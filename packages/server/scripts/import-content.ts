import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOT_OWNER_ID,
  Position,
  STADIUM_LEVELS,
  STARTING_STADIUM_CAPACITY,
  STARTING_STADIUM_LEVEL,
  StarLevel,
  buildPlayerFromRating,
  backfillContract,
  createRng,
  generateAcademy,
  generateStarterSquad,
  isValidCountryCode,
  canonicalCountryCode,
  LEAGUE_CAPACITY,
} from '@tactical-arena/shared';
import { prisma } from '../src/db/prisma.js';
import { getGameState } from '../src/services/gameStateService.js';
import { forceStartLeague, joinOrCreateLeague } from '../src/services/leagueService.js';
import { sponsorBoardFor } from '../src/services/sponsorBoardService.js';
import { createCup } from '../src/services/cupService.js';
import { ensureManagersForAllClubs, ensureUnemployedPool } from '../src/services/managerService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const contentDir = path.join(repoRoot, 'content');

const reimportSquads = process.argv.includes('--reimport-squads');

interface ClubRow {
  slug: string;
  name: string;
  country: string;
  division: number;
  /** Real-world stadium capacity, if known (e.g. imported from a real league's venue data) — used to
   *  seed stadiumLevel/stadiumCapacity at creation instead of the default starter stadium. Undefined for
   *  rows with no `stadium_capacity` value (or an invalid one), which just get the usual default. */
  stadiumCapacity?: number;
  /** 1-99 — pins a synthetic squad's overall quality (see generateStarterSquad) instead of leaving it to
   *  chance, when there's no real players.csv roster for this club. Undefined falls back to the normal
   *  random range. See `SKILL_LEVEL_SOURCE_NOTE` below for how these numbers were derived. */
  skillLevel?: number;
  state?: string | null;
}

/**
 * `skill_level` values in clubs.csv for the real Brasileirão Série A clubs were derived from the 2025
 * season's final standings (points out of 38 games), linearly mapped from the 2025 points range onto a
 * 58-78 in-game skill band: `58 + (points - 15) / (79 - 15) * 20`. 15 is a stand-in floor for the four
 * clubs that were relegated after the 2024 season (Athletico Paranaense, Criciúma, Atlético Goianiense,
 * Cuiabá) and so didn't play — and have no points in — the actual 2025 Série A season; they're pinned to
 * the weakest tier (58) since a team that dropped to Série B is presumably weaker than the real 2025
 * bottom side (Sport, 17 points), not because 15 is a real number. Every other club's number is that
 * club's real 2025 points run through the formula above. This is a rough proxy, not a claim of precision
 * — the point is relative ordering (a title-winning squad clearly stronger than a relegation-zone one),
 * not an exact rating.
 */

/** The highest stadium tier whose own capacity doesn't exceed the real one — a 78,838-seat Maracanã
 *  lands on level 4 (75,000), not level 5 (120,000), since claiming a bigger capacity than reality would
 *  overstate matchday revenue. The club still starts at that real capacity number exactly, this just picks
 *  which upgrade tier it's considered "already at" for progression purposes. */
function stadiumLevelForCapacity(capacity: number): number {
  const fitting = STADIUM_LEVELS.filter((l) => l.capacity <= capacity);
  return fitting.length > 0 ? fitting[fitting.length - 1].level : STARTING_STADIUM_LEVEL;
}

interface PlayerRow {
  clubSlug: string;
  name: string;
  position: Position;
  age: number;
  nationality: string;
  rating: number;
  starLevel: StarLevel;
  diferenciado: boolean;
}

/** Minimal CSV parser: comma-separated, double-quoted fields (with "" as an escaped quote) supported. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current);
    return fields.map((f) => f.trim());
  }

  const header = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, i) => (row[key] = values[i] ?? ''));
    return row;
  });
}

function loadClubs(): ClubRow[] {
  const filePath = path.join(contentDir, 'clubs.csv');
  const rows = parseCsv(fs.readFileSync(filePath, 'utf-8'));
  const clubs: ClubRow[] = [];
  const seenSlugs = new Set<string>();

  for (const [i, row] of rows.entries()) {
    const line = i + 2; // +1 for 0-index, +1 for header row
    if (!row.slug) {
      console.warn(`clubs.csv linha ${line}: sem slug, pulando`);
      continue;
    }
    if (seenSlugs.has(row.slug)) {
      console.warn(`clubs.csv linha ${line}: slug "${row.slug}" duplicado neste arquivo, pulando`);
      continue;
    }
    const country = canonicalCountryCode(row.country);
    if (!isValidCountryCode(country)) {
      console.warn(`clubs.csv linha ${line} (${row.slug}): país inválido "${row.country}", pulando`);
      continue;
    }
    const division = Number(row.division);
    if (!Number.isInteger(division) || division < 1) {
      console.warn(`clubs.csv linha ${line} (${row.slug}): divisão inválida "${row.division}", pulando`);
      continue;
    }
    if (!row.name) {
      console.warn(`clubs.csv linha ${line} (${row.slug}): sem nome, pulando`);
      continue;
    }

    // Optional column — most rows (hand-made example clubs) leave it blank and get the default starter
    // stadium; only present for clubs imported with real-world venue data.
    let stadiumCapacity: number | undefined;
    if (row.stadium_capacity) {
      const parsed = Number(row.stadium_capacity);
      if (Number.isFinite(parsed) && parsed > 0) {
        stadiumCapacity = Math.round(parsed);
      } else {
        console.warn(`clubs.csv linha ${line} (${row.slug}): stadium_capacity inválida "${row.stadium_capacity}", ignorando`);
      }
    }

    // Optional column — see SKILL_LEVEL_SOURCE_NOTE above. Only meaningful for clubs with no real
    // players.csv roster, since buildSquad ignores it entirely (real ratings take precedence).
    let skillLevel: number | undefined;
    if (row.skill_level) {
      const parsed = Number(row.skill_level);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 99) {
        skillLevel = Math.round(parsed);
      } else {
        console.warn(`clubs.csv linha ${line} (${row.slug}): skill_level inválida "${row.skill_level}", ignorando`);
      }
    }

    let state: string | null = null;
    if (row.state) {
      state = row.state.trim() || null;
    }

    seenSlugs.add(row.slug);
    clubs.push({ slug: row.slug, name: row.name, country, division, stadiumCapacity, skillLevel, state });
  }

  return clubs;
}

const VALID_POSITIONS: Position[] = ['GK', 'DEF', 'LAT', 'MID', 'ATT'];

/** The position codes the second layout uses, mapped onto the game's own. */
const FOREIGN_POSITIONS: Record<string, Position> = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'ATT' };

/**
 * players.csv carries two different column layouts under one header.
 *
 * The header describes `club_slug,name,position,age,nationality,rating,star_level,diferenciado`, and 6.172
 * rows follow it. The other 45.412 are laid out `club_slug,name,age,position,rating,star,diferenciado`,
 * with no nationality and with DF/MF/FW where the game writes DEF/MID/ATT. Read by header alone, every one
 * of those rows hit "posição inválida" and was dropped, so 1.311 of the 1.505 clubs in the world were built
 * from a synthetic squad while their real players sat unread in the file.
 *
 * The layouts are told apart by which of the two middle columns holds a number, which is unambiguous: one
 * layout has the age there, the other a position code.
 */
function normaliseRow(row: Record<string, string>, clubCountry: string | undefined) {
  const ageFirst = /^\d+$/.test((row.position ?? '').trim());
  if (!ageFirst) return { ...row, position: row.position?.toUpperCase() };

  const foreign = FOREIGN_POSITIONS[(row.age ?? '').toUpperCase().trim()];
  return {
    ...row,
    position: foreign ?? row.age?.toUpperCase(),
    age: row.position,
    rating: row.nationality,
    // This layout does not record where a player is from, so they are from where the club is.
    nationality: clubCountry ?? '',
    star_level: row.rating === '1' ? 'NATURAL' : 'NONE',
    diferenciado: row.star_level === '1' ? 'S' : '',
  };
}

function loadPlayers(countryBySlug: Map<string, string>): Map<string, PlayerRow[]> {
  const filePath = path.join(contentDir, 'players.csv');
  const rows = parseCsv(fs.readFileSync(filePath, 'utf-8'));
  const byClub = new Map<string, PlayerRow[]>();

  for (const [i, raw] of rows.entries()) {
    const line = i + 2;
    const row = normaliseRow(raw, countryBySlug.get(raw.club_slug));
    const position = row.position as Position;
    if (!VALID_POSITIONS.includes(position)) {
      console.warn(`players.csv linha ${line}: posição inválida "${raw.position}", pulando`);
      continue;
    }
    const age = Number(row.age);
    if (!Number.isInteger(age) || age < 15 || age > 45) {
      console.warn(`players.csv linha ${line} (${row.name}): idade inválida "${row.age}", pulando`);
      continue;
    }
    const nationality = canonicalCountryCode(row.nationality);
    if (!isValidCountryCode(nationality)) {
      console.warn(`players.csv linha ${line} (${row.name}): nacionalidade inválida "${row.nationality}", pulando`);
      continue;
    }
    const rating = Number(row.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 99) {
      console.warn(`players.csv linha ${line} (${row.name}): nota inválida "${row.rating}", pulando`);
      continue;
    }
    let starLevel: StarLevel = 'NONE';
    if (row.star_level) {
      const parsed = row.star_level.toUpperCase() as StarLevel;
      if (['NONE', 'NATURAL', 'DEVELOPED'].includes(parsed)) {
        starLevel = parsed;
      } else {
        console.warn(`players.csv linha ${line} (${row.name}): star_level inválido "${row.star_level}", usando NONE`);
      }
    }
    // Optional column — "S" (or "TRUE") marks a real-world standout, anything else is left unflagged.
    const diferenciado = ['S', 'TRUE', 'SIM'].includes((row.diferenciado ?? '').toUpperCase().trim());
    if (!row.club_slug || !row.name) {
      console.warn(`players.csv linha ${line}: sem club_slug ou nome, pulando`);
      continue;
    }

    const list = byClub.get(row.club_slug) ?? [];
    list.push({ clubSlug: row.club_slug, name: row.name, position, age, nationality, rating, starLevel, diferenciado });
    byClub.set(row.club_slug, list);
  }

  for (const squad of byClub.values()) assignFullbacks(squad);

  return byClub;
}

/**
 * Turns some of a squad's centre-backs into fullbacks, when the source could not say which were which.
 *
 * The second players.csv layout only knows DF, while every formation in the game fields two LATs (see
 * FORMATION_SLOTS). Imported as written, those clubs would field two centre-backs out of position on the
 * touchlines for the rest of the game's life. There is nothing in the file to recover the real answer
 * from, so half the defenders become fullbacks, which is the shape of an actual squad. Taken by
 * alternating index rather than at random, so the same file always imports the same way.
 *
 * Squads that do name their fullbacks are left exactly as they are.
 */
function assignFullbacks(squad: PlayerRow[]): void {
  if (squad.some((p) => p.position === 'LAT')) return;

  const centreBacks = squad.filter((p) => p.position === 'DEF');
  // Two at the back is the fewest any formation asks for; a squad that thin keeps all of them.
  if (centreBacks.length < 4) return;

  for (let i = 1; i < centreBacks.length; i += 2) centreBacks[i].position = 'LAT';
}

function buildSquad(clubId: string, clubSlug: string, playerRows: PlayerRow[]) {
  const rng = createRng(`${clubSlug}-import`);
  return playerRows.map((row, index) =>
    buildPlayerFromRating(
      {
        id: `${clubId}-p${index}`,
        name: row.name,
        position: row.position,
        age: row.age,
        nationality: row.nationality,
        rating: row.rating,
        starLevel: row.starLevel,
        diferenciado: row.diferenciado,
      },
      rng,
    ),
  );
}

/** The cup engine only accepts a power-of-2 club count (see generateFirstRoundFixtures), so this takes
 *  the strongest 16 (by skill_level) of the real, content-imported BRA clubs rather than all 20-ish —
 *  a round-of-16 knockout, not a full replica of the real competition's much larger early rounds. Skips
 *  quietly (not an error) if a "Copa do Brasil" for this season already exists, or if there aren't yet
 *  enough real BRA clubs with a skill_level to seed a meaningful bracket. */
const CUP_BRACKET_SIZE = 16;

/** Members of CONMEBOL, the Taça Libertadores' eligible countries. */
const CONMEBOL_COUNTRIES = ['BRA', 'URU', 'ARG', 'CHI', 'COL', 'PER', 'ECU', 'PAR', 'BOL', 'VEN'];

async function createNationalCupsIfNeeded(clubRows: ClubRow[]): Promise<void> {
  const season = new Date().getFullYear();

  const competitions = [
    { countryCode: 'BRA', cupName: 'Copa do Brasil' },
    { countryCode: 'ESP', cupName: 'Copa del Rey' },
    { countryCode: 'ENG', cupName: 'FA Cup' },
    { countryCode: 'ITA', cupName: 'Copa Itália' },
    { countryCode: 'GER', cupName: 'DFB-Pokal' },
    { countryCode: 'CONMEBOL', cupName: 'Taça Libertadores' },
  ];

  for (const comp of competitions) {
    const existing = await prisma.cup.findFirst({
      where: { countryCode: comp.countryCode, name: comp.cupName, season },
    });
    if (existing) continue;

    let realRows: ClubRow[];
    if (comp.countryCode === 'CONMEBOL') {
      realRows = clubRows.filter((c) => CONMEBOL_COUNTRIES.includes(c.country) && c.skillLevel !== undefined);
    } else {
      realRows = clubRows.filter((c) => c.country === comp.countryCode && c.skillLevel !== undefined);
    }

    if (realRows.length < CUP_BRACKET_SIZE) continue;

    const topRows = [...realRows].sort((a, b) => (b.skillLevel ?? 0) - (a.skillLevel ?? 0)).slice(0, CUP_BRACKET_SIZE);
    const records = await prisma.club.findMany({ where: { slug: { in: topRows.map((r) => r.slug) } } });
    const bySlug = new Map(records.map((r) => [r.slug, r.id]));
    const clubIds = topRows.map((row) => bySlug.get(row.slug)).filter((id): id is string => !!id);
    if (clubIds.length !== CUP_BRACKET_SIZE) continue;

    await createCup(comp.cupName, comp.countryCode, clubIds);
    console.log(`+ ${comp.cupName} criada com os ${clubIds.length} principais clubes (${comp.countryCode}).`);
  }
}

/**
 * A content-imported country can field fewer than LEAGUE_CAPACITY (e.g. the 18 real Bundesliga clubs),
 * in which case joinOrCreateLeague leaves its league OPEN forever — it only auto-starts on reaching an
 * even LEAGUE_CAPACITY — and an OPEN league has no fixtures, so those clubs would never play a match.
 * This force-starts every OPEN league of the current season that already has an even number of clubs.
 */
async function startEvenCountOpenLeagues(): Promise<number> {
  const season = (await getGameState()).seasonYear;
  const open = await prisma.league.findMany({ where: { status: 'OPEN', season } });
  let started = 0;
  for (const league of open) {
    const clubIds = JSON.parse(league.clubIdsJson) as string[];
    if (clubIds.length < 2 || clubIds.length % 2 !== 0) continue;
    try {
      await forceStartLeague(league.id, BOT_OWNER_ID);
      started += 1;
      console.log(`+ ${league.name} iniciada com ${clubIds.length} clubes (${league.countryCode}).`);
    } catch (err) {
      console.warn(`${league.name}: não foi possível iniciar a liga —`, err);
    }
  }
  return started;
}

/**
 * How many divisions a country runs. Everything below the last one exists without a domestic league.
 *
 * The club database marks every one of its 1,526 clubs as division 1, which is not a pyramid, it is a
 * pile: Brazil alone brings 243. Two tiers is what a manager can actually be promoted into and relegated
 * out of, and it keeps a matchday to a size the world can play — the deeper the pyramid, the more
 * fixtures every Sunday, for tiers nobody will ever open.
 */
const DIVISIONS_PER_COUNTRY = 2;

function divisionsForCountry(countryCode: string): number {
  return countryCode === 'BRA' ? 4 : DIVISIONS_PER_COUNTRY;
}

/**
 * Reads each country's divisions from the file, and falls back to squad strength where the file is silent.
 *
 * This used to sort every country by squad average and cut at twenty, because the `division` column said 1
 * for all 1,526 clubs — a pile rather than a pyramid. That column is now written, and the strength sort
 * turned out to be actively wrong: the ratings in `players.csv` are noise around 64, so Benfica averages
 * 64.0 while Benfica B averages 65.8 and the reserve side was being promoted over the first team. Portugal
 * opened with Benfica B in the top flight, Argentina with Acassuso and All Boys, and Brazil with the 2024
 * Série A, which is the version of this the player noticed.
 *
 * Strength is kept only for countries whose rows still say 1 for everyone, where there is nothing else to
 * go on. It is a poor measure and it is used only where the alternative is alphabetical order.
 */
function assignDivisions(
  clubs: ClubRow[],
  playersByClub: Map<string, { rating: number }[]>,
): Map<string, number | null> {
  const strengthOf = (slug: string) => {
    const squad = playersByClub.get(slug) ?? [];
    if (squad.length === 0) return 0;
    return squad.reduce((sum, p) => sum + p.rating, 0) / squad.length;
  };

  const byCountry = new Map<string, ClubRow[]>();
  for (const club of clubs) {
    const list = byCountry.get(club.country) ?? [];
    list.push(club);
    byCountry.set(club.country, list);
  }

  const divisionBySlug = new Map<string, number | null>();
  for (const [, list] of byCountry) {
    const escrito = list.some((c) => c.division > 1);

    /**
     * Each division is filled to capacity and then made even.
     *
     * A round robin needs an even number of clubs, so a tier left with an odd one never generates a
     * fixture list and sits OPEN forever — which measured at 57 of 158 leagues on the first full import,
     * every one of them a country whose clubs would simply never play.
     */
    const ordenado = escrito
      ? [...list].sort((a, b) => a.division - b.division)
      : [...list].sort((a, b) => strengthOf(b.slug) - strengthOf(a.slug));

    const maxDiv = divisionsForCountry(list[0].country);
    if (escrito) {
      for (let tier = 1; tier <= maxDiv; tier += 1) {
        const doTier = ordenado.filter((c) => c.division === tier).slice(0, LEAGUE_CAPACITY);
        // O mais fraco de um tier ímpar espera a próxima temporada, senão a liga nunca sorteia.
        const size = doTier.length - (doTier.length % 2);
        for (let i = 0; i < size; i += 1) divisionBySlug.set(doTier[i].slug, tier);
        for (let i = size; i < doTier.length; i += 1) divisionBySlug.set(doTier[i].slug, null);
      }
      for (const club of ordenado) {
        if (!divisionBySlug.has(club.slug)) divisionBySlug.set(club.slug, null);
      }
      continue;
    }

    let placed = 0;
    for (let tier = 1; tier <= maxDiv; tier += 1) {
      const remaining = ordenado.length - placed;
      if (remaining < 2) break;
      const wanted = Math.min(LEAGUE_CAPACITY, remaining);
      const size = wanted - (wanted % 2);
      for (let i = 0; i < size; i += 1) divisionBySlug.set(ordenado[placed + i].slug, tier);
      placed += size;
    }
    for (let i = placed; i < ordenado.length; i += 1) divisionBySlug.set(ordenado[i].slug, null);
  }
  return divisionBySlug;
}

async function run() {
  const clubs = loadClubs();
  const playersByClub = loadPlayers(new Map(clubs.map((c) => [c.slug, c.country])));
  const divisionBySlug = assignDivisions(clubs, playersByClub);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  /**
   * A temporada em que o mundo nasce, para os contratos já saírem daqui com prazo.
   *
   * Carimbar aqui e não no arranque do servidor não é preferência de estilo: são 1.811 clubes, e um
   * backfill que percorre todos eles antes de o servidor escutar estourou o smoke test do empacotamento
   * desktop, que espera dez segundos pelo /health. O importador já está a escrever cada clube uma vez —
   * o prazo entra nessa mesma escrita, de graça.
   */
  const temporadaDeNascimento = (await getGameState()).seasonYear;

  for (const clubRow of clubs) {
    try {
      const playerRows = playersByClub.get(clubRow.slug) ?? [];
      const existing = await prisma.club.findUnique({ where: { slug: clubRow.slug } });

      if (!existing) {
        const hash = createHash('sha256').update(`tactical-arena-club:${clubRow.slug}`).digest('hex');
        const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
        let players;
        if (playerRows.length === 0) {
          // No roster data at all for this club (e.g. a real club identity imported without real player
          // data) — generate a squad the same way the game already does for its own random clubs, rather
          // than refusing to create a club that only lacks player rows because none exist yet. skillLevel
          // (if the row has one) pins the squad's overall quality to something real instead of random.
          players = generateStarterSquad(id, clubRow.country, undefined, clubRow.skillLevel);
        } else {
          const goalkeepers = playerRows.filter((p) => p.position === 'GK').length;
          if (playerRows.length < 11 || goalkeepers < 1) {
            console.warn(
              `${clubRow.slug}: elenco insuficiente em players.csv (${playerRows.length} jogadores, ${goalkeepers} goleiro(s)) — precisa de pelo menos 11 jogadores com 1 goleiro. Pulando clube.`,
            );
            skipped++;
            continue;
          }
          players = buildSquad(id, clubRow.slug, playerRows);
        }
        const academyPlayers = generateAcademy(id, clubRow.country);

        /**
         * Contrato espalhado no tempo, pela mesma regra que cura um save antigo.
         *
         * Dar a todos o mesmo ano de término faria o mundo inteiro vencer contrato na mesma virada, e cada
         * elenco perderia metade da gente de uma vez. A semente vem do slug para o mundo nascer igual em
         * duas instalações: reinstalar o jogo não pode mudar os prazos por baixo do técnico.
         */
        const rngContratos = createRng(`contratos-${clubRow.slug}`);
        players = players.map((p) => backfillContract(p, temporadaDeNascimento, rngContratos));
        const academiaComContrato = academyPlayers.map((p) => backfillContract(p, temporadaDeNascimento, rngContratos));

        const stadiumLevel = clubRow.stadiumCapacity ? stadiumLevelForCapacity(clubRow.stadiumCapacity) : STARTING_STADIUM_LEVEL;
        const stadiumCapacity = clubRow.stadiumCapacity ?? STARTING_STADIUM_CAPACITY;

        await prisma.club.create({
          data: {
            id,
            name: clubRow.name,
            ownerId: BOT_OWNER_ID,
            slug: clubRow.slug,
            country: clubRow.country,
            state: clubRow.state,
            playersJson: JSON.stringify(players),
            academyPlayersJson: JSON.stringify(academiaComContrato),
            // Without a board this club would run at a loss from its first week and never sign a deal,
            // because only a club's owner can. See sponsorBoardFor.
            sponsorshipsJson: JSON.stringify(
              sponsorBoardFor({
                id,
                players,
                stadiumLevel,
                stadiumCapacity,
                division: divisionBySlug.get(clubRow.slug) ?? divisionsForCountry(clubRow.country),
                titlesWon: 0,
              }),
            ),
            stadiumLevel,
            stadiumCapacity,
          },
        });
        /**
         * A club below the last division simply has no league. It still exists, still has a squad and
         * still trades — it is just not playing a championship this game models.
         */
        const division = divisionBySlug.get(clubRow.slug) ?? null;
        if (division !== null) await joinOrCreateLeague(id, clubRow.country, division);
        created++;
        const squadSource = playerRows.length === 0 ? 'elenco sintético' : 'players.csv';
        console.log(
          `+ ${clubRow.slug} (${clubRow.name}) criado — ${players.length} jogadores (${squadSource}), ${clubRow.country} divisão ${divisionBySlug.get(clubRow.slug) ?? 'sem liga'}, estádio nível ${stadiumLevel} (${stadiumCapacity} lugares)`,
        );
      } else {
        // Country/division changes aren't applied on an update — moving an existing club between
        // leagues is a bigger operation (fixtures, standings) than this importer takes on.
        const data: { name?: string; playersJson?: string } = {};
        if (existing.name !== clubRow.name) data.name = clubRow.name;

        if (reimportSquads) {
          if (playerRows.length === 0) {
            // No real roster — regenerate the synthetic squad, picking up any skill_level change in
            // clubs.csv since the club was first created (e.g. newly-added real-world standings data).
            data.playersJson = JSON.stringify(generateStarterSquad(existing.id, clubRow.country, undefined, clubRow.skillLevel));
          } else {
            const goalkeepers = playerRows.filter((p) => p.position === 'GK').length;
            if (playerRows.length >= 11 && goalkeepers >= 1) {
              data.playersJson = JSON.stringify(buildSquad(existing.id, clubRow.slug, playerRows));
            } else {
              console.warn(`${clubRow.slug}: --reimport-squads pedido mas elenco insuficiente em players.csv, mantendo elenco atual`);
            }
          }
        }

        if (Object.keys(data).length > 0) {
          await prisma.club.update({ where: { id: existing.id }, data });
          updated++;
          console.log(`~ ${clubRow.slug} atualizado`);
        }
      }
    } catch (err) {
      console.warn(`${clubRow.slug}: erro ao importar, pulando —`, err);
      skipped++;
    }
  }

  console.log(`\nImportação concluída: ${created} criado(s), ${updated} atualizado(s), ${skipped} pulado(s).`);

  await createNationalCupsIfNeeded(clubs);
  await startEvenCountOpenLeagues();

  /**
   * O comando de cada clube, por último, quando todos já existem.
   *
   * Os nomes reais vêm de `content/managers.csv`, extraído uma vez por `scripts/extract-managers.mjs`. Onde
   * não há nome real — a origem cobre 1.465 dos nossos clubes, e a Romênia inteira não está lá — o gerador
   * do próprio jogo inventa um com o sabor do continente.
   */
  const nomesReais = new Map<string, string>();
  const arquivoTreinadores = path.join(contentDir, 'managers.csv');
  if (fs.existsSync(arquivoTreinadores)) {
    const bruto = fs.readFileSync(arquivoTreinadores, 'utf8').replace(/^\uFEFF/, '');
    const linhas = bruto.split(/\r?\n/).filter((l) => l.trim());
    for (const linha of linhas.slice(1)) {
      const virgula = linha.indexOf(',');
      if (virgula > 0) nomesReais.set(linha.slice(0, virgula).trim(), linha.slice(virgula + 1).trim());
    }
  } else {
    console.warn('managers.csv não encontrado — todos os treinadores serão gerados.');
  }

  const criados = await ensureManagersForAllClubs(nomesReais);
  const bolsao = await ensureUnemployedPool();
  console.log(`Treinadores: ${criados} clubes ganharam comando (${nomesReais.size} nomes reais disponíveis), ${bolsao} no bolsão de desempregados.`);

  await prisma.$disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOT_OWNER_ID,
  Club,
  ModPack,
  ModPackClub,
  ModPackImportResult,
  Player,
  PlayerAttributes,
  Position,
  PreferredFoot,
  validateCrestDimensions,
  StarLevel,
  calculateMarketValue,
  calculateOverall,
  calculateReleaseClause,
  calculateWage,
  defaultDetailedAttributes,
  generateAcademy,
  generateStarterSquad,
  isValidCountryCode,
  KitPattern,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub, vacatedRoleFields } from './clubService.js';
import { joinOrCreateLeague } from './leagueService.js';

export class TeamEditorError extends Error {}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Guards every filesystem write this service does — a slug flows straight into a file path (crest PNG),
 *  and the mod-pack JSON is the most realistic path-traversal vector (a hand-edited file is trivial),
 *  not just the interactive create-club form. Applied on every write path, not just the obvious one. */
function assertValidSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) {
    throw new TeamEditorError('Slug inválido — use apenas letras minúsculas, números e hífen.');
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'P2002';
}

/**
 * Mirrors the two branches `resolveCrestsDir` (app.ts) already has for STATIC SERVING, but for WRITING —
 * that function intentionally returns null in the bundled/packaged case, so it can't be reused as-is here.
 * In practice this whole service only ever runs when DESKTOP_MODE is set (see middleware/desktopOnly.ts),
 * and DESKTOP_MODE and WEB_DIST_PATH are set together by the same block in packages/desktop/src/main.js —
 * so the packaged branch is always the one taken outside of manual dev testing.
 */
function resolveWritableCrestsDir(): string {
  const webDistPath = process.env['WEB_DIST_PATH'];
  if (webDistPath) return path.join(webDistPath, 'crests');
  try {
    // Dev-only fallback (unbundled ESM) — esbuild's CJS bundle leaves `import.meta.url` empty, so this
    // throws if ever reached there. Never actually reached in the packaged build: WEB_DIST_PATH and
    // DESKTOP_MODE are set together by the same block in packages/desktop/src/main.js.
    const dirname = path.dirname(fileURLToPath(import.meta.url)); // packages/server/src/services
    return path.join(dirname, '..', '..', '..', '..', 'content', 'crests');
  } catch {
    throw new TeamEditorError('Não foi possível localizar a pasta de escudos.');
  }
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const MAX_CREST_BYTES = 2 * 1024 * 1024;

function writeCrestFile(slug: string, base64Png: string): void {
  assertValidSlug(slug);
  const buffer = Buffer.from(base64Png, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_CREST_BYTES) {
    throw new TeamEditorError('Escudo inválido: arquivo vazio ou maior que 2MB.');
  }
  if (!buffer.subarray(0, 4).equals(PNG_MAGIC)) {
    throw new TeamEditorError('Escudo inválido: o arquivo precisa ser um PNG.');
  }

  /**
   * The size, checked against the same spec the creator screen shows the manager.
   *
   * A PNG carries its dimensions in the IHDR chunk, which is always the first one: eight bytes of signature,
   * four of length, four of type, then width and height as big-endian 32-bit integers. No decoding needed,
   * and no image library for a check this small.
   */
  if (buffer.length >= 24) {
    const dimensions = validateCrestDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
    if (!dimensions.ok) throw new TeamEditorError(`Escudo inválido: ${dimensions.problem}`);
  }
  const dir = resolveWritableCrestsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.png`), buffer);
}

function readCrestBase64(slug: string): string | null {
  const file = path.join(resolveWritableCrestsDir(), `${slug}.png`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file).toString('base64');
}

export async function uploadCrest(slug: string, base64Png: string): Promise<void> {
  writeCrestFile(slug, base64Png);
  await prisma.club.updateMany({ where: { slug }, data: { crestBase64: base64Png } }).catch(() => {});
}

// ---- Player edit ----

export interface PlayerEditPatch {
  name?: string;
  age?: number;
  nationality?: string;
  position?: Position;
  preferredFoot?: PreferredFoot;
  attributes?: Partial<PlayerAttributes>;
}

function clampAttribute(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

/**
 * Applies only the editable fields from `patch`, spreading everything else — including `potential`,
 * `starLevel`, `traits`, `developmentPoints`, morale/fatigue/commitment, suspensions, injuries — straight
 * from the stored player, untouched. This is a whitelist, not a blacklist: there is no code path here that
 * ever reads `patch.potential` or `patch.starLevel`, so there's nothing to smuggle regardless of what a
 * tampered client sends. Derived fields (overall/marketValue/wage/releaseClause) are recomputed from the
 * shared pure functions in player.ts — never accepted from the client either.
 */
function applyEditableFields(player: Player, patch: PlayerEditPatch): Player {
  const name = patch.name?.trim() || player.name;
  const age = patch.age !== undefined ? Math.max(15, Math.min(45, Math.round(patch.age))) : player.age;
  const nationality = patch.nationality ?? player.nationality;
  const position = patch.position ?? player.position;
  const preferredFoot = patch.preferredFoot ?? player.preferredFoot;
  const attributes: PlayerAttributes = {
    pace: clampAttribute(patch.attributes?.pace ?? player.attributes.pace),
    finishing: clampAttribute(patch.attributes?.finishing ?? player.attributes.finishing),
    passing: clampAttribute(patch.attributes?.passing ?? player.attributes.passing),
    defending: clampAttribute(patch.attributes?.defending ?? player.attributes.defending),
    physical: clampAttribute(patch.attributes?.physical ?? player.attributes.physical),
    goalkeeping: clampAttribute(patch.attributes?.goalkeeping ?? player.attributes.goalkeeping),
  };

  const overall = calculateOverall(position, attributes);
  const marketValue = calculateMarketValue(age, overall, player.potential, player.starLevel);
  const wage = calculateWage(marketValue);
  const releaseClause = calculateReleaseClause(marketValue);

  return { ...player, name, age, nationality, position, preferredFoot, attributes, overall, marketValue, wage, releaseClause };
}

export async function updatePlayer(clubId: string, playerId: string, patch: PlayerEditPatch): Promise<Club> {
  const club = await getClub(clubId);
  const index = club.players.findIndex((p) => p.id === playerId);
  if (index === -1) {
    throw new TeamEditorError('Jogador não pertence a este clube');
  }

  const players = [...club.players];
  players[index] = applyEditableFields(players[index], patch);

  await prisma.club.update({ where: { id: clubId }, data: { playersJson: JSON.stringify(players) } });
  return { ...club, players };
}

// ---- Create / delete player ----

export interface NewPlayerInput {
  name: string;
  age: number;
  nationality: string;
  position: Position;
  preferredFoot: PreferredFoot;
  attributes: PlayerAttributes;
}

export async function createPlayer(clubId: string, input: NewPlayerInput): Promise<Club> {
  const club = await getClub(clubId);

  const attributes: PlayerAttributes = {
    pace: clampAttribute(input.attributes.pace),
    finishing: clampAttribute(input.attributes.finishing),
    passing: clampAttribute(input.attributes.passing),
    defending: clampAttribute(input.attributes.defending),
    physical: clampAttribute(input.attributes.physical),
    goalkeeping: clampAttribute(input.attributes.goalkeeping),
  };
  const overall = calculateOverall(input.position, attributes);
  // Fixed policy for editor-created players (no primitive exists to derive these from hand-picked
  // attributes the way generation/progression does): no growth ceiling above their current overall, and
  // never a "craque" star billing — those are earned in-game, not typed in.
  const potential = overall;
  const starLevel: StarLevel = 'NONE';
  const marketValue = calculateMarketValue(input.age, overall, potential, starLevel);

  const player: Player = {
    id: `${clubId}-editor-${randomUUID()}`,
    name: input.name.trim() || 'Jogador Sem Nome',
    position: input.position,
    preferredFoot: input.preferredFoot,
    age: Math.max(15, Math.min(45, Math.round(input.age))),
    attributes,
    detailedAttributes: defaultDetailedAttributes(),
    morale: 50,
    fatigue: 0,
    commitment: 50,
    marketValue,
    overall,
    potential,
    starLevel,
    traits: [],
    functions: [],
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    nationality: input.nationality,
    wage: calculateWage(marketValue),
    releaseClause: calculateReleaseClause(marketValue),
  };

  const players = [...club.players, player];
  await prisma.club.update({ where: { id: clubId }, data: { playersJson: JSON.stringify(players) } });
  return { ...club, players };
}

export async function deletePlayer(clubId: string, playerId: string): Promise<Club> {
  const club = await getClub(clubId);
  if (!club.players.some((p) => p.id === playerId)) {
    throw new TeamEditorError('Jogador não pertence a este clube');
  }

  const players = club.players.filter((p) => p.id !== playerId);
  const roleVacated = vacatedRoleFields(club, [playerId]);
  const lostTutor = club.tutorPlayerId === playerId;

  await prisma.club.update({
    where: { id: clubId },
    data: { playersJson: JSON.stringify(players), ...roleVacated, ...(lostTutor ? { tutorPlayerId: null } : {}) },
  });
  return { ...club, players, ...roleVacated, ...(lostTutor ? { tutorPlayerId: null } : {}) };
}

// ---- Instant transfer ("seletor de transferências") ----

/** Admin-style instant move — no budget/wage checks, no listing, no negotiation. Not restricted to clubs
 *  the requesting user owns: the editor curates the whole database, not just "your" club. */
export async function moveTransfer(playerId: string, fromClubId: string, toClubId: string): Promise<{ from: Club; to: Club }> {
  if (fromClubId === toClubId) {
    throw new TeamEditorError('Clube de origem e destino são o mesmo.');
  }

  const fromClub = await getClub(fromClubId);
  const toClub = await getClub(toClubId);
  const player = fromClub.players.find((p) => p.id === playerId);
  if (!player) {
    throw new TeamEditorError('Jogador não pertence ao clube de origem');
  }

  const fromPlayers = fromClub.players.filter((p) => p.id !== playerId);
  const toPlayers = [...toClub.players, player];
  const roleVacated = vacatedRoleFields(fromClub, [playerId]);
  const lostTutor = fromClub.tutorPlayerId === playerId;

  await prisma.$transaction([
    prisma.club.update({
      where: { id: fromClub.id },
      data: { playersJson: JSON.stringify(fromPlayers), ...roleVacated, ...(lostTutor ? { tutorPlayerId: null } : {}) },
    }),
    prisma.club.update({ where: { id: toClub.id }, data: { playersJson: JSON.stringify(toPlayers) } }),
  ]);

  return {
    from: { ...fromClub, players: fromPlayers, ...roleVacated, ...(lostTutor ? { tutorPlayerId: null } : {}) },
    to: { ...toClub, players: toPlayers },
  };
}

// ---- Create club ----

export interface NewClubInput {
  name: string;
  slug: string;
  country: string;
  division: number;
}

export async function createEditorClub(input: NewClubInput): Promise<Club> {
  assertValidSlug(input.slug);
  if (!isValidCountryCode(input.country)) {
    throw new TeamEditorError(`País inválido: ${input.country}`);
  }
  if (!Number.isInteger(input.division) || input.division < 1) {
    throw new TeamEditorError('Divisão inválida — use um número inteiro a partir de 1.');
  }

  const id = randomUUID();
  const players = generateStarterSquad(id, input.country);
  const academyPlayers = generateAcademy(id, input.country);

  try {
    await prisma.club.create({
      data: {
        id,
        name: input.name,
        ownerId: BOT_OWNER_ID,
        slug: input.slug,
        country: input.country,
        playersJson: JSON.stringify(players),
        academyPlayersJson: JSON.stringify(academyPlayers),
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new TeamEditorError(`Já existe um clube com o slug "${input.slug}".`);
    }
    throw err;
  }

  await joinOrCreateLeague(id, input.country, input.division);
  return getClub(id);
}

// ---- Club Identity & Auto-Squad ----

export interface ClubIdentityPatch {
  name?: string;
  stadiumName?: string;
  stadiumCapacity?: number;
  city?: string | null;
  budget?: number;
  kitPattern?: KitPattern;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export async function updateClubIdentity(clubId: string, patch: ClubIdentityPatch): Promise<Club> {
  const club = await getClub(clubId);
  const name = patch.name?.trim() || club.name;
  const stadiumName = patch.stadiumName !== undefined ? patch.stadiumName.trim() : club.stadiumName;
  const stadiumCapacity = patch.stadiumCapacity !== undefined ? Math.max(1000, Math.round(patch.stadiumCapacity)) : club.stadiumCapacity;
  const city = patch.city !== undefined ? patch.city : club.city;
  const budget = patch.budget !== undefined ? Math.max(0, Math.round(patch.budget)) : club.budget;
  const kitPattern = patch.kitPattern !== undefined ? patch.kitPattern : club.kitPattern;
  const primaryColor = patch.primaryColor !== undefined ? patch.primaryColor : club.primaryColor;
  const secondaryColor = patch.secondaryColor !== undefined ? patch.secondaryColor : club.secondaryColor;

  await prisma.club.update({
    where: { id: clubId },
    data: {
      name,
      stadiumName,
      stadiumCapacity,
      city,
      budget,
      kitPattern,
      primaryColor,
      secondaryColor,
    },
  });

  return getClub(clubId);
}

export async function autoGenerateClubSquad(clubId: string): Promise<Club> {
  const club = await getClub(clubId);
  const players = generateStarterSquad(clubId, club.country);
  const academyPlayers = generateAcademy(clubId, club.country);

  await prisma.club.update({
    where: { id: clubId },
    data: {
      playersJson: JSON.stringify(players),
      academyPlayersJson: JSON.stringify(academyPlayers),
      captainPlayerId: null,
      captainWeeksServed: 0,
      tutorPlayerId: null,
      penaltyTakerId: null,
      freeKickTakerId: null,
      cornerLeftTakerId: null,
      cornerRightTakerId: null,
      pendingRoundTacticJson: null,
    },
  });

  return getClub(clubId);
}

// ---- Mod pack export/import ----

/** Every club id → the division of whichever league currently lists it, built from one pass over every
 *  league row instead of a query per club (this used to be per-club and was slow enough with a couple
 *  dozen slugged clubs to blow past a 5s test timeout). */
async function buildDivisionIndex(): Promise<Map<string, number>> {
  const leagues = await prisma.league.findMany();
  const index = new Map<string, number>();
  for (const league of leagues) {
    for (const clubId of JSON.parse(league.clubIdsJson) as string[]) {
      index.set(clubId, league.division);
    }
  }
  return index;
}

/** Every club with a slug (the stable merge key a mod pack needs) — a randomly-created club with no slug
 *  has no stable identity across two different players' saves, so it can't be meaningfully shared. */
export async function exportModPack(): Promise<ModPack> {
  const [records, divisionByClubId] = await Promise.all([
    prisma.club.findMany({ where: { slug: { not: null } }, select: { id: true } }),
    buildDivisionIndex(),
  ]);

  const clubs = await Promise.all(
    records.map(async ({ id }): Promise<ModPackClub | null> => {
      const club = await getClub(id);
      if (!club.slug) return null;
      return {
        slug: club.slug,
        name: club.name,
        country: club.country,
        division: divisionByClubId.get(club.id) ?? 1,
        players: club.players,
        academyPlayers: club.academyPlayers,
        crestBase64: readCrestBase64(club.slug),
        kitPattern: club.kitPattern,
        primaryColor: club.primaryColor,
        secondaryColor: club.secondaryColor,
        stadiumCapacity: club.stadiumCapacity,
        stadiumName: club.stadiumName,
        city: club.city,
        budget: club.budget,
      };
    }),
  );

  return { version: 1, clubs: clubs.filter((c): c is ModPackClub => c !== null) };
}

/**
 * A merge into the receiving player's own save, not a blind replace: a slug that matches a club currently
 * managed by a real user (not the bot pool) is someone's actual career, so it's skipped rather than
 * silently overwritten. For clubs that ARE applied, every field referencing a specific player id
 * (captain/tutor/set-piece takers, the pending round tactic) is cleared — the imported roster's ids don't
 * match the old ones, so those would otherwise dangle. Historical top-scorer entries pointing at
 * now-replaced player ids are a known, accepted cosmetic gap for this first version — not fixed here.
 */
export async function importModPack(pack: ModPack): Promise<ModPackImportResult> {
  const created: string[] = [];
  const updated: string[] = [];
  const skippedOwned: string[] = [];

  for (const modClub of pack.clubs) {
    assertValidSlug(modClub.slug);
    if (!isValidCountryCode(modClub.country)) continue;

    const existing = await prisma.club.findUnique({ where: { slug: modClub.slug } });

    if (existing) {
      if (existing.ownerId !== BOT_OWNER_ID) {
        skippedOwned.push(modClub.slug);
        continue;
      }
      await prisma.club.update({
        where: { id: existing.id },
        data: {
          name: modClub.name,
          playersJson: JSON.stringify(modClub.players),
          academyPlayersJson: JSON.stringify(modClub.academyPlayers),
          kitPattern: modClub.kitPattern,
          primaryColor: modClub.primaryColor,
          secondaryColor: modClub.secondaryColor,
          stadiumCapacity: modClub.stadiumCapacity,
          stadiumName: modClub.stadiumName,
          city: modClub.city,
          budget: modClub.budget,
          captainPlayerId: null,
          captainWeeksServed: 0,
          tutorPlayerId: null,
          penaltyTakerId: null,
          freeKickTakerId: null,
          cornerLeftTakerId: null,
          cornerRightTakerId: null,
          pendingRoundTacticJson: null,
        },
      });
      updated.push(modClub.slug);
    } else {
      const id = randomUUID();
      await prisma.club.create({
        data: {
          id,
          name: modClub.name,
          ownerId: BOT_OWNER_ID,
          slug: modClub.slug,
          country: modClub.country,
          playersJson: JSON.stringify(modClub.players),
          academyPlayersJson: JSON.stringify(modClub.academyPlayers),
          kitPattern: modClub.kitPattern,
          primaryColor: modClub.primaryColor,
          secondaryColor: modClub.secondaryColor,
          stadiumCapacity: modClub.stadiumCapacity,
          stadiumName: modClub.stadiumName,
          city: modClub.city,
          budget: modClub.budget,
        },
      });
      await joinOrCreateLeague(id, modClub.country, modClub.division);
      created.push(modClub.slug);
    }

    if (modClub.crestBase64) {
      try {
        writeCrestFile(modClub.slug, modClub.crestBase64);
      } catch {
        // A bad crest doesn't roll back the roster import above — worst case, that club falls back to
        // the usual procedural crest (see ClubCrest.tsx's own onError fallback).
      }
    }
  }

  return { created, updated, skippedOwned };
}

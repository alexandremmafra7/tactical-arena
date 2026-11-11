import { buildPlayerFromRating, createRng, generateSquad, type Player, type Position, type StarLevel } from '@tactical-arena/shared';

/**
 * The real world, offline.
 *
 * The offline engine invented its clubs: twenty-four hand-written names with squads produced by
 * `generateSquad`, so on Android the manager took charge of a Flamengo whose players did not exist. The
 * shipped content is `clubs.csv` and `players.csv`, together 2,2 MB against the 108 MB of art the APK
 * already carries, so there was never a size reason to make players up.
 *
 * What is loaded is bounded, and by storage rather than by bandwidth: the save lives in `localStorage`,
 * which stops around 5 MB. Forty real Brazilian clubs with their 962 real players measure 1,17 MB, so a
 * handful of countries fits and all 1.505 clubs of the full database does not.
 */

/** The two column layouts `players.csv` carries under one header. See the importer for the whole story. */
const FOREIGN_POSITIONS: Record<string, Position> = {
  GK: 'GK',
  DF: 'DEF',
  MF: 'MID',
  FW: 'ATT',
  DEF: 'DEF',
  LAT: 'LAT',
  MID: 'MID',
  ATT: 'ATT',
};

/** Comma separated, double quotes honoured. The names in this file contain commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out;
}

function rows(text: string): string[][] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim().length > 0)
    .map(splitCsvLine);
}

export interface OfflineClubSeed {
  slug: string;
  name: string;
  country: string;
  stadiumCapacity: number;
  players: Player[];
  state?: string | null;
}

interface RawPlayer {
  name: string;
  position: Position;
  age: number;
  rating: number;
  nationality?: string;
  starLevel?: StarLevel;
  diferenciado?: boolean;
}

/**
 * Reads a squad row under either of the file's two layouts.
 *
 * Told apart by which of the two middle columns holds a number: one layout has the age there, the other a
 * position code. Rows that fit neither are skipped rather than guessed at.
 */
function readPlayerRow(cells: string[]): RawPlayer | null {
  const numeric = (value: string) => /^\d+$/.test((value ?? '').trim());
  const isLayout1 = numeric(cells[3]);
  const [age, rawPosition, rating, nationality, starRaw, difRaw] = isLayout1
    ? [Number(cells[3]), cells[2], Number(cells[5]), cells[4], cells[6], cells[7]]
    : [Number(cells[2]), cells[3], Number(cells[4]), undefined, cells[5], cells[6]];

  const position = FOREIGN_POSITIONS[(rawPosition ?? '').toUpperCase().trim()];
  if (!position || !Number.isInteger(age) || age < 15 || age > 45) return null;
  if (!Number.isFinite(rating) || rating < 1 || rating > 99) return null;

  let starLevel: StarLevel = 'NONE';
  if (starRaw) {
    const parsed = starRaw.toUpperCase().trim();
    if (parsed === 'NATURAL' || parsed === '1') starLevel = 'NATURAL';
    else if (parsed === 'DEVELOPED' || parsed === 'DEVELOPING') starLevel = 'DEVELOPED';
  }

  const difNormalized = (difRaw ?? '').toUpperCase().trim();
  const diferenciado = difNormalized === 'S' || difNormalized === 'SIM' || difNormalized === 'TRUE' || difNormalized === '1';

  return { name: cells[1] || 'Jogador', position, age, rating, nationality, starLevel, diferenciado };
}

/** How many of a squad's players are kept. Enough for a first team, a bench and some rotation. */
const SQUAD_LIMIT = 32;

/**
 * Turns a country's real clubs into the two divisions the game plays.
 *
 * Ranked by squad strength and cut into equal, even-sized tiers, which is what the server's importer does
 * with the same file: a round robin needs an even count, and a tier left odd never generates a fixture list.
 */
export function buildCountry(
  clubRows: string[][],
  squads: Map<string, RawPlayer[]>,
  country: string,
  perDivision: number,
): OfflineClubSeed[][] {
  /**
   * Um clube entra por qualquer um dos dois caminhos que o arquivo já oferece.
   *
   * `clubs.csv` tem 1.505 clubes com elenco listado em `players.csv` e 21 que trazem só uma nota de força na
   * sexta coluna, entre eles o Manchester City, o Chelsea e o Tottenham. Isto exigia onze jogadores listados,
   * então esses 21 eram descartados calados: o campeonato inglês offline não tinha o City. Quem traz nota mas
   * não traz nomes ganha um elenco gerado naquela força, que é o mesmo que o jogo faz com um clube fundado.
   */
  const eligible = clubRows
    .filter((c) => c[2] === country)
    .map((c) => {
      const squad = squads.get(c[0]);
      if (squad && squad.length >= 11) {
        return { row: c, average: squad.reduce((sum, p) => sum + p.rating, 0) / squad.length };
      }
      const nota = Number(c[5]);
      return Number.isFinite(nota) && nota > 0 ? { row: c, average: nota } : null;
    })
    .filter((c): c is { row: string[]; average: number } => c !== null)
    .sort((a, b) => b.average - a.average);

  const rng = createRng(`offline-${country}`);
  const toSeed = (row: string[], average: number): OfflineClubSeed => {
    const state = row[6] ? row[6].trim() : null;
    const listado = squads.get(row[0]);
    if (!listado || listado.length < 11) {
      // Sem nomes no arquivo: elenco gerado na força declarada, semeado no slug para não mudar a cada abertura.
      return {
        slug: row[0],
        name: row[1],
        country,
        stadiumCapacity: Number(row[4]) || 20_000,
        players: generateSquad(Math.round(average), row[0], country).map((player) => {
          Object.defineProperty(player, 'detailedAttributes', {
            value: player.detailedAttributes,
            enumerable: false,
            writable: true,
            configurable: true,
          });
          return player;
        }),
        state,
      };
    }

    // Prioriza manter goleiros no elenco para garantir que nenhum time fique sem goleiro
    const gks = listado.filter((p) => p.position === 'GK');
    const outfield = listado.filter((p) => p.position !== 'GK');
    const selectedGks = [...gks.slice(0, 4)];
    if (selectedGks.length === 0) {
      selectedGks.push(
        {
          name: 'Goleiro Titular',
          position: 'GK',
          age: 26,
          rating: Math.round(average),
          nationality: country,
          starLevel: 'NONE',
          diferenciado: false,
        },
        {
          name: 'Goleiro Reserva',
          position: 'GK',
          age: 22,
          rating: Math.max(50, Math.round(average - 4)),
          nationality: country,
          starLevel: 'NONE',
          diferenciado: false,
        },
      );
    }
    const maxOutfield = Math.max(0, SQUAD_LIMIT - selectedGks.length);
    const squad = [...selectedGks, ...outfield.slice(0, maxOutfield)];
    return {
      slug: row[0],
      name: row[1],
      country,
      stadiumCapacity: Number(row[4]) || 20_000,
      players: squad.map((p, index) => {
        const player = buildPlayerFromRating(
          {
            id: `${row[0]}-p${index}`,
            name: p.name,
            position: p.position,
            age: p.age,
            nationality: p.nationality || country,
            rating: p.rating,
            starLevel: p.starLevel ?? 'NONE',
            diferenciado: p.diferenciado ?? false,
          },
          rng,
        );
        Object.defineProperty(player, 'detailedAttributes', {
          value: player.detailedAttributes,
          enumerable: false,
          writable: true,
          configurable: true,
        });
        return player;
      }),
      state,
    };
  };

  /**
   * A divisão vem escrita no arquivo, e não da força do elenco.
   *
   * Esta função ordenava por média de elenco e cortava em vinte, e isso estava errado por um motivo que só
   * apareceu ao medir: as notas dos jogadores no arquivo são ruído em volta de 64. O Benfica tem média 64,0
   * e o Benfica B tem 65,8, então o time B subia na frente. A quarta coluna do `clubs.csv` agora diz a
   * divisão de cada clube, escrita a mão nas ligas em que se sabe qual é, e as duas plataformas passam a
   * concordar: era o servidor que usava a coluna e o offline que a ignorava.
   */
  const porDivisao = new Map<number, { row: string[]; average: number }[]>();
  for (const item of eligible) {
    const divisao = Number(item.row[3]) || 1;
    porDivisao.set(divisao, [...(porDivisao.get(divisao) ?? []), item]);
  }

  const maxTier = country === 'BRA' ? 4 : 2;

  if ((porDivisao.get(1)?.length ?? 0) >= 2) {
    const saida: OfflineClubSeed[][] = [];
    for (const divisao of Array.from({ length: maxTier }, (_, i) => i + 1)) {
      const tier = (porDivisao.get(divisao) ?? []).slice(0, perDivision);
      // Returno duplo pede número par, e o mais fraco espera a próxima temporada.
      if (tier.length % 2 === 1) tier.pop();
      if (tier.length >= 2) saida.push(tier.map(({ row, average }) => toSeed(row, average)));
    }
    if (saida.length > 0) return saida;
  }

  const divisions: OfflineClubSeed[][] = [];
  for (let tier = 0; tier < maxTier; tier += 1) {
    const slice = eligible.slice(tier * perDivision, (tier + 1) * perDivision);
    // An odd tier never draws a fixture list, so the weakest club of it waits for another season.
    if (slice.length % 2 === 1) slice.pop();
    if (slice.length >= 2) divisions.push(slice.map(({ row, average }) => toSeed(row, average)));
  }

  return divisions;
}

/**
 * The shipped club database, fetched once.
 *
 * Served as a static file from the same origin the app is loaded from, which on Android is the bundled
 * assets, so this is a read off local storage rather than a network call. Returns null when it cannot be
 * read, and the caller keeps its invented world rather than starting with nothing.
 */
export interface OfflineContent {
  clubs: string[][];
  squads: Map<string, RawPlayer[]>;
}

export async function loadOfflineContent(): Promise<OfflineContent | null> {
  try {
    const [clubsText, playersText] = await Promise.all([
      fetch('/clubs.csv').then((r) => (r.ok ? r.text() : Promise.reject(new Error('clubs.csv')))),
      fetch('/players.csv').then((r) => (r.ok ? r.text() : Promise.reject(new Error('players.csv')))),
    ]);

    const squads = new Map<string, RawPlayer[]>();
    for (const cells of rows(playersText)) {
      const player = readPlayerRow(cells);
      if (!player || !cells[0]) continue;
      const list = squads.get(cells[0]) ?? [];
      // Only the first few matter, and stopping early saves parsing 51.585 rows into objects nobody reads.
      if (list.length < 35) list.push(player);
      squads.set(cells[0], list);
    }

    return { clubs: rows(clubsText), squads };
  } catch {
    return null;
  }
}

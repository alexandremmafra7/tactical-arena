import type { MatchEvent, MatchStats } from './match.js';
import { createRng } from '../simulation/rng.js';

export type LeagueStatus = 'OPEN' | 'IN_PROGRESS' | 'FINISHED';

/**
 * A top flight holds twenty clubs, which is thirty-eight rounds.
 *
 * It was eight, and eight is not a league anyone recognises — it made a season fourteen rounds long and
 * over in a couple of months. The number is a real one now: `content/clubs.csv` carries exactly twenty
 * first-division clubs for Brazil, Spain and England, so a country's top division fills naturally with
 * the clubs that actually play in it, and `generateDoubleRoundRobinFixtures` produces the 2(n-1) rounds
 * without being touched.
 */
export const LEAGUE_CAPACITY = 20;

export interface LeagueFixture {
  round: number;
  homeClubId: string;
  awayClubId: string;
  /**
   * The full match record, for fixtures worth keeping one.
   *
   * Null both before a fixture is played and, permanently, for one resolved result-only (see `result`).
   */
  matchId: string | null;
  /**
   * The score, kept on the fixture itself for a match nobody watched.
   *
   * A stored `Match` row costs ~5.7 KB — fine for the handful the manager actually opens, ruinous across a
   * world of leagues, where a single season would add tens of megabytes to the save for matches no one will
   * ever look at. A fixture between two computer-run clubs is therefore simulated for its result only: the
   * squads still age, tire and pick up injuries exactly as before, but what survives is the scoreline and
   * who scored, which is all the table and the top-scorer list ever needed.
   *
   * Absent when the fixture has a `matchId` — that row is the record then, and duplicating it here would
   * invite the two to disagree.
   */
  result?: {
    homeGoals: number;
    awayGoals: number;
    /** Goalscorers, for the top-scorer standings. */
    scorers?: { playerId: string; clubId: string; name: string }[];
    /** Assist providers, for the top-assist standings (mirrors `scorers`). */
    assists?: { playerId: string; clubId: string; name: string }[];
    stats?: MatchStats;
    events?: MatchEvent[];
  } | null;
  /**
   * The calendar day this round is played, as a civil `'YYYY-MM-DD'` (see `gameDate.ts`).
   *
   * Optional so that fixtures written before the calendar existed keep loading untouched — a missing
   * date simply means "this fixture was never scheduled", which every reader treats as unknown rather
   * than as an error.
   */
  date?: string | null;
}

export interface League {
  id: string;
  countryCode: string;
  /** 1 = top flight. Each division is its own independent league instance — no promotion/relegation yet. */
  division: number;
  name: string;
  capacity: number;
  clubIds: string[];
  status: LeagueStatus;
  fixtures: LeagueFixture[];
  /** In-game "year" — real calendar year of the first season; each auto-renewed next season is +1 (see História). */
  season: number;
  /** Set once status is FINISHED — the season's winner (standings[0]) and its goal-scoring leader. */
  championClubId: string | null;
  /** Whoever owned `championClubId` at the moment it won — see historyService.ts for why this is
   *  captured separately instead of always reading the club's current owner. Null for older rows
   *  finalized before this field existed. */
  championOwnerId: string | null;
  topScorerPlayerId: string | null;
  topScorerName: string | null;
  topScorerGoals: number | null;
  topScorerClubId: string | null;
}

export interface StandingRow {
  clubId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/**
 * Standard circle-method double round-robin: fix one club, rotate the rest around it for N-1 rounds
 * (each pair meets exactly once, home/away alternated per round for balance), then mirror the same
 * pairings with home/away swapped for the second leg. Requires an even number of clubs (no byes).
 */
export function generateDoubleRoundRobinFixtures(clubIds: string[], seed?: string | number): LeagueFixture[] {
  const n = clubIds.length;
  if (n < 2) {
    throw new Error('A league needs at least 2 clubs to generate a schedule');
  }
  if (n % 2 !== 0) {
    throw new Error('generateDoubleRoundRobinFixtures requires an even number of clubs');
  }

  let shuffledIds = [...clubIds];
  if (seed !== undefined && seed !== null) {
    const rng = createRng(typeof seed === 'number' ? String(seed) : seed);
    for (let i = shuffledIds.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
    }
  }

  const fixed = shuffledIds[0];
  let rotating = shuffledIds.slice(1);
  const firstLegRounds: [string, string][][] = [];

  for (let round = 0; round < n - 1; round++) {
    const current = [fixed, ...rotating];
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = current[i];
      const away = current[n - 1 - i];
      pairs.push(round % 2 === 0 ? [home, away] : [away, home]);
    }
    firstLegRounds.push(pairs);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  const fixtures: LeagueFixture[] = [];
  firstLegRounds.forEach((pairs, i) => {
    for (const [home, away] of pairs) {
      fixtures.push({ round: i + 1, homeClubId: home, awayClubId: away, matchId: null });
    }
  });
  firstLegRounds.forEach((pairs, i) => {
    for (const [home, away] of pairs) {
      fixtures.push({ round: n - 1 + i + 1, homeClubId: away, awayClubId: home, matchId: null });
    }
  });

  return fixtures;
}

/**
 * Official CBF (Confederação Brasileira de Futebol) Standings Aggregation & Tiebreaking:
 * 1. Pontos ganhos (points)
 * 2. Maior número de vitórias (wins)
 * 3. Maior saldo de gols (GD)
 * 4. Maior número de gols pró (GF)
 * 5. Confronto direto (H2H)
 * 6. Ordem alfabética / Sorteio (clubId)
 */
export function computeStandings(
  clubIds: string[],
  results: { homeClubId: string; awayClubId: string; homeGoals: number; awayGoals: number }[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const id of clubIds) {
    rows.set(id, { clubId: id, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
  }

  for (const result of results) {
    const home = rows.get(result.homeClubId);
    const away = rows.get(result.awayClubId);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += result.homeGoals;
    home.goalsAgainst += result.awayGoals;
    away.goalsFor += result.awayGoals;
    away.goalsAgainst += result.homeGoals;

    if (result.homeGoals > result.awayGoals) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (result.homeGoals < result.awayGoals) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      home.points += 1;
      away.draws++;
      away.points += 1;
    }
  }

  return [...rows.values()].sort((a, b) => {
    // 1. Points
    if (b.points !== a.points) return b.points - a.points;
    // 2. Victories (CBF standard: number of wins takes precedence over GD)
    if (b.wins !== a.wins) return b.wins - a.wins;
    // 3. Goal Difference
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    // 4. Goals For
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    // 5. Head-to-Head between tied clubs
    const h2hMatches = results.filter(
      (r) =>
        (r.homeClubId === a.clubId && r.awayClubId === b.clubId) ||
        (r.homeClubId === b.clubId && r.awayClubId === a.clubId),
    );
    if (h2hMatches.length > 0) {
      let ptsA = 0;
      let ptsB = 0;
      let gdH2HA = 0;
      for (const m of h2hMatches) {
        const gA = m.homeClubId === a.clubId ? m.homeGoals : m.awayGoals;
        const gB = m.homeClubId === a.clubId ? m.awayGoals : m.homeGoals;
        gdH2HA += gA - gB;
        if (gA > gB) ptsA += 3;
        else if (gB > gA) ptsB += 3;
        else {
          ptsA += 1;
          ptsB += 1;
        }
      }
      if (ptsB !== ptsA) return ptsB - ptsA;
      if (gdH2HA !== 0) return -gdH2HA;
    }

    // 6. Tiebreaker fallback
    return a.clubId.localeCompare(b.clubId);
  });
}


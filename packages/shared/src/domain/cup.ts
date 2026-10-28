export type CupTieFormat = 'SINGLE_LEG' | 'TWO_LEGGED';

/** One knockout tie or leg: null matchId/winnerClubId until the round is advanced. */
export interface CupFixture {
  round: number;
  stageName?: string;
  homeClubId: string;
  awayClubId: string;
  matchId: string | null;
  winnerClubId: string | null;
  /** True if normal time (or aggregate) ended level and the winner was decided on penalties. */
  wentToPenalties: boolean;
  /** Penalty shootout final score if match went to penalties. */
  penaltyScore?: { home: number; away: number };
  /** In two-legged ties: 1 for first leg, 2 for second leg (return match). */
  leg?: 1 | 2;
  /** Unique ID connecting Leg 1 and Leg 2 of the same tie. */
  tieId?: string;
  /** First leg score (home vs away as played in leg 1). */
  firstLegScore?: { home: number; away: number };
  /** Combined aggregate score (perspective of current fixture: [thisHome]:[thisAway]). */
  aggregateScore?: { home: number; away: number };
  /**
   * The calendar day this tie is played, as a civil `'YYYY-MM-DD'` (see `gameDate.ts`).
   *
   * Cup rounds are dated as they are drawn rather than all at once: a knockout bracket does not exist
   * until the previous round has been decided. Optional for the same reason as on a league fixture —
   * anything written before the calendar existed still loads.
   */
  date?: string | null;
}

export interface Cup {
  id: string;
  name: string;
  countryCode: string;
  /** The original entrants, in bracket order (fixed once the cup is created). */
  clubIds: string[];
  /** Every fixture generated so far, across all rounds played. */
  fixtures: CupFixture[];
  status: 'IN_PROGRESS' | 'FINISHED';
  championClubId: string | null;
  /** Whoever owned `championClubId` at the moment it won — see historyService.ts. Null for older rows
   *  finalized before this field existed. */
  championOwnerId: string | null;
  /** In-game "year" this cup was created in — see História and League.season. */
  season: number;
  /** Set once status is FINISHED — the tournament's goal-scoring leader. */
  topScorerPlayerId: string | null;
  topScorerName: string | null;
  topScorerGoals: number | null;
  topScorerClubId: string | null;
  /** Seeded clubs entering at later stages (e.g. Stage 3 in Copa do Brasil). */
  seededClubIds?: string[];
  currentStageName?: string;
}

export const COPA_DO_BRASIL_STAGES = [
  '1ª Fase (Preliminar)',
  '2ª Fase (Preliminar)',
  '3ª Fase (32 Clubes)',
  'Oitavas de Final',
  'Quartas de Final',
  'Semifinais',
  'Grande Final',
];

/** How many rounds a single-elimination bracket of this size needs (8 clubs -> 3: QF, SF, Final). */
export function totalCupRounds(numClubs: number): number {
  return Math.round(Math.log2(numClubs));
}

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

/** Round 1 pairings straight from the entrant list — the caller is responsible for shuffling it first. */
export function generateFirstRoundFixtures(clubIds: string[], stageName?: string): CupFixture[] {
  if (!isPowerOfTwo(clubIds.length) && clubIds.length !== 80 && clubIds.length !== 92) {
    throw new Error('O número de clubes precisa ser uma potência de 2 (2, 4, 8, 16...) ou 80/92 para a Copa do Brasil');
  }
  const fixtures: CupFixture[] = [];
  for (let i = 0; i < clubIds.length; i += 2) {
    fixtures.push({
      round: 1,
      stageName: stageName ?? (clubIds.length === 80 ? '1ª Fase (Preliminar)' : undefined),
      homeClubId: clubIds[i],
      awayClubId: clubIds[i + 1],
      matchId: null,
      winnerClubId: null,
      wentToPenalties: false,
    });
  }
  return fixtures;
}

/** Next round's pairings from the previous round's winners, keeping bracket order. */
export function generateNextRoundFixtures(previousRoundWinners: string[], round: number, stageName?: string): CupFixture[] {
  const fixtures: CupFixture[] = [];
  for (let i = 0; i < previousRoundWinners.length; i += 2) {
    fixtures.push({
      round,
      stageName,
      homeClubId: previousRoundWinners[i],
      awayClubId: previousRoundWinners[i + 1],
      matchId: null,
      winnerClubId: null,
      wentToPenalties: false,
    });
  }
  return fixtures;
}

/**
 * How far a club got in the bracket: the champion's own final-round win, an eliminated club's last
 * fixture (the round it lost in), or null if it hasn't played a fixture yet. Used to size the cup's
 * per-stage prize money — see calculateCupPrizeMoney in finance.ts.
 */
export function clubRoundReached(cup: Cup, clubId: string): number | null {
  const played = cup.fixtures.filter((f) => (f.homeClubId === clubId || f.awayClubId === clubId) && f.winnerClubId !== null);
  if (played.length === 0) return null;
  return played.reduce((max, f) => Math.max(max, f.round), 0);
}

/**
 * A knockout tie can't end in a draw, and this game has no extra-time/shootout simulation yet — so a
 * level scoreline is broken by a weighted coin flip instead. The stronger side (by combined attack +
 * defense + goalkeeping rating) gets a real edge, but the swing is capped so the underdog always has a
 * genuine (if slim) chance, same spirit as a real shootout.
 */
export function resolvePenaltyWinner(homeClubId: string, awayClubId: string, homeStrength: number, awayStrength: number, rng: () => number): string {
  const total = homeStrength + awayStrength;
  const homeChance = total > 0 ? 0.5 + 0.4 * ((homeStrength - awayStrength) / total) : 0.5;
  return rng() < homeChance ? homeClubId : awayClubId;
}

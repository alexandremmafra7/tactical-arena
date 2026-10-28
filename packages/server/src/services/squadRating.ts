import { autoFillLineup, computeTeamStrength, createRng } from '@tactical-arena/shared';
import type { Club, Player } from '@tactical-arena/shared';

export interface SquadRating {
  attack: number;
  defense: number;
  goalkeeping: number;
}

/**
 * How good a squad is, as three numbers, so a match nobody watches never has to open it.
 *
 * This is what makes the background rule worth having. The rule itself is fast either way — the engine is
 * only 0.62 ms a match — but a background fixture measured at 9.2 ms, and nearly all of that was reading
 * two 42 KB rosters and writing them back. Keeping the answer beside the roster is what removes the
 * roster from the loop entirely.
 *
 * Read from the club's best available eleven with no tactical instructions at all, which is both the
 * cheapest thing to compute and the honest one: nobody is picking a side for these matches, so crediting
 * one with a manager's tactical edge would be inventing a decision that was never made.
 */
export function computeSquadRating(players: Player[]): SquadRating {
  if (players.length < 11) return { attack: 30, defense: 30, goalkeeping: 30 };

  /**
   * A stub with just enough of a club for the strength model. The fields left at their neutral values —
   * no captain, no titles — are exactly the ones that belong to a club's history rather than its squad,
   * and including them would make the rating drift for reasons that have nothing to do with the players.
   */
  const stub = {
    id: 'rating',
    name: 'rating',
    ownerId: 'rating',
    slug: null,
    country: 'BRA',
    players,
    academyPlayers: [],
    budget: 0,
    captainPlayerId: null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: 1,
    stadiumCapacity: 20000,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
    pendingRoundTactic: null,
    staff: [],
  } as unknown as Club;

  try {
    const strength = computeTeamStrength(stub, autoFillLineup(stub));
    return { attack: strength.attack, defense: strength.defense, goalkeeping: strength.goalkeeping };
  } catch {
    // A squad that cannot field a legal eleven (too few, all one position) still needs a number.
    return { attack: 30, defense: 30, goalkeeping: 30 };
  }
}

export interface ScorerCandidate {
  playerId: string;
  name: string;
  /** Relative likelihood of being the one who scores. */
  weight: number;
  /** Relative likelihood of being the one who set it up. */
  assistWeight: number;
}

/** How many names are worth keeping. Beyond this the tail almost never scores anyway. */
const SCORER_POOL_SIZE = 12;

/**
 * Who scores for this club, so a goal in a match nobody watched still has a name on it.
 *
 * Without this, a background league would fill its table and crown a champion with an empty top-scorer
 * list — every striker in the world outside the manager's own division simply never scoring. Keeping a
 * dozen names and their weights beside the club costs a few hundred bytes and means the rule can credit
 * a goal without opening a 42 KB roster, which is the whole reason it is fast.
 *
 * Weighted the way the engine picks a scorer: finishing first, and forwards far ahead of defenders. It is
 * an attribution, not a simulation — nobody is claiming this striker beat that goalkeeper — but across a
 * season it puts the right names at the top of the list, which is what the list is for.
 */
export function computeScorerPool(players: Player[]): ScorerCandidate[] {
  const positionWeight: Record<string, number> = { ATT: 1, MID: 0.45, LAT: 0.12, DEF: 0.09, GK: 0.002 };
  const assistWeightByPosition: Record<string, number> = { MID: 1, ATT: 0.7, LAT: 0.6, DEF: 0.12, GK: 0.01 };

  return players
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      weight: Math.max(0.001, (player.attributes.finishing / 100) ** 2 * (positionWeight[player.position] ?? 0.1)),
      // Who makes them is a different question from who takes them: passing, and weighted toward the
      // players who actually supply — wingers and midfielders ahead of the centre-forward.
      assistWeight: Math.max(0.001, (player.attributes.passing / 100) ** 2 * (assistWeightByPosition[player.position] ?? 0.1)),
    }))
    .sort((a, b) => b.weight + b.assistWeight - (a.weight + a.assistWeight))
    .slice(0, SCORER_POOL_SIZE);
}

/**
 * Picks who scored, given how many goals and a club's finishers.
 *
 * Seeded rather than random so a round always credits the same players however many times it is
 * recomputed, which is the same promise the rest of the background rule makes.
 */
export function pickBackgroundScorers(pool: ScorerCandidate[], goals: number, seed: string): ScorerCandidate[] {
  if (goals <= 0 || pool.length === 0) return [];
  const rng = createRng(seed);
  const total = pool.reduce((sum, candidate) => sum + candidate.weight, 0);

  const picked: ScorerCandidate[] = [];
  for (let goal = 0; goal < goals; goal += 1) {
    let ticket = rng() * total;
    // The last candidate catches any floating-point remainder, so a goal is never left uncredited.
    let chosen = pool[pool.length - 1];
    for (const candidate of pool) {
      ticket -= candidate.weight;
      if (ticket <= 0) {
        chosen = candidate;
        break;
      }
    }
    picked.push(chosen);
  }
  return picked;
}

/**
 * Real football credits an assist on roughly two goals in three; the rest are penalties, solo runs and
 * scrambles that nobody set up. Inventing a passer for every goal would put a number on the assists table
 * that stands for nothing.
 */
const GOALS_WITH_AN_ASSIST = 0.66;

/**
 * Who set the goals up. Same idea as `pickBackgroundScorers`, and never the scorer himself.
 */
export function pickBackgroundAssists(
  pool: ScorerCandidate[],
  scorers: ScorerCandidate[],
  seed: string,
): ScorerCandidate[] {
  if (scorers.length === 0 || pool.length === 0) return [];
  const rng = createRng(`${seed}-assists`);
  const picked: ScorerCandidate[] = [];

  for (const scorer of scorers) {
    if (rng() > GOALS_WITH_AN_ASSIST) continue;
    const candidates = pool.filter((candidate) => candidate.playerId !== scorer.playerId);
    if (candidates.length === 0) continue;

    /**
     * A pool stored before assist weights existed falls back to the scoring weight rather than to NaN.
     * Pools are rebuilt on the next roster write, so this heals itself; until then the names are still
     * plausible ones.
     */
    const assistWeightOf = (candidate: ScorerCandidate) => candidate.assistWeight ?? candidate.weight;

    const total = candidates.reduce((sum, candidate) => sum + assistWeightOf(candidate), 0);
    let ticket = rng() * total;
    let chosen = candidates[candidates.length - 1];
    for (const candidate of candidates) {
      ticket -= assistWeightOf(candidate);
      if (ticket <= 0) {
        chosen = candidate;
        break;
      }
    }
    picked.push(chosen);
  }
  return picked;
}

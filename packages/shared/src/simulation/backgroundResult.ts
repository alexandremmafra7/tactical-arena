import { chanceProbability, goalProbability } from './engine.js';
import { homeAdvantageFactors } from './homeAdvantage.js';
import { createRng } from './rng.js';

/** Everything the rule needs about one side. Numbers, not squads — that is the whole point. */
export interface BackgroundSideRating {
  attack: number;
  defense: number;
  goalkeeping: number;
}

export interface BackgroundResult {
  homeGoals: number;
  awayGoals: number;
}

/** A match is ninety minutes of chances. */
const MATCH_MINUTES = 90;

/**
 * The engine reaches the goal in more ways than the minute-by-minute chance roll: corners and turnovers
 * won by pressing carry their own attempts, and rebounds and penalties add more. Those routes are worth
 * about a third of the scoring on top of open play, so the rule adds them back rather than quietly
 * producing a lower-scoring world than the one it stands in for.
 *
 * Fitted by playing the same fixtures both ways (see scripts/background-rule.ts), not guessed: at this
 * value an even match scores 2.97 against the engine's 2.96, with the draw rate, the home win rate and
 * the goalless rate all landing on the same number. Change anything about the goal funnel and re-run it.
 */
const EXTRA_ROUTES_TO_GOAL = 1.32;

/**
 * The result of a match nobody is watching, without playing it out.
 *
 * The game already resolved unwatched matches through the full engine and kept only the score, which is
 * faithful but pays for a minute-by-minute simulation nobody reads. That was affordable for one country
 * and stops being affordable for a world: with two divisions everywhere, a single matchday is over five
 * hundred fixtures.
 *
 * The saving is not in the simulation. The engine costs 0.62 ms a match; the measured cost of a
 * background fixture was 9.2 ms, and nearly all of the difference is reading two 42 KB squads and writing
 * them back. So the rule takes *ratings* rather than squads — numbers already kept on the club — and that
 * is what lets a distant league be played without touching a roster at all.
 *
 * It is not a second, competing model of football. Chance creation and conversion come from the very
 * functions the engine uses, on the same inputs, so a background league and a watched one agree about
 * what a good side is. What it skips is the narrative: no events, no commentary, no bookings. Goals are
 * drawn per minute exactly as the engine draws them, which keeps the distribution — not just the mean —
 * the same shape, including the goalless games and the occasional rout.
 */
export function simulateBackgroundResult(
  home: BackgroundSideRating,
  away: BackgroundSideRating,
  seed: string,
  crowdIntensity?: number,
): BackgroundResult {
  const rng = createRng(seed);
  const venue = homeAdvantageFactors(crowdIntensity);

  const homeAttack = home.attack * venue.attack;
  const homeDefense = home.defense * venue.defense;

  const homeChance = chanceProbability(homeAttack, away.defense, 1, 1) * EXTRA_ROUTES_TO_GOAL;
  const awayChance = chanceProbability(away.attack, homeDefense, 1, 1) * EXTRA_ROUTES_TO_GOAL;
  const homeConversion = goalProbability(homeAttack, away.goalkeeping, away.defense, 1, 1);
  const awayConversion = goalProbability(away.attack, home.goalkeeping, homeDefense, 1, 1);

  let homeGoals = 0;
  let awayGoals = 0;
  for (let minute = 1; minute <= MATCH_MINUTES; minute += 1) {
    if (rng() < homeChance && rng() < homeConversion) homeGoals += 1;
    if (rng() < awayChance && rng() < awayConversion) awayGoals += 1;
  }

  return { homeGoals, awayGoals };
}

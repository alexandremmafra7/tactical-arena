/**
 * Playing at home.
 *
 * Until this existed the engine was perfectly symmetric: swapping the two sides mirrored the result exactly,
 * so a fixture list was just twenty neutral-ground games and "onde eu jogo" meant nothing. Two identical
 * squads split the points 49.9/50.1 over four thousand matches, which is a coin.
 *
 * ## What the research says
 *
 * In Europe's top leagues before 2020, home sides won about 44% of matches and took roughly **57% of all
 * points**, with an average goal difference around **+0.31 per match** (CIES Football Observatory; the
 * COVID studies below use the same baseline). Brazilian football sits at the higher end of that band —
 * travel across a continent-sized country is a real cost that a two-hour trip in England is not.
 *
 * The empty stadiums of 2020-21 are the cleanest natural experiment anyone will ever get, and they show the
 * crowd is *part* of the effect, not all of it: goal difference fell from +0.31 to +0.24 with nobody in the
 * ground (Frontiers in Sports and Active Living, 2021), while a separate analysis of 4,844 matches across
 * 11 countries found the points margin roughly halving. Estimates of the crowd's share therefore run from
 * about a quarter to about a half; the rest is travel, familiarity with the pitch, and routine, none of
 * which an empty stand takes away. `CROWD_SHARE` below sits in the middle of that spread.
 *
 * The same studies found referees lean with the crowd — more fouls given against the home side once the
 * stands were silent, and fewer cards for visitors. Small, but it is the most *visible* way a full house
 * shows up in a match, so it is modelled here too.
 *
 * ## What it is tied to in game
 *
 * Occupancy, not stadium size. A packed fifteen-thousand-seat ground is a cauldron; a half-empty
 * eighty-thousand bowl is not, and the game already moves occupancy with league position (see
 * calculateAttendanceRate), so form feeds the crowd and the crowd feeds the team. Absolute size is
 * deliberately left out: capacity already drives matchday income, and paying it into the match engine as
 * well would hand the biggest clubs a second dividend on the same investment.
 */

/** League-average occupancy (see ATTENDANCE_RATE in finance.ts). Used when a caller has no crowd figure. */
export const DEFAULT_CROWD_INTENSITY = 0.6;

/**
 * Share of the advantage that needs people in the ground. The remainder survives an empty stadium: the
 * visitors still travelled, and the hosts still know their own pitch.
 */
const CROWD_SHARE = 0.35;

/**
 * The advantage at full occupancy, before CROWD_SHARE splits it.
 *
 * Fitted against both real targets at once — about 57% of the points and a goal difference near +0.3 per
 * match — which only became possible once the engine's own scoring rate was brought in line with real
 * football (see CHANCE_BASE_PROB in engine.ts). Before that the match produced 1.3 goals against football's
 * 2.7, and an absolute goal-difference target would have been asking the mando to be twice the edge it
 * really is; the fit had to rest on points share alone. Refitted here on the corrected scale, which diluted
 * the old constants and needed them raised. See scripts/home-check.ts.
 */
const FULL_ATTACK_BONUS = 0.150;
const FULL_DEFENSE_BONUS = 0.092;

/**
 * How far the referee leans, at full occupancy. Deliberately the smallest of the three: a crowd nudges
 * decisions, it does not buy them.
 */
const FULL_REFEREE_LEAN = 0.08;

export interface HomeAdvantageFactors {
  /** Multiplies the home side's attack. */
  attack: number;
  /** Multiplies the home side's defence. */
  defense: number;
  /** Multiplies the home side's chance of being penalised — below 1, the benefit of the doubt. */
  homeFoul: number;
  /** Multiplies the visitors' chance of being penalised — above 1, the crowd baying for it. */
  awayFoul: number;
}

/** No venue effect at all: what a genuinely neutral ground (or a test that wants symmetry) should pass. */
export const NEUTRAL_HOME_ADVANTAGE: HomeAdvantageFactors = { attack: 1, defense: 1, homeFoul: 1, awayFoul: 1 };

/** Scales a full-occupancy effect down by how empty the ground is, keeping the crowd-independent part. */
function scaled(full: number, crowdIntensity: number): number {
  return full * (1 - CROWD_SHARE + CROWD_SHARE * crowdIntensity);
}

/**
 * The venue's effect on the match, given how full the home ground is (0 to 1 — see
 * `calculateAttendanceRate`). Values outside that range are clamped rather than trusted.
 */
export function homeAdvantageFactors(crowdIntensity: number = DEFAULT_CROWD_INTENSITY): HomeAdvantageFactors {
  const intensity = Math.max(0, Math.min(1, crowdIntensity));
  const lean = scaled(FULL_REFEREE_LEAN, intensity);
  return {
    attack: 1 + scaled(FULL_ATTACK_BONUS, intensity),
    defense: 1 + scaled(FULL_DEFENSE_BONUS, intensity),
    homeFoul: 1 - lean,
    awayFoul: 1 + lean,
  };
}

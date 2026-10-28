import {
  AttackApproach,
  AttackStyle,
  Formation,
  MarkingStyle,
  Mentality,
  PressingIntensity,
  DefensiveLineHeight,
  DEFENSIVE_LINE_MODIFIERS,
  defensiveLineOf,
} from '../domain/tactic.js';

/**
 * Tactics as decisions rather than sliders.
 *
 * Every tactical dial already carried a flat multiplier (see tactic.ts), but each was context free: playing
 * counter-attack was worth exactly the same against a side camped on its own box as against one throwing
 * everyone forward. That makes the tactic screen a stat sheet — you pick the biggest number once and never
 * think about it again. What's here instead is the part that depends on *who you are playing and what is
 * happening in the match*: width against a packed box, space behind a committed opponent, marking against
 * the style it was built to stop, and what going for it while a man down actually buys you.
 *
 * Deliberately bounded (see EFFECT_MIN/EFFECT_MAX): tactics should decide tight matches and let an underdog
 * steal one, never turn a bad squad into a good one. Strength is still the main term.
 */

/** How a formation occupies the pitch. Separate from FORMATION_POSITIONS, which only says which slot holds
 *  which base position — that already shapes the squad's raw ratings through personnel, so reusing it for a
 *  flat power bonus here would double count. Shape only ever feeds *matchups*. */
export interface FormationShape {
  /** 0..1. Natural width: bodies stationed wide, to attack the flanks and to defend them. */
  width: number;
  /** 0..1. Bodies between the ball and the goal — how hard the side is to play through centrally. */
  compactness: number;
}

export const FORMATION_SHAPES: Record<Formation, FormationShape> = {
  // Standard 11-player formations
  '4-4-2': { width: 0.6, compactness: 0.55 },
  '4-3-3': { width: 0.7, compactness: 0.35 },
  '3-5-2': { width: 0.4, compactness: 0.5 },
  '5-3-2': { width: 0.55, compactness: 0.85 },
  '4-2-3-1': { width: 0.65, compactness: 0.6 },
  '4-1-4-1': { width: 0.6, compactness: 0.65 },
  '3-4-3': { width: 0.75, compactness: 0.4 },

  // Contingency 10-player formations
  '4-4-1': { width: 0.55, compactness: 0.6 },
  '5-3-1': { width: 0.5, compactness: 0.9 },
  '4-3-2': { width: 0.5, compactness: 0.45 },
  '3-4-2': { width: 0.65, compactness: 0.45 },
  '4-5-0': { width: 0.55, compactness: 0.75 },
};

const BASELINE_WIDTH = FORMATION_SHAPES['4-4-2'].width;
const BASELINE_COMPACTNESS = FORMATION_SHAPES['4-4-2'].compactness;

/** Everything about one side's setup that the other side's tactics can react to. */
export interface TacticalSetup {
  formation: Formation;
  mentality: Mentality;
  attackStyle: AttackStyle;
  markingStyle: MarkingStyle;
  attackApproach: AttackApproach;
  pressing: PressingIntensity;
  /** Optional so direct callers and old serialized setups retain pressing-derived line behavior. */
  defensiveLine?: DefensiveLineHeight;
  /** Mean pace of the attacking players on the pitch, normalized to 0..1; 0.5 is ordinary. */
  attackerPace?: number;
  /** From TeamStrength.missingPlayers — 0 at full strength (see numericalDisadvantage.ts). */
  missingPlayers: number;
  /** Mean fatigue (0-100) of whoever is actually on the pitch — a press is only as good as the legs running it. */
  avgFatigue: number;
  /**
   * How well this side plays out from the back, 0 to 1, with 0.5 an ordinary team.
   *
   * The thing a press is actually betting against. Pressing high is a wager that the opponent cannot beat
   * the first line; against a side that passes well it is the worst option available, because the bodies
   * committed forward are exactly the ones missing when the ball goes past them.
   */
  buildUpQuality: number;
}

/** Multipliers applied on top of raw strength: chance creation, conversion, and defensive solidity. */
export interface MatchupEffect {
  chance: number;
  goal: number;
  defense: number;
  /** Raw counter danger from an explicit line choice, before the aggregate safety clamp. */
  spaceBehind?: number;
}

/** Hard bounds on the combined effect, giving high-leverage tactical choices real impact (up to ±45%). */
const EFFECT_MIN = 0.65;
const EFFECT_MAX = 1.45;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * How far up the pitch a side has committed itself, 0 (parked) to 1 (all in). Drives the space-behind rules:
 * this is what a counter-attack feeds on and what a possession siege runs out of.
 */
function commitment(setup: TacticalSetup): number {
  const byApproach = setup.attackApproach === 'TOTAL_ATTACK' ? 1 : setup.attackApproach === 'BALANCED' ? 0.5 : 0;
  const byMentality = setup.mentality === 'attacking' ? 0.25 : setup.mentality === 'defensive' ? -0.25 : 0;
  return clamp(byApproach + byMentality, 0, 1);
}

/** How much a marking scheme helps or hurts against the attacking style coming at it — as a multiplier on
 *  the *attacker's* chance creation. Man marking tracks a playmaker well and gets turned inside out by pace;
 *  zonal is the opposite trade; heavy marking wins duels and breaks counter-attacks with tactical fouls. */
function markingCounter(marking: MarkingStyle, attackStyle: AttackStyle, attackApproach: AttackApproach): number {
  let mult = 1;
  if (attackStyle === 'THROUGH_MIDDLE') {
    if (marking === 'MAN_MARKING') mult *= 0.88;
    else if (marking === 'HEAVY') mult *= 0.94;
    else if (marking === 'ZONAL') mult *= 1.05;
  } else if (attackStyle === 'WINGS') {
    if (marking === 'ZONAL') mult *= 0.90;
    else if (marking === 'MAN_MARKING') mult *= 1.10;
    else if (marking === 'HEAVY') mult *= 1.04;
  }

  // Heavy marking disrupts counter-attacking flow with tactical challenges
  if (attackApproach === 'COUNTER_ATTACK' && marking === 'HEAVY') {
    mult *= 0.92;
  }

  return mult;
}

/** How much of a high press stops functioning when the legs running it are gone. Pressing is the most
 *  physically expensive thing a team can do, so a knackered side that keeps pressing gets the worst of both
 *  worlds: it stops winning the ball high and the gaps behind it stay wide open. */
const TIRED_PRESS_CHANCE_LOSS = 0.30;
const TIRED_PRESS_DEFENSE_LOSS = 0.22;

/** How hard an opponent's abandoned space behind is punished by a counter-attack (the Klopp trade). */
const SPACE_BEHIND_CONVERSION = 0.40;
/** Explicit line calibration at ordinary (0.5) attacker pace. */
const EXPLICIT_LINE_DANGER: Record<DefensiveLineHeight, number> = {
  DEEP: 0.475,
  BALANCED: 1,
  HIGH: 1.325,
};
const EXPLICIT_LINE_DANGER_PRESS = 0.075;
const EXPLICIT_LINE_DANGER_PACE = 0.625;

/**
 * What pressing is worth against the opponent's ability to play out of it.
 *
 * Sized so the choice is worth roughly as much as reading a formation is: pressing the right side and
 * pressing the wrong one should be a couple of tenths of a point per match apart, not a rounding error.
 * The defensive term is the larger of the two because that is where a beaten press actually hurts — the
 * chances you fail to win high are cheap, the ones they get behind you are not.
 */
const PRESS_VS_BUILDUP_CHANCE = 0.40;
const PRESS_VS_BUILDUP_DEFENSE = 0.50;
/** Sitting off is the mirror image, and a smaller effect: it denies rather than wins. */
const LOW_BLOCK_VS_BUILDUP_DEFENSE = 0.38;
const LOW_BLOCK_VS_BUILDUP_CHANCE = 0.06;

/**
 * How a short-handed side's chosen reaction redistributes what it has left.
 *
 * The defensive terms are deliberately small. They *mitigate* the numerical-disadvantage penalty applied in
 * numericalDisadvantage.ts, they must never overturn it.
 */
const SHORTHANDED_ATTACK_GAMBLE = 0.15;
const SHORTHANDED_ATTACK_EXPOSURE = 0.08;
const SHORTHANDED_DIG_IN_DEFENSE = 0.03;
const SHORTHANDED_DIG_IN_COST = 0.10;
const MAX_SHORTHANDED_STEPS = 3;

/**
 * The tactical multipliers `own` earns against this particular `opponent`, in this particular situation.
 *
 * The rules:
 *  1. Flanks beat a packed box (5-3-2, 5-4-1); playing through the middle of one is neutralized.
 *  2. You need the formation width to actually play wide — playing wings on a narrow 3-5-2 is ineffective.
 *  3. Counter-attack punishes committed opponents with space behind; against a low block it runs out of room.
 *  4. Marking schemes counter the specific attacking avenue they were built to neutralize.
 *  5. Pressing high hands a counter-attacking opponent the channel behind your defence to run into.
 *  6. A press rewards fresh legs with early turnovers, but severely exposes tired squads.
 *  7. Short-handed adaptations give the manager a real dilemma between chasing the match or damage control.
 */
export function tacticalMatchup(own: TacticalSetup, opponent: TacticalSetup): MatchupEffect {
  const ownShape = FORMATION_SHAPES[own.formation];
  const opponentShape = FORMATION_SHAPES[opponent.formation];

  let chance = 1;
  let goal = 1;
  let defense = 1;
  let spaceBehind: number | undefined;

  // 1. Their compactness, relative to a flat two banks of four (4-4-2).
  const theirCompactness = opponentShape.compactness - BASELINE_COMPACTNESS;
  if (own.attackStyle === 'WINGS') {
    chance *= 1 + 0.45 * theirCompactness;
  }
  if (own.attackStyle === 'THROUGH_MIDDLE') {
    chance *= 1 - 0.50 * theirCompactness;
    if (theirCompactness > 0.1) goal *= 0.88; // Crowded central box blocks shots
  }

  // 2. Our own width, relative to the baseline.
  const ourWidth = ownShape.width - BASELINE_WIDTH;
  if (own.attackStyle === 'WINGS') chance *= 1 + 0.45 * ourWidth;
  if (own.attackStyle === 'THROUGH_MIDDLE') chance *= 1 - 0.35 * ourWidth;

  // 3. Space behind them (or the lack of it). Counter converts what it gets; a siege struggles to get any.
  const oppCommitment = commitment(opponent);
  const push = oppCommitment - 0.5;
  if (own.attackApproach === 'COUNTER_ATTACK') {
    goal *= 1 + 0.35 * push;
    chance *= 1 + 0.15 * push;
    // Counter into a deeply parked bus has no open space
    if (oppCommitment < 0.3) {
      chance *= 0.85;
      goal *= 0.82;
    }
  }
  if (own.attackApproach === 'TOTAL_ATTACK') {
    chance *= 1 + 0.22 * push;
    defense *= 0.92; // Pushing forward leaves vulnerability at the back
  }

  // 4. Their marking against our attacking style and approach.
  chance *= markingCounter(opponent.markingStyle, own.attackStyle, own.attackApproach);

  // 5. Line height owns the space behind; quick attackers punish an exposed high line most.
  const theirSpaceBehind = opponent.defensiveLine
    ? DEFENSIVE_LINE_MODIFIERS[defensiveLineOf(opponent)].spaceBehind
    : opponent.pressing === 'HIGH_PRESS'
      ? 1
      : opponent.pressing === 'LOW_BLOCK'
        ? 0
        : 0.5;
  if (own.attackApproach === 'COUNTER_ATTACK') {
    const danger = opponent.defensiveLine
      ? EXPLICIT_LINE_DANGER[opponent.defensiveLine] +
        theirSpaceBehind * EXPLICIT_LINE_DANGER_PACE * (clamp(own.attackerPace ?? 0.5, 0, 1) - 0.5) +
        (opponent.pressing === 'HIGH_PRESS'
          ? EXPLICIT_LINE_DANGER_PRESS
          : opponent.pressing === 'LOW_BLOCK'
            ? -EXPLICIT_LINE_DANGER_PRESS
            : 0)
      : 1 + SPACE_BEHIND_CONVERSION * (theirSpaceBehind - 0.5);
    goal *= danger;
    if (opponent.defensiveLine) spaceBehind = danger;
    chance *= 1 + 0.18 * (theirSpaceBehind - 0.5);
  }

  // 6. Our own press vs fatigue: rewards fresh legs, severely punishes tired legs.
  if (own.pressing === 'HIGH_PRESS') {
    const spent = clamp(own.avgFatigue / 100, 0, 1);
    if (spent < 0.3) {
      chance *= 1.08;
      defense *= 1.06;
    } else {
      chance *= 1 - TIRED_PRESS_CHANCE_LOSS * spent;
      defense *= 1 - TIRED_PRESS_DEFENSE_LOSS * spent;
    }
  }

  /**
   * 6b. Who you are pressing.
   *
   * Until this rule existed, pressing only ever asked about our own legs, which made it a stylistic
   * preference rather than a decision: high and low came out within a hundredth of a point of each other
   * over a thousand matches. A press is a bet that the opponent cannot play through it, and football
   * settles that bet on their passing, not on ours — so pressing a side that plays out well is the worst
   * option on the screen, and dropping off against them is the right one.
   */
  const theirBuildUp = opponent.buildUpQuality - 0.5;
  if (own.pressing === 'HIGH_PRESS') {
    chance *= 1 - PRESS_VS_BUILDUP_CHANCE * theirBuildUp;
    defense *= 1 - PRESS_VS_BUILDUP_DEFENSE * theirBuildUp;
  } else if (own.pressing === 'LOW_BLOCK') {
    // Denying the space behind is worth most against exactly the side that would have used it.
    defense *= 1 + LOW_BLOCK_VS_BUILDUP_DEFENSE * theirBuildUp;
    chance *= 1 - LOW_BLOCK_VS_BUILDUP_CHANCE * theirBuildUp;
  }

  // 7. Low block defensive solidity when protecting a result
  if (own.pressing === 'LOW_BLOCK' && own.mentality === 'defensive') {
    defense *= 1.12;
    chance *= 0.88;
  }

  // 8. Short-handed adaptations
  if (own.missingPlayers > 0) {
    const steps = Math.min(own.missingPlayers, MAX_SHORTHANDED_STEPS);
    if (own.attackApproach === 'TOTAL_ATTACK') {
      chance *= 1 + SHORTHANDED_ATTACK_GAMBLE * steps;
      defense *= 1 - SHORTHANDED_ATTACK_EXPOSURE * steps;
    } else if (own.attackApproach === 'COUNTER_ATTACK') {
      chance *= 1 - SHORTHANDED_DIG_IN_COST * steps;
      defense *= 1 + SHORTHANDED_DIG_IN_DEFENSE * steps;
    }
  }

  return {
    chance: clamp(chance, EFFECT_MIN, EFFECT_MAX),
    goal: clamp(goal, EFFECT_MIN, EFFECT_MAX),
    defense: clamp(defense, EFFECT_MIN, EFFECT_MAX),
    ...(spaceBehind === undefined ? {} : { spaceBehind }),
  };
}

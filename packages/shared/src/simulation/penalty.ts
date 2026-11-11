import { Player } from '../domain/player.js';
import { defaultDetailedAttributes } from '../domain/detailedAttributes.js';

/**
 * The penalty kick, resolved as a duel between two named players instead of two team-level numbers.
 *
 * Until this existed a spot kick was `0.78 + (finishing - teamGoalkeeping) / 400`: the taker's general
 * shooting against the *side's* goalkeeping rating. Nothing about being a specialist from twelve yards
 * mattered, and nothing about the keeper as an individual did either. Meanwhile the game already generates
 * 48 named attributes per player (see detailedAttributes.ts) including PENALTY_TAKING and PENALTY_SAVING,
 * all of them explicitly outside the simulation. This is the first place they get used.
 *
 * ## Composure
 *
 * The design called for a COMPOSURE attribute, which the game does not have and this deliberately does not
 * add. A permanent "coolness" stat would be a new number to generate, migrate and balance, and it would sit
 * frozen while everything interesting about nerve is situational. Composure here is *derived* instead, from
 * things the game already tracks and already moves: morale, how much is left in the legs, and personality.
 * A tired, unhappy, temperamental player is the one you do not want on the spot at 89 minutes — which is
 * exactly the story the existing systems were already telling and nothing was listening to.
 *
 * ## Calibration
 *
 * Real conversion sits around **76%** across a season, dropping into the low 70s for kicks that decide
 * something. `BASE_CONVERSION` is fitted so an ordinary taker against an ordinary keeper lands there, with
 * the attribute gap moving it out toward roughly 90% for a specialist against a poor keeper and down toward
 * 55% for a defender pressed into it against a good one. See scripts/penalty-check.ts.
 */

/** Conversion for a neutral duel with no pressure. Fitted so the league-wide rate lands near the real 76%. */
const BASE_CONVERSION = 0.76;

/** How far the attribute gap between the two players can swing the outcome. */
const DUEL_SWING = 0.55;

const MIN_CONVERSION = 0.3;
const MAX_CONVERSION = 0.95;

/** Weights for the two sides of the duel. Taken from the design brief, mapped onto attributes this game has. */
const TAKER_WEIGHTS = { penalty: 0.4, shot: 0.3, composure: 0.2, power: 0.1 };
const KEEPER_WEIGHTS = { penalty: 0.4, reflexes: 0.3, agility: 0.2, anticipation: 0.1 };

/** Composure inputs, all already tracked per player. */
const COMPOSURE_BASELINE = 50;
const COMPOSURE_FROM_MORALE = 0.45;
const COMPOSURE_FROM_FATIGUE = 0.3;
const COMPOSURE_LEADER_BONUS = 12;
const COMPOSURE_TEMPERAMENTAL_PENALTY = 14;

/** The most a decisive moment can take off a kick, before composure decides how much of it actually lands. */
const MAX_PRESSURE = 0.12;

/**
 * How steady this player is right now, 1 to 99. Not a stored attribute — see the note above on why.
 *
 * Fatigue bites harder than morale lifts, on purpose: a player who is emptied out has legs that will not do
 * what he tells them, which is a harder problem than being in a mood.
 */
export function composure(player: Player): number {
  let value = COMPOSURE_BASELINE + (player.morale - 50) * COMPOSURE_FROM_MORALE - player.fatigue * COMPOSURE_FROM_FATIGUE;
  if (player.traits.includes('LEADER')) value += COMPOSURE_LEADER_BONUS;
  if (player.traits.includes('TEMPERAMENTAL')) value -= COMPOSURE_TEMPERAMENTAL_PENALTY;
  return Math.max(1, Math.min(99, value));
}

/** The taker's side of the duel, 0 to 1: specialism from the spot first, then technique, nerve and power. */
export function penaltyTakerScore(player: Player): number {
  const a = player.detailedAttributes ?? defaultDetailedAttributes(player.attributes?.finishing ?? 50);
  return (
    (a.PENALTY_TAKING * TAKER_WEIGHTS.penalty +
      a.SHOT_POWER * TAKER_WEIGHTS.shot +
      composure(player) * TAKER_WEIGHTS.composure +
      a.POWER * TAKER_WEIGHTS.power) /
    100
  );
}

/** The keeper's side, 0 to 1: reading the taker first, then the raw ability to get across and reach it. */
export function penaltyKeeperScore(player: Player): number {
  const a = player.detailedAttributes ?? defaultDetailedAttributes(player.attributes?.goalkeeping ?? 50);
  return (
    (a.PENALTY_SAVING * KEEPER_WEIGHTS.penalty +
      a.REFLEXES * KEEPER_WEIGHTS.reflexes +
      a.AGILITY * KEEPER_WEIGHTS.agility +
      a.ANTICIPATION * KEEPER_WEIGHTS.anticipation) /
    100
  );
}

/**
 * How much this particular kick is worth, 0 to 1. A penalty in the 20th minute of a 3-0 is a formality; one
 * in the 89th with the game level is the match. Both halves of that matter — late *and* tight — so a late
 * kick in a settled game barely registers.
 */
export function penaltyPressure(minute: number, goalDifference: number): number {
  const late = Math.max(0, Math.min(1, (minute - 60) / 30));
  const tight = Math.abs(goalDifference) <= 1 ? 1 : Math.abs(goalDifference) === 2 ? 0.4 : 0;
  return late * tight;
}

/**
 * Chance the kick is scored.
 *
 * Pressure is filtered through the taker's composure rather than applied flat: the whole point of nerve is
 * that it is invisible until the moment is big, and then it is the only thing that matters. A composed
 * player takes an 89th-minute equaliser almost as well as a 20th-minute formality; a fragile one does not.
 */
export function penaltyConversionProbability(taker: Player, keeper: Player | null, pressure: number = 0): number {
  const edge = penaltyTakerScore(taker) - (keeper ? penaltyKeeperScore(keeper) : 0.5);
  const nerve = 1 - composure(taker) / 100;
  const cost = MAX_PRESSURE * Math.max(0, Math.min(1, pressure)) * nerve;
  return Math.max(MIN_CONVERSION, Math.min(MAX_CONVERSION, BASE_CONVERSION + edge * DUEL_SWING - cost));
}

/**
 * Given the kick was not scored, the chance it missed the target altogether rather than being saved.
 *
 * Skewed by who took it: a specialist who fails usually picked a corner the keeper guessed, while someone
 * who has no business being on the spot is the one who blazes it over. Feeds the shots-on-target column, so
 * a ballooned penalty correctly does not count as a shot on goal.
 *
 * The constant is set so a competent taker misses the target on roughly 40% of his failures, which is about
 * how real missed penalties split between saved and off target (or against the woodwork).
 */
export function penaltyOffTargetShare(taker: Player): number {
  const control = ((taker.detailedAttributes?.PENALTY_TAKING ?? taker.attributes?.finishing ?? 50) + composure(taker)) / 200;
  return Math.max(0.2, Math.min(0.75, 0.95 - control));
}

/**
 * Who steps up when the manager never named anyone: the best man on the pitch for it, keeper excluded.
 *
 * Previously this fell to a random attacker weighted by general finishing, which is not how any team has
 * ever taken a penalty — and with PENALTY_TAKING generated low for every role except centre-forward, it
 * meant most spot kicks were struck by someone with no business taking them. Real sides have a designated
 * taker whether or not the manager wrote it down, so this stands in for the one the dressing room would
 * have picked. Naming a taker in the tactic still overrides it; that choice now moves the odds instead of
 * only moving a name in the commentary.
 *
 * Deterministic, so it consumes no RNG and cannot perturb the seeded event stream.
 */
export function bestPenaltyTaker(onPitch: Player[]): Player | null {
  const outfield = onPitch.filter((p) => p.position !== 'GK');
  const pool = outfield.length > 0 ? outfield : onPitch;
  if (pool.length === 0) return null;
  return pool.reduce((best, p) => (penaltyTakerScore(p) > penaltyTakerScore(best) ? p : best));
}

import { Club } from '../domain/club.js';
import { MatchSide, PenaltyKickResult, PenaltyShootoutResult, PenaltyShotOutcome, PenaltyTargetZone } from '../domain/match.js';

export interface ResolvePenaltyShotResult {
  outcome: PenaltyShotOutcome;
  targetZone: PenaltyTargetZone;
  gkZone: PenaltyTargetZone;
  isGoal: boolean;
  isSaved: boolean;
  isOffTarget: boolean;
}

/**
 * Resolves a single spot kick into a target quadrant (1 to 5) and goalkeeper guess, as detailed in the
 * Technical Specification (PDF Section 4).
 * Target zones: 1-SupEsq, 2-SupDir, 3-InfEsq, 4-InfDir, 5-Centro.
 */
export function resolvePenaltyShot(
  taker: Player,
  keeper: Player | null,
  targetZone: PenaltyTargetZone,
  pressure: number,
  rng: () => number,
): ResolvePenaltyShotResult {
  const prob = penaltyConversionProbability(taker, keeper, pressure);
  const randVal = rng();

  // Miss chance (wide or against the post), amplified if stamina is low / fatigue is heavy
  const fatigueMultiplier = taker.fatigue > 70 ? 1.5 : 1.0;
  const missChance = ((1.0 - (composure(taker) + (taker.detailedAttributes?.SHOT_POWER ?? taker.attributes?.finishing ?? 50)) / 200) * 0.15) * fatigueMultiplier;

  const gkZone = (Math.floor(rng() * 5) + 1) as PenaltyTargetZone;

  if (randVal < missChance) {
    const outcome: PenaltyShotOutcome = rng() < 0.35 ? 'TRAVE' : 'FORA';
    return {
      outcome,
      targetZone,
      gkZone,
      isGoal: false,
      isSaved: false,
      isOffTarget: true,
    };
  }

  if (randVal <= prob) {
    // Keeper has a 25% chance of saving if guessing the exact same target zone
    if (gkZone === targetZone && rng() < 0.25) {
      return {
        outcome: 'DEFESA',
        targetZone,
        gkZone,
        isGoal: false,
        isSaved: true,
        isOffTarget: false,
      };
    }
    return {
      outcome: 'GOL',
      targetZone,
      gkZone,
      isGoal: true,
      isSaved: false,
      isOffTarget: false,
    };
  }

  // Not within conversion probability: keeper saves or ball goes off target
  const outcome: PenaltyShotOutcome = rng() < 0.7 ? 'DEFESA' : 'FORA';
  return {
    outcome,
    targetZone,
    gkZone,
    isGoal: false,
    isSaved: outcome === 'DEFESA',
    isOffTarget: outcome === 'FORA',
  };
}

/**
 * Builds the kicking order for a penalty shootout: respects any custom kicker IDs requested by the manager,
 * and fills the rest in descending order of penalty taking proficiency with the goalkeeper last.
 */
export function buildShootoutKickingOrder(lineup: Player[], customOrderIds?: string[]): Player[] {
  const byId = new Map(lineup.map((p) => [p.id, p]));
  const ordered: Player[] = [];
  const added = new Set<string>();

  if (customOrderIds) {
    for (const id of customOrderIds) {
      const player = byId.get(id);
      if (player && !added.has(id)) {
        ordered.push(player);
        added.add(id);
      }
    }
  }

  const outfield = lineup.filter((p) => p.position !== 'GK' && !added.has(p.id));
  outfield.sort((a, b) => penaltyTakerScore(b) - penaltyTakerScore(a));
  for (const player of outfield) {
    ordered.push(player);
    added.add(player.id);
  }

  const keepers = lineup.filter((p) => p.position === 'GK' && !added.has(p.id));
  for (const player of keepers) {
    ordered.push(player);
    added.add(player.id);
  }

  return ordered.length > 0 ? ordered : lineup;
}

/**
 * Simulates a complete knockout tiebreak penalty shootout (Disputa de Pênaltis) with official CBF / FIFA rules:
 * - 5 kicks per side alternated.
 * - Early termination when one side has an insurmountable lead.
 * - Sudden death rounds (round 6+) if tied after 5 kicks.
 */
export function simulatePenaltyShootout(
  homeClub: Club,
  awayClub: Club,
  homeLineup: Player[],
  awayLineup: Player[],
  rng: () => number,
  customHomeOrder?: string[],
  customAwayOrder?: string[],
): PenaltyShootoutResult {
  const homeKickers = buildShootoutKickingOrder(homeLineup, customHomeOrder);
  const awayKickers = buildShootoutKickingOrder(awayLineup, customAwayOrder);

  const homeGk = homeLineup.find((p) => p.position === 'GK') ?? homeLineup[0];
  const awayGk = awayLineup.find((p) => p.position === 'GK') ?? awayLineup[0];

  const kicks: PenaltyKickResult[] = [];
  let homeScore = 0;
  let awayScore = 0;
  let homeKicksTaken = 0;
  let awayKicksTaken = 0;

  // Regular 5-round series
  for (let r = 1; r <= 5; r++) {
    // 1. Home team kick
    const homeTaker = homeKickers[(r - 1) % homeKickers.length];
    const homeTarget = (Math.floor(rng() * 5) + 1) as PenaltyTargetZone;
    const homePressure = 0.2 + (r / 5) * 0.4;
    const homeShot = resolvePenaltyShot(homeTaker, awayGk, homeTarget, homePressure, rng);

    const homeScoreBefore = { home: homeScore, away: awayScore };
    if (homeShot.isGoal) homeScore++;
    homeKicksTaken++;
    const homeScoreAfter = { home: homeScore, away: awayScore };

    kicks.push({
      roundNumber: r,
      team: 'home',
      kickerId: homeTaker.id,
      kickerName: homeTaker.name,
      goalkeeperId: awayGk.id,
      goalkeeperName: awayGk.name,
      targetZone: homeShot.targetZone,
      gkZone: homeShot.gkZone,
      outcome: homeShot.outcome,
      scoreBefore: homeScoreBefore,
      scoreAfter: homeScoreAfter,
      isSuddenDeath: false,
    });

    // Mathematical check after Home kick
    const awayRemainingAfterHome = 5 - awayKicksTaken;
    const homeRemainingAfterHome = 5 - homeKicksTaken;
    if (homeScore > awayScore + awayRemainingAfterHome || awayScore > homeScore + homeRemainingAfterHome) {
      break;
    }

    // 2. Away team kick
    const awayTaker = awayKickers[(r - 1) % awayKickers.length];
    const awayTarget = (Math.floor(rng() * 5) + 1) as PenaltyTargetZone;
    const awayPressure = 0.2 + (r / 5) * 0.4;
    const awayShot = resolvePenaltyShot(awayTaker, homeGk, awayTarget, awayPressure, rng);

    const awayScoreBefore = { home: homeScore, away: awayScore };
    if (awayShot.isGoal) awayScore++;
    awayKicksTaken++;
    const awayScoreAfter = { home: homeScore, away: awayScore };

    kicks.push({
      roundNumber: r,
      team: 'away',
      kickerId: awayTaker.id,
      kickerName: awayTaker.name,
      goalkeeperId: homeGk.id,
      goalkeeperName: homeGk.name,
      targetZone: awayShot.targetZone,
      gkZone: awayShot.gkZone,
      outcome: awayShot.outcome,
      scoreBefore: awayScoreBefore,
      scoreAfter: awayScoreAfter,
      isSuddenDeath: false,
    });

    // Mathematical check after Away kick
    const awayRemainingAfterAway = 5 - awayKicksTaken;
    const homeRemainingAfterAway = 5 - homeKicksTaken;
    if (homeScore > awayScore + awayRemainingAfterAway || awayScore > homeScore + homeRemainingAfterAway) {
      break;
    }
  }

  // Sudden Death if level after 5 kicks
  if (homeKicksTaken === 5 && awayKicksTaken === 5 && homeScore === awayScore) {
    let round = 6;
    const maxRounds = 30; // Safety cap
    while (homeScore === awayScore && round <= maxRounds) {
      // Home kick in sudden death
      const homeTaker = homeKickers[(round - 1) % homeKickers.length];
      const homeTarget = (Math.floor(rng() * 5) + 1) as PenaltyTargetZone;
      const homeShot = resolvePenaltyShot(homeTaker, awayGk, homeTarget, 0.8, rng);
      const homeScoreBefore = { home: homeScore, away: awayScore };
      if (homeShot.isGoal) homeScore++;
      const homeScoreAfter = { home: homeScore, away: awayScore };

      kicks.push({
        roundNumber: round,
        team: 'home',
        kickerId: homeTaker.id,
        kickerName: homeTaker.name,
        goalkeeperId: awayGk.id,
        goalkeeperName: awayGk.name,
        targetZone: homeShot.targetZone,
        gkZone: homeShot.gkZone,
        outcome: homeShot.outcome,
        scoreBefore: homeScoreBefore,
        scoreAfter: homeScoreAfter,
        isSuddenDeath: true,
      });

      // Away kick in sudden death
      const awayTaker = awayKickers[(round - 1) % awayKickers.length];
      const awayTarget = (Math.floor(rng() * 5) + 1) as PenaltyTargetZone;
      const awayShot = resolvePenaltyShot(awayTaker, homeGk, awayTarget, 0.8, rng);
      const awayScoreBefore = { home: homeScore, away: awayScore };
      if (awayShot.isGoal) awayScore++;
      const awayScoreAfter = { home: homeScore, away: awayScore };

      kicks.push({
        roundNumber: round,
        team: 'away',
        kickerId: awayTaker.id,
        kickerName: awayTaker.name,
        goalkeeperId: homeGk.id,
        goalkeeperName: homeGk.name,
        targetZone: awayShot.targetZone,
        gkZone: awayShot.gkZone,
        outcome: awayShot.outcome,
        scoreBefore: awayScoreBefore,
        scoreAfter: awayScoreAfter,
        isSuddenDeath: true,
      });

      round++;
    }
  }

  const winnerSide: MatchSide = homeScore > awayScore ? 'home' : 'away';
  const winnerClubId = winnerSide === 'home' ? homeClub.id : awayClub.id;

  return {
    winnerClubId,
    winnerSide,
    homeScore,
    awayScore,
    kicks,
    homeOrder: homeKickers.map((p) => p.id),
    awayOrder: awayKickers.map((p) => p.id),
  };
}


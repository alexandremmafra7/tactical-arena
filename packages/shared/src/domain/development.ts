import { Player, PlayerAttributes, TrainingFocus, isEliteQuality, PEAK_AGE_START, PEAK_AGE_END, calculateMarketValue, calculateOverall } from './player.js';
import { applyMatchDevelopmentStyleBonus, type ManagerStyleId } from './managerStyle.js';

export const GROWTH_AGE_CEILING = PEAK_AGE_START - 1;
const BASE_YOUNG_GROWTH = 0.6;
const DEVELOPMENT_POINTS_GROWTH_FACTOR = 0.04;
const MAX_GROWTH_PER_TICK = 3;

/**
 * Youth plasticity: how much more a given week of development is worth to a fourteen-year-old than to a
 * twenty-three-year-old.
 */
const PLASTICITY_PEAK_AGE = 14;
const PLASTICITY_MAX = 2.6;

const PLATEAU_RESIDUAL_GROWTH = 0.15;

const BASE_VETERAN_DECLINE = 0.4;
const MAX_DECLINE_PER_TICK = 1.2;
const VETERAN_DECLINE_MITIGATION_FACTOR = 0.02;

export const STAR_BREAKTHROUGH_MIN_OVERALL = 90;
export const STAR_BREAKTHROUGH_MAX_AGE = 29;
export const STAR_BREAKTHROUGH_MIN_DEVELOPMENT_POINTS = 15;
const STAR_BREAKTHROUGH_CHANCE = 0.04;
const STAR_BREAKTHROUGH_POTENTIAL_BONUS = 3;

const DEVELOPMENT_POINTS_DECAY = 0.5;

/** An UNDISCIPLINED player squanders training investment — the same developmentPoints buy less growth. */
const UNDISCIPLINED_GROWTH_MULTIPLIER = 0.6;

const TRAINING_FOCUS_ATTRIBUTES: Record<TrainingFocus, (keyof PlayerAttributes)[]> = {
  PHYSICAL: ['physical', 'pace'],
  TECHNICAL: ['passing', 'finishing'],
  MENTAL: ['passing', 'defending'],
  FINISHING: ['finishing'],
  PASSING: ['passing'],
  DEFENDING: ['defending'],
  PACE: ['pace'],
};

/** Points added to each targeted attribute once per training/development cycle. */
const FOCUS_ATTRIBUTE_BOOST = 2;

/**
 * O jogador já chegou ao limite dele.
 *
 * Existe para o jogo poder recusar uma sessão em vez de cobrar por nada. Um jogador cujo potencial é igual
 * ao overall não tem o que ganhar, e isso vale para a maioria dos atletas a partir dos vinte e seis anos.
 */
export function isAtPotential(player: Player): boolean {
  return player.overall >= player.potential;
}

function trainingFocusEfficiency(age: number): number {
  if (age <= GROWTH_AGE_CEILING) return developmentPlasticity(age);
  if (age <= PEAK_AGE_END) return 0.6;
  return 0.3;
}

/**
 * Executes a deliberate training session on a player, immediately granting developmentPoints
 * and applying tangible attribute improvements and overall recalculation.
 */
export function executePlayerTrainingSession(
  player: Player,
  focus?: TrainingFocus | null,
  fitnessCoachBoost: number = 1.0,
  youthCoordinatorBoost: number = 1.0,
): Player {
  const isYouth = player.age <= GROWTH_AGE_CEILING;
  const youthMult = isYouth ? youthCoordinatorBoost : 1.0;
  const growthMultiplier = (player.traits.includes('UNDISCIPLINED') ? UNDISCIPLINED_GROWTH_MULTIPLIER : 1.0) * youthMult;
  
  const devPointsGained = Math.round(20 * youthMult);
  const developmentPoints = player.developmentPoints + devPointsGained;

  const attributes = { ...player.attributes };
  let commitment = player.commitment;

  const efficiency = trainingFocusEfficiency(player.age) * growthMultiplier;

  if (focus === 'MENTAL') {
    commitment = Math.min(100, commitment + Math.max(1, Math.round(3 * efficiency)));
    attributes.passing = Math.min(99, attributes.passing + (efficiency >= 1.2 ? 1 : 0));
    attributes.defending = Math.min(99, attributes.defending + (efficiency >= 1.2 ? 1 : 0));
  } else if (focus === 'PHYSICAL') {
    const boost = Math.max(1, Math.round(FOCUS_ATTRIBUTE_BOOST * efficiency * fitnessCoachBoost));
    attributes.physical = Math.min(99, attributes.physical + boost);
    attributes.pace = Math.min(99, attributes.pace + Math.max(1, Math.round(boost * 0.8)));
  } else if (focus === 'TECHNICAL') {
    const boost = Math.max(1, Math.round(FOCUS_ATTRIBUTE_BOOST * efficiency));
    if (player.position === 'GK') {
      attributes.goalkeeping = Math.min(99, attributes.goalkeeping + boost);
    } else {
      attributes.passing = Math.min(99, attributes.passing + boost);
      attributes.finishing = Math.min(99, attributes.finishing + boost);
    }
  } else if (focus === 'FINISHING' || focus === 'PASSING' || focus === 'DEFENDING' || focus === 'PACE') {
    const attribute = focus.toLowerCase() as 'finishing' | 'passing' | 'defending' | 'pace';
    const boost = Math.max(1, Math.round(FOCUS_ATTRIBUTE_BOOST * efficiency));
    attributes[attribute] = Math.min(99, attributes[attribute] + boost);
  } else {
    // General training
    const boost = Math.max(1, Math.round(1.5 * efficiency));
    if (player.position === 'GK') {
      attributes.goalkeeping = Math.min(99, attributes.goalkeeping + boost);
      attributes.physical = Math.min(99, attributes.physical + Math.max(1, Math.round(boost * 0.5)));
    } else if (player.position === 'DEF' || player.position === 'LAT') {
      attributes.defending = Math.min(99, attributes.defending + boost);
      attributes.physical = Math.min(99, attributes.physical + Math.max(1, Math.round(boost * 0.6)));
    } else if (player.position === 'MID') {
      attributes.passing = Math.min(99, attributes.passing + boost);
      attributes.pace = Math.min(99, attributes.pace + Math.max(1, Math.round(boost * 0.5)));
    } else {
      attributes.finishing = Math.min(99, attributes.finishing + boost);
      attributes.pace = Math.min(99, attributes.pace + Math.max(1, Math.round(boost * 0.6)));
    }
  }

  /**
   * O teto do potencial trava o atributo, e não só o número mostrado.
   *
   * Estava a travar apenas a exibição: os atributos subiam sem limite e o overall ficava preso no potencial.
   * De 26 anos em diante `potencial` é igual a `overall`, então dez sessões pagas levavam o cálculo dos
   * atributos de 71 para 76 e a ficha do jogador continuava a dizer 71, com o valor de mercado parado. O
   * técnico gastava seiscentos e setenta mil e não tinha como saber se alguma coisa acontecera.
   *
   * Travar o atributo é o que mantém o potencial significando o que promete. E quem já está no teto não
   * paga por sessão nenhuma: `isAtPotential` avisa antes, e o serviço recusa em vez de cobrar.
   */
  const rawOverall = calculateOverall(player.position, attributes);
  const overall = Math.min(player.potential, Math.max(player.overall, rawOverall));
  if (rawOverall > player.potential) {
    return { ...player, developmentPoints, commitment };
  }
  const marketValue = calculateMarketValue(player.age, overall, player.potential, player.starLevel);

  return {
    ...player,
    attributes,
    commitment,
    overall,
    marketValue,
    developmentPoints,
    trainingFocus: focus ?? null,
  };
}

/**
 * Applies one development tick's pending training focus on top of general development.
 */
function applyTrainingFocus(player: Player, fitnessCoachBoost: number = 1.0): Player {
  if (!player.trainingFocus) return player;

  const growthMultiplier = player.traits.includes('UNDISCIPLINED') ? UNDISCIPLINED_GROWTH_MULTIPLIER : 1;
  const boost = Math.round(FOCUS_ATTRIBUTE_BOOST * trainingFocusEfficiency(player.age) * growthMultiplier);
  if (boost <= 0) return player;

  if (player.trainingFocus === 'MENTAL') {
    return { ...player, commitment: Math.min(100, player.commitment + boost) };
  }

  const targets = TRAINING_FOCUS_ATTRIBUTES[player.trainingFocus] ?? [];
  const attributes = { ...player.attributes };
  const targetBoost = player.trainingFocus === 'PHYSICAL' ? Math.round(boost * fitnessCoachBoost) : boost;
  for (const key of targets) {
    attributes[key] = Math.min(99, attributes[key] + targetBoost);
  }
  const calculado = calculateOverall(player.position, attributes);
  // Mesma trava do treino pago: no teto, o atributo para de subir em vez de subir sem aparecer.
  if (calculado > player.potential) return player;

  const overall = Math.min(player.potential, Math.max(player.overall, calculado));
  return {
    ...player,
    attributes,
    overall,
    marketValue: calculateMarketValue(player.age, overall, player.potential, player.starLevel),
  };
}

/** A week of rest recovers most of the fatigue built up from playing matches. */
const WEEKLY_FATIGUE_RECOVERY = 30;
/** How far a player's `physical` (1-99) pushes their weekly recovery away from the flat baseline. */
const PHYSICAL_RECOVERY_SWING = 0.25;
/** A player past their physical peak recovers a bit slower each week, same peak window as `ageFactor`. */
const VETERAN_RECOVERY_PENALTY = 0.1;
/** Fraction of the gap to the player's `commitment` that closes each week — a match-driven mood swing fades
 *  over a few weeks toward how much this player actually trusts the coach, unless refreshed by new results. */
const WEEKLY_MORALE_REVERSION = 0.25;
/** Within this much of `commitment`, morale simply lands on it rather than halving toward it forever. */
const MORALE_SETTLE_THRESHOLD = 0.5;

/**
 * Regular retirement age. Elite players (see `isEliteQuality`) get a later one — reusing the same "elite"
 * bar already used to flatten the age curve keeps the concept of quality-attenuated aging consistent everywhere.
 */
export const BASE_RETIREMENT_AGE = 35;
export const ELITE_RETIREMENT_AGE = 40;

/**
 * The multiplier a player's age puts on a week of development, 1 at the top of the growth window and
 * `PLASTICITY_MAX` at `PLASTICITY_PEAK_AGE` — see the note on those constants.
 *
 * Exported so the academy screen can tell a manager *why* this fifteen-year-old is worth a training slot
 * and that twenty-two-year-old is not, rather than leaving it as an invisible curve.
 */
export function developmentPlasticity(age: number): number {
  if (age >= GROWTH_AGE_CEILING) return 1;
  if (age <= PLASTICITY_PEAK_AGE) return PLASTICITY_MAX;
  const towardYouth = (GROWTH_AGE_CEILING - age) / (GROWTH_AGE_CEILING - PLASTICITY_PEAK_AGE);
  return 1 + (PLASTICITY_MAX - 1) * towardYouth;
}

/**
 * What a full match is worth in development, before the age curve is applied.
 *
 * Sized against `TRAINING_DEVELOPMENT_BOOST` (20, one deliberate training session): a match is worth
 * about a quarter of that, so a season of playing develops a regular meaningfully while a manager who
 * *also* trains still gets clearly more out of the same player. Playing should never beat coaching.
 */
export const MATCH_DEVELOPMENT_POINTS_FULL_MATCH = 5;

/**
 * Development earned by actually playing.
 *
 * Until now `developmentPoints` came only from a manager pressing "treinar", which meant they came only
 * from the one club a human runs. Every other player in the world — the entire opposition, every squad in
 * every other league — earned nothing ever, so once the world started running its own competitions in the
 * background those players would sit frozen at their starting overall while the manager's squad pulled
 * away. That is not a balance quirk, it is the world quietly dying around the player.
 *
 * The rule is deliberately the same for everyone, human-managed or not: **minutes on the pitch develop a
 * footballer.** It scales with minutes actually played, so a bench player gains little and a regular
 * gains steadily, and it runs through the same `developmentPlasticity` age curve as everything else, so a
 * teenager learns far more from ninety minutes than a thirty-year-old does.
 *
 * Applied after every match by both paths — the one the manager watches and the result-only one used for
 * matches nobody sees — because a rule that only held for observed matches would recreate the very
 * divergence it exists to prevent.
 */
export function matchDevelopmentPoints(age: number, minutesPlayed: number, managerStyle?: ManagerStyleId | string | null): number {
  if (minutesPlayed <= 0) return 0;
  const share = Math.min(1, minutesPlayed / 90);
  const base = MATCH_DEVELOPMENT_POINTS_FULL_MATCH * share * developmentPlasticity(age);
  return applyMatchDevelopmentStyleBonus(base, age, managerStyle);
}

export function retirementAge(player: Player): number {
  return isEliteQuality(player.overall, player.starLevel) ? ELITE_RETIREMENT_AGE : BASE_RETIREMENT_AGE;
}

export function hasRetired(player: Player): boolean {
  return player.age >= retirementAge(player);
}

export interface WeeklyRecoveryOptions {
  fitnessStaminaBoost?: number;
  youthCoordinatorBoost?: number;
  isAcademy?: boolean;
  simplePreset?: boolean;
}

/**
 * One week of rest, coaching, and development: fatigue drains, morale drifts back toward commitment,
 * active training focus lands, and youth/academy prospects steadily convert weekly development into attribute growth.
 */
export function applyWeeklyRecovery(player: Player, options: WeeklyRecoveryOptions = {}): Player {
  const fitnessMultiplier = options.fitnessStaminaBoost ? 1.0 + options.fitnessStaminaBoost : 1.0;
  const withFocus = applyTrainingFocus(player, fitnessMultiplier);

  const physicalRecoveryFactor = 1 + ((withFocus.attributes.physical - 50) / 49) * PHYSICAL_RECOVERY_SWING;
  const veteranRecoveryFactor = player.age > PEAK_AGE_END ? 1 - VETERAN_RECOVERY_PENALTY : 1;
  const staminaBoostMultiplier = 1.0 + (options.fitnessStaminaBoost ?? 0) + (options.simplePreset ? 0.2 : 0);
  const weeklyRecovery = WEEKLY_FATIGUE_RECOVERY * physicalRecoveryFactor * veteranRecoveryFactor * staminaBoostMultiplier;
  const fatigue = Math.max(0, player.fatigue - weeklyRecovery);

  const drifted = player.morale + (player.commitment - player.morale) * WEEKLY_MORALE_REVERSION;
  const morale = Math.abs(player.commitment - drifted) < MORALE_SETTLE_THRESHOLD ? player.commitment : drifted;

  let attributes = { ...withFocus.attributes };
  let overall = withFocus.overall;
  let marketValue = withFocus.marketValue;
  let devPoints = player.developmentPoints;

  // Youth Academy & Young Prospect weekly progression
  const isYouth = player.age <= GROWTH_AGE_CEILING;
  if (isYouth && (options.isAcademy || devPoints >= 10)) {
    const youthMultiplier = (options.youthCoordinatorBoost ?? 1.0) * developmentPlasticity(player.age);
    // Weekly continuous academy coaching
    if (options.isAcademy && overall < player.potential) {
      if (player.position === 'GK') {
        attributes.goalkeeping = Math.min(player.potential, attributes.goalkeeping + (youthMultiplier >= 1.5 ? 1 : 0));
      } else if (player.position === 'DEF' || player.position === 'LAT') {
        attributes.defending = Math.min(player.potential, attributes.defending + (youthMultiplier >= 1.5 ? 1 : 0));
      } else if (player.position === 'MID') {
        attributes.passing = Math.min(player.potential, attributes.passing + (youthMultiplier >= 1.5 ? 1 : 0));
      } else {
        attributes.finishing = Math.min(player.potential, attributes.finishing + (youthMultiplier >= 1.5 ? 1 : 0));
      }
      overall = Math.min(player.potential, Math.max(overall, calculateOverall(player.position, attributes)));
      marketValue = calculateMarketValue(player.age, overall, player.potential, player.starLevel);
    }
  }

  if (!player.trainingFocus && withFocus === player && fatigue === player.fatigue && morale === player.morale && overall === player.overall) {
    return player;
  }

  return {
    ...player,
    trainingFocus: null,
    attributes,
    overall,
    marketValue,
    commitment: withFocus.commitment,
    fatigue,
    morale,
  };
}

/**
 * Advances a player by one year: they age, and `overall` drifts toward `potential` (fast growth while
 * young, small residual growth on the plateau, decline past the plateau attenuated for elite players and
 * softened for anyone with invested developmentPoints — see VETERAN_DECLINE_MITIGATION_FACTOR). Invested
 * `developmentPoints` accelerate growth and are consumed (decayed) here, which is why breaking through to
 * a DEVELOPED star requires sustained investment rather than a single training session.
 *
 * This is the season turn, not the week (see `applyWeeklyRecovery`). Keeping growth annual is what lets
 * the constants below stay exactly as they were calibrated: one step per year, as before. It also gives
 * `developmentPoints` a season to accumulate across training sessions and minutes played, so a year of
 * being coached and picked is what moves a player, rather than a single click.
 */
export function evolvePlayer(player: Player, rng: () => number): Player {
  const elite = isEliteQuality(player.overall, player.starLevel);
  const growthMultiplier = player.traits.includes('UNDISCIPLINED') ? UNDISCIPLINED_GROWTH_MULTIPLIER : 1;
  let overall = player.overall;
  let potential = player.potential;
  let starLevel = player.starLevel;

  if (player.age <= GROWTH_AGE_CEILING) {
    // Plasticity scales the capped step rather than the raw one, so it lifts the ceiling too: what counts
    // as an implausible jump in a single week is itself a function of how young the player is.
    const growthStep =
      Math.min(MAX_GROWTH_PER_TICK, BASE_YOUNG_GROWTH + player.developmentPoints * DEVELOPMENT_POINTS_GROWTH_FACTOR) *
      developmentPlasticity(player.age) *
      growthMultiplier;
    overall = Math.min(potential, overall + growthStep);
  } else if (player.age >= PEAK_AGE_START && player.age <= PEAK_AGE_END) {
    if (overall < potential) {
      const growthStep = (PLATEAU_RESIDUAL_GROWTH + player.developmentPoints * DEVELOPMENT_POINTS_GROWTH_FACTOR * 0.5) * growthMultiplier;
      overall = Math.min(potential, overall + growthStep);
    }
  } else {
    const declineStep = Math.min(MAX_DECLINE_PER_TICK, BASE_VETERAN_DECLINE * (elite ? 0.5 : 1));
    // Training doesn't reverse a veteran's decline into growth, only softens it — floored at 0 rather
    // than letting a big enough mitigation push `overall` upward for a player past their peak.
    const veteranMitigation = player.developmentPoints * VETERAN_DECLINE_MITIGATION_FACTOR * growthMultiplier;
    overall = Math.max(1, overall - Math.max(0, declineStep - veteranMitigation));
  }

  overall = Math.round(overall * 10) / 10;

  const qualifiesForBreakthrough =
    starLevel === 'NONE' &&
    overall >= STAR_BREAKTHROUGH_MIN_OVERALL &&
    player.age <= STAR_BREAKTHROUGH_MAX_AGE &&
    player.developmentPoints >= STAR_BREAKTHROUGH_MIN_DEVELOPMENT_POINTS;

  if (qualifiesForBreakthrough && rng() < STAR_BREAKTHROUGH_CHANCE) {
    starLevel = 'DEVELOPED';
    potential = Math.min(99, potential + STAR_BREAKTHROUGH_POTENTIAL_BONUS);
  }

  const developmentPoints = Math.floor(player.developmentPoints * DEVELOPMENT_POINTS_DECAY);
  const age = player.age + 1;

  return {
    ...player,
    age,
    overall,
    potential,
    starLevel,
    developmentPoints,
    marketValue: calculateMarketValue(age, overall, potential, starLevel),
  };
}

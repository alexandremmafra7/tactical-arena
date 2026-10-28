import { Club } from '../domain/club.js';
import {
  ATTACK_APPROACH_MODIFIERS,
  MAX_SUBSTITUTIONS,
  ATTACK_STYLE_MODIFIERS,
  DEFENSIVE_LINE_MODIFIERS,
  PRESSING_MODIFIERS,
  Tactic,
  defensiveLineOf,
  pressingOf,
  transitionStyleOf,
} from '../domain/tactic.js';
import { Player } from '../domain/player.js';
import { MatchEvent, MatchResult, MatchSide, PendingMatchDecision } from '../domain/match.js';
import { createRng } from './rng.js';
import { computeTeamStrength, starFactor, TeamStrength } from './teamStrength.js';
import { getInjuryReductionRate, getTacticalAssistantBonus } from '../domain/staff.js';
import { bookedPlayerIds, dismissalSettlingFactor, offPitchPlayerIds, sentOffPlayerIds } from './numericalDisadvantage.js';
import { HomeAdvantageFactors, NEUTRAL_HOME_ADVANTAGE, homeAdvantageFactors } from './homeAdvantage.js';
import { MatchWeather, NEUTRAL_WEATHER, WeatherFactors, weatherAttackFactor, weatherFactors } from './weather.js';
import { bestPenaltyTaker, penaltyConversionProbability, penaltyOffTargetShare, penaltyPressure } from './penalty.js';
import { TacticalSetup, tacticalMatchup } from './tacticalMatchup.js';
import { calculateShotXg, isBigChance, ShotType } from './xg.js';
import { calculateStoppageTime } from './stoppageTime.js';

// O tipo e os multiplicadores moram em weather.ts; aqui ele segue reexportado para quem já o importava.
export type { MatchWeather };

export interface MatchParticipant {
  club: Club;
  tactic: Tactic;
}

export interface SimulateMatchInput {
  home: MatchParticipant;
  away: MatchParticipant;
  seed: string;
  /** How full the home ground is, 0 to 1 — see `SimulateMatchSegmentInput.crowdIntensity`. */
  crowdIntensity?: number;
  /** Match weather / pitch conditions: DRY (standard), RAIN (wet pitch), HOT (heavy fatigue). */
  weather?: MatchWeather;
}

const MINUTES = 90;
export { MINUTES as MATCH_MINUTES };

/**
 * Sigmoid (S-curve) utility function for non-linear attribute scaling (PDF Section 4).
 * Smoothly bounds output while amplifying elite tier differences without hard clamp cliffs.
 */
export function sigmoidCurve(delta: number, baseTarget: number, min: number, max: number, steepness: number = 0.018): number {
  const ratio = (max - min) / Math.max(0.001, baseTarget - min) - 1;
  const shift = Math.log(Math.max(0.001, ratio));
  return min + (max - min) / (1 + Math.exp(-steepness * delta + shift));
}

/**
 * How often the referee blows for a foul, per side per minute.
 *
 * Fitted to the **Brasileirão's** 24.6 fouls a match, not a European league's 22: this is the second most
 * foul-heavy national league in the world, and it is the one the game models. The old value produced 2.2,
 * which left the "Faltas" line on the stats card reading 1 x 1 in a game with two dozen shots, and made
 * cards so rare that a booking meant almost nothing.
 *
 * Only the fouls that produce a card reach the commentary (see resolveFoul) — the other twenty live in the
 * stat line, the same treatment an attempt off target gets.
 */
const FOUL_BASE_PROB = 0.126;
const AGGRESSIVE_FOUL_WEIGHT_BONUS = 2.5;
const PROVOCATIVE_CONFUSION_CHANCE = 0.2;
/** How much of his usual recklessness a booked player keeps — see the note in resolveFoul. */
const BOOKED_CAUTION = 0.07;

/**
 * Per-minute, per-side chance that someone pulls up hurt.
 *
 * The previous value (0.009) was set against the wrong quantity. It aimed at total match injury
 * incidence — every knock that costs a player training time, ~25-36 per 1000 player-hours, which works
 * out near one per match across both teams. But most of those are reported after the final whistle;
 * the player finishes the game. What this engine models is the incapacitating kind that stops play and
 * forces the manager to make a substitution, which is roughly a third of them.
 *
 * On top of aiming at the wrong target it overshot it anyway: measured 1.61 per match against its own
 * stated ~1.0. Now calibrated against 0.30 per match, both teams combined — about one every three
 * matches — and pinned by `matchProfile.test.ts` so it cannot drift again.
 */
const INJURY_BASE_PROB = 0.00168;
/** At full squad fatigue (avg 100), the per-minute injury chance is 2.5x the fresh-legs baseline. */
const INJURY_FATIGUE_MAX_MULTIPLIER = 1.5;

/**
 * How busy a match is, and how often the chances it produces are taken.
 *
 * These two used to sit at 0.02 and 0.25, which produced a match of 4 shots and 1.0 goals where a real one
 * has 25 and 2.7 — a quarter of the goals off a sixth of the shots, held up by a conversion rate of 25%
 * against football's real 10.5%. Every chance was a near-certainty and there were hardly any, so 35% of
 * matches finished nil-nil (real: 7%) and 45% were drawn (real: 25%). Fitted against the full match profile
 * in scripts/match-profile.ts rather than one number at a time, because moving either alone just trades one
 * unrealistic figure for another.
 *
 * The divisor is what keeps a good side beating a bad one: it converts the attack-versus-defence gap into
 * extra chances, and had to come down alongside the base to preserve the gulf between a 90-rated squad and
 * a 30-rated one that the old numbers produced by accident.
 *
 * The two are fitted together and cannot be moved apart. When the chance funnel was last retuned, the
 * goal base was left where it was, and the match quietly drifted to 2.40 goals at 9.6% conversion against
 * football's 2.70 and 10.5% — with the model contradicting itself, since the chances it was creating were
 * worth 2.72 xG and only 2.40 were being scored. Refitting the goal base against the profile closed all
 * three at once. Change one of these and re-run scripts/match-profile.ts; never change one on its own.
 */
const CHANCE_BASE_PROB = 0.1200;
const CHANCE_STRENGTH_DIVISOR = 550;
const GOAL_BASE_PROB = 0.0980;

/** Share of goal-scoring chances that turn out to be a penalty kick instead of open play. Fitted so the
 *  match sees roughly the 0.27 spot kicks a real one does (see scripts/penalty-check.ts). Expressed as a
 *  share of chances, so it moves whenever the chance rate does. */
const PENALTY_SHARE_OF_CHANCES = 0.0108;

/** Corners aren't modeled as their own event stream (no player/description worth surfacing, unlike a shot
 *  or a foul) — just a per-minute count nudged by the same attack-vs-defense balance as chance creation,
 *  calibrated to land a full match around 4-6 per side. */
const CORNER_BASE_PROB = 0.047;

/** Same "silent counter, no event stream" treatment as corners — see Submenu Tática/Escalação spec (3.9),
 *  "sua pressão alta recuperou N bolas no campo ofensivo". Scaled by PRESSING_MODIFIERS' own `chance`
 *  multiplier (already tuned to represent how much more a given intensity generates in the final third)
 *  rather than a parallel dial, so LOW_BLOCK barely wins the ball high up and HIGH_PRESS does it often. */
const PRESS_RECOVERY_BASE_PROB = 0.05;

/** Of the chances that don't end in a goal, how many still forced a save (on target) rather than going
 *  wide, over, or getting blocked — split out purely for the "no gol" stat, no gameplay effect either way.
 *  Set so total shots on target land near the real third of all attempts. (A missed *penalty* has its own
 *  split, driven by who took it — see penaltyOffTargetShare.) */
const ON_TARGET_SHARE_OPEN_MISS = 0.26;

/**
 * Post-loss transition (Phase 2): COUNTERPRESS is a bounded duel — pressing collective vs receiving
 * collective — rather than a coin flip, per the approved design's "bounded normalized comparison
 * centered around 50% for equal collective attributes" (min 15%, max 75%).
 */
const COUNTERPRESS_BASE_PROB = 0.5;
const COUNTERPRESS_MIN_PROB = 0.15;
const COUNTERPRESS_MAX_PROB = 0.75;
const COUNTERPRESS_ATTRIBUTE_DIVISOR = 220;
const COUNTERPRESS_FATIGUE_PENALTY = 0.002;
const COUNTERPRESS_REST_DEFENCE_WEIGHT = 0.1;

/** A successful counterpress wins the ball back high and unsettled — worth a small, deliberately modest
 *  bump to the immediate follow-up chance's goal probability, not a fresh mechanic of its own. */
const COUNTERPRESS_RAPID_GOAL_BOOST = 1.08;

/** Winning the ball back via counterpress is common (the duel is bounded 15-75%); a clear shooting chance
 *  from it is not. The "immediate rapid chance" per the spec is only a small, bounded chance on top of a
 *  successful recovery — gating it at the same order of magnitude as the side's normal per-minute chance
 *  probability (rather than firing on every success) is what keeps it "modest" enough not to double a
 *  match's shot volume for any side that presses. See realismFloor.test.ts, which pins the ceiling this
 *  protects. */
const COUNTERPRESS_RAPID_CHANCE_MULTIPLIER = 0;

/** How much extra counterattack-chance probability a disorganized side concedes to its opponent's very
 *  next offensive sequence, scaled by the disorganized side's own flank vulnerability (see
 *  `RestDefenceModifiers`) — bounded and modest, per the approved spec, so it creates tactical identity
 *  without turning a single failed counterpress into a decisive event on its own. */
const DISORGANIZATION_CHANCE_BONUS = 0.20;

/**
 * Deterministically picks one of `variants` from a key built out of values that already vary event to
 * event (the player's id, the minute) rather than consuming an RNG draw — keeps the commentary from
 * repeating the exact same line every time without touching the seeded random stream the rest of the
 * engine relies on for reproducibility (and without perturbing every downstream draw the way spending an
 * extra `rng()` call here would).
 */
function pickVariant<T>(variants: readonly T[], key: string): T {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return variants[Math.abs(hash) % variants.length];
}

const GOAL_PHRASES: ((name: string) => string)[] = [
  (name) => `Gol de ${name}!`,
  (name) => `${name} balança as redes!`,
  (name) => `${name} não perdoa e marca!`,
  (name) => `Golaço de ${name}!`,
  (name) => `${name} conclui com categoria!`,
];

const GOAL_WITH_ASSIST_PHRASES: ((name: string, assist: string) => string)[] = [
  (name, assist) => `Gol de ${name}! Linda assistência de ${assist}!`,
  (name, assist) => `${name} marca após passe açucarado de ${assist}!`,
  (name, assist) => `${assist} encontra ${name} livre para balançar as redes!`,
  (name, assist) => `Gol de ${name}! Jogada perfeita construída por ${assist}!`,
  (name, assist) => `${name} estufa as redes com passe magistral de ${assist}!`,
];

const PENALTY_GOAL_PHRASES: ((name: string) => string)[] = [
  (name) => `Pênalti! Gol de ${name}!`,
  (name) => `${name} converte a cobrança com frieza!`,
  (name) => `${name} não desperdiça a cobrança de pênalti!`,
];

/**
 * Attempts that forced the keeper into something — the only misses the commentary reports.
 *
 * A real match has around 25 shots, and narrating every one of them buries the match in "manda para fora".
 * Broadcast commentary picks out the ones that were nearly goals; the rest live in the shot count and
 * nowhere else. Everything off target is still counted in `shots`, just never spoken about.
 */
const SAVED_CHANCE_PHRASES: ((name: string, keeper: string) => string)[] = [
  (name, keeper) => `${keeper} faz grande defesa em finalização de ${name}`,
  (name, keeper) => `${name} obriga ${keeper} a trabalhar`,
  (name, keeper) => `Quase! ${name} finaliza e ${keeper} salva`,
  (name, keeper) => `${keeper} espalma o chute de ${name}`,
  (name, keeper) => `Chance de ${name}, defendida por ${keeper}`,
];

const SOLO_BRILLIANCE_GOAL_PHRASES: ((name: string) => string)[] = [
  (name) => `Lampejo de craque! ${name} arranca no mano a mano e estufa as redes com um golaço individual!`,
  (name) => `Pintura de ${name}! Tirou a jogada da cartola, limpou a marcação e decidiu sozinho!`,
  (name) => `Genialidade pura de ${name}! Arrancou em velocidade e mandou direto no ângulo!`,
  (name) => `Golaço espetacular de ${name}! Jogada individual desconcertante para abrir a defesa!`,
  (name) => `Decidiu sozinho! ${name} finta o zagueiro e finaliza com frieza milimétrica!`,
];

const SOLO_BRILLIANCE_SAVED_PHRASES: ((name: string, keeper: string) => string)[] = [
  (name, keeper) => `Jogada de gênio! ${name} finta dois marcadores, mas ${keeper} faz milagre!`,
  (name, keeper) => `${name} arrisca jogada individual espetacular e ${keeper} espalma no reflexo!`,
  (name, keeper) => `Bela jogada de ${name}! Bateu colocado no ângulo, mas ${keeper} salva espetacularmente!`,
  (name, keeper) => `${keeper} opera um milagre após arrancada veloz de ${name}!`,
];

/** Off target — the taker's own fault, nobody to credit. */
const PENALTY_MISS_PHRASES: ((name: string) => string)[] = [
  (name) => `Pênalti perdido por ${name}`,
  (name) => `${name} desperdiça a cobrança e manda para fora`,
  (name) => `${name} isola a cobrança de pênalti`,
  (name) => `Na trave! ${name} desperdiça o pênalti`,
];

/** On target but stopped — the keeper earns the line, so he is named. */
const PENALTY_SAVE_PHRASES: ((name: string, keeper: string) => string)[] = [
  (name, keeper) => `${keeper} defende a cobrança de ${name}!`,
  (name, keeper) => `Pênalti defendido! ${keeper} pega a cobrança de ${name}`,
  (name, keeper) => `${name} bate e ${keeper} salva no canto`,
];

const YELLOW_CARD_PHRASES: ((name: string) => string)[] = [
  (name) => `Cartão amarelo para ${name} por falta dura`,
  (name) => `${name} entra duro e leva cartão amarelo`,
  (name) => `Falta dura de ${name} rende cartão amarelo`,
];

const RED_CARD_PHRASES: ((name: string, suspensionMatches: number) => string)[] = [
  (name, matches) => `Cartão vermelho para ${name}! Suspenso por ${matches} partida(s)`,
  (name, matches) => `Expulso! ${name} vê o vermelho direto e desfalca o time por ${matches} partida(s)`,
];

const SECOND_YELLOW_PHRASES: ((name: string, suspensionMatches: number) => string)[] = [
  (name, matches) => `Segundo amarelo em ${name}! Expulso e suspenso por ${matches} partida(s)`,
  (name, matches) => `${name} leva o segundo amarelo e está fora, desfalca o time por ${matches} partida(s)`,
];

const INJURY_PHRASES: ((name: string, injuryWeeks: number) => string)[] = [
  (name, weeks) => `Lesão! ${name} sai machucado e desfalca o time por ${weeks} semana(s)`,
  (name, weeks) => `${name} sente a contusão e deixa o campo, fora por ${weeks} semana(s)`,
  (name, weeks) => `Departamento médico chamado: ${name} não continua e desfalca o time por ${weeks} semana(s)`,
];

const PLANNED_SUB_PHRASES: ((outName: string, inName: string) => string)[] = [
  (outName, inName) => `Substituição: sai ${outName}, entra ${inName}`,
  (outName, inName) => `Mexida no time: ${outName} deixa o campo, ${inName} entra em seu lugar`,
];

const EMERGENCY_SUB_PHRASES: ((outName: string, inName: string) => string)[] = [
  (outName, inName) => `Substituição forçada: sai ${outName} lesionado, entra ${inName}`,
  (outName, inName) => `Troca obrigatória: ${outName} não tem condições de continuar, ${inName} entra em seu lugar`,
];

const WOODWORK_PHRASES: ((name: string) => string)[] = [
  (name) => `Na trave! Finalização de ${name} carimba o poste!`,
  (name) => `No travessão! Bomba de ${name} quase entra!`,
  (name) => `${name} chuta colocado e a bola explode na trave!`,
];

const REBOUND_GOAL_PHRASES: ((name: string, keeper: string) => string)[] = [
  (name, keeper) => `No rebote! ${keeper} espalma e ${name} completa para o gol!`,
  (name) => `Gol no rebote! ${name} é oportunista e manda para as redes!`,
  (name, keeper) => `${keeper} dá rebote e ${name} não perdoa!`,
];

const BIG_SAVE_PHRASES: ((name: string, keeper: string) => string)[] = [
  (name, keeper) => `Milagre de ${keeper}! Defesa espetacular no chute de ${name}!`,
  (name, keeper) => `Defesa impressionante! ${keeper} salva o gol certo em finalização de ${name}!`,
  (name, keeper) => `Espalma ${keeper}! Grande intervenção no chute perigoso de ${name}!`,
];

interface MatchProbs {
  homeChanceProb: number;
  awayChanceProb: number;
  homeGoalProb: number;
  awayGoalProb: number;
}

/**
 * A side's strength with whatever its tactical assistant is worth folded in.
 *
 * `getTacticalAssistantBonus` existed for a long time with no callers at all: the assistant was the only
 * one of the five staff roles with no effect anywhere in the game, and the club screen sold it on "surgical
 * substitutions and live adaptations" it never made. The club was already reaching the engine, so nothing
 * had to be threaded through to fix it.
 *
 * It lands on strength rather than on the tactical multipliers on purpose. Tactical choices are damped
 * against a neutral reference, because both managers make them and they compound (see
 * `dampenSharedTacticalVolume`); an assistant is neither a choice made at kickoff nor something that
 * compounds with the opponent's. Left in the tactical part, two thirds of it would be damped straight back
 * out and a diamond assistant would be worth almost nothing.
 */
function strengthWithStaff(club: Club, tactic: Tactic, offPitch: ReadonlySet<string>): TeamStrength {
  const strength = computeTeamStrength(club, tactic, offPitch);
  const assistant = club.staff?.find((member) => member.role === 'TACTICAL_ASSISTANT');
  const { chanceBonus, defenseBonus } = getTacticalAssistantBonus(assistant);
  if (chanceBonus === 1 && defenseBonus === 1) return strength;

  return { ...strength, attack: strength.attack * chanceBonus, defense: strength.defense * defenseBonus };
}

export interface SimulateMatchSegmentInput {
  home: MatchParticipant;
  away: MatchParticipant;
  /** An already-created RNG (resumable or not) — the caller owns seeding/persisting it. */
  rng: () => number;
  /** Minutes are simulated inclusive of both ends: [startMinute, endMinute]. */
  startMinute: number;
  endMinute: number;
  /**
   * Events from earlier segments of this same match, if it's being resumed. Required for a live match to
   * stay a man down across a pause: who is off the pitch is derived from the timeline, so resuming without
   * these would quietly restore a sent-off player at the next tick.
   */
  priorEvents?: MatchEvent[];
  /** Running totals to continue from — omit (or 0) when starting a match from minute 1. */
  homeGoals?: number;
  awayGoals?: number;
  homeShots?: number;
  awayShots?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeCorners?: number;
  awayCorners?: number;
  homeFouls?: number;
  awayFouls?: number;
  homePressRecoveries?: number;
  awayPressRecoveries?: number;
  homeGoalsFromPressRecovery?: number;
  awayGoalsFromPressRecovery?: number;
  homeXg?: number;
  awayXg?: number;
  homeBigChances?: number;
  awayBigChances?: number;
  homeSaves?: number;
  awaySaves?: number;
  homeWoodwork?: number;
  awayWoodwork?: number;
  homeBlockedShots?: number;
  awayBlockedShots?: number;
  /**
   * Whether a side is still disorganized from a failed counterpress in a prior minute, pending consumption
   * by the opponent's very next offensive sequence — see the per-minute loop's transition/counterpress
   * block. Can span a segment boundary (unlike red-card settling), so it's explicit segment state.
   */
  homeDisorganized?: boolean;
  awayDisorganized?: boolean;
  homeAdvancedCounterpressRecoveries?: number;
  awayAdvancedCounterpressRecoveries?: number;
  homeFailedCounterpresses?: number;
  awayFailedCounterpresses?: number;
  /**
   * Sides whose manager is at the touchline right now and must be asked before play restarts.
   */
  interruptOnInjury?: { home?: boolean; away?: boolean };
  interruptOnRedCard?: { home?: boolean; away?: boolean };
  crowdIntensity?: number;
  weather?: MatchWeather;
  /** Explicit half indicator when playing extra stoppage time (1 for 1st half extra, 2 for 2nd half extra). */
  stoppageHalf?: 1 | 2;
}

export interface MatchSegmentResult {
  /** Only the events from *this* segment (minutes in [startMinute, endMinute]), not the whole match. */
  events: MatchEvent[];
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homePressRecoveries: number;
  awayPressRecoveries: number;
  homeGoalsFromPressRecovery: number;
  awayGoalsFromPressRecovery: number;
  homeXg: number;
  awayXg: number;
  homeBigChances: number;
  awayBigChances: number;
  homeSaves: number;
  awaySaves: number;
  homeWoodwork: number;
  awayWoodwork: number;
  homeBlockedShots: number;
  awayBlockedShots: number;
  /** Pending disorganization state and running counterpress counters — see `SimulateMatchSegmentInput`. */
  homeDisorganized: boolean;
  awayDisorganized: boolean;
  homeAdvancedCounterpressRecoveries: number;
  awayAdvancedCounterpressRecoveries: number;
  homeFailedCounterpresses: number;
  awayFailedCounterpresses: number;
  /** Team strength as of the end of this segment (reflects any substitutions applied) — feeds possession stats. */
  homeStrength: TeamStrength;
  awayStrength: TeamStrength;
  homeTactic: Tactic;
  awayTactic: Tactic;
  pendingDecision?: PendingMatchDecision;
  stoppedAtMinute?: number;
}

/**
 * The engine's actual per-minute loop, usable for either a full 90-minute match in one call
 * (`simulateMatch`) or one chunk of a pausable/resumable live match (`simulateMatchSegment`) — same
 * math either way, so a live-watched match plays out identically to an instantly-resolved one.
 */
export function simulateMatchSegment(input: SimulateMatchSegmentInput): MatchSegmentResult {
  const { rng } = input;
  let homeTactic = input.home.tactic;
  let awayTactic = input.away.tactic;

  const venue = homeAdvantageFactors(input.crowdIntensity);
  /** O tempo do dia. Ausente é seco, que é o baseline contra o qual o motor foi calibrado. */
  const conditions = weatherFactors(input.weather);

  const events: MatchEvent[] = [];
  const priorEvents = input.priorEvents ?? [];
  /** The whole match so far, not just this segment — who is off the pitch is a match-long fact. */
  const timeline = () => [...priorEvents, ...events];

  let homeOffPitch = offPitchPlayerIds(priorEvents, 'home');
  let awayOffPitch = offPitchPlayerIds(priorEvents, 'away');
  let homeSentOff = sentOffPlayerIds(priorEvents, 'home');
  let awaySentOff = sentOffPlayerIds(priorEvents, 'away');

  let home = strengthWithStaff(input.home.club, homeTactic, homeOffPitch);
  let away = strengthWithStaff(input.away.club, awayTactic, awayOffPitch);
  let homeAttackers = pickAttackers(home.lineupPlayers);
  let awayAttackers = pickAttackers(away.lineupPlayers);

  /**
   * What a fitness coach keeps off the treatment table.
   *
   * `getInjuryReductionRate` promised up to half of all muscle injuries and had no caller anywhere on the
   * server. The only code that read it was a variable in the transfers page that nothing then used, so the
   * club screen sold a reduction the match never applied. Read once at kickoff: who a club employs does not
   * change during a match.
   */
  const homeInjuryReduction = getInjuryReductionRate(input.home.club.staff?.find((m) => m.role === 'FITNESS_COACH'));
  const awayInjuryReduction = getInjuryReductionRate(input.away.club.staff?.find((m) => m.role === 'FITNESS_COACH'));

  /**
   * Re-derives both sides' off-pitch sets from the full timeline and rebuilds whichever side's strength
   * actually changed. Called after anything that can send a player off, hurt one, or replace one — a
   * dismissal has to bite from the very next minute, not only once the next substitution happens to
   * trigger a recompute.
   */
  const refreshAvailability = (forceHome: boolean = false, forceAway: boolean = false): void => {
    const all = timeline();
    const nextHome = offPitchPlayerIds(all, 'home');
    const nextAway = offPitchPlayerIds(all, 'away');
    if (forceHome || nextHome.size !== homeOffPitch.size) {
      homeOffPitch = nextHome;
      homeSentOff = sentOffPlayerIds(all, 'home');
      home = strengthWithStaff(input.home.club, homeTactic, homeOffPitch);
      homeAttackers = pickAttackers(home.lineupPlayers);
    }
    if (forceAway || nextAway.size !== awayOffPitch.size) {
      awayOffPitch = nextAway;
      awaySentOff = sentOffPlayerIds(all, 'away');
      away = strengthWithStaff(input.away.club, awayTactic, awayOffPitch);
      awayAttackers = pickAttackers(away.lineupPlayers);
    }
  };

  let homeGoals = input.homeGoals ?? 0;
  let awayGoals = input.awayGoals ?? 0;
  let homeShots = input.homeShots ?? 0;
  let awayShots = input.awayShots ?? 0;
  let homeShotsOnTarget = input.homeShotsOnTarget ?? 0;
  let awayShotsOnTarget = input.awayShotsOnTarget ?? 0;
  let homeCorners = input.homeCorners ?? 0;
  let awayCorners = input.awayCorners ?? 0;
  let homeFouls = input.homeFouls ?? 0;
  let awayFouls = input.awayFouls ?? 0;
  let homePressRecoveries = input.homePressRecoveries ?? 0;
  let awayPressRecoveries = input.awayPressRecoveries ?? 0;
  let homeGoalsFromPressRecovery = input.homeGoalsFromPressRecovery ?? 0;
  let awayGoalsFromPressRecovery = input.awayGoalsFromPressRecovery ?? 0;
  let homeXg = input.homeXg ?? 0;
  let awayXg = input.awayXg ?? 0;
  let homeBigChances = input.homeBigChances ?? 0;
  let awayBigChances = input.awayBigChances ?? 0;
  let homeSaves = input.homeSaves ?? 0;
  let awaySaves = input.awaySaves ?? 0;
  let homeWoodwork = input.homeWoodwork ?? 0;
  let awayWoodwork = input.awayWoodwork ?? 0;
  let homeBlockedShots = input.homeBlockedShots ?? 0;
  let awayBlockedShots = input.awayBlockedShots ?? 0;
  let homeDisorganized = input.homeDisorganized ?? false;
  let awayDisorganized = input.awayDisorganized ?? false;
  let homeAdvancedCounterpressRecoveries = input.homeAdvancedCounterpressRecoveries ?? 0;
  let awayAdvancedCounterpressRecoveries = input.awayAdvancedCounterpressRecoveries ?? 0;
  let homeFailedCounterpresses = input.homeFailedCounterpresses ?? 0;
  let awayFailedCounterpresses = input.awayFailedCounterpresses ?? 0;
  /** At most one injury per player per segment — a player already carried off doesn't get hurt again. */
  const injuredThisSegment = new Set<string>();
  /** Non-null the moment a watched side loses someone: the loop plays out that minute and then stops. */
  let pendingDecision: PendingMatchDecision | null = null;
  let stoppedAtMinute: number | null = null;

  for (let minute = input.startMinute; minute <= input.endMinute; minute++) {
    const homeSubbed = applyDueSubstitutions('home', minute, homeTactic, input.home.club, homeSentOff, events, timeline());
    if (homeSubbed) {
      homeTactic = homeSubbed;
      home = strengthWithStaff(input.home.club, homeTactic, homeOffPitch);
      homeAttackers = pickAttackers(home.lineupPlayers);
    }

    const awaySubbed = applyDueSubstitutions('away', minute, awayTactic, input.away.club, awaySentOff, events, timeline());
    if (awaySubbed) {
      awayTactic = awaySubbed;
      away = strengthWithStaff(input.away.club, awayTactic, awayOffPitch);
      awayAttackers = pickAttackers(away.lineupPlayers);
    }
    // A substitution can bring an injured player's replacement on, restoring the side to eleven.
    if (homeSubbed || awaySubbed) refreshAvailability();

    const minuteEventsStart = events.length;
    const settled = timeline();
    const isStoppageTime = minute > 90 || input.stoppageHalf === 2 || input.stoppageHalf === 1;
    const isLateGame = minute >= 65 || isStoppageTime;
    const isSecondHalf = minute >= 46;
    const scoreDiff = homeGoals - awayGoals;

    // Game State Pacing & Blowout Modulation:
    // Leading teams manage risk & possession in 2nd half, slowing down chance rate unless they are on TOTAL_ATTACK.
    // Trailing teams compact defensively unless they are shorthanded (red card) or have broken morale.
    let homeGameStateChanceMult = 1.0;
    let awayGameStateChanceMult = 1.0;
    let homeGameStateDefenseMult = 1.0;
    let awayGameStateDefenseMult = 1.0;

    if (isSecondHalf) {
      if (scoreDiff >= 2) {
        if (homeTactic.attackApproach !== 'TOTAL_ATTACK') {
          homeGameStateChanceMult = scoreDiff >= 3 ? 0.78 : 0.86;
        }
        if (away.missingPlayers === 0) {
          awayGameStateDefenseMult = scoreDiff >= 3 ? 1.15 : 1.06;
        }
      } else if (scoreDiff <= -2) {
        if (awayTactic.attackApproach !== 'TOTAL_ATTACK') {
          awayGameStateChanceMult = scoreDiff <= -3 ? 0.78 : 0.86;
        }
        if (home.missingPlayers === 0) {
          homeGameStateDefenseMult = scoreDiff <= -3 ? 1.15 : 1.06;
        }
      }
    }

    /**
     * What a mentality is actually for.
     *
     * It used to be a flat, context-free trade — 15% of attack for 15% of defence, worth the same in
     * every minute of every match — which is why it decided nothing: over a thousand matches the three
     * settings finished within six hundredths of a point of each other. A mentality in football is a
     * decision about *the match you are in*: seeing out a lead, or going after a deficit. So that is what
     * it does here, from the moment there is a result to protect or chase rather than only at two goals.
     *
     * The flat trade stays as it was. This is what makes choosing it right or wrong.
     */
    if (isSecondHalf) {
      if (scoreDiff !== 0) {
        const homeManagement = gameManagement(homeTactic.mentality, scoreDiff > 0);
        const awayManagement = gameManagement(awayTactic.mentality, scoreDiff < 0);
        homeGameStateChanceMult *= homeManagement.chance;
        homeGameStateDefenseMult *= homeManagement.defense;
        awayGameStateChanceMult *= awayManagement.chance;
        awayGameStateDefenseMult *= awayManagement.defense;
      } else {
        if (homeTactic.mentality === 'defensive') {
          homeGameStateDefenseMult *= 1.38;
          homeGameStateChanceMult *= 1.05;
        }
        if (awayTactic.mentality === 'defensive') {
          awayGameStateDefenseMult *= 1.38;
          awayGameStateChanceMult *= 1.05;
        }
      }
    }

    const urgencyMult = isStoppageTime ? 1.14 : 1.07;
    const urgency = {
      home: (isLateGame && scoreDiff <= 0 ? urgencyMult : isLateGame && scoreDiff > 0 ? 0.94 : 1.0) * homeGameStateChanceMult,
      away: (isLateGame && scoreDiff >= 0 ? urgencyMult : isLateGame && scoreDiff < 0 ? 0.94 : 1.0) * awayGameStateChanceMult,
    };

    const probs = computeProbs(
      home,
      away,
      homeTactic,
      awayTactic,
      {
        home: dismissalSettlingFactor(settled, 'home', minute),
        away: dismissalSettlingFactor(settled, 'away', minute),
      },
      venue,
      urgency,
      {
        home: homeGameStateDefenseMult,
        away: awayGameStateDefenseMult,
      },
      conditions,
    );

    let homeScoredThisMinute = false;
    let awayScoredThisMinute = false;

    // A disorganization left pending by the opponent's failed counterpress in a prior minute is consumed
    // right here, by home's very next offensive sequence — see the away-side transition block below.
    let homeEffectiveChanceProb = probs.homeChanceProb;
    if (awayDisorganized) {
      homeEffectiveChanceProb = clamp(probs.homeChanceProb * (1 + DISORGANIZATION_CHANCE_BONUS * away.restDefence.flankVulnerability), 0.02, 0.32);
      awayDisorganized = false;
    }

    if (rng() < homeEffectiveChanceProb) {
      homeShots++;
      const chance = resolveChance('home', minute, home, away, homeAttackers, homeTactic, awayTactic, probs.homeGoalProb, homeGoals - awayGoals, rng, events);
      homeXg += chance.xg;
      if (chance.bigChance) homeBigChances++;
      if (chance.save) awaySaves++;
      if (chance.woodwork) homeWoodwork++;
      if (chance.blocked) homeBlockedShots++;
      if (chance.goal) {
        homeGoals++;
        homeScoredThisMinute = true;
      }
      if (chance.onTarget) homeShotsOnTarget++;
      if (chance.derivedCorner) homeCorners++;
    }

    // Post-loss transition (Fase 2): home decides how it reacts to just losing the ball, via exactly one
    // unconditional roll per minute — win it back near goal (COUNTERPRESS success: advanced recovery + an
    // immediate rapid chance) or fall back into shape (RECOMPOSE, or a failed COUNTERPRESS, which leaves
    // home disorganized for away's very next sequence — resolved immediately below, same minute).
    if (transitionStyleOf(homeTactic) === 'COUNTERPRESS') {
      if (rng() < counterpressSuccessProbability(home, away)) {
        homeAdvancedCounterpressRecoveries++;
        // The recovery itself is common; a genuine shooting chance out of it is not — gated at the same
        // order of magnitude as an ordinary chance so a pressing side's shot volume doesn't double.
        if (rng() < probs.homeChanceProb * COUNTERPRESS_RAPID_CHANCE_MULTIPLIER) {
          homeShots++;
          const rapid = resolveChance(
            'home',
            minute,
            home,
            away,
            homeAttackers,
            homeTactic,
            awayTactic,
            probs.homeGoalProb * COUNTERPRESS_RAPID_GOAL_BOOST,
            homeGoals - awayGoals,
            rng,
            events,
          );
          homeXg += rapid.xg;
          if (rapid.bigChance) homeBigChances++;
          if (rapid.save) awaySaves++;
          if (rapid.woodwork) homeWoodwork++;
          if (rapid.blocked) homeBlockedShots++;
          if (rapid.goal) {
            homeGoals++;
            homeScoredThisMinute = true;
          }
          if (rapid.onTarget) homeShotsOnTarget++;
          if (rapid.derivedCorner) homeCorners++;
        }
      } else {
        homeFailedCounterpresses++;
        homeDisorganized = true;
      }
    } else {
      rng(); // RECOMPOSE still draws and discards, so both branches cost the same fixed roll per side per minute.
    }

    // Home's own disorganization (just set above, if any) is consumed here by away's very next sequence,
    // in this same minute.
    let awayEffectiveChanceProb = probs.awayChanceProb;
    if (homeDisorganized) {
      awayEffectiveChanceProb = clamp(probs.awayChanceProb * (1 + DISORGANIZATION_CHANCE_BONUS * home.restDefence.flankVulnerability), 0.02, 0.32);
      homeDisorganized = false;
    }

    if (rng() < awayEffectiveChanceProb) {
      awayShots++;
      const chance = resolveChance('away', minute, away, home, awayAttackers, awayTactic, homeTactic, probs.awayGoalProb, awayGoals - homeGoals, rng, events);
      awayXg += chance.xg;
      if (chance.bigChance) awayBigChances++;
      if (chance.save) homeSaves++;
      if (chance.woodwork) awayWoodwork++;
      if (chance.blocked) awayBlockedShots++;
      if (chance.goal) {
        awayGoals++;
        awayScoredThisMinute = true;
      }
      if (chance.onTarget) awayShotsOnTarget++;
      if (chance.derivedCorner) awayCorners++;
    }

    // Away's own transition: same shape as home's above, one roll per minute regardless of style. A failed
    // counterpress here can only be consumed at the top of home's block *next* minute (the segment state
    // is what lets that survive a pause/resume boundary).
    if (transitionStyleOf(awayTactic) === 'COUNTERPRESS') {
      if (rng() < counterpressSuccessProbability(away, home)) {
        awayAdvancedCounterpressRecoveries++;
        if (rng() < probs.awayChanceProb * COUNTERPRESS_RAPID_CHANCE_MULTIPLIER) {
          awayShots++;
          const rapid = resolveChance(
            'away',
            minute,
            away,
            home,
            awayAttackers,
            awayTactic,
            homeTactic,
            probs.awayGoalProb * COUNTERPRESS_RAPID_GOAL_BOOST,
            awayGoals - homeGoals,
            rng,
            events,
          );
          awayXg += rapid.xg;
          if (rapid.bigChance) awayBigChances++;
          if (rapid.save) homeSaves++;
          if (rapid.woodwork) awayWoodwork++;
          if (rapid.blocked) awayBlockedShots++;
          if (rapid.goal) {
            awayGoals++;
            awayScoredThisMinute = true;
          }
          if (rapid.onTarget) awayShotsOnTarget++;
          if (rapid.derivedCorner) awayCorners++;
        }
      } else {
        awayFailedCounterpresses++;
        awayDisorganized = true;
      }
    } else {
      rng();
    }

    if (rng() < cornerProbability(home.attack, away.defense)) homeCorners++;
    if (rng() < cornerProbability(away.attack, home.defense)) awayCorners++;

    // Silent counters, same "no event stream worth surfacing" treatment as corners above — see the
    // Submenu Tática/Escalação spec's post-match tactical-effectiveness report (buildTacticalReport).
    if (rng() < pressRecoveryProbability(homeTactic, home.attack, away.defense)) {
      homePressRecoveries++;
      if (homeScoredThisMinute) homeGoalsFromPressRecovery++;
    }
    if (rng() < pressRecoveryProbability(awayTactic, away.attack, home.defense)) {
      awayPressRecoveries++;
      if (awayScoredThisMinute) awayGoalsFromPressRecovery++;
    }

    // The crowd's effect on the whistle (see FULL_REFEREE_LEAN): the hosts get the benefit of the doubt,
    // the visitors get pulled up for the same challenge.
    if (rng() < FOUL_BASE_PROB * home.foulProbabilityModifier * venue.homeFoul) {
      homeFouls++;
      const fouler = pickFouler(home.lineupPlayers, rng);
      const dismissed = resolveFoul(fouler, 'home', away.lineupPlayers, minute, bookedPlayerIds(timeline(), 'home'), rng, events);
      if (dismissed && input.interruptOnRedCard?.home) {
        pendingDecision = { type: 'redCard', side: 'home', playerId: dismissed, minute };
      }
    }

    if (rng() < FOUL_BASE_PROB * away.foulProbabilityModifier * venue.awayFoul) {
      awayFouls++;
      const fouler = pickFouler(away.lineupPlayers, rng);
      const dismissed = resolveFoul(fouler, 'away', home.lineupPlayers, minute, bookedPlayerIds(timeline(), 'away'), rng, events);
      if (dismissed && input.interruptOnRedCard?.away) {
        pendingDecision = { type: 'redCard', side: 'away', playerId: dismissed, minute };
      }
    }

    let homeReplaced = false;
    let awayReplaced = false;

    if (rng() < injuryProbability(home.lineupPlayers, injuredThisSegment, homeInjuryReduction)) {
      const injured = pickInjured(home.lineupPlayers, injuredThisSegment, rng);
      if (injured) {
        injuredThisSegment.add(injured.id);
        resolveInjury(injured, 'home', minute, rng, events);
        if (input.interruptOnInjury?.home) {
          pendingDecision = { type: 'injury', side: 'home', playerId: injured.id, minute };
        } else {
          const patched = applyEmergencySubstitution('home', minute, homeTactic, input.home.club, injured, timeline(), events);
          if (patched) {
            homeTactic = patched;
            homeReplaced = true;
          }
        }
      }
    }

    if (rng() < injuryProbability(away.lineupPlayers, injuredThisSegment, awayInjuryReduction)) {
      const injured = pickInjured(away.lineupPlayers, injuredThisSegment, rng);
      if (injured) {
        injuredThisSegment.add(injured.id);
        resolveInjury(injured, 'away', minute, rng, events);
        if (input.interruptOnInjury?.away) {
          // Deliberately not `??=`: if both sides lost someone in the same minute, the watched side that
          // went down *second* still needs asking. Only one decision fits in the state at a time, so the
          // other side's injury is handled by the next stop — the events for both are already recorded.
          pendingDecision = { type: 'injury', side: 'away', playerId: injured.id, minute };
        } else {
          const patched = applyEmergencySubstitution('away', minute, awayTactic, input.away.club, injured, timeline(), events);
          if (patched) {
            awayTactic = patched;
            awayReplaced = true;
          }
        }
      }
    }

    // Tag any new events with period and stoppageMinute metadata
    for (let i = minuteEventsStart; i < events.length; i++) {
      const ev = events[i];
      if (!ev.period) {
        if (input.stoppageHalf === 1 || (!input.stoppageHalf && minute > 45 && input.endMinute <= 55)) {
          ev.period = '1T';
          ev.stoppageMinute = minute - 45;
        } else if (input.stoppageHalf === 2 || minute > 90) {
          ev.period = '2T';
          ev.stoppageMinute = minute - 90;
        } else if (minute <= 45) {
          ev.period = '1T';
        } else {
          ev.period = '2T';
        }
      }
    }

    // Any dismissal or injury above leaves that side short from the very next minute onward. An injury
    // patched up in the same minute leaves the off-pitch count unchanged but the eleven itself different,
    // so those sides are forced through a recompute rather than relying on the count moving.
    refreshAvailability(homeReplaced, awayReplaced);

    // The referee has the game stopped: this minute is complete (the injury and anything else that
    // happened in it are recorded), and nothing further is simulated until the manager answers.
    if (pendingDecision) {
      stoppedAtMinute = minute;
      break;
    }
  }

  return {
    events,
    homeGoals,
    awayGoals,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homeCorners,
    awayCorners,
    homeFouls,
    awayFouls,
    homePressRecoveries,
    awayPressRecoveries,
    homeGoalsFromPressRecovery,
    awayGoalsFromPressRecovery,
    homeXg: Math.round(homeXg * 100) / 100,
    awayXg: Math.round(awayXg * 100) / 100,
    homeBigChances,
    awayBigChances,
    homeSaves,
    awaySaves,
    homeWoodwork,
    awayWoodwork,
    homeBlockedShots,
    awayBlockedShots,
    homeDisorganized,
    awayDisorganized,
    homeAdvancedCounterpressRecoveries,
    awayAdvancedCounterpressRecoveries,
    homeFailedCounterpresses,
    awayFailedCounterpresses,
    homeStrength: home,
    awayStrength: away,
    homeTactic,
    awayTactic,
    ...(pendingDecision ? { pendingDecision, stoppedAtMinute: stoppedAtMinute! } : {}),
  };
}

/**
 * Possession is a snapshot of the current attack/defense balance rather than a stopwatch — the same
 * formula works whether the match just ended (`simulateMatch`) or is still going (a live match re-derives
 * it from the current team strengths on every tick, so a red card or a tiring lineup nudges it live).
 * An explicitly chosen low/deep block concedes territory; absent tactics retain the old strength-only math.
 * This remains the one place the live-match and instant-result paths share the calculation.
 */
export function derivePossession(
  home: TeamStrength,
  away: TeamStrength,
  homeTactic?: Tactic,
  awayTactic?: Tactic,
): { home: number; away: number } {
  const homePower = home.attack + home.defense * 0.3;
  const awayPower = away.attack + away.defense * 0.3;
  const homeBlock = homeTactic?.defensiveLine === 'DEEP' && pressingOf(homeTactic) === 'LOW_BLOCK' ? 0.9 : 1;
  const awayBlock = awayTactic?.defensiveLine === 'DEEP' && pressingOf(awayTactic) === 'LOW_BLOCK' ? 0.9 : 1;
  const totalPower = homePower * homeBlock + awayPower * awayBlock;
  const homePossession = totalPower > 0 ? Math.round(((homePower * homeBlock) / totalPower) * 100) : 50;
  return { home: homePossession, away: 100 - homePossession };
}

/**
 * Deterministic: identical input (including seed) always produces identical output.
 * Simulates the 1st half, 1st-half added time, 2nd half, and 2nd-half added time with authentic stoppage minutes.
 */
export function simulateMatch(input: SimulateMatchInput): MatchResult {
  const rng = createRng(input.seed);

  // 1. First half regular (minutes 1 to 45)
  const h1 = simulateMatchSegment({
    home: input.home,
    away: input.away,
    rng,
    startMinute: 1,
    endMinute: 45,
    crowdIntensity: input.crowdIntensity,
    weather: input.weather,
  });

  const h1Stoppage = calculateStoppageTime(h1.events).half1;
  const allEvents = [...h1.events];
  let currentSegment = h1;

  // 2. First half stoppage time (minutes 46 to 45 + h1Stoppage)
  if (h1Stoppage > 0) {
    const h1Extra = simulateMatchSegment({
      home: { club: input.home.club, tactic: currentSegment.homeTactic },
      away: { club: input.away.club, tactic: currentSegment.awayTactic },
      rng,
      startMinute: 46,
      endMinute: 45 + h1Stoppage,
      priorEvents: allEvents,
      homeGoals: currentSegment.homeGoals,
      awayGoals: currentSegment.awayGoals,
      homeShots: currentSegment.homeShots,
      awayShots: currentSegment.awayShots,
      homeShotsOnTarget: currentSegment.homeShotsOnTarget,
      awayShotsOnTarget: currentSegment.awayShotsOnTarget,
      homeCorners: currentSegment.homeCorners,
      awayCorners: currentSegment.awayCorners,
      homeFouls: currentSegment.homeFouls,
      awayFouls: currentSegment.awayFouls,
      homePressRecoveries: currentSegment.homePressRecoveries,
      awayPressRecoveries: currentSegment.awayPressRecoveries,
      homeGoalsFromPressRecovery: currentSegment.homeGoalsFromPressRecovery,
      awayGoalsFromPressRecovery: currentSegment.awayGoalsFromPressRecovery,
      homeXg: currentSegment.homeXg,
      awayXg: currentSegment.awayXg,
      homeBigChances: currentSegment.homeBigChances,
      awayBigChances: currentSegment.awayBigChances,
      homeSaves: currentSegment.homeSaves,
      awaySaves: currentSegment.awaySaves,
      homeWoodwork: currentSegment.homeWoodwork,
      awayWoodwork: currentSegment.awayWoodwork,
      homeBlockedShots: currentSegment.homeBlockedShots,
      awayBlockedShots: currentSegment.awayBlockedShots,
      homeDisorganized: currentSegment.homeDisorganized,
      awayDisorganized: currentSegment.awayDisorganized,
      homeAdvancedCounterpressRecoveries: currentSegment.homeAdvancedCounterpressRecoveries,
      awayAdvancedCounterpressRecoveries: currentSegment.awayAdvancedCounterpressRecoveries,
      homeFailedCounterpresses: currentSegment.homeFailedCounterpresses,
      awayFailedCounterpresses: currentSegment.awayFailedCounterpresses,
      crowdIntensity: input.crowdIntensity,
      weather: input.weather,
      stoppageHalf: 1,
    });
    allEvents.push(...h1Extra.events);
    currentSegment = h1Extra;
  }

  // 3. Second half regular (minutes 46 to 90)
  const h2 = simulateMatchSegment({
    home: { club: input.home.club, tactic: currentSegment.homeTactic },
    away: { club: input.away.club, tactic: currentSegment.awayTactic },
    rng,
    startMinute: 46,
    endMinute: MINUTES,
    priorEvents: allEvents,
    homeGoals: currentSegment.homeGoals,
    awayGoals: currentSegment.awayGoals,
    homeShots: currentSegment.homeShots,
    awayShots: currentSegment.awayShots,
    homeShotsOnTarget: currentSegment.homeShotsOnTarget,
    awayShotsOnTarget: currentSegment.awayShotsOnTarget,
    homeCorners: currentSegment.homeCorners,
    awayCorners: currentSegment.awayCorners,
    homeFouls: currentSegment.homeFouls,
    awayFouls: currentSegment.awayFouls,
    homePressRecoveries: currentSegment.homePressRecoveries,
    awayPressRecoveries: currentSegment.awayPressRecoveries,
    homeGoalsFromPressRecovery: currentSegment.homeGoalsFromPressRecovery,
    awayGoalsFromPressRecovery: currentSegment.awayGoalsFromPressRecovery,
    homeXg: currentSegment.homeXg,
    awayXg: currentSegment.awayXg,
    homeBigChances: currentSegment.homeBigChances,
    awayBigChances: currentSegment.awayBigChances,
    homeSaves: currentSegment.homeSaves,
    awaySaves: currentSegment.awaySaves,
    homeWoodwork: currentSegment.homeWoodwork,
    awayWoodwork: currentSegment.awayWoodwork,
    homeBlockedShots: currentSegment.homeBlockedShots,
    awayBlockedShots: currentSegment.awayBlockedShots,
    homeDisorganized: currentSegment.homeDisorganized,
    awayDisorganized: currentSegment.awayDisorganized,
    homeAdvancedCounterpressRecoveries: currentSegment.homeAdvancedCounterpressRecoveries,
    awayAdvancedCounterpressRecoveries: currentSegment.awayAdvancedCounterpressRecoveries,
    homeFailedCounterpresses: currentSegment.homeFailedCounterpresses,
    awayFailedCounterpresses: currentSegment.awayFailedCounterpresses,
    crowdIntensity: input.crowdIntensity,
    weather: input.weather,
  });
  allEvents.push(...h2.events);
  currentSegment = h2;

  // 4. Second half stoppage time (minutes 91 to 90 + h2Stoppage)
  const h2Stoppage = calculateStoppageTime(allEvents).half2;
  if (h2Stoppage > 0) {
    const h2Extra = simulateMatchSegment({
      home: { club: input.home.club, tactic: currentSegment.homeTactic },
      away: { club: input.away.club, tactic: currentSegment.awayTactic },
      rng,
      startMinute: 91,
      endMinute: MINUTES + h2Stoppage,
      priorEvents: allEvents,
      homeGoals: currentSegment.homeGoals,
      awayGoals: currentSegment.awayGoals,
      homeShots: currentSegment.homeShots,
      awayShots: currentSegment.awayShots,
      homeShotsOnTarget: currentSegment.homeShotsOnTarget,
      awayShotsOnTarget: currentSegment.awayShotsOnTarget,
      homeCorners: currentSegment.homeCorners,
      awayCorners: currentSegment.awayCorners,
      homeFouls: currentSegment.homeFouls,
      awayFouls: currentSegment.awayFouls,
      homePressRecoveries: currentSegment.homePressRecoveries,
      awayPressRecoveries: currentSegment.awayPressRecoveries,
      homeGoalsFromPressRecovery: currentSegment.homeGoalsFromPressRecovery,
      awayGoalsFromPressRecovery: currentSegment.awayGoalsFromPressRecovery,
      homeXg: currentSegment.homeXg,
      awayXg: currentSegment.awayXg,
      homeBigChances: currentSegment.homeBigChances,
      awayBigChances: currentSegment.awayBigChances,
      homeSaves: currentSegment.homeSaves,
      awaySaves: currentSegment.awaySaves,
      homeWoodwork: currentSegment.homeWoodwork,
      awayWoodwork: currentSegment.awayWoodwork,
      homeBlockedShots: currentSegment.homeBlockedShots,
      awayBlockedShots: currentSegment.awayBlockedShots,
      homeDisorganized: currentSegment.homeDisorganized,
      awayDisorganized: currentSegment.awayDisorganized,
      homeAdvancedCounterpressRecoveries: currentSegment.homeAdvancedCounterpressRecoveries,
      awayAdvancedCounterpressRecoveries: currentSegment.awayAdvancedCounterpressRecoveries,
      homeFailedCounterpresses: currentSegment.homeFailedCounterpresses,
      awayFailedCounterpresses: currentSegment.awayFailedCounterpresses,
      crowdIntensity: input.crowdIntensity,
      weather: input.weather,
      stoppageHalf: 2,
    });
    allEvents.push(...h2Extra.events);
    currentSegment = h2Extra;
  }

  const { homeStrength: home, awayStrength: away } = currentSegment;
  const possession = derivePossession(home, away, currentSegment.homeTactic, currentSegment.awayTactic);

  return {
    homeGoals: currentSegment.homeGoals,
    awayGoals: currentSegment.awayGoals,
    events: allEvents,
    stats: {
      home: {
        shots: currentSegment.homeShots,
        shotsOnTarget: currentSegment.homeShotsOnTarget,
        possession: possession.home,
        corners: currentSegment.homeCorners,
        fouls: currentSegment.homeFouls,
        pressRecoveries: currentSegment.homePressRecoveries,
        goalsFromPressRecovery: currentSegment.homeGoalsFromPressRecovery,
        xg: currentSegment.homeXg,
        bigChances: currentSegment.homeBigChances,
        saves: currentSegment.homeSaves,
        woodwork: currentSegment.homeWoodwork,
        blockedShots: currentSegment.homeBlockedShots,
      },
      away: {
        shots: currentSegment.awayShots,
        shotsOnTarget: currentSegment.awayShotsOnTarget,
        possession: possession.away,
        corners: currentSegment.awayCorners,
        fouls: currentSegment.awayFouls,
        pressRecoveries: currentSegment.awayPressRecoveries,
        goalsFromPressRecovery: currentSegment.awayGoalsFromPressRecovery,
        xg: currentSegment.awayXg,
        bigChances: currentSegment.awayBigChances,
        saves: currentSegment.awaySaves,
        woodwork: currentSegment.awayWoodwork,
        blockedShots: currentSegment.awayBlockedShots,
      },
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * How a mentality handles being ahead or behind.
 *
 * A defensive side is good at seeing a game out and poor at rescuing one; an attacking side is the
 * reverse. That asymmetry is the whole point: it makes the choice pay off in some matches and cost in
 * others, where a symmetric trade could only ever average out to nothing.
 */
function gameManagement(mentality: Tactic['mentality'], leading: boolean): { chance: number; defense: number } {
  if (leading) {
    if (mentality === 'defensive') return { chance: 0.80, defense: 1.15 };
    if (mentality === 'attacking') return { chance: 1.18, defense: 1.05 };
    return { chance: 1, defense: 1 };
  }
  if (mentality === 'attacking') return { chance: 1.18, defense: 0.90 };
  if (mentality === 'defensive') return { chance: 1.08, defense: 1.25 };
  return { chance: 1, defense: 1 };
}

/** One side's setup as the opposing tactics see it (see tacticalMatchup.ts). */
function setupOf(tactic: Tactic, strength: TeamStrength): TacticalSetup {
  const onPitch = strength.lineupPlayers;
  const avgFatigue = onPitch.length > 0 ? onPitch.reduce((sum, p) => sum + p.fatigue, 0) / onPitch.length : 0;

  /**
   * Whether this side can pass its way out of pressure, on a 0-to-1 scale with an ordinary team at 0.5.
   *
   * Two things decide it, and both matter. The passing of the players actually on the pitch is the honest
   * source of ability — it moves when a playmaker is substituted, when a centre-half who can play is
   * dropped, when someone is fielded out of position. And the attacking style is the *intent*: a side
   * committed to playing through the middle is trying to pass out of the press, while one committed to
   * the flanks goes around it and is far easier to trap.
   *
   * Centred on 55, which is where the game's clubs actually sit (measured across the shipped database:
   * median 55.3, quartiles 54.2 and 56.8, a long tail to 86). Centring on the attribute scale's own
   * midpoint of 50 would have read almost every side in the game as press-resistant, turning a decision
   * into a permanent trap — and would have left the effect near zero in exactly the ordinary fixtures
   * where the manager most wants the dial to mean something.
   */
  const avgPassing = onPitch.length > 0 ? onPitch.reduce((sum, p) => sum + p.attributes.passing, 0) / onPitch.length : 55;
  const styleIntent = tactic.attackStyle === 'THROUGH_MIDDLE' ? 0.22 : tactic.attackStyle === 'WINGS' ? -0.22 : 0;
  const buildUpQuality = Math.max(0, Math.min(1, 0.5 + (avgPassing - 55) / 30 + styleIntent));

  return {
    formation: tactic.formation,
    mentality: tactic.mentality,
    attackStyle: tactic.attackStyle,
    markingStyle: tactic.markingStyle,
    attackApproach: tactic.attackApproach,
    pressing: pressingOf(tactic),
    defensiveLine: tactic.defensiveLine,
    attackerPace: (() => {
      const attackers = onPitch.filter((player) => player.position === 'ATT');
      const runners = attackers.length > 0 ? attackers : onPitch;
      return runners.length > 0
        ? runners.reduce((sum, player) => sum + player.attributes.pace, 0) / runners.length / 100
        : 0.5;
    })(),
    missingPlayers: strength.missingPlayers,
    avgFatigue,
    buildUpQuality,
  };
}

/**
 * Raw strength decides most of it, but not all of it: each side's tactics are first weighed against what the
 * *other* side is actually doing, and those multipliers land on chance creation, conversion, and the defensive
 * figure the opponent has to beat (see tacticalMatchup.ts).
 */
function computeProbs(
  home: TeamStrength,
  away: TeamStrength,
  homeTactic: Tactic,
  awayTactic: Tactic,
  /** Short-lived defensive cost of a very recent dismissal — see dismissalSettlingFactor. 1 when settled. */
  settling: { home: number; away: number } = { home: 1, away: 1 },
  /** The venue effect — see homeAdvantage.ts. The one place the two sides are not treated alike. */
  venue: HomeAdvantageFactors = NEUTRAL_HOME_ADVANTAGE,
  /** Late-match urgency modifier driven by game state / scoreline. */
  urgency: { home: number; away: number } = { home: 1, away: 1 },
  gameStateDefense: { home: number; away: number } = { home: 1, away: 1 },
  /** O tempo, igual para os dois lados — ver weather.ts. Seco não mexe em nada. */
  weather: WeatherFactors = NEUTRAL_WEATHER,
): MatchProbs {
  const homeSetup = setupOf(homeTactic, home);
  const awaySetup = setupOf(awayTactic, away);
  const homeMatchup = tacticalMatchup(homeSetup, awaySetup);
  const awayMatchup = tacticalMatchup(awaySetup, homeSetup);

  // Where each side chooses to win the ball back: straight multipliers, before the opponent-dependent
  // matchup on top (see PRESSING_MODIFIERS).
  const homePress = PRESSING_MODIFIERS[homeSetup.pressing];
  const awayPress = PRESSING_MODIFIERS[awaySetup.pressing];

  /**
   * O que o campo cobra do estilo de cada um. Sai de `ATTACK_STYLE_MODIFIERS`, que já descreve todo estilo
   * como mistura de passe e velocidade: a chuva reprecifica os dois ingredientes e a mistura de cada um
   * decide quanto ele perde. Ver weatherAttackFactor.
   */
  const homeWeatherAttack = weatherAttackFactor(ATTACK_STYLE_MODIFIERS[homeSetup.attackStyle], weather);
  const awayWeatherAttack = weatherAttackFactor(ATTACK_STYLE_MODIFIERS[awaySetup.attackStyle], weather);

  const homeMentalityGoal = homeTactic.mentality === 'attacking' ? 1.12 : 1.0;
  const awayMentalityGoal = awayTactic.mentality === 'attacking' ? 1.12 : 1.0;

  const homeAttack = home.attack * home.attackStyleCompatibility * venue.attack * homeWeatherAttack;
  const awayAttack = away.attack * away.attackStyleCompatibility * awayWeatherAttack;
  const homeDefense =
    home.defense * homeMatchup.defense * homePress.defense * settling.home * venue.defense * gameStateDefense.home * home.restDefence.centralExposure;
  const awayDefense =
    away.defense * awayMatchup.defense * awayPress.defense * settling.away * gameStateDefense.away * away.restDefence.centralExposure;

  const homeChance = chanceProbability(
    homeAttack,
    awayDefense,
    home.chanceModifier * home.restDefence.territorialRetention,
    homeMatchup.chance * homePress.chance,
    urgency.home,
  );
  const awayChance = chanceProbability(
    awayAttack,
    homeDefense,
    away.chanceModifier * away.restDefence.territorialRetention,
    awayMatchup.chance * awayPress.chance,
    urgency.away,
  );
  const homeGoal = goalProbability(homeAttack, away.goalkeeping, awayDefense, home.goalModifier * homeMentalityGoal, homeMatchup.goal * weather.goal);
  const awayGoal = goalProbability(awayAttack, home.goalkeeping, homeDefense, away.goalModifier * awayMentalityGoal, awayMatchup.goal * weather.goal);

  /**
   * The same match with every tactical decision taken out of it, which is the figure the engine was
   * calibrated against (see scripts/match-profile.ts, which measures with every dial on BALANCED).
   *
   * Venue, red cards, a fresh dismissal and the state of the game all stay in: none of them is a choice
   * the two managers made, and none of them compounds the way tactics do.
   *
   * O tempo entra por esta mesma porta, e é o detalhe que decide se ele funciona. Um campo pesado não é
   * decisão de ninguém: se ele entrasse só no cálculo tático acima, o amortecedor o trataria como escolha
   * dos técnicos e devolveria a partida quase toda para o valor de tempo seco — o efeito existiria no
   * código e não no jogo. Só o `weather.goal` entra aqui; a parcela de estilo (`weatherAttackFactor`)
   * fica de fora de propósito, porque essa parte *é* consequência da escolha do técnico e deve ser
   * amortecida como qualquer outra.
   */
  const homeAttackNeutral = (home.attack / home.tacticalAttackMultiplier) * venue.attack;
  const awayAttackNeutral = away.attack / away.tacticalAttackMultiplier;
  const homeDefenseNeutral =
    (home.defense / home.tacticalDefenseMultiplier) * CALIBRATED.defense * settling.home * venue.defense * gameStateDefense.home;
  const awayDefenseNeutral =
    (away.defense / away.tacticalDefenseMultiplier) * CALIBRATED.defense * settling.away * gameStateDefense.away;

  const neutralChance =
    chanceProbability(homeAttackNeutral, awayDefenseNeutral, CALIBRATED.chance, 1, urgency.home) +
    chanceProbability(awayAttackNeutral, homeDefenseNeutral, CALIBRATED.chance, 1, urgency.away);
  const neutralGoal =
    goalProbability(homeAttackNeutral, away.goalkeeping, awayDefenseNeutral, CALIBRATED.goal, weather.goal) +
    goalProbability(awayAttackNeutral, home.goalkeeping, homeDefenseNeutral, CALIBRATED.goal, weather.goal);

  const [homeChanceProb, awayChanceProb] = dampenSharedTacticalVolume(homeChance, awayChance, neutralChance);
  const [homeGoalProb, awayGoalProb] = dampenSharedTacticalVolume(homeGoal, awayGoal, neutralGoal);

  return { homeChanceProb, awayChanceProb, homeGoalProb, awayGoalProb };
}

/**
 * How much of a shared tactical shift in match volume survives. 1 would let tactics move the total
 * freely (what the engine used to do); 0 would mean tactics could only ever decide *who* gets the
 * chances, never how many there are.
 *
 * Tuned against the extremes rather than the middle, because the middle was never the problem: two sides
 * both sitting deep used to produce 0.47 goals and 62% goalless matches, and two sides both throwing
 * everyone forward produced 4.25 goals from 41 shots. Real football's most cautious fixtures still reach
 * roughly two goals and its most open ones rarely pass thirty shots.
 */
const TACTICAL_VOLUME_SURVIVAL = 0.34;

/**
 * The setup the engine's numbers were fitted against: every dial on its balanced setting, which is what
 * `autoFillLineup` hands a manager who has not touched the tactics screen and what
 * `scripts/match-profile.ts` measures.
 *
 * The reference has to be this and not "all modifiers set to 1", because balanced is not neutral —
 * `ATTACK_APPROACH_MODIFIERS.BALANCED` deliberately carries 1.05 chance and 1.1 conversion so that the
 * middle option is a real compromise rather than a trap. Anchoring on 1 quietly pulled the calibrated
 * match itself down, from 2.75 goals to 2.45.
 */
const CALIBRATED = ATTACK_APPROACH_MODIFIERS.BALANCED;

/**
 * Pulls the *shared* part of two sides' tactical effect back toward the neutral match, leaving the
 * difference between them untouched.
 *
 * This is the whole fix for compounding. Every tactical modifier multiplies into both sides at once —
 * one side's caution lowers its own chance creation while raising the bar its opponent has to beat — so
 * two cautious managers did not meet in the middle, they multiplied, and the match disappeared. Scaling
 * both probabilities by the same factor cannot change which of them is larger or by how much, so a
 * counter-attack still punishes a committed opponent exactly as hard as before, wings still beat a
 * packed box by the same margin, and a mismatch is still a mismatch. What changes is only how much the
 * two managers can between them decide that football does not happen.
 */
function dampenSharedTacticalVolume(home: number, away: number, neutralTotal: number): [number, number] {
  const total = home + away;
  if (total <= 0 || neutralTotal <= 0) return [home, away];

  // total^(1-s) * neutral^s, expressed as a scale so the two keep their exact ratio.
  const scale = (neutralTotal / total) ** (1 - TACTICAL_VOLUME_SURVIVAL);
  return [home * scale, away * scale];
}

/**
 * Sigmoid-bounded non-linear utility curve (PDF Section 4).
 * Reflects that top-tier differences (85 vs 92) create larger qualitative separation than low-tier gaps.
 */
export function chanceProbability(
  attack: number,
  opponentDefense: number,
  chanceModifier: number,
  matchupChance: number,
  urgency: number = 1.0,
): number {
  const delta = attack - opponentDefense;
  const fromStrength = sigmoidCurve(delta, CHANCE_BASE_PROB, 0.04, 0.28, 0.024);
  return clamp(fromStrength * chanceModifier * matchupChance * urgency, 0.02, 0.32);
}

/** Same attack-vs-defense shape as `chanceProbability`, on its own independent roll — a corner isn't
 *  derived from shots (real matches produce plenty that don't follow a shot at all), just biased the
 *  same direction the balance of play already leans. */
function cornerProbability(attack: number, opponentDefense: number): number {
  return clamp(CORNER_BASE_PROB + (attack - opponentDefense) / 4000, 0.015, 0.11);
}

function pressRecoveryProbability(tactic: Tactic, attack: number, opponentDefense: number): number {
  const pressing = pressingOf(tactic);
  const legacy =
    PRESS_RECOVERY_BASE_PROB * PRESSING_MODIFIERS[pressing].chance +
    (attack - opponentDefense) / 6000;
  const lineSupport = tactic.defensiveLine
    ? DEFENSIVE_LINE_MODIFIERS[defensiveLineOf(tactic)].recoverySupport
    : 1;
  return clamp(legacy * lineSupport, 0.01, 0.14);
}

/** Chance a COUNTERPRESS roll succeeds: pressing side's teamwork+anticipation against the receiving side's
 *  first touch+composure, nudged by the presser's fatigue (tired legs don't close space) and how well its
 *  rest-defence shape supports winning the ball back. Centered near 50% for equal collectives, bounded per
 *  the approved spec so neither a mismatch nor a perfect setup ever makes the roll a foregone conclusion. */
function counterpressSuccessProbability(pressing: TeamStrength, receiving: TeamStrength): number {
  const pressingScore = (pressing.teamwork + pressing.anticipation) / 2;
  const receivingScore = (receiving.firstTouch + receiving.composure) / 2;
  const avgFatigue = pressing.lineupPlayers.length
    ? pressing.lineupPlayers.reduce((sum, p) => sum + p.fatigue, 0) / pressing.lineupPlayers.length
    : 0;
  const restDefenceBonus = (pressing.restDefence.compatibility - 0.5) * COUNTERPRESS_REST_DEFENCE_WEIGHT;
  const fromStrength =
    COUNTERPRESS_BASE_PROB +
    (pressingScore - receivingScore) / COUNTERPRESS_ATTRIBUTE_DIVISOR -
    avgFatigue * COUNTERPRESS_FATIGUE_PENALTY +
    restDefenceBonus;
  return clamp(fromStrength, COUNTERPRESS_MIN_PROB, COUNTERPRESS_MAX_PROB);
}

export function goalProbability(
  attack: number,
  opponentGoalkeeping: number,
  opponentDefense: number,
  goalModifier: number,
  matchupGoal: number,
): number {
  const delta = attack - (opponentGoalkeeping * 0.6 + opponentDefense * 0.4);
  // Conversion sits near football's ~10.5% and rises gently with a real quality gap.
  // The controlled ceiling keeps the better side winning through shot volume with only a mild conversion premium.
  const fromStrength = sigmoidCurve(delta, GOAL_BASE_PROB, 0.02, 0.14, 0.022);
  return clamp(fromStrength * goalModifier * matchupGoal, 0.02, 0.28);
}

/**
 * Swaps in any substitutes scheduled for exactly this minute, returning the updated tactic (with
 * its lineup patched) so the caller can recompute team strength — or `null` if nothing was due.
 *
 * A sub scheduled for a player who has since been sent off is dropped: a dismissal leaves the shirt
 * empty for good, and honouring the swap would quietly hand the side its eleventh man back. A side
 * that has already used all its substitutions has its remaining scheduled swaps dropped too.
 */
function applyDueSubstitutions(
  side: MatchSide,
  minute: number,
  tactic: Tactic,
  club: Club,
  sentOff: ReadonlySet<string>,
  events: MatchEvent[],
  matchTimeline: MatchEvent[],
): Tactic | null {
  const onPitch = new Set(tactic.lineup.map((slot) => slot.playerId));
  const remaining = substitutionsRemaining(side, matchTimeline);
  if (remaining <= 0) return null;
  const due = tactic.plannedSubstitutions
    .filter(
      (sub) =>
        sub.minute === minute &&
        !sentOff.has(sub.outPlayerId) &&
        // An emergency substitution (see below) may already have taken this player off, or already used the
        // very player this swap was going to bring on — either way the planned swap is moot.
        onPitch.has(sub.outPlayerId) &&
        !onPitch.has(sub.inPlayerId),
    )
    .slice(0, remaining);
  if (due.length === 0) return null;

  let lineup = tactic.lineup;
  for (const sub of due) {
    lineup = lineup.map((slot) => (slot.playerId === sub.outPlayerId ? { playerId: sub.inPlayerId, side: slot.side } : slot));
    const outPlayer = club.players.find((p) => p.id === sub.outPlayerId);
    const inPlayer = club.players.find((p) => p.id === sub.inPlayerId);
    const description = pickVariant(PLANNED_SUB_PHRASES, `${sub.outPlayerId}-${minute}`)(outPlayer?.name ?? '???', inPlayer?.name ?? '???');
    events.push({
      minute,
      type: 'substitution',
      team: side,
      playerId: sub.outPlayerId,
      relatedPlayerId: sub.inPlayerId,
      description,
    });
  }

  return { ...tactic, lineup };
}

/** How many changes this side still has left, from the substitutions already in the match timeline. */
export function substitutionsRemaining(side: MatchSide, timeline: MatchEvent[]): number {
  const used = timeline.filter((e) => e.type === 'substitution' && e.team === side).length;
  return Math.max(0, MAX_SUBSTITUTIONS - used);
}

/**
 * The bench players who could legally come on right now: still on the bench (not already brought on) and
 * only if the side has a change left. Shared by the automatic touchline pick below and by the manager-facing
 * interruption panel, so the list a human is offered is exactly the list the engine would choose from.
 */
export function availableReplacements(side: MatchSide, tactic: Tactic, club: Club, timeline: MatchEvent[]): Player[] {
  if (substitutionsRemaining(side, timeline) <= 0) return [];
  const onPitch = new Set(tactic.lineup.map((slot) => slot.playerId));
  const byId = new Map(club.players.map((p) => [p.id, p]));
  return tactic.substitutes.map((slot) => byId.get(slot.playerId)).filter((p): p is Player => !!p && !onPitch.has(p.id));
}

/**
 * Who the touchline would send on for `injured` out of `candidates`: the best like-for-like available,
 * preferring a substitute the manager hasn't already earmarked for a planned swap later in the match
 * (spending a committed one drops that plan — see applyDueSubstitutions). Falls back to a committed
 * player when that's all that's left: eleven men now beats a plan for the 70th minute.
 *
 * Consumes no RNG, so using it never perturbs the seeded event stream that makes a match reproducible.
 */
export function suggestedReplacement(candidates: Player[], tactic: Tactic, injured: Player): Player | null {
  if (candidates.length === 0) return null;
  const committed = new Set(tactic.plannedSubstitutions.map((sub) => sub.inPlayerId));
  const uncommitted = candidates.filter((p) => !committed.has(p.id));
  const group = uncommitted.length > 0 ? uncommitted : candidates;

  const likeForLike = group.filter((p) => p.position === injured.position);
  const pool = likeForLike.length > 0 ? likeForLike : group;
  return pool.reduce((best, p) => (p.overall > best.overall ? p : best));
}

/**
 * Puts `replacement` on in `outPlayer`'s slot and records the event. The one place a forced change is
 * actually applied, whether the choice came from the touchline heuristic or from a manager answering the
 * interruption — so both paths produce an identical timeline and an identical resulting tactic.
 */
export function applyForcedSubstitution(
  side: MatchSide,
  minute: number,
  tactic: Tactic,
  outPlayer: Player,
  replacement: Player,
  events: MatchEvent[],
): Tactic {
  events.push({
    minute,
    type: 'substitution',
    team: side,
    playerId: outPlayer.id,
    relatedPlayerId: replacement.id,
    description: pickVariant(EMERGENCY_SUB_PHRASES, `${outPlayer.id}-${minute}`)(outPlayer.name, replacement.name),
  });

  return {
    ...tactic,
    lineup: tactic.lineup.map((slot) => (slot.playerId === outPlayer.id ? { playerId: replacement.id, side: slot.side } : slot)),
  };
}

/**
 * Sends the bench on for a player who has just gone off injured, the way a real touchline would rather
 * than leaving the side short for the rest of the match. Used only where there is nobody to ask — a bot
 * club, or an unattended tick running a fixture to full time in one call. A watched side stops the clock
 * instead and puts the choice to its manager (see `interruptOnInjury`).
 *
 * Returns the patched tactic, or `null` if nobody could come on (bench exhausted, or all subs used).
 */
function applyEmergencySubstitution(
  side: MatchSide,
  minute: number,
  tactic: Tactic,
  club: Club,
  injured: Player,
  timeline: MatchEvent[],
  events: MatchEvent[],
): Tactic | null {
  const replacement = suggestedReplacement(availableReplacements(side, tactic, club, timeline), tactic, injured);
  if (!replacement) return null;
  return applyForcedSubstitution(side, minute, tactic, injured, replacement, events);
}

const SHOT_TYPES_POOL: readonly ShotType[] = ['BOX_SHOT', 'ONE_ON_ONE', 'LONG_SHOT', 'HEADER', 'BOX_SHOT', 'BOX_SHOT', 'HEADER', 'LONG_SHOT'];
const DEEP_BLOCK_SHOT_TYPES_POOL: readonly ShotType[] = ['LONG_SHOT', 'LONG_SHOT', 'LONG_SHOT', 'HEADER', 'LONG_SHOT', 'LONG_SHOT', 'HEADER', 'LONG_SHOT'];

/** Shot geometry without consuming an RNG draw, kept public only so calibration tests can count silent misses. */
export function shotTypeForChance(opponentTactic: Tactic, key: string): ShotType {
  const opponentParksBox = opponentTactic.defensiveLine === 'DEEP' && pressingOf(opponentTactic) === 'LOW_BLOCK';
  return pickVariant(opponentParksBox ? DEEP_BLOCK_SHOT_TYPES_POOL : SHOT_TYPES_POOL, key);
}

export interface ResolveChanceResult {
  goal: boolean;
  onTarget: boolean;
  xg: number;
  bigChance: boolean;
  save: boolean;
  woodwork: boolean;
  blocked: boolean;
  derivedCorner: boolean;
}

/**
 * Resolves one goal-scoring chance into a penalty or open play, and that into a goal or a miss.
 * Computes individual shot xG and executes a causal chain (Goal, Woodwork, Keeper Save, Corner).
 */
function resolveChance(
  side: MatchSide,
  minute: number,
  strength: TeamStrength,
  opponentStrength: TeamStrength,
  attackers: Player[],
  tactic: Tactic,
  opponentTactic: Tactic,
  goalProb: number,
  /** This side's lead (negative when behind) as the chance falls — only used to weigh a penalty's pressure. */
  goalDifference: number,
  rng: () => number,
  events: MatchEvent[],
): ResolveChanceResult {
  if (rng() < PENALTY_SHARE_OF_CHANCES) {
    const designated = tactic.penaltyTakerId ? strength.lineupPlayers.find((p) => p.id === tactic.penaltyTakerId) : undefined;
    const taker = designated ?? bestPenaltyTaker(strength.lineupPlayers) ?? weightedPick(attackers, rng);
    const keeper = opponentStrength.lineupPlayers.find((p) => p.position === 'GK') ?? null;
    const pressure = penaltyPressure(minute, goalDifference);
    const penaltyGoalProb = penaltyConversionProbability(taker, keeper, pressure);
    const xg = calculateShotXg({ type: 'PENALTY', shooter: taker, keeper });

    const takerKey = `${taker.id}-${minute}`;
    if (rng() < penaltyGoalProb) {
      const description = pickVariant(PENALTY_GOAL_PHRASES, takerKey)(taker.name);
      events.push({ minute, type: 'goal', team: side, playerId: taker.id, description, isPenalty: true, xg, shotOutcome: 'goal', shotType: 'PENALTY' });
      return { goal: true, onTarget: true, xg, bigChance: true, save: false, woodwork: false, blocked: false, derivedCorner: false };
    }
    const offTarget = rng() < penaltyOffTargetShare(taker);
    const description = offTarget
      ? pickVariant(PENALTY_MISS_PHRASES, takerKey)(taker.name)
      : pickVariant(PENALTY_SAVE_PHRASES, takerKey)(taker.name, keeper?.name ?? 'o goleiro');
    events.push({ minute, type: 'chance', team: side, playerId: taker.id, description, isPenalty: true, xg, shotOutcome: offTarget ? 'off_target' : 'saved', shotType: 'PENALTY' });
    return { goal: false, onTarget: !offTarget, xg, bigChance: true, save: !offTarget, woodwork: false, blocked: false, derivedCorner: false };
  }

  const scorer = weightedPick(attackers, rng);
  const scorerKey = `${scorer.id}-${minute}`;
  const keeper = opponentStrength.lineupPlayers.find((p) => p.position === 'GK') ?? null;

  // An explicit low/deep block protects the box by inviting lower-quality attempts from distance.
  const shotType = shotTypeForChance(opponentTactic, scorerKey);
  const xg = calculateShotXg({ type: shotType, shooter: scorer, keeper });
  const bigChance = isBigChance(xg);

  // Fator individual de finalização do jogador: finalizadores de elite e craques convertem a uma taxa
  // significativamente maior do que um atleta comum, mantendo o ponto de equilíbrio centrado no atacante padrão (~74).
  const shooterFinishingMult = 1 + ((scorer.attributes.finishing - 74) / 160) + (starFactor(scorer) - 1) * 0.5;
  const effectiveGoalProb = clamp(goalProb * Math.max(0.75, Math.min(1.28, shooterFinishingMult)), 0.02, 0.30);

  if (rng() < effectiveGoalProb) {
    const isSoloBrilliance = (starFactor(scorer) >= 1.08 || scorer.attributes.finishing >= 85) && rng() < 0.35;
    const hasAssist = !isSoloBrilliance && rng() < OPEN_PLAY_ASSIST_SHARE;
    const assistant = hasAssist ? pickAssistant(strength.lineupPlayers, scorer.id, rng) : null;
    let description: string;
    if (isSoloBrilliance) {
      description = pickVariant(SOLO_BRILLIANCE_GOAL_PHRASES, scorerKey)(scorer.name);
    } else if (assistant) {
      description = pickVariant(GOAL_WITH_ASSIST_PHRASES, scorerKey)(scorer.name, assistant.name);
    } else {
      description = pickVariant(GOAL_PHRASES, scorerKey)(scorer.name);
    }

    events.push({
      minute,
      type: 'goal',
      team: side,
      playerId: scorer.id,
      description,
      xg,
      shotOutcome: 'goal',
      shotType,
      ...(assistant ? { assistPlayerId: assistant.id, assistPlayerName: assistant.name } : {}),
    });
    return { goal: true, onTarget: true, xg, bigChance, save: false, woodwork: false, blocked: false, derivedCorner: false };
  }

  // Missed direct attempt: check if on target (forced a save)
  const onTarget = rng() < ON_TARGET_SHARE_OPEN_MISS;
  if (onTarget) {
    const derivedCorner = pickVariant([false, true, false, false], `${scorerKey}-corner`);
    const isSoloAttempt = (starFactor(scorer) >= 1.08 || scorer.attributes.finishing >= 85);
    const savePhrases = isSoloAttempt ? SOLO_BRILLIANCE_SAVED_PHRASES : bigChance ? BIG_SAVE_PHRASES : SAVED_CHANCE_PHRASES;
    const description = pickVariant(savePhrases, scorerKey)(scorer.name, keeper?.name ?? 'o goleiro');
    events.push({ minute, type: 'chance', team: side, playerId: scorer.id, description, xg, shotOutcome: 'saved', shotType, isDerivedCorner: derivedCorner });
    return { goal: false, onTarget: true, xg, bigChance, save: true, woodwork: false, blocked: false, derivedCorner };
  }

  // Off target: tracked in stats without cluttering commentary
  const isWoodwork = pickVariant([true, false, false, false, false, false, false, false, false, false, false, false], `${scorerKey}-wood`);
  const isBlocked = !isWoodwork && pickVariant([true, false, false, false], `${scorerKey}-block`);
  // A big chance that goes wide is still a big chance — a missed one-on-one was every bit the opening a
  // saved one was. Before this the off-target branch hardcoded `bigChance: false`, so a real match reported
  // ~1.4 big chances when football sees 3-4, because only the ones that produced a goal or a save counted.
  return { goal: false, onTarget: false, xg, bigChance, save: false, woodwork: isWoodwork, blocked: isBlocked, derivedCorner: false };
}

function pickAttackers(players: Player[]): Player[] {
  const attackers = players.filter((p) => p.position === 'ATT' || p.position === 'MID');
  return attackers.length > 0 ? attackers : players.filter((p) => p.position !== 'GK');
}

/** Share of open-play goals that come from a direct assist (~74% in real football). */
export const OPEN_PLAY_ASSIST_SHARE = 0.74;

/**
 * Selects an assistant for an open-play goal among teammates on the pitch (excluding scorer).
 * Weighted heavily by passing ability, vision, and playmaker/winger tactical functions.
 */
export function pickAssistant(players: Player[], scorerId: string, rng: () => number): Player | null {
  const outfield = players.filter((p) => p.id !== scorerId && p.position !== 'GK');
  const pool = outfield.length > 0 ? outfield : players.filter((p) => p.id !== scorerId);
  if (pool.length === 0) return null;

  const weights = pool.map((p) => {
    let weight = p.attributes.passing * 0.6 + p.attributes.pace * 0.2 + (p.detailedAttributes?.VISION ?? 60) * 0.2;
    if (p.functions?.includes('MEIA_CRIACAO') || p.functions?.includes('MEIA_ARMADOR')) weight *= 2.0;
    if (p.functions?.includes('FALSO_NOVE')) weight *= 1.8;
    if (
      p.functions?.includes('PONTA') ||
      p.functions?.includes('PONTA_LINHA_DE_FUNDO') ||
      p.functions?.includes('PONTA_INVERTIDO')
    )
      weight *= 1.6;
    if (
      p.functions?.includes('LATERAL') ||
      p.functions?.includes('ALA') ||
      p.functions?.includes('ALA_OFENSIVO') ||
      p.functions?.includes('LATERAL_CONSTRUTOR')
    )
      weight *= 1.3;
    return Math.max(1, weight);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function weightedPick(players: Player[], rng: () => number): Player {
  const weights = players.map((p) => {
    // Atacantes naturalmente concentram mais finalizações que meias
    const positionBias = p.position === 'ATT' ? 1.5 : 1.0;
    const starMult = starFactor(p);
    // Curva não-linear: finalizadores de elite (80-99) chamam muito mais o jogo ofensivo
    const baseFinishing = Math.max(10, p.attributes.finishing);
    return Math.pow(baseFinishing / 50, 1.8) * positionBias * starMult;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < players.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return players[i];
  }
  return players[players.length - 1];
}

/** Picks who commits a foul incident; AGGRESSIVE players are disproportionately more likely to be the culprit. */
function pickFouler(players: Player[], rng: () => number): Player {
  const outfield = players.filter((p) => p.position !== 'GK');
  const pool = outfield.length > 0 ? outfield : players;
  const weights = pool.map((p) => 1 + (p.traits.includes('AGGRESSIVE') ? AGGRESSIVE_FOUL_WEIGHT_BONUS : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/**
 * Resolves a foul incident into no card / yellow / red, weighted by the fouler's AGGRESSIVE trait.
 * Returns the id of anyone sent off by it, so the caller can halt the match for a reorganization.
 *
 * A booking for someone already carrying one is a dismissal, which is why this needs `alreadyBooked` from
 * the whole match rather than just this segment: without it a player could collect yellows all afternoon
 * and never walk, and the booking markers on the pitch (there so a manager can take a player off before it
 * costs them a man) would be warning about a consequence that never arrived.
 */
function resolveFoul(
  fouler: Player,
  foulerTeam: MatchSide,
  opponents: Player[],
  minute: number,
  alreadyBooked: Set<string>,
  rng: () => number,
  events: MatchEvent[],
): string | null {
  // Share of fouls that draw a card. Fitted alongside FOUL_BASE_PROB against the Brasileirão's 4.42
  // yellows and 0.27 reds a match: when a side gave away two fouls a game these could be generous, and
  // once it gives away twelve they cannot. An AGGRESSIVE player stays roughly three times likelier to
  // walk and twice as likely to be booked, which is what the trait is for.
  const aggressive = fouler.traits.includes('AGGRESSIVE');
  const redThreshold = aggressive ? 0.02 : 0.006;
  /**
   * A player already on a yellow pulls out of the challenges that would end his match. Without this the
   * engine sent off roughly one player a match on a second booking, five times what real football does:
   * with eleven fouls a side, somebody picks up a second one purely by arithmetic unless the model knows
   * that being booked *changes how you play*. Straight reds are untouched — a caution doesn't stop anyone
   * doing something violent, it only stops the careless.
   */
  const bookedCaution = alreadyBooked.has(fouler.id) ? BOOKED_CAUTION : 1;
  const yellowThreshold = redThreshold + (aggressive ? 0.282 : 0.145) * bookedCaution;
  const cardRoll = rng();

  const foulerKey = `${fouler.id}-${minute}`;
  const opponentSide = foulerTeam === 'home' ? 'away' : 'home';

  if (cardRoll < redThreshold) {
    const suspensionMatches = rollSuspensionLength(aggressive, rng);
    const description = pickVariant(RED_CARD_PHRASES, foulerKey)(fouler.name, suspensionMatches);
    events.push({ minute, type: 'card', team: foulerTeam, playerId: fouler.id, description, suspensionMatches });
    triggerConfusionIfProvoked(opponents, opponentSide, minute, rng, events);
    return fouler.id;
  }

  if (cardRoll < yellowThreshold) {
    if (alreadyBooked.has(fouler.id)) {
      // Second yellow. Rolled the same way as a straight red so the ban length still reflects how reckless
      // the player is, keeping the RNG stream shape identical whichever route the dismissal took.
      const suspensionMatches = rollSuspensionLength(aggressive, rng);
      const description = pickVariant(SECOND_YELLOW_PHRASES, foulerKey)(fouler.name, suspensionMatches);
      events.push({ minute, type: 'card', team: foulerTeam, playerId: fouler.id, description, suspensionMatches });
      triggerConfusionIfProvoked(opponents, opponentSide, minute, rng, events);
      return fouler.id;
    }
    const description = pickVariant(YELLOW_CARD_PHRASES, foulerKey)(fouler.name);
    events.push({ minute, type: 'card', team: foulerTeam, playerId: fouler.id, description });
    triggerConfusionIfProvoked(opponents, opponentSide, minute, rng, events);
  }

  return null;
}

/** How many matches a red card costs, weighted by how reckless the fouler already is (AGGRESSIVE). */
function rollSuspensionLength(aggressive: boolean, rng: () => number): number {
  const severityRoll = rng();
  const oneMatchCeiling = aggressive ? 0.35 : 0.6;
  const twoMatchCeiling = aggressive ? 0.7 : 0.9;

  if (severityRoll < oneMatchCeiling) return 1;
  if (severityRoll < twoMatchCeiling) return 2;
  return 3;
}

/** This minute's injury chance for one side: rises with the lineup's average incoming fatigue (see
 *  `Player.fatigue` — already-tired legs are the single biggest real-world risk factor, per research),
 *  and falls by whatever the club's fitness coach is worth (see `getInjuryReductionRate`). */
function injuryProbability(players: Player[], alreadyInjured: Set<string>, staffReduction = 0): number {
  const fit = players.filter((p) => !alreadyInjured.has(p.id));
  if (fit.length === 0) return 0;
  const avgFatigue = fit.reduce((sum, p) => sum + p.fatigue, 0) / fit.length;
  return INJURY_BASE_PROB * (1 + (avgFatigue / 100) * INJURY_FATIGUE_MAX_MULTIPLIER) * (1 - staffReduction);
}

/** Picks who gets hurt: weighted toward whoever is already more fatigued and less physically robust —
 *  the two individualized risk factors from Fase 1 double as the injury-risk drivers here. */
function pickInjured(players: Player[], alreadyInjured: Set<string>, rng: () => number): Player | null {
  const pool = players.filter((p) => !alreadyInjured.has(p.id));
  if (pool.length === 0) return null;
  const weights = pool.map((p) => 1 + p.fatigue / 25 + (99 - p.attributes.physical) / 25);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** How many matches an injury sidelines a player, skewed toward the common case (most real injuries are minor). */
function rollInjuryLength(rng: () => number): number {
  const severityRoll = rng();
  if (severityRoll < 0.65) return 1;
  if (severityRoll < 0.9) return 2 + Math.floor(rng() * 3);
  return 5 + Math.floor(rng() * 4);
}

function resolveInjury(player: Player, team: MatchSide, minute: number, rng: () => number, events: MatchEvent[]): void {
  const injuryWeeks = rollInjuryLength(rng);
  const description = pickVariant(INJURY_PHRASES, `${player.id}-${minute}`)(player.name, injuryWeeks);
  events.push({ minute, type: 'injury', team, playerId: player.id, description, injuryWeeks });
}

/** A PROVOCATIVE opponent on the pitch has a chance of getting swept into the same incident. */
function triggerConfusionIfProvoked(
  opponents: Player[],
  opponentSide: MatchSide,
  minute: number,
  rng: () => number,
  events: MatchEvent[],
): void {
  const provocateur = opponents.find((p) => p.traits.includes('PROVOCATIVE'));
  if (provocateur && rng() < PROVOCATIVE_CONFUSION_CHANCE) {
    events.push({
      minute,
      type: 'card',
      team: opponentSide,
      playerId: provocateur.id,
      description: `Confusão em campo: cartão amarelo também para ${provocateur.name}`,
    });
  }
}

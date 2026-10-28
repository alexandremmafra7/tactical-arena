import { Player, Tactic, minutesPlayedByPlayerId, applyMoraleStyleBonus, type ManagerStyleId } from '@tactical-arena/shared';

const WIN_MORALE_DELTA = 8;
const DRAW_MORALE_DELTA = 1;
const LOSS_MORALE_DELTA = -8;
const GOAL_DIFF_MORALE_STEP = 1;
const MAX_GOAL_DIFF_BONUS = 3;

const FULL_MATCH_FATIGUE_GAIN = 18;
const MATCH_MINUTES = 90;

const MORALE_MIN = 0;
const MORALE_MAX = 100;
const FATIGUE_MIN = 0;
const FATIGUE_MAX = 100;

/** A TEMPERAMENTAL player's mood swings harder in both directions off the same result. */
const TEMPERAMENTAL_MORALE_MULTIPLIER = 1.6;

/** How far a player's `physical` (1-99) pushes their fatigue gain away from the flat baseline. */
const PHYSICAL_FATIGUE_SWING = 0.25;
/** A player already carrying fatigue tires a bit faster still — legs already gone tire quicker. */
const ACCUMULATED_FATIGUE_COMPOUNDING = 400;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 1 at physical=50 (league-average build), down to 0.75 for a 99-physical athlete, up to 1.25 for a 1-physical one. */
function physicalFatigueFactor(physical: number): number {
  return 1 - ((physical - 50) / 49) * PHYSICAL_FATIGUE_SWING;
}

/** Win/draw/loss plus a capped goal-difference bonus — a routine win moves morale less than a thrashing. */
export function matchMoraleDelta(goalsFor: number, goalsAgainst: number, managerStyle?: ManagerStyleId | string | null): number {
  const base = goalsFor > goalsAgainst ? WIN_MORALE_DELTA : goalsFor === goalsAgainst ? DRAW_MORALE_DELTA : LOSS_MORALE_DELTA;
  const goalDiffBonus = clamp(goalsFor - goalsAgainst, -MAX_GOAL_DIFF_BONUS, MAX_GOAL_DIFF_BONUS) * GOAL_DIFF_MORALE_STEP;
  const standardDelta = base + goalDiffBonus;
  return applyMoraleStyleBonus(standardDelta, goalsFor, goalsAgainst, managerStyle);
}

/**
 * Post-match roster update: the whole squad's morale reacts to the result (win/draw/loss, amplified by
 * goal difference), while fatigue only accrues for whoever actually took the pitch, proportional to the
 * minutes they played and individualized by their own `physical` attribute (a sturdier build tires less
 * per minute) and however tired they already were going in (fatigue compounds a little on itself — a
 * player already running on empty tires faster than one starting fresh). Pure so callers can layer it on
 * top of other post-match updates (e.g. suspensions) before writing the roster once.
 *
 * `fatigueOverload` (1 = normal) is the surcharge for having played short-handed — see
 * `fatigueOverloadMultiplier`. Applied to everyone who took the pitch rather than only to whoever was on
 * during the shorthanded spell: the ten left out there share the extra ground between them, and the
 * bookkeeping to split it minute by minute would buy precision nobody can perceive in-game.
 */
export function applyMoraleAndFatigue(players: Player[], tactic: Tactic, moraleDelta: number, fatigueOverload: number = 1): Player[] {
  const minutes = minutesPlayedByPlayerId(tactic);
  return players.map((player) => {
    const minutesPlayed = minutes.get(player.id) ?? 0;
    const baseGain = (FULL_MATCH_FATIGUE_GAIN * minutesPlayed) / MATCH_MINUTES;
    const fatigueGain =
      baseGain * physicalFatigueFactor(player.attributes.physical) * (1 + player.fatigue / ACCUMULATED_FATIGUE_COMPOUNDING) * fatigueOverload;
    const playerMoraleDelta = player.traits.includes('TEMPERAMENTAL') ? moraleDelta * TEMPERAMENTAL_MORALE_MULTIPLIER : moraleDelta;
    return {
      ...player,
      morale: clamp(player.morale + playerMoraleDelta, MORALE_MIN, MORALE_MAX),
      fatigue: clamp(player.fatigue + fatigueGain, FATIGUE_MIN, FATIGUE_MAX),
    };
  });
}

import { Player } from '../domain/player.js';

export type ShotType = 'PENALTY' | 'ONE_ON_ONE' | 'BOX_SHOT' | 'LONG_SHOT' | 'HEADER' | 'REBOUND';

export interface ShotXgInput {
  type: ShotType;
  shooter: Player;
  keeper: Player | null;
  /** Shot pressure / distance multiplier (1.0 = baseline for that shot type). */
  pressureModifier?: number;
}

/**
 * Base xG values aligned with real-world football analytics (Opta/StatsBomb baselines).
 *
 * These are the *mean* conversion for each shot geometry. They were re-based because the old ones left
 * the average attempt at 0.14 xG while a real shot averages 0.10-0.12, so the match's sum(xG) ran ~18%
 * ahead of the goals the engine actually scored. The open-play pool weighs these 3×BOX / 1×O2O / 2×LONG /
 * 2×HEADER, which lands the average attempt at ~0.105 — matching both reality and the ~10.5% conversion
 * the goal funnel now produces, so sum(xG) ≈ sum(goals) over a season the way a calibrated model should.
 */
export const BASE_XG: Record<ShotType, number> = {
  PENALTY: 0.76,
  REBOUND: 0.45,
  ONE_ON_ONE: 0.40,
  BOX_SHOT: 0.10,
  HEADER: 0.06,
  LONG_SHOT: 0.03,
};

/**
 * Computes the Expected Goals (xG) value for an individual shot attempt.
 *
 * Factors:
 * 1. Base probability according to shot geometry and context (penalty, 1v1, open box, long range, header, rebound).
 * 2. Shooter's technical finishing ability (and composure/traits).
 * 3. Goalkeeper's positioning and reflexes (if keeper is present and not out of position).
 * 4. Contextual pressure modifier (fatigue, defensive harassment).
 */
export function calculateShotXg(input: ShotXgInput): number {
  const { type, shooter, keeper, pressureModifier = 1.0 } = input;
  const base = BASE_XG[type];

  // Penalty kicks are heavily standardized (fixed spot, single duel).
  if (type === 'PENALTY') {
    const penaltyTaking = shooter.detailedAttributes?.PENALTY_TAKING ?? shooter.attributes.finishing;
    const penaltySaving = keeper?.detailedAttributes?.PENALTY_SAVING ?? (keeper ? keeper.attributes.goalkeeping : 50);
    const skillDiff = (penaltyTaking - penaltySaving) / 250;
    return Math.max(0.60, Math.min(0.92, Math.round((base + skillDiff) * 100) / 100));
  }

  // Check for specialized detailed attributes
  let specialtyBonus = 0;
  if (shooter.detailedAttributes) {
    if (type === 'LONG_SHOT' && shooter.detailedAttributes.LONG_SHOTS) {
      specialtyBonus += ((shooter.detailedAttributes.LONG_SHOTS - 50) / 350) * base;
    } else if (type === 'HEADER' && shooter.detailedAttributes.HEADING) {
      specialtyBonus += ((shooter.detailedAttributes.HEADING - 50) / 350) * base;
    } else if (type === 'ONE_ON_ONE' && shooter.detailedAttributes.FINISHING) {
      specialtyBonus += ((shooter.detailedAttributes.FINISHING - 50) / 300) * base;
    }
  }

  // Open play shooter factor: finishing attribute relative to average (50).
  const finishingBonus = ((shooter.attributes.finishing - 50) / 300) * base + specialtyBonus;

  // Goalkeeper resistance: high goalkeeping / reflexes reduces shot expected conversion.
  let keeperSpecialty = 0;
  if (keeper?.detailedAttributes) {
    if (type === 'ONE_ON_ONE' && keeper.detailedAttributes.ONE_ON_ONE) {
      keeperSpecialty += ((keeper.detailedAttributes.ONE_ON_ONE - 50) / 400) * base;
    } else if (keeper.detailedAttributes.REFLEXES) {
      keeperSpecialty += ((keeper.detailedAttributes.REFLEXES - 50) / 400) * base;
    }
  }
  const keeperResistance = keeper ? ((keeper.attributes.goalkeeping - 50) / 350) * base + keeperSpecialty : 0;

  // Fatigue dampener: a severely fatigued striker is slightly less accurate.
  const fatiguePenalty = (shooter.fatigue / 100) * 0.08 * base;

  const rawXg = (base + finishingBonus - keeperResistance - fatiguePenalty) * pressureModifier;

  // Clamped according to real-world statistical ranges per shot type.
  const minFloor = type === 'LONG_SHOT' ? 0.02 : 0.05;
  const maxCeil = type === 'REBOUND' || type === 'ONE_ON_ONE' ? 0.75 : 0.45;

  return Math.max(minFloor, Math.min(maxCeil, Math.round(rawXg * 100) / 100));
}

/** Threshold above which a shot is classified as a "Big Chance" / "Grande Chance". */
export const BIG_CHANCE_THRESHOLD = 0.30;

export function isBigChance(xg: number): boolean {
  return xg >= BIG_CHANCE_THRESHOLD;
}

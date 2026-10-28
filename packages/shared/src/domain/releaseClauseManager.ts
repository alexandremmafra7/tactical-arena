import { Player } from './player.js';

export interface ReleaseClauseAdjustmentResult {
  playerId: string;
  playerName: string;
  marketValue: number;
  oldReleaseClause: number;
  newReleaseClause: number;
  oldWage: number;
  newWage: number;
  multiplier: number;
  categoryLabel: string;
}

/**
 * Calculates the required player wage adjustment when setting a customized release clause.
 * Higher release clauses demand a salary compensation bonus (e.g. 5x clause = ~25% wage increase).
 * A Football Director with high rating negotiates better terms, lowering the wage bump.
 */
export function calculateAdjustedWageForReleaseClause(
  player: Player,
  newReleaseClause: number,
  directorRating?: number
): number {
  const baseClause = Math.max(10_000, player.marketValue * 1.6);
  const ratio = newReleaseClause / baseClause;

  if (ratio <= 1.0) {
    // Clause decreased or kept at baseline — keep current wage
    return player.wage;
  }

  // Wage increase curve: +8% per additional 1.0x above base multiplier
  let wageIncreaseFactor = Math.min(0.80, (ratio - 1.0) * 0.08);

  // Director discount on wage negotiation (up to 30% discount on the salary bump)
  if (directorRating && directorRating > 50) {
    const discount = Math.min(0.30, (directorRating - 50) * 0.006);
    wageIncreaseFactor *= (1 - discount);
  }

  const adjustedWage = Math.round(player.wage * (1 + wageIncreaseFactor));
  return Math.max(player.wage, adjustedWage);
}

/**
 * Automatically calculates the optimal contract shielding release clause for every player in the squad.
 * Promising youngsters and star players receive massive protection clauses to prevent hostile buyouts.
 */
export function autoShieldSquadReleaseClauses(
  players: Player[],
  directorRating?: number
): ReleaseClauseAdjustmentResult[] {
  return players.map((p) => {
    let targetMultiplier = 2.0;
    let categoryLabel = 'Elenco / Rotação';

    const isYoungProdigy = p.age <= 22 && (p.potential >= 75 || p.starLevel !== 'NONE');
    const isStar = p.overall >= 80 || p.starLevel !== 'NONE';
    const isKeyPlayer = p.overall >= 74;

    if (isYoungProdigy) {
      targetMultiplier = 7.0; // 7x market value for U22 gems
      categoryLabel = '💎 Joia da Base / Promessa';
    } else if (isStar) {
      targetMultiplier = 5.0; // 5x market value for stars
      categoryLabel = '⭐ Estrela do Time';
    } else if (isKeyPlayer) {
      targetMultiplier = 3.5; // 3.5x market value for key starters
      categoryLabel = '🛡️ Titular Importante';
    } else {
      targetMultiplier = 2.2; // 2.2x market value for squad depth
      categoryLabel = '📋 Rotação de Elenco';
    }

    // Football Director improves protection multiplier slightly (up to +1.0x)
    if (directorRating && directorRating >= 75) {
      targetMultiplier += (directorRating - 75) * 0.04;
    }

    const newReleaseClause = Math.round((p.marketValue * targetMultiplier) / 1000) * 1000;
    const newWage = calculateAdjustedWageForReleaseClause(p, newReleaseClause, directorRating);

    return {
      playerId: p.id,
      playerName: p.name,
      marketValue: p.marketValue,
      oldReleaseClause: p.releaseClause,
      newReleaseClause,
      oldWage: p.wage,
      newWage,
      multiplier: Number(targetMultiplier.toFixed(1)),
      categoryLabel,
    };
  });
}

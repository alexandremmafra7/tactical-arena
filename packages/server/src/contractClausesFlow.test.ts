import { describe, it, expect } from 'vitest';
import { calculateSellOnShare, calculateMatchPerformanceBonuses } from '@tactical-arena/shared';

describe('Contract Clauses & Transfer Sell-on Integration Flow', () => {
  it('correctly computes sell-on profit payout on player resale', () => {
    // Jogador comprado por 5M, vendido por 15M com 25% de sell-on clause sobre a mais-valia
    const originalFee = 5_000_000;
    const resaleFee = 15_000_000;
    const sellOnPercent = 25;

    const share = calculateSellOnShare(resaleFee, originalFee, sellOnPercent);
    // Lucro = 10M. 25% de 10M = 2.5M
    expect(share).toBe(2_500_000);
  });

  it('correctly computes player match bonuses for clean sheet and goals', () => {
    const players = [
      { id: 'p1', position: 'ATT', contractClauses: { goalBonus: 10000, appearanceBonus: 1000 } },
      { id: 'p2', position: 'GK', contractClauses: { cleanSheetBonus: 5000, appearanceBonus: 500 } },
    ] as any[];

    const goalsMap = new Map<string, number>();
    goalsMap.set('p1', 1);

    const { totalBonusCost } = calculateMatchPerformanceBonuses(
      players,
      0, // 0 goals conceded (clean sheet)
      goalsMap,
      ['p1', 'p2'], // starters
    );

    // p1: 1000 (app) + 10000 (1 goal) = 11000
    // p2: 500 (app) + 5000 (clean sheet) = 5500
    // Total = 16500
    expect(totalBonusCost).toBe(16_500);
  });
});

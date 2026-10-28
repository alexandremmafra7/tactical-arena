import { describe, expect, it } from 'vitest';
import {
  canHireStaff,
  generateStaffMarket,
  getDirectorTransferDiscount,
  getFinancialDirectorSponsorBoost,
  getFitnessStaminaBoost,
  getInjuryReductionRate,
  STAFF_ROLES_INFO,
  STAFF_TIER_CONFIG,
} from './staff.js';

describe('Staff Domain & Candidates Market', () => {
  it('generates a full market of staff candidates across all 5 roles and 4 tiers', () => {
    const market = generateStaffMarket(123);
    expect(market.length).toBe(40); // 5 roles * 4 tiers * 2 candidates

    // Verify all roles are present
    const roles = new Set(market.map((s) => s.role));
    expect(roles.size).toBe(5);
    expect(roles.has('TACTICAL_ASSISTANT')).toBe(true);
    expect(roles.has('FOOTBALL_DIRECTOR')).toBe(true);
    expect(roles.has('FITNESS_COACH')).toBe(true);
    expect(roles.has('YOUTH_COORDINATOR')).toBe(true);
    expect(roles.has('FINANCIAL_DIRECTOR')).toBe(true);

    // Verify all tiers are present
    const tiers = new Set(market.map((s) => s.tier));
    expect(tiers.size).toBe(4);
    expect(tiers.has('BRONZE')).toBe(true);
    expect(tiers.has('DIAMANTE')).toBe(true);
  });

  it('validates hiring restrictions based on club visibility and manager titles', () => {
    const market = generateStaffMarket(42);
    const bronzeCandidate = market.find((s) => s.tier === 'BRONZE')!;
    const diamondCandidate = market.find((s) => s.tier === 'DIAMANTE')!;

    // Bronze has no restrictions
    expect(canHireStaff(bronzeCandidate, 10, 0).canHire).toBe(true);

    // Diamond requires high visibility and at least 2 titles
    const failVis = canHireStaff(diamondCandidate, 30, 3);
    expect(failVis.canHire).toBe(false);
    expect(failVis.reason).toContain('Visibilidade');

    const failTitles = canHireStaff(diamondCandidate, 80, 0);
    expect(failTitles.canHire).toBe(false);
    expect(failTitles.reason).toContain('título');

    const success = canHireStaff(diamondCandidate, 85, 3);
    expect(success.canHire).toBe(true);
  });

  it('computes realistic department bonuses for hired directors and coaches', () => {
    const market = generateStaffMarket(99);
    const director = market.find((s) => s.role === 'FOOTBALL_DIRECTOR' && s.tier === 'DIAMANTE')!;
    const fitness = market.find((s) => s.role === 'FITNESS_COACH' && s.tier === 'OURO')!;
    const cfo = market.find((s) => s.role === 'FINANCIAL_DIRECTOR' && s.tier === 'PRATA')!;

    const discount = getDirectorTransferDiscount(director);
    expect(discount).toBeGreaterThanOrEqual(0.12);
    expect(discount).toBeLessThanOrEqual(0.20);

    /**
     * O bônus de recuperação foi recalibrado e o teto baixou de propósito.
     *
     * O antigo levava a recuperação semanal acima do custo de um jogo por volta da nota 80, e a partir dali o
     * cansaço deixava de existir: medido, elenco com cansaço médio zero. O teto novo mantém a recuperação por
     * baixo do desgaste de uma partida, então um bom preparador adia o desgaste em vez de aboli-lo.
     */
    const staminaBoost = getFitnessStaminaBoost(fitness);
    expect(staminaBoost).toBeGreaterThan(0.08);
    expect(staminaBoost, 'acima disto o cansaço sai do jogo como mecânica').toBeLessThanOrEqual(0.22);

    const injuryReduction = getInjuryReductionRate(fitness);
    expect(injuryReduction).toBeGreaterThanOrEqual(0.20);

    const sponsorBoost = getFinancialDirectorSponsorBoost(cfo);
    expect(sponsorBoost).toBeGreaterThanOrEqual(0.05);
  });
});

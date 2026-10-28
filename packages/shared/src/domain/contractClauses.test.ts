import { describe, it, expect } from 'vitest';
import { calculateSellOnShare, evaluateContractNegotiation, calculateMatchPerformanceBonuses } from './contractClauses.js';
import type { AgentProfile, NegotiationOffer, ContractClauses } from './contractClauses.js';
import type { Player } from './player.js';
import type { Club } from './club.js';

describe('Contract Clauses & Agent Negotiations', () => {
  const mockPlayer: Player = {
    id: 'p1',
    name: 'Craque Silva',
    position: 'ATT',
    overall: 88,
    age: 25,
    wage: 50_000,
    marketValue: 10_000_000,
    potential: 92,
    starLevel: 3,
    diferenciado: true,
    contractClauses: {
      goalBonus: 5000,
      cleanSheetBonus: 0,
      appearanceBonus: 1000,
      titleBonus: 50000,
      sellOnClausePercent: 20,
      releaseClause: 50000000,
      relegationReleaseDiscount: 50,
      loanOption: 'NONE',
    } as ContractClauses,
  } as unknown as Player;

  const mockClub: Club = {
    id: 'c1',
    name: 'Tactical FC',
    prestige: 85,
    players: [],
  } as unknown as Club;

  const mockAgent: AgentProfile = {
    name: 'Mino Raiola Jr',
    personality: 'GREEDY',
    patience: 80,
  };

  it('calculates sell-on clause share correctly based on profit', () => {
    const share = calculateSellOnShare(20_000_000, 10_000_000, 20);
    expect(share).toBe(2_000_000);

    const noProfitShare = calculateSellOnShare(8_000_000, 10_000_000, 20);
    expect(noProfitShare).toBe(0);
  });

  it('calculates match performance bonuses correctly', () => {
    const gkPlayer: Player = {
      id: 'gk1',
      name: 'Goleiro Paredão',
      position: 'GK',
      overall: 82,
      wage: 20_000,
      contractClauses: { cleanSheetBonus: 3000, appearanceBonus: 500 } as ContractClauses,
    } as unknown as Player;

    const goalMap = new Map<string, number>();
    goalMap.set('p1', 2); // 2 gols de Craque Silva

    const { totalBonusCost } = calculateMatchPerformanceBonuses(
      [mockPlayer, gkPlayer],
      0, // clean sheet
      goalMap,
      ['p1', 'gk1'], // ambos titulares
    );

    // Craque Silva: appearance(1000) + 2*goalBonus(10000) = 11000
    // Goleiro: appearance(500) + cleanSheet(3000) = 3500
    // Total = 11000 + 3500 = 14500
    expect(totalBonusCost).toBe(14_500);
  });

  it('accepts negotiation when offer meets or exceeds expectations', () => {
    const generousOffer: NegotiationOffer = {
      weeklyWage: 80_000,
      signingBonus: 200_000,
      contractYears: 4,
      goalBonus: 5_000,
      cleanSheetBonus: 0,
      appearanceBonus: 1_000,
      releaseClause: 50_000_000,
    };

    const result = evaluateContractNegotiation({
      player: mockPlayer,
      club: mockClub,
      offer: generousOffer,
      agent: mockAgent,
    });

    expect(result.status).toBe('ACCEPTED');
    expect(result.updatedAgent.patience).toBeGreaterThan(mockAgent.patience);
  });

  it('issues counter-offer or storms out when offer is too low', () => {
    const lowOffer: NegotiationOffer = {
      weeklyWage: 20_000,
      signingBonus: 10_000,
      contractYears: 1,
      goalBonus: 500,
      cleanSheetBonus: 0,
      appearanceBonus: 100,
      releaseClause: 5_000_000,
    };

    const result = evaluateContractNegotiation({
      player: mockPlayer,
      club: mockClub,
      offer: lowOffer,
      agent: mockAgent,
    });

    expect(result.status).toBe('COUNTER_OFFER');
    expect(result.counterOffer).toBeDefined();
    expect(result.updatedAgent.patience).toBeLessThan(mockAgent.patience);
  });

  it('storms out when agent patience reaches zero', () => {
    const impatientAgent: AgentProfile = {
      name: 'Agent Strict',
      personality: 'STUBBORN',
      patience: 10,
    };

    const terribleOffer: NegotiationOffer = {
      weeklyWage: 10_000,
      signingBonus: 0,
      contractYears: 1,
      goalBonus: 0,
      cleanSheetBonus: 0,
      appearanceBonus: 0,
      releaseClause: 1_000_000,
    };

    const result = evaluateContractNegotiation({
      player: mockPlayer,
      club: mockClub,
      offer: terribleOffer,
      agent: impatientAgent,
    });

    expect(result.status).toBe('STORMED_OUT');
    expect(result.updatedAgent.patience).toBe(0);
  });
});

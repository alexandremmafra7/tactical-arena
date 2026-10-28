import { describe, it, expect } from 'vitest';
import {
  identifyExpiringContracts,
  computeRecommendedWage,
  batchRenewContracts,
  processDirectorContractDelegation,
} from './contractRenewalAutomation.js';
import type { Club, Player } from '../index.js';
import { getStaffDelegationPreset } from './staffDelegationConfig.js';

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Player One',
    position: 'MID',
    preferredFoot: 'RIGHT',
    age: 25,
    attributes: {
      pace: 75,
      finishing: 70,
      passing: 78,
      defending: 72,
      physical: 74,
      goalkeeping: 10,
    },
    detailedAttributes: {} as any,
    morale: 80,
    fatigue: 0,
    commitment: 80,
    marketValue: 1_000_000,
    overall: 75,
    potential: 80,
    starLevel: 'NONE',
    traits: [],
    functions: [],
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    nationality: 'BRA',
    wage: 5_000,
    releaseClause: 1_600_000,
    contractUntil: 2026, // Expiring this season
    ...overrides,
  };
}

function createMockClub(overrides: Partial<Club> = {}): Club {
  return {
    id: 'club-1',
    name: 'Mock FC',
    ownerId: 'user-1',
    slug: 'mock-fc',
    country: 'BRA',
    players: [],
    academyPlayers: [],
    budget: 5_000_000,
    captainPlayerId: null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: 1,
    stadiumCapacity: 10000,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
    pendingRoundTactic: null,
    staff: [
      {
        id: 'dir-1',
        name: 'Alexandre Mattos',
        role: 'FOOTBALL_DIRECTOR',
        tier: 'OURO',
        rating: 85,
        specialty: 'Especialista em Negociações de Mercado',
        description: 'Diretor experiente',
        wage: 35000,
        minClubVisibility: 50,
        minCareerTitles: 1,
        avatar: '👔',
        nationality: 'BRA',
      },
    ],
    staffDelegationConfig: getStaffDelegationPreset('brasfoot_casual'),
    ...overrides,
  };
}

describe('Contract Renewal Automation', () => {
  describe('identifyExpiringContracts', () => {
    it('returns empty result for club with no players', () => {
      const result = identifyExpiringContracts([]);
      expect(result.allExpiring).toHaveLength(0);
      expect(result.keyPlayers).toHaveLength(0);
      expect(result.squadPlayers).toHaveLength(0);
      expect(result.surplusPlayers).toHaveLength(0);
      expect(result.totalBatchCost).toBe(0);
    });

    it('categorizes star, squad, and surplus expiring contracts accurately', () => {
      const star = createMockPlayer({
        id: 'star-1',
        name: 'Craque Silva',
        overall: 88,
        starLevel: 'NATURAL',
        contractUntil: 2026,
      });

      const squad = createMockPlayer({
        id: 'squad-1',
        name: 'Volante Operário',
        overall: 74,
        contractUntil: 2026,
      });

      const surplus = createMockPlayer({
        id: 'surplus-1',
        name: 'Veterano Em Fim De Carreira',
        overall: 60,
        age: 34,
        contractUntil: 2026,
      });

      const longContract = createMockPlayer({
        id: 'long-1',
        name: 'Contrato Longo',
        overall: 78,
        contractUntil: 2030,
      });

      const club = createMockClub({
        players: [star, squad, surplus, longContract],
      });

      const result = identifyExpiringContracts(club, 10, 2026);

      expect(result.allExpiring).toHaveLength(3);
      expect(result.keyPlayers.map((k) => k.player.id)).toContain('star-1');
      expect(result.squadPlayers.map((s) => s.player.id)).toContain('squad-1');
      expect(result.surplusPlayers.map((sp) => sp.player.id)).toContain('surplus-1');
      expect(result.recommendedBatchPlayerIds).toEqual(['star-1', 'squad-1']);
      expect(result.totalBatchCost).toBeGreaterThan(0);
    });
  });

  describe('computeRecommendedWage', () => {
    it('scales wage appropriately with overall and awards star bonus', () => {
      const regular = createMockPlayer({ overall: 75, marketValue: 2_000_000 });
      const star = createMockPlayer({ overall: 88, marketValue: 20_000_000, starLevel: 'NATURAL' });

      const regularWage = computeRecommendedWage(regular);
      const starWage = computeRecommendedWage(star);

      expect(regularWage).toBeGreaterThanOrEqual(5000);
      expect(starWage).toBeGreaterThan(regularWage * 5);
    });

    it('gives young high-potential players a fair development bump', () => {
      const youngTalent = createMockPlayer({
        age: 19,
        overall: 72,
        potential: 85,
        marketValue: 1_500_000,
        wage: 3_000,
      });

      const recommended = computeRecommendedWage(youngTalent);
      expect(recommended).toBeGreaterThanOrEqual(youngTalent.wage);
    });
  });

  describe('batchRenewContracts', () => {
    it('renews selected players atomically and deducts cost from club budget', () => {
      const p1 = createMockPlayer({ id: 'p1', contractUntil: 2026, wage: 5_000 });
      const p2 = createMockPlayer({ id: 'p2', contractUntil: 2026, wage: 6_000 });
      const club = createMockClub({ players: [p1, p2], budget: 2_000_000 });

      const result = batchRenewContracts(club, ['p1', 'p2'], 2026, { years: 2 });

      expect(result.renewedPlayers).toHaveLength(2);
      expect(result.failedPlayerIds).toHaveLength(0);
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.updatedClub.budget).toBe(2_000_000 - result.totalCost);

      const renewedP1 = result.updatedClub.players.find((p) => p.id === 'p1');
      const renewedP2 = result.updatedClub.players.find((p) => p.id === 'p2');
      expect(renewedP1?.contractUntil).toBe(2028);
      expect(renewedP2?.contractUntil).toBe(2028);
    });

    it('stops renewing when budget is exhausted without corrupting state', () => {
      const p1 = createMockPlayer({ id: 'p1', contractUntil: 2026, wage: 50_000, marketValue: 10_000_000 });
      const p2 = createMockPlayer({ id: 'p2', contractUntil: 2026, wage: 50_000, marketValue: 10_000_000 });
      const club = createMockClub({ players: [p1, p2], budget: 50_000 }); // Low budget

      const result = batchRenewContracts(club, ['p1', 'p2'], 2026, { years: 2 });

      expect(result.failedPlayerIds).toHaveLength(2);
      expect(result.renewedPlayers).toHaveLength(0);
      expect(result.updatedClub.budget).toBe(50_000);
    });

    it('supports custom yearsMap for per-player contract duration', () => {
      const p1 = createMockPlayer({ id: 'p1', contractUntil: 2026, wage: 5_000 });
      const p2 = createMockPlayer({ id: 'p2', contractUntil: 2026, wage: 6_000 });
      const club = createMockClub({ players: [p1, p2], budget: 2_000_000 });

      const result = batchRenewContracts(club, ['p1', 'p2'], 2026, {
        years: 2,
        yearsMap: { p1: 3, p2: 1 },
      });

      expect(result.renewedPlayers).toHaveLength(2);
      const renewedP1 = result.updatedClub.players.find((p) => p.id === 'p1');
      const renewedP2 = result.updatedClub.players.find((p) => p.id === 'p2');
      expect(renewedP1?.contractUntil).toBe(2029); // +3 years
      expect(renewedP2?.contractUntil).toBe(2027); // +1 year
    });
  });

  describe('processDirectorContractDelegation', () => {
    it('auto-renews secondary squad players when director_handles_routine is enabled', () => {
      const star = createMockPlayer({ id: 'star-1', overall: 89, starLevel: 'NATURAL', contractUntil: 2026 });
      const squad1 = createMockPlayer({ id: 'squad-1', overall: 75, contractUntil: 2026 });
      const squad2 = createMockPlayer({ id: 'squad-2', overall: 74, contractUntil: 2026 });
      const surplus = createMockPlayer({ id: 'surplus-1', age: 35, overall: 58, contractUntil: 2026 });

      const club = createMockClub({
        players: [star, squad1, squad2, surplus],
        budget: 5_000_000,
        staffDelegationConfig: {
          ...getStaffDelegationPreset('brasfoot_casual'),
          contractRenewals: 'director_handles_routine',
        },
      });

      const outcome = processDirectorContractDelegation(club, 2026);

      expect(outcome.renewedCount).toBe(2);
      expect(outcome.renewedPlayers.map((p) => p.id)).toEqual(['squad-1', 'squad-2']);
      expect(outcome.keyPlayersRequiringDecision.map((k) => k.player.id)).toEqual(['star-1']);
      expect(outcome.headline).toBe('📝 O Diretor de Futebol renovou o contrato de 2 atletas da equipe.');

      // Check that renewed players now have extended contract
      const updatedSquad1 = outcome.club.players.find((p) => p.id === 'squad-1');
      expect(updatedSquad1?.contractUntil).toBe(2028);

      // Star player remained untouched for manager to decide
      const updatedStar = outcome.club.players.find((p) => p.id === 'star-1');
      expect(updatedStar?.contractUntil).toBe(2026);
    });

    it('defaults to director_handles_routine when staffDelegationConfig is undefined', () => {
      const squad1 = createMockPlayer({ id: 'squad-1', overall: 75, contractUntil: 2026 });
      const club = createMockClub({
        players: [squad1],
        staffDelegationConfig: undefined,
      });

      const outcome = processDirectorContractDelegation(club, 2026);
      expect(outcome.renewedCount).toBe(1);
      expect(outcome.headline).toBe('📝 O Diretor de Futebol renovou o contrato de 1 atleta da equipe.');
    });

    it('does not auto-renew when manual delegation mode is active', () => {
      const squad1 = createMockPlayer({ id: 'squad-1', overall: 75, contractUntil: 2026 });
      const club = createMockClub({
        players: [squad1],
        staffDelegationConfig: {
          ...getStaffDelegationPreset('football_manager_hardcore'),
          contractRenewals: 'manual',
        },
      });

      const outcome = processDirectorContractDelegation(club, 2026);
      expect(outcome.renewedCount).toBe(0);
      expect(outcome.renewedPlayers).toHaveLength(0);
      expect(outcome.headline).toBeNull();
    });
  });
});

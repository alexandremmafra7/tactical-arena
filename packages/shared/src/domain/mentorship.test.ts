import { describe, expect, it } from 'vitest';
import type { Player } from './player.js';
import {
  calculateMentorshipCompatibility,
  autoAssignMentorshipPairs,
  applyMentorshipTick,
  isEligibleMentor,
  isEligibleApprentice,
} from './mentorship.js';

describe('mentorship domain', () => {
  const veteranLeaderDEF: Player = {
    id: 'p-veteran-def',
    name: 'Gilberto Silva',
    position: 'DEF',
    age: 32,
    overall: 80,
    potential: 80,
    nationality: 'Brasil',
    traits: ['LEADER'],
    functions: ['ZAGUEIRO_REBATEDOR'],
    morale: 85,
    fatigue: 10,
    commitment: 90,
    preferredFoot: 'RIGHT',
    starLevel: 'NONE',
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    marketValue: 1000000,
    wage: 50000,
    releaseClause: 10000000,
    attributes: { pace: 70, finishing: 40, passing: 68, defending: 82, physical: 80, goalkeeping: 10 },
    detailedAttributes: {} as any,
  };

  const youngProspectDEF: Player = {
    id: 'p-young-def',
    name: 'Murillo',
    position: 'DEF',
    age: 20,
    overall: 73,
    potential: 85,
    nationality: 'Brasil',
    traits: ['TEMPERAMENTAL'],
    functions: [],
    morale: 70,
    fatigue: 15,
    commitment: 65,
    preferredFoot: 'LEFT',
    starLevel: 'NONE',
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    marketValue: 5000000,
    wage: 20000,
    releaseClause: 30000000,
    attributes: { pace: 74, finishing: 35, passing: 64, defending: 75, physical: 76, goalkeeping: 10 },
    detailedAttributes: {} as any,
  };

  const foreignStrikerATT: Player = {
    id: 'p-young-att',
    name: 'Mateo Retegui',
    position: 'ATT',
    age: 21,
    overall: 74,
    potential: 84,
    nationality: 'Argentina',
    traits: [],
    functions: ['CENTROAVANTE'],
    morale: 75,
    fatigue: 5,
    commitment: 70,
    preferredFoot: 'RIGHT',
    starLevel: 'NONE',
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    marketValue: 6000000,
    wage: 35000,
    releaseClause: 40000000,
    attributes: { pace: 77, finishing: 78, passing: 60, defending: 35, physical: 75, goalkeeping: 10 },
    detailedAttributes: {} as any,
  };

  const veteranStrikerATT: Player = {
    id: 'p-veteran-att',
    name: 'Fred',
    position: 'ATT',
    age: 33,
    overall: 79,
    potential: 79,
    nationality: 'Brasil',
    traits: ['DETERMINED'],
    functions: ['CENTROAVANTE_REFERENCIA'],
    morale: 80,
    fatigue: 12,
    commitment: 85,
    preferredFoot: 'RIGHT',
    starLevel: 'NONE',
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    marketValue: 1200000,
    wage: 45000,
    releaseClause: 5000000,
    attributes: { pace: 68, finishing: 83, passing: 66, defending: 30, physical: 72, goalkeeping: 10 },
    detailedAttributes: {} as any,
  };

  describe('eligibility & compatibility', () => {
    it('identifies eligible mentors and apprentices by age and traits', () => {
      expect(isEligibleMentor(veteranLeaderDEF)).toBe(true);
      expect(isEligibleMentor(youngProspectDEF)).toBe(false);
      expect(isEligibleApprentice(youngProspectDEF)).toBe(true);
      expect(isEligibleApprentice(veteranLeaderDEF)).toBe(false);
    });

    it('calculates very high compatibility for same position, nationality and LEADER trait', () => {
      const result = calculateMentorshipCompatibility(veteranLeaderDEF, youngProspectDEF);
      expect(result.isEligible).toBe(true);
      // 50 base + 30 (mesma pos) + 15 (mesma nac) + 15 (leader) = 100 max
      expect(result.score).toBeGreaterThanOrEqual(95);
      expect(result.reasons.some((r) => r.includes('Mesma posição'))).toBe(true);
      expect(result.reasons.some((r) => r.includes('Líder Nato'))).toBe(true);
    });

    it('gives lower compatibility when position and nationality do not match', () => {
      const result = calculateMentorshipCompatibility(veteranLeaderDEF, foreignStrikerATT);
      expect(result.isEligible).toBe(true);
      // 50 base + 0 (pos diferente) + 0 (nac diferente) + 15 (leader) = 65
      expect(result.score).toBeLessThan(75);
    });
  });

  describe('autoAssignMentorshipPairs', () => {
    it('pairs the best matching mentors with the most promising youth prospects', () => {
      const squad = [veteranLeaderDEF, veteranStrikerATT, youngProspectDEF, foreignStrikerATT];
      const pairs = autoAssignMentorshipPairs(squad);

      expect(pairs.length).toBe(2);

      // O zagueiro veterano deve mentorar o zagueiro jovem
      const defPair = pairs.find((p) => p.mentorId === veteranLeaderDEF.id);
      expect(defPair).toBeDefined();
      expect(defPair?.apprenticeId).toBe(youngProspectDEF.id);
      expect(defPair?.positionMatch).toBe(true);

      // O atacante veterano deve mentorar o atacante jovem
      const attPair = pairs.find((p) => p.mentorId === veteranStrikerATT.id);
      expect(attPair).toBeDefined();
      expect(attPair?.apprenticeId).toBe(foreignStrikerATT.id);
      expect(attPair?.positionMatch).toBe(true);
    });
  });

  describe('applyMentorshipTick', () => {
    it('increments weeksActive and applies positive development events over time', () => {
      const pairs = [{
        id: 'test-pair',
        mentorId: veteranLeaderDEF.id,
        mentorName: veteranLeaderDEF.name,
        apprenticeId: youngProspectDEF.id,
        apprenticeName: youngProspectDEF.name,
        compatibilityScore: 95,
        positionMatch: true,
        sharedNationality: true,
        weeksActive: 2, // próxima semana vira 3 (semana de avaliação)
      }];

      const squad = [veteranLeaderDEF, youngProspectDEF];
      // RNG retornando 0.05 para garantir ativação
      const tick = applyMentorshipTick(pairs, squad, () => 0.05);

      expect(tick.updatedPairs[0].weeksActive).toBe(3);
      expect(tick.events.length).toBeGreaterThan(0);

      const updatedYoung = tick.updatedSquad.find((p) => p.id === youngProspectDEF.id);
      expect(updatedYoung?.commitment).toBeGreaterThan(youngProspectDEF.commitment);
    });
  });
});

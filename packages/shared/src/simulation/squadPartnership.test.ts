import { describe, it, expect } from 'vitest';
import {
  calculatePartnershipAffinity,
  findCriticalPartnerships,
  calculateSquadPartnershipSynergy,
  partnershipKey,
} from '../domain/squadPartnership.js';
import { makePlayer } from './testFactories.js';

describe('Squad Partnership Chemistry System (Tarefa 3.1)', () => {
  describe('calculatePartnershipAffinity', () => {
    it('aplica penalidade de desentendimento e erro sob pressão para recém-contratados (0 a 5 jogos)', () => {
      const newAffinity = calculatePartnershipAffinity(2);
      expect(newAffinity.level).toBe('NEW');
      expect(newAffinity.score).toBeLessThanOrEqual(25);
      expect(newAffinity.bonusMultiplier).toBe(0.98); // -2% de entrosamento
      expect(newAffinity.pressureErrorRisk).toBe(0.10); // +10% de risco sob pressão
    });

    it('mantém neutralidade e curva de crescimento para parcerias em desenvolvimento (6 a 15 jogos)', () => {
      const devAffinity = calculatePartnershipAffinity(10);
      expect(devAffinity.level).toBe('DEVELOPING');
      expect(devAffinity.score).toBeGreaterThan(25);
      expect(devAffinity.score).toBeLessThanOrEqual(50);
      expect(devAffinity.bonusMultiplier).toBe(1.0);
      expect(devAffinity.pressureErrorRisk).toBe(0.0);
    });

    it('confere bônus de entrosamento estabelecido (+3%) para parcerias de 16 a 30 jogos', () => {
      const estAffinity = calculatePartnershipAffinity(22);
      expect(estAffinity.level).toBe('ESTABLISHED');
      expect(estAffinity.score).toBeGreaterThan(50);
      expect(estAffinity.score).toBeLessThanOrEqual(75);
      expect(estAffinity.bonusMultiplier).toBe(1.03);
      expect(estAffinity.pressureErrorRisk).toBe(0.0);
    });

    it('confere bônus máximo de veteranos (+6%) para duplas com mais de 30 jogos juntas', () => {
      const vetAffinity = calculatePartnershipAffinity(45);
      expect(vetAffinity.level).toBe('VETERAN');
      expect(vetAffinity.score).toBeGreaterThan(75);
      expect(vetAffinity.score).toBeLessThanOrEqual(100);
      expect(vetAffinity.bonusMultiplier).toBe(1.06); // +6% em antecipação e coberturas
      expect(vetAffinity.pressureErrorRisk).toBe(0.0);
    });
  });

  describe('partnershipKey', () => {
    it('gera chave determinística independente da ordem dos IDs', () => {
      expect(partnershipKey('playerA', 'playerB')).toBe(partnershipKey('playerB', 'playerA'));
    });
  });

  describe('findCriticalPartnerships & calculateSquadPartnershipSynergy', () => {
    it('detecta duplas críticas de zaga, meio e ataque no lineup e calcula bônus da equipe', () => {
      const d1 = makePlayer('d1', { name: 'Zagueiro 1', position: 'DEF' });
      const d2 = makePlayer('d2', { name: 'Zagueiro 2', position: 'DEF' });
      const m1 = makePlayer('m1', { name: 'Volante 1', position: 'MID' });
      const m2 = makePlayer('m2', { name: 'Meia 1', position: 'MID' });
      const a1 = makePlayer('a1', { name: 'Atacante 1', position: 'ATT' });
      const a2 = makePlayer('a2', { name: 'Atacante 2', position: 'ATT' });

      const lineup = [
        { player: d1, slotPosition: 'DEF' as const },
        { player: d2, slotPosition: 'DEF' as const },
        { player: m1, slotPosition: 'MID' as const },
        { player: m2, slotPosition: 'MID' as const },
        { player: a1, slotPosition: 'ATT' as const },
        { player: a2, slotPosition: 'ATT' as const },
      ];

      // Histórico simulado: Zaga veterana (35 jogos), Meio recém-formado (3 jogos), Ataque estabelecido (20 jogos)
      const history = new Map<string, number>();
      history.set(partnershipKey('d1', 'd2'), 35);
      history.set(partnershipKey('m1', 'm2'), 3);
      history.set(partnershipKey('a1', 'a2'), 20);

      const pairs = findCriticalPartnerships(lineup, history);
      expect(pairs.length).toBe(3);

      const defPair = pairs.find((p) => p.sector === 'DEFENSE');
      expect(defPair?.affinity.level).toBe('VETERAN');
      expect(defPair?.affinity.bonusMultiplier).toBe(1.06);

      const midPair = pairs.find((p) => p.sector === 'MIDFIELD');
      expect(midPair?.affinity.level).toBe('NEW');
      expect(midPair?.affinity.pressureErrorRisk).toBe(0.10);

      const attPair = pairs.find((p) => p.sector === 'ATTACK');
      expect(attPair?.affinity.level).toBe('ESTABLISHED');
      expect(attPair?.affinity.bonusMultiplier).toBe(1.03);

      const synergy = calculateSquadPartnershipSynergy(pairs);
      expect(synergy.defenseBonus).toBeGreaterThan(1.0); // Zaga veterana compensa meio recém-formado
      expect(synergy.maxPressureErrorRisk).toBe(0.10); // Risco sob pressão detectado pelo meio novo
      expect(synergy.averageAffinityScore).toBeGreaterThan(0);
    });
  });
});

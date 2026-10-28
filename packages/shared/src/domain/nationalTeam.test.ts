/**
 * TESTES UNITÁRIOS - SELEÇÕES NACIONAIS, CONVOCAÇÃO DE 26 ATLETAS & BENEFÍCIOS FIFA
 *
 * Testa o catálogo de seleções, convocação rigorosa de 26 atletas por overall/nacionalidade/sem lesão,
 * cálculos de diárias de liberação da FIFA, indenizações de lesão e bônus de torneios.
 */

import { describe, it, expect } from 'vitest';
import {
  NATIONAL_TEAMS,
  autoSelectNationalSquad,
  calculateFifaReleaseCompensation,
  calculateFifaInjuryIndemnity,
  calculateNationalTournamentBonus,
  calculateFifaRankingChange,
  evaluateNationalJobOffer
} from './nationalTeam';
import type { Player } from './player';

describe('National Teams & FIFA Benefits Program', () => {
  it('deve conter pelo menos 62 seleções nacionais cadastradas', () => {
    expect(NATIONAL_TEAMS.length).toBeGreaterThanOrEqual(62);
    const brazil = NATIONAL_TEAMS.find(t => t.id === 'BRA');
    expect(brazil).toBeDefined();
    expect(brazil?.name).toBe('Brasil');
    expect(brazil?.confederation).toBe('CONMEBOL');
  });

  it('deve convocar exatamente 26 jogadores respeitando nacionalidade, sem lesão e quotas FIFA (3 GK, 5 DEF, 4 LAT, 7 MID, 7 ATT)', () => {
    const mockPlayers = Array.from({ length: 60 }, (_, i) => ({
      id: `p_${i + 1}`,
      name: `Jogador ${i + 1}`,
      position: (i < 5 ? 'GK' : i < 15 ? 'DEF' : i < 22 ? 'LAT' : i < 40 ? 'MID' : 'ATT') as any,
      nationality: 'BRA',
      preferredFoot: 'RIGHT',
      age: 25,
      attributes: { pace: 70, finishing: 70, passing: 70, defending: 70, physical: 70, goalkeeping: 70 },
      detailedAttributes: {} as any,
      morale: 80,
      fatigue: 0,
      commitment: 90,
      marketValue: 1000000,
      overall: 50 + (i % 40),
      potential: 90,
      starLevel: 'NATURAL' as const,
      traits: i === 0 ? ['LEADER'] : [],
      functions: [],
      developmentPoints: 0,
      trainingFocus: null,
      suspensions: [],
      wage: 20000,
      releaseClause: 5000000,
      injuryWeeks: i === 5 ? 3 : 0 // Jogador p_6 está lesionado e não deve ser convocado
    }));

    // Adicionar um jogador de outra nacionalidade que não deve entrar na seleção BRA
    mockPlayers.push({
      id: 'p_foreign',
      name: 'Estrangeiro Craque',
      position: 'ATT',
      nationality: 'ARG',
      preferredFoot: 'RIGHT',
      age: 26,
      attributes: { pace: 90, finishing: 90, passing: 90, defending: 90, physical: 90, goalkeeping: 90 },
      detailedAttributes: {} as any,
      morale: 95,
      fatigue: 0,
      commitment: 90,
      marketValue: 50000000,
      overall: 95,
      potential: 95,
      starLevel: 'NATURAL' as const,
      traits: ['LEADER'],
      functions: [],
      developmentPoints: 0,
      trainingFocus: null,
      suspensions: [],
      wage: 50000,
      releaseClause: 100000000,
      injuryWeeks: 0
    });

    const squadState = autoSelectNationalSquad('BRA', mockPlayers as unknown as Player[]);
    expect(squadState.squad).toHaveLength(26);

    // Verificar se o lesionado (p_6) e o estrangeiro (p_foreign) foram excluídos
    expect(squadState.squad.some(p => p.playerId === 'p_6')).toBe(false);
    expect(squadState.squad.some(p => p.playerId === 'p_foreign')).toBe(false);

    // Verificar contagem por posição
    const gks = squadState.squad.filter(p => p.position === 'GK');
    const defs = squadState.squad.filter(p => p.position === 'DEF');
    const lats = squadState.squad.filter(p => p.position === 'LAT');
    const mids = squadState.squad.filter(p => p.position === 'MID');
    const atts = squadState.squad.filter(p => p.position === 'ATT');

    expect(gks).toHaveLength(3);
    expect(defs).toHaveLength(5);
    expect(lats).toHaveLength(4);
    expect(mids).toHaveLength(7);
    expect(atts).toHaveLength(7);
  });

  it('deve calcular corretamente a compensação de liberação e indenização por lesão da FIFA', () => {
    const mockPlayer: Player = {
      id: 'test_p',
      name: 'Atleta Teste',
      position: 'MID',
      nationality: 'BRA',
      preferredFoot: 'RIGHT',
      age: 24,
      overall: 82,
      wage: 40000,
      attributes: {} as any,
      detailedAttributes: {} as any,
      morale: 80,
      fatigue: 0,
      commitment: 90,
      marketValue: 20000000,
      potential: 90,
      starLevel: 'NATURAL',
      traits: [],
      suspensions: [],
      injuryWeeks: 0,
      functions: [],
      developmentPoints: 0,
      trainingFocus: null,
      releaseClause: 50000000
    };

    const compensation = calculateFifaReleaseCompensation(mockPlayer, 10);
    expect(compensation).toBeGreaterThan(0);

    const indemnity = calculateFifaInjuryIndemnity(mockPlayer, 4); // 4 semanas de lesão
    expect(indemnity).toBeGreaterThan(0);

    const tournamentBonus = calculateNationalTournamentBonus(3, 'CHAMPION');
    expect(tournamentBonus).toBe(9000000); // 3M * 3
  });

  it('deve recalcular corretamente os pontos do Ranking FIFA', () => {
    const winResult = calculateFifaRankingChange(1800, 1500, 'WIN', true);
    expect(winResult.newPoints).toBeGreaterThan(1800);
    expect(winResult.pointsDiff).toBeGreaterThan(0);

    const lossResult = calculateFifaRankingChange(1800, 1500, 'LOSS', false);
    expect(lossResult.newPoints).toBeLessThan(1800);
    expect(lossResult.pointsDiff).toBeLessThan(0);
  });
});

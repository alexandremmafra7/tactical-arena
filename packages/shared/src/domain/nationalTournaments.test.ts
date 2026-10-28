/**
 * TESTES UNITÁRIOS - COPA DO MUNDO DA FIFA & TORNEIOS DE SELEÇÕES
 *
 * Valida a geração de grupos da Copa do Mundo, Eurocopa, Finalíssima
 * e avanço de torneios internacionais.
 */

import { describe, it, expect } from 'vitest';
import {
  generateWorldCupTournament,
  generateEuroTournament,
  generateFinalissima,
  advanceNationalTournament
} from './nationalTournaments';

describe('National Tournaments Domain', () => {
  it('deve gerar a Copa do Mundo da FIFA com 32 seleções em 8 grupos', () => {
    const teams = Array.from({ length: 32 }, (_, i) => `NAT_${i + 1}`);
    const wc = generateWorldCupTournament(teams, 2026, 123);

    expect(wc.tournamentType).toBe('WORLD_CUP');
    expect(wc.groups).toBeDefined();
    expect(Object.keys(wc.groups || {})).toHaveLength(8);
    expect(wc.trophyAsset).toContain('tr_copamundo.png');
    expect(wc.matches.length).toBeGreaterThan(0);
  });

  it('deve lançar erro se a Copa do Mundo não tiver exatamente 32 seleções', () => {
    expect(() => generateWorldCupTournament(['BRA', 'ARG'])).toThrow();
  });

  it('deve gerar a Eurocopa com 24 seleções', () => {
    const teams = Array.from({ length: 24 }, (_, i) => `EUR_${i + 1}`);
    const euro = generateEuroTournament(teams, 2028, 456);

    expect(euro.tournamentType).toBe('EURO');
    expect(euro.trophyAsset).toContain('tr_eurocopa.png');
  });

  it('deve gerar a Finalíssima CONMEBOL-UEFA em jogo único', () => {
    const finalissima = generateFinalissima('BRA', 'FRA', 2029);

    expect(finalissima.tournamentType).toBe('FINALISSIMA');
    expect(finalissima.matches).toHaveLength(1);
    expect(finalissima.trophyAsset).toContain('tr_finalissima.png');

    const advanced = advanceNationalTournament(finalissima, [
      { matchId: 'finalissima_match', homeScore: 2, awayScore: 1 }
    ]);

    expect(advanced.isCompleted).toBe(true);
    expect(advanced.champion).toBe('BRA');
  });
});

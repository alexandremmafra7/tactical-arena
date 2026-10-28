/**
 * TESTES UNITÁRIOS - FIFA CLUB WORLD CUP
 *
 * Testa rigorosamente as funções do domínio dos Mundiais de Clubes da FIFA:
 * 1. Copa Intercontinental da FIFA (Mundial Anual)
 * 2. Super Mundial de Clubes FIFA (32 Clubes)
 * 3. Cálculo de pontos de ranking
 *
 * @see 12_MUNDIAIS_DE_CLUBES_DA_FIFA_SPEC.md
 */

import { describe, it, expect } from 'vitest';

import {
  generateIntercontinentalBracket,
  generateSuperClubWorldCup,
  calculateClubWorldCupRankingPoints,
  IntercontinentalTournamentState,
  IntercontinentalPhase,
  SuperWorldCupState,
  SuperWorldCupPhase,
  ContinentalConfederation,
  IntercontinentalMatch,
  SuperWorldCupMatch
} from './fifaClubWorldCup';

describe('FIFA Club World Cup Domain', () => {
  describe('generateIntercontinentalBracket', () => {
    const mockChampions: Record<string, string> = {
      UEFA: 'UEL_MAN_CITY',      // Campeão da Champions League
      CONMEBOL: 'BRA_PALMEIRAS', // Campeão da Libertadores
      CONCACAF: 'MEX_CLUB_AMERICA', // Campeão da CONCACAF Champions Cup
      AFC: 'KOR_ULSAN_HYUNDAI',  // Campeão da AFC Champions League
      CAF: 'EGY_AL_AHLY',        // Campeão da CAF Champions League
      OFC: 'NZL_AUCKLAND_CITY'   // Campeão da OFC Champions League
    };

    it('deve gerar todas as fases da Intercontinental quando todos os campeões estão presentes', () => {
      const result: IntercontinentalTournamentState = generateIntercontinentalBracket(mockChampions);

      expect(result.matches).toHaveLength(5); // 5 partidas: 2 Playoffs AF/ASIA/OFC, Dérbi das Américas, Challenger, Final
      expect(result.currentPhase).toBe('PLAYOFF_AF_ASIA_PACIFIC');
      expect(result.isCompleted).toBe(false);

      // Verificar Fase 1: Playoff África-Ásia-Pacífico
      const afAsiaMatch1 = result.matches.find(m =>
        m.phase === 'PLAYOFF_AF_ASIA_PACIFIC' &&
        m.homeTeam === mockChampions.AFC &&
        m.awayTeam === mockChampions.OFC
      );
      expect(afAsiaMatch1).toBeDefined();
      expect(afAsiaMatch1?.isKnockout).toBe(true);
      expect(afAsiaMatch1?.neutralVenue).toBe(false);

      const afAsiaMatch2 = result.matches.find(m =>
        m.phase === 'PLAYOFF_AF_ASIA_PACIFIC' &&
        m.homeTeam === mockChampions.CAF &&
        m.awayTeam?.startsWith('TBD_')
      );
      expect(afAsiaMatch2).toBeDefined();
      expect(afAsiaMatch2?.isKnockout).toBe(true);
      expect(afAsiaMatch2?.neutralVenue).toBe(false);

      // Verificar Fase 2: Dérbi das Américas
      const derbiMatch = result.matches.find(m =>
        m.phase === 'DERBI_DAS_AMERICAS' &&
        m.homeTeam === mockChampions.CONMEBOL &&
        m.awayTeam === mockChampions.CONCACAF
      );
      expect(derbiMatch).toBeDefined();
      expect(derbiMatch?.isKnockout).toBe(true);
      expect(derbiMatch?.neutralVenue).toBe(false);

      // Verificar Fase 3: Copa Challenger
      const challengerMatch = result.matches.find(m =>
        m.phase === 'COPA_CHALLENGER' &&
        m.awayTeam?.startsWith('TBD_derbi_americas_winner')
      );
      expect(challengerMatch).toBeDefined();
      expect(challengerMatch?.isKnockout).toBe(true);
      expect(challengerMatch?.neutralVenue).toBe(false);

      // Verificar Fase 4: Grande Final
      const finalMatch = result.matches.find(m =>
        m.phase === 'GRANDE_FINAL' &&
        m.awayTeam === mockChampions.UEFA &&
        m.neutralVenue === true
      );
      expect(finalMatch).toBeDefined();
      expect(finalMatch?.isKnockout).toBe(true);
      expect(finalMatch?.neutralVenue).toBe(true);
    });

    it('deve lidar com campeões ausentes corretamente', () => {
      // Teste sem campeão da OFC
      const championsWithoutOFC = { ...mockChampions };
      delete championsWithoutOFC.OFC;

      const result: IntercontinentalTournamentState = generateIntercontinentalBracket(championsWithoutOFC);

      // Deve ter menos partidas pois não podemos fazer OFC vs AFC
      expect(result.matches.length).toBeLessThan(4);

      // Deve ainda ter o Dérbi das Américas se tivermos CONMEBOL e CONCACAF
      const derbiMatch = result.matches.find(m =>
        m.phase === 'DERBI_DAS_AMERICAS'
      );
      expect(derbiMatch).toBeDefined();

      // Teste sem campeões essenciais (UEFA, CONMEBOL, CONCACAF)
      const minimalChampions = {
        UEFA: mockChampions.UEFA
      };

      const minimalResult: IntercontinentalTournamentState = generateIntercontinentalBracket(minimalChampions);
      expect(minimalResult.matches.length).toBe(0);
      expect(minimalResult.currentPhase).toBe('PLAYOFF_AF_ASIA_PACIFIC');
      expect(minimalResult.isCompleted).toBe(false);
    });

    it('deve retornar estado vazio quando não houver campeões essenciais', () => {
      const emptyChampions: Record<string, string> = {};
      const result: IntercontinentalTournamentState = generateIntercontinentalBracket(emptyChampions);

      expect(result.matches).toHaveLength(0);
      expect(result.currentPhase).toBe('PLAYOFF_AF_ASIA_PACIFIC');
      expect(result.isCompleted).toBe(false);
      expect(result.champion).toBeUndefined();
    });
  });

  describe('generateSuperClubWorldCup', () => {
    const mockQualifiedClubs = Array.from({length: 32}, (_, i) => `CLUB_${i + 1}`);

    it('deve gerar exatamente 32 clubes em 8 grupos de 4', () => {
      const result: SuperWorldCupState = generateSuperClubWorldCup(mockQualifiedClubs, 12345); // Seed fixo

      // Verificar se temos 8 grupos
      expect(Object.keys(result.groups)).toHaveLength(8);

      // Verificar se cada grupo tem exatamente 4 clubes
      for (const group of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        expect(result.groups[group]).toHaveLength(4);

        // Verificar se todos os clubes são únicos (não há duplicatas entre grupos)
        const allTeams = Object.values(result.groups).flat();
        const uniqueTeams = new Set(allTeams);
        expect(uniqueTeams.size).toBe(32);
      }

      // Verificar se temos o número correto de partidas da fase de grupos
      // Cada grupo de 4 times tem 6 partidas (4 escolhe 2)
      const groupStageMatches = result.matches.filter(m => m.phase === 'GROUP_STAGE');
      expect(groupStageMatches.length).toBe(8 * 6); // 8 grupos * 6 partidas cada = 48 partidas

      // Verificar estado inicial
      expect(result.currentPhase).toBe('GROUP_STAGE');
      expect(result.isCompleted).toBe(false);
      expect(result.champion).toBeUndefined();

      // Verificar classificações iniciais (zeradas)
      for (const group of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
        const groupStandings = result.standings[group];
        expect(groupStandings).toHaveLength(4);

        for (const standing of groupStandings) {
          expect(standing.points).toBe(0);
          expect(standing.gamesPlayed).toBe(0);
          expect(standing.goalsFor).toBe(0);
          expect(standing.goalsAgainst).toBe(0);
          expect(standing.goalDifference).toBe(0);
        }
      }
    });

    it('deve lançar erro quando o número de clubes não for 32', () => {
      // Teste com 31 clubes
      expect(() => generateSuperClubWorldCup(Array.from({length: 31}, (_, i) => `CLUB_${i + 1}`)))
        .toThrow('Super Mundial requer exatamente 32 clubes classificados');

      // Teste com 33 clubes
      expect(() => generateSuperClubWorldCup(Array.from({length: 33}, (_, i) => `CLUB_${i + 1}`)))
        .toThrow('Super Mundial requer exatamente 32 clubes classificados');

      // Teste com 0 clubes
      expect(() => generateSuperClubWorldCup([]))
        .toThrow('Super Mundial requer exatamente 32 clubes classificados');
    });

    it('deve usar seed para gerar sorteios reproduzíveis', () => {
      const seed = 999;
      const result1 = generateSuperClubWorldCup(mockQualifiedClubs, seed);
      const result2 = generateSuperClubWorldCup(mockQualifiedClubs, seed);

      // Os grupos devem ser idênticos com o mesmo seed
      expect(result1.groups).toEqual(result2.groups);

      // Mas diferentes com seeds diferentes
      const result3 = generateSuperClubWorldCup(mockQualifiedClubs, 888);
      expect(result1.groups).not.toEqual(result3.groups);
    });
  });

  describe('calculateClubWorldCupRankingPoints', () => {
    it('deve calcular pontos corretamente baseado na fórmula', () => {
      // Teste com valores zero
      expect(calculateClubWorldCupRankingPoints({
        continentalTournamentWins: 0,
        continentalTournamentFinals: 0,
        continentalTournamentSemis: 0,
        nationalLeaguePoints: 0
      })).toBe(0);

      // Teste com vitórias continentais
      expect(calculateClubWorldCupRankingPoints({
        continentalTournamentWins: 2,
        continentalTournamentFinals: 0,
        continentalTournamentSemis: 0,
        nationalLeaguePoints: 0
      })).toBe(200); // 2 * 100

      // Teste com finais continentais
      expect(calculateClubWorldCupRankingPoints({
        continentalTournamentWins: 0,
        continentalTournamentFinals: 3,
        continentalTournamentSemis: 0,
        nationalLeaguePoints: 0
      })).toBe(150); // 3 * 50

      // Teste com semifinais continentais
      expect(calculateClubWorldCupRankingPoints({
        continentalTournamentWins: 0,
        continentalTournamentFinals: 0,
        continentalTournamentSemis: 4,
        nationalLeaguePoints: 0
      })).toBe(100); // 4 * 25

      // Teste com pontos nacionais
      expect(calculateClubWorldCupRankingPoints({
        continentalTournamentWins: 0,
        continentalTournamentFinals: 0,
        continentalTournamentSemis: 0,
        nationalLeaguePoints: 2500
      })).toBe(25); // 2500 / 100

      // Teste misto
      expect(calculateClubWorldCupRankingPoints({
        continentalTournamentWins: 1,
        continentalTournamentFinals: 2,
        continentalTournamentSemis: 1,
        nationalLeaguePoints: 1500
      })).toBe(100 + 100 + 25 + 15); // 1*100 + 2*50 + 1*25 + 1500/100 = 240
    });

    it('deve lidar com valores negativos (embora não devessem ocorrer na prática)', () => {
      expect(calculateClubWorldCupRankingPoints({
        continentalTournamentWins: -1,
        continentalTournamentFinals: 0,
        continentalTournamentSemis: 0,
        nationalLeaguePoints: 0
      })).toBe(-100);
    });
  });
});
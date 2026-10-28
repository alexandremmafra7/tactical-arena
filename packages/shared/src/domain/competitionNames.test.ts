import { describe, expect, it } from 'vitest';
import { leagueName, cupName, countryName } from './competitionNames.js';

/**
 * As competições dizem o nome delas, não a sigla do arquivo.
 *
 * Esta tabela vivia dentro do `leagueService`, no servidor, cobrindo oito países. O modo offline não alcança
 * o servidor, então montava o nome sozinho e escrevia o código: o jogador via "RODADA 1 • SÉRIE A - BRA" no
 * topo da tela do clube e "Copa Nacional (BRA)" na agenda. Sigla de arquivo não é nome de campeonato.
 */
describe('nomes de competição', () => {
  it('usa o nome de verdade onde ele existe', () => {
    expect(leagueName('BRA', 1)).toBe('Brasileirão Série A');
    expect(leagueName('BRA', 2)).toBe('Brasileirão Série B');
    expect(leagueName('ENG', 1)).toBe('Premier League');
    expect(leagueName('ESP', 1)).toBe('LaLiga');
    expect(cupName('BRA')).toBe('Copa do Brasil');
    expect(cupName('ENG')).toBe('FA Cup');
  });

  it('nunca escreve o código do país na tela', () => {
    /**
     * A regressão que isto guarda. São 51 países jogáveis e a tabela nomeia menos que isso, então o que
     * importa não é a tabela estar completa, e sim o que sai quando ela não tem a resposta.
     */
    for (const code of ['BRA', 'POL', 'NZL', 'KAZ', 'CYP', 'SVN', 'BLR', 'ISR', 'CHI', 'URU']) {
      for (const nome of [leagueName(code, 1), leagueName(code, 2), cupName(code)]) {
        expect(nome, `${code} vazou a sigla em "${nome}"`).not.toContain(code);
        expect(nome.trim().length).toBeGreaterThan(3);
      }
    }
  });

  it('concorda o artigo com o nome do país', () => {
    // Sem isto sai "Copa da Cazaquistão" e "Liga da Paraguai", que erra em quinze dos cinquenta e um.
    expect(cupName('KAZ')).toBe('Copa do Cazaquistão');
    expect(leagueName('KAZ', 2)).toContain('do Cazaquistão');
    expect(cupName('POL')).toBe('Copa da Polônia');
    expect(cupName('ISR')).toBe('Copa de Israel');
  });

  it('não usa travessão, que a casa não usa', () => {
    // O nome montado dizia "Liga de X — Divisão 2". A regra vale para todo texto que o jogador lê.
    for (const code of ['POL', 'NZL', 'CYP', 'BLR', 'SVN']) {
      for (const nome of [leagueName(code, 1), leagueName(code, 2), cupName(code)]) {
        expect(nome).not.toMatch(/[—–]/);
        expect(nome).not.toContain(' & ');
      }
    }
  });

  it('devolve o país por extenso, e o código quando não conhece', () => {
    expect(countryName('BRA')).toBe('Brasil');
    expect(countryName('ZZZ')).toBe('ZZZ');
  });
});

import { describe, it, expect } from 'vitest';
import { ATTACK_STYLE_MODIFIERS } from '../domain/tactic.js';
import {
  NEUTRAL_WEATHER,
  weatherAttackFactor,
  weatherFactors,
  weatherFor,
  type MatchWeather,
} from './weather.js';

describe('multiplicadores do tempo', () => {
  it('tempo seco não mexe em nada, que é o baseline da calibragem', () => {
    expect(weatherFactors('DRY')).toEqual(NEUTRAL_WEATHER);
    expect(weatherFactors()).toEqual(NEUTRAL_WEATHER);
  });

  it('mantém os efeitos pequenos: o clima inclina a partida, não decide por ela', () => {
    for (const tempo of ['RAIN', 'HOT'] as MatchWeather[]) {
      const f = weatherFactors(tempo);
      for (const valor of [f.passing, f.pace, f.goal, f.fatigue]) {
        expect(Math.abs(valor - 1)).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it('separa os assuntos: chuva mexe no jogo, calor mexe nas pernas', () => {
    const chuva = weatherFactors('RAIN');
    const calor = weatherFactors('HOT');

    expect(chuva.passing).toBeLessThan(1);
    expect(chuva.pace).toBeGreaterThan(1);
    expect(chuva.fatigue).toBe(1);

    expect(calor.fatigue).toBeGreaterThan(1);
    expect(calor.passing).toBe(1);
    expect(calor.pace).toBe(1);
  });
});

describe('o preço do estilo no campo pesado', () => {
  /**
   * O ponto da mecânica inteira. Não é penalidade fixa: a chuva reprecifica passe e velocidade, e a
   * mistura de cada estilo decide quanto ele perde. Se isso deixar de valer, o clima vira dado viciado.
   */
  it('castiga o jogo por dentro mais que o jogo pelas pontas', () => {
    const chuva = weatherFactors('RAIN');
    const porDentro = weatherAttackFactor(ATTACK_STYLE_MODIFIERS.THROUGH_MIDDLE, chuva);
    const equilibrado = weatherAttackFactor(ATTACK_STYLE_MODIFIERS.BALANCED, chuva);
    const pelasPontas = weatherAttackFactor(ATTACK_STYLE_MODIFIERS.WINGS, chuva);

    expect(porDentro).toBeLessThan(equilibrado);
    expect(equilibrado).toBeLessThan(pelasPontas);
    // E o jogo pelas pontas realmente ganha alguma coisa, em vez de só perder menos.
    expect(pelasPontas).toBeGreaterThan(1);
  });

  it('não mexe em estilo nenhum quando está seco ou quente', () => {
    for (const tempo of ['DRY', 'HOT'] as MatchWeather[]) {
      for (const estilo of Object.values(ATTACK_STYLE_MODIFIERS)) {
        expect(weatherAttackFactor(estilo, weatherFactors(tempo))).toBeCloseTo(1, 10);
      }
    }
  });
});

describe('que tempo faz no dia do jogo', () => {
  it('devolve sempre o mesmo tempo para a mesma partida', () => {
    const primeira = weatherFor('2026-01-18', 'SOUTH_AMERICA', 'match-1');
    for (let i = 0; i < 20; i++) {
      expect(weatherFor('2026-01-18', 'SOUTH_AMERICA', 'match-1')).toBe(primeira);
    }
  });

  it('dá tempo seco quando não se sabe a data, em vez de inventar uma', () => {
    expect(weatherFor(null, 'SOUTH_AMERICA', 'match-1')).toBe('DRY');
    expect(weatherFor('data-torta', 'EUROPE', 'match-1')).toBe('DRY');
  });

  /** Conta quantos de N jogos de um mês pegam cada tempo, variando só o id da partida. */
  function distribuicao(mes: string, continente: Parameters<typeof weatherFor>[1], n = 400) {
    const conta: Record<MatchWeather, number> = { DRY: 0, RAIN: 0, HOT: 0 };
    for (let i = 0; i < n; i++) conta[weatherFor(`2026-${mes}-15`, continente, `m${i}`)]++;
    return conta;
  }

  it('chove no verão brasileiro e não em julho', () => {
    const janeiro = distribuicao('01', 'SOUTH_AMERICA');
    const julho = distribuicao('07', 'SOUTH_AMERICA');
    expect(janeiro.RAIN).toBeGreaterThan(julho.RAIN * 2);
  });

  it('inverte o calendário no hemisfério norte, porque lá o verão é julho', () => {
    const janeiroEuropa = distribuicao('01', 'EUROPE');
    const julhoEuropa = distribuicao('07', 'EUROPE');
    expect(julhoEuropa.HOT).toBeGreaterThan(janeiroEuropa.HOT);
    expect(janeiroEuropa.RAIN).toBeGreaterThan(julhoEuropa.RAIN);
  });

  it('deixa a maioria dos jogos em tempo seco, em qualquer mês', () => {
    for (const mes of ['01', '04', '07', '10']) {
      for (const continente of ['SOUTH_AMERICA', 'EUROPE'] as const) {
        const { DRY } = distribuicao(mes, continente);
        expect(DRY).toBeGreaterThan(200);
      }
    }
  });
});

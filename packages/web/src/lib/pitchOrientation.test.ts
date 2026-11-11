import { describe, expect, it } from 'vitest';
import { attacksRight, eventPeriod, mirrorPoint } from './pitchOrientation.js';

describe('pitchOrientation', () => {
  it('1º tempo: mandante ataca para a direita, visitante para a esquerda', () => {
    expect(attacksRight('home', '1T')).toBe(true);
    expect(attacksRight('away', '1T')).toBe(false);
  });

  it('2º tempo: os times trocam de lado', () => {
    expect(attacksRight('home', '2T')).toBe(false);
    expect(attacksRight('away', '2T')).toBe(true);
  });

  it('os dois times nunca atacam para o mesmo lado', () => {
    for (const period of ['1T', '2T'] as const) {
      expect(attacksRight('home', period)).not.toBe(attacksRight('away', period));
    }
  });

  it('evento: o period do próprio evento vale mais que o minuto', () => {
    expect(eventPeriod({ period: '1T', minute: 47 })).toBe('1T');
    expect(eventPeriod({ period: '2T', minute: 46 })).toBe('2T');
  });

  it('evento sem period: decide pelo minuto', () => {
    expect(eventPeriod({ minute: 45 })).toBe('1T');
    expect(eventPeriod({ minute: 46 })).toBe('2T');
  });

  it('espelhar duas vezes devolve o ponto original e preserva campos extras', () => {
    const p = { x: 18, y: 12, tag: 'lb' };
    const m = mirrorPoint(p);
    expect(m).toEqual({ x: 82, y: 48, tag: 'lb' });
    expect(mirrorPoint(m)).toEqual(p);
  });
});

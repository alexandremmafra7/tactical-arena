import { describe, it, expect } from 'vitest';
import { buildPressingReport } from './match.js';

describe('buildPressingReport', () => {
  it('reports zero recoveries plainly, with no goals clause', () => {
    const text = buildPressingReport('HIGH_PRESS', { pressRecoveries: 0, goalsFromPressRecovery: 0 });
    expect(text).toBe('Sua pressão alta não recuperou bolas no campo ofensivo nesta partida.');
  });

  it('reports recoveries without a goals clause when none led to a goal', () => {
    const text = buildPressingReport('MEDIUM', { pressRecoveries: 5, goalsFromPressRecovery: 0 });
    expect(text).toBe('Sua pressão recuperou 5 bolas no campo ofensivo.');
  });

  it('adds the goals clause once at least one recovery led to a goal', () => {
    const text = buildPressingReport('HIGH_PRESS', { pressRecoveries: 8, goalsFromPressRecovery: 2 });
    expect(text).toBe('Sua pressão alta recuperou 8 bolas no campo ofensivo, resultando em 2 gols.');
  });

  it('uses singular wording for exactly one recovery and one goal', () => {
    const text = buildPressingReport('LOW_BLOCK', { pressRecoveries: 1, goalsFromPressRecovery: 1 });
    expect(text).toBe('Sua pressão baixa recuperou 1 bola no campo ofensivo, resultando em 1 gol.');
  });

  it('never contains an em dash, en dash, or ampersand (house style for user-facing copy)', () => {
    const samples = [
      buildPressingReport('HIGH_PRESS', { pressRecoveries: 0, goalsFromPressRecovery: 0 }),
      buildPressingReport('MEDIUM', { pressRecoveries: 5, goalsFromPressRecovery: 0 }),
      buildPressingReport('LOW_BLOCK', { pressRecoveries: 8, goalsFromPressRecovery: 2 }),
    ];
    for (const text of samples) {
      expect(text).not.toMatch(/[—–&]/);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { runTacticalBenchmark } from './benchmarkRunner.js';

describe('Monte Carlo Tactical Engine Benchmark (Vitest Suite)', () => {
  it('calibra 200 partidas dentro das metas UEFA/FIFA sem anomalias', () => {
    const N = 200;
    const m = runTacticalBenchmark(N);

    const avgGoals = m.totalGoals / N;
    const homeWinRate = m.homeWins / N;
    const drawRate = m.draws / N;

    // Metas de Calibração (Fase 4 / Master Plan)
    // Gols médios: entre 2.30 e 3.10
    expect(avgGoals).toBeGreaterThanOrEqual(2.30);
    expect(avgGoals).toBeLessThanOrEqual(3.10);

    // Mandante competitivo (mando de campo saudável): entre 38% e 52%
    expect(homeWinRate).toBeGreaterThanOrEqual(0.38);
    expect(homeWinRate).toBeLessThanOrEqual(0.52);

    // Empates consistentes: entre 18% e 32%
    expect(drawRate).toBeGreaterThanOrEqual(0.18);
    expect(drawRate).toBeLessThanOrEqual(0.32);

    // Pressão Alta recupera mais bolas que Bloco Baixo no campo ofensivo
    if (m.highPressMatches > 0 && m.lowBlockMatches > 0) {
      const highPressAvg = m.highPressRecoveries / m.highPressMatches;
      const lowBlockAvg = m.lowBlockRecoveries / m.lowBlockMatches;
      expect(highPressAvg).toBeGreaterThan(lowBlockAvg);
    }
  });
});

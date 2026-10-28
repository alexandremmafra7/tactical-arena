import { describe, it, expect } from 'vitest';
import { simulateMatch, makeClub, makeTactic } from '@tactical-arena/shared';

describe('Massive Stress Tests & Chaos Engineering', () => {
  it('simulates 50 consecutive matches without memory heap spikes or NaN/Infinity xG', () => {
    const home = makeClub('h1', 'Mandante FC', 75);
    const away = makeClub('a1', 'Visitante FC', 72);
    const homeTactic = makeTactic(home);
    const awayTactic = makeTactic(away);

    const initialHeap = process.memoryUsage().heapUsed;

    for (let i = 0; i < 50; i++) {
      const res = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `match-stress-${i}`,
      });
      expect(res.homeGoals).toBeGreaterThanOrEqual(0);
      expect(res.awayGoals).toBeGreaterThanOrEqual(0);
      expect(res.stats.home.xg).not.toBeNaN();
      expect(res.stats.away.xg).not.toBeNaN();
      expect(Number.isFinite(res.stats.home.xg)).toBe(true);
    }

    const finalHeap = process.memoryUsage().heapUsed;
    const diffMb = (finalHeap - initialHeap) / (1024 * 1024);
    // Heap growth should remain bounded under 40MB after 50 simulations
    expect(diffMb).toBeLessThan(40);
  });
});

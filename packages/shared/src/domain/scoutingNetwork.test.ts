import { describe, it, expect } from 'vitest';
import { maskPlayerAttributes, generateScoutReport } from './scoutingNetwork.js';
import type { Player } from './player.js';

describe('Scouting Network & Fog of War Domain', () => {
  const mockPlayer: Player = {
    id: 'p1',
    name: 'Jovem Promessa',
    position: 'MID',
    overall: 72,
    age: 19,
    potential: 86,
    marketValue: 3_000_000,
    attributes: { pace: 75, finishing: 68, passing: 78, defending: 65, physical: 70, goalkeeping: 10 },
  } as unknown as Player;

  it('masks player attributes accurately based on knowledge level', () => {
    const revealed = maskPlayerAttributes(mockPlayer, 'REVEALED');
    expect(revealed.overall.isExact).toBe(true);
    expect(revealed.overall.min).toBe(72);

    const partial = maskPlayerAttributes(mockPlayer, 'PARTIAL');
    expect(partial.overall.isExact).toBe(false);
    expect(partial.overall.min).toBeLessThanOrEqual(72);
    expect(partial.overall.max).toBeGreaterThanOrEqual(72);

    const unknown = maskPlayerAttributes(mockPlayer, 'UNKNOWN');
    expect(unknown.overall.isExact).toBe(false);
    expect(unknown.overall.min).toBeLessThanOrEqual(72);
  });

  it('generates accurate scout reports including hidden gem classification', () => {
    const report = generateScoutReport(mockPlayer);
    expect(report.grade).toBe('HIDDEN_GEM');
    expect(report.summary).toContain('JOIA OCULTA');
    expect(report.potentialEstimate.min).toBeGreaterThanOrEqual(83);
  });
});

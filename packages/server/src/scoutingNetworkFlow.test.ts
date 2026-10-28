import { describe, it, expect } from 'vitest';
import { maskPlayerAttributes, generateScoutReport } from '@tactical-arena/shared';
import type { Player } from '@tactical-arena/shared';

describe('Scouting Network & Fog of War Backend Flow', () => {
  const samplePlayer: Player = {
    id: 'sp1',
    name: 'Estrela Distante',
    position: 'ATT',
    overall: 75,
    age: 20,
    potential: 89,
    marketValue: 8_000_000,
  } as unknown as Player;

  it('applies unknown Fog of War mask correctly', () => {
    const masked = maskPlayerAttributes(samplePlayer, 'UNKNOWN');
    expect(masked.overall.isExact).toBe(false);
    expect(masked.overall.min).toBeLessThanOrEqual(75);
    expect(masked.overall.max).toBeGreaterThanOrEqual(75);
  });

  it('generates high quality scout report for hidden gems', () => {
    const report = generateScoutReport(samplePlayer);
    expect(report.grade).toBe('HIDDEN_GEM');
    expect(report.playerName).toBe('Estrela Distante');
  });
});

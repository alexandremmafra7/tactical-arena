import { describe, it, expect } from 'vitest';
import { calculateClubVisibility, getVisibilityTier } from './clubVisibility.js';
import { makeClub } from '../simulation/testFactories.js';

describe('clubVisibility domain model', () => {
  it('calculates higher visibility for clubs with star players, bigger stadiums and trophy history', () => {
    const powerhouse = makeClub('powerhouse', 'Powerhouse FC', 86, { starLevel: 'DEVELOPED' });
    powerhouse.stadiumCapacity = 80_000;

    const modestClub = makeClub('modest', 'Modest FC', 62);
    modestClub.stadiumCapacity = 8_000;

    const visPower = calculateClubVisibility(powerhouse, 1, 4, 100_000);
    const visModest = calculateClubVisibility(modestClub, 2, 0, 5_000);

    expect(visPower.score).toBeGreaterThan(70);
    expect(['CONTINENTAL', 'GLOBAL']).toContain(visPower.tier);
    expect(visPower.tvRevenueMultiplier).toBeGreaterThan(1.5);

    expect(visModest.score).toBeLessThan(50);
    expect(visModest.tier).toMatch(/LOCAL|REGIONAL/);
  });

  it('correctly maps scores to visibility tiers and open broadcast chances', () => {
    const globalTier = getVisibilityTier(92);
    expect(globalTier.tier).toBe('GLOBAL');
    expect(globalTier.openChance).toBeGreaterThanOrEqual(0.8);

    const regionalTier = getVisibilityTier(35);
    expect(regionalTier.tier).toBe('REGIONAL');
    expect(regionalTier.tvMultiplier).toBe(1.1);
  });
});

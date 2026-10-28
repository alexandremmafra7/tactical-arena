import { describe, it, expect } from 'vitest';
import { getClubCrestTheme } from './clubCrest.js';

describe('getClubCrestTheme', () => {
  it('is deterministic: the same club id always yields the same theme', () => {
    const club = { id: 'club-123', name: 'Testador FC' };
    expect(getClubCrestTheme(club)).toEqual(getClubCrestTheme({ ...club }));
  });

  it('derives initials from up to the first two words of the name', () => {
    expect(getClubCrestTheme({ id: 'a', name: 'Testador FC' }).initials).toBe('TF');
    expect(getClubCrestTheme({ id: 'b', name: 'Flamengo' }).initials).toBe('FL');
  });

  it('produces different hues for most different club ids', () => {
    const hues = new Set(Array.from({ length: 20 }, (_, i) => getClubCrestTheme({ id: `club-${i}`, name: 'X' }).hue));
    expect(hues.size).toBeGreaterThan(10);
  });

  it('always returns a hue within 0-359', () => {
    for (let i = 0; i < 50; i++) {
      const { hue } = getClubCrestTheme({ id: `seed-${i}`, name: 'Club' });
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

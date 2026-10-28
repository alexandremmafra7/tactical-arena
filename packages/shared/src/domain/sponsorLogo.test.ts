import { describe, it, expect } from 'vitest';
import { getSponsorLogoTheme } from './sponsorLogo.js';

describe('getSponsorLogoTheme', () => {
  it('is deterministic: the same sponsor name always yields the same theme', () => {
    expect(getSponsorLogoTheme('Banco Meridian Global', 'MASTER')).toEqual(getSponsorLogoTheme('Banco Meridian Global', 'MASTER'));
  });

  it('derives initials from up to the first two words of the name', () => {
    expect(getSponsorLogoTheme('Banco Meridian Global', 'MASTER').initials).toBe('BM');
    expect(getSponsorLogoTheme('RotaVetor', 'TECH_EQUIPMENT').initials).toBe('RO');
  });

  it('gives each sponsorship type its own distinct shape', () => {
    const shapes = new Set(
      (['MASTER', 'KIT_SUPPLIER', 'STADIUM_NAMING', 'REGIONAL', 'TECH_EQUIPMENT'] as const).map(
        (type) => getSponsorLogoTheme('Same Name', type).shape,
      ),
    );
    expect(shapes.size).toBe(5);
  });

  it('produces different hues for most different sponsor names', () => {
    const hues = new Set(Array.from({ length: 20 }, (_, i) => getSponsorLogoTheme(`Sponsor ${i}`, 'MASTER').hue));
    expect(hues.size).toBeGreaterThan(10);
  });
});

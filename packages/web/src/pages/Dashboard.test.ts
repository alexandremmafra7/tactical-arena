import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashSource = readFileSync(join(__dirname, 'Dashboard.tsx'), 'utf-8');

describe('Dashboard source contract', () => {
  it('contains no career-creation state or API calls', () => {
    expect(dashSource).not.toContain('gameMode');
    expect(dashSource).not.toContain('foundable');
    expect(dashSource).not.toContain('playableCountries');
    expect(dashSource).not.toContain('pickCountry');
    expect(dashSource).not.toContain('pickDivision');
    expect(dashSource).not.toContain('availableClubs');
    expect(dashSource).not.toContain('currentManager');
    expect(dashSource).not.toContain('listFoundableCountries(');
    expect(dashSource).not.toContain('listPlayableCountries(');
    expect(dashSource).not.toContain('listAvailableClubs(');
    expect(dashSource).not.toContain('claimClub(');
    expect(dashSource).not.toContain('foundClub(');
    expect(dashSource).not.toContain('OnboardingWizard');
  });
});

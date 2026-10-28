import { describe, expect, it } from 'vitest';
import { Player } from './player.js';
import { autoShieldSquadReleaseClauses, calculateAdjustedWageForReleaseClause } from './releaseClauseManager.js';
import { makePlayer } from '../simulation/testFactories.js';

function createMockPlayer(partial: Partial<Player>): Player {
  return makePlayer(partial.id ?? 'p-1', {
    name: 'Endrick',
    position: 'ATT',
    preferredFoot: 'LEFT',
    age: 18,
    overall: 78,
    potential: 94,
    starLevel: 'NATURAL',
    marketValue: 20_000_000,
    releaseClause: 32_000_000,
    wage: 50_000,
    ...partial,
  });
}

describe('Release Clause Manager & Auto Shielding', () => {
  it('calculates higher wage compensation for elevated release clauses', () => {
    const player = createMockPlayer({ marketValue: 10_000_000, wage: 30_000 });
    // Default clause is 1.6x = 16M. Setting to 48M (4.8x) demands ~20-25% wage bump
    const newClause = 48_000_000;
    const adjustedWage = calculateAdjustedWageForReleaseClause(player, newClause);

    expect(adjustedWage).toBeGreaterThan(player.wage);
    expect(adjustedWage).toBeLessThanOrEqual(Math.round(player.wage * 1.5));
  });

  it('applies director discount on wage increases for high clauses', () => {
    const player = createMockPlayer({ marketValue: 10_000_000, wage: 30_000 });
    const newClause = 50_000_000;

    const wageWithoutDirector = calculateAdjustedWageForReleaseClause(player, newClause);
    const wageWithEliteDirector = calculateAdjustedWageForReleaseClause(player, newClause, 95);

    expect(wageWithEliteDirector).toBeLessThan(wageWithoutDirector);
  });

  it('automatically applies tiered super-clauses across squad profiles', () => {
    const youngProdigy = createMockPlayer({ id: 'p-gem', name: 'Estêvão', age: 17, overall: 76, potential: 92, starLevel: 'NATURAL', marketValue: 15_000_000 });
    const primeStar = createMockPlayer({ id: 'p-star', name: 'Arrascaeta', age: 29, overall: 84, marketValue: 25_000_000 });
    const rotationPlayer = createMockPlayer({ id: 'p-rot', name: 'Reserva', age: 26, overall: 70, potential: 70, starLevel: 'NONE', marketValue: 2_000_000 });

    const results = autoShieldSquadReleaseClauses([youngProdigy, primeStar, rotationPlayer]);

    const gemResult = results.find((r) => r.playerId === 'p-gem')!;
    const starResult = results.find((r) => r.playerId === 'p-star')!;
    const rotResult = results.find((r) => r.playerId === 'p-rot')!;

    // Young prodigy receives >= 7.0x clause multiplier
    expect(gemResult.multiplier).toBeGreaterThanOrEqual(7.0);
    expect(gemResult.categoryLabel).toContain('Joia da Base');

    // Star receives >= 5.0x clause multiplier
    expect(starResult.multiplier).toBeGreaterThanOrEqual(5.0);
    expect(starResult.categoryLabel).toContain('Estrela');

    // Rotation receives standard ~2.2x
    expect(rotResult.multiplier).toBeLessThanOrEqual(3.0);
  });
});

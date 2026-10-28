import { describe, expect, it } from 'vitest';
import {
  CONTINGENCY_FORMATIONS,
  FORMATION_POSITIONS,
  STANDARD_FORMATIONS,
  isContingencyFormation,
} from '../domain/tactic.js';
import { makeClub } from './testFactories.js';
import { computeTeamStrength, positionMismatchFactor, resolveLineupPlayers } from './teamStrength.js';

describe('Contingency and Modern Formations', () => {
  it('defines valid slot lengths and positions for all standard and contingency formations', () => {
    for (const f of STANDARD_FORMATIONS) {
      expect(FORMATION_POSITIONS[f].length).toBe(11);
      expect(FORMATION_POSITIONS[f][0]).toBe('GK');
    }

    for (const f of CONTINGENCY_FORMATIONS) {
      expect(FORMATION_POSITIONS[f].length).toBe(10);
      expect(FORMATION_POSITIONS[f][0]).toBe('GK');
      expect(isContingencyFormation(f)).toBe(true);
    }
  });

  it('correctly resolves and computes strength for a 10-player contingency formation (4-4-1)', () => {
    const club = makeClub('club-1', 'Botafogo', 75);
    const tenPlayers = club.players.slice(0, 10);

    const tactic = {
      clubId: club.id,
      formation: '4-4-1' as const,
      mentality: 'balanced' as const,
      attackStyle: 'BALANCED' as const,
      markingStyle: 'BALANCED' as const,
      attackApproach: 'BALANCED' as const,
      lineup: tenPlayers.map((p) => ({ playerId: p.id })),
      substitutes: [],
      plannedSubstitutions: [],
    };

    const resolved = resolveLineupPlayers(club, tactic);
    expect(resolved.length).toBe(10);

    const strength = computeTeamStrength(club, tactic);
    expect(strength.missingPlayers).toBe(1);
    expect(strength.attack).toBeGreaterThan(0);
    expect(strength.defense).toBeGreaterThan(0);
  });

  it('calculates positional mismatch penalty accurately', () => {
    // Natural match -> 1.0 (100%)
    expect(positionMismatchFactor('ATT', 'ATT')).toBeCloseTo(1.0);
    expect(positionMismatchFactor('DEF', 'DEF')).toBeCloseTo(1.0);

    // 1 step away (e.g. DEF at LAT or MID at ATT) -> 0.70 (70%)
    expect(positionMismatchFactor('DEF', 'LAT')).toBeCloseTo(0.7);
    expect(positionMismatchFactor('MID', 'ATT')).toBeCloseTo(0.7);

    // 2 steps away (e.g. DEF at MID) -> 0.49 (49%)
    expect(positionMismatchFactor('DEF', 'MID')).toBeCloseTo(0.49);

    // 3 steps away (e.g. DEF at ATT) -> ~0.343
    expect(positionMismatchFactor('DEF', 'ATT')).toBeCloseTo(0.343);
  });
});

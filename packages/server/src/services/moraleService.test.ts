import { describe, it, expect } from 'vitest';
import { Player, Tactic } from '@tactical-arena/shared';
import { applyMoraleAndFatigue } from './moraleService.js';

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    position: 'MID',
    preferredFoot: 'RIGHT',
    age: 26,
    attributes: { pace: 60, finishing: 60, passing: 60, defending: 60, physical: 50, goalkeeping: 10 },
    detailedAttributes: {} as Player['detailedAttributes'],
    morale: 50,
    fatigue: 0,
    commitment: 50,
    overall: 60,
    potential: 60,
    starLevel: 'NONE',
    traits: [],
    functions: [],
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    nationality: 'BRA',
    marketValue: 100_000,
    wage: 1_000,
    releaseClause: 200_000,
    ...overrides,
  };
}

function makeTactic(starters: Player[]): Tactic {
  return {
    clubId: 'club',
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'BALANCED',
    attackApproach: 'COUNTER_ATTACK',
    lineup: starters.map((p) => ({ playerId: p.id })),
    substitutes: [],
    plannedSubstitutions: [],
  };
}

describe('fatigue overload for a short-handed side', () => {
  const starters = Array.from({ length: 11 }, (_, i) => makePlayer(`p${i}`));
  const tactic = makeTactic(starters);

  it('tires the players who stayed on more than a normal match would', () => {
    const normal = applyMoraleAndFatigue(starters, tactic, 0);
    const shortHanded = applyMoraleAndFatigue(starters, tactic, 0, 1.15);

    expect(shortHanded[0].fatigue).toBeGreaterThan(normal[0].fatigue);
    // 15% more ground to cover, 15% more fatigue off the same minutes.
    expect(shortHanded[0].fatigue).toBeCloseTo(normal[0].fatigue * 1.15, 5);
  });

  it('defaults to no surcharge, so a full-strength match is unaffected', () => {
    const explicit = applyMoraleAndFatigue(starters, tactic, 0, 1);
    const defaulted = applyMoraleAndFatigue(starters, tactic, 0);
    expect(defaulted[0].fatigue).toBe(explicit[0].fatigue);
  });

  it('leaves someone who never came off the bench untouched by the surcharge', () => {
    const unused = makePlayer('unused');
    const squad = [...starters, unused];
    const shortHanded = applyMoraleAndFatigue(squad, tactic, 0, 1.5);
    expect(shortHanded.find((p) => p.id === 'unused')!.fatigue).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { calculateShotXg, isBigChance, BASE_XG, BIG_CHANCE_THRESHOLD } from './xg.js';
import { Player } from '../domain/player.js';

function makeTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'test-player',
    name: 'Atacante Teste',
    position: 'ATT',
    preferredFoot: 'RIGHT',
    age: 26,
    attributes: {
      finishing: 75,
      pace: 80,
      passing: 70,
      defending: 40,
      physical: 75,
      goalkeeping: 10,
    },
    detailedAttributes: {} as any,
    morale: 80,
    fatigue: 0,
    commitment: 80,
    marketValue: 1000000,
    overall: 75,
    potential: 80,
    starLevel: 'NONE',
    traits: [],
    functions: ['CENTROAVANTE'],
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    nationality: 'BRA',
    wage: 50000,
    releaseClause: 5000000,
    ...overrides,
  };
}

describe('xg: expected goals calculation model', () => {
  it('penalties have base xG around 0.76 and scale with taker vs keeper skill', () => {
    const taker = makeTestPlayer({ attributes: { finishing: 85, pace: 80, passing: 70, defending: 30, physical: 70, goalkeeping: 10 } });
    const keeper = makeTestPlayer({ position: 'GK', attributes: { goalkeeping: 80, physical: 75, pace: 50, passing: 50, defending: 50, finishing: 10 } });

    const xg = calculateShotXg({ type: 'PENALTY', shooter: taker, keeper });
    expect(xg).toBeGreaterThanOrEqual(0.70);
    expect(xg).toBeLessThanOrEqual(0.90);
    expect(isBigChance(xg)).toBe(true);
  });

  it('one-on-one chances produce high expected goals and qualify as big chances', () => {
    const shooter = makeTestPlayer({ attributes: { finishing: 80, pace: 85, passing: 65, defending: 30, physical: 70, goalkeeping: 10 } });
    const keeper = makeTestPlayer({ position: 'GK', attributes: { goalkeeping: 70, physical: 70, pace: 50, passing: 50, defending: 50, finishing: 10 } });

    const xg = calculateShotXg({ type: 'ONE_ON_ONE', shooter, keeper });
    expect(xg).toBeGreaterThanOrEqual(0.35);
    expect(isBigChance(xg)).toBe(true);
  });

  it('long-range shots have lower xG than inside-box attempts', () => {
    const shooter = makeTestPlayer({ attributes: { finishing: 70, pace: 70, passing: 70, defending: 50, physical: 70, goalkeeping: 10 } });
    const keeper = makeTestPlayer({ position: 'GK', attributes: { goalkeeping: 70, physical: 70, pace: 50, passing: 50, defending: 50, finishing: 10 } });

    const longXg = calculateShotXg({ type: 'LONG_SHOT', shooter, keeper });
    const boxXg = calculateShotXg({ type: 'BOX_SHOT', shooter, keeper });

    expect(longXg).toBeLessThan(boxXg);
    expect(longXg).toBeLessThan(BIG_CHANCE_THRESHOLD);
  });

  it('severe fatigue dampens the expected goals output', () => {
    const freshShooter = makeTestPlayer({ fatigue: 0 });
    const tiredShooter = makeTestPlayer({ fatigue: 95 });
    const keeper = makeTestPlayer({ position: 'GK', attributes: { goalkeeping: 60, physical: 60, pace: 50, passing: 50, defending: 50, finishing: 10 } });

    const freshXg = calculateShotXg({ type: 'BOX_SHOT', shooter: freshShooter, keeper });
    const tiredXg = calculateShotXg({ type: 'BOX_SHOT', shooter: tiredShooter, keeper });

    expect(tiredXg).toBeLessThanOrEqual(freshXg);
  });
});

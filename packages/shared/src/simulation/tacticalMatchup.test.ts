import { describe, it, expect } from 'vitest';
import { tacticalMatchup, type TacticalSetup } from './tacticalMatchup.js';
import { derivePossession, simulateMatch, simulateMatchSegment } from './engine.js';
import { makeClub, makeTactic } from './testFactories.js';
import { createRng } from './rng.js';
import { computeTeamStrength } from './teamStrength.js';
import type { MatchEvent } from '../domain/match.js';
import { defensiveLineOf } from '../domain/tactic.js';

function setup(overrides: Partial<TacticalSetup> = {}): TacticalSetup {
  return {
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'BALANCED',
    markingStyle: 'BALANCED',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    missingPlayers: 0,
    avgFatigue: 0,
    // An ordinary passing side: pressing it is neither punished nor rewarded.
    buildUpQuality: 0.5,
    ...overrides,
  };
}

describe('tactical matchups', () => {
  it('is neutral when both sides pick the plain middle of every dial', () => {
    const effect = tacticalMatchup(setup(), setup());
    expect(effect.chance).toBeCloseTo(1);
    expect(effect.goal).toBeCloseTo(1);
    expect(effect.defense).toBeCloseTo(1);
  });

  it('rewards attacking the flanks of a packed box and punishes going through it', () => {
    const parkedBus = setup({ formation: '5-3-2' });
    const wings = tacticalMatchup(setup({ attackStyle: 'WINGS' }), parkedBus);
    const middle = tacticalMatchup(setup({ attackStyle: 'THROUGH_MIDDLE' }), parkedBus);

    expect(wings.chance).toBeGreaterThan(1);
    expect(middle.chance).toBeLessThan(1);
    expect(wings.chance).toBeGreaterThan(middle.chance);
  });

  it('flips that around against a side that leaves the middle open', () => {
    const open = setup({ formation: '4-3-3' });
    const wings = tacticalMatchup(setup({ attackStyle: 'WINGS' }), open);
    const middle = tacticalMatchup(setup({ attackStyle: 'THROUGH_MIDDLE' }), open);

    expect(middle.chance).toBeGreaterThan(1);
    expect(wings.chance).toBeLessThan(1);
  });

  it('needs the width to play wide — a narrow shape cannot attack the flanks well', () => {
    const opponent = setup();
    const wide = tacticalMatchup(setup({ attackStyle: 'WINGS', formation: '4-3-3' }), opponent);
    const narrow = tacticalMatchup(setup({ attackStyle: 'WINGS', formation: '3-5-2' }), opponent);

    expect(wide.chance).toBeGreaterThan(narrow.chance);
  });

  it('lets a counter-attack feed on the space a committed opponent leaves behind', () => {
    const counter = setup({ attackApproach: 'COUNTER_ATTACK' });
    const versusAllIn = tacticalMatchup(counter, setup({ attackApproach: 'TOTAL_ATTACK', mentality: 'attacking' }));
    const versusLowBlock = tacticalMatchup(counter, setup({ attackApproach: 'COUNTER_ATTACK', mentality: 'defensive' }));

    expect(versusAllIn.goal).toBeGreaterThan(1);
    expect(versusLowBlock.goal).toBeLessThan(1);
  });

  it('finds no space for a siege against a side that has parked', () => {
    const total = setup({ attackApproach: 'TOTAL_ATTACK' });
    const versusOpen = tacticalMatchup(total, setup({ attackApproach: 'TOTAL_ATTACK' }));
    const versusParked = tacticalMatchup(total, setup({ attackApproach: 'COUNTER_ATTACK', mentality: 'defensive' }));

    expect(versusParked.chance).toBeLessThan(versusOpen.chance);
  });

  it('makes man marking good against a playmaker and bad against pace out wide', () => {
    const manMarking = setup({ markingStyle: 'MAN_MARKING' });
    const middle = tacticalMatchup(setup({ attackStyle: 'THROUGH_MIDDLE' }), manMarking);
    const wings = tacticalMatchup(setup({ attackStyle: 'WINGS' }), manMarking);

    expect(middle.chance).toBeLessThan(wings.chance);
  });

  it('never lets a stack of favourable matchups run away with the match', () => {
    const best = tacticalMatchup(
      setup({ attackStyle: 'WINGS', formation: '4-3-3', attackApproach: 'TOTAL_ATTACK', missingPlayers: 3 }),
      setup({ formation: '5-3-2', markingStyle: 'MAN_MARKING', attackApproach: 'TOTAL_ATTACK', mentality: 'attacking' }),
    );
    expect(best.chance).toBeLessThanOrEqual(1.45);
    expect(best.goal).toBeLessThanOrEqual(1.45);
    expect(best.defense).toBeGreaterThanOrEqual(0.65);
  });
});

describe('pressing', () => {
  it('hands a counter-attacking opponent the channel behind a high press', () => {
    const counter = setup({ attackApproach: 'COUNTER_ATTACK' });
    const versusHighPress = tacticalMatchup(counter, setup({ pressing: 'HIGH_PRESS' }));
    const versusLowBlock = tacticalMatchup(counter, setup({ pressing: 'LOW_BLOCK' }));

    expect(versusHighPress.goal).toBeGreaterThan(versusLowBlock.goal);
    expect(versusHighPress.goal).toBeGreaterThan(1);
    expect(versusLowBlock.goal).toBeLessThan(1);
  });

  it('stops working once the legs running it are gone', () => {
    const fresh = tacticalMatchup(setup({ pressing: 'HIGH_PRESS', avgFatigue: 0 }), setup());
    const spent = tacticalMatchup(setup({ pressing: 'HIGH_PRESS', avgFatigue: 95 }), setup());

    // Worst of both worlds: it no longer wins the ball high, and the gaps behind it stay wide open.
    expect(spent.chance).toBeLessThan(fresh.chance);
    expect(spent.defense).toBeLessThan(fresh.defense);
  });

  it('leaves a low block indifferent to how tired it is', () => {
    const fresh = tacticalMatchup(setup({ pressing: 'LOW_BLOCK', avgFatigue: 0 }), setup());
    const spent = tacticalMatchup(setup({ pressing: 'LOW_BLOCK', avgFatigue: 95 }), setup());

    expect(spent.chance).toBeCloseTo(fresh.chance);
    expect(spent.defense).toBeCloseTo(fresh.defense);
  });

  it('preserves every old pressing profile exactly when defensiveLine is absent', () => {
    const counter = setup({ attackApproach: 'COUNTER_ATTACK', attackerPace: 1 });
    const expected = {
      LOW_BLOCK: { chance: 0.91, goal: 0.8, defense: 1 },
      MEDIUM: { chance: 1, goal: 1, defense: 1 },
      HIGH_PRESS: { chance: 1.09, goal: 1.2, defense: 1 },
    } as const;

    expect(defensiveLineOf({ pressing: 'LOW_BLOCK' })).toBe('DEEP');
    const low = tacticalMatchup(counter, setup({ pressing: 'LOW_BLOCK' }));
    expect(low.chance).toBe(expected.LOW_BLOCK.chance);
    expect(low.goal).toBe(expected.LOW_BLOCK.goal);
    expect(low.defense).toBe(expected.LOW_BLOCK.defense);
    expect(low.spaceBehind).toBeUndefined();

    expect(defensiveLineOf({ pressing: 'MEDIUM' })).toBe('BALANCED');
    const medium = tacticalMatchup(counter, setup({ pressing: 'MEDIUM' }));
    expect(medium.chance).toBe(expected.MEDIUM.chance);
    expect(medium.goal).toBe(expected.MEDIUM.goal);
    expect(medium.defense).toBe(expected.MEDIUM.defense);
    expect(medium.spaceBehind).toBeUndefined();

    expect(defensiveLineOf({ pressing: 'HIGH_PRESS' })).toBe('HIGH');
    const high = tacticalMatchup(counter, setup({ pressing: 'HIGH_PRESS' }));
    expect(high.chance).toBe(expected.HIGH_PRESS.chance);
    expect(high.goal).toBe(expected.HIGH_PRESS.goal);
    expect(high.defense).toBe(expected.HIGH_PRESS.defense);
    expect(high.spaceBehind).toBeUndefined();
  });

  it('keeps the legacy recovery threshold unchanged when defensiveLine is absent', () => {
    const pressing = makeClub('legacy-recovery-pressing', 'Pressing FC', 80);
    const receiving = makeClub('legacy-recovery-receiving', 'Receiving FC', 40);
    const pressingTactic = makeTactic(pressing, {
      pressing: 'HIGH_PRESS',
      transitionStyle: 'RECOMPOSE',
      defensiveLine: undefined,
    });
    const receivingTactic = makeTactic(receiving, { transitionStyle: 'RECOMPOSE' });
    const pressingStrength = computeTeamStrength(pressing, pressingTactic);
    const receivingStrength = computeTeamStrength(receiving, receivingTactic);
    const strengthDelta = (pressingStrength.attack - receivingStrength.defense) / 6000;
    const legacyThreshold = 0.05 * 1.15 + strengthDelta;
    const regressedThreshold = (0.05 + strengthDelta) * 1.15;
    const recoveryRoll = (legacyThreshold + regressedThreshold) / 2;
    expect(regressedThreshold).toBeGreaterThan(legacyThreshold);
    let draw = 0;

    const segment = simulateMatchSegment({
      home: { club: pressing, tactic: pressingTactic },
      away: { club: receiving, tactic: receivingTactic },
      rng: () => (++draw === 7 ? recoveryRoll : 1),
      startMinute: 1,
      endMinute: 1,
    });

    expect(segment.homePressRecoveries).toBe(0);
  });

  it('separates the four extreme pressing × line risk profiles', () => {
    const counter = setup({ attackApproach: 'COUNTER_ATTACK', attackerPace: 0.5 });
    const highPressHighLine = tacticalMatchup(counter, setup({ pressing: 'HIGH_PRESS', defensiveLine: 'HIGH' }));
    const highPressDeepLine = tacticalMatchup(counter, setup({ pressing: 'HIGH_PRESS', defensiveLine: 'DEEP' }));
    const lowBlockHighLine = tacticalMatchup(counter, setup({ pressing: 'LOW_BLOCK', defensiveLine: 'HIGH' }));
    const lowBlockDeepLine = tacticalMatchup(counter, setup({ pressing: 'LOW_BLOCK', defensiveLine: 'DEEP' }));

    expect(highPressHighLine.spaceBehind).toBeCloseTo(1.4);
    expect(lowBlockHighLine.spaceBehind).toBeCloseTo(1.25);
    expect(highPressDeepLine.spaceBehind).toBeCloseTo(0.55);
    expect(lowBlockDeepLine.spaceBehind).toBeCloseTo(0.4);
    // Aggregate conversion retains the engine-wide safety floor even when raw danger is lower.
    expect(lowBlockDeepLine.goal / tacticalMatchup(counter, setup()).goal).toBe(0.65);
  });

  it('keeps an explicit balanced line neutral at ordinary attacker pace', () => {
    const effect = tacticalMatchup(
      setup({ attackApproach: 'COUNTER_ATTACK', attackerPace: 0.5 }),
      setup({ pressing: 'MEDIUM', defensiveLine: 'BALANCED' }),
    );

    expect(effect.spaceBehind).toBe(1);
  });

  it("weights high-line danger by the opposing attackers' pace", () => {
    const highLine = setup({ defensiveLine: 'HIGH' });
    const slow = tacticalMatchup(setup({ attackApproach: 'COUNTER_ATTACK', attackerPace: 0 }), highLine);
    const ordinary = tacticalMatchup(setup({ attackApproach: 'COUNTER_ATTACK', attackerPace: 0.5 }), highLine);
    const fast = tacticalMatchup(setup({ attackApproach: 'COUNTER_ATTACK', attackerPace: 1 }), highLine);

    expect(fast.spaceBehind).toBeGreaterThan(ordinary.spaceBehind!);
    expect(ordinary.spaceBehind).toBeGreaterThan(slow.spaceBehind!);
  });

  it('makes an explicit low/deep block concede possession without changing an old inferred block', () => {
    const club = makeClub('line-possession', 'Line FC', 70);
    const balancedTactic = makeTactic(club, { pressing: 'MEDIUM', defensiveLine: 'BALANCED' });
    const lowBlock = makeTactic(club, { pressing: 'LOW_BLOCK', defensiveLine: 'DEEP' });
    const legacyLowBlock = makeTactic(club, { pressing: 'LOW_BLOCK', defensiveLine: undefined });
    const strength = computeTeamStrength(club, balancedTactic);

    expect(derivePossession(strength, strength, lowBlock, balancedTactic)).toEqual({ home: 47, away: 53 });
    expect(derivePossession(strength, strength, legacyLowBlock, balancedTactic)).toEqual({ home: 50, away: 50 });
  });

  it('makes HIGH_PRESS + HIGH recover the ball about 1.35× as often as the balanced baseline', () => {
    const pressing = makeClub('line-recovery-pressing', 'Pressing FC', 70);
    const receiving = makeClub('line-recovery-receiving', 'Receiving FC', 70);
    let aggressiveRecoveries = 0;
    let baselineRecoveries = 0;

    for (let i = 0; i < 500; i++) {
      aggressiveRecoveries += simulateMatch({
        seed: `line-recovery-${i}`,
        home: { club: pressing, tactic: makeTactic(pressing, { pressing: 'HIGH_PRESS', defensiveLine: 'HIGH' }) },
        away: { club: receiving, tactic: makeTactic(receiving) },
      }).stats.home.pressRecoveries;
      baselineRecoveries += simulateMatch({
        seed: `line-recovery-${i}`,
        home: { club: pressing, tactic: makeTactic(pressing, { pressing: 'MEDIUM', defensiveLine: 'BALANCED' }) },
        away: { club: receiving, tactic: makeTactic(receiving) },
      }).stats.home.pressRecoveries;
    }

    expect(aggressiveRecoveries / baselineRecoveries).toBeGreaterThan(1.3);
    expect(aggressiveRecoveries / baselineRecoveries).toBeLessThan(1.4);
  });
});

describe('reacting to going a man down', () => {
  const opponent = setup();

  it('buys attacking volume at a real defensive cost when the manager goes for it', () => {
    const shortHanded = setup({ missingPlayers: 1, attackApproach: 'TOTAL_ATTACK' });
    const fullStrength = setup({ attackApproach: 'TOTAL_ATTACK' });

    const short = tacticalMatchup(shortHanded, opponent);
    const full = tacticalMatchup(fullStrength, opponent);

    expect(short.chance).toBeGreaterThan(full.chance);
    expect(short.defense).toBeLessThan(full.defense);
  });

  it('buys defensive solidity at a real attacking cost when the manager digs in', () => {
    const shortHanded = setup({ missingPlayers: 1, attackApproach: 'COUNTER_ATTACK' });
    const fullStrength = setup({ attackApproach: 'COUNTER_ATTACK' });

    const short = tacticalMatchup(shortHanded, opponent);
    const full = tacticalMatchup(fullStrength, opponent);

    expect(short.defense).toBeGreaterThan(full.defense);
    expect(short.chance).toBeLessThan(full.chance);
  });

  it('makes the two reactions a genuine trade rather than one dominating', () => {
    const goForIt = tacticalMatchup(setup({ missingPlayers: 1, attackApproach: 'TOTAL_ATTACK' }), opponent);
    const digIn = tacticalMatchup(setup({ missingPlayers: 1, attackApproach: 'COUNTER_ATTACK' }), opponent);

    expect(goForIt.chance).toBeGreaterThan(digIn.chance);
    expect(digIn.defense).toBeGreaterThan(goForIt.defense);
  });
});

/**
 * The scenario this whole module exists for: a man down, does switching to all-out attack actually put more
 * of the ball in the opponent's box? Measured through the real engine over many seeded matches, not on the
 * multipliers alone.
 */
describe('end to end: chasing a game a man down', () => {
  function playShortHanded(approach: 'COUNTER_ATTACK' | 'TOTAL_ATTACK'): { scored: number; conceded: number; shots: number } {
    const homeClub = makeClub('chase-home', 'Chase FC', 70);
    const awayClub = makeClub('chase-away', 'Rival FC', 70);
    const sentOff: MatchEvent[] = [
      { minute: 1, type: 'card', team: 'home', playerId: 'chase-home-p10', description: 'vermelho', suspensionMatches: 1 },
    ];

    let scored = 0;
    let conceded = 0;
    let shots = 0;
    for (let i = 0; i < 400; i++) {
      const segment = simulateMatchSegment({
        home: { club: homeClub, tactic: makeTactic(homeClub, { attackApproach: approach }) },
        away: { club: awayClub, tactic: makeTactic(awayClub) },
        rng: createRng(`chase-${i}`),
        startMinute: 1,
        endMinute: 90,
        priorEvents: sentOff,
      });
      scored += segment.homeGoals;
      conceded += segment.awayGoals;
      shots += segment.homeShots;
    }
    return { scored: scored / 400, conceded: conceded / 400, shots: shots / 400 };
  }

  it('creates more shots and scores more, while conceding more, than sitting back does', () => {
    const digIn = playShortHanded('COUNTER_ATTACK');
    const goForIt = playShortHanded('TOTAL_ATTACK');

    expect(goForIt.shots).toBeGreaterThan(digIn.shots);
    expect(goForIt.scored).toBeGreaterThan(digIn.scored);
    expect(goForIt.conceded).toBeGreaterThan(digIn.conceded);
  });
});

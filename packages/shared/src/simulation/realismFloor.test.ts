import { describe, expect, it } from 'vitest';
import { makeClub } from './testFactories.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';
import { simulateMatch } from './engine.js';
import type { Tactic } from '../domain/tactic.js';

const home = makeClub('piso-h', 'Casa', 70, { seed: 'piso-h' });
const away = makeClub('piso-a', 'Fora', 70, { seed: 'piso-a' });
const baseHome = { ...autoFillLineup(home), clubId: home.id } as Tactic;
const baseAway = { ...autoFillLineup(away), clubId: away.id } as Tactic;

/** Enough matches for the rates to settle without making the suite crawl. */
const N = 400;

function play(h: Tactic, a: Tactic, tag: string) {
  let goals = 0;
  let goalless = 0;
  let homePoints = 0;
  for (let i = 0; i < N; i += 1) {
    const r = simulateMatch({ seed: `${tag}-${i}`, home: { club: home, tactic: h }, away: { club: away, tactic: a } });
    goals += r.homeGoals + r.awayGoals;
    if (r.homeGoals + r.awayGoals === 0) goalless += 1;
    if (r.homeGoals > r.awayGoals) homePoints += 3;
    else if (r.homeGoals === r.awayGoals) homePoints += 1;
  }
  return { goals: goals / N, goalless: goalless / N, ppg: homePoints / N };
}

/**
 * Tactics decide who wins; they do not get to decide whether football happens.
 *
 * Every tactical modifier lands on both sides at once — one manager's caution lowers his own chance
 * creation *and* raises the bar his opponent has to clear — so two cautious managers did not meet in the
 * middle, they multiplied. Measured before this was fixed: two sides both playing defensive, counter and
 * a low block produced 0.47 goals a match with 62% of fixtures goalless. That is not a dour game of
 * football, it is a broken one, and every dial involved was a perfectly reasonable thing to pick.
 *
 * The fix (see `dampenSharedTacticalVolume`) scales both sides by the same factor, so it cannot change
 * which of them is stronger or by how much. These tests hold both halves of that: the floor is real, and
 * the tactical counters that make the screen worth visiting still work at full strength.
 */
describe('realism floor', () => {
  const bus = { mentality: 'defensive', attackApproach: 'COUNTER_ATTACK', pressing: 'LOW_BLOCK' } as const;

  it('keeps a match between two ultra-cautious sides recognisable as football', () => {
    const r = play({ ...baseHome, ...bus }, { ...baseAway, ...bus }, 'bus');

    // A cagey game, but a game. Stated as a share of the calibrated match so it survives a retune of the
    // scoring scale, which absolute figures here would not.
    const calibrated = play(baseHome, baseAway, 'cal-floor');
    expect(
      r.goals / calibrated.goals,
      `fechado ${r.goals.toFixed(2)} x calibrado ${calibrated.goals.toFixed(2)}`,
    ).toBeGreaterThan(0.4);
    expect(r.goalless, `sem gols: ${(r.goalless * 100).toFixed(0)}%`).toBeLessThan(0.3);
  });

  it('still lets caution make a game tighter than an open one', () => {
    /**
     * Measured against the calibrated match rather than against fixed numbers.
     *
     * An absolute bound here would be the very mistake this file exists to catch. The engine's scoring
     * scale is retuned from time to time (see GOAL_BASE_PROB), and every constant fitted against the old
     * scale silently stops meaning what it meant — which is exactly how the handicap for playing a man
     * down lost a quarter of its bite without a single test going red. What matters is not that an open
     * game reaches some particular number of goals, but that it stays a recognisable multiple of a normal
     * one.
     */
    const calibrated = play(baseHome, baseAway, 'cal');
    const cautious = play({ ...baseHome, ...bus }, { ...baseAway, ...bus }, 'tight');
    const open = play(
      { ...baseHome, mentality: 'attacking', attackApproach: 'TOTAL_ATTACK', pressing: 'HIGH_PRESS' },
      { ...baseAway, mentality: 'attacking', attackApproach: 'TOTAL_ATTACK', pressing: 'HIGH_PRESS' },
      'open',
    );

    // The floor must not flatten the dials into decoration: an open game is still clearly more open.
    expect(open.goals).toBeGreaterThan(cautious.goals * 1.5);
    // And neither extreme may run away from the ordinary match by more than about half again.
    expect(
      open.goals / calibrated.goals,
      `aberto ${open.goals.toFixed(2)} x calibrado ${calibrated.goals.toFixed(2)}`,
    ).toBeLessThan(1.6);
    expect(
      cautious.goals / calibrated.goals,
      `fechado ${cautious.goals.toFixed(2)} x calibrado ${calibrated.goals.toFixed(2)}`,
    ).toBeGreaterThan(0.4);
  });

  it('leaves the tactical counters at full strength', () => {
    // Width against a packed box, and the same choice against an open one. The whole point of the
    // damping is that it scales both sides alike, so a matchup edge survives it untouched.
    const wingsVsBus = play(
      { ...baseHome, attackStyle: 'WINGS', formation: '4-3-3' },
      { ...baseAway, formation: '5-3-2' },
      'w532',
    );
    const middleVsBus = play(
      { ...baseHome, attackStyle: 'THROUGH_MIDDLE', formation: '4-3-3' },
      { ...baseAway, formation: '5-3-2' },
      'm532',
    );
    const middleVsOpen = play(
      { ...baseHome, attackStyle: 'THROUGH_MIDDLE', formation: '4-3-3' },
      { ...baseAway, formation: '4-3-3' },
      'm433',
    );

    // Going round a compact side beats going through it...
    expect(wingsVsBus.ppg, `alas ${wingsVsBus.ppg.toFixed(2)} x meio ${middleVsBus.ppg.toFixed(2)}`).toBeGreaterThan(
      middleVsBus.ppg,
    );
    // ...and the same choice is worth more against a side that leaves the middle open. Reading the
    // opponent is the point; there is no single best style.
    expect(middleVsOpen.ppg).toBeGreaterThan(middleVsBus.ppg);
  });
});

import { describe, it, expect } from 'vitest';
import {
  bestPenaltyTaker,
  composure,
  penaltyConversionProbability,
  penaltyKeeperScore,
  penaltyOffTargetShare,
  penaltyPressure,
  penaltyTakerScore,
} from './penalty.js';
import { simulateMatch } from './engine.js';
import { defaultDetailedAttributes } from '../domain/detailedAttributes.js';
import type { DetailedAttribute } from '../domain/detailedAttributes.js';
import type { Player } from '../domain/player.js';
import { generateStarterSquad } from '../domain/squadGenerator.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';
import { makeClub, makePlayer } from './testFactories.js';

function withAttributes(id: string, overrides: Partial<Record<DetailedAttribute, number>>, extra: Partial<Player> = {}): Player {
  const base = makePlayer(id, extra);
  return { ...base, ...extra, detailedAttributes: { ...defaultDetailedAttributes(50), ...overrides } };
}

const specialist = withAttributes('specialist', { PENALTY_TAKING: 95, SHOT_POWER: 88, POWER: 80 }, { morale: 80, fatigue: 10 });
const defender = withAttributes('defender', { PENALTY_TAKING: 20, SHOT_POWER: 40, POWER: 35 }, { morale: 45, fatigue: 70 });
const eliteKeeper = withAttributes('elite-gk', { PENALTY_SAVING: 90, REFLEXES: 92, AGILITY: 88, ANTICIPATION: 80 }, { position: 'GK' });
const poorKeeper = withAttributes('poor-gk', { PENALTY_SAVING: 35, REFLEXES: 45, AGILITY: 40, ANTICIPATION: 30 }, { position: 'GK' });

describe('composure', () => {
  it('rises with morale and falls with fatigue', () => {
    const fresh = withAttributes('fresh', {}, { morale: 90, fatigue: 0 });
    const spent = withAttributes('spent', {}, { morale: 90, fatigue: 95 });
    const miserable = withAttributes('miserable', {}, { morale: 10, fatigue: 0 });

    expect(composure(fresh)).toBeGreaterThan(composure(spent));
    expect(composure(fresh)).toBeGreaterThan(composure(miserable));
  });

  it('reads personality: a leader is steadier, a temperamental one is not', () => {
    const plain = withAttributes('plain', {}, { morale: 60, fatigue: 20, traits: [] });
    const leader = withAttributes('leader', {}, { morale: 60, fatigue: 20, traits: ['LEADER'] });
    const hothead = withAttributes('hothead', {}, { morale: 60, fatigue: 20, traits: ['TEMPERAMENTAL'] });

    expect(composure(leader)).toBeGreaterThan(composure(plain));
    expect(composure(hothead)).toBeLessThan(composure(plain));
  });

  it('stays inside 1 to 99 however extreme the inputs', () => {
    const best = withAttributes('best', {}, { morale: 100, fatigue: 0, traits: ['LEADER'] });
    const worst = withAttributes('worst', {}, { morale: 0, fatigue: 100, traits: ['TEMPERAMENTAL'] });
    expect(composure(best)).toBeLessThanOrEqual(99);
    expect(composure(worst)).toBeGreaterThanOrEqual(1);
  });
});

describe('penalty duel scores', () => {
  it('rates a spot-kick specialist above a defender pressed into it', () => {
    expect(penaltyTakerScore(specialist)).toBeGreaterThan(penaltyTakerScore(defender));
  });

  it('rates a keeper who reads penalties above one who does not', () => {
    expect(penaltyKeeperScore(eliteKeeper)).toBeGreaterThan(penaltyKeeperScore(poorKeeper));
  });

  it('weighs the specialist attribute above general shooting', () => {
    const penaltyMan = withAttributes('pen-man', { PENALTY_TAKING: 90, SHOT_POWER: 40 });
    const shooter = withAttributes('shooter', { PENALTY_TAKING: 40, SHOT_POWER: 90 });
    expect(penaltyTakerScore(penaltyMan)).toBeGreaterThan(penaltyTakerScore(shooter));
  });
});

describe('penaltyConversionProbability', () => {
  it('lands near the real conversion rate for an ordinary duel', () => {
    const ordinaryTaker = withAttributes('ordinary', { PENALTY_TAKING: 55, SHOT_POWER: 60, POWER: 55 }, { morale: 55, fatigue: 25 });
    const ordinaryKeeper = withAttributes('ordinary-gk', { PENALTY_SAVING: 55, REFLEXES: 60, AGILITY: 60, ANTICIPATION: 45 }, { position: 'GK' });
    const p = penaltyConversionProbability(ordinaryTaker, ordinaryKeeper);
    expect(p).toBeGreaterThan(0.68);
    expect(p).toBeLessThan(0.85);
  });

  it('spans from near-certain to a coin flip across the extremes', () => {
    expect(penaltyConversionProbability(specialist, poorKeeper)).toBeGreaterThan(0.9);
    expect(penaltyConversionProbability(defender, eliteKeeper)).toBeLessThan(0.55);
  });

  it('never leaves the 30 to 95 percent band, however lopsided', () => {
    const hopeless = withAttributes('hopeless', { PENALTY_TAKING: 1, SHOT_POWER: 1, POWER: 1 }, { morale: 0, fatigue: 100 });
    const wall = withAttributes('wall', { PENALTY_SAVING: 99, REFLEXES: 99, AGILITY: 99, ANTICIPATION: 99 }, { position: 'GK' });
    expect(penaltyConversionProbability(hopeless, wall, 1)).toBeGreaterThanOrEqual(0.3);
    expect(penaltyConversionProbability(specialist, poorKeeper, 0)).toBeLessThanOrEqual(0.95);
  });

  it('costs a fragile taker more than a composed one when the moment is big', () => {
    const calmDrop = penaltyConversionProbability(specialist, eliteKeeper, 0) - penaltyConversionProbability(specialist, eliteKeeper, 1);
    const fragileDrop = penaltyConversionProbability(defender, eliteKeeper, 0) - penaltyConversionProbability(defender, eliteKeeper, 1);

    expect(calmDrop).toBeGreaterThan(0);
    expect(fragileDrop).toBeGreaterThan(calmDrop);
  });
});

describe('penaltyPressure', () => {
  it('is nothing early on, whatever the score', () => {
    expect(penaltyPressure(20, 0)).toBe(0);
    expect(penaltyPressure(20, 3)).toBe(0);
  });

  it('is nothing late in a settled game', () => {
    expect(penaltyPressure(89, 4)).toBe(0);
  });

  it('peaks late in a tight one', () => {
    expect(penaltyPressure(89, 0)).toBeGreaterThan(0.9);
    expect(penaltyPressure(89, 0)).toBeGreaterThan(penaltyPressure(70, 0));
    expect(penaltyPressure(89, 0)).toBeGreaterThan(penaltyPressure(89, 2));
  });
});

describe('penaltyOffTargetShare', () => {
  it('has the poor taker blaze it over more often than the specialist', () => {
    expect(penaltyOffTargetShare(defender)).toBeGreaterThan(penaltyOffTargetShare(specialist));
  });
});

describe('bestPenaltyTaker', () => {
  it('picks the best man for it and never the goalkeeper', () => {
    const squad = [eliteKeeper, defender, specialist];
    expect(bestPenaltyTaker(squad)?.id).toBe('specialist');
  });

  it('returns null when there is nobody at all', () => {
    expect(bestPenaltyTaker([])).toBeNull();
  });
});

describe('engine: penalties', () => {
  function club(id: string) {
    return { ...makeClub(id, id, 70), players: generateStarterSquad(id, 'BRA', `${id}-squad`) };
  }

  it('awards spot kicks at roughly the rate a real match does, and converts them at roughly the real rate', () => {
    const home = club('home-pen-rate');
    const away = club('away-pen-rate');
    const homeTactic = { ...autoFillLineup(home), clubId: home.id };
    const awayTactic = { ...autoFillLineup(away), clubId: away.id };

    let penalties = 0;
    let scored = 0;
    const N = 1200;

    for (let i = 0; i < N; i++) {
      const r = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `pen-rate-${i}`,
      });
      for (const e of r.events) {
        if (!e.isPenalty) continue;
        penalties++;
        if (e.type === 'goal') scored++;
      }
    }

    // Real top-flight football: about 0.25-0.30 penalties a match, converted a bit over three times in four.
    expect(penalties / N).toBeGreaterThan(0.15);
    expect(penalties / N).toBeLessThan(0.4);
    expect(scored / penalties).toBeGreaterThan(0.68);
    expect(scored / penalties).toBeLessThan(0.84);
  });

  it('sends the best taker on the pitch to the spot when the manager named nobody', () => {
    const home = club('home-pen-pick');
    const away = club('away-pen-pick');
    const homeTactic = { ...autoFillLineup(home), clubId: home.id, penaltyTakerId: undefined };
    const awayTactic = { ...autoFillLineup(away), clubId: away.id };

    const onPitch = homeTactic.lineup
      .map((slot) => home.players.find((p) => p.id === slot.playerId))
      .filter((p): p is Player => !!p);
    const expected = bestPenaltyTaker(onPitch)!;

    let sawPenalty = false;
    for (let i = 0; i < 400; i++) {
      const r = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `pen-pick-${i}`,
      });
      for (const e of r.events) {
        // Only kicks taken before anyone left the pitch: a substitution or dismissal legitimately changes
        // who the best available taker is.
        if (!e.isPenalty || e.team !== 'home') continue;
        const disrupted = r.events.some(
          (other) => other.minute <= e.minute && other.team === 'home' && (other.type === 'substitution' || other.type === 'injury' || (other.type === 'card' && other.suspensionMatches !== undefined)),
        );
        if (disrupted) continue;
        sawPenalty = true;
        expect(e.playerId).toBe(expected.id);
      }
    }
    expect(sawPenalty).toBe(true);
  });

  it('names the keeper when he saves it, and nobody when it goes over', () => {
    const home = club('home-pen-text');
    const away = club('away-pen-text');
    const homeTactic = { ...autoFillLineup(home), clubId: home.id };
    const awayTactic = { ...autoFillLineup(away), clubId: away.id };
    // The keeper actually in the eleven, not just the first one in the squad — a squad carries several and
    // the auto-fill picks the best of them.
    const awayKeeper = awayTactic.lineup
      .map((slot) => away.players.find((p) => p.id === slot.playerId))
      .find((p): p is Player => !!p && p.position === 'GK')!;

    let sawSave = false;
    let sawOffTarget = false;
    for (let i = 0; i < 800 && !(sawSave && sawOffTarget); i++) {
      const r = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `pen-text-${i}`,
      });
      for (const e of r.events) {
        if (!e.isPenalty || e.type !== 'chance' || e.team !== 'home') continue;
        if (e.description.includes(awayKeeper.name)) sawSave = true;
        else sawOffTarget = true;
      }
    }

    expect(sawSave).toBe(true);
    expect(sawOffTarget).toBe(true);
  });
});

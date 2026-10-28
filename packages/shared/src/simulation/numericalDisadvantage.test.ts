import { describe, it, expect } from 'vitest';
import {
  bookedPlayerIds,
  fatigueOverloadMultiplier,
  missingPlayerMinutes,
  numericalDisadvantageFactors,
  offPitchPlayerIds,
  sentOffPlayerIds,
} from './numericalDisadvantage.js';
import { computeTeamStrength } from './teamStrength.js';
import { TacticalSetup, tacticalMatchup } from './tacticalMatchup.js';
import { simulateMatchSegment } from './engine.js';
import { makeClub, makePlayer, makeTactic } from './testFactories.js';
import { createRng } from './rng.js';
import { MatchEvent } from '../domain/match.js';

const baseSetup: TacticalSetup = {
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
};

function redCard(playerId: string, minute: number, team: 'home' | 'away' = 'home'): MatchEvent {
  return { minute, type: 'card', team, playerId, description: 'vermelho', suspensionMatches: 1 };
}

function yellowCard(playerId: string, minute: number, team: 'home' | 'away' = 'home'): MatchEvent {
  return { minute, type: 'card', team, playerId, description: 'amarelo' };
}

function injury(playerId: string, minute: number, team: 'home' | 'away' = 'home'): MatchEvent {
  return { minute, type: 'injury', team, playerId, description: 'lesão', injuryWeeks: 2 };
}

function substitution(outId: string, inId: string, minute: number, team: 'home' | 'away' = 'home'): MatchEvent {
  return { minute, type: 'substitution', team, playerId: outId, relatedPlayerId: inId, description: 'substituição' };
}

describe('who is off the pitch', () => {
  it('counts a sent-off player but not a booked one', () => {
    const events = [redCard('sent-off', 20), yellowCard('booked', 30)];
    expect(offPitchPlayerIds(events, 'home')).toEqual(new Set(['sent-off']));
    expect(sentOffPlayerIds(events, 'home')).toEqual(new Set(['sent-off']));
  });

  it('only counts the side that actually lost the player', () => {
    const events = [redCard('theirs', 20, 'away')];
    expect(offPitchPlayerIds(events, 'home').size).toBe(0);
    expect(offPitchPlayerIds(events, 'away')).toEqual(new Set(['theirs']));
  });

  it('stops counting an injured player once a substitute comes on for them', () => {
    const hurt = [injury('hurt', 20)];
    expect(offPitchPlayerIds(hurt, 'home')).toEqual(new Set(['hurt']));

    const replaced = [...hurt, substitution('hurt', 'fresh', 21)];
    expect(offPitchPlayerIds(replaced, 'home').size).toBe(0);
  });

  it('never lets a substitution put a sent-off player back on', () => {
    const events = [redCard('sent-off', 20), substitution('sent-off', 'fresh', 21)];
    expect(offPitchPlayerIds(events, 'home')).toEqual(new Set(['sent-off']));
  });
});

describe('who is on a booking', () => {
  it('counts a yellow but not a red — a red is already off, a yellow is the one to worry about', () => {
    const events = [yellowCard('booked', 20), redCard('sent-off', 30)];
    expect(bookedPlayerIds(events, 'home')).toEqual(new Set(['booked']));
  });

  it('only reports the side asked for', () => {
    expect(bookedPlayerIds([yellowCard('theirs', 20, 'away')], 'home').size).toBe(0);
    expect(bookedPlayerIds([yellowCard('theirs', 20, 'away')], 'away')).toEqual(new Set(['theirs']));
  });

  it('is empty for a clean match', () => {
    expect(bookedPlayerIds([injury('x', 10)], 'home').size).toBe(0);
  });
});

describe('time spent short-handed', () => {
  it('runs a dismissal through to the final whistle', () => {
    expect(missingPlayerMinutes([redCard('x', 30)], 'home')).toBe(60);
  });

  it('closes an injury spell at the replacement, not at fulltime', () => {
    expect(missingPlayerMinutes([injury('x', 30), substitution('x', 'y', 40)], 'home')).toBe(10);
  });

  it('adds up concurrent spells', () => {
    expect(missingPlayerMinutes([redCard('a', 60), redCard('b', 60)], 'home')).toBe(60);
  });

  it('is zero for a match nobody left', () => {
    expect(missingPlayerMinutes([yellowCard('a', 10)], 'home')).toBe(0);
  });
});

describe('handicap curve', () => {
  it('is neutral at full strength', () => {
    expect(numericalDisadvantageFactors(0)).toEqual({ attack: 1, defense: 1 });
  });

  it('costs attack more than defense — a short side drops deep and defends, it does not attack', () => {
    const down = numericalDisadvantageFactors(1);
    expect(down.attack).toBeLessThan(down.defense);
    expect(down.attack).toBeLessThan(1);
  });

  it('punishes the second dismissal harder than the first', () => {
    const one = numericalDisadvantageFactors(1);
    const two = numericalDisadvantageFactors(2);
    const firstLoss = 1 - one.attack;
    const secondLoss = one.attack - two.attack;
    expect(secondLoss).toBeGreaterThan(firstLoss);
  });

  it('never degrades to zero however many players are gone', () => {
    const wiped = numericalDisadvantageFactors(11);
    expect(wiped.attack).toBeGreaterThan(0);
    expect(wiped.defense).toBeGreaterThan(0);
  });
});

describe('fatigue overload', () => {
  it('is neutral when the side was never short', () => {
    expect(fatigueOverloadMultiplier(0)).toBe(1);
  });

  it('grows with time spent a man down', () => {
    expect(fatigueOverloadMultiplier(90)).toBeGreaterThan(fatigueOverloadMultiplier(45));
    expect(fatigueOverloadMultiplier(45)).toBeGreaterThan(1);
  });
});

describe('computeTeamStrength with players off the pitch', () => {
  it('weakens a side that is a man down, and reports how many are missing', () => {
    const club = makeClub('short', 'Short FC', 70);
    const tactic = makeTactic(club);

    const full = computeTeamStrength(club, tactic);
    const short = computeTeamStrength(club, tactic, new Set([club.players[10].id]));

    expect(full.missingPlayers).toBe(0);
    expect(short.missingPlayers).toBe(1);
    expect(short.attack).toBeLessThan(full.attack);
    expect(short.defense).toBeLessThan(full.defense);
    expect(short.lineupPlayers).toHaveLength(10);
  });

  it('drops a sent-off player out of the pool that can score or foul', () => {
    const club = makeClub('pool', 'Pool FC', 70);
    const tactic = makeTactic(club);
    const goneId = club.players[10].id;

    const short = computeTeamStrength(club, tactic, new Set([goneId]));
    expect(short.lineupPlayers.some((p) => p.id === goneId)).toBe(false);
  });
});

describe('engine: playing short', () => {
  /** Same fixture, same seed, only difference being a dismissal already on the timeline. */
  function playWith(priorEvents: MatchEvent[]): { home: number; away: number } {
    const homeClub = makeClub('eng-home', 'Home FC', 70);
    const awayClub = makeClub('eng-away', 'Away FC', 70);
    let home = 0;
    let away = 0;
    for (let i = 0; i < 300; i++) {
      const segment = simulateMatchSegment({
        home: { club: homeClub, tactic: makeTactic(homeClub) },
        away: { club: awayClub, tactic: makeTactic(awayClub) },
        rng: createRng(`short-${i}`),
        startMinute: 1,
        endMinute: 90,
        priorEvents,
      });
      home += segment.homeGoals;
      away += segment.awayGoals;
    }
    return { home: home / 300, away: away / 300 };
  }

  it('makes a side down to ten score less and concede more', () => {
    const full = playWith([]);
    const short = playWith([redCard('eng-home-p10', 1)]);

    expect(short.home).toBeLessThan(full.home);
    expect(short.away).toBeGreaterThan(full.away);
  });

  /** Regression: the "dig in" reaction is a mitigation, not an upgrade. An over-generous defensive bonus
   *  once made a ten-man side defend *better* than the same eleven-man side, which is nonsense. */
  it('never lets any reaction leave ten men defending better than eleven', () => {
    const approaches = ['COUNTER_ATTACK', 'BALANCED', 'TOTAL_ATTACK'] as const;
    for (const attackApproach of approaches) {
      const full = numericalDisadvantageFactors(0);
      const short = numericalDisadvantageFactors(1);
      const digInBonus = tacticalMatchup(
        { ...baseSetup, attackApproach, missingPlayers: 1 },
        { ...baseSetup },
      ).defense;
      expect(short.defense * digInBonus).toBeLessThan(full.defense);
    }
  });

  it('carries a dismissal across a pause instead of quietly restoring the player', () => {
    const homeClub = makeClub('resume-home', 'Home FC', 70);
    const awayClub = makeClub('resume-away', 'Away FC', 70);
    const priorEvents = [redCard('resume-home-p10', 10)];

    const segment = simulateMatchSegment({
      home: { club: homeClub, tactic: makeTactic(homeClub) },
      away: { club: awayClub, tactic: makeTactic(awayClub) },
      // Picked to land no further card/injury incident in this window under the current engine, so the
      // only missing player is the one carried over from `priorEvents` — not a property of this seed
      // specifically, just one that happens to keep this assertion about *that* to a single number.
      rng: createRng('resume-0'),
      startMinute: 46,
      endMinute: 90,
      priorEvents,
    });

    expect(segment.homeStrength.missingPlayers).toBe(1);
    expect(segment.homeStrength.lineupPlayers.some((p) => p.id === 'resume-home-p10')).toBe(false);
  });

  it('refuses to spend a planned substitution on a player who has been sent off', () => {
    const homeClub = makeClub('sub-home', 'Home FC', 70);
    const awayClub = makeClub('sub-away', 'Away FC', 70);
    const bench = makePlayer('sub-home-bench', { position: 'ATT' });
    const clubWithBench = { ...homeClub, players: [...homeClub.players, bench] };

    const tactic = makeTactic(homeClub, {
      substitutes: [{ playerId: bench.id }],
      plannedSubstitutions: [{ id: 'planned-1', minute: 50, outPlayerId: 'sub-home-p10', inPlayerId: bench.id }],
    });

    const segment = simulateMatchSegment({
      home: { club: clubWithBench, tactic },
      away: { club: awayClub, tactic: makeTactic(awayClub) },
      rng: createRng('blocked-sub'),
      startMinute: 46,
      endMinute: 90,
      priorEvents: [redCard('sub-home-p10', 10)],
    });

    expect(segment.events.some((e) => e.type === 'substitution' && e.playerId === 'sub-home-p10')).toBe(false);
    expect(segment.homeStrength.missingPlayers).toBe(1);
  });

  it('sends the bench on for an injured starter, so the side is only briefly short', () => {
    const homeClub = makeClub('inj-home', 'Home FC', 70);
    const awayClub = makeClub('inj-away', 'Away FC', 70);
    const bench = Array.from({ length: 5 }, (_, i) => makePlayer(`inj-home-b${i}`, { position: 'MID' }));
    const clubWithBench = { ...homeClub, players: [...homeClub.players, ...bench] };
    const tactic = makeTactic(homeClub, { substitutes: bench.map((p) => ({ playerId: p.id })) });

    // Enough runs that at least one injury lands; every one of them should be patched up right away.
    let injuries = 0;
    let emergencySubs = 0;
    for (let i = 0; i < 200; i++) {
      const segment = simulateMatchSegment({
        home: { club: clubWithBench, tactic },
        away: { club: awayClub, tactic: makeTactic(awayClub) },
        rng: createRng(`injury-${i}`),
        startMinute: 1,
        endMinute: 90,
      });
      const homeInjuries = segment.events.filter((e) => e.type === 'injury' && e.team === 'home');
      injuries += homeInjuries.length;
      for (const hurt of homeInjuries) {
        if (segment.events.some((e) => e.type === 'substitution' && e.team === 'home' && e.playerId === hurt.playerId)) {
          emergencySubs++;
        }
      }
    }

    expect(injuries).toBeGreaterThan(0);
    expect(emergencySubs).toBe(injuries);
  });

  it('leaves the side a man down when the bench has nobody left to send on', () => {
    const homeClub = makeClub('nobench-home', 'Home FC', 70);
    const awayClub = makeClub('nobench-away', 'Away FC', 70);

    let injuries = 0;
    let stillShort = 0;
    for (let i = 0; i < 200; i++) {
      const segment = simulateMatchSegment({
        home: { club: homeClub, tactic: makeTactic(homeClub) },
        away: { club: awayClub, tactic: makeTactic(awayClub) },
        rng: createRng(`injury-${i}`),
        startMinute: 1,
        endMinute: 90,
      });
      const homeInjuries = segment.events.filter((e) => e.type === 'injury' && e.team === 'home');
      injuries += homeInjuries.length;
      if (homeInjuries.length > 0 && segment.homeStrength.missingPlayers > 0) stillShort++;
    }

    expect(injuries).toBeGreaterThan(0);
    expect(stillShort).toBeGreaterThan(0);
  });
});

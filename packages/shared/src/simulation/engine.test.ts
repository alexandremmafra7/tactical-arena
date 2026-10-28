import { describe, it, expect } from 'vitest';
import { shotTypeForChance, simulateMatch, simulateMatchSegment } from './engine.js';
import { createResumableRng, resumableRngFromState } from './rng.js';
import { dismissalSettlingFactor, offPitchPlayerIds } from './numericalDisadvantage.js';
import type { MatchEvent } from '../domain/match.js';
import type { Club } from '../domain/club.js';
import type { Player } from '../domain/player.js';
import { defaultDetailedAttributes } from '../domain/detailedAttributes.js';
import { makeClub, makePlayer, makeTactic } from './testFactories.js';

/** Applies the same collective-attribute overrides to every player in a club, for the counterpress duel
 *  tests below — mirrors the post-club-construction override pattern teamStrength.test.ts already uses,
 *  since makeClub itself only supports uniform traits, not per-player detailedAttributes/commitment. */
function withCollective(
  club: Club,
  overrides: {
    commitment?: number;
    traits?: Player['traits'];
    fatigue?: number;
    morale?: number;
    anticipation?: number;
    ballControl?: number;
  },
): Club {
  return {
    ...club,
    players: club.players.map((p) => ({
      ...p,
      commitment: overrides.commitment ?? p.commitment,
      traits: overrides.traits ?? p.traits,
      fatigue: overrides.fatigue ?? p.fatigue,
      morale: overrides.morale ?? p.morale,
      detailedAttributes: {
        ...p.detailedAttributes,
        ...(overrides.anticipation !== undefined ? { ANTICIPATION: overrides.anticipation } : {}),
        ...(overrides.ballControl !== undefined ? { BALL_CONTROL: overrides.ballControl } : {}),
      },
    })),
  };
}

describe('simulateMatch determinism', () => {
  it('produces an identical result for the same seed and inputs', () => {
    const home = makeClub('home', 'Home FC', 70);
    const away = makeClub('away', 'Away FC', 70);
    const homeTactic = makeTactic(home);
    const awayTactic = makeTactic(away);

    const input = { home: { club: home, tactic: homeTactic }, away: { club: away, tactic: awayTactic }, seed: 'fixed-seed-123' };

    const resultA = simulateMatch(input);
    const resultB = simulateMatch(input);

    expect(resultB).toEqual(resultA);
  });

  it('produces different results for different seeds', () => {
    const home = makeClub('home', 'Home FC', 70);
    const away = makeClub('away', 'Away FC', 70);
    const homeTactic = makeTactic(home);
    const awayTactic = makeTactic(away);

    const resultA = simulateMatch({ home: { club: home, tactic: homeTactic }, away: { club: away, tactic: awayTactic }, seed: 'seed-a' });
    const resultB = simulateMatch({ home: { club: home, tactic: homeTactic }, away: { club: away, tactic: awayTactic }, seed: 'seed-b' });

    expect(resultB).not.toEqual(resultA);
  });
});

describe('simulateMatch statistical sanity', () => {
  it('has a clearly stronger team win more often than a much weaker team over many simulations', () => {
    const strong = makeClub('strong', 'Strong FC', 90);
    const weak = makeClub('weak', 'Weak FC', 30);
    const strongTactic = makeTactic(strong);
    const weakTactic = makeTactic(weak);

    let strongWins = 0;
    let weakWins = 0;
    let draws = 0;
    const N = 200;

    for (let i = 0; i < N; i++) {
      const result = simulateMatch({
        home: { club: strong, tactic: strongTactic },
        away: { club: weak, tactic: weakTactic },
        seed: `sim-${i}`,
      });

      if (result.homeGoals > result.awayGoals) strongWins++;
      else if (result.homeGoals < result.awayGoals) weakWins++;
      else draws++;
    }

    expect(strongWins).toBeGreaterThan(weakWins);
    expect(strongWins / N).toBeGreaterThan(0.6);
  });
});

describe('simulateMatch discipline (personality traits)', () => {
  it('gives an AGGRESSIVE-heavy team more card events than a team with no aggressive players, over many simulations', () => {
    const aggressiveTeam = makeClub('aggressive', 'Aggressive FC', 70, { traits: ['AGGRESSIVE'] });
    const cleanTeam = makeClub('clean', 'Clean FC', 70, { seed: 'aggressive' });
    const aggressiveTactic = makeTactic(aggressiveTeam);
    const cleanTactic = makeTactic(cleanTeam);

    let aggressiveTeamCards = 0;
    let cleanTeamCards = 0;
    const N = 100;

    for (let i = 0; i < N; i++) {
      const result = simulateMatch({
        home: { club: aggressiveTeam, tactic: aggressiveTactic },
        away: { club: cleanTeam, tactic: cleanTactic },
        seed: `discipline-${i}`,
      });

      for (const event of result.events) {
        if (event.type !== 'card') continue;
        if (event.team === 'home') aggressiveTeamCards++;
        else cleanTeamCards++;
      }
    }

    expect(aggressiveTeamCards).toBeGreaterThan(cleanTeamCards);
  });

  it('always attaches a 1-3 match suspension to red card events, and AGGRESSIVE players average longer bans', () => {
    const aggressiveTeam = makeClub('aggressive-red', 'Aggressive Red FC', 70, { traits: ['AGGRESSIVE'] });
    const cleanTeam = makeClub('clean-red', 'Clean Red FC', 70, { seed: 'aggressive-red' });
    const aggressiveTactic = makeTactic(aggressiveTeam);
    const cleanTactic = makeTactic(cleanTeam);

    const aggressiveSuspensions: number[] = [];
    const cleanSuspensions: number[] = [];
    const N = 300;

    for (let i = 0; i < N; i++) {
      const result = simulateMatch({
        home: { club: aggressiveTeam, tactic: aggressiveTactic },
        away: { club: cleanTeam, tactic: cleanTactic },
        seed: `red-card-${i}`,
      });

      for (const event of result.events) {
        if (event.type !== 'card' || !event.suspensionMatches) continue;
        expect(event.suspensionMatches).toBeGreaterThanOrEqual(1);
        expect(event.suspensionMatches).toBeLessThanOrEqual(3);
        if (event.team === 'home') aggressiveSuspensions.push(event.suspensionMatches);
        else cleanSuspensions.push(event.suspensionMatches);
      }
    }

    const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
    expect(aggressiveSuspensions.length).toBeGreaterThan(0);
    expect(cleanSuspensions.length).toBeGreaterThan(0);
    expect(average(aggressiveSuspensions)).toBeGreaterThan(average(cleanSuspensions));
  });
});

describe('simulateMatch injuries', () => {
  it('gives a fully fatigued team more injury events than a fresh-legs team, over many simulations', () => {
    const tired = makeClub('tired', 'Tired FC', 70);
    tired.players = tired.players.map((p) => ({ ...p, fatigue: 100 }));
    const fresh = makeClub('fresh', 'Fresh FC', 70, { seed: 'tired' });
    fresh.players = fresh.players.map((p) => ({ ...p, fatigue: 0 }));
    const tiredTactic = makeTactic(tired);
    const freshTactic = makeTactic(fresh);

    let tiredInjuries = 0;
    let freshInjuries = 0;
    const N = 300;

    for (let i = 0; i < N; i++) {
      const result = simulateMatch({
        home: { club: tired, tactic: tiredTactic },
        away: { club: fresh, tactic: freshTactic },
        seed: `injury-${i}`,
      });

      for (const event of result.events) {
        if (event.type !== 'injury') continue;
        if (event.team === 'home') tiredInjuries++;
        else freshInjuries++;
      }
    }

    expect(tiredInjuries).toBeGreaterThan(freshInjuries);
  });

  it('always attaches a 1-8 match absence to injury events', () => {
    const home = makeClub('home-injury', 'Home Injury FC', 70);
    home.players = home.players.map((p) => ({ ...p, fatigue: 100 }));
    const away = makeClub('away-injury', 'Away Injury FC', 70);
    away.players = away.players.map((p) => ({ ...p, fatigue: 100 }));
    const homeTactic = makeTactic(home);
    const awayTactic = makeTactic(away);

    let sawInjury = false;
    for (let i = 0; i < 100; i++) {
      const result = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `injury-length-${i}`,
      });

      for (const event of result.events) {
        if (event.type !== 'injury') continue;
        sawInjury = true;
        expect(event.injuryWeeks).toBeGreaterThanOrEqual(1);
        expect(event.injuryWeeks).toBeLessThanOrEqual(8);
      }
    }

    expect(sawInjury).toBe(true);
  });
});

describe('injury interruptions', () => {
  /** A whole match's worth of minutes in one segment, with a bench, for a side that always gets hurt. */
  function fragileSetup(seedTag: string) {
    const home = makeClub(`home-${seedTag}`, 'Home FC', 70);
    home.players = home.players.map((p) => ({ ...p, fatigue: 100 }));
    const bench = makePlayer(`bench-${seedTag}`, { position: 'ATT' });
    const homeWithBench = { ...home, players: [...home.players, bench] };
    const away = makeClub(`away-${seedTag}`, 'Away FC', 70);
    away.players = away.players.map((p) => ({ ...p, fatigue: 100 }));

    return {
      home: homeWithBench,
      away,
      homeTactic: makeTactic(homeWithBench, {
        lineup: home.players.map((p) => ({ playerId: p.id })),
        substitutes: [{ playerId: bench.id }],
      }),
      awayTactic: makeTactic(away),
      bench,
    };
  }

  /** Runs full matches until one produces a stoppage, so the assertions don't depend on a lucky seed. */
  function firstStoppage(interruptOnInjury: { home?: boolean; away?: boolean }, seedTag: string) {
    const setup = fragileSetup(seedTag);
    for (let i = 0; i < 200; i++) {
      const rng = createResumableRng(`${seedTag}-${i}`);
      const segment = simulateMatchSegment({
        home: { club: setup.home, tactic: setup.homeTactic },
        away: { club: setup.away, tactic: setup.awayTactic },
        rng: rng.next,
        startMinute: 1,
        endMinute: 90,
        interruptOnInjury,
      });
      if (segment.pendingDecision) return { setup, segment };
    }
    throw new Error('no stoppage produced in 200 matches');
  }

  it('stops the clock at the minute of the injury instead of substituting for the manager', () => {
    const { segment } = firstStoppage({ home: true }, 'stop');

    expect(segment.pendingDecision).toMatchObject({ type: 'injury', side: 'home' });
    expect(segment.stoppedAtMinute).toBe(segment.pendingDecision!.minute);
    // Short of the 90 it was asked for: those minutes have not been played and must not be skipped on resume.
    expect(segment.stoppedAtMinute).toBeLessThan(90);
    // The injury itself is recorded, but nobody came on in its place.
    const injuries = segment.events.filter((e) => e.type === 'injury' && e.team === 'home');
    expect(injuries.some((e) => e.playerId === segment.pendingDecision!.playerId)).toBe(true);
    expect(segment.events.some((e) => e.type === 'substitution' && e.team === 'home')).toBe(false);
  });

  it('leaves the opposing side to resolve its own injuries automatically', () => {
    const { segment } = firstStoppage({ home: true }, 'one-sided');
    expect(segment.pendingDecision!.side).toBe('home');
  });

  it('never halts a side nobody is watching — the touchline substitutes as before', () => {
    const setup = fragileSetup('unattended');
    let sawInjury = false;
    let sawSub = false;

    for (let i = 0; i < 200; i++) {
      const result = simulateMatch({
        home: { club: setup.home, tactic: setup.homeTactic },
        away: { club: setup.away, tactic: setup.awayTactic },
        seed: `unattended-${i}`,
      });
      const injuries = result.events.filter((e) => e.type === 'injury' && e.team === 'home');
      if (injuries.length > 0) {
        sawInjury = true;
        if (result.events.some((e) => e.type === 'substitution' && e.team === 'home')) sawSub = true;
      }
    }

    expect(sawInjury).toBe(true);
    expect(sawSub).toBe(true);
  });

  it('records the minutes it did play, so resuming from the stop loses nothing', () => {
    const { setup, segment } = firstStoppage({ home: true }, 'resume');
    const stoppedAt = segment.stoppedAtMinute!;

    // Every event belongs to a minute that was actually played.
    for (const event of segment.events) {
      expect(event.minute).toBeLessThanOrEqual(stoppedAt);
    }
    // And the stop is late enough to be a real mid-match halt, not a degenerate minute-1 case.
    expect(stoppedAt).toBeGreaterThanOrEqual(1);
    expect(setup.homeTactic.lineup).toHaveLength(11);
  });
});

describe('dismissals', () => {
  /** A squad of thugs, so red cards and second yellows show up without needing hundreds of matches. */
  function brawlSetup(seedTag: string) {
    const home = makeClub(`home-${seedTag}`, 'Home FC', 70, { traits: ['AGGRESSIVE'] });
    const away = makeClub(`away-${seedTag}`, 'Away FC', 70, { traits: ['AGGRESSIVE'] });
    return { home, away, homeTactic: makeTactic(home), awayTactic: makeTactic(away) };
  }

  it('sends off a booked player who fouls again, rather than letting them collect yellows all match', () => {
    const setup = brawlSetup('second-yellow');
    let sawSecondYellow = false;

    for (let i = 0; i < 300 && !sawSecondYellow; i++) {
      const result = simulateMatch({
        home: { club: setup.home, tactic: setup.homeTactic },
        away: { club: setup.away, tactic: setup.awayTactic },
        seed: `second-yellow-${i}`,
      });

      const seenYellow = new Set<string>();
      for (const event of result.events) {
        if (event.type !== 'card') continue;
        const key = `${event.team}:${event.playerId}`;
        const isDismissal = event.suspensionMatches !== undefined;
        if (isDismissal && seenYellow.has(key)) sawSecondYellow = true;
        if (!isDismissal) {
          // A player already booked must never pick up a *second* plain yellow: that has to be a dismissal.
          expect(seenYellow.has(key)).toBe(false);
          seenYellow.add(key);
        }
      }
    }

    expect(sawSecondYellow).toBe(true);
  });

  it('halts a watched side at the dismissal so its manager can reshape', () => {
    const setup = brawlSetup('halt-red');
    let halted = null as ReturnType<typeof simulateMatchSegment> | null;

    for (let i = 0; i < 300 && !halted; i++) {
      const rng = createResumableRng(`halt-red-${i}`);
      const segment = simulateMatchSegment({
        home: { club: setup.home, tactic: setup.homeTactic },
        away: { club: setup.away, tactic: setup.awayTactic },
        rng: rng.next,
        startMinute: 1,
        endMinute: 90,
        interruptOnRedCard: { home: true },
      });
      if (segment.pendingDecision) halted = segment;
    }

    expect(halted).not.toBeNull();
    expect(halted!.pendingDecision).toMatchObject({ type: 'redCard', side: 'home' });
    expect(halted!.stoppedAtMinute).toBe(halted!.pendingDecision!.minute);
    const dismissal = halted!.events.find(
      (e) => e.type === 'card' && e.team === 'home' && e.playerId === halted!.pendingDecision!.playerId && e.suspensionMatches !== undefined,
    );
    expect(dismissal).toBeDefined();
  });

  it('never halts for a dismissal nobody asked to be told about', () => {
    const setup = brawlSetup('unwatched-red');
    for (let i = 0; i < 60; i++) {
      const rng = createResumableRng(`unwatched-red-${i}`);
      const segment = simulateMatchSegment({
        home: { club: setup.home, tactic: setup.homeTactic },
        away: { club: setup.away, tactic: setup.awayTactic },
        rng: rng.next,
        startMinute: 1,
        endMinute: 90,
      });
      expect(segment.pendingDecision).toBeUndefined();
    }
  });
});

describe('dismissalSettlingFactor', () => {
  const dismissal = (minute: number): MatchEvent => ({
    minute,
    type: 'card',
    team: 'home',
    playerId: 'p1',
    description: 'red',
    suspensionMatches: 1,
  });

  it('is neutral for a side that has lost nobody', () => {
    expect(dismissalSettlingFactor([], 'home', 40)).toBe(1);
  });

  it('bites hardest in the minute of the card and fades back to neutral', () => {
    const events = [dismissal(30)];
    const atCard = dismissalSettlingFactor(events, 'home', 30);
    const soonAfter = dismissalSettlingFactor(events, 'home', 33);

    expect(atCard).toBeLessThan(1);
    expect(soonAfter).toBeGreaterThan(atCard);
    expect(soonAfter).toBeLessThan(1);
    expect(dismissalSettlingFactor(events, 'home', 40)).toBe(1);
  });

  it('only touches the side that actually lost a player', () => {
    expect(dismissalSettlingFactor([dismissal(30)], 'away', 31)).toBe(1);
  });

  it('restarts the scramble when a second player walks', () => {
    const events = [dismissal(20), { ...dismissal(60), playerId: 'p2' }];
    expect(dismissalSettlingFactor(events, 'home', 61)).toBeLessThan(1);
  });
});

describe('simulateMatch substitutions', () => {
  it('applies a planned substitution at its scheduled minute and emits a matching event', () => {
    const home = makeClub('home-sub', 'Home Sub FC', 70);
    const bench = makePlayer('home-sub-bench', { position: 'ATT', attributes: { pace: 90, finishing: 90, passing: 90, defending: 90, physical: 90, goalkeeping: 10 } });
    const homeWithBench = { ...home, players: [...home.players, bench] };
    const away = makeClub('away-sub', 'Away Sub FC', 70);

    const outPlayerId = home.players[9].id;
    const homeTactic = makeTactic(homeWithBench, {
      lineup: home.players.map((p) => ({ playerId: p.id })),
      substitutes: [{ playerId: bench.id }],
      plannedSubstitutions: [{ id: 'sub1', minute: 46, outPlayerId, inPlayerId: bench.id }],
    });
    const awayTactic = makeTactic(away);

    const result = simulateMatch({
      home: { club: homeWithBench, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      seed: 'sub-test-seed',
    });

    const subEvents = result.events.filter((e) => e.type === 'substitution');
    expect(subEvents).toHaveLength(1);
    expect(subEvents[0].minute).toBe(46);
    expect(subEvents[0].playerId).toBe(outPlayerId);
    expect(subEvents[0].relatedPlayerId).toBe(bench.id);

    // The substitute should never be able to score/miss before minute 46.
    const earlyInvolvement = result.events.some((e) => e.minute < 46 && (e.playerId === bench.id || e.relatedPlayerId === bench.id));
    expect(earlyInvolvement).toBe(false);
  });

  it('stops applying planned substitutions once the side has used all five changes', () => {
    const home = makeClub('home-cap', 'Home Cap FC', 70);
    const bench = Array.from({ length: 10 }, (_, i) => makePlayer(`home-cap-b${i}`, { position: 'MID' }));
    const homeWithBench = { ...home, players: [...home.players, ...bench] };
    const away = makeClub('away-cap', 'Away Cap FC', 70);

    const priorSub = (minute: number, out: string, inn: string): MatchEvent => ({
      minute,
      type: 'substitution',
      team: 'home',
      playerId: out,
      relatedPlayerId: inn,
      description: 'substituição anterior',
    });
    // All five changes were already spent in the first half.
    const priorEvents = [
      priorSub(10, home.players[6].id, bench[6].id),
      priorSub(15, home.players[7].id, bench[7].id),
      priorSub(20, home.players[8].id, bench[8].id),
      priorSub(25, home.players[9].id, bench[9].id),
      priorSub(30, home.players[10].id, bench[5].id),
    ];
    // The current XI already reflects those earlier swaps.
    const currentLineup = [...home.players.slice(0, 6), ...bench.slice(5, 10)];
    const homeTactic = makeTactic(homeWithBench, {
      lineup: currentLineup.map((p) => ({ playerId: p.id })),
      substitutes: bench.map((p) => ({ playerId: p.id })),
      plannedSubstitutions: [
        { id: 'planned-46', minute: 46, outPlayerId: home.players[1].id, inPlayerId: bench[0].id },
        { id: 'planned-50', minute: 50, outPlayerId: home.players[2].id, inPlayerId: bench[1].id },
      ],
    });

    const rng = createResumableRng('sub-cap-exhausted');
    const segment = simulateMatchSegment({
      home: { club: homeWithBench, tactic: homeTactic },
      away: { club: away, tactic: makeTactic(away) },
      rng: rng.next,
      startMinute: 46,
      endMinute: 50,
      priorEvents,
    });

    const homeSubs = segment.events.filter((e) => e.type === 'substitution' && e.team === 'home');
    expect(homeSubs).toHaveLength(0);
  });

  it('applies only as many due planned substitutions as the side has changes left', () => {
    const home = makeClub('home-cap2', 'Home Cap2 FC', 70);
    const bench = Array.from({ length: 10 }, (_, i) => makePlayer(`home-cap2-b${i}`, { position: 'MID' }));
    const homeWithBench = { ...home, players: [...home.players, ...bench] };
    const away = makeClub('away-cap2', 'Away Cap2 FC', 70);

    const priorSub = (minute: number, out: string, inn: string): MatchEvent => ({
      minute,
      type: 'substitution',
      team: 'home',
      playerId: out,
      relatedPlayerId: inn,
      description: 'substituição anterior',
    });
    // Four changes already spent, so exactly one more is available.
    const priorEvents = [
      priorSub(10, home.players[6].id, bench[6].id),
      priorSub(15, home.players[7].id, bench[7].id),
      priorSub(20, home.players[8].id, bench[8].id),
      priorSub(25, home.players[9].id, bench[9].id),
    ];
    const currentLineup = [...home.players.slice(0, 6), ...bench.slice(6, 10), home.players[10]];
    const homeTactic = makeTactic(homeWithBench, {
      lineup: currentLineup.map((p) => ({ playerId: p.id })),
      substitutes: bench.map((p) => ({ playerId: p.id })),
      // Two swaps scheduled for the same minute, but only one change left.
      plannedSubstitutions: [
        { id: 'planned-a', minute: 46, outPlayerId: home.players[1].id, inPlayerId: bench[0].id },
        { id: 'planned-b', minute: 46, outPlayerId: home.players[2].id, inPlayerId: bench[1].id },
      ],
    });

    const rng = createResumableRng('sub-cap-partial');
    const segment = simulateMatchSegment({
      home: { club: homeWithBench, tactic: homeTactic },
      away: { club: away, tactic: makeTactic(away) },
      rng: rng.next,
      startMinute: 46,
      endMinute: 46,
      priorEvents,
      interruptOnInjury: { home: true },
    });

    const homeSubs = segment.events.filter((e) => e.type === 'substitution' && e.team === 'home');
    expect(homeSubs).toHaveLength(1);
  });
});

describe('press recoveries (Feedback Pós-Jogo)', () => {
  it('records more attacking-third recoveries for a HIGH_PRESS side than a LOW_BLOCK side under the same conditions, over many matches', () => {
    const highPressClub = makeClub('high-press', 'Pressão FC', 70);
    const lowBlockClub = makeClub('low-block', 'Bloco FC', 70);
    const opponent = makeClub('opponent-press', 'Rival FC', 70);
    const highPressTactic = makeTactic(highPressClub, { pressing: 'HIGH_PRESS' });
    const lowBlockTactic = makeTactic(lowBlockClub, { pressing: 'LOW_BLOCK' });
    const opponentTactic = makeTactic(opponent);

    let highPressTotal = 0;
    let lowBlockTotal = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const highResult = simulateMatch({ home: { club: highPressClub, tactic: highPressTactic }, away: { club: opponent, tactic: opponentTactic }, seed: `high-${i}` });
      const lowResult = simulateMatch({ home: { club: lowBlockClub, tactic: lowBlockTactic }, away: { club: opponent, tactic: opponentTactic }, seed: `low-${i}` });
      highPressTotal += highResult.stats.home.pressRecoveries;
      lowBlockTotal += lowResult.stats.home.pressRecoveries;
    }

    expect(highPressTotal).toBeGreaterThan(lowBlockTotal);
  });

  it('never attributes more goals to press recoveries than the side actually scored, across many matches', () => {
    const home = makeClub('home-recov', 'Home Recov FC', 75);
    const away = makeClub('away-recov', 'Away Recov FC', 75);
    const homeTactic = makeTactic(home, { pressing: 'HIGH_PRESS' });
    const awayTactic = makeTactic(away, { pressing: 'HIGH_PRESS' });

    for (let i = 0; i < 40; i++) {
      const result = simulateMatch({ home: { club: home, tactic: homeTactic }, away: { club: away, tactic: awayTactic }, seed: `recov-${i}` });
      expect(result.stats.home.goalsFromPressRecovery).toBeLessThanOrEqual(result.stats.home.pressRecoveries);
      expect(result.stats.home.goalsFromPressRecovery).toBeLessThanOrEqual(result.homeGoals);
      expect(result.stats.away.goalsFromPressRecovery).toBeLessThanOrEqual(result.stats.away.pressRecoveries);
      expect(result.stats.away.goalsFromPressRecovery).toBeLessThanOrEqual(result.awayGoals);
    }
  });

  it('resumes press-recovery counters exactly the same as one uninterrupted call', () => {
    const home = makeClub('home-live-press', 'Home Live Press FC', 65);
    const away = makeClub('away-live-press', 'Away Live Press FC', 65);
    const homeTactic = makeTactic(home, { pressing: 'HIGH_PRESS' });
    const awayTactic = makeTactic(away, { pressing: 'HIGH_PRESS' });
    const seed = 'live-resume-press-seed';

    const oneShotRng = createResumableRng(seed);
    const oneShot = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: oneShotRng.next,
      startMinute: 1,
      endMinute: 90,
    });

    const liveRng = createResumableRng(seed);
    const firstHalf = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: liveRng.next,
      startMinute: 1,
      endMinute: 45,
    });
    const resumedRng = resumableRngFromState(liveRng.getState());
    const secondHalf = simulateMatchSegment({
      home: { club: home, tactic: firstHalf.homeTactic },
      away: { club: away, tactic: firstHalf.awayTactic },
      rng: resumedRng.next,
      startMinute: 46,
      endMinute: 90,
      priorEvents: firstHalf.events,
      homeGoals: firstHalf.homeGoals,
      awayGoals: firstHalf.awayGoals,
      homePressRecoveries: firstHalf.homePressRecoveries,
      awayPressRecoveries: firstHalf.awayPressRecoveries,
      homeGoalsFromPressRecovery: firstHalf.homeGoalsFromPressRecovery,
      awayGoalsFromPressRecovery: firstHalf.awayGoalsFromPressRecovery,
    });

    expect(secondHalf.homePressRecoveries).toBe(oneShot.homePressRecoveries);
    expect(secondHalf.awayPressRecoveries).toBe(oneShot.awayPressRecoveries);
    expect(secondHalf.homeGoalsFromPressRecovery).toBe(oneShot.homeGoalsFromPressRecovery);
    expect(secondHalf.awayGoalsFromPressRecovery).toBe(oneShot.awayGoalsFromPressRecovery);
  });
});

describe('simulateMatchSegment resumability (live match pausing)', () => {
  it('splitting a match at halftime and resuming produces the exact same result as one uninterrupted call', () => {
    const home = makeClub('home-live', 'Home Live FC', 65);
    const away = makeClub('away-live', 'Away Live FC', 65);
    const homeTactic = makeTactic(home);
    const awayTactic = makeTactic(away);
    const seed = 'live-resume-seed';

    const oneShotRng = createResumableRng(seed);
    const oneShot = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: oneShotRng.next,
      startMinute: 1,
      endMinute: 90,
    });

    const liveRng = createResumableRng(seed);
    const firstHalf = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: liveRng.next,
      startMinute: 1,
      endMinute: 45,
    });
    // Simulate a pause: persist the rng state, then rebuild it exactly as a server request would.
    const resumedRng = resumableRngFromState(liveRng.getState());
    const secondHalf = simulateMatchSegment({
      // Must resume from whatever the first half's segment actually ended with, not the pristine kickoff
      // tactic — a substitution (planned or emergency) applied in the first half only lives on the
      // segment's own returned tactic (see MatchSegmentResult.homeTactic/awayTactic).
      home: { club: home, tactic: firstHalf.homeTactic },
      away: { club: away, tactic: firstHalf.awayTactic },
      rng: resumedRng.next,
      startMinute: 46,
      endMinute: 90,
      priorEvents: firstHalf.events,
      homeGoals: firstHalf.homeGoals,
      awayGoals: firstHalf.awayGoals,
      homeShots: firstHalf.homeShots,
      awayShots: firstHalf.awayShots,
    });

    expect(secondHalf.homeGoals).toBe(oneShot.homeGoals);
    expect(secondHalf.awayGoals).toBe(oneShot.awayGoals);
    expect(secondHalf.homeShots).toBe(oneShot.homeShots);
    expect(secondHalf.awayShots).toBe(oneShot.awayShots);
    expect([...firstHalf.events, ...secondHalf.events]).toEqual(oneShot.events);
  });
});

describe('simulateMatch penalties', () => {
  it('uses the designated penalty taker (never a different scorer) across many simulations that award a penalty', () => {
    const home = makeClub('home-pen', 'Home Pen FC', 70);
    const away = makeClub('away-pen', 'Away Pen FC', 70);
    const takerId = home.players.find((p) => p.position === 'ATT')!.id;

    let sawPenalty = false;
    for (let i = 0; i < 150; i++) {
      const homeTactic = makeTactic(home, { penaltyTakerId: takerId });
      const awayTactic = makeTactic(away);
      const result = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `pen-test-${i}`,
      });

      for (const event of result.events) {
        if (event.team !== 'home' || !event.isPenalty) continue;
        // A taker already sent off or carried off can't step up — somebody else has to, and that's the
        // point of the fallback. Events earlier in the same minute don't count: chances resolve before
        // fouls and injuries do, so the taker was still on when this kick was awarded.
        const goneByNow = offPitchPlayerIds(
          result.events.filter((e) => e.minute < event.minute),
          'home',
        );
        if (goneByNow.has(takerId)) continue;
        sawPenalty = true;
        expect(event.playerId).toBe(takerId);
      }
    }

    expect(sawPenalty).toBe(true);
  });
});

describe('simulateMatch xG and chained events', () => {
  it('populates xG and advanced stats (saves, bigChances, woodwork, blockedShots)', () => {
    const home = makeClub('home-xg', 'Home xG FC', 75);
    const away = makeClub('away-xg', 'Away xG FC', 75);
    const homeTactic = makeTactic(home);
    const awayTactic = makeTactic(away);

    const result = simulateMatch({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      seed: 'xg-test-sample-1',
    });

    expect(typeof result.stats.home.xg).toBe('number');
    expect(typeof result.stats.away.xg).toBe('number');
    expect(result.stats.home.xg).toBeGreaterThanOrEqual(0);
    expect(result.stats.away.xg).toBeGreaterThanOrEqual(0);
    expect(result.stats.home.bigChances).toBeGreaterThanOrEqual(0);
    expect(result.stats.home.saves).toBeGreaterThanOrEqual(0);
    expect(result.stats.home.woodwork).toBeGreaterThanOrEqual(0);
    expect(result.stats.home.blockedShots).toBeGreaterThanOrEqual(0);

    for (const event of result.events) {
      if (event.type === 'goal' || event.type === 'chance') {
        expect(typeof event.xg).toBe('number');
        expect(event.xg).toBeGreaterThan(0);
        expect(event.shotOutcome).toBeDefined();
        expect(event.shotType).toBeDefined();
      }
    }
  });

  it('makes an explicit low/deep block yield more long-range attempts without changing legacy shot selection', () => {
    const club = makeClub('line-shots', 'Line Shots FC', 70);
    const deep = makeTactic(club, { defensiveLine: 'DEEP', pressing: 'LOW_BLOCK' });
    const balanced = makeTactic(club, { defensiveLine: 'BALANCED', pressing: 'MEDIUM' });
    const legacy = makeTactic(club, { defensiveLine: undefined, pressing: 'MEDIUM' });
    const keys = club.players.flatMap((player) =>
      Array.from({ length: 90 }, (_, minute) => `${player.id}-${minute + 1}`),
    );
    const countLongShots = (tactic: ReturnType<typeof makeTactic>) =>
      keys.filter((key) => shotTypeForChance(tactic, key) === 'LONG_SHOT').length;

    expect(countLongShots(deep)).toBeGreaterThan(countLongShots(balanced));
    expect(countLongShots(legacy)).toBe(countLongShots(balanced));
  });
});

describe('post-loss transition: COUNTERPRESS vs RECOMPOSE (Fase 2)', () => {
  it('RECOMPOSE on both sides never attempts a counterpress or creates disorganization', () => {
    const home = makeClub('recompose-home', 'Recompose Home FC', 70);
    const away = makeClub('recompose-away', 'Recompose Away FC', 70);
    const homeTactic = makeTactic(home, { transitionStyle: 'RECOMPOSE' });
    const awayTactic = makeTactic(away, { transitionStyle: 'RECOMPOSE' });

    const result = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: createResumableRng('recompose-both').next,
      startMinute: 1,
      endMinute: 90,
    });

    expect(result.homeAdvancedCounterpressRecoveries).toBe(0);
    expect(result.awayAdvancedCounterpressRecoveries).toBe(0);
    expect(result.homeFailedCounterpresses).toBe(0);
    expect(result.awayFailedCounterpresses).toBe(0);
    expect(result.homeDisorganized).toBe(false);
    expect(result.awayDisorganized).toBe(false);
  });

  it('rolls the transition exactly once per side per minute when COUNTERPRESS is set (fixed draw count, not conditional on a chance occurring)', () => {
    const home = makeClub('cp-count-home', 'CP Count Home FC', 70);
    const away = makeClub('cp-count-away', 'CP Count Away FC', 70);
    const homeTactic = makeTactic(home, { transitionStyle: 'COUNTERPRESS' });
    const awayTactic = makeTactic(away, { transitionStyle: 'COUNTERPRESS' });

    const result = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: createResumableRng('cp-count').next,
      startMinute: 1,
      endMinute: 90,
    });

    expect(result.homeAdvancedCounterpressRecoveries + result.homeFailedCounterpresses).toBe(90);
    expect(result.awayAdvancedCounterpressRecoveries + result.awayFailedCounterpresses).toBe(90);
  });

  it('a collective favored on teamwork/anticipation succeeds its counterpress more often than the same collective placed on the receiving side, over many matches', () => {
    const strongPress = withCollective(makeClub('cp-strong-press', 'CP Strong Press FC', 70), {
      commitment: 95,
      traits: ['LEADER'],
      anticipation: 95,
      fatigue: 0,
    });
    const weakReceive = withCollective(makeClub('cp-weak-receive', 'CP Weak Receive FC', 70), {
      ballControl: 10,
      morale: 10,
      traits: ['TEMPERAMENTAL'],
      fatigue: 80,
    });
    const strongTactic = makeTactic(strongPress, { transitionStyle: 'COUNTERPRESS' });
    const weakTactic = makeTactic(weakReceive, { transitionStyle: 'COUNTERPRESS' });

    let favoredRecoveries = 0;
    let unfavoredRecoveries = 0;
    const N = 30;
    for (let i = 0; i < N; i++) {
      // Favored pressing side at home.
      const favored = simulateMatchSegment({
        home: { club: strongPress, tactic: strongTactic },
        away: { club: weakReceive, tactic: weakTactic },
        rng: createResumableRng(`cp-favored-${i}`).next,
        startMinute: 1,
        endMinute: 90,
      });
      favoredRecoveries += favored.homeAdvancedCounterpressRecoveries;

      // Same collectives, roles swapped: the weak collective now presses, the strong one receives.
      const unfavored = simulateMatchSegment({
        home: { club: weakReceive, tactic: weakTactic },
        away: { club: strongPress, tactic: strongTactic },
        rng: createResumableRng(`cp-unfavored-${i}`).next,
        startMinute: 1,
        endMinute: 90,
      });
      unfavoredRecoveries += unfavored.homeAdvancedCounterpressRecoveries;
    }

    expect(favoredRecoveries).toBeGreaterThan(unfavoredRecoveries);
  });

  it('a side using COUNTERPRESS against a heavily favored opponent concedes more shots than the same matchup with RECOMPOSE, over many matches (disorganization bonus)', () => {
    // A badly overmatched collective (low teamwork/anticipation, exhausted) fails its counterpress duel far
    // more often than it succeeds, so switching it from RECOMPOSE (never disorganizes) to COUNTERPRESS
    // (fails often, handing its opponent the very next sequence at a boosted rate) should measurably raise
    // the opponent's shot count without changing anything else about the matchup.
    const weakPress = withCollective(makeClub('disorg-away', 'Disorg Away FC', 60), {
      commitment: 5,
      traits: ['UNDISCIPLINED'],
      anticipation: 5,
      fatigue: 95,
    });
    const strongReceive = withCollective(makeClub('disorg-home', 'Disorg Home FC', 60), {
      ballControl: 95,
      morale: 90,
      fatigue: 0,
    });

    const counterpressTactic = makeTactic(weakPress, { transitionStyle: 'COUNTERPRESS' });
    const recomposeTactic = makeTactic(weakPress, { transitionStyle: 'RECOMPOSE' });
    const homeTactic = makeTactic(strongReceive);

    let shotsWithCounterpressAway = 0;
    let shotsWithRecomposeAway = 0;
    const N = 40;
    for (let i = 0; i < N; i++) {
      const withCp = simulateMatch({
        home: { club: strongReceive, tactic: homeTactic },
        away: { club: weakPress, tactic: counterpressTactic },
        seed: `disorg-cp-${i}`,
      });
      shotsWithCounterpressAway += withCp.stats.home.shots;

      const withRecompose = simulateMatch({
        home: { club: strongReceive, tactic: homeTactic },
        away: { club: weakPress, tactic: recomposeTactic },
        seed: `disorg-recompose-${i}`,
      });
      shotsWithRecomposeAway += withRecompose.stats.home.shots;
    }

    expect(shotsWithCounterpressAway).toBeGreaterThan(shotsWithRecomposeAway);
  });

  it('HIGH_PRESS + attacking mentality falls back to COUNTERPRESS for old tactics with no explicit transitionStyle, while any other old combination falls back to RECOMPOSE', () => {
    const home = makeClub('legacy-cp-home', 'Legacy CP Home FC', 70);
    const away = makeClub('legacy-cp-away', 'Legacy CP Away FC', 70);
    // No transitionStyle set: HIGH_PRESS + attacking should read as COUNTERPRESS per transitionStyleOf.
    const homeTactic = makeTactic(home, { pressing: 'HIGH_PRESS', mentality: 'attacking' });
    // No transitionStyle set, balanced mentality: should read as RECOMPOSE.
    const awayTactic = makeTactic(away, { pressing: 'HIGH_PRESS', mentality: 'balanced' });

    const result = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: createResumableRng('legacy-fallback').next,
      startMinute: 1,
      endMinute: 90,
    });

    expect(result.homeAdvancedCounterpressRecoveries + result.homeFailedCounterpresses).toBe(90);
    expect(result.awayAdvancedCounterpressRecoveries + result.awayFailedCounterpresses).toBe(0);
  });

  it('resumes disorganization flags and counterpress counters exactly the same as one uninterrupted call', () => {
    const home = makeClub('cp-live-home', 'CP Live Home FC', 65);
    const away = makeClub('cp-live-away', 'CP Live Away FC', 65);
    const homeTactic = makeTactic(home, { transitionStyle: 'COUNTERPRESS' });
    const awayTactic = makeTactic(away, { transitionStyle: 'COUNTERPRESS' });
    const seed = 'live-resume-cp-seed';

    const oneShotRng = createResumableRng(seed);
    const oneShot = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: oneShotRng.next,
      startMinute: 1,
      endMinute: 90,
    });

    const liveRng = createResumableRng(seed);
    const firstHalf = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: liveRng.next,
      startMinute: 1,
      endMinute: 45,
    });
    const resumedRng = resumableRngFromState(liveRng.getState());
    const secondHalf = simulateMatchSegment({
      home: { club: home, tactic: firstHalf.homeTactic },
      away: { club: away, tactic: firstHalf.awayTactic },
      rng: resumedRng.next,
      startMinute: 46,
      endMinute: 90,
      priorEvents: firstHalf.events,
      homeGoals: firstHalf.homeGoals,
      awayGoals: firstHalf.awayGoals,
      homeDisorganized: firstHalf.homeDisorganized,
      awayDisorganized: firstHalf.awayDisorganized,
      homeAdvancedCounterpressRecoveries: firstHalf.homeAdvancedCounterpressRecoveries,
      awayAdvancedCounterpressRecoveries: firstHalf.awayAdvancedCounterpressRecoveries,
      homeFailedCounterpresses: firstHalf.homeFailedCounterpresses,
      awayFailedCounterpresses: firstHalf.awayFailedCounterpresses,
    });

    expect(secondHalf.homeAdvancedCounterpressRecoveries).toBe(oneShot.homeAdvancedCounterpressRecoveries);
    expect(secondHalf.awayAdvancedCounterpressRecoveries).toBe(oneShot.awayAdvancedCounterpressRecoveries);
    expect(secondHalf.homeFailedCounterpresses).toBe(oneShot.homeFailedCounterpresses);
    expect(secondHalf.awayFailedCounterpresses).toBe(oneShot.awayFailedCounterpresses);
    expect(secondHalf.homeDisorganized).toBe(oneShot.homeDisorganized);
    expect(secondHalf.awayDisorganized).toBe(oneShot.awayDisorganized);
    expect([...firstHalf.events, ...secondHalf.events]).toEqual(oneShot.events);
  });
});

describe('star player individual impact & solo brilliance', () => {
  it('makes a 90-rated superstar striker in a modest team heavily outscore a generic forward', () => {
    const opponent = makeClub('opp', 'Opponent FC', 60);
    const oppTactic = makeTactic(opponent);

    let starGoals = 0;
    let genericGoals = 0;
    let soloPhrasesSeen = 0;

    for (let i = 0; i < 25; i++) {
      const modestClub = makeClub('modest', 'Modest FC', 55);
      const modestTactic = makeTactic(modestClub);
      const starClub = {
        ...modestClub,
        players: modestClub.players.map((p, idx) =>
          idx === 9
            ? { ...p, overall: 92, starLevel: 'NATURAL' as const, attributes: { ...p.attributes, finishing: 94, pace: 92 } }
            : p,
        ),
      };
      const starTactic = makeTactic(starClub);

      const resStar = simulateMatch({
        home: { club: starClub, tactic: starTactic },
        away: { club: opponent, tactic: oppTactic },
        seed: `star-test-${i}`,
      });
      const resGeneric = simulateMatch({
        home: { club: modestClub, tactic: modestTactic },
        away: { club: opponent, tactic: oppTactic },
        seed: `star-test-${i}`,
      });

      const starPlayerId = starClub.players[9].id;
      const genericPlayerId = modestClub.players[9].id;

      starGoals += resStar.events.filter((e) => e.type === 'goal' && e.team === 'home' && e.playerId === starPlayerId).length;
      genericGoals += resGeneric.events.filter((e) => e.type === 'goal' && e.team === 'home' && e.playerId === genericPlayerId).length;

      for (const ev of resStar.events) {
        if (ev.type === 'goal' && (ev.description.includes('Lampejo de craque') || ev.description.includes('Pintura') || ev.description.includes('Genialidade') || ev.description.includes('Decidiu sozinho') || ev.description.includes('Golaço espetacular'))) {
          soloPhrasesSeen++;
        }
      }
    }

    expect(starGoals).toBeGreaterThan(genericGoals);
    expect(soloPhrasesSeen).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { simulateMatch, simulateMatchSegment } from './engine.js';
import { createRng } from './rng.js';
import type { MatchEvent } from '../domain/match.js';
import { generateStarterSquad } from '../domain/squadGenerator.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';
import { makeClub } from './testFactories.js';

/**
 * What a match should look like, held against real top-flight football.
 *
 * The engine has a lot of dials that all feed the same funnel — chance rate, conversion, tactical
 * multipliers, the venue effect, the numerical handicap — and every one of them was calibrated against a
 * target of its own. Nothing was watching the *result*: for a long time the engine produced 4 shots and 1.0
 * goals a match, 35% of them nil-nil, because each dial was individually defensible and nobody added them
 * up. This is the check that adds them up.
 *
 * Bands, not exact figures, and deliberately wide enough that ordinary tuning elsewhere doesn't trip them —
 * but narrow enough that the scoreline can't quietly drift back to something no football match resembles.
 * Full numbers live in scripts/match-profile.ts.
 */
describe('match profile against real football', () => {
  function club(id: string, seed: string, skill?: number) {
    return { ...makeClub(id, id, 70), players: generateStarterSquad(id, 'BRA', seed, skill) };
  }

  const home = club('home-profile', 'profile-squad');
  const away = club('away-profile', 'profile-squad');
  const homeTactic = { ...autoFillLineup(home), clubId: home.id };
  const awayTactic = { ...autoFillLineup(away), clubId: away.id };

  const N = 2000;
  const totals = {
    goals: 0,
    draws: 0,
    shots: 0,
    onTarget: 0,
    corners: 0,
    nilNil: 0,
    homeWins: 0,
    awayWins: 0,
    fouls: 0,
    yellows: 0,
    reds: 0,
    injuries: 0,
  };

  for (let i = 0; i < N; i++) {
    const r = simulateMatch({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      seed: `profile-${i}`,
    });
    totals.goals += r.homeGoals + r.awayGoals;
    totals.shots += r.stats.home.shots + r.stats.away.shots;
    totals.onTarget += r.stats.home.shotsOnTarget + r.stats.away.shotsOnTarget;
    totals.corners += r.stats.home.corners + r.stats.away.corners;
    totals.fouls += r.stats.home.fouls + r.stats.away.fouls;
    for (const e of r.events) {
      if (e.type === 'card') e.suspensionMatches === undefined ? totals.yellows++ : totals.reds++;
      if (e.type === 'injury') totals.injuries++;
    }
    if (r.homeGoals === r.awayGoals) totals.draws++;
    else if (r.homeGoals > r.awayGoals) totals.homeWins++;
    else totals.awayWins++;
    if (r.homeGoals === 0 && r.awayGoals === 0) totals.nilNil++;
  }

  it('scores about as often as a real match does', () => {
    const perMatch = totals.goals / N;
    expect(perMatch).toBeGreaterThan(2.3); // real ~2.7
    expect(perMatch).toBeLessThan(3.1);
  });

  it('draws about as often as a real league does', () => {
    const rate = totals.draws / N;
    expect(rate).toBeGreaterThan(0.2); // real ~0.25
    expect(rate).toBeLessThan(0.32);
  });

  it('does not fill the fixture list with goalless draws', () => {
    expect(totals.nilNil / N).toBeLessThan(0.12); // real ~7%
  });

  it('produces a believable number of attempts, and converts them at a believable rate', () => {
    const shots = totals.shots / N;
    expect(shots).toBeGreaterThan(20); // real ~25
    expect(shots).toBeLessThan(31);

    const conversion = totals.goals / totals.shots;
    expect(conversion).toBeGreaterThan(0.08); // real ~10.5%
    expect(conversion).toBeLessThan(0.14);
  });

  it('puts about a third of the attempts on target', () => {
    const share = totals.onTarget / totals.shots;
    expect(share).toBeGreaterThan(0.27); // real ~34%
    expect(share).toBeLessThan(0.42);
  });

  /**
   * A real match takes 25 shots, and a commentary that reports all of them is unreadable — two thirds of it
   * would be "manda para fora". Only the attempts that forced a save get spoken about; the rest exist in
   * the shot count and nowhere else, the way a broadcast handles them.
   *
   * This also keeps the two systems that read the timeline in the range they were designed for: player
   * ratings award a small bonus per chance, and the momentum bar weighs them, and both were tuned when a
   * match produced a handful of events rather than dozens.
   */
  it('narrates the attempts worth narrating and leaves the rest to the stat line', () => {
    let narrated = 0;
    let offTargetNarrated = 0;
    const K = 500;

    for (let i = 0; i < K; i++) {
      const r = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `feed-${i}`,
      });
      narrated += r.events.length;

      // Every open-play chance in the timeline should be one the keeper had to deal with. Count them
      // against the on-target tally: narrating more of those than were on target would mean off-target
      // efforts leaked back into the feed.
      const openChances = r.events.filter((e) => e.type === 'chance' && !e.isPenalty).length;
      const goals = r.events.filter((e) => e.type === 'goal').length;
      const onTarget = r.stats.home.shotsOnTarget + r.stats.away.shotsOnTarget;
      if (openChances + goals > onTarget) offTargetNarrated++;
    }

    expect(offTargetNarrated).toBe(0);
    // Comfortably readable: goals, saves, cards, substitutions and injuries, not a wall of missed shots.
    expect(narrated / K).toBeLessThan(18);
    expect(narrated / K).toBeGreaterThan(6);
  });

  /**
   * Injuries here are only the incapacitating kind: play stops and the manager has to use a
   * substitution. That is roughly a third of all time-loss injuries (UEFA's ~25 per 1000 match hours
   * works out near 0.8 a match, but most of those are reported after the whistle), so about one every
   * three matches.
   *
   * This assertion exists because the rate was 1.61 a match for a long time, five times reality, and
   * nothing caught it: every OTHER dial looked right, and the extra men limping off were quietly
   * propping up the scoreline. Which is exactly why it belongs in this file, next to the numbers it
   * distorts, and not in a test of its own.
   */
  it('does not send more players off injured than real football does', () => {
    const perMatch = totals.injuries / N;
    expect(perMatch).toBeGreaterThan(0.12); // real ~0.3
    expect(perMatch).toBeLessThan(0.6);
  });

  it('wins about as many corners as a real match', () => {
    const perMatch = totals.corners / N;
    expect(perMatch).toBeGreaterThan(8); // real ~10.2
    expect(perMatch).toBeLessThan(15);
  });

  /**
   * Discipline is held against the **Brasileirão**, not a European average: 24.6 fouls, 4.42 yellows and
   * 0.27 reds a match. It is the second most foul-heavy national league in the world and it is the one this
   * game models, so borrowing European numbers would set the bar about a fifth too low.
   */
  it('is refereed as often as a Brazilian match is', () => {
    const fouls = totals.fouls / N;
    expect(fouls).toBeGreaterThan(21); // real ~24.6
    expect(fouls).toBeLessThan(29);
  });

  it('books and dismisses players at roughly the real rate', () => {
    const yellows = totals.yellows / N;
    expect(yellows).toBeGreaterThan(3.4); // real ~4.42
    expect(yellows).toBeLessThan(5.6);

    // Rare enough that a dismissal still means something: about one match in four, not one a game.
    const reds = totals.reds / N;
    expect(reds).toBeGreaterThan(0.15); // real ~0.27
    expect(reds).toBeLessThan(0.45);
  });

  it('splits results the way a real league table does', () => {
    // Real top-flight: roughly 44% home wins, 25% draws, 31% away wins.
    expect(totals.homeWins / N).toBeGreaterThan(0.38);
    expect(totals.homeWins / N).toBeLessThan(0.5);
    expect(totals.awayWins / N).toBeGreaterThan(0.25);
    expect(totals.awayWins / N).toBeLessThan(0.36);
  });

  /**
   * The numerical-disadvantage fit, against Vecer, Kopriva & Ichiba (JQAS 2009): a side reduced to ten
   * scores at roughly 0.67 of its previous rate while its opponent scores at roughly 1.20 of theirs.
   *
   * Pinned here rather than in numericalDisadvantage.test.ts because it is not a property of those
   * constants alone — it runs through the whole chance-and-conversion funnel, and quietly lost half its
   * bite the first time that funnel's scale was corrected. Direction alone is not enough to catch that.
   */
  it('keeps a dismissal costing what the research says it costs', () => {
    function goalsWith(priorEvents: MatchEvent[]) {
      let mine = 0;
      let theirs = 0;
      const K = 800;
      for (let i = 0; i < K; i++) {
        const s = simulateMatchSegment({
          home: { club: home, tactic: homeTactic },
          away: { club: away, tactic: awayTactic },
          rng: createRng(`vecer-${i}`),
          startMinute: 1,
          endMinute: 90,
          priorEvents,
        });
        mine += s.homeGoals;
        theirs += s.awayGoals;
      }
      return { mine: mine / K, theirs: theirs / K };
    }

    const full = goalsWith([]);
    // Someone actually in the eleven: sending off a substitute would change nothing and pass vacuously.
    const short = goalsWith([
      {
        minute: 1,
        type: 'card',
        team: 'home',
        playerId: homeTactic.lineup[5].playerId,
        description: 'expulso',
        suspensionMatches: 1,
      },
    ]);

    const ownRate = short.mine / full.mine;
    const opponentRate = short.theirs / full.theirs;

    expect(ownRate).toBeGreaterThan(0.58); // target 0.67
    expect(ownRate).toBeLessThan(0.78);
    expect(opponentRate).toBeGreaterThan(1.1); // target 1.20
    expect(opponentRate).toBeLessThan(1.32);
  });

  it('still lets a far better side dominate a far worse one', () => {
    const strong = club('strong-profile', 'strong', 90);
    const weak = club('weak-profile', 'weak', 30);
    const strongTactic = { ...autoFillLineup(strong), clubId: strong.id };
    const weakTactic = { ...autoFillLineup(weak), clubId: weak.id };

    let strongWins = 0;
    let strongShots = 0;
    let weakShots = 0;
    const M = 400;
    for (let i = 0; i < M; i++) {
      const r = simulateMatch({
        home: { club: strong, tactic: strongTactic },
        away: { club: weak, tactic: weakTactic },
        seed: `mismatch-${i}`,
      });
      if (r.homeGoals > r.awayGoals) strongWins++;
      strongShots += r.stats.home.shots;
      weakShots += r.stats.away.shots;
    }

    // Rescaling the funnel must not flatten the league into a coin toss.
    expect(strongWins / M).toBeGreaterThan(0.85);
    expect(strongShots).toBeGreaterThan(weakShots * 2);
  });
});

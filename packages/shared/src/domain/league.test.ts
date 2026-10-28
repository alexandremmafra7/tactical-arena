import { describe, it, expect } from 'vitest';
import { computeStandings, generateDoubleRoundRobinFixtures } from './league.js';

describe('generateDoubleRoundRobinFixtures', () => {
  it('produces 2*(N-1) rounds with N/2 matches each, for a 4-club league', () => {
    const clubIds = ['A', 'B', 'C', 'D'];
    const fixtures = generateDoubleRoundRobinFixtures(clubIds);

    const rounds = new Set(fixtures.map((f) => f.round));
    expect(rounds.size).toBe(2 * (clubIds.length - 1));
    expect(fixtures.length).toBe(rounds.size * (clubIds.length / 2));
  });

  it('has every club play every other club exactly once at home and once away', () => {
    const clubIds = ['A', 'B', 'C', 'D', 'E', 'F'];
    const fixtures = generateDoubleRoundRobinFixtures(clubIds);

    for (const a of clubIds) {
      for (const b of clubIds) {
        if (a === b) continue;
        const aHomeVsB = fixtures.filter((f) => f.homeClubId === a && f.awayClubId === b);
        expect(aHomeVsB).toHaveLength(1);
      }
    }
  });

  it('never schedules the same club twice in the same round', () => {
    const clubIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const fixtures = generateDoubleRoundRobinFixtures(clubIds);

    const byRound = new Map<number, string[]>();
    for (const f of fixtures) {
      const clubs = byRound.get(f.round) ?? [];
      clubs.push(f.homeClubId, f.awayClubId);
      byRound.set(f.round, clubs);
    }

    for (const [, clubs] of byRound) {
      expect(new Set(clubs).size).toBe(clubs.length);
    }
  });

  it('rejects an odd number of clubs', () => {
    expect(() => generateDoubleRoundRobinFixtures(['A', 'B', 'C'])).toThrow();
  });

  it('produces different fixture orders with different seeds', () => {
    const clubIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const fixtures1 = generateDoubleRoundRobinFixtures(clubIds, 'season-2026-alpha');
    const fixtures2 = generateDoubleRoundRobinFixtures(clubIds, 'season-2026-beta');

    // As ordens das partidas na rodada 1 devem diferir devido ao sorteio com seed
    const round1Fixtures1 = fixtures1.filter(f => f.round === 1);
    const round1Fixtures2 = fixtures2.filter(f => f.round === 1);

    expect(round1Fixtures1).not.toEqual(round1Fixtures2);
  });
});

describe('computeStandings', () => {
  it('computes points, goal difference and tie-breaking order for a hand-built set of results', () => {
    const clubIds = ['A', 'B', 'C'];
    const results = [
      { homeClubId: 'A', awayClubId: 'B', homeGoals: 3, awayGoals: 0 }, // A win
      { homeClubId: 'B', awayClubId: 'C', homeGoals: 1, awayGoals: 1 }, // draw
      { homeClubId: 'C', awayClubId: 'A', homeGoals: 2, awayGoals: 2 }, // draw
    ];

    const standings = computeStandings(clubIds, results);

    const a = standings.find((s) => s.clubId === 'A')!;
    expect(a.played).toBe(2);
    expect(a.wins).toBe(1);
    expect(a.draws).toBe(1);
    expect(a.points).toBe(4);
    expect(a.goalsFor).toBe(5);
    expect(a.goalsAgainst).toBe(2);

    // A (4 pts) should rank above B and C (1 pt each).
    expect(standings[0].clubId).toBe('A');
  });

  it('breaks ties by goal difference when points are equal', () => {
    const clubIds = ['A', 'B', 'C', 'D'];
    const results = [
      { homeClubId: 'A', awayClubId: 'B', homeGoals: 5, awayGoals: 0 }, // A: 3pts, GD +5; B: 0pts, GD -5
      { homeClubId: 'C', awayClubId: 'D', homeGoals: 1, awayGoals: 0 }, // C: 3pts, GD +1; D: 0pts, GD -1
    ];

    const standings = computeStandings(clubIds, results);

    // A and C tie on 3 points; A's bigger goal difference ranks it first. D and B tie on 0 points; D's
    // milder goal difference ranks it above B.
    expect(standings.map((s) => s.clubId)).toEqual(['A', 'C', 'D', 'B']);
  });
});

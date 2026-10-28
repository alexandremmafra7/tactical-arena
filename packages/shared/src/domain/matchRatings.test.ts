import { describe, it, expect } from 'vitest';
import { calculateMatchRatings, findManOfTheMatch } from './matchRatings.js';
import type { MatchEvent } from './match.js';
import { makePlayer } from '../simulation/testFactories.js';

describe('calculateMatchRatings', () => {
  it('gives every starter a base rating with no events and a draw', () => {
    const home = [makePlayer('h1'), makePlayer('h2')];
    const away = [makePlayer('a1'), makePlayer('a2')];
    const { home: homeRatings, away: awayRatings } = calculateMatchRatings(home, away, [], 0, 0);
    expect(homeRatings.every((r) => r.rating === 6.0)).toBe(true);
    expect(awayRatings.every((r) => r.rating === 6.0)).toBe(true);
  });

  it('rewards a goal, penalizes cards, and gives a small bump for winning', () => {
    const home = [makePlayer('h1'), makePlayer('h2')];
    const away = [makePlayer('a1')];
    const events: MatchEvent[] = [
      { minute: 10, type: 'goal', team: 'home', playerId: 'h1', description: 'Gol!' },
      { minute: 20, type: 'card', team: 'home', playerId: 'h2', description: 'Cartão amarelo' },
      { minute: 30, type: 'card', team: 'away', playerId: 'a1', description: 'Cartão vermelho', suspensionMatches: 2 },
    ];
    const { home: homeRatings, away: awayRatings } = calculateMatchRatings(home, away, events, 1, 0);

    const scorer = homeRatings.find((r) => r.playerId === 'h1')!;
    const yellowCarded = homeRatings.find((r) => r.playerId === 'h2')!;
    const redCarded = awayRatings.find((r) => r.playerId === 'a1')!;

    expect(scorer.rating).toBeGreaterThan(6.0);
    expect(yellowCarded.rating).toBeLessThan(6.3); // won the match (+0.3) but yellow card (-0.3) cancels it out
    expect(redCarded.rating).toBeLessThan(5.0); // lost (-0.3) and a red card (-1.5)
  });

  it('clamps ratings to the 0-10 range', () => {
    const home = [makePlayer('h1')];
    const events: MatchEvent[] = Array.from({ length: 10 }, (_, i) => ({
      minute: i + 1,
      type: 'goal' as const,
      team: 'home' as const,
      playerId: 'h1',
      description: 'Gol!',
    }));
    const { home: homeRatings } = calculateMatchRatings(home, [], events, 10, 0);
    expect(homeRatings[0].rating).toBeLessThanOrEqual(10);
  });
});

describe('findManOfTheMatch', () => {
  it('picks the single highest-rated player across both sides', () => {
    const home = [makePlayer('h1'), makePlayer('h2')];
    const away = [makePlayer('a1')];
    const events: MatchEvent[] = [{ minute: 10, type: 'goal', team: 'away', playerId: 'a1', description: 'Gol!' }];
    const { home: homeRatings, away: awayRatings } = calculateMatchRatings(home, away, events, 0, 1);
    const motm = findManOfTheMatch(homeRatings, awayRatings, 0, 1);
    expect(motm?.playerId).toBe('a1');
  });

  it('breaks a rating tie in favor of the winning side', () => {
    const home = [makePlayer('h1')];
    const away = [makePlayer('a1')];
    const { home: homeRatings, away: awayRatings } = calculateMatchRatings(home, away, [], 1, 0);
    const motm = findManOfTheMatch(homeRatings, awayRatings, 1, 0);
    expect(motm?.side).toBe('home');
  });

  it('returns null when there are no players at all', () => {
    expect(findManOfTheMatch([], [], 0, 0)).toBeNull();
  });
});

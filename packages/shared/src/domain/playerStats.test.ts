import { describe, it, expect } from 'vitest';
import { makePlayer, makeClub } from '../simulation/testFactories.js';
import { aggregateClubPlayerStats, applyMatchEventsToPlayers, resetPlayerSeasonStats, applyBackgroundResultToPlayers } from './playerStats.js';

describe('Player Stats & Dynamic Career In-Game System', () => {
  it('starts players with 0 stats by default on Day 1', () => {
    const player = makePlayer('p1', { name: 'New Star' });
    expect(player.seasonGoals).toBe(0);
    expect(player.seasonAssists).toBe(0);
    expect(player.seasonMatches).toBe(0);
    expect(player.careerGoals).toBe(0);
    expect(player.careerAssists).toBe(0);
    expect(player.careerMatches).toBe(0);
  });

  it('updates player stats correctly from match events', () => {
    let player = makePlayer('p1', { name: 'Striker' });
    const events = [
      { type: 'goal', playerId: 'p1', assistPlayerId: 'p2' },
      { type: 'goal', playerId: 'p1' },
    ];
    const playedMinutes = new Map([['p1', 90]]);

    const updated = applyMatchEventsToPlayers([player], events, playedMinutes);
    expect(updated[0].seasonGoals).toBe(2);
    expect(updated[0].seasonMatches).toBe(1);
    expect(updated[0].careerGoals).toBe(2);
    expect(updated[0].careerMatches).toBe(1);
  });

  it('accumulates career stats and resets season stats on season turn', () => {
    let player = makePlayer('p1', {
      name: 'Veteran',
      seasonGoals: 25,
      seasonAssists: 10,
      seasonMatches: 38,
      careerGoals: 50,
      careerAssists: 20,
      careerMatches: 100,
    });

    const reset = resetPlayerSeasonStats(player);
    expect(reset.seasonGoals).toBe(0);
    expect(reset.seasonAssists).toBe(0);
    expect(reset.seasonMatches).toBe(0);
    expect(reset.careerGoals).toBe(75);
    expect(reset.careerAssists).toBe(30);
    expect(reset.careerMatches).toBe(138);
  });

  it('aggregates league and world top scorers and assistants correctly', () => {
    const clubA = makeClub('club-a', 'Flamengo', 80, { seed: 'a' });
    clubA.players[0].seasonGoals = 15;
    clubA.players[0].seasonAssists = 5;
    clubA.players[0].seasonMatches = 20;

    const clubB = makeClub('club-b', 'Palmeiras', 80, { seed: 'b' });
    clubB.players[0].seasonGoals = 18;
    clubB.players[0].seasonAssists = 8;
    clubB.players[0].seasonMatches = 22;

    const stats = aggregateClubPlayerStats([clubA, clubB]);
    expect(stats.topScorers[0].goals).toBe(18);
    expect(stats.topAssistants[0].assists).toBe(8);
  });
});

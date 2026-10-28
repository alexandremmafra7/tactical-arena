import { describe, it, expect } from 'vitest';
import { autoFillLineup, DEFAULT_BENCH_SIZE, pickBenchPlayers, pickPlayersForSlots } from './lineupAutofill.js';
import { makePlayer } from '../simulation/testFactories.js';
import { Club, STARTING_BUDGET, STARTING_STADIUM_CAPACITY, STARTING_STADIUM_LEVEL } from './club.js';

function buildClub(players: ReturnType<typeof makePlayer>[]): Club {
  return {
    id: 'club',
    name: 'Club',
    ownerId: 'owner',
    slug: null,
    pendingRoundTactic: null,
    country: 'BRA',
    players,
    academyPlayers: [],
    budget: STARTING_BUDGET,
    captainPlayerId: null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: STARTING_STADIUM_LEVEL,
    stadiumCapacity: STARTING_STADIUM_CAPACITY,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
  };
}

describe('autoFillLineup', () => {
  it('never selects a suspended player', () => {
    const players = [
      makePlayer('gk', { position: 'GK' }),
      ...Array.from({ length: 4 }, (_, i) => makePlayer(`def${i}`, { position: 'DEF' })),
      ...Array.from({ length: 4 }, (_, i) => makePlayer(`mid${i}`, { position: 'MID' })),
      makePlayer('att0', { position: 'ATT', suspensions: [{ competitionId: null, matchesRemaining: 2 }] }),
      makePlayer('att1', { position: 'ATT' }),
      makePlayer('att2', { position: 'ATT' }),
    ];
    const club = buildClub(players);

    const tactic = autoFillLineup(club);
    const selectedIds = tactic.lineup.map((s) => s.playerId);

    expect(selectedIds).not.toContain('att0');
    expect(selectedIds).toHaveLength(11);
  });

  it('prefers higher-overall candidates when more players are available than slots', () => {
    const players = [
      makePlayer('gk', { position: 'GK' }),
      ...Array.from({ length: 4 }, (_, i) => makePlayer(`def${i}`, { position: 'DEF' })),
      ...Array.from({ length: 4 }, (_, i) => makePlayer(`mid${i}`, { position: 'MID' })),
      makePlayer('att-strong', { position: 'ATT', overall: 90 }),
      makePlayer('att-weak', { position: 'ATT', overall: 40 }),
      makePlayer('att-weakest', { position: 'ATT', overall: 20 }),
    ];
    const club = buildClub(players);

    const tactic = autoFillLineup(club);
    const selectedIds = tactic.lineup.map((s) => s.playerId);

    expect(selectedIds).toContain('att-strong');
    expect(selectedIds).not.toContain('att-weakest');
  });

  it('throws a clear error when fewer than 11 players are available', () => {
    const players = [
      makePlayer('gk', { position: 'GK' }),
      makePlayer('def0', { position: 'DEF' }),
      makePlayer('mid0', { position: 'MID' }),
    ];
    const club = buildClub(players);

    expect(() => autoFillLineup(club)).toThrow(/fewer than 11 players/);
  });

  it('falls back to fielding suspended/injured players as a last resort rather than throwing, when the squad has exactly 11 but most are unavailable', () => {
    const players = [
      makePlayer('gk', { position: 'GK' }),
      ...Array.from({ length: 4 }, (_, i) =>
        makePlayer(`def${i}`, { position: 'DEF', suspensions: [{ competitionId: null, matchesRemaining: 1 }] }),
      ),
      ...Array.from({ length: 4 }, (_, i) => makePlayer(`mid${i}`, { position: 'MID', injuryWeeks: 2 })),
      ...Array.from({ length: 2 }, (_, i) => makePlayer(`att${i}`, { position: 'ATT' })),
    ];
    const club = buildClub(players);

    const tactic = autoFillLineup(club);
    expect(tactic.lineup).toHaveLength(11);
  });

  it('fields 100% natural position players for standard 4-3-3 formation when squad has sufficient players', () => {
    const players = [
      makePlayer('gk1', { position: 'GK' }),
      makePlayer('lat1', { position: 'LAT' }),
      makePlayer('lat2', { position: 'LAT' }),
      makePlayer('def1', { position: 'DEF' }),
      makePlayer('def2', { position: 'DEF' }),
      makePlayer('mid1', { position: 'MID' }),
      makePlayer('mid2', { position: 'MID' }),
      makePlayer('mid3', { position: 'MID' }),
      makePlayer('att1', { position: 'ATT' }),
      makePlayer('att2', { position: 'ATT' }),
      makePlayer('att3', { position: 'ATT' }),
    ];
    const club = buildClub(players);
    const tactic = autoFillLineup(club, null, '4-3-3');
    expect(tactic.formation).toBe('4-3-3');

    const byId = new Map(players.map((p) => [p.id, p]));
    const lineupPositions = tactic.lineup.map((s) => byId.get(s.playerId)?.position);
    expect(lineupPositions).toEqual(['GK', 'LAT', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'ATT', 'ATT', 'ATT']);
  });

  it('fields 100% natural position players for 3-5-2 and 5-3-2 formations without any out-of-position players', () => {
    const players = [
      makePlayer('gk1', { position: 'GK' }),
      makePlayer('lat1', { position: 'LAT' }),
      makePlayer('lat2', { position: 'LAT' }),
      makePlayer('def1', { position: 'DEF' }),
      makePlayer('def2', { position: 'DEF' }),
      makePlayer('def3', { position: 'DEF' }),
      makePlayer('mid1', { position: 'MID' }),
      makePlayer('mid2', { position: 'MID' }),
      makePlayer('mid3', { position: 'MID' }),
      makePlayer('mid4', { position: 'MID' }),
      makePlayer('mid5', { position: 'MID' }),
      makePlayer('att1', { position: 'ATT' }),
      makePlayer('att2', { position: 'ATT' }),
    ];
    const club = buildClub(players);
    const byId = new Map(players.map((p) => [p.id, p]));

    const tactic352 = autoFillLineup(club, null, '3-5-2');
    const positions352 = tactic352.lineup.map((s) => byId.get(s.playerId)?.position);
    expect(positions352).toEqual(['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'ATT', 'ATT']);

    const tactic532 = autoFillLineup(club, null, '5-3-2');
    const positions532 = tactic532.lineup.map((s) => byId.get(s.playerId)?.position);
    expect(positions532).toEqual(['GK', 'LAT', 'DEF', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'ATT', 'ATT']);
  });
});

describe('pickPlayersForSlots', () => {
  it('picks the highest-overall candidate per slot with the "overall" strategy', () => {
    const players = [
      makePlayer('gk', { position: 'GK', overall: 60 }),
      makePlayer('att-weak', { position: 'ATT', overall: 40 }),
      makePlayer('att-strong', { position: 'ATT', overall: 90 }),
    ];

    const result = pickPlayersForSlots(players, ['GK', 'ATT'], 'overall');

    expect(result).toEqual(['gk', 'att-strong']);
  });

  it('picks the freshest (lowest-fatigue) candidate per slot with the "stamina" strategy', () => {
    const players = [
      makePlayer('att-tired', { position: 'ATT', fatigue: 80, overall: 90 }),
      makePlayer('att-fresh', { position: 'ATT', fatigue: 5, overall: 40 }),
    ];

    const result = pickPlayersForSlots(players, ['ATT'], 'stamina');

    expect(result).toEqual(['att-fresh']);
  });

  it('picks the higher força+moral+stamina average per slot with the "balanced" strategy, over a tired unhappy star', () => {
    const players = [
      makePlayer('att-tired-star', { position: 'ATT', overall: 95, morale: 20, fatigue: 90 }),
      makePlayer('att-solid-fresh', { position: 'ATT', overall: 65, morale: 80, fatigue: 5 }),
    ];

    const result = pickPlayersForSlots(players, ['ATT'], 'balanced');

    expect(result).toEqual(['att-solid-fresh']);
  });

  it('picks the candidate whose attributes fit the active attackStyle with the "style" strategy', () => {
    const players = [
      makePlayer('att-passer', { position: 'ATT', overall: 70, attributes: { pace: 40, finishing: 70, passing: 90, defending: 30, physical: 60, goalkeeping: 5 } }),
      makePlayer('att-sprinter', { position: 'ATT', overall: 70, attributes: { pace: 95, finishing: 70, passing: 40, defending: 30, physical: 60, goalkeeping: 5 } }),
    ];

    const wings = pickPlayersForSlots(players, ['ATT'], 'style', null, { attackStyle: 'WINGS', markingStyle: 'BALANCED' });
    const throughMiddle = pickPlayersForSlots(players, ['ATT'], 'style', null, { attackStyle: 'THROUGH_MIDDLE', markingStyle: 'BALANCED' });

    expect(wings).toEqual(['att-sprinter']);
    expect(throughMiddle).toEqual(['att-passer']);
  });

  it('falls back to the "overall" ranking for the "style" strategy when no styleContext is given', () => {
    const players = [
      makePlayer('att-weak', { position: 'ATT', overall: 40 }),
      makePlayer('att-strong', { position: 'ATT', overall: 90 }),
    ];

    const result = pickPlayersForSlots(players, ['ATT'], 'style');

    expect(result).toEqual(['att-strong']);
  });

  it('never repeats a player across two slots of the same position', () => {
    const players = [
      makePlayer('def-a', { position: 'DEF', overall: 70 }),
      makePlayer('def-b', { position: 'DEF', overall: 65 }),
    ];

    const result = pickPlayersForSlots(players, ['DEF', 'DEF'], 'overall');

    expect(result).toEqual(['def-a', 'def-b']);
  });

  it('leaves a slot null when no available candidate exists in squad at all', () => {
    const players = [makePlayer('gk', { position: 'GK' })];

    const result = pickPlayersForSlots(players, ['GK', 'ATT'], 'overall');

    expect(result).toEqual(['gk', null]);
  });

  it('only places players out of position if no natural position player is available', () => {
    const players = [
      makePlayer('att-1', { position: 'ATT', overall: 80 }),
      makePlayer('mid-1', { position: 'MID', overall: 90 }), // Stronger MID
      makePlayer('mid-2', { position: 'MID', overall: 85 }),
    ];

    // For an ATT slot, it MUST pick att-1 even though mid-1 has higher overall
    const resultWithNatural = pickPlayersForSlots(players, ['ATT'], 'overall');
    expect(resultWithNatural).toEqual(['att-1']);

    // If 2 ATT slots are requested and only 1 ATT exists, the second slot falls back to the best available outfield player
    const resultWithFallback = pickPlayersForSlots(players, ['ATT', 'ATT'], 'overall');
    expect(resultWithFallback).toEqual(['att-1', 'mid-1']);
  });

  it('excludes suspended/injured players from consideration', () => {
    const players = [
      makePlayer('att-suspended', { position: 'ATT', overall: 95, suspensions: [{ competitionId: null, matchesRemaining: 1 }] }),
      makePlayer('att-ok', { position: 'ATT', overall: 50 }),
    ];

    const result = pickPlayersForSlots(players, ['ATT'], 'overall');

    expect(result).toEqual(['att-ok']);
  });

  it('never selects a goalkeeper for an outfield slot if any outfield player is available', () => {
    const players = [
      makePlayer('gk-star', { position: 'GK', overall: 99 }),
      makePlayer('mid-junior', { position: 'MID', overall: 45 }),
    ];

    // For a LAT slot with no LAT available, it MUST pick mid-junior, NEVER gk-star
    const result = pickPlayersForSlots(players, ['LAT'], 'overall');
    expect(result).toEqual(['mid-junior']);
  });

  it('prioritizes closest positional affinity during fallback when natural position is exhausted', () => {
    const players = [
      makePlayer('def-bench', { position: 'DEF', overall: 75 }),
      makePlayer('att-bench', { position: 'ATT', overall: 85 }),
    ];

    // For a LAT slot with no LAT available: DEF (distance 1) is preferred over ATT (distance 2)
    const result = pickPlayersForSlots(players, ['LAT'], 'overall');
    expect(result).toEqual(['def-bench']);
  });
});

describe('pickBenchPlayers', () => {
  it('excludes the starting XI and picks the next-best by overall', () => {
    const players = [
      makePlayer('starter', { position: 'ATT', overall: 95 }),
      makePlayer('bench-strong', { position: 'MID', overall: 80 }),
      makePlayer('bench-weak', { position: 'DEF', overall: 40 }),
    ];

    const result = pickBenchPlayers(players, new Set(['starter']), 'overall', 2);

    expect(result).toEqual(['bench-strong', 'bench-weak']);
  });

  it('picks the freshest (lowest-fatigue) candidates with the "stamina" strategy', () => {
    const players = [
      makePlayer('tired', { position: 'MID', fatigue: 80, overall: 90 }),
      makePlayer('fresh', { position: 'MID', fatigue: 5, overall: 40 }),
    ];

    const result = pickBenchPlayers(players, new Set(), 'stamina', 1);

    expect(result).toEqual(['fresh']);
  });

  it('excludes suspended/injured players and caps at the requested bench size', () => {
    const players = [
      makePlayer('suspended', { position: 'ATT', overall: 99, suspensions: [{ competitionId: null, matchesRemaining: 1 }] }),
      ...Array.from({ length: 10 }, (_, i) => makePlayer(`avail${i}`, { position: 'MID', overall: 50 + i })),
    ];

    const result = pickBenchPlayers(players, new Set(), 'overall', DEFAULT_BENCH_SIZE);

    expect(result).not.toContain('suspended');
    expect(result).toHaveLength(DEFAULT_BENCH_SIZE);
  });

  it('picks the higher força+moral+stamina average candidate with the "balanced" strategy', () => {
    const players = [
      makePlayer('tired-star', { position: 'ATT', overall: 95, morale: 20, fatigue: 90 }),
      makePlayer('solid-fresh', { position: 'MID', overall: 65, morale: 80, fatigue: 5 }),
    ];

    const result = pickBenchPlayers(players, new Set(), 'balanced', 1);

    expect(result).toEqual(['solid-fresh']);
  });

  it('ranks each candidate by their own position under the "style" strategy, with no single slot to score against', () => {
    const players = [
      makePlayer('def-anchor', { position: 'DEF', overall: 70, attributes: { pace: 40, finishing: 30, passing: 50, defending: 90, physical: 80, goalkeeping: 5 } }),
      makePlayer('mid-slow-passer', { position: 'MID', overall: 70, attributes: { pace: 30, finishing: 50, passing: 60, defending: 40, physical: 50, goalkeeping: 5 } }),
    ];

    const result = pickBenchPlayers(players, new Set(), 'style', 1, null, { attackStyle: 'THROUGH_MIDDLE', markingStyle: 'HEAVY' });

    // HEAVY marking amplifies the defender's already-strong `defending`, comfortably ahead of the
    // midfielder's modest attacking blend even with THROUGH_MIDDLE's passing weighting applied.
    expect(result).toEqual(['def-anchor']);
  });

  it('ensures each position (GK, LAT, DEF, MID, ATT) is represented and never selects more than 1 GK', () => {
    const players = [
      makePlayer('gk-1', { position: 'GK', overall: 85 }),
      makePlayer('gk-2', { position: 'GK', overall: 80 }),
      makePlayer('lat-1', { position: 'LAT', overall: 75 }),
      makePlayer('def-1', { position: 'DEF', overall: 74 }),
      makePlayer('mid-1', { position: 'MID', overall: 73 }),
      makePlayer('att-1', { position: 'ATT', overall: 72 }),
      makePlayer('mid-2', { position: 'MID', overall: 71 }),
      makePlayer('att-2', { position: 'ATT', overall: 70 }),
    ];

    const result = pickBenchPlayers(players, new Set(), 'overall', 7);

    expect(result).toContain('gk-1');
    expect(result).not.toContain('gk-2'); // Never more than 1 GK on the bench
    expect(result).toContain('lat-1');
    expect(result).toContain('def-1');
    expect(result).toContain('mid-1');
    expect(result).toContain('att-1');
    expect(result).toHaveLength(7);
  });

  it('prefers high-fitness (>80%) and high-morale players with the "assistant" strategy', () => {
    const players = [
      makePlayer('tired-superstar', { position: 'ATT', overall: 88, morale: 50, fatigue: 40 }), // fitness 60% -> penalty
      makePlayer('fit-starter', { position: 'ATT', overall: 82, morale: 80, fatigue: 10 }), // fitness 90%
    ];

    const result = pickBenchPlayers(players, new Set(), 'assistant', 1);
    expect(result).toEqual(['fit-starter']);
  });
});


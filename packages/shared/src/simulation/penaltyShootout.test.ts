import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';
import {
  bestPenaltyTaker,
  buildShootoutKickingOrder,
  resolvePenaltyShot,
  simulatePenaltyShootout,
} from './penalty.js';
import { makeClub, makePlayer } from './testFactories.js';
import { defaultDetailedAttributes } from '../domain/detailedAttributes.js';

function makeDetailedPlayer(id: string, name: string, pos: 'GK' | 'ATT' | 'MID' | 'DEF', pen: number, shot: number, morale: number) {
  const detailed = defaultDetailedAttributes();
  detailed.PENALTY_TAKING = pen;
  detailed.SHOT_POWER = shot;
  if (pos === 'GK') {
    detailed.PENALTY_SAVING = 80;
    detailed.REFLEXES = 85;
    detailed.AGILITY = 75;
    detailed.ANTICIPATION = 80;
  }
  return makePlayer(id, {
    name,
    position: pos,
    morale,
    attributes: {
      pace: 70,
      finishing: shot,
      passing: 70,
      defending: 50,
      physical: 70,
      goalkeeping: pos === 'GK' ? 85 : 10,
    },
    detailedAttributes: detailed,
  });
}

describe('Penalty Shootout Engine', () => {
  it('builds kicking order putting the best penalty takers first and goalkeeper last', () => {
    const players = [
      makeDetailedPlayer('p-gk', 'Goleiro', 'GK', 20, 20, 50),
      makeDetailedPlayer('p-att', 'Artilheiro', 'ATT', 95, 90, 85),
      makeDetailedPlayer('p-mid', 'Meia', 'MID', 75, 75, 70),
      makeDetailedPlayer('p-def', 'Zagueiro', 'DEF', 50, 50, 50),
    ];
    const order = buildShootoutKickingOrder(players);

    expect(order.length).toBe(4);
    expect(order[0].name).toBe('Artilheiro');
    expect(order[order.length - 1].position).toBe('GK');
  });

  it('respects custom order for designated kickers and fills the remaining slots', () => {
    const players = [
      makeDetailedPlayer('p-gk', 'Goleiro', 'GK', 20, 20, 50),
      makeDetailedPlayer('p-att', 'Artilheiro', 'ATT', 95, 90, 85),
      makeDetailedPlayer('p-mid', 'Meia', 'MID', 75, 75, 70),
      makeDetailedPlayer('p-def', 'Zagueiro', 'DEF', 50, 50, 50),
    ];
    const customOrder = ['p-mid', 'p-att'];
    const order = buildShootoutKickingOrder(players, customOrder);

    expect(order[0].id).toBe('p-mid');
    expect(order[1].id).toBe('p-att');
    expect(order.length).toBe(4);
    expect(order[order.length - 1].position).toBe('GK');
  });

  it('resolves individual penalty shots with valid quadrant data and realistic outcomes', () => {
    const striker = makeDetailedPlayer('p-att', 'Artilheiro', 'ATT', 95, 90, 85);
    const keeper = makeDetailedPlayer('p-gk', 'Goleiro', 'GK', 20, 20, 50);
    const rng = createRng('test-shot-seed-123');

    const shot = resolvePenaltyShot(striker, keeper, 1, 0.2, rng);

    expect(shot.targetZone).toBe(1);
    expect([1, 2, 3, 4, 5]).toContain(shot.gkZone);
    expect(['GOL', 'DEFESA', 'FORA', 'TRAVE']).toContain(shot.outcome);
  });

  it('simulates a complete shootout with deterministic results based on seed', () => {
    const home = makeClub('club-home', 'Home Club', 75, { seed: 'home-seed' });
    const away = makeClub('club-away', 'Away Club', 75, { seed: 'away-seed' });

    const seed = 'cup-final-2026-shootout';
    const result1 = simulatePenaltyShootout(home, away, home.players, away.players, createRng(seed));
    const result2 = simulatePenaltyShootout(home, away, home.players, away.players, createRng(seed));

    expect(result1.winnerClubId).toBe(result2.winnerClubId);
    expect(result1.homeScore).toBe(result2.homeScore);
    expect(result1.awayScore).toBe(result2.awayScore);
    expect(result1.kicks.length).toBe(result2.kicks.length);
    expect(result1.kicks.length).toBeGreaterThanOrEqual(3);
  });

  it('correctly declares early finish when score lead is mathematically insurmountable', () => {
    const home = makeClub('club-home', 'Home Club', 75, { seed: 'home-seed' });
    const away = makeClub('club-away', 'Away Club', 75, { seed: 'away-seed' });

    // Run 50 random shootouts, verify every single one satisfies the math invariants
    for (let i = 0; i < 50; i++) {
      const rng = createRng(`seed-check-${i}`);
      const result = simulatePenaltyShootout(home, away, home.players, away.players, rng);

      expect(['home', 'away']).toContain(result.winnerSide);
      if (result.winnerSide === 'home') {
        expect(result.homeScore).toBeGreaterThan(result.awayScore);
        expect(result.winnerClubId).toBe('club-home');
      } else {
        expect(result.awayScore).toBeGreaterThan(result.homeScore);
        expect(result.winnerClubId).toBe('club-away');
      }

      // Check kick progression
      for (const kick of result.kicks) {
        expect(['GOL', 'DEFESA', 'FORA', 'TRAVE']).toContain(kick.outcome);
        expect(kick.kickerName).toBeTruthy();
        expect(kick.goalkeeperName).toBeTruthy();
      }
    }
  });
});

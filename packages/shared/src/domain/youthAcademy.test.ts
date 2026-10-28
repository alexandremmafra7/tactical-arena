import { describe, expect, it } from 'vitest';
import { DEFAULT_STAFF_DELEGATION_CONFIG, getStaffDelegationPreset } from './staffDelegationConfig.js';
import { makePlayer } from '../simulation/testFactories.js';
import { isYouthGem, resolveYouthPromotions } from './youthAcademy.js';

describe('youth academy promotion policy', () => {
  it('identifies a jewel by potential, natural talent, or diferenciado status', () => {
    expect(isYouthGem(makePlayer('potential', { age: 18, potential: 82 }))).toBe(true);
    expect(isYouthGem(makePlayer('natural', { age: 18, potential: 70, starLevel: 'NATURAL' }))).toBe(true);
    expect(isYouthGem(makePlayer('different', { age: 18, potential: 70, diferenciado: true }))).toBe(true);
    expect(isYouthGem(makePlayer('ordinary', { age: 18, potential: 81 }))).toBe(false);
  });

  it('automatically promotes ready jewels and every player who completed 20 while roster slots exist', () => {
    const players = Array.from({ length: 33 }, (_, i) => makePlayer(`senior-${i}`));
    const ready = makePlayer('ready', { age: 18, overall: 70, potential: 82 });
    const tooRaw = makePlayer('raw', { age: 18, overall: 69, potential: 95 });
    const agedOut = makePlayer('aged-out', { age: 20, overall: 55, potential: 65 });

    const result = resolveYouthPromotions(players, [ready, tooRaw, agedOut], DEFAULT_STAFF_DELEGATION_CONFIG);

    expect(result.promoted.map((p) => p.id)).toEqual(['ready', 'aged-out']);
    expect(result.players).toHaveLength(35);
    expect(result.academyPlayers.map((p) => p.id)).toEqual(['raw']);
  });

  it('never exceeds 35 first-team players', () => {
    const players = Array.from({ length: 34 }, (_, i) => makePlayer(`senior-${i}`));
    const prospects = [
      makePlayer('best', { age: 18, overall: 75, potential: 90 }),
      makePlayer('second', { age: 18, overall: 72, potential: 86 }),
    ];

    const result = resolveYouthPromotions(players, prospects, DEFAULT_STAFF_DELEGATION_CONFIG);

    expect(result.players).toHaveLength(35);
    expect(result.promoted.map((p) => p.id)).toEqual(['best']);
    expect(result.academyPlayers.map((p) => p.id)).toEqual(['second']);
  });

  it('keeps every prospect in the academy in manual FM mode', () => {
    const players = Array.from({ length: 20 }, (_, i) => makePlayer(`senior-${i}`));
    const prospects = [makePlayer('aged-out', { age: 20 }), makePlayer('ready', { age: 18, overall: 70, potential: 82 })];

    const result = resolveYouthPromotions(players, prospects, getStaffDelegationPreset('football_manager_hardcore'));

    expect(result.promoted).toEqual([]);
    expect(result.players).toEqual(players);
    expect(result.academyPlayers).toEqual(prospects);
  });
});
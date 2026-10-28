import { describe, it, expect } from 'vitest';
import { applySquadHarmony } from './squadHarmony.js';
import { makeClub, makePlayer, makeTactic } from '../simulation/testFactories.js';
import { PersonalityTrait } from './player.js';

function withTraits(players: ReturnType<typeof makeClub>['players'], traitByIndex: Record<number, PersonalityTrait[]>) {
  return players.map((p, i) => (traitByIndex[i] ? { ...p, traits: traitByIndex[i] } : p));
}

describe('applySquadHarmony', () => {
  it('leaves morale untouched with no problematic starters', () => {
    const club = makeClub('h1', 'Harmony One', 60);
    const starters = club.players.slice(0, 11);
    const tactic = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })) });

    const result = applySquadHarmony(club.players, tactic, null);
    expect(result.every((p) => p.morale === 50)).toBe(true);
  });

  it('leaves morale untouched with just one problematic starter (the free allowance)', () => {
    const club = makeClub('h2', 'Harmony Two', 60);
    const players = withTraits(club.players, { 0: ['AGGRESSIVE'] });
    const starters = players.slice(0, 11);
    const tactic = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })) });

    const result = applySquadHarmony(players, tactic, null);
    expect(result.every((p) => p.morale === 50)).toBe(true);
  });

  it('docks the whole squad morale once problematic starters exceed the free allowance', () => {
    const club = makeClub('h3', 'Harmony Three', 60);
    const players = withTraits(club.players, { 0: ['AGGRESSIVE'], 1: ['TEMPERAMENTAL'], 2: ['SELFISH'] });
    const starters = players.slice(0, 11);
    const tactic = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })) });

    const result = applySquadHarmony(players, tactic, null);
    // Whole squad feels it, including bench players who weren't even in the lineup.
    expect(result.every((p) => p.morale < 50)).toBe(true);
  });

  it('lets a LEADER starter cancel out one problematic starter', () => {
    const club = makeClub('h4', 'Harmony Four', 60);
    const withoutLeader = withTraits(club.players, { 0: ['AGGRESSIVE'], 1: ['TEMPERAMENTAL'] });
    const withLeader = withTraits(club.players, { 0: ['AGGRESSIVE'], 1: ['TEMPERAMENTAL'], 2: ['LEADER'] });

    const tacticWithoutLeader = makeTactic(club, { lineup: withoutLeader.slice(0, 11).map((p) => ({ playerId: p.id })) });
    const tacticWithLeader = makeTactic(club, { lineup: withLeader.slice(0, 11).map((p) => ({ playerId: p.id })) });

    const resultWithoutLeader = applySquadHarmony(withoutLeader, tacticWithoutLeader, null)[0].morale;
    const resultWithLeader = applySquadHarmony(withLeader, tacticWithLeader, null)[0].morale;

    expect(resultWithLeader).toBeGreaterThan(resultWithoutLeader);
  });

  it('caps the penalty even with a starting XI full of problem personalities', () => {
    const club = makeClub('h5', 'Harmony Five', 60);
    const traits: PersonalityTrait[] = ['AGGRESSIVE', 'PROVOCATIVE', 'TEMPERAMENTAL', 'UNDISCIPLINED', 'SELFISH'];
    const players = club.players.map((p, i) => ({ ...p, traits: i < 11 ? [traits[i % traits.length]] : p.traits }));
    const starters = players.slice(0, 11);
    const tactic = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })) });

    const result = applySquadHarmony(players, tactic, null);
    expect(result[0].morale).toBe(35); // 50 - MAX_SQUAD_HARMONY_PENALTY (15)
  });

  it('lets a benched (non-starting) tutor cancel out one problematic starter', () => {
    const club = makeClub('h6', 'Harmony Six', 60);
    const starters = withTraits(club.players, { 0: ['AGGRESSIVE'], 1: ['TEMPERAMENTAL'] });
    const tutor = makePlayer('tutor-h6', { age: 34 });
    const players = [...starters, tutor];
    const tactic = makeTactic(club, {
      lineup: starters.map((p) => ({ playerId: p.id })),
      substitutes: [{ playerId: tutor.id }],
    });

    const resultWithoutTutor = applySquadHarmony(players, tactic, null)[0].morale;
    const resultWithTutor = applySquadHarmony(players, tactic, tutor.id)[0].morale;

    expect(resultWithTutor).toBeGreaterThan(resultWithoutTutor);
  });

  it('does not neutralize anything if the tutor was not called up for this match', () => {
    const club = makeClub('h7', 'Harmony Seven', 60);
    const starters = withTraits(club.players, { 0: ['AGGRESSIVE'], 1: ['TEMPERAMENTAL'] });
    const tutor = makePlayer('tutor-h7', { age: 34 });
    const players = [...starters, tutor];
    const tactic = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })), substitutes: [] });

    const resultWithoutTutor = applySquadHarmony(players, tactic, null)[0].morale;
    const resultWithUncalledTutor = applySquadHarmony(players, tactic, tutor.id)[0].morale;

    expect(resultWithUncalledTutor).toBe(resultWithoutTutor);
  });
});

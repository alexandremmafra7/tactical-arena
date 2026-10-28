import { describe, it, expect } from 'vitest';
import { validateSubstitutesAndPlan, resolveLineupPlayers, LineupValidationError } from './teamStrength.js';
import { makeClub, makePlayer, makeTactic } from './testFactories.js';
import { MAX_SUBSTITUTIONS } from '../domain/tactic.js';

/** A club whose first 11 players are the starters, plus 2 extra squad players available as bench. */
function clubWithBench() {
  const club = makeClub('club', 'Club FC', 60);
  const bench = [makePlayer('club-bench0', { position: 'DEF' }), makePlayer('club-bench1', { position: 'ATT' })];
  return { ...club, players: [...club.players, ...bench] };
}

function baseLineup(club: ReturnType<typeof clubWithBench>) {
  return club.players.slice(0, 11).map((p) => ({ playerId: p.id }));
}

describe('validateSubstitutesAndPlan', () => {
  it('accepts an empty bench and empty plan (the common case today)', () => {
    const club = makeClub('club', 'Club FC', 60);
    const tactic = makeTactic(club);
    expect(() => validateSubstitutesAndPlan(club, tactic)).not.toThrow();
  });

  it('accepts a valid bench with a valid planned substitution and penalty taker', () => {
    const club = clubWithBench();
    const tactic = makeTactic(club, {
      lineup: baseLineup(club),
      substitutes: [{ playerId: 'club-bench0' }],
      plannedSubstitutions: [{ id: 'sub1', minute: 46, outPlayerId: club.players[0].id, inPlayerId: 'club-bench0' }],
      penaltyTakerId: club.players[9].id,
    });
    expect(() => validateSubstitutesAndPlan(club, tactic)).not.toThrow();
  });

  it('rejects a suspended substitute', () => {
    const club = clubWithBench();
    club.players[club.players.length - 1] = {
      ...club.players[club.players.length - 1],
      suspensions: [{ competitionId: null, matchesRemaining: 1 }],
    };
    const tactic = makeTactic(club, { lineup: baseLineup(club), substitutes: [{ playerId: 'club-bench1' }] });
    expect(() => validateSubstitutesAndPlan(club, tactic)).toThrow(LineupValidationError);
  });

  it('rejects a substitute who is also a starter', () => {
    const club = clubWithBench();
    const tactic = makeTactic(club, { lineup: baseLineup(club), substitutes: [{ playerId: club.players[0].id }] });
    expect(() => validateSubstitutesAndPlan(club, tactic)).toThrow(LineupValidationError);
  });

  it(`rejects more than ${MAX_SUBSTITUTIONS} planned substitutions`, () => {
    const club = clubWithBench();
    const extraBench = Array.from({ length: MAX_SUBSTITUTIONS + 1 }, (_, i) => makePlayer(`club-extra${i}`, { position: 'MID' }));
    const withBench = { ...club, players: [...club.players, ...extraBench] };
    const lineup = baseLineup(withBench);
    const substitutes = extraBench.map((p) => ({ playerId: p.id }));
    const plannedSubstitutions = extraBench.map((p, i) => ({
      id: `sub${i}`,
      minute: 46 + i,
      outPlayerId: lineup[i].playerId,
      inPlayerId: p.id,
    }));
    const tactic = makeTactic(withBench, { lineup, substitutes, plannedSubstitutions });
    expect(() => validateSubstitutesAndPlan(withBench, tactic)).toThrow(LineupValidationError);
  });

  it('rejects a substitution minute outside 1-90', () => {
    const club = clubWithBench();
    const tactic = makeTactic(club, {
      lineup: baseLineup(club),
      substitutes: [{ playerId: 'club-bench0' }],
      plannedSubstitutions: [{ id: 'sub1', minute: 0, outPlayerId: club.players[0].id, inPlayerId: 'club-bench0' }],
    });
    expect(() => validateSubstitutesAndPlan(club, tactic)).toThrow(LineupValidationError);
  });

  it('rejects an "out" player who is not one of the 11 starters', () => {
    const club = clubWithBench();
    const tactic = makeTactic(club, {
      lineup: baseLineup(club),
      substitutes: [{ playerId: 'club-bench0' }],
      plannedSubstitutions: [{ id: 'sub1', minute: 46, outPlayerId: 'club-bench1', inPlayerId: 'club-bench0' }],
    });
    expect(() => validateSubstitutesAndPlan(club, tactic)).toThrow(LineupValidationError);
  });

  it('rejects an "in" player who is not on the bench', () => {
    const club = clubWithBench();
    const tactic = makeTactic(club, {
      lineup: baseLineup(club),
      plannedSubstitutions: [{ id: 'sub1', minute: 46, outPlayerId: club.players[0].id, inPlayerId: 'club-bench0' }],
    });
    expect(() => validateSubstitutesAndPlan(club, tactic)).toThrow(LineupValidationError);
  });

  it('rejects reusing the same "out" player across two substitutions', () => {
    const club = clubWithBench();
    const tactic = makeTactic(club, {
      lineup: baseLineup(club),
      substitutes: [{ playerId: 'club-bench0' }, { playerId: 'club-bench1' }],
      plannedSubstitutions: [
        { id: 'sub1', minute: 46, outPlayerId: club.players[0].id, inPlayerId: 'club-bench0' },
        { id: 'sub2', minute: 60, outPlayerId: club.players[0].id, inPlayerId: 'club-bench1' },
      ],
    });
    expect(() => validateSubstitutesAndPlan(club, tactic)).toThrow(LineupValidationError);
  });

  it('rejects a penalty taker who is not one of the 11 starters', () => {
    const club = clubWithBench();
    const tactic = makeTactic(club, { lineup: baseLineup(club), penaltyTakerId: 'club-bench0' });
    expect(() => validateSubstitutesAndPlan(club, tactic)).toThrow(LineupValidationError);
  });
});

describe('resolveLineupPlayers', () => {
  it('rejects a lineup that lists the same player twice', () => {
    const club = makeClub('dup', 'Dup FC', 60);
    const lineup = club.players.slice(0, 10).map((p) => ({ playerId: p.id }));
    lineup.push({ playerId: club.players[0].id }); // 11 slots, but the GK appears twice
    const tactic = makeTactic(club, { lineup });
    expect(() => resolveLineupPlayers(club, tactic)).toThrow(LineupValidationError);
  });

  it('accepts a clean 11 with no duplicates', () => {
    const club = makeClub('clean', 'Clean FC', 60);
    const tactic = makeTactic(club);
    expect(() => resolveLineupPlayers(club, tactic)).not.toThrow();
  });
});

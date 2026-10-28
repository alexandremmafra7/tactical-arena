import { describe, it, expect } from 'vitest';
import { updateSuspensions } from './suspensionService.js';

// Minimal Player stand-ins — only the fields updateSuspensions actually reads.
function player(id: string, suspensions: { competitionId: string | null; matchesRemaining: number }[] = []) {
  return { id, suspensions } as any;
}

describe('updateSuspensions', () => {
  it('decrements only the entry matching this match\'s competition, leaving other competitions untouched', () => {
    const p = player('p1', [
      { competitionId: 'league-1', matchesRemaining: 2 },
      { competitionId: 'cup-1', matchesRemaining: 1 },
    ]);

    const result = updateSuspensions([p], [], 'league-1');

    expect(result[0].suspensions).toEqual([
      { competitionId: 'league-1', matchesRemaining: 1 },
      { competitionId: 'cup-1', matchesRemaining: 1 },
    ]);
  });

  it('drops an entry once it reaches zero', () => {
    const p = player('p1', [{ competitionId: 'league-1', matchesRemaining: 1 }]);
    const result = updateSuspensions([p], [], 'league-1');
    expect(result[0].suspensions).toEqual([]);
  });

  it('adds a fresh suspension for the competition this red card was earned in, without touching other competitions', () => {
    const p = player('p1', [{ competitionId: 'cup-1', matchesRemaining: 2 }]);
    const events = [{ type: 'card', team: 'home', playerId: 'p1', description: 'red', suspensionMatches: 3 }] as any;

    const result = updateSuspensions([p], events, 'league-1');

    expect(result[0].suspensions).toContainEqual({ competitionId: 'league-1', matchesRemaining: 3 });
    expect(result[0].suspensions).toContainEqual({ competitionId: 'cup-1', matchesRemaining: 2 });
  });

  it('overwrites (does not stack) a fresh red card in the same competition as an existing suspension', () => {
    const p = player('p1', [{ competitionId: 'league-1', matchesRemaining: 2 }]);
    const events = [{ type: 'card', team: 'home', playerId: 'p1', description: 'red', suspensionMatches: 3 }] as any;

    const result = updateSuspensions([p], events, 'league-1');

    expect(result[0].suspensions).toEqual([{ competitionId: 'league-1', matchesRemaining: 3 }]);
  });

  it('leaves players with no suspensions untouched', () => {
    const p = player('p1');
    const result = updateSuspensions([p], [], 'league-1');
    expect(result[0].suspensions).toEqual([]);
  });
});

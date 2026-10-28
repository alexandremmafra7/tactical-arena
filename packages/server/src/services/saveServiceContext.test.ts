import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clubFindFirst, clubFindUnique, leagueFindMany, matchFindMany, getGameState } = vi.hoisted(() => ({
  clubFindFirst: vi.fn(),
  clubFindUnique: vi.fn(),
  leagueFindMany: vi.fn(),
  matchFindMany: vi.fn(),
  getGameState: vi.fn(),
}));

vi.mock('../db/prisma.js', () => ({
  prisma: {
    club: { findFirst: clubFindFirst, findUnique: clubFindUnique },
    league: { findMany: leagueFindMany },
    match: { findMany: matchFindMany },
  },
}));

vi.mock('./gameStateService.js', () => ({ getGameState }));

import { getLiveClubInfo } from './saveService.js';

describe('Career Hub live save context', () => {
  beforeEach(() => {
    clubFindFirst.mockReset();
    clubFindUnique.mockReset();
    leagueFindMany.mockReset();
    matchFindMany.mockReset();
    getGameState.mockReset();
    clubFindFirst.mockResolvedValue({
      id: 'club-a', name: 'Aurora', country: 'BRA', slug: null, budget: 1_000, titlesWon: 0,
    });
    getGameState.mockResolvedValue({ currentDate: '2026-09-12', seasonYear: 2026, phase: 'IN_SEASON' });
    matchFindMany.mockResolvedValue([]);
  });

  it('selects the dated future fixture before a legacy undated fixture', async () => {
    leagueFindMany.mockResolvedValue([{
      id: 'league-a', name: 'Liga', division: 1, season: 2026, status: 'IN_PROGRESS',
      clubIdsJson: JSON.stringify(['club-a', 'club-b', 'club-c']),
      fixturesJson: JSON.stringify([
        { round: 2, homeClubId: 'club-a', awayClubId: 'club-b', matchId: null },
        { round: 1, homeClubId: 'club-a', awayClubId: 'club-c', matchId: null, date: '2026-09-14' },
      ]),
      createdAt: new Date('2026-01-01'),
    }]);
    clubFindUnique.mockResolvedValue({ name: 'Clube C', slug: 'clube-c' });

    await expect(getLiveClubInfo('user-a')).resolves.toMatchObject({
      nextOpponentName: 'Clube C',
      nextOpponentSlug: 'clube-c',
      nextMatchDate: '2026-09-14',
    });
    expect(clubFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'club-c' } }));
  });
});

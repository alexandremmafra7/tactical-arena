import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clubFindMany, leagueFindMany } = vi.hoisted(() => ({
  clubFindMany: vi.fn(),
  leagueFindMany: vi.fn(),
}));

vi.mock('../db/prisma.js', () => ({
  prisma: {
    club: { findMany: clubFindMany },
    league: { findMany: leagueFindMany },
  },
}));

vi.mock('./saveService.js', () => ({ syncCurrentSaveToDisk: vi.fn() }));

describe('listAvailableClubs', () => {
  beforeEach(() => {
    clubFindMany.mockReset();
    leagueFindMany.mockReset();
    clubFindMany.mockResolvedValue([]);
  });

  it('returns no clubs when the requested division does not exist', async () => {
    leagueFindMany.mockResolvedValue([]);
    const { listAvailableClubs } = await import('./clubService.js');
    await expect(listAvailableClubs('BRA', 9)).resolves.toEqual([]);
  });

  it('does not fall back to other tiers when the requested division has no available club', async () => {
    clubFindMany.mockResolvedValue([
      {
        id: 'club-first-tier',
        ownerId: 'BOT',
        country: 'BRA',
        playersJson: '[]',
        academyPlayersJson: '[]',
        sponsorshipsJson: '[]',
        loansJson: '[]',
        pendingTransferPaymentsJson: '[]',
        staffJson: '[]',
        staffRecordJson: '[]',
        bankGuaranteesJson: '[]',
      },
    ]);
    leagueFindMany.mockResolvedValue([
      { clubIdsJson: JSON.stringify(['club-second-tier']) },
    ]);

    const { listAvailableClubs } = await import('./clubService.js');
    await expect(listAvailableClubs('BRA', 2)).resolves.toEqual([]);
  });
});

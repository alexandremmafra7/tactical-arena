import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  generateStarterSquad,
  type Club,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { ensureSchema } from '../db/ensureSchema.js';
import { fieldDefaultTactic } from './initialTacticService.js';

function clubWithStarterSquad(id: string): Club {
  return {
    id,
    name: 'Tática FC',
    ownerId: randomUUID(),
    slug: null,
    country: 'BRA',
    players: generateStarterSquad(id, 'BRA'),
    academyPlayers: [],
    budget: 5_000_000,
    captainPlayerId: null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: 1,
    stadiumCapacity: 20_000,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
    pendingRoundTactic: null,
  };
}

describe('fieldDefaultTactic', () => {
  beforeAll(() => ensureSchema());

  it('writes the initial tactic through the supplied transaction client', async () => {
    const club = clubWithStarterSquad(randomUUID());

    await expect(prisma.$transaction(async (transaction) => {
      await fieldDefaultTactic(club, transaction);
      throw new Error('rollback-probe');
    })).rejects.toThrow('rollback-probe');

    await expect(prisma.tacticPreset.count({
      where: { clubId: club.id },
    })).resolves.toBe(0);

    await fieldDefaultTactic(club, prisma);

    const preset = await prisma.tacticPreset.findFirst({
      where: { clubId: club.id, isDefault: true },
    });
    expect(preset).toMatchObject({
      clubId: club.id,
      formation: '4-4-2',
      isDefault: true,
    });
    expect(JSON.parse(preset!.lineupJson)).toHaveLength(11);
  });

  it('propagates an invalid squad failure without storing a partial preset', async () => {
    const club = {
      ...clubWithStarterSquad(randomUUID()),
      players: [],
    };

    await expect(
      fieldDefaultTactic(club, prisma),
    ).rejects.toThrow('fewer than 11 players');

    await expect(prisma.tacticPreset.count({
      where: { clubId: club.id },
    })).resolves.toBe(0);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BOT_OWNER_ID, generateStarterSquad } from '@tactical-arena/shared';
import { prisma } from './db/prisma.js';
import { ensureSchema } from './db/ensureSchema.js';
import { getOrCreateOffers } from './services/jobOfferService.js';

describe('job offers', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  it('generates only one pending set when requested concurrently', async () => {
    const userId = `offers-${randomUUID()}`;
    for (let i = 0; i < 3; i += 1) {
      const id = randomUUID();
      await prisma.club.create({
        data: {
          id,
          name: `Oferta FC ${i}`,
          ownerId: BOT_OWNER_ID,
          country: 'BRA',
          playersJson: JSON.stringify(generateStarterSquad(id, 'BRA')),
          academyPlayersJson: '[]',
        },
      });
    }

    const [first, second] = await Promise.all([
      getOrCreateOffers(userId),
      getOrCreateOffers(userId),
    ]);
    const pending = await prisma.jobOffer.findMany({ where: { userId, status: 'PENDING' } });

    expect(first.length).toBeGreaterThan(0);
    expect(second.map((offer) => offer.id).sort()).toEqual(first.map((offer) => offer.id).sort());
    expect(pending.map((offer) => offer.id).sort()).toEqual(first.map((offer) => offer.id).sort());
  });
});

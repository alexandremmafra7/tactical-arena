import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

const app = createApp();

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string };
}

async function createClubFor(token: string, name: string) {
  const res = await request(app).post('/clubs').set('Authorization', `Bearer ${token}`).send({ name, country: 'BRA' });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Naming-rights challenge offer flow', () => {
  it('only surfaces a challenge offer once the club has won a title, and signing it replaces the active naming-rights deal', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Arena FC');

    // Sign the initial naming-rights deal.
    const firstOffersRes = await request(app)
      .get(`/clubs/${club.id}/finance/sponsorship-offers`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(firstOffersRes.status).toBe(200);
    const namingOffer = firstOffersRes.body.find((o: { type: string }) => o.type === 'STADIUM_NAMING');
    expect(namingOffer).toBeTruthy();
    expect(namingOffer.isChallenge).toBeFalsy();

    const signRes = await request(app)
      .post(`/clubs/${club.id}/finance/sponsorships`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send(namingOffer);
    expect(signRes.status).toBe(201);
    const originalSponsorName = signRes.body.sponsorships.find((s: { type: string }) => s.type === 'STADIUM_NAMING').sponsorName;

    // With zero titles, no challenge offer shows up alongside the active deal.
    const noChallengeRes = await request(app)
      .get(`/clubs/${club.id}/finance/sponsorship-offers`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(noChallengeRes.body.some((o: { isChallenge?: boolean }) => o.isChallenge)).toBe(false);

    // Simulate the club having won a title (normally set by distributePrizeMoney/distributeCupPrizeMoney).
    await prisma.club.update({ where: { id: club.id }, data: { titlesWon: 2 } });

    const withChallengeRes = await request(app)
      .get(`/clubs/${club.id}/finance/sponsorship-offers`)
      .set('Authorization', `Bearer ${manager.token}`);
    const challengeOffer = withChallengeRes.body.find((o: { isChallenge?: boolean }) => o.isChallenge);
    expect(challengeOffer).toBeTruthy();
    expect(challengeOffer.type).toBe('STADIUM_NAMING');
    expect(challengeOffer.weeklyAmount).toBeGreaterThan(namingOffer.weeklyAmount);

    // Signing the challenge offer replaces the active naming-rights deal instead of being blocked as a duplicate type.
    const replaceRes = await request(app)
      .post(`/clubs/${club.id}/finance/sponsorships`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send(challengeOffer);
    expect(replaceRes.status).toBe(201);
    const namingDeals = replaceRes.body.sponsorships.filter((s: { type: string }) => s.type === 'STADIUM_NAMING');
    expect(namingDeals).toHaveLength(1);
    expect(namingDeals[0].sponsorName).toBe(challengeOffer.sponsorName);
    expect(namingDeals[0].weeklyAmount).toBe(challengeOffer.weeklyAmount);
  }, 30000);

  it('still blocks signing a second, non-challenge sponsorship of a type already held', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Dupe FC');

    /**
     * A club arrives holding the sponsors its ground earns (see `sponsorBoardFor`), and the offers list
     * only ever carries types it does not already have. Whichever of those it signs, signing it again must
     * still be refused.
     */
    const offersRes = await request(app)
      .get(`/clubs/${club.id}/finance/sponsorship-offers`)
      .set('Authorization', `Bearer ${manager.token}`);
    const offer = offersRes.body.find(
      (o: { isChallenge?: boolean; isPoachOffer?: boolean }) => !o.isChallenge && !o.isPoachOffer,
    );
    expect(offer, 'a new club must still have something left to negotiate').toBeTruthy();

    const firstSignRes = await request(app)
      .post(`/clubs/${club.id}/finance/sponsorships`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send(offer);
    expect(firstSignRes.status).toBe(201);

    const secondSignRes = await request(app)
      .post(`/clubs/${club.id}/finance/sponsorships`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ ...offer, id: randomUUID() });
    expect(secondSignRes.status).toBe(400);
  }, 30000);
});

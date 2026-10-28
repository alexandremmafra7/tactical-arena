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

/** Overwrites one player's age/traits directly in the DB — squad generation doesn't guarantee a 32+ player every time. */
async function patchPlayer(club: any, playerId: string, patch: Partial<{ age: number; traits: string[] }>) {
  const record = await prisma.club.findUnique({ where: { id: club.id } });
  const players = JSON.parse(record!.playersJson).map((p: any) => (p.id === playerId ? { ...p, ...patch } : p));
  await prisma.club.update({ where: { id: club.id }, data: { playersJson: JSON.stringify(players) } });
}

describe('Tutor flow', () => {
  it('appoints an eligible veteran as tutor and lets the manager remove the designation', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Tutores FC');
    const veteran = club.players[0];
    await patchPlayer(club, veteran.id, { age: 34, traits: [] });

    const setRes = await request(app).post(`/clubs/${club.id}/tutor`).set('Authorization', `Bearer ${manager.token}`).send({ playerId: veteran.id });
    expect(setRes.status).toBe(200);
    expect(setRes.body.tutorPlayerId).toBe(veteran.id);

    const removeRes = await request(app).post(`/clubs/${club.id}/tutor`).set('Authorization', `Bearer ${manager.token}`).send({ playerId: null });
    expect(removeRes.status).toBe(200);
    expect(removeRes.body.tutorPlayerId).toBeNull();
  });

  it('rejects a player younger than 32', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Jovens FC');
    const young = club.players[0];
    await patchPlayer(club, young.id, { age: 25, traits: [] });

    const res = await request(app).post(`/clubs/${club.id}/tutor`).set('Authorization', `Bearer ${manager.token}`).send({ playerId: young.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('32');
  });

  it('rejects an UNDISCIPLINED player regardless of age', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Indisciplinados FC');
    const undisciplined = club.players[0];
    await patchPlayer(club, undisciplined.id, { age: 35, traits: ['UNDISCIPLINED'] });

    const res = await request(app)
      .post(`/clubs/${club.id}/tutor`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ playerId: undisciplined.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('indisciplinado');
  });

  it('rejects a player who does not belong to the club, and a club you do not own', async () => {
    const owner = await registerAndLogin();
    const intruder = await registerAndLogin();
    const club = await createClubFor(owner.token, 'Protegido FC');

    const badPlayerRes = await request(app)
      .post(`/clubs/${club.id}/tutor`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ playerId: 'not-a-real-player-id' });
    expect(badPlayerRes.status).toBe(400);

    const intruderRes = await request(app)
      .post(`/clubs/${club.id}/tutor`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ playerId: club.players[0].id });
    expect(intruderRes.status).toBe(400);
  });

  it('lifts the tutor designation when the tutor is sold', async () => {
    const seller = await registerAndLogin();
    const buyer = await registerAndLogin();
    const sellerClub = await createClubFor(seller.token, 'Vendedor FC');
    const buyerClub = await createClubFor(buyer.token, 'Comprador FC');

    const veteran = sellerClub.players[0];
    await patchPlayer(sellerClub, veteran.id, { age: 34, traits: [] });
    const afterTutor = await request(app)
      .post(`/clubs/${sellerClub.id}/tutor`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ playerId: veteran.id });
    expect(afterTutor.body.tutorPlayerId).toBe(veteran.id);

    const listingRes = await request(app)
      .post(`/transfers/listings`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send({ clubId: sellerClub.id, playerId: veteran.id, askingPrice: 10_000 });
    expect(listingRes.status).toBe(201);

    const buyRes = await request(app)
      .post(`/transfers/listings/${listingRes.body.id}/buy`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ buyerClubId: buyerClub.id });
    expect(buyRes.status).toBe(204);

    const finalSellerClub = (await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`)).body;
    expect(finalSellerClub.tutorPlayerId).toBeNull();
  });
});

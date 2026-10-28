import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const app = createApp();

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.userId as string };
}

async function createClubFor(token: string, name: string) {
  const res = await request(app).post('/clubs').set('Authorization', `Bearer ${token}`).send({ name, country: 'BRA' });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Transfer market flow', () => {
  it('lets a club list a player and another club buy it, moving squad and budget atomically', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();

    const clubA = await createClubFor(managerA.token, 'Vendedor FC');
    const clubB = await createClubFor(managerB.token, 'Comprador FC');

    const playerToSell = clubA.players[0];
    const askingPrice = 50_000;

    const listRes = await request(app)
      .post('/transfers/listings')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ clubId: clubA.id, playerId: playerToSell.id, askingPrice });
    expect(listRes.status).toBe(201);
    const listing = listRes.body;
    expect(listing.status).toBe('ACTIVE');
    expect(listing.player.id).toBe(playerToSell.id);

    const marketRes = await request(app).get('/transfers/listings').set('Authorization', `Bearer ${managerB.token}`);
    expect(marketRes.status).toBe(200);
    expect(marketRes.body.some((l: any) => l.id === listing.id)).toBe(true);

    const buyRes = await request(app)
      .post(`/transfers/listings/${listing.id}/buy`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ buyerClubId: clubB.id });
    expect(buyRes.status).toBe(204);

    const updatedClubA = (await request(app).get(`/clubs/${clubA.id}`).set('Authorization', `Bearer ${managerA.token}`)).body;
    const updatedClubB = (await request(app).get(`/clubs/${clubB.id}`).set('Authorization', `Bearer ${managerB.token}`)).body;

    expect(updatedClubA.players.some((p: any) => p.id === playerToSell.id)).toBe(false);
    expect(updatedClubB.players.some((p: any) => p.id === playerToSell.id)).toBe(true);
    expect(updatedClubA.players.length).toBe(clubA.players.length - 1);
    expect(updatedClubB.players.length).toBe(clubB.players.length + 1);
    expect(updatedClubA.budget).toBe(clubA.budget + askingPrice);
    expect(updatedClubB.budget).toBe(clubB.budget - askingPrice);

    const marketAfter = await request(app).get('/transfers/listings').set('Authorization', `Bearer ${managerA.token}`);
    expect(marketAfter.body.some((l: any) => l.id === listing.id)).toBe(false);
  });

  it('rejects listing a player by someone who does not own the club', async () => {
    const managerA = await registerAndLogin();
    const intruder = await registerAndLogin();
    const clubA = await createClubFor(managerA.token, 'Clube Alheio');

    const res = await request(app)
      .post('/transfers/listings')
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ clubId: clubA.id, playerId: clubA.players[0].id, askingPrice: 10_000 });

    expect(res.status).toBe(400);
  });

  it('rejects buying your own listing and buying with insufficient budget', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const clubA = await createClubFor(managerA.token, 'Rico FC');
    const clubB = await createClubFor(managerB.token, 'Pobre FC');

    const listing = (
      await request(app)
        .post('/transfers/listings')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ clubId: clubA.id, playerId: clubA.players[0].id, askingPrice: 10_000 })
    ).body;

    const selfBuy = await request(app)
      .post(`/transfers/listings/${listing.id}/buy`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ buyerClubId: clubA.id });
    expect(selfBuy.status).toBe(400);

    const expensiveListing = (
      await request(app)
        .post('/transfers/listings')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ clubId: clubA.id, playerId: clubA.players[1].id, askingPrice: 999_999_999 })
    ).body;

    const brokeBuy = await request(app)
      .post(`/transfers/listings/${expensiveListing.id}/buy`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ buyerClubId: clubB.id });
    expect(brokeBuy.status).toBe(400);
  });
});

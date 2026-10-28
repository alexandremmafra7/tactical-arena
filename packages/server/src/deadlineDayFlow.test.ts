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

describe('Deadline Day live auction flow', () => {
  it('lets a club list a player, enters deadline day, bids, advances 5 times, and settles atomically', async () => {
    const managerSeller = await registerAndLogin();
    const managerBuyer = await registerAndLogin();

    const sellerClub = await createClubFor(managerSeller.token, 'Vendedor Leilão FC');
    const buyerClub = await createClubFor(managerBuyer.token, 'Comprador Leilão FC');

    const { prisma } = await import('./db/prisma.js');
    await prisma.club.update({ where: { id: buyerClub.id }, data: { budget: 200_000_000 } });

    const playerToSell = sellerClub.players[0];
    const askingPrice = 80_000;
    const winningBid = 100_000_000;

    // List player on regular market first
    const listRes = await request(app)
      .post('/transfers/listings')
      .set('Authorization', `Bearer ${managerSeller.token}`)
      .send({ clubId: sellerClub.id, playerId: playerToSell.id, askingPrice });
    expect(listRes.status).toBe(201);
    const listing = listRes.body;

    // Fetch deadline day
    const deadlineRes = await request(app)
      .get(`/transfers/deadline-day?clubId=${buyerClub.id}`)
      .set('Authorization', `Bearer ${managerBuyer.token}`);
    expect(deadlineRes.status).toBe(200);
    const deadlineState = deadlineRes.body;
    expect(deadlineState.isActive).toBe(true);

    const auction = deadlineState.auctions.find((a: any) => a.player.id === playerToSell.id);
    expect(auction).toBeTruthy();

    // Place bid with a strong amount
    const bidRes = await request(app)
      .post('/transfers/deadline-day/bid')
      .set('Authorization', `Bearer ${managerBuyer.token}`)
      .send({
        auctionId: auction.id,
        buyerClubId: buyerClub.id,
        amount: winningBid,
        wageOffer: playerToSell.wage || 20_000,
      });
    expect(bidRes.status).toBe(200);
    expect(bidRes.body.auctions.find((a: any) => a.id === auction.id).highestBidderClubId).toBe(buyerClub.id);

    // Advance 5 times (12 -> 8 -> 4 -> 2 -> 1 -> 0)
    for (let i = 0; i < 5; i += 1) {
      const advRes = await request(app)
        .post('/transfers/deadline-day/advance')
        .set('Authorization', `Bearer ${managerBuyer.token}`)
        .send({ clubId: buyerClub.id });
      expect(advRes.status).toBe(200);
    }

    // Verify final settlement
    const updatedSeller = (await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${managerSeller.token}`)).body;
    const updatedBuyer = (await request(app).get(`/clubs/${buyerClub.id}`).set('Authorization', `Bearer ${managerBuyer.token}`)).body;

    expect(updatedSeller.players.some((p: any) => p.id === playerToSell.id)).toBe(false);
    expect(updatedBuyer.players.some((p: any) => p.id === playerToSell.id)).toBe(true);
    expect(updatedSeller.budget).toBe(sellerClub.budget + winningBid);
    expect(updatedBuyer.budget).toBe(200_000_000 - winningBid);
  });

  it('rejects bidding with a club the manager does not own', async () => {
    const managerA = await registerAndLogin();
    const intruder = await registerAndLogin();

    const clubA = await createClubFor(managerA.token, 'Clube Legítimo FC');
    const playerToSell = clubA.players[0];

    await request(app)
      .post('/transfers/listings')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ clubId: clubA.id, playerId: playerToSell.id, askingPrice: 50_000 });

    const deadlineRes = await request(app)
      .get(`/transfers/deadline-day?clubId=${clubA.id}`)
      .set('Authorization', `Bearer ${managerA.token}`);
    const auction = deadlineRes.body.auctions[0];

    const intruderBid = await request(app)
      .post('/transfers/deadline-day/bid')
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({
        auctionId: auction.id,
        buyerClubId: clubA.id,
        amount: 60_000,
        wageOffer: 25_000,
      });

    expect(intruderBid.status).toBe(400);
  });
});

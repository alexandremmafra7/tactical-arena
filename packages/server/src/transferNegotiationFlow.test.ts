import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { processWeeklyTickForClub } from './services/weeklyTickService.js';

const app = createApp();

/**
 * A week passes for this club, then it is read back.
 *
 * There is no per-club "avançar semana" route any more: time is not something a manager does to their
 * own club, it is something that happens to everyone at once. These tests are about one club, so they
 * drive the single-club form — running the whole world here would make every suite pay for every other
 * suite's leftover clubs, and this database is shared and never emptied.
 */
let weekCursor = 0;
async function tickWeek(clubId: string, token: string) {
  weekCursor += 1;
  await processWeeklyTickForClub(clubId, `2035-04-${String(weekCursor).padStart(2, "0")}`);
  return (await request(app).get(`/clubs/${clubId}`).set("Authorization", `Bearer ${token}`)).body;
}


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

describe('Release clause instant buyout', () => {
  it('lets a buyer acquire a player by paying the full release clause, with no seller consent', async () => {
    const seller = await registerAndLogin();
    const buyer = await registerAndLogin();
    const sellerClub = await createClubFor(seller.token, 'Vendedor FC');
    const buyerClub = await createClubFor(buyer.token, 'Comprador FC');
    const target = sellerClub.players[0];

    /**
     * Balances are read immediately before the transfer, not taken from what the clubs were created with.
     *
     * Money moves for reasons that have nothing to do with this test now: the season turn pays prize
     * money and television money to every club in a league, and any suite in this shared database can
     * trigger one. What this test means is the delta the transfer causes, so that is what it measures.
     */
    const buyerBefore = (await request(app).get(`/clubs/${buyerClub.id}`).set('Authorization', `Bearer ${buyer.token}`)).body.budget;
    const sellerBefore = (await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`)).body.budget;

    const res = await request(app)
      .post('/transfers/release-clause')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ sellerClubId: sellerClub.id, playerId: target.id, buyerClubId: buyerClub.id });
    expect(res.status).toBe(204);

    const updatedBuyer = await request(app).get(`/clubs/${buyerClub.id}`).set('Authorization', `Bearer ${buyer.token}`);
    const updatedSeller = await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`);

    expect(updatedBuyer.body.players.some((p: any) => p.id === target.id)).toBe(true);
    expect(updatedSeller.body.players.some((p: any) => p.id === target.id)).toBe(false);
    expect(updatedBuyer.body.budget).toBe(buyerBefore - target.releaseClause);
    expect(updatedSeller.body.budget).toBe(sellerBefore + target.releaseClause);
  });

  it('rejects paying a release clause for a player who no longer belongs to the seller club', async () => {
    const seller = await registerAndLogin();
    const buyer = await registerAndLogin();
    const sellerClub = await createClubFor(seller.token, 'Vendedor Fantasma FC');
    const buyerClub = await createClubFor(buyer.token, 'Comprador Fantasma FC');

    const res = await request(app)
      .post('/transfers/release-clause')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ sellerClubId: sellerClub.id, playerId: 'not-a-real-id', buyerClubId: buyerClub.id });
    expect(res.status).toBe(400);
  });
});

describe('Negotiated transfer proposals', () => {
  it('accepts a cash-only proposal (paid upfront): players and money move immediately', async () => {
    const seller = await registerAndLogin();
    const buyer = await registerAndLogin();
    const sellerClub = await createClubFor(seller.token, 'Vendedor Cash FC');
    const buyerClub = await createClubFor(buyer.token, 'Comprador Cash FC');
    const target = sellerClub.players[0];
    const cashAmount = Math.round(target.releaseClause * 0.6);

    // Balances read now, not taken from creation: the season turn pays prize and television money to
    // every club in a league, and any suite in this shared database can trigger one.
    const buyerBefore = (await request(app).get(`/clubs/${buyerClub.id}`).set('Authorization', `Bearer ${buyer.token}`)).body.budget;
    const sellerBefore = (await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`)).body.budget;

    const createRes = await request(app)
      .post('/transfers/proposals')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        buyerClubId: buyerClub.id,
        sellerClubId: sellerClub.id,
        targetPlayerId: target.id,
        cashAmount,
        installments: 1,
        offeredPlayerIds: [],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('PENDING');

    const acceptRes = await request(app)
      .post(`/transfers/proposals/${createRes.body.id}/accept`)
      .set('Authorization', `Bearer ${seller.token}`);
    expect(acceptRes.status).toBe(204);

    const updatedBuyer = await request(app).get(`/clubs/${buyerClub.id}`).set('Authorization', `Bearer ${buyer.token}`);
    const updatedSeller = await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`);

    expect(updatedBuyer.body.players.some((p: any) => p.id === target.id)).toBe(true);
    expect(updatedSeller.body.players.some((p: any) => p.id === target.id)).toBe(false);
    expect(updatedBuyer.body.budget).toBe(buyerBefore - cashAmount);
    expect(updatedSeller.body.budget).toBe(sellerBefore + cashAmount);
    expect(updatedBuyer.body.pendingTransferPayments).toHaveLength(0);
  });

  it('accepts an installment proposal: no cash moves upfront, budgets shift gradually across weeks', async () => {
    const seller = await registerAndLogin();
    const buyer = await registerAndLogin();
    const sellerClub = await createClubFor(seller.token, 'Vendedor Parcelado FC');
    const buyerClub = await createClubFor(buyer.token, 'Comprador Parcelado FC');
    const target = sellerClub.players[0];
    const cashAmount = target.releaseClause;
    const installments = 4;

    // Read now rather than trusting the creation values — see the release-clause test above.
    const buyerBefore = (await request(app).get(`/clubs/${buyerClub.id}`).set('Authorization', `Bearer ${buyer.token}`)).body.budget;

    const createRes = await request(app)
      .post('/transfers/proposals')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        buyerClubId: buyerClub.id,
        sellerClubId: sellerClub.id,
        targetPlayerId: target.id,
        cashAmount,
        installments,
        offeredPlayerIds: [],
      });
    expect(createRes.status).toBe(201);

    const acceptRes = await request(app)
      .post(`/transfers/proposals/${createRes.body.id}/accept`)
      .set('Authorization', `Bearer ${seller.token}`);
    expect(acceptRes.status).toBe(204);

    const rightAfterAccept = await request(app).get(`/clubs/${buyerClub.id}`).set('Authorization', `Bearer ${buyer.token}`);
    expect(rightAfterAccept.body.players.some((p: any) => p.id === target.id)).toBe(true);
    // Player moves immediately, but no cash yet — that's the whole point of installments.
    expect(rightAfterAccept.body.budget).toBe(buyerBefore);
    expect(rightAfterAccept.body.pendingTransferPayments).toHaveLength(1);
    const weeklyAmount = rightAfterAccept.body.pendingTransferPayments[0].weeklyAmount;

    /**
     * Only the buyer's week is run, so the seller's balance still moves for exactly one reason: the
     * instalment landing in it. In the game both clubs live through the same week, but a test that ran
     * the whole world here would be paying for every club every other suite ever created, in a database
     * that is shared and never emptied.
     */
    const sellerBefore = (await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`)).body;
    let sellerAfterTick = sellerBefore;
    let buyerAfterTick = rightAfterAccept.body;
    for (let i = 0; i < installments; i++) {
      buyerAfterTick = await tickWeek(buyerClub.id, buyer.token);
      sellerAfterTick = (await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`)).body;
    }

    expect(buyerAfterTick.pendingTransferPayments).toHaveLength(0);

    // What the seller gained beyond its own running costs is exactly the instalments, to the last real.
    expect(sellerAfterTick.budget - sellerBefore.budget).toBe(weeklyAmount * installments);
  }, 30000);

  it('accepts a player-for-player swap proposal with no cash involved', async () => {
    const seller = await registerAndLogin();
    const buyer = await registerAndLogin();
    const sellerClub = await createClubFor(seller.token, 'Vendedor Troca FC');
    const buyerClub = await createClubFor(buyer.token, 'Comprador Troca FC');
    const target = sellerClub.players[0];
    const offered = buyerClub.players[0];

    // Read now rather than trusting the creation values — see the release-clause test above.
    const swapBuyerBefore = (await request(app).get(`/clubs/${buyerClub.id}`).set('Authorization', `Bearer ${buyer.token}`)).body.budget;
    const swapSellerBefore = (await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`)).body.budget;

    const createRes = await request(app)
      .post('/transfers/proposals')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        buyerClubId: buyerClub.id,
        sellerClubId: sellerClub.id,
        targetPlayerId: target.id,
        cashAmount: 0,
        installments: 1,
        offeredPlayerIds: [offered.id],
      });
    expect(createRes.status).toBe(201);

    const acceptRes = await request(app)
      .post(`/transfers/proposals/${createRes.body.id}/accept`)
      .set('Authorization', `Bearer ${seller.token}`);
    expect(acceptRes.status).toBe(204);

    const updatedBuyer = await request(app).get(`/clubs/${buyerClub.id}`).set('Authorization', `Bearer ${buyer.token}`);
    const updatedSeller = await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`);

    expect(updatedBuyer.body.players.some((p: any) => p.id === target.id)).toBe(true);
    expect(updatedBuyer.body.players.some((p: any) => p.id === offered.id)).toBe(false);
    expect(updatedSeller.body.players.some((p: any) => p.id === offered.id)).toBe(true);
    expect(updatedSeller.body.players.some((p: any) => p.id === target.id)).toBe(false);
    expect(updatedBuyer.body.budget).toBe(swapBuyerBefore);
    expect(updatedSeller.body.budget).toBe(swapSellerBefore);
  });

  it('lets the seller reject and the buyer withdraw a pending proposal, with no side effects', async () => {
    const seller = await registerAndLogin();
    const buyer = await registerAndLogin();
    const sellerClub = await createClubFor(seller.token, 'Vendedor Recusa FC');
    const buyerClub = await createClubFor(buyer.token, 'Comprador Recusa FC');
    const target = sellerClub.players[0];

    const rejectCreate = await request(app)
      .post('/transfers/proposals')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ buyerClubId: buyerClub.id, sellerClubId: sellerClub.id, targetPlayerId: target.id, cashAmount: 1000, installments: 1, offeredPlayerIds: [] });
    expect(rejectCreate.status).toBe(201);
    const rejectRes = await request(app)
      .post(`/transfers/proposals/${rejectCreate.body.id}/reject`)
      .set('Authorization', `Bearer ${seller.token}`);
    expect(rejectRes.status).toBe(204);

    const withdrawCreate = await request(app)
      .post('/transfers/proposals')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ buyerClubId: buyerClub.id, sellerClubId: sellerClub.id, targetPlayerId: target.id, cashAmount: 1000, installments: 1, offeredPlayerIds: [] });
    expect(withdrawCreate.status).toBe(201);
    const withdrawRes = await request(app)
      .post(`/transfers/proposals/${withdrawCreate.body.id}/withdraw`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect(withdrawRes.status).toBe(204);

    const stillOwned = await request(app).get(`/clubs/${sellerClub.id}`).set('Authorization', `Bearer ${seller.token}`);
    expect(stillOwned.body.players.some((p: any) => p.id === target.id)).toBe(true);
  });

  it('rejects accepting a proposal whose target player was sold elsewhere while it waited', async () => {
    const seller = await registerAndLogin();
    const buyerA = await registerAndLogin();
    const buyerB = await registerAndLogin();
    const sellerClub = await createClubFor(seller.token, 'Vendedor Concorrido FC');
    const buyerClubA = await createClubFor(buyerA.token, 'Comprador A FC');
    const buyerClubB = await createClubFor(buyerB.token, 'Comprador B FC');
    const target = sellerClub.players[0];

    const proposalRes = await request(app)
      .post('/transfers/proposals')
      .set('Authorization', `Bearer ${buyerA.token}`)
      .send({
        buyerClubId: buyerClubA.id,
        sellerClubId: sellerClub.id,
        targetPlayerId: target.id,
        cashAmount: 1000,
        installments: 1,
        offeredPlayerIds: [],
      });
    expect(proposalRes.status).toBe(201);

    // Buyer B swoops in and pays the release clause first, moving the player away from the seller.
    const releaseRes = await request(app)
      .post('/transfers/release-clause')
      .set('Authorization', `Bearer ${buyerB.token}`)
      .send({ sellerClubId: sellerClub.id, playerId: target.id, buyerClubId: buyerClubB.id });
    expect(releaseRes.status).toBe(204);

    const acceptRes = await request(app)
      .post(`/transfers/proposals/${proposalRes.body.id}/accept`)
      .set('Authorization', `Bearer ${seller.token}`);
    expect(acceptRes.status).toBe(400);
  });
});

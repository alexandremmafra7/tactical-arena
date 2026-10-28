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

function baseTacticFields(club: any, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    clubId: club.id,
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'BALANCED',
    attackApproach: 'COUNTER_ATTACK',
    lineup: club.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
    substitutes: [],
    plannedSubstitutions: [],
    ...overrides,
  };
}

describe('Post-match morale, fatigue and commitment', () => {
  it('moves morale on both sides, only raises fatigue for players who actually took the pitch, and leaves a starter with higher commitment than a player left out of the squad', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const clubA = await createClubFor(managerA.token, 'Moral A FC');
    const clubB = await createClubFor(managerB.token, 'Moral B FC');

    // Squad harmony (randomly-rolled problem personalities dragging morale down) is a separate mechanic
    // covered elsewhere; clear traits here so this test's win/loss morale assertions aren't at the mercy
    // of how many problematic traits this run's squad happened to roll.
    clubA.players = clubA.players.map((p: any) => ({ ...p, traits: [] }));
    await prisma.club.update({ where: { id: clubA.id }, data: { playersJson: JSON.stringify(clubA.players) } });

    const benchPlayer = clubA.players[15];
    const match = (
      await request(app)
        .post('/matches')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send(baseTacticFields(clubA));

    const afterB = await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send(baseTacticFields(clubB));
    expect(afterB.status).toBe(200);
    expect(afterB.body.status).toBe('LIVE');

    const fulltime = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 90 });
    expect(fulltime.status).toBe(200);
    expect(fulltime.body.status).toBe('SIMULATED');

    const result = fulltime.body.result;
    const homeWon = result.homeGoals > result.awayGoals;
    const homeLost = result.homeGoals < result.awayGoals;

    const finalClubA = (await request(app).get(`/clubs/${clubA.id}`).set('Authorization', `Bearer ${managerA.token}`)).body;
    const startingPlayerA = finalClubA.players.find((p: any) => p.id === clubA.players[0].id);
    const benchPlayerA = finalClubA.players.find((p: any) => p.id === benchPlayer.id);

    // Whoever started gained fatigue from playing the full 90 minutes; a bench player who never entered did not.
    expect(startingPlayerA.fatigue).toBeGreaterThan(0);
    expect(benchPlayerA.fatigue).toBe(0);

    if (homeWon) expect(startingPlayerA.morale).toBeGreaterThan(50);
    if (homeLost) expect(startingPlayerA.morale).toBeLessThan(50);
    // A player who never played still shares in the team's result-driven morale swing.
    expect(benchPlayerA.morale).toBe(startingPlayerA.morale);

    // The starter felt trusted by getting the nod; the player left out of the squad entirely did not.
    expect(startingPlayerA.commitment).toBeGreaterThan(50);
    expect(benchPlayerA.commitment).toBeLessThan(50);
  });
});

describe('Individualized fatigue gain', () => {
  it('leaves a high-physical starter with less post-match fatigue than a low-physical starter who played the same minutes', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const clubA = await createClubFor(managerA.token, 'Fisico A FC');
    const clubB = await createClubFor(managerB.token, 'Fisico B FC');

    const sturdyId = clubA.players[0].id;
    const frailId = clubA.players[1].id;
    clubA.players = clubA.players.map((p: any) => {
      if (p.id === sturdyId) return { ...p, traits: [], attributes: { ...p.attributes, physical: 95 } };
      if (p.id === frailId) return { ...p, traits: [], attributes: { ...p.attributes, physical: 5 } };
      return { ...p, traits: [] };
    });
    await prisma.club.update({ where: { id: clubA.id }, data: { playersJson: JSON.stringify(clubA.players) } });

    const match = (
      await request(app)
        .post('/matches')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerA.token}`).send(baseTacticFields(clubA));
    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerB.token}`).send(baseTacticFields(clubB));
    await request(app).post(`/matches/${match.id}/live/advance`).set('Authorization', `Bearer ${managerA.token}`).send({ toMinute: 90 });

    const finalClubA = (await request(app).get(`/clubs/${clubA.id}`).set('Authorization', `Bearer ${managerA.token}`)).body;
    const sturdy = finalClubA.players.find((p: any) => p.id === sturdyId);
    const frail = finalClubA.players.find((p: any) => p.id === frailId);

    expect(sturdy.fatigue).toBeLessThan(frail.fatigue);
  });
});

describe('TEMPERAMENTAL morale multiplier', () => {
  it('swings a TEMPERAMENTAL starter\'s morale further from neutral than a plain teammate off the same result', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const clubA = await createClubFor(managerA.token, 'Temperamental FC');
    const clubB = await createClubFor(managerB.token, 'Estavel FC');

    const temperamentalPlayer = clubA.players[0];
    const steadyPlayer = clubA.players[1];
    // Clear every other trait so the squad-harmony mechanic (a separate, uniform effect) stays a no-op here —
    // one TEMPERAMENTAL starter alone is within the free allowance and triggers no squad-wide penalty.
    const patchedPlayers = clubA.players.map((p: any) => (p.id === temperamentalPlayer.id ? { ...p, traits: ['TEMPERAMENTAL'] } : { ...p, traits: [] }));
    await prisma.club.update({ where: { id: clubA.id }, data: { playersJson: JSON.stringify(patchedPlayers) } });

    const match = (
      await request(app)
        .post('/matches')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send(baseTacticFields(clubA));
    const afterB = await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send(baseTacticFields(clubB));
    expect(afterB.status).toBe(200);

    await request(app).post(`/matches/${match.id}/live/advance`).set('Authorization', `Bearer ${managerA.token}`).send({ toMinute: 90 });

    const finalClubA = (await request(app).get(`/clubs/${clubA.id}`).set('Authorization', `Bearer ${managerA.token}`)).body;
    const finalTemperamental = finalClubA.players.find((p: any) => p.id === temperamentalPlayer.id);
    const finalSteady = finalClubA.players.find((p: any) => p.id === steadyPlayer.id);

    expect(Math.abs(finalTemperamental.morale - 50)).toBeGreaterThan(Math.abs(finalSteady.morale - 50));
  });
});

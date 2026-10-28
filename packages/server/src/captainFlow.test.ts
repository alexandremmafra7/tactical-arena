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

describe('Captain flow', () => {
  it('sets a captain and grows their tenure across weeks, resetting when the captain changes', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Capitães FC');
    // Youngest on the squad: guaranteed not to hit retirement age within the couple of
    // ticks this test runs, unlike an arbitrary player who could happen to be generated near 35.
    const playerA = [...club.players].sort((a: any, b: any) => a.age - b.age)[0];

    const setRes = await request(app)
      .post(`/clubs/${club.id}/captain`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ playerId: playerA.id });
    expect(setRes.status).toBe(200);
    expect(setRes.body.captainPlayerId).toBe(playerA.id);
    expect(setRes.body.captainWeeksServed).toBe(0);

    let club2 = await tickWeek(club.id, manager.token);
    expect(club2.captainWeeksServed).toBe(1);

    club2 = await tickWeek(club.id, manager.token);
    expect(club2.captainWeeksServed).toBe(2);

    // Read the captain from the squad as it stands after those weeks, not from the original snapshot.
    const playerB = club2.players.find((p: any) => p.id !== playerA.id);
    expect(playerB).toBeDefined();

    const changeRes = await request(app)
      .post(`/clubs/${club.id}/captain`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ playerId: playerB.id });
    expect(changeRes.status).toBe(200);
    expect(changeRes.body.captainPlayerId).toBe(playerB.id);
    expect(changeRes.body.captainWeeksServed).toBe(0);
  }, 30000);

  it('rejects setting a captain you do not own, and a player who is not on the club', async () => {
    const owner = await registerAndLogin();
    const intruder = await registerAndLogin();
    const club = await createClubFor(owner.token, 'Protegido FC');

    const intruderRes = await request(app)
      .post(`/clubs/${club.id}/captain`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ playerId: club.players[0].id });
    expect(intruderRes.status).toBe(400);

    const badPlayerRes = await request(app)
      .post(`/clubs/${club.id}/captain`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ playerId: 'not-a-real-player-id' });
    expect(badPlayerRes.status).toBe(400);
  });
});

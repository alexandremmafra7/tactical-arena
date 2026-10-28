import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const app = createApp();
const COUNTRY = 'JPN';

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string };
}

async function createClubFor(token: string, name: string) {
  const res = await request(app).post('/clubs').set('Authorization', `Bearer ${token}`).send({ name, country: COUNTRY });
  expect(res.status).toBe(201);
  return res.body;
}

/** Every club in this suite is human-owned, so every fixture is created live (see createLiveMatch) —
 *  finish each to fulltime before the bracket can progress, same as a real manager eventually would. */
async function finishAnyLiveMatches(fixtures: any[], token: string) {
  for (const fixture of fixtures) {
    if (!fixture.matchId || fixture.winnerClubId !== null) continue;
    const match = (await request(app).get(`/matches/${fixture.matchId}`).set('Authorization', `Bearer ${token}`)).body;
    if (match.status === 'LIVE') {
      await request(app).post(`/matches/${fixture.matchId}/live/advance`).set('Authorization', `Bearer ${token}`).send({ toMinute: 90 });
    }
  }
}

describe('Cup flow end-to-end', () => {
  it('runs an 8-club single-elimination bracket to a single champion', async () => {
    const owner = await registerAndLogin();
    const clubs = [];
    for (let i = 0; i < 8; i++) {
      clubs.push(await createClubFor(owner.token, `Cup Club ${randomUUID().slice(0, 8)}`));
    }
    const clubIds = clubs.map((c) => c.id);

    const createRes = await request(app)
      .post('/cups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Copa de Teste', countryCode: COUNTRY, clubIds });
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('IN_PROGRESS');
    expect(createRes.body.fixtures).toHaveLength(4);
    expect(new Set(createRes.body.clubIds)).toEqual(new Set(clubIds));

    let current = createRes.body;
    let guard = 0;
    while (current.status !== 'FINISHED' && guard < 20) {
      const advanceRes = await request(app).post(`/cups/${current.id}/advance-round`).set('Authorization', `Bearer ${owner.token}`);
      expect(advanceRes.status).toBe(200);
      current = advanceRes.body;
      await finishAnyLiveMatches(current.fixtures, owner.token);
      guard++;
    }

    expect(current.status).toBe('FINISHED');
    expect(current.fixtures).toHaveLength(7); // 4 (QF) + 2 (SF) + 1 (final)
    expect(clubIds).toContain(current.championClubId);
    expect(current.fixtures.every((f: any) => f.matchId !== null && f.winnerClubId !== null)).toBe(true);

    // Every round's winners feed exactly the next round's fixtures.
    const round1Winners = current.fixtures.filter((f: any) => f.round === 1).map((f: any) => f.winnerClubId).sort();
    const round2Clubs = current.fixtures
      .filter((f: any) => f.round === 2)
      .flatMap((f: any) => [f.homeClubId, f.awayClubId])
      .sort();
    expect(round2Clubs).toEqual(round1Winners);

    const round2Winners = current.fixtures.filter((f: any) => f.round === 2).map((f: any) => f.winnerClubId).sort();
    const finalClubs = current.fixtures
      .filter((f: any) => f.round === 3)
      .flatMap((f: any) => [f.homeClubId, f.awayClubId])
      .sort();
    expect(finalClubs).toEqual(round2Winners);

    const finalFixture = current.fixtures.find((f: any) => f.round === 3);
    expect(finalFixture.winnerClubId).toBe(current.championClubId);
  }, 60000);

  it('rejects creating a cup with a non-power-of-2 number of clubs', async () => {
    const owner = await registerAndLogin();
    const clubs = [];
    for (let i = 0; i < 3; i++) {
      clubs.push(await createClubFor(owner.token, `Odd Club ${randomUUID().slice(0, 8)}`));
    }

    const res = await request(app)
      .post('/cups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Copa Inválida', countryCode: COUNTRY, clubIds: clubs.map((c) => c.id) });
    expect(res.status).toBe(400);
  });
});

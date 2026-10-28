import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { turnSeasonForClub } from './services/seasonTurnService.js';

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

describe('Youth academy flow', () => {
  it('creates a new club with a sub-20 academy alongside the main squad', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Base FC');

    expect(club.academyPlayers.length).toBeGreaterThan(0);
    for (const p of club.academyPlayers) {
      expect(p.age).toBeLessThan(20);
    }
  });

  it('promotes an academy player into the main squad, keeping their id', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Promoção FC');
    const prospect = club.academyPlayers[0];

    const res = await request(app)
      .post(`/clubs/${club.id}/academy/${prospect.id}/promote`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(res.status).toBe(200);

    expect(res.body.academyPlayers.some((p: any) => p.id === prospect.id)).toBe(false);
    expect(res.body.players.some((p: any) => p.id === prospect.id)).toBe(true);
    expect(res.body.players.length).toBe(club.players.length + 1);
  });

  it('releases an academy player with no financial compensation', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Dispensa FC');
    const prospect = club.academyPlayers[0];

    const res = await request(app)
      .post(`/clubs/${club.id}/academy/${prospect.id}/release`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(res.status).toBe(200);

    expect(res.body.academyPlayers.some((p: any) => p.id === prospect.id)).toBe(false);
    expect(res.body.academyPlayers.length).toBe(club.academyPlayers.length - 1);
    expect(res.body.budget).toBe(club.budget);
  });

  it('trains an academy player, spending budget and boosting their developmentPoints', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Treino Base FC');
    const prospect = club.academyPlayers[0];

    const res = await request(app)
      .post(`/clubs/${club.id}/academy/${prospect.id}/train`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(res.status).toBe(200);
    expect(res.body.budget).toBeLessThan(club.budget);

    const trained = res.body.academyPlayers.find((p: any) => p.id === prospect.id);
    expect(trained.developmentPoints).toBeGreaterThan(0);
  });

  it('rejects academy actions from someone who does not own the club, and for a player not in the academy', async () => {
    const owner = await registerAndLogin();
    const intruder = await registerAndLogin();
    const club = await createClubFor(owner.token, 'Protegida FC');
    const prospect = club.academyPlayers[0];

    const intruderRes = await request(app)
      .post(`/clubs/${club.id}/academy/${prospect.id}/promote`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(intruderRes.status).toBe(400);

    const wrongPlayerRes = await request(app)
      .post(`/clubs/${club.id}/academy/not-a-real-id/promote`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(wrongPlayerRes.status).toBe(400);

    const mainSquadPlayerRes = await request(app)
      .post(`/clubs/${club.id}/academy/${club.players[0].id}/promote`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(mainSquadPlayerRes.status).toBe(400);
  });

  it('graduates an academy prospect into the main squad once they turn 20, refilling the academy slot', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Graduação FC');

    /**
     * Prospects start at 14-19, so six turns of the year guarantee at least one reaches 20. They used to
     * reach it in six *weeks*, because the weekly tick aged everyone a year at a time — which is exactly
     * the confusion the season turn exists to undo.
     */
    let current = club;
    for (let year = 0; year < 6; year++) {
      await turnSeasonForClub(club.id, 2027 + year);
      current = (await request(app).get(`/clubs/${club.id}`).set('Authorization', `Bearer ${manager.token}`)).body;
    }

    // The academy pipeline always stays full...
    expect(current.academyPlayers).toHaveLength(club.academyPlayers.length);
    // ...but at least one original prospect id should have moved up into the main squad.
    const originalAcademyIds = club.academyPlayers.map((p: any) => p.id);
    const graduatedIds = originalAcademyIds.filter((id: string) => current.players.some((p: any) => p.id === id));
    expect(graduatedIds.length).toBeGreaterThan(0);
    for (const id of graduatedIds) {
      expect(current.academyPlayers.some((p: any) => p.id === id)).toBe(false);
    }
  }, 30000);
});

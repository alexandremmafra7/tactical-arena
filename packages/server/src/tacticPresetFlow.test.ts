import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

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

function tacticFor(club: any) {
  return {
    clubId: club.id,
    formation: '4-3-3',
    mentality: 'attacking',
    attackStyle: 'WINGS',
    markingStyle: 'ZONAL',
    attackApproach: 'TOTAL_ATTACK',
    lineup: club.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
    substitutes: club.players.slice(11, 16).map((p: any) => ({ playerId: p.id })),
  };
}

describe('Tactic preset flow', () => {
  it('saves, lists and deletes a named tactic plan for a club', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Planos FC');

    const saveRes = await request(app)
      .post(`/clubs/${club.id}/tactic-presets`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Pressão total', tactic: tacticFor(club) });
    expect(saveRes.status).toBe(201);
    expect(saveRes.body.name).toBe('Pressão total');
    expect(saveRes.body.attackStyle).toBe('WINGS');
    expect(saveRes.body.lineup).toHaveLength(11);
    // The bench is saved and reloaded alongside the lineup — a manager's XI+bench choice sticks together
    // as one standing tactic instead of the bench resetting to empty every time the preset is applied.
    expect(saveRes.body.substitutes).toHaveLength(5);

    const listRes = await request(app).get(`/clubs/${club.id}/tactic-presets`).set('Authorization', `Bearer ${manager.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(saveRes.body.id);
    expect(listRes.body[0].substitutes).toHaveLength(5);

    const deleteRes = await request(app)
      .delete(`/clubs/${club.id}/tactic-presets/${saveRes.body.id}`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(deleteRes.status).toBe(204);

    const listAfter = await request(app).get(`/clubs/${club.id}/tactic-presets`).set('Authorization', `Bearer ${manager.token}`);
    expect(listAfter.body).toHaveLength(0);
  });

  it('rejects saving a preset for a club you do not own, and deleting a preset you do not own', async () => {
    const owner = await registerAndLogin();
    const intruder = await registerAndLogin();
    const club = await createClubFor(owner.token, 'Alheio FC');

    const saveRes = await request(app)
      .post(`/clubs/${club.id}/tactic-presets`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ name: 'Roubado', tactic: tacticFor(club) });
    expect(saveRes.status).toBe(400);

    const ownedPreset = await request(app)
      .post(`/clubs/${club.id}/tactic-presets`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Do dono', tactic: tacticFor(club) });

    const deleteRes = await request(app)
      .delete(`/clubs/${club.id}/tactic-presets/${ownedPreset.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(deleteRes.status).toBe(400);
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

const app = createApp();

async function registerAndCreateClub() {
  const email = `${randomUUID()}@test.com`;
  const auth = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(auth.status).toBe(201);
  const token = auth.body.token as string;
  const created = await request(app)
    .post('/clubs')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Vestiario ${randomUUID()}`, country: 'BRA' });
  expect(created.status).toBe(201);
  return { token, club: created.body };
}

async function register() {
  const auth = await request(app)
    .post('/auth/register')
    .send({ email: `${randomUUID()}@test.com`, password: 'password123' });
  expect(auth.status).toBe(201);
  return auth.body.token as string;
}

describe('locker room flow', () => {
  it('derives and persists a locker room state for an authenticated reader', async () => {
    const { token, club } = await registerAndCreateClub();

    const response = await request(app)
      .get(`/clubs/${club.id}/locker-room`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.hierarchy).toHaveLength(club.players.length);
    expect(response.body).toEqual(expect.objectContaining({
      squadCohesion: expect.any(Number),
      managerSupport: expect.any(Number),
      atmosphere: expect.any(String),
    }));

    const stored = await prisma.club.findUniqueOrThrow({ where: { id: club.id } });
    expect(JSON.parse(stored.lockerRoomJson)).toEqual(response.body);
  });

  it('applies a team talk atomically and rejects a non-owner', async () => {
    const { token, club } = await registerAndCreateClub();
    const otherToken = await register();
    const beforeMorale = new Map<string, number>(club.players.map((player: { id: string; morale: number }) => [player.id, player.morale]));

    const response = await request(app)
      .post(`/clubs/${club.id}/team-talk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ talkId: 'PRE_MATCH:PASSIONATE', context: 'PRE_MATCH', scoreDifferential: 0 });

    expect(response.status).toBe(200);
    expect(response.body.overallReaction).toMatch(/^(INSPIRED|FOCUSED)$/);
    expect(response.body.moraleModifiers[club.players[0].id]).toBeTypeOf('number');

    const stored = await prisma.club.findUniqueOrThrow({ where: { id: club.id } });
    const players = JSON.parse(stored.playersJson) as Array<{ id: string; morale: number }>;
    for (const player of players) {
      const expected = Math.max(0, Math.min(100, beforeMorale.get(player.id)! + response.body.moraleModifiers[player.id]));
      expect(player.morale).toBe(expected);
    }
    expect(JSON.parse(stored.lockerRoomJson).hierarchy).toHaveLength(players.length);

    const forbidden = await request(app)
      .post(`/clubs/${club.id}/team-talk`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ talkId: 'PRE_MATCH:PASSIONATE', context: 'PRE_MATCH', scoreDifferential: 0 });
    expect(forbidden.status).toBe(400);
  });

  it('validates team-talk input at the route boundary', async () => {
    const { token, club } = await registerAndCreateClub();
    const response = await request(app)
      .post(`/clubs/${club.id}/team-talk`)
      .set('Authorization', `Bearer ${token}`)
      .send({ talkId: 42, context: 'INVALID', scoreDifferential: 'one' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Preleção inválida');
  });
});

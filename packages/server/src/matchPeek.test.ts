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

async function createClub(token: string, name: string) {
  const res = await request(app).post('/clubs').set('Authorization', `Bearer ${token}`).send({ name, country: 'BRA' });
  expect(res.status).toBe(201);
  return res.body;
}

const tacticFor = (club: any) => ({
  clubId: club.id,
  formation: '4-4-2',
  mentality: 'balanced',
  attackStyle: 'THROUGH_MIDDLE',
  markingStyle: 'BALANCED',
  attackApproach: 'COUNTER_ATTACK',
  lineup: club.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
});

/** Partida ao vivo entre dois técnicos, no minuto 0. */
async function liveMatch() {
  const a = await registerAndLogin();
  const b = await registerAndLogin();
  const clubA = await createClub(a.token, `Peek A ${randomUUID().slice(0, 6)}`);
  const clubB = await createClub(b.token, `Peek B ${randomUUID().slice(0, 6)}`);
  const created = await request(app)
    .post('/matches')
    .set('Authorization', `Bearer ${a.token}`)
    .send({ homeClubId: clubA.id, awayClubId: clubB.id });
  expect(created.status).toBe(201);
  const id = created.body.id as string;
  await request(app).post(`/matches/${id}/tactic`).set('Authorization', `Bearer ${a.token}`).send(tacticFor(clubA));
  const started = await request(app).post(`/matches/${id}/tactic`).set('Authorization', `Bearer ${b.token}`).send(tacticFor(clubB));
  expect(started.body.status).toBe('LIVE');
  return { id, a, b };
}

const peek = (id: string, token: string, body: unknown) =>
  request(app).post(`/matches/${id}/live/peek`).set('Authorization', `Bearer ${token}`).send(body as object);

const essence = (e: any) => ({ minute: e.minute, type: e.type, team: e.team, playerId: e.playerId, description: e.description, period: e.period, shotOutcome: e.shotOutcome });

describe('POST /matches/:id/live/peek', () => {
  it('não grava nada: o estado da partida é o mesmo antes e depois, e espiar duas vezes dá o mesmo', async () => {
    const { id, a } = await liveMatch();
    const before = await request(app).get(`/matches/${id}`).set('Authorization', `Bearer ${a.token}`);

    const first = await peek(id, a.token, { toMinute: 45 });
    const second = await peek(id, a.token, { toMinute: 45 });
    expect(first.status).toBe(200);
    expect(first.body.events.length).toBeGreaterThan(0);
    expect(second.body.events).toEqual(first.body.events);

    const after = await request(app).get(`/matches/${id}`).set('Authorization', `Bearer ${a.token}`);
    expect(after.body.live).toEqual(before.body.live);
    expect(after.body.live.currentMinute).toBe(0);
  });

  it('prevê exatamente os lances que o avanço de verdade produz', async () => {
    const { id, a } = await liveMatch();
    const peeked = await peek(id, a.token, { toMinute: 45 });
    const advanced = await request(app)
      .post(`/matches/${id}/live/advance`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ toMinute: 45 });
    expect(advanced.status).toBe(200);
    expect(advanced.body.live.events.map(essence)).toEqual(peeked.body.events.map(essence));
  });

  it('espiar poucos minutos à frente também bate com o avanço minuto a minuto', async () => {
    const { id, a } = await liveMatch();
    const seen: unknown[] = [];
    for (let minute = 1; minute <= 20; minute++) {
      const ahead = await peek(id, a.token, { toMinute: minute + 3 });
      const adv = await request(app)
        .post(`/matches/${id}/live/advance`)
        .set('Authorization', `Bearer ${a.token}`)
        .send({ toMinute: minute });
      // Tudo que o avanço revelou neste minuto estava na espiada anterior (que olhava 3 minutos à frente).
      const revealed = adv.body.live.events.filter((e: any) => e.minute === minute).map(essence);
      const predicted = ahead.body.events.filter((e: any) => e.minute === minute).map(essence);
      expect(revealed).toEqual(predicted);
      seen.push(...revealed);
    }
    expect(Array.isArray(seen)).toBe(true);
  });

  it('só devolve o futuro: nada de minutos que já passaram', async () => {
    const { id, a } = await liveMatch();
    await request(app).post(`/matches/${id}/live/advance`).set('Authorization', `Bearer ${a.token}`).send({ toMinute: 20 });
    const res = await peek(id, a.token, { toMinute: 30 });
    expect(res.status).toBe(200);
    for (const e of res.body.events) {
      expect(e.minute).toBeGreaterThan(20);
      expect(e.minute).toBeLessThanOrEqual(30);
    }
  });

  it('quem não joga a partida não pode espiar', async () => {
    const { id } = await liveMatch();
    const outsider = await registerAndLogin();
    const res = await peek(id, outsider.token, { toMinute: 30 });
    expect(res.status).toBe(400);
  });

  it('exige toMinute', async () => {
    const { id, a } = await liveMatch();
    const res = await peek(id, a.token, {});
    expect(res.status).toBe(400);
  });
});

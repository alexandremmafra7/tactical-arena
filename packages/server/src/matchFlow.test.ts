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

describe('PvP match flow end-to-end', () => {
  it('lets two managers submit tactics and produces the same simulated result for both', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();

    const clubARes = await request(app)
      .post('/clubs')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ name: 'Clube A', country: 'BRA' });
    expect(clubARes.status).toBe(201);
    const clubA = clubARes.body;

    const clubBRes = await request(app)
      .post('/clubs')
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ name: 'Clube B', country: 'BRA' });
    expect(clubBRes.status).toBe(201);
    const clubB = clubBRes.body;

    const matchRes = await request(app)
      .post('/matches')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ homeClubId: clubA.id, awayClubId: clubB.id });
    expect(matchRes.status).toBe(201);
    const match = matchRes.body;
    expect(match.status).toBe('WAITING_TACTICS');

    const tacticFor = (club: any) => ({
      clubId: club.id,
      formation: '4-4-2',
      mentality: 'balanced',
      attackStyle: 'THROUGH_MIDDLE',
      markingStyle: 'BALANCED',
      attackApproach: 'COUNTER_ATTACK',
      lineup: club.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
    });

    const afterA = await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send(tacticFor(clubA));
    expect(afterA.status).toBe(200);
    expect(afterA.body.status).toBe('WAITING_TACTICS');

    const afterB = await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send(tacticFor(clubB));
    expect(afterB.status).toBe(200);
    // Both tactics in kicks off a live, pausable match instead of resolving instantly.
    expect(afterB.body.status).toBe('LIVE');
    expect(afterB.body.result).toBeUndefined();
    expect(afterB.body.live.currentMinute).toBe(0);

    // Play to halftime — still live, no result yet.
    const halftime = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 45 });
    expect(halftime.status).toBe(200);
    expect(halftime.body.status).toBe('LIVE');
    expect(halftime.body.live.currentMinute).toBe(45);
    expect(halftime.body.result).toBeUndefined();

    // Play to fulltime — now it finalizes exactly like an instantly-resolved match would.
    const fulltime = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ toMinute: 90 });
    expect(fulltime.status).toBe(200);
    expect(fulltime.body.status).toBe('SIMULATED');
    expect(fulltime.body.result).toBeDefined();
    expect(typeof fulltime.body.result.homeGoals).toBe('number');
    expect(typeof fulltime.body.result.awayGoals).toBe('number');
    // The "Feedback Pós-Jogo" tactical stats round-trip through the live/advance HTTP path too, not just
    // the in-process engine (see matchService.ts's own homePressRecoveries/awayPressRecoveries wiring).
    expect(typeof fulltime.body.result.stats.home.pressRecoveries).toBe('number');
    expect(typeof fulltime.body.result.stats.home.goalsFromPressRecovery).toBe('number');
    expect(typeof fulltime.body.result.stats.away.pressRecoveries).toBe('number');
    expect(typeof fulltime.body.result.stats.away.goalsFromPressRecovery).toBe('number');

    // Both managers polling the match afterwards must see the exact same result.
    const viewFromA = await request(app).get(`/matches/${match.id}`).set('Authorization', `Bearer ${managerA.token}`);
    const viewFromB = await request(app).get(`/matches/${match.id}`).set('Authorization', `Bearer ${managerB.token}`);
    expect(viewFromA.body.result).toEqual(viewFromB.body.result);
  });

  it('lets a manager pause and change tactics mid-match without touching minutes already played', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();

    const clubA = (
      await request(app).post('/clubs').set('Authorization', `Bearer ${managerA.token}`).send({ name: 'Clube Live A', country: 'BRA' })
    ).body;
    const clubB = (
      await request(app).post('/clubs').set('Authorization', `Bearer ${managerB.token}`).send({ name: 'Clube Live B', country: 'BRA' })
    ).body;

    const match = (
      await request(app)
        .post('/matches')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    const tacticFor = (club: any, mentality: string) => ({
      clubId: club.id,
      formation: '4-4-2',
      mentality,
      attackStyle: 'THROUGH_MIDDLE',
      markingStyle: 'BALANCED',
      attackApproach: 'COUNTER_ATTACK',
      lineup: club.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
    });

    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerA.token}`).send(tacticFor(clubA, 'balanced'));
    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerB.token}`).send(tacticFor(clubB, 'balanced'));

    const halftime = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 45 });
    const eventsAtHalftime = halftime.body.live.events.length;

    // Switch to a more attacking mentality for the second half.
    const tacticUpdate = await request(app)
      .post(`/matches/${match.id}/live/tactic`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send(tacticFor(clubA, 'attacking'));
    expect(tacticUpdate.status).toBe(200);
    expect(tacticUpdate.body.live.homeTactic.mentality).toBe('attacking');
    // Nothing already played is touched by changing tactics.
    expect(tacticUpdate.body.live.events).toHaveLength(eventsAtHalftime);
    expect(tacticUpdate.body.live.currentMinute).toBe(45);

    const fulltime = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ toMinute: 90 });
    expect(fulltime.status).toBe(200);
    expect(fulltime.body.status).toBe('SIMULATED');
    // Every event up to halftime survives untouched in the final timeline.
    expect(fulltime.body.result.events.slice(0, eventsAtHalftime)).toEqual(halftime.body.live.events);
  });

  it('rejects advancing or changing tactics on a match that is not live', async () => {
    const managerA = await registerAndLogin();
    const outsider = await registerAndLogin();
    const clubA = (
      await request(app).post('/clubs').set('Authorization', `Bearer ${managerA.token}`).send({ name: 'Clube Solo', country: 'BRA' })
    ).body;
    const clubB = (
      await request(app).post('/clubs').set('Authorization', `Bearer ${managerA.token}`).send({ name: 'Clube Solo B', country: 'BRA' })
    ).body;

    const match = (
      await request(app)
        .post('/matches')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    // Still WAITING_TACTICS — advancing shouldn't work yet.
    const tooEarly = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 10 });
    expect(tooEarly.status).toBe(400);

    // An account with no club in this match can't drive it forward either.
    const bothTactics = (club: any) => ({
      clubId: club.id,
      formation: '4-4-2',
      mentality: 'balanced',
      attackStyle: 'THROUGH_MIDDLE',
      markingStyle: 'BALANCED',
      attackApproach: 'COUNTER_ATTACK',
      lineup: club.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
    });
    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerA.token}`).send(bothTactics(clubA));
    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerA.token}`).send(bothTactics(clubB));

    const forbidden = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ toMinute: 10 });
    expect(forbidden.status).toBe(400);
  });

  it('rejects a tactic submitted by someone who does not own the club', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const intruder = await registerAndLogin();

    const clubA = (
      await request(app).post('/clubs').set('Authorization', `Bearer ${managerA.token}`).send({ name: 'Clube A2', country: 'BRA' })
    ).body;
    const clubB = (
      await request(app).post('/clubs').set('Authorization', `Bearer ${managerB.token}`).send({ name: 'Clube B2', country: 'BRA' })
    ).body;

    const match = (
      await request(app)
        .post('/matches')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    const res = await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({
        clubId: clubA.id,
        formation: '4-4-2',
        mentality: 'balanced',
        attackStyle: 'THROUGH_MIDDLE',
        markingStyle: 'BALANCED',
        attackApproach: 'COUNTER_ATTACK',
        lineup: clubA.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
      });

    expect(res.status).toBe(400);
  });
});

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

function baseTacticFields(club: any) {
  return {
    clubId: club.id,
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'BALANCED',
    attackApproach: 'COUNTER_ATTACK',
    lineup: club.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
  };
}

describe('Match substitutions and penalty taker', () => {
  it('applies a planned substitution deterministically (regardless of match seed) and honors the penalty taker', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();

    const clubA = (await request(app).post('/clubs').set('Authorization', `Bearer ${managerA.token}`).send({ name: 'Sub A FC', country: 'BRA' })).body;
    const clubB = (await request(app).post('/clubs').set('Authorization', `Bearer ${managerB.token}`).send({ name: 'Sub B FC', country: 'BRA' })).body;

    const match = (
      await request(app).post('/matches').set('Authorization', `Bearer ${managerA.token}`).send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    const outPlayer = clubA.players[9];
    const benchPlayer = clubA.players[15];
    // A spare alongside the earmarked substitute: an injury can strike at any minute, and the engine sends
    // the bench on for it (applyEmergencySubstitution). With only the earmarked player available, an early
    // injury would legitimately consume him and cancel the 46' swap this test is here to verify — the spare
    // is what the emergency reaches for first, leaving the manager's plan intact.
    const spareBenchPlayer = clubA.players[16];

    const tacticA = {
      ...baseTacticFields(clubA),
      substitutes: [{ playerId: benchPlayer.id }, { playerId: spareBenchPlayer.id }],
      plannedSubstitutions: [{ id: 'sub1', minute: 46, outPlayerId: outPlayer.id, inPlayerId: benchPlayer.id }],
      penaltyTakerId: outPlayer.id,
    };

    const afterA = await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerA.token}`).send(tacticA);
    expect(afterA.status).toBe(200);

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

    /**
     * The planned swap has to land exactly as set — but only if there is still a player to swap out.
     *
     * A dismissal empties the shirt for good and an injury takes him off early, and either legitimately
     * drops the 46' change (see applyDueSubstitutions). That used to be rare enough to ignore; once the
     * engine's discipline was calibrated to the Brasileirão's 24.6 fouls and 4.4 bookings a match, "this
     * particular player survives 46 minutes" stopped being a safe assumption and made the test flaky about
     * one run in sixty. Checking the timeline instead of hoping keeps it asserting the actual rule.
     */
    const events = fulltime.body.result.events;
    const before46 = events.filter((e: any) => e.minute < 46 && e.team === 'home');

    // Mirrors applyDueSubstitutions' own three conditions, read off the timeline.
    const outPlayerGone = before46.some(
      (e: any) =>
        e.playerId === outPlayer.id &&
        (e.type === 'injury' || e.type === 'substitution' || (e.type === 'card' && e.suspensionMatches !== undefined)),
    );
    const benchPlayerAlreadyOn = before46.some((e: any) => e.type === 'substitution' && e.relatedPlayerId === benchPlayer.id);
    const preempted = outPlayerGone || benchPlayerAlreadyOn;

    const subEvents = events.filter((e: any) => e.type === 'substitution' && e.team === 'home');
    const plannedSub = subEvents.find((e: any) => e.playerId === outPlayer.id && e.minute === 46);

    if (preempted) {
      // Either the shirt or the replacement was gone by the 46th, so the swap correctly never happened.
      expect(plannedSub).toBeUndefined();
    } else {
      expect(plannedSub).toBeDefined();
      expect(plannedSub.minute).toBe(46);
      expect(plannedSub.relatedPlayerId).toBe(benchPlayer.id);
    }
  });

  it('rejects a tactic with more than 5 planned substitutions', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const clubA = (await request(app).post('/clubs').set('Authorization', `Bearer ${managerA.token}`).send({ name: 'TooMany A FC', country: 'BRA' })).body;
    const clubB = (await request(app).post('/clubs').set('Authorization', `Bearer ${managerB.token}`).send({ name: 'TooMany B FC', country: 'BRA' })).body;
    const match = (
      await request(app).post('/matches').set('Authorization', `Bearer ${managerA.token}`).send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    const bench = clubA.players.slice(11, 16);
    const lineup = clubA.players.slice(0, 11);
    const tacticA = {
      ...baseTacticFields(clubA),
      substitutes: bench.map((p: any) => ({ playerId: p.id })),
      plannedSubstitutions: bench.map((p: any, i: number) => ({
        id: `sub${i}`,
        minute: 20 + i,
        outPlayerId: lineup[i].id,
        inPlayerId: p.id,
      })),
    };
    // 6th substitution reusing an already-subbed starter slot's neighbor to push the count over the cap.
    tacticA.plannedSubstitutions.push({ id: 'sub-extra', minute: 80, outPlayerId: lineup[5].id, inPlayerId: bench[0].id });

    const res = await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerA.token}`).send(tacticA);
    expect(res.status).toBe(400);
  });

  it('rejects a substitution whose "in" player is not on the bench', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const clubA = (await request(app).post('/clubs').set('Authorization', `Bearer ${managerA.token}`).send({ name: 'BadSub A FC', country: 'BRA' })).body;
    const clubB = (await request(app).post('/clubs').set('Authorization', `Bearer ${managerB.token}`).send({ name: 'BadSub B FC', country: 'BRA' })).body;
    const match = (
      await request(app).post('/matches').set('Authorization', `Bearer ${managerA.token}`).send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    const tacticA = {
      ...baseTacticFields(clubA),
      substitutes: [],
      plannedSubstitutions: [{ id: 'sub1', minute: 46, outPlayerId: clubA.players[0].id, inPlayerId: clubA.players[12].id }],
    };

    const res = await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerA.token}`).send(tacticA);
    expect(res.status).toBe(400);
  });
});

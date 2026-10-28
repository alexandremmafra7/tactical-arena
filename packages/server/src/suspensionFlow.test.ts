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

/** Picks the first 11 currently-available (non-suspended, non-injured) players — not just the first 11
 *  by array order — so repeated attempts against the same club don't deadlock on a stale roster snapshot
 *  once someone else on the original first-11 has since picked up a card or knock. */
function heavyMarkingTacticFor(club: any) {
  const available = club.players.filter(
    (p: any) => !p.suspensions.some((s: any) => s.matchesRemaining > 0) && p.injuryWeeks === 0,
  );
  return {
    clubId: club.id,
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'HEAVY',
    attackApproach: 'COUNTER_ATTACK',
    lineup: available.slice(0, 11).map((p: any) => ({ playerId: p.id })),
  };
}

describe('Red card suspension flow', () => {
  it('bans a sent-off player from being selected in a future lineup', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const clubA = await createClubFor(managerA.token, 'Duro FC A');
    const clubB = await createClubFor(managerB.token, 'Duro FC B');

    let suspendedPlayerId: string | null = null;
    let suspendedClubOwnerToken: string | null = null;
    let suspendedClubId: string | null = null;

    for (let attempt = 0; attempt < 150 && !suspendedPlayerId; attempt++) {
      // Refetch on every attempt: a prior iteration may have left someone on the "usual" first 11 either
      // suspended or injured, and the tactic must be built from who's actually available right now.
      const currentClubA = (await request(app).get(`/clubs/${clubA.id}`).set('Authorization', `Bearer ${managerA.token}`)).body;
      const currentClubB = (await request(app).get(`/clubs/${clubB.id}`).set('Authorization', `Bearer ${managerB.token}`)).body;

      const match = (
        await request(app)
          .post('/matches')
          .set('Authorization', `Bearer ${managerA.token}`)
          .send({ homeClubId: clubA.id, awayClubId: clubB.id })
      ).body;

      await request(app)
        .post(`/matches/${match.id}/tactic`)
        .set('Authorization', `Bearer ${managerA.token}`)
        .send(heavyMarkingTacticFor(currentClubA));

      await request(app)
        .post(`/matches/${match.id}/tactic`)
        .set('Authorization', `Bearer ${managerB.token}`)
        .send(heavyMarkingTacticFor(currentClubB));

      const fulltime = await request(app)
        .post(`/matches/${match.id}/live/advance`)
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ toMinute: 90 });

      const events = fulltime.body?.result?.events ?? [];
      const redCard = events.find((e: any) => e.type === 'card' && e.suspensionMatches);
      if (redCard) {
        suspendedPlayerId = redCard.playerId;
        if (redCard.team === 'home') {
          suspendedClubOwnerToken = managerA.token;
          suspendedClubId = clubA.id;
        } else {
          suspendedClubOwnerToken = managerB.token;
          suspendedClubId = clubB.id;
        }
      }
    }

    expect(suspendedPlayerId).not.toBeNull();

    const opponentId = suspendedClubId === clubA.id ? clubB.id : clubA.id;
    const opponentToken = suspendedClubId === clubA.id ? managerB.token : managerA.token;

    const nextMatch = (
      await request(app)
        .post('/matches')
        .set('Authorization', `Bearer ${opponentToken}`)
        .send({ homeClubId: suspendedClubId, awayClubId: opponentId })
    ).body;

    const suspendedClub = (await request(app).get(`/clubs/${suspendedClubId}`).set('Authorization', `Bearer ${suspendedClubOwnerToken}`)).body;
    const suspendedPlayer = suspendedClub.players.find((p: any) => p.id === suspendedPlayerId);
    expect(suspendedPlayer.suspensions.some((s: any) => s.matchesRemaining > 0)).toBe(true);

    // Deliberately build a lineup that still includes the suspended player, to prove submission is rejected.
    const otherAvailable = suspendedClub.players.filter(
      (p: any) => p.id !== suspendedPlayerId && !p.suspensions.some((s: any) => s.matchesRemaining > 0) && p.injuryWeeks === 0,
    );
    const lineupWithSuspendedPlayer = [suspendedPlayer, ...otherAvailable.slice(0, 10)].map((p: any) => ({ playerId: p.id }));

    const rejected = await request(app)
      .post(`/matches/${nextMatch.id}/tactic`)
      .set('Authorization', `Bearer ${suspendedClubOwnerToken}`)
      .send({ ...heavyMarkingTacticFor(suspendedClub), lineup: lineupWithSuspendedPlayer });

    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toContain('suspended');
  }, 30000);
});

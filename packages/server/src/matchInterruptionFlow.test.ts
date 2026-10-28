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
    substitutes: club.players.slice(11, 18).map((p: any) => ({ playerId: p.id })),
    plannedSubstitutions: [],
  };
}

/** Players a club can actually field right now — a squad picks up knocks and bans across repeated fixtures. */
function fitPlayers(club: any) {
  return club.players.filter((p: any) => p.injuryWeeks === 0 && !p.suspensions.some((s: any) => s.matchesRemaining > 0));
}

async function newManagerWithClub(name: string) {
  const manager = await registerAndLogin();
  const club = (await request(app).post('/clubs').set('Authorization', `Bearer ${manager.token}`).send({ name, country: 'BRA' })).body;
  await request(app).put(`/clubs/${club.id}/staff/delegation`).set('Authorization', `Bearer ${manager.token}`).send({ autoSubstitutionsInMatch: false });
  return { manager, club };
}

/**
 * Hunts for a fixture that halts asking the *home* manager for a `wanted` decision, and hands it over mid
 * stoppage for the test to answer.
 *
 * Both kinds of stoppage are rare on purpose — a dismissal lands in under 7% of matches even with heavy
 * marking (measured, not guessed) — so this retries whole fixtures rather than betting on one seed. It asks
 * for all 90 minutes in a single interactive call each time: the engine plays until something stops it and
 * returns there, which is far cheaper than pacing the clock five minutes at a time. Stoppages of the other
 * kind get waved through so the hunt keeps going instead of ending on the wrong sort of halt.
 *
 * Clubs are reused between attempts (generating a squad is the expensive part) and replaced once the wear
 * of repeated matches leaves too few fit players to field a side.
 */
async function fixtureHaltedFor(wanted: 'injury' | 'redCard', tag: string) {
  let home = await newManagerWithClub(`${tag} A FC`);
  let away = await newManagerWithClub(`${tag} B FC`);

  for (let attempt = 0; attempt < 140; attempt++) {
    const clubA = (await request(app).get(`/clubs/${home.club.id}`).set('Authorization', `Bearer ${home.manager.token}`)).body;
    const clubB = (await request(app).get(`/clubs/${away.club.id}`).set('Authorization', `Bearer ${away.manager.token}`)).body;
    const fitA = fitPlayers(clubA);
    const fitB = fitPlayers(clubB);
    if (fitA.length < 13 || fitB.length < 13) {
      home = await newManagerWithClub(`${tag} A${attempt} FC`);
      away = await newManagerWithClub(`${tag} B${attempt} FC`);
      continue;
    }

    const match = (
      await request(app)
        .post('/matches')
        .set('Authorization', `Bearer ${home.manager.token}`)
        .send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    // Heavy marking fouls more, which is the only lever available for making cards happen in test time.
    const tacticFor = (club: any, fit: any[]) => ({ ...baseTacticFields({ ...club, players: fit }), markingStyle: 'HEAVY' });
    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${home.manager.token}`).send(tacticFor(clubA, fitA));
    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${away.manager.token}`).send(tacticFor(clubB, fitB));

    for (let stop = 0; stop < 12; stop++) {
      const res = await request(app)
        .post(`/matches/${match.id}/live/advance`)
        .set('Authorization', `Bearer ${home.manager.token}`)
        .send({ toMinute: 90, interactive: true });
      expect(res.status).toBe(200);
      if (res.body.status === 'SIMULATED') break;

      const pending = res.body.live?.pendingDecision;
      if (!pending) break;
      if (pending.type === wanted) {
        return {
          managerA: home.manager,
          managerB: away.manager,
          clubA,
          clubB,
          matchId: match.id as string,
          match: res.body,
        };
      }
      // Not the stoppage we are after: answer it in the least intrusive way and keep playing.
      const url =
        pending.type === 'injury' ? `/matches/${match.id}/live/decision` : `/matches/${match.id}/live/decision/reorganize`;
      const body = pending.type === 'injury' ? { replacementPlayerId: null } : { lineupPlayerIds: null };
      await request(app).post(url).set('Authorization', `Bearer ${home.manager.token}`).send(body);
    }
  }
  throw new Error(`no fixture halted for a home ${wanted}`);
}

const fixtureHaltedForInjury = (tag: string) => fixtureHaltedFor('injury', tag);
const fixtureHaltedForRedCard = (tag: string) => fixtureHaltedFor('redCard', tag);

describe('Red card interruption', () => {
  it('halts at the dismissal and holds the clock until the manager answers', async () => {
    const { matchId, managerA, match } = await fixtureHaltedForRedCard('redhalt');
    const pending = match.live.pendingDecision;

    expect(pending.type).toBe('redCard');
    expect(match.live.currentMinute).toBe(pending.minute);
    const dismissal = match.live.events.find(
      (e: any) => e.type === 'card' && e.team === 'home' && e.playerId === pending.playerId && e.suspensionMatches !== undefined,
    );
    expect(dismissal).toBeDefined();

    const ignored = await request(app)
      .post(`/matches/${matchId}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 90, interactive: true });
    expect(ignored.body.status).toBe('LIVE');
    expect(ignored.body.live.currentMinute).toBe(pending.minute);
  }, 180000);

  it('moves the hole where the manager puts it, keeping the same eleven names', async () => {
    const { matchId, managerA, match } = await fixtureHaltedForRedCard('reshape');
    const pending = match.live.pendingDecision;
    const before: string[] = match.live.homeTactic.lineup.map((s: any) => s.playerId);

    // Shift the vacancy: swap the sent-off shirt with an outfield team-mate's slot.
    const sentOffIndex = before.indexOf(pending.playerId);
    const targetIndex = before.findIndex((id, i) => i !== sentOffIndex && i > 0);
    const after = [...before];
    [after[sentOffIndex], after[targetIndex]] = [after[targetIndex], after[sentOffIndex]];

    const res = await request(app)
      .post(`/matches/${matchId}/live/decision/reorganize`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ lineupPlayerIds: after });
    expect(res.status).toBe(200);
    expect(res.body.live.pendingDecision).toBeNull();

    const saved: string[] = res.body.live.homeTactic.lineup.map((s: any) => s.playerId);
    expect(saved).toEqual(after);
    // Still the same eleven names, only rearranged — a dismissal must not become a free substitution.
    expect([...saved].sort()).toEqual([...before].sort());
  }, 180000);

  it('rejects a reorganization that smuggles in a player who was not on the pitch', async () => {
    const { matchId, managerA, clubA, match } = await fixtureHaltedForRedCard('smuggle');
    const before: string[] = match.live.homeTactic.lineup.map((s: any) => s.playerId);
    const onPitch = new Set(before);
    const bench = clubA.players.find((p: any) => !onPitch.has(p.id));

    const smuggled = [...before];
    smuggled[smuggled.indexOf(match.live.pendingDecision.playerId)] = bench.id;

    const res = await request(app)
      .post(`/matches/${matchId}/live/decision/reorganize`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ lineupPlayerIds: smuggled });
    expect(res.status).toBe(400);
  }, 180000);

  it('lets the manager keep the shape and carry the hole where it fell', async () => {
    const { matchId, managerA, match } = await fixtureHaltedForRedCard('keep');
    const before: string[] = match.live.homeTactic.lineup.map((s: any) => s.playerId);

    const res = await request(app)
      .post(`/matches/${matchId}/live/decision/reorganize`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ lineupPlayerIds: null });
    expect(res.status).toBe(200);
    expect(res.body.live.pendingDecision).toBeNull();
    expect(res.body.live.homeTactic.lineup.map((s: any) => s.playerId)).toEqual(before);

    // And the clock runs again.
    const resumed = await request(app)
      .post(`/matches/${matchId}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 90, interactive: true });
    expect(resumed.status).toBe(200);
    if (resumed.body.status === 'SIMULATED') {
      expect(resumed.body.result).toBeDefined();
    } else {
      expect(resumed.body.live.currentMinute).toBeGreaterThanOrEqual(match.live.currentMinute);
    }
  }, 180000);

  it('clears the halt itself once nobody is watching, leaving the side to play on with ten', async () => {
    const { matchId, managerA } = await fixtureHaltedForRedCard('redabandon');

    const finished = await request(app)
      .post(`/matches/${matchId}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 90 });
    expect(finished.status).toBe(200);
    expect(finished.body.status).toBe('SIMULATED');
  }, 180000);
});

describe('Injury interruption', () => {
  it('halts the clock at the injury and refuses to move on until the manager answers', async () => {
    const { matchId, managerA, match } = await fixtureHaltedForInjury('halt');

    const pending = match.live.pendingDecision;
    expect(pending.type).toBe('injury');
    expect(match.live.currentMinute).toBe(pending.minute);
    // Nobody was sent on in the manager's place.
    const subs = match.live.events.filter((e: any) => e.type === 'substitution' && e.team === 'home');
    expect(subs.every((e: any) => e.playerId !== pending.playerId)).toBe(true);

    // Asking for more minutes while a decision is owed changes nothing at all.
    const ignored = await request(app)
      .post(`/matches/${matchId}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 90, interactive: true });
    expect(ignored.status).toBe(200);
    expect(ignored.body.status).toBe('LIVE');
    expect(ignored.body.live.currentMinute).toBe(pending.minute);
    expect(ignored.body.live.pendingDecision.playerId).toBe(pending.playerId);
  }, 60000);

  it('offers only bench players the engine would accept, and names its own suggestion', async () => {
    const { matchId, managerA, match } = await fixtureHaltedForInjury('options');

    const res = await request(app).get(`/matches/${matchId}/live/decision`).set('Authorization', `Bearer ${managerA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.decision.playerId).toBe(match.live.pendingDecision.playerId);

    const benchIds = new Set(match.live.homeTactic.substitutes.map((s: any) => s.playerId));
    const onPitch = new Set(match.live.homeTactic.lineup.map((s: any) => s.playerId));
    expect(res.body.candidates.length).toBeGreaterThan(0);
    for (const candidate of res.body.candidates) {
      expect(benchIds.has(candidate.id)).toBe(true);
      expect(onPitch.has(candidate.id)).toBe(false);
    }
    expect(res.body.candidates.some((c: any) => c.id === res.body.suggestedId)).toBe(true);
  }, 60000);

  it('sends on exactly the player the manager picked, then lets the match run again', async () => {
    const { matchId, managerA, match } = await fixtureHaltedForInjury('choose');
    const pending = match.live.pendingDecision;

    const options = (await request(app).get(`/matches/${matchId}/live/decision`).set('Authorization', `Bearer ${managerA.token}`)).body;
    // Deliberately not the suggested one where possible — the manager's pick must win over the heuristic.
    const chosen = options.candidates.find((c: any) => c.id !== options.suggestedId) ?? options.candidates[0];

    const resolved = await request(app)
      .post(`/matches/${matchId}/live/decision`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ replacementPlayerId: chosen.id });
    expect(resolved.status).toBe(200);
    expect(resolved.body.live.pendingDecision).toBeNull();

    const sub = resolved.body.live.events.find(
      (e: any) => e.type === 'substitution' && e.team === 'home' && e.playerId === pending.playerId,
    );
    expect(sub).toBeDefined();
    expect(sub.relatedPlayerId).toBe(chosen.id);
    expect(sub.minute).toBe(pending.minute);
    expect(resolved.body.live.homeTactic.lineup.some((s: any) => s.playerId === chosen.id)).toBe(true);
    expect(resolved.body.live.homeTactic.lineup.some((s: any) => s.playerId === pending.playerId)).toBe(false);

    // The clock moves again now the referee has his answer.
    const resumed = await request(app)
      .post(`/matches/${matchId}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: Math.min(90, pending.minute + 5), interactive: true });
    const isSimulated = resumed.body.status === 'SIMULATED';
    const currentMin = resumed.body.live?.currentMinute ?? 90;
    expect(isSimulated || currentMin > pending.minute || currentMin === 90 || resumed.body.live?.pendingDecision !== null).toBe(true);
  }, 60000);

  it('lets the manager decline and play on a man short', async () => {
    const { matchId, managerA, match } = await fixtureHaltedForInjury('decline');
    const pending = match.live.pendingDecision;

    const resolved = await request(app)
      .post(`/matches/${matchId}/live/decision`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ replacementPlayerId: null });
    expect(resolved.status).toBe(200);
    expect(resolved.body.live.pendingDecision).toBeNull();
    const subs = resolved.body.live.events.filter((e: any) => e.type === 'substitution' && e.team === 'home');
    expect(subs.every((e: any) => e.playerId !== pending.playerId)).toBe(true);
  }, 60000);

  it('rejects a replacement who is not on the bench', async () => {
    const { matchId, managerA, match } = await fixtureHaltedForInjury('invalid');

    const starter = { id: match.live.homeTactic.lineup[0].playerId };
    const res = await request(app)
      .post(`/matches/${matchId}/live/decision`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ replacementPlayerId: starter.id });
    expect(res.status).toBe(400);
  }, 60000);

  it('rejects the opposing manager answering a decision that is not theirs', async () => {
    const { matchId, managerB } = await fixtureHaltedForInjury('wrong-side');

    const res = await request(app)
      .post(`/matches/${matchId}/live/decision`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ replacementPlayerId: null });
    expect(res.status).toBe(400);
  }, 60000);

  it('resolves the stoppage itself once nobody is watching, so an abandoned fixture still finishes', async () => {
    const { matchId, managerA, match } = await fixtureHaltedForInjury('abandoned');
    const pending = match.live.pendingDecision;

    // The manager walked away: a plain (non-interactive) advance stands in for the round being wrapped up.
    const finished = await request(app)
      .post(`/matches/${matchId}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 90 });
    expect(finished.status).toBe(200);
    expect(finished.body.status).toBe('SIMULATED');

    // The touchline put someone on for the injured player rather than leaving the side short by default.
    const sub = finished.body.result.events.find(
      (e: any) => e.type === 'substitution' && e.team === 'home' && e.playerId === pending.playerId,
    );
    expect(sub).toBeDefined();
  }, 60000);
});

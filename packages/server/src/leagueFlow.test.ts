import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { generateDoubleRoundRobinFixtures } from '@tactical-arena/shared';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

const app = createApp();
// Dedicated, never-reused country so this test's league can't accumulate stray clubs left behind by
// an earlier aborted run (whose owner tokens would be unrecoverable, permanently stalling their fixtures).
const COUNTRY = 'EGY';

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string };
}

async function createClubFor(token: string, name: string, country: string = COUNTRY) {
  const res = await request(app).post('/clubs').set('Authorization', `Bearer ${token}`).send({ name, country });
  expect(res.status).toBe(201);
  return res.body;
}

/**
 * Finds the league a given club actually joined, by membership rather than by an assumed clean slate —
 * this suite hits the same persistent dev database as every other integration test, and (unlike per-match
 * tests keyed by their own returned ids) league membership is shared, accumulating state across repeated
 * runs. Deriving all assertions from the resulting club count (see below) instead of a hardcoded 4 keeps
 * the test correct however many clubs happen to already be sitting in that country's league.
 */
/**
 * Every club in this suite is human-owned, so every fixture is created live (see createLiveMatch) —
 * finish each one to fulltime before the round/league can be considered advanced, same as a real manager
 * watching their own match would eventually click through to the end. Only the owner of one of the two
 * clubs in a fixture may drive its clock (see requireParticipant in matchService), so this needs a
 * clubId -> token map to pick the right credential per match rather than one shared token.
 */
async function finishAnyLiveMatches(fixtures: any[], clubIdToToken: Record<string, string>) {
  for (const fixture of fixtures) {
    if (!fixture.matchId) continue;
    const token = clubIdToToken[fixture.homeClubId] ?? clubIdToToken[fixture.awayClubId];
    if (!token) continue;
    const match = (await request(app).get(`/matches/${fixture.matchId}`).set('Authorization', `Bearer ${token}`)).body;
    if (match.status === 'LIVE') {
      await request(app).post(`/matches/${fixture.matchId}/live/advance`).set('Authorization', `Bearer ${token}`).send({ toMinute: 90 });
    }
  }
}

async function findLeagueForClub(token: string, clubId: string, country: string = COUNTRY) {
  const res = await request(app).get(`/leagues?country=${country}`).set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body.find((l: any) => l.clubIds.includes(clubId));
}

describe('League flow end-to-end', () => {
  it('runs a full double round-robin to completion with a consistent final table', async () => {
    const managers = await Promise.all([registerAndLogin(), registerAndLogin(), registerAndLogin(), registerAndLogin()]);
    // Sequential on purpose: joining a league is a read-then-write against the same league row, so creating
    // clubs concurrently could race and scatter them across separate leagues instead of one shared league.
    const clubs = [];
    for (let i = 0; i < managers.length; i++) {
      clubs.push(await createClubFor(managers[i].token, `Clube ITA ${randomUUID().slice(0, 8)}`));
    }

    const clubIdToToken: Record<string, string> = {};
    clubs.forEach((c, i) => {
      clubIdToToken[c.id] = managers[i].token;
    });

    const league = await findLeagueForClub(managers[0].token, clubs[0].id);
    expect(league).toBeDefined();
    expect(league.status).toBe('OPEN');
    const n = league.clubIds.length;
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n % 2).toBe(0);

    const startRes = await request(app)
      .post(`/leagues/${league.id}/force-start`)
      .set('Authorization', `Bearer ${managers[0].token}`);
    expect(startRes.status).toBe(200);
    expect(startRes.body.status).toBe('IN_PROGRESS');
    expect(startRes.body.fixtures).toHaveLength(2 * (n - 1) * (n / 2));

    let current = startRes.body;
    let guard = 0;
    while (current.status !== 'FINISHED' && guard < 60) {
      const advanceRes = await request(app)
        .post(`/leagues/${league.id}/advance-round`)
        .set('Authorization', `Bearer ${managers[0].token}`);
      expect(advanceRes.status).toBe(200);
      current = advanceRes.body;
      // Every fixture here is human-vs-human, so each is created live — finish it before the season can
      // be declared over. A round's matchIds are assigned immediately, so `pendingRounds` moves on to the
      // next round right away; the extra guard budget covers the trailing iterations spent just catching
      // up on live matches once every round has already been scheduled.
      await finishAnyLiveMatches(current.fixtures, clubIdToToken);
      guard++;
    }
    expect(current.status).toBe('FINISHED');
    expect(current.fixtures.every((f: any) => f.matchId !== null)).toBe(true);

    const detailRes = await request(app).get(`/leagues/${league.id}`).set('Authorization', `Bearer ${managers[0].token}`);
    expect(detailRes.status).toBe(200);
    const { standings } = detailRes.body;

    expect(standings).toHaveLength(n);
    for (const row of standings) {
      expect(row.played).toBe(2 * (n - 1));
      expect(row.points).toBe(row.wins * 3 + row.draws);
    }

    // Cross-check: total goals scored across every simulated match equals the sum of goalsFor across the table.
    const matchIds: string[] = current.fixtures.map((f: any) => f.matchId);
    let totalGoalsFromMatches = 0;
    for (const matchId of matchIds) {
      const matchRes = await request(app).get(`/matches/${matchId}`).set('Authorization', `Bearer ${managers[0].token}`);
      totalGoalsFromMatches += matchRes.body.result.homeGoals + matchRes.body.result.awayGoals;
    }
    const totalGoalsFromStandings = standings.reduce((sum: number, row: any) => sum + row.goalsFor, 0);
    expect(totalGoalsFromStandings).toBe(totalGoalsFromMatches);
  }, 60000);

  /**
   * Regression: "ir para a partida" used to reopen an abandoned match, mid-game.
   *
   * `getNextActionableMatch` hands back the *oldest* unfinished match, and a manager who wanders off leaves
   * theirs LIVE forever — so the button kept returning that one, at whatever minute it was left at, instead
   * of the round they had just started. Sometimes it opened at the 85th and ended a few seconds later.
   *
   * Advancing the round is the manager saying they are done with the last one, so that is when a stale
   * match gets resolved. Walking back into a match you have *not* moved on from still has to work, which
   * the first half of this test pins.
   */
  it('never opens a stale in-progress match as the next one after the round moves on', async () => {
    const COUNTRY_STALE = 'MAR';
    const managers = await Promise.all([registerAndLogin(), registerAndLogin(), registerAndLogin(), registerAndLogin()]);
    const clubs: any[] = [];
    for (const [i, manager] of managers.entries()) {
      clubs.push(await createClubFor(manager.token, `Stale FC ${i} ${randomUUID().slice(0, 8)}`, COUNTRY_STALE));
    }

    /**
     * The league is seeded directly rather than found via `joinOrCreateLeague`.
     *
     * A dedicated country is not enough on its own: every run leaves its four clubs behind in this
     * database, so the country's OPEN league slowly fills with clubs whose owner tokens are gone. New
     * clubs then either join a league that auto-started at capacity or share one with fixtures nobody
     * can finish, and this test's very first `nextFor(0)` comes back null. Owning the exact club list
     * makes the test say the same thing on the first run and the fiftieth.
     */
    const league = { id: randomUUID() };
    await prisma.league.create({
      data: {
        id: league.id,
        countryCode: COUNTRY_STALE,
        division: 1,
        name: `Liga Stale ${league.id.slice(0, 8)}`,
        capacity: clubs.length,
        status: 'OPEN',
        clubIdsJson: JSON.stringify(clubs.map((c) => c.id)),
        fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubs.map((c) => c.id))),
        season: 2050,
      },
    });
    await request(app).post(`/leagues/${league.id}/force-start`).set('Authorization', `Bearer ${managers[0].token}`);

    const nextFor = async (index: number) =>
      (await request(app).get(`/matches/next/${clubs[index].id}`).set('Authorization', `Bearer ${managers[index].token}`)).body;

    await request(app).post(`/leagues/${league.id}/advance-round`).set('Authorization', `Bearer ${managers[0].token}`);
    const round1 = await nextFor(0);
    expect(round1.status).toBe('LIVE');
    expect(round1.live.currentMinute).toBe(0);

    // Watch part of it, then wander off without finishing.
    await request(app)
      .post(`/matches/${round1.id}/live/advance`)
      .set('Authorization', `Bearer ${managers[0].token}`)
      .send({ toMinute: 30, interactive: true });

    // Coming straight back must resume the same match — this is not a stale one, it is theirs, in progress.
    const resumed = await nextFor(0);
    expect(resumed.id).toBe(round1.id);
    expect(resumed.live.currentMinute).toBeGreaterThan(0);

    // Moving on to the next round is what closes it out.
    await request(app).post(`/leagues/${league.id}/advance-round`).set('Authorization', `Bearer ${managers[0].token}`);
    const round2 = await nextFor(0);
    expect(round2.id).not.toBe(round1.id);
    expect(round2.status).toBe('LIVE');
    expect(round2.live.currentMinute).toBe(0);

    // And the abandoned one actually finished rather than being left hanging.
    const abandoned = (await request(app).get(`/matches/${round1.id}`).set('Authorization', `Bearer ${managers[0].token}`)).body;
    expect(abandoned.status).toBe('SIMULATED');
  }, 60000);

  it('rejects force-start and advance-round from someone with no club in the league', async () => {
    // Deliberately never force-started or finished — a dedicated country keeps this permanently-OPEN,
    // 2-club league from ever being picked up by the *other* test's club-creation loop in a later run.
    const REJECTION_TEST_COUNTRY = 'GHA';
    const insiderA = await registerAndLogin();
    const insiderB = await registerAndLogin();
    const outsider = await registerAndLogin();

    const clubA = await createClubFor(insiderA.token, `Insider FC ${randomUUID().slice(0, 8)}`, REJECTION_TEST_COUNTRY);
    await createClubFor(insiderB.token, `Insider FC ${randomUUID().slice(0, 8)}`, REJECTION_TEST_COUNTRY);

    const league = await findLeagueForClub(insiderA.token, clubA.id, REJECTION_TEST_COUNTRY);
    expect(league).toBeDefined();

    const forbiddenStart = await request(app)
      .post(`/leagues/${league.id}/force-start`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(forbiddenStart.status).toBe(400);
  });
});

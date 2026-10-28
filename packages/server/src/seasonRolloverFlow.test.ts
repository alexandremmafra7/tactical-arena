import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { generateDoubleRoundRobinFixtures } from '@tactical-arena/shared';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { turnSeason } from './services/seasonService.js';

const app = createApp();
/** Dedicated, never-reused country so this suite's leagues can't collide with another test's (MAR is taken by leagueFlow). */
const COUNTRY = 'CRC';

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string };
}

/**
 * Pins the shared game clock below every season this suite seeds.
 *
 * Creating a club auto-joins it to an OPEN league for its country (see `joinOrCreateLeague`), stamped
 * with whatever season the clock currently reads — and that league starts on its own once enough clubs
 * have accumulated across runs. Since `getActiveLeagueForClub` answers with the *latest* in-progress
 * season, a clock left in 2037 by another suite would make that incidental league outrank the 2031 one
 * these tests are actually about. Pinning it low keeps the answer the seeded leagues'.
 */
async function pinClockTo(seasonYear: number) {
  const currentDate = seasonYear + '-01-01';
  await prisma.gameState.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', currentDate, seasonYear, phase: 'PRE_SEASON' },
    update: { currentDate, seasonYear, phase: 'PRE_SEASON' },
  });
}

/** Below every season this suite seeds, so an incidental auto-joined league never outranks them. */
async function pinClockBelowSeeds() {
  await pinClockTo(2029);
}

async function createClubFor(token: string) {
  await pinClockBelowSeeds();
  const res = await request(app)
    .post('/clubs')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Clube CRC ${randomUUID().slice(0, 8)}`, country: COUNTRY });
  expect(res.status).toBe(201);
  return res.body;
}

/**
 * Builds a league containing exactly these clubs, straight through Prisma.
 *
 * Deliberately bypasses `joinOrCreateLeague`: that puts a new club into whatever OPEN league already
 * exists for the country and auto-starts it once it reaches capacity, so against this shared database a
 * suite that just calls POST /clubs ends up sharing a league with clubs left behind by earlier runs —
 * whose owner tokens are gone, so their fixtures can never be finished and the season can never end.
 * Seeding the row directly is what makes this test independent of how many times it has run before.
 */
async function seedLeagueWith(clubIds: string[], season: number) {
  const id = randomUUID();
  await prisma.league.create({
    data: {
      id,
      countryCode: COUNTRY,
      division: 1,
      name: `Liga de Teste ${id.slice(0, 8)}`,
      capacity: clubIds.length,
      status: 'IN_PROGRESS',
      clubIdsJson: JSON.stringify(clubIds),
      // A one-club league has no schedule to generate; the selection test only cares which row wins.
      fixturesJson: JSON.stringify(clubIds.length >= 2 ? generateDoubleRoundRobinFixtures(clubIds) : []),
      season,
    },
  });
  return id;
}

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

/**
 * The season boundary.
 *
 * `finalizeSeason` always created next season's league row correctly — the failure was that nothing
 * pointed at it. `listLeagues` returns every row ordered `createdAt asc` with no status filter, and every
 * screen picked the first entry whose clubIds matched, which is the *oldest FINISHED* league forever. The
 * season number froze permanently and "ir para a partida" kept trying to advance a league that had ended,
 * where the server rightly refuses.
 */
describe('Season rollover', () => {
  it('prefers the in-progress season over finished ones', async () => {
    // No matches, no playing: just the two rows the old code could not tell apart.
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token);

    const finishedId = randomUUID();
    await prisma.league.create({
      data: {
        id: finishedId,
        countryCode: COUNTRY,
        division: 1,
        name: 'Liga de Teste (encerrada)',
        capacity: 2,
        status: 'FINISHED',
        clubIdsJson: JSON.stringify([club.id]),
        fixturesJson: '[]',
        season: 2030,
      },
    });
    const currentId = await seedLeagueWith([club.id], 2031);

    const active = (await request(app).get(`/leagues/active?clubId=${club.id}`).set('Authorization', `Bearer ${manager.token}`)).body;
    expect(active).not.toBeNull();
    expect(active.id).toBe(currentId);
    expect(active.id).not.toBe(finishedId);
    expect(active.status).toBe('IN_PROGRESS');
    expect(active.season).toBe(2031);
  });

  it('opens the next season at the turn of the year, not the moment the last fixture resolves', async () => {
    const managers = await Promise.all([registerAndLogin(), registerAndLogin()]);
    const clubs = [];
    for (const manager of managers) clubs.push(await createClubFor(manager.token));
    const clubIdToToken: Record<string, string> = {};
    clubs.forEach((c, i) => {
      clubIdToToken[c.id] = managers[i].token;
    });
    const token = managers[0].token;
    const clubId = clubs[0].id;

    const seasonBefore = 2040;
    const leagueId = await seedLeagueWith(clubs.map((c) => c.id), seasonBefore);

    // Two clubs is a two-round season, which keeps this fast.
    let current: any = { status: 'IN_PROGRESS' };
    let guard = 0;
    while (current.status !== 'FINISHED' && guard < 40) {
      const res = await request(app).post(`/leagues/${leagueId}/advance-round`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      current = res.body;
      await finishAnyLiveMatches(current.fixtures, clubIdToToken);
      guard += 1;
    }
    expect(current.status).toBe('FINISHED');

    /**
     * Finishing a season no longer opens the next one.
     *
     * It used to, in the same function, which is why the year never turned: a new league appeared the
     * instant the last fixture resolved, in whatever month that happened, while the clock stayed where it
     * was. Closing a competition and opening one are different events on different dates.
     */
    const cohortJson = JSON.stringify(clubs.map((c) => c.id));
    expect(
      await prisma.league.count({ where: { countryCode: COUNTRY, division: 1, season: seasonBefore + 1, clubIdsJson: cohortJson } }),
    ).toBe(0);

    await pinClockTo(seasonBefore);
    const report = await turnSeason(seasonBefore + 1);
    expect(report.seasonYear).toBe(seasonBefore + 1);

    const active = (await request(app).get(`/leagues/active?clubId=${clubId}`).set('Authorization', `Bearer ${token}`)).body;
    expect(active).not.toBeNull();
    expect(active.status).toBe('IN_PROGRESS');
    expect(active.season).toBe(seasonBefore + 1);
    expect(active.id).not.toBe(leagueId);
    expect(active.clubIds).toContain(clubId);
    // A fresh season starts with everything still to play, and every round already on the calendar.
    expect(active.fixtures.every((f: any) => f.matchId === null && !f.result)).toBe(true);
    expect(active.fixtures.every((f: any) => typeof f.date === 'string')).toBe(true);

    // Exactly one renewal for this cohort, however many times the turn is reached. Keyed on the club list
    // because a country legitimately runs several same-named leagues per season with different clubs in
    // each, so counting by country and division alone would be meaningless here.
    await turnSeason(seasonBefore + 1);
    expect(
      await prisma.league.count({ where: { countryCode: COUNTRY, division: 1, season: seasonBefore + 1, clubIdsJson: cohortJson } }),
    ).toBe(1);
  }, 60000);
});

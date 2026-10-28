import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { generateDoubleRoundRobinFixtures, dayOfWeek, WEDNESDAY } from '@tactical-arena/shared';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

const app = createApp();
/** Dedicated, never-reused country. */
const COUNTRY = 'SCO';
/** Dedicated, never-reused season: the clock scans by season, so this is what isolates the suite. */
const SEASON = 2037;

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

async function createClubFor(token: string) {
  const res = await request(app)
    .post('/clubs')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Clube SCO ${randomUUID().slice(0, 8)}`, country: COUNTRY });
  expect(res.status).toBe(201);
  return res.body;
}

async function pinClockTo(currentDate: string) {
  await prisma.gameState.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', currentDate, seasonYear: SEASON, phase: 'PRE_SEASON' },
    update: { currentDate, seasonYear: SEASON, phase: 'PRE_SEASON' },
  });
}

/**
 * The clock is a singleton and the database is shared by every integration suite, so "the next matchday
 * in the world" is only a well-defined question here if this suite owns its season outright. Nothing else
 * uses 2037; this closes anything that leaked into it before asserting on what comes next.
 */
beforeAll(async () => {
  await prisma.league.deleteMany({ where: { season: SEASON } });
  await prisma.cup.deleteMany({ where: { season: SEASON } });
});

beforeEach(async () => {
  await prisma.league.deleteMany({ where: { season: SEASON } });
  await prisma.cup.deleteMany({ where: { season: SEASON } });
});

async function startedLeague(token: string, clubIds: string[], name: string, countryCode: string = COUNTRY) {
  const leagueId = randomUUID();
  await prisma.league.create({
    data: {
      id: leagueId,
      countryCode,
      division: 1,
      name,
      capacity: clubIds.length,
      status: 'OPEN',
      clubIdsJson: JSON.stringify(clubIds),
      fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
      season: SEASON,
    },
  });
  const res = await request(app).post(`/leagues/${leagueId}/force-start`).set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body;
}

/**
 * The game finally has a loop.
 *
 * Every advance used to mean "play the next round of *this* league", chosen by whichever screen the
 * manager happened to be on. That is why a cup tie falling between two league rounds was unreachable, and
 * why the season number never turned: nothing in the game knew what day it was, so nothing could say what
 * came next. These tests pin the replacement — the calendar decides, and one button follows it.
 */
describe('Matchday advance', () => {
  it('moves the clock to the next scheduled date and plays what is on it', async () => {
    await pinClockTo(`${SEASON}-01-01`);
    const token = await registerAndLogin();
    const clubs = [await createClubFor(token), await createClubFor(token)];
    const league = await startedLeague(token, clubs.map((c) => c.id), 'Liga do Relógio');

    const round1Date = league.fixtures.find((f: { round: number }) => f.round === 1).date;
    expect(round1Date).toBeTruthy();

    const res = await request(app).post('/game/advance').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // The clock lands exactly on the fixture's own date — not a week later, not "today plus seven".
    expect(res.body.date).toBe(round1Date);
    expect(res.body.played.some((p: { competitionId: string }) => p.competitionId === league.id)).toBe(true);

    const after = (await request(app).get(`/leagues/${league.id}`).set('Authorization', `Bearer ${token}`)).body;
    const round1 = after.fixtures.filter((f: { round: number }) => f.round === 1);
    for (const fixture of round1) {
      expect(fixture.matchId ?? fixture.result, 'round 1 should have been played').toBeTruthy();
    }
  }, 60000);

  it('plays one date at a time, in order, and never runs the clock backwards', async () => {
    await pinClockTo(`${SEASON}-01-01`);
    const token = await registerAndLogin();
    // Four clubs, so the league has six rounds and three advances have somewhere to go. A two-club league
    // has exactly two rounds, and the third advance would find the season already over.
    const clubs = [
      await createClubFor(token),
      await createClubFor(token),
      await createClubFor(token),
      await createClubFor(token),
    ];
    const league = await startedLeague(token, clubs.map((c) => c.id), 'Liga Sequencial');

    const dates: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post('/game/advance').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      dates.push(res.body.date);
    }

    // Strictly forward: an advance that landed on the same day twice would mean a round was replayed.
    expect(dates[1] > dates[0]).toBe(true);
    expect(dates[2] > dates[1]).toBe(true);

    const after = (await request(app).get(`/leagues/${league.id}`).set('Authorization', `Bearer ${token}`)).body;
    const playedRounds = new Set(
      after.fixtures
        .filter((f: { matchId: string | null; result?: unknown }) => f.matchId || f.result)
        .map((f: { round: number }) => f.round),
    );
    expect([...playedRounds].sort((a, b) => (a as number) - (b as number))).toEqual([1, 2, 3]);
  }, 60000);

  /**
   * The point of the whole calendar: interleaving is not a conflict to resolve, it is just what happens
   * when each date belongs to one round. The manager presses the same button and gets whatever that day
   * holds — a Sunday of league or a Wednesday of cup.
   */
  it('walks into the cup on the midweek date between two league rounds', async () => {
    await pinClockTo(`${SEASON}-01-01`);
    const token = await registerAndLogin();
    const clubs = [
      await createClubFor(token),
      await createClubFor(token),
      await createClubFor(token),
      await createClubFor(token),
    ];
    const clubIds = clubs.map((c) => c.id);
    await startedLeague(token, clubIds, 'Liga Intercalada de Verdade');

    const cup = (
      await request(app)
        .post('/cups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Copa do Relógio ${randomUUID().slice(0, 6)}`, countryCode: COUNTRY, clubIds })
    ).body;
    const cupDate = cup.fixtures.find((f: { date?: string | null }) => f.date)?.date;
    expect(cupDate, 'the cup must be dated for this test to mean anything').toBeTruthy();
    expect(dayOfWeek(cupDate)).toBe(WEDNESDAY);

    // Advance until the clock reaches the cup's date. It has to arrive there on its own.
    let reachedCup: { kind: string; competitionId: string }[] | null = null;
    for (let i = 0; i < 12 && !reachedCup; i += 1) {
      const res = await request(app).post('/game/advance').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      if (res.body.date === cupDate) reachedCup = res.body.played;
    }

    expect(reachedCup, `the clock never stopped on ${cupDate}`).toBeTruthy();
    expect(reachedCup!.some((p) => p.kind === 'CUP' && p.competitionId === cup.id)).toBe(true);
    // And only the cup: a league round on a cup's Wednesday would break the one-date-one-round rule.
    expect(reachedCup!.every((p) => p.kind === 'CUP')).toBe(true);
  }, 60000);

  it('says what is coming without playing it', async () => {
    await pinClockTo(`${SEASON}-01-01`);
    const token = await registerAndLogin();
    const clubs = [await createClubFor(token), await createClubFor(token)];
    const league = await startedLeague(token, clubs.map((c) => c.id), 'Liga da Espiada');
    await prisma.league.deleteMany({ where: { season: SEASON, id: { not: league.id } } });

    const peek = (await request(app).get('/game/next-matchday').set('Authorization', `Bearer ${token}`)).body;
    expect(peek.competitionId).toBe(league.id);
    expect(peek.round).toBe(1);

    // Asked twice, the answer must not have moved: the screen reads this on every render.
    const again = (await request(app).get('/game/next-matchday').set('Authorization', `Bearer ${token}`)).body;
    expect(again).toEqual(peek);

    const state = (await request(app).get('/game/state').set('Authorization', `Bearer ${token}`)).body;
    expect(state.currentDate).toBe(`${SEASON}-01-01`);
  }, 60000);

  it('still runs the world a week when the last-tick marker is left in the future', async () => {
    await pinClockTo(`${SEASON}-01-01`);
    const token = await registerAndLogin();
    const clubs = [await createClubFor(token), await createClubFor(token)];
    await startedLeague(token, clubs.map((c) => c.id), 'Liga do Marcador');

    /**
     * A marker ahead of the clock is not hypothetical: loading one save over another, importing one, or
     * the season turn setting a date all leave it there. Adding a week to it produces a Monday that never
     * arrives, so the world's wages, building work and injury recovery would stop for good — silently,
     * with a game that otherwise looks like it is running.
     */
    await prisma.gameState.update({ where: { id: 'singleton' }, data: { lastWeeklyTickDate: `${SEASON + 2}-06-01` } });

    const res = await request(app).post('/game/advance').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.weeksRun.length).toBeGreaterThan(0);
  }, 60000);

  it('refuses to advance for someone with no club', async () => {
    const token = await registerAndLogin();
    const res = await request(app).post('/game/advance').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  }, 60000);

  it('requires authentication', async () => {
    expect((await request(app).post('/game/advance')).status).toBe(401);
  }, 60000);
});

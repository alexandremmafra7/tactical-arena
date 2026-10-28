import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { dayOfWeek, generateDoubleRoundRobinFixtures, seasonWindow, WEDNESDAY } from '@tactical-arena/shared';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

const app = createApp();
/** Dedicated, never-reused country. */
const COUNTRY = 'AUS';
const SEASON = 2035;

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
    .send({ name: `Clube AUS ${randomUUID().slice(0, 8)}`, country: COUNTRY });
  expect(res.status).toBe(201);
  return res.body;
}

/**
 * Pins the game clock to this suite's season.
 *
 * The clock is a singleton shared by every integration suite in this database, and competitions take
 * their season from it — so a suite that seeds leagues in one year while the clock sits in another is
 * testing a state the real game never reaches. Setting it explicitly is both more honest and more
 * stable than walking the global clock forward.
 */
async function pinClockTo(seasonYear: number) {
  const currentDate = `${seasonYear}-01-01`;
  await prisma.gameState.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', currentDate, seasonYear, phase: 'PRE_SEASON' },
    update: { currentDate, seasonYear, phase: 'PRE_SEASON' },
  });
}

/**
 * Fixtures with dates.
 *
 * Before this the game had no notion of when a match was played: fixtures carried a round number and
 * nothing else, and a league and a cup running at the same time had no idea the other existed. These
 * tests pin the rule everything rests on — one date, one round — across both competitions at once.
 */
describe('Season calendar', () => {
  it('dates every league round inside the season window', async () => {
    await pinClockTo(SEASON);
    const token = await registerAndLogin();
    const clubs = [await createClubFor(token), await createClubFor(token)];

    const leagueId = randomUUID();
    await prisma.league.create({
      data: {
        id: leagueId,
        countryCode: COUNTRY,
        division: 1,
        name: 'Liga Calendário',
        capacity: 2,
        status: 'OPEN',
        clubIdsJson: JSON.stringify(clubs.map((c) => c.id)),
        fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubs.map((c) => c.id))),
        season: SEASON,
      },
    });

    const started = (await request(app).post(`/leagues/${leagueId}/force-start`).set('Authorization', `Bearer ${token}`)).body;
    expect(started.status).toBe('IN_PROGRESS');

    const { startDate, endDate } = seasonWindow(SEASON);
    for (const fixture of started.fixtures) {
      expect(fixture.date, `round ${fixture.round}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(fixture.date >= startDate).toBe(true);
      expect(fixture.date <= endDate).toBe(true);
    }

    // Same round, same day — and different rounds never share one.
    const byRound = new Map<number, string>();
    for (const fixture of started.fixtures) {
      const seen = byRound.get(fixture.round);
      if (seen) expect(fixture.date).toBe(seen);
      else byRound.set(fixture.round, fixture.date);
    }
    expect(new Set(byRound.values()).size).toBe(byRound.size);
  });

  /** The interleaving guarantee: a cup never lands on a day the league is already using. */
  it('schedules a cup around the league instead of on top of it', async () => {
    await pinClockTo(SEASON);
    const token = await registerAndLogin();
    const clubs = [await createClubFor(token), await createClubFor(token), await createClubFor(token), await createClubFor(token)];
    const clubIds = clubs.map((c) => c.id);

    const leagueId = randomUUID();
    await prisma.league.create({
      data: {
        id: leagueId,
        countryCode: COUNTRY,
        division: 1,
        name: 'Liga Intercalada',
        capacity: 4,
        status: 'OPEN',
        clubIdsJson: JSON.stringify(clubIds),
        fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
        season: SEASON,
      },
    });
    const league = (await request(app).post(`/leagues/${leagueId}/force-start`).set('Authorization', `Bearer ${token}`)).body;

    const cup = (
      await request(app)
        .post('/cups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Copa Teste ${randomUUID().slice(0, 6)}`, countryCode: COUNTRY, clubIds })
    ).body;

    const cupDates = cup.fixtures.map((f: { date?: string | null }) => f.date).filter(Boolean);
    expect(cupDates.length).toBeGreaterThan(0);

    const leagueDates = new Set(league.fixtures.map((f: { date: string }) => f.date));
    for (const date of cupDates) {
      expect(leagueDates.has(date), `cup tie on ${date} clashes with a league round`).toBe(false);
      // Cups belong midweek — that is what makes the two competitions alternate rather than compete.
      expect(dayOfWeek(date)).toBe(WEDNESDAY);
    }
  });

  it('merges league and cup into one dated calendar for the club', async () => {
    await pinClockTo(SEASON);
    const token = await registerAndLogin();
    const clubs = [await createClubFor(token), await createClubFor(token)];
    const clubIds = clubs.map((c) => c.id);

    const leagueId = randomUUID();
    await prisma.league.create({
      data: {
        id: leagueId,
        countryCode: COUNTRY,
        division: 1,
        name: 'Liga Mesclada',
        capacity: 2,
        status: 'OPEN',
        clubIdsJson: JSON.stringify(clubIds),
        fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
        season: SEASON,
      },
    });
    await request(app).post(`/leagues/${leagueId}/force-start`).set('Authorization', `Bearer ${token}`);
    await request(app)
      .post('/cups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Copa Mesclada ${randomUUID().slice(0, 6)}`, countryCode: COUNTRY, clubIds });

    const calendar = (
      await request(app).get(`/game/calendar?clubId=${clubIds[0]}`).set('Authorization', `Bearer ${token}`)
    ).body;

    expect(calendar.entries.length).toBeGreaterThan(0);
    expect(calendar.entries.some((e: { kind: string }) => e.kind === 'LEAGUE')).toBe(true);
    expect(calendar.entries.some((e: { kind: string }) => e.kind === 'CUP')).toBe(true);

    // Sorted by date, so the screen can render it straight down the page.
    const dated = calendar.entries.filter((e: { date: string | null }) => e.date);
    for (let i = 1; i < dated.length; i += 1) {
      expect(dated[i].date >= dated[i - 1].date).toBe(true);
    }

    // Every entry is from this club's point of view, with the opponent already resolved to a name.
    for (const entry of calendar.entries) {
      expect(entry.opponentClubId).not.toBe(clubIds[0]);
      expect(typeof entry.opponentName).toBe('string');
      expect(typeof entry.isHome).toBe('boolean');
    }
  });
});

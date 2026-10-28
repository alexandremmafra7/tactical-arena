import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { BOT_OWNER_ID, generateDoubleRoundRobinFixtures } from '@tactical-arena/shared';
import { prisma } from './db/prisma.js';
import { advanceRound } from './services/leagueService.js';
import { turnSeasonForClub } from './services/seasonTurnService.js';
import { createClub } from './services/clubService.js';

/** Dedicated, never-reused country. */
const COUNTRY = 'SEN';

async function botClub(name: string) {
  const club = await createClub(BOT_OWNER_ID, name, COUNTRY);
  return club;
}

/**
 * Matches nobody watches.
 *
 * A stored match costs ~5.7 KB. That is nothing for the handful a manager opens and ruinous across a world
 * of leagues, where one season would add tens of megabytes of commentary no one will ever read. A fixture
 * between two computer-run clubs is therefore played for its result only — same engine, same tactics, no
 * stored row — and everything downstream has to carry on as if nothing changed.
 */
describe('Background matches', () => {
  it('plays a bot-only round without storing a match, and still fills the table', async () => {
    const clubs = [await botClub('Bot A'), await botClub('Bot B'), await botClub('Bot C'), await botClub('Bot D')];
    const clubIds = clubs.map((c) => c.id);

    const leagueId = randomUUID();
    await prisma.league.create({
      data: {
        id: leagueId,
        countryCode: COUNTRY,
        division: 1,
        name: 'Liga de Fundo',
        capacity: 4,
        status: 'IN_PROGRESS',
        clubIdsJson: JSON.stringify(clubIds),
        fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
        season: 2026,
      },
    });

    const matchesBefore = await prisma.match.count();
    const league = await advanceRound(leagueId, BOT_OWNER_ID);
    const matchesAfter = await prisma.match.count();

    // The whole point: no rows added for a round nobody saw.
    expect(matchesAfter).toBe(matchesBefore);

    const round1 = league.fixtures.filter((f) => f.round === 1);
    expect(round1.length).toBeGreaterThan(0);
    for (const fixture of round1) {
      expect(fixture.matchId).toBeNull();
      expect(fixture.result, 'a played fixture must carry its score').toBeTruthy();
      expect(typeof fixture.result!.homeGoals).toBe('number');
      expect(typeof fixture.result!.awayGoals).toBe('number');
    }

    // And the table counts them exactly like any other result.
    const { standings: table } = await import('./services/leagueService.js').then((m) =>
      m.getLeagueWithStandings(leagueId),
    );
    const played = table.reduce((sum, row) => sum + row.played, 0);
    expect(played).toBe(round1.length * 2);
  });

  it('moves on to the next round instead of replaying the one it just played', async () => {
    const clubs = [await botClub('Rodada A'), await botClub('Rodada B')];
    const clubIds = clubs.map((c) => c.id);

    const leagueId = randomUUID();
    await prisma.league.create({
      data: {
        id: leagueId,
        countryCode: COUNTRY,
        division: 4,
        name: 'Liga de Rodadas',
        capacity: 2,
        status: 'IN_PROGRESS',
        clubIdsJson: JSON.stringify(clubIds),
        fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
        season: 2026,
      },
    });

    await advanceRound(leagueId, BOT_OWNER_ID);
    const after = await advanceRound(leagueId, BOT_OWNER_ID);

    /**
     * "Not yet played" used to mean `matchId === null`, which a result-only fixture satisfies forever —
     * so round 1 stayed the lowest pending round and every advance replayed it, scoring the same game
     * again and again while round 2 never arrived.
     */
    for (const fixture of after.fixtures) {
      expect(fixture.result, `round ${fixture.round} should have been played`).toBeTruthy();
    }
  });

  it('does not touch a roster it is not showing anyone', async () => {
    const clubs = [await botClub('Dev A'), await botClub('Dev B')];
    const clubIds = clubs.map((c) => c.id);

    const before = await prisma.club.findUnique({ where: { id: clubIds[0] } });

    const leagueId = randomUUID();
    await prisma.league.create({
      data: {
        id: leagueId,
        countryCode: COUNTRY,
        division: 2,
        name: 'Liga de Desenvolvimento',
        capacity: 2,
        status: 'IN_PROGRESS',
        clubIdsJson: JSON.stringify(clubIds),
        fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
        season: 2026,
      },
    });
    await advanceRound(leagueId, BOT_OWNER_ID);

    const after = await prisma.club.findUnique({ where: { id: clubIds[0] } });

    /**
     * The whole saving, stated as a fact about the database.
     *
     * A background fixture is resolved from the ratings kept beside the club, so the 42 KB roster is
     * never read and never written. That is where the cost was: the simulation itself is 0.62 ms and a
     * background fixture measured at 27.7 ms before this. Fatigue, injuries and bookings are the price —
     * they are things that happen to players, and no player is loaded.
     */
    expect(after?.playersJson).toBe(before?.playersJson);
    // The match is still counted, so the season turn can pay for it.
    expect(after?.pendingMatchesPlayed).toBe(1);
  }, 60000);

  it('keeps the world developing: the matches it counts are paid out at the season turn', async () => {
    const clubs = [await botClub('Fadiga A'), await botClub('Fadiga B')];
    const clubIds = clubs.map((c) => c.id);

    const leagueId = randomUUID();
    await prisma.league.create({
      data: {
        id: leagueId,
        countryCode: COUNTRY,
        division: 3,
        name: 'Liga de Fadiga',
        capacity: 2,
        status: 'IN_PROGRESS',
        clubIdsJson: JSON.stringify(clubIds),
        fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
        season: 2026,
      },
    });
    await advanceRound(leagueId, BOT_OWNER_ID);

    const beforeTurn = await prisma.club.findUnique({ where: { id: clubIds[0] } });
    const pointsBefore = (JSON.parse(beforeTurn!.playersJson) as { developmentPoints: number }[]).reduce(
      (sum, p) => sum + p.developmentPoints,
      0,
    );

    await turnSeasonForClub(clubIds[0], 2027);

    const afterTurn = await prisma.club.findUnique({ where: { id: clubIds[0] } });
    const pointsAfter = (JSON.parse(afterTurn!.playersJson) as { developmentPoints: number }[]).reduce(
      (sum, p) => sum + p.developmentPoints,
      0,
    );

    /**
     * Development used to come only from a manager pressing "treinar", which left every squad outside the
     * one a human runs frozen forever. Minutes still count for everyone — they are simply credited where
     * development is spent anyway, at the turn of the year, instead of after each match nobody watched.
     */
    expect(pointsAfter).toBeGreaterThan(pointsBefore);
    expect(afterTurn?.pendingMatchesPlayed, 'the tally is settled, not carried forward').toBe(0);
  }, 60000);
});

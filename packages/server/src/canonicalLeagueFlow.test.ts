import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { BOT_OWNER_ID, LEAGUE_CAPACITY } from '@tactical-arena/shared';
import { prisma } from './db/prisma.js';
import { createClub } from './services/clubService.js';
import { joinOrCreateLeague } from './services/leagueService.js';
import { getGameState } from './services/gameStateService.js';

/** Dedicated, never-reused country. */
const COUNTRY = 'CIV';

/**
 * One league per country, per division, per season.
 *
 * It was not so before: a club joined the oldest OPEN league and a brand new one opened whenever that
 * filled, so Brazil ran three separate leagues all called "Brasileirão Série A" in the same season. Every
 * screen that asked "which league is this club in?" had to guess, and every season renewal had to be keyed
 * on the exact list of clubs rather than on the competition, because the competition was not identifiable.
 */
describe('Canonical league', () => {
  it('puts a whole country into the same league instead of opening a second one', async () => {
    const season = (await getGameState()).seasonYear;
    const division = 40;

    for (let i = 0; i < 6; i += 1) {
      const club = await createClub(BOT_OWNER_ID, `Canonico ${i} ${randomUUID().slice(0, 6)}`, COUNTRY);
      await joinOrCreateLeague(club.id, COUNTRY, division);
    }

    const leagues = await prisma.league.findMany({ where: { countryCode: COUNTRY, division, season } });
    expect(leagues).toHaveLength(1);
    expect((JSON.parse(leagues[0].clubIdsJson) as string[]).length).toBe(6);
  }, 60000);

  it('sends the overflow down a division once the top one is full', async () => {
    const season = (await getGameState()).seasonYear;
    const division = 50;

    // Fill the division to the brim by hand, so the test does not have to create twenty squads.
    const full = Array.from({ length: LEAGUE_CAPACITY }, (_, i) => `preenchimento-${division}-${i}`);
    await prisma.league.create({
      data: {
        id: randomUUID(),
        countryCode: COUNTRY,
        division,
        name: `Liga Cheia ${division}`,
        capacity: LEAGUE_CAPACITY,
        status: 'OPEN',
        clubIdsJson: JSON.stringify(full),
        fixturesJson: '[]',
        season,
      },
    });

    const late = await createClub(BOT_OWNER_ID, `Atrasado ${randomUUID().slice(0, 6)}`, COUNTRY);
    const placed = await joinOrCreateLeague(late.id, COUNTRY, division);

    expect(placed, 'a club with nowhere in the top division should drop a division, not vanish').toBeTruthy();
    expect(placed!.division).toBe(division + 1);
    expect(placed!.clubIds).toContain(late.id);

    // And the full division is untouched — nobody is squeezed in past capacity.
    const top = await prisma.league.findFirst({ where: { countryCode: COUNTRY, division, season } });
    expect((JSON.parse(top!.clubIdsJson) as string[]).length).toBe(LEAGUE_CAPACITY);
  }, 60000);

  it('does not squeeze a latecomer into a division that has already kicked off', async () => {
    const season = (await getGameState()).seasonYear;
    const division = 60;

    await prisma.league.create({
      data: {
        id: randomUUID(),
        countryCode: COUNTRY,
        division,
        name: `Liga Em Andamento ${division}`,
        capacity: LEAGUE_CAPACITY,
        status: 'IN_PROGRESS',
        clubIdsJson: JSON.stringify(['ja-jogando-a', 'ja-jogando-b']),
        fixturesJson: '[]',
        season,
      },
    });

    const late = await createClub(BOT_OWNER_ID, `Tarde ${randomUUID().slice(0, 6)}`, COUNTRY);
    const placed = await joinOrCreateLeague(late.id, COUNTRY, division);

    // Room on paper, but the fixtures are already drawn: joining now would mean a club with no schedule.
    expect(placed!.division).toBe(division + 1);
    const started = await prisma.league.findFirst({ where: { countryCode: COUNTRY, division, season } });
    expect(JSON.parse(started!.clubIdsJson)).not.toContain(late.id);
  }, 60000);

  it('is idempotent for a club already in its league', async () => {
    const division = 70;
    const club = await createClub(BOT_OWNER_ID, `Repetido ${randomUUID().slice(0, 6)}`, COUNTRY);

    const first = await joinOrCreateLeague(club.id, COUNTRY, division);
    const again = await joinOrCreateLeague(club.id, COUNTRY, division);

    expect(again!.id).toBe(first!.id);
    expect(again!.clubIds.filter((id) => id === club.id)).toHaveLength(1);
  }, 60000);
});

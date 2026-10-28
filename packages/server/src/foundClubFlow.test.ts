import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { BOT_OWNER_ID, generateDoubleRoundRobinFixtures, type LeagueFixture } from '@tactical-arena/shared';
import { prisma } from './db/prisma.js';
import { createClub, getClub } from './services/clubService.js';
import { foundClub, listFoundableCountries, CITY_SIZES, FoundClubError } from './services/foundClubService.js';
import { STARTING_BUDGET } from '@tactical-arena/shared';

/** Dedicated, never-reused country. */
const COUNTRY = 'LVA';
/** A second one, for the case where there is no pyramid to climb. */
const FLAT_COUNTRY = 'LTU';

const SEASON = 2051;

async function botClub(name: string) {
  return createClub(BOT_OWNER_ID, `${name} ${randomUUID().slice(0, 6)}`, COUNTRY);
}

/**
 * A season of its own per case.
 *
 * The game keeps one league per division per season (see `joinOrCreateLeague`), and `foundClub` relies on
 * that to know which competition it is putting the club into. Seeding several second divisions for the same
 * country and year would break an invariant the real game never breaks, and the service would rightly pick
 * an arbitrary one of them.
 */
async function pinClock(season: number) {
  await prisma.gameState.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', currentDate: `${season}-01-05`, seasonYear: season, phase: 'PRE_SEASON' },
    update: { currentDate: `${season}-01-05`, seasonYear: season, phase: 'PRE_SEASON' },
  });
}

async function seedLeague(countryCode: string, division: number, clubIds: string[], season: number) {
  await pinClock(season);
  const id = randomUUID();
  await prisma.league.create({
    data: {
      id,
      countryCode,
      division,
      name: `Divisão ${division}`,
      capacity: clubIds.length,
      status: 'IN_PROGRESS',
      clubIdsJson: JSON.stringify(clubIds),
      fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
      season,
    },
  });
  return id;
}

/**
 * Founding a club.
 *
 * The "criar clube" that existed dropped the new club into division 1 by way of `joinOrCreateLeague`, which
 * only ever joins a league still OPEN. Every league in the shipped world is already under way, so what it
 * really did was invent an empty division below the pyramid and leave the club alone in it, waiting for a
 * season that would never start.
 *
 * A division has a fixed size, a drawn fixture list and an even number of clubs the round robin depends on.
 * A club joining has to take somebody's place, which is also what happens when a side is admitted to a real
 * competition.
 */
describe('Founding a club', () => {
  it('only offers countries with somewhere to climb to', async () => {
    const flat = [await createClub(BOT_OWNER_ID, `Plano A ${randomUUID().slice(0, 6)}`, FLAT_COUNTRY)];
    await seedLeague(FLAT_COUNTRY, 1, [flat[0].id, (await createClub(BOT_OWNER_ID, `Plano B ${randomUUID().slice(0, 6)}`, FLAT_COUNTRY)).id], SEASON);

    const foundable = await listFoundableCountries();

    /**
     * A club founded where there is only one division spends the whole save in the only tier there is,
     * which is the same game as taking over an existing club with a worse squad. On the shipped world this
     * filter excludes 72 of 98 countries, so it is not a formality.
     */
    expect(foundable.some((c) => c.code === FLAT_COUNTRY)).toBe(false);
  }, 120000);

  it('puts the new club in the access division, in the weakest side place', async () => {
    const first = [await botClub('LV1 A'), await botClub('LV1 B')];
    const second = [await botClub('LV2 A'), await botClub('LV2 B'), await botClub('LV2 C'), await botClub('LV2 D')];

    const season = SEASON + 1;
    await seedLeague(COUNTRY, 1, first.map((c) => c.id), season);
    const accessId = await seedLeague(COUNTRY, 2, second.map((c) => c.id), season);

    const before = await prisma.club.findMany({
      where: { id: { in: second.map((c) => c.id) } },
      select: { id: true, ratingAttack: true, ratingDefense: true },
    });
    const weakest = before.reduce((w, c) => (c.ratingAttack + c.ratingDefense < w.ratingAttack + w.ratingDefense ? c : w));

    const founded = await foundClub('manager-found', { name: 'Fundado FC', country: COUNTRY });

    const league = await prisma.league.findUnique({ where: { id: accessId } });
    const members = JSON.parse(league!.clubIdsJson) as string[];

    expect(members, 'o clube fundado entra na divisão de acesso').toContain(founded.id);
    expect(members, 'e quem saiu foi o mais fraco').not.toContain(weakest.id);

    /**
     * The invariants a substitution has to leave alone. Adding a club instead of swapping one would break
     * every one of them at once: a round robin needs an even count, and a tier left odd never generates a
     * fixture list at all.
     */
    expect(members).toHaveLength(second.length);
    expect(members.length % 2).toBe(0);
    expect(new Set(members).size).toBe(members.length);
  }, 120000);

  it('rewrites the fixtures so the new club actually has games', async () => {
    const first = [await botClub('FX1 A'), await botClub('FX1 B')];
    const second = [await botClub('FX2 A'), await botClub('FX2 B'), await botClub('FX2 C'), await botClub('FX2 D')];
    const season = SEASON + 2;
    await seedLeague(COUNTRY, 1, first.map((c) => c.id), season);
    const accessId = await seedLeague(COUNTRY, 2, second.map((c) => c.id), season);

    const founded = await foundClub('manager-found', { name: 'Com Jogos FC', country: COUNTRY });

    const league = await prisma.league.findUnique({ where: { id: accessId } });
    const fixtures = JSON.parse(league!.fixturesJson) as LeagueFixture[];
    const members = new Set(JSON.parse(league!.clubIdsJson) as string[]);

    // A place in the table is worth nothing without a fixture list to go with it.
    const games = fixtures.filter((f) => f.homeClubId === founded.id || f.awayClubId === founded.id);
    expect(games.length).toBe((second.length - 1) * 2);

    // And nothing may still be drawn against the club that left.
    for (const fixture of fixtures) {
      expect(members.has(fixture.homeClubId)).toBe(true);
      expect(members.has(fixture.awayClubId)).toBe(true);
    }
  }, 120000);

  it('gives the founded club the worst squad in its division, but a real one', async () => {
    const first = [await botClub('SQ1 A'), await botClub('SQ1 B')];
    const second = [await botClub('SQ2 A'), await botClub('SQ2 B'), await botClub('SQ2 C'), await botClub('SQ2 D')];
    const season = SEASON + 3;
    await seedLeague(COUNTRY, 1, first.map((c) => c.id), season);
    const accessId = await seedLeague(COUNTRY, 2, second.map((c) => c.id), season);

    const founded = await foundClub('manager-found', { name: 'Do Zero FC', country: COUNTRY });
    const members = JSON.parse((await prisma.league.findUnique({ where: { id: accessId } }))!.clubIdsJson) as string[];

    const ratings = await prisma.club.findMany({
      where: { id: { in: members } },
      select: { id: true, ratingAttack: true, ratingDefense: true },
    });
    const strengthOf = (id: string) => {
      const row = ratings.find((r) => r.id === id)!;
      return row.ratingAttack + row.ratingDefense;
    };

    const others = members.filter((id) => id !== founded.id);
    /**
     * A club with no history, no money and nobody who wanted to sign for it should be the worst side in the
     * league it enters. Not hopeless, which is why the handicap is eight points of overall and not thirty.
     */
    expect(Math.min(...others.map(strengthOf))).toBeGreaterThan(strengthOf(founded.id));
    expect(founded.players.length).toBeGreaterThanOrEqual(11);

    // And it arrives with the small sponsor board its ground earns, like any other new club.
    expect(founded.sponsorships.length).toBeGreaterThan(0);
  }, 120000);

  it('refuses once the season has kicked off', async () => {
    const first = [await botClub('KO1 A'), await botClub('KO1 B')];
    const second = [await botClub('KO2 A'), await botClub('KO2 B'), await botClub('KO2 C'), await botClub('KO2 D')];
    const season = SEASON + 4;
    await seedLeague(COUNTRY, 1, first.map((c) => c.id), season);
    const accessId = await seedLeague(COUNTRY, 2, second.map((c) => c.id), season);

    // One round played is enough: substituting a club into a fixture that already has a score would rewrite
    // a result that happened.
    const league = await prisma.league.findUnique({ where: { id: accessId } });
    const fixtures = JSON.parse(league!.fixturesJson) as LeagueFixture[];
    fixtures[0].result = { homeGoals: 2, awayGoals: 1, scorers: [], assists: [] } as LeagueFixture['result'];
    await prisma.league.update({ where: { id: accessId }, data: { fixturesJson: JSON.stringify(fixtures) } });

    await expect(foundClub('manager-found', { name: 'Atrasado FC', country: COUNTRY })).rejects.toBeInstanceOf(FoundClubError);
  }, 120000);

  it('leaves the displaced club alive, just without a league', async () => {
    const first = [await botClub('DP1 A'), await botClub('DP1 B')];
    const second = [await botClub('DP2 A'), await botClub('DP2 B'), await botClub('DP2 C'), await botClub('DP2 D')];
    const season = SEASON + 5;
    await seedLeague(COUNTRY, 1, first.map((c) => c.id), season);
    const accessId = await seedLeague(COUNTRY, 2, second.map((c) => c.id), season);

    const founded = await foundClub('manager-found', { name: 'Substituto FC', country: COUNTRY });
    const members = new Set(JSON.parse((await prisma.league.findUnique({ where: { id: accessId } }))!.clubIdsJson) as string[]);
    const displacedId = second.map((c) => c.id).find((id) => !members.has(id))!;

    /**
     * Losing a league place is not being deleted. Every club below the last division is already in this
     * state, so the world has plenty of precedent for a club that exists and does not play a championship.
     */
    const displaced = await getClub(displacedId);
    expect(displaced.players.length).toBeGreaterThan(0);
    expect(displaced.id).not.toBe(founded.id);
  }, 120000);

  it('trades cash for a ground, whichever way the manager chooses', async () => {
    const season = SEASON + 7;
    const first = [await botClub('CT1 A'), await botClub('CT1 B')];
    const second = [await botClub('CT2 A'), await botClub('CT2 B'), await botClub('CT2 C'), await botClub('CT2 D')];
    await seedLeague(COUNTRY, 1, first.map((c) => c.id), season);
    await seedLeague(COUNTRY, 2, second.map((c) => c.id), season);

    const town = await foundClub('manager-found', { name: 'Vila FC', country: COUNTRY, citySize: 'SMALL' });

    const season2 = SEASON + 8;
    const first2 = [await botClub('CT3 A'), await botClub('CT3 B')];
    const second2 = [await botClub('CT4 A'), await botClub('CT4 B'), await botClub('CT4 C'), await botClub('CT4 D')];
    await seedLeague(COUNTRY, 1, first2.map((c) => c.id), season2);
    await seedLeague(COUNTRY, 2, second2.map((c) => c.id), season2);

    const city = await foundClub('manager-found', { name: 'Metrópole FC', country: COUNTRY, citySize: 'LARGE' });

    /**
     * One choice, two consequences pointing opposite ways. A big city hands over a ground that earns several
     * times as much every week and takes most of the opening budget to secure; a small town leaves the money
     * in the manager's hands and almost nothing coming through the turnstiles.
     */
    expect(city.stadiumCapacity).toBeGreaterThan(town.stadiumCapacity);
    expect(city.budget).toBeLessThan(town.budget);
    expect(town.budget).toBe(STARTING_BUDGET);
    expect(city.stadiumCapacity).toBe(CITY_SIZES.LARGE.capacity);
  }, 120000);

  it('gives the club a slug, because a crest is a file named after one', async () => {
    const season = SEASON + 9;
    const first = [await botClub('SL1 A'), await botClub('SL1 B')];
    const second = [await botClub('SL2 A'), await botClub('SL2 B'), await botClub('SL2 C'), await botClub('SL2 D')];
    await seedLeague(COUNTRY, 1, first.map((c) => c.id), season);
    await seedLeague(COUNTRY, 2, second.map((c) => c.id), season);

    const club = await foundClub('manager-found', {
      name: 'Esperança de São João',
      country: COUNTRY,
      city: 'São João',
    });

    /**
     * Only clubs with a slug can carry their own badge (see `uploadCrest`), and a club a manager invented is
     * exactly the one most likely to want one. Every imported club has a slug; a founded one used to have
     * none, so the upload had nowhere to write.
     */
    expect(club.slug).toBeTruthy();
    expect(club.slug, 'acentos e espaços não podem virar nome de arquivo').toMatch(/^[a-z0-9-]+$/);
    expect(club.slug).toContain('esperanca-de-sao-joao');
    expect(club.city).toBe('São João');
  }, 120000);
});

import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { BOT_OWNER_ID, generateDoubleRoundRobinFixtures } from '@tactical-arena/shared';
import { prisma } from './db/prisma.js';
import { createClub } from './services/clubService.js';
import { advanceRound } from './services/leagueService.js';
import { applyPromotionAndRelegation, promotionSlots } from './services/promotionService.js';
import { turnSeason } from './services/seasonService.js';
import { getLeagueWithStandings } from './services/leagueService.js';

/** Dedicated, never-reused country. */
const COUNTRY = 'EST';

const SEASON = 2044;

async function botClub(name: string) {
  return createClub(BOT_OWNER_ID, `${name} ${randomUUID().slice(0, 6)}`, COUNTRY);
}

async function seedLeague(division: number, clubIds: string[], season = SEASON) {
  const id = randomUUID();
  await prisma.league.create({
    data: {
      id,
      countryCode: COUNTRY,
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

/** Plays a seeded league to the end so it has a real table to be promoted and relegated on. */
async function playOut(leagueId: string) {
  for (let round = 0; round < 40; round += 1) {
    const league = await advanceRound(leagueId, BOT_OWNER_ID);
    if (league.status === 'FINISHED') return league;
  }
  throw new Error('a liga não terminou');
}

async function pinClockTo(seasonYear: number) {
  const currentDate = `${seasonYear}-12-20`;
  await prisma.gameState.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', currentDate, seasonYear, phase: 'IN_SEASON' },
    update: { currentDate, seasonYear, phase: 'IN_SEASON' },
  });
}

/**
 * Access and relegation.
 *
 * The game had none. A club stayed in the division it was born into for as long as the save lasted: winning
 * the second division was worth a line in the history screen and nothing else, and "escapar do rebaixamento"
 * was an objective the board could set and never enforce. It is also the thing that has to exist before a
 * manager can found a club at the bottom and have anywhere to go.
 */
describe('Promotion and relegation', () => {
  it('sizes the exchange to the division, never emptying it and never freezing it', () => {
    // A fifth of the smaller division, which is the Brasileirão's own four in twenty.
    expect(promotionSlots(20, 20)).toBe(4);
    expect(promotionSlots(8, 8)).toBe(2);
    /**
     * A two-club tier trades nobody. Exchanging even one of those every year means the champion always goes
     * up and the runner-up always comes down for the life of the save, which is not a pyramid either.
     */
    expect(promotionSlots(2, 2)).toBe(0);
    expect(promotionSlots(3, 3)).toBe(0);
    // A pyramid where nobody moves is not a pyramid, so anything big enough trades at least one.
    expect(promotionSlots(4, 4)).toBeGreaterThan(0);
    expect(promotionSlots(20, 2), 'o degrau pequeno manda no tamanho da troca').toBe(0);
    // And one that turns over completely is not a division.
    expect(promotionSlots(4, 4)).toBeLessThanOrEqual(2);
  });

  it('sends the bottom of the first division down and brings the top of the second up', async () => {
    const first = [await botClub('Primeira A'), await botClub('Primeira B'), await botClub('Primeira C'), await botClub('Primeira D')];
    const second = [await botClub('Segunda A'), await botClub('Segunda B'), await botClub('Segunda C'), await botClub('Segunda D')];

    const upperId = await seedLeague(1, first.map((c) => c.id));
    const lowerId = await seedLeague(2, second.map((c) => c.id));

    const upperTable = await playOut(upperId);
    const lowerTable = await playOut(lowerId);

    const { moves, membershipByLeagueId } = await applyPromotionAndRelegation(SEASON);

    const slots = promotionSlots(4, 4);
    const { standings: upperStandings } = await import('./services/leagueService.js').then((m) =>
      m.getLeagueWithStandings(upperTable.id),
    );
    const { standings: lowerStandings } = await import('./services/leagueService.js').then((m) =>
      m.getLeagueWithStandings(lowerTable.id),
    );

    const wentDown = upperStandings.slice(-slots).map((r) => r.clubId);
    const wentUp = lowerStandings.slice(0, slots).map((r) => r.clubId);

    const nextFirst = membershipByLeagueId.get(upperId)!;
    const nextSecond = membershipByLeagueId.get(lowerId)!;

    for (const clubId of wentUp) expect(nextFirst, 'o campeão da segunda tem de subir').toContain(clubId);
    for (const clubId of wentDown) expect(nextSecond, 'o lanterna da primeira tem de cair').toContain(clubId);
    for (const clubId of wentUp) expect(nextSecond).not.toContain(clubId);
    for (const clubId of wentDown) expect(nextFirst).not.toContain(clubId);

    expect(moves.filter((m) => m.toDivision === 1)).toHaveLength(slots);
    expect(moves.filter((m) => m.toDivision === 2)).toHaveLength(slots);
  }, 300000);

  it('keeps both divisions the same size, and even', async () => {
    const first = [await botClub('Par A'), await botClub('Par B'), await botClub('Par C'), await botClub('Par D')];
    const second = [await botClub('Par E'), await botClub('Par F'), await botClub('Par G'), await botClub('Par H')];

    const upperId = await seedLeague(1, first.map((c) => c.id), SEASON + 1);
    const lowerId = await seedLeague(2, second.map((c) => c.id), SEASON + 1);
    await playOut(upperId);
    await playOut(lowerId);

    const { membershipByLeagueId } = await applyPromotionAndRelegation(SEASON + 1);

    /**
     * The reason equal numbers go each way. A round robin needs an even number of clubs, and a tier left
     * with an odd one never generates a fixture list at all — measured at 57 of 158 leagues on the first
     * full world import, every one of them a country whose clubs would simply never play again.
     */
    for (const leagueId of [upperId, lowerId]) {
      const members = membershipByLeagueId.get(leagueId)!;
      expect(members).toHaveLength(4);
      expect(members.length % 2).toBe(0);
      expect(new Set(members).size, 'ninguém pode acabar em duas divisões').toBe(members.length);
    }
  }, 300000);

  it('leaves a country with a single division exactly as it was', async () => {
    const only = [await botClub('Sozinha A'), await botClub('Sozinha B')];
    const leagueId = await seedLeague(1, only.map((c) => c.id), SEASON + 2);
    await playOut(leagueId);

    const { moves, membershipByLeagueId } = await applyPromotionAndRelegation(SEASON + 2);

    // There is nowhere to go up to and nowhere to fall to. Nobody moves, and nothing is reported.
    expect(moves.filter((m) => only.some((c) => c.id === m.clubId))).toHaveLength(0);
    expect(membershipByLeagueId.get(leagueId)).toEqual(only.map((c) => c.id));
  }, 300000);

  it('actually moves the club: next season the champion of the second division is in the first', async () => {
    const season = SEASON + 3;
    const first = [await botClub('Vira A'), await botClub('Vira B'), await botClub('Vira C'), await botClub('Vira D')];
    const second = [await botClub('Vira E'), await botClub('Vira F'), await botClub('Vira G'), await botClub('Vira H')];

    const upperId = await seedLeague(1, first.map((c) => c.id), season);
    const lowerId = await seedLeague(2, second.map((c) => c.id), season);
    await playOut(upperId);
    await playOut(lowerId);

    const { standings } = await getLeagueWithStandings(lowerId);
    const champion = standings[0].clubId;

    await pinClockTo(season);
    const report = await turnSeason(season + 1);

    /**
     * The whole point, stated as a fact about next season's fixture list. Everything before this is
     * bookkeeping; a club that wins the second division and opens the next year in the second division
     * again has not been promoted, however many rows moved in a map.
     */
    const nextFirst = await prisma.league.findFirst({ where: { countryCode: COUNTRY, division: 1, season: season + 1 } });
    expect(nextFirst, 'a primeira divisão tem de existir na temporada nova').toBeTruthy();
    expect(JSON.parse(nextFirst!.clubIdsJson) as string[]).toContain(champion);

    expect(report.promoted).toBeGreaterThan(0);
    expect(report.relegated).toBe(report.promoted);

    // And the club hears about it.
    const news = await prisma.newsItem.findMany({ where: { clubId: champion } });
    expect(news.some((n) => n.category === 'PROMOTION')).toBe(true);
  }, 300000);

  it('processes 4 divisions ladder with promotion and relegation across all tiers', async () => {
    const season = SEASON + 4;
    const d1 = [await botClub('A1'), await botClub('A2'), await botClub('A3'), await botClub('A4')];
    const d2 = [await botClub('B1'), await botClub('B2'), await botClub('B3'), await botClub('B4')];
    const d3 = [await botClub('C1'), await botClub('C2'), await botClub('C3'), await botClub('C4')];
    const d4 = [await botClub('D1'), await botClub('D2'), await botClub('D3'), await botClub('D4')];

    const l1 = await seedLeague(1, d1.map(c => c.id), season);
    const l2 = await seedLeague(2, d2.map(c => c.id), season);
    const l3 = await seedLeague(3, d3.map(c => c.id), season);
    const l4 = await seedLeague(4, d4.map(c => c.id), season);

    await playOut(l1);
    await playOut(l2);
    await playOut(l3);
    await playOut(l4);

    const { moves, membershipByLeagueId } = await applyPromotionAndRelegation(season);

    expect(moves.some(m => m.fromDivision === 2 && m.toDivision === 1)).toBe(true);
    expect(moves.some(m => m.fromDivision === 3 && m.toDivision === 2)).toBe(true);
    expect(moves.some(m => m.fromDivision === 4 && m.toDivision === 3)).toBe(true);

    expect(membershipByLeagueId.has(l1)).toBe(true);
    expect(membershipByLeagueId.has(l2)).toBe(true);
    expect(membershipByLeagueId.has(l3)).toBe(true);
    expect(membershipByLeagueId.has(l4)).toBe(true);
  }, 300000);
});

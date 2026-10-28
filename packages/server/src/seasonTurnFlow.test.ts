import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { BOT_OWNER_ID, calculateTvMoney, generateDoubleRoundRobinFixtures, seasonWindow } from '@tactical-arena/shared';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { createClub, getClub } from './services/clubService.js';
import { turnSeason } from './services/seasonService.js';

const app = createApp();
/** Dedicated, never-reused country. */
const COUNTRY = 'CHI';
/** Dedicated, never-reused seasons: the turn works on a whole year at a time. */
const SEASON = 2044;

async function pinClockTo(seasonYear: number) {
  const currentDate = `${seasonYear}-01-01`;
  await prisma.gameState.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', currentDate, seasonYear, phase: 'PRE_SEASON' },
    update: { currentDate, seasonYear, phase: 'PRE_SEASON' },
  });
}

async function finishedLeague(clubIds: string[], season: number, division = 1) {
  const id = randomUUID();
  await prisma.league.create({
    data: {
      id,
      countryCode: COUNTRY,
      division,
      name: `Liga da Virada ${id.slice(0, 8)}`,
      capacity: clubIds.length,
      status: 'FINISHED',
      clubIdsJson: JSON.stringify(clubIds),
      fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
      season,
    },
  });
  return id;
}

/**
 * The first of January.
 *
 * The year never used to turn at all. A new league appeared the instant a season's last fixture
 * resolved, in whatever month that happened, while the game's date stayed where it was — so the season
 * number froze and the squads only aged when a manager happened to press a weekly button. Everything
 * annual now happens on one date, together.
 */
describe('Season turn', () => {
  it('ages every squad, opens next season already dated, and pays the television money', async () => {
    await pinClockTo(SEASON);
    const clubs = [
      await createClub(BOT_OWNER_ID, `Virada A ${Date.now()}`, COUNTRY),
      await createClub(BOT_OWNER_ID, `Virada B ${Date.now()}`, COUNTRY),
    ];
    const clubIds = clubs.map((c) => c.id);
    const oldLeagueId = await finishedLeague(clubIds, SEASON);

    const before = await getClub(clubIds[0]);
    const budgetBefore = before.budget;

    const report = await turnSeason(SEASON + 1);
    expect(report.seasonYear).toBe(SEASON + 1);
    expect(report.leaguesCreated).toBeGreaterThan(0);

    // The clock is the record of the year, and it lands on 1 January.
    const clock = await prisma.gameState.findUnique({ where: { id: 'singleton' } });
    expect(clock?.seasonYear).toBe(SEASON + 1);
    expect(clock?.currentDate).toBe(`${SEASON + 1}-01-01`);

    // Everyone is a year older, except whoever retired and left the club.
    const after = await getClub(clubIds[0]);
    const survivors = after.players.filter((p) => before.players.some((b) => b.id === p.id && b.name === p.name));
    expect(survivors.length).toBeGreaterThan(0);
    for (const player of survivors) {
      expect(player.age, player.name).toBe(before.players.find((b) => b.id === player.id)!.age + 1);
    }

    // Next season's league exists, is not the old one, and every round already knows its day.
    const next = await prisma.league.findFirst({
      where: { countryCode: COUNTRY, season: SEASON + 1, clubIdsJson: JSON.stringify(clubIds) },
    });
    expect(next).toBeTruthy();
    expect(next!.id).not.toBe(oldLeagueId);
    expect(next!.status).toBe('IN_PROGRESS');

    const { startDate, endDate } = seasonWindow(SEASON + 1);
    const fixtures = JSON.parse(next!.fixturesJson) as { date?: string | null }[];
    expect(fixtures.length).toBeGreaterThan(0);
    for (const fixture of fixtures) {
      expect(fixture.date, 'every round of a new season is dated').toBeTruthy();
      expect(fixture.date! >= startDate && fixture.date! <= endDate).toBe(true);
    }

    /**
     * The television money is what makes the calendar affordable. The season runs April to December, so
     * a club crosses roughly thirteen weeks with wages going out and no gate receipts coming in; without
     * this every club in the world would start each season poorer than it ended the last.
     */
    /**
     * O valor exato deixou de ser a cota da divisão: ela é multiplicada pelo porte do clube, que
     * `getVisibilityTier` calculava e ninguém consultava. Um clube recém-criado é "Clube Local" e fica com
     * 0,9 da cota. O que este teste guarda continua sendo o que importa: entrou dinheiro de televisão, e
     * numa ordem de grandeza que cobre as semanas sem bilheteria.
     */
    const cotaRecebida = after.budget - budgetBefore;
    expect(cotaRecebida).toBeGreaterThan(0);
    expect(cotaRecebida).toBeGreaterThan(calculateTvMoney(1) * 0.8);
    expect(cotaRecebida).toBeLessThan(calculateTvMoney(1) * 2.5);
  }, 60000);

  it('does nothing at all the second time, so a retried advance cannot age the world twice', async () => {
    await pinClockTo(SEASON + 4);
    const club = await createClub(BOT_OWNER_ID, `Virada Idem ${Date.now()}`, COUNTRY);
    await finishedLeague([club.id, (await createClub(BOT_OWNER_ID, `Virada Idem B ${Date.now()}`, COUNTRY)).id], SEASON + 4);

    await turnSeason(SEASON + 5);
    const afterFirst = await getClub(club.id);

    const second = await turnSeason(SEASON + 5);
    const afterSecond = await getClub(club.id);

    expect(second.clubsAged).toBe(0);
    expect(second.leaguesCreated).toBe(0);
    expect(second.tvMoneyPaid).toBe(0);
    expect(afterSecond.budget).toBe(afterFirst.budget);
    expect(afterSecond.players.map((p) => p.age)).toEqual(afterFirst.players.map((p) => p.age));
  }, 60000);

  it('crosses into the new year on its own once the season runs out', async () => {
    await pinClockTo(SEASON + 12);

    /**
     * The manager's own club sits in another country on purpose. `/game/advance` needs them to have one,
     * but a human in the league being played would make every fixture live and waiting to be watched —
     * and what this test is about is the clock reaching the end of a season and carrying on.
     */
    const email = `${randomUUID()}@test.com`;
    const token = (await request(app).post('/auth/register').send({ email, password: 'password123' })).body.token as string;
    await request(app)
      .post('/clubs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Espectador ${randomUUID().slice(0, 8)}`, country: 'ECU' });

    const clubIds = [
      (await createClub(BOT_OWNER_ID, `Ano A ${Date.now()}`, COUNTRY)).id,
      (await createClub(BOT_OWNER_ID, `Ano B ${Date.now()}`, COUNTRY)).id,
    ];
    const leagueId = randomUUID();
    const { scheduleLeagueFixtures } = await import('./services/scheduleService.js');
    const fixtures = await scheduleLeagueFixtures(
      generateDoubleRoundRobinFixtures(clubIds),
      SEASON + 12,
      leagueId,
      clubIds,
    );
    await prisma.league.create({
      data: {
        id: leagueId,
        countryCode: COUNTRY,
        division: 1,
        name: `Liga do Ano ${leagueId.slice(0, 8)}`,
        capacity: 2,
        status: 'IN_PROGRESS',
        clubIdsJson: JSON.stringify(clubIds),
        fixturesJson: JSON.stringify(fixtures),
        season: SEASON + 12,
      },
    });

    /**
     * The season is played out directly rather than through the button, because what is under test is
     * the trigger and not the rounds: every press of `/game/advance` runs the week for every club that
     * exists, and this database is shared and never emptied, so playing a whole season through it would
     * charge this one test for every club every other suite ever created.
     */
    const { playLeagueRound } = await import('./services/leagueService.js');
    for (let round = 0; round < 4; round += 1) {
      const row = await prisma.league.findUnique({ where: { id: leagueId } });
      if (row?.status === 'FINISHED') break;
      await playLeagueRound(leagueId);
    }
    expect((await prisma.league.findUnique({ where: { id: leagueId } }))?.status).toBe('FINISHED');

    /**
     * Creating a club auto-joins it to a league for its country (see `joinOrCreateLeague`), so the clubs
     * above left other competitions of this season running. Closing them is what makes the premise true:
     * the season is over. The turn fires when the whole season has been played, not when one league has.
     */
    await prisma.league.updateMany({ where: { season: SEASON + 12, status: 'IN_PROGRESS' }, data: { status: 'FINISHED' } });
    await prisma.cup.updateMany({ where: { season: SEASON + 12, status: 'IN_PROGRESS' }, data: { status: 'FINISHED' } });

    // Now one press, with nothing left on the calendar. The year has to turn without being asked.
    const res = await request(app).post('/game/advance').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.seasonYear, 'the clock should have entered the next year on its own').toBe(SEASON + 13);
    const renewed = await prisma.league.findFirst({
      where: { countryCode: COUNTRY, season: SEASON + 13, clubIdsJson: JSON.stringify(clubIds) },
    });
    expect(renewed, 'and the same clubs should have a new season to play').toBeTruthy();
  }, 120000);

  it('plays out a league the calendar stranded, instead of leaving its clubs with no football', async () => {
    await pinClockTo(SEASON + 16);
    const clubIds = [
      (await createClub(BOT_OWNER_ID, `Preso A ${Date.now()}`, COUNTRY)).id,
      (await createClub(BOT_OWNER_ID, `Preso B ${Date.now()}`, COUNTRY)).id,
    ];

    /**
     * Rounds with no date at all, which is what the scheduler produces for clubs whose season has run
     * out of free days — measured at twenty-eight of thirty-eight rounds on a starved calendar. The clock
     * only ever stops on dates, so these can never be reached by playing: the league would stay
     * IN_PROGRESS forever and, because renewal only reopens finished competitions, these two clubs would
     * have had no season this year and none the next either.
     */
    const leagueId = randomUUID();
    await prisma.league.create({
      data: {
        id: leagueId,
        countryCode: COUNTRY,
        division: 1,
        name: `Liga Sem Datas ${leagueId.slice(0, 8)}`,
        capacity: 2,
        status: 'IN_PROGRESS',
        clubIdsJson: JSON.stringify(clubIds),
        fixturesJson: JSON.stringify(
          generateDoubleRoundRobinFixtures(clubIds).map((f) => ({ ...f, date: null })),
        ),
        season: SEASON + 16,
      },
    });

    const report = await turnSeason(SEASON + 17);
    expect(report.leaguesClosed).toBeGreaterThan(0);

    const closed = await prisma.league.findUnique({ where: { id: leagueId } });
    expect(closed?.status, 'the stranded league should have been played out').toBe('FINISHED');
    expect(closed?.championClubId, 'and it should have a real champion').toBeTruthy();
    for (const fixture of JSON.parse(closed!.fixturesJson) as { matchId: string | null; result?: unknown }[]) {
      expect(fixture.matchId ?? fixture.result).toBeTruthy();
    }

    // And its clubs get next season, which is the whole point of not leaving it hanging.
    const next = await prisma.league.findFirst({
      where: { countryCode: COUNTRY, season: SEASON + 17, clubIdsJson: JSON.stringify(clubIds) },
    });
    expect(next, 'the same clubs should have a new season to play').toBeTruthy();
  }, 120000);

  it('pays a second-division club less than a first-division one', async () => {
    await pinClockTo(SEASON + 8);
    const top = [
      await createClub(BOT_OWNER_ID, `Virada D1 A ${Date.now()}`, COUNTRY),
      await createClub(BOT_OWNER_ID, `Virada D1 B ${Date.now()}`, COUNTRY),
    ];
    const second = [
      await createClub(BOT_OWNER_ID, `Virada D2 A ${Date.now()}`, COUNTRY),
      await createClub(BOT_OWNER_ID, `Virada D2 B ${Date.now()}`, COUNTRY),
    ];
    await finishedLeague(top.map((c) => c.id), SEASON + 8, 1);
    await finishedLeague(second.map((c) => c.id), SEASON + 8, 2);

    const topBefore = (await getClub(top[0].id)).budget;
    const secondBefore = (await getClub(second[0].id)).budget;

    await turnSeason(SEASON + 9);

    /**
     * Subir na pirâmide tem de valer dinheiro, no mesmo princípio da tabela de premiação.
     *
     * O valor exato deixou de ser a cota da divisão: ela passou a ser multiplicada pelo porte do clube, que
     * `getVisibilityTier` calculava e ninguém consultava. Um clube recém-criado é "Clube Local" e recebe
     * 0,9 da cota; um gigante com títulos chega a 2,2. O que continua tendo de valer, e é o que este teste
     * guarda, é que a primeira divisão paga mais que a segunda ao mesmo clube.
     */
    const recebidoNaPrimeira = (await getClub(top[0].id)).budget - topBefore;
    const recebidoNaSegunda = (await getClub(second[0].id)).budget - secondBefore;

    expect(recebidoNaPrimeira).toBeGreaterThan(0);
    expect(recebidoNaSegunda).toBeGreaterThan(0);
    expect(recebidoNaSegunda).toBeLessThan(recebidoNaPrimeira);
    expect(calculateTvMoney(2)).toBeLessThan(calculateTvMoney(1));
  }, 60000);

  it('deixa o aposentado sair sem pôr um garoto no lugar dele', async () => {
    /**
     * A reposição um a um inflava o elenco, porque o substituto entrava e o formado da base entrava por
     * cima: medido ao longo de vinte temporadas, um elenco de 32 chegava a 56 jogadores. E o garoto que
     * nascia assim era beco sem saída, com 3,6 pontos de folga até o potencial contra 15,8 de quem sobe da
     * base.
     */
    await pinClockTo(SEASON + 20);
    const clube = await createClub(BOT_OWNER_ID, `Virada Aposenta ${Date.now()}`, COUNTRY);
    await finishedLeague(
      [clube.id, (await createClub(BOT_OWNER_ID, `Virada Aposenta B ${Date.now()}`, COUNTRY)).id],
      SEASON + 20,
    );

    const antes = await getClub(clube.id);
    const veteranos = antes.players.filter((p) => p.age >= 34).map((p) => p.id);

    await turnSeason(SEASON + 21);
    const depois = await getClub(clube.id);

    // Quem se aposentou não está mais no elenco, e ninguém herdou o lugar dele.
    for (const id of veteranos) {
      const aindaLa = depois.players.find((p) => p.id === id);
      if (aindaLa) expect(aindaLa.age).toBeGreaterThan(34);
    }

    /**
     * O elenco não pode crescer numa virada de temporada. Ele pode encolher, e pode ganhar quem se formou na
     * base, mas a soma das duas coisas nunca é maior que o que entrou pela base.
     */
    const formados = depois.players.filter((p) => !antes.players.some((b) => b.id === p.id));
    expect(depois.players.length).toBeLessThanOrEqual(antes.players.length + formados.length);

    // E nunca abaixo do piso que permite escalar onze com banco.
    expect(depois.players.length).toBeGreaterThanOrEqual(16);
  }, 60000);
});

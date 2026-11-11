import { randomUUID } from 'node:crypto';
import {
  calculateClubVisibility,
  calculateInitialMembers,
  type Club,
  CupFixture,
  LeagueFixture,
  calculateTvMoney,
  gameDate,
  generateDoubleRoundRobinFixtures,
  generateFirstRoundFixtures,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getGameState, setSeasonYear } from './gameStateService.js';
import { scheduleCupRound, scheduleLeagueFixtures } from './scheduleService.js';
import { playLeagueRound } from './leagueService.js';
import { playCupRound } from './cupService.js';
import { turnSeasonForAllClubs } from './seasonTurnService.js';
import { applyPromotionAndRelegation } from './promotionService.js';
import { publishDivisionMoves } from './newsService.js';

export interface SeasonTurnReport {
  /** The year the game has just entered. */
  seasonYear: number;
  clubsAged: number;
  /** Competitions of the outgoing season that were still unfinished and had to be played out. */
  leaguesClosed: number;
  cupsClosed: number;
  leaguesCreated: number;
  cupsCreated: number;
  tvMoneyPaid: number;
  /** Clubs that went up a division, and clubs that came down. */
  promoted: number;
  relegated: number;
}

/**
 * How many rounds a competition may be pushed through while being closed out. A twenty-club league is
 * thirty-eight; the margin is there so a bracket that redraws itself cannot spin forever.
 */
const MAX_CLOSING_ROUNDS = 60;

/**
 * Plays out whatever the outgoing season never finished, so nothing is left stranded.
 *
 * A competition can end the year unfinished for two reasons, and neither is the manager's doing. The
 * calendar can run out of free days for a set of clubs, in which case `scheduleLeagueFixtures` leaves
 * those rounds with no date — and an undated round is invisible to the clock, so it can never be played
 * (measured: a starved pool left twenty-eight of a league's thirty-eight rounds undated). Or a round can
 * simply be left behind. Either way the league stays IN_PROGRESS forever, which used to mean it was never
 * renewed either, because renewal only ever looked at finished competitions — so its clubs fell out of
 * football entirely, with no season this year and none the next.
 *
 * Closing them here costs a few seconds once a year (a full league season measures at about ten), and it
 * buys a real table, a real champion and a real top scorer instead of a competition abandoned mid-way.
 */
async function closeOutgoingSeason(season: number): Promise<{ leaguesClosed: number; cupsClosed: number }> {
  let leaguesClosed = 0;
  let cupsClosed = 0;

  /** Fixtures with neither a stored match nor a stored score — the same "still to play" test the league uses. */
  const stillToPlay = async (id: string): Promise<{ status: string; pending: number } | null> => {
    const row = await prisma.league.findUnique({ where: { id }, select: { status: true, fixturesJson: true } });
    if (!row) return null;
    const fixtures = JSON.parse(row.fixturesJson) as { matchId: string | null; result?: unknown }[];
    return { status: row.status, pending: fixtures.filter((f) => f.matchId === null && !f.result).length };
  };

  const leagues = await prisma.league.findMany({ where: { season, status: 'IN_PROGRESS' }, select: { id: true } });
  for (const { id } of leagues) {
    for (let guard = 0; guard < MAX_CLOSING_ROUNDS; guard += 1) {
      const before = await stillToPlay(id);
      if (!before || before.status !== 'IN_PROGRESS') break;

      // Each call plays the lowest round still pending and finalises the league once none are left. An
      // undated round is perfectly playable this way — it was only ever unreachable from the clock.
      await playLeagueRound(id).catch(() => null);

      const after = await stillToPlay(id);
      // No fixture resolved means this competition cannot progress at all; stop rather than spin.
      if (!after || after.pending >= before.pending) break;
    }
    const finished = await prisma.league.findUnique({ where: { id }, select: { status: true } });
    if (finished?.status === 'FINISHED') leaguesClosed += 1;
  }

  const cups = await prisma.cup.findMany({ where: { season, status: 'IN_PROGRESS' }, select: { id: true } });
  for (const { id } of cups) {
    for (let guard = 0; guard < MAX_CLOSING_ROUNDS; guard += 1) {
      const row = await prisma.cup.findUnique({ where: { id }, select: { status: true } });
      if (!row || row.status !== 'IN_PROGRESS') break;
      const played = await playCupRound(id).catch(() => null);
      if (!played) break;
    }
    const finished = await prisma.cup.findUnique({ where: { id }, select: { status: true } });
    if (finished?.status === 'FINISHED') cupsClosed += 1;
  }

  return { leaguesClosed, cupsClosed };
}

/**
 * Next season's leagues, for every cohort that finished one.
 *
 * Renewal used to live at the end of `finalizeSeason`, which fused two unrelated things: closing a
 * competition (champion, top scorer, prize money) and opening the next one. That fusion is the structural
 * cause of the bug where the year never turned — the new league appeared the moment the last fixture
 * resolved, in whatever month that happened, while the game's notion of "this season" was derived from
 * whichever league row a screen happened to pick up. A season now begins when the year begins.
 */
async function renewLeagues(
  previousSeason: number,
  newSeason: number,
  membershipByLeagueId: Map<string, string[]>,
): Promise<number> {
  const finished = await prisma.league.findMany({ where: { season: previousSeason, status: 'FINISHED' } });
  let created = 0;

  for (const league of finished) {
    /**
     * Who contests this division next season, which is not the same thing as who contested it last season:
     * the bottom of the table has gone down and the top of the tier below has come up (see
     * `applyPromotionAndRelegation`). The division persists, its members do not.
     */
    const clubIds = membershipByLeagueId.get(league.id) ?? (JSON.parse(league.clubIdsJson) as string[]);
    const clubIdsJson = JSON.stringify(clubIds);
    /**
     * Keyed on the club list as well as the competition. Country and division alone would be enough now
     * that a season holds one league per division (see `joinOrCreateLeague`), but a save made before that
     * rule still carries several, and matching loosely there would mistake another cohort's league for
     * this one's renewal and leave these clubs with no season at all.
     */
    const already = await prisma.league.findFirst({
      where: {
        countryCode: league.countryCode,
        division: league.division,
        season: newSeason,
        clubIdsJson,
      },
    });
    if (already) continue;
    if (clubIds.length < 2 || clubIds.length % 2 !== 0) continue;

    const id = randomUUID();
    const fixtures: LeagueFixture[] = await scheduleLeagueFixtures(
      generateDoubleRoundRobinFixtures(clubIds, randomUUID()),
      newSeason,
      id,
      clubIds,
    );
    await prisma.league.create({
      data: {
        id,
        countryCode: league.countryCode,
        division: league.division,
        name: league.name,
        capacity: league.capacity,
        status: 'IN_PROGRESS',
        clubIdsJson,
        fixturesJson: JSON.stringify(fixtures),
        season: newSeason,
      },
    });
    created += 1;
  }

  return created;
}

/** The same for cups, whose renewal used to sit at the end of `advanceCupRound` for the same reasons. */
async function renewCups(previousSeason: number, newSeason: number): Promise<number> {
  const finished = await prisma.cup.findMany({ where: { season: previousSeason, status: 'FINISHED' } });
  let created = 0;

  for (const cup of finished) {
    const clubIds = JSON.parse(cup.clubIdsJson) as string[];
    const already = await prisma.cup.findFirst({
      where: { name: cup.name, countryCode: cup.countryCode, season: newSeason },
    });
    if (already) continue;
    if (clubIds.length < 2) continue;

    let fixtures: CupFixture[];
    try {
      fixtures = generateFirstRoundFixtures(clubIds);
    } catch {
      continue; // a bracket that cannot be drawn is skipped rather than aborting the whole turn
    }
    // Dated at creation, unlike the old renewal, which produced a bracket with no days attached and so
    // was invisible to the clock.
    const dated = await scheduleCupRound(fixtures, newSeason, 1, clubIds);
    await prisma.cup.create({
      data: {
        id: randomUUID(),
        name: cup.name,
        countryCode: cup.countryCode,
        clubIdsJson: cup.clubIdsJson,
        fixturesJson: JSON.stringify(dated),
        status: 'IN_PROGRESS',
        season: newSeason,
      },
    });
    created += 1;
  }

  return created;
}

/**
 * The annual television money, paid to every club with a league place in the new season.
 *
 * Paid at the turn rather than weekly because that is where the hole is: the season runs April to
 * December, so a club crosses roughly thirteen weeks of wages with no gate receipts (see
 * `calculateTvMoney`). A club in no league gets nothing, which is the same as saying there is no
 * television deal to pay it.
 */
async function payTvMoney(season: number): Promise<number> {
  const leagues = await prisma.league.findMany({ where: { season }, select: { clubIdsJson: true, division: true } });

  /**
   * A cota base sai da divisão; o porte do clube multiplica-a.
   *
   * `getVisibilityTier` já devolvia um `tvRevenueMultiplier` de 0,9 a 2,2, calculado, exposto e mostrado na
   * tela — e ninguém o consultava. Um Flamengo e um Criciúma da mesma divisão recebiam exatamente a mesma
   * cota, que é o contrário do que qualquer acordo de transmissão faz. Encher o estádio, ganhar título e
   * juntar torcida passam a valer também aqui, e não só no patrocínio.
   */
  const divisionByClubId = new Map<string, number>();
  for (const league of leagues) {
    for (const clubId of JSON.parse(league.clubIdsJson) as string[]) {
      // Clube em duas ligas ao mesmo tempo (o que os dados permitem) conta pela melhor delas.
      const atual = divisionByClubId.get(clubId);
      divisionByClubId.set(clubId, atual === undefined ? league.division : Math.min(atual, league.division));
    }
  }

  const records = await prisma.club.findMany({
    where: { id: { in: [...divisionByClubId.keys()] } },
    select: { id: true, playersJson: true, stadiumCapacity: true, titlesWon: true, membersCount: true },
  });

  const amountByClubId = new Map<string, number>();
  for (const record of records) {
    const division = divisionByClubId.get(record.id) ?? 1;
    const clube = {
      players: JSON.parse(record.playersJson),
      stadiumCapacity: record.stadiumCapacity,
      titlesWon: record.titlesWon,
    } as Club;
    const membros = record.membersCount ?? calculateInitialMembers(clube, division);
    const porte = calculateClubVisibility(clube, division, record.titlesWon, membros);

    amountByClubId.set(record.id, Math.round(calculateTvMoney(division) * porte.tvRevenueMultiplier));
  }

  let paid = 0;
  for (const [clubId, amount] of amountByClubId) {
    const updated = await prisma.club
      .update({ where: { id: clubId }, data: { budget: { increment: amount } } })
      .catch(() => null);
    if (updated) paid += amount;
  }
  return paid;
}

/**
 * The first of January.
 *
 * Everything that happens once a year and had nowhere to happen: squads age, veterans retire and are
 * replaced, prospects who turned twenty graduate, last season's competitions are reopened for the new
 * one with their dates already set, and the television money lands to carry clubs through a pre-season
 * with no gate receipts.
 *
 * Safe to call twice. The clock is the record of whether the year has turned, so a turn into a year the
 * game has already entered does nothing — which matters because an advance that fails halfway must not
 * age every squad in the world a second time.
 */
export async function turnSeason(newYear: number): Promise<SeasonTurnReport> {
  const state = await getGameState();
  if (state.seasonYear >= newYear) {
    return {
      seasonYear: state.seasonYear,
      clubsAged: 0,
      leaguesClosed: 0,
      cupsClosed: 0,
      leaguesCreated: 0,
      cupsCreated: 0,
      tvMoneyPaid: 0,
      promoted: 0,
      relegated: 0,
    };
  }

  const previousSeason = newYear - 1;

  /**
   * The outgoing season is finished before the new one is opened.
   *
   * It has to happen first, and in the old year: renewal only reopens competitions that ended, so
   * anything still hanging would take its clubs out of football altogether rather than merely ending
   * their season early.
   */
  const { leaguesClosed, cupsClosed } = await closeOutgoingSeason(previousSeason);

  /**
   * The clock moves first, and to 1 January.
   *
   * Everything below reads the game's year to decide what it is doing — `scheduleLeagueFixtures` builds
   * its calendar from the season, `createCup` stamps the season it is told — so leaving the clock in the
   * old year while creating the new year's competitions would date them all in a season that has
   * already been played.
   */
  await setSeasonYear(newYear, gameDate(newYear, 1, 1));

  const { clubsProcessed } = await turnSeasonForAllClubs(newYear);

  /**
   * Access and relegation, before anything is rebuilt.
   *
   * It has to sit between closing the old season and opening the new one: the tables it reads only exist
   * once every competition has finished, and the membership it produces is what the new season is built
   * from. Running it after renewal would leave every club exactly where it started for another year.
   */
  const { moves, membershipByLeagueId } = await applyPromotionAndRelegation(previousSeason);
  await publishDivisionMoves(moves).catch((err) => console.error('notícia de acesso e rebaixamento falhou:', err));

  const leaguesCreated = await renewLeagues(previousSeason, newYear, membershipByLeagueId);
  const cupsCreated = await renewCups(previousSeason, newYear);
  const tvMoneyPaid = await payTvMoney(newYear);

  return {
    seasonYear: newYear,
    clubsAged: clubsProcessed,
    leaguesClosed,
    cupsClosed,
    leaguesCreated,
    cupsCreated,
    tvMoneyPaid,
    promoted: moves.filter((m) => m.toDivision < m.fromDivision).length,
    relegated: moves.filter((m) => m.toDivision > m.fromDivision).length,
  };
}

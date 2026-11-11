import { randomUUID } from 'node:crypto';
import {
  applyTitleMembershipBoost,
  calculateInitialMembers,
  membershipCeiling,
  leagueName,
  BOT_OWNER_ID,
  COUNTRIES,
  Club,
  LEAGUE_CAPACITY,
  League,
  LeagueFixture,
  Player,
  StandingRow,
  TacticPreset,
  Tactic,
  autoFillLineup,
  botTactic,
  tacticalIdentityOf,
  calculateAttendanceRate,
  simulateBackgroundResult,
  computeStandings,
  generateDoubleRoundRobinFixtures,
  resolveLineupPlayers,
  validateSubstitutesAndPlan,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub, toDomain as toDomainClub } from './clubService.js';
import { pickBackgroundAssists, pickBackgroundScorers, type ScorerCandidate } from './squadRating.js';
import { createLiveMatch, simulateFixtureResultOnly, tickLiveMatchSystem } from './matchService.js';
import { distributePrizeMoney } from './financeService.js';
import { getDefaultPreset, getDefaultPresets } from './tacticPresetService.js';
import { computeTopScorer, computeTopScorersList, computeTopAssistantsList, TopScorerResult, TopAssistantResult } from './topScorerService.js';
import { generateTitleNews } from './newsService.js';
import { scheduleLeagueFixtures } from './scheduleService.js';
import { getGameState } from './gameStateService.js';

export class LeagueError extends Error {}

/**
 * The league, round number and every fixture in that round for `matchId` — what the live-match banner and
 * its round ticker are built from. Read once when the screen opens, not on every tick of the clock.
 */
export async function findLeagueRoundContext(
  matchId: string,
): Promise<{ league: League; round: number; fixtures: LeagueFixture[] } | null> {
  /**
   * Narrowed twice, because the obvious version does not survive a few seasons.
   *
   * It used to read every league ever played and parse each one's whole fixture list to find one match
   * id. That was fine at 56 fixtures a league and stopped being fine at 380: measured at 52 ms across 204
   * leagues, and — worse than slow — *unbounded*, since leagues accumulate every season and none is ever
   * scanned less. Ten seasons of a full world would have it reading tens of megabytes to answer one
   * question about one match.
   *
   * A live match is always in a competition that is still running, so finished seasons are not candidates
   * at all. And the search for the id itself belongs in SQLite, which can scan the text where it already
   * lives instead of shipping every calendar to Node to be parsed. Ids are uuids, so a substring match
   * cannot collide with anything.
   */
  const candidates = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "League"
    WHERE "status" = 'IN_PROGRESS' AND instr("fixturesJson", ${matchId}) > 0
    LIMIT 1
  `;
  if (candidates.length === 0) return null;

  const record = await prisma.league.findUnique({ where: { id: candidates[0].id } });
  if (!record) return null;

  const league = toDomain(record);
  const fixture = league.fixtures.find((f) => f.matchId === matchId);
  if (!fixture) return null;
  return { league, round: fixture.round, fixtures: league.fixtures.filter((f) => f.round === fixture.round) };
}

/**
 * The real world name of a country's division.
 *
 * The table lives in `shared/competitionNames` now, because the offline build cannot reach this file and was
 * writing the country code onto the screen instead: "Série A - BRA" and "Copa Nacional (BRA)". Kept exported
 * here so the callers in this package do not all have to change, and so both platforms name a competition
 * the same way.
 */
export function getOfficialLeagueName(countryCode: string, division: number): string {
  return leagueName(countryCode, division);
}

/**
 * How many divisions below the one asked for a club will look for a place.
 *
 * Counted from the requested division rather than from the top of the pyramid: divisions are just
 * numbers here, and the team editor creates clubs in whatever division it likes. Anchoring this to an
 * absolute floor left anything numbered past it with nowhere to go at all.
 */
const OVERFLOW_DEPTH = 3;

/**
 * Puts a club into its country's league for that division, or the first division below with room.
 *
 * A country now has exactly one league per division per season, which it did not before: this used to
 * take the oldest OPEN league and open a brand new one whenever that filled, so Brazil ran three leagues
 * all called "Brasileirão Série A" in the same season, competing with each other for every screen that
 * asked "which league is this club in?". Every renewal since has had to be keyed on the club list rather
 * than on the competition, precisely because the competition was not identifiable.
 *
 * With twenty places and a real club list, a division fills up for real, so overflow needs somewhere to
 * go: it cascades down the pyramid. A club that finds every division full or already under way gets no
 * league at all, and `null` says so — being unable to place a club is not a reason to refuse to create it.
 */
export async function joinOrCreateLeague(clubId: string, countryCode: string, division: number): Promise<League | null> {
  // From the game clock, not the wall clock: leagues and cups must agree on which season they belong to,
  // and once the in-game year moves past the real one they would otherwise diverge.
  const season = (await getGameState()).seasonYear;

  for (let tier = division; tier <= division + OVERFLOW_DEPTH; tier += 1) {
    const canonical = await prisma.league.findFirst({ where: { countryCode, division: tier, season } });

    if (!canonical) {
      const leagueId = randomUUID();
      await prisma.league.create({
        data: {
          id: leagueId,
          countryCode,
          division: tier,
          name: getOfficialLeagueName(countryCode, tier),
          capacity: LEAGUE_CAPACITY,
          status: 'OPEN',
          clubIdsJson: JSON.stringify([clubId]),
          fixturesJson: JSON.stringify([]),
          season,
        },
      });
      return getLeague(leagueId);
    }

    const clubIds = JSON.parse(canonical.clubIdsJson) as string[];
    if (clubIds.includes(clubId)) return toDomain(canonical);
    // A division already playing has no room for a latecomer, and neither has a full one.
    if (canonical.status !== 'OPEN' || clubIds.length >= LEAGUE_CAPACITY) continue;

    const withClub = [...clubIds, clubId];
    await prisma.league.update({ where: { id: canonical.id }, data: { clubIdsJson: JSON.stringify(withClub) } });

    // Only auto-start on an even count: the round-robin generator requires it. An odd overshoot just
    // leaves the league OPEN a little longer (or force-started) instead of crashing club creation.
    if (withClub.length >= LEAGUE_CAPACITY && withClub.length % 2 === 0) {
      return startLeague(canonical.id, withClub);
    }
    return getLeague(canonical.id);
  }

  return null;
}

/** Generates the schedule even though the league hasn't reached capacity. Needs at least 2 (even) clubs. */
export async function forceStartLeague(leagueId: string, requestingUserId: string): Promise<League> {
  const league = await getLeague(leagueId);
  if (league.status !== 'OPEN') {
    throw new LeagueError('Esta liga já foi iniciada');
  }
  if (league.clubIds.length < 2) {
    throw new LeagueError('É necessário pelo menos 2 clubes para iniciar a liga');
  }
  await assertRequesterHasClubInLeague(league, requestingUserId);

  return startLeague(leagueId, league.clubIds);
}

export async function getLeague(leagueId: string): Promise<League> {
  const record = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!record) {
    throw new LeagueError(`Liga ${leagueId} não encontrada`);
  }
  return toDomain(record);
}

export async function listLeagues(countryCode?: string, division?: number): Promise<League[]> {
  const where = {
    ...(countryCode ? { countryCode } : {}),
    ...(division !== undefined ? { division } : {}),
  };
  const records = await prisma.league.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { createdAt: 'asc' },
  });
  return records.map(toDomain);
}

/**
 * The league a club is actually playing in right now.
 *
 * Every caller used to do `listLeagues().find((l) => l.clubIds.includes(clubId))`, and that is wrong the
 * moment a season ends: `listLeagues` returns every row ordered `createdAt asc` with no status filter, so
 * `find` keeps returning the *oldest FINISHED* league forever. The season number on screen froze at
 * whatever it was when the save was created, and ClubHome's "ir para a partida" kept calling
 * `advanceLeagueRound` on a finished league, where the server rightly refuses.
 *
 * `matchService.getNextActionableMatch` already filtered on `IN_PROGRESS`, so the two halves of the app
 * disagreed about which league the club was in. This is the one answer both should use.
 *
 * Falls back to the most recent FINISHED league so a club between seasons still has something to show
 * (final table, champion) rather than rendering as if it had no competition at all.
 */
export async function getActiveLeagueForClub(clubId: string): Promise<League | null> {
  const records = await prisma.league.findMany({ orderBy: [{ season: 'desc' }, { createdAt: 'desc' }] });
  const mine = records.map(toDomain).filter((l) => l.clubIds.includes(clubId));
  return mine.find((l) => l.status === 'IN_PROGRESS') ?? mine.find((l) => l.status === 'OPEN') ?? mine[0] ?? null;
}

export async function getLeagueWithStandings(leagueId: string): Promise<{ league: League; standings: StandingRow[] }> {
  const league = await getLeague(leagueId);
  const matchIds = league.fixtures.map((f) => f.matchId).filter((id): id is string => !!id);

  const results: { homeClubId: string; awayClubId: string; homeGoals: number; awayGoals: number }[] = [];
  if (matchIds.length > 0) {
    const matches = await prisma.match.findMany({ where: { id: { in: matchIds } } });
    for (const m of matches) {
      if (!m.resultJson) continue;
      const result = JSON.parse(m.resultJson);
      results.push({ homeClubId: m.homeClubId, awayClubId: m.awayClubId, homeGoals: result.homeGoals, awayGoals: result.awayGoals });
    }
  }
  // Fixtures played for their result only keep the score on themselves rather than in a match row, and
  // they count towards the table exactly the same.
  for (const fixture of league.fixtures) {
    if (fixture.matchId || !fixture.result) continue;
    results.push({
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      homeGoals: fixture.result.homeGoals,
      awayGoals: fixture.result.awayGoals,
    });
  }

  return { league, standings: computeStandings(league.clubIds, results) };
}

export async function getLeagueStats(
  leagueId: string,
): Promise<{ topScorers: TopScorerResult[]; topAssistants: TopAssistantResult[] }> {
  const league = await getLeague(leagueId);
  const matchIds = league.fixtures.map((f) => f.matchId).filter((id): id is string => !!id);
  const fixtureScorers = league.fixtures.flatMap((f) => (f.matchId ? [] : (f.result?.scorers ?? [])));
  const fixtureAssistants = league.fixtures.flatMap((f) => (f.matchId ? [] : (f.result?.assists ?? [])));
  const [topScorers, topAssistants] = await Promise.all([
    computeTopScorersList(matchIds, league.clubIds, 10, fixtureScorers),
    computeTopAssistantsList(matchIds, league.clubIds, 10, fixtureAssistants),
  ]);
  return { topScorers, topAssistants };
}

/**
 * Picks the tactic a club plays a league fixture with, in priority order:
 * 1. The manager's own chosen lineup (`pendingRoundTactic`). It **stays set** until they change or cancel
 *    it: it used to be wiped the moment the round was played, so a manager who had picked their side found
 *    it silently reverted to auto-fill the following week and had to redo it every single round.
 * 2. Its marked-default `TacticPreset`, if it has one and the lineup still resolves (players may have
 *    been sold/retired/suspended since it was saved).
 * 3. Auto-fill from the current (non-suspended) squad — always the case for still-bot-owned clubs,
 *    since only a human can set either of the above.
 */
async function resolveLeagueTactic(club: Club, leagueId: string, knownPresets?: Map<string, TacticPreset>): Promise<Tactic> {
  if (club.pendingRoundTactic) {
    try {
      resolveLineupPlayers(club, club.pendingRoundTactic, leagueId);
      validateSubstitutesAndPlan(club, club.pendingRoundTactic, leagueId);
      return club.pendingRoundTactic;
    } catch {
      // No longer fields a valid XI (a player was sold/retired/suspended) — fall back for this fixture, but
      // leave it saved: the squad may well be whole again next week, and silently binning the manager's side
      // over a one-week suspension is exactly the behaviour being fixed here.
    }
  }

  const preset = knownPresets ? knownPresets.get(club.id) ?? null : await getDefaultPreset(club.id);
  if (preset) {
    const tactic: Tactic = {
      clubId: club.id,
      formation: preset.formation,
      mentality: preset.mentality,
      attackStyle: preset.attackStyle,
      markingStyle: preset.markingStyle,
      attackApproach: preset.attackApproach,
      pressing: preset.pressing,
      lineup: preset.lineup,
      substitutes: preset.substitutes,
      plannedSubstitutions: [],
    };
    try {
      resolveLineupPlayers(club, tactic, leagueId);
      return tactic;
    } catch {
      // Preset no longer fields a valid XI (a player was sold/retired/suspended) — fall through to auto-fill.
    }
  }
  // See resolveCupTactic: computer-run clubs carry their own standing style, human clubs stay neutral.
  if (club.ownerId === BOT_OWNER_ID) {
    const identity = tacticalIdentityOf(club);
    const autoFilled = autoFillLineup(club, leagueId, identity.formation);
    return botTactic(club, autoFilled);
  }
  return autoFillLineup(club, leagueId, '4-4-2');
}

/** True if any fixture's match (typically a manager-watched one from createLiveMatch) hasn't finished yet. */
async function anyFixtureStillLive(fixtures: LeagueFixture[]): Promise<boolean> {
  const matchIds = fixtures.map((f) => f.matchId).filter((id): id is string => !!id);
  if (matchIds.length === 0) return false;
  const liveCount = await prisma.match.count({ where: { id: { in: matchIds }, status: 'LIVE' } });
  return liveCount > 0;
}

/**
 * Resolves every fixture in the first round that still has pending matches: each club plays whatever
 * `resolveLeagueTactic` picks for it (its own next-round tactic, its default preset, or an auto-filled
 * lineup, in that priority order) — then it's simulated and persisted through the same engine and
 * suspension pipeline as an ad-hoc PvP challenge. Marks the league FINISHED once no fixture is left pending.
 */
export async function advanceRound(leagueId: string, requestingUserId: string): Promise<League> {
  const league = await getLeague(leagueId);
  if (league.status !== 'IN_PROGRESS') {
    throw new LeagueError('A liga precisa estar em andamento para avançar rodadas');
  }
  await assertRequesterHasClubInLeague(league, requestingUserId);
  return playLeagueRound(leagueId);
}

/**
 * The round itself, with no question of who asked for it.
 *
 * Split out of `advanceRound` because the two questions it used to answer at once have come apart. "May
 * this user do this?" is still membership in the league — that is what the route means. "Which round is
 * due?" used to always be the lowest pending one, and now the calendar answers it: the time service knows
 * today's date and asks for the round scheduled on it, which may not be the lowest pending round of every
 * competition it touches. The time service also plays leagues the manager has no club in, so it does its
 * own authorization once against the save and comes in here.
 */
export async function playLeagueRound(leagueId: string, requestedRound?: number): Promise<League> {
  const league = await getLeague(leagueId);
  if (league.status !== 'IN_PROGRESS') {
    throw new LeagueError('A liga precisa estar em andamento para avançar rodadas');
  }

  /**
   * A fixture is still to be played only if it has neither a stored match nor a stored score.
   *
   * `matchId === null` alone used to mean the same thing, and stopped meaning it the moment bot-only
   * fixtures started being resolved for their result without a match row: those keep a null `matchId`
   * forever, so a round already played would come back as the lowest pending round and be replayed on
   * every advance, on and on.
   */
  const unplayed = (f: LeagueFixture) => f.matchId === null && !f.result;

  const pendingRounds = league.fixtures.filter(unplayed).map((f) => f.round);
  if (pendingRounds.length === 0) {
    // Every fixture has a match — auto-complete any remaining abandoned live match so the season can finalize.
    for (const fixture of league.fixtures) {
      if (fixture.matchId) {
        await tickLiveMatchSystem(fixture.matchId).catch(() => null);
      }
    }
    if (await anyFixtureStillLive(league.fixtures)) {
      return league;
    }
    return finalizeSeason(league, league.fixtures);
  }

  const round = requestedRound ?? Math.min(...pendingRounds);
  // Asking for a round that has already been played is not an error — two competitions can land on the
  // same date, and the time service plays whatever the calendar lists for today without first checking
  // whether an earlier advance already covered it.
  if (!pendingRounds.includes(round)) return league;

  const updatedFixtures = [...league.fixtures];

  /**
   * How full each ground will be this round — the venue effect's input (see homeAdvantage.ts). Read once
   * here from the table as it stands before the round, so every fixture in the round is judged by the same
   * standings, and so the crowd is not re-derived on every clock tick of every live match.
   *
   * The table is what makes this worth doing: a club climbing the league fills its ground and gets a louder
   * mando for it, while one sliding toward the bottom plays in front of empty seats. Form feeding the crowd
   * and the crowd feeding the team is the loop the flat 0.6 occupancy never had.
   */
  const { standings } = await getLeagueWithStandings(leagueId);
  const positionOf = new Map(standings.map((row, index) => [row.clubId, index + 1]));
  const matchesPlayed = standings.reduce((most, row) => Math.max(most, row.played), 0);
  const crowdFor = (club: Club): number =>
    calculateAttendanceRate({
      stadiumCapacity: club.stadiumCapacity,
      leaguePosition: positionOf.get(club.id) ?? null,
      totalClubsInLeague: league.clubIds.length,
      titlesWon: club.titlesWon,
      matchesPlayed,
    });

  // A human watching their own fixture expects the *whole round*'s scoreboard to tick alongside it (see
  // the live-match round ticker) — so if any fixture this round involves a real manager, every fixture in
  // the round is created live and left paced together, bots included. Only when nobody in the whole round
  // is human does it make sense to just resolve everything instantly — nobody's there to watch it tick.
  const roundFixtures = updatedFixtures.filter((f) => f.round === round && unplayed(f));

  /**
   * Every club of the round, read once.
   *
   * This used to load each club from the database one at a time — twice over, in fact, since working out
   * whether a human was involved fetched the whole 42 KB row just to look at `ownerId`. A background
   * matchday across a world of leagues is thousands of those, and measurement put the cost of a
   * background fixture at 27.7 ms against 0.62 ms of actual simulation: virtually all of it was the
   * round trips, not the football.
   */
  const roundClubIds = [...new Set(roundFixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))];

  /**
   * Whether a real manager has anything to do with this round, decided before a single roster is read.
   *
   * This is the fork the whole file turns on. A round the manager is playing in is worth every millisecond
   * of the full engine. A round in a league on the other side of the world is not, and there are hundreds
   * of those on the same Sunday.
   */
  const roundOwners = await prisma.club.findMany({
    where: { id: { in: roundClubIds } },
    select: { id: true, ownerId: true },
  });
  const roundHasHuman = roundOwners.some((c) => c.ownerId !== BOT_OWNER_ID);

  /**
   * Rosters are only loaded for a round somebody is going to watch.
   *
   * A background round runs on the ratings kept beside each club (see squadRating.ts), so it never opens
   * a squad at all — which is where its cost was: the simulation is 0.62 ms, the two 42 KB rosters either
   * side of it were the rest of the 9.2 ms.
   */
  const roundClubs = new Map<string, Club>(
    roundHasHuman
      ? (await prisma.club.findMany({ where: { id: { in: roundClubIds } } })).map((record) => [
          record.id,
          toDomainClub(record),
        ])
      : [],
  );
  const clubOf = async (clubId: string): Promise<Club> => roundClubs.get(clubId) ?? (await getClub(clubId));

  /** Squads changed by the fixtures below, written once at the end of the round. */
  const pendingRosters: { clubId: string; players: Player[] }[] = [];

  // The round's standing lineups, in one query rather than one per team per fixture.
  const roundPresets = await getDefaultPresets(roundClubIds);

  /**
   * Close out anything still running from an earlier round before starting a new one.
   *
   * A manager who walks away mid-match leaves it LIVE forever, and `getNextActionableMatch` hands back the
   * *oldest* unfinished match — so "ir para a partida" kept reopening that abandoned one, at whatever
   * minute it was left at, instead of the round the manager had just started. Sometimes at the 85th.
   *
   * Asking to advance the round is the manager saying they are done with the last one, so this is the safe
   * moment to resolve it: it never fires while they are actually watching, only when they move on. The
   * previous version only did this for fixtures *in the round being created*, which is precisely the set
   * that cannot be stale.
   */
  for (const fixture of updatedFixtures) {
    if (fixture.round < round && fixture.matchId) {
      await tickLiveMatchSystem(fixture.matchId).catch(() => null);
    }
  }

  /**
   * A round nobody is watching, resolved from ratings alone.
   *
   * The rule is the same football (see `simulateBackgroundResult`, fitted against the engine fixture by
   * fixture), reached without opening a squad: two clubs, six numbers, a score. What it gives up is the
   * narrative — no timeline, no bookings, no goalscorers — which is what nobody was ever going to read.
   *
   * The minutes are not thrown away, though. Each club's tally of background matches is counted here and
   * cashed in as development at the season turn, so a world playing its own leagues keeps improving
   * instead of standing still while the manager's squad pulls away.
   */
  if (!roundHasHuman && roundFixtures.length > 0) {
    const ratings = new Map(
      (
        await prisma.club.findMany({
          where: { id: { in: roundClubIds } },
          select: {
            id: true,
            ratingAttack: true,
            ratingDefense: true,
            ratingGoalkeeping: true,
            stadiumCapacity: true,
            titlesWon: true,
            scorerPoolJson: true,
          },
        })
      ).map((c) => [c.id, c]),
    );

    for (let i = 0; i < updatedFixtures.length; i += 1) {
      const fixture = updatedFixtures[i];
      if (fixture.round !== round || !unplayed(fixture)) continue;
      const home = ratings.get(fixture.homeClubId);
      const away = ratings.get(fixture.awayClubId);
      if (!home || !away) continue;

      const crowd = calculateAttendanceRate({
        stadiumCapacity: home.stadiumCapacity,
        leaguePosition: positionOf.get(home.id) ?? null,
        totalClubsInLeague: league.clubIds.length,
        titlesWon: home.titlesWon,
        matchesPlayed,
      });

      const outcome = simulateBackgroundResult(
        { attack: home.ratingAttack, defense: home.ratingDefense, goalkeeping: home.ratingGoalkeeping },
        { attack: away.ratingAttack, defense: away.ratingDefense, goalkeeping: away.ratingGoalkeeping },
        `${leagueId}-${round}-${fixture.homeClubId}-${fixture.awayClubId}`,
        crowd,
      );

      /**
       * The goals get names, so a league nobody watches still has a top scorer.
       *
       * Drawn from the dozen finishers kept beside each club (see `computeScorerPool`), weighted the way
       * the engine weights them, and seeded from the fixture so the same round always credits the same
       * players. Assists follow the same idea on the passing weights, and only on the two goals in three
       * that real football credits to somebody.
       */
      const credit = (clubId: string, poolJson: string, goals: number) => {
        const pool = JSON.parse(poolJson) as ScorerCandidate[];
        const seed = `${leagueId}-${round}-${clubId}`;
        const scorers = pickBackgroundScorers(pool, goals, seed);
        const assists = pickBackgroundAssists(pool, scorers, seed);
        const named = (list: ScorerCandidate[]) => list.map((p) => ({ playerId: p.playerId, clubId, name: p.name }));
        return { scorers: named(scorers), assists: named(assists) };
      };
      const homeCredit = credit(home.id, home.scorerPoolJson, outcome.homeGoals);
      const awayCredit = credit(away.id, away.scorerPoolJson, outcome.awayGoals);

      updatedFixtures[i] = {
        ...fixture,
        matchId: null,
        result: {
          homeGoals: outcome.homeGoals,
          awayGoals: outcome.awayGoals,
          scorers: [...homeCredit.scorers, ...awayCredit.scorers],
          assists: [...homeCredit.assists, ...awayCredit.assists],
        },
      };
    }

    // One statement for the whole round, and never a roster.
    await prisma.club.updateMany({
      where: { id: { in: roundClubIds } },
      data: { pendingMatchesPlayed: { increment: 1 } },
    });
  }

  for (let i = 0; i < updatedFixtures.length; i++) {
    const fixture = updatedFixtures[i];
    if (fixture.round !== round) continue;
    if (fixture.matchId !== null) {
      await tickLiveMatchSystem(fixture.matchId).catch(() => null);
      continue;
    }
    if (fixture.result) continue; // already resolved for its result only

    const homeClub = await clubOf(fixture.homeClubId);
    const awayClub = await clubOf(fixture.awayClubId);
    const homeTactic = await resolveLeagueTactic(homeClub, leagueId, roundPresets);
    const awayTactic = await resolveLeagueTactic(awayClub, leagueId, roundPresets);

    if (!roundHasHuman) {
      /**
       * Nobody is watching this one, so it is played for its result and nothing else.
       *
       * Same engine, same tactics, same crowd — only the bookkeeping is lighter: no stored match row, no
       * minute-by-minute timeline. A stored match costs about 5.7 KB, which is fine for the fixtures a
       * manager actually opens and impossible across a world of leagues, where one season of commentary
       * nobody reads would add tens of megabytes to the save.
       */
      const outcome = await simulateFixtureResultOnly(
        homeClub,
        awayClub,
        homeTactic,
        awayTactic,
        { type: 'league', id: leagueId },
        crowdFor(homeClub),
        // Saved with the rest of the round, below, rather than two round trips per fixture.
        false,
      );
      pendingRosters.push(
        { clubId: homeClub.id, players: outcome.rosters.homePlayers },
        { clubId: awayClub.id, players: outcome.rosters.awayPlayers },
      );
      updatedFixtures[i] = {
        ...fixture,
        matchId: null,
        result: {
          homeGoals: outcome.homeGoals,
          awayGoals: outcome.awayGoals,
          scorers: outcome.scorers,
          assists: outcome.assists,
        },
      };
      continue;
    }

    // A human is involved somewhere in this round, so every fixture in it is created live and paced
    // together — that is what makes the round ticker on the live screen move alongside their own match.
    const match = await createLiveMatch(
      fixture.homeClubId,
      fixture.awayClubId,
      homeTactic,
      awayTactic,
      { type: 'league', id: leagueId },
      crowdFor(homeClub),
    );
    updatedFixtures[i] = { ...fixture, matchId: match.id };
  }

  // The manager's chosen lineup is deliberately *not* wiped here — it is their standing side now, and only
  // they clear it (see resolveLeagueTactic and clubService.clearPendingRoundTactic).
  /**
   * The round's squads, saved together.
   *
   * One transaction rather than two round trips per fixture. A club plays once in a round, so there is
   * never more than one pending roster per club and nothing can overwrite anything. Each still goes
   * through `prisma.club.update`, so the extension that keeps the wage cache and the owed rest honest
   * runs for every one of them (see db/prisma.ts).
   */
  if (pendingRosters.length > 0) {
    await prisma.$transaction(
      pendingRosters.map((entry) =>
        prisma.club.update({ where: { id: entry.clubId }, data: { playersJson: JSON.stringify(entry.players) } }),
      ),
    );
  }

  const finished = !(updatedFixtures.some(unplayed) || (await anyFixtureStillLive(updatedFixtures)));
  await prisma.league.update({
    where: { id: leagueId },
    data: { fixturesJson: JSON.stringify(updatedFixtures), status: finished ? 'FINISHED' : 'IN_PROGRESS' },
  });

  if (!finished) {
    return { ...league, fixtures: updatedFixtures, status: 'IN_PROGRESS' };
  }
  return finalizeSeason(league, updatedFixtures);
}

/**
 * A league's last fixture just resolved: hands out prize money (existing behavior), stamps the season's
 * champion (standings[0]) and goal-scoring leader onto this now-FINISHED league row, then immediately
 * spins up next season's league for the same clubs (see the "renovar automaticamente" call) — an
 * auto-renewing league is what makes the História screens' year-over-year record possible at all.
 */
async function finalizeSeason(league: League, fixtures: LeagueFixture[]): Promise<League> {
  const matchIds = fixtures.map((f) => f.matchId).filter((id): id is string => !!id);
  const results: { homeClubId: string; awayClubId: string; homeGoals: number; awayGoals: number }[] = [];
  if (matchIds.length > 0) {
    const matches = await prisma.match.findMany({ where: { id: { in: matchIds } } });
    for (const m of matches) {
      if (!m.resultJson) continue;
      const result = JSON.parse(m.resultJson);
      results.push({ homeClubId: m.homeClubId, awayClubId: m.awayClubId, homeGoals: result.homeGoals, awayGoals: result.awayGoals });
    }
  }
  // Fixtures played for their result only decide the title exactly like any other.
  for (const fixture of fixtures) {
    if (fixture.matchId || !fixture.result) continue;
    results.push({
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      homeGoals: fixture.result.homeGoals,
      awayGoals: fixture.result.awayGoals,
    });
  }
  const standings = computeStandings(league.clubIds, results);
  const championClubId = standings[0]?.clubId ?? null;
  // Captured now, alongside championClubId, so a manager resigning/reclaiming this club later can't
  // retroactively change who this title is attributed to (see historyService.ts).
  const championClub = championClubId ? await getClub(championClubId) : null;
  const championOwnerId = championClub?.ownerId ?? null;
  const fixtureScorers = fixtures.flatMap((f) => (f.matchId ? [] : (f.result?.scorers ?? [])));
  const topScorer = await computeTopScorer(matchIds, league.clubIds, fixtureScorers);

  await prisma.league.update({
    where: { id: league.id },
    data: {
      status: 'FINISHED',
      championClubId,
      championOwnerId,
      topScorerPlayerId: topScorer?.playerId ?? null,
      topScorerName: topScorer?.name ?? null,
      topScorerGoals: topScorer?.goals ?? null,
      topScorerClubId: topScorer?.clubId ?? null,
    },
  });
  await distributePrizeMoney(league.clubIds, standings, league.division);
  if (championClub) {
    /**
     * O título entra na ficha do clube, e a torcida cresce com ele.
     *
     * `titlesWon` só era escrito como zero, em cinco lugares, e nunca incrementado: ganhar o campeonato não
     * aumentava a contagem de títulos de ninguém. Isso não é cosmético, porque `titlesWon` alimenta o porte
     * do clube no quadro de patrocínios e a exigência de currículo da comissão técnica, então metade das
     * portas que um título deveria abrir estava trancada.
     *
     * O ganho de sócios é uma fatia do que falta para o teto, não dos que já existem, senão vinte e cinco
     * por cento ao ano compõem até o absurdo. Ver clubMembership.
     */
    const teto = membershipCeiling(championClub.stadiumCapacity);
    const socios = championClub.membersCount ?? calculateInitialMembers(championClub, league.division);
    await prisma.club.update({
      where: { id: championClub.id },
      data: {
        titlesWon: { increment: 1 },
        membersCount: applyTitleMembershipBoost(socios, 'league', teto).newMembers,
      },
    });
    await generateTitleNews(championClub.name, championClub.id, league.name).catch((err) => console.error('generateTitleNews failed:', err));
  }

  /**
   * Next season is not created here any more — see `seasonService.turnSeason`.
   *
   * This function used to close a season and open the next one in the same breath, which meant a new
   * league appeared the instant the last fixture resolved, in whatever month that happened. That is the
   * structural cause of the year never turning: the game had two disagreeing notions of "this season",
   * one from the clock and one from whichever league row a screen picked up. Closing is what happens
   * when a competition ends; opening is what happens on 1 January.
   */

  return {
    ...league,
    fixtures,
    status: 'FINISHED',
    championClubId,
    championOwnerId,
    topScorerPlayerId: topScorer?.playerId ?? null,
    topScorerName: topScorer?.name ?? null,
    topScorerGoals: topScorer?.goals ?? null,
    topScorerClubId: topScorer?.clubId ?? null,
  };
}

async function startLeague(leagueId: string, clubIds: string[]): Promise<League> {
  if (clubIds.length % 2 !== 0) {
    throw new LeagueError('O número de clubes precisa ser par para gerar o calendário');
  }

  const existing = await prisma.league.findUnique({ where: { id: leagueId }, select: { season: true } });
  const fixtures = await scheduleLeagueFixtures(
    generateDoubleRoundRobinFixtures(clubIds, randomUUID()),
    existing?.season ?? (await getGameState()).seasonYear,
    leagueId,
    clubIds,
  );
  await prisma.league.update({
    where: { id: leagueId },
    data: { clubIdsJson: JSON.stringify(clubIds), fixturesJson: JSON.stringify(fixtures), status: 'IN_PROGRESS' },
  });

  return getLeague(leagueId);
}

async function assertRequesterHasClubInLeague(league: League, requestingUserId: string): Promise<void> {
  const clubs = await Promise.all(league.clubIds.map((id) => getClub(id)));
  const owns = clubs.some((c) => c.ownerId === requestingUserId);
  if (!owns) {
    throw new LeagueError('Você precisa ter um clube nesta liga para fazer isso');
  }
}

interface LeagueRecord {
  id: string;
  countryCode: string;
  division: number;
  name: string;
  capacity: number;
  status: string;
  clubIdsJson: string;
  fixturesJson: string;
  season: number;
  championClubId: string | null;
  championOwnerId?: string | null;
  topScorerPlayerId: string | null;
  topScorerName: string | null;
  topScorerGoals: number | null;
  topScorerClubId: string | null;
}

function toDomain(record: LeagueRecord): League {
  return {
    id: record.id,
    countryCode: record.countryCode,
    division: record.division,
    name: record.name,
    capacity: record.capacity,
    status: record.status as League['status'],
    clubIds: JSON.parse(record.clubIdsJson),
    fixtures: JSON.parse(record.fixturesJson),
    season: record.season,
    championClubId: record.championClubId,
    championOwnerId: record.championOwnerId ?? null,
    topScorerPlayerId: record.topScorerPlayerId,
    topScorerName: record.topScorerName,
    topScorerGoals: record.topScorerGoals,
    topScorerClubId: record.topScorerClubId,
  };
}

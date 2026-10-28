import { GameDate, LeagueFixture, CupFixture, addDays, compareGameDate, isAfter, isBefore, isSameOrBefore, mondayOf } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getGameState, setCurrentDate, setLastWeeklyTickDate } from './gameStateService.js';
import { playLeagueRound, getActiveLeagueForClub } from './leagueService.js';
import { playCupRound } from './cupService.js';
import { getNextActionableMatch, tickLiveMatchSystem } from './matchService.js';
import { processWeeklyTick } from './weeklyTickService.js';
import { turnSeason } from './seasonService.js';

export class TimeError extends Error {}

/** One competition's round, due on a given day. */
export interface ScheduledRound {
  kind: 'LEAGUE' | 'CUP';
  competitionId: string;
  competitionName: string;
  round: number;
  date: GameDate;
}

export interface MatchdayOutcome {
  /** Where the clock stands after advancing. */
  date: GameDate;
  seasonYear: number;
  /** What was played today, across every competition. */
  played: ScheduledRound[];
  /** The manager's own match, when today handed them one to watch. Null when the day passed them by. */
  matchId: string | null;
  /** Mondays crossed on the way here, each one a week of wages, rest and building work for the world. */
  weeksRun: GameDate[];
  /**
   * O clube que o técnico perdeu nesta passagem, quando a diretoria o demitiu.
   *
   * Sobe até aqui porque a tela precisa saber. Sem isto o jogador continuaria a ver o painel de um clube que
   * já não dirige — a demissão aconteceria no banco e em lugar nenhum onde ele pudesse notar.
   */
  sackedFromClubId: string | null;
}

/** Every round still to be played that knows what day it belongs to, across every running competition. *
 * Undated fixtures are ignored rather than guessed at: a knockout round whose draw has not happened yet
 * has no date because it genuinely has no date, and inventing one here would let the clock stop on a day
 * with nothing to play. The legacy path below is what covers a save with no dates at all. */
async function pendingScheduledRounds(seasonYear: number): Promise<ScheduledRound[]> {
  const rounds = new Map<string, ScheduledRound>();

  /** Only this season's competitions. Dates repeat every year — the second Sunday of April exists in 2027
   * as much as in 2026 — so a league left unfinished in a past season would otherwise sit permanently at
   * the front of the queue and pin the clock behind it forever, and next season's fixtures, once the turn
   * creates them, would be playable before the year had actually turned. */
  const leagues = await prisma.league.findMany({ where: { status: 'IN_PROGRESS', season: seasonYear } });
  for (const record of leagues) {
    const fixtures = JSON.parse(record.fixturesJson) as LeagueFixture[];
    for (const fixture of fixtures) {
      if (fixture.matchId !== null || fixture.result) continue;
      if (!fixture.date) continue;
      const key = `L:${record.id}:${fixture.round}`;
      if (!rounds.has(key)) {
        rounds.set(key, {
          kind: 'LEAGUE',
          competitionId: record.id,
          competitionName: record.name,
          round: fixture.round,
          date: fixture.date,
        });
      }
    }
  }

  const cups = await prisma.cup.findMany({ where: { status: 'IN_PROGRESS', season: seasonYear } });
  for (const record of cups) {
    const fixtures = JSON.parse(record.fixturesJson) as CupFixture[];
    for (const fixture of fixtures) {
      if (fixture.winnerClubId !== null) continue;
      if (!fixture.date) continue;
      const key = `C:${record.id}:${fixture.round}`;
      if (!rounds.has(key)) {
        rounds.set(key, {
          kind: 'CUP',
          competitionId: record.id,
          competitionName: record.name,
          round: fixture.round,
          date: fixture.date,
        });
      }
    }
  }

  return [...rounds.values()].sort((a, b) => compareGameDate(a.date, b.date) || a.round - b.round);
}

/**
 * Closes out anything a manager walked away from before the clock moves past it.
 *
 * A match left LIVE is a day that never finished. Advancing while one is still open would leave it hanging
 * behind the clock forever, and `getNextActionableMatch` would keep handing it back — which is the old bug
 * where "ir para a partida" dropped a manager into a game already at the 85th minute.
 */
async function resolveMatchesLeftBehind(before: GameDate): Promise<void> {
  const leagues = await prisma.league.findMany({ where: { status: 'IN_PROGRESS' } });
  const stale: string[] = [];
  for (const record of leagues) {
    for (const fixture of JSON.parse(record.fixturesJson) as LeagueFixture[]) {
      if (fixture.matchId && fixture.date && isBefore(fixture.date, before)) stale.push(fixture.matchId);
    }
  }
  const cups = await prisma.cup.findMany({ where: { status: 'IN_PROGRESS' } });
  for (const record of cups) {
    for (const fixture of JSON.parse(record.fixturesJson) as CupFixture[]) {
      if (fixture.matchId && fixture.date && isBefore(fixture.date, before)) stale.push(fixture.matchId);
    }
  }
  if (stale.length === 0) return;

  const live = await prisma.match.findMany({
    where: { id: { in: stale }, status: 'LIVE' },
    select: { id: true },
  });
  for (const match of live) {
    await tickLiveMatchSystem(match.id).catch(() => null);
  }
}

/**
 * Runs the weekly tick for every Monday the clock is about to cross, and records each one.
 *
 * `lastWeeklyTickDate` is what makes this safe to retry: an advance that fails halfway, or a manager who
 * hammers the button, must not charge the world's wages twice. Each Monday is claimed before its week is
 * processed, and a Monday already claimed is skipped.
 *
 * The cap bounds how much one press can cost, not how many weeks eventually happen. A season boundary
 * leaves a real gap — the season ends in December and the next starts in April, so a club crosses some
 * fourteen weeks of wages with no gate receipts, which is exactly what the television money is for — and
 * grinding all of them in a single request would hang the game. Whatever is left over is simply still
 * pending on the next press, when this starts again from the Monday after the last one recorded. The
 * weeks are deferred, never dropped.
 */
async function runWeeksUpTo(target: GameDate): Promise<{ run: GameDate[]; sackedFromClubId: string | null }> {
  const MAX_WEEKS_PER_ADVANCE = 8;
  const state = await getGameState();
  /**
   * A clock that has never ticked starts at the week it is going to, not at the week it is standing on.
   *
   * The clock is created on 1 January and the season does not start until April, so taking `currentDate`
   * as the starting point would make a manager's very first press of the button grind through a
   * quarter-year of wages for every club in the world before playing a single match. Nothing happened in
   * those weeks. The world begins the week it begins.
   *
   * A marker sitting *ahead* of where the game is going gets the same treatment. It means the clock has
   * changed era under it — a save loaded over another, an imported one, a season turn that set the date —
   * and simply adding a week to it would produce a Monday that never arrives, so the world's wages,
   * building work and recovery would stop for good with nothing to show that they had.
   */
  const marker = state.lastWeeklyTickDate;
  const firstMonday = marker && !isAfter(marker, target) ? addDays(marker, 7) : mondayOf(target);

  const run: GameDate[] = [];
  let sackedFromClubId: string | null = null;
  let monday = firstMonday;
  while (isSameOrBefore(monday, target) && run.length < MAX_WEEKS_PER_ADVANCE) {
    await setLastWeeklyTickDate(monday);
    const semana = await processWeeklyTick(monday);
    // A primeira demissão manda: depois dela o técnico não dirige mais nada, e as semanas seguintes já
    // correm sem ele.
    if (semana.playerSacked && !sackedFromClubId) sackedFromClubId = semana.playerFormerClubId;
    run.push(monday);
    monday = addDays(monday, 7);
  }
  return { run, sackedFromClubId };
}

/**
 * Moves the game to its next matchday and plays it.
 *
 * This is the loop the game never had. Every advance used to be "play the next round of *this* league",
 * which is why a cup tie falling between two league rounds was unreachable and why the season number
 * never turned: nothing in the game knew what day it was, so nothing could know what came next.
 *
 * The rule is the calendar's, not this function's. Each date belongs to exactly one round of one
 * competition (see `buildSeasonCalendar`), so "what is next" is just the earliest date with a round still
 * to play, and interleaving league and cup falls out of that for free — no conflict to resolve, no
 * priority to encode. Whether the next date is a Sunday of league or a Wednesday of cup, the manager
 * presses the same button.
 */
export async function advanceOnce(userId: string, mayTurnSeason: boolean, mayPlayMatch: boolean = true): Promise<MatchdayOutcome> {
  const club = await prisma.club.findFirst({ where: { ownerId: userId }, select: { id: true } });
  if (!club) {
    throw new TimeError('Você precisa de um clube para avançar no calendário');
  }

  const state = await getGameState();
  await resolveMatchesLeftBehind(state.currentDate);

  const scheduled = await pendingScheduledRounds(state.seasonYear);
  if (scheduled.length === 0) {
    /**
     * Nothing left on the calendar. That means one of two very different things, and only one of them
     * calls for doing anything.
     *
     * A save that predates dated fixtures has a league to play and simply no days attached to it, so the
     * old "next pending round" keeps it moving. A season that has genuinely run its course has nothing to
     * play, and reaching for the same fallback there would keep poking a finished league every time the
     * manager pressed the button. `undated` is what tells the two apart.
     */
    const league = await getActiveLeagueForClub(club.id);
    const undated = !!league && league.fixtures.every((fixture) => !fixture.date);
    if (league && league.status === 'IN_PROGRESS' && undated) {
      if (mayPlayMatch) {
        await playLeagueRound(league.id);
        return {
          date: state.currentDate,
          seasonYear: state.seasonYear,
          played: [{ kind: 'LEAGUE', competitionId: league.id, competitionName: league.name, round: 0, date: state.currentDate }],
          weeksRun: [],
          sackedFromClubId: null,
          matchId: (await getNextActionableMatch(club.id))?.id ?? null,
        };
      } else {
        // Skip playing the match, but still advance nothing (date unchanged)
        return {
          date: state.currentDate,
          seasonYear: state.seasonYear,
          played: [],
          weeksRun: [],
          sackedFromClubId: null,
          matchId: null,
        };
      }
    }

    /**
     * The season has run out, so the year turns.
     *
     * This is the moment the game never reached. Every competition of this season is played out, which
     * is exactly what 31 December means, and the only thing left to do is enter the next one: squads age,
     * veterans retire, next season's competitions open with their dates set, and the television money
     * lands (see `turnSeason`). Then the same question is asked again, and this time the calendar has an
     * answer.
     */
    if (mayTurnSeason) {
      const turned = await turnSeason(state.seasonYear + 1);
      if (turned.seasonYear > state.seasonYear) {
        return advanceOnce(userId, false, true); // keep mayPlayMatch true for recursive call
      }
    }
    const after = await getGameState();
    return { date: after.currentDate, seasonYear: after.seasonYear, played: [], weeksRun: [], matchId: null, sackedFromClubId: null };
  }

  const matchday = scheduled[0].date;
  const dueToday = scheduled.filter((entry) => entry.date === matchday);

  // Every Monday between where the clock stood and where it is going gets its week processed, before the
  // matches are played — a squad turns up to Sunday's game having rested, not about to.
  const { run: weeksRun, sackedFromClubId } = await runWeeksUpTo(matchday);

  if (mayPlayMatch) {
    for (const entry of dueToday) {
      if (entry.kind === 'LEAGUE') await playLeagueRound(entry.competitionId, entry.round);
      else await playCupRound(entry.competitionId, entry.round);
    }
  }

  /**
   * The clock never runs backwards. A round can be overdue — a manager who left one unplayed still has it
   * sitting on a date behind them — and playing it is right, but rewinding the calendar to do so is not.
   */
  const moved = isBefore(matchday, state.currentDate) ? state.currentDate : matchday;
  const after = await setCurrentDate(moved);

  return {
    date: after.currentDate,
    seasonYear: after.seasonYear,
    played: mayPlayMatch ? dueToday : [],
    weeksRun,
    sackedFromClubId,
    matchId: mayPlayMatch && !sackedFromClubId ? (await getNextActionableMatch(club.id))?.id ?? null : null,
  };
}

/**
 * What the manager is walking into next, without playing it — the button's label comes from here.
 *
 * Deliberately read-only: the screen asks this on every render, and a question about the future must
 * never move the game.
 */
export async function peekNextMatchday(): Promise<ScheduledRound | null> {
  const { seasonYear } = await getGameState();
  const scheduled = await pendingScheduledRounds(seasonYear);
  return scheduled[0] ?? null;
}

/**
 * Advances the clock to the next matchday and plays the matches.
 */
export async function advanceToNextMatchday(userId: string): Promise<MatchdayOutcome> {
  return advanceOnce(userId, true, true);
}

/**
 * Advances the clock to the next matchday without playing the match.
 * Used for "Pular até a Próxima Partida" feature.
 */
export async function advanceClockToNextMatchday(userId: string): Promise<MatchdayOutcome> {
  return advanceOnce(userId, true, false);
}
import {
  GameDate,
  WEDNESDAY,
  addWeeks,
  buildSeasonCalendar,
  dayOfWeek,
  leagueRoundDates,
  seasonWindow,
  type CupFixture,
  type LeagueFixture,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';

/**
 * Turning fixtures into dated fixtures.
 *
 * The pure calendar in `shared/domain/calendar.ts` decides the shape of a season. This is the thin layer
 * that applies it to what is actually in the database, and — crucially — the one place that knows which
 * dates are already spoken for across *every* competition of that season.
 *
 * That cross-competition view is what upholds the rule the whole design rests on: one date, one round.
 * A club can therefore never be scheduled into two matches at once, and nothing needs to check for it.
 */

/**
 * Dates already claimed by competitions that share clubs with `clubIds`.
 *
 * Scoped by shared clubs, not by season alone. Two leagues in different countries playing on the same
 * Sunday is normal football, and blocking that would leave the second league with no dates at all. What
 * genuinely cannot overlap is a competition a club is *already* playing in that day — which is exactly
 * the league-and-its-cup case this whole feature exists to interleave.
 */
export async function takenDatesForClubs(season: number, clubIds: string[]): Promise<Set<GameDate>> {
  const mine = new Set(clubIds);
  const [leagues, cups] = await Promise.all([
    prisma.league.findMany({ where: { season }, select: { clubIdsJson: true, fixturesJson: true } }),
    prisma.cup.findMany({ where: { season }, select: { clubIdsJson: true, fixturesJson: true } }),
  ]);

  const taken = new Set<GameDate>();
  const collect = (clubIdsJson: string, fixturesJson: string) => {
    let members: string[];
    let fixtures: { date?: string | null }[];
    try {
      members = JSON.parse(clubIdsJson);
      fixtures = JSON.parse(fixturesJson);
    } catch {
      return;
    }
    if (!members.some((id) => mine.has(id))) return;
    for (const fixture of fixtures) if (fixture.date) taken.add(fixture.date);
  };
  for (const league of leagues) collect(league.clubIdsJson, league.fixturesJson);
  for (const cup of cups) collect(cup.clubIdsJson, cup.fixturesJson);
  return taken;
}

/**
 * Dates a league's fixtures across the season window.
 *
 * Cup dates already in the database are treated as reserved, so the league schedules around whatever
 * knockout ties have been drawn rather than on top of them.
 */
export async function scheduleLeagueFixtures(
  fixtures: LeagueFixture[],
  season: number,
  leagueId: string,
  clubIds: string[],
): Promise<LeagueFixture[]> {
  const rounds = fixtures.reduce((most, f) => Math.max(most, f.round), 0);
  if (rounds === 0) return fixtures;

  // Dates these clubs are already committed to are removed from the pool *before* rounds are handed out,
  // rather than clearing a round afterwards — clearing left the round with no date at all instead of
  // moving it to the next free day.
  const taken = await takenDatesForClubs(season, clubIds);
  const calendar = buildSeasonCalendar({
    seasonYear: season,
    leagueRounds: rounds,
    leagueKey: leagueId,
    unavailableDates: taken,
  });

  const roundDates = leagueRoundDates(calendar, leagueId);

  /**
   * A round with no date is a round that will never be played: the clock only ever stops on dates, so an
   * undated fixture is invisible to it, and a competition holding one can never finish. It happens when
   * the pool is starved — clubs committed to enough other competitions that the season has no free days
   * left — and it used to happen in silence. Saying so is the difference between a bug someone can find
   * and clubs quietly falling out of football. `turnSeason` closes out whatever is left stranded.
   */
  const undated = rounds - roundDates.size;
  if (undated > 0) {
    console.warn(
      `[scheduleService] liga ${leagueId}: ${undated} de ${rounds} rodadas ficaram sem data — ` +
        'não há dias livres suficientes na temporada para esses clubes.',
    );
  }

  return fixtures.map((fixture) => ({ ...fixture, date: roundDates.get(fixture.round) ?? null }));
}

/**
 * The next free midweek date for a cup round, at or after `notBefore`.
 *
 * Cups are dated one round at a time because a knockout bracket is only drawn once the previous round is
 * decided. Prefers Wednesdays — a cup tie in the middle of the week is what makes the league's weekends
 * and the cup's midweeks interleave — and falls back to any free day if the midweeks are gone.
 */
export async function nextFreeCupDate(season: number, clubIds: string[], notBefore?: GameDate): Promise<GameDate | null> {
  const { startDate, endDate } = seasonWindow(season);
  const taken = await takenDatesForClubs(season, clubIds);
  // Knockout rounds are weeks apart, not back to back. Taking the very next free Wednesday each time
  // packed a whole cup into April and left the rest of the season empty; a real cup breathes between
  // rounds while the league plays on.
  const WEEKS_BETWEEN_CUP_ROUNDS = 3;
  const earliest = notBefore ? addWeeks(notBefore, WEEKS_BETWEEN_CUP_ROUNDS) : startDate;
  const from = earliest > startDate ? earliest : startDate;

  const candidates: GameDate[] = [];
  const calendar = buildSeasonCalendar({ seasonYear: season, leagueRounds: 0, leagueKey: '' });
  for (const slot of calendar.slots) {
    if (slot.date < from || slot.date > endDate) continue;
    if (taken.has(slot.date)) continue;
    candidates.push(slot.date);
  }
  return candidates.find((d) => dayOfWeek(d) === WEDNESDAY) ?? candidates[0] ?? null;
}

/** Stamps every fixture of one cup round with a date, leaving other rounds untouched. */
export async function scheduleCupRound(
  fixtures: CupFixture[],
  season: number,
  round: number,
  clubIds: string[],
  notBefore?: GameDate,
): Promise<CupFixture[]> {
  const alreadyDated = fixtures.find((f) => f.round === round && f.date);
  if (alreadyDated) return fixtures;

  const date = await nextFreeCupDate(season, clubIds, notBefore);
  if (!date) return fixtures;
  return fixtures.map((fixture) => (fixture.round === round ? { ...fixture, date } : fixture));
}

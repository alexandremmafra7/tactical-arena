import { describe, expect, it } from 'vitest';
import {
  assignDatesToFixtures,
  buildAnnualCalendar,
  buildSeasonCalendar,
  claimNextCupSlot,
  firstMatchday,
  leagueRoundDates,
  nationalSeasonWindow,
  nextMatchdayOnOrAfter,
  seasonPhaseOn,
  seasonTurnDate,
  seasonWindow,
  stateSeasonWindow,
  type SeasonCalendar,
} from './calendar.js';
import { dayOfWeek, daysBetween, SUNDAY, WEDNESDAY } from './gameDate.js';

const LEAGUE = 'liga-serie-a';
const STATE_LEAGUE = 'estadual-paulista';

function build(overrides: Partial<Parameters<typeof buildSeasonCalendar>[0]> = {}): SeasonCalendar {
  return buildSeasonCalendar({
    seasonYear: 2026,
    leagueRounds: 38,
    leagueKey: LEAGUE,
    cups: [{ competitionKey: 'copa-do-brasil', rounds: 4 }],
    ...overrides,
  });
}

describe('the season and state windows', () => {
  it('runs state championships from January to March and national from April to December', () => {
    const stateWin = stateSeasonWindow(2026);
    expect(stateWin.startDate).toBe('2026-01-10'); // 2nd Saturday of January 2026
    expect(stateWin.endDate).toBe('2026-03-29'); // last Sunday of March 2026

    const natWin = nationalSeasonWindow(2026);
    expect(natWin.startDate).toBe('2026-04-04'); // 1st Saturday of April 2026
    expect(natWin.endDate).toBe('2026-12-13'); // 2nd Sunday of December 2026

    const fullWin = seasonWindow(2026);
    expect(fullWin.startDate).toBe(stateWin.startDate);
    expect(fullWin.endDate).toBe(natWin.endDate);
  });

  it('places every date in the right phase, considering January to March as in-season active competition', () => {
    expect(seasonPhaseOn('2026-01-02', 2026)).toBe('PRE_SEASON'); // Before 2nd Sat of Jan
    expect(seasonPhaseOn('2026-02-10', 2026)).toBe('IN_SEASON');  // State championship period (Jan-Mar)
    expect(seasonPhaseOn('2026-07-01', 2026)).toBe('IN_SEASON');  // National championship period (Apr-Dec)
    expect(seasonPhaseOn('2026-12-20', 2026)).toBe('OFF_SEASON');
    expect(seasonTurnDate(2026)).toBe('2027-01-01');
  });
});

describe('annual calendar with State (Phase 1) and National (Phase 2)', () => {
  it('schedules state championships in Jan-Mar and Brasileirao in Apr-Dec without date collision', () => {
    const calendar = buildAnnualCalendar({
      seasonYear: 2026,
      stateRounds: 12,
      stateKey: STATE_LEAGUE,
      leagueRounds: 38,
      leagueKey: LEAGUE,
      cups: [{ competitionKey: 'copa-do-brasil', rounds: 4 }],
    });

    const stateDates = calendar.slots
      .filter((s) => s.claim?.competitionKey === STATE_LEAGUE)
      .map((s) => s.date);
    const leagueDates = calendar.slots
      .filter((s) => s.claim?.competitionKey === LEAGUE)
      .map((s) => s.date);

    expect(stateDates.length).toBe(12);
    expect(leagueDates.length).toBe(38);

    // All state matches must be between Jan and March (Phase 1)
    for (const date of stateDates) {
      expect(date >= '2026-01-01').toBe(true);
      expect(date <= '2026-03-31').toBe(true);
    }

    // All league matches must be between April and December (Phase 2)
    for (const date of leagueDates) {
      expect(date >= '2026-04-01').toBe(true);
      expect(date <= '2026-12-31').toBe(true);
    }

    // No collision between state and national dates
    const allClaimedDates = calendar.slots.filter((s) => s.claim !== null).map((s) => s.date);
    expect(new Set(allClaimedDates).size).toBe(allClaimedDates.length);
  });
});

describe('buildSeasonCalendar', () => {
  it('gives all 38 league rounds their own date inside the season', () => {
    const calendar = build();
    const dates = leagueRoundDates(calendar, LEAGUE);

    expect(dates.size).toBe(38);
    for (let round = 1; round <= 38; round += 1) {
      const date = dates.get(round);
      expect(date, `round ${round}`).toBeDefined();
      expect(date! >= calendar.startDate).toBe(true);
      expect(date! <= calendar.endDate).toBe(true);
    }
    expect(new Set(dates.values()).size).toBe(38);
  });

  it('runs the rounds in calendar order', () => {
    const dates = leagueRoundDates(build(), LEAGUE);
    for (let round = 2; round <= 38; round += 1) {
      expect(dates.get(round)! > dates.get(round - 1)!, `round ${round} after ${round - 1}`).toBe(true);
    }
  });

  /**
   * The invariant the whole design rests on. One slot, one round: that is what makes it impossible for a
   * club to be booked into two matches at once, without anything having to check for it.
   */
  it('never lets two rounds share a date', () => {
    const calendar = build({ cups: [{ competitionKey: 'copa', rounds: 6 }] });
    for (let i = 0; i < 6; i += 1) claimNextCupSlot(calendar, 'copa', i + 1);

    const claimed = calendar.slots.filter((s) => s.claim !== null);
    expect(new Set(claimed.map((s) => s.date)).size).toBe(claimed.length);
  });

  it('leaves at least three days between consecutive matchdays', () => {
    const calendar = build();
    const claimed = calendar.slots.filter((s) => s.claim !== null);
    for (let i = 1; i < claimed.length; i += 1) {
      const gap = daysBetween(claimed[i - 1].date, claimed[i].date);
      expect(gap, `gap before ${claimed[i].date}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('plays the league mostly at weekends, spilling midweek only when it must', () => {
    const calendar = build();
    const league = calendar.slots.filter((s) => s.claim?.kind === 'LEAGUE');
    const midweek = league.filter((s) => s.slotType === 'MIDWEEK');
    // 38 rounds against ~36 Sundays: a couple of rounds have to move, which is what the real
    // Brasileirão does when the calendar is tight. Anything more means the packing went wrong.
    expect(midweek.length).toBeLessThanOrEqual(4);
    expect(league.length - midweek.length).toBeGreaterThanOrEqual(34);
  });

  it('puts every matchday on a Sunday or a Wednesday', () => {
    for (const slot of build().slots) {
      expect([SUNDAY, WEDNESDAY]).toContain(dayOfWeek(slot.date));
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });
});

describe('cup scheduling', () => {
  it('hands cup rounds midweek dates, spread out, with the final late in the season', () => {
    const calendar = build({ cups: [{ competitionKey: 'copa', rounds: 4 }] });
    const claimed = [1, 2, 3, 4].map((round) => claimNextCupSlot(calendar, 'copa', round));

    expect(claimed.every((s) => s !== null)).toBe(true);
    for (const slot of claimed) expect(slot!.slotType).toBe('MIDWEEK');

    const dates = claimed.map((s) => s!.date);
    for (let i = 1; i < dates.length; i += 1) expect(dates[i] > dates[i - 1]).toBe(true);
    // The final belongs in the closing stretch, not in July.
    expect(dates[3] >= '2026-10-01').toBe(true);
  });

  it('claims rounds one at a time, because a knockout bracket is only drawn as it goes', () => {
    const calendar = build({ cups: [{ competitionKey: 'copa', rounds: 4 }] });
    const first = claimNextCupSlot(calendar, 'copa', 1);
    expect(first).not.toBeNull();
    // Still three dates held for this cup, untouched by the league.
    expect(calendar.slots.filter((s) => s.reservedFor === 'copa' && s.claim === null)).toHaveLength(3);
  });

  it('still finds a date for a cup that outgrows its reservation', () => {
    const calendar = build({ cups: [{ competitionKey: 'copa', rounds: 2 }] });
    for (let round = 1; round <= 2; round += 1) claimNextCupSlot(calendar, 'copa', round);
    const extra = claimNextCupSlot(calendar, 'copa', 3);
    expect(extra).not.toBeNull();
    expect(extra!.claim?.round).toBe(3);
  });

  it('keeps the cup out of the league way', () => {
    const calendar = build({ cups: [{ competitionKey: 'copa', rounds: 4 }] });
    for (let round = 1; round <= 4; round += 1) claimNextCupSlot(calendar, 'copa', round);
    const cupDates = calendar.slots.filter((s) => s.claim?.kind === 'CUP').map((s) => s.date);
    const leagueDates = calendar.slots.filter((s) => s.claim?.kind === 'LEAGUE').map((s) => s.date);
    for (const date of cupDates) expect(leagueDates).not.toContain(date);
  });
});

describe('navigating the calendar', () => {
  it('finds the next matchday from any date', () => {
    const calendar = build();
    const first = firstMatchday(calendar)!;
    expect(nextMatchdayOnOrAfter(calendar, calendar.startDate)!.date).toBe(first.date);
    // Asking on a matchday returns that same day, not the one after.
    expect(nextMatchdayOnOrAfter(calendar, first.date)!.date).toBe(first.date);
    // Past the end there is nothing left, which is how the season knows it is over.
    expect(nextMatchdayOnOrAfter(calendar, '2026-12-31')).toBeNull();
  });

  it('stamps fixtures with the date of their round', () => {
    const calendar = build();
    const fixtures = [
      { round: 1, homeClubId: 'a', awayClubId: 'b' },
      { round: 2, homeClubId: 'b', awayClubId: 'a' },
      { round: 99, homeClubId: 'a', awayClubId: 'b' },
    ];
    const dated = assignDatesToFixtures(fixtures, leagueRoundDates(calendar, LEAGUE));
    expect(dated[0].date).toBe(leagueRoundDates(calendar, LEAGUE).get(1));
    expect(dated[1].date).toBe(leagueRoundDates(calendar, LEAGUE).get(2));
    // A round with no slot keeps a null date rather than silently borrowing someone else's.
    expect(dated[2].date).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  addDays,
  addWeeks,
  compareGameDate,
  dayOfWeek,
  daysBetween,
  formatLongPtBr,
  formatShortPtBr,
  gameDate,
  mondayOf,
  nextWeekdayOnOrAfter,
  nthWeekdayOfMonth,
  parseGameDate,
  SATURDAY,
  SUNDAY,
  WEDNESDAY,
} from './gameDate.js';

describe('GameDate arithmetic', () => {
  it('rolls over months and years', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addWeeks('2026-04-05', 2)).toBe('2026-04-19');
  });

  it('handles the leap day', () => {
    // 2028 is a leap year, 2027 is not.
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366);
    expect(daysBetween('2027-01-01', '2028-01-01')).toBe(365);
  });

  it('knows the weekday', () => {
    // 5 April 2026 is a Sunday; 8 April 2026 is a Wednesday.
    expect(dayOfWeek('2026-04-05')).toBe(SUNDAY);
    expect(dayOfWeek('2026-04-08')).toBe(WEDNESDAY);
    expect(dayOfWeek('2026-04-04')).toBe(SATURDAY);
  });

  it('finds the Monday that starts a week, counting Sunday as the end of one', () => {
    // Week of Mon 6 Apr 2026.
    expect(mondayOf('2026-04-06')).toBe('2026-04-06');
    expect(mondayOf('2026-04-08')).toBe('2026-04-06');
    // Sunday belongs to the week that already started, not the one about to.
    expect(mondayOf('2026-04-12')).toBe('2026-04-06');
  });

  it('finds the nth weekday of a month', () => {
    // April 2026 starts on a Wednesday, so its first Saturday is the 4th.
    expect(nthWeekdayOfMonth(2026, 4, SATURDAY, 1)).toBe('2026-04-04');
    // December 2026 starts on a Tuesday; first Sunday the 6th, second the 13th.
    expect(nthWeekdayOfMonth(2026, 12, SUNDAY, 2)).toBe('2026-12-13');
  });

  it('returns the same day when it already falls on the requested weekday', () => {
    expect(nextWeekdayOnOrAfter('2026-04-05', SUNDAY)).toBe('2026-04-05');
    expect(nextWeekdayOnOrAfter('2026-04-06', SUNDAY)).toBe('2026-04-12');
  });

  it('sorts and compares as calendar order', () => {
    const dates = ['2026-12-13', '2026-04-05', '2026-08-01'];
    expect([...dates].sort(compareGameDate)).toEqual(['2026-04-05', '2026-08-01', '2026-12-13']);
  });

  it('normalises overflow when building a date', () => {
    expect(gameDate(2026, 13, 1)).toBe('2027-01-01');
    expect(gameDate(2026, 1, 32)).toBe('2026-02-01');
  });

  it('rejects malformed input instead of guessing', () => {
    expect(() => parseGameDate('05/04/2026')).toThrow();
    expect(() => parseGameDate('2026-4-5')).toThrow();
  });

  it('formats for a Brazilian reader', () => {
    expect(formatShortPtBr('2026-04-05')).toBe('05/04');
    expect(formatLongPtBr('2026-04-05')).toBe('domingo, 5 de abril de 2026');
  });
});

/**
 * The timezone guard.
 *
 * A `GameDate` is a civil date — a square on a wall calendar — not an instant. If any of these functions
 * ever reaches for local time (`new Date('2026-04-05')`, `getDate()`, `toISOString()` on a local-time
 * Date), results shift by a day for players either side of UTC while every test on a UTC machine keeps
 * passing. `process.env.TZ` is set before each assertion here so that mistake fails loudly instead.
 *
 * Kiritimati is UTC+14 and Niue is UTC-11 — the two extremes of the inhabited timezone range, 25 hours
 * apart, so any instant-based arithmetic lands on a different day in one of them.
 */
describe('is immune to the local timezone', () => {
  const zones = ['Pacific/Kiritimati', 'Pacific/Niue', 'America/Sao_Paulo', 'UTC'];

  function underZone<T>(zone: string, fn: () => T): T {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try {
      return fn();
    } finally {
      process.env.TZ = previous;
    }
  }

  it('gives the same weekday everywhere', () => {
    for (const zone of zones) {
      expect(underZone(zone, () => dayOfWeek('2026-04-05')), `weekday under ${zone}`).toBe(SUNDAY);
    }
  });

  it('gives the same arithmetic everywhere', () => {
    for (const zone of zones) {
      expect(underZone(zone, () => addDays('2026-12-31', 1)), `rollover under ${zone}`).toBe('2027-01-01');
      expect(underZone(zone, () => mondayOf('2026-04-12')), `monday under ${zone}`).toBe('2026-04-06');
      expect(underZone(zone, () => nthWeekdayOfMonth(2026, 4, SATURDAY, 1)), `nth under ${zone}`).toBe('2026-04-04');
    }
  });
});

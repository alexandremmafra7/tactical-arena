/**
 * The in-game calendar date.
 *
 * A `GameDate` is a **civil date** — a day on a wall calendar, with no time and no timezone. It is stored
 * and passed around as the string `'YYYY-MM-DD'`, never as a `Date` and never as a Prisma `DateTime`.
 *
 * That choice is deliberate and load-bearing. A `Date` (and a Prisma `DateTime` column) is an *instant*:
 * `new Date('2026-04-05')` is midnight UTC, which is still 5 April in London and already 4 April in São
 * Paulo. Let one of those into the calendar and matchdays silently shift by a day for players west of
 * Greenwich, while every test on a UTC machine keeps passing. Every function here does its arithmetic
 * through `Date.UTC` and hands back a string, so the local timezone can never influence the result.
 *
 * Weekday numbering follows JavaScript: 0 = Sunday ... 6 = Saturday.
 */
export type GameDate = string;

export const SUNDAY = 0;
export const WEDNESDAY = 3;
export const SATURDAY = 6;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parsed into its civil parts. Throws on anything that is not a well-formed `YYYY-MM-DD`. */
export function parseGameDate(date: GameDate): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new Error(`Data de jogo inválida: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Builds a `GameDate` from civil parts, normalising overflow (month 13 becomes January of the next year). */
export function gameDate(year: number, month: number, day: number): GameDate {
  const utc = new Date(Date.UTC(year, month - 1, day));
  return toGameDate(utc);
}

/** Formats a UTC-based Date back to `YYYY-MM-DD`. Internal helper — callers should stay in strings. */
function toGameDate(utc: Date): GameDate {
  const year = String(utc.getUTCFullYear()).padStart(4, '0');
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toUtc(date: GameDate): Date {
  const { year, month, day } = parseGameDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(date: GameDate, days: number): GameDate {
  const utc = toUtc(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return toGameDate(utc);
}

export function addWeeks(date: GameDate, weeks: number): GameDate {
  return addDays(date, weeks * 7);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(date: GameDate): number {
  return toUtc(date).getUTCDay();
}

/** Negative if `a` is earlier, positive if later, 0 if the same day. Safe to pass to `sort`. */
export function compareGameDate(a: GameDate, b: GameDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isBefore(a: GameDate, b: GameDate): boolean {
  return a < b;
}

export function isAfter(a: GameDate, b: GameDate): boolean {
  return a > b;
}

export function isSameOrBefore(a: GameDate, b: GameDate): boolean {
  return a <= b;
}

/** Whole days from `a` to `b`; negative if `b` is earlier. */
export function daysBetween(a: GameDate, b: GameDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** The Monday of this date's week. Weeks run Monday to Sunday, which is what the weekly tick keys off. */
export function mondayOf(date: GameDate): GameDate {
  const weekday = dayOfWeek(date);
  // Sunday (0) belongs to the week that started six days earlier, not the one starting tomorrow.
  const offset = weekday === SUNDAY ? -6 : 1 - weekday;
  return addDays(date, offset);
}

/** The first `weekday` on or after `date`. Returns `date` itself when it already falls on that weekday. */
export function nextWeekdayOnOrAfter(date: GameDate, weekday: number): GameDate {
  const diff = (weekday - dayOfWeek(date) + 7) % 7;
  return addDays(date, diff);
}

/**
 * The nth occurrence of a weekday in a month, e.g. the first Saturday of April 2026 or the second Sunday
 * of December. `n` is 1-based.
 */
export function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): GameDate {
  const first = gameDate(year, month, 1);
  const firstMatching = nextWeekdayOnOrAfter(first, weekday);
  return addDays(firstMatching, (n - 1) * 7);
}

/**
 * The last occurrence of a weekday in a month.
 */
export function lastWeekdayOfMonth(year: number, month: number, weekday: number): GameDate {
  const lastDayUtc = new Date(Date.UTC(year, month, 0));
  const lastDate = toGameDate(lastDayUtc);
  const diff = (dayOfWeek(lastDate) - weekday + 7) % 7;
  return addDays(lastDate, -diff);
}

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const WEEKDAYS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "05/04" — the compact form for a fixture row. */
export function formatShortPtBr(date: GameDate): string {
  const { month, day } = parseGameDate(date);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/** "domingo, 5 de abril de 2026" — the long form for a header. */
export function formatLongPtBr(date: GameDate): string {
  const { year, month, day } = parseGameDate(date);
  return `${WEEKDAYS_PT[dayOfWeek(date)]}, ${day} de ${MONTHS_PT[month - 1]} de ${year}`;
}

export function monthNamePtBr(month: number): string {
  return MONTHS_PT[month - 1];
}

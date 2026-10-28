import {
  GameDate,
  SATURDAY,
  SUNDAY,
  addDays,
  compareGameDate,
  gameDate,
  isSameOrBefore,
  lastWeekdayOfMonth,
  nextWeekdayOnOrAfter,
  nthWeekdayOfMonth,
} from './gameDate.js';

/**
 * The season's schedule of matchdays.
 *
 * The whole design rests on one rule: **a calendar slot belongs to exactly one round of exactly one
 * competition.** Build the ordered list of matchday dates first, then hand each one to a single round.
 * Because a round never contains the same club twice, and a slot never hosts two rounds, no club can be
 * booked into two matches at once — that guarantee falls out of the structure instead of needing a
 * conflict checker. Interleaving the league with a cup stops being a scheduling problem and becomes the
 * much simpler question of who gets this particular Wednesday.
 *
 * Slots alternate Sunday / Wednesday, so consecutive matchdays are always three or four days apart and
 * squads get a realistic rest gap without anything having to enforce one.
 */
export type CompetitionKind = 'LEAGUE' | 'CUP';
export type SlotType = 'WEEKEND' | 'MIDWEEK';

export interface SlotClaim {
  kind: CompetitionKind;
  /** Identifies the competition. The league uses its id; a cup uses its own. */
  competitionKey: string;
  round: number;
  /** Optional display name for a cup stage ("Oitavas de final"). */
  label?: string;
}

export interface CalendarSlot {
  date: GameDate;
  slotType: SlotType;
  /** The round playing here, or null while the slot is still free. */
  claim: SlotClaim | null;
  /**
   * Held for a competition that has not drawn this round yet. Knockout cups generate each round only
   * once the previous one has been decided (a two-legged tie, seeded clubs entering late), so their dates
   * are set aside up front by count and claimed one at a time as the bracket unfolds.
   */
  reservedFor: string | null;
}

export interface SeasonCalendar {
  seasonYear: number;
  startDate: GameDate;
  endDate: GameDate;
  /** Ascending by date, no duplicates. */
  slots: CalendarSlot[];
}

export interface CupSchedulingRequest {
  competitionKey: string;
  /** How many midweek dates to set aside for this cup across the season. */
  rounds: number;
}

export interface BuildSeasonCalendarInput {
  seasonYear: number;
  /** League rounds to place, e.g. 38 for a 20-club double round robin. */
  leagueRounds: number;
  /** The league's id, stamped onto each claimed slot. */
  leagueKey: string;
  cups?: CupSchedulingRequest[];
  /**
   * Dates these clubs are already committed to elsewhere. Removed from the pool before any round is
   * handed out, so a conflicting round moves to the next free day instead of ending up with no date.
   */
  unavailableDates?: ReadonlySet<GameDate>;
  /** State championship rounds (Fase 1: Jan-Mar), e.g. 12 or 13 rounds. */
  stateRounds?: number;
  /** State championship competition key, e.g. 'paulista'. */
  stateKey?: string;
}

/**
 * The state championship window (Fase 1: January to March): opens on the second Saturday of January
 * and closes on the last Sunday of March (12 to 14 weeks).
 */
export function stateSeasonWindow(seasonYear: number): { startDate: GameDate; endDate: GameDate } {
  return {
    startDate: nthWeekdayOfMonth(seasonYear, 1, SATURDAY, 2),
    endDate: lastWeekdayOfMonth(seasonYear, 3, SUNDAY),
  };
}

/**
 * The national competition window (Fase 2: April to December): opens on the first Saturday of April
 * and closes on the second Sunday of December.
 */
export function nationalSeasonWindow(seasonYear: number): { startDate: GameDate; endDate: GameDate } {
  return {
    startDate: nthWeekdayOfMonth(seasonYear, 4, SATURDAY, 1),
    endDate: nthWeekdayOfMonth(seasonYear, 12, SUNDAY, 2),
  };
}

/**
 * The Brazilian annual season window: opens at the start of January state championships and closes
 * on the second Sunday of December.
 */
export function seasonWindow(seasonYear: number): { startDate: GameDate; endDate: GameDate } {
  const state = stateSeasonWindow(seasonYear);
  const national = nationalSeasonWindow(seasonYear);
  return {
    startDate: state.startDate,
    endDate: national.endDate,
  };
}

export type SeasonPhase = 'PRE_SEASON' | 'IN_SEASON' | 'OFF_SEASON';

/** Where a date sits relative to the season: before it, inside it, or after it in the same year. */
export function seasonPhaseOn(date: GameDate, seasonYear: number): SeasonPhase {
  const { startDate, endDate } = seasonWindow(seasonYear);
  if (date < startDate) return 'PRE_SEASON';
  if (date > endDate) return 'OFF_SEASON';
  return 'IN_SEASON';
}

/** Every Sunday and the Wednesday that follows it, from the season's first weekend to its last. */
function generateSlots(startDate: GameDate, endDate: GameDate): CalendarSlot[] {
  const slots: CalendarSlot[] = [];
  let sunday = nextWeekdayOnOrAfter(startDate, SUNDAY);
  while (isSameOrBefore(sunday, endDate)) {
    slots.push({ date: sunday, slotType: 'WEEKEND', claim: null, reservedFor: null });
    const wednesday = addDays(sunday, 3);
    if (isSameOrBefore(wednesday, endDate)) {
      slots.push({ date: wednesday, slotType: 'MIDWEEK', claim: null, reservedFor: null });
    }
    sunday = addDays(sunday, 7);
  }
  return slots.sort((a, b) => compareGameDate(a.date, b.date));
}

/**
 * Spreads a cup's rounds across the midweek dates so its final lands late in the season rather than in
 * July. Runs from a quarter of the way in to ninety percent of the way in; a single-round cup sits at
 * sixty percent.
 */
function reserveCupSlots(slots: CalendarSlot[], cup: CupSchedulingRequest, startDate?: GameDate, endDate?: GameDate): void {
  const midweek = slots.filter((s) => {
    if (s.slotType !== 'MIDWEEK' || s.reservedFor !== null) return false;
    if (startDate && s.date < startDate) return false;
    if (endDate && s.date > endDate) return false;
    return true;
  });
  if (midweek.length === 0 || cup.rounds <= 0) return;

  const taken = new Set<number>();
  for (let i = 0; i < cup.rounds; i += 1) {
    const fraction = cup.rounds === 1 ? 0.6 : 0.25 + (i / (cup.rounds - 1)) * 0.65;
    let index = Math.min(midweek.length - 1, Math.round(fraction * (midweek.length - 1)));
    // Two rounds must never land on the same date, so walk forward off any collision.
    while (taken.has(index) && index < midweek.length - 1) index += 1;
    while (taken.has(index) && index > 0) index -= 1;
    if (taken.has(index)) break;
    taken.add(index);
    midweek[index].reservedFor = cup.competitionKey;
  }
}

/**
 * Builds the annual season calendar comprising Phase 1 (State Championships, Jan-Mar)
 * and Phase 2 (Brasileirão + Cups, Apr-Dec).
 */
export function buildAnnualCalendar(input: BuildSeasonCalendarInput): SeasonCalendar {
  const { startDate, endDate } = seasonWindow(input.seasonYear);
  const slots = generateSlots(startDate, endDate);

  // Mark days these clubs already play on as spoken for, before anything is handed out.
  const unavailable = input.unavailableDates;
  if (unavailable) {
    for (const slot of slots) if (unavailable.has(slot.date)) slot.reservedFor = '__unavailable__';
  }

  const stateWin = stateSeasonWindow(input.seasonYear);
  const natWin = nationalSeasonWindow(input.seasonYear);

  // 1. Phase 1: State Championship (Jan - Mar)
  if (input.stateRounds && input.stateKey) {
    const p1Slots = slots.filter(
      (s) => s.date >= stateWin.startDate && s.date <= stateWin.endDate && s.reservedFor === null && s.claim === null
    );
    const p1Weekends = p1Slots.filter((s) => s.slotType === 'WEEKEND');
    const p1Midweeks = p1Slots.filter((s) => s.slotType === 'MIDWEEK');

    const p1Overflow = Math.max(0, input.stateRounds - p1Weekends.length);
    const p1MidweekPicks: CalendarSlot[] = [];
    for (let i = 0; i < p1Overflow && p1Midweeks.length > 0; i += 1) {
      const fraction = p1Overflow === 1 ? 0.5 : 0.3 + (i / (p1Overflow - 1)) * 0.4;
      let index = Math.min(p1Midweeks.length - 1, Math.round(fraction * (p1Midweeks.length - 1)));
      while (p1MidweekPicks.includes(p1Midweeks[index]) && index < p1Midweeks.length - 1) index += 1;
      while (p1MidweekPicks.includes(p1Midweeks[index]) && index > 0) index -= 1;
      if (p1MidweekPicks.includes(p1Midweeks[index])) break;
      p1MidweekPicks.push(p1Midweeks[index]);
    }

    const p1Chosen = [...p1Weekends.slice(0, input.stateRounds), ...p1MidweekPicks]
      .slice(0, input.stateRounds)
      .sort((a, b) => compareGameDate(a.date, b.date));

    p1Chosen.forEach((slot, i) => {
      slot.claim = { kind: 'LEAGUE', competitionKey: input.stateKey!, round: i + 1 };
    });
  }

  // 2. Phase 2: Cups and National League (Apr - Dec)
  for (const cup of input.cups ?? []) {
    reserveCupSlots(slots, cup, natWin.startDate, natWin.endDate);
  }

  const p2Free = slots.filter(
    (s) => s.date >= natWin.startDate && s.date <= natWin.endDate && s.claim === null && s.reservedFor === null
  );
  const p2Weekends = p2Free.filter((s) => s.slotType === 'WEEKEND');
  const p2Midweeks = p2Free.filter((s) => s.slotType === 'MIDWEEK');

  // Weekends carry the league; only the overflow goes midweek. With 38 rounds against ~37 Sundays that
  // is usually a single round.
  const overflow = Math.max(0, input.leagueRounds - p2Weekends.length);
  // Spread that overflow through the middle of the season instead of taking the earliest midweek dates.
  // Grabbing the first ones available put a Sunday-Wednesday double in the opening week and left the run
  // to the title untouched, which is backwards: real leagues stack midweek rounds into the congested
  // middle, never onto the opening weekend.
  const midweekPicks: CalendarSlot[] = [];
  for (let i = 0; i < overflow && p2Midweeks.length > 0; i += 1) {
    const fraction = overflow === 1 ? 0.5 : 0.3 + (i / (overflow - 1)) * 0.4;
    let index = Math.min(p2Midweeks.length - 1, Math.round(fraction * (p2Midweeks.length - 1)));
    while (midweekPicks.includes(p2Midweeks[index]) && index < p2Midweeks.length - 1) index += 1;
    while (midweekPicks.includes(p2Midweeks[index]) && index > 0) index -= 1;
    if (midweekPicks.includes(p2Midweeks[index])) break;
    midweekPicks.push(p2Midweeks[index]);
  }

  // Rounds are played in order, so sort the chosen dates before numbering them: choosing weekends first
  // decides *which* dates get used, not what order they run in.
  const chosen = [...p2Weekends.slice(0, input.leagueRounds), ...midweekPicks]
    .slice(0, input.leagueRounds)
    .sort((a, b) => compareGameDate(a.date, b.date));
  chosen.forEach((slot, i) => {
    slot.claim = { kind: 'LEAGUE', competitionKey: input.leagueKey, round: i + 1 };
  });

  return { seasonYear: input.seasonYear, startDate, endDate, slots };
}

/**
 * Builds the season's calendar and assigns the league's rounds to dates.
 */
export function buildSeasonCalendar(input: BuildSeasonCalendarInput): SeasonCalendar {
  return buildAnnualCalendar(input);
}

/**
 * Hands a cup its next reserved date. Called when a knockout round is actually drawn, since the bracket
 * is not known in advance. Falls back to any free midweek date if the reservations ran out (a cup that
 * grew more rounds than expected), and returns null only when the season has no room left.
 */
export function claimNextCupSlot(
  calendar: SeasonCalendar,
  competitionKey: string,
  round: number,
  label?: string,
): CalendarSlot | null {
  const reserved = calendar.slots.find((s) => s.reservedFor === competitionKey && s.claim === null);
  const slot =
    reserved ??
    calendar.slots.find((s) => s.claim === null && s.reservedFor === null && s.slotType === 'MIDWEEK') ??
    calendar.slots.find((s) => s.claim === null && s.reservedFor === null);
  if (!slot) return null;
  slot.claim = { kind: 'CUP', competitionKey, round, ...(label ? { label } : {}) };
  return slot;
}

/** The dates the league's rounds landed on, indexed by round number. */
export function leagueRoundDates(calendar: SeasonCalendar, leagueKey: string): Map<number, GameDate> {
  const byRound = new Map<number, GameDate>();
  for (const slot of calendar.slots) {
    if (slot.claim?.kind === 'LEAGUE' && slot.claim.competitionKey === leagueKey) {
      byRound.set(slot.claim.round, slot.date);
    }
  }
  return byRound;
}

/** Stamps each fixture with the date its round is scheduled for. Fixtures of unscheduled rounds keep null. */
export function assignDatesToFixtures<T extends { round: number }>(
  fixtures: T[],
  roundDates: Map<number, GameDate>,
): (T & { date: GameDate | null })[] {
  return fixtures.map((fixture) => ({ ...fixture, date: roundDates.get(fixture.round) ?? null }));
}

export function slotsOn(calendar: SeasonCalendar, date: GameDate): CalendarSlot[] {
  return calendar.slots.filter((s) => s.date === date);
}

/** The first claimed matchday on or after `date` — what "advance to the next matchday" navigates to. */
export function nextMatchdayOnOrAfter(calendar: SeasonCalendar, date: GameDate): CalendarSlot | null {
  return calendar.slots.find((s) => s.claim !== null && s.date >= date) ?? null;
}

/** Convenience for the very first matchday of a season. */
export function firstMatchday(calendar: SeasonCalendar): CalendarSlot | null {
  return calendar.slots.find((s) => s.claim !== null) ?? null;
}

/** 1 January of the following year — when the season turns over. */
export function seasonTurnDate(seasonYear: number): GameDate {
  return gameDate(seasonYear + 1, 1, 1);
}

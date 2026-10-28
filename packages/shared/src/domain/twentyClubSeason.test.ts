import { describe, expect, it } from 'vitest';
import { LEAGUE_CAPACITY, generateDoubleRoundRobinFixtures } from './league.js';
import { assignDatesToFixtures, buildSeasonCalendar, leagueRoundDates, seasonWindow } from './calendar.js';
import { daysBetween } from './gameDate.js';

const clubIds = Array.from({ length: LEAGUE_CAPACITY }, (_, i) => `club-${i + 1}`);

/**
 * A top flight of twenty.
 *
 * It was eight, which made a season fourteen rounds long and over in a couple of months — not a league
 * anyone would recognise. Twenty is the real number, and it is also six and a half times the volume, so
 * these tests exist to prove the calendar can actually hold it rather than to assume it can.
 */
describe('a twenty-club season', () => {
  it('is thirty-eight rounds, with no change to the fixture generator', () => {
    const fixtures = generateDoubleRoundRobinFixtures(clubIds);
    const rounds = new Set(fixtures.map((f) => f.round));

    // 2(n-1) rounds of n/2 matches: the generator produces this for any even n, untouched.
    expect(rounds.size).toBe(38);
    expect(fixtures.length).toBe(380);
    for (const round of rounds) {
      expect(fixtures.filter((f) => f.round === round)).toHaveLength(10);
    }
  });

  it('gives every club nineteen home matches and nineteen away', () => {
    const fixtures = generateDoubleRoundRobinFixtures(clubIds);
    for (const clubId of clubIds) {
      expect(fixtures.filter((f) => f.homeClubId === clubId), `${clubId} em casa`).toHaveLength(19);
      expect(fixtures.filter((f) => f.awayClubId === clubId), `${clubId} fora`).toHaveLength(19);
    }
    // And each pairing exactly once per direction — no club meets another three times.
    const seen = new Set(fixtures.map((f) => `${f.homeClubId}>${f.awayClubId}`));
    expect(seen.size).toBe(380);
  });

  it('fits inside the season window, one round to a day', () => {
    const season = 2030;
    const { startDate, endDate } = seasonWindow(season);
    const calendar = buildSeasonCalendar({ seasonYear: season, leagueRounds: 38, leagueKey: 'liga' });
    const dateByRound = leagueRoundDates(calendar, 'liga');

    expect(dateByRound.size).toBe(38);
    // One date per round, and no date shared by two rounds — the rule the whole calendar rests on.
    expect(new Set(dateByRound.values()).size).toBe(38);
    for (const [round, date] of dateByRound) {
      expect(date >= startDate && date <= endDate, `rodada ${round} em ${date}`).toBe(true);
    }
  });

  it('never asks a club to play two days running', () => {
    const season = 2030;
    const calendar = buildSeasonCalendar({ seasonYear: season, leagueRounds: 38, leagueKey: 'liga' });
    const dated = assignDatesToFixtures(generateDoubleRoundRobinFixtures(clubIds), leagueRoundDates(calendar, 'liga'));

    const datesByClub = new Map<string, string[]>();
    for (const fixture of dated) {
      if (!fixture.date) continue;
      for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
        datesByClub.set(clubId, [...(datesByClub.get(clubId) ?? []), fixture.date]);
      }
    }

    for (const [clubId, dates] of datesByClub) {
      const sorted = [...dates].sort();
      for (let i = 1; i < sorted.length; i += 1) {
        // Thirty-eight rounds in about thirty-six weekends means some midweek football, which is exactly
        // what the real competition does. What it must never mean is back-to-back days.
        expect(daysBetween(sorted[i - 1], sorted[i]), `${clubId}: ${sorted[i - 1]} -> ${sorted[i]}`).toBeGreaterThan(1);
      }
    }
  });
});

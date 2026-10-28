import { GameDate, compareGameDate } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getActiveLeagueForClub } from './leagueService.js';

/** One dated fixture, ready to render: no ids to resolve, no second request to make. */
export interface CalendarEntry {
  date: GameDate | null;
  competitionId: string;
  competitionName: string;
  kind: 'LEAGUE' | 'CUP';
  round: number;
  /** Cup stage name ("Oitavas de final") when there is one. */
  stageName?: string;
  opponentClubId: string;
  opponentName: string;
  opponentSlug?: string | null;
  opponentCrestBase64?: string | null;
  opponentPrimaryColor?: string | null;
  opponentSecondaryColor?: string | null;
  isHome: boolean;
  matchId: string | null;
  /** Filled once played. */
  result?: { goalsFor: number; goalsAgainst: number; outcome: 'V' | 'E' | 'D' };
}

export interface ClubCalendar {
  clubId: string;
  seasonYear: number | null;
  entries: CalendarEntry[];
}

/**
 * Everything this club plays this season, in date order, across every competition.
 *
 * Fixtures with no date (a knockout round not yet drawn, or anything created before the calendar
 * existed) sort to the end rather than being dropped — a manager should still see that the tie exists.
 */
export async function getClubCalendar(clubId: string): Promise<ClubCalendar> {
  const league = await getActiveLeagueForClub(clubId);
  const seasonYear = league?.season ?? null;

  const cupRecords = await prisma.cup.findMany(
    seasonYear === null ? undefined : { where: { season: seasonYear } },
  );
  const cups = cupRecords
    .map((record) => ({
      id: record.id,
      name: record.name,
      clubIds: JSON.parse(record.clubIdsJson) as string[],
      fixtures: JSON.parse(record.fixturesJson) as {
        round: number;
        stageName?: string;
        homeClubId: string;
        awayClubId: string;
        matchId: string | null;
        date?: string | null;
      }[],
    }))
    .filter((cup) => cup.clubIds.includes(clubId));

  // Names and slugs for every club that appears as an opponent, fetched once rather than per fixture.
  const opponentIds = new Set<string>();
  for (const fixture of league?.fixtures ?? []) {
    if (fixture.homeClubId === clubId) opponentIds.add(fixture.awayClubId);
    else if (fixture.awayClubId === clubId) opponentIds.add(fixture.homeClubId);
  }
  for (const cup of cups) {
    for (const fixture of cup.fixtures) {
      if (fixture.homeClubId === clubId) opponentIds.add(fixture.awayClubId);
      else if (fixture.awayClubId === clubId) opponentIds.add(fixture.homeClubId);
    }
  }
  const clubs = await prisma.club.findMany({
    where: { id: { in: [...opponentIds] } },
    select: { id: true, name: true, slug: true, crestBase64: true, primaryColor: true, secondaryColor: true },
  });
  const nameOf = new Map(clubs.map((c) => [c.id, c.name]));
  const slugOf = new Map(clubs.map((c) => [c.id, c.slug]));
  const crestOf = new Map(clubs.map((c) => [c.id, c.crestBase64]));
  const primaryColorOf = new Map(clubs.map((c) => [c.id, c.primaryColor]));
  const secondaryColorOf = new Map(clubs.map((c) => [c.id, c.secondaryColor]));

  const matchIds = [
    ...(league?.fixtures ?? []).map((f) => f.matchId),
    ...cups.flatMap((c) => c.fixtures.map((f) => f.matchId)),
  ].filter((id): id is string => !!id);
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    select: { id: true, resultJson: true },
  });
  const resultOf = new Map(matches.map((m) => [m.id, m.resultJson ? JSON.parse(m.resultJson) : null]));

  const entries: CalendarEntry[] = [];

  const push = (
    fixture: {
      round: number;
      homeClubId: string;
      awayClubId: string;
      matchId: string | null;
      date?: string | null;
      stageName?: string;
      result?: { homeGoals: number; awayGoals: number } | null;
    },
    competitionId: string,
    competitionName: string,
    kind: 'LEAGUE' | 'CUP',
  ) => {
    const isHome = fixture.homeClubId === clubId;
    const opponentClubId = isHome ? fixture.awayClubId : fixture.homeClubId;
    // Two ways a fixture can carry a score: a stored match (one a manager watched) or the score written
    // straight onto the fixture (a bot-only game, played for its result and never stored). The calendar
    // has to show both, or every round the manager skipped past would read as unplayed.
    const raw = (fixture.matchId ? resultOf.get(fixture.matchId) : null) ?? fixture.result ?? null;
    let result: CalendarEntry['result'];
    if (raw) {
      const goalsFor = isHome ? raw.homeGoals : raw.awayGoals;
      const goalsAgainst = isHome ? raw.awayGoals : raw.homeGoals;
      result = { goalsFor, goalsAgainst, outcome: goalsFor > goalsAgainst ? 'V' : goalsFor === goalsAgainst ? 'E' : 'D' };
    }
    entries.push({
      date: fixture.date ?? null,
      competitionId,
      competitionName,
      kind,
      round: fixture.round,
      ...(fixture.stageName ? { stageName: fixture.stageName } : {}),
      opponentClubId,
      opponentName: nameOf.get(opponentClubId) ?? 'Adversário',
      opponentSlug: slugOf.get(opponentClubId) ?? null,
      opponentCrestBase64: crestOf.get(opponentClubId) ?? null,
      opponentPrimaryColor: primaryColorOf.get(opponentClubId) ?? null,
      opponentSecondaryColor: secondaryColorOf.get(opponentClubId) ?? null,
      isHome,
      matchId: fixture.matchId,
      ...(result ? { result } : {}),
    });
  };

  for (const fixture of league?.fixtures ?? []) {
    if (fixture.homeClubId !== clubId && fixture.awayClubId !== clubId) continue;
    push(fixture, league!.id, league!.name, 'LEAGUE');
  }
  for (const cup of cups) {
    for (const fixture of cup.fixtures) {
      if (fixture.homeClubId !== clubId && fixture.awayClubId !== clubId) continue;
      push(fixture, cup.id, cup.name, 'CUP');
    }
  }

  entries.sort((a, b) => {
    // Undated fixtures go last: a knockout round that has not been drawn yet still deserves to be seen,
    // just not jumbled in among the dates.
    if (!a.date && !b.date) return a.round - b.round;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return compareGameDate(a.date, b.date);
  });

  return { clubId, seasonYear, entries };
}

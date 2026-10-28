import { randomUUID } from 'node:crypto';
import { prisma, type Db } from '../db/prisma.js';

export interface CareerTenure {
  clubId: string;
  clubName: string;
  countryCode: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
}

export interface CareerTitle {
  type: 'league' | 'cup';
  name: string;
  season: number;
  division?: number;
}

export interface Career {
  tenures: CareerTenure[];
  titles: CareerTitle[];
  /** clubIds this user is currently (still) managing — an open tenure with no `endedAt`. */
  activeClubIds: string[];
}

/** Opens a new tenure — called by clubService whenever a user starts managing a club (created or claimed). */
export async function openTenure(
  userId: string,
  clubId: string,
  clubName: string,
  countryCode: string,
  db: Pick<Db, 'managerTenure'> = prisma,
): Promise<void> {
  await db.managerTenure.create({
    data: { id: randomUUID(), userId, clubId, clubName, countryCode },
  });
}

/** Closes the user's currently-open tenure for this club, if any — called by clubService.resignClub. */
export async function closeTenure(clubId: string, userId: string, endReason: string): Promise<void> {
  const open = await prisma.managerTenure.findFirst({ where: { clubId, userId, endedAt: null } });
  if (!open) return;
  await prisma.managerTenure.update({ where: { id: open.id }, data: { endedAt: new Date(), endReason } });
}

/**
 * Every club this user has ever managed, plus every league/cup title they won (reusing the same
 * `championOwnerId` captured-at-the-moment-of-winning field historyService.ts relies on — see
 * schema.prisma). This is the data behind the "Minha carreira" screen.
 */
export async function getCareer(userId: string): Promise<Career> {
  const [tenures, leagues, cups] = await Promise.all([
    prisma.managerTenure.findMany({ where: { userId }, orderBy: { startedAt: 'asc' } }),
    prisma.league.findMany({ where: { championOwnerId: userId } }),
    prisma.cup.findMany({ where: { championOwnerId: userId } }),
  ]);

  const titles: CareerTitle[] = [
    ...leagues.map((l) => ({ type: 'league' as const, name: l.name, season: l.season, division: l.division })),
    ...cups.map((c) => ({ type: 'cup' as const, name: c.name, season: c.season })),
  ];

  return {
    tenures: tenures.map((t) => ({
      clubId: t.clubId,
      clubName: t.clubName,
      countryCode: t.countryCode,
      startedAt: t.startedAt.toISOString(),
      endedAt: t.endedAt?.toISOString() ?? null,
      endReason: t.endReason,
    })),
    titles,
    activeClubIds: tenures.filter((t) => t.endedAt === null).map((t) => t.clubId),
  };
}

/**
 * A rough win/loss/title-weighted rating used only to decide which caliber of club offers this manager a
 * job (see jobOfferService.ts) — not shown to the user directly. Counts every match played by one of this
 * user's clubs while they were actually in charge of it (a tenure's [startedAt, endedAt ?? now] window),
 * so results from a *previous* manager of the same club (or a *later* one, after a resignation) don't
 * count for or against this score.
 */
export async function managerScore(userId: string): Promise<number> {
  const tenures = await prisma.managerTenure.findMany({ where: { userId } });
  const [leagueTitles, cupTitles] = await Promise.all([
    prisma.league.count({ where: { championOwnerId: userId } }),
    prisma.cup.count({ where: { championOwnerId: userId } }),
  ]);

  let wins = 0;
  let draws = 0;
  let losses = 0;

  for (const tenure of tenures) {
    const matches = await prisma.match.findMany({
      where: {
        status: 'SIMULATED',
        OR: [{ homeClubId: tenure.clubId }, { awayClubId: tenure.clubId }],
        createdAt: { gte: tenure.startedAt, ...(tenure.endedAt ? { lte: tenure.endedAt } : {}) },
      },
    });

    for (const m of matches) {
      if (!m.resultJson) continue;
      const result = JSON.parse(m.resultJson) as { homeGoals: number; awayGoals: number };
      const isHome = m.homeClubId === tenure.clubId;
      const goalsFor = isHome ? result.homeGoals : result.awayGoals;
      const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
      if (goalsFor > goalsAgainst) wins++;
      else if (goalsFor === goalsAgainst) draws++;
      else losses++;
    }
  }

  return wins * 3 + draws - losses + (leagueTitles + cupTitles) * 15;
}

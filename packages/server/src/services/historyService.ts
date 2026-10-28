import { BOT_OWNER_ID, COUNTRIES, CountryHistory } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';

function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/**
 * Every FINISHED league season and cup, grouped by country — the data behind the História screens.
 * A league keeps renewing into a new row each season (see leagueService.finalizeSeason), so this
 * naturally accumulates one entry per year without needing a separate archive table.
 */
export async function getHistory(): Promise<CountryHistory[]> {
  const [leagues, cups] = await Promise.all([
    prisma.league.findMany({ where: { status: 'FINISHED' }, orderBy: [{ countryCode: 'asc' }, { division: 'asc' }, { season: 'asc' }] }),
    prisma.cup.findMany({ where: { status: 'FINISHED' }, orderBy: [{ countryCode: 'asc' }, { season: 'asc' }] }),
  ]);

  const relevantClubIds = new Set<string>();
  for (const l of leagues) {
    if (l.championClubId) relevantClubIds.add(l.championClubId);
    if (l.topScorerClubId) relevantClubIds.add(l.topScorerClubId);
  }
  for (const c of cups) {
    if (c.championClubId) relevantClubIds.add(c.championClubId);
    if (c.topScorerClubId) relevantClubIds.add(c.topScorerClubId);
  }

  const clubs = relevantClubIds.size > 0 ? await prisma.club.findMany({ where: { id: { in: [...relevantClubIds] } } }) : [];
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  const ownerIds = new Set<string>();
  for (const club of clubs) if (club.ownerId !== BOT_OWNER_ID) ownerIds.add(club.ownerId);
  // A title's championOwnerId may belong to a manager who has since resigned/been replaced — not
  // necessarily any club's *current* owner — so it needs its own pass to end up in `users` too.
  for (const l of leagues) if (l.championOwnerId && l.championOwnerId !== BOT_OWNER_ID) ownerIds.add(l.championOwnerId);
  for (const c of cups) if (c.championOwnerId && c.championOwnerId !== BOT_OWNER_ID) ownerIds.add(c.championOwnerId);
  const users = ownerIds.size > 0 ? await prisma.user.findMany({ where: { id: { in: [...ownerIds] } } }) : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  function managerName(ownerId: string): string {
    if (ownerId === BOT_OWNER_ID) return 'CPU';
    return userById.get(ownerId)?.email ?? 'Desconhecido';
  }

  const byCountry = new Map<string, CountryHistory>();
  function bucket(countryCode: string): CountryHistory {
    let entry = byCountry.get(countryCode);
    if (!entry) {
      entry = { countryCode, countryName: countryName(countryCode), leagues: [], cups: [] };
      byCountry.set(countryCode, entry);
    }
    return entry;
  }

  for (const l of leagues) {
    if (!l.championClubId) continue;
    const club = clubById.get(l.championClubId);
    // Prefer the owner captured at the moment the title was won — the club's CURRENT owner may have
    // resigned/reclaimed it since, which would otherwise misattribute this title (see schema comment
    // on League.championOwnerId). Older rows finalized before that field existed fall back to current owner.
    const ownerId = l.championOwnerId ?? club?.ownerId;
    bucket(l.countryCode).leagues.push({
      season: l.season,
      name: l.name,
      division: l.division,
      championClubId: l.championClubId,
      championClubName: club?.name ?? l.championClubId,
      managerName: ownerId ? managerName(ownerId) : 'Desconhecido',
      topScorerName: l.topScorerName,
      topScorerGoals: l.topScorerGoals,
      topScorerClubName: l.topScorerClubId ? clubById.get(l.topScorerClubId)?.name ?? null : null,
    });
  }

  for (const c of cups) {
    if (!c.championClubId) continue;
    const club = clubById.get(c.championClubId);
    const ownerId = c.championOwnerId ?? club?.ownerId;
    bucket(c.countryCode).cups.push({
      season: c.season,
      name: c.name,
      championClubId: c.championClubId,
      championClubName: club?.name ?? c.championClubId,
      managerName: ownerId ? managerName(ownerId) : 'Desconhecido',
      topScorerName: c.topScorerName,
      topScorerGoals: c.topScorerGoals,
      topScorerClubName: c.topScorerClubId ? clubById.get(c.topScorerClubId)?.name ?? null : null,
    });
  }

  return [...byCountry.values()].sort((a, b) => a.countryName.localeCompare(b.countryName));
}

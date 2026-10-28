import { prisma } from '../db/prisma.js';
import { getLeagueWithStandings } from './leagueService.js';

/** One club changing division at the turn of the year. */
export interface DivisionMove {
  clubId: string;
  clubName: string;
  countryCode: string;
  fromDivision: number;
  toDivision: number;
  /** Where they finished the season that sent them. */
  finalPosition: number;
}

export interface PromotionOutcome {
  moves: DivisionMove[];
  /**
   * Who should contest each of last season's leagues next year, keyed by that league's id. Renewal reads
   * this instead of copying the old membership, which is the whole mechanism: the division is the thing
   * that persists, and the clubs in it are what change.
   */
  membershipByLeagueId: Map<string, string[]>;
}

/**
 * Below this, a division is too small to trade clubs at all.
 *
 * Some countries in the shipped world run a two-club tier. Exchanging even one of those every year means the
 * champion always goes up and the runner-up always comes down, guaranteed, for the life of the save: no
 * jeopardy in it, no achievement in it, just two clubs swapping places forever. A division that small stays
 * where it is until it has enough members for the result to mean something.
 */
const MIN_DIVISION_SIZE = 4;

/**
 * How many clubs go up and come down between two adjacent divisions.
 *
 * A fifth of the smaller of the two, which lands on four in a twenty-club league — the Brasileirão's own
 * number, and close to what most leagues use. Always at least one, because a pyramid where nobody moves is
 * not a pyramid, and never more than half, because a division that turns over completely is not a division.
 */
export function promotionSlots(upperSize: number, lowerSize: number): number {
  const smaller = Math.min(upperSize, lowerSize);
  if (smaller < MIN_DIVISION_SIZE) return 0;
  return Math.max(1, Math.min(Math.floor(smaller / 2), Math.round(smaller * 0.2)));
}

/** The club ids of a finished league, best first. Falls back to the stored order if nothing was played. */
async function finishingOrder(leagueId: string, clubIds: string[]): Promise<string[]> {
  const { standings } = await getLeagueWithStandings(leagueId);
  if (standings.length !== clubIds.length) return clubIds;
  return standings.map((row) => row.clubId);
}

/**
 * Access and relegation, at the turn of the year.
 *
 * The game had none: a club stayed in the division it was born into for as long as the save lasted. Winning
 * the second division was worth a line in the history screen and nothing else, "escapar do rebaixamento"
 * was an objective the board could set and never enforce, and a club founded at the bottom had no way up —
 * which is the thing that makes starting at the bottom worth doing at all.
 *
 * Equal numbers each way, so both divisions keep their size and, just as importantly, their parity: a round
 * robin needs an even number of clubs, and a tier left with an odd one never generates a fixture list.
 *
 * Nothing is written here except the clubs' new addresses. Last season's league keeps its own record of who
 * played in it, because that is history and did happen.
 */
export async function applyPromotionAndRelegation(previousSeason: number): Promise<PromotionOutcome> {
  const finished = await prisma.league.findMany({ where: { season: previousSeason, status: 'FINISHED' } });

  const membershipByLeagueId = new Map<string, string[]>();
  for (const league of finished) membershipByLeagueId.set(league.id, JSON.parse(league.clubIdsJson) as string[]);

  const byCountry = new Map<string, typeof finished>();
  for (const league of finished) {
    byCountry.set(league.countryCode, [...(byCountry.get(league.countryCode) ?? []), league]);
  }

  const moves: DivisionMove[] = [];

  for (const leagues of byCountry.values()) {
    const ladder = [...leagues].sort((a, b) => a.division - b.division);

    for (let i = 0; i < ladder.length - 1; i += 1) {
      const upper = ladder[i];
      const lower = ladder[i + 1];
      // Only genuinely adjacent tiers trade clubs. A country missing a division does not skip over the gap.
      if (lower.division !== upper.division + 1) continue;

      const upperClubs = membershipByLeagueId.get(upper.id)!;
      const lowerClubs = membershipByLeagueId.get(lower.id)!;

      const slots = promotionSlots(upperClubs.length, lowerClubs.length);
      if (slots === 0) continue;

      const upperOrder = await finishingOrder(upper.id, upperClubs);
      const lowerOrder = await finishingOrder(lower.id, lowerClubs);
      const relegated = upperOrder.slice(-slots);
      const promoted = lowerOrder.slice(0, slots);

      membershipByLeagueId.set(upper.id, [...upperOrder.filter((id) => !relegated.includes(id)), ...promoted]);
      membershipByLeagueId.set(lower.id, [...lowerOrder.filter((id) => !promoted.includes(id)), ...relegated]);

      const names = new Map(
        (await prisma.club.findMany({ where: { id: { in: [...relegated, ...promoted] } }, select: { id: true, name: true } })).map(
          (c) => [c.id, c.name],
        ),
      );

      promoted.forEach((clubId, index) =>
        moves.push({
          clubId,
          clubName: names.get(clubId) ?? clubId,
          countryCode: upper.countryCode,
          fromDivision: lower.division,
          toDivision: upper.division,
          finalPosition: index + 1,
        }),
      );
      relegated.forEach((clubId, index) =>
        moves.push({
          clubId,
          clubName: names.get(clubId) ?? clubId,
          countryCode: upper.countryCode,
          fromDivision: upper.division,
          toDivision: lower.division,
          finalPosition: upperOrder.length - slots + index + 1,
        }),
      );
    }
  }

  return { moves, membershipByLeagueId };
}

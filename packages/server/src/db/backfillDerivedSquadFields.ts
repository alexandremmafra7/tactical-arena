import { calculateWageBill } from '@tactical-arena/shared';
import type { Player } from '@tactical-arena/shared';
import { prisma } from './prisma.js';
import { computeScorerPool, computeSquadRating } from '../services/squadRating.js';

/**
 * Fills in the cached wage bills and squad ratings for clubs that predate them.
 *
 * The weekly tick charges wages from `weeklyWageBill` and `academyWageBill` rather than reading a 42 KB
 * roster per club per week. Those columns are kept correct from then on by the prisma extension, which
 * recomputes them on every roster write — but a save made before they existed has them at their default
 * of zero, and a zero here does not read as "missing", it reads as "this club pays nobody". Left alone,
 * every existing club would quietly stop having a payroll.
 *
 * So the gap is closed once, on startup, next to the schema healing that exists for exactly this class of
 * problem. A club whose roster is genuinely empty costs nothing to recompute, and the pass is skipped
 * entirely for anyone already backfilled, so this is cheap on every launch after the first.
 */
export async function backfillDerivedSquadFields(): Promise<number> {
  const stale = await prisma.club.findMany({
    where: { OR: [{ weeklyWageBill: 0 }, { ratingAttack: 0 }], NOT: { playersJson: '[]' } },
    select: { id: true, playersJson: true, academyPlayersJson: true },
  });

  for (const club of stale) {
    const players = JSON.parse(club.playersJson) as Player[];
    const rating = computeSquadRating(players);
    await prisma.club.update({
      where: { id: club.id },
      data: {
        weeklyWageBill: Math.round(calculateWageBill(players)),
        academyWageBill: Math.round(calculateWageBill(JSON.parse(club.academyPlayersJson) as Player[])),
        ratingAttack: rating.attack,
        ratingDefense: rating.defense,
        ratingGoalkeeping: rating.goalkeeping,
        scorerPoolJson: JSON.stringify(computeScorerPool(players)),
      },
    });
  }

  return stale.length;
}

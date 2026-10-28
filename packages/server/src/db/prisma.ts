import { PrismaClient } from '@prisma/client';
import { calculateWageBill } from '@tactical-arena/shared';
import type { Player } from '@tactical-arena/shared';
import { computeScorerPool, computeSquadRating } from '../services/squadRating.js';


/**
 * Bookkeeping that must never be left to whoever remembers.
 *
 * Two facts about a club are derived from its rosters and kept beside them: how many weeks of rest are
 * still owed to the squad (`pendingRestWeeks`, folded in lazily by `clubService.toDomain`) and what the
 * rosters cost in wages (`weeklyWageBill`, `academyWageBill`). Both exist so the weekly tick can run for
 * the whole world without reading a 42 KB roster per club — measured at 87% of the tick's entire cost.
 *
 * Both are only correct as long as they are updated *every single time* a roster is written, and rosters
 * are written from two dozen places across nine services: transfers, the team editor, the academy,
 * post-match updates, the season turn, club creation. Asking each of them to remember would be a bug
 * waiting to happen, and a silent one — a missed update does not throw, it just quietly applies a week of
 * rest twice or charges last month's wages forever.
 *
 * So it is not asked. Any write that carries a roster passes through here and gets the derived fields
 * recomputed whether the caller thought about them or not. `pendingRestWeeks` resets to zero because the
 * players being written were read through `toDomain`, which already folded the owed rest into them.
 */
function withDerivedSquadFields<T extends Record<string, unknown>>(data: T): T {
  const patch: Record<string, unknown> = {};

  if (typeof data.playersJson === 'string') {
    const players = JSON.parse(data.playersJson) as Player[];
    patch.weeklyWageBill = Math.round(calculateWageBill(players));
    patch.pendingRestWeeks = 0;

    // What a background match reads instead of the roster itself (see squadRating.ts).
    const rating = computeSquadRating(players);
    patch.ratingAttack = rating.attack;
    patch.ratingDefense = rating.defense;
    patch.ratingGoalkeeping = rating.goalkeeping;
    patch.scorerPoolJson = JSON.stringify(computeScorerPool(players));
  }
  if (typeof data.academyPlayersJson === 'string') {
    patch.academyWageBill = Math.round(calculateWageBill(JSON.parse(data.academyPlayersJson) as Player[]));
    patch.pendingRestWeeks = 0;
  }

  return Object.keys(patch).length > 0 ? { ...data, ...patch } : data;
}

export function makePrisma(url?: string) {
  const base = new PrismaClient(
    url ? { datasources: { db: { url } } } : undefined,
  );

  return base.$extends({
    query: {
      club: {
        async create({ args, query }) {
          return query({ ...args, data: withDerivedSquadFields(args.data as Record<string, unknown>) as typeof args.data });
        },
        async update({ args, query }) {
          return query({ ...args, data: withDerivedSquadFields(args.data as Record<string, unknown>) as typeof args.data });
        },
        async updateMany({ args, query }) {
          return query({ ...args, data: withDerivedSquadFields(args.data as Record<string, unknown>) as typeof args.data });
        },
        async upsert({ args, query }) {
          return query({
            ...args,
            create: withDerivedSquadFields(args.create as Record<string, unknown>) as typeof args.create,
            update: withDerivedSquadFields(args.update as Record<string, unknown>) as typeof args.update,
          });
        },
      },
    },
  });
}

export type Db = ReturnType<typeof makePrisma>;
export const prisma: Db = makePrisma();

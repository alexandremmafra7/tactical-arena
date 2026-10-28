import { randomUUID } from 'node:crypto';
import {
  autoFillLineup,
  pressingOf,
  type Club,
} from '@tactical-arena/shared';
import { prisma, type Db } from '../db/prisma.js';

/** Stores the valid starting XI that every newly assigned club must have. */
export async function fieldDefaultTactic(
  club: Club,
  db: Pick<Db, 'tacticPreset'> = prisma,
): Promise<void> {
  const tactic = autoFillLineup(club);

  await db.tacticPreset.updateMany({
    where: { clubId: club.id, isDefault: true },
    data: { isDefault: false },
  });
  await db.tacticPreset.create({
    data: {
      id: randomUUID(),
      clubId: club.id,
      name: `Padrão (${tactic.formation})`,
      formation: tactic.formation,
      mentality: tactic.mentality,
      attackStyle: tactic.attackStyle,
      markingStyle: tactic.markingStyle,
      attackApproach: tactic.attackApproach,
      pressing: pressingOf(tactic),
      lineupJson: JSON.stringify(tactic.lineup),
      substitutesJson: JSON.stringify(tactic.substitutes ?? []),
      isDefault: true,
    },
  });
}

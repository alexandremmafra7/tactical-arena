import { randomUUID } from 'node:crypto';
import { DEFAULT_PRESSING, Tactic, TacticPreset, pressingOf } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub } from './clubService.js';

export class TacticPresetError extends Error {}

export async function savePreset(clubId: string, requestingUserId: string, name: string, tactic: Tactic): Promise<TacticPreset> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new TacticPresetError('Você não é o dono deste clube');
  }
  if (!name.trim()) {
    throw new TacticPresetError('Nome do plano é obrigatório');
  }

  const id = randomUUID();
  const record = await prisma.tacticPreset.create({
    data: {
      id,
      clubId,
      name: name.trim(),
      formation: tactic.formation,
      mentality: tactic.mentality,
      attackStyle: tactic.attackStyle,
      markingStyle: tactic.markingStyle,
      attackApproach: tactic.attackApproach,
      pressing: pressingOf(tactic),
      lineupJson: JSON.stringify(tactic.lineup),
      substitutesJson: JSON.stringify(tactic.substitutes ?? []),
    },
  });

  return toDomain(record);
}

export async function listPresets(clubId: string): Promise<TacticPreset[]> {
  const records = await prisma.tacticPreset.findMany({ where: { clubId }, orderBy: { createdAt: 'desc' } });
  return records.map(toDomain);
}

/** The club's current default preset (used by league fixtures instead of auto-filling), if any is set. */
export async function getDefaultPreset(clubId: string): Promise<TacticPreset | null> {
  const record = await prisma.tacticPreset.findFirst({ where: { clubId, isDefault: true } });
  return record ? toDomain(record) : null;
}

/**
 * The standing lineups of many clubs at once, for a whole round of fixtures.
 *
 * Asking club by club is one query per team per match, which across a world of leagues is thousands of
 * round trips on a matchday — and almost every one of them comes back empty, because a computer-run club
 * has no saved preset at all.
 */
export async function getDefaultPresets(clubIds: string[]): Promise<Map<string, TacticPreset>> {
  if (clubIds.length === 0) return new Map();
  const records = await prisma.tacticPreset.findMany({ where: { clubId: { in: clubIds }, isDefault: true } });
  return new Map(records.map((record) => [record.clubId, toDomain(record)]));
}

/** Marks one preset as the club's default, clearing the flag on any previous default (at most one at a time). */
export async function setDefaultPreset(presetId: string, requestingUserId: string): Promise<TacticPreset> {
  const record = await prisma.tacticPreset.findUnique({ where: { id: presetId } });
  if (!record) {
    throw new TacticPresetError('Plano não encontrado');
  }
  const club = await getClub(record.clubId);
  if (club.ownerId !== requestingUserId) {
    throw new TacticPresetError('Você não é o dono deste plano');
  }

  await prisma.$transaction([
    prisma.tacticPreset.updateMany({ where: { clubId: record.clubId, isDefault: true }, data: { isDefault: false } }),
    prisma.tacticPreset.update({ where: { id: presetId }, data: { isDefault: true } }),
  ]);

  return { ...toDomain(record), isDefault: true };
}

export async function deletePreset(presetId: string, requestingUserId: string): Promise<void> {
  const record = await prisma.tacticPreset.findUnique({ where: { id: presetId } });
  if (!record) {
    throw new TacticPresetError('Plano não encontrado');
  }

  const club = await getClub(record.clubId);
  if (club.ownerId !== requestingUserId) {
    throw new TacticPresetError('Você não é o dono deste plano');
  }

  await prisma.tacticPreset.delete({ where: { id: presetId } });
}

interface TacticPresetRecord {
  id: string;
  clubId: string;
  name: string;
  formation: string;
  mentality: string;
  attackStyle: string;
  markingStyle: string;
  attackApproach: string;
  pressing?: string | null;
  lineupJson: string;
  substitutesJson: string;
  isDefault: boolean;
}

function toDomain(record: TacticPresetRecord): TacticPreset {
  return {
    id: record.id,
    clubId: record.clubId,
    name: record.name,
    formation: record.formation as TacticPreset['formation'],
    mentality: record.mentality as TacticPreset['mentality'],
    attackStyle: record.attackStyle as TacticPreset['attackStyle'],
    markingStyle: record.markingStyle as TacticPreset['markingStyle'],
    // Presets saved before this dial existed read as the neutral middle rather than undefined.
    attackApproach: record.attackApproach as TacticPreset['attackApproach'],
    pressing: (record.pressing as TacticPreset['pressing']) ?? DEFAULT_PRESSING,
    lineup: JSON.parse(record.lineupJson),
    substitutes: JSON.parse(record.substitutesJson),
    isDefault: record.isDefault,
  };
}

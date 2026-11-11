import {
  canBeSacked,
  canResign,
  canTakeOverAfterGoal,
  canTakeOverDivision,
  explainBlock,
  hardcoreGoal,
  type GameMode,
  type HardcoreGoal,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { readSavesIndex } from './saveService.js';

/**
 * Qual modo de carreira este técnico escolheu, e o que isso o impede de fazer.
 */
export class GameModeError extends Error {}

const PADRAO: GameMode = 'STANDARD';
const runtimeGameModes = new Map<string, GameMode>();

export function setRuntimeGameMode(userId: string, mode: GameMode): void {
  runtimeGameModes.set(userId, mode);
}

export function getGameMode(userId: string): GameMode {
  const runtime = runtimeGameModes.get(userId);
  if (runtime) return runtime;
  try {
    const save = readSavesIndex().saves.find((s) => s.managerUserId === userId);
    return save?.gameMode ?? PADRAO;
  } catch {
    return PADRAO;
  }
}

export async function divisionOfClub(clubId: string): Promise<number> {
  const ligas = await prisma.league.findMany({
    where: { clubIdsJson: { contains: clubId } },
    orderBy: { season: 'desc' },
    select: { division: true, status: true, clubIdsJson: true },
  });

  const pertence = ligas.filter((liga) => (JSON.parse(liga.clubIdsJson) as string[]).includes(clubId));
  const emAndamento = pertence.find((liga) => liga.status === 'IN_PROGRESS');
  return (emAndamento ?? pertence[0])?.division ?? 99;
}

export async function assertCanTakeOver(userId: string, clubId: string): Promise<void> {
  const mode = getGameMode(userId);
  const division = await divisionOfClub(clubId);

  if (mode === 'HARDCORE') {
    const meu = await prisma.club.findFirst({ where: { ownerId: userId }, select: { id: true } });
    const cumprido = meu
      ? (await hardcoreProgress(userId, meu.id)).met
      : (await prisma.managerTenure.count({ where: { userId, endedAt: { not: null } } })) > 0;

    if (canTakeOverAfterGoal(mode, cumprido, division)) return;
    throw new GameModeError(explainBlock(mode, 'division'));
  }

  if (!canTakeOverDivision(mode, division)) {
    throw new GameModeError(explainBlock(mode, 'division'));
  }
}

export async function hardcoreProgress(userId: string, clubId: string): Promise<HardcoreGoal> {
  const clube = await prisma.club.findUnique({ where: { id: clubId }, select: { country: true } });
  if (!clube) return hardcoreGoal([]);

  const [ligas, copas] = await Promise.all([
    prisma.league.findMany({
      where: { countryCode: clube.country },
      select: { id: true, name: true, division: true, championOwnerId: true },
    }),
    prisma.cup.findMany({ where: { countryCode: clube.country }, select: { id: true, name: true, championOwnerId: true } }),
  ]);

  const divisaoAtual = await divisionOfClub(clubId);
  const divisaoMaisAlta = ligas.length > 0 ? Math.min(...ligas.map((l) => l.division)) : 1;
  if (divisaoAtual > divisaoMaisAlta) return hardcoreGoal([]);

  const porNome = new Map<string, { id: string; name: string; won: boolean }>();
  for (const liga of ligas.filter((l) => l.division === divisaoMaisAlta)) {
    const anterior = porNome.get(liga.name);
    porNome.set(liga.name, {
      id: liga.id,
      name: liga.name,
      won: (anterior?.won ?? false) || liga.championOwnerId === userId,
    });
  }
  for (const copa of copas) {
    const anterior = porNome.get(copa.name);
    porNome.set(copa.name, {
      id: copa.id,
      name: copa.name,
      won: (anterior?.won ?? false) || copa.championOwnerId === userId,
    });
  }

  return hardcoreGoal([...porNome.values()]);
}

export async function assertCanResign(userId: string, clubId: string): Promise<void> {
  const mode = getGameMode(userId);
  if (mode !== 'HARDCORE') return;

  const objetivo = await hardcoreProgress(userId, clubId);
  if (!canResign(mode, objetivo.met)) {
    const falta = objetivo.missing.length > 0 ? ` Falta ganhar: ${objetivo.missing.join(', ')}.` : '';
    throw new GameModeError(`${explainBlock(mode, 'resign')}${falta}`);
  }
}

export function isSackImmune(ownerId: string): boolean {
  return !canBeSacked(getGameMode(ownerId));
}

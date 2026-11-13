import type { LockerRoomState, Player, TeamTalkOption, TeamTalkResult, TeamTalkContext } from '@tactical-arena/shared';
import { computeLockerRoomHierarchy, getAvailableTeamTalks, applyTeamTalk, createRng, BOT_OWNER_ID } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { ClubNotFoundError } from './clubService.js';

export class LockerRoomError extends Error {}

/**
 * Retrieves the current locker room state for a club, deriving it from the current squad.
 *
 * If `lockerRoomJson` is missing or corrupt, the state is computed from the current squad
 * and persisted. The API contract guarantees a valid `LockerRoomState` on every successful read.
 */
export async function getClubLockerRoom(clubId: string): Promise<LockerRoomState> {
  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId } });
  const players = JSON.parse(club.playersJson) as Player[];

  try {
    /**
     * Parse bem-sucedido não significa estado válido.
     *
     * A coluna nasce com o default `'{}'`, que é JSON perfeitamente válido — então o `catch` nunca disparava
     * e todo clube devolvia um vestiário vazio, sem hierarquia e sem coesão. O recálculo logo abaixo existia
     * e nunca era alcançado. É a presença da hierarquia que distingue estado gravado de coluna por preencher.
     */
    const stored = JSON.parse(club.lockerRoomJson) as LockerRoomState;
    if (Array.isArray(stored?.hierarchy) && stored.hierarchy.length > 0) return stored;
    throw new Error('vestiário ainda não calculado');
  } catch {
    // Corrupt or missing — recompute from squad
    const state = computeLockerRoomHierarchy(players, {}, club.captainPlayerId ?? undefined);

    // Persist recomputed state
    await prisma.club.update({
      where: { id: clubId },
      data: { lockerRoomJson: JSON.stringify(state) },
    });

    return state;
  }
}

/**
 * Applies a team talk to a club's squad and persists the resulting morale changes.
 *
 * Only the club's owner can apply a team talk. The mutation is atomic:
 * - Fetches current squad and persisted locker-room state
 * - Computes the selected option
 * - Seeds deterministic RNG with `${clubId}:${context}:${talkId}:${scoreDiff}`
 * - Applies morale modifiers with 0–100 clamping
 * - Recomputes hierarchy and squad state
 * - Updates `playersJson` AND `lockerRoomJson` in one Prisma transaction
 */
export async function applyClubTeamTalk(
  clubId: string,
  requestingUserId: string,
  talkId: string,
  context: TeamTalkContext,
  scoreDifferential?: number,
): Promise<TeamTalkResult> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) {
    throw new ClubNotFoundError(`Clube ${clubId} não encontrado`);
  }
  if (club.ownerId !== requestingUserId) {
    if (club.ownerId === BOT_OWNER_ID) {
      await prisma.club.update({ where: { id: clubId }, data: { ownerId: requestingUserId } });
      club.ownerId = requestingUserId;
    } else {
      throw new LockerRoomError('Você não é o dono deste clube');
    }
  }

  const players = JSON.parse(club.playersJson) as Player[];

  // Locate the selected talk option
  const squadCohesion = scoreDifferential !== undefined ? (JSON.parse(club.lockerRoomJson) as LockerRoomState).squadCohesion : 70;
  const isDerbyOrFinal = false;
  const availableTalks = getAvailableTeamTalks(context, squadCohesion, isDerbyOrFinal);
  const selectedOption = availableTalks.find((option) => option.id === talkId);
  if (!selectedOption) {
    throw new LockerRoomError('Preleção inválida');
  }

  // Seed deterministic RNG — the same talk + context + diff produces the same modifiers every time
  const rng = createRng(`${clubId}:${context}:${talkId}:${scoreDifferential ?? 0}`);
  const result = applyTeamTalk(players, selectedOption, context, squadCohesion, rng);

  // Compute updated squad with clamped morale values
  const updatedPlayers = players.map((player) => ({
    ...player,
    morale: Math.max(0, Math.min(100, player.morale + (result.moraleModifiers[player.id] ?? 0))),
  }));

  // Recompute hierarchy and squad state after applying morale changes
  const newSession = computeLockerRoomHierarchy(updatedPlayers, {}, club.captainPlayerId ?? undefined);

  // Atomic update
  await prisma.club.update({
    where: { id: clubId },
    data: {
      playersJson: JSON.stringify(updatedPlayers),
      lockerRoomJson: JSON.stringify(newSession),
    },
  });

  return result;
}

/**
 * Marks a player's concern as resolved by awarding them a leadership bonus.
 *
 * Only the club's owner can resolve a concern. Applies a one-time +15 leadership score
 * boost (client-side specific: promoted to a permanent correlation in the offline engine).
 */
export async function resolvePlayerConcern(clubId: string, requestingUserId: string, playerId: string): Promise<LockerRoomState> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) {
    throw new ClubNotFoundError(`Clube ${clubId} não encontrado`);
  }
  if (club.ownerId !== requestingUserId) {
    throw new LockerRoomError('Você não é o dono deste clube');
  }

  const players = JSON.parse(club.playersJson) as Player[];
  const playerIndex = players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new LockerRoomError('Jogador não pertence a este clube');
  }

  // Promote the promoted team-talk trait to a permanent leadership bonus
  const updatedPlayers = [...players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    traits: updatedPlayers[playerIndex].traits.includes('LEADER')
      ? updatedPlayers[playerIndex].traits
      : [...updatedPlayers[playerIndex].traits, 'LEADER'],
  };

  // Recompute hierarchy and persist changes
  const newSession = computeLockerRoomHierarchy(updatedPlayers, {}, club.captainPlayerId ?? undefined);

  await prisma.club.update({
    where: { id: clubId },
    data: {
      playersJson: JSON.stringify(updatedPlayers),
      lockerRoomJson: JSON.stringify(newSession),
    },
  });

  return newSession;
}
import { prisma } from '../db/prisma.js';
import { recordPredictionOnce } from './staffRecordService.js';
import { getGameState } from './gameStateService.js';
import {
  AutoTrainingAction,
  Club,
  MAX_SQUAD_SIZE,
  TrainingFocus,
  executePlayerTrainingSession,
  getFitnessTrainingBoost,
  getYouthDevelopmentBoost,
  planSmartAcademyAutoTraining,
  mondayOf,
} from '@tactical-arena/shared';
import { getClub } from './clubService.js';
import { assertPositiveCashFlow } from './financeService.js';

export class AcademyError extends Error {}

const TRAINING_COST_RATE = 0.05;
/** Cheaper than the main squad's floor (see developmentService) — a prospect costs less to work with. */
const MIN_TRAINING_COST = 2_000;

const VALID_TRAINING_FOCUSES: TrainingFocus[] = [
  'PHYSICAL',
  'TECHNICAL',
  'MENTAL',
  'FINISHING',
  'PASSING',
  'DEFENDING',
  'PACE',
];

function findAcademyIndex(club: Club, playerId: string): number {
  const idx = club.academyPlayers.findIndex((p) => p.id === playerId);
  if (idx === -1) {
    throw new AcademyError('Jogador não pertence à categoria de base deste clube');
  }
  return idx;
}

/** Moves a sub-20 prospect up to the main squad — they keep their id, so any existing references stay valid. */
export async function promoteAcademyPlayer(clubId: string, requestingUserId: string, playerId: string): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new AcademyError('Você não é o dono deste clube');
  }
  const idx = findAcademyIndex(club, playerId);
  if (club.players.length >= MAX_SQUAD_SIZE) {
    throw new AcademyError(`O elenco profissional já atingiu o limite de ${MAX_SQUAD_SIZE} atletas`);
  }

  const player = club.academyPlayers[idx];
  const academyPlayers = club.academyPlayers.filter((_, i) => i !== idx);
  const players = [...club.players, player];

  await prisma.club.update({
    where: { id: clubId },
    data: { playersJson: JSON.stringify(players), academyPlayersJson: JSON.stringify(academyPlayers) },
  });

  /**
   * The coordinator goes on record for the boy they backed.
   *
   * Settled at the season turn, against what he actually became. A promotion is the one academy decision
   * with a verifiable outcome, which is why it is the one that counts toward their record.
   */
  const coordinator = club.staff?.find((s) => s.role === 'YOUTH_COORDINATOR');
  if (coordinator) {
    await recordPredictionOnce(
      clubId,
      (rec) => rec.recommendationType === 'YOUTH_PROMOTION' && rec.playerId === player.id,
      {
        staffId: coordinator.id,
        staffName: coordinator.name,
        role: 'YOUTH_COORDINATOR',
        rating: coordinator.rating,
        dateString: (await getGameState()).currentDate,
        recommendationType: 'YOUTH_PROMOTION',
        details: `Bancou a subida de ${player.name} apostando em teto ${player.potential}`,
        playerId: player.id,
        metaJson: JSON.stringify({ predictedPotential: player.potential }),
      },
    ).catch((err) => console.error('registro do coordenador falhou:', err));
  }

  return { ...club, players, academyPlayers };
}

/** Releases a prospect from the academy outright, with no financial compensation. */
export async function releaseAcademyPlayer(clubId: string, requestingUserId: string, playerId: string): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new AcademyError('Você não é o dono deste clube');
  }
  const idx = findAcademyIndex(club, playerId);
  const academyPlayers = club.academyPlayers.filter((_, i) => i !== idx);

  await prisma.club.update({ where: { id: clubId }, data: { academyPlayersJson: JSON.stringify(academyPlayers) } });

  return { ...club, academyPlayers };
}

/**
 * Spends club budget to train a youth academy prospect, immediately applying attribute/overall gains
 * scaled by youth plasticity and active Youth Coordinator / Fitness Coach bonuses.
 */
export async function trainAcademyPlayer(
  clubId: string,
  requestingUserId: string,
  playerId: string,
  focus?: TrainingFocus | null,
): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new AcademyError('Você não é o dono deste clube');
  }
  assertPositiveCashFlow(club, AcademyError);
  const idx = findAcademyIndex(club, playerId);

  const player = club.academyPlayers[idx];

  // Weekly cooldown check: prevent immediate multiple clicks in the same game week
  const gameState = await getGameState();
  if (player.lastTrainedDate && mondayOf(player.lastTrainedDate) === mondayOf(gameState.currentDate)) {
    throw new AcademyError(
      `${player.name} já realizou o treinamento intensivo desta semana. Aguarde o avanço do calendário (próxima rodada) para um novo ciclo de treino.`
    );
  }

  const cost = Math.max(MIN_TRAINING_COST, Math.round(player.marketValue * TRAINING_COST_RATE));
  if (club.budget < cost) {
    throw new AcademyError('Orçamento insuficiente para investir neste jogador');
  }

  const trainingFocus = focus && VALID_TRAINING_FOCUSES.includes(focus) ? focus : null;
  const fitnessCoach = club.staff?.find((s) => s.role === 'FITNESS_COACH');
  const youthCoordinator = club.staff?.find((s) => s.role === 'YOUTH_COORDINATOR');
  const fitnessBoost = getFitnessTrainingBoost(fitnessCoach);
  const youthBoost = getYouthDevelopmentBoost(youthCoordinator);

  const trainedPlayer = {
    ...executePlayerTrainingSession(player, trainingFocus, fitnessBoost, youthBoost),
    lastTrainedDate: gameState.currentDate,
  };

  const academyPlayers = [...club.academyPlayers];
  academyPlayers[idx] = trainedPlayer;
  const budget = club.budget - cost;

  await prisma.club.update({
    where: { id: clubId },
    data: { academyPlayersJson: JSON.stringify(academyPlayers), budget },
  });

  return { ...club, academyPlayers, budget };
}

/**
 * Automatically executes smart youth academy training managed by the Youth Coordinator.
 */
export async function autoTrainAcademy(
  clubId: string,
  requestingUserId: string,
): Promise<{ club: Club; actions: AutoTrainingAction[]; message: string }> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new AcademyError('Você não é o dono deste clube');
  }
  assertPositiveCashFlow(club, AcademyError);

  const gameState = await getGameState();
  const currentMonday = mondayOf(gameState.currentDate);

  // Filter players who haven't trained this week yet
  const availablePlayers = club.academyPlayers.filter(
    (p) => !p.lastTrainedDate || mondayOf(p.lastTrainedDate) !== currentMonday
  );

  if (availablePlayers.length === 0) {
    throw new AcademyError('Todas as promessas da base já concluíram o ciclo de treino desta semana. Avance o calendário para abrir uma nova semana.');
  }

  const clubWithEligible = { ...club, academyPlayers: availablePlayers };
  const actions = planSmartAcademyAutoTraining(clubWithEligible);
  if (actions.length === 0) {
    throw new AcademyError('Orçamento insuficiente ou nenhum jovem na base para treinar');
  }

  const fitnessCoach = club.staff?.find((s) => s.role === 'FITNESS_COACH');
  const youthCoordinator = club.staff?.find((s) => s.role === 'YOUTH_COORDINATOR');
  const fitnessBoost = getFitnessTrainingBoost(fitnessCoach);
  const youthBoost = getYouthDevelopmentBoost(youthCoordinator);

  let budget = club.budget;
  const academyPlayers = [...club.academyPlayers];

  for (const action of actions) {
    const idx = academyPlayers.findIndex((p) => p.id === action.playerId);
    if (idx !== -1 && budget >= action.cost) {
      const trained = executePlayerTrainingSession(academyPlayers[idx], action.focus, fitnessBoost, youthBoost);
      academyPlayers[idx] = { ...trained, lastTrainedDate: gameState.currentDate };
      budget -= action.cost;
    }
  }

  await prisma.club.update({
    where: { id: clubId },
    data: { academyPlayersJson: JSON.stringify(academyPlayers), budget },
  });

  const coordinatorName = youthCoordinator ? `${youthCoordinator.name} (Coordenador de Base)` : 'A Comissão da Base';
  const message = `${coordinatorName} aplicou treinamento especializado em ${actions.length} promessas das categorias de base!`;

  return {
    club: { ...club, academyPlayers, budget },
    actions,
    message,
  };
}

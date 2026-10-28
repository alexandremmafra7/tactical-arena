import { randomUUID } from 'node:crypto';
import {
  isAtPotential,
  AutoTrainingAction,
  Club,
  Player,
  StadiumConstruction,
  TrainingFocus,
  applyFinancialMorale,
  calculateMaintenanceCost,
  calculateStadiumRevenue,
  calculateWageBill,
  createRng,
  evolvePlayer,
  executePlayerTrainingSession,
  getFitnessTrainingBoost,
  getYouthDevelopmentBoost,
  generateAcademyProspect,
  getStadiumLevelInfo,
  hasRetired,
  planSmartAutoTraining,
  regenerateRetiredPlayer,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub } from './clubService.js';
import { assertPositiveCashFlow } from './financeService.js';

export class DevelopmentError extends Error {}

const TRAINING_COST_RATE = 0.05;
const MIN_TRAINING_COST = 5_000;

/** Youth prospects graduate out of the academy once they're no longer sub-20. */
const ACADEMY_GRADUATION_AGE = 20;

const VALID_TRAINING_FOCUSES: TrainingFocus[] = [
  'PHYSICAL',
  'TECHNICAL',
  'MENTAL',
  'FINISHING',
  'PASSING',
  'DEFENDING',
  'PACE',
];

/**
 * Spends club budget to train a player, immediately executing the training session,
 * applying attribute/overall gains and staff bonuses.
 */
export async function investInPlayer(
  clubId: string,
  requestingUserId: string,
  playerId: string,
  focus?: TrainingFocus | null,
): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new DevelopmentError('Você não é o dono deste clube');
  }
  assertPositiveCashFlow(club, DevelopmentError);

  const playerIndex = club.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new DevelopmentError('Jogador não pertence a este clube');
  }

  const player = club.players[playerIndex];

  /**
   * Não se cobra por um treino que não pode dar nada.
   *
   * Um jogador no teto do potencial não ganha atributo nenhum, e antes disto o clube pagava do mesmo jeito:
   * dez sessões num atleta de vinte e seis anos custavam seiscentos e setenta mil e não mudavam um ponto da
   * ficha dele. Recusar é mais honesto que cobrar e não entregar.
   */
  if (isAtPotential(player)) {
    throw new DevelopmentError(`${player.name} já atingiu o potencial máximo dele e não evolui mais com treino`);
  }

  const cost = Math.max(MIN_TRAINING_COST, Math.round(player.marketValue * TRAINING_COST_RATE));
  if (club.budget < cost) {
    throw new DevelopmentError('Orçamento insuficiente para investir neste jogador');
  }

  const trainingFocus = focus && VALID_TRAINING_FOCUSES.includes(focus) ? focus : null;
  const fitnessCoach = club.staff?.find((s) => s.role === 'FITNESS_COACH');
  const youthCoordinator = club.staff?.find((s) => s.role === 'YOUTH_COORDINATOR');
  const fitnessBoost = getFitnessTrainingBoost(fitnessCoach);
  const youthBoost = getYouthDevelopmentBoost(youthCoordinator);

  const trainedPlayer = executePlayerTrainingSession(player, trainingFocus, fitnessBoost, youthBoost);

  const updatedPlayers = [...club.players];
  updatedPlayers[playerIndex] = trainedPlayer;
  const updatedBudget = club.budget - cost;

  await prisma.club.update({
    where: { id: clubId },
    data: { playersJson: JSON.stringify(updatedPlayers), budget: updatedBudget },
  });

  return { ...club, players: updatedPlayers, budget: updatedBudget };
}

/**
 * Executes a smart automated training session managed by the club's coaching staff and fitness coach.
 */
export async function autoTrainSquad(
  clubId: string,
  requestingUserId: string,
): Promise<{ club: Club; actions: AutoTrainingAction[]; message: string }> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new DevelopmentError('Você não é o dono deste clube');
  }
  assertPositiveCashFlow(club, DevelopmentError);

  const actions = planSmartAutoTraining(club);
  if (actions.length === 0) {
    throw new DevelopmentError('Orçamento insuficiente ou nenhum atleta elegível para treinamento no momento');
  }

  const fitnessCoach = club.staff?.find((s) => s.role === 'FITNESS_COACH');
  const youthCoordinator = club.staff?.find((s) => s.role === 'YOUTH_COORDINATOR');
  const fitnessBoost = getFitnessTrainingBoost(fitnessCoach);
  const youthBoost = getYouthDevelopmentBoost(youthCoordinator);

  let updatedBudget = club.budget;
  const updatedPlayers = [...club.players];

  for (const action of actions) {
    const idx = updatedPlayers.findIndex((p) => p.id === action.playerId);
    if (idx !== -1 && updatedBudget >= action.cost) {
      updatedPlayers[idx] = executePlayerTrainingSession(updatedPlayers[idx], action.focus, fitnessBoost, youthBoost);
      updatedBudget -= action.cost;
    }
  }

  await prisma.club.update({
    where: { id: clubId },
    data: { playersJson: JSON.stringify(updatedPlayers), budget: updatedBudget },
  });

  const staffName = fitnessCoach ? `${fitnessCoach.name} (Preparador Físico)` : 'A Comissão Técnica';
  const message = `${staffName} planejou e executou o treino intensivo de ${actions.length} atletas com foco em evolução e condicionamento!`;

  return {
    club: { ...club, players: updatedPlayers, budget: updatedBudget },
    actions,
    message,
  };
}

/**
 * `advanceWeek` lived here: one club, one owner, one button, doing a week of finances and a year of
 * ageing in the same call. Time is not a per-club action any more — see `weeklyTickService` for the week
 * the whole world lives through, and `seasonTurnService` for the year.
 */

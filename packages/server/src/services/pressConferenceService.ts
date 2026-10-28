import {
  type InterviewType,
  type InterviewTriggerContext,
  type PressConferenceContext,
  type PressConferenceResult,
  type PressConferenceImpact,
  type InterviewQuestion,
  type InterviewAnswerOption,
  type InterviewResponse,
  type DelegationOption,
  calculatePressConferenceImpact,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { ClubNotFoundError } from './clubService.js';

/**
 * Service for managing press conferences (Passo 5 - Sistema de entrevistas coletivas & mídia pós-jogo)
 */

/**
 * Creates a new press conference for a club
 * @param clubId - The ID of the club
 * @param userId - The ID of the user requesting the press conference
 * @param type - The type of interview
 * @param trigger - The trigger context for the interview
 * @returns The created press conference
 */
export async function createPressConference(
  clubId: string,
  userId: string,
  type: InterviewType,
  trigger: InterviewTriggerContext
) {
  // Verify club exists and user owns it
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) {
    throw new ClubNotFoundError(`Clube ${clubId} não encontrado`);
  }
  if (club.ownerId !== userId) {
    throw new Error('Você não é o dono deste clube');
  }

  // Get total questions available for this type (this would come from a question bank)
  // For now, we'll use a placeholder - in a real implementation, this would fetch from a question database
  const totalQuestions = 10; // Placeholder

  // Select questions for this interview (in reality, this would be randomized based on type/trigger)
  const selectedQuestions: string[] = [];
  for (let i = 0; i < Math.min(5, totalQuestions); i++) { // Select 5 questions for the interview
    selectedQuestions.push(`question_${i + 1}`);
  }

  // Create base context
  const context: PressConferenceContext = {
    type,
    trigger,
    totalQuestions,
    mandatoryQuestionCount: 5, // Assuming all are mandatory for now
    customQuestionsReplaced: 0,
    selectedQuestions,
    baseTone: 'CALM' // Default tone
  };

  // Create the press conference record
  const pressConference = await prisma.pressConference.create({
    data: {
      week: await getCurrentWeek(),
      type,
      trigger: JSON.stringify(trigger),
      context: JSON.stringify(context),
      teamId: clubId,
    }
  });

  return pressConference;
}

/**
 * Gets the press conference history for a club
 * @param clubId - The ID of the club
 * @param limit - Maximum number of press conferences to return
 * @returns Array of press conferences
 */
export async function getPressConferenceHistory(
  clubId: string,
  limit: number = 10
) {
  // Verify club exists
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) {
    throw new ClubNotFoundError(`Clube ${clubId} não encontrado`);
  }

  const pressConferences = await prisma.pressConference.findMany({
    where: { teamId: clubId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return pressConferences;
}

/**
 * Gets a specific press conference by ID
 * @param pressConferenceId - The ID of the press conference
 * @returns The press conference
 */
export async function getPressConferenceById(
  pressConferenceId: string
) {
  const pressConference = await prisma.pressConference.findUnique({
    where: { id: pressConferenceId }
  });

  if (!pressConference) {
    throw new Error('Coletiva de imprensa não encontrada');
  }

  return pressConference;
}

/**
 * Submits answers for a press conference and calculates the results
 * @param pressConferenceId - The ID of the press conference
 * @param userId - The ID of the user submitting answers
 * @param responses - Array of interview responses
 * @param delegationOption - Optional delegation option
 * @returns The press conference result with impacts
 */
export async function submitPressConferenceAnswers(
  pressConferenceId: string,
  userId: string,
  responses: InterviewResponse[],
  delegationOption?: DelegationOption
) {
  // Get the press conference
  const pressConference = await getPressConferenceById(pressConferenceId);

  // Verify the user owns the club
  const club = await prisma.club.findUnique({ where: { id: pressConference.teamId } });
  if (!club) {
    throw new ClubNotFoundError(`Clube ${pressConference.teamId} não encontrado`);
  }
  if (club.ownerId !== userId) {
    throw new Error('Você não é o dono deste clube');
  }

  // Parse the context
  const context: PressConferenceContext = JSON.parse(pressConference.context);

  // Calculate real mathematical impacts using shared domain logic
  const impact: PressConferenceImpact = calculatePressConferenceImpact(
    responses,
    context,
    delegationOption
  );

  // Calculate score (placeholder)
  const score = evaluatePressConferenceScore(
    responses.map(r => r.optionId),
    context.totalQuestions,
    50 // Placeholder editorial weight
  );

  // Create the result
  const result: PressConferenceResult = {
    questionsAnswered: responses.length,
    responses,
    globalPRReward: 0, // Placeholder
    impact
  };

  // Update the press conference with results
  const updatedPressConference = await prisma.pressConference.update({
    where: { id: pressConferenceId },
    data: {
      result: JSON.stringify(result),
      impact: JSON.stringify(impact),
      delegateUsed: !!delegationOption && delegationOption.type !== 'NONE',
      assistantUsed: delegationOption?.type === 'ASSISTANT' ? delegationOption.assistantName : undefined
    }
  });

  return updatedPressConference;
}

/**
 * Gets the current week (placeholder implementation)
 * In a real implementation, this would come from the game state service
 */
async function getCurrentWeek(): Promise<number> {
  // Placeholder - in reality, this would fetch from game state
  return 1;
}

// Placeholder for score evaluation - in reality, this would be imported from shared
function evaluatePressConferenceScore(selectedOptions: string[], totalQuestions: number, editorialWeight: number): number {
  // Simplified implementation
  const answeredCount = selectedOptions.length;
  const POINTS_PER_GOOD_ANSWER = 12;
  const points = answeredCount * POINTS_PER_GOOD_ANSWER;
  const weightMultiplier = editorialWeight / 100;
  const weightedPoints = Math.round(points * weightMultiplier);
  const score = weightedPoints * 3;  // Máximo 100
  return Math.min(100, Math.max(0, Math.round(score)));
}
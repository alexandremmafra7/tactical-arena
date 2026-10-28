import { AttackApproach, AttackStyle, Mentality, PressingIntensity, Tactic } from './tactic.js';

export interface BotAdaptiveTacticContext {
  minute: number;
  currentScore: { home: number; away: number };
  botSide: 'home' | 'away';
  botCurrentTactic: Tactic;
  hasRedCard?: boolean;
  opponentHasRedCard?: boolean;
  isKnockoutSecondLeg?: boolean;
  aggregateDeficit?: number;
}

export type AdaptiveAdjustmentType =
  | 'DESPERATE_CHASE'
  | 'ATTACKING_SURGE'
  | 'PARK_THE_BUS'
  | 'DEFEND_NARROW_LEAD'
  | 'RED_CARD_RECOMPOSE'
  | 'MAN_ADVANTAGE_EXPLOIT';

export interface BotAdaptiveTacticOutcome {
  adjusted: boolean;
  newTactic: Tactic;
  adjustmentType?: AdaptiveAdjustmentType;
  headline?: string;
  explanation?: string;
}

/**
 * Evaluates match context and dynamically mutates bot tactical posture in real-time.
 * Mimics a real-life coach reading game state and adjusting mentality, line height, and attacking approach.
 */
export function computeMidMatchAdaptiveTactic(
  context: BotAdaptiveTacticContext,
): BotAdaptiveTacticOutcome {
  const { minute, currentScore, botSide, botCurrentTactic, hasRedCard, opponentHasRedCard } = context;

  const botGoals = botSide === 'home' ? currentScore.home : currentScore.away;
  const oppGoals = botSide === 'home' ? currentScore.away : currentScore.home;
  const goalDiff = botGoals - oppGoals; // positive = winning, negative = losing

  // 1. Man down (Red Card received by Bot)
  if (hasRedCard) {
    if (botCurrentTactic.pressing !== 'LOW_BLOCK' || botCurrentTactic.mentality !== 'defensive') {
      return {
        adjusted: true,
        adjustmentType: 'RED_CARD_RECOMPOSE',
        headline: 'Reorganização Tática em Desvantagem',
        explanation: 'Com um jogador a menos, a equipe recua as linhas para recompor a defesa e jogar no contragolpe.',
        newTactic: {
          ...botCurrentTactic,
          mentality: 'defensive' as Mentality,
          pressing: 'LOW_BLOCK' as PressingIntensity,
          attackApproach: 'COUNTER_ATTACK' as AttackApproach,
        },
      };
    }
  }

  // 2. Trailing by 2+ goals in the final stretch (75'+) -> Desperate All-Out Attack
  if (goalDiff <= -2 && minute >= 75) {
    if (botCurrentTactic.mentality !== 'attacking' || botCurrentTactic.attackApproach !== 'TOTAL_ATTACK') {
      return {
        adjusted: true,
        adjustmentType: 'DESPERATE_CHASE',
        headline: 'Tudo ou Nada!',
        explanation: 'Perdendo por desvantagem considerável, o técnico adversário lança todos ao ataque com pressão sufocante.',
        newTactic: {
          ...botCurrentTactic,
          mentality: 'attacking' as Mentality,
          pressing: 'HIGH_PRESS' as PressingIntensity,
          attackApproach: 'TOTAL_ATTACK' as AttackApproach,
          attackStyle: 'WINGS' as AttackStyle,
        },
      };
    }
  }

  // 3. Trailing by 1 goal in second half (65'+) -> Attacking Surge
  if (goalDiff === -1 && minute >= 65) {
    if (botCurrentTactic.mentality !== 'attacking') {
      return {
        adjusted: true,
        adjustmentType: 'ATTACKING_SURGE',
        headline: 'Pressão em Busca do Empate',
        explanation: 'Atrás no placar, o adversário sobe a linha de marcação e aumenta o ritmo ofensivo.',
        newTactic: {
          ...botCurrentTactic,
          mentality: 'attacking' as Mentality,
          pressing: 'HIGH_PRESS' as PressingIntensity,
          attackApproach: 'TOTAL_ATTACK' as AttackApproach,
        },
      };
    }
  }

  // 4. Clinging to a 1-goal lead in final 12 minutes (78'+) -> Park The Bus / Compact Defense
  if (goalDiff === 1 && minute >= 78) {
    if (botCurrentTactic.mentality !== 'defensive') {
      return {
        adjusted: true,
        adjustmentType: 'DEFEND_NARROW_LEAD',
        headline: 'Fechando a Casinha',
        explanation: 'Para garantir os 3 pontos na reta final, a equipe compacta o bloco defensivo e prioriza a posse segura.',
        newTactic: {
          ...botCurrentTactic,
          mentality: 'defensive' as Mentality,
          pressing: 'LOW_BLOCK' as PressingIntensity,
          attackApproach: 'COUNTER_ATTACK' as AttackApproach,
        },
      };
    }
  }


  // 5. Opponent has a Red Card and game is tied or trailing (35'+) -> Exploit Numerical Advantage
  if (opponentHasRedCard && goalDiff <= 0 && minute >= 35) {
    if (botCurrentTactic.attackStyle !== 'WINGS' || botCurrentTactic.pressing !== 'HIGH_PRESS') {
      return {
        adjusted: true,
        adjustmentType: 'MAN_ADVANTAGE_EXPLOIT',
        headline: 'Explorando a Vantagem Numérica',
        explanation: 'Com um jogador a mais, a equipe adversária abre o jogo pelas pontas para desgastar a marcação.',
        newTactic: {
          ...botCurrentTactic,
          attackStyle: 'WINGS' as AttackStyle,
          pressing: 'HIGH_PRESS' as PressingIntensity,
          mentality: 'attacking' as Mentality,
        },
      };
    }
  }

  return {
    adjusted: false,
    newTactic: botCurrentTactic,
  };
}

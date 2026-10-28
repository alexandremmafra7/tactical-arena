/**
 * Fast Calendar Advance & Multi-Week Simulation Domain
 *
 * Allows smooth, unblocked skipping across idle / non-match weeks directly to the club's next fixture.
 * Automatically processes background weekly ticks (stamina recovery, physiotherapy, director routines)
 * and safely pauses if a high-priority event occurs (e.g. key player injury or blockbuster transfer proposal).
 */

export interface FastAdvanceNextMatchInfo {
  matchId: string | null;
  opponentId: string;
  opponentName: string;
  isHome: boolean;
  competitionName: string;
  round: number;
  date: string;
}

export interface FastAdvanceInterruptionReason {
  type: 'INJURY' | 'TRANSFER_OFFER' | 'SUSPENSION' | 'BOARD_CRISIS';
  title: string;
  description: string;
}

export interface FastAdvanceResult {
  stepsAdvanced: number;
  initialDate: string;
  finalDate: string;
  nextMatch: FastAdvanceNextMatchInfo | null;
  eventsSummary: string[];
  interrupted: boolean;
  interruptionReason?: FastAdvanceInterruptionReason;
  staminaRecovered: boolean;
}

export interface FastAdvancePlayerRef {
  id: string;
  name: string;
  stamina: number;
  isInjured?: boolean;
  isSuspended?: boolean;
  star_level?: number;
}

export interface EvaluateFastAdvanceInput {
  players: FastAdvancePlayerRef[];
  pendingOffersCount?: number;
  urgentBoardNotice?: boolean;
}

/**
 * Checks if the simulation loop should pause immediately before advancing further.
 */
export function evaluateFastAdvanceInterruption(
  input: EvaluateFastAdvanceInput,
): { interrupted: boolean; reason?: FastAdvanceInterruptionReason } {
  // 1. Board crisis / urgent notice
  if (input.urgentBoardNotice) {
    return {
      interrupted: true,
      reason: {
        type: 'BOARD_CRISIS',
        title: 'Reunião Urgente da Diretoria',
        description: 'A diretoria solicitou uma reunião extraordinária com o treinador.',
      },
    };
  }

  // 2. Star player injured (star_level >= 4)
  const injuredStar = input.players.find((p) => p.isInjured && p.star_level && p.star_level >= 4);
  if (injuredStar) {
    return {
      interrupted: true,
      reason: {
        type: 'INJURY',
        title: 'Lesão de Jogador Chave',
        description: `${injuredStar.name} sofreu uma lesão e o Departamento Médico recomenda atenção imediata.`,
      },
    };
  }

  // 3. Excessive unhandled transfer offers (>= 3)
  if (input.pendingOffersCount && input.pendingOffersCount >= 3) {
    return {
      interrupted: true,
      reason: {
        type: 'TRANSFER_OFFER',
        title: 'Propostas no Mercado',
        description: `Existem ${input.pendingOffersCount} propostas de transferência recebidas aguardando resposta.`,
      },
    };
  }

  return { interrupted: false };
}

/**
 * Helper to generate a friendly summary of skipped matchdays and weeks.
 */
export function formatFastAdvanceSummary(result: FastAdvanceResult): string {
  if (result.interrupted && result.interruptionReason) {
    return `Simulação interrompida após avançar até ${result.finalDate}: ${result.interruptionReason.description}`;
  }
  if (!result.nextMatch) {
    return `Calendário avançado em ${result.stepsAdvanced} rodadas até ${result.finalDate}.`;
  }
  const venue = result.nextMatch.isHome ? 'em casa' : 'fora de casa';
  return `Avanço concluído até ${result.finalDate} (${result.stepsAdvanced} rodadas simuladas). Próximo confronto: vs ${result.nextMatch.opponentName} (${venue}) pela ${result.nextMatch.competitionName}.`;
}

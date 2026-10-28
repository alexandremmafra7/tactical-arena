import type { Player } from './player.js';
import type { Club } from './club.js';
import { getPlayerTier } from './player.js';

export type LoanOptionType = 'NONE' | 'OPTIONAL' | 'MANDATORY';

export interface ContractClauses {
  goalBonus: number;         // Valor pago por gol marcado (para meio-campistas e atacantes)
  cleanSheetBonus: number;   // Valor pago por jogo sem sofrer gols (para goleiros e zagueiros)
  appearanceBonus: number;   // Valor por partida disputada como titular
  titleBonus: number;        // Bonificação financeira por conquista de título
  sellOnClausePercent: number; // Porcentagem de mais-valia/venda futura retida (0 a 30)
  releaseClause: number;     // Multa rescisória
  relegationReleaseDiscount: number; // % de desconto na multa caso o clube sofra rebaixamento (ex: 50)
  loanOption: LoanOptionType;
  purchaseFee?: number;      // Valor de compra fixado para empréstimo
}

export type AgentPersonality = 'DIPLOMATIC' | 'AMBITIOUS' | 'GREEDY' | 'STUBBORN';

export interface AgentProfile {
  name: string;
  personality: AgentPersonality;
  patience: number; // 0 a 100
}

export interface NegotiationOffer {
  weeklyWage: number;
  signingBonus: number; // Luvas
  contractYears: number;
  goalBonus: number;
  cleanSheetBonus: number;
  appearanceBonus: number;
  releaseClause: number;
  sellOnClausePercent?: number;
}

export interface EvaluateContractNegotiationInput {
  player: Player;
  club: Club;
  offer: NegotiationOffer;
  agent: AgentProfile;
}

export type NegotiationStatus = 'ACCEPTED' | 'COUNTER_OFFER' | 'REJECTED' | 'STORMED_OUT';

export interface NegotiationEvaluationResult {
  status: NegotiationStatus;
  message: string;
  counterOffer?: NegotiationOffer;
  updatedAgent: AgentProfile;
}

/**
 * Calcula o repasse financeiro de venda futura (Sell-on Clause / Mais-valia).
 * Baseia-se no lucro da venda (Preço de Venda - Preço de Compra Original) multiplicado pela porcentagem.
 */
export function calculateSellOnShare(transferFee: number, originalFee: number, sellOnPercent: number): number {
  if (sellOnPercent <= 0 || transferFee <= originalFee) return 0;
  const profit = transferFee - originalFee;
  return Math.round(profit * (sellOnPercent / 100));
}

/**
 * Calcula os bônus de desempenho de uma partida para o elenco.
 */
export function calculateMatchPerformanceBonuses(
  players: Player[],
  goalsConceded: number,
  playerGoalCounts: Map<string, number>,
  starterPlayerIds: string[],
): { totalBonusCost: number; updatedPlayers: Player[] } {
  let totalBonusCost = 0;
  const updatedPlayers = players.map((player) => {
    let earned = 0;

    // Appearance bonus para titulares
    if (starterPlayerIds.includes(player.id) && (player.contractClauses?.appearanceBonus ?? 0) > 0) {
      earned += player.contractClauses!.appearanceBonus;
    }

    // Clean sheet bonus para GK e DEF
    if (goalsConceded === 0 && (player.position === 'GK' || player.position === 'DEF') && (player.contractClauses?.cleanSheetBonus ?? 0) > 0) {
      earned += player.contractClauses!.cleanSheetBonus;
    }

    // Goal bonus
    const goals = playerGoalCounts.get(player.id) ?? 0;
    if (goals > 0 && (player.contractClauses?.goalBonus ?? 0) > 0) {
      earned += goals * player.contractClauses!.goalBonus;
    }

    if (earned > 0) {
      totalBonusCost += earned;
    }

    return player;
  });

  return { totalBonusCost, updatedPlayers };
}

/**
 * Avalia uma proposta salarial e contratual com o jogador e seu agente.
 * Considera a personalidade do agente, o prestígio do clube e o tier do atleta.
 */
export function evaluateContractNegotiation(input: EvaluateContractNegotiationInput): NegotiationEvaluationResult {
  const { player, club, offer, agent } = input;

  let currentPatience = agent.patience;

  const tier = getPlayerTier(player.overall, player.starLevel, player.diferenciado);
  let baseExpectedWage = Math.max(player.wage * 1.2, 30_000);
  if (tier === 'GENIO') baseExpectedWage = Math.max(player.wage * 1.4, 70_000);
  else if (tier === 'BAITA') baseExpectedWage = Math.max(player.wage * 1.3, 50_000);

  let thresholdMultiplier = 1.0;
  if (agent.personality === 'GREEDY') thresholdMultiplier = 1.2;
  if (agent.personality === 'STUBBORN') thresholdMultiplier = 1.1;
  if (agent.personality === 'DIPLOMATIC') thresholdMultiplier = 0.95;

  const expectedWage = baseExpectedWage * thresholdMultiplier;
  const wageRatio = offer.weeklyWage / expectedWage;

  if (currentPatience <= 0) {
    return {
      status: 'STORMED_OUT',
      message: `O empresário ${agent.name} perdeu totalmente a paciência com as ofertas insatisfatórias e encerrou as negociações por 2 semanas!`,
      updatedAgent: { ...agent, patience: 0 },
    };
  }

  if (wageRatio >= 1.0 && offer.contractYears >= 2) {
    return {
      status: 'ACCEPTED',
      message: `Proposta aceita! O empresário ${agent.name} e o atleta ${player.name} ficaram satisfeitos com os termos oferecidos.`,
      updatedAgent: { ...agent, patience: Math.min(100, currentPatience + 10) },
    };
  }

  if (wageRatio < 0.75) {
    currentPatience = Math.max(0, currentPatience - 25);
  } else {
    currentPatience = Math.max(0, currentPatience - 10);
  }

  if (currentPatience === 0) {
    return {
      status: 'STORMED_OUT',
      message: `O empresário ${agent.name} considerou a oferta uma falta de respeito e se retirou da mesa de negociação!`,
      updatedAgent: { ...agent, patience: 0 },
    };
  }

  const counterWage = Math.round(expectedWage * 1.1);
  const counterBonus = Math.round(offer.signingBonus * 1.25 + 50_000);
  const counterOffer: NegotiationOffer = {
    weeklyWage: counterWage,
    signingBonus: counterBonus,
    contractYears: Math.max(offer.contractYears, 3),
    goalBonus: Math.round((offer.goalBonus || 1000) * 1.2),
    cleanSheetBonus: Math.round((offer.cleanSheetBonus || 1000) * 1.2),
    appearanceBonus: Math.round((offer.appearanceBonus || 500) * 1.2),
    releaseClause: Math.round(counterWage * 104 * 2.5),
  };

  return {
    status: 'COUNTER_OFFER',
    message: `O empresário ${agent.name} recusou os valores iniciais, mas apresentou uma contraproposta para o contrato de ${player.name}. (Paciência restante: ${currentPatience}%)`,
    counterOffer,
    updatedAgent: { ...agent, patience: currentPatience },
  };
}

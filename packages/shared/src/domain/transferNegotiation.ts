import type { Club } from './club.js';
import type { Player } from './player.js';
import type { StaffMember } from './staff.js';
import { calculateClubVisibility, type ClubVisibility } from './clubVisibility.js';
import { getPlayerTier } from './player.js';
import { getDirectorTransferDiscount } from './staff.js';

export interface ProposalEvaluationResult {
  /** Whether the seller club and the player agree to the deal */
  accepted: boolean;
  /** Clear human-readable justification for the decision */
  reason: string;
  /** Detailed breakdown metrics explaining why it was accepted or rejected */
  detailedBreakdown: {
    /** Gap in prestige between buyer and seller (positive means buyer is bigger) */
    prestigeDelta: number;
    /** Relative buyer strength score (0 to 100) */
    buyerVisibilityScore: number;
    /** Relative seller strength score (0 to 100) */
    sellerVisibilityScore: number;
    /** How crucial the player is to the seller's squad */
    importanceScore: number;
    /** Player's willingness to accept personal terms and join buyer */
    willingnessToJoin: number;
    /** Total economic value offered (cash + swaps) relative to demand */
    offeredTotalValue: number;
    /** Expected fair threshold demand from seller */
    minimumDemandedValue: number;
    /** Football Director persuasion discount / boost */
    directorBonusPercent: number;
    /** Whether bank guarantee requirements are met */
    bankGuaranteeSatisfied: boolean;
  };
  /** Estimated fair price seller would accept if rejected on valuation */
  requiredCashAmount?: number;
  /** Whether bank guarantee is mandatory for this deal */
  requiresBankGuarantee?: boolean;
}

export interface EvaluateProposalInput {
  buyerClub: Club;
  sellerClub: Club;
  targetPlayer: Player;
  cashAmount: number;
  installments: number;
  offeredPlayers?: Player[];
  hasBankGuarantee?: boolean;
  buyerDivision?: number;
  sellerDivision?: number;
}

/**
 * Realistic decision engine for transfer proposals.
 * Evaluates club hierarchy, player importance, economic offer, personal terms,
 * staff influence, and bank guarantee requirements.
 */
export function evaluateTransferProposal(input: EvaluateProposalInput): ProposalEvaluationResult {
  const {
    buyerClub,
    sellerClub,
    targetPlayer,
    cashAmount,
    installments,
    offeredPlayers = [],
    hasBankGuarantee = false,
    buyerDivision = 1,
    sellerDivision = 1,
  } = input;

  // 1. Calculate Visibility & Prestige for both clubs
  const buyerVis: ClubVisibility = calculateClubVisibility(
    buyerClub,
    buyerDivision,
    buyerClub.titlesWon ?? 0,
  );
  const sellerVis: ClubVisibility = calculateClubVisibility(
    sellerClub,
    sellerDivision,
    sellerClub.titlesWon ?? 0,
  );

  const prestigeDelta = buyerVis.score - sellerVis.score;
  const divisionDelta = sellerDivision - buyerDivision; // Positive if buyer is in a higher division (e.g. 2 - 1 = +1)

  // 2. Identify Player Importance & Special Tier
  const tier = getPlayerTier(targetPlayer.overall, targetPlayer.starLevel, targetPlayer.diferenciado);
  const isGenio = tier === 'GENIO';
  const isBaita = tier === 'BAITA';
  const isYoungPromise = targetPlayer.age <= 21 && targetPlayer.potential >= 80;

  // Calculate player's standing in the seller's squad
  const squadOvrAvg =
    sellerClub.players.length > 0
      ? sellerClub.players.reduce((sum, p) => sum + p.overall, 0) / sellerClub.players.length
      : 70;

  let importanceScore = 1.0;
  if (isGenio) {
    importanceScore = 1.75; // Geniuses are cornerstone assets
  } else if (isBaita) {
    importanceScore = 1.45;
  } else if (isYoungPromise) {
    importanceScore = 1.35;
  } else if (targetPlayer.overall >= squadOvrAvg + 5) {
    importanceScore = 1.25; // Vital starter
  } else if (targetPlayer.overall <= squadOvrAvg - 4) {
    importanceScore = 0.85; // Surplus / bench player
  }

  // 3. Player Willingness to Join (Personal Terms)
  // Higher division or superior club prestige attracts players; lower prestige repels stars
  let willingnessToJoin = 100;

  // Penalty if moving to a significantly smaller club
  if (prestigeDelta < -15) {
    const penalty = Math.abs(prestigeDelta + 15) * 1.5;
    willingnessToJoin -= penalty;
  }

  // Heavy penalty if dropping division (e.g. Div 1 -> Div 2)
  if (divisionDelta < 0) {
    willingnessToJoin -= 35;
  }

  // Extra reluctance from elite players to join unheralded clubs
  if ((isGenio || isBaita) && buyerVis.score < 50) {
    willingnessToJoin -= 30;
  }

  // Boost if moving to a prestigious powerhouse
  if (prestigeDelta > 15) {
    willingnessToJoin += Math.min(30, (prestigeDelta - 15) * 0.8);
  }
  if (divisionDelta > 0) {
    willingnessToJoin += 20; // Moving up a division
  }

  willingnessToJoin = Math.max(0, Math.min(150, willingnessToJoin));

  // 4. Staff Influence (Football Director)
  const footballDirector = buyerClub.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const directorDiscount = getDirectorTransferDiscount(footballDirector);
  const directorBonusPercent = Math.round(directorDiscount * 100);

  // 5. Total Economic Offer Calculation
  // Cash offered (with time-value discount for installments if no bank guarantee)
  const isInstallments = installments > 1;
  const requiresBankGuarantee = isInstallments && cashAmount > 500_000 && buyerVis.score < 80;

  // Swapped players evaluated by seller
  const swapValueTotal = offeredPlayers.reduce((sum, p) => {
    // If offered player fills a useful role for seller, value is 100% of market value
    const posMatch = sellerClub.players.filter((sp) => sp.position === p.position).length < 4;
    const factor = posMatch ? 1.05 : 0.85;
    return sum + p.marketValue * factor;
  }, 0);

  const offeredTotalValue = cashAmount + swapValueTotal;

  // 6. Minimum Demanded Valuation from Seller
  // Base demand starts from player market value
  let baseDemand = targetPlayer.marketValue * importanceScore;

  // If buyer is much richer/bigger, seller negotiates harder (+10% to +30%)
  if (prestigeDelta > 20) {
    baseDemand *= 1 + Math.min(0.3, (prestigeDelta - 20) * 0.005);
  }

  // If seller is in a lower division and buyer is a giant, seller is willing to sell if player desires it
  if (prestigeDelta > 30 && willingnessToJoin >= 110) {
    baseDemand *= 0.9;
  }

  // Apply Director of Football discount
  baseDemand *= 1 - directorDiscount;
  const minimumDemandedValue = Math.max(100_000, Math.round(baseDemand / 10_000) * 10_000);

  // 7. Decision Rules & Justifications

  // Check A: Bank Guarantee on Installments
  if (requiresBankGuarantee && !hasBankGuarantee) {
    return {
      accepted: false,
      reason: `Proposta recusada: O ${sellerClub.name} exige Garantia Bancária / Carta de Fiança para aceitar o parcelamento em ${installments}x de valores acima de R$ 500.000.`,
      detailedBreakdown: {
        prestigeDelta,
        buyerVisibilityScore: buyerVis.score,
        sellerVisibilityScore: sellerVis.score,
        importanceScore,
        willingnessToJoin,
        offeredTotalValue,
        minimumDemandedValue,
        directorBonusPercent,
        bankGuaranteeSatisfied: false,
      },
      requiredCashAmount: minimumDemandedValue,
      requiresBankGuarantee: true,
    };
  }

  // Check B: Player Refusal (Personal Terms / Career Regression)
  if (willingnessToJoin < 45) {
    let playerRefusalReason = `Proposta recusada: ${targetPlayer.name} não tem interesse em se transferir para o ${buyerClub.name}.`;
    if (divisionDelta < 0) {
      playerRefusalReason = `Proposta recusada: ${targetPlayer.name} recusou os termos contratuais por considerar um retrocesso atuar em divisão inferior.`;
    } else if (isGenio || isBaita) {
      playerRefusalReason = `Proposta recusada: O craque ${targetPlayer.name} prefere permanecer em um clube de maior projeção e visibilidade internacional.`;
    }

    return {
      accepted: false,
      reason: playerRefusalReason,
      detailedBreakdown: {
        prestigeDelta,
        buyerVisibilityScore: buyerVis.score,
        sellerVisibilityScore: sellerVis.score,
        importanceScore,
        willingnessToJoin,
        offeredTotalValue,
        minimumDemandedValue,
        directorBonusPercent,
        bankGuaranteeSatisfied: true,
      },
      requiredCashAmount: minimumDemandedValue,
      requiresBankGuarantee,
    };
  }

  // Check C: Valuation & Economic Offer
  const offerRatio = offeredTotalValue / minimumDemandedValue;

  if (offerRatio < 0.75) {
    return {
      accepted: false,
      reason: `Proposta recusada: A oferta de ${formatMoney(offeredTotalValue)} foi considerada muito abaixo da pedida pelo ${sellerClub.name} (mínimo esperado: ${formatMoney(minimumDemandedValue)}).`,
      detailedBreakdown: {
        prestigeDelta,
        buyerVisibilityScore: buyerVis.score,
        sellerVisibilityScore: sellerVis.score,
        importanceScore,
        willingnessToJoin,
        offeredTotalValue,
        minimumDemandedValue,
        directorBonusPercent,
        bankGuaranteeSatisfied: true,
      },
      requiredCashAmount: minimumDemandedValue,
      requiresBankGuarantee,
    };
  }

  if (offerRatio < 1.0) {
    // Close offer: if player is really pushing to leave or surplus, seller might accept
    if (willingnessToJoin >= 120 || importanceScore <= 0.9) {
      return {
        accepted: true,
        reason: `Proposta aceita! O ${sellerClub.name} aceitou os termos após ${targetPlayer.name} manifestar forte desejo de atuar pelo ${buyerClub.name}.`,
        detailedBreakdown: {
          prestigeDelta,
          buyerVisibilityScore: buyerVis.score,
          sellerVisibilityScore: sellerVis.score,
          importanceScore,
          willingnessToJoin,
          offeredTotalValue,
          minimumDemandedValue,
          directorBonusPercent,
          bankGuaranteeSatisfied: true,
        },
        requiresBankGuarantee,
      };
    }

    return {
      accepted: false,
      reason: `Proposta recusada: O ${sellerClub.name} considerou a oferta insuficiente para liberar o atleta. Pedida estimada: ${formatMoney(minimumDemandedValue)}.`,
      detailedBreakdown: {
        prestigeDelta,
        buyerVisibilityScore: buyerVis.score,
        sellerVisibilityScore: sellerVis.score,
        importanceScore,
        willingnessToJoin,
        offeredTotalValue,
        minimumDemandedValue,
        directorBonusPercent,
        bankGuaranteeSatisfied: true,
      },
      requiredCashAmount: minimumDemandedValue,
      requiresBankGuarantee,
    };
  }

  // Acceptance!
  let acceptReason = `Proposta aceita! A diretoria do ${sellerClub.name} considerou a oferta financeiramente vantajosa e liberou ${targetPlayer.name}.`;
  if (directorBonusPercent > 0) {
    acceptReason = `Proposta aceita! Graças à intervenção do seu Diretor de Futebol (+${directorBonusPercent}% de persuasão), o ${sellerClub.name} concordou com a transferência.`;
  } else if (hasBankGuarantee && isInstallments) {
    acceptReason = `Proposta aceita! Com a Garantia Bancária apresentada, o parcelamento foi aprovado pelo ${sellerClub.name}.`;
  }

  return {
    accepted: true,
    reason: acceptReason,
    detailedBreakdown: {
      prestigeDelta,
      buyerVisibilityScore: buyerVis.score,
      sellerVisibilityScore: sellerVis.score,
      importanceScore,
      willingnessToJoin,
      offeredTotalValue,
      minimumDemandedValue,
      directorBonusPercent,
      bankGuaranteeSatisfied: true,
    },
    requiresBankGuarantee,
  };
}

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

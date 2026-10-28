export type TransferProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export interface TransferProposal {
  id: string;
  buyerClubId: string;
  buyerClubName: string;
  sellerClubId: string;
  sellerClubName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  /** Cash offered; can be below the release clause — that's the point of negotiating instead of paying it. */
  cashAmount: number;
  /** 1 = paid immediately in full on acceptance; >1 spreads `cashAmount` over that many weekly installments. */
  installments: number;
  /** Player ids from the buyer's own squad offered in exchange (empty for a cash-only offer). */
  offeredPlayerIds: string[];
  status: TransferProposalStatus;
  /** Feedback or formal response rationale from the seller's board */
  responseMessage?: string;
  /** Whether the proposal triggered or required a Bank Guarantee */
  requiresBankGuarantee?: boolean;
  /** Whether the buyer attached a certified Bank Guarantee to the offer */
  hasBankGuarantee?: boolean;
  createdAt: string;
}

export interface TransferInstallmentPlan {
  id: string;
  payerClubId: string;
  payeeClubId: string;
  weeklyAmount: number;
  weeksRemaining: number;
}

export const MAX_INSTALLMENTS = 12;

/** Splits a total into equal weekly installments, rounding each payment up so the total is never underpaid. */
export function calculateInstallmentPlan(totalAmount: number, installments: number): { weeklyAmount: number; weeksRemaining: number } {
  const weeks = Math.max(1, Math.round(installments));
  const weeklyAmount = Math.ceil(totalAmount / weeks / 100) * 100;
  return { weeklyAmount, weeksRemaining: weeks };
}

import { Player } from './player.js';
import { Position } from './player.js';

export interface AuctionBid {
  clubId: string;
  clubName: string;
  amount: number;
  wageOffer: number;
  timestamp: string;
  isUserBid: boolean;
}

export interface DeadlineAuctionItem {
  id: string;
  player: Player;
  sellerClubId: string;
  sellerClubName: string;
  minimumBid: number;
  currentBid: number;
  highestBidderClubId: string | null;
  highestBidderClubName: string | null;
  bids: AuctionBid[];
  hoursRemaining: number;
  status: 'ACTIVE' | 'RESOLVED_SOLD' | 'RESOLVED_UNSOLD';
  isPanicSell?: boolean;
  panicDiscountPct?: number;
}

export interface DeadlineDayState {
  isActive: boolean;
  seasonYear: number;
  windowType: 'PRE_SEASON' | 'MID_SEASON';
  currentHour: number;
  auctions: DeadlineAuctionItem[];
  breakingNews: string[];
  panicBuyRequests: Array<{
    clubId: string;
    clubName: string;
    positionNeeded: Position;
    budgetMax: number;
  }>;
}

export interface DeadlineBidInput {
  auctionId: string;
  clubId: string;
  clubName: string;
  amount: number;
  wageOffer: number;
  timestamp: string;
  isUserBid: boolean;
  availableBudget: number;
}

export interface DeadlineAiClub {
  clubId: string;
  clubName: string;
  availableBudget: number;
  positionNeeded: Position;
}

export interface DeadlineSettlement {
  auctionId: string;
  playerId: string;
  sellerClubId: string;
  buyerClubId: string;
  amount: number;
  wageOffer: number;
}

export interface DeadlineAdvanceResult {
  state: DeadlineDayState;
  settlements: DeadlineSettlement[];
}

export class DeadlineDayError extends Error {}

export const DEADLINE_HOURS = [12, 8, 4, 2, 1, 0] as const;

export function inactiveDeadlineDay(seasonYear: number): DeadlineDayState {
  return {
    isActive: false,
    seasonYear,
    windowType: 'PRE_SEASON',
    currentHour: 0,
    auctions: [],
    breakingNews: [],
    panicBuyRequests: [],
  };
}

export function createDeadlineDayState(input: {
  seasonYear: number;
  windowType: DeadlineDayState['windowType'];
  auctions: DeadlineAuctionItem[];
  panicBuyRequests?: DeadlineDayState['panicBuyRequests'];
}): DeadlineDayState {
  return {
    isActive: true,
    seasonYear: input.seasonYear,
    windowType: input.windowType,
    currentHour: DEADLINE_HOURS[0],
    auctions: [...input.auctions],
    breakingNews: [],
    panicBuyRequests: input.panicBuyRequests ?? [],
  };
}

export function nextMinimumBid(item: DeadlineAuctionItem): number {
  if (item.bids.length === 0) {
    return item.minimumBid;
  }
  return Math.ceil((item.currentBid * 1.05) / 1000) * 1000;
}

export function placeDeadlineBid(state: DeadlineDayState, input: DeadlineBidInput): DeadlineDayState {
  // Validate auction is active and not closed
  const auction = state.auctions.find((a) => a.id === input.auctionId);
  if (!auction) {
    throw new DeadlineDayError('Leilão não encontrado');
  }
  if (auction.status !== 'ACTIVE') {
    throw new DeadlineDayError('Leilão encerrado');
  }
  if (state.currentHour === 0) {
    throw new DeadlineDayError('Leilão encerrado');
  }
  // Validate bidder is not the seller
  if (input.clubId === auction.sellerClubId) {
    throw new DeadlineDayError('O clube vendedor não pode comprar o próprio jogador');
  }
  // Validate amount is a positive finite number
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new DeadlineDayError('Valor do lance deve ser um número positivo e finito');
  }
  // Validate wageOffer is a positive finite number
  if (!Number.isFinite(input.wageOffer) || input.wageOffer <= 0) {
    throw new DeadlineDayError('Salário oferecido deve ser um número positivo e finito');
  }
  // Validate availableBudget is sufficient
  if (input.amount > input.availableBudget) {
    throw new DeadlineDayError('Orçamento insuficiente');
  }
  // Validate amount meets minimum bid requirements
  const minimum = nextMinimumBid(auction);
  if (input.amount < minimum) {
    throw new DeadlineDayError(`Lance mínimo é ${minimum}`);
  }

  // Create new bid
  const newBid: AuctionBid = {
    clubId: input.clubId,
    clubName: input.clubName,
    amount: input.amount,
    wageOffer: input.wageOffer,
    timestamp: input.timestamp,
    isUserBid: input.isUserBid,
  };

  // Update auction
  const updatedAuction: DeadlineAuctionItem = {
    ...auction,
    currentBid: input.amount,
    highestBidderClubId: input.clubId,
    highestBidderClubName: input.clubName,
    bids: [...auction.bids, newBid],
  };

  // Update state
  const updatedAuctions = state.auctions.map((a) => (a.id === input.auctionId ? updatedAuction : a));

  return {
    ...state,
    auctions: updatedAuctions,
  };
}

export function applyPanicSell(item: DeadlineAuctionItem, discountPct: number): DeadlineAuctionItem {
  if (discountPct < 15 || discountPct > 30) {
    throw new DeadlineDayError('Desconto de panic sell deve estar entre 15% e 30%');
  }
  if (item.bids.length > 0) {
    throw new DeadlineDayError('Panic sell só pode ser aplicado a leilões sem lances');
  }
  const newMinimumBid = Math.ceil((item.minimumBid * (1 - discountPct / 100)) / 1000) * 1000;
  return {
    ...item,
    minimumBid: newMinimumBid,
    isPanicSell: true,
    panicDiscountPct: discountPct,
  };
}

export function advanceDeadlineDay(
  state: DeadlineDayState,
  aiClubs: DeadlineAiClub[],
  timestamp: string,
  rng: () => number,
): DeadlineAdvanceResult {
  // Find next hour
  const currentIndex = (DEADLINE_HOURS as readonly number[]).indexOf(state.currentHour);
  if (currentIndex === -1) {
    throw new DeadlineDayError('Hora inválida');
  }
  let nextHour = state.currentHour;
  if (currentIndex + 1 < DEADLINE_HOURS.length) {
    nextHour = DEADLINE_HOURS[currentIndex + 1];
  } else {
    // Already at 0, should not advance further
    nextHour = 0;
  }

  // Apply panic sell at hours 4, 2, 1 (when no bids)
  let updatedAuctions = state.auctions.map((auction) => {
    if (
      auction.hoursRemaining === nextHour &&
      auction.bids.length === 0 &&
      [4, 2, 1].includes(nextHour)
    ) {
      const discountPct = 15 + Math.floor(rng() * 16); // 15-30
      return applyPanicSell(auction, discountPct);
    }
    return auction;
  });

  // AI bidding: each AI club can bid on auctions matching their position needed
  updatedAuctions = updatedAuctions.map((auction) => {
    // Skip if auction is not active or already closed
    if (auction.status !== 'ACTIVE' || state.currentHour === 0) {
      return auction;
    }
    // Check each AI club
    for (const aiClub of aiClubs) {
      if (aiClub.positionNeeded === auction.player.position) {
        // AI bids with probability 0.45
        if (rng() < 0.45) {
          // AI bids up to 80% of available budget, but at least minimum bid
          const maxBid = Math.floor(aiClub.availableBudget * 0.8);
          const minimum = nextMinimumBid(auction);
          if (maxBid >= minimum) {
            // AI bids a random amount between minimum and maxBid, rounded to nearest 1000
            const bidAmount = Math.floor((minimum + rng() * (maxBid - minimum)) / 1000) * 1000;
            const wageOffer = Math.min(bidAmount * 0.1, aiClub.availableBudget * 0.3); // Simplified wage offer
            try {
              // Place the bid using the shared function (which validates)
              const bidInput: DeadlineBidInput = {
                auctionId: auction.id,
                clubId: aiClub.clubId,
                clubName: aiClub.clubName,
                amount: bidAmount,
                wageOffer: wageOffer,
                timestamp: timestamp,
                isUserBid: false,
                availableBudget: aiClub.availableBudget,
              };
              // We need to update the auction with the bid
              // Since placeDeadlineBid returns a new state, we extract the auction
              const tempState = {
                ...state,
                auctions: [auction], // temporary state with only this auction
              };
              const newState = placeDeadlineBid(tempState, bidInput);
              return newState.auctions[0];
            } catch (e) {
              // If bid fails (shouldn't happen with our constraints), ignore
              return auction;
            }
          }
        }
      }
    }
    return auction;
  });

  // Advance hour and update auctions hoursRemaining
  const auctionsWithHours = updatedAuctions.map((auction) => ({
    ...auction,
    hoursRemaining: nextHour,
  }));
  const newState = {
    ...state,
    currentHour: nextHour,
    isActive: nextHour !== 0, // becomes false when hour is 0
    auctions: auctionsWithHours,
    // Add breaking news (simplified)
    breakingNews: [
      ...state.breakingNews,
      `Relógio do Deadline Day avançado para ${nextHour}h`,
    ].slice(-30), // Keep only latest 30
  };

  // Settle auctions if we reached hour 0
  const settlements: DeadlineSettlement[] = [];
  if (nextHour === 0) {
    for (const auction of newState.auctions) {
      if (auction.status === 'ACTIVE') {
        let settlement: DeadlineSettlement | null = null;
        if (auction.bids.length > 0) {
          // Find highest bid
          const highestBid = auction.bids.reduce((prev, current) =>
            prev.amount > current.amount ? prev : current
          );
          // Validate buyer budget and seller ownership (simplified, in real implementation would check clubs)
          // For now, we assume validation passes and create settlement
          settlement = {
            auctionId: auction.id,
            playerId: auction.player.id,
            sellerClubId: auction.sellerClubId,
            buyerClubId: highestBid.clubId,
            amount: highestBid.amount,
            wageOffer: highestBid.wageOffer,
          };
          auction.status = 'RESOLVED_SOLD';
        } else {
          auction.status = 'RESOLVED_UNSOLD';
        }
        if (settlement) {
          settlements.push(settlement);
        }
      }
    }
  }

  return {
    state: newState,
    settlements,
  };
}
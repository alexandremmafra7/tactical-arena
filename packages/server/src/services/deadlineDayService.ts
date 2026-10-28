import {
  BOT_OWNER_ID,
  DeadlineAiClub,
  DeadlineAdvanceResult,
  DeadlineAuctionItem,
  DeadlineDayError,
  DeadlineDayState,
  Player,
  Position,
  advanceDeadlineDay,
  createDeadlineDayState,
  createRng,
  placeDeadlineBid,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub, vacatedRoleFields } from './clubService.js';

export { DeadlineDayError };

async function loadOrCreateDeadlineDay(): Promise<DeadlineDayState> {
  const gameStateRecord = await prisma.gameState.findUnique({ where: { id: 'singleton' } });
  const seasonYear = gameStateRecord?.seasonYear ?? new Date().getFullYear();

  let state: DeadlineDayState | null = null;
  if (gameStateRecord?.deadlineDayJson) {
    try {
      state = JSON.parse(gameStateRecord.deadlineDayJson);
    } catch {
      state = null;
    }
  }

  if (state && (state.isActive || (state.seasonYear === seasonYear && state.auctions.length > 0))) {
    return state;
  }

  const listings = await prisma.transferListing.findMany({
    where: { status: 'ACTIVE' },
  });

  const clubIds = Array.from(new Set(listings.map((l) => l.clubId)));
  const clubs = await prisma.club.findMany({
    where: { id: { in: clubIds } },
    select: { id: true, name: true },
  });
  const clubNameById = new Map(clubs.map((c) => [c.id, c.name]));

  const auctions: DeadlineAuctionItem[] = listings.map((l) => {
    const sellerName = clubNameById.get(l.clubId) ?? 'Clube Vendedor';
    const player: Player = JSON.parse(l.playerJson);
    return {
      id: l.id,
      player,
      sellerClubId: l.clubId,
      sellerClubName: sellerName,
      minimumBid: l.askingPrice,
      currentBid: 0,
      highestBidderClubId: null,
      highestBidderClubName: null,
      bids: [],
      hoursRemaining: 12,
      status: 'ACTIVE',
    };
  });

  const botClubs = await prisma.club.findMany({
    where: { ownerId: BOT_OWNER_ID },
    select: { id: true, name: true, budget: true },
  });

  const positions: Position[] = ['GK', 'DEF', 'MID', 'ATT'];
  const panicBuyRequests = botClubs.slice(0, 4).map((c, i) => ({
    clubId: c.id,
    clubName: c.name,
    positionNeeded: positions[i % positions.length],
    budgetMax: Math.floor(c.budget * 0.7),
  }));

  const newState = createDeadlineDayState({
    seasonYear,
    windowType: gameStateRecord?.phase === 'MID_SEASON' ? 'MID_SEASON' : 'PRE_SEASON',
    auctions,
    panicBuyRequests,
  });

  await persistDeadlineDay(newState);
  return newState;
}

async function persistDeadlineDay(state: DeadlineDayState): Promise<void> {
  await prisma.gameState.upsert({
    where: { id: 'singleton' },
    update: { deadlineDayJson: JSON.stringify(state) },
    create: {
      id: 'singleton',
      currentDate: '2026-01-01',
      seasonYear: state.seasonYear || new Date().getFullYear(),
      phase: 'PRE_SEASON',
      deadlineDayJson: JSON.stringify(state),
    },
  });
}

async function settleDeadlineDay(result: DeadlineAdvanceResult): Promise<DeadlineDayState> {
  const state: DeadlineDayState = {
    ...result.state,
    auctions: [...result.state.auctions],
  };

  await prisma.$transaction(async (tx) => {
    for (const settlement of result.settlements) {
      const sellerRecord = await tx.club.findUnique({ where: { id: settlement.sellerClubId } });
      const buyerRecord = await tx.club.findUnique({ where: { id: settlement.buyerClubId } });

      if (!sellerRecord || !buyerRecord || settlement.sellerClubId === settlement.buyerClubId) {
        const auctionIdx = state.auctions.findIndex((a) => a.id === settlement.auctionId);
        if (auctionIdx !== -1) {
          state.auctions[auctionIdx] = {
            ...state.auctions[auctionIdx],
            status: 'RESOLVED_UNSOLD',
            highestBidderClubId: null,
            highestBidderClubName: null,
          };
        }
        continue;
      }

      const sellerPlayers: Player[] = JSON.parse(sellerRecord.playersJson);
      const playerIndex = sellerPlayers.findIndex((p) => p.id === settlement.playerId);

      if (playerIndex === -1 || buyerRecord.budget < settlement.amount) {
        const auctionIdx = state.auctions.findIndex((a) => a.id === settlement.auctionId);
        if (auctionIdx !== -1) {
          state.auctions[auctionIdx] = {
            ...state.auctions[auctionIdx],
            status: 'RESOLVED_UNSOLD',
            highestBidderClubId: null,
            highestBidderClubName: null,
          };
        }
        continue;
      }

      const player = sellerPlayers[playerIndex];
      const updatedSellerPlayers = sellerPlayers.filter((p) => p.id !== player.id);

      const buyerPlayers: Player[] = JSON.parse(buyerRecord.playersJson);
      const transferredPlayer: Player = {
        ...player,
        wage: settlement.wageOffer > 0 ? settlement.wageOffer : player.wage,
      };
      const updatedBuyerPlayers = [...buyerPlayers, transferredPlayer];

      const sellerVacated = vacatedRoleFields(sellerRecord as any, [player.id]);
      await tx.club.update({
        where: { id: sellerRecord.id },
        data: {
          playersJson: JSON.stringify(updatedSellerPlayers),
          budget: { increment: settlement.amount },
          ...sellerVacated,
        },
      });

      await tx.club.update({
        where: { id: buyerRecord.id },
        data: {
          playersJson: JSON.stringify(updatedBuyerPlayers),
          budget: { decrement: settlement.amount },
        },
      });

      await tx.transferListing.updateMany({
        where: { id: settlement.auctionId, status: 'ACTIVE' },
        data: { status: 'SOLD' },
      });
    }

    await tx.gameState.upsert({
      where: { id: 'singleton' },
      update: { deadlineDayJson: JSON.stringify(state) },
      create: {
        id: 'singleton',
        currentDate: '2026-01-01',
        seasonYear: state.seasonYear || new Date().getFullYear(),
        phase: 'PRE_SEASON',
        deadlineDayJson: JSON.stringify(state),
      },
    });
  });

  return state;
}

export async function getDeadlineDay(clubId: string): Promise<DeadlineDayState> {
  const club = await getClub(clubId);
  if (!club) {
    throw new DeadlineDayError('Clube não encontrado');
  }
  return loadOrCreateDeadlineDay();
}

export async function placeDeadlineDayBid(input: {
  auctionId: string;
  buyerClubId: string;
  amount: number;
  wageOffer: number;
  requestingUserId: string;
}): Promise<DeadlineDayState> {
  const buyer = await getClub(input.buyerClubId);
  if (buyer.ownerId !== input.requestingUserId) {
    throw new DeadlineDayError('Você não é o dono deste clube');
  }

  const state = await loadOrCreateDeadlineDay();
  const nextState = placeDeadlineBid(state, {
    auctionId: input.auctionId,
    clubId: buyer.id,
    clubName: buyer.name,
    amount: input.amount,
    wageOffer: input.wageOffer,
    timestamp: new Date().toISOString(),
    isUserBid: true,
    availableBudget: buyer.budget,
  });

  await persistDeadlineDay(nextState);
  return nextState;
}

export async function advanceDeadlineDayHour(input: {
  clubId: string;
  requestingUserId: string;
}): Promise<DeadlineDayState> {
  const club = await getClub(input.clubId);
  if (club.ownerId !== input.requestingUserId) {
    throw new DeadlineDayError('Você não é o dono deste clube');
  }

  const state = await loadOrCreateDeadlineDay();
  if (state.currentHour === 0 || !state.isActive) {
    return state;
  }

  const botClubs = await prisma.club.findMany({
    where: { ownerId: BOT_OWNER_ID },
    select: { id: true, name: true, budget: true },
  });

  const positions: Position[] = ['GK', 'DEF', 'MID', 'ATT'];
  const aiClubs: DeadlineAiClub[] = botClubs.map((b, idx) => ({
    clubId: b.id,
    clubName: b.name,
    availableBudget: b.budget,
    positionNeeded: positions[idx % positions.length],
  }));

  const seed = `deadline-${state.seasonYear}-${state.currentHour}-${state.auctions.length}`;
  const rng = createRng(seed);

  const advanceResult = advanceDeadlineDay(state, aiClubs, new Date().toISOString(), rng);

  if (advanceResult.state.currentHour === 0) {
    return settleDeadlineDay(advanceResult);
  }

  await persistDeadlineDay(advanceResult.state);
  return advanceResult.state;
}

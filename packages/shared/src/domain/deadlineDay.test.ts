import { describe, expect, it } from 'vitest';
import { generateSquad } from './squadGenerator.js';
import {
  DeadlineDayError,
  advanceDeadlineDay,
  applyPanicSell,
  createDeadlineDayState,
  nextMinimumBid,
  placeDeadlineBid,
  type DeadlineAdvanceResult,
  type DeadlineAuctionItem,
} from './deadlineDay.js';

const player = generateSquad(72, 'deadline-test', 'BRA')[0];

function auction(): DeadlineAuctionItem {
  return {
    id: 'auction-1',
    player,
    sellerClubId: 'seller',
    sellerClubName: 'Vendedor',
    minimumBid: 1_000_000,
    currentBid: 0,
    highestBidderClubId: null,
    highestBidderClubName: null,
    bids: [],
    hoursRemaining: 12,
    status: 'ACTIVE',
  };
}

function state() {
  return createDeadlineDayState({
    seasonYear: 2026,
    windowType: 'PRE_SEASON',
    auctions: [auction()],
  });
}

function stateWithBid() {
  return placeDeadlineBid(state(), {
    auctionId: 'auction-1',
    clubId: 'buyer',
    clubName: 'Comprador',
    amount: 1_000_000,
    wageOffer: 20_000,
    timestamp: '2026-01-31T09:00:00.000Z',
    isUserBid: true,
    availableBudget: 2_000_000,
  });
}

describe('Deadline Day', () => {
  it('requires the opening bid and then a rounded 5% raise', () => {
    expect(nextMinimumBid(auction())).toBe(1_000_000);
    expect(nextMinimumBid(stateWithBid().auctions[0])).toBe(1_050_000);
  });

  it('rejects invalid, self, closed, under-minimum, and unaffordable bids', () => {
    const input = {
      auctionId: 'auction-1',
      clubId: 'seller',
      clubName: 'Vendedor',
      amount: 1_000_000,
      wageOffer: 20_000,
      timestamp: '2026-01-31T09:00:00.000Z',
      isUserBid: true,
      availableBudget: 2_000_000,
    };

    expect(() => placeDeadlineBid(state(), input)).toThrow(DeadlineDayError);
    expect(() => placeDeadlineBid(state(), { ...input, clubId: 'buyer', amount: Number.NaN })).toThrow(DeadlineDayError);
    expect(() => placeDeadlineBid(state(), { ...input, clubId: 'buyer', amount: 999_999 })).toThrow(DeadlineDayError);
    expect(() => placeDeadlineBid(state(), { ...input, clubId: 'buyer', availableBudget: 999_999 })).toThrow(DeadlineDayError);
    expect(() => placeDeadlineBid({ ...state(), currentHour: 0 }, { ...input, clubId: 'buyer' })).toThrow(DeadlineDayError);
  });

  it('rejects invalid wage offers', () => {
    expect(() => placeDeadlineBid(state(), {
      auctionId: 'auction-1',
      clubId: 'buyer',
      clubName: 'Comprador',
      amount: 1_000_000,
      wageOffer: Number.POSITIVE_INFINITY,
      timestamp: '2026-01-31T09:00:00.000Z',
      isUserBid: true,
      availableBudget: 2_000_000,
    })).toThrow(DeadlineDayError);
  });

  it('bounds panic sell without changing market value', () => {
    expect(() => applyPanicSell(auction(), 14)).toThrow(DeadlineDayError);
    const discounted = applyPanicSell(auction(), 20);
    expect(discounted.minimumBid).toBe(800_000);
    expect(discounted.player.marketValue).toBe(player.marketValue);
    expect(discounted).toMatchObject({ isPanicSell: true, panicDiscountPct: 20 });
  });

  it('advances 12, 8, 4, 2, 1, 0 and settles only at zero', () => {
    let result: DeadlineAdvanceResult = { state: stateWithBid(), settlements: [] };
    for (const hour of [8, 4, 2, 1, 0]) {
      result = advanceDeadlineDay(result.state, [], '2026-01-31T10:00:00.000Z', () => 0.99);
      expect(result.state.currentHour).toBe(hour);
      expect(result.state.auctions[0].hoursRemaining).toBe(hour);
      expect(result.settlements).toHaveLength(hour === 0 ? 1 : 0);
    }
    expect(result.state.isActive).toBe(false);
    expect(result.state.auctions[0].status).toBe('RESOLVED_SOLD');
    expect(result.settlements[0]).toMatchObject({ buyerClubId: 'buyer', amount: 1_000_000 });
  });

  it('resolves an auction without bids as unsold', () => {
    let result: DeadlineAdvanceResult = { state: state(), settlements: [] };
    for (let index = 0; index < 5; index += 1) {
      result = advanceDeadlineDay(result.state, [], '2026-01-31T10:00:00.000Z', () => 0.99);
    }
    expect(result.state.auctions[0].status).toBe('RESOLVED_UNSOLD');
    expect(result.settlements).toEqual([]);
  });

  it('uses injected RNG for repeatable AI bids', () => {
    const ai = [{
      clubId: 'ai',
      clubName: 'IA FC',
      availableBudget: 2_000_000,
      positionNeeded: player.position,
    }];
    const first = advanceDeadlineDay(state(), ai, '2026-01-31T10:00:00.000Z', () => 0);
    const second = advanceDeadlineDay(state(), ai, '2026-01-31T10:00:00.000Z', () => 0);
    expect(first).toEqual(second);
    expect(first.state.auctions[0].highestBidderClubId).toBe('ai');
  });
});

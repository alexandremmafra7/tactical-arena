import { describe, it, expect } from 'vitest';
import { evaluateTransferProposal } from './transferNegotiation.js';
import { makeClub, makePlayer } from '../simulation/testFactories.js';

describe('evaluateTransferProposal', () => {
  it('rejects an offer that is way below the demanded valuation', () => {
    const buyer = makeClub('buyer-1', 'Comprador FC', 70);
    const seller = makeClub('seller-1', 'Vendedor EC', 70);
    const target = makePlayer('star-1', { name: 'Artilheiro', overall: 82, marketValue: 5_000_000 });
    seller.players = [target, ...seller.players];

    const result = evaluateTransferProposal({
      buyerClub: buyer,
      sellerClub: seller,
      targetPlayer: target,
      cashAmount: 1_000_000, // Only 20% of market value
      installments: 1,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('muito abaixo da pedida');
  });

  it('rejects when an unheralded lower-division club tries to buy a superstar from a continental giant', () => {
    // Small buyer in Div 2 with no titles
    const smallBuyer = makeClub('small-1', 'Pequeno FC', 55);
    smallBuyer.stadiumCapacity = 3000;
    smallBuyer.titlesWon = 0;

    // Giant seller in Div 1 with many titles and big stadium
    const giantSeller = makeClub('giant-1', 'Gigante Continental', 88);
    giantSeller.stadiumCapacity = 70000;
    giantSeller.titlesWon = 8;

    const superstar = makePlayer('genio-1', { name: 'Craque Mundial', overall: 92, marketValue: 25_000_000 });
    giantSeller.players = [superstar, ...giantSeller.players];

    const result = evaluateTransferProposal({
      buyerClub: smallBuyer,
      sellerClub: giantSeller,
      targetPlayer: superstar,
      cashAmount: 35_000_000, // High cash offer
      installments: 1,
      buyerDivision: 2,
      sellerDivision: 1,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toMatch(/recusou|interesse|retrocesso|projeção/i);
    expect(result.detailedBreakdown.willingnessToJoin).toBeLessThan(45);
  });

  it('accepts when a powerhouse makes a strong offer for a player in a smaller club', () => {
    const giantBuyer = makeClub('giant-1', 'Gigante Continental', 85);
    giantBuyer.stadiumCapacity = 70000;
    giantBuyer.titlesWon = 8;

    const smallSeller = makeClub('small-1', 'Pequeno FC', 60);
    smallSeller.stadiumCapacity = 3000;
    smallSeller.titlesWon = 0;

    const player = makePlayer('promessa-1', { name: 'Destaque Local', overall: 78, marketValue: 2_000_000 });
    smallSeller.players = [player, ...smallSeller.players];

    const result = evaluateTransferProposal({
      buyerClub: giantBuyer,
      sellerClub: smallSeller,
      targetPlayer: player,
      cashAmount: 3_500_000,
      installments: 1,
      buyerDivision: 1,
      sellerDivision: 2,
    });

    expect(result.accepted).toBe(true);
    expect(result.reason).toMatch(/vantajosa|liberou|aceitou/i);
    expect(result.detailedBreakdown.willingnessToJoin).toBeGreaterThan(100);
  });

  it('demands a bank guarantee for large installment proposals without bank backing', () => {
    const buyer = makeClub('buyer-1', 'Comprador FC', 70);
    buyer.stadiumCapacity = 10000;
    buyer.titlesWon = 0;

    const seller = makeClub('seller-1', 'Vendedor EC', 70);
    const player = makePlayer('p-1', { name: 'Meia Titular', overall: 80, marketValue: 3_000_000 });
    seller.players = [player, ...seller.players];

    // 6 installments without guarantee
    const resultWithoutBg = evaluateTransferProposal({
      buyerClub: buyer,
      sellerClub: seller,
      targetPlayer: player,
      cashAmount: 4_000_000,
      installments: 6,
      hasBankGuarantee: false,
    });

    expect(resultWithoutBg.accepted).toBe(false);
    expect(resultWithoutBg.requiresBankGuarantee).toBe(true);
    expect(resultWithoutBg.reason).toContain('Garantia Bancária');

    // With bank guarantee attached
    const resultWithBg = evaluateTransferProposal({
      buyerClub: buyer,
      sellerClub: seller,
      targetPlayer: player,
      cashAmount: 4_500_000,
      installments: 6,
      hasBankGuarantee: true,
    });

    expect(resultWithBg.accepted).toBe(true);
    expect(resultWithBg.reason).toContain('Garantia Bancária');
  });

  it('applies football director bonus to make negotiations easier', () => {
    const buyer = makeClub('buyer-1', 'Comprador FC', 75);
    buyer.staff = [
      {
        id: 'dir-1',
        name: 'Carlos Diretor',
        role: 'FOOTBALL_DIRECTOR',
        tier: 'OURO',
        rating: 85,
        specialty: 'Negociador de Alto Nível',
        description: '',
        wage: 35000,
        minClubVisibility: 50,
        minCareerTitles: 1,
        avatar: '👔',
        nationality: 'BRA',
      },
    ];

    const seller = makeClub('seller-1', 'Vendedor EC', 75);
    const player = makePlayer('p-1', { name: 'Atacante', overall: 79, marketValue: 2_000_000 });
    seller.players = [player, ...seller.players];

    const result = evaluateTransferProposal({
      buyerClub: buyer,
      sellerClub: seller,
      targetPlayer: player,
      cashAmount: 2_000_000,
      installments: 1,
    });

    expect(result.detailedBreakdown.directorBonusPercent).toBeGreaterThan(0);
    expect(result.accepted).toBe(true);
  });
});

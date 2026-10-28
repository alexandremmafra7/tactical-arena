import { describe, it, expect } from 'vitest';
import {
  CONTRACT_LENGTHS,
  LOAN_PLANS,
  MAX_SPONSORSHIPS,
  SPONSOR_TYPES,
  STADIUM_LEVELS,
  applyFinancialMorale,
  calculateCupPrizeMoney,
  calculateLoanTerms,
  calculateMaintenanceCost,
  calculatePrizeMoney,
  calculateAttendance,
  calculateAttendanceRate,
  calculateStadiumRevenue,
  calculateWageBill,
  calculateWageReserve,
  buildSponsorBoard,
  canAffordWage,
  computeClubPrestige,
  evaluateSponsorGoals,
  generateMidSeasonSponsorshipOffers,
  generateNamingRightsChallengeOffer,
  generateSponsorshipOffers,
  getNextStadiumLevel,
  getStadiumLevelInfo,
  previewStadiumUpgrade,
  stadiumDisplayName,
  weeklyCashFlow,
  type ClubPrestigeInputs,
} from './finance.js';
import { createRng } from '../simulation/rng.js';
import { makePlayer } from '../simulation/testFactories.js';

describe('stadium attendance', () => {
  const base = { stadiumCapacity: 20_000, totalClubsInLeague: 20, titlesWon: 0 };

  it('fills the ground for a leader and empties it for the bottom club', () => {
    const top = calculateAttendanceRate({ ...base, leaguePosition: 1 });
    const bottom = calculateAttendanceRate({ ...base, leaguePosition: 20 });
    expect(top).toBeGreaterThan(bottom);
    expect(top).toBeGreaterThan(0.6);
    expect(bottom).toBeLessThan(0.6);
  });

  /** Centred on the old flat constant on purpose, so league-average matchday income is unchanged. */
  it('leaves a mid-table club on the historic baseline', () => {
    const midOfNineteen = calculateAttendanceRate({ ...base, totalClubsInLeague: 19, leaguePosition: 10 });
    expect(midOfNineteen).toBeCloseTo(0.6, 5);
  });

  it('falls back to the baseline when there is no table yet', () => {
    expect(calculateAttendanceRate({ ...base, leaguePosition: null })).toBeCloseTo(0.6, 5);
  });

  /** Before kickoff every club is on zero points, so "last" is just how the table happened to sort. */
  it('ignores the table entirely until a match has actually been played', () => {
    expect(calculateAttendanceRate({ ...base, leaguePosition: 20, matchesPlayed: 0 })).toBeCloseTo(0.6, 5);
    expect(calculateAttendanceRate({ ...base, leaguePosition: 20, matchesPlayed: 1 })).toBeLessThan(0.6);
  });

  it('rewards a trophy cabinet, but with a ceiling', () => {
    const none = calculateAttendanceRate({ ...base, leaguePosition: 10, titlesWon: 0 });
    const some = calculateAttendanceRate({ ...base, leaguePosition: 10, titlesWon: 2 });
    const loads = calculateAttendanceRate({ ...base, leaguePosition: 10, titlesWon: 50 });
    expect(some).toBeGreaterThan(none);
    expect(loads).toBeGreaterThan(some);
    expect(loads - none).toBeLessThanOrEqual(0.12 + 1e-9);
  });

  it('never exceeds capacity nor empties the ground entirely', () => {
    const packed = calculateAttendanceRate({ ...base, leaguePosition: 1, titlesWon: 100 });
    const deserted = calculateAttendanceRate({ ...base, leaguePosition: 20, titlesWon: 0 });
    expect(packed).toBeLessThanOrEqual(1);
    expect(deserted).toBeGreaterThanOrEqual(0.25);
  });

  it('turns the rate into actual bums on seats', () => {
    const inputs = { ...base, leaguePosition: 1 };
    expect(calculateAttendance(inputs)).toBe(Math.round(20_000 * calculateAttendanceRate(inputs)));
  });

  it('keeps matchday revenue on the old baseline when no rate is supplied', () => {
    expect(calculateStadiumRevenue(20_000)).toBe(calculateStadiumRevenue(20_000, 0.6));
  });
});

describe('stadium economics', () => {
  it('gives bigger stadiums more matchday revenue', () => {
    const small = calculateStadiumRevenue(STADIUM_LEVELS[0].capacity);
    const big = calculateStadiumRevenue(STADIUM_LEVELS[4].capacity);
    expect(big).toBeGreaterThan(small);
  });

  it('charges maintenance as a percentage of stadium revenue and payroll', () => {
    const smallRevenue = calculateStadiumRevenue(STADIUM_LEVELS[0].capacity);
    const bigRevenue = calculateStadiumRevenue(STADIUM_LEVELS[4].capacity);
    expect(calculateMaintenanceCost(bigRevenue, 100_000)).toBeGreaterThan(calculateMaintenanceCost(smallRevenue, 100_000));
    expect(calculateMaintenanceCost(smallRevenue, 200_000)).toBeGreaterThan(calculateMaintenanceCost(smallRevenue, 50_000));
  });

  it('exposes level info and the next upgrade target', () => {
    expect(getStadiumLevelInfo(1)?.capacity).toBe(STADIUM_LEVELS[0].capacity);
    expect(getNextStadiumLevel(1)?.level).toBe(2);
    expect(getNextStadiumLevel(5)).toBeUndefined();
  });
});

describe('previewStadiumUpgrade', () => {
  const prestigeInputs = { avgSquadOverall: 70, stadiumLevel: 1, division: 2, leaguePosition: 4, totalClubsInLeague: 10, titlesWon: 0 };

  it('reports the current level using the flat attendance rate the real weekly tick uses, not the form-aware one', () => {
    const preview = previewStadiumUpgrade(1, prestigeInputs);
    expect(preview.current.level).toBe(1);
    expect(preview.current.capacity).toBe(STADIUM_LEVELS[0].capacity);
    expect(preview.current.receitaPorJogo).toBe(calculateStadiumRevenue(STADIUM_LEVELS[0].capacity));
  });

  it('projects bigger crowds, more matchday revenue and a payback estimate for the next level', () => {
    const preview = previewStadiumUpgrade(1, prestigeInputs);
    expect(preview.next).not.toBeNull();
    expect(preview.next!.level).toBe(2);
    expect(preview.next!.capacity).toBe(STADIUM_LEVELS[1].capacity);
    expect(preview.next!.publicoMedio).toBeGreaterThan(preview.current.publicoMedio);
    expect(preview.next!.receitaPorJogo).toBeGreaterThan(preview.current.receitaPorJogo);
    expect(preview.next!.upgradeCost).toBe(STADIUM_LEVELS[1].upgradeCost);
    expect(preview.next!.constructionWeeks).toBe(STADIUM_LEVELS[1].constructionWeeks);
    // Payback = cost / extra revenue per match, rounded up so the club always earns at least the full cost back.
    const extraRevenue = preview.next!.receitaPorJogo - preview.current.receitaPorJogo;
    expect(preview.next!.paybackMatches).toBe(Math.ceil(STADIUM_LEVELS[1].upgradeCost / extraRevenue));
  });

  it('gives a bigger stadium more prestige stars than a smaller one, all else equal', () => {
    const preview = previewStadiumUpgrade(1, prestigeInputs);
    expect(preview.next!.prestigeStars).toBeGreaterThanOrEqual(preview.current.prestigeStars);
  });

  it('has no next level once the stadium is already at the top', () => {
    const preview = previewStadiumUpgrade(5, prestigeInputs);
    expect(preview.next).toBeNull();
  });

  it('throws for an unknown stadium level', () => {
    expect(() => previewStadiumUpgrade(99, prestigeInputs)).toThrow();
  });
});

describe('calculateWageBill', () => {
  it('sums every player wage in the list', () => {
    const players = [makePlayer('a', { wage: 1000 }), makePlayer('b', { wage: 2500 })];
    expect(calculateWageBill(players)).toBe(3500);
  });
});

describe('weeklyCashFlow', () => {
  /**
   * A conta que três telas escreviam à mão. O teste existe para elas não voltarem a divergir: painel,
   * estádio e os cards dos hubs precisam dizer o mesmo número para a mesma semana.
   */
  const club = {
    stadiumCapacity: 20_000,
    players: [makePlayer('a', { wage: 4_000 }), makePlayer('b', { wage: 6_000 })],
    sponsorships: [{ weeklyAmount: 30_000 }, { weeklyAmount: 12_000 }],
    loans: [{ weeklyPayment: 5_000 }],
    pendingTransferPayments: [{ weeklyAmount: 2_000 }],
  } as unknown as Parameters<typeof weeklyCashFlow>[0];

  it('soma patrocínio e bilheteria na receita, e folha, manutenção, empréstimo e parcela na despesa', () => {
    const gate = calculateStadiumRevenue(20_000);
    const wages = 10_000;
    const { income, expense, net } = weeklyCashFlow(club);

    expect(income).toBe(42_000 + gate);
    expect(expense).toBe(wages + calculateMaintenanceCost(gate, wages) + 5_000 + 2_000);
    expect(net).toBe(income - expense);
  });

  it('cobra menos bilheteria quando o estádio não enche', () => {
    const cheio = weeklyCashFlow(club);
    const vazio = weeklyCashFlow(club, 0.3);
    expect(vazio.income).toBeLessThan(cheio.income);
    expect(vazio.net).toBeLessThan(cheio.net);
  });

  it('não quebra num clube sem patrocínio, empréstimo nem parcela a pagar', () => {
    const pelado = { stadiumCapacity: 10_000, players: [] } as unknown as Parameters<typeof weeklyCashFlow>[0];
    const { income, expense } = weeklyCashFlow(pelado);
    expect(income).toBe(calculateStadiumRevenue(10_000));
    expect(expense).toBe(calculateMaintenanceCost(calculateStadiumRevenue(10_000), 0));
  });
});

describe('canAffordWage', () => {
  it('requires several weeks of the full payroll left in cash after the deal', () => {
    const totalWageBill = 10_000;
    const reserve = calculateWageReserve(totalWageBill);
    expect(canAffordWage(reserve, totalWageBill)).toBe(true);
    expect(canAffordWage(reserve - 1, totalWageBill)).toBe(false);
  });

  it('blocks a signing that would leave the club unable to cover its next few payrolls', () => {
    // Rich in players' wages but the fee ate almost all the cash.
    expect(canAffordWage(1_000, 50_000)).toBe(false);
  });

  it('allows a signing when plenty of cash remains relative to the new total payroll', () => {
    expect(canAffordWage(1_000_000, 20_000)).toBe(true);
  });
});

describe('computeClubPrestige', () => {
  it('rates an elite, top-of-the-table, big-stadium club higher than a small bottom-of-the-table one', () => {
    const elite = computeClubPrestige({ avgSquadOverall: 88, stadiumLevel: 5, division: 1, leaguePosition: 1, totalClubsInLeague: 8, titlesWon: 0 });
    const small = computeClubPrestige({ avgSquadOverall: 55, stadiumLevel: 1, division: 3, leaguePosition: 8, totalClubsInLeague: 8, titlesWon: 0 });
    expect(elite).toBeGreaterThan(small);
    expect(elite).toBeLessThanOrEqual(1);
    expect(small).toBeGreaterThanOrEqual(0);
  });

  it('defaults to a neutral standing factor before the league has any table yet', () => {
    const preSeason = computeClubPrestige({ avgSquadOverall: 70, stadiumLevel: 2, division: 1, leaguePosition: null, totalClubsInLeague: 8, titlesWon: 0 });
    expect(preSeason).toBeGreaterThan(0);
    expect(preSeason).toBeLessThan(1);
  });

  it('rates a proven title-winning club higher than an otherwise identical one with none', () => {
    const base = { avgSquadOverall: 70, stadiumLevel: 2, division: 1, leaguePosition: 3, totalClubsInLeague: 8 };
    const winner = computeClubPrestige({ ...base, titlesWon: 5 });
    const untested = computeClubPrestige({ ...base, titlesWon: 0 });
    expect(winner).toBeGreaterThan(untested);
  });
});

describe('calculateLoanTerms', () => {
  it('repays principal plus interest over the chosen plan\'s term', () => {
    const { weeklyPayment, weeksRemaining } = calculateLoanTerms(200_000, 'MEDIO');
    expect(weeksRemaining).toBe(20);
    expect(weeklyPayment * weeksRemaining).toBeGreaterThan(200_000);
  });

  it('offers three distinct plans trading rate for term', () => {
    expect(LOAN_PLANS).toHaveLength(3);
    const short = calculateLoanTerms(200_000, 'CURTO');
    const long = calculateLoanTerms(200_000, 'LONGO');
    expect(short.weeksRemaining).toBeLessThan(long.weeksRemaining);
    // Shorter term, lower rate — but paid off much faster, so the weekly hit is still steeper.
    expect(short.weeklyPayment).toBeGreaterThan(long.weeklyPayment);
  });
});

describe('generateSponsorshipOffers', () => {
  const prestige = { avgSquadOverall: 70, stadiumLevel: 2, division: 1, leaguePosition: 3, totalClubsInLeague: 8, titlesWon: 0 };

  it('offers multiple competing deals per sponsorship type not already held', () => {
    const rng = createRng('sponsor-seed');
    const offers = generateSponsorshipOffers(rng, prestige);
    expect(offers).toHaveLength(SPONSOR_TYPES.length * 3);
    expect(new Set(offers.map((o) => o.type)).size).toBe(SPONSOR_TYPES.length);
    for (const offer of offers) {
      expect(offer.weeklyAmount).toBeGreaterThan(0);
      expect(offer.weeksRemaining).toBeGreaterThan(0);
      expect(offer.sponsorName.length).toBeGreaterThan(0);
      expect(CONTRACT_LENGTHS.some((c) => c.key === offer.contractLength)).toBe(true);
      expect(offer.titleBonus).toBeGreaterThan(offer.weeklyAmount);
      expect(offer.cupBonus).toBeGreaterThan(offer.weeklyAmount);
      expect(offer.signingBonus).toBeGreaterThanOrEqual(0);
      expect(offer.goals).toBeDefined();
    }
  });

  it('offers three candidates for a free slot and one rival for a taken one', () => {
    const held = ['MASTER', 'KIT_SUPPLIER'] as const;
    const offers = generateSponsorshipOffers(createRng('sponsor-seed-2'), prestige, [...held]);

    const livres = offers.filter((o) => !o.isReplacement);
    const rivais = offers.filter((o) => o.isReplacement);

    // Free slots still get a choice of three, and none of them is for a shirt already spoken for.
    expect(livres).toHaveLength((SPONSOR_TYPES.length - held.length) * 3);
    expect(livres.some((o) => held.includes(o.type as (typeof held)[number]))).toBe(false);

    /**
     * And each taken slot gets exactly one rival bidding for it.
     *
     * Without these the negotiation table was a list of vacancies: a club holding four of five sponsors saw
     * offers for the one empty slot and nothing else, so there was never a deal to weigh against a deal. One
     * per slot rather than three, because this is a decision about breaking a running contract and three
     * near-identical versions of it would bury the contract being competed with.
     */
    expect(rivais).toHaveLength(held.length);
    expect(new Set(rivais.map((o) => o.type))).toEqual(new Set(held));
  });

  it('pays a more prestigious club more for the same sponsorship type', () => {
    const eliteOffers = generateSponsorshipOffers(createRng('seed-x'), {
      avgSquadOverall: 88,
      stadiumLevel: 5,
      division: 1,
      leaguePosition: 1,
      totalClubsInLeague: 8,
      titlesWon: 5,
    });
    const smallOffers = generateSponsorshipOffers(createRng('seed-x'), {
      avgSquadOverall: 55,
      stadiumLevel: 1,
      division: 3,
      leaguePosition: 8,
      totalClubsInLeague: 8,
      titlesWon: 0,
    });
    const eliteMaster = eliteOffers.find((o) => o.type === 'MASTER')!;
    const smallMaster = smallOffers.find((o) => o.type === 'MASTER')!;
    expect(eliteMaster.weeklyAmount).toBeGreaterThan(smallMaster.weeklyAmount);
  });

  it('draws a naming-rights offer with its own longer, fixed contract duration', () => {
    const rng = createRng('naming-duration-seed');
    const offers = generateSponsorshipOffers(rng, prestige);
    const naming = offers.find((o) => o.type === 'STADIUM_NAMING')!;
    expect(naming.weeksRemaining).toBeGreaterThanOrEqual(40);
    expect(naming.weeksRemaining).toBeLessThanOrEqual(60);
  });

  it('only draws KIT_SUPPLIER offers from the Top Mundial tier for an elite club', () => {
    const elitePrestige = { avgSquadOverall: 90, stadiumLevel: 5, division: 1, leaguePosition: 1, totalClubsInLeague: 8, titlesWon: 5 };
    const topMundialNames = SPONSOR_TYPES.find((t) => t.type === 'KIT_SUPPLIER')!.tiers![0].names;
    for (let seed = 0; seed < 10; seed++) {
      const offers = generateSponsorshipOffers(createRng(`elite-kit-${seed}`), elitePrestige);
      const kit = offers.find((o) => o.type === 'KIT_SUPPLIER')!;
      expect(kit.sponsorTier).toBe('Top Mundial');
      expect(topMundialNames).toContain(kit.sponsorName);
    }
  });

  it('never draws a small club a Top Mundial KIT_SUPPLIER offer', () => {
    const smallPrestige = { avgSquadOverall: 45, stadiumLevel: 1, division: 4, leaguePosition: 8, totalClubsInLeague: 8, titlesWon: 0 };
    for (let seed = 0; seed < 10; seed++) {
      const offers = generateSponsorshipOffers(createRng(`small-kit-${seed}`), smallPrestige);
      const kit = offers.find((o) => o.type === 'KIT_SUPPLIER')!;
      expect(kit.sponsorTier).not.toBe('Top Mundial');
    }
  });
});

describe('generateNamingRightsChallengeOffer', () => {
  const prestige = { avgSquadOverall: 80, stadiumLevel: 4, division: 1, leaguePosition: 1, totalClubsInLeague: 8, titlesWon: 0 };

  it('returns null for a club with no titles', () => {
    expect(generateNamingRightsChallengeOffer(createRng('challenge-seed'), prestige, 0)).toBeNull();
  });

  it('returns a more lucrative STADIUM_NAMING offer once the club has won a title', () => {
    const rng1 = createRng('challenge-seed-2');
    const rng2 = createRng('challenge-seed-2');
    const normal = generateSponsorshipOffers(rng1, { ...prestige, titlesWon: 1 }, []).find((o) => o.type === 'STADIUM_NAMING')!;
    const challenge = generateNamingRightsChallengeOffer(rng2, { ...prestige, titlesWon: 1 }, 1)!;
    expect(challenge).not.toBeNull();
    expect(challenge.type).toBe('STADIUM_NAMING');
    expect(challenge.isChallenge).toBe(true);
    expect(challenge.weeklyAmount).toBeGreaterThan(normal.weeklyAmount);
  });
});

describe('stadiumDisplayName', () => {
  it('returns null with no active naming-rights sponsorship', () => {
    expect(stadiumDisplayName([])).toBeNull();
  });

  it('returns an Arena name built from the active naming-rights sponsor', () => {
    const sponsorships = generateSponsorshipOffers(createRng('arena-seed'), {
      avgSquadOverall: 70, stadiumLevel: 2, division: 1, leaguePosition: 3, totalClubsInLeague: 8, titlesWon: 0,
    }).filter((s) => s.type === 'STADIUM_NAMING');
    const name = stadiumDisplayName(sponsorships);
    expect(name).toBe(`Arena ${sponsorships[0].sponsorName}`);
  });
});

describe('applyFinancialMorale', () => {
  it('leaves morale untouched when the budget is at or above zero', () => {
    const players = [makePlayer('a', { morale: 50, wage: 1000 })];
    expect(applyFinancialMorale(players, 0, 1000)[0].morale).toBe(50);
    expect(applyFinancialMorale(players, 5000, 1000)[0].morale).toBe(50);
  });

  it('docks morale lightly for a budget barely in the red relative to payroll', () => {
    const players = [makePlayer('a', { morale: 50, wage: 1000 })];
    const wageBill = 10_000;
    const result = applyFinancialMorale(players, -1_000, wageBill); // 0.1 week of payroll underwater
    expect(result[0].morale).toBeLessThan(50);
    expect(result[0].morale).toBeGreaterThan(45);
  });

  it('docks morale harder for a deep financial crisis, but caps the penalty', () => {
    const players = [makePlayer('a', { morale: 80, wage: 1000 })];
    const wageBill = 10_000;
    const mild = applyFinancialMorale(players, -1_000, wageBill); // 0.1 week underwater
    const severe = applyFinancialMorale(players, -100_000, wageBill); // 10 weeks underwater

    expect(80 - severe[0].morale).toBeGreaterThan(80 - mild[0].morale);
    expect(severe[0].morale).toBe(60); // capped at MAX_FINANCIAL_MORALE_PENALTY = 20
  });

  it('never drops morale below zero even from an extreme deficit', () => {
    const players = [makePlayer('a', { morale: 5, wage: 1000 })];
    const result = applyFinancialMorale(players, -10_000_000, 1000);
    expect(result[0].morale).toBe(0);
  });
});

describe('calculatePrizeMoney', () => {
  it('pays the league winner more than lower finishers, with a floor for everyone', () => {
    const first = calculatePrizeMoney(1);
    const mid = calculatePrizeMoney(4);
    const last = calculatePrizeMoney(8);
    expect(first).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(last);
    expect(last).toBeGreaterThan(0);
  });

  it('pays less in a lower division for the same final position', () => {
    const topFlight = calculatePrizeMoney(1, 1);
    const secondDivision = calculatePrizeMoney(1, 2);
    expect(topFlight).toBeGreaterThan(secondDivision);
  });
});

describe('calculateCupPrizeMoney', () => {
  it('pays the champion the most, then finalist, semifinalist, quarterfinalist in descending order', () => {
    const champion = calculateCupPrizeMoney(3, 3, true);
    const finalist = calculateCupPrizeMoney(3, 3, false);
    const semifinalist = calculateCupPrizeMoney(2, 3, false);
    const quarterfinalist = calculateCupPrizeMoney(1, 3, false);
    expect(champion).toBeGreaterThan(finalist);
    expect(finalist).toBeGreaterThan(semifinalist);
    expect(semifinalist).toBeGreaterThan(quarterfinalist);
  });
});

describe('evaluateSponsorGoals', () => {
  it('marks league position goal as achieved and pays reward when club finishes in target position', () => {
    const mockSponsorship = {
      id: 's-1',
      type: 'MASTER' as const,
      sponsorName: 'Test Sponsor',
      weeklyAmount: 50_000,
      weeksRemaining: 20,
      contractLength: 'MEDIO' as const,
      titleBonus: 500_000,
      cupBonus: 300_000,
      goals: [
        {
          id: 'g-1',
          type: 'LEAGUE_POSITION' as const,
          title: 'Top 4',
          description: 'Finish in Top 4',
          targetValue: 4,
          reward: 200_000,
          isCompleted: false,
        },
      ],
    };

    const { updatedSponsorships, totalRewardEarned, newlyCompletedGoals } = evaluateSponsorGoals(
      [mockSponsorship],
      { leaguePosition: 2, isChampion: false },
    );

    expect(totalRewardEarned).toBe(200_000);
    expect(newlyCompletedGoals).toHaveLength(1);
    expect(updatedSponsorships[0].goals![0].isCompleted).toBe(true);
  });

  it('evaluates goals_scored goals and marks completed when threshold reached', () => {
    const mockSponsorship = {
      id: 's-2',
      type: 'KIT_SUPPLIER' as const,
      sponsorName: 'Test Kit',
      weeklyAmount: 30_000,
      weeksRemaining: 20,
      contractLength: 'MEDIO' as const,
      titleBonus: 300_000,
      cupBonus: 200_000,
      goals: [
        {
          id: 'g-2',
          type: 'GOALS_SCORED' as const,
          title: '30 Goals',
          description: 'Score 30+ goals',
          targetValue: 30,
          reward: 150_000,
          isCompleted: false,
        },
      ],
    };

    const { totalRewardEarned, updatedSponsorships } = evaluateSponsorGoals(
      [mockSponsorship],
      { totalGoalsScored: 35 },
    );

    expect(totalRewardEarned).toBe(150_000);
    expect(updatedSponsorships[0].goals![0].isCompleted).toBe(true);
  });
});

describe('generateMidSeasonSponsorshipOffers', () => {
  const prestige = { avgSquadOverall: 75, stadiumLevel: 3, division: 1, leaguePosition: 2, totalClubsInLeague: 20, titlesWon: 1 };
  const activeSponsors = [
    {
      id: 'active-master',
      type: 'MASTER' as const,
      sponsorName: 'Old Sponsor',
      weeklyAmount: 80_000,
      weeksRemaining: 15,
      contractLength: 'MEDIO' as const,
      titleBonus: 800_000,
      cupBonus: 500_000,
    },
  ];

  it('generates lucrative poach offers when club is in top 4', () => {
    const rng = createRng('poach-seed');
    const poachOffers = generateMidSeasonSponsorshipOffers(rng, prestige, activeSponsors, 2);

    expect(poachOffers.length).toBeGreaterThan(0);
    expect(poachOffers[0].isPoachOffer).toBe(true);
    expect(poachOffers[0].weeklyAmount).toBeGreaterThan(activeSponsors[0].weeklyAmount);
    expect(poachOffers[0].signingBonus).toBeGreaterThan(0);
    expect(poachOffers[0].replacedSponsorName).toBe('Old Sponsor');
  });

  it('does not generate poach offers when club is low in the table', () => {
    const rng = createRng('poach-seed');
    const poachOffers = generateMidSeasonSponsorshipOffers(rng, prestige, activeSponsors, 12);
    expect(poachOffers).toHaveLength(0);
  });

  it('does not re-poach an already poached contract in the same cycle', () => {
    const rng = createRng('poach-seed');
    const alreadyPoachedSponsors = [
      {
        ...activeSponsors[0],
        isPoachOffer: true,
      },
    ];
    const poachOffers = generateMidSeasonSponsorshipOffers(rng, prestige, alreadyPoachedSponsors, 1);
    expect(poachOffers).toHaveLength(0);
  });

  it('respects market cap ceiling and will not generate if already at or above ceiling', () => {
    const rng = createRng('poach-seed');
    const ultraHighSponsors = [
      {
        ...activeSponsors[0],
        weeklyAmount: 5_000_000,
      },
    ];
    const poachOffers = generateMidSeasonSponsorshipOffers(rng, prestige, ultraHighSponsors, 1);
    expect(poachOffers).toHaveLength(0);
  });
});

/**
 * The board a club carries when nobody negotiates for it.
 *
 * Only an owner can sign a sponsorship, so before this existed every computer-run club in the world held
 * none at all and ran at a permanent loss. See buildSponsorBoard.
 */
describe('buildSponsorBoard', () => {
  const club = (stadiumLevel: number): ClubPrestigeInputs => ({
    avgSquadOverall: 68,
    stadiumLevel,
    division: 1,
    leaguePosition: null,
    totalClubsInLeague: 20,
    titlesWon: 0,
  });

  it('gives a bigger ground a bigger board, and never an empty one', () => {
    const village = buildSponsorBoard(createRng('village'), club(1), 2_000);
    const giant = buildSponsorBoard(createRng('giant'), club(4), 90_000);

    expect(village.length).toBeGreaterThan(0);
    expect(giant.length).toBeGreaterThan(village.length);
    expect(giant.length).toBeLessThanOrEqual(MAX_SPONSORSHIPS);
  });

  it('reads the seats rather than the upgrade tier', () => {
    /**
     * Stadium level 2 covers everything from 15.000 to 39.999 seats, which was 1.287 of the 1.526 clubs in
     * the shipped world sharing one bucket. Two clubs on the same tier with very different grounds must not
     * end up with the same sponsors.
     */
    const modest = buildSponsorBoard(createRng('modest'), club(2), 16_000);
    const large = buildSponsorBoard(createRng('large'), club(2), 39_000);
    expect(large.length).toBeGreaterThan(modest.length);
  });

  it('hands over contracts already running, not a windfall', () => {
    const board = buildSponsorBoard(createRng('running'), club(3), 45_000);

    for (const deal of board) {
      // A signing bonus is what a manager collects for closing a deal. Nobody closed these.
      expect(deal.signingBonus ?? 0).toBe(0);
      expect(deal.weeklyAmount).toBeGreaterThan(0);
      expect(deal.weeksRemaining).toBeGreaterThan(0);
      // Goals exist for a manager to chase; nothing would ever evaluate them here.
      expect(deal.goals ?? []).toHaveLength(0);
    }
    // One deal per type: a club cannot hold two shirt sponsors.
    expect(new Set(board.map((d) => d.type)).size).toBe(board.length);
  });

  it('is the same board every time, for the same club', () => {
    const first = buildSponsorBoard(createRng('repeat'), club(3), 45_000);
    const second = buildSponsorBoard(createRng('repeat'), club(3), 45_000);
    expect(second).toEqual(first);
  });

  it('covers a real club well enough to keep it out of the red on its own', () => {
    /**
     * The number that mattered: measured across the 1.526 clubs of the imported world, a median club's wage
     * bill runs to about R$ 181.000 a week against R$ 150.000 of gate money at a 25.000-seat ground. The
     * board plus the gate has to come close enough that the annual television money can finish the job,
     * otherwise the world is insolvent by construction, which is exactly where it was.
     */
    const board = buildSponsorBoard(createRng('median'), club(2), 25_000);
    const weekly = board.reduce((sum, deal) => sum + deal.weeklyAmount, 0);
    const gate = calculateStadiumRevenue(25_000);

    expect(weekly + gate).toBeGreaterThan(181_000);
  });
});

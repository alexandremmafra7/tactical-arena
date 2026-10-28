import { randomUUID } from 'node:crypto';
import {
  Club,
  ClubPrestigeInputs,
  Cup,
  LoanPlanKey,
  LOAN_PLANS,
  MAX_SPONSORSHIPS,
  MAX_LOAN_AMOUNT,
  MIN_LOAN_AMOUNT,
  Sponsorship,
  StandingRow,
  calculateCupPrizeMoney,
  calculateLoanTerms,
  calculatePrizeMoney,
  calculateClubVisibility,
  generateSeasonBroadcastTargets,
  evaluateBroadcastTargets,
  clubRoundReached,
  createRng,
  evaluateSponsorGoals,
  generateMidSeasonSponsorshipOffers,
  generateNamingRightsChallengeOffer,
  generateSponsorshipOffers,
  getNextStadiumLevel,
  getNextStadiumTier,
  getNextStadiumReform,
  getStadiumCurrentStep,
  type StadiumConstruction,
  totalCupRounds,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub } from './clubService.js';
import { getManagerStyle } from './managerStyleService.js';

export class FinanceError extends Error {}

/** Shared guard: while cash flow is negative, no new spending commitments (training, sponsorships, loans). */
export function assertPositiveCashFlow(club: Club, ErrorClass: new (message: string) => Error = FinanceError): void {
  if (club.budget < 0) {
    throw new ErrorClass('Orçamento negativo: acerte as pendências financeiras antes de assumir novos compromissos');
  }
}

/**
 * Candidate sponsorship offers to show the manager — generates multiple competing proposals per available
 * slot (with different archetypes, upfront transfer funds and performance clauses) plus mid-season poach offers.
 */
export function getSponsorshipOffers(club: Club, prestige: ClubPrestigeInputs, managerStyle?: string | null): Sponsorship[] {
  const rng = createRng(`${club.id}-sponsors-${Date.now()}`);
  const activeTypes = club.sponsorships.map((s) => s.type);
  const activeSponsorNames = club.sponsorships.map((s) => s.sponsorName);
  const style = managerStyle ?? getManagerStyle(club.ownerId);
  const offers = generateSponsorshipOffers(rng, prestige, activeTypes, 3, activeSponsorNames, style);

  // A proven winner attracts rival bids for a naming-rights deal it already holds — see
  // generateNamingRightsChallengeOffer. Signing this one replaces the active deal (signSponsorship).
  const activeNaming = club.sponsorships.find((s) => s.type === 'STADIUM_NAMING');
  if (activeNaming) {
    const challenge = generateNamingRightsChallengeOffer(rng, prestige, club.titlesWon);
    if (challenge) offers.push(challenge);
  }

  // Mid-season poaching offers for top performers
  const midSeasonOffers = generateMidSeasonSponsorshipOffers(rng, prestige, club.sponsorships, prestige.leaguePosition);
  offers.push(...midSeasonOffers);

  return offers;
}

export async function signSponsorship(clubId: string, requestingUserId: string, offer: Sponsorship): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new FinanceError('Você não é o dono deste clube');
  }
  assertPositiveCashFlow(club);

  const isNamingRightsReplace = offer.isChallenge === true && offer.type === 'STADIUM_NAMING';
  const isPoachReplace = offer.isPoachOffer === true;
  // A rival bidding openly for a slot the club already holds. Signing it breaks the running contract.
  const isOpenReplace = offer.isReplacement === true && club.sponsorships.some((s) => s.type === offer.type);
  const isReplace = isNamingRightsReplace || isPoachReplace || isOpenReplace;

  if (!isReplace && club.sponsorships.length >= MAX_SPONSORSHIPS) {
    throw new FinanceError(`Este clube já tem o máximo de ${MAX_SPONSORSHIPS} patrocínios ativos`);
  }
  if (!isReplace && club.sponsorships.some((s) => s.type === offer.type)) {
    throw new FinanceError('Este clube já tem um patrocínio ativo desse tipo');
  }
  if (!Number.isFinite(offer.weeklyAmount) || offer.weeklyAmount <= 0 || !Number.isFinite(offer.weeksRemaining) || offer.weeksRemaining <= 0) {
    throw new FinanceError('Proposta de patrocínio inválida');
  }

  const remainingSponsorships = isReplace
    ? club.sponsorships.filter((s) => s.type !== offer.type)
    : club.sponsorships;

  const signedSponsorship: Sponsorship = { ...offer, id: randomUUID() };
  const sponsorships = [...remainingSponsorships, signedSponsorship];

  // Upfront transfer acquisition fund / signing bonus credited immediately to the club budget
  const upfrontBonus = offer.signingBonus ?? 0;
  const budget = club.budget + upfrontBonus;

  await prisma.club.update({
    where: { id: clubId },
    data: {
      sponsorshipsJson: JSON.stringify(sponsorships),
      budget,
    },
  });

  return { ...club, sponsorships, budget };
}

export async function takeLoan(clubId: string, requestingUserId: string, amount: number, planKey: LoanPlanKey): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new FinanceError('Você não é o dono deste clube');
  }
  assertPositiveCashFlow(club);

  if (!Number.isFinite(amount) || amount < MIN_LOAN_AMOUNT || amount > MAX_LOAN_AMOUNT) {
    throw new FinanceError(`O empréstimo deve ficar entre ${MIN_LOAN_AMOUNT} e ${MAX_LOAN_AMOUNT}`);
  }
  if (!LOAN_PLANS.some((p) => p.key === planKey)) {
    throw new FinanceError('Plano de empréstimo inválido');
  }

  const { weeklyPayment, weeksRemaining } = calculateLoanTerms(amount, planKey);
  const loans = [...club.loans, { id: randomUUID(), planKey, principal: amount, remainingBalance: amount, weeklyPayment, weeksRemaining }];
  const budget = club.budget + amount;

  await prisma.club.update({ where: { id: clubId }, data: { loansJson: JSON.stringify(loans), budget } });

  return { ...club, loans, budget };
}

/**
 * Starts a stadium expansion: pays `upgradeCost` upfront, but the club keeps playing at its current
 * (smaller) capacity for `constructionWeeks` — the new level only comes online once the countdown
 * finishes (see developmentService.advanceWeek). Only one expansion can be underway at a time.
 */
export async function upgradeStadium(clubId: string, requestingUserId: string, useSubReforms: boolean = false): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new FinanceError('Você não é o dono deste clube');
  }
  if (club.stadiumConstruction) {
    throw new FinanceError('Já existe uma obra em andamento neste estádio');
  }

  const currentTier = club.stadiumTier ?? club.stadiumLevel ?? 1;
  const currentStep = (club as any).stadiumStep ?? getStadiumCurrentStep(currentTier, club.stadiumCapacity);
  const nextReform = useSubReforms ? getNextStadiumReform(currentTier, currentStep) : null;

  let cost: number;
  let durationWeeks: number;
  let stadiumConstruction: StadiumConstruction;

  if (nextReform) {
    cost = nextReform.cost;
    durationWeeks = nextReform.durationWeeks;
    stadiumConstruction = {
      targetLevel: nextReform.step === 4 ? currentTier + 1 : currentTier,
      targetStep: nextReform.step,
      stepName: nextReform.name,
      targetCapacity: nextReform.targetCapacity,
      weeksRemaining: nextReform.durationWeeks,
      videoFile: nextReform.videoFile,
    };
  } else {
    const next = getNextStadiumLevel(club.stadiumLevel);
    if (!next) {
      throw new FinanceError('O estádio já está no nível máximo');
    }
    cost = next.upgradeCost;
    durationWeeks = next.constructionWeeks;
    stadiumConstruction = {
      targetLevel: next.level,
      weeksRemaining: next.constructionWeeks,
    };
  }

  if (club.budget < cost) {
    throw new FinanceError('Orçamento insuficiente para reformar o estádio');
  }

  const budget = club.budget - cost;
  await prisma.club.update({
    where: { id: clubId },
    data: {
      budget,
      stadiumConstructionJson: JSON.stringify(stadiumConstruction),
      stadiumUpgradeWeek: durationWeeks,
    },
  });

  return { ...club, budget, stadiumConstruction, stadiumUpgradeWeek: durationWeeks };
}

/**
 * Called when a league finishes: pays prize money, title bonuses, and evaluates contractual performance goals.
 */
export async function distributePrizeMoney(clubIds: string[], standings: StandingRow[], division: number = 1): Promise<void> {
  const positionByClubId = new Map(standings.map((row, index) => [row.clubId, index + 1]));
  const championClubId = standings[0]?.clubId;

  for (const clubId of clubIds) {
    const position = positionByClubId.get(clubId);
    if (!position) continue;

    const club = await getClub(clubId).catch(() => null);
    if (!club) continue;

    const isChampion = clubId === championClubId;
    const isRelegated = position > standings.length - 4;
    const standingRow = standings.find((s) => s.clubId === clubId);

    const goalEvaluation = evaluateSponsorGoals(club.sponsorships, {
      leaguePosition: position,
      totalClubsInLeague: standings.length,
      isChampion,
      isRelegated,
      totalGoalsScored: standingRow?.goalsFor ?? 0,
    });

    const visibility = calculateClubVisibility(club, division, club.titlesWon, club.membersCount ?? 0);
    const broadcastTargets = generateSeasonBroadcastTargets(visibility.score, division);
    const broadcastEval = evaluateBroadcastTargets(broadcastTargets, {
      leaguePosition: position,
      totalClubsInLeague: standings.length,
      isChampion,
      totalGoalsScored: standingRow?.goalsFor ?? 0,
    });

    const prize = calculatePrizeMoney(position, division);
    const titleBonus = isChampion ? club.sponsorships.reduce((sum, s) => sum + s.titleBonus, 0) : 0;
    const totalGoalsBonus = goalEvaluation.totalRewardEarned;
    const broadcastBonus = broadcastEval.totalRewardEarned;

    await prisma.club.update({
      where: { id: clubId },
      data: {
        budget: club.budget + prize + titleBonus + totalGoalsBonus + broadcastBonus,
        sponsorshipsJson: JSON.stringify(goalEvaluation.updatedSponsorships),
        ...(isChampion ? { titlesWon: club.titlesWon + 1 } : {}),
      },
    });
  }
}

/**
 * Called when a cup's final has been decided: pays prize money, cup bonuses, and evaluates contractual goals.
 */
export async function distributeCupPrizeMoney(cup: Cup): Promise<void> {
  const totalRounds = totalCupRounds(cup.clubIds.length);

  for (const clubId of cup.clubIds) {
    const roundReached = clubRoundReached(cup, clubId);
    if (roundReached === null) continue;

    const club = await getClub(clubId).catch(() => null);
    if (!club) continue;

    const isChampion = clubId === cup.championClubId;
    const isCupFinalist = roundReached >= totalRounds - 1;
    const prize = calculateCupPrizeMoney(roundReached, totalRounds, isChampion);
    const cupBonus = isChampion ? club.sponsorships.reduce((sum, s) => sum + s.cupBonus, 0) : 0;

    const goalEvaluation = evaluateSponsorGoals(club.sponsorships, {
      cupRoundReached: roundReached,
      totalCupRounds: typeof totalCupRounds === 'function' ? totalCupRounds(club.players.length) : 4,
      isCupChampion: isChampion,
    });

    const visibility = calculateClubVisibility(club, 1, club.titlesWon, club.membersCount ?? 0);
    const broadcastTargets = generateSeasonBroadcastTargets(visibility.score, 1);
    const broadcastEval = evaluateBroadcastTargets(broadcastTargets, {
      isCupFinalist,
      isChampion,
    });

    const totalGoalsBonus = goalEvaluation.totalRewardEarned;
    const broadcastBonus = broadcastEval.totalRewardEarned;

    await prisma.club.update({
      where: { id: clubId },
      data: {
        budget: club.budget + prize + cupBonus + totalGoalsBonus + broadcastBonus,
        sponsorshipsJson: JSON.stringify(goalEvaluation.updatedSponsorships),
        ...(isChampion ? { titlesWon: club.titlesWon + 1 } : {}),
      },
    });
  }
}

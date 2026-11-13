import { randomUUID } from 'node:crypto';
import {
  applyStarSigningMembershipBoost,
  calculateInitialMembers,
  membershipCeiling,
  BOT_OWNER_ID,
  Club,
  Player,
  TransferListing,
  TransferProposal,
  TransferProposalStatus,
  calculateInstallmentPlan,
  calculateWageBill,
  canAffordWage,
  evaluateTransferProposal,
  directorVerdict,
  getDirectorTransferDiscount,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { recordPredictionOnce } from './staffRecordService.js';
import { getGameState } from './gameStateService.js';
import { getClub, vacatedRoleFields } from './clubService.js';
import { generateTransferNews } from './newsService.js';

export class TransferError extends Error {}

/**
 * A signing needs more than the transfer fee — it also commits the buyer to a new recurring wage
 * starting immediately. Blocks any deal that would leave the club without a cash cushion for its own
 * payroll (see canAffordWage/WAGE_RESERVE_WEEKS in finance.ts) — the wage-affordability gate that keeps
 * salary tied to hiring, not just to the weekly finance tick.
 */
function assertWageAffordable(club: Club, cashAfterDeal: number, netWageChange: number): void {
  const currentWageBill = calculateWageBill(club.players) + calculateWageBill(club.academyPlayers);
  const totalWageBillAfterDeal = currentWageBill + netWageChange;
  if (!canAffordWage(cashAfterDeal, totalWageBillAfterDeal)) {
    throw new TransferError(
      'Este clube não vai sobrar caixa suficiente para pagar a folha salarial (elenco + este jogador) nas próximas semanas',
    );
  }
}

/**
 * A torcida reage a um reforço de peso.
 *
 * `applyStarSigningMembershipBoost` estava escrita no shared e tinha zero chamadas, como as outras duas
 * regras de sócio que liguei hoje. É a que faltava: contratar um craque enche a sede de sócio novo, e o
 * dinheiro disso é justamente o que ajuda a pagar o craque.
 *
 * Best-effort de propósito. A transferência já foi confirmada quando isto roda, e um tropeço aqui não pode
 * desfazer uma compra que o jogador já viu acontecer.
 */
async function applyStarSigningMembership(buyerClubId: string, player: { overall: number }): Promise<void> {
  if (player.overall < 80) return;

  const record = await prisma.club.findUnique({
    where: { id: buyerClubId },
    select: { membersCount: true, stadiumCapacity: true, playersJson: true },
  });
  if (!record) return;

  const socios =
    record.membersCount ??
    calculateInitialMembers({ players: JSON.parse(record.playersJson), stadiumCapacity: record.stadiumCapacity } as Club, 1);

  const { newMembers } = applyStarSigningMembershipBoost(socios, player.overall, membershipCeiling(record.stadiumCapacity));
  await prisma.club.update({ where: { id: buyerClubId }, data: { membersCount: newMembers } });
}

export async function listPlayerForTransfer(clubId: string, requestingUserId: string, playerId: string, askingPrice: number): Promise<TransferListing> {
  if (!Number.isFinite(askingPrice) || askingPrice <= 0) {
    throw new TransferError('Preço pedido deve ser maior que zero');
  }

  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new TransferError('Você não é o dono deste clube');
  }

  const player = club.players.find((p) => p.id === playerId);
  if (!player) {
    throw new TransferError('Jogador não pertence a este clube');
  }

  const existingActive = await findActiveListingsByClub(clubId);
  if (existingActive.some((listing) => listing.player.id === playerId)) {
    throw new TransferError('Este jogador já está listado no mercado');
  }

  const id = randomUUID();
  const record = await prisma.transferListing.create({
    data: { id, clubId, playerJson: JSON.stringify(player), askingPrice: Math.round(askingPrice), status: 'ACTIVE' },
  });

  return toDomain(record, club.name);
}

export async function cancelListing(listingId: string, requestingUserId: string): Promise<void> {
  const record = await prisma.transferListing.findUnique({ where: { id: listingId } });
  if (!record) {
    throw new TransferError('Anúncio não encontrado');
  }
  if (record.status !== 'ACTIVE') {
    throw new TransferError('Este anúncio não está mais ativo');
  }

  const club = await getClub(record.clubId);
  if (club.ownerId !== requestingUserId) {
    throw new TransferError('Você não é o dono deste anúncio');
  }

  await prisma.transferListing.update({ where: { id: listingId }, data: { status: 'CANCELLED' } });
}

export async function listActiveListings(): Promise<TransferListing[]> {
  const records = await prisma.transferListing.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
  if (records.length === 0) return [];

  const clubIds = [...new Set(records.map((r) => r.clubId))];
  const clubs = await prisma.club.findMany({ where: { id: { in: clubIds } } });
  const clubNameById = new Map(clubs.map((c) => [c.id, c.name]));

  return records.map((record) => toDomain(record, clubNameById.get(record.clubId) ?? 'Clube desconhecido'));
}

/**
 * Buys a listed player instantly at the asking price. Runs as a single DB transaction so the
 * squads and budgets of both clubs, plus the listing status, always move together.
 */
export async function buyListedPlayer(listingId: string, buyerUserId: string, buyerClubId: string): Promise<void> {
  const record = await prisma.transferListing.findUnique({ where: { id: listingId } });
  if (!record || record.status !== 'ACTIVE') {
    throw new TransferError('Anúncio não está mais disponível');
  }
  if (record.clubId === buyerClubId) {
    throw new TransferError('Você não pode comprar um jogador do seu próprio clube');
  }

  const buyerClub = await getClub(buyerClubId);
  if (buyerClub.ownerId !== buyerUserId) {
    throw new TransferError('Você não é o dono deste clube');
  }

  const director = buyerClub.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const discount = getDirectorTransferDiscount(director);
  const pricePaid = Math.round(record.askingPrice * (1 - discount));

  if (buyerClub.budget < pricePaid) {
    throw new TransferError('Orçamento insuficiente para esta contratação');
  }

  const sellerClub = await getClub(record.clubId);
  const player: Player = JSON.parse(record.playerJson);
  assertWageAffordable(buyerClub, buyerClub.budget - pricePaid, player.wage);
  const stillOwned = sellerClub.players.some((p) => p.id === player.id);
  if (!stillOwned) {
    await prisma.transferListing.update({ where: { id: listingId }, data: { status: 'CANCELLED' } });
    throw new TransferError('Jogador não está mais disponível neste clube');
  }

  const sellerPlayers = sellerClub.players.filter((p) => p.id !== player.id);
  const buyerPlayers = [...buyerClub.players, player];
  // Selling the captain/tutor/any set-piece taker vacates that designation — none should leave a
  // dangling reference to a player no longer on the roster.
  const sellerLostTutor = sellerClub.tutorPlayerId === player.id;

  await prisma.$transaction([
    prisma.club.update({
      where: { id: sellerClub.id },
      data: {
        playersJson: JSON.stringify(sellerPlayers),
        budget: sellerClub.budget + record.askingPrice,
        ...vacatedRoleFields(sellerClub, [player.id]),
        ...(sellerLostTutor ? { tutorPlayerId: null } : {}),
      },
    }),
    prisma.club.update({
      where: { id: buyerClub.id },
      data: { playersJson: JSON.stringify(buyerPlayers), budget: buyerClub.budget - pricePaid },
    }),
    prisma.transferListing.update({ where: { id: listingId }, data: { status: 'SOLD' } }),
  ]);

  /**
   * The director goes on record for the price they approved.
   *
   * Settled at the season turn against what the player turned out to be worth. Their verdict was always the
   * opinion the manager acted on; this is the half that says whether acting on it was right, which is the
   * only thing that makes one director worth more than another beyond the discount they negotiate.
   */
  if (director) {
    const verdict = directorVerdict(buyerClub, player, record.askingPrice);
    if (verdict) {
      await recordPredictionOnce(
        buyerClub.id,
        (rec) => rec.recommendationType === 'TRANSFER_VALUATION' && rec.playerId === player.id,
        {
          staffId: director.id,
          staffName: director.name,
          role: 'FOOTBALL_DIRECTOR',
          rating: director.rating,
          dateString: (await getGameState()).currentDate,
          recommendationType: 'TRANSFER_VALUATION',
          details: `Chamou o preço de ${player.name} de "${verdict.label}", avaliando em R$ ${verdict.valuation.toLocaleString('pt-BR')}`,
          playerId: player.id,
          metaJson: JSON.stringify({
            valuationType: verdict.label === 'Pechincha' ? 'PECHINCHA' : verdict.label === 'Caro' ? 'CARO' : 'JUSTO',
            purchasePrice: pricePaid,
            valuation: verdict.valuation,
          }),
        },
      ).catch((err) => console.error('registro do diretor de futebol falhou:', err));
    }
  }

  await generateTransferNews(buyerClub, sellerClub, player.name).catch((err) => console.error('generateTransferNews failed:', err));

  // A torcida reage ao reforço; ver applyStarSigningMembership.
  await applyStarSigningMembership(buyerClub.id, player).catch((err) =>
    console.error('applyStarSigningMembership failed:', err),
  );
}

/**
 * Buys a player outright by paying their full release clause. No listing and no seller consent
 * required — this is the whole point of a release clause. Runs as a single DB transaction, same
 * pattern as buyListedPlayer.
 */
export async function payReleaseClause(sellerClubId: string, playerId: string, buyerClubId: string, requestingUserId: string): Promise<void> {
  if (sellerClubId === buyerClubId) {
    throw new TransferError('Você não pode comprar um jogador do seu próprio clube');
  }

  const buyerClub = await getClub(buyerClubId);
  if (buyerClub.ownerId !== requestingUserId) {
    throw new TransferError('Você não é o dono deste clube');
  }

  const sellerClub = await getClub(sellerClubId);
  const player = sellerClub.players.find((p) => p.id === playerId);
  if (!player) {
    throw new TransferError('Jogador não pertence a este clube');
  }
  const isStarPlayer = player.overall >= 80 || player.starLevel !== 'NONE';
  let craqueFundDeduction = 0;
  let updatedSponsorships = buyerClub.sponsorships;

  if (isStarPlayer && buyerClub.sponsorships.length > 0) {
    const masterIndex = buyerClub.sponsorships.findIndex(
      (s) => s.type === 'MASTER' && (s.craqueFundRemaining ?? 0) > 0,
    );
    if (masterIndex !== -1) {
      const masterSponsor = buyerClub.sponsorships[masterIndex];
      craqueFundDeduction = Math.min(player.releaseClause, masterSponsor.craqueFundRemaining ?? 0);
      const remainingFund = (masterSponsor.craqueFundRemaining ?? 0) - craqueFundDeduction;
      updatedSponsorships = [...buyerClub.sponsorships];
      updatedSponsorships[masterIndex] = {
        ...masterSponsor,
        craqueFundRemaining: remainingFund,
      };
    }
  }

  const effectiveCashCost = Math.max(0, player.releaseClause - craqueFundDeduction);
  if (buyerClub.budget < effectiveCashCost) {
    throw new TransferError('Orçamento insuficiente para pagar a multa rescisória');
  }
  assertWageAffordable(buyerClub, buyerClub.budget - effectiveCashCost, player.wage);

  const sellerPlayers = sellerClub.players.filter((p) => p.id !== player.id);
  const buyerPlayers = [...buyerClub.players, player];
  const sellerLostTutor = sellerClub.tutorPlayerId === player.id;

  await prisma.$transaction([
    prisma.club.update({
      where: { id: sellerClub.id },
      data: {
        playersJson: JSON.stringify(sellerPlayers),
        budget: sellerClub.budget + player.releaseClause,
        ...vacatedRoleFields(sellerClub, [player.id]),
        ...(sellerLostTutor ? { tutorPlayerId: null } : {}),
      },
    }),
    prisma.club.update({
      where: { id: buyerClub.id },
      data: {
        playersJson: JSON.stringify(buyerPlayers),
        budget: buyerClub.budget - effectiveCashCost,
        sponsorshipsJson: JSON.stringify(updatedSponsorships),
      },
    }),
    prisma.transferListing.updateMany({
      where: { clubId: sellerClub.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    }),
  ]);

  await generateTransferNews(buyerClub, sellerClub, player.name).catch((err) => console.error('generateTransferNews failed:', err));

  // A torcida reage ao reforço; ver applyStarSigningMembership.
  await applyStarSigningMembership(buyerClub.id, player).catch((err) =>
    console.error('applyStarSigningMembership failed:', err),
  );
}

export interface ScoutingClubSummary {
  id: string;
  name: string;
  country: string;
  slug: string | null;
  players: Player[];
  stadiumCapacity: number;
  titlesWon: number;
}

/**
 * Sem país (ou 'GLOBAL') devolve só o ÍNDICE dos clubes — `players` vazio e `playersJson` nem sai do banco.
 *
 * O mundo importado tem ~2.100 clubes: devolver todos com elenco gerava ~86 MB de JSON e ~900 MB de pico de
 * memória numa única requisição — a tela inicial do clube fazia isso a cada carga, e numa hospedagem de
 * 512 MB o processo era morto por falta de memória (o jogo "não começava"). Elencos só saem por país.
 */
export async function listScoutingDatabase(country?: string): Promise<ScoutingClubSummary[]> {
  if (!country || country === 'GLOBAL') {
    const index = await prisma.club.findMany({
      select: { id: true, name: true, country: true, slug: true, stadiumCapacity: true, titlesWon: true },
      orderBy: { name: 'asc' },
    });
    return index.map((r) => ({ ...r, players: [] }));
  }

  const records = await prisma.club.findMany({
    where: { country },
    orderBy: { name: 'asc' },
  });

  return records.map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country,
    slug: r.slug,
    players: JSON.parse(r.playersJson),
    stadiumCapacity: r.stadiumCapacity,
    titlesWon: r.titlesWon,
  }));
}

export interface CreateProposalInput {
  buyerClubId: string;
  sellerClubId: string;
  targetPlayerId: string;
  cashAmount: number;
  installments: number;
  offeredPlayerIds: string[];
  requestingUserId: string;
  hasBankGuarantee?: boolean;
}

export async function createProposal(input: CreateProposalInput): Promise<TransferProposal> {
  const { buyerClubId, sellerClubId, targetPlayerId, requestingUserId, hasBankGuarantee = false } = input;
  if (buyerClubId === sellerClubId) {
    throw new TransferError('Você não pode fazer uma proposta para o seu próprio clube');
  }
  if (!Number.isFinite(input.cashAmount) || input.cashAmount < 0) {
    throw new TransferError('Valor em dinheiro inválido');
  }

  const buyerClub = await getClub(buyerClubId);
  if (buyerClub.ownerId !== requestingUserId) {
    throw new TransferError('Você não é o dono deste clube');
  }

  const sellerClub = await getClub(sellerClubId);
  const targetPlayer = sellerClub.players.find((p) => p.id === targetPlayerId);
  if (!targetPlayer) {
    throw new TransferError('Jogador alvo não pertence ao clube vendedor');
  }

  const offeredPlayerIds = [...new Set(input.offeredPlayerIds)];
  for (const offeredId of offeredPlayerIds) {
    if (!buyerClub.players.some((p) => p.id === offeredId)) {
      throw new TransferError('Jogador oferecido não pertence ao seu clube');
    }
  }
  if (input.cashAmount === 0 && offeredPlayerIds.length === 0) {
    throw new TransferError('A proposta precisa incluir dinheiro e/ou jogadores');
  }

  const confirmedOfferedPlayers = offeredPlayerIds.map((id) => buyerClub.players.find((p) => p.id === id)!);
  const id = randomUUID();
  const installments = Math.max(1, Math.round(input.installments));

  const isBotSeller = sellerClub.ownerId === BOT_OWNER_ID;

  if (isBotSeller) {
    const evaluation = evaluateTransferProposal({
      buyerClub,
      sellerClub,
      targetPlayer,
      cashAmount: input.cashAmount,
      installments,
      offeredPlayers: confirmedOfferedPlayers,
      hasBankGuarantee,
    });

    if (evaluation.accepted) {
      const payUpfront = installments <= 1;
      if (payUpfront && buyerClub.budget < input.cashAmount) {
        const record = await prisma.transferProposal.create({
          data: {
            id,
            buyerClubId,
            sellerClubId,
            targetPlayerId,
            targetPlayerName: targetPlayer.name,
            cashAmount: Math.round(input.cashAmount),
            installments,
            offeredPlayerIdsJson: JSON.stringify(offeredPlayerIds),
            status: 'REJECTED',
            responseMessage: 'Proposta aceita pela diretoria, porém cancelada por falta de saldo imediato em caixa do comprador.',
            requiresBankGuarantee: false,
            hasBankGuarantee,
          },
        });
        return toProposalDomain(record, buyerClub.name, sellerClub.name);
      }

      const cashAfterDeal = payUpfront ? buyerClub.budget - input.cashAmount : buyerClub.budget;
      const netWageChange = targetPlayer.wage - confirmedOfferedPlayers.reduce((sum, p) => sum + p.wage, 0);
      assertWageAffordable(buyerClub, cashAfterDeal, netWageChange);

      const sellerPlayers = [
        ...sellerClub.players.filter((p) => p.id !== targetPlayer.id),
        ...confirmedOfferedPlayers,
      ];
      const buyerPlayers = [
        ...buyerClub.players.filter((p) => !offeredPlayerIds.includes(p.id)),
        targetPlayer,
      ];
      const sellerLostTutor = sellerClub.tutorPlayerId === targetPlayer.id;
      const buyerLostTutor = confirmedOfferedPlayers.some((p) => p.id === buyerClub.tutorPlayerId);

      const newInstallmentPlan = payUpfront
        ? null
        : calculateInstallmentPlan(input.cashAmount, installments);

      await prisma.$transaction([
        prisma.club.update({
          where: { id: sellerClub.id },
          data: {
            playersJson: JSON.stringify(sellerPlayers),
            budget: payUpfront ? sellerClub.budget + input.cashAmount : sellerClub.budget,
            ...vacatedRoleFields(sellerClub, [targetPlayer.id]),
            ...(sellerLostTutor ? { tutorPlayerId: null } : {}),
          },
        }),
        prisma.club.update({
          where: { id: buyerClub.id },
          data: {
            playersJson: JSON.stringify(buyerPlayers),
            budget: payUpfront ? buyerClub.budget - input.cashAmount : buyerClub.budget,
            ...(newInstallmentPlan
              ? {
                  pendingTransferPaymentsJson: JSON.stringify([
                    ...buyerClub.pendingTransferPayments,
                    {
                      id: randomUUID(),
                      payerClubId: buyerClub.id,
                      payeeClubId: sellerClub.id,
                      weeklyAmount: newInstallmentPlan.weeklyAmount,
                      weeksRemaining: newInstallmentPlan.weeksRemaining,
                    },
                  ]),
                }
              : {}),
            ...vacatedRoleFields(buyerClub, offeredPlayerIds),
            ...(buyerLostTutor ? { tutorPlayerId: null } : {}),
          },
        }),
        prisma.transferProposal.create({
          data: {
            id,
            buyerClubId,
            sellerClubId,
            targetPlayerId,
            targetPlayerName: targetPlayer.name,
            cashAmount: Math.round(input.cashAmount),
            installments,
            offeredPlayerIdsJson: JSON.stringify(offeredPlayerIds),
            status: 'ACCEPTED',
            responseMessage: evaluation.reason,
            requiresBankGuarantee: evaluation.requiresBankGuarantee ?? false,
            hasBankGuarantee,
          },
        }),
      ]);

      await generateTransferNews(buyerClub, sellerClub, targetPlayer.name).catch((err) =>
        console.error('generateTransferNews failed:', err),
      );

      const record = await prisma.transferProposal.findUniqueOrThrow({ where: { id } });
      return toProposalDomain(record, buyerClub.name, sellerClub.name);
    } else {
      const record = await prisma.transferProposal.create({
        data: {
          id,
          buyerClubId,
          sellerClubId,
          targetPlayerId,
          targetPlayerName: targetPlayer.name,
          cashAmount: Math.round(input.cashAmount),
          installments,
          offeredPlayerIdsJson: JSON.stringify(offeredPlayerIds),
          status: 'REJECTED',
          responseMessage: evaluation.reason,
          requiresBankGuarantee: evaluation.requiresBankGuarantee ?? false,
          hasBankGuarantee,
        },
      });
      return toProposalDomain(record, buyerClub.name, sellerClub.name);
    }
  }

  // Human seller (PvP)
  const record = await prisma.transferProposal.create({
    data: {
      id,
      buyerClubId,
      sellerClubId,
      targetPlayerId,
      targetPlayerName: targetPlayer.name,
      cashAmount: Math.round(input.cashAmount),
      installments,
      offeredPlayerIdsJson: JSON.stringify(offeredPlayerIds),
      status: 'PENDING',
      hasBankGuarantee,
    },
  });

  return toProposalDomain(record, buyerClub.name, sellerClub.name);
}

export async function listProposalsForClub(clubId: string): Promise<TransferProposal[]> {
  const records = await prisma.transferProposal.findMany({
    where: { OR: [{ buyerClubId: clubId }, { sellerClubId: clubId }] },
    orderBy: { createdAt: 'desc' },
  });
  if (records.length === 0) return [];

  const clubIds = [...new Set(records.flatMap((r) => [r.buyerClubId, r.sellerClubId]))];
  const clubs = await prisma.club.findMany({ where: { id: { in: clubIds } } });
  const clubNameById = new Map(clubs.map((c) => [c.id, c.name]));

  return records.map((record) =>
    toProposalDomain(
      record,
      clubNameById.get(record.buyerClubId) ?? 'Clube desconhecido',
      clubNameById.get(record.sellerClubId) ?? 'Clube desconhecido',
    ),
  );
}

/**
 * Seller accepts a pending proposal. Re-validates that the target and offered players still sit
 * in the expected squads (either side may have been sold elsewhere while the proposal waited).
 * Players swap immediately either way; cash only moves immediately when paid in full — an
 * installment plan defers it to weekly ticks in developmentService.advanceWeek instead.
 */
export async function acceptProposal(proposalId: string, requestingUserId: string): Promise<void> {
  const record = await prisma.transferProposal.findUnique({ where: { id: proposalId } });
  if (!record || record.status !== 'PENDING') {
    throw new TransferError('Proposta não está mais disponível');
  }

  const sellerClub = await getClub(record.sellerClubId);
  if (sellerClub.ownerId !== requestingUserId) {
    throw new TransferError('Você não é o dono do clube vendedor');
  }

  const buyerClub = await getClub(record.buyerClubId);
  const targetPlayer = sellerClub.players.find((p) => p.id === record.targetPlayerId);
  if (!targetPlayer) {
    await prisma.transferProposal.update({ where: { id: proposalId }, data: { status: 'REJECTED' } });
    throw new TransferError('Jogador alvo não está mais neste clube');
  }

  const offeredPlayerIds: string[] = JSON.parse(record.offeredPlayerIdsJson);
  const offeredPlayers = offeredPlayerIds.map((id) => buyerClub.players.find((p) => p.id === id));
  if (offeredPlayers.some((p) => !p)) {
    await prisma.transferProposal.update({ where: { id: proposalId }, data: { status: 'REJECTED' } });
    throw new TransferError('Um dos jogadores oferecidos não está mais no clube comprador');
  }
  const confirmedOfferedPlayers = offeredPlayers as Player[];

  const payUpfront = record.installments <= 1;
  if (payUpfront && buyerClub.budget < record.cashAmount) {
    throw new TransferError('Clube comprador não tem orçamento suficiente para pagar à vista');
  }
  const cashAfterDeal = payUpfront ? buyerClub.budget - record.cashAmount : buyerClub.budget;
  const netWageChange = targetPlayer.wage - confirmedOfferedPlayers.reduce((sum, p) => sum + p.wage, 0);
  assertWageAffordable(buyerClub, cashAfterDeal, netWageChange);

  const sellerPlayers = [
    ...sellerClub.players.filter((p) => p.id !== targetPlayer.id),
    ...confirmedOfferedPlayers,
  ];
  const buyerPlayers = [
    ...buyerClub.players.filter((p) => !offeredPlayerIds.includes(p.id)),
    targetPlayer,
  ];
  const sellerLostTutor = sellerClub.tutorPlayerId === targetPlayer.id;
  const buyerLostTutor = confirmedOfferedPlayers.some((p) => p.id === buyerClub.tutorPlayerId);

  const newInstallmentPlan = payUpfront
    ? null
    : calculateInstallmentPlan(record.cashAmount, record.installments);

  await prisma.$transaction([
    prisma.club.update({
      where: { id: sellerClub.id },
      data: {
        playersJson: JSON.stringify(sellerPlayers),
        budget: payUpfront ? sellerClub.budget + record.cashAmount : sellerClub.budget,
        ...vacatedRoleFields(sellerClub, [targetPlayer.id]),
        ...(sellerLostTutor ? { tutorPlayerId: null } : {}),
      },
    }),
    prisma.club.update({
      where: { id: buyerClub.id },
      data: {
        playersJson: JSON.stringify(buyerPlayers),
        budget: payUpfront ? buyerClub.budget - record.cashAmount : buyerClub.budget,
        ...(newInstallmentPlan
          ? {
              pendingTransferPaymentsJson: JSON.stringify([
                ...buyerClub.pendingTransferPayments,
                {
                  id: randomUUID(),
                  payerClubId: buyerClub.id,
                  payeeClubId: sellerClub.id,
                  weeklyAmount: newInstallmentPlan.weeklyAmount,
                  weeksRemaining: newInstallmentPlan.weeksRemaining,
                },
              ]),
            }
          : {}),
        ...vacatedRoleFields(buyerClub, offeredPlayerIds),
        ...(buyerLostTutor ? { tutorPlayerId: null } : {}),
      },
    }),
    prisma.transferProposal.update({ where: { id: proposalId }, data: { status: 'ACCEPTED' } }),
  ]);

  await generateTransferNews(buyerClub, sellerClub, targetPlayer.name).catch((err) => console.error('generateTransferNews failed:', err));

  // A torcida reage ao reforço; ver applyStarSigningMembership.
  await applyStarSigningMembership(buyerClub.id, targetPlayer).catch((err) =>
    console.error('applyStarSigningMembership failed:', err),
  );
}

export async function rejectProposal(proposalId: string, requestingUserId: string): Promise<void> {
  const record = await prisma.transferProposal.findUnique({ where: { id: proposalId } });
  if (!record || record.status !== 'PENDING') {
    throw new TransferError('Proposta não está mais disponível');
  }
  const sellerClub = await getClub(record.sellerClubId);
  if (sellerClub.ownerId !== requestingUserId) {
    throw new TransferError('Você não é o dono do clube vendedor');
  }
  await prisma.transferProposal.update({ where: { id: proposalId }, data: { status: 'REJECTED' } });
}

export async function withdrawProposal(proposalId: string, requestingUserId: string): Promise<void> {
  const record = await prisma.transferProposal.findUnique({ where: { id: proposalId } });
  if (!record || record.status !== 'PENDING') {
    throw new TransferError('Proposta não está mais disponível');
  }
  const buyerClub = await getClub(record.buyerClubId);
  if (buyerClub.ownerId !== requestingUserId) {
    throw new TransferError('Você não é o dono do clube comprador');
  }
  await prisma.transferProposal.update({ where: { id: proposalId }, data: { status: 'WITHDRAWN' } });
}

interface ProposalRecord {
  id: string;
  buyerClubId: string;
  sellerClubId: string;
  targetPlayerId: string;
  targetPlayerName: string;
  cashAmount: number;
  installments: number;
  offeredPlayerIdsJson: string;
  status: string;
  responseMessage?: string | null;
  requiresBankGuarantee?: boolean | null;
  hasBankGuarantee?: boolean | null;
  createdAt: Date;
}

function toProposalDomain(record: ProposalRecord, buyerClubName: string, sellerClubName: string): TransferProposal {
  return {
    id: record.id,
    buyerClubId: record.buyerClubId,
    buyerClubName,
    sellerClubId: record.sellerClubId,
    sellerClubName,
    targetPlayerId: record.targetPlayerId,
    targetPlayerName: record.targetPlayerName,
    cashAmount: record.cashAmount,
    installments: record.installments,
    offeredPlayerIds: JSON.parse(record.offeredPlayerIdsJson),
    status: record.status as TransferProposalStatus,
    responseMessage: record.responseMessage ?? undefined,
    requiresBankGuarantee: Boolean(record.requiresBankGuarantee),
    hasBankGuarantee: Boolean(record.hasBankGuarantee),
    createdAt: record.createdAt.toISOString(),
  };
}

async function findActiveListingsByClub(clubId: string): Promise<TransferListing[]> {
  const records = await prisma.transferListing.findMany({ where: { clubId, status: 'ACTIVE' } });
  return records.map((r) => toDomain(r, ''));
}

interface ListingRecord {
  id: string;
  clubId: string;
  playerJson: string;
  askingPrice: number;
  status: string;
  createdAt: Date;
}

function toDomain(record: ListingRecord, clubName: string): TransferListing {
  return {
    id: record.id,
    clubId: record.clubId,
    clubName,
    player: JSON.parse(record.playerJson),
    askingPrice: record.askingPrice,
    status: record.status as TransferListing['status'],
    createdAt: record.createdAt.toISOString(),
  };
}

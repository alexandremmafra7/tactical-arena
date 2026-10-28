import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { listAvailableClubs, claimClub, getClub } from './clubService.js';
import { managerScore } from './careerService.js';
import { getGameMode } from './gameModeService.js';
import { withCareerOperationLock } from './careerOperationLock.js';
import { canTakeOverDivision } from '@tactical-arena/shared';

export class JobOfferError extends Error {}

const OFFER_COUNT = 3;

/** Bands (division numbers, best-fit first) offered at each track-record tier — a jobless rookie with no
 *  wins yet only gets approached by lower divisions; a proven, title-winning manager can be offered the
 *  top flight. Whatever band comes up empty (this install may not have every division populated) falls
 *  back to the next one, and finally to any available club at all, rather than offering nothing. */
function divisionBandsForScore(score: number): number[] {
  if (score >= 60) return [1, 2, 3, 4];
  if (score >= 25) return [2, 3, 4, 1];
  return [3, 4, 2, 1];
}

export interface JobOffer {
  id: string;
  clubId: string;
  clubName: string;
  createdAt: string;
}

/**
 * A jobless manager's current pending offers — generated lazily the first time they're requested (rather
 * than on a background schedule, since this game has no cron/tick infra) and reused until accepted. Only
 * makes sense for a user with no active tenure (see careerService.getCareer's `activeClubIds`); callers
 * should check that before calling this.
 */
export function getOrCreateOffers(userId: string): Promise<JobOffer[]> {
  return withCareerOperationLock(() => generateOffers(userId));
}

async function generateOffers(userId: string): Promise<JobOffer[]> {
  const existing = await prisma.jobOffer.findMany({ where: { userId, status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
  if (existing.length > 0) {
    return existing.map((o) => ({ id: o.id, clubId: o.clubId, clubName: o.clubName, createdAt: o.createdAt.toISOString() }));
  }

  const score = await managerScore(userId);
  /**
   * As faixas de divisão que o modo alcança, e só elas.
   *
   * Uma sondagem que o modo não deixa aceitar é um convite a assinar premium, e por isso aparece com
   * cadeado. Uma **oferta de emprego** que não se pode aceitar é outra coisa: chega a quem está desempregado
   * e sem nada para fazer, e uma lista de portas fechadas nesse momento lê-se como jogo quebrado.
   */
  const mode = getGameMode(userId);
  const bands = divisionBandsForScore(score).filter((division) => canTakeOverDivision(mode, division));

  /**
   * Um clube que demitiu este técnico não o chama de volta.
   *
   * Sem isto a primeira proposta que chegava a um demitido era o próprio clube que o tinha mandado embora
   * na mesma semana — verificado ao testar a demissão, e o bastante para desfazer o peso dela: perder o
   * emprego deixaria de ser consequência e passaria a ser um passeio de ida e volta.
   */
  const demitidoDe = new Set(
    (await prisma.managerTenure.findMany({ where: { userId, endReason: 'SACKED' }, select: { clubId: true } })).map(
      (t) => t.clubId,
    ),
  );

  const picked: { id: string; name: string }[] = [];
  const pickedIds = new Set<string>();
  for (const division of bands) {
    if (picked.length >= OFFER_COUNT) break;
    const candidates = await listAvailableClubs(undefined, division);
    for (const club of candidates) {
      if (picked.length >= OFFER_COUNT || pickedIds.has(club.id) || demitidoDe.has(club.id)) continue;
      picked.push({ id: club.id, name: club.name });
      pickedIds.add(club.id);
    }
  }
  if (picked.length === 0) {
    // No division-filtered candidates anywhere (e.g. a fresh install with only division-1 clubs) — any
    // available club beats offering nothing.
    const anyAvailable = await listAvailableClubs();
    for (const club of anyAvailable) {
      if (picked.length >= OFFER_COUNT) break;
      if (demitidoDe.has(club.id)) continue;
      picked.push({ id: club.id, name: club.name });
    }
  }

  const created = await Promise.all(
    picked.map((club) =>
      prisma.jobOffer.create({ data: { id: randomUUID(), userId, clubId: club.id, clubName: club.name } }),
    ),
  );
  return created.map((o) => ({ id: o.id, clubId: o.clubId, clubName: o.clubName, createdAt: o.createdAt.toISOString() }));
}

/** Accepts a pending offer: claims the club (reusing clubService.claimClub) and expires every other
 *  pending offer for this user, since they now have a club and shouldn't keep collecting more. */
export async function acceptOffer(offerId: string, requestingUserId: string) {
  const offer = await prisma.jobOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.userId !== requestingUserId) {
    throw new JobOfferError('Oferta não encontrada');
  }
  if (offer.status !== 'PENDING') {
    throw new JobOfferError('Esta oferta não está mais disponível');
  }

  // The offered club may have been claimed by someone else (or the offer gone stale) since it was made.
  const club = await getClub(offer.clubId);

  await prisma.jobOffer.update({ where: { id: offerId }, data: { status: 'ACCEPTED' } });
  await prisma.jobOffer.updateMany({
    where: { userId: requestingUserId, status: 'PENDING', id: { not: offerId } },
    data: { status: 'EXPIRED' },
  });

  if (club.ownerId !== requestingUserId) {
    return claimClub(offer.clubId, requestingUserId);
  }
  return club;
}

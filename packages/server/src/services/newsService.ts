import { randomUUID } from 'node:crypto';
import {
  Club,
  MatchEvent,
  MatchResult,
  MedicalRecovery,
  NewsCategory,
  NewsItem,
  goalStreakHeadline,
  matchResultHeadline,
  titleHeadline,
  transferInHeadline,
  transferOutHeadline,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';

async function recordNews(clubId: string, category: NewsCategory, headline: string): Promise<void> {
  await prisma.newsItem.create({ data: { id: randomUUID(), clubId, category, headline } });
}

const DEFAULT_LIMIT = 20;

export async function listNews(clubId: string, limit: number = DEFAULT_LIMIT): Promise<NewsItem[]> {
  const records = await prisma.newsItem.findMany({
    where: { clubId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return records.map((r) => ({ id: r.id, clubId: r.clubId, category: r.category as NewsCategory, headline: r.headline, createdAt: r.createdAt.toISOString() }));
}

/**
 * The transfer market across the whole game, not just one club's own dealings.
 *
 * Only TRANSFER_IN is read among transfers: every completed transfer writes two rows, an IN for the buyer
 * and an OUT for the seller (see `generateTransferNews`), and the buyer's headline already names both clubs
 * — so this is one row per deal rather than the same move reported twice.
 *
 * A troca de comando entra aqui pelo mesmo motivo que a transferência: é notícia do mundo, não do clube.
 * Sem isto, um técnico demitido do Palmeiras seria um fato que só o Palmeiras saberia, e o mercado de
 * treinadores existiria sem nunca ser sentido por quem joga.
 */
export async function listTransferNews(limit: number = DEFAULT_LIMIT): Promise<NewsItem[]> {
  const records = await prisma.newsItem.findMany({
    where: { category: { in: ['TRANSFER_IN', 'MANAGER'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return records.map((r) => ({
    id: r.id,
    clubId: r.clubId,
    category: r.category as NewsCategory,
    headline: r.headline,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** How many goals in one match before it's newsworthy on its own, not just part of the scoreline. */
const GOAL_STREAK_THRESHOLD = 2;

/**
 * Called once per finished match (see matchService.advanceLiveMatchUnchecked — the single place every
 * match, watched or auto-resolved, actually finalizes) — generates the result headline for BOTH sides,
 * plus any standout scoring performance, straight from the same MatchResult every other post-match system
 * already reads. Injury/suspension events already carry a fully-formatted Portuguese description from the
 * engine itself (see engine.ts resolveInjury/resolveFoul) — reused verbatim rather than re-templated.
 */
export async function generateMatchNews(homeClub: Club, awayClub: Club, result: MatchResult): Promise<void> {
  await Promise.all([
    generateSideNews(homeClub, awayClub, result.homeGoals, result.awayGoals, 'home', result.events),
    generateSideNews(awayClub, homeClub, result.awayGoals, result.homeGoals, 'away', result.events),
  ]);
}

export async function generateMedicalRecoveryNews(clubId: string, recoveries: MedicalRecovery[]): Promise<void> {
  await Promise.all(recoveries.map((recovery) => recordNews(
    clubId,
    'INJURY',
    `🏥 Fisioterapia: ${recovery.playerName} teve a recuperação reduzida em ${recovery.weeksReduced} semana${recovery.weeksReduced === 1 ? '' : 's'}.`,
  )));
}

async function generateSideNews(
  club: Club,
  opponent: Club,
  myGoals: number,
  oppGoals: number,
  side: 'home' | 'away',
  events: MatchEvent[],
): Promise<void> {
  await recordNews(club.id, 'MATCH_RESULT', matchResultHeadline(club.name, opponent.name, myGoals, oppGoals));

  const sideEvents = events.filter((e) => e.team === side);

  const goalsByPlayer = new Map<string, number>();
  for (const event of sideEvents) {
    if (event.type !== 'goal') continue;
    goalsByPlayer.set(event.playerId, (goalsByPlayer.get(event.playerId) ?? 0) + 1);
  }
  for (const [playerId, count] of goalsByPlayer) {
    if (count < GOAL_STREAK_THRESHOLD) continue;
    const playerName = club.players.find((p) => p.id === playerId)?.name ?? 'Um jogador';
    await recordNews(club.id, 'GOAL_STREAK', goalStreakHeadline(playerName, count, opponent.name));
  }

  for (const event of sideEvents) {
    if (event.type === 'injury') {
      await recordNews(club.id, 'INJURY', event.description);
    } else if (event.type === 'card' && event.suspensionMatches) {
      await recordNews(club.id, 'SUSPENSION', event.description);
    }
  }
}

export async function generateTransferNews(buyerClub: Club, sellerClub: Club, playerName: string): Promise<void> {
  await Promise.all([
    recordNews(buyerClub.id, 'TRANSFER_IN', transferInHeadline(buyerClub.name, playerName)),
    recordNews(sellerClub.id, 'TRANSFER_OUT', transferOutHeadline(sellerClub.name, playerName, buyerClub.name)),
  ]);
}

export async function generateTitleNews(clubName: string, clubId: string, competitionName: string): Promise<void> {
  await recordNews(clubId, 'TITLE', titleHeadline(clubName, competitionName));
}

/**
 * The two headlines a season is actually remembered for.
 *
 * Going up and coming down are the biggest things that happen to a club, and until access and relegation
 * existed there was nothing to report: every club finished every season exactly where it started. Written
 * one club at a time, because it is that club's news.
 */
export async function publishDivisionMoves(
  moves: { clubId: string; clubName: string; fromDivision: number; toDivision: number }[],
): Promise<void> {
  for (const move of moves) {
    const wentUp = move.toDivision < move.fromDivision;
    await recordNews(
      move.clubId,
      wentUp ? 'PROMOTION' : 'RELEGATION',
      wentUp
        ? `Acesso conquistado: ${move.clubName} sobe para a ${move.toDivision}ª divisão`
        : `Rebaixamento: ${move.clubName} cai para a ${move.toDivision}ª divisão`,
    );
  }
}

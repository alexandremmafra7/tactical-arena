import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { getGameState } from '../services/gameStateService.js';
import { getClubCalendar } from '../services/calendarViewService.js';
import { advanceToNextMatchday, peekNextMatchday, TimeError } from '../services/timeService.js';
import { seasonWindow, aggregateClubPlayerStats, BOT_OWNER_ID } from '@tactical-arena/shared';
import type { Club, FastAdvanceResult, PlayerStatsEntry } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { ClubNotFoundError } from '../services/clubService.js';
import { readSavesIndex } from '../services/saveService.js';

/** The game clock: what day it is, what is on the calendar, and moving to the next matchday. */
export const gameRouter = Router();

gameRouter.use(requireAuth);

gameRouter.get('/state', async (_req, res) => {
  const state = await getGameState();
  const { startDate, endDate } = seasonWindow(state.seasonYear);
  res.json({ ...state, seasonStartDate: startDate, seasonEndDate: endDate });
});

/**
 * One club's whole season, league and cup merged and sorted by date.
 *
 * The screens used to ask each competition separately and show them as two unrelated lists, which is
 * exactly why a cup tie sitting between two league rounds was invisible. Merging here — where the dates
 * live — is what makes the calendar read as one season.
 */
gameRouter.get('/calendar', async (req, res) => {
  const clubId = typeof req.query.clubId === 'string' ? req.query.clubId : undefined;
  if (!clubId) {
    res.status(400).json({ error: 'clubId é obrigatório' });
    return;
  }
  res.json(await getClubCalendar(clubId));
});

/** What is next on the calendar, without playing it. Feeds the matchday button's label. */
gameRouter.get('/next-matchday', async (_req, res) => {
  res.json(await peekNextMatchday());
});

/**
 * Moves the game to its next matchday and plays it.
 *
 * The single replacement for the four separate "advance this league's round" calls the screens used to
 * make. Which competition gets played is the calendar's decision now, not the button's.
 */
gameRouter.post('/advance', async (req: AuthedRequest, res) => {
  try {
    const { clubId } = req.body ?? {};
    if (clubId && typeof clubId === 'string') {
      let club = await prisma.club.findUnique({ where: { id: clubId } });
      if (!club) {
        club = await prisma.club.findUnique({ where: { slug: clubId } });
      }
      if (!club) {
        try {
          const index = readSavesIndex();
          const match = index.saves.find((s) => s.clubId === clubId);
          if (match?.clubSlug) {
            club = await prisma.club.findUnique({ where: { slug: match.clubSlug } });
          } else if (match?.clubName) {
            club = await prisma.club.findFirst({ where: { name: match.clubName } });
          }
        } catch {}
      }
      if (club && (club.ownerId === BOT_OWNER_ID || !club.ownerId)) {
        await prisma.club.update({ where: { id: club.id }, data: { ownerId: req.userId! } });
      }
    }
    res.json(await advanceToNextMatchday(req.userId!));
  } catch (err) {
    if (err instanceof TimeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

/**
 * "Pular até o Jogo" no servidor — o mesmo passo do modo offline (`localFastAdvanceToNextMatch`).
 *
 * O cliente sempre chamou esta rota, mas ela só existia no motor offline: no mundo hospedado o botão
 * respondia 404 e o técnico não saía do lugar. Cada passo é um `advanceToNextMatchday`; para assim que o
 * dia entrega uma partida ao técnico, quando ele é demitido, ou quando o calendário não tem mais o que jogar.
 */
const FAST_ADVANCE_MAX_STEPS = 8;

gameRouter.post('/fast-advance', async (req: AuthedRequest, res) => {
  try {
    const userId = req.userId!;
    const before = await getGameState();
    let stepsAdvanced = 0;
    let outcome = await advanceToNextMatchday(userId);
    stepsAdvanced += 1;
    while (
      stepsAdvanced < FAST_ADVANCE_MAX_STEPS &&
      !outcome.matchId &&
      !outcome.sackedFromClubId &&
      outcome.played.length > 0
    ) {
      outcome = await advanceToNextMatchday(userId);
      stepsAdvanced += 1;
    }

    const finalDate = String(outcome.date);
    let nextMatch: FastAdvanceResult['nextMatch'] = null;
    if (outcome.matchId) {
      const [match, mine] = await Promise.all([
        prisma.match.findUnique({
          where: { id: outcome.matchId },
          select: { homeClubId: true, awayClubId: true, competitionType: true, competitionId: true },
        }),
        prisma.club.findFirst({ where: { ownerId: userId }, select: { id: true } }),
      ]);
      if (match && mine) {
        const isHome = match.homeClubId === mine.id;
        const opponentId = isHome ? match.awayClubId : match.homeClubId;
        const opponent = await prisma.club.findUnique({ where: { id: opponentId }, select: { name: true } });
        const round = outcome.played.find((entry) => entry.competitionId === match.competitionId) ?? outcome.played[0];
        nextMatch = {
          matchId: outcome.matchId,
          opponentId,
          opponentName: opponent?.name ?? 'Adversário',
          isHome,
          competitionName: round?.competitionName ?? 'Campeonato',
          round: round?.round ?? 0,
          date: finalDate,
        };
      }
    }

    const result: FastAdvanceResult = {
      stepsAdvanced,
      initialDate: String(before.currentDate),
      finalDate,
      nextMatch,
      eventsSummary: [`Elenco recuperou fôlego ao longo de ${stepsAdvanced} rodada(s)`],
      interrupted: Boolean(outcome.sackedFromClubId),
      interruptionReason: outcome.sackedFromClubId
        ? {
            type: 'BOARD_CRISIS',
            title: 'Demissão',
            description: 'A diretoria encerrou o seu contrato durante o período simulado.',
          }
        : undefined,
      staminaRecovered: true,
    };
    res.json(result);
  } catch (err) {
    if (err instanceof TimeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

/**
 * Artilharia e assistências do mundo inteiro, lidas em lotes.
 *
 * Carregar os ~2.100 clubes de uma vez (linha completa + `toDomain`) custava mais de 600 MB de memória por
 * requisição. Só o elenco interessa aqui, e os 50 melhores do mundo estão necessariamente entre os 50
 * melhores de cada lote — então cada lote é agregado e descartado, e só os candidatos seguem adiante.
 */
const WORLD_STATS_BATCH = 100;

gameRouter.get('/world-stats', async (_req, res) => {
  let scorers: PlayerStatsEntry[] = [];
  let assistants: PlayerStatsEntry[] = [];
  let cursor: string | undefined;

  for (;;) {
    const records = await prisma.club.findMany({
      take: WORLD_STATS_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, name: true, slug: true, playersJson: true },
    });
    if (records.length === 0) break;
    cursor = records[records.length - 1].id;

    const batch = aggregateClubPlayerStats(
      records.map((r) => ({ id: r.id, name: r.name, slug: r.slug, players: JSON.parse(r.playersJson) }) as unknown as Club),
    );
    scorers = scorers.concat(batch.topScorers);
    assistants = assistants.concat(batch.topAssistants);
    if (records.length < WORLD_STATS_BATCH) break;
  }

  res.json({
    topScorers: scorers
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.matches - b.matches)
      .slice(0, 50),
    topAssistants: assistants
      .sort((a, b) => b.assists - a.assists || b.goals - a.goals || a.matches - b.matches)
      .slice(0, 50),
  });
});

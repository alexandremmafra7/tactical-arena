import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { getGameState } from '../services/gameStateService.js';
import { getClubCalendar } from '../services/calendarViewService.js';
import { advanceToNextMatchday, peekNextMatchday, TimeError } from '../services/timeService.js';
import { seasonWindow, aggregateClubPlayerStats, BOT_OWNER_ID } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { toDomain as toDomainClub } from '../services/clubService.js';

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
      const club = await prisma.club.findUnique({ where: { id: clubId } });
      if (club && (club.ownerId === BOT_OWNER_ID || !club.ownerId)) {
        await prisma.club.update({ where: { id: clubId }, data: { ownerId: req.userId! } });
      }
    }
    res.json(await advanceToNextMatchday(req.userId!));
  } catch (err) {
    if (err instanceof TimeError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

gameRouter.get('/world-stats', async (_req, res) => {
  const clubs = await prisma.club.findMany();
  const domainClubs = clubs.map((c) => toDomainClub(c));
  const stats = aggregateClubPlayerStats(domainClubs);
  res.json(stats);
});

import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import {
  advanceRound,
  forceStartLeague,
  getActiveLeagueForClub,
  getLeagueStats,
  getLeagueWithStandings,
  listLeagues,
  LeagueError,
} from '../services/leagueService.js';

export const leaguesRouter = Router();

leaguesRouter.use(requireAuth);

leaguesRouter.get('/', async (req, res) => {
  const country = typeof req.query.country === 'string' ? req.query.country : undefined;
  const division = typeof req.query.division === 'string' ? Number(req.query.division) : undefined;
  const leagues = await listLeagues(country, division);
  res.json(leagues);
});

/** Registered before '/:id' so the literal path is not swallowed by the id parameter. */
leaguesRouter.get('/active', async (req, res) => {
  const clubId = typeof req.query.clubId === 'string' ? req.query.clubId : undefined;
  if (!clubId) {
    res.status(400).json({ error: 'clubId é obrigatório' });
    return;
  }
  const league = await getActiveLeagueForClub(clubId);
  if (!league) {
    res.json(null);
    return;
  }
  const { standings } = await getLeagueWithStandings(league.id);
  res.json({ ...league, standings });
});

leaguesRouter.get('/:id', async (req, res) => {
  try {
    const { league, standings } = await getLeagueWithStandings(req.params.id);
    res.json({ ...league, standings });
  } catch (err) {
    if (err instanceof LeagueError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

leaguesRouter.get('/:id/stats', async (req, res) => {
  try {
    const stats = await getLeagueStats(req.params.id);
    res.json(stats);
  } catch (err) {
    if (err instanceof LeagueError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

leaguesRouter.post('/:id/force-start', async (req: AuthedRequest, res) => {
  try {
    const league = await forceStartLeague(req.params.id, req.userId!);
    res.json(league);
  } catch (err) {
    if (err instanceof LeagueError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

leaguesRouter.post('/:id/advance-round', async (req: AuthedRequest, res) => {
  try {
    const league = await advanceRound(req.params.id, req.userId!);
    res.json(league);
  } catch (err) {
    if (err instanceof LeagueError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

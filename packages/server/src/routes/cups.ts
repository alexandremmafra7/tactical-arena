import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { advanceCupRound, createCup, getCup, listCups, CupError } from '../services/cupService.js';

export const cupsRouter = Router();

cupsRouter.use(requireAuth);

cupsRouter.get('/', async (req, res) => {
  const country = typeof req.query.country === 'string' ? req.query.country : undefined;
  const clubId = typeof req.query.clubId === 'string' ? req.query.clubId : undefined;
  const cups = await listCups(country);
  if (clubId) {
    res.json(cups.filter((c) => c.clubIds.includes(clubId)));
    return;
  }
  res.json(cups);
});

cupsRouter.get('/:id', async (req, res) => {
  try {
    const cup = await getCup(req.params.id);
    res.json(cup);
  } catch (err) {
    if (err instanceof CupError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

cupsRouter.post('/', async (req: AuthedRequest, res) => {
  const { name, countryCode, clubIds } = req.body ?? {};
  if (typeof name !== 'string' || typeof countryCode !== 'string' || !Array.isArray(clubIds)) {
    res.status(400).json({ error: 'name, countryCode e clubIds são obrigatórios' });
    return;
  }

  try {
    const cup = await createCup(name, countryCode, clubIds);
    res.status(201).json(cup);
  } catch (err) {
    if (err instanceof CupError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

cupsRouter.post('/copa-do-brasil', async (req: AuthedRequest, res) => {
  try {
    const { createOfficialCopaDoBrasil } = await import('../services/copaBrasilImportService.js');
    const season = typeof req.body?.season === 'number' ? req.body.season : new Date().getFullYear();
    const cup = await createOfficialCopaDoBrasil(season);
    res.status(201).json(cup);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

cupsRouter.post('/:id/advance-round', async (req: AuthedRequest, res) => {
  try {
    // Passing the user is what enforces "you must have a club in this cup" — until now this route let
    // anyone advance anyone's cup.
    const cup = await advanceCupRound(req.params.id, req.userId!);
    res.json(cup);
  } catch (err) {
    if (err instanceof CupError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

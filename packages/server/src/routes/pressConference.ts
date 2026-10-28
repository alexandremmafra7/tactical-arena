import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import {
  createPressConference,
  getPressConferenceHistory,
  getPressConferenceById,
  submitPressConferenceAnswers,
} from '../services/pressConferenceService.js';
import { ClubNotFoundError } from '../services/clubService.js';

export const pressConferenceRouter = Router();

pressConferenceRouter.use(requireAuth);

pressConferenceRouter.post('/', async (req: AuthedRequest, res) => {
  try {
    const { clubId, type, trigger } = req.body;
    if (!clubId || !type || !trigger) {
      res.status(400).json({ error: 'clubId, type e trigger são obrigatórios' });
      return;
    }
    const pressConference = await createPressConference(clubId, req.userId!, type, trigger);
    res.status(201).json(pressConference);
  } catch (err) {
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message.includes('não é o dono')) {
      res.status(403).json({ error: err.message });
      return;
    }
    throw err;
  }
});

pressConferenceRouter.get('/history/:clubId', async (req: AuthedRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const history = await getPressConferenceHistory(req.params.clubId, limit);
    res.json(history);
  } catch (err) {
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

pressConferenceRouter.get('/:id', async (req: AuthedRequest, res) => {
  try {
    const pressConference = await getPressConferenceById(req.params.id);
    res.json(pressConference);
  } catch (err) {
    if (err instanceof Error && err.message.includes('não encontrada')) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

pressConferenceRouter.post('/:id/submit', async (req: AuthedRequest, res) => {
  try {
    const { responses, delegationOption } = req.body;
    if (!Array.isArray(responses)) {
      res.status(400).json({ error: 'responses deve ser um array' });
      return;
    }
    const result = await submitPressConferenceAnswers(
      req.params.id,
      req.userId!,
      responses,
      delegationOption
    );
    res.json(result);
  } catch (err) {
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message.includes('não é o dono')) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message.includes('não encontrada')) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

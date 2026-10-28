import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getHistory } from '../services/historyService.js';

export const historyRouter = Router();

historyRouter.use(requireAuth);

historyRouter.get('/', async (_req, res) => {
  res.json(await getHistory());
});

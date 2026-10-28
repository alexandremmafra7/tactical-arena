import express, { Router } from 'express';
import { AuthedRequest } from '../middleware/auth.js';
import { verifyToken } from '../services/authService.js';
import { requireDesktopMode } from '../middleware/desktopOnly.js';
import { prisma } from '../db/prisma.js';
import {
  TeamEditorError,
  autoGenerateClubSquad,
  createEditorClub,
  createPlayer,
  deletePlayer,
  exportModPack,
  importModPack,
  moveTransfer,
  updateClubIdentity,
  updatePlayer,
  uploadCrest,
} from '../services/teamEditorService.js';
import { ClubNotFoundError, getClub } from '../services/clubService.js';
import type { ModPack } from '@tactical-arena/shared';

export const teamEditorRouter = Router();

// Fail closed before auth even runs — an unauthenticated probe against a hosted server gets a flat 403
// instead of a 401 that would reveal the route exists behind a login. See middleware/desktopOnly.ts.
teamEditorRouter.use(requireDesktopMode);

function editorAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.userId = verifyToken(header.slice('Bearer '.length));
    } catch {
      req.userId = 'desktop-user';
    }
  } else {
    req.userId = 'desktop-user';
  }
  next();
}

teamEditorRouter.use(editorAuth);
// A mod pack bundles full rosters plus several base64-encoded crests — comfortably over express.json()'s
// global ~100kb default. Scoped here so the rest of the app's routes keep the smaller default.
teamEditorRouter.use(express.json({ limit: '25mb' }));

function handleServiceError(err: unknown, res: express.Response): void {
  if (err instanceof TeamEditorError || err instanceof ClubNotFoundError) {
    res.status(400).json({ error: err.message });
    return;
  }
  throw err;
}

/** Every club in the save, not just the requester's own or the unclaimed pool — the editor curates the
 *  whole database. */
teamEditorRouter.get('/clubs', async (_req: AuthedRequest, res) => {
  const records = await prisma.club.findMany({ select: { id: true } });
  const clubs = await Promise.all(records.map((r) => getClub(r.id)));
  res.json(clubs);
});

teamEditorRouter.patch('/clubs/:clubId/players/:playerId', async (req: AuthedRequest, res) => {
  try {
    const club = await updatePlayer(req.params.clubId, req.params.playerId, req.body ?? {});
    res.json(club);
  } catch (err) {
    handleServiceError(err, res);
  }
});

teamEditorRouter.post('/clubs/:clubId/players', async (req: AuthedRequest, res) => {
  try {
    const club = await createPlayer(req.params.clubId, req.body ?? {});
    res.status(201).json(club);
  } catch (err) {
    handleServiceError(err, res);
  }
});

teamEditorRouter.delete('/clubs/:clubId/players/:playerId', async (req: AuthedRequest, res) => {
  try {
    const club = await deletePlayer(req.params.clubId, req.params.playerId);
    res.json(club);
  } catch (err) {
    handleServiceError(err, res);
  }
});

teamEditorRouter.post('/transfers', async (req: AuthedRequest, res) => {
  const { playerId, fromClubId, toClubId } = req.body ?? {};
  if (typeof playerId !== 'string' || typeof fromClubId !== 'string' || typeof toClubId !== 'string') {
    res.status(400).json({ error: 'playerId, fromClubId e toClubId são obrigatórios' });
    return;
  }
  try {
    const result = await moveTransfer(playerId, fromClubId, toClubId);
    res.json(result);
  } catch (err) {
    handleServiceError(err, res);
  }
});

teamEditorRouter.post('/clubs', async (req: AuthedRequest, res) => {
  try {
    const club = await createEditorClub(req.body ?? {});
    res.status(201).json(club);
  } catch (err) {
    handleServiceError(err, res);
  }
});

teamEditorRouter.patch('/clubs/:clubId/identity', async (req: AuthedRequest, res) => {
  try {
    const club = await updateClubIdentity(req.params.clubId, req.body ?? {});
    res.json(club);
  } catch (err) {
    handleServiceError(err, res);
  }
});

teamEditorRouter.post('/clubs/:clubId/autosquad', async (req: AuthedRequest, res) => {
  try {
    const club = await autoGenerateClubSquad(req.params.clubId);
    res.json(club);
  } catch (err) {
    handleServiceError(err, res);
  }
});

teamEditorRouter.post('/clubs/:slug/crest', async (req: AuthedRequest, res) => {
  const { base64Png } = req.body ?? {};
  if (typeof base64Png !== 'string') {
    res.status(400).json({ error: 'base64Png é obrigatório' });
    return;
  }
  try {
    await uploadCrest(req.params.slug, base64Png);
    res.status(204).send();
  } catch (err) {
    handleServiceError(err, res);
  }
});

teamEditorRouter.get('/export', async (_req: AuthedRequest, res) => {
  const pack = await exportModPack();
  res.json(pack);
});

teamEditorRouter.post('/import', async (req: AuthedRequest, res) => {
  const pack = req.body as ModPack | undefined;
  if (!pack || pack.version !== 1 || !Array.isArray(pack.clubs)) {
    res.status(400).json({ error: 'Arquivo de pacote inválido.' });
    return;
  }
  try {
    const result = await importModPack(pack);
    res.json(result);
  } catch (err) {
    handleServiceError(err, res);
  }
});

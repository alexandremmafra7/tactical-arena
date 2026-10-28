import { Router } from 'express';
import { requireLocalSession } from '../middleware/security.js';
import {
  createNewSave,
  deleteSave,
  duplicateSave,
  listAllSaves,
  loadSave,
  renameSave,
} from '../services/saveService.js';

export const savesRouter = Router();
savesRouter.use(requireLocalSession);

savesRouter.get('/', async (_req, res) => {
  try {
    const result = await listAllSaves();
    res.json({...result, saves: result.saves.map(({managerToken: _secret, ...save}) => save)});
  } catch (err) {
    res.status(500).json({ error: 'Não foi possível concluir a operação de save.' });
  }
});

savesRouter.post('/new', async (req, res) => {
  try {
    const { name, managerFirstName, managerLastName, managerNationality, managerStyle, managerAvatar, clockFormat, gameMode } =
      req.body ?? {};
    const result = await createNewSave({
      name,
      managerFirstName,
      managerLastName,
      managerNationality,
      managerStyle,
      managerAvatar,
      clockFormat,
      /**
       * O modo tem de atravessar esta rota, e quase não atravessou.
       *
       * Ela desmonta o corpo campo a campo, então um campo novo que não seja listado aqui é descartado em
       * silêncio: a tela ofereceria os três modos, o jogador escolheria, e toda carreira nasceria padrão sem
       * nada indicar o contrário.
       */
      gameMode,
    });
    res.json({ ok: true, save: {...result.save, managerToken: undefined}, token: result.token, userId: result.userId });
  } catch (err) {
    res.status(500).json({ error: 'Não foi possível concluir a operação de save.' });
  }
});

savesRouter.post('/:id/load', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await loadSave(id);
    res.json({ ok: true, save: {...result.save, managerToken: undefined}, token: result.token, userId: result.userId, claimedClubId: result.claimedClubId });
  } catch (err) {
    res.status(404).json({ error: 'Não foi possível concluir a operação de save.' });
  }
});

savesRouter.post('/:id/rename', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body ?? {};
    const save = renameSave(id, name);
    res.json({ ok: true, save: {...save, managerToken: undefined} });
  } catch (err) {
    res.status(400).json({ error: 'Não foi possível concluir a operação de save.' });
  }
});

savesRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    deleteSave(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: 'Não foi possível concluir a operação de save.' });
  }
});

savesRouter.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body ?? {};
    const save = duplicateSave(id, name);
    res.json({ ok: true, save: {...save, managerToken: undefined} });
  } catch (err) {
    res.status(400).json({ error: 'Não foi possível concluir a operação de save.' });
  }
});

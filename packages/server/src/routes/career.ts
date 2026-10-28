import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { getCareer } from '../services/careerService.js';
import { getOrCreateOffers, acceptOffer, JobOfferError } from '../services/jobOfferService.js';
import { acceptApproach, declineApproach, listApproaches, ApproachError } from '../services/approachService.js';
import { claimClub, resignClub } from '../services/clubService.js';

export const careerRouter = Router();

careerRouter.use(requireAuth);

careerRouter.get('/', async (req: AuthedRequest, res) => {
  res.json(await getCareer(req.userId!));
});

careerRouter.get('/offers', async (req: AuthedRequest, res) => {
  const career = await getCareer(req.userId!);
  if (career.activeClubIds.length > 0) {
    res.json([]);
    return;
  }
  res.json(await getOrCreateOffers(req.userId!));
});

/**
 * As sondagens abertas ao técnico: clubes que o querem, enquanto ele ainda tem emprego.
 *
 * Separadas das ofertas de emprego de propósito. Uma proposta a quem está desempregado é uma saída; uma
 * sondagem a quem está empregado é uma decisão, e as duas não cabem na mesma lista sem confundir as duas
 * situações.
 */
careerRouter.get('/approaches', async (req: AuthedRequest, res) => {
  res.json(await listApproaches(req.userId!));
});

careerRouter.post('/approaches/:id/accept', async (req: AuthedRequest, res) => {
  try {
    const { clubId } = await acceptApproach(req.params.id, req.userId!);
    const career = await getCareer(req.userId!);

    /**
     * Sair do clube atual antes de assumir o novo, e nessa ordem.
     *
     * Invertê-la deixaria o técnico com dois clubes por um instante — e `activeClubIds` é uma lista, então
     * nada no jogo se queixaria: ele simplesmente passaria a dirigir dois times ao mesmo tempo.
     */
    for (const atual of career.activeClubIds) {
      await resignClub(atual, req.userId!);
    }

    res.json(await claimClub(clubId, req.userId!));
  } catch (err) {
    if (err instanceof ApproachError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

careerRouter.post('/approaches/:id/decline', async (req: AuthedRequest, res) => {
  try {
    await declineApproach(req.params.id, req.userId!);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof ApproachError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

careerRouter.post('/offers/:id/accept', async (req: AuthedRequest, res) => {
  try {
    const club = await acceptOffer(req.params.id, req.userId!);
    res.json(club);
  } catch (err) {
    if (err instanceof JobOfferError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

careerRouter.get('/trophy-room', async (req: AuthedRequest, res) => {
  try {
    const { getCareerTrophyRoom } = await import('../services/trophyService.js');
    const trophyRoom = await getCareerTrophyRoom(req.userId!);
    res.json(trophyRoom);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});


import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import {
  listPlayerForTransfer,
  cancelListing,
  listActiveListings,
  buyListedPlayer,
  payReleaseClause,
  createProposal,
  listProposalsForClub,
  acceptProposal,
  rejectProposal,
  withdrawProposal,
  listScoutingDatabase,
  TransferError,
} from '../services/transferService.js';
import {
  getDeadlineDay,
  placeDeadlineDayBid,
  advanceDeadlineDayHour,
  DeadlineDayError,
} from '../services/deadlineDayService.js';

export const transfersRouter = Router();

transfersRouter.use(requireAuth);

transfersRouter.get('/scouting', async (req, res) => {
  const country = typeof req.query.country === 'string' ? req.query.country : undefined;
  const database = await listScoutingDatabase(country);
  res.json(database);
});

transfersRouter.get('/listings', async (_req, res) => {
  const listings = await listActiveListings();
  res.json(listings);
});

transfersRouter.post('/listings', async (req: AuthedRequest, res) => {
  const { clubId, playerId, askingPrice } = req.body ?? {};
  if (typeof clubId !== 'string' || typeof playerId !== 'string' || typeof askingPrice !== 'number') {
    res.status(400).json({ error: 'clubId, playerId e askingPrice são obrigatórios' });
    return;
  }

  try {
    const listing = await listPlayerForTransfer(clubId, req.userId!, playerId, askingPrice);
    res.status(201).json(listing);
  } catch (err) {
    if (err instanceof TransferError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.delete('/listings/:id', async (req: AuthedRequest, res) => {
  try {
    await cancelListing(req.params.id, req.userId!);
    res.status(204).send();
  } catch (err) {
    if (err instanceof TransferError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.post('/listings/:id/buy', async (req: AuthedRequest, res) => {
  const { buyerClubId } = req.body ?? {};
  if (typeof buyerClubId !== 'string') {
    res.status(400).json({ error: 'buyerClubId é obrigatório' });
    return;
  }

  try {
    await buyListedPlayer(req.params.id, req.userId!, buyerClubId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof TransferError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.post('/release-clause', async (req: AuthedRequest, res) => {
  const { sellerClubId, playerId, buyerClubId } = req.body ?? {};
  if (typeof sellerClubId !== 'string' || typeof playerId !== 'string' || typeof buyerClubId !== 'string') {
    res.status(400).json({ error: 'sellerClubId, playerId e buyerClubId são obrigatórios' });
    return;
  }

  try {
    await payReleaseClause(sellerClubId, playerId, buyerClubId, req.userId!);
    res.status(204).send();
  } catch (err) {
    if (err instanceof TransferError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.get('/proposals', async (req: AuthedRequest, res) => {
  const { clubId } = req.query;
  if (typeof clubId !== 'string') {
    res.status(400).json({ error: 'clubId é obrigatório' });
    return;
  }
  const proposals = await listProposalsForClub(clubId);
  res.json(proposals);
});

transfersRouter.post('/proposals', async (req: AuthedRequest, res) => {
  const { buyerClubId, sellerClubId, targetPlayerId, cashAmount, installments, offeredPlayerIds, hasBankGuarantee } = req.body ?? {};
  if (
    typeof buyerClubId !== 'string' ||
    typeof sellerClubId !== 'string' ||
    typeof targetPlayerId !== 'string' ||
    typeof cashAmount !== 'number' ||
    typeof installments !== 'number'
  ) {
    res.status(400).json({ error: 'buyerClubId, sellerClubId, targetPlayerId, cashAmount e installments são obrigatórios' });
    return;
  }

  try {
    const proposal = await createProposal({
      buyerClubId,
      sellerClubId,
      targetPlayerId,
      cashAmount,
      installments,
      offeredPlayerIds: Array.isArray(offeredPlayerIds) ? offeredPlayerIds : [],
      requestingUserId: req.userId!,
      hasBankGuarantee: Boolean(hasBankGuarantee),
    });
    res.status(201).json(proposal);
  } catch (err) {
    if (err instanceof TransferError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.post('/proposals/:id/accept', async (req: AuthedRequest, res) => {
  try {
    await acceptProposal(req.params.id, req.userId!);
    res.status(204).send();
  } catch (err) {
    if (err instanceof TransferError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.post('/proposals/:id/reject', async (req: AuthedRequest, res) => {
  try {
    await rejectProposal(req.params.id, req.userId!);
    res.status(204).send();
  } catch (err) {
    if (err instanceof TransferError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.post('/proposals/:id/withdraw', async (req: AuthedRequest, res) => {
  try {
    await withdrawProposal(req.params.id, req.userId!);
    res.status(204).send();
  } catch (err) {
    if (err instanceof TransferError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.get('/deadline-day', async (req: AuthedRequest, res) => {
  const clubId = typeof req.query.clubId === 'string' ? req.query.clubId : undefined;
  if (!clubId) {
    res.status(400).json({ error: 'clubId é obrigatório' });
    return;
  }

  try {
    const state = await getDeadlineDay(clubId);
    res.json(state);
  } catch (err) {
    if (err instanceof DeadlineDayError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.post('/deadline-day/bid', async (req: AuthedRequest, res) => {
  const { auctionId, buyerClubId, amount, wageOffer } = req.body ?? {};
  if (
    typeof auctionId !== 'string' ||
    typeof buyerClubId !== 'string' ||
    typeof amount !== 'number' ||
    typeof wageOffer !== 'number'
  ) {
    res.status(400).json({ error: 'auctionId, buyerClubId, amount e wageOffer são obrigatórios' });
    return;
  }

  try {
    const state = await placeDeadlineDayBid({
      auctionId,
      buyerClubId,
      amount,
      wageOffer,
      requestingUserId: req.userId!,
    });
    res.json(state);
  } catch (err) {
    if (err instanceof DeadlineDayError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

transfersRouter.post('/deadline-day/advance', async (req: AuthedRequest, res) => {
  const { clubId } = req.body ?? {};
  if (typeof clubId !== 'string') {
    res.status(400).json({ error: 'clubId é obrigatório' });
    return;
  }

  try {
    const state = await advanceDeadlineDayHour({
      clubId,
      requestingUserId: req.userId!,
    });
    res.json(state);
  } catch (err) {
    if (err instanceof DeadlineDayError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});


import { Router } from 'express';
import { LineupValidationError, totalCupRounds } from '@tactical-arena/shared';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import {
  advanceLiveMatch,
  peekLiveMatch,
  createMatch,
  getMatch,
  getNextActionableMatch,
  injuryDecisionOptions,
  resolveInjuryDecision,
  resolveRedCardDecision,
  submitTactic,
  tickLiveMatchSystem,
  updateLiveMatchTactic,
  resetLiveMatch,
  MatchError,
} from '../services/matchService.js';
import { findLeagueRoundContext } from '../services/leagueService.js';
import { findCupRoundContext } from '../services/cupService.js';
import { prisma } from '../db/prisma.js';
import { ClubNotFoundError, getClub } from '../services/clubService.js';

export const matchesRouter = Router();

matchesRouter.use(requireAuth);

matchesRouter.get('/next/:clubId', async (req, res) => {
  const match = await getNextActionableMatch(req.params.clubId);
  res.json(match);
});

/**
 * The competition banner (name + round label) and every other fixture in this match's round (league or
 * cup), if it belongs to one — the live-match banner and round ticker's data source. A bare PvP challenge
 * (no competition) simply has no competition and no siblings.
 */
matchesRouter.get('/:id/siblings', async (req, res) => {
  const matchId = req.params.id;

  const leagueCtx = await findLeagueRoundContext(matchId);
  const cupCtx = leagueCtx ? null : await findCupRoundContext(matchId);

  const fixtures = leagueCtx?.fixtures ?? cupCtx?.fixtures ?? [];
  const otherMatchIds = fixtures.map((f) => f.matchId).filter((id): id is string => !!id && id !== matchId);

  // Se a partida atual já foi concluída, auto-finaliza quaisquer partidas entre bots pendentes na mesma rodada
  const currentMatch = await getMatch(matchId).catch(() => null);
  if (currentMatch && currentMatch.status === 'SIMULATED') {
    for (const otherId of otherMatchIds) {
      const rec = await prisma.match.findUnique({ where: { id: otherId } });
      if (rec && rec.status === 'LIVE') {
        const homeClub = await getClub(rec.homeClubId);
        const awayClub = await getClub(rec.awayClubId);
        if (homeClub.ownerId === 'bot' && awayClub.ownerId === 'bot') {
          await tickLiveMatchSystem(otherId).catch(() => null);
        }
      }
    }
  }

  const matches = await Promise.all(otherMatchIds.map((id) => getMatch(id).catch(() => null)));

  const competition = leagueCtx
    ? { type: 'league' as const, name: leagueCtx.league.name, division: leagueCtx.league.division, round: leagueCtx.round }
    : cupCtx
      ? { type: 'cup' as const, name: cupCtx.cup.name, round: cupCtx.round, totalRounds: totalCupRounds(cupCtx.cup.clubIds.length) }
      : null;

  res.json({ competition, fixtures: matches.filter((m): m is NonNullable<typeof m> => !!m) });
});

/**
 * Paces a fixture nobody in particular owns forward — used by the live-match round ticker to advance
 * every other fixture in the round in lockstep with the one a human is actually watching. See
 * tickLiveMatchSystem: no participant check, since a bot-vs-bot fixture has no owner to authenticate as.
 */
matchesRouter.post('/:id/live/tick', async (req: AuthedRequest, res) => {
  const { toMinute } = req.body ?? {};
  if (typeof toMinute !== 'number') {
    res.status(400).json({ error: 'toMinute é obrigatório' });
    return;
  }

  try {
    const match = await tickLiveMatchSystem(req.params.id, toMinute);
    res.json(match);
  } catch (err) {
    if (err instanceof MatchError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

matchesRouter.post('/', async (req, res) => {
  const { homeClubId, awayClubId } = req.body ?? {};
  if (typeof homeClubId !== 'string' || typeof awayClubId !== 'string') {
    res.status(400).json({ error: 'homeClubId e awayClubId são obrigatórios' });
    return;
  }

  try {
    const match = await createMatch(homeClubId, awayClubId);
    res.status(201).json(match);
  } catch (err) {
    /*
     * O id do adversário é digitado à mão pelo técnico na tela do elenco, então errar o id é o desfecho
     * mais provável desta rota — e ele saía como "erro interno do servidor", que não diz o que fazer.
     * ClubNotFoundError é resposta ao que foi pedido, não falha do servidor.
     */
    if (err instanceof MatchError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

matchesRouter.get('/:id', async (req, res) => {
  try {
    const match = await getMatch(req.params.id);
    res.json(match);
  } catch (err) {
    if (err instanceof MatchError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

matchesRouter.post('/:id/tactic', async (req: AuthedRequest, res) => {
  const tactic = req.body;
  if (!tactic || typeof tactic.clubId !== 'string' || !Array.isArray(tactic.lineup)) {
    res.status(400).json({ error: 'Tática inválida' });
    return;
  }
  tactic.substitutes = Array.isArray(tactic.substitutes) ? tactic.substitutes : [];
  tactic.plannedSubstitutions = Array.isArray(tactic.plannedSubstitutions) ? tactic.plannedSubstitutions : [];

  try {
    const match = await submitTactic(req.params.id, req.userId!, tactic);
    res.json(match);
  } catch (err) {
    if (err instanceof MatchError || err instanceof LineupValidationError) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    throw err;
  }
});

/** Plays the live match forward to `toMinute` (e.g. 45 for halftime, 90 for fulltime) — see advanceLiveMatch. */
matchesRouter.post('/:id/live/advance', async (req: AuthedRequest, res) => {
  const { toMinute, interactive } = req.body ?? {};
  if (typeof toMinute !== 'number') {
    res.status(400).json({ error: 'toMinute é obrigatório' });
    return;
  }

  try {
    const match = await advanceLiveMatch(req.params.id, req.userId!, toMinute, interactive === true);
    res.json(match);
  } catch (err) {
    if (err instanceof MatchError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

/**
 * Espia os próximos minutos sem gravar nada — só para o campo 2D chegar ao lance antes do relógio. Devolve os
 * lances que o avanço de verdade vai produzir até `toMinute`; ver peekLiveMatch.
 */
matchesRouter.post('/:id/live/peek', async (req: AuthedRequest, res) => {
  const { toMinute, interactive } = req.body ?? {};
  if (typeof toMinute !== 'number') {
    res.status(400).json({ error: 'toMinute é obrigatório' });
    return;
  }

  try {
    res.json({ events: await peekLiveMatch(req.params.id, req.userId!, toMinute, interactive === true) });
  } catch (err) {
    if (err instanceof MatchError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

/** Who may come on while play is halted for an injury, plus the touchline's own pick. */
matchesRouter.get('/:id/live/decision', async (req: AuthedRequest, res) => {
  try {
    res.json(await injuryDecisionOptions(req.params.id, req.userId!));
  } catch (err) {
    if (err instanceof MatchError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

/** Answers the halt: `replacementPlayerId` null means playing on a man short. */
matchesRouter.post('/:id/live/decision', async (req: AuthedRequest, res) => {
  const { replacementPlayerId } = req.body ?? {};
  if (replacementPlayerId !== null && typeof replacementPlayerId !== 'string') {
    res.status(400).json({ error: 'replacementPlayerId deve ser o id de um jogador ou null' });
    return;
  }

  try {
    const match = await resolveInjuryDecision(req.params.id, req.userId!, replacementPlayerId);
    res.json(match);
  } catch (err) {
    if (err instanceof MatchError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

/** Answers a dismissal: `lineupPlayerIds` rearranges the eleven slots, null keeps the current shape. */
matchesRouter.post('/:id/live/decision/reorganize', async (req: AuthedRequest, res) => {
  const { lineupPlayerIds } = req.body ?? {};
  const valid =
    lineupPlayerIds === null ||
    (Array.isArray(lineupPlayerIds) && lineupPlayerIds.every((id: unknown) => typeof id === 'string'));
  if (!valid) {
    res.status(400).json({ error: 'lineupPlayerIds deve ser uma lista de ids ou null' });
    return;
  }

  try {
    const match = await resolveRedCardDecision(req.params.id, req.userId!, lineupPlayerIds);
    res.json(match);
  } catch (err) {
    if (err instanceof MatchError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

/** Changes one side's tactic/lineup/subs while the match is paused — takes effect from the next advance on. */
matchesRouter.post('/:id/live/tactic', async (req: AuthedRequest, res) => {
  const tactic = req.body;
  if (!tactic || typeof tactic.clubId !== 'string' || !Array.isArray(tactic.lineup)) {
    res.status(400).json({ error: 'Tática inválida' });
    return;
  }
  tactic.substitutes = Array.isArray(tactic.substitutes) ? tactic.substitutes : [];
  tactic.plannedSubstitutions = Array.isArray(tactic.plannedSubstitutions) ? tactic.plannedSubstitutions : [];

  try {
    const match = await updateLiveMatchTactic(req.params.id, req.userId!, tactic);
    res.json(match);
  } catch (err) {
    if (err instanceof MatchError || err instanceof LineupValidationError) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    throw err;
  }
});

/** Resets a live match back to minute 0. */
matchesRouter.post('/:id/live/reset', async (req: AuthedRequest, res) => {
  try {
    const match = await resetLiveMatch(req.params.id, req.userId!);
    res.json(match);
  } catch (err) {
    if (err instanceof MatchError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

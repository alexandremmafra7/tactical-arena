import { Router } from 'express';
import { ContractError, batchRenewPlayerContracts, contractOverview, listFreeAgents, renewPlayerContract, signFreeAgent } from '../services/contractService.js';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { getClubLockerRoom, applyClubTeamTalk, LockerRoomError } from '../services/lockerRoomService.js';
import type { TeamTalkContext } from '@tactical-arena/shared';
import {
  createClub,
  getClub,
  listClubsByOwner,
  listAvailableClubs,
  claimClub,
  resignClub,
  setCaptain,
  setTutor,
  setPlayerRole,
  setPendingRoundTactic,
  clearPendingRoundTactic,
  setPlayerFunctions,
  updatePlayerReleaseClause,
  autoShieldSquadReleaseClausesService,
  hireStaffMember,
  fireStaffMember,
  updateStaffDelegationConfig,
  ClubNotFoundError,
  CaptainError,
  TutorError,
  PlayerRoleError,
  ClubValidationError,
  ClaimError,
  RoundTacticError,
  PlayerFunctionError,
  StaffError,
  ReleaseClauseError,
} from '../services/clubService.js';
import {
  Club,
  ClubPrestigeInputs,
  LineupValidationError,
  LoanPlanKey,
  PLAYER_ROLES,
  PlayerFunction,
  PlayerRole,
  Sponsorship,
  StaffMember,
  StaffDelegationConfig,
  averageSquadOverall,
  generateStaffMarket,
  generateTacticalAssistantAdvice,
  planSmartTacticsAgainstOpponent,
  previewStadiumUpgrade,
  getStadiumCurrentStep,
  autoFillLineup,
  generateOppositionDossier,
} from '@tactical-arena/shared';
import { investInPlayer, autoTrainSquad, DevelopmentError } from '../services/developmentService.js';
import { savePreset, listPresets, deletePreset, setDefaultPreset, TacticPresetError } from '../services/tacticPresetService.js';
import { promoteAcademyPlayer, releaseAcademyPlayer, trainAcademyPlayer, autoTrainAcademy, AcademyError } from '../services/academyService.js';
import { getSponsorshipOffers, signSponsorship, takeLoan, upgradeStadium, FinanceError } from '../services/financeService.js';
import { listLeagues, getLeagueWithStandings } from '../services/leagueService.js';
import { listNews, listTransferNews } from '../services/newsService.js';
import { recentForm } from '../services/matchService.js';
import { foundClub, listFoundableCountries, CITY_SIZES, FoundClubError, type CitySize } from '../services/foundClubService.js';
import { recordPredictionOnce } from '../services/staffRecordService.js';
import { getGameState } from '../services/gameStateService.js';
import { moodFor } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { GameModeError, setRuntimeGameMode } from '../services/gameModeService.js';
import { getManagerStyle } from '../services/managerStyleService.js';

/**
 * Sponsorship value is driven by "porte do time": squad quality, stadium size, and where this club
 * currently sits in its league (division + table position). Computed here rather than inside
 * financeService because that would require importing leagueService there, which itself imports
 * financeService (distributePrizeMoney) — the route layer already sits above both services.
 */
async function computeClubPrestigeInputs(club: Club): Promise<ClubPrestigeInputs> {
  const leagues = await listLeagues(club.country);
  const league = leagues.find((l) => l.clubIds.includes(club.id));

  let leaguePosition: number | null = null;
  if (league && league.status !== 'OPEN') {
    const { standings } = await getLeagueWithStandings(league.id);
    const index = standings.findIndex((s) => s.clubId === club.id);
    leaguePosition = index === -1 ? null : index + 1;
  }

  return {
    avgSquadOverall: averageSquadOverall(club.players),
    stadiumLevel: club.stadiumLevel,
    division: league?.division ?? 1,
    leaguePosition,
    totalClubsInLeague: league?.clubIds.length ?? 0,
    titlesWon: club.titlesWon,
  };
}

/** A record's metadata, or an empty object when it is missing or was written by an older build. */
function readMeta(metaJson?: string): Record<string, unknown> {
  if (!metaJson) return {};
  try {
    return JSON.parse(metaJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const clubsRouter = Router();

clubsRouter.get('/available', async (req, res) => {
  const { country, division } = req.query;
  const clubs = await listAvailableClubs(
    typeof country === 'string' ? country : undefined,
    typeof division === 'string' ? Number(division) : undefined,
  );
  res.json(clubs);
});

clubsRouter.use(requireAuth);

// Locker room routes
clubsRouter.get('/:id/locker-room', async (req: AuthedRequest, res) => {
  try {
    const lockerRoom = await getClubLockerRoom(req.params.id);
    res.json(lockerRoom);
  } catch (err) {
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/team-talk', async (req: AuthedRequest, res) => {
  const { talkId, context, scoreDifferential = 0 } = req.body ?? {};
  if (typeof talkId !== 'string' || !['PRE_MATCH', 'HALF_TIME', 'POST_MATCH'].includes(context) || typeof scoreDifferential !== 'number') {
    res.status(400).json({ error: 'Preleção inválida' });
    return;
  }
  try {
    const result = await applyClubTeamTalk(
      req.params.id,
      req.userId!,
      talkId,
      context as TeamTalkContext,
      scoreDifferential,
    );
    res.json(result);
  } catch (err) {
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof LockerRoomError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/', async (req: AuthedRequest, res) => {
  const { name, country } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Nome do clube é obrigatório' });
    return;
  }
  if (typeof country !== 'string' || country.trim().length === 0) {
    res.status(400).json({ error: 'País do clube é obrigatório' });
    return;
  }

  try {
    const club = await createClub(req.userId!, name.trim(), country);
    res.status(201).json(club);
  } catch (err) {
    if (err instanceof ClubValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.get('/mine', async (req: AuthedRequest, res) => {
  const clubs = await listClubsByOwner(req.userId!);
  res.json(clubs);
});

/**
 * Where founding a club is worth doing. Registered above `/:id`, which would otherwise swallow it.
 */
clubsRouter.get('/foundable-countries', async (_req: AuthedRequest, res) => {
  res.json(await listFoundableCountries());
});

/** Founds a club in its country's access division, taking the weakest side's place (see foundClub). */
clubsRouter.post('/found', async (req: AuthedRequest, res) => {
  const { name, country, city, citySize, kitPattern, primaryColor, secondaryColor, crestBase64 } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Nome do clube é obrigatório' });
    return;
  }
  if (typeof country !== 'string' || country.trim().length === 0) {
    res.status(400).json({ error: 'País do clube é obrigatório' });
    return;
  }

  try {
    const size = typeof citySize === 'string' && citySize in CITY_SIZES ? (citySize as CitySize) : 'SMALL';
    res.status(201).json(
      await foundClub(req.userId!, {
        name: name.trim(),
        country,
        city: typeof city === 'string' ? city : undefined,
        citySize: size,
        kitPattern,
        primaryColor,
        secondaryColor,
        crestBase64,
      }),
    );
  } catch (err) {
    if (err instanceof FoundClubError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/claim', async (req: AuthedRequest, res) => {
  try {
    const { gameMode } = req.body ?? {};
    if (gameMode === 'STANDARD' || gameMode === 'PREMIUM' || gameMode === 'HARDCORE') {
      setRuntimeGameMode(req.userId!, gameMode);
    }
    const club = await claimClub(req.params.id, req.userId!);
    res.json(club);
  } catch (err) {
    if (err instanceof ClaimError || err instanceof GameModeError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/resign', async (req: AuthedRequest, res) => {
  try {
    const club = await resignClub(req.params.id, req.userId!);
    res.json(club);
  } catch (err) {
    if (err instanceof ClaimError || err instanceof GameModeError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.get('/:id', async (req, res) => {
  try {
    const club = await getClub(req.params.id);
    res.json(club);
  } catch (err) {
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.get('/:id/form', async (req, res) => {
  res.json(await recentForm(req.params.id));
});

clubsRouter.get('/:id/news', async (req, res) => {
  const news = await listNews(req.params.id);
  res.json(news);
});

/** Market-wide, not this club's own dealings — mounted here only because every caller already has a club id.
 *  `:id` is ignored on purpose (see listTransferNews). */
clubsRouter.get('/:id/news/transfers', async (_req, res) => {
  res.json(await listTransferNews());
});

/**
 * Contratos: ver, renovar, e assinar quem está livre.
 *
 * As duas metades do trabalho do diretor de futebol. Sem elas o técnico só perde jogador na virada do ano,
 * porque o contrato passou a vencer de verdade e não havia como renovar nem repor.
 */
/**
 * O treinador do clube e o que a diretoria acha dele.
 *
 * Aberto a qualquer clube e não só ao do dono: ver quem comanda o adversário é informação de futebol, e é o
 * que torna o mundo povoado em vez de decorativo. A confiança e o aviso, esses, só saem para quem manda no
 * clube — saber que o presidente do rival está prestes a demitir alguém seria informação que nem no futebol
 * de verdade circula.
 */
clubsRouter.get('/:id/manager', async (req: AuthedRequest, res) => {
  const clube = await prisma.club.findUnique({ where: { id: req.params.id }, select: { ownerId: true } });
  if (!clube) {
    res.status(404).json({ error: 'Clube não encontrado' });
    return;
  }

  const treinador = await prisma.manager.findFirst({ where: { clubId: req.params.id } });
  if (!treinador) {
    res.json(null);
    return;
  }

  const meu = clube.ownerId === req.userId;
  res.json({
    name: treinador.name,
    nationality: treinador.nationality,
    reputation: treinador.reputation,
    ...(meu
      ? {
          confidence: treinador.confidence,
          confidenceReason: treinador.confidenceReason,
          warnings: treinador.warnings,
          mood: moodFor(treinador.confidence).mood,
          moodLabel: moodFor(treinador.confidence).label,
        }
      : {}),
  });
});

clubsRouter.get('/:id/contracts', async (req: AuthedRequest, res) => {
  try {
    res.json(await contractOverview(req.params.id, req.userId!));
  } catch (err) {
    if (err instanceof ContractError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/contracts/batch-renew', async (req: AuthedRequest, res) => {
  try {
    const playerIds = Array.isArray(req.body?.playerIds) ? req.body.playerIds : [];
    const years = Number(req.body?.years ?? 2);
    const yearsMap = typeof req.body?.yearsMap === 'object' && req.body.yearsMap ? req.body.yearsMap : undefined;
    const result = await batchRenewPlayerContracts(req.params.id, req.userId!, playerIds, { years, yearsMap });
    res.json(result);
  } catch (err) {
    if (err instanceof ContractError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/players/:playerId/renew', async (req: AuthedRequest, res) => {
  try {
    const { club, cost } = await renewPlayerContract(req.params.id, req.userId!, req.params.playerId, Number(req.body?.years ?? 2));
    res.json({ club, cost });
  } catch (err) {
    if (err instanceof ContractError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.get('/:id/free-agents', async (req: AuthedRequest, res) => {
  const { country, position, limit } = req.query as Record<string, string | undefined>;
  res.json(await listFreeAgents({ country, position, limit: limit ? Number(limit) : undefined }));
});

clubsRouter.post('/:id/free-agents/:freeAgentId/sign', async (req: AuthedRequest, res) => {
  try {
    const resultado = await signFreeAgent(req.params.id, req.userId!, req.params.freeAgentId, Number(req.body?.years ?? 3));
    res.json(resultado);
  } catch (err) {
    if (err instanceof ContractError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/players/:playerId/train', async (req: AuthedRequest, res) => {
  try {
    const club = await investInPlayer(req.params.id, req.userId!, req.params.playerId, req.body?.focus);
    res.json(club);
  } catch (err) {
    if (err instanceof DevelopmentError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/round-tactic', async (req: AuthedRequest, res) => {
  const tactic = req.body;
  if (!tactic || typeof tactic.clubId !== 'string' || !Array.isArray(tactic.lineup)) {
    res.status(400).json({ error: 'Tática inválida' });
    return;
  }
  tactic.substitutes = Array.isArray(tactic.substitutes) ? tactic.substitutes : [];
  tactic.plannedSubstitutions = Array.isArray(tactic.plannedSubstitutions) ? tactic.plannedSubstitutions : [];

  try {
    const club = await setPendingRoundTactic(req.params.id, req.userId!, tactic);
    res.json(club);
  } catch (err) {
    if (err instanceof RoundTacticError || err instanceof ClubNotFoundError || err instanceof LineupValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.delete('/:id/round-tactic', async (req: AuthedRequest, res) => {
  try {
    const club = await clearPendingRoundTactic(req.params.id, req.userId!);
    res.json(club);
  } catch (err) {
    if (err instanceof RoundTacticError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/captain', async (req: AuthedRequest, res) => {
  const { playerId } = req.body ?? {};
  if (playerId !== null && typeof playerId !== 'string') {
    res.status(400).json({ error: 'playerId deve ser uma string ou null' });
    return;
  }

  try {
    const club = await setCaptain(req.params.id, req.userId!, playerId);
    res.json(club);
  } catch (err) {
    if (err instanceof CaptainError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/player-role', async (req: AuthedRequest, res) => {
  const { playerId, role, assign } = req.body ?? {};
  if (typeof playerId !== 'string') {
    res.status(400).json({ error: 'playerId é obrigatório' });
    return;
  }
  if (!PLAYER_ROLES.includes(role)) {
    res.status(400).json({ error: 'role inválida' });
    return;
  }
  if (typeof assign !== 'boolean') {
    res.status(400).json({ error: 'assign deve ser um booleano' });
    return;
  }

  try {
    const club = await setPlayerRole(req.params.id, req.userId!, playerId, role as PlayerRole, assign);
    res.json(club);
  } catch (err) {
    if (err instanceof PlayerRoleError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/tutor', async (req: AuthedRequest, res) => {
  const { playerId } = req.body ?? {};
  if (playerId !== null && typeof playerId !== 'string') {
    res.status(400).json({ error: 'playerId deve ser uma string ou null' });
    return;
  }

  try {
    const club = await setTutor(req.params.id, req.userId!, playerId);
    res.json(club);
  } catch (err) {
    if (err instanceof TutorError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/players/:playerId/functions', async (req: AuthedRequest, res) => {
  const { functions } = req.body ?? {};
  if (!Array.isArray(functions) || !functions.every((f) => typeof f === 'string')) {
    res.status(400).json({ error: 'functions deve ser uma lista de strings' });
    return;
  }

  try {
    const club = await setPlayerFunctions(req.params.id, req.userId!, req.params.playerId, functions as PlayerFunction[]);
    res.json(club);
  } catch (err) {
    if (err instanceof PlayerFunctionError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/tactic-presets', async (req: AuthedRequest, res) => {
  const { name, tactic } = req.body ?? {};
  if (typeof name !== 'string' || !tactic) {
    res.status(400).json({ error: 'name e tactic são obrigatórios' });
    return;
  }

  try {
    const preset = await savePreset(req.params.id, req.userId!, name, tactic);
    res.status(201).json(preset);
  } catch (err) {
    if (err instanceof TacticPresetError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.get('/:id/tactic-presets', async (req, res) => {
  const presets = await listPresets(req.params.id);
  res.json(presets);
});

clubsRouter.post('/:id/tactic-presets/:presetId/default', async (req: AuthedRequest, res) => {
  try {
    const preset = await setDefaultPreset(req.params.presetId, req.userId!);
    res.json(preset);
  } catch (err) {
    if (err instanceof TacticPresetError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.delete('/:id/tactic-presets/:presetId', async (req: AuthedRequest, res) => {
  try {
    await deletePreset(req.params.presetId, req.userId!);
    res.status(204).send();
  } catch (err) {
    if (err instanceof TacticPresetError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/academy/:playerId/promote', async (req: AuthedRequest, res) => {
  try {
    const club = await promoteAcademyPlayer(req.params.id, req.userId!, req.params.playerId);
    res.json(club);
  } catch (err) {
    if (err instanceof AcademyError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/academy/:playerId/release', async (req: AuthedRequest, res) => {
  try {
    const club = await releaseAcademyPlayer(req.params.id, req.userId!, req.params.playerId);
    res.json(club);
  } catch (err) {
    if (err instanceof AcademyError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/academy/:playerId/train', async (req: AuthedRequest, res) => {
  try {
    const club = await trainAcademyPlayer(req.params.id, req.userId!, req.params.playerId, req.body?.focus ?? null);
    res.json(club);
  } catch (err) {
    if (err instanceof AcademyError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.get('/:id/finance/sponsorship-offers', async (req: AuthedRequest, res) => {
  try {
    const club = await getClub(req.params.id);
    const prestige = await computeClubPrestigeInputs(club);
    const offers = getSponsorshipOffers(club, prestige, getManagerStyle(req.userId ?? club.ownerId));
    res.json(offers);
  } catch (err) {
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/finance/sponsorships', async (req: AuthedRequest, res) => {
  const { id, type, sponsorName, weeklyAmount, weeksRemaining, contractLength, titleBonus, cupBonus, sponsorTier, isChallenge } =
    req.body ?? {};
  if (
    typeof type !== 'string' ||
    typeof sponsorName !== 'string' ||
    typeof weeklyAmount !== 'number' ||
    typeof weeksRemaining !== 'number' ||
    typeof contractLength !== 'string' ||
    typeof titleBonus !== 'number' ||
    typeof cupBonus !== 'number'
  ) {
    res.status(400).json({ error: 'Proposta de patrocínio incompleta' });
    return;
  }

  try {
    const club = await signSponsorship(req.params.id, req.userId!, {
      id,
      type,
      sponsorName,
      weeklyAmount,
      weeksRemaining,
      contractLength,
      titleBonus,
      cupBonus,
      ...(typeof sponsorTier === 'string' ? { sponsorTier } : {}),
      ...(isChallenge === true ? { isChallenge: true } : {}),
    } as Sponsorship);
    res.status(201).json(club);
  } catch (err) {
    if (err instanceof FinanceError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/finance/loans', async (req: AuthedRequest, res) => {
  const { amount, planKey } = req.body ?? {};
  if (typeof amount !== 'number' || typeof planKey !== 'string') {
    res.status(400).json({ error: 'amount e planKey são obrigatórios' });
    return;
  }

  try {
    const club = await takeLoan(req.params.id, req.userId!, amount, planKey as LoanPlanKey);
    res.status(201).json(club);
  } catch (err) {
    if (err instanceof FinanceError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.get('/:id/stadium/preview', async (req, res) => {
  try {
    const club = await getClub(req.params.id);
    const prestige = await computeClubPrestigeInputs(club);
    const tierOrLevel = club.stadiumLevel ?? club.stadiumTier ?? 1;
    const currentStep = (club as any).stadiumStep ?? getStadiumCurrentStep(tierOrLevel, club.stadiumCapacity);
    res.json(previewStadiumUpgrade(tierOrLevel, prestige, currentStep, club.stadiumCapacity));
  } catch (err) {
    if (err instanceof ClubNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/stadium/upgrade', async (req: AuthedRequest, res) => {
  try {
    const useSubReforms = Boolean(req.body?.useSubReforms);
    const club = await upgradeStadium(req.params.id, req.userId!, useSubReforms);
    res.json(club);
  } catch (err) {
    if (err instanceof FinanceError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/release-clause', async (req: AuthedRequest, res) => {
  const { playerId, newReleaseClause } = req.body ?? {};
  if (typeof playerId !== 'string' || typeof newReleaseClause !== 'number') {
    res.status(400).json({ error: 'playerId e newReleaseClause são obrigatórios' });
    return;
  }

  try {
    const club = await updatePlayerReleaseClause(req.params.id, req.userId!, playerId, newReleaseClause);
    res.json(club);
  } catch (err) {
    if (err instanceof ReleaseClauseError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/auto-shield', async (req: AuthedRequest, res) => {
  try {
    const club = await autoShieldSquadReleaseClausesService(req.params.id, req.userId!);
    res.json(club);
  } catch (err) {
    if (err instanceof ReleaseClauseError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.get('/:id/staff-market', async (req, res) => {
  try {
    const market = generateStaffMarket(Number(req.params.id.replace(/\D/g, '').slice(0, 4)) || 42);
    res.json(market);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

clubsRouter.post('/:id/staff', async (req: AuthedRequest, res) => {
  const staff = req.body as StaffMember;
  if (!staff || typeof staff.id !== 'string' || typeof staff.role !== 'string') {
    res.status(400).json({ error: 'Dados de profissional inválidos' });
    return;
  }

  try {
    const club = await hireStaffMember(req.params.id, req.userId!, staff);
    res.json(club);
  } catch (err) {
    if (err instanceof StaffError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.delete('/:id/staff/:staffId', async (req: AuthedRequest, res) => {
  try {
    const club = await fireStaffMember(req.params.id, req.userId!, req.params.staffId);
    res.json(club);
  } catch (err) {
    if (err instanceof StaffError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.put('/:id/staff/delegation', async (req: AuthedRequest, res) => {
  const config = req.body as StaffDelegationConfig;
  if (!config || typeof config !== 'object') {
    res.status(400).json({ error: 'Configuração de delegação inválida' });
    return;
  }

  try {
    const club = await updateStaffDelegationConfig(req.params.id, req.userId!, config);
    res.json(club);
  } catch (err) {
    if (err instanceof StaffError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.get('/:id/tactical-advice', async (req: AuthedRequest, res) => {
  try {
    const club = await getClub(req.params.id);
    const assistant = club.staff?.find((s) => s.role === 'TACTICAL_ASSISTANT');
    const { opponentId } = req.query;

    let opponentClubName = 'o próximo adversário';
    let opponentTactic = null;

    if (typeof opponentId === 'string' && opponentId) {
      try {
        const opp = await getClub(opponentId);
        opponentClubName = opp.name;
        opponentTactic = opp.pendingRoundTactic ?? null;
      } catch {
        // Fallback to generic
      }
    }

    const advice = generateTacticalAssistantAdvice(assistant, opponentTactic, opponentClubName, getManagerStyle(req.userId));

    /**
     * The assistant goes on record.
     *
     * Only when there is somebody to hold to it and a named opponent to hold them to: a generic report with
     * no fixture attached predicts nothing, and an interim assistant is nobody. The match settles it (see
     * `evaluateMatchStaffRecords`), which is why the opponent's id travels with the entry.
     */
    if (assistant && typeof opponentId === 'string' && opponentId) {
      await recordPredictionOnce(
        club.id,
        (rec) => rec.recommendationType === 'TACTIC_PATTERN' && readMeta(rec.metaJson).opponentClubId === opponentId,
        {
          staffId: assistant.id,
          staffName: assistant.name,
          role: 'TACTICAL_ASSISTANT',
          rating: assistant.rating,
          dateString: (await getGameState()).currentDate,
          recommendationType: 'TACTIC_PATTERN',
          details: `Leu ${opponentClubName} como "${advice.readPattern}" (${advice.confidenceLabel})`,
          metaJson: JSON.stringify({ opponentClubId: opponentId, readPattern: advice.readPattern }),
        },
      ).catch((err: unknown) => console.error('registro do auxiliar tático falhou:', err));
    }

    res.json(advice);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

clubsRouter.get('/:id/opposition-dossier', async (req: AuthedRequest, res) => {
  try {
    const club = await getClub(req.params.id);
    const assistant = club.staff?.find((s) => s.role === 'TACTICAL_ASSISTANT');
    const { opponentId } = req.query;
    if (!opponentId || typeof opponentId !== 'string') {
      return res.status(400).json({ error: 'opponentId é obrigatório' });
    }
    const opp = await getClub(opponentId);
    const oppTactic = opp.pendingRoundTactic ?? autoFillLineup(opp);
    const dossier = generateOppositionDossier(opp, oppTactic, assistant);
    res.json(dossier);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

clubsRouter.post('/:id/auto-train', async (req: AuthedRequest, res) => {
  try {
    const result = await autoTrainSquad(req.params.id, req.userId!);
    res.json(result);
  } catch (err) {
    if (err instanceof DevelopmentError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/auto-train-academy', async (req: AuthedRequest, res) => {
  try {
    const result = await autoTrainAcademy(req.params.id, req.userId!);
    res.json(result);
  } catch (err) {
    if (err instanceof AcademyError || err instanceof ClubNotFoundError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

clubsRouter.post('/:id/auto-tactics', async (req: AuthedRequest, res) => {
  try {
    const club = await getClub(req.params.id);
    if (club.ownerId !== req.userId!) {
      res.status(403).json({ error: 'Você não é o dono deste clube' });
      return;
    }

    const { opponentId } = req.body ?? {};
    let opponentTactic = null;

    if (typeof opponentId === 'string' && opponentId) {
      try {
        const opp = await getClub(opponentId);
        opponentTactic = opp.pendingRoundTactic ?? null;
      } catch {
        // Fallback to default
      }
    }

    const { tactic, explanation } = planSmartTacticsAgainstOpponent(club, opponentTactic);
    const updatedClub = await setPendingRoundTactic(club.id, req.userId!, tactic);

    res.json({
      club: updatedClub,
      tactic,
      message: explanation,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

clubsRouter.get('/:id/trophy-room', async (req, res) => {
  try {
    const { getClubTrophyRoom } = await import('../services/trophyService.js');
    const trophyRoom = await getClubTrophyRoom(req.params.id);
    res.json(trophyRoom);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});


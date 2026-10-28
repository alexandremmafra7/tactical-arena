import { randomUUID } from 'node:crypto';
import type { WeeklyRecoveryOptions } from '@tactical-arena/shared';
import {
  calculateInitialMembers,
  getFitnessStaminaBoost,
  getYouthDevelopmentBoost,
  applyWeeklyRecovery,
  BOT_OWNER_ID,
  Club,
  KitPattern,
  FUNCTIONS_BY_POSITION,
  MAX_PLAYER_FUNCTIONS,
  PLAYER_ROLE_CLUB_FIELD,
  PLAYER_ROLES,
  Player,
  PlayerFunction,
  PlayerRole,
  STARTING_BUDGET,
  STARTING_STADIUM_CAPACITY,
  STARTING_STADIUM_LEVEL,
  StaffMember,
  StaffDelegationConfig,
  DEFAULT_STAFF_DELEGATION_CONFIG,
  Tactic,
  autoShieldSquadReleaseClauses,
  calculateAdjustedWageForReleaseClause,
  calculateBankGuaranteeEligibility,
  calculateClubVisibility,
  canHireStaff,
  defaultDetailedAttributes,
  generateAcademy,
  generateStaffMarket,
  generateStarterSquad,
  isValidCountryCode,
  resolveLineupPlayers,
  tiredPlayers,
  validateSubstitutesAndPlan,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { joinOrCreateLeague } from './leagueService.js';
import { sponsorBoardFor } from './sponsorBoardService.js';
import { recordPredictionOnce } from './staffRecordService.js';
import { getGameState } from './gameStateService.js';
import { closeTenure, openTenure } from './careerService.js';
import { syncCurrentSaveToDisk } from './saveService.js';
import { stampContracts } from './newSquadContracts.js';
import { seatUserAsManager, unseatUserAsManager } from './sackingService.js';
import { REPUTATION_WALKOUT_PENALTY } from './managerService.js';
import { assertCanResign, assertCanTakeOver } from './gameModeService.js';
import { fieldDefaultTactic } from './initialTacticService.js';

export class ClubNotFoundError extends Error {}
export class CaptainError extends Error {}
export class TutorError extends Error {}
export class ClubValidationError extends Error {}
export class ClaimError extends Error {}
export class RoundTacticError extends Error {}
export class PlayerFunctionError extends Error {}
export class PlayerRoleError extends Error {}
export class StaffError extends Error {}
export class ReleaseClauseError extends Error {}

/** Randomly-created clubs (the quick "make up a club" flow) always land in the top division. */
const RANDOM_CLUB_DIVISION = 1;

export async function createClub(ownerId: string, name: string, country: string): Promise<Club> {
  if (!isValidCountryCode(country)) {
    throw new ClubValidationError(`País inválido: ${country}`);
  }

  const id = randomUUID();
  // Contrato carimbado na criação, senão o clube nasce sem prazo nenhum e nada vence na primeira temporada.
  const players = await stampContracts(generateStarterSquad(id, country), id);
  const academyPlayers = await stampContracts(generateAcademy(id, country), `${id}-base`);

  /**
   * A club arrives with sponsors already on the shirt, the way a manager arrives at a club that existed
   * before them. Starting empty made the game unwinnable rather than hard: wages ran to R$ 171.000 a week
   * against R$ 46.000 of gate money, so the opening budget was gone before the season ended. There is
   * still plenty left to negotiate, since a new club draws only the small board its ground earns.
   */
  const sponsorships = sponsorBoardFor({
    id,
    players,
    stadiumLevel: STARTING_STADIUM_LEVEL,
    stadiumCapacity: STARTING_STADIUM_CAPACITY,
    division: RANDOM_CLUB_DIVISION,
    titlesWon: 0,
  });

  await prisma.club.create({
    data: {
      id,
      name,
      ownerId,
      country,
      playersJson: JSON.stringify(players),
      academyPlayersJson: JSON.stringify(academyPlayers),
      sponsorshipsJson: JSON.stringify(sponsorships),
      budget: STARTING_BUDGET,
      stadiumLevel: STARTING_STADIUM_LEVEL,
      stadiumCapacity: STARTING_STADIUM_CAPACITY,
      staffJson: JSON.stringify({
        staff: [],
        delegationConfig: DEFAULT_STAFF_DELEGATION_CONFIG,
      }),
    },
  });

  try {
    await joinOrCreateLeague(id, country, RANDOM_CLUB_DIVISION);
  } catch (err) {
    // Joining a league is a side effect of creating a club, not the point of the request — a hiccup here
    // (e.g. a race on the league roster) shouldn't take down club creation, which already committed above.
    console.error(`Club ${id} created but failed to join a league for ${country}:`, err);
  }

  await openTenure(ownerId, id, name, country);
  syncCurrentSaveToDisk();

  return {
    id,
    name,
    ownerId,
    slug: null,
    country,
    players,
    academyPlayers,
    budget: STARTING_BUDGET,
    captainPlayerId: null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: STARTING_STADIUM_LEVEL,
    stadiumCapacity: STARTING_STADIUM_CAPACITY,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships,
    loans: [],
    pendingTransferPayments: [],
    pendingRoundTactic: null,
    staffDelegationConfig: DEFAULT_STAFF_DELEGATION_CONFIG,
  };
}

export async function getClub(clubId: string): Promise<Club> {
  const record = await prisma.club.findUnique({ where: { id: clubId } });
  if (!record) {
    throw new ClubNotFoundError(`Clube ${clubId} não encontrado`);
  }

  /**
   * A divisão real, buscada uma vez, aqui.
   *
   * Este é o caminho por onde passam as decisões que consultam visibilidade: contratar comissão técnica,
   * garantia bancária, o que a tela mostra. Estava fixa em 1, então um clube da segunda divisão pontuava
   * quinze pontos de prestígio em vez de oito. Uma consulta a mais por clube lido é barata; a alternativa era
   * denormalizar a divisão e mantê-la em dia em quatro lugares.
   */
  const divisao = await divisionOfClub(clubId);
  return toDomain(record, divisao);
}

/** A divisão em que o clube joga, ou a primeira quando ele não está em liga nenhuma. */
async function divisionOfClub(clubId: string): Promise<number> {
  const leagues = await prisma.league.findMany({
    where: { clubIdsJson: { contains: `"${clubId}"` } },
    select: { division: true, season: true },
    orderBy: { season: 'desc' },
  });
  return leagues[0]?.division ?? 1;
}

export async function listClubsByOwner(ownerId: string): Promise<Club[]> {
  const records = await prisma.club.findMany({ where: { ownerId } });
  return records.map(toDomain);
}

/** Premade clubs for the "choose a club" screen in a new career. */
export async function listAvailableClubs(country?: string, division?: number): Promise<Club[]> {
  const records = await prisma.club.findMany({
    where: {
      ...(country ? { country } : {}),
    },
  });
  const clubs = records.map(toDomain);
  if (division === undefined) return clubs;

  // Division lives on the League row, not on Club — filter by cross-referencing league membership.
  const leagues = await prisma.league.findMany({ where: { division, ...(country ? { countryCode: country } : {}) } });
  if (leagues.length === 0) return [];
  const idsInDivision = new Set(leagues.flatMap((l) => JSON.parse(l.clubIdsJson) as string[]));
  return clubs.filter((club) => idsInDivision.has(club.id));
}

/** Claims a club for `requestingUserId`. */
export async function claimClub(clubId: string, requestingUserId: string): Promise<Club> {
  const club = await getClub(clubId);

  /**
   * O modo de carreira decide o que se pode assumir, e a recusa é aqui.
   *
   * As três portas de entrada — escolher no painel, aceitar uma oferta e aceitar uma sondagem — passam todas
   * por esta função. Verificar em cada uma delas seria escrever a mesma regra três vezes e esquecê-la na
   * quarta que aparecesse.
   */
  await assertCanTakeOver(requestingUserId, clubId);

  await prisma.club.update({ where: { id: clubId }, data: { ownerId: requestingUserId } });
  await openTenure(requestingUserId, clubId, club.name, club.country);
  /**
   * O técnico que estava no clube sai, e o jogador senta na cadeira dele.
   *
   * Sem isto o mundo tinha um buraco silencioso: todo clube ganha comando, e o da máquina continuava
   * sentado enquanto o jogador dirigia. A confiança seria calculada para um fantasma, e a demissão do
   * jogador mandaria embora outra pessoa.
   */
  await seatUserAsManager(clubId, requestingUserId);
  await fieldDefaultTactic(club);
  syncCurrentSaveToDisk();
  return { ...club, ownerId: requestingUserId };
}

/** Resigns from a club, symmetric to `claimClub` — hands it back to the bot pool and closes the manager's
 *  tenure (see careerService.ts), so it shows up in their "Minha carreira" history and they become
 *  eligible to receive fresh job offers. Only the current manager can resign their own club. */
export async function resignClub(clubId: string, requestingUserId: string): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new ClaimError('Você não é o técnico deste clube');
  }

  // No modo do zero não se larga o clube antes de o levar à elite: é a promessa inteira do modo.
  await assertCanResign(requestingUserId, clubId);

  await prisma.club.update({ where: { id: clubId }, data: { ownerId: BOT_OWNER_ID } });
  await closeTenure(clubId, requestingUserId, 'RESIGNED');
  // Abandonar o clube custa reputação, e é esse preço que impede pular fora sempre que a corda aperta.
  await unseatUserAsManager(clubId, REPUTATION_WALKOUT_PENALTY);
  return { ...club, ownerId: BOT_OWNER_ID };
}

/**
 * Sets a one-off tactic for this club's *next* league fixture only — lets the manager actually pick a
 * lineup before each round instead of always relying on a standing default preset or auto-fill. Gets
 * consumed (cleared) by `leagueService.advanceRound` the moment it's used for a fixture.
 */
export async function setPendingRoundTactic(clubId: string, requestingUserId: string, tactic: Tactic): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new RoundTacticError('Você não é o dono deste clube');
  }

  resolveLineupPlayers(club, tactic);
  validateSubstitutesAndPlan(club, tactic);

  await prisma.club.update({ where: { id: clubId }, data: { pendingRoundTacticJson: JSON.stringify(tactic) } });

  /**
   * The fitness coach goes on record about who was picked.
   *
   * This is the moment the warning is worth anything: the manager has just named a side, and a player they
   * left in is either going to hold up or is not. The match settles it, so the coach is judged on the eleven
   * that actually took the field rather than on a general observation about the squad.
   */
  await recordFitnessWarnings(club, tactic).catch((err) => console.error('registro do preparador físico falhou:', err));

  return { ...club, pendingRoundTactic: tactic };
}

/** The picked players this club's fitness coach thinks will not last the ninety minutes. */
async function recordFitnessWarnings(club: Club, tactic: Tactic): Promise<void> {
  const coach = club.staff?.find((s) => s.role === 'FITNESS_COACH');
  if (!coach) return;

  const picked = new Set(tactic.lineup.map((slot) => slot.playerId));
  const atRisk = tiredPlayers(club.players, coach.rating).filter((p) => picked.has(p.id));
  const gameDate = (await getGameState()).currentDate;

  for (const player of atRisk) {
    await recordPredictionOnce(
      club.id,
      (rec) => rec.recommendationType === 'INJURY_WARNING' && rec.playerId === player.id,
      {
        staffId: coach.id,
        staffName: coach.name,
        role: 'FITNESS_COACH',
        rating: coach.rating,
        dateString: gameDate,
        recommendationType: 'INJURY_WARNING',
        details: `Avisou que ${player.name} não aguentaria os 90 minutos (${Math.round(player.fatigue)} de desgaste)`,
        playerId: player.id,
      },
    );
  }
}

/** Cancels a previously-set next-round tactic, falling back to the default preset (or auto-fill) again. */
export async function clearPendingRoundTactic(clubId: string, requestingUserId: string): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new RoundTacticError('Você não é o dono deste clube');
  }

  await prisma.club.update({ where: { id: clubId }, data: { pendingRoundTacticJson: null } });
  return { ...club, pendingRoundTactic: null };
}

/** Sets (or clears, with playerId=null) the club captain. Changing to a different player resets tenure. */
export async function setCaptain(clubId: string, requestingUserId: string, playerId: string | null): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new CaptainError('Você não é o dono deste clube');
  }

  if (playerId !== null && !club.players.some((p) => p.id === playerId)) {
    throw new CaptainError('Jogador não pertence a este clube');
  }

  const captainWeeksServed = playerId === club.captainPlayerId ? club.captainWeeksServed : 0;

  await prisma.club.update({
    where: { id: clubId },
    data: { captainPlayerId: playerId, captainWeeksServed },
  });

  return { ...club, captainPlayerId: playerId, captainWeeksServed };
}

const TUTOR_MIN_AGE = 32;

/**
 * Sets (or clears, with playerId=null) the club's designated dressing-room tutor — a deliberate counterweight
 * to problem personalities that doesn't depend on rolling a LEADER trait (see squadHarmony.ts). Eligibility:
 * belongs to this club, at least TUTOR_MIN_AGE, and not UNDISCIPLINED — an undisciplined player can't model
 * discipline for anyone else. Unlike the captain, there's no tenure to track — just the designation itself.
 */
export async function setTutor(clubId: string, requestingUserId: string, playerId: string | null): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new TutorError('Você não é o dono deste clube');
  }

  if (playerId !== null) {
    const player = club.players.find((p) => p.id === playerId);
    if (!player) {
      throw new TutorError('Jogador não pertence a este clube');
    }
    if (player.age < TUTOR_MIN_AGE) {
      throw new TutorError(`O tutor precisa ter pelo menos ${TUTOR_MIN_AGE} anos`);
    }
    if (player.traits.includes('UNDISCIPLINED')) {
      throw new TutorError('Um jogador indisciplinado não pode ser tutor');
    }
  }

  await prisma.club.update({ where: { id: clubId }, data: { tutorPlayerId: playerId } });
  return { ...club, tutorPlayerId: playerId };
}

/**
 * Toggles a single `role` for `playerId`: `assign=true` gives it to them (displacing whoever else on
 * the club previously held that one role — same single-field overwrite as `setCaptain`); `assign=false`
 * drops it, if they currently hold it. A player can hold several different roles at once — this only
 * ever touches the one field for `role`, never any of the player's other designations.
 */
export async function setPlayerRole(clubId: string, requestingUserId: string, playerId: string, role: PlayerRole, assign: boolean): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new PlayerRoleError('Você não é o dono deste clube');
  }
  if (!club.players.some((p) => p.id === playerId)) {
    throw new PlayerRoleError('Jogador não pertence a este clube');
  }

  const field = PLAYER_ROLE_CLUB_FIELD[role];
  const patch: RoleFieldsPatch = {};

  if (assign) {
    patch[field] = playerId;
    // A brand-new captain always starts tenure at 0; re-selecting the incumbent keeps their existing tenure.
    if (role === 'CAPTAIN') patch.captainWeeksServed = playerId === club.captainPlayerId ? club.captainWeeksServed : 0;
  } else if (club[field] === playerId) {
    patch[field] = null;
    if (role === 'CAPTAIN') patch.captainWeeksServed = 0;
  }

  await prisma.club.update({ where: { id: clubId }, data: patch });
  return { ...club, ...patch };
}

export interface RoleFieldsPatch {
  captainPlayerId?: string | null;
  captainWeeksServed?: number;
  penaltyTakerId?: string | null;
  freeKickTakerId?: string | null;
  cornerLeftTakerId?: string | null;
  cornerRightTakerId?: string | null;
}

/**
 * Clears every squad role (captain + set-piece designations) any of `departingPlayerIds` currently
 * holds on `club` — a Prisma update patch, spreadable alongside whatever else the caller is already
 * writing. Used whenever a player leaves the club (sold, released) so no role field dangles a
 * reference to them (see transferService.ts).
 */
export function vacatedRoleFields(club: Club, departingPlayerIds: string[]): RoleFieldsPatch {
  const departing = new Set(departingPlayerIds);
  const patch: RoleFieldsPatch = {};
  for (const role of PLAYER_ROLES) {
    const field = PLAYER_ROLE_CLUB_FIELD[role];
    const holder = club[field];
    if (holder && departing.has(holder)) {
      patch[field] = null;
      if (role === 'CAPTAIN') patch.captainWeeksServed = 0;
    }
  }
  return patch;
}

/**
 * Sets the tactical sub-role(s) a coach wants for one player — e.g. a LAT played as ALA rather than
 * LATERAL. Must fit the player's base position (see FUNCTIONS_BY_POSITION) and is capped at
 * MAX_PLAYER_FUNCTIONS; this is purely a coach's designation, not something generation ever sets.
 */
export async function setPlayerFunctions(
  clubId: string,
  requestingUserId: string,
  playerId: string,
  functions: PlayerFunction[],
): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new PlayerFunctionError('Você não é o dono deste clube');
  }

  const playerIndex = club.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new PlayerFunctionError('Jogador não pertence a este clube');
  }

  if (functions.length > MAX_PLAYER_FUNCTIONS) {
    throw new PlayerFunctionError(`No máximo ${MAX_PLAYER_FUNCTIONS} funções por jogador`);
  }
  if (new Set(functions).size !== functions.length) {
    throw new PlayerFunctionError('Funções repetidas não são permitidas');
  }

  const player = club.players[playerIndex];
  const allowed = FUNCTIONS_BY_POSITION[player.position];
  for (const fn of functions) {
    if (!allowed.includes(fn)) {
      throw new PlayerFunctionError(`Função inválida para a posição deste jogador`);
    }
  }

  const updatedPlayers = [...club.players];
  updatedPlayers[playerIndex] = { ...player, functions };

  await prisma.club.update({ where: { id: clubId }, data: { playersJson: JSON.stringify(updatedPlayers) } });
  return { ...club, players: updatedPlayers };
}

interface ClubRecord {
  id: string;
  /** Sócios ativos. Alimenta a visibilidade e a receita semanal; ver clubMembership. */
  membersCount?: number | null;
  name: string;
  ownerId: string;
  slug: string | null;
  country: string;
  playersJson: string;
  academyPlayersJson: string;
  budget: number;
  captainPlayerId: string | null;
  captainWeeksServed: number;
  tutorPlayerId: string | null;
  penaltyTakerId: string | null;
  freeKickTakerId: string | null;
  cornerLeftTakerId: string | null;
  cornerRightTakerId: string | null;
  stadiumLevel: number;
  stadiumCapacity: number;
  stadiumTier?: number | null;
  stadiumUpgradeWeek?: number | null;
  stadiumConstructionJson?: string | null;
  stadiumName?: string | null;
  titlesWon: number;
  sponsorshipsJson: string;
  loansJson: string;
  pendingTransferPaymentsJson: string;
  pendingRoundTacticJson: string | null;
  staffJson?: string | null;
  /** Optional: a club stored before the comissão kept a record of what it advised has nothing here. */
  staffRecordJson?: string | null;
  city?: string | null;
  /** Weeks of rest owed but not yet written into the rosters — see `withOwedRest`. */
  pendingRestWeeks?: number | null;
  kitPattern?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  crestBase64?: string | null;
}

/** Older stored rows predate `functions`/`detailedAttributes`/`injuryWeeks`, and predate the switch from
 *  a flat `suspensionMatches` counter to the per-competition `suspensions` array — default/migrate them
 *  in place on read so the rest of the app never sees the old shapes or `undefined`. */
function normalizePlayers(
  players: Array<
    Player & {
      functions?: PlayerFunction[];
      detailedAttributes?: Player['detailedAttributes'];
      injuryWeeks?: number;
      /** Pre-calendar saves counted an injury in matches, not weeks. */
      injuryMatches?: number;
      suspensions?: Player['suspensions'];
      suspensionMatches?: number;
    }
  >,
): Player[] {
  return players.map((p) => {
    const { suspensionMatches, injuryMatches, ...rest } = p;
    return {
      ...rest,
      functions: p.functions ?? [],
      detailedAttributes: p.detailedAttributes ?? defaultDetailedAttributes(),
      injuryWeeks: p.injuryWeeks ?? p.injuryMatches ?? 0,
      suspensions: p.suspensions ?? (suspensionMatches ? [{ competitionId: null, matchesRemaining: suspensionMatches }] : []),
    };
  });
}

/** Exported so the weekly tick can turn a raw batch of rows into clubs without a round trip each. */
/**
 * Folds in the weeks of rest this squad is owed but has not been written with.
 *
 * The weekly tick used to walk every club in the world, parse its roster, rest each player and write the
 * whole thing back — 42 KB read and rewritten per club per week, measured at 87% of the tick's entire
 * cost, to move three small numbers. It now just counts the weeks, and they are applied here, on the way
 * out, where the roster is being parsed anyway.
 *
 * This is only sound because `applyWeeklyRecovery` is pure and deterministic (see the split in
 * development.ts): N weeks owed is exactly N applications, in any order, at any time. Injuries count down
 * the same way. Nothing here is a dice roll, so a squad read today and a squad read next week agree about
 * the past.
 */
function withOwedRest(players: Player[], weeks: number, options: WeeklyRecoveryOptions): Player[] {
  if (weeks <= 0) return players;
  return players.map((player) => {
    let rested = player;
    for (let week = 0; week < weeks; week += 1) rested = applyWeeklyRecovery(rested, options);
    return rested.injuryWeeks > 0 ? { ...rested, injuryWeeks: Math.max(0, rested.injuryWeeks - weeks) } : rested;
  });
}

export function toDomain(record: ClubRecord, division = 1): Club {
  let staff: StaffMember[] = [];
  let staffDelegationConfig: StaffDelegationConfig | undefined = undefined;

  if (record.staffJson) {
    try {
      const parsed = JSON.parse(record.staffJson);
      if (Array.isArray(parsed)) {
        staff = parsed;
      } else if (parsed && typeof parsed === 'object') {
        staff = Array.isArray(parsed.staff) ? parsed.staff : [];
        if (parsed.delegationConfig) {
          staffDelegationConfig = { ...DEFAULT_STAFF_DELEGATION_CONFIG, ...parsed.delegationConfig };
        }
      }
    } catch {
      staff = [];
    }
  }

  /**
   * The owed weeks are applied with this club's own coaching staff, exactly as the tick would have.
   * A fitness coach speeds recovery and a youth coordinator develops the academy, so projecting without
   * them would quietly refund their salaries in lost effect.
   */
  const owedRest = record.pendingRestWeeks ?? 0;
  const fitnessStaminaBoost = getFitnessStaminaBoost(staff.find((s) => s.role === 'FITNESS_COACH'));
  const youthCoordinatorBoost = getYouthDevelopmentBoost(staff.find((s) => s.role === 'YOUTH_COORDINATOR'));
  const simplePreset = (staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG).trainingRegime === 'simple_preset';

  const players = withOwedRest(normalizePlayers(JSON.parse(record.playersJson)), owedRest, {
    fitnessStaminaBoost,
    simplePreset,
  });
  let parsedAcademy: Player[] = [];
  try {
    parsedAcademy = record.academyPlayersJson ? JSON.parse(record.academyPlayersJson) : [];
  } catch {
    parsedAcademy = [];
  }
  if (!Array.isArray(parsedAcademy) || parsedAcademy.length === 0) {
    parsedAcademy = generateAcademy(record.id, record.country, `academy-${record.id}`);
  }
  const academyPlayers = withOwedRest(normalizePlayers(parsedAcademy), owedRest, {
    fitnessStaminaBoost,
    youthCoordinatorBoost,
    isAcademy: true,
    simplePreset,
  });
  /**
   * A visibilidade do clube, com os sócios que ele realmente tem.
   *
   * Estava com `20_000` escrito à mão. A fórmula reserva até vinte pontos para o tamanho da torcida, e esse
   * número fixo congelava esse pedaço: um clube podia ir de 74 mil a 150 mil sócios sem ganhar um ponto. Como
   * a visibilidade é o que destranca comissão técnica melhor, metade do que se ganha enchendo o estádio não
   * chegava a lugar nenhum.
   *
   * A divisão continua entrando por fora. `toDomain` é síncrono e mapeia um registro do banco, e a divisão
   * mora na liga: buscá-la aqui exigiria uma consulta por clube mapeado, e guardá-la no clube criaria uma
   * segunda cópia da verdade em quatro pontos de escrita. Quem sabe a divisão passa-a; quem não sabe fica
   * com a primeira, que é onde a maioria dos clubes está.
   */
  const membros = record.membersCount ?? calculateInitialMembers({ players, stadiumCapacity: record.stadiumCapacity } as Club, division);
  const visScore = calculateClubVisibility({
    players,
    stadiumCapacity: record.stadiumCapacity,
    titlesWon: record.titlesWon,
  } as Club, division, record.titlesWon, membros).score;

  const cfo = staff.find((s) => s.role === 'FINANCIAL_DIRECTOR');
  const bankGuarantees = calculateBankGuaranteeEligibility(record.budget, visScore, cfo?.rating ?? 50);

  return {
    id: record.id,
    name: record.name,
    ownerId: record.ownerId,
    slug: record.slug,
    country: record.country,
    players,
    academyPlayers,
    budget: record.budget,
    captainPlayerId: record.captainPlayerId,
    captainWeeksServed: record.captainWeeksServed,
    tutorPlayerId: record.tutorPlayerId,
    penaltyTakerId: record.penaltyTakerId,
    freeKickTakerId: record.freeKickTakerId,
    cornerLeftTakerId: record.cornerLeftTakerId,
    cornerRightTakerId: record.cornerRightTakerId,
    stadiumLevel: record.stadiumLevel,
    stadiumCapacity: record.stadiumCapacity,
    stadiumTier: record.stadiumTier ?? record.stadiumLevel ?? 1,
    stadiumUpgradeWeek: record.stadiumUpgradeWeek ?? null,
    stadiumConstruction: record.stadiumConstructionJson ? JSON.parse(record.stadiumConstructionJson) : null,
    stadiumName: record.stadiumName ?? null,
    titlesWon: record.titlesWon,
    sponsorships: JSON.parse(record.sponsorshipsJson),
    loans: JSON.parse(record.loansJson),
    pendingTransferPayments: JSON.parse(record.pendingTransferPaymentsJson),
    pendingRoundTactic: record.pendingRoundTacticJson ? JSON.parse(record.pendingRoundTacticJson) : null,
    visibilityScore: visScore,
    staff,
    /**
     * What the comissão has said, and whether it turned out right.
     *
     * Without this line the column exists, the evaluation hooks run, and the staff screen renders a history
     * panel, but `club.staffRecords` is undefined everywhere: both evaluators bail on their first line and
     * the screen shows "Aguardando histórico" for the rest of the save. Defaulted rather than assumed, since
     * a club stored before the column existed has nothing there.
     */
    staffRecords: record.staffRecordJson ? JSON.parse(record.staffRecordJson) : [],
    city: record.city ?? null,
    bankGuarantees,
    kitPattern: (record.kitPattern as KitPattern) ?? undefined,
    primaryColor: record.primaryColor ?? null,
    secondaryColor: record.secondaryColor ?? null,
    crestBase64: record.crestBase64 ?? null,
    staffDelegationConfig: staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG,
  };
}

/**
 * Updates the release clause for a specific player on the roster, adjusting their wage accordingly.
 */
export async function updatePlayerReleaseClause(
  clubId: string,
  requestingUserId: string,
  playerId: string,
  newReleaseClause: number
): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new ReleaseClauseError('Você não é o dono deste clube');
  }

  const playerIndex = club.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new ReleaseClauseError('Jogador não encontrado no elenco');
  }

  if (newReleaseClause <= 0) {
    throw new ReleaseClauseError('Multa rescisória deve ser maior que zero');
  }

  const targetPlayer = club.players[playerIndex];
  const footballDirector = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const newWage = calculateAdjustedWageForReleaseClause(targetPlayer, newReleaseClause, footballDirector?.rating);

  const updatedPlayers = [...club.players];
  updatedPlayers[playerIndex] = {
    ...targetPlayer,
    releaseClause: Math.round(newReleaseClause),
    wage: newWage,
  };

  await prisma.club.update({
    where: { id: clubId },
    data: { playersJson: JSON.stringify(updatedPlayers) },
  });

  return { ...club, players: updatedPlayers };
}

/**
 * Automatically applies tiered contract shielding release clauses across the entire squad.
 */
export async function autoShieldSquadReleaseClausesService(clubId: string, requestingUserId: string): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new ReleaseClauseError('Você não é o dono deste clube');
  }

  const footballDirector = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const shieldResults = autoShieldSquadReleaseClauses(club.players, footballDirector?.rating);

  const shieldByPlayerId = new Map(shieldResults.map((r) => [r.playerId, r]));
  const updatedPlayers = club.players.map((p) => {
    const shield = shieldByPlayerId.get(p.id);
    if (!shield) return p;
    return {
      ...p,
      releaseClause: shield.newReleaseClause,
      wage: shield.newWage,
    };
  });

  await prisma.club.update({
    where: { id: clubId },
    data: { playersJson: JSON.stringify(updatedPlayers) },
  });

  return { ...club, players: updatedPlayers };
}

/**
 * Hires a staff specialist for the club, replacing any existing specialist in the same role.
 */
export async function hireStaffMember(clubId: string, requestingUserId: string, staff: StaffMember): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new StaffError('Você não é o dono deste clube');
  }

  const currentStaff = club.staff ?? [];
  const check = canHireStaff(staff, club.visibilityScore ?? 50, club.titlesWon);
  if (!check.canHire) {
    throw new StaffError(check.reason ?? 'Seu clube não preenche os requisitos para contratar este profissional');
  }

  // Replace existing staff in this role or append
  const updatedStaff = currentStaff.filter((s) => s.role !== staff.role).concat(staff);

  await prisma.club.update({
    where: { id: clubId },
    data: {
      staffJson: JSON.stringify({
        staff: updatedStaff,
        delegationConfig: club.staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG,
      }),
    },
  });

  return { ...club, staff: updatedStaff };
}

/**
 * Fires a staff specialist from the club.
 */
export async function fireStaffMember(clubId: string, requestingUserId: string, staffId: string): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new StaffError('Você não é o dono deste clube');
  }

  const currentStaff = club.staff ?? [];
  const updatedStaff = currentStaff.filter((s) => s.id !== staffId);

  await prisma.club.update({
    where: { id: clubId },
    data: {
      staffJson: JSON.stringify({
        staff: updatedStaff,
        delegationConfig: club.staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG,
      }),
    },
  });

  return { ...club, staff: updatedStaff };
}

/**
 * Updates staff delegation config for the club.
 */
export async function updateStaffDelegationConfig(
  clubId: string,
  requestingUserId: string,
  config: StaffDelegationConfig,
): Promise<Club> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new StaffError('Você não é o dono deste clube');
  }

  const updatedConfig: StaffDelegationConfig = {
    ...DEFAULT_STAFF_DELEGATION_CONFIG,
    ...config,
  };

  await prisma.club.update({
    where: { id: clubId },
    data: {
      staffJson: JSON.stringify({
        staff: club.staff ?? [],
        delegationConfig: updatedConfig,
      }),
    },
  });

  return { ...club, staffDelegationConfig: updatedConfig };
}

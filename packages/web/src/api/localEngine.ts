import {
  BOT_OWNER_ID,
  Club,
  KitPattern,
  Cup,
  FormResult,
  League,
  Match,
  MatchStatus,
  MAX_PLAYER_FUNCTIONS,
  NewsItem,
  PLAYER_ROLE_CLUB_FIELD,
  Player,
  PlayerFunction,
  PlayerRole,
  TacticPreset,
  StandingRow,
  Tactic,
  TacticalAssistantAdvice,
  TransferListing,
  TransferProposal,
  evaluateTransferProposal,
  autoShieldSquadReleaseClauses as sharedAutoShield,
  batchRenewContracts,
  identifyExpiringContracts,
  processDirectorContractDelegation,
  type CategorizedExpiringContracts,
  evaluateFastAdvanceInterruption,
  type FastAdvanceResult,
  computeMidMatchAdaptiveTactic,
  computeStandings,
  generateDoubleRoundRobinFixtures,
  generateSingleRoundRobinFixtures,
  generateCustomCupBracket,
  validateCustomChampionshipConfig,
  type CustomChampionshipConfig,
  type CreateCareerResult,
  type SaveSlot,
  generateSquad,
  buildPlayerFromRating,
  generateAcademy,
  generateTacticalAssistantAdvice,
  generateOppositionDossier,
  planSmartTacticsAgainstOpponent,
  type OppositionDossier,
  autoFillLineup,
  botTactic,
  buildSeasonCalendar,
  buildSponsorBoard,
  generateStaffMarket,
  resolveClubKit,
  canHireStaff,
  generateSponsorshipOffers,
  generateNamingRightsChallengeOffer,
  generateMidSeasonSponsorshipOffers,
  MAX_SPONSORSHIPS,
  type StaffMember,
  type StaffDelegationConfig,
  type TrophyRoomEntry,
  defaultDetailedAttributes,
  DEFAULT_STAFF_DELEGATION_CONFIG,
  type Sponsorship,
  createRng,
  computeTeamStrength,
  derivePossession,
  leagueName,
  cupName,
  STADIUM_LEVELS,
  STADIUM_TIERS,
  getStadiumTierInfo,
  getNextStadiumTier,
  getStadiumCurrentStep,
  getNextStadiumReform,
  type StadiumConstruction,
  simulateBackgroundResult,
  leagueRoundDates,
  previewStadiumUpgrade,
  averageSquadOverall,
  calculateCombatPerformanceBonus,
  simulateMatch,
  simulateMatchSegment,
  COUNTRIES,
  fixtureWeatherKey,
  weatherFor,
  type MatchWeather,
  resumableRngFromState,
  createResumableRng,
  calculateStoppageTime,
  MATCH_MINUTES,
  type LiveMatchState,
  type StadiumUpgradePreview,
  type GameMode,
  type ManagerStyleId,
  type PendingMatchDecision,
  type MatchResult,
  availableReplacements,
  suggestedReplacement,
  applyForcedSubstitution,
  applyAutomatedMedicalCare,
  getAutomatedMedicalCareSettings,
  contractEndFor,
  renewContract,
  renewalCost,
  seasonsRemaining,
  executePlayerTrainingSession,
  planSmartAutoTraining,
  planSmartAcademyAutoTraining,
  getYouthDevelopmentBoost,
  getFitnessTrainingBoost,
  buildHallOfFameData,
  aggregateClubPlayerStats,
  generateBackgroundScorersAndAssists,
  defaultLineupForClub,
  applyBackgroundResultToPlayers,
  applyMatchEventsToPlayers,
  type HallOfFameData,
  type TrophyEntry,
  type ClubRecordBook,
  recordTournamentChampion,
  updateClubRecords,
  getTrophyVisualSpec,
  type DeadlineDayState,
  type DeadlineAuctionItem,
  type DeadlineAiClub,
  type DeadlineBidInput,
  type DeadlineAdvanceResult,
  inactiveDeadlineDay,
  createDeadlineDayState,
  nextMinimumBid,
  placeDeadlineBid,
  advanceDeadlineDay,
  DeadlineDayError,
  type LockerRoomState,
  type TeamTalkContext,
  type TeamTalkResult,
  computeLockerRoomHierarchy,
  getAvailableTeamTalks,
  applyTeamTalk,
  type InterviewType,
  type InterviewTriggerContext,
  type InterviewResponse,
  type PressConferenceImpact,
  type DelegationOption,
  type CausalAnswerOption,
  calculatePressConferenceImpact,
  generateCausalPressConferenceQuestions,
  type ContinentalTournamentState,
  type ContinentalTournamentType,
  generateContinentalGroups,
  calculateGroupStandings,
  generateRoundOf16FromGroups,
  TOURNAMENT_CONFIGS,
  type ClubPotEntry,
  autoSelectNationalSquad,
  calculateFifaReleaseCompensation,
  calculateFifaInjuryIndemnity,
  NATIONAL_TEAMS,
  type NationalTeamConfig,
  type NationalSquadEntry,
  type NationalTeamSquadState,
  type NationalJobOffer,
  REAL_QUALIFIED_LIBERTADORES_SEASON_1,
  REAL_QUALIFIED_SUDAMERICANA_SEASON_1,
} from '@tactical-arena/shared';
import { buildCountry, loadOfflineContent, type OfflineContent } from './offlineWorld.js';

const LOCAL_STORAGE_KEY = 'tactical_arena_offline_save_v1';

/**
 * Which build wrote the save, and the reason a save is thrown away.
 *
 * `localStorage` survives reinstalls, so a career started on an older build opens on a newer one carrying
 * whatever world that older build invented. That is what kept the made-up squads alive after the real club
 * database shipped. While the game is still changing daily the honest thing is to start over: the stamp
 * changes with every build, so installing a new one is what discards the old career.
 *
 * Read through a guard because `__BUILD_STAMP__` is defined by Vite, and the test runner and any other
 * consumer of this module never go through Vite. There it stays constant and no save is ever discarded.
 */
const BUILD_STAMP = typeof __BUILD_STAMP__ === 'string' ? __BUILD_STAMP__ : 'dev';
const LOCAL_USER_ID = 'local_manager_1';
const LOCAL_USER_TOKEN = 'local_manager_token_1';

/** Mirrors `CalendarEntry` in the api client, which is what every screen reads. */
export interface LocalCalendarEntry {
  date: string | null;
  competitionId: string;
  competitionName: string;
  kind: 'LEAGUE' | 'CUP';
  round: number;
  stageName?: string;
  opponentClubId: string;
  opponentName: string;
  opponentSlug?: string | null;
  opponentCrestBase64?: string | null;
  opponentPrimaryColor?: string | null;
  opponentSecondaryColor?: string | null;
  isHome: boolean;
  matchId: string | null;
  result?: { goalsFor: number; goalsAgainst: number; outcome: 'V' | 'E' | 'D' };
}

export interface LocalFreeAgent {
  id: string;
  player: Player;
  sinceSeason: number;
}

interface LocalManagerTenure {
  userId: string;
  clubId: string;
  clubName: string;
  countryCode: string;
  startedAt: string;
  endedAt: string | null;
  endReason: 'RESIGNED' | 'SACKED' | null;
}

interface LocalJobOffer {
  id: string;
  clubId: string;
  clubName: string;
  status: 'PENDING';
  createdAt: string;
}

function openLocalTenure(state: LocalGameState, club: Club): void {
  state.tenures ??= [];
  if (state.tenures.some((tenure) => tenure.userId === LOCAL_USER_ID && tenure.clubId === club.id && !tenure.endedAt)) return;
  state.tenures.push({
    userId: LOCAL_USER_ID,
    clubId: club.id,
    clubName: club.name,
    countryCode: club.country,
    startedAt: new Date().toISOString(),
    endedAt: null,
    endReason: null,
  });
}

export interface LocalPressConference {
  id: string;
  clubId: string;
  week: number;
  type: InterviewType;
  trigger: InterviewTriggerContext;
  status: 'OPEN' | 'SUBMITTED' | 'DELEGATED';
  context: {
    clubName: string;
    managerName: string;
    opponentName: string;
    matchResult: 'W' | 'D' | 'L';
    goalsScored: number;
    goalsConceded: number;
    currentPosition: number;
    isClassic: boolean;
    isFinal: boolean;
    isThreeLossesStreak: boolean;
  };
  questions: Array<{
    id: string;
    text: string;
    category: string;
    reporterName?: string;
    mediaOutlet?: string;
    outletBadge?: string;
    answers?: CausalAnswerOption[];
  }>;
  responses?: InterviewResponse[];
  impact?: PressConferenceImpact;
  createdAt: string;
  updatedAt: string;
}

export interface LocalGameState {
  version: number;
  userId: string;
  gameDate: { year: number; month: number; day: number };
  clubs: Club[];
  leagues: League[];
  cups: Cup[];
  continentalCompetitions?: ContinentalTournamentState[];
  processedFifaWindows?: string[];
  claimedNationalTeamCode?: string | null;
  nationalTeamSquads?: Record<string, NationalSquadEntry[]>;
  nationalTeams?: Record<string, NationalTeamSquadState>;
  nationalJobOffers?: NationalJobOffer[];
  news: NewsItem[];
  listings: TransferListing[];
  proposals: TransferProposal[];
  currentSeason: number;
  tenures?: LocalManagerTenure[];
  jobOffers?: LocalJobOffer[];
  freeAgents?: LocalFreeAgent[];
  /**
   * O modo de carreira desta partida salva.
   *
   * Offline não existe índice de saves em disco — o slot que a tela mostra é derivado deste estado — então é
   * aqui que o modo tem de morar para sobreviver a fechar o jogo.
   */
  gameMode?: GameMode;
  managerStyle?: ManagerStyleId | string;
  /** A partida que o técnico está assistindo, se houver, para ela sobreviver a fechar a tela. */
  liveMatch?: { matchId: string; live: LiveMatchState } | null;
  /** Estado ao vivo das outras partidas da rodada simuladas em paralelo no painel lateral */
  siblingLiveMatches?: Record<string, LiveMatchState>;
  /** Estado persistido do Deadline Day de leilões ao vivo */
  deadlineDayState?: DeadlineDayState;
  lockerRoomStates?: Record<string, LockerRoomState>;
  pressConferences?: LocalPressConference[];
  /** Semente única gerada para este save para que sorteios de campeonatos e partidas sejam exclusivos. */
  saveSeed?: string;
  /** Which build wrote this save. A mismatch means it is discarded rather than migrated; see BUILD_STAMP. */
  buildStamp?: string;
}

export function generateSaveSeed(): string {
  return `save_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_CLUBS_BY_COUNTRY: Record<string, Array<Array<{ name: string; slug: string; rating: number }>>> = {
  BRA: [
    // Série A (20 clubes)
    [
      { name: 'Flamengo', slug: 'flamengo', rating: 82 },
      { name: 'Palmeiras', slug: 'palmeiras', rating: 82 },
      { name: 'Atlético Mineiro', slug: 'atletico-mg', rating: 79 },
      { name: 'Botafogo', slug: 'botafogo', rating: 79 },
      { name: 'São Paulo', slug: 'sao-paulo', rating: 78 },
      { name: 'Fluminense', slug: 'fluminense', rating: 78 },
      { name: 'Grêmio', slug: 'gremio', rating: 77 },
      { name: 'Internacional', slug: 'internacional', rating: 77 },
      { name: 'Corinthians', slug: 'corinthians', rating: 76 },
      { name: 'Cruzeiro', slug: 'cruzeiro', rating: 76 },
      { name: 'Athletico Paranaense', slug: 'athletico-pr', rating: 76 },
      { name: 'Fortaleza', slug: 'fortaleza', rating: 76 },
      { name: 'Bahia', slug: 'bahia', rating: 75 },
      { name: 'Vasco da Gama', slug: 'vasco', rating: 75 },
      { name: 'Red Bull Bragantino', slug: 'bragantino', rating: 75 },
      { name: 'Vitória', slug: 'vitoria', rating: 72 },
      { name: 'Juventude', slug: 'juventude', rating: 71 },
      { name: 'Criciúma', slug: 'criciuma', rating: 71 },
      { name: 'Cuiabá', slug: 'cuiaba', rating: 71 },
      { name: 'Atlético Goianiense', slug: 'atletico-go', rating: 70 },
    ],
    // Série B (20 clubes - Divisão de Acesso)
    [
      { name: 'Santos', slug: 'santos', rating: 75 },
      { name: 'Sport Recife', slug: 'sport', rating: 74 },
      { name: 'Ceará', slug: 'ceara', rating: 74 },
      { name: 'América Mineiro', slug: 'america-mg', rating: 73 },
      { name: 'Coritiba', slug: 'coritiba', rating: 73 },
      { name: 'Goiás', slug: 'goias', rating: 73 },
      { name: 'Novorizontino', slug: 'novorizontino', rating: 72 },
      { name: 'Mirassol', slug: 'mirassol', rating: 71 },
      { name: 'Vila Nova', slug: 'vila-nova', rating: 71 },
      { name: 'Avaí', slug: 'avai', rating: 71 },
      { name: 'Operário Ferroviário', slug: 'operario-pr', rating: 70 },
      { name: 'CRB', slug: 'crb', rating: 70 },
      { name: 'Ponte Preta', slug: 'ponte-preta', rating: 69 },
      { name: 'Paysandu', slug: 'paysandu', rating: 69 },
      { name: 'Chapecoense', slug: 'chapecoense', rating: 69 },
      { name: 'Amazonas', slug: 'amazonas', rating: 68 },
      { name: 'Botafogo-SP', slug: 'botafogo-sp', rating: 68 },
      { name: 'Ituano', slug: 'ituano', rating: 68 },
      { name: 'Guarani', slug: 'guarani', rating: 68 },
      { name: 'Brusque', slug: 'brusque', rating: 67 },
    ],
  ],
  URU: [
    [
      { name: 'Peñarol', slug: 'penarol_uru', rating: 74 },
      { name: 'Nacional', slug: 'nacional_uru', rating: 74 },
      { name: 'Defensor Sporting', slug: 'defensor_uru', rating: 70 },
      { name: 'Danubio', slug: 'danubio_uru', rating: 69 },
      { name: 'Boston River', slug: 'bostonriver_uru', rating: 68 },
      { name: 'Montevideo City', slug: 'mcv_uru', rating: 68 },
      { name: 'Liverpool URU', slug: 'liverpool_uru', rating: 69 },
      { name: 'Wanderers', slug: 'wanderers_uru', rating: 68 },
      { name: 'Cerro Largo', slug: 'cerrolargo_uru', rating: 67 },
      { name: 'River Plate URU', slug: 'riverplate_uru', rating: 67 },
      { name: 'Progreso', slug: 'progreso_uru', rating: 66 },
      { name: 'Fénix', slug: 'fenix_uru', rating: 66 },
      { name: 'Racing Montevideo', slug: 'racing_uru', rating: 66 },
      { name: 'Deportivo Maldonado', slug: 'maldonado_uru', rating: 65 },
      { name: 'Rampla Juniors', slug: 'rampla_uru', rating: 65 },
      { name: 'Miramar Misiones', slug: 'miramar_uru', rating: 64 },
    ],
  ],
  ARG: [
    [
      { name: 'Boca Juniors', slug: 'boca_arg', rating: 80 },
      { name: 'River Plate', slug: 'river_arg', rating: 80 },
      { name: 'Racing Club', slug: 'racing_arg', rating: 77 },
      { name: 'Independiente', slug: 'independiente_arg', rating: 76 },
      { name: 'San Lorenzo', slug: 'sanlorenzo_arg', rating: 75 },
      { name: 'Vélez Sarsfield', slug: 'velez_arg', rating: 75 },
      { name: 'Estudiantes', slug: 'estudiantes_arg', rating: 76 },
      { name: 'Rosario Central', slug: 'rosariocentral_arg', rating: 74 },
      { name: 'Talleres', slug: 'talleres_arg', rating: 75 },
      { name: 'Lanús', slug: 'lanus_arg', rating: 74 },
      { name: 'Newell’s Old Boys', slug: 'newells_arg', rating: 73 },
      { name: 'Argentinos Juniors', slug: 'argentinos_arg', rating: 73 },
      { name: 'Defensa y Justicia', slug: 'defensa_arg', rating: 73 },
      { name: 'Huracán', slug: 'huracan_arg', rating: 72 },
      { name: 'Godoy Cruz', slug: 'godoycruz_arg', rating: 72 },
      { name: 'Belgrano', slug: 'belgrano_arg', rating: 72 },
      { name: 'Gimnasia LP', slug: 'gimnasia_arg', rating: 71 },
      { name: 'Platense', slug: 'platense_arg', rating: 71 },
      { name: 'Banfield', slug: 'banfield_arg', rating: 70 },
      { name: 'Unión', slug: 'union_arg', rating: 70 },
    ],
  ],
};

/**
 * The sponsor board an offline club carries, from the same generator the server uses.
 *
 * Every club here was created with `sponsorships: []`, so offline the whole economy read zero: no weekly
 * income, "Patrocínios ativos: R$ 0/sem", and a club burning its wage bill against nothing but gate money.
 * The board is not decoration — it is the largest income a club has, and `buildSponsorBoard` is a pure
 * function in shared with no server behind it.
 */
function localSponsorBoard(club: Club, division: number) {
  return buildSponsorBoard(
    createRng(`sponsors-${club.id}`),
    {
      avgSquadOverall: averageSquadOverall(club.players ?? []),
      stadiumLevel: club.stadiumLevel,
      division,
      leaguePosition: null,
      totalClubsInLeague: 20,
      titlesWon: club.titlesWon,
    },
    club.stadiumCapacity,
  ).map((deal) => ({ ...deal, id: `${club.id}-${deal.type}` }));
}

/**
 * How much of the real world the offline build carries.
 *
 * Bounded by `localStorage`, which is where the save lives and which stops around 5 MB. Measured: a real club
 * with its real squad serialises to about 30 KB, so these 76 clubs cost roughly 2,3 MB and leave room for the
 * season that gets written on top of them. The whole database is 1.505 clubs and would not fit.
 *
 * Brazil gets both divisions because that is where promotion and relegation is worth playing; the neighbours
 * get one each, enough for their seasons to run alongside.
 */
const OFFLINE_COUNTRIES: { code: string; divisions: number[] }[] = [
  { code: 'BRA', divisions: [20, 20, 20, 20] },
  { code: 'ARG', divisions: [20] },
  { code: 'URU', divisions: [16] },
];

/** The tier a ground of this size sits in, so a real capacity does not arrive with a level that contradicts it. */
function levelForCapacity(capacity: number): number {
  let level = 1;
  for (const tier of STADIUM_LEVELS) if (capacity >= tier.capacity) level = tier.level;
  return level;
}

interface ClubSeed {
  name: string;
  slug: string;
  players: Player[];
  stadiumCapacity: number;
  state?: string | null;
}

function buildClub(seed: ClubSeed, country: string, index: number, division: number): Club {
  const squad = seed.players;
  const clubId = `club_${country}_${index + 1}`;
  const academy = generateAcademy(seed.slug || clubId, country, `academy-${seed.slug || clubId}`);

  for (const p of squad) {
    if (p.detailedAttributes && Object.getOwnPropertyDescriptor(p, 'detailedAttributes')?.enumerable !== false) {
      Object.defineProperty(p, 'detailedAttributes', {
        value: p.detailedAttributes,
        enumerable: false,
        writable: true,
        configurable: true,
      });
    }
  }
  for (const a of academy) {
    if (a.detailedAttributes && Object.getOwnPropertyDescriptor(a, 'detailedAttributes')?.enumerable !== false) {
      Object.defineProperty(a, 'detailedAttributes', {
        value: a.detailedAttributes,
        enumerable: false,
        writable: true,
        configurable: true,
      });
    }
  }

  const club: Club = {
    id: clubId,
    name: seed.name,
    slug: seed.slug,
    ownerId: BOT_OWNER_ID,
    country,
    state: seed.state ?? null,
    players: squad,
    academyPlayers: academy,
    budget: 15_000_000,
    captainPlayerId: squad[0]?.id ?? null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: squad[0]?.id ?? null,
    freeKickTakerId: squad[1]?.id ?? null,
    cornerLeftTakerId: squad[2]?.id ?? null,
    cornerRightTakerId: squad[3]?.id ?? null,
    stadiumLevel: levelForCapacity(seed.stadiumCapacity),
    stadiumCapacity: seed.stadiumCapacity,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
    pendingRoundTactic: null,
    staff: [],
    bankGuarantees: [],
    kitPattern: resolveClubKit({ slug: seed.slug, name: seed.name }).kitPattern,
    primaryColor: resolveClubKit({ slug: seed.slug, name: seed.name }).primaryColor,
    secondaryColor: resolveClubKit({ slug: seed.slug, name: seed.name }).secondaryColor,
    awayKitPattern: resolveClubKit({ slug: seed.slug, name: seed.name }).awayKitPattern,
    awayPrimaryColor: resolveClubKit({ slug: seed.slug, name: seed.name }).awayPrimaryColor,
    awaySecondaryColor: resolveClubKit({ slug: seed.slug, name: seed.name }).awaySecondaryColor,
  };
  club.sponsorships = localSponsorBoard(club, division);
  try {
    club.pendingRoundTactic = autoFillLineup(club);
  } catch {
    // Fallback if squad is small
  }
  return club;
}

/**
 * The invented world, kept as the fallback.
 *
 * Used when the shipped club database cannot be read, which is a real possibility on a platform where the
 * files are served out of the app bundle. A world of made-up clubs is worse than the real one and much better
 * than a game that will not start.
 */
function inventedCountryTier(country: string, division: number, count: number): ClubSeed[] {
  const countryDefs = DEFAULT_CLUBS_BY_COUNTRY[country];
  const tierDefs = countryDefs?.[division - 1] ?? [];
  const seeds: ClubSeed[] = [];
  for (let i = 0; i < count; i++) {
    const def = tierDefs[i] ?? {
      name: `${country} Clube ${division}-${i + 1}`,
      slug: `${country.toLowerCase()}-clube-${division}-${i + 1}`,
      rating: Math.max(50, 78 - (division - 1) * 6 - Math.floor(i / 3)),
    };
    seeds.push({
      name: def.name,
      slug: def.slug,
      players: generateSquad(def.rating, `${country}_${division}_${i}`, country),
      stadiumCapacity: Math.max(2_000, 25_000 - (division - 1) * 10_000),
    });
  }
  return seeds;
}

function initContinentalTournaments(clubs: Club[], season: number, saveSeed?: string): ContinentalTournamentState[] {
  const clubMapBySlug = new Map<string, Club>();
  const clubMapByName = new Map<string, Club>();
  for (const c of clubs) {
    if (c.slug) clubMapBySlug.set(c.slug.toLowerCase(), c);
    clubMapBySlug.set(c.id.toLowerCase(), c);
    clubMapByName.set(c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(), c);
  }

  const pickClubsForList = (slugs: readonly string[], count: number): Club[] => {
    const picked: Club[] = [];
    const usedIds = new Set<string>();

    for (const slug of slugs) {
      if (picked.length >= count) break;
      const found = clubMapBySlug.get(slug) || clubMapBySlug.get(`club_${slug}`) || clubMapByName.get(slug);
      if (found && !usedIds.has(found.id)) {
        picked.push(found);
        usedIds.add(found.id);
      }
    }

    const remaining = [...clubs].sort((a, b) => averageSquadOverall(b.players ?? []) - averageSquadOverall(a.players ?? []));
    for (const c of remaining) {
      if (picked.length >= count) break;
      if (!usedIds.has(c.id)) {
        picked.push(c);
        usedIds.add(c.id);
      }
    }
    return picked.slice(0, count);
  };

  const libClubs = season === 1
    ? pickClubsForList(REAL_QUALIFIED_LIBERTADORES_SEASON_1, 32)
    : [...clubs].sort((a, b) => averageSquadOverall(b.players ?? []) - averageSquadOverall(a.players ?? [])).slice(0, 32);

  const libUsedIds = new Set(libClubs.map(c => c.id));
  const remainingForSud = clubs.filter(c => !libUsedIds.has(c.id));
  const sudClubs = season === 1
    ? pickClubsForList(REAL_QUALIFIED_SUDAMERICANA_SEASON_1, 32)
    : remainingForSud.sort((a, b) => averageSquadOverall(b.players ?? []) - averageSquadOverall(a.players ?? [])).slice(0, 32);

  const libEntrants: ClubPotEntry[] = libClubs.map(c => ({
    clubId: c.id,
    countryCode: c.country,
    reputationOrRating: averageSquadOverall(c.players ?? []),
  }));

  const sudEntrants: ClubPotEntry[] = sudClubs.map(c => ({
    clubId: c.id,
    countryCode: c.country,
    reputationOrRating: averageSquadOverall(c.players ?? []),
  }));

  const rng = createRng(`${saveSeed || 'continental'}-season-${season}`);
  const libGroups = generateContinentalGroups(libEntrants, rng);
  const sudGroups = generateContinentalGroups(sudEntrants, rng);

  const libertadores: ContinentalTournamentState = {
    id: `libertadores_${season}`,
    type: 'LIBERTADORES',
    name: TOURNAMENT_CONFIGS.LIBERTADORES.name,
    season,
    status: 'IN_PROGRESS',
    currentStage: 'GROUP_STAGE',
    groups: libGroups,
    knockoutFixtures: [],
    championClubId: null,
    runnerUpClubId: null,
  };

  const sudamericana: ContinentalTournamentState = {
    id: `sudamericana_${season}`,
    type: 'SUDAMERICANA',
    name: TOURNAMENT_CONFIGS.SUDAMERICANA.name,
    season,
    status: 'IN_PROGRESS',
    currentStage: 'GROUP_STAGE',
    groups: sudGroups,
    knockoutFixtures: [],
    championClubId: null,
    runnerUpClubId: null,
  };

  return [libertadores, sudamericana];
}

/**
 * Builds the world the offline game plays in.
 *
 * Takes the shipped club database when it has been read, and its own inventions when it has not. Club ids stay
 * `club_<PAIS>_<n>` either way, because saves and screens address clubs by that id.
 */
function initDefaultWorld(content: OfflineContent | null = offlineContent, saveSeed?: string): LocalGameState {
  const effectiveSaveSeed = saveSeed || generateSaveSeed();
  const clubs: Club[] = [];
  const leagues: League[] = [];
  const cups: Cup[] = [];

  for (const { code: country, divisions } of OFFLINE_COUNTRIES) {
    const tiers = content
      ? buildCountry(content.clubs, content.squads, country, Math.max(...divisions)).slice(0, divisions.length)
      : [];

    // Anything the database could not supply falls back whole, rather than half real and half invented.
    const seeds: ClubSeed[][] =
      tiers.length > 0
        ? tiers.map((tier, n) => tier.slice(0, divisions[n]))
        : divisions.map((count, divIdx) => inventedCountryTier(country, divIdx + 1, count));

    const countryClubIds: string[] = [];
    let index = 0;

    seeds.forEach((tier, tierIndex) => {
      const division = tierIndex + 1;
      const tierClubs = tier.map((seed) => {
        const club = buildClub(seed, country, index, division);
        index += 1;
        return club;
      });
      clubs.push(...tierClubs);

      const ids = tierClubs.map((c) => c.id);
      countryClubIds.push(...ids);
      leagues.push({
        id: `league_${country}_${division}`,
        countryCode: country,
        division,
        name: leagueName(country, division),
        capacity: ids.length,
        clubIds: ids,
        status: 'IN_PROGRESS',
        fixtures: generateDoubleRoundRobinFixtures(ids, `${effectiveSaveSeed}_league_${country}_${division}_2026`),
        season: 2026,
        championClubId: null,
        championOwnerId: null,
        topScorerPlayerId: null,
        topScorerName: null,
        topScorerGoals: null,
        topScorerClubId: null,
      });
    });

    cups.push({
      id: `cup_${country}_1`,
      name: cupName(country),
      countryCode: country,
      clubIds: countryClubIds,
      fixtures: [],
      status: 'IN_PROGRESS',
      championClubId: null,
      championOwnerId: null,
      season: 2026,
      topScorerPlayerId: null,
      topScorerName: null,
      topScorerGoals: null,
      topScorerClubId: null,
    });
  }

  return {
    version: 1,
    userId: LOCAL_USER_ID,
    saveSeed: effectiveSaveSeed,
    gameDate: { year: 2026, month: 1, day: 15 },
    clubs,
    leagues,
    cups,
    continentalCompetitions: initContinentalTournaments(clubs, 2026, effectiveSaveSeed),
    news: [],
    listings: [],
    proposals: [],
    currentSeason: 2026,
    tenures: [],
    jobOffers: [],
    lockerRoomStates: {},
    buildStamp: BUILD_STAMP,
  };
}

/**
 * The shipped club database, once it has been read.
 *
 * Held at module scope because the world is built from a synchronous call reached through a dozen screens, and
 * threading a promise through all of them to load a file that ships inside the app is the wrong trade. The
 * fetch happens once, before the career screen opens; see `prepareOfflineWorld`.
 */
let offlineContent: OfflineContent | null = null;

/**
 * Reads the club database and, if the world has not been built yet, builds it from the real thing.
 *
 * Called from the start screen before a career can begin. An existing save is left exactly as it is: the
 * clubs of a career in progress cannot be swapped out underneath it.
 */
export function prepareOfflineWorld(): Promise<void> {
  // Memoised, because the start screen asks on mount and again when the career menu opens, and a second
  // read of a 2,1 MB file would race the first to build the world twice.
  offlineWorldReady ??= buildOfflineWorld();
  return offlineWorldReady;
}

let offlineWorldReady: Promise<void> | null = null;

function expandTruncatedClubs(state: LocalGameState, content: OfflineContent): boolean {
  let modified = false;
  const rng = createRng('offline-squad-expansion');
  for (const club of state.clubs) {
    if (!club.players) club.players = [];
    if (club.players.length >= 25) continue;

    const existingNames = new Set(club.players.map((p) => p.name.toLowerCase().trim()));
    const rawList = club.slug ? content.squads.get(club.slug) : undefined;
    if (rawList && rawList.length > 0) {
      const missing = rawList.filter((r) => !existingNames.has(r.name.toLowerCase().trim()));
      for (let i = 0; i < missing.length && club.players.length < 32; i++) {
        const raw = missing[i];
        const p = buildPlayerFromRating(
          {
            id: `${club.slug || club.id}-p${club.players.length}`,
            name: raw.name,
            position: raw.position,
            age: raw.age,
            nationality: raw.nationality || club.country,
            rating: raw.rating,
            starLevel: raw.starLevel ?? 'NONE',
            diferenciado: raw.diferenciado ?? false,
          },
          rng,
        );
        Object.defineProperty(p, 'detailedAttributes', {
          value: p.detailedAttributes || defaultDetailedAttributes(p.overall),
          enumerable: false,
          writable: true,
          configurable: true,
        });
        club.players.push(p);
        existingNames.add(raw.name.toLowerCase().trim());
        modified = true;
      }
    }

    // Se ainda tiver menos de 26 jogadores, completa com jogadores da base/gerados para dar profundidade de elenco
    if (club.players.length < 26) {
      const avg = club.players.length > 0
        ? Math.round(club.players.reduce((sum, p) => sum + p.overall, 0) / club.players.length)
        : 68;
      const filler = generateSquad(avg, `${club.slug || club.id}-fill`, club.country);
      for (const p of filler) {
        if (club.players.length >= 28) break;
        if (existingNames.has(p.name.toLowerCase().trim())) continue;
        Object.defineProperty(p, 'detailedAttributes', {
          value: p.detailedAttributes || defaultDetailedAttributes(p.overall),
          enumerable: false,
          writable: true,
          configurable: true,
        });
        club.players.push(p);
        existingNames.add(p.name.toLowerCase().trim());
        modified = true;
      }
    }
  }
  return modified;
}

async function buildOfflineWorld(): Promise<void> {
  const content = await loadOfflineContent();
  if (!content) return;
  offlineContent = content;

  try {
    // A career in progress on this same build keeps its clubs; one from an older build is about to be dropped.
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalGameState;
      const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
      const hasCorruptedSerieA = parsed.clubs?.some((c) => c.slug === 'exemplo-aguia' || (c.country === 'BRA' && c.name === 'Porto') || (c.country === 'BRA' && (c.players?.length ?? 0) < 22));
      const isCompatibleStamp = (parsed.buildStamp === BUILD_STAMP || (!isTestEnv && Boolean(parsed.buildStamp && (parsed.buildStamp === 'v0.1.3' || parsed.buildStamp.startsWith('2026-'))))) && !hasCorruptedSerieA;
      if (isCompatibleStamp) {
        const hasActiveCareer = parsed.clubs?.some((c) => c.ownerId === LOCAL_USER_ID);
        const hasAccessDivision = parsed.leagues?.some((l) => l.countryCode === 'BRA' && l.division === 2);
        const hasTruncatedRoster = parsed.clubs?.some((c) => c.country === 'BRA' && (c.players?.length ?? 0) < 22);

        if (hasActiveCareer && hasAccessDivision && !hasTruncatedRoster) return;

        if (hasActiveCareer && hasTruncatedRoster) {
          expandTruncatedClubs(parsed, content);
          inMemoryGameState = parsed;
          saveLocalGameState(inMemoryGameState);
          return;
        }
      }
    }
  } catch {
    // Storage unreachable is its own failure and shows up elsewhere; building the world is still worth doing.
  }

  inMemoryGameState = initDefaultWorld(content);
  saveLocalGameState(inMemoryGameState);
}


let inMemoryGameState: LocalGameState | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function resetInMemoryGameState(): void {
  inMemoryGameState = null;
  offlineWorldReady = null;
}

export function loadLocalGameState(): LocalGameState {
  if (inMemoryGameState) {
    if (inMemoryGameState.clubs && inMemoryGameState.clubs.some((c) => c.slug === 'exemplo-aguia' || (c.country === 'BRA' && c.name === 'Porto'))) {
      inMemoryGameState = null;
    } else {
      if (!inMemoryGameState.saveSeed) {
        inMemoryGameState.saveSeed = generateSaveSeed();
      }
      if (offlineContent && inMemoryGameState.clubs && inMemoryGameState.clubs.some((c) => c.country === 'BRA' && (c.players?.length ?? 0) < 22)) {
        if (expandTruncatedClubs(inMemoryGameState, offlineContent)) {
          saveLocalGameState(inMemoryGameState);
        }
      }
      return inMemoryGameState;
    }
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const stamped = raw ? (JSON.parse(raw) as LocalGameState) : null;

    // A career from another build is not migrated, it is dropped. See BUILD_STAMP for why, and until when.
    const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    const hasCorruptedSerieA = stamped?.clubs?.some((c) => c.slug === 'exemplo-aguia' || (c.country === 'BRA' && c.name === 'Porto') || (c.country === 'BRA' && (c.players?.length ?? 0) < 22));
    const isCompatibleStamp = !isTestEnv && !hasCorruptedSerieA && Boolean(stamped?.buildStamp && (stamped.buildStamp === 'v0.1.3' || stamped.buildStamp.startsWith('2026-')));
    const fromThisBuild = (stamped?.buildStamp === BUILD_STAMP || isCompatibleStamp) && !hasCorruptedSerieA;
    if (stamped && !fromThisBuild) {
      console.info('[offline] save de outra versão do jogo, começando do zero');
    }

    if (raw && fromThisBuild) {
      const parsed = stamped as LocalGameState;
      if (parsed && parsed.clubs && Array.isArray(parsed.clubs) && parsed.clubs.length > 0) {
        let updated = false;
        if (!parsed.saveSeed) {
          parsed.saveSeed = generateSaveSeed();
          updated = true;
        }

        // Se o conteúdo offline já estiver disponível e houver elencos truncados da versão anterior (< 22 jogadores), expande
        if (offlineContent && parsed.clubs.some((c) => c.country === 'BRA' && (c.players?.length ?? 0) < 22)) {
          if (expandTruncatedClubs(parsed, offlineContent)) {
            updated = true;
          }
        }
        if (!parsed.tenures) {
          const startedAt = new Date(Date.UTC(
            parsed.gameDate.year,
            parsed.gameDate.month - 1,
            parsed.gameDate.day,
          )).toISOString();
          parsed.tenures = parsed.clubs.filter((club) => club.ownerId === LOCAL_USER_ID).map((club) => ({
            userId: LOCAL_USER_ID,
            clubId: club.id,
            clubName: club.name,
            countryCode: club.country,
            startedAt,
            endedAt: null,
            endReason: null,
          }));
          updated = true;
        }
        if (!parsed.jobOffers) {
          parsed.jobOffers = [];
          updated = true;
        }
        if (!parsed.lockerRoomStates) {
          parsed.lockerRoomStates = {};
          updated = true;
        }

        // Ensure every club has defensive array properties initialized
        for (const club of parsed.clubs) {
          if (!club.players) club.players = [];
          for (const p of club.players) {
            if (!p.detailedAttributes || Object.getOwnPropertyDescriptor(p, 'detailedAttributes')?.enumerable !== false) {
              Object.defineProperty(p, 'detailedAttributes', {
                value: p.detailedAttributes || defaultDetailedAttributes(p.overall),
                enumerable: false,
                writable: true,
                configurable: true,
              });
            }
          }
          if (!club.academyPlayers || club.academyPlayers.length === 0) {
            club.academyPlayers = generateAcademy(club.slug || club.id, club.country);
            updated = true;
          }
          for (const a of club.academyPlayers) {
            if (!a.detailedAttributes || Object.getOwnPropertyDescriptor(a, 'detailedAttributes')?.enumerable !== false) {
              Object.defineProperty(a, 'detailedAttributes', {
                value: a.detailedAttributes || defaultDetailedAttributes(a.overall),
                enumerable: false,
                writable: true,
                configurable: true,
              });
            }
          }
          if (!club.sponsorships) club.sponsorships = [];
          /**
           * A save from before clubs had a board would otherwise stay on zero income for the rest of its
           * life. Filled in on read, which is where this file already heals everything else about an older
           * save's shape.
           */
          if (club.sponsorships.length === 0) {
            club.sponsorships = localSponsorBoard(club, 1);
            updated = true;
          }
          if (!club.loans) club.loans = [];
          if (!club.pendingTransferPayments) club.pendingTransferPayments = [];
          if (!club.staff) club.staff = [];
          if (!club.bankGuarantees) club.bankGuarantees = [];
          if (club.stadiumStep === undefined) {
            const currentTier = club.stadiumTier ?? club.stadiumLevel ?? 1;
            club.stadiumStep = getStadiumCurrentStep(currentTier, club.stadiumCapacity);
          }
        }

        // 1. Ensure leagues exist
        if (!parsed.leagues || parsed.leagues.length === 0) {
          parsed.leagues = [];
          const countries = Array.from(new Set(parsed.clubs.map((c) => c.country)));
          for (const country of countries) {
            const countryClubs = parsed.clubs.filter((c) => c.country === country);
            const cIds = countryClubs.map((c) => c.id);
            parsed.leagues.push({
              id: `league_${country}_1`,
              countryCode: country,
              division: 1,
              name: leagueName(country, 1),
              capacity: countryClubs.length,
              clubIds: cIds,
              status: 'IN_PROGRESS',
              fixtures: generateDoubleRoundRobinFixtures(cIds, `${parsed.saveSeed || 'save'}_league_${country}_1_${parsed.currentSeason || 2026}`),
              season: parsed.currentSeason || 2026,
              championClubId: null,
              championOwnerId: null,
              topScorerPlayerId: null,
              topScorerName: null,
              topScorerGoals: null,
              topScorerClubId: null,
            });
          }
          updated = true;
        }

        // 3. Ensure cups exist
        if (!parsed.cups || parsed.cups.length === 0) {
          parsed.cups = [];
          const countries = Array.from(new Set(parsed.clubs.map((c) => c.country)));
          for (const country of countries) {
            const countryClubs = parsed.clubs.filter((c) => c.country === country);
            const cIds = countryClubs.map((c) => c.id);
            parsed.cups.push({
              id: `cup_${country}_1`,
              name: cupName(country),
              countryCode: country,
              clubIds: cIds,
              fixtures: [],
              status: 'IN_PROGRESS',
              championClubId: null,
              championOwnerId: null,
              season: parsed.currentSeason || 2026,
              topScorerPlayerId: null,
              topScorerName: null,
              topScorerGoals: null,
              topScorerClubId: null,
            });
          }
          updated = true;
        }

        // 4. Ensure continental competitions exist
        if (!parsed.continentalCompetitions || parsed.continentalCompetitions.length === 0) {
          parsed.continentalCompetitions = initContinentalTournaments(parsed.clubs, parsed.currentSeason || 2026);
          updated = true;
        }

        inMemoryGameState = parsed;
        if (updated) {
          saveLocalGameState(parsed);
        }

        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const fresh = initDefaultWorld();
  inMemoryGameState = fresh;
  saveLocalGameState(fresh);
  return fresh;
}


export function saveLocalGameState(state: LocalGameState): void {
  inMemoryGameState = state;
  if (state.clubs) {
    for (const club of state.clubs) {
      if (club.players) {
        for (const p of club.players) {
          if (p.detailedAttributes && Object.getOwnPropertyDescriptor(p, 'detailedAttributes')?.enumerable !== false) {
            Object.defineProperty(p, 'detailedAttributes', {
              value: p.detailedAttributes,
              enumerable: false,
              writable: true,
              configurable: true,
            });
          }
        }
      }
      if (club.academyPlayers) {
        for (const a of club.academyPlayers) {
          if (a.detailedAttributes && Object.getOwnPropertyDescriptor(a, 'detailedAttributes')?.enumerable !== false) {
            Object.defineProperty(a, 'detailedAttributes', {
              value: a.detailedAttributes,
              enumerable: false,
              writable: true,
              configurable: true,
            });
          }
        }
      }
    }
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...state, buildStamp: BUILD_STAMP }));
    } catch (err) {
      /**
       * Worth saying out loud now that the save carries the real club database: it went from well under a
       * megabyte of invented clubs to 2,5 MB, against a `localStorage` quota that stops somewhere near 5 MB.
       * A quota failure here is a career that silently stops being written, so if the world ever grows again
       * this is the line that says so.
       */
      console.error('[offline] não foi possível gravar a carreira', err);
    }
  }, 100);
}

// --- API Emulators ---

export async function localLogin(): Promise<{ token: string; userId: string }> {
  return { token: LOCAL_USER_TOKEN, userId: LOCAL_USER_ID };
}

export async function localRegister(): Promise<{ token: string; userId: string }> {
  return { token: LOCAL_USER_TOKEN, userId: LOCAL_USER_ID };
}

export async function localListMyClubs(): Promise<Club[]> {
  const state = loadLocalGameState();
  return state.clubs.filter((c) => c.ownerId === LOCAL_USER_ID);
}

export async function localGetClub(id: string): Promise<Club> {
  const state = loadLocalGameState();
  const found = state.clubs.find((c) => c.id === id);
  if (!found) throw new Error(`Clube ${id} não encontrado`);
  return found;
}

function deriveLockerRoom(club: Club, incidents: string[] = []): LockerRoomState {
  const room = computeLockerRoomHierarchy(
    club.players,
    club.captainPlayerId ? { [club.captainPlayerId]: club.captainWeeksServed ?? 0 } : {},
    club.captainPlayerId ?? undefined,
  );
  return { ...room, recentIncidents: incidents };
}

export async function localGetLockerRoom(clubId: string): Promise<LockerRoomState> {
  const state = loadLocalGameState();
  const club = state.clubs.find((candidate) => candidate.id === clubId);
  if (!club) throw new Error(`Clube ${clubId} não encontrado`);
  state.lockerRoomStates ??= {};
  const previous = state.lockerRoomStates[clubId];
  const room = deriveLockerRoom(club, previous?.recentIncidents ?? []);
  if (JSON.stringify(previous) !== JSON.stringify(room)) {
    state.lockerRoomStates[clubId] = room;
    saveLocalGameState(state);
  }
  return room;
}

export async function localApplyTeamTalk(
  clubId: string,
  talkId: string,
  context: TeamTalkContext,
  scoreDifferential = 0,
): Promise<TeamTalkResult> {
  const state = loadLocalGameState();
  const club = state.clubs.find((candidate) => candidate.id === clubId);
  if (!club) throw new Error(`Clube ${clubId} não encontrado`);
  if (club.ownerId !== LOCAL_USER_ID) throw new Error('Você não administra este clube');
  const option = getAvailableTeamTalks(context, scoreDifferential, false).find((candidate) => candidate.id === talkId);
  if (!option) throw new Error('Preleção inválida para este contexto');

  const result = applyTeamTalk(
    club.players,
    option,
    context,
    scoreDifferential,
    createRng(`${clubId}:${context}:${talkId}:${scoreDifferential}`),
  );
  club.players = club.players.map((player) => ({
    ...player,
    morale: Math.max(0, Math.min(100, player.morale + (result.moraleModifiers[player.id] ?? 0))),
  }));
  state.lockerRoomStates ??= {};
  state.lockerRoomStates[clubId] = deriveLockerRoom(club, state.lockerRoomStates[clubId]?.recentIncidents ?? []);
  saveLocalGameState(state);
  return result;
}

export async function getActiveLeague(clubId: string) {
  const state = loadLocalGameState();
  const league = state.leagues.find((l) => l.clubIds.includes(clubId) && l.status === 'IN_PROGRESS');
  return league ?? state.leagues.find((l) => l.clubIds.includes(clubId)) ?? null;
}

/**
 * Garante que campanhas em andamento cujas partidas passadas não tenham acumulado gols de atletas
 * sejam retroativamente reconstruídas a partir de todos os fixtures já concluídos.
 */
export function ensurePlayerSeasonStatsBackfilled(state: LocalGameState): boolean {
  let totalGoals = 0;
  for (const c of state.clubs) {
    for (const p of c.players) {
      totalGoals += (p.seasonGoals ?? 0);
    }
  }

  // Se já há gols de atletas computados, não precisa de reprocessamento
  if (totalGoals > 0) return false;

  let backfilled = false;
  const clubMap = new Map(state.clubs.map((c) => [c.id, c]));

  for (const league of state.leagues) {
    for (const fixture of league.fixtures) {
      if (!fixture.result) continue;
      const home = clubMap.get(fixture.homeClubId);
      const away = clubMap.get(fixture.awayClubId);
      if (!home || !away) continue;

      const res = fixture.result as any;
      const homeGoals = res.homeGoals ?? 0;
      const awayGoals = res.awayGoals ?? 0;

      if (res.events && res.events.length > 0) {
        // Partida ao vivo gravada
        const homeL = defaultLineupForClub(home.players).map((p) => p.id);
        const awayL = defaultLineupForClub(away.players).map((p) => p.id);
        const homeMin = new Map<string, number>();
        const awayMin = new Map<string, number>();
        for (const id of homeL) homeMin.set(id, 90);
        for (const id of awayL) awayMin.set(id, 90);

        for (const ev of res.events) {
          if (ev.type === 'substitution') {
            const targetMap = ev.team === 'home' ? homeMin : awayMin;
            if (ev.playerId) targetMap.set(ev.playerId, ev.minute);
            if (ev.relatedPlayerId) targetMap.set(ev.relatedPlayerId, Math.max(1, 90 - ev.minute));
          }
        }

        home.players = applyMatchEventsToPlayers(home.players, res.events, homeMin);
        away.players = applyMatchEventsToPlayers(away.players, res.events, awayMin);
        backfilled = true;
      } else {
        // Partida de segundo plano
        const hEvents = generateBackgroundScorersAndAssists(
          home,
          homeGoals,
          `${league.id}-${fixture.round}-${home.id}-bf`,
        );
        const aEvents = generateBackgroundScorersAndAssists(
          away,
          awayGoals,
          `${league.id}-${fixture.round}-${away.id}-bf`,
        );

        home.players = applyBackgroundResultToPlayers(
          home.players,
          hEvents.scorers,
          hEvents.assists,
          hEvents.lineupPlayerIds,
        );
        away.players = applyBackgroundResultToPlayers(
          away.players,
          aEvents.scorers,
          aEvents.assists,
          aEvents.lineupPlayerIds,
        );

        res.scorers = [...hEvents.scorers, ...aEvents.scorers];
        res.assists = [...hEvents.assists, ...aEvents.assists];
        backfilled = true;
      }
    }
  }

  for (const comp of (state.continentalCompetitions ?? [])) {
    const contFixtures = [
      ...(comp.groups?.flatMap((g) => g.fixtures) ?? []),
      ...(comp.knockoutFixtures ?? []),
    ];
    for (const fixture of contFixtures) {
      if (!(fixture as any).result) continue;
      const home = clubMap.get(fixture.homeClubId);
      const away = clubMap.get(fixture.awayClubId);
      if (!home || !away) continue;

      const res = (fixture as any).result;
      const homeGoals = res.homeGoals ?? 0;
      const awayGoals = res.awayGoals ?? 0;

      const hEvents = generateBackgroundScorersAndAssists(
        home,
        homeGoals,
        `${comp.id}-${fixture.homeClubId}-bf`,
      );
      const aEvents = generateBackgroundScorersAndAssists(
        away,
        awayGoals,
        `${comp.id}-${fixture.awayClubId}-bf`,
      );

      home.players = applyBackgroundResultToPlayers(
        home.players,
        hEvents.scorers,
        hEvents.assists,
        hEvents.lineupPlayerIds,
      );
      away.players = applyBackgroundResultToPlayers(
        away.players,
        aEvents.scorers,
        aEvents.assists,
        aEvents.lineupPlayerIds,
      );

      res.scorers = [...hEvents.scorers, ...aEvents.scorers];
      res.assists = [...hEvents.assists, ...aEvents.assists];
      backfilled = true;
    }
  }

  if (backfilled) {
    saveLocalGameState(state);
  }
  return backfilled;
}

export async function getLeagueStats(leagueId: string) {
  const state = loadLocalGameState();
  ensurePlayerSeasonStatsBackfilled(state);
  const league = state.leagues.find((l) => l.id === leagueId);
  if (!league) return { topScorers: [], topAssistants: [] };
  const fromFixtures = await localGetLeagueStats(leagueId);
  if (fromFixtures.topScorers.length > 0 || fromFixtures.topAssistants.length > 0) {
    return fromFixtures;
  }
  const aggregated = aggregateClubPlayerStats(state.clubs, league.clubIds);
  return {
    topScorers: (aggregated.topScorers ?? []).filter((s) => Number(s.goals ?? 0) > 0),
    topAssistants: (aggregated.topAssistants ?? []).filter((a) => Number(a.assists ?? 0) > 0),
  };
}

export async function getWorldStats() {
  const state = loadLocalGameState();
  ensurePlayerSeasonStatsBackfilled(state);
  return aggregateClubPlayerStats(state.clubs);
}

/**
 * Os países que dão para jogar offline, lidos do banco que veio no APK.
 *
 * A tela oferecia os 98 países da lista estática do `shared`, e o mundo offline tinha três. Escolher Chile
 * devolvia "nenhum clube disponível" sem dizer por quê. Só que cortar para três seria jogar fora conteúdo
 * que já está no aparelho: dos 144 países do arquivo, 29 têm 16 clubes ou mais com elenco de verdade, o
 * bastante para um campeonato. Os outros 115 têm de 1 a 12 clubes, o que não dá liga nenhuma: a Bélgica tem
 * 6, a Polônia 2.
 */
export async function localPlayableCountries(): Promise<string[]> {
  const state = loadLocalGameState();
  const jaNoMundo = new Set(state.leagues.map((l) => l.countryCode));
  if (!offlineContent) return [...jaNoMundo];

  /**
   * Conta pelos dois caminhos, o mesmo que `buildCountry` aceita: elenco listado em `players.csv`, ou nota
   * de força na sexta coluna de `clubs.csv` e elenco gerado a partir dela. Contar só o primeiro escondia
   * países inteiros que o jogo monta sem dificuldade nenhuma: a Polônia aparecia como impossível e abria com
   * 18 clubes quando alcançada por outro caminho.
   */
  const contagem = new Map<string, number>();
  for (const linha of offlineContent.clubs) {
    const temElenco = (offlineContent.squads.get(linha[0])?.length ?? 0) >= 11;
    const temNota = Number.isFinite(Number(linha[5])) && Number(linha[5]) > 0;
    if (temElenco || temNota) contagem.set(linha[2], (contagem.get(linha[2]) ?? 0) + 1);
  }

  return [...new Set([...jaNoMundo, ...[...contagem.entries()].filter(([, q]) => q >= MIN_CLUBES_POR_PAIS).map(([c]) => c)])];
}

/** Abaixo disto o país não tem clubes para um returno duplo que se possa chamar de campeonato. */
const MIN_CLUBES_POR_PAIS = 10;

/**
 * Traz um país para dentro do mundo, e leva embora o anterior que ninguém assumiu.
 *
 * O rodízio existe por causa da cota: o save vive no `localStorage`, que para perto de 5 MB, e os três
 * países de partida já ocupam 2,5. Um país a mais cabe; cinco não cabem, e um jogador que espia dez países
 * antes de escolher encheria a cota só de olhar. Então fica um de cada vez, e o país onde o jogador assumiu
 * um clube nunca é despejado, nem os três de origem.
 */
function trazerPais(state: LocalGameState, country: string): void {
  if (!offlineContent) return;
  if (state.leagues.some((l) => l.countryCode === country)) return;

  const divisoes = buildCountry(offlineContent.clubs, offlineContent.squads, country, 20);
  if (divisoes.length === 0) return;

  const fixos = new Set([...OFFLINE_COUNTRIES.map((c) => c.code), ...state.clubs.filter((c) => c.ownerId === LOCAL_USER_ID).map((c) => c.country)]);
  const despejar = new Set(state.leagues.map((l) => l.countryCode).filter((c) => !fixos.has(c)));
  if (despejar.size > 0) {
    state.clubs = state.clubs.filter((c) => !despejar.has(c.country));
    state.leagues = state.leagues.filter((l) => !despejar.has(l.countryCode));
    state.cups = state.cups.filter((c) => !despejar.has(c.countryCode));
  }

  // Só a primeira divisão: uma segunda dobraria o custo de um país que o jogador ainda está só a espiar.
  const tier = divisoes[0];
  const clubes = tier.map((seed, i) => buildClub(seed, country, i, 1));
  state.clubs.push(...clubes);

  const ids = clubes.map((c) => c.id);
  state.leagues.push({
    id: `league_${country}_1`,
    countryCode: country,
    division: 1,
    name: leagueName(country, 1),
    capacity: ids.length,
    clubIds: ids,
    status: 'IN_PROGRESS',
    fixtures: generateDoubleRoundRobinFixtures(ids, `${state.saveSeed || 'save'}_league_${country}_1_${state.currentSeason}`),
    season: state.currentSeason,
    championClubId: null,
    championOwnerId: null,
    topScorerPlayerId: null,
    topScorerName: null,
    topScorerGoals: null,
    topScorerClubId: null,
  });
  state.cups.push({
    id: `cup_${country}_1`,
    name: cupName(country),
    countryCode: country,
    clubIds: ids,
    fixtures: [],
    status: 'IN_PROGRESS',
    championClubId: null,
    championOwnerId: null,
    season: state.currentSeason,
    topScorerPlayerId: null,
    topScorerName: null,
    topScorerGoals: null,
    topScorerClubId: null,
  });

  saveLocalGameState(state);
}

export async function localListAvailableClubs(country?: string, division?: number): Promise<Club[]> {
  await prepareOfflineWorld();
  const state = loadLocalGameState();
  if (offlineContent && state.clubs && state.clubs.some((c) => c.country === 'BRA' && (c.players?.length ?? 0) < 22)) {
    if (expandTruncatedClubs(state, offlineContent)) {
      saveLocalGameState(state);
    }
  }
  // Montado na hora, do arquivo que já veio no APK, em vez de responder com uma lista vazia.
  if (country) trazerPais(state, country);
  let result = state.clubs.filter((c) => !country || c.country === country);
  if (division !== undefined) {
    const targetLeague = state.leagues.find(
      (l) => (!country || l.countryCode === country) && l.division === division,
    );
    if (targetLeague) {
      const allowedIds = new Set(targetLeague.clubIds);
      result = result.filter((c) => allowedIds.has(c.id));
    }
  }
  return result;
}

export async function localClaimClub(clubId: string): Promise<Club> {
  const state = loadLocalGameState();
  let target = state.clubs.find((c) => c.id === clubId);
  if (!target) {
    const match = clubId.match(/^club_([A-Za-z0-9]+)_/);
    if (match) {
      const countryCode = match[1].toUpperCase();
      trazerPais(state, countryCode);
      target = state.clubs.find((c) => c.id === clubId);
    }
  }
  if (!target) {
    target = state.clubs.find((c) => c.slug === clubId || c.name.toLowerCase() === clubId.toLowerCase());
  }
  if (!target) throw new Error('Clube não encontrado');

  /**
   * O teto de divisão **não** é aplicado offline, e isso é deliberado.
   *
   * O mundo local tem três países, e só o Brasil tem segunda divisão — medido, não suposto. Aplicar aqui a
   * regra do modo padrão prenderia o jogador à Série B brasileira, que é o contrário do que o modo promete,
   * e tornaria o Android pior por causa de uma regra pensada para um mundo de 131 países.
   *
   * A trava volta no dia em que o mundo offline crescer o bastante para ela significar alguma coisa. Até lá,
   * o modo continua guardado no save e continua valendo para o que faz sentido sem servidor: as velocidades
   * de partida e o que a tela mostra.
   */
  target.ownerId = LOCAL_USER_ID;
  openLocalTenure(state, target);
  if (!target.academyPlayers || target.academyPlayers.length === 0) {
    target.academyPlayers = generateAcademy(target.slug || target.id, target.country);
  }

  const countryClubs = state.clubs.filter((c) => c.country === target.country);
  let league = state.leagues.find((l) => l.countryCode === target.country);
  if (!league && countryClubs.length >= 2) {
    const cIds = countryClubs.map((c) => c.id);
    league = {
      id: `league_${target.country}_1`,
      countryCode: target.country,
      division: 1,
      name: leagueName(target.country, 1),
      capacity: countryClubs.length,
      clubIds: cIds,
      status: 'IN_PROGRESS',
      fixtures: generateDoubleRoundRobinFixtures(cIds, `${state.saveSeed || 'save'}_league_${target.country}_1_${state.currentSeason}`),
      season: state.currentSeason,
      championClubId: null,
      championOwnerId: null,
      topScorerPlayerId: null,
      topScorerName: null,
      topScorerGoals: null,
      topScorerClubId: null,
    };
    state.leagues.push(league);
  }

  let cup = state.cups.find((c) => c.countryCode === target.country);
  if (!cup && countryClubs.length >= 2) {
    cup = {
      id: `cup_${target.country}_1`,
      name: cupName(target.country),
      countryCode: target.country,
      clubIds: countryClubs.map((c) => c.id),
      fixtures: [],
      status: 'IN_PROGRESS',
      championClubId: null,
      championOwnerId: null,
      season: state.currentSeason,
      topScorerPlayerId: null,
      topScorerName: null,
      topScorerGoals: null,
      topScorerClubId: null,
    };
    state.cups.push(cup);
  }

  saveLocalGameState(state);
  return target;
}

export async function localCreateClub(name: string, country: string): Promise<Club> {
  const state = loadLocalGameState();
  const squad = generateSquad(72, `custom_${Date.now()}`, country);
  const newClub: Club = {
    id: `custom_club_${Date.now()}`,
    name,
    slug: null,
    ownerId: LOCAL_USER_ID,
    country,
    players: squad,
    academyPlayers: [],
    budget: 15_000_000,
    captainPlayerId: squad[0]?.id ?? null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: squad[0]?.id ?? null,
    freeKickTakerId: squad[1]?.id ?? null,
    cornerLeftTakerId: squad[2]?.id ?? null,
    cornerRightTakerId: squad[3]?.id ?? null,
    stadiumLevel: 1,
    stadiumCapacity: 20000,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
    pendingRoundTactic: null,
    staff: [],
    bankGuarantees: [],
    kitPattern: resolveClubKit({ name }).kitPattern,
    primaryColor: resolveClubKit({ name }).primaryColor,
    secondaryColor: resolveClubKit({ name }).secondaryColor,
    awayKitPattern: resolveClubKit({ name }).awayKitPattern,
    awayPrimaryColor: resolveClubKit({ name }).awayPrimaryColor,
    awaySecondaryColor: resolveClubKit({ name }).awaySecondaryColor,
  };
  state.clubs.push(newClub);
  openLocalTenure(state, newClub);
  saveLocalGameState(state);
  return newClub;
}

export async function localListAllClubsForEditor(): Promise<Club[]> {
  const state = loadLocalGameState();
  return state.clubs;
}

export async function localCreateCustomChampionship(
  config: CustomChampionshipConfig,
  userClubId: string,
  managerName: string,
  participatingClubs?: Club[]
): Promise<CreateCareerResult> {
  const validation = validateCustomChampionshipConfig(config);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const state = loadLocalGameState();

  // Ingest any participating clubs passed from the wizard
  if (participatingClubs && participatingClubs.length > 0) {
    for (const pClub of participatingClubs) {
      const existingIdx = state.clubs.findIndex((c) => c.id === pClub.id);
      if (existingIdx >= 0) {
        state.clubs[existingIdx] = {
          ...state.clubs[existingIdx],
          ...pClub,
          players: (pClub.players && pClub.players.length > 0) ? pClub.players : state.clubs[existingIdx].players,
          sponsorships: (pClub.sponsorships && pClub.sponsorships.length > 0)
            ? pClub.sponsorships
            : (state.clubs[existingIdx].sponsorships && state.clubs[existingIdx].sponsorships.length > 0
                ? state.clubs[existingIdx].sponsorships
                : localSponsorBoard(pClub, 1)),
        };
      } else {
        const squad = (pClub.players && pClub.players.length > 0)
          ? pClub.players
          : generateSquad(72, `custom_${pClub.id}`, pClub.country || 'BRA');
        const clubToAdd: Club = {
          ...pClub,
          id: pClub.id,
          name: pClub.name,
          slug: pClub.slug ?? null,
          country: pClub.country || 'BRA',
          players: squad,
          academyPlayers: pClub.academyPlayers ?? [],
          budget: typeof pClub.budget === 'number' && pClub.budget > 0 ? pClub.budget : 15_000_000,
          captainPlayerId: pClub.captainPlayerId ?? squad[0]?.id ?? null,
          captainWeeksServed: pClub.captainWeeksServed ?? 0,
          tutorPlayerId: pClub.tutorPlayerId ?? null,
          penaltyTakerId: pClub.penaltyTakerId ?? squad[0]?.id ?? null,
          freeKickTakerId: pClub.freeKickTakerId ?? squad[1]?.id ?? null,
          cornerLeftTakerId: pClub.cornerLeftTakerId ?? squad[2]?.id ?? null,
          cornerRightTakerId: pClub.cornerRightTakerId ?? squad[3]?.id ?? null,
          stadiumLevel: pClub.stadiumLevel ?? 1,
          stadiumCapacity: pClub.stadiumCapacity ?? 20000,
          stadiumConstruction: pClub.stadiumConstruction ?? null,
          titlesWon: pClub.titlesWon ?? 0,
          sponsorships: pClub.sponsorships && pClub.sponsorships.length > 0 ? pClub.sponsorships : localSponsorBoard(pClub, 1),
          loans: pClub.loans ?? [],
          pendingTransferPayments: pClub.pendingTransferPayments ?? [],
          pendingRoundTactic: pClub.pendingRoundTactic ?? null,
          staff: pClub.staff ?? [],
          bankGuarantees: pClub.bankGuarantees ?? [],
          ownerId: pClub.id === userClubId ? LOCAL_USER_ID : (pClub.ownerId ?? 'bot'),
        };
        state.clubs.push(clubToAdd);
      }
    }
  }

  // Ensure all clubIds referenced in divisions or cup exist in state.clubs
  const allNeededClubIds = new Set<string>();
  for (const div of config.divisions) {
    for (const cid of div.clubIds) {
      allNeededClubIds.add(cid);
    }
  }
  if (config.cup) {
    for (const cid of config.cup.clubIds) {
      allNeededClubIds.add(cid);
    }
  }

  for (const cid of allNeededClubIds) {
    if (!state.clubs.some((c) => c.id === cid)) {
      const fallbackSquad = generateSquad(72, `synthetic_${cid}`, 'BRA');
      state.clubs.push({
        id: cid,
        name: `Clube ${cid.slice(0, 8)}`,
        slug: null,
        country: 'BRA',
        players: fallbackSquad,
        academyPlayers: [],
        budget: 15_000_000,
        captainPlayerId: fallbackSquad[0]?.id ?? null,
        captainWeeksServed: 0,
        tutorPlayerId: null,
        penaltyTakerId: fallbackSquad[0]?.id ?? null,
        freeKickTakerId: fallbackSquad[1]?.id ?? null,
        cornerLeftTakerId: fallbackSquad[2]?.id ?? null,
        cornerRightTakerId: fallbackSquad[3]?.id ?? null,
        stadiumLevel: 1,
        stadiumCapacity: 20000,
        stadiumConstruction: null,
        titlesWon: 0,
        sponsorships: [],
        loans: [],
        pendingTransferPayments: [],
        pendingRoundTactic: null,
        staff: [],
        bankGuarantees: [],
        kitPattern: resolveClubKit({ slug: cid }).kitPattern,
        primaryColor: resolveClubKit({ slug: cid }).primaryColor,
        secondaryColor: resolveClubKit({ slug: cid }).secondaryColor,
        awayKitPattern: resolveClubKit({ slug: cid }).awayKitPattern,
        awayPrimaryColor: resolveClubKit({ slug: cid }).awayPrimaryColor,
        awaySecondaryColor: resolveClubKit({ slug: cid }).awaySecondaryColor,
        ownerId: cid === userClubId ? LOCAL_USER_ID : 'bot',
      });
    }
  }

  let userClub = state.clubs.find((c) => c.id === userClubId);
  if (!userClub) {
    userClub = state.clubs.find((c) => (c.slug && c.slug === userClubId) || c.name === userClubId);
    if (userClub) {
      userClub.id = userClubId;
    }
  }
  if (!userClub) {
    throw new Error(`Clube do usuário (${userClubId}) não encontrado na base de dados.`);
  }

  // Reset ownership of any previous user clubs
  for (const club of state.clubs) {
    if (club.id !== userClub.id && club.ownerId === LOCAL_USER_ID) {
      club.ownerId = 'bot';
    }
  }

  userClub.ownerId = LOCAL_USER_ID;
  openLocalTenure(state, userClub);

  // Auto-fill tactic for user club and participating clubs if not set
  for (const cid of allNeededClubIds) {
    const c = state.clubs.find((club) => club.id === cid);
    if (c && !c.pendingRoundTactic) {
      try {
        c.pendingRoundTactic = autoFillLineup(c);
      } catch {
        // ignore
      }
    }
  }

  // Preserve rest of the world: state.clubs keeps all existing clubs.
  const newLeagues: League[] = [];
  for (const div of config.divisions) {
    const rawFixtures =
      div.roundsFormat === 'SINGLE'
        ? generateSingleRoundRobinFixtures(div.clubIds, `custom_div_${div.division}_${state.currentSeason}`)
        : generateDoubleRoundRobinFixtures(div.clubIds, `custom_div_${div.division}_${state.currentSeason}`);

    const fixtures = rawFixtures.map((f) => ({
      round: f.round,
      homeClubId: f.homeClubId,
      awayClubId: f.awayClubId,
      matchId: null,
      result: null,
    }));

    newLeagues.push({
      id: `custom_league_${config.id}_div_${div.division}`,
      countryCode: userClub.country,
      division: div.division,
      name: div.name,
      capacity: div.clubIds.length,
      clubIds: div.clubIds,
      status: 'IN_PROGRESS',
      fixtures,
      season: state.currentSeason,
      championClubId: null,
      championOwnerId: null,
      topScorerPlayerId: null,
      topScorerName: null,
      topScorerGoals: null,
      topScorerClubId: null,
    });
  }

  state.leagues = newLeagues;

  if (config.cup) {
    const cupBracket = generateCustomCupBracket(config.cup.clubIds, config.cup);
    state.cups = [
      {
        id: `custom_cup_${config.id}`,
        name: config.cup.name,
        countryCode: userClub.country,
        clubIds: config.cup.clubIds,
        fixtures: cupBracket.fixtures,
        status: 'IN_PROGRESS',
        championClubId: null,
        championOwnerId: null,
        season: state.currentSeason,
        topScorerPlayerId: null,
        topScorerName: null,
        topScorerGoals: null,
        topScorerClubId: null,
      },
    ];
  } else {
    state.cups = [];
  }

  saveLocalGameState(state);

  const saveId = `save_custom_${Date.now()}`;
  const saveSlot: SaveSlot = {
    schemaVersion: 2,
    id: saveId,
    name: config.name,
    fileName: `${saveId}.json`,
    managerFirstName: managerName.split(' ')[0] ?? 'Técnico',
    managerLastName: managerName.split(' ').slice(1).join(' ') || '',
    managerName,
    managerNationality: userClub.country,
    managerStyle: 'Estrategista',
    managerAvatar: '👔',
    clockFormat: 'HALF_45',
    gameMode: 'PREMIUM',
    managerUserId: LOCAL_USER_ID,
    clubId: userClub.id,
    clubName: userClub.name,
    clubCountry: userClub.country,
    division: config.divisions[0]?.division ?? 1,
    season: state.currentSeason,
    round: 1,
    budget: userClub.budget,
    titlesWon: userClub.titlesWon,
    crestBase64: userClub.crestBase64,
    primaryColor: userClub.primaryColor,
    secondaryColor: userClub.secondaryColor,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCurrent: true,
  };

  return {
    save: saveSlot,
    token: LOCAL_USER_TOKEN,
    userId: LOCAL_USER_ID,
    club: userClub,
    reused: false,
  };
}

export async function localGetClubForm(clubId: string): Promise<FormResult[]> {
  const state = loadLocalGameState();
  const results: FormResult[] = [];
  for (const league of state.leagues) {
    for (const fix of league.fixtures) {
      if (fix.result) {
        if (fix.homeClubId === clubId) {
          const outcome: FormResult = fix.result.homeGoals > fix.result.awayGoals ? 'V' : fix.result.homeGoals < fix.result.awayGoals ? 'D' : 'E';
          results.push(outcome);
        } else if (fix.awayClubId === clubId) {
          const outcome: FormResult = fix.result.awayGoals > fix.result.homeGoals ? 'V' : fix.result.awayGoals < fix.result.homeGoals ? 'D' : 'E';
          results.push(outcome);
        }
      }
    }
  }
  return results.slice(-5);
}

export async function localGetClubNews(clubId: string): Promise<NewsItem[]> {
  const state = loadLocalGameState();
  return state.news.filter((n) => !n.clubId || n.clubId === clubId).slice(0, 10);
}

/**
 * The league a club actually plays in.
 *
 * Every one of these lookups used to be `leagues.find((l) => l.countryCode === club.country)`, which was
 * right for exactly as long as a country had one league. The day Brazil got a second division that silently
 * started answering "Série A" for a Série B club, and the damage was invisible until you tried to play:
 * `localAdvanceLiveMatch` wrote the result into the wrong league's fixture list, found no fixture there, and
 * wrote nothing at all. The manager's own game never got a result, so the round never completed, so the
 * clock never moved off round one. From the outside that is exactly "só a rodada do player é simulada".
 *
 * Falls back to the country when the club is in no league at all, which is the state a just-founded club is
 * in for the moment between being created and being placed.
 */
function leagueOfClub(state: LocalGameState, club: Club): League | undefined {
  return (
    state.leagues.find((l) => l.clubIds.includes(club.id)) ??
    state.leagues.find((l) => l.countryCode === club.country)
  );
}

/**
 * A plain team sheet for a side that has not been given one.
 *
 * Takes the club whose sheet it is, which is the whole point: this existed twice, and the copy in
 * `localAdvanceLiveMatch` built one sheet from the home squad and handed it to *both* sides. The engine then
 * looked up eleven home players inside the away squad, found none, and threw on the first of them. That
 * happened on every match the manager played, so their own fixture never got a result, the round never
 * completed, and the clock stopped on round one for the rest of the career.
 */
function defaultTacticFor(club: Club): Tactic {
  if (club.players && club.players.length >= 11) {
    try {
      if (club.ownerId && club.ownerId !== LOCAL_USER_ID) {
        return botTactic(club);
      }
      return autoFillLineup(club);
    } catch {
      // fallback se a escala automática falhar
    }
  }

  // Fallback seguro: garante que um goleiro (se existir) esteja estritamente no slot 0
  const gks = club.players?.filter((p) => p.position === 'GK') ?? [];
  const outfield = club.players?.filter((p) => p.position !== 'GK') ?? [];
  const starters = gks.length > 0
    ? [gks[0], ...outfield.slice(0, 10)]
    : (club.players ?? []).slice(0, 11);
  const starterIds = new Set(starters.map((p) => p.id));
  const remaining = (club.players ?? []).filter((p) => !starterIds.has(p.id));

  return {
    clubId: club.id,
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'BALANCED',
    markingStyle: 'BALANCED',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    lineup: starters.map((p) => ({ playerId: p.id })),
    substitutes: remaining.slice(0, 7).map((p) => ({ playerId: p.id })),
    plannedSubstitutions: [],
  };
}

/**
 * As mesmas cidades que o servidor oferece. Ver `foundClubService`: o estádio grande rende mais toda semana e
 * come a maior parte do dinheiro de partida, então a escolha é um troco entre receita e caixa.
 */
export const LOCAL_CITY_SIZES = {
  SMALL: { label: 'Cidade pequena', capacity: 2_000, budgetShare: 1 },
  MEDIUM: { label: 'Cidade média', capacity: 8_000, budgetShare: 0.7 },
  LARGE: { label: 'Cidade grande', capacity: 15_000, budgetShare: 0.45 },
};

/** O quanto um elenco fundado do zero fica abaixo da média da divisão que o recebe. */
const LOCAL_FOUNDED_HANDICAP = 8;

/**
 * Os países onde há divisão de acesso para receber um clube novo.
 *
 * Offline isto era uma lista de 98 países vinda do servidor, e o servidor não existe no telefone, então o
 * `catch` devolvia lista vazia e a tela de fundar clube ficava sem país nenhum para escolher. Aqui a
 * resposta sai do mundo que de facto está carregado: um país só aparece se tiver uma segunda divisão, senão
 * fundar um clube significaria empurrar alguém para fora da primeira.
 */
export async function localListFoundableCountries(): Promise<{ code: string; accessDivision: number; size: number }[]> {
  const state = loadLocalGameState();
  const porPais = new Map<string, League[]>();
  for (const league of state.leagues) {
    porPais.set(league.countryCode, [...(porPais.get(league.countryCode) ?? []), league]);
  }

  return [...porPais.entries()]
    .map(([code, ligas]) => {
      const acesso = ligas.reduce((menor, l) => (l.division > menor.division ? l : menor));
      return { code, accessDivision: acesso.division, size: acesso.clubIds.length };
    })
    .filter((pais) => pais.accessDivision > 1)
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Funda um clube na divisão de acesso, no lugar do elenco mais fraco dela.
 *
 * A contraparte offline de `foundClubService.foundClub`, e ela faltava por inteiro: `foundClub` no cliente
 * ia direto ao servidor sem desvio, então no Android o botão "Fundar o meu clube" existia e não fazia nada.
 * Mantém a mesma regra do servidor, incluindo o handicap do elenco, para que fundar não seja o caminho
 * fácil: o time nasce oito pontos abaixo da média da divisão que o recebe.
 */
export async function localFoundClub(input: {
  name: string;
  country: string;
  city?: string;
  citySize?: string;
  kitPattern?: KitPattern;
  primaryColor?: string;
  secondaryColor?: string;
  crestBase64?: string;
  awayKitPattern?: KitPattern | null;
  awayPrimaryColor?: string | null;
  awaySecondaryColor?: string | null;
}): Promise<Club> {
  const state = loadLocalGameState();
  const ligas = state.leagues.filter((l) => l.countryCode === input.country);
  if (ligas.length === 0) throw new Error('País sem campeonato neste mundo');

  const acesso = ligas.reduce((menor, l) => (l.division > menor.division ? l : menor));
  if (acesso.division === 1) throw new Error('Este país não tem divisão de acesso');

  const tamanho = LOCAL_CITY_SIZES[(input.citySize as keyof typeof LOCAL_CITY_SIZES) ?? 'SMALL'] ?? LOCAL_CITY_SIZES.SMALL;

  // Só clubes sem técnico podem sair. O clube do próprio jogador nunca é o deslocado.
  const membros = acesso.clubIds
    .map((id) => state.clubs.find((c) => c.id === id))
    .filter((c): c is Club => Boolean(c) && c!.ownerId !== LOCAL_USER_ID);
  if (membros.length === 0) throw new Error('Não há vaga na divisão de acesso');

  const forca = (c: Club) => averageSquadOverall(c.players ?? []);
  const deslocado = membros.reduce((fraco, c) => (forca(c) < forca(fraco) ? c : fraco));
  const mediaDaDivisao = membros.reduce((soma, c) => soma + forca(c), 0) / membros.length;
  const nivel = Math.max(35, Math.round(mediaDaDivisao) - LOCAL_FOUNDED_HANDICAP);

  const id = `club_fundado_${input.country}_${state.clubs.length + 1}`;
  const novo: Club = {
    id,
    name: input.name.trim(),
    slug: `${input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id.slice(-4)}`,
    ownerId: LOCAL_USER_ID,
    country: input.country,
    city: input.city?.trim() || null,
    kitPattern: input.kitPattern ?? 'SOLID',
    primaryColor: input.primaryColor ?? '#e11d48',
    secondaryColor: input.secondaryColor ?? '#ffffff',
    awayKitPattern: input.awayKitPattern ?? 'SOLID',
    awayPrimaryColor: input.awayPrimaryColor ?? '#f8fafc',
    awaySecondaryColor: input.awaySecondaryColor ?? (input.primaryColor ?? '#e11d48'),
    crestBase64: input.crestBase64 ?? null,
    players: generateSquad(nivel, id, input.country),
    academyPlayers: [],
    budget: Math.round(15_000_000 * tamanho.budgetShare),
    captainPlayerId: null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: 1,
    stadiumCapacity: tamanho.capacity,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
    pendingRoundTactic: null,
    staff: [],
    bankGuarantees: [],
  };
  novo.captainPlayerId = novo.players[0]?.id ?? null;
  try {
    novo.pendingRoundTactic = autoFillLineup(novo);
  } catch {}
  novo.sponsorships = localSponsorBoard(novo, acesso.division);

  // Uma troca só, na lista da divisão e em cada jogo já sorteado contra quem sai.
  const trocar = (clubId: string) => (clubId === deslocado.id ? id : clubId);
  acesso.clubIds = acesso.clubIds.map(trocar);
  for (const jogo of acesso.fixtures) {
    jogo.homeClubId = trocar(jogo.homeClubId);
    jogo.awayClubId = trocar(jogo.awayClubId);
  }
  for (const copa of state.cups) {
    copa.clubIds = copa.clubIds.map(trocar);
  }

  // O clube deslocado sai do mundo, senão fica sem campeonato e aparece em telas onde não devia.
  state.clubs = state.clubs.filter((c) => c.id !== deslocado.id);
  state.clubs.push(novo);
  openLocalTenure(state, novo);

  saveLocalGameState(state);
  return novo;
}

export async function localUploadEditorCrest(slug: string, base64Png: string): Promise<void> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.slug === slug);
  if (club) {
    club.crestBase64 = base64Png;
    saveLocalGameState(state);
  }
}

export async function localGetLeague(clubId: string): Promise<League | null> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) return null;
  return leagueOfClub(state, club) ?? null;
}

export async function localGetActiveLeague(clubId: string): Promise<(League & { standings: StandingRow[] }) | null> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) return null;
  const league = leagueOfClub(state, club);
  if (!league) return null;

  const results = league.fixtures
    .filter((f) => f.result != null)
    .map((f) => ({ homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals: f.result!.homeGoals, awayGoals: f.result!.awayGoals }));

  const standings = computeStandings(league.clubIds, results);
  return { ...league, standings };
}

export async function localListLeagues(country?: string, division?: number): Promise<League[]> {
  const state = loadLocalGameState();
  return state.leagues.filter((l) => (!country || l.countryCode === country) && (division === undefined || l.division === division));
}

export async function localGetLeagueById(leagueId: string): Promise<League & { standings: StandingRow[] }> {
  const state = loadLocalGameState();
  const league = state.leagues.find((l) => l.id === leagueId);
  if (!league) throw new Error(`Liga ${leagueId} não encontrada`);
  const results = league.fixtures
    .filter((f) => f.result != null)
    .map((f) => ({ homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals: f.result!.homeGoals, awayGoals: f.result!.awayGoals }));
  const standings = computeStandings(league.clubIds, results);
  return { ...league, standings };
}

export async function localListCups(country?: string): Promise<Cup[]> {
  const state = loadLocalGameState();
  return state.cups.filter((c) => !country || c.countryCode === country);
}

export async function localGetCupById(cupId: string): Promise<Cup> {
  const state = loadLocalGameState();
  const cup = state.cups.find((c) => c.id === cupId);
  if (!cup) throw new Error(`Copa ${cupId} não encontrada`);
  return cup;
}

export async function localGetLeagueStats(leagueId: string): Promise<{ topScorers: any[]; topAssistants: any[] }> {
  const state = loadLocalGameState();
  const league = state.leagues.find((l) => l.id === leagueId);
  if (!league) return { topScorers: [], topAssistants: [] };

  const scorerCounts = new Map<string, { playerId: string; name: string; clubId?: string; goals: number }>();
  const assistCounts = new Map<string, { playerId: string; name: string; clubId?: string; assists: number }>();

  for (const f of league.fixtures) {
    if (f.result?.scorers) {
      for (const s of f.result.scorers) {
        const entry = scorerCounts.get(s.playerId) ?? { playerId: s.playerId, name: s.name, clubId: s.clubId, goals: 0 };
        entry.goals += 1;
        scorerCounts.set(s.playerId, entry);
      }
    } else if (f.result?.events) {
      for (const e of f.result.events) {
        if (e.type === 'goal' && e.playerId) {
          const club = state.clubs.find((c) => c.id === (e.team === 'home' ? f.homeClubId : f.awayClubId));
          const player = club?.players.find((p) => p.id === e.playerId);
          const name = player?.name ?? 'Desconhecido';
          const clubId = e.team === 'home' ? f.homeClubId : f.awayClubId;
          const entry = scorerCounts.get(e.playerId) ?? { playerId: e.playerId, name, clubId, goals: 0 };
          entry.goals += 1;
          scorerCounts.set(e.playerId, entry);
        }
      }
    }

    if (f.result?.assists) {
      for (const a of f.result.assists) {
        const entry = assistCounts.get(a.playerId) ?? { playerId: a.playerId, name: a.name, clubId: a.clubId, assists: 0 };
        entry.assists += 1;
        assistCounts.set(a.playerId, entry);
      }
    }
  }

  const topScorers = Array.from(scorerCounts.values())
    .filter((e) => e.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10)
    .map((e) => ({ ...e, playerName: e.name }));

  const topAssistants = Array.from(assistCounts.values())
    .filter((a) => a.assists > 0)
    .sort((a, b) => b.assists - a.assists)
    .slice(0, 10)
    .map((a) => ({ ...a, playerName: a.name }));

  return { topScorers, topAssistants };
}

export async function localGetCup(clubId: string): Promise<Cup | null> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) return null;
  return state.cups.find((c) => c.countryCode === club.country) ?? null;
}

export async function localGetMatch(id: string): Promise<Match> {
  const state = loadLocalGameState();
  for (const league of state.leagues) {
    const fix = league.fixtures.find(
      (f) => f.matchId === id || `match_${f.homeClubId}_${f.awayClubId}_${f.round}` === id || `${f.homeClubId}_${f.awayClubId}_${f.round}` === id,
    );
    if (fix) {
      const home = state.clubs.find((c) => c.id === fix.homeClubId);
      const away = state.clubs.find((c) => c.id === fix.awayClubId);
      const defaultTactic = (clubId: string): Tactic => {
        const club = state.clubs.find((c) => c.id === clubId);
        return club ? defaultTacticFor(club) : defaultTacticFor({ ...state.clubs[0], id: clubId, players: [] });
      };

      const claimedClub = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
      const eDoTecnico = Boolean(claimedClub) && (fix.homeClubId === claimedClub!.id || fix.awayClubId === claimedClub!.id);

      /**
       * A partida do técnico chega por jogar, não jogada.
       *
       * Isto simulava os noventa minutos aqui mesmo e devolvia `status: 'SIMULATED'`, e o `Tactic.tsx`
       * desvia direto para a tela de resultado quando vê esse status. O jogador apertava "ir para a
       * partida" e caía no placar: a tela ao vivo nunca chegava a abrir. O resto da rodada continua sendo
       * resolvido aqui, que é o que faz a tabela andar.
       */
      if (eDoTecnico && !fix.result) {
        const data = localLeagueRoundDates(league, state.currentSeason).get(fix.round);
        if (data) {
          resolveFixturesOn(state, data, claimedClub!.id);
          const [y, m, d] = data.split('-').map(Number);
          state.gameDate = { year: y, month: m, day: d };
          saveLocalGameState(state);
        }

        /**
         * Devolvida já ao vivo, com o apito inicial dado.
         *
         * `LiveMatch.tsx` guarda a entrada com `status !== 'LIVE' && !live` e manda para o resultado quem
         * não passar: uma partida entregue como `WAITING_TACTICS` era lida como acabada e a tela ricocheteava
         * para o placar. O estado nasce aqui, no minuto zero, e daí em diante é a tela que o empurra.
         */
        if (home && away) {
          const semente = `${state.saveSeed || 'save'}_${fix.homeClubId}_${fix.awayClubId}_${fix.round}`;
          if (!state.liveMatch || state.liveMatch.matchId !== id) {
            state.liveMatch = { matchId: id, live: liveStateInicial(home, away, semente) };
            saveLocalGameState(state);
          }

          return {
            id,
            homeClubId: fix.homeClubId,
            awayClubId: fix.awayClubId,
            seed: semente,
            status: 'LIVE' as MatchStatus,
            live: state.liveMatch.live,
            homeTactic: state.liveMatch.live.homeTactic,
            awayTactic: state.liveMatch.live.awayTactic,
            competitionType: 'league',
            competitionId: league.id,
          };
        }

        return {
          id,
          homeClubId: fix.homeClubId,
          awayClubId: fix.awayClubId,
          seed: id,
          status: 'WAITING_TACTICS' as MatchStatus,
          competitionType: 'league',
          competitionId: league.id,
        };
      }

      let result = fix.result;
      if (!result && home && away) {
        const sim = simulateMatch({
          home: { club: home, tactic: defaultTactic(home.id) },
          away: { club: away, tactic: defaultTactic(away.id) },
          seed: `${state.saveSeed || 'save'}_${fix.homeClubId}_${fix.awayClubId}_${fix.round}`,
          weather: localWeatherOf(state, home, fix.awayClubId),
        });
        result = {
          homeGoals: sim.homeGoals,
          awayGoals: sim.awayGoals,
          stats: sim.stats,
          events: sim.events,
        };
        fix.result = result;

        /**
         * And the rest of the round with it.
         *
         * Opening this screen is one of the two ways a matchday starts, and it was the one that resolved a
         * single fixture and left the other seven standing: the manager played, the table did not move, and
         * the championship could not be read. The date comes from the fixture's own round, so every league
         * playing that day goes with it.
         */
        const date = localLeagueRoundDates(league, state.currentSeason).get(fix.round);
        if (date) {
          const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
          resolveFixturesOn(state, date, claimed?.id ?? null);
          processLocalWeeklyTick(state, date);
        }

        saveLocalGameState(state);
      }

      return {
        id,
        homeClubId: fix.homeClubId,
        awayClubId: fix.awayClubId,
        seed: id,
        status: 'SIMULATED' as MatchStatus,
        homeTactic: home ? defaultTactic(home.id) : undefined,
        awayTactic: away ? defaultTactic(away.id) : undefined,
        result: result as any,
        competitionType: 'league',
        competitionId: league.id,
      };
    }
  }

  for (const cup of state.cups) {
    const fix = cup.fixtures.find(
      (f) => f.matchId === id || `match_${f.homeClubId}_${f.awayClubId}_${f.round}` === id || `${f.homeClubId}_${f.awayClubId}_${f.round}` === id,
    );
    if (fix) {
      const home = state.clubs.find((c) => c.id === fix.homeClubId);
      const away = state.clubs.find((c) => c.id === fix.awayClubId);
      const defaultTactic = (clubId: string): Tactic => {
        const club = state.clubs.find((c) => c.id === clubId);
        return club ? defaultTacticFor(club) : defaultTacticFor({ ...state.clubs[0], id: clubId, players: [] });
      };

      const isSimulated = Boolean(fix.winnerClubId);
      return {
        id,
        homeClubId: fix.homeClubId,
        awayClubId: fix.awayClubId,
        seed: id,
        status: (isSimulated ? 'SIMULATED' : 'WAITING_TACTICS') as MatchStatus,
        homeTactic: home ? defaultTactic(home.id) : undefined,
        awayTactic: away ? defaultTactic(away.id) : undefined,
        competitionType: 'cup',
        competitionId: cup.id,
      };
    }
  }

  throw new Error('Partida não encontrada');
}

export async function localGetNextMatch(clubId: string): Promise<Match | null> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) return null;

  const league = leagueOfClub(state, club);
  if (!league) return null;

  const fix = league.fixtures.find((f) => (f.homeClubId === clubId || f.awayClubId === clubId) && !f.result);
  if (!fix) return null;

  const home = state.clubs.find((c) => c.id === fix.homeClubId);
  const away = state.clubs.find((c) => c.id === fix.awayClubId);
  if (!home || !away) return null;

  return {
    id: `match_${fix.homeClubId}_${fix.awayClubId}_${fix.round}`,
    homeClubId: home.id,
    awayClubId: away.id,
    seed: `${state.saveSeed || 'save'}_${fix.homeClubId}_${fix.awayClubId}_${fix.round}`,
    status: 'WAITING_TACTICS' as MatchStatus,
    competitionType: 'league',
    competitionId: league.id,
  };
}

/**
 * A escalação entregue, e a partida começa.
 *
 * Isto devolvia sempre `status: 'WAITING_TACTICS'` com clubes chamados "home" e "away", um esboço que nunca
 * foi terminado. O `Tactic.tsx` só segue para a tela ao vivo quando vê `LIVE`, então offline o jogador
 * entregava a escalação e ficava parado em "Aguardando os dois técnicos" para sempre: não há segundo técnico
 * a esperar, o adversário é a máquina.
 *
 * A tática fica guardada no clube, senão ela não chega ao motor e o jogador escala um time que não joga.
 */
export async function localSubmitTactic(matchId: string, tactic: Tactic): Promise<Match> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  if (claimed) {
    claimed.pendingRoundTactic = tactic;
    saveLocalGameState(state);
  }

  const partes = matchId.startsWith('match_') ? matchId.slice('match_'.length).split('_') : [];
  const rodada = partes.length >= 3 ? Number(partes[partes.length - 1]) : NaN;
  const liga = claimed ? leagueOfClub(state, claimed) : undefined;
  const fix = liga && Number.isFinite(rodada)
    ? liga.fixtures.find((f) => f.round === rodada && (f.homeClubId === claimed!.id || f.awayClubId === claimed!.id))
    : undefined;

  return {
    id: matchId,
    homeClubId: fix?.homeClubId ?? claimed?.id ?? 'home',
    awayClubId: fix?.awayClubId ?? 'away',
    seed: matchId,
    // Já jogada é resultado; por jogar é ao vivo, porque não há outro técnico para esperar.
    status: (fix?.result ? 'SIMULATED' : 'LIVE') as MatchStatus,
    homeTactic: tactic,
    result: fix?.result as never,
    competitionType: liga ? 'league' : undefined,
    competitionId: liga?.id ?? undefined,
  };
}

/**
 * A partida do técnico, minuto a minuto, offline.
 *
 * `localAdvanceLiveMatch` simulava os noventa minutos de uma vez e devolvia o placar pronto. A tela
 * `LiveMatch` a chama num laço conforme o tempo real passa, pedindo "avance até o minuto 12", e lê
 * `updated.live.events` para narrar, comemorar gol e cobrar pênalti. Sem o campo `live` ela não tinha o que
 * mostrar: no Android o jogador apertava "ir para a partida" e recebia o resultado, sem ver nada acontecer.
 *
 * O motor incremental que o servidor usa mora no `shared` e não precisa de servidor nenhum:
 * `simulateMatchSegment` roda um pedaço de partida e `resumableRngFromState` guarda o sorteio entre as
 * chamadas, então o jogo assistido sai idêntico ao resolvido de uma vez, que é o que o motor promete.
 */
function liveStateInicial(home: Club, away: Club, seed: string): LiveMatchState {
  return {
    currentMinute: 0,
    period: '1T',
    rngState: createResumableRng(seed).getState(),
    homeTactic: home.pendingRoundTactic ?? defaultTacticFor(home),
    awayTactic: away.pendingRoundTactic ?? defaultTacticFor(away),
    homeGoals: 0, awayGoals: 0, homeShots: 0, awayShots: 0,
    homeShotsOnTarget: 0, awayShotsOnTarget: 0,
    homeCorners: 0, awayCorners: 0, homeFouls: 0, awayFouls: 0,
    homePressRecoveries: 0, awayPressRecoveries: 0,
    homeGoalsFromPressRecovery: 0, awayGoalsFromPressRecovery: 0,
    homeXg: 0, awayXg: 0, homeBigChances: 0, awayBigChances: 0,
    homeSaves: 0, awaySaves: 0, homeWoodwork: 0, awayWoodwork: 0,
    homeBlockedShots: 0, awayBlockedShots: 0,
    // 50/50 até a bola rolar, que é o mesmo padrão que o servidor usa ao normalizar um estado antigo.
    homePossession: 50, awayPossession: 50,
    events: [],
  };
}

function autoResolveLocalPendingDecision(live: LiveMatchState, homeClub: Club, awayClub: Club): LiveMatchState {
  const decision = live.pendingDecision;
  if (!decision) return live;
  if (decision.type === 'redCard') return { ...live, pendingDecision: null };

  const club = decision.side === 'home' ? homeClub : awayClub;
  const tactic = decision.side === 'home' ? live.homeTactic : live.awayTactic;
  const injured = club.players.find((p) => p.id === decision.playerId);
  const replacement = injured
    ? suggestedReplacement(availableReplacements(decision.side, tactic, club, live.events), tactic, injured)
    : null;

  if (!injured || !replacement) return { ...live, pendingDecision: null };

  const events = [...live.events];
  const patched = applyForcedSubstitution(decision.side, decision.minute, tactic, injured, replacement, events);
  return {
    ...live,
    homeTactic: decision.side === 'home' ? patched : live.homeTactic,
    awayTactic: decision.side === 'away' ? patched : live.awayTactic,
    events,
    pendingDecision: null,
  };
}

function applyLocalPostMatchMedicalCare(
  state: LocalGameState,
  club: Club,
  events: MatchResult['events'],
  side: 'home' | 'away',
  matchId: string,
): Club {
  const freshInjuryByPlayerId = new Map(
    (events ?? [])
      .filter((event) => event.type === 'injury' && event.team === side && event.playerId && typeof event.injuryWeeks === 'number' && event.injuryWeeks > 0)
      .map((event) => [event.playerId as string, event.injuryWeeks as number]),
  );
  const progressedClub = {
    ...club,
    players: club.players.map((player) => ({
      ...player,
      injuryWeeks: freshInjuryByPlayerId.get(player.id) ?? Math.max(0, player.injuryWeeks - 1),
    })),
  };
  const settings = getAutomatedMedicalCareSettings(progressedClub);
  if (!settings) return progressedClub;

  const result = applyAutomatedMedicalCare(progressedClub, settings.chiefDoctorRating, settings.mode);
  const pad = (value: number) => String(value).padStart(2, '0');
  const createdAt = `${state.gameDate.year}-${pad(state.gameDate.month)}-${pad(state.gameDate.day)}T00:00:00.000Z`;
  state.news.push(...result.recoveries.map((recovery) => ({
    id: `medical_${matchId}_${recovery.playerId}`,
    clubId: club.id,
    category: 'INJURY' as const,
    headline: `🏥 Fisioterapia: ${recovery.playerName} teve a recuperação reduzida em ${recovery.weeksReduced} semana${recovery.weeksReduced === 1 ? '' : 's'}.`,
    createdAt,
  })));
  return result.club;
}

export async function localAdvanceLiveMatch(matchId: string, toMinute: number, interactive = true): Promise<Match> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  if (!claimed) throw new Error('Nenhum clube selecionado');

  const league = leagueOfClub(state, claimed);
  if (!league) throw new Error('Liga não encontrada');

  const partes = matchId.startsWith('match_') ? matchId.slice('match_'.length).split('_') : [];
  const rodadaDoId = partes.length >= 3 ? Number(partes[partes.length - 1]) : NaN;
  const fix = Number.isFinite(rodadaDoId)
    ? league.fixtures.find(
        (f) => f.round === rodadaDoId && (f.homeClubId === claimed.id || f.awayClubId === claimed.id),
      )
    : league.fixtures.find((f) => (f.homeClubId === claimed.id || f.awayClubId === claimed.id) && !f.result);
  if (!fix) throw new Error('Partida não encontrada');

  const home = state.clubs.find((c) => c.id === fix.homeClubId);
  const away = state.clubs.find((c) => c.id === fix.awayClubId);
  if (!home || !away) throw new Error('Clube da partida não encontrado');

  const isHome = home.ownerId === claimed.id || home.id === claimed.id;
  const mySide: 'home' | 'away' = isHome ? 'home' : 'away';

  // Já apitou: a tela pode pedir de novo depois do fim, e a resposta é o mesmo placar, não um jogo novo.
  if (fix.result) {
    return {
      id: matchId,
      homeClubId: home.id,
      awayClubId: away.id,
      seed: `${state.saveSeed || 'save'}_${fix.homeClubId}_${fix.awayClubId}_${fix.round}`,
      status: 'SIMULATED' as MatchStatus,
      result: fix.result,
      competitionType: 'league',
      competitionId: league.id,
    } as Match;
  }

  const seed = `${state.saveSeed || 'save'}_${fix.homeClubId}_${fix.awayClubId}_${fix.round}`;

  // O estado vivo acompanha o save, senão fechar a tela no minuto 30 recomeçaria a partida do zero.
  if (!state.liveMatch || state.liveMatch.matchId !== matchId) {
    state.liveMatch = { matchId, live: liveStateInicial(home, away, seed) };
  }
  const live = state.liveMatch.live;

  // Se houver uma decisão pendente da equipe do jogador assistida ao vivo, o relógio aguarda resposta.
  // Se for simulação desatendida / avançando até o final (toMinute >= 120 ou interactive === false), auto-resolve.
  if (live.pendingDecision) {
    if (interactive && toMinute <= 90 && live.pendingDecision.side === mySide) {
      return {
        id: matchId,
        homeClubId: home.id,
        awayClubId: away.id,
        seed,
        status: 'LIVE' as MatchStatus,
        live,
        competitionType: 'league',
        competitionId: league.id,
      } as Match;
    }
    const resolved = autoResolveLocalPendingDecision(live, home, away);
    Object.assign(live, resolved);
  }

  const acrescimos = calculateStoppageTime(live.events);
  const tetoPrimeiro = 45 + acrescimos.half1;

  if (live.period === 'HT' && Math.round(toMinute) > tetoPrimeiro) live.period = '2T';

  const primeiroTempo = (live.period ?? '1T') === '1T';
  const tetoSegundo = MATCH_MINUTES + acrescimos.half2;
  const teto = primeiroTempo ? tetoPrimeiro : tetoSegundo;

  const alvo = Math.max(live.currentMinute, Math.min(teto, Math.round(toMinute)));
  const inicio = primeiroTempo ? live.currentMinute + 1 : Math.max(tetoPrimeiro + 1, live.currentMinute + 1);

  if (alvo > live.currentMinute) {
    // Avalia ajustes adaptativos táticos do adversário (IA de decisão em tempo real)
    const botSide: 'home' | 'away' = mySide === 'home' ? 'away' : 'home';
    const botClub = botSide === 'home' ? home : away;
    const botTactic = botSide === 'home' ? live.homeTactic : live.awayTactic;
    const botHasRed = live.events.some((e) => e.type === 'card' && e.team === botSide && (e.description?.includes('vermelho') || (e as any).suspensionMatches));
    const humanHasRed = live.events.some((e) => e.type === 'card' && e.team === mySide && (e.description?.includes('vermelho') || (e as any).suspensionMatches));

    const adaptation = computeMidMatchAdaptiveTactic({
      minute: live.currentMinute,
      currentScore: { home: live.homeGoals, away: live.awayGoals },
      botSide,
      botCurrentTactic: botTactic,
      hasRedCard: botHasRed,
      opponentHasRedCard: humanHasRed,
    });

    if (adaptation.adjusted) {
      if (botSide === 'home') {
        live.homeTactic = adaptation.newTactic;
      } else {
        live.awayTactic = adaptation.newTactic;
      }
      const alreadyAnnounced = live.events.some((e) => e.type === ('tactical_adjustment' as any) && (e as any).adjustmentType === adaptation.adjustmentType);
      if (!alreadyAnnounced && adaptation.headline) {
        live.events.push({
          minute: live.currentMinute,
          type: 'tactical_adjustment' as any,
          team: botSide,
          description: `📢 [Ajuste Tático] ${botClub.name}: ${adaptation.headline} — ${adaptation.explanation}`,
          adjustmentType: adaptation.adjustmentType,
        } as any);
      }
    }

    const rng = resumableRngFromState(live.rngState);
    const trecho = simulateMatchSegment({
      home: { club: home, tactic: live.homeTactic },
      away: { club: away, tactic: live.awayTactic },

      rng: rng.next,
      startMinute: inicio,
      endMinute: alvo,
      priorEvents: live.events,
      homeGoals: live.homeGoals,
      awayGoals: live.awayGoals,
      homeShots: live.homeShots,
      awayShots: live.awayShots,
      homeShotsOnTarget: live.homeShotsOnTarget,
      awayShotsOnTarget: live.awayShotsOnTarget,
      homeCorners: live.homeCorners,
      awayCorners: live.awayCorners,
      homeFouls: live.homeFouls,
      awayFouls: live.awayFouls,
      homePressRecoveries: live.homePressRecoveries,
      awayPressRecoveries: live.awayPressRecoveries,
      homeGoalsFromPressRecovery: live.homeGoalsFromPressRecovery,
      awayGoalsFromPressRecovery: live.awayGoalsFromPressRecovery,
      interruptOnInjury:
        interactive &&
        toMinute <= 90 &&
        !((mySide === 'home' ? home : away)?.staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG).autoSubstitutionsInMatch
          ? { [mySide]: true }
          : {},
      interruptOnRedCard:
        interactive &&
        toMinute <= 90 &&
        !((mySide === 'home' ? home : away)?.staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG).autoSubstitutionsInMatch
          ? { [mySide]: true }
          : {},
      weather: localWeatherOf(state, home, away?.id ?? ''),
    } as never);

    const possession = derivePossession(
      trecho.homeStrength,
      trecho.awayStrength,
      trecho.homeTactic,
      trecho.awayTactic,
    );

    Object.assign(live, {
      currentMinute: trecho.stoppedAtMinute ?? alvo,
      rngState: rng.getState(),
      events: [...live.events, ...trecho.events],
      homeGoals: trecho.homeGoals,
      awayGoals: trecho.awayGoals,
      homeShots: trecho.homeShots,
      awayShots: trecho.awayShots,
      homeShotsOnTarget: trecho.homeShotsOnTarget,
      awayShotsOnTarget: trecho.awayShotsOnTarget,
      homeCorners: trecho.homeCorners,
      awayCorners: trecho.awayCorners,
      homeFouls: trecho.homeFouls,
      awayFouls: trecho.awayFouls,
      homePressRecoveries: trecho.homePressRecoveries,
      awayPressRecoveries: trecho.awayPressRecoveries,
      homeGoalsFromPressRecovery: trecho.homeGoalsFromPressRecovery,
      awayGoalsFromPressRecovery: trecho.awayGoalsFromPressRecovery,
      homeXg: trecho.homeXg ?? live.homeXg,
      awayXg: trecho.awayXg ?? live.awayXg,
      homeBigChances: trecho.homeBigChances ?? live.homeBigChances,
      awayBigChances: trecho.awayBigChances ?? live.awayBigChances,
      homeSaves: trecho.homeSaves ?? live.homeSaves,
      awaySaves: trecho.awaySaves ?? live.awaySaves,
      homeWoodwork: trecho.homeWoodwork ?? live.homeWoodwork,
      awayWoodwork: trecho.awayWoodwork ?? live.awayWoodwork,
      homeBlockedShots: trecho.homeBlockedShots ?? live.homeBlockedShots,
      awayBlockedShots: trecho.awayBlockedShots ?? live.awayBlockedShots,
      homePossession: possession.home,
      awayPossession: possession.away,
      pendingDecision: trecho.pendingDecision ?? null,
      homeTactic: trecho.homeTactic,
      awayTactic: trecho.awayTactic,
    });

    if (primeiroTempo && live.currentMinute >= tetoPrimeiro) live.period = 'HT';
  }

  const acabou = live.period === '2T' && !live.pendingDecision && live.currentMinute >= tetoSegundo;
  if (acabou) {
    const stats = {
      home: {
        shots: live.homeShots,
        shotsOnTarget: live.homeShotsOnTarget,
        possession: live.homePossession ?? 50,
        corners: live.homeCorners,
        fouls: live.homeFouls,
        pressRecoveries: live.homePressRecoveries,
        goalsFromPressRecovery: live.homeGoalsFromPressRecovery,
        xg: live.homeXg ?? 0,
        bigChances: live.homeBigChances ?? 0,
        saves: live.homeSaves ?? 0,
        woodwork: live.homeWoodwork ?? 0,
        blockedShots: live.homeBlockedShots ?? 0,
      },
      away: {
        shots: live.awayShots,
        shotsOnTarget: live.awayShotsOnTarget,
        possession: live.awayPossession ?? 50,
        corners: live.awayCorners,
        fouls: live.awayFouls,
        pressRecoveries: live.awayPressRecoveries,
        goalsFromPressRecovery: live.awayGoalsFromPressRecovery,
        xg: live.awayXg ?? 0,
        bigChances: live.awayBigChances ?? 0,
        saves: live.awaySaves ?? 0,
        woodwork: live.awayWoodwork ?? 0,
        blockedShots: live.awayBlockedShots ?? 0,
      },
    };

    const scorers = (live.events ?? [])
      .filter((e) => e.type === 'goal' && e.playerId)
      .map((e) => ({
        playerId: e.playerId as string,
        clubId: e.team === 'home' ? home.id : away.id,
        name: (e.team === 'home' ? home : away).players.find((p) => p.id === e.playerId)?.name ?? 'Desconhecido',
      }));

    const assists = (live.events ?? [])
      .filter((e) => e.type === 'goal' && e.assistPlayerId)
      .map((e) => ({
        playerId: e.assistPlayerId as string,
        clubId: e.team === 'home' ? home.id : away.id,
        name: (e.team === 'home' ? home : away).players.find((p) => p.id === e.assistPlayerId)?.name ?? e.assistPlayerName ?? 'Desconhecido',
      }));

    const matchResult: MatchResult = {
      homeGoals: live.homeGoals,
      awayGoals: live.awayGoals,
      events: live.events,
      stats,
      scorers,
      assists,
    } as never;

    // Atualiza contadores oficiais de temporada e carreira dos atletas (partida ao vivo)
    const homeLineupIds = (live.homeTactic?.lineup ?? []).map((s) => s.playerId).filter(Boolean);
    const awayLineupIds = (live.awayTactic?.lineup ?? []).map((s) => s.playerId).filter(Boolean);
    const homeMinutes = new Map<string, number>();
    const awayMinutes = new Map<string, number>();
    for (const id of homeLineupIds) homeMinutes.set(id, 90);
    for (const id of awayLineupIds) awayMinutes.set(id, 90);

    for (const ev of live.events ?? []) {
      if (ev.type === 'substitution') {
        const targetMap = ev.team === 'home' ? homeMinutes : awayMinutes;
        if (ev.playerId) targetMap.set(ev.playerId, ev.minute);
        if (ev.relatedPlayerId) targetMap.set(ev.relatedPlayerId, Math.max(1, 90 - ev.minute));
      }
    }

    home.players = applyMatchEventsToPlayers(home.players, live.events ?? [], homeMinutes);
    away.players = applyMatchEventsToPlayers(away.players, live.events ?? [], awayMinutes);

    const targetClub = claimed.id === home.id ? home : away;
    const updatedClaimed = applyLocalPostMatchMedicalCare(state, targetClub, live.events, mySide, matchId);
    if (claimed.id === home.id) {
      home.players = updatedClaimed.players;
    } else if (claimed.id === away.id) {
      away.players = updatedClaimed.players;
    }

    const myClub = mySide === 'home' ? home : away;
    const oppClub = mySide === 'home' ? away : home;
    const myAvg = myClub.players.length > 0 ? myClub.players.reduce((s, p) => s + p.overall, 0) / myClub.players.length : 0;
    const oppAvg = oppClub.players.length > 0 ? oppClub.players.reduce((s, p) => s + p.overall, 0) / oppClub.players.length : 0;
    const isUnderdog = myAvg < oppAvg - 3;
    const myGoals = mySide === 'home' ? live.homeGoals : live.awayGoals;
    const oppGoals = mySide === 'home' ? live.awayGoals : live.homeGoals;
    const pressRec = (mySide === 'home' ? live.homePressRecoveries : live.awayPressRecoveries) ?? 0;
    const combatBonus = calculateCombatPerformanceBonus({
      events: live.events,
      mySide,
      myGoals,
      opponentGoals: oppGoals,
      pressRecoveries: pressRec,
      isUnderdog,
    });
    if (combatBonus.totalBonus > 0) {
      updatedClaimed.budget = (updatedClaimed.budget ?? 0) + combatBonus.totalBonus;
    }

    state.clubs = state.clubs.map((club) => club.id === claimed.id ? updatedClaimed : club.id === home.id ? home : club.id === away.id ? away : club);
    fix.result = matchResult as never;
    state.liveMatch = null;

    // O resto da rodada acontece no mesmo dia, senão a tabela anda só com o jogo do técnico.
    const data = localLeagueRoundDates(league, state.currentSeason).get(fix.round);
    if (data) resolveFixturesOn(state, data, claimed.id);
    finishLocalLeague(state, league);
    processLocalWeeklyTick(state, data);
  }

  saveLocalGameState(state);
  return {
    id: matchId,
    homeClubId: home.id,
    awayClubId: away.id,
    seed,
    status: (acabou ? 'SIMULATED' : 'LIVE') as MatchStatus,
    live: acabou ? undefined : live,
    result: acabou ? fix.result : undefined,
    competitionType: 'league',
    competitionId: league.id,
  } as Match;
}

export async function localGetInjuryDecision(matchId: string): Promise<{
  decision: PendingMatchDecision;
  candidates: Player[];
  suggestedId: string | null;
}> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  if (!claimed) throw new Error('Nenhum clube selecionado');

  const live = state.liveMatch?.live;
  const decision = live?.pendingDecision;
  if (!decision || decision.type !== 'injury') {
    throw new Error('Não há nenhuma lesão pendente nesta partida');
  }

  const isHome = decision.side === 'home';
  const tactic = isHome ? live.homeTactic : live.awayTactic;
  const injured = claimed.players.find((p) => p.id === decision.playerId);
  const candidates = availableReplacements(decision.side, tactic, claimed, live.events);
  const suggested = injured ? suggestedReplacement(candidates, tactic, injured) : null;

  return { decision, candidates, suggestedId: suggested?.id ?? null };
}

export async function localResolveInjuryDecision(matchId: string, replacementPlayerId: string | null): Promise<Match> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  if (!claimed) throw new Error('Nenhum clube selecionado');

  const live = state.liveMatch?.live;
  const decision = live?.pendingDecision;
  if (!decision || decision.type !== 'injury') {
    throw new Error('Não há decisão de lesão pendente');
  }

  const isHome = decision.side === 'home';
  const tactic = isHome ? live.homeTactic : live.awayTactic;
  const injured = claimed.players.find((p) => p.id === decision.playerId);

  if (replacementPlayerId && injured) {
    const candidates = availableReplacements(decision.side, tactic, claimed, live.events);
    const replacement = candidates.find((p) => p.id === replacementPlayerId);
    if (replacement) {
      const events = [...live.events];
      const patched = applyForcedSubstitution(decision.side, decision.minute, tactic, injured, replacement, events);
      if (isHome) live.homeTactic = patched;
      else live.awayTactic = patched;
      live.events = events;
    }
  }

  live.pendingDecision = null;
  saveLocalGameState(state);
  return localGetMatch(matchId);
}

export async function localResolveRedCardDecision(matchId: string, lineupPlayerIds: string[] | null): Promise<Match> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  if (!claimed) throw new Error('Nenhum clube selecionado');

  const live = state.liveMatch?.live;
  const decision = live?.pendingDecision;
  if (!decision || decision.type !== 'redCard') {
    throw new Error('Não há decisão de expulsão pendente');
  }

  const isHome = decision.side === 'home';
  const tactic = isHome ? live.homeTactic : live.awayTactic;
  if (lineupPlayerIds && lineupPlayerIds.length > 0) {
    let fullList = lineupPlayerIds;
    if (lineupPlayerIds.length === tactic.lineup.length - 1) {
      fullList = [...lineupPlayerIds, decision.playerId];
    }
    if (fullList.length === tactic.lineup.length) {
      const reorganized: Tactic = {
        ...tactic,
        lineup: tactic.lineup.map((slot, i) => ({ ...slot, playerId: fullList[i] })),
      };
      if (isHome) live.homeTactic = reorganized;
      else live.awayTactic = reorganized;
    }
  }

  live.pendingDecision = null;
  saveLocalGameState(state);
  return localGetMatch(matchId);
}

export async function localUpdateLiveMatchTactic(matchId: string, tactic: Tactic): Promise<Match> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  if (!claimed) throw new Error('Nenhum clube selecionado');

  const league = leagueOfClub(state, claimed);
  if (!league) throw new Error('Liga não encontrada');

  const partes = matchId.startsWith('match_') ? matchId.slice('match_'.length).split('_') : [];
  const rodadaDoId = partes.length >= 3 ? Number(partes[partes.length - 1]) : NaN;
  const fix = Number.isFinite(rodadaDoId)
    ? league.fixtures.find(
        (f) => f.round === rodadaDoId && (f.homeClubId === claimed.id || f.awayClubId === claimed.id),
      )
    : league.fixtures.find((f) => (f.homeClubId === claimed.id || f.awayClubId === claimed.id) && !f.result);
  if (!fix) throw new Error('Partida não encontrada');

  const home = state.clubs.find((c) => c.id === fix.homeClubId);
  const away = state.clubs.find((c) => c.id === fix.awayClubId);
  if (!home || !away) throw new Error('Clube da partida não encontrado');

  const seed = `${state.saveSeed || 'save'}_${fix.homeClubId}_${fix.awayClubId}_${fix.round}`;
  if (!state.liveMatch || state.liveMatch.matchId !== matchId) {
    state.liveMatch = { matchId, live: liveStateInicial(home, away, seed) };
  }

  const isHome = home.ownerId === claimed.id || home.id === claimed.id;
  const side = tactic.clubId === home.id ? 'home' : tactic.clubId === away.id ? 'away' : isHome ? 'home' : 'away';

  state.liveMatch.live = {
    ...state.liveMatch.live,
    homeTactic: side === 'home' ? tactic : state.liveMatch.live.homeTactic,
    awayTactic: side === 'away' ? tactic : state.liveMatch.live.awayTactic,
  };

  saveLocalGameState(state);
  return localGetMatch(matchId);
}


export async function localResetLiveMatch(matchId: string): Promise<Match> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  if (!claimed) throw new Error('Nenhum clube selecionado');

  const league = leagueOfClub(state, claimed);
  if (!league) throw new Error('Liga não encontrada');

  const partes = matchId.startsWith('match_') ? matchId.slice('match_'.length).split('_') : [];
  const rodadaDoId = partes.length >= 3 ? Number(partes[partes.length - 1]) : NaN;
  const fix = Number.isFinite(rodadaDoId)
    ? league.fixtures.find(
        (f) => f.round === rodadaDoId && (f.homeClubId === claimed.id || f.awayClubId === claimed.id),
      )
    : league.fixtures.find((f) => (f.homeClubId === claimed.id || f.awayClubId === claimed.id));
  if (!fix) throw new Error('Partida não encontrada');

  const home = state.clubs.find((c) => c.id === fix.homeClubId);
  const away = state.clubs.find((c) => c.id === fix.awayClubId);
  if (!home || !away) throw new Error('Clube da partida não encontrado');

  const seed = `${fix.homeClubId}_${fix.awayClubId}_${fix.round}_${Date.now()}`;
  delete (fix as any).result;

  state.liveMatch = {
    matchId,
    live: liveStateInicial(home, away, seed),
  };
  if (state.siblingLiveMatches) {
    state.siblingLiveMatches = {};
  }
  saveLocalGameState(state);

  return {
    id: matchId,
    homeClubId: home.id,
    awayClubId: away.id,
    seed,
    status: 'LIVE' as MatchStatus,
    homeTactic: state.liveMatch.live.homeTactic,
    awayTactic: state.liveMatch.live.awayTactic,
    live: state.liveMatch.live,
    broadcaster: state.liveMatch.live.broadcaster,
    competitionType: 'league',
    competitionId: league.id,
  };
}


export async function localListTransferListings(): Promise<TransferListing[]> {
  const state = loadLocalGameState();
  return state.listings;
}

export async function localBuyTransferListing(listingId: string, buyerClubId: string): Promise<void> {
  const state = loadLocalGameState();
  const idx = state.listings.findIndex((l) => l.id === listingId);
  if (idx === -1) throw new Error('Anúncio não encontrado');
  const listing = state.listings[idx];
  const buyer = state.clubs.find((c) => c.id === buyerClubId);
  const seller = state.clubs.find((c) => c.id === listing.clubId);
  if (!buyer || !seller) throw new Error('Clubes envolvidos não encontrados');

  if (buyer.budget < listing.askingPrice) {
    throw new Error('Orçamento insuficiente');
  }

  const pIdx = seller.players.findIndex((p) => p.id === listing.player.id);
  if (pIdx === -1) throw new Error('Jogador não encontrado no vendedor');
  const [player] = seller.players.splice(pIdx, 1);

  buyer.budget -= listing.askingPrice;
  seller.budget += listing.askingPrice;
  buyer.players.push(player);

  state.listings.splice(idx, 1);
  saveLocalGameState(state);
}

export async function localPayReleaseClause(
  sellerClubId: string,
  playerId: string,
  buyerClubId: string
): Promise<void> {
  const state = loadLocalGameState();
  const buyer = state.clubs.find((c) => c.id === buyerClubId);
  let seller = state.clubs.find((c) => c.id === sellerClubId);
  if (!seller) seller = ensureClubInGameState(state, sellerClubId);

  if (!buyer || !seller) {
    throw new Error('Clubes envolvidos não encontrados');
  }

  const pIdx = seller.players.findIndex((p) => p.id === playerId);
  if (pIdx === -1) {
    throw new Error('Jogador não encontrado no clube de origem');
  }

  const player = seller.players[pIdx];
  const clauseAmount = player.releaseClause ?? (player.marketValue * 2);

  if (buyer.budget < clauseAmount) {
    throw new Error('Orçamento insuficiente para pagar a multa rescisória');
  }

  // Executa a transferência financeira e de elenco
  buyer.budget -= clauseAmount;
  seller.budget += clauseAmount;

  seller.players.splice(pIdx, 1);
  player.clubId = buyer.id;
  buyer.players.push(player);

  // Remove qualquer anúncio de venda ativo do jogador
  state.listings = (state.listings ?? []).filter((l) => l.player?.id !== player.id);

  // Registra a notícia oficial da contratação no Inbox
  state.news = state.news ?? [];
  state.news.push({
    id: `clause_${Date.now()}_${player.id}`,
    clubId: buyer.id,
    category: 'TRANSFER_IN',
    headline: `Multa Paga! O ${buyer.name} pagou a multa rescisória de R$ ${clauseAmount.toLocaleString('pt-BR')} e contratou ${player.name} junto ao ${seller.name}!`,
    createdAt: new Date().toISOString(),
  });

  saveLocalGameState(state);
}

export async function localUpdateReleaseClause(clubId: string, playerId: string, newClause: number): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  const player = club.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Jogador não encontrado');
  player.releaseClause = newClause;
  saveLocalGameState(state);
  return club;
}

export async function localAutoShieldReleaseClauses(clubId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  sharedAutoShield(club.players);
  saveLocalGameState(state);
  return club;
}


export async function localGetCareer(): Promise<{ tenures: Omit<LocalManagerTenure, 'userId'>[]; titles: any[]; activeClubIds: string[] }> {
  const state = loadLocalGameState();
  const tenures = (state.tenures ?? []).filter((tenure) => tenure.userId === LOCAL_USER_ID);
  const titles = [
    ...state.leagues.filter((league) => league.championOwnerId === LOCAL_USER_ID).map((league) => ({ type: 'league', name: league.name, season: league.season, division: league.division })),
    ...state.cups.filter((cup) => cup.championOwnerId === LOCAL_USER_ID).map((cup) => ({ type: 'cup', name: cup.name, season: cup.season })),
  ];
  return {
    tenures: tenures.map(({ userId: _userId, ...tenure }) => tenure),
    titles,
    activeClubIds: tenures.filter((tenure) => !tenure.endedAt).map((tenure) => tenure.clubId),
  };
}

export async function localGetJobOffers(): Promise<Omit<LocalJobOffer, 'status'>[]> {
  const state = loadLocalGameState();
  if (state.clubs.some((club) => club.ownerId === LOCAL_USER_ID)) return [];

  state.jobOffers ??= [];
  const before = state.jobOffers.length;
  state.jobOffers = state.jobOffers.filter((offer) =>
    state.clubs.some((club) => club.id === offer.clubId && club.ownerId === BOT_OWNER_ID),
  );
  let changed = state.jobOffers.length !== before;
  let pending = state.jobOffers;
  if (pending.length === 0) {
    const createdAt = new Date().toISOString();
    pending = state.clubs.filter((club) => club.ownerId === BOT_OWNER_ID).slice(0, 3).map((club, index) => ({
      id: `local_offer_${Date.now()}_${index}`,
      clubId: club.id,
      clubName: club.name,
      status: 'PENDING' as const,
      createdAt,
    }));
    state.jobOffers.push(...pending);
    changed = true;
  }
  if (changed) saveLocalGameState(state);
  return pending.map(({ status: _status, ...offer }) => offer);
}

export async function localAcceptJobOffer(offerId: string): Promise<Club> {
  const state = loadLocalGameState();
  const offer = state.jobOffers?.find((candidate) => candidate.id === offerId);
  if (!offer || offer.status !== 'PENDING') throw new Error('Esta oferta não está mais disponível');
  const club = state.clubs.find((candidate) => candidate.id === offer.clubId);
  if (!club || club.ownerId !== BOT_OWNER_ID) throw new Error('Este clube já contratou outro técnico');

  state.jobOffers = [];
  saveLocalGameState(state);
  return localClaimClub(offer.clubId);
}

/**
 * The game clock, in the shape the game actually reads.
 *
 * This used to return `{ gameDate, currentSeasonYear, lastTickDate, clockFormat }`, which shares not one
 * field name with `GameStateView`. Every reader therefore got `undefined` where it expected a date, and
 * `ClubNav` renders `formatLongPtBr(gameState.currentDate)` on every club screen — so `parseGameDate`
 * threw "Data de jogo inválida: undefined" during render and took the whole tree down. That is the blank
 * screen the Android build showed after opening a career: offline mode is the default there, and only
 * there, which is why the desktop build with a real server never hit it.
 *
 * The same mismatch had already been found in `localGetTacticalAdvice`, so the shape of what this file
 * returns is worth checking against the interface rather than assumed.
 */
/**
 * O tempo de um confronto, offline.
 *
 * Espelho exato de `weatherOfFixture` no servidor, e é obrigatório que seja: a preleção calcula o tempo
 * pela mesma chave antes de o jogo existir, e se o motor offline jogasse sempre em tempo seco, a tela
 * anunciaria campo pesado e a partida sairia normal. Prometer no Android o que só acontece no servidor é
 * pior que não ter clima nenhum.
 */
function localWeatherOf(state: { gameDate: { year: number; month: number; day: number } }, homeClub: Club | undefined, awayClubId: string): MatchWeather {
  if (!homeClub) return 'DRY';
  const pad = (v: number) => String(v).padStart(2, '0');
  const data = `${state.gameDate.year}-${pad(state.gameDate.month)}-${pad(state.gameDate.day)}`;
  const continent = COUNTRIES.find((c) => c.code === homeClub.country)?.continent ?? 'SOUTH_AMERICA';
  return weatherFor(data, continent, fixtureWeatherKey(homeClub.id, awayClubId));
}

export async function localGetGameState(): Promise<{
  currentDate: string;
  seasonYear: number;
  phase: 'PRE_SEASON' | 'IN_SEASON' | 'OFF_SEASON';
  lastWeeklyTickDate: string | null;
  seasonStartDate: string;
  seasonEndDate: string;
}> {
  const state = loadLocalGameState();
  const pad = (value: number) => String(value).padStart(2, '0');
  const currentDate = `${state.gameDate.year}-${pad(state.gameDate.month)}-${pad(state.gameDate.day)}`;
  const season = state.currentSeason;

  // The Brazilian calendar the rest of the game runs on: April to December, with the year turning in January.
  const seasonStartDate = `${season}-04-01`;
  const seasonEndDate = `${season}-12-15`;
  const phase =
    currentDate < seasonStartDate ? 'PRE_SEASON' : currentDate > seasonEndDate ? 'OFF_SEASON' : 'IN_SEASON';

  return { currentDate, seasonYear: season, phase, lastWeeklyTickDate: currentDate, seasonStartDate, seasonEndDate };
}

/**
 * The season's dates, built once per league from the same calendar the server uses.
 *
 * The offline engine used to invent them, stamping every fixture with `2026-0X-15` off a division of the
 * round number. `buildSeasonCalendar` is a pure function in shared with no database behind it, so there was
 * never a reason to guess: it lays April to December out into weekend and midweek slots and hands each round
 * a real date, which is what makes "the next match" and "advance to the next matchday" mean anything.
 */
function localLeagueRoundDates(league: League, seasonYear: number): Map<number, string> {
  const rounds = league.fixtures.reduce((max, f) => Math.max(max, f.round), 0);
  const calendar = buildSeasonCalendar({ seasonYear, leagueRounds: rounds, leagueKey: league.id });
  return leagueRoundDates(calendar, league.id);
}

/**
 * The competition banner over a live match, and the other games of the same round.
 *
 * Rebuilt from its contract after an over-wide edit removed it. The live match screen reads
 * `competition.name` and tickers through `fixtures`, so both have to be present and the fixtures have to be
 * `Match`-shaped rather than raw league fixtures.
 */
export async function localGetMatchSiblings(matchId: string): Promise<{
  competition: { type: 'league'; name: string; division: number; round: number } | null;
  fixtures: Match[];
}> {
  const state = loadLocalGameState();

  const parts = matchId.split('_');
  const round = Number(parts[parts.length - 1]);
  const league = state.leagues.find((l) => l.fixtures.some((f) => `match_${f.homeClubId}_${f.awayClubId}_${f.round}` === matchId));
  if (!league || !Number.isFinite(round)) return { competition: null, fixtures: [] };

  if (!state.siblingLiveMatches) {
    state.siblingLiveMatches = {};
  }

  const fixtures = league.fixtures
    .filter((f) => f.round === round && `match_${f.homeClubId}_${f.awayClubId}_${f.round}` !== matchId)
    .map((f) => {
      const sibId = `match_${f.homeClubId}_${f.awayClubId}_${f.round}`;
      const home = state.clubs.find((c) => c.id === f.homeClubId);
      const away = state.clubs.find((c) => c.id === f.awayClubId);
      const seed = `${state.saveSeed || 'save'}_${f.homeClubId}_${f.awayClubId}_${f.round}`;

      let liveState = state.siblingLiveMatches?.[sibId];
      if (!liveState && home && away) {
        liveState = liveStateInicial(home, away, seed);
        state.siblingLiveMatches![sibId] = liveState;
      }

      const isSimulated = !!f.result && (!liveState || liveState.currentMinute >= 90);

      return {
        id: sibId,
        homeClubId: f.homeClubId,
        homeClubName: home?.name ?? 'Casa',
        homeClubSlug: home?.slug ?? null,
        awayClubId: f.awayClubId,
        awayClubName: away?.name ?? 'Fora',
        awayClubSlug: away?.slug ?? null,
        status: (isSimulated ? 'SIMULATED' : 'LIVE') as MatchStatus,
        live: isSimulated ? undefined : liveState,
        result: isSimulated && f.result ? { homeGoals: f.result.homeGoals, awayGoals: f.result.awayGoals, events: f.result.events ?? [] } : undefined,
      } as unknown as Match;
    });

  saveLocalGameState(state);
  return {
    competition: { type: 'league', name: league.name, division: league.division, round },
    fixtures,
  };
}

export async function localTickLiveMatch(matchId: string, toMinute: number): Promise<Match> {
  const state = loadLocalGameState();
  const parts = matchId.split('_');
  const round = Number(parts[parts.length - 1]);
  const league = state.leagues.find((l) => l.fixtures.some((f) => `match_${f.homeClubId}_${f.awayClubId}_${f.round}` === matchId));
  const fix = league?.fixtures.find((f) => `match_${f.homeClubId}_${f.awayClubId}_${f.round}` === matchId);
  if (!league || !fix) throw new Error('Partida irmã não encontrada');

  const home = state.clubs.find((c) => c.id === fix.homeClubId);
  const away = state.clubs.find((c) => c.id === fix.awayClubId);
  if (!home || !away) throw new Error('Clubes não encontrados');

  if (!state.siblingLiveMatches) state.siblingLiveMatches = {};
  const seed = `${state.saveSeed || 'save'}_${fix.homeClubId}_${fix.awayClubId}_${fix.round}`;
  if (!state.siblingLiveMatches[matchId]) {
    state.siblingLiveMatches[matchId] = liveStateInicial(home, away, seed);
  }
  const live = state.siblingLiveMatches[matchId];

  if (live.currentMinute >= 90 && fix.result) {
    return {
      id: matchId,
      homeClubId: home.id,
      awayClubId: away.id,
      status: 'SIMULATED' as MatchStatus,
      result: fix.result,
    } as unknown as Match;
  }

  const acrescimos = calculateStoppageTime(live.events);
  if (live.period === 'HT' && Math.round(toMinute) > 45) live.period = '2T';

  const primeiroTempo = (live.period ?? '1T') === '1T';
  const teto = primeiroTempo ? 45 + acrescimos.half1 : MATCH_MINUTES + acrescimos.half2;
  const alvo = Math.max(live.currentMinute, Math.min(teto, Math.round(toMinute)));
  const inicio = primeiroTempo ? live.currentMinute + 1 : Math.max(46, live.currentMinute + 1);

  if (alvo > live.currentMinute) {
    const rng = resumableRngFromState(live.rngState);
    const trecho = simulateMatchSegment({
      home: { club: home, tactic: live.homeTactic },
      away: { club: away, tactic: live.awayTactic },
      rng: rng.next,
      startMinute: inicio,
      endMinute: alvo,
      priorEvents: live.events,
      homeGoals: live.homeGoals,
      awayGoals: live.awayGoals,
      homeShots: live.homeShots,
      awayShots: live.awayShots,
      homeShotsOnTarget: live.homeShotsOnTarget,
      awayShotsOnTarget: live.awayShotsOnTarget,
      homeCorners: live.homeCorners,
      awayCorners: live.awayCorners,
      homeFouls: live.homeFouls,
      awayFouls: live.awayFouls,
      weather: localWeatherOf(state, home, away?.id ?? ''),
    } as never);

    let allEvents = [...live.events, ...trecho.events];
    let lastSegment = trecho;

    if (toMinute >= 90 && primeiroTempo) {
      const stoppageH2 = calculateStoppageTime(allEvents).half2;
      const tetoFinal = MATCH_MINUTES + stoppageH2;
      const trecho2T = simulateMatchSegment({
        home: { club: home, tactic: trecho.homeTactic },
        away: { club: away, tactic: trecho.awayTactic },
        rng: rng.next,
        startMinute: 46,
        endMinute: tetoFinal,
        priorEvents: allEvents,
        homeGoals: trecho.homeGoals,
        awayGoals: trecho.awayGoals,
        homeShots: trecho.homeShots,
        awayShots: trecho.awayShots,
        homeShotsOnTarget: trecho.homeShotsOnTarget,
        awayShotsOnTarget: trecho.awayShotsOnTarget,
        homeCorners: trecho.homeCorners,
        awayCorners: trecho.awayCorners,
        homeFouls: trecho.homeFouls,
        awayFouls: trecho.awayFouls,
        weather: localWeatherOf(state, home, away?.id ?? ''),
      } as never);
      allEvents = [...allEvents, ...trecho2T.events];
      lastSegment = trecho2T;
      live.period = '2T';
    } else if (primeiroTempo && (trecho.stoppedAtMinute ?? alvo) >= 45 + acrescimos.half1) {
      live.period = 'HT';
    }

    const possession = derivePossession(
      lastSegment.homeStrength,
      lastSegment.awayStrength,
      lastSegment.homeTactic,
      lastSegment.awayTactic,
    );

    Object.assign(live, {
      currentMinute: toMinute >= 90 ? MATCH_MINUTES + calculateStoppageTime(allEvents).half2 : (lastSegment.stoppedAtMinute ?? alvo),
      rngState: rng.getState(),
      events: allEvents,
      homeGoals: lastSegment.homeGoals,
      awayGoals: lastSegment.awayGoals,
      homeShots: lastSegment.homeShots,
      awayShots: lastSegment.awayShots,
      homeShotsOnTarget: lastSegment.homeShotsOnTarget,
      awayShotsOnTarget: lastSegment.awayShotsOnTarget,
      homeCorners: lastSegment.homeCorners,
      awayCorners: lastSegment.awayCorners,
      homeFouls: lastSegment.homeFouls,
      awayFouls: lastSegment.awayFouls,
      homePossession: possession.home,
      awayPossession: possession.away,
      homeTactic: lastSegment.homeTactic,
      awayTactic: lastSegment.awayTactic,
    });
  }

  const stoppageFinal = calculateStoppageTime(live.events);
  const acabou = (live.period === '2T' && live.currentMinute >= MATCH_MINUTES + stoppageFinal.half2) || toMinute >= 90;
  if (acabou) {
    const matchStats = {
      home: { shots: live.homeShots, shotsOnTarget: live.homeShotsOnTarget, possession: live.homePossession, corners: live.homeCorners, fouls: live.homeFouls },
      away: { shots: live.awayShots, shotsOnTarget: live.awayShotsOnTarget, possession: live.awayPossession, corners: live.awayCorners, fouls: live.awayFouls },
    };
    fix.result = { homeGoals: live.homeGoals, awayGoals: live.awayGoals, scorers: [], assists: [], events: live.events, stats: matchStats } as never;
    delete state.siblingLiveMatches[matchId];
  }

  saveLocalGameState(state);
  return {
    id: matchId,
    homeClubId: home.id,
    awayClubId: away.id,
    status: (acabou ? 'SIMULATED' : 'LIVE') as MatchStatus,
    live: acabou ? undefined : live,
    result: acabou ? fix.result : undefined,
  } as unknown as Match;
}

/**
 * A side's strength, for a match nobody is going to watch.
 *
 * Read through the same `computeTeamStrength` the engine itself uses, off an auto-filled lineup, so a
 * background result is decided by the same squad quality that would decide a watched one.
 */
function localSideRating(club: Club) {
  const strength = computeTeamStrength(club, autoFillLineup(club));
  return { attack: strength.attack, defense: strength.defense, goalkeeping: strength.goalkeeping };
}

function finishLocalLeague(state: LocalGameState, league: League): void {
  if (league.status === 'FINISHED' || league.fixtures.some((fixture) => !fixture.result)) return;
  const results = league.fixtures.map((fixture) => ({
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    homeGoals: fixture.result!.homeGoals,
    awayGoals: fixture.result!.awayGoals,
  }));
  const championClubId = computeStandings(league.clubIds, results)[0]?.clubId ?? null;
  league.status = 'FINISHED';
  league.championClubId = championClubId;
  league.championOwnerId = state.clubs.find((club) => club.id === championClubId)?.ownerId ?? null;
}

/** The next round with anything left to play, across every league in the world. */
function localNextRound(state: LocalGameState): { league: League; round: number; date: string | null } | null {
  let best: { league: League; round: number; date: string | null } | null = null;

  for (const league of state.leagues) {
    const pending = league.fixtures.filter((f) => !f.result);
    if (pending.length === 0) continue;

    const round = Math.min(...pending.map((f) => f.round));
    const date = localLeagueRoundDates(league, state.currentSeason).get(round) ?? null;

    // Earliest date first, so the world plays in calendar order rather than in league order.
    if (!best || (date ?? '9999') < (best.date ?? '9999')) best = { league, round, date };
  }

  return best;
}

export async function localGetNextMatchday(): Promise<{
  kind: 'LEAGUE';
  competitionId: string;
  competitionName: string;
  round: number;
  date: string;
} | null> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  if (!claimed) return null;

  // The manager's own next fixture, which is the one the button is offering to take them to.
  const league = state.leagues.find((l) => l.clubIds.includes(claimed.id));
  if (!league) return null;
  const mine = league.fixtures.filter((f) => !f.result && (f.homeClubId === claimed.id || f.awayClubId === claimed.id));
  if (mine.length === 0) return null;

  const round = Math.min(...mine.map((f) => f.round));
  const date = localLeagueRoundDates(league, state.currentSeason).get(round);

  return {
    kind: 'LEAGUE',
    competitionId: league.id,
    competitionName: league.name,
    round,
    date: date ?? `${state.currentSeason}-04-05`,
  };
}

/**
 * Atualização semanal do mundo offline:
 * - Avança a data do relógio (se fornecida).
 * - Decrementa semanas de obras no estádio; ao zerar, conclui a etapa / tier, atualiza capacidade e gera notícia.
 * - Cobra manutenção semanal de estádio.
 * - Decrementa semanas restantes de patrocínios ativos.
 */
export function processLocalWeeklyTick(state: LocalGameState, currentDateStr?: string): void {
  if (currentDateStr) {
    const [year, month, day] = currentDateStr.split('-').map(Number);
    state.gameDate = { year, month, day };
  }

  const todayStr = currentDateStr ?? `${state.gameDate.year}-${String(state.gameDate.month).padStart(2, '0')}-${String(state.gameDate.day).padStart(2, '0')}`;

  for (const club of state.clubs) {
    if (club.stadiumConstruction) {
      club.stadiumConstruction.weeksRemaining -= 1;
      if (club.stadiumConstruction.weeksRemaining <= 0) {
        const construction = club.stadiumConstruction;
        const targetCap = construction.targetCapacity;
        const targetStep = construction.targetStep;
        const targetLevel = construction.targetLevel;

        if (targetCap) {
          club.stadiumCapacity = targetCap;
        }

        if (targetStep !== undefined) {
          club.stadiumStep = targetStep;
          if (targetStep >= 4) {
            const nextTier = targetLevel;
            club.stadiumTier = nextTier;
            club.stadiumLevel = nextTier;
            club.stadiumStep = 0;
          }
        } else {
          const finished = getStadiumTierInfo(targetLevel);
          if (finished) {
            club.stadiumLevel = finished.tier;
            club.stadiumTier = finished.tier;
            club.stadiumCapacity = finished.capacity;
          }
        }

        const stepDesc = construction.stepName ? `a etapa "${construction.stepName}"` : 'a reforma do estádio';
        state.news.push({
          id: `stadium_finish_${club.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          clubId: club.id,
          category: 'TITLE' as any,
          headline: `🏟️ Obra Concluída! O estádio concluiu ${stepDesc}. A nova capacidade oficial é de ${club.stadiumCapacity.toLocaleString('pt-BR')} lugares!`,
          createdAt: todayStr,
        });

        club.stadiumConstruction = null;
        club.stadiumUpgradeWeek = null;
      } else {
        club.stadiumUpgradeWeek = club.stadiumConstruction.weeksRemaining;
      }
    }

    const currentTier = club.stadiumTier ?? club.stadiumLevel ?? 1;
    const tierInfo = getStadiumTierInfo(currentTier);
    const maintenance = tierInfo?.weeklyMaintenance ?? 5_000;
    club.budget = Math.max(0, club.budget - maintenance);

    if (club.sponsorships && club.sponsorships.length > 0) {
      for (const sp of club.sponsorships) {
        if (typeof (sp as any).weeksRemaining === 'number' && (sp as any).weeksRemaining > 0) {
          (sp as any).weeksRemaining -= 1;
        }
      }
    }
  }
}

/**
 * A matchday, for the whole world rather than for one club.
 *
 * What this replaced never worked at all: it handed the away side the *home* side's tactic, lineup ids
 * included, so `simulateMatch` threw on the first fixture and the loop died with nothing played. Measured
 * before the rewrite: zero fixtures resolved, every time. That is why the table never moved and the
 * championship could not be read.
 *
 * Matches nobody watches are resolved by `simulateBackgroundResult`, the same rule the server uses for
 * exactly this: same engine calibration, decided from squad ratings, without opening a roster or building
 * a minute-by-minute timeline for a game nobody will read. The manager's own fixture is left unplayed on
 * purpose, because that is the one they are about to go and watch.
 */
export async function localAdvanceMatchday(): Promise<{
  date: string;
  seasonYear: number;
  played: { kind: 'LEAGUE'; competitionId: string; competitionName: string; round: number; date: string }[];
  sackedFromClubId: null,
    matchId: string | null;
}> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  const next = localNextRound(state);

  const today = next?.date ?? `${state.currentSeason}-04-05`;
  if (!next) return { date: today, seasonYear: state.currentSeason, played: [], sackedFromClubId: null,
    matchId: null };

  const { rounds, matchId } = resolveFixturesOn(state, today, claimed?.id ?? null);
  processLocalWeeklyTick(state, today);

  saveLocalGameState(state);
  /**
   * Offline ninguém é demitido, porque offline não há semana.
   *
   * A confiança da diretoria se move no tick semanal, e o motor local não tem tick. Devolver `null` é a
   * resposta honesta: não é que não houve demissão, é que o relógio que a produziria não corre aqui.
   */
  return { date: today, seasonYear: state.currentSeason, played: rounds, matchId, sackedFromClubId: null };
}

/**
 * Fast multi-week/matchday advance directly to the manager's next active match.
 * Resolves intermediate fixture dates, recovers stamina, and pauses if an urgent event occurs.
 */
export async function localFastAdvanceToNextMatch(clubId?: string): Promise<FastAdvanceResult> {
  const initialState = loadLocalGameState();
  const claimed = clubId
    ? initialState.clubs.find((c) => c.id === clubId) ?? initialState.clubs.find((c) => c.ownerId === LOCAL_USER_ID)
    : initialState.clubs.find((c) => c.ownerId === LOCAL_USER_ID);

  const initialDate = `${initialState.gameDate.year}-${String(initialState.gameDate.month).padStart(2, '0')}-${String(initialState.gameDate.day).padStart(2, '0')}`;
  let stepsAdvanced = 0;
  let lastOutcome: { matchId: string | null; date: string } | null = null;
  const eventsSummary: string[] = [];
  let interruptionReason: FastAdvanceResult['interruptionReason'];

  const MAX_STEPS = 8;

  for (let i = 0; i < MAX_STEPS; i++) {
    const currentState = loadLocalGameState();
    const currentClub = claimed ? currentState.clubs.find((c) => c.id === claimed.id) : null;

    if (currentClub) {
      const check = evaluateFastAdvanceInterruption({
        players: currentClub.players.map((p) => ({
          id: p.id,
          name: p.name,
          stamina: Math.max(0, 100 - p.fatigue),
          isInjured: (p.injuryWeeks ?? 0) > 0,
          isSuspended: (p.suspensions?.length ?? 0) > 0,
          star_level: p.starLevel === 'NATURAL' ? 5 : p.starLevel === 'DEVELOPED' ? 4 : 3,
        })),
        pendingOffersCount: currentState.proposals?.filter((p) => p.status === 'PENDING' && p.sellerClubId === currentClub.id).length ?? 0,
      });

      if (check.interrupted && stepsAdvanced > 0) {
        interruptionReason = check.reason;
        break;
      }
    }

    const outcome = await localAdvanceMatchday();
    stepsAdvanced++;
    lastOutcome = outcome;

    if (currentClub) {
      const updatedState = loadLocalGameState();
      const clubToHeal = updatedState.clubs.find((c) => c.id === currentClub.id);
      if (clubToHeal) {
        for (const p of clubToHeal.players) {
          if ((p.injuryWeeks ?? 0) === 0) {
            p.fatigue = Math.max(0, p.fatigue - 10);
          } else {
            p.injuryWeeks = Math.max(0, p.injuryWeeks - 1);
          }
        }
        saveLocalGameState(updatedState);
      }
    }



    if (outcome.matchId) {
      break;
    }
  }

  const finalState = loadLocalGameState();
  const finalDate = `${finalState.gameDate.year}-${String(finalState.gameDate.month).padStart(2, '0')}-${String(finalState.gameDate.day).padStart(2, '0')}`;

  let nextMatch: FastAdvanceResult['nextMatch'] = null;
  if (claimed && lastOutcome?.matchId) {
    const league = finalState.leagues.find((l) => l.clubIds.includes(claimed.id));
    const nextFixture = league?.fixtures.find(
      (f) => !f.result && (f.homeClubId === claimed.id || f.awayClubId === claimed.id),
    );
    if (nextFixture) {
      const isHome = nextFixture.homeClubId === claimed.id;
      const opponentId = isHome ? nextFixture.awayClubId : nextFixture.homeClubId;
      const opponent = finalState.clubs.find((c) => c.id === opponentId);
      nextMatch = {
        matchId: lastOutcome.matchId,
        opponentId,
        opponentName: opponent?.name ?? 'Adversário',
        isHome,
        competitionName: league?.name ?? 'Campeonato',
        round: nextFixture.round,
        date: finalDate,
      };
    }
  }

  eventsSummary.push(`Elenco recuperou fôlego ao longo de ${stepsAdvanced} rodada(s)`);

  return {
    stepsAdvanced,
    initialDate,
    finalDate,
    nextMatch,
    eventsSummary,
    interrupted: Boolean(interruptionReason),
    interruptionReason,
    staminaRecovered: true,
  };
}


function getContinentalRoundDates(seasonYear: number): Map<number, string> {
  const map = new Map<number, string>();
  map.set(1, `${seasonYear}-04-09`);
  map.set(2, `${seasonYear}-04-23`);
  map.set(3, `${seasonYear}-05-07`);
  map.set(4, `${seasonYear}-05-21`);
  map.set(5, `${seasonYear}-06-04`);
  map.set(6, `${seasonYear}-06-18`);
  map.set(7, `${seasonYear}-07-09`);
  map.set(8, `${seasonYear}-07-23`);
  map.set(9, `${seasonYear}-08-13`);
  map.set(10, `${seasonYear}-08-27`);
  map.set(11, `${seasonYear}-09-17`);
  map.set(12, `${seasonYear}-10-01`);
  map.set(13, `${seasonYear}-10-29`);
  return map;
}

function resolveContinentalFixturesOn(
  state: LocalGameState,
  today: string,
  claimedClubId: string | null,
): { matchId: string | null } {
  state.continentalCompetitions ??= [];
  let matchId: string | null = null;
  const dates = getContinentalRoundDates(state.currentSeason);
  const currentRound = [...dates.entries()].find(([, date]) => date === today)?.[0];
  if (currentRound === undefined) return { matchId };

  for (const comp of state.continentalCompetitions) {
    if (comp.status === 'FINISHED') continue;

    if (comp.currentStage === 'GROUP_STAGE') {
      let allGroupFixturesFinished = true;
      for (const group of comp.groups) {
        const roundFixtures = group.fixtures.filter((f) => f.round === currentRound);
        for (const fixture of roundFixtures) {
          if (!fixture.matchId) {
            fixture.matchId = `cont_${comp.id}_g${group.letter}_r${currentRound}_${fixture.homeClubId}_${fixture.awayClubId}`;
          }
          if (fixture.winnerClubId !== null) continue;

          const home = state.clubs.find((c) => c.id === fixture.homeClubId);
          const away = state.clubs.find((c) => c.id === fixture.awayClubId);
          if (!home || !away) continue;

          if (claimedClubId && (fixture.homeClubId === claimedClubId || fixture.awayClubId === claimedClubId)) {
            matchId = fixture.matchId;
            allGroupFixturesFinished = false;
            continue;
          }

          try {
            const result = simulateBackgroundResult(
              localSideRating(home),
              localSideRating(away),
              `${state.saveSeed || 'save'}-${comp.id}-${currentRound}-${fixture.homeClubId}`,
            );

            const homeEvents = generateBackgroundScorersAndAssists(
              home,
              result.homeGoals,
              `${state.saveSeed || 'save'}-${comp.id}-${currentRound}-${fixture.homeClubId}-h`,
            );
            const awayEvents = generateBackgroundScorersAndAssists(
              away,
              result.awayGoals,
              `${state.saveSeed || 'save'}-${comp.id}-${currentRound}-${fixture.awayClubId}-a`,
            );

            home.players = applyBackgroundResultToPlayers(
              home.players,
              homeEvents.scorers,
              homeEvents.assists,
              homeEvents.lineupPlayerIds,
            );
            away.players = applyBackgroundResultToPlayers(
              away.players,
              awayEvents.scorers,
              awayEvents.assists,
              awayEvents.lineupPlayerIds,
            );

            const stats = {
              home: { shots: Math.max(result.homeGoals, 8), shotsOnTarget: Math.max(result.homeGoals, 4), possession: 50, corners: 4, fouls: 10, xg: Number((result.homeGoals * 0.85).toFixed(2)) },
              away: { shots: Math.max(result.awayGoals, 8), shotsOnTarget: Math.max(result.awayGoals, 4), possession: 50, corners: 4, fouls: 10, xg: Number((result.awayGoals * 0.85).toFixed(2)) },
            };
            (fixture as any).result = {
              homeGoals: result.homeGoals,
              awayGoals: result.awayGoals,
              scorers: [...homeEvents.scorers, ...awayEvents.scorers],
              assists: [...homeEvents.assists, ...awayEvents.assists],
              events: [],
              stats,
            };
            fixture.winnerClubId = result.homeGoals > result.awayGoals ? fixture.homeClubId : result.awayGoals > result.homeGoals ? fixture.awayClubId : 'DRAW';
          } catch {
            fixture.winnerClubId = 'DRAW';
          }
        }

        const matchScores: Record<string, { homeGoals: number; awayGoals: number }> = {};
        group.fixtures.forEach((f) => {
          const res = (f as any).result;
          if (f.matchId && res) {
            matchScores[f.matchId] = { homeGoals: res.homeGoals, awayGoals: res.awayGoals };
          }
        });
        group.standings = calculateGroupStandings(group.clubIds, group.fixtures, matchScores);

        if (group.fixtures.some((f) => !f.winnerClubId)) {
          allGroupFixturesFinished = false;
        }
      }

      if (currentRound === 6 && allGroupFixturesFinished) {
        comp.currentStage = 'ROUND_OF_16';
        comp.knockoutFixtures = generateRoundOf16FromGroups(comp.groups, 7, true);

        for (const group of comp.groups) {
          for (const row of group.standings) {
            const club = state.clubs.find((c) => c.id === row.clubId);
            if (club) {
              club.budget = (club.budget ?? 0) + 3_000_000;
            }
          }
        }
      }
    } else {
      const roundFixtures = comp.knockoutFixtures.filter((f) => f.round === currentRound && !f.winnerClubId);
      for (const fixture of roundFixtures) {
        if (!fixture.matchId) {
          fixture.matchId = `cont_${comp.id}_ko_r${currentRound}_${fixture.homeClubId}_${fixture.awayClubId}`;
        }
        const home = state.clubs.find((c) => c.id === fixture.homeClubId);
        const away = state.clubs.find((c) => c.id === fixture.awayClubId);
        if (!home || !away) continue;

        if (claimedClubId && (fixture.homeClubId === claimedClubId || fixture.awayClubId === claimedClubId)) {
          matchId = fixture.matchId;
          continue;
        }

        try {
          const result = simulateBackgroundResult(
            localSideRating(home),
            localSideRating(away),
            `${state.saveSeed || 'save'}-${comp.id}-${currentRound}-${fixture.homeClubId}`,
          );

          const homeEvents = generateBackgroundScorersAndAssists(
            home,
            result.homeGoals,
            `${state.saveSeed || 'save'}-${comp.id}-${currentRound}-${fixture.homeClubId}-ko-h`,
          );
          const awayEvents = generateBackgroundScorersAndAssists(
            away,
            result.awayGoals,
            `${state.saveSeed || 'save'}-${comp.id}-${currentRound}-${fixture.awayClubId}-ko-a`,
          );

          home.players = applyBackgroundResultToPlayers(
            home.players,
            homeEvents.scorers,
            homeEvents.assists,
            homeEvents.lineupPlayerIds,
          );
          away.players = applyBackgroundResultToPlayers(
            away.players,
            awayEvents.scorers,
            awayEvents.assists,
            awayEvents.lineupPlayerIds,
          );

          (fixture as any).result = {
            homeGoals: result.homeGoals,
            awayGoals: result.awayGoals,
            scorers: [...homeEvents.scorers, ...awayEvents.scorers],
            assists: [...homeEvents.assists, ...awayEvents.assists],
            events: [],
            stats: { home: { shots: 10, shotsOnTarget: 5, possession: 50, corners: 5, fouls: 10, xg: 1 }, away: { shots: 10, shotsOnTarget: 5, possession: 50, corners: 5, fouls: 10, xg: 1 } },
          };
          fixture.winnerClubId = result.homeGoals > result.awayGoals ? fixture.homeClubId : result.awayGoals > result.homeGoals ? fixture.awayClubId : fixture.homeClubId;
        } catch {
          fixture.winnerClubId = fixture.homeClubId;
        }
      }

      if (currentRound === 13) {
        const finalFix = comp.knockoutFixtures.find((f) => f.round === 13);
        if (finalFix && finalFix.winnerClubId && !comp.championClubId) {
          comp.status = 'FINISHED';
          comp.championClubId = finalFix.winnerClubId;
          const champ = state.clubs.find((c) => c.id === finalFix.winnerClubId);
          if (champ) {
            champ.budget = (champ.budget ?? 0) + 20_000_000;
            champ.titlesWon = (champ.titlesWon ?? 0) + 1;
            champ.trophies ??= [];
            champ.trophies.push({
              id: `trophy_${comp.type}_${comp.season}`,
              competitionType: comp.type as any,
              competitionName: comp.name,
              seasonYear: comp.season,
              clubId: champ.id,
              clubName: champ.name,
              managerName: 'Técnico Local',
              trophyIcon: '🏆',
              date: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  return { matchId };
}


function checkAndResolveFifaWindow(state: LocalGameState, today: string, claimedClubId: string | null): void {
  const fifaDates: Record<string, { week: number; label: string }> = {
    [`${state.currentSeason}-03-25`]: { week: 11, label: 'Data FIFA — Março' },
    [`${state.currentSeason}-06-10`]: { week: 23, label: 'Data FIFA — Junho' },
    [`${state.currentSeason}-09-09`]: { week: 36, label: 'Data FIFA — Setembro' },
    [`${state.currentSeason}-10-14`]: { week: 41, label: 'Data FIFA — Outubro' },
    [`${state.currentSeason}-11-18`]: { week: 46, label: 'Data FIFA — Novembro' },
  };

  const windowInfo = fifaDates[today];
  if (!windowInfo) return;

  state.processedFifaWindows ??= [];
  const windowKey = `${state.currentSeason}-${windowInfo.week}`;
  if (state.processedFifaWindows.includes(windowKey)) return;
  state.processedFifaWindows.push(windowKey);

  const claimedClub = claimedClubId ? state.clubs.find(c => c.id === claimedClubId) : null;
  const allPlayers = state.clubs.flatMap(c => (c.players ?? []).map(p => ({ ...p, clubId: c.id, clubName: c.name })));

  for (const nation of NATIONAL_TEAMS) {
    state.nationalTeams ??= {};
    let squadState = state.nationalTeams[nation.id];
    if (!squadState) {
      squadState = autoSelectNationalSquad(nation.id, allPlayers);
      state.nationalTeams[nation.id] = squadState;
    }

    for (const entry of squadState.squad) {
      const club = state.clubs.find(c => c.id === entry.clubId);
      const player = club?.players.find(p => p.id === entry.playerId);

      if (claimedClub && entry.clubId === claimedClub.id && player) {
        const pad = (v: number) => String(v).padStart(2, '0');
        const createdAt = `${state.currentSeason}-${pad(state.gameDate.month)}-${pad(state.gameDate.day)}T00:00:00.000Z`;

        // Convocação News
        state.news.push({
          id: `fifa_${windowKey}_${entry.playerId}`,
          clubId: claimedClub.id,
          category: 'NATIONAL_TEAM',
          headline: `Convocação da Seleção: ${entry.playerName} foi convocado para defender a Seleção de ${nation.name} (${windowInfo.label})!`,
          createdAt,
        });

        // 1. Programa FIFA de Benefícios (Release Compensation)
        const compensation = calculateFifaReleaseCompensation(player, 10);
        claimedClub.budget += compensation;
        state.news.push({
          id: `fifa_comp_${windowKey}_${player.id}`,
          clubId: claimedClub.id,
          category: 'NATIONAL_TEAM',
          headline: `Programa FIFA de Benefícios: O clube recebeu R$ ${compensation.toLocaleString('pt-BR')} pela liberação de ${player.name} para a Seleção ${nation.name}.`,
          createdAt,
        });

        // 2. Proteção FIFA contra Lesões (3% a 5% de chance)
        if (Math.random() < 0.04 && (!player.injuryWeeks || player.injuryWeeks === 0)) {
          const injuryWeeks = Math.floor(Math.random() * 6) + 2; // 2 a 8 semanas
          player.injuryWeeks = injuryWeeks;
          const indemnity = calculateFifaInjuryIndemnity(player, injuryWeeks);
          claimedClub.budget += indemnity;

          state.news.push({
            id: `fifa_injury_${windowKey}_${player.id}`,
            clubId: claimedClub.id,
            category: 'INJURY',
            headline: `Alerta FIFA / DM: ${player.name} sofreu uma lesão defendendo a Seleção ${nation.name} e desfalcará o time por ${injuryWeeks} semanas. A FIFA pagou uma indenização de R$ ${indemnity.toLocaleString('pt-BR')} para cobrir os custos médicos e salariais.`,
            createdAt,
          });
        }
      }

      if (player) {
        player.fatigue = Math.min(100, (player.fatigue || 0) + 12);
      }
    }
  }
}

/**
 * Plays everything scheduled for one date, in every country, except the manager's own fixture.
 *
 * Shared by the two ways a matchday can start, which is the whole point of pulling it out: advancing the
 * clock called this, and opening the manager's own match did not. So on a phone the manager played their
 * game, the other seven of the round stayed unplayed, and the table never moved — exactly the symptom
 * reported. The tests missed it because they called the advance directly and never went through the match
 * screen, which is the path a player actually takes.
 */
function resolveFixturesOn(
  state: LocalGameState,
  today: string,
  claimedClubId: string | null,
): { rounds: { kind: 'LEAGUE'; competitionId: string; competitionName: string; round: number; date: string }[]; matchId: string | null } {
  const rounds: { kind: 'LEAGUE'; competitionId: string; competitionName: string; round: number; date: string }[] = [];
  let matchId: string | null = null;

  checkAndResolveFifaWindow(state, today, claimedClubId);

  const contRes = resolveContinentalFixturesOn(state, today, claimedClubId);
  if (contRes.matchId && !matchId) {
    matchId = contRes.matchId;
  }

  for (const league of state.leagues) {
    const dates = localLeagueRoundDates(league, state.currentSeason);
    const round = [...dates.entries()].find(([, date]) => date === today)?.[0];
    if (round === undefined) continue;

    const fixtures = league.fixtures.filter((f) => f.round === round && !f.result);
    if (fixtures.length === 0) continue;

    for (const fixture of fixtures) {
      const home = state.clubs.find((c) => c.id === fixture.homeClubId);
      const away = state.clubs.find((c) => c.id === fixture.awayClubId);
      if (!home || !away) continue;

      // The manager's own match is theirs to play, so it is left standing for the match screen.
      if (claimedClubId && (fixture.homeClubId === claimedClubId || fixture.awayClubId === claimedClubId)) {
        matchId = `match_${fixture.homeClubId}_${fixture.awayClubId}_${fixture.round}`;
        continue;
      }

      try {
        const result = simulateBackgroundResult(
          localSideRating(home),
          localSideRating(away),
          `${state.saveSeed || 'save'}-${league.id}-${fixture.round}-${fixture.homeClubId}`,
        );

        const homeEvents = generateBackgroundScorersAndAssists(
          home,
          result.homeGoals,
          `${state.saveSeed || 'save'}-${league.id}-${fixture.round}-${fixture.homeClubId}-h`,
        );
        const awayEvents = generateBackgroundScorersAndAssists(
          away,
          result.awayGoals,
          `${state.saveSeed || 'save'}-${league.id}-${fixture.round}-${fixture.awayClubId}-a`,
        );

        home.players = applyBackgroundResultToPlayers(
          home.players,
          homeEvents.scorers,
          homeEvents.assists,
          homeEvents.lineupPlayerIds,
        );
        away.players = applyBackgroundResultToPlayers(
          away.players,
          awayEvents.scorers,
          awayEvents.assists,
          awayEvents.lineupPlayerIds,
        );

        const stats = {
          home: { shots: Math.max(result.homeGoals, 8), shotsOnTarget: Math.max(result.homeGoals, 4), possession: 50, corners: 4, fouls: 10, xg: Number((result.homeGoals * 0.85).toFixed(2)) },
          away: { shots: Math.max(result.awayGoals, 8), shotsOnTarget: Math.max(result.awayGoals, 4), possession: 50, corners: 4, fouls: 10, xg: Number((result.awayGoals * 0.85).toFixed(2)) },
        };
        fixture.result = {
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals,
          scorers: [...homeEvents.scorers, ...awayEvents.scorers],
          assists: [...homeEvents.assists, ...awayEvents.assists],
          events: [],
          stats,
        } as never;
      } catch {
        /**
         * A squad too broken to field an eleven cannot decide a match, and must not stop the rest of the
         * round either. Before this the first such fixture took the whole matchday down with it.
         */
        const stats = {
          home: { shots: 0, shotsOnTarget: 0, possession: 50, corners: 0, fouls: 0, xg: 0 },
          away: { shots: 0, shotsOnTarget: 0, possession: 50, corners: 0, fouls: 0, xg: 0 },
        };
        fixture.result = { homeGoals: 0, awayGoals: 0, scorers: [], assists: [], events: [], stats } as never;
      }
    }

    finishLocalLeague(state, league);

    rounds.push({ kind: 'LEAGUE', competitionId: league.id, competitionName: league.name, round, date: today });
  }

  return { rounds, matchId };
}

export async function localGetClubCalendar(clubId: string): Promise<{
  clubId: string;
  seasonYear: number;
  entries: LocalCalendarEntry[];
}> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  const league = club ? state.leagues.find((l) => l.clubIds.includes(clubId)) : null;
  if (!club || !league) return { clubId, seasonYear: state.currentSeason, entries: [] };

  const dates = localLeagueRoundDates(league, state.currentSeason);

  const entries = league.fixtures
    .filter((f) => f.homeClubId === clubId || f.awayClubId === clubId)
    .map((f) => {
      const isHome = f.homeClubId === clubId;
      const opponent = state.clubs.find((c) => c.id === (isHome ? f.awayClubId : f.homeClubId));

      const goalsFor = isHome ? f.result?.homeGoals : f.result?.awayGoals;
      const goalsAgainst = isHome ? f.result?.awayGoals : f.result?.homeGoals;

      return {
        date: dates.get(f.round) ?? null,
        competitionId: league.id,
        competitionName: league.name,
        kind: 'LEAGUE' as const,
        round: f.round,
        opponentClubId: opponent?.id ?? '',
        opponentName: opponent?.name ?? 'Oponente',
        opponentSlug: opponent?.slug ?? null,
        opponentCrestBase64: (opponent as any)?.crestBase64 ?? null,
        opponentPrimaryColor: (opponent as any)?.primaryColor ?? null,
        opponentSecondaryColor: (opponent as any)?.secondaryColor ?? null,
        isHome,
        matchId: f.matchId ?? null,
        ...(f.result && goalsFor !== undefined && goalsAgainst !== undefined
          ? {
              result: {
                goalsFor,
                goalsAgainst,
                outcome: (goalsFor > goalsAgainst ? 'V' : goalsFor === goalsAgainst ? 'E' : 'D') as 'V' | 'E' | 'D',
              },
            }
          : {}),
      };
    })
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));

  return { clubId, seasonYear: state.currentSeason, entries };
}

/**
 * Squad and tactics operations, offline.
 *
 * Rebuilt after a careless edit removed them: each one mirrors the endpoint it stands in for, and follows
 * the same shape as every sibling here — load the state, change the one thing, persist, hand the club back,
 * because every caller does `setClub(...)` with what comes out.
 */
export async function localTrainPlayer(clubId: string, playerId: string, focus: string | null): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  const player = club.players.find((p) => p.id === playerId);
  // Offline has no development tick, so training records the focus and leaves the growth to the server.
  if (player) player.trainingFocus = (focus as Player['trainingFocus']) ?? null;
  saveLocalGameState(state);
  return club;
}

export async function localSetCaptain(clubId: string, playerId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  // An empty id is how the client spells "nobody wears it", since the route takes null.
  club.captainPlayerId = playerId || null;
  club.captainWeeksServed = 0;
  saveLocalGameState(state);
  return club;
}

export async function localSetTutor(clubId: string, playerId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  club.tutorPlayerId = playerId || null;
  saveLocalGameState(state);
  return club;
}

export async function localSetPlayerRole(
  clubId: string,
  playerId: string,
  role: PlayerRole,
  assign: boolean,
): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');

  // The club field each role lives in, so this cannot drift from the server's own mapping.
  const field = PLAYER_ROLE_CLUB_FIELD[role];
  club[field] = assign ? playerId : null;
  if (field === 'captainPlayerId') club.captainWeeksServed = 0;

  saveLocalGameState(state);
  return club;
}

export async function localSetPlayerFunctions(
  clubId: string,
  playerId: string,
  functions: PlayerFunction[],
): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  const player = club.players.find((p) => p.id === playerId);
  if (player) player.functions = functions.slice(0, MAX_PLAYER_FUNCTIONS);
  saveLocalGameState(state);
  return club;
}

/** Offline keeps no saved tactics of its own: the standing lineup is `pendingRoundTactic` on the club. */
export async function localListTacticPresets(_clubId: string): Promise<TacticPreset[]> {
  return [];
}

/** Nobody negotiates with an offline world, so there is never an offer waiting. */
export async function localListTransferProposals(_clubId: string): Promise<TransferProposal[]> {
  return [];
}

export async function localCreateTransferProposal(params: {
  buyerClubId: string;
  sellerClubId: string;
  targetPlayerId: string;
  cashAmount: number;
  installments: number;
  offeredPlayerIds: string[];
  hasBankGuarantee?: boolean;
}): Promise<TransferProposal> {
  const state = loadLocalGameState();
  const buyer = state.clubs.find((c) => c.id === params.buyerClubId);
  let seller = state.clubs.find((c) => c.id === params.sellerClubId);
  if (!seller) seller = ensureClubInGameState(state, params.sellerClubId);
  if (!buyer || !seller) throw new Error('Clube não encontrado');
  const targetPlayer = seller.players.find((p) => p.id === params.targetPlayerId);
  if (!targetPlayer) throw new Error('Jogador não encontrado no clube vendedor');

  const offeredPlayers = buyer.players.filter((p) => params.offeredPlayerIds.includes(p.id));
  const evalResult = evaluateTransferProposal({
    buyerClub: buyer,
    sellerClub: seller,
    targetPlayer,
    cashAmount: params.cashAmount,
    installments: params.installments,
    offeredPlayers,
    hasBankGuarantee: params.hasBankGuarantee,
  });

  const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const proposal: TransferProposal = {
    id: proposalId,
    buyerClubId: buyer.id,
    buyerClubName: buyer.name,
    sellerClubId: seller.id,
    sellerClubName: seller.name,
    targetPlayerId: targetPlayer.id,
    targetPlayerName: targetPlayer.name,
    cashAmount: params.cashAmount,
    installments: params.installments,
    offeredPlayerIds: params.offeredPlayerIds,
    hasBankGuarantee: params.hasBankGuarantee ?? false,
    status: evalResult.accepted ? 'ACCEPTED' : 'REJECTED',
    responseMessage: evalResult.reason,
    createdAt: new Date().toISOString(),
  };

  if (evalResult.accepted) {
    buyer.budget -= params.cashAmount;
    seller.budget += params.cashAmount;
    seller.players = seller.players.filter((p) => p.id !== targetPlayer.id);
    buyer.players.push(targetPlayer);
    for (const off of offeredPlayers) {
      buyer.players = buyer.players.filter((p) => p.id !== off.id);
      seller.players.push(off);
    }
  }

  saveLocalGameState(state);
  return proposal;
}

export async function localSaveTacticPreset(_clubId: string, _preset: any): Promise<any> {
  return { id: `preset_${Date.now()}`, name: 'Tática Padrão', isDefault: true };
}

export async function localDeleteTacticPreset(_clubId: string, _presetId: string): Promise<void> {}

export async function localSetDefaultTacticPreset(_clubId: string, _presetId: string): Promise<any> {
  return { id: _presetId, name: 'Tática Padrão', isDefault: true };
}

export async function localSetRoundTactic(clubId: string, tactic: Tactic): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  club.pendingRoundTactic = tactic;
  saveLocalGameState(state);
  return club;
}

export async function localClearRoundTactic(clubId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  club.pendingRoundTactic = null;
  saveLocalGameState(state);
  return club;
}

export async function localPromoteAcademyPlayer(clubId: string, playerId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  const idx = club.academyPlayers.findIndex((p) => p.id === playerId);
  if (idx !== -1) {
    const [promoted] = club.academyPlayers.splice(idx, 1);
    club.players.push(promoted);
  }
  saveLocalGameState(state);
  return club;
}

export async function localListContinentalTournaments(): Promise<ContinentalTournamentState[]> {
  const state = loadLocalGameState();
  return state.continentalCompetitions ?? [];
}

export async function localGetContinentalTournament(id: string): Promise<ContinentalTournamentState | null> {
  const state = loadLocalGameState();
  return state.continentalCompetitions?.find((c) => c.id === id) ?? null;
}


export async function localReleaseAcademyPlayer(clubId: string, playerId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  const idx = club.academyPlayers.findIndex((p) => p.id === playerId);
  if (idx !== -1) club.academyPlayers.splice(idx, 1);
  saveLocalGameState(state);
  return club;
}

export async function localTrainAcademyPlayer(clubId: string, playerId: string, focus: string | null): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  const player = club.academyPlayers.find((p) => p.id === playerId);
  if (player) {
    const currentCycle = state.gameDate ? `${state.gameDate.year}-${state.gameDate.month}-${state.gameDate.day}` : 'cycle_1';
    if ((player as any).lastTrainedCycle === currentCycle) {
      throw new Error(`O jovem ${player.name} já realizou os treinos deste período. Avance para a próxima rodada!`);
    }
    (player as any).lastTrainedCycle = currentCycle;
    player.trainingFocus = (focus as any) ?? null;
    const staff = club.staff || [];
    const coordinator = staff.find((s) => s.role === 'YOUTH_COORDINATOR');
    const fitnessCoach = staff.find((s) => s.role === 'FITNESS_COACH');
    const youthBoost = getYouthDevelopmentBoost(coordinator);
    const fitnessBoost = getFitnessTrainingBoost(fitnessCoach);
    const updated = executePlayerTrainingSession(player, (focus as any) || 'BALANCED', fitnessBoost, youthBoost);
    Object.assign(player, updated);
  }
  saveLocalGameState(state);
  return club;
}

const GLOBAL_SCOUTING_MAJOR_COUNTRIES = [
  'BRA', 'ENG', 'ESP', 'ITA', 'GER', 'FRA', 'POR', 'ARG', 'URU', 'NED', 'TUR', 'KSA', 'USA', 'BEL', 'SCO',
];

const scoutingClubsCache = new Map<string, Array<{ id: string; name: string; country: string; slug: string | null; players: Player[]; stadiumCapacity: number; titlesWon: number }>>();

export function ensureClubInGameState(state: LocalGameState, clubId: string): Club | undefined {
  let club = state.clubs.find((c) => c.id === clubId || c.slug === clubId);
  if (club) return club;

  for (const list of scoutingClubsCache.values()) {
    const found = list.find((c) => c.id === clubId || c.slug === clubId);
    if (found) {
      club = {
        id: found.id,
        name: found.name,
        slug: found.slug,
        ownerId: BOT_OWNER_ID,
        country: found.country,
        players: [...found.players],
        academyPlayers: [],
        budget: 25_000_000,
        captainPlayerId: found.players[0]?.id ?? null,
        captainWeeksServed: 0,
        tutorPlayerId: null,
        penaltyTakerId: null,
        freeKickTakerId: null,
        cornerLeftTakerId: null,
        cornerRightTakerId: null,
        sponsorships: [],
        stadiumLevel: 3,
        stadiumCapacity: found.stadiumCapacity,
        stadiumConstruction: null,
        titlesWon: found.titlesWon,
        championshipCount: 0,
        copaCount: 0,
        supercopaCount: 0,
        libertadoresCount: 0,
        recopaCount: 0,
        mundialCount: 0,
        division2Count: 0,
        boardConfidence: 75,
        boardSeasonGoal: null,
        boardHistory: [],
        managerStyle: null,
        trophyCabinet: [],
      } as unknown as Club;
      state.clubs.push(club);
      return club;
    }
  }
  return undefined;
}

export async function localListScoutingDatabase(country?: string): Promise<Array<{ id: string; name: string; country: string; slug: string | null; players: Player[]; stadiumCapacity: number; titlesWon: number }>> {
  const state = loadLocalGameState();
  if (!offlineContent) {
    offlineContent = await loadOfflineContent();
  }

  const isGlobal = !country || country === 'GLOBAL';
  const targetCountries = isGlobal ? GLOBAL_SCOUTING_MAJOR_COUNTRIES : [country];

  const results: Array<{ id: string; name: string; country: string; slug: string | null; players: Player[]; stadiumCapacity: number; titlesWon: number }> = [];

  for (const cCode of targetCountries) {
    let countryClubs = scoutingClubsCache.get(cCode);
    if (!countryClubs) {
      const inState = state.clubs.filter((c) => c.country === cCode);
      if (inState.length >= 10) {
        countryClubs = inState.map((c) => ({
          id: c.id,
          name: c.name,
          country: c.country,
          slug: c.slug ?? null,
          players: c.players ?? [],
          stadiumCapacity: c.stadiumCapacity ?? 20000,
          titlesWon: c.titlesWon ?? 0,
        }));
      } else if (offlineContent) {
        const divisoes = buildCountry(offlineContent.clubs, offlineContent.squads, cCode, 20);
        if (divisoes.length > 0) {
          countryClubs = divisoes[0].map((seed, idx) => ({
            id: `club_${cCode}_${idx + 1}`,
            name: seed.name,
            country: cCode,
            slug: seed.slug ?? null,
            players: seed.players,
            stadiumCapacity: seed.stadiumCapacity ?? 20000,
            titlesWon: 0,
          }));
        }
      }
      if (countryClubs && countryClubs.length > 0) {
        scoutingClubsCache.set(cCode, countryClubs);
      }
    }
    if (countryClubs) {
      results.push(...countryClubs);
    }
  }

  // Include user club if not present
  for (const club of state.clubs) {
    if (club.ownerId === LOCAL_USER_ID && !results.some((r) => r.id === club.id)) {
      results.push({
        id: club.id,
        name: club.name,
        country: club.country,
        slug: club.slug ?? null,
        players: club.players ?? [],
        stadiumCapacity: club.stadiumCapacity ?? 20000,
        titlesWon: club.titlesWon ?? 0,
      });
    }
  }

  return results;
}

/**
 * The stadium screen's preview, computed the way the server computes it.
 *
 * The stand-in this replaces returned `{ currentLevel, currentCapacity, nextCapacity, cost, weeksToBuild }`,
 * and the screen reads `preview.current.receitaPorJogo` — so offline it read a property of `undefined` and
 * took the page down. Calling the shared function is both correct and shorter than inventing a shape.
 */
export async function localGetStadiumPreview(clubId: string): Promise<StadiumUpgradePreview> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  const league = club ? state.leagues.find((l) => l.clubIds.includes(club.id)) : null;

  const currentTier = club?.stadiumTier ?? club?.stadiumLevel ?? 1;
  const currentStep = club?.stadiumStep ?? getStadiumCurrentStep(currentTier, club?.stadiumCapacity ?? 2000);

  return previewStadiumUpgrade(
    currentTier,
    {
      avgSquadOverall: averageSquadOverall(club?.players ?? []),
      stadiumLevel: currentTier,
      division: league?.division ?? 1,
      leaguePosition: null,
      totalClubsInLeague: league?.clubIds.length ?? 0,
      titlesWon: club?.titlesWon ?? 0,
    },
    currentStep,
    club?.stadiumCapacity,
  );
}

export async function localUpgradeStadium(clubId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  if (club.stadiumConstruction) {
    throw new Error('Já existe uma obra em andamento neste estádio');
  }

  const currentTier = club.stadiumTier ?? club.stadiumLevel ?? 1;
  const currentStep = club.stadiumStep ?? getStadiumCurrentStep(currentTier, club.stadiumCapacity);
  const nextReform = getNextStadiumReform(currentTier, currentStep);

  let cost: number;
  let durationWeeks: number;
  let stadiumConstruction: StadiumConstruction;

  if (nextReform) {
    cost = nextReform.cost;
    durationWeeks = nextReform.durationWeeks;
    stadiumConstruction = {
      targetLevel: nextReform.step === 4 ? currentTier + 1 : currentTier,
      targetStep: nextReform.step,
      stepName: nextReform.name,
      targetCapacity: nextReform.targetCapacity,
      weeksRemaining: nextReform.durationWeeks,
      videoFile: nextReform.videoFile,
    };
  } else {
    const next = getNextStadiumTier(currentTier);
    if (!next) {
      throw new Error('O estádio já está no nível máximo');
    }
    cost = next.upgradeCost;
    durationWeeks = next.upgradeWeeks;
    stadiumConstruction = {
      targetLevel: next.tier,
      targetCapacity: next.capacity,
      weeksRemaining: next.upgradeWeeks,
    };
  }

  if (club.budget < cost) {
    throw new Error('Orçamento insuficiente para reformar o estádio');
  }

  club.budget -= cost;
  club.stadiumConstruction = stadiumConstruction;
  club.stadiumUpgradeWeek = durationWeeks;
  saveLocalGameState(state);
  return club;
}

export async function localGetHistory(): Promise<any[]> {
  return [];
}

export async function localGetHallOfFame(clubId?: string): Promise<HallOfFameData> {
  const state = loadLocalGameState();
  const currentClub = clubId ? state.clubs.find((c) => c.id === clubId) : state.clubs[0];
  const userManager = {
    name: 'Você (Treinador)',
    titlesWon: currentClub?.titlesWon ?? 0,
    trophies: currentClub?.trophies ?? [],
  };
  return buildHallOfFameData(state.clubs, userManager);
}

export async function localResignClub(clubId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');

  club.ownerId = BOT_OWNER_ID;
  const tenure = state.tenures?.find((candidate) => candidate.userId === LOCAL_USER_ID && candidate.clubId === clubId && !candidate.endedAt);
  if (tenure) {
    tenure.endedAt = new Date().toISOString();
    tenure.endReason = 'RESIGNED';
  }
  saveLocalGameState(state);
  return club;
}

export async function localGetSponsorshipOffers(_clubId: string): Promise<any[]> {
  return [
    { id: 'sp_1', companyName: 'Banco Nacional', weeklyValue: 250000, durationWeeks: 52, minFinishPosition: 4, bonusValue: 500000 },
  ];
}

export async function localAcceptSponsorship(clubId: string, offer: any): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  club.sponsorships.push({ ...offer, startSeason: state.currentSeason, remainingWeeks: offer.durationWeeks });
  saveLocalGameState(state);
  return club;
}

export async function localTakeLoan(clubId: string, amount: number, _planKey: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  club.budget += amount;
  club.loans.push({
    id: `loan_${Date.now()}`,
    planKey: (_planKey as any) ?? 'MEDIO',
    principal: amount,
    remainingBalance: amount,
    weeklyPayment: Math.round(amount / 20),
    weeksRemaining: 20,
  });
  saveLocalGameState(state);
  return club;
}

export async function localGetStadiumUpgradePreview(clubId: string): Promise<any> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  const currentTier = club?.stadiumTier ?? club?.stadiumLevel ?? 1;
  const current = getStadiumTierInfo(currentTier);
  const next = getNextStadiumTier(currentTier);
  return {
    currentTier,
    currentName: current?.name ?? 'Estádio Municipal',
    currentCapacity: club?.stadiumCapacity ?? current?.capacity ?? 2000,
    newCapacity: next?.capacity ?? (club?.stadiumCapacity ?? 2000),
    cost: next?.upgradeCost ?? 0,
    durationWeeks: next?.upgradeWeeks ?? 0,
    nextTier: next?.tier ?? null,
    nextName: next?.name ?? null,
  };
}

export async function localScoutTransfers(): Promise<any[]> {
  const state = loadLocalGameState();
  return state.clubs;
}

/**
 * O mercado de comissão técnica, do mesmo gerador que o servidor usa.
 *
 * Isto devolvia **uma** pessoa inventada à mão, "Dr. Carlos Silva", assistente tático, sempre a mesma. No
 * Android o mercado inteiro era esse um. `generateStaffMarket` vive no `shared` e não precisa de servidor
 * nenhum; era só chamá-lo.
 */
/**
 * As propostas de patrocínio, e a assinatura delas, offline.
 *
 * `getSponsorshipOffers` e `signSponsorship` iam direto ao servidor, sem desvio, então no Android a aba de
 * finanças abria vazia e o botão de assinar não fazia nada. É o mesmo defeito que "Fundar o meu clube"
 * tinha: um caminho que só existia de um lado. As regras aqui são as do `financeService`, incluindo a de
 * substituição, que é o que faz a proposta rival valer alguma coisa.
 */
function prestigioDoClube(state: LocalGameState, club: Club) {
  const liga = leagueOfClub(state, club);
  const posicao = liga ? liga.clubIds.indexOf(club.id) + 1 : null;
  return {
    avgSquadOverall: averageSquadOverall(club.players ?? []),
    stadiumLevel: club.stadiumLevel,
    division: liga?.division ?? 1,
    leaguePosition: posicao && posicao > 0 ? posicao : null,
    totalClubsInLeague: liga?.clubIds.length ?? 20,
    titlesWon: club.titlesWon,
  };
}

export async function localSponsorshipOffers(clubId: string): Promise<Sponsorship[]> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) return [];

  /**
   * Semeado na data do jogo, e não no relógio do aparelho. O servidor usa `Date.now()`, o que ali é
   * inofensivo porque cada chamada é uma requisição; aqui a tela relê a cada render e as propostas
   * trocariam debaixo do dedo do jogador enquanto ele lê.
   */
  const rng = createRng(`${club.id}-sponsors-${state.gameDate.year}-${state.gameDate.month}`);
  const prestigio = prestigioDoClube(state, club);
  const tiposAtivos = club.sponsorships.map((s) => s.type);
  const nomesAtivos = club.sponsorships.map((s) => s.sponsorName);

  const ofertas = generateSponsorshipOffers(rng, prestigio, tiposAtivos, 3, nomesAtivos, state.managerStyle);

  const namingAtivo = club.sponsorships.find((s) => s.type === 'STADIUM_NAMING');
  if (namingAtivo) {
    const desafio = generateNamingRightsChallengeOffer(rng, prestigio, club.titlesWon);
    if (desafio) ofertas.push(desafio);
  }

  ofertas.push(...generateMidSeasonSponsorshipOffers(rng, prestigio, club.sponsorships, prestigio.leaguePosition));
  return ofertas;
}

export async function localSignSponsorship(clubId: string, offer: Sponsorship): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');

  // As três formas de uma proposta substituir um contrato em vigor, iguais às do servidor.
  const trocaNaming = offer.isChallenge === true && offer.type === 'STADIUM_NAMING';
  const trocaAssedio = offer.isPoachOffer === true;
  const trocaAberta = offer.isReplacement === true && club.sponsorships.some((s) => s.type === offer.type);
  const substitui = trocaNaming || trocaAssedio || trocaAberta;

  if (!substitui && club.sponsorships.length >= MAX_SPONSORSHIPS) {
    throw new Error(`Este clube já tem o máximo de ${MAX_SPONSORSHIPS} patrocínios ativos`);
  }
  if (!substitui && club.sponsorships.some((s) => s.type === offer.type)) {
    throw new Error('Este clube já tem um patrocínio ativo desse tipo');
  }
  if (!Number.isFinite(offer.weeklyAmount) || offer.weeklyAmount <= 0) {
    throw new Error('Proposta de patrocínio inválida');
  }

  const restantes = substitui ? club.sponsorships.filter((s) => s.type !== offer.type) : club.sponsorships;
  club.sponsorships = [...restantes, { ...offer, id: `${club.id}-${offer.type}-${state.gameDate.year}` }];

  // A luva entra no caixa na hora, que é metade do motivo de uma proposta ser melhor que outra.
  club.budget += offer.signingBonus ?? 0;

  saveLocalGameState(state);
  return club;
}

export async function localClaimNationalTeam(teamCode: string): Promise<void> {
  const state = loadLocalGameState();
  state.claimedNationalTeamCode = teamCode;
  state.nationalTeamSquads ??= {};
  if (!state.nationalTeamSquads[teamCode]) {
    const allPlayers = state.clubs.flatMap(c => (c.players ?? []).map(p => ({ ...p, clubId: c.id, clubName: c.name })));
    const stateSquad = autoSelectNationalSquad(teamCode, allPlayers);
    state.nationalTeamSquads[teamCode] = stateSquad.squad;
  }
  saveLocalGameState(state);
}

export async function localResignNationalTeam(): Promise<void> {
  const state = loadLocalGameState();
  state.claimedNationalTeamCode = null;
  saveLocalGameState(state);
}

export async function localGetNationalTeam(teamCode: string): Promise<{ config: NationalTeamConfig; squad: NationalSquadEntry[] } | null> {
  const state = loadLocalGameState();
  const config = NATIONAL_TEAMS.find(t => t.id === teamCode);
  if (!config) return null;
  state.nationalTeamSquads ??= {};
  if (!state.nationalTeamSquads[teamCode]) {
    const allPlayers = state.clubs.flatMap(c => (c.players ?? []).map(p => ({ ...p, clubId: c.id, clubName: c.name })));
    const stateSquad = autoSelectNationalSquad(teamCode, allPlayers);
    state.nationalTeamSquads[teamCode] = stateSquad.squad;
  }
  return {
    config,
    squad: state.nationalTeamSquads[teamCode],
  };
}

export async function localSaveNationalSquad(teamCode: string, playerIds: string[]): Promise<void> {
  const state = loadLocalGameState();
  state.nationalTeamSquads ??= {};
  const allPlayers = state.clubs.flatMap(c => (c.players ?? []).map(p => ({ ...p, clubId: c.id, clubName: c.name })));

  const entries: NationalSquadEntry[] = playerIds.map((id, idx) => {
    const p = allPlayers.find(pl => pl.id === id);
    return {
      playerId: id,
      playerName: p?.name ?? 'Atleta',
      clubId: p?.clubId ?? 'FREE',
      clubName: p?.clubName ?? 'Sem Clube',
      position: p?.position ?? 'MID',
      overall: p?.overall ?? 70,
      morale: p?.morale ?? 75,
      caps: Math.floor(Math.random() * 30) + 1,
      goals: Math.floor(Math.random() * 5),
      isStarter: idx < 11,
    };
  });
  state.nationalTeamSquads[teamCode] = entries;
  saveLocalGameState(state);
}

export async function localListNationalJobOffers(): Promise<NationalJobOffer[]> {
  const state = loadLocalGameState();
  state.nationalJobOffers ??= [];
  if (state.nationalJobOffers.length === 0 && !state.claimedNationalTeamCode) {
    const availableTeams = NATIONAL_TEAMS.slice(0, 5);
    state.nationalJobOffers = availableTeams.map((t, i) => ({
      id: `offer_${t.id}_${i}`,
      teamCode: t.id,
      teamName: t.name,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    }));
  }
  return state.nationalJobOffers;
}

export async function localClaimNationalTeamByOffer(offerId: string): Promise<void> {
  const state = loadLocalGameState();
  state.nationalJobOffers ??= [];
  const offer = state.nationalJobOffers.find(o => o.id === offerId);
  if (offer) {
    offer.status = 'ACCEPTED';
    state.claimedNationalTeamCode = offer.teamCode;
    await localClaimNationalTeam(offer.teamCode);
  }
  saveLocalGameState(state);
}


export async function localListStaffMarket(clubId: string): Promise<StaffMember[]> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);

  // Semeado na temporada, e não no relógio, para o mercado não se remexer a cada vez que a tela abre.
  const mercado = generateStaffMarket(state.currentSeason);
  const jaContratados = new Set((club?.staff ?? []).map((m) => m.id));
  return mercado.filter((m) => !jaContratados.has(m.id));
}

/**
 * Contrata quem o técnico escolheu.
 *
 * Isto ignorava o `staffId` por inteiro: escolhesse quem escolhesse, o clube recebia um "Profissional
 * Contratado", assistente tático, PRATA, nota 80, quinze mil de salário. Um preparador físico contratado
 * chegava como assistente tático, então nenhum dos bônus que o jogador pagou para ter chegava a valer.
 *
 * Aplica as mesmas travas do servidor: um por função, e as exigências de visibilidade e de títulos que
 * `canHireStaff` define, senão o mercado inteiro fica disponível desde o primeiro dia.
 */
export async function localHireStaff(clubId: string, staffId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  if (!club.staff) club.staff = [];

  const escolhido = generateStaffMarket(state.currentSeason).find((m) => m.id === staffId);
  if (!escolhido) throw new Error('Profissional não encontrado no mercado');

  const { canHire, reason } = canHireStaff(escolhido, club.visibilityScore ?? 50, club.titlesWon ?? 0);
  if (!canHire) throw new Error(reason ?? 'Este profissional não aceita o convite');

  // Uma pessoa por função: contratar substitui quem estava no posto, como no servidor.
  club.staff = [...club.staff.filter((m) => m.role !== escolhido.role), escolhido];
  saveLocalGameState(state);
  return club;
}

export async function localFireStaff(clubId: string, staffId: string): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  if (!club.staff) club.staff = [];
  const idx = club.staff.findIndex((s) => s.id === staffId);
  if (idx !== -1) club.staff.splice(idx, 1);
  saveLocalGameState(state);
  return club;
}

export async function localUpdateStaffDelegation(
  clubId: string,
  config: StaffDelegationConfig,
): Promise<Club> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  const updatedConfig: StaffDelegationConfig = {
    ...DEFAULT_STAFF_DELEGATION_CONFIG,
    ...config,
  };
  club.staffDelegationConfig = updatedConfig;
  saveLocalGameState(state);
  return club;
}


/**
 * The same scouting report offline as online.
 *
 * This used to return `{ summary: 'O time está bem equilibrado no 4-4-2.' }`, which shares no field with
 * the report the screen renders, so every box in the modal came out empty in offline mode. The generator
 * is pure and lives in shared, so there was never a reason for a stand-in here.
 */
export async function localGetTacticalAdvice(clubId: string, opponentId?: string): Promise<TacticalAssistantAdvice> {
  const club = await localGetClub(clubId);
  const assistant = club.staff?.find((s) => s.role === 'TACTICAL_ASSISTANT');

  const state = loadLocalGameState();
  const opponent = opponentId ? await localGetClub(opponentId).catch(() => null) : null;
  return generateTacticalAssistantAdvice(
    assistant,
    opponent?.pendingRoundTactic ?? null,
    opponent?.name ?? 'o próximo adversário',
    state.managerStyle,
  );
}

export async function localGetOppositionDossier(clubId: string, opponentId: string): Promise<OppositionDossier> {
  const club = await localGetClub(clubId);
  const opp = await localGetClub(opponentId);
  const assistant = club.staff?.find((s) => s.role === 'TACTICAL_ASSISTANT');
  const oppTactic = opp.pendingRoundTactic ?? autoFillLineup(opp);
  return generateOppositionDossier(opp, oppTactic, assistant);
}

/**
 * The three "do it for me" buttons, offline.
 *
 * Each of these returned a count or a flag, while every caller does `setClub(res.club)` and then renders
 * from it — so offline every one of them replaced the club with `undefined` and blanked the screen on the
 * next read. They do no training here, which is honest: the offline engine has no development tick to run.
 * What they must do is hand back the club unchanged and say plainly that nothing happened.
 */
function localStaffActionResult(clubId: string, message: string) {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  return { club: club as Club, actions: [] as never[], message };
}

export async function localAutoTrainSquad(clubId: string) {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');

  const actions = planSmartAutoTraining(club);
  if (actions.length === 0) {
    return {
      club,
      actions: [],
      message: 'Orçamento insuficiente ou nenhum atleta elegível para treinamento no momento.',
    };
  }

  const fitnessCoach = club.staff?.find((s) => s.role === 'FITNESS_COACH');
  const youthCoordinator = club.staff?.find((s) => s.role === 'YOUTH_COORDINATOR');
  const fitnessBoost = getFitnessTrainingBoost(fitnessCoach);
  const youthBoost = getYouthDevelopmentBoost(youthCoordinator);

  let updatedBudget = club.budget;
  for (const action of actions) {
    const idx = club.players.findIndex((p) => p.id === action.playerId);
    if (idx !== -1 && updatedBudget >= action.cost) {
      club.players[idx] = executePlayerTrainingSession(club.players[idx], action.focus, fitnessBoost, youthBoost);
      updatedBudget -= action.cost;
    }
  }
  club.budget = updatedBudget;
  saveLocalGameState(state);

  const staffName = fitnessCoach ? `${fitnessCoach.name} (Preparador Físico)` : 'A Comissão Técnica';
  const message = `${staffName} planejou e executou o treino intensivo de ${actions.length} atletas com foco em evolução e condicionamento!`;

  return {
    club,
    actions,
    message,
  };
}

export async function localAutoTrainAcademy(clubId: string) {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');

  const actions = planSmartAcademyAutoTraining(club);
  if (actions.length === 0) {
    return {
      club,
      actions: [],
      message: 'Orçamento insuficiente ou nenhum jovem na base para treinar.',
    };
  }

  const staff = club.staff || [];
  const coordinator = staff.find((s) => s.role === 'YOUTH_COORDINATOR');
  const fitnessCoach = staff.find((s) => s.role === 'FITNESS_COACH');
  const youthBoost = getYouthDevelopmentBoost(coordinator);
  const fitnessBoost = getFitnessTrainingBoost(fitnessCoach);

  const currentCycle = state.gameDate ? `${state.gameDate.year}-${state.gameDate.month}-${state.gameDate.day}` : 'cycle_1';
  let budget = club.budget;
  const academyPlayers = [...(club.academyPlayers || [])];

  for (const action of actions) {
    const idx = academyPlayers.findIndex((p) => p.id === action.playerId);
    if (idx !== -1 && budget >= action.cost) {
      const trained = executePlayerTrainingSession(academyPlayers[idx], action.focus, fitnessBoost, youthBoost);
      (trained as any).lastTrainedCycle = currentCycle;
      academyPlayers[idx] = trained;
      budget -= action.cost;
    }
  }

  club.academyPlayers = academyPlayers;
  club.budget = budget;
  saveLocalGameState(state);

  const coordinatorName = coordinator ? `${coordinator.name} (Coordenador de Base)` : 'A Comissão da Base';
  const message = `${coordinatorName} aplicou treinamento especializado em ${actions.length} promessas das categorias de base!`;

  return {
    club,
    actions,
    message,
  };
}

export async function localAutoPrepareTactics(clubId: string, opponentId?: string) {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  let opponentTactic: any = null;
  if (opponentId) {
    const oppClub = state.clubs.find((c) => c.id === opponentId);
    if (oppClub) {
      opponentTactic = oppClub.pendingRoundTactic ?? autoFillLineup(oppClub);
    }
  }
  const result = planSmartTacticsAgainstOpponent(club, opponentTactic);
  club.pendingRoundTactic = result.tactic as never;
  saveLocalGameState(state);
  return {
    club,
    tactic: result.tactic,
    message: result.explanation,
  };
}

export interface LocalSaveSlot {
  id: string;
  name: string;
  fileName: string;
  managerFirstName?: string;
  managerLastName?: string;
  managerName?: string;
  managerNationality?: string;
  managerStyle?: string;
  managerAvatar?: string;
  clockFormat?: 'HALF_45' | 'FULL_90';
  /** O modo de carreira, também offline: as regras não podem valer só quando há servidor. */
  gameMode?: GameMode;
  managerUserId?: string;
  managerToken?: string;
  clubName?: string;
  clubCountry?: string;
  division?: number;
  season?: number;
  round?: number;
  budget?: number;
  titlesWon?: number;
  clubSlug?: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  currentDate?: string;
  leaguePosition?: number;
  nextOpponentName?: string;
  nextOpponentSlug?: string | null;
  nextMatchDate?: string;
  seasonPhase?: 'PRE_SEASON' | 'IN_SEASON' | 'OFF_SEASON';
  transferWindowOpen?: boolean;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

export async function localListSaves(): Promise<{
  currentSaveId: string;
  currentManager: any | null;
  saves: LocalSaveSlot[];
}> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  const league = claimed ? leagueOfClub(state, claimed) ?? null : null;
  const gameState = await localGetGameState();
  const standings = league
    ? computeStandings(
        league.clubIds,
        league.fixtures
          .filter((fixture) => fixture.result != null)
          .map((fixture) => ({
            homeClubId: fixture.homeClubId,
            awayClubId: fixture.awayClubId,
            homeGoals: fixture.result!.homeGoals,
            awayGoals: fixture.result!.awayGoals,
          })),
      )
    : [];
  const clubFixtures = claimed && league
    ? league.fixtures.filter((fixture) => fixture.homeClubId === claimed.id || fixture.awayClubId === claimed.id)
    : [];
  const nextFixture = clubFixtures
    .filter((fixture) => !fixture.matchId && !fixture.result)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.round - b.round)
    .find((fixture) => !fixture.date || fixture.date >= gameState.currentDate);
  const opponentId = claimed && nextFixture
    ? nextFixture.homeClubId === claimed.id ? nextFixture.awayClubId : nextFixture.homeClubId
    : undefined;
  const opponent = state.clubs.find((club) => club.id === opponentId);
  const playedRounds = clubFixtures.filter((fixture) => !!fixture.matchId || !!fixture.result).map((fixture) => fixture.round);
  const currentSlot: LocalSaveSlot = {
    id: 'local_save_default',
    name: 'Carreira Principal',
    fileName: 'offline_save.json',
    managerFirstName: 'Treinador',
    managerLastName: 'Principal',
    managerName: 'Treinador Principal',
    managerNationality: 'BRA',
    managerStyle: state.managerStyle ?? 'Estrategista',
    managerAvatar: '👔',
    clockFormat: 'HALF_45',
    gameMode: state.gameMode ?? 'STANDARD',
    managerUserId: LOCAL_USER_ID,
    managerToken: LOCAL_USER_TOKEN,
    clubName: claimed?.name,
    clubCountry: claimed?.country,
    clubSlug: claimed?.slug,
    crestBase64: (claimed as any)?.crestBase64 ?? null,
    primaryColor: (claimed as any)?.primaryColor ?? null,
    secondaryColor: (claimed as any)?.secondaryColor ?? null,
    division: league?.division ?? 1,
    season: state.currentSeason,
    round: playedRounds.length > 0 ? Math.max(...playedRounds) : 0,
    budget: claimed?.budget ?? 15_000_000,
    titlesWon: claimed?.titlesWon ?? 0,
    currentDate: gameState.currentDate,
    leaguePosition: claimed ? standings.findIndex((row) => row.clubId === claimed.id) + 1 || undefined : undefined,
    nextOpponentName: opponent?.name,
    nextOpponentSlug: opponent?.slug,
    nextMatchDate: nextFixture?.date ?? undefined,
    seasonPhase: gameState.phase,
    transferWindowOpen: gameState.phase === 'PRE_SEASON',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCurrent: true,
  };

  return {
    currentSaveId: 'local_save_default',
    currentManager: {
      firstName: 'Treinador',
      lastName: 'Principal',
      fullName: 'Treinador Principal',
      nationality: 'BRA',
      style: state.managerStyle ?? 'Estrategista',
      avatar: '👔',
      clockFormat: 'HALF_45',
      // A tela lê o modo daqui para saber quais velocidades liberar e o que esconder no painel.
      gameMode: state.gameMode ?? 'STANDARD',
    },
    saves: [currentSlot],
  };
}

export async function localCreateNewSave(params: any): Promise<{ ok: boolean; save: LocalSaveSlot; token: string; userId: string }> {
  await prepareOfflineWorld();
  resetInMemoryGameState();
  const seedForSave = params?.saveSeed || generateSaveSeed();
  const fresh = initDefaultWorld(offlineContent, seedForSave);
  // O modo e estilo escolhidos na criação entram no mundo novo
  fresh.gameMode = (params?.gameMode as GameMode | undefined) ?? 'STANDARD';
  fresh.managerStyle = (params?.managerStyle as ManagerStyleId | undefined) ?? 'Estrategista';
  saveLocalGameState(fresh);
  const name = typeof params === 'string' ? params : params?.name ?? 'Nova Carreira';
  const save: LocalSaveSlot = {
    id: `save_${Date.now()}`,
    name,
    fileName: `save_${Date.now()}.json`,
    managerFirstName: params?.managerFirstName ?? 'Treinador',
    managerLastName: params?.managerLastName ?? 'Novo',
    managerName: `${params?.managerFirstName ?? 'Treinador'} ${params?.managerLastName ?? 'Novo'}`.trim(),
    managerNationality: params?.managerNationality ?? 'BRA',
    managerStyle: params?.managerStyle ?? 'Estrategista',
    managerAvatar: params?.managerAvatar ?? '👔',
    clockFormat: params?.clockFormat ?? 'HALF_45',
    gameMode: params?.gameMode ?? 'STANDARD',
    managerUserId: LOCAL_USER_ID,
    managerToken: LOCAL_USER_TOKEN,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCurrent: true,
  };
  return { ok: true, save, token: LOCAL_USER_TOKEN, userId: LOCAL_USER_ID };
}

export async function localLoadSave(id: string): Promise<{ ok: boolean; save: LocalSaveSlot; token: string; userId: string; claimedClubId?: string }> {
  const state = loadLocalGameState();
  const claimed = state.clubs.find((c) => c.ownerId === LOCAL_USER_ID);
  const list = await localListSaves();
  const save = list.saves[0];
  return { ok: true, save, token: LOCAL_USER_TOKEN, userId: LOCAL_USER_ID, claimedClubId: claimed?.id };
}

function generateInitialFreeAgents(currentSeason: number): LocalFreeAgent[] {
  const seed = `free-agents-${currentSeason}`;
  const squad1 = generateSquad(74, `${seed}-1`, 'BRA');
  const squad2 = generateSquad(69, `${seed}-2`, 'ARG');
  const squad3 = generateSquad(65, `${seed}-3`, 'URU');
  const all = [...squad1, ...squad2, ...squad3];

  return all.map((p, idx) => ({
    id: `fa_${currentSeason}_${idx}_${p.id}`,
    player: {
      ...p,
      contractUntil: currentSeason,
    },
    sinceSeason: currentSeason,
  }));
}

export async function localGetContracts(clubId: string): Promise<{
  seasonYear: number;
  players: { playerId: string; contractUntil: number | null; seasonsRemaining: number; costByYears: Record<string, number> }[];
  expiringAnalysis: CategorizedExpiringContracts;
}> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  const seasonYear = state.currentSeason ?? 2026;
  const director = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const expiringAnalysis = identifyExpiringContracts(club, 10, seasonYear);

  return {
    seasonYear,
    players: club.players.map((p) => ({
      playerId: p.id,
      contractUntil: p.contractUntil ?? null,
      seasonsRemaining: seasonsRemaining(p, seasonYear),
      costByYears: Object.fromEntries(
        [1, 2, 3, 4, 5].map((anos) => [anos, renewalCost(p, seasonYear, anos, director)]),
      ),
    })),
    expiringAnalysis,
  };
}

export async function localBatchRenewContracts(
  clubId: string,
  playerIds: string[],
  optionsOrYears: number | { years?: number; yearsMap?: Record<string, number>; updateWages?: boolean } = 2,
): Promise<{ club: Club; totalCost: number; renewedCount: number; failedPlayerIds: string[] }> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  const seasonYear = state.currentSeason ?? 2026;

  const options =
    typeof optionsOrYears === 'number'
      ? { years: optionsOrYears, updateWages: true }
      : { updateWages: true, ...optionsOrYears };

  const result = batchRenewContracts(club, playerIds, seasonYear, options);
  if (result.renewedPlayers.length > 0) {
    club.players = result.updatedClub.players;
    club.budget = result.updatedClub.budget;
    saveLocalGameState(state);
  }

  return {
    club: { ...club },
    totalCost: result.totalCost,
    renewedCount: result.renewedPlayers.length,
    failedPlayerIds: result.failedPlayerIds,
  };
}

export async function localRenewPlayerContract(
  clubId: string,
  playerId: string,
  years: number,
): Promise<{ club: Club; cost: number }> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');

  const anos = Math.max(1, Math.min(5, Math.round(years)));
  const index = club.players.findIndex((p) => p.id === playerId);
  if (index === -1) throw new Error('Jogador não pertence a este clube');

  const seasonYear = state.currentSeason ?? 2026;
  const player = club.players[index];
  const director = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const cost = renewalCost(player, seasonYear, anos, director);

  if (club.budget < cost) {
    throw new Error(`Orçamento insuficiente: renovar por ${anos} temporada(s) custa R$ ${cost.toLocaleString('pt-BR')}`);
  }

  const renewedPlayer = renewContract(player, seasonYear, anos);
  club.players[index] = renewedPlayer;
  club.budget -= cost;

  saveLocalGameState(state);
  return { club: { ...club }, cost };
}

export async function localListFreeAgents(
  _clubId: string,
  options: { country?: string; position?: string; limit?: number } = {},
): Promise<{ id: string; player: Player; sinceSeason: number }[]> {
  const state = loadLocalGameState();
  if (!state.freeAgents || state.freeAgents.length === 0) {
    state.freeAgents = generateInitialFreeAgents(state.currentSeason ?? 2026);
    saveLocalGameState(state);
  }

  let list = [...state.freeAgents];
  if (options.country) {
    list = list.filter((fa) => fa.player.nationality === options.country);
  }
  if (options.position) {
    list = list.filter((fa) => fa.player.position === options.position);
  }
  list.sort((a, b) => b.player.overall - a.player.overall);
  return list.slice(0, Math.min(200, Math.max(1, options.limit ?? 50)));
}

export async function localSignFreeAgent(
  clubId: string,
  freeAgentId: string,
  years?: number,
): Promise<{ club: Club; cost: number; player: Player }> {
  const state = loadLocalGameState();
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');

  if (!state.freeAgents || state.freeAgents.length === 0) {
    state.freeAgents = generateInitialFreeAgents(state.currentSeason ?? 2026);
  }

  const faIndex = state.freeAgents.findIndex((fa) => fa.id === freeAgentId);
  if (faIndex === -1) throw new Error('Este jogador não está mais disponível no mercado de passes livres');

  const freeAgent = state.freeAgents[faIndex];
  const livre = freeAgent.player;
  const anos = Math.max(1, Math.min(5, Math.round(years ?? 3)));
  const cost = Math.max(1, Math.round(livre.wage * 12 * anos));

  if (club.budget < cost) {
    throw new Error(`Orçamento insuficiente: a luva é de R$ ${cost.toLocaleString('pt-BR')}`);
  }

  const seasonYear = state.currentSeason ?? 2026;
  const assinado: Player = {
    ...livre,
    id: `fa_signed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    contractUntil: contractEndFor(livre.age, seasonYear) + (anos - 1),
  };

  club.players.push(assinado);
  club.budget -= cost;
  state.freeAgents.splice(faIndex, 1);

  saveLocalGameState(state);
  return { club: { ...club }, cost, player: assinado };
}

export async function localGetClubTrophyRoom(clubId: string) {
  const state = loadLocalGameState();
  const club = state.clubs.find((c: Club) => c.id === clubId);
  const defaultBook: ClubRecordBook = {
    topScorers: [],
    topAssisters: [],
    mostAppearances: [],
    recordSale: null,
    recordPurchase: null,
    biggestWin: null,
    unbeatenStreakRecord: 0,
    currentUnbeatenStreak: 0,
  };

  if (!club) {
    return {
      clubId,
      clubName: 'Clube',
      trophies: [],
      recordBook: defaultBook,
      titlesWon: 0,
    };
  }

  const trophies: TrophyRoomEntry[] = (club.trophies || []).slice().sort((a: TrophyRoomEntry, b: TrophyRoomEntry) => b.seasonYear - a.seasonYear);
  const recordBook: ClubRecordBook = club.recordBook ? { ...defaultBook, ...club.recordBook } : defaultBook;

  return {
    clubId: club.id,
    clubName: club.name,
    trophies,
    recordBook,
    titlesWon: club.titlesWon || trophies.length,
  };
}

export async function localGetCareerTrophyRoom() {
  const state = loadLocalGameState();
  const allTrophies: TrophyRoomEntry[] = [];

  for (const c of state.clubs) {
    if (c.trophies) {
      for (const t of c.trophies) {
        if (!allTrophies.some((existing) => existing.id === t.id)) {
          allTrophies.push(t);
        }
      }
    }
  }

  return {
    userId: LOCAL_USER_ID,
    managerName: 'Treinador',
    reputation: 60,
    trophies: allTrophies.sort((a: TrophyRoomEntry, b: TrophyRoomEntry) => b.seasonYear - a.seasonYear),
    titlesCount: allTrophies.length,
  };
}

export function localGetDeadlineDay(clubId: string): DeadlineDayState {
  const state = loadLocalGameState();
  const seasonYear = state.currentSeason ?? 2026;

  if (
    state.deadlineDayState &&
    (state.deadlineDayState.isActive ||
      (state.deadlineDayState.seasonYear === seasonYear && state.deadlineDayState.auctions.length > 0))
  ) {
    return state.deadlineDayState;
  }

  const listings = state.listings || [];
  const clubNameById = new Map(state.clubs.map((c) => [c.id, c.name]));

  const auctions: DeadlineAuctionItem[] = listings.map((l) => ({
    id: l.id,
    player: l.player,
    sellerClubId: l.clubId,
    sellerClubName: clubNameById.get(l.clubId) ?? 'Clube Vendedor',
    minimumBid: l.askingPrice,
    currentBid: 0,
    highestBidderClubId: null,
    highestBidderClubName: null,
    bids: [],
    hoursRemaining: 12,
    status: 'ACTIVE',
  }));

  const botClubs = state.clubs.filter((c) => c.ownerId === BOT_OWNER_ID);
  const positions: Array<'GK' | 'DEF' | 'MID' | 'ATT'> = ['GK', 'DEF', 'MID', 'ATT'];
  const panicBuyRequests = botClubs.slice(0, 4).map((c, i) => ({
    clubId: c.id,
    clubName: c.name,
    positionNeeded: positions[i % positions.length],
    budgetMax: Math.floor(c.budget * 0.7),
  }));

  const newDeadlineState = createDeadlineDayState({
    seasonYear,
    windowType: 'PRE_SEASON',
    auctions,
    panicBuyRequests,
  });

  state.deadlineDayState = newDeadlineState;
  saveLocalGameState(state);
  return newDeadlineState;
}

export function localPlaceDeadlineDayBid(input: {
  auctionId: string;
  buyerClubId: string;
  amount: number;
  wageOffer: number;
}): DeadlineDayState {
  const state = loadLocalGameState();
  const buyer = state.clubs.find((c) => c.id === input.buyerClubId);
  if (!buyer) {
    throw new DeadlineDayError('Clube comprador não encontrado');
  }

  const deadlineState = state.deadlineDayState ?? localGetDeadlineDay(input.buyerClubId);
  const nextDeadlineState = placeDeadlineBid(deadlineState, {
    auctionId: input.auctionId,
    clubId: buyer.id,
    clubName: buyer.name,
    amount: input.amount,
    wageOffer: input.wageOffer,
    timestamp: new Date().toISOString(),
    isUserBid: true,
    availableBudget: buyer.budget,
  });

  state.deadlineDayState = nextDeadlineState;
  saveLocalGameState(state);
  return nextDeadlineState;
}

export function localAdvanceDeadlineDay(clubId: string): DeadlineDayState {
  const state = loadLocalGameState();
  const deadlineState = state.deadlineDayState ?? localGetDeadlineDay(clubId);

  if (deadlineState.currentHour === 0 || !deadlineState.isActive) {
    return deadlineState;
  }

  const botClubs = state.clubs.filter((c) => c.ownerId === BOT_OWNER_ID);
  const positions: Array<'GK' | 'DEF' | 'MID' | 'ATT'> = ['GK', 'DEF', 'MID', 'ATT'];
  const aiClubs: DeadlineAiClub[] = botClubs.map((b, idx) => ({
    clubId: b.id,
    clubName: b.name,
    availableBudget: b.budget,
    positionNeeded: positions[idx % positions.length],
  }));

  const seed = `deadline-${deadlineState.seasonYear}-${deadlineState.currentHour}-${deadlineState.auctions.length}`;
  const rng = createRng(seed);

  const advanceResult = advanceDeadlineDay(deadlineState, aiClubs, new Date().toISOString(), rng);

  if (advanceResult.state.currentHour === 0) {
    for (const settlement of advanceResult.settlements) {
      const seller = state.clubs.find((c) => c.id === settlement.sellerClubId);
      const buyer = state.clubs.find((c) => c.id === settlement.buyerClubId);

      if (!seller || !buyer || settlement.sellerClubId === settlement.buyerClubId) {
        const auction = advanceResult.state.auctions.find((a) => a.id === settlement.auctionId);
        if (auction) {
          auction.status = 'RESOLVED_UNSOLD';
          auction.highestBidderClubId = null;
          auction.highestBidderClubName = null;
        }
        continue;
      }

      const playerIndex = seller.players.findIndex((p) => p.id === settlement.playerId);
      if (playerIndex === -1 || buyer.budget < settlement.amount) {
        const auction = advanceResult.state.auctions.find((a) => a.id === settlement.auctionId);
        if (auction) {
          auction.status = 'RESOLVED_UNSOLD';
          auction.highestBidderClubId = null;
          auction.highestBidderClubName = null;
        }
        continue;
      }

      const player = seller.players[playerIndex];
      seller.players.splice(playerIndex, 1);
      seller.budget += settlement.amount;

      const transferredPlayer: Player = {
        ...player,
        wage: settlement.wageOffer > 0 ? settlement.wageOffer : player.wage,
      };
      buyer.players.push(transferredPlayer);
      buyer.budget -= settlement.amount;

      state.listings = (state.listings || []).filter((l) => l.id !== settlement.auctionId);
    }
  }

  state.deadlineDayState = advanceResult.state;
  saveLocalGameState(state);
  return advanceResult.state;
}

// ─── Press Conference ─────────────────────────────────────────────────────────

const PC_QUESTIONS: Record<string, Array<{ id: string; text: string; category: string }>> = {
  POST_MATCH_CLASICO: [
    { id: 'q1', text: 'Como você avalia o desempenho do time no clássico?', category: 'performance' },
    { id: 'q2', text: 'O resultado reflete o que aconteceu em campo?', category: 'result' },
  ],
  POST_MATCH_FINAL: [
    { id: 'q1', text: 'O que significa para você disputar esta final?', category: 'emotion' },
    { id: 'q2', text: 'Quais os pontos-chave para o sucesso hoje?', category: 'performance' },
  ],
  POST_MATCH_3_LOSSES: [
    { id: 'q1', text: 'Três derrotas seguidas — o que está falhando?', category: 'crisis' },
    { id: 'q2', text: 'Como o vestiário está reagindo a este momento?', category: 'morale' },
  ],
  PRE_SEASON: [
    { id: 'q1', text: 'Quais são as ambições do clube para esta temporada?', category: 'ambition' },
    { id: 'q2', text: 'Que reforços você espera para o elenco?', category: 'transfers' },
  ],
  REGULAR: [
    { id: 'q1', text: 'Como avalia a partida de hoje?', category: 'performance' },
    { id: 'q2', text: 'O que espera do próximo jogo?', category: 'outlook' },
  ],
};

/**
 * Em que semana o clube está, medida pela rodada mais alta que ele já jogou.
 *
 * O motor offline não tem contador de semana — tem data de jogo e temporada. A rodada é a medida honesta de
 * "há quanto tempo esta temporada corre" para quem só precisa carimbar a coletiva.
 */
function semanaDoClube(state: LocalGameState, club: Club): number {
  const league = leagueOfClub(state, club);
  const rodadas = (league?.fixtures ?? [])
    .filter((f) => f.result != null && (f.homeClubId === club.id || f.awayClubId === club.id))
    .map((f) => f.round);
  return rodadas.length > 0 ? Math.max(...rodadas) : 1;
}

/**
 * O contexto da coletiva, montado do que o mundo offline realmente guarda.
 *
 * Este bloco foi escrito contra um `LocalGameState` que não existe — `state.matches`, `league.country` e
 * `league.standings` nunca foram campos deste motor. Offline não há lista de partidas: o que aconteceu vive
 * nas rodadas da liga, e a tabela é calculada, não guardada. É de lá que sai tudo aqui.
 */
function buildPcContext(club: Club, state: LocalGameState): LocalPressConference['context'] {
  const league = leagueOfClub(state, club);
  const jogados = (league?.fixtures ?? []).filter(
    (f) => f.result != null && (f.homeClubId === club.id || f.awayClubId === club.id),
  );
  const lastMatch = jogados[jogados.length - 1];

  const isHome = lastMatch?.homeClubId === club.id;
  const goalsFor = isHome ? (lastMatch?.result?.homeGoals ?? 0) : (lastMatch?.result?.awayGoals ?? 0);
  const goalsAgainst = isHome ? (lastMatch?.result?.awayGoals ?? 0) : (lastMatch?.result?.homeGoals ?? 0);
  const result: 'W' | 'D' | 'L' = goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L';
  const opponentId = isHome ? lastMatch?.awayClubId : lastMatch?.homeClubId;
  const opponent = state.clubs.find((c) => c.id === opponentId);

  const standings = league
    ? computeStandings(
        league.clubIds,
        league.fixtures
          .filter((f) => f.result != null)
          .map((f) => ({
            homeClubId: f.homeClubId,
            awayClubId: f.awayClubId,
            homeGoals: f.result!.homeGoals,
            awayGoals: f.result!.awayGoals,
          })),
      )
    : [];
  const position = standings.findIndex((linha) => linha.clubId === club.id) + 1 || 99;

  return {
    clubName: club.name,
    managerName: 'Treinador',
    opponentName: opponent?.name ?? 'Adversário',
    matchResult: result,
    goalsScored: goalsFor,
    goalsConceded: goalsAgainst,
    currentPosition: position,
    isClassic: false,
    isFinal: false,
    isThreeLossesStreak: false,
  };
}

export async function localCreatePressConference(
  clubId: string,
  userId: string,
  type: InterviewType,
  trigger: InterviewTriggerContext,
): Promise<LocalPressConference> {
  const state = loadLocalGameState();
  if (!state) throw new Error('Estado offline não encontrado');
  const club = state.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error('Clube não encontrado');
  if (userId !== LOCAL_USER_ID) throw new Error('Usuário não é o dono do clube');

  const now = new Date().toISOString();
  
  const baseContext = buildPcContext(club, state);
  /**
   * O gatilho e o contexto chamam as mesmas coisas por nomes diferentes.
   *
   * `InterviewTriggerContext` traz `opponent` e `position`; o contexto da coletiva guarda `opponentName` e
   * `currentPosition`. O espalhamento não liga um ao outro — sem estas duas linhas a coletiva anunciava
   * sempre "Adversário" e a posição que o gatilho informou era descartada em silêncio.
   */
  const pcContext = {
    ...baseContext,
    ...trigger,
    opponentName: trigger.opponent ?? baseContext.opponentName,
    currentPosition: trigger.position ?? baseContext.currentPosition,
    type,
  };

  let questions: LocalPressConference['questions'] = PC_QUESTIONS[type] ?? PC_QUESTIONS.REGULAR;
  const league = leagueOfClub(state, club);
  const jogados = (league?.fixtures ?? []).filter(
    (f) => f.result != null && (f.homeClubId === club.id || f.awayClubId === club.id),
  );
  const lastMatch = jogados[jogados.length - 1];

  if (lastMatch && lastMatch.result) {
    const oppId = lastMatch.homeClubId === club.id ? lastMatch.awayClubId : lastMatch.homeClubId;
    const opponent = state.clubs.find((c) => c.id === oppId);
    if (opponent) {
      const matchObj: Match = {
        id: `match_${lastMatch.homeClubId}_${lastMatch.awayClubId}_${lastMatch.round}`,
        seed: `${lastMatch.homeClubId}_${lastMatch.awayClubId}_${lastMatch.round}`,
        homeClubId: lastMatch.homeClubId,
        awayClubId: lastMatch.awayClubId,
        status: 'SIMULATED',
        result: {
          ...lastMatch.result,
          events: lastMatch.result.events ?? [],
          stats: lastMatch.result.stats as any,
        },
        homeTactic: lastMatch.homeClubId === club.id ? club.pendingRoundTactic ?? undefined : undefined,
        awayTactic: lastMatch.awayClubId === club.id ? club.pendingRoundTactic ?? undefined : undefined,
      };
      const causal = generateCausalPressConferenceQuestions(
        matchObj,
        club,
        opponent,
        club.pendingRoundTactic ?? undefined,
      );
      if (causal && causal.length > 0) {
        questions = causal.map((q) => ({
          id: q.id,
          text: q.question,
          category: q.category ?? 'REGULAR',
          reporterName: q.reporterName,
          mediaOutlet: q.mediaOutlet,
          outletBadge: q.outletBadge,
          answers: q.answers,
        }));
      }
    }
  }

  const pc: LocalPressConference = {
    id: `pc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    clubId,
    week: semanaDoClube(state, club),
    type,
    trigger,
    status: 'OPEN',
    context: pcContext,
    questions,
    createdAt: now,
    updatedAt: now,
  };

  // Brasfooter rule: auto-delegate when manager delegated press conferences
  if (club.staffDelegationConfig?.pressConferences === 'delegated') {
    const delegationOption: DelegationOption = { type: 'ASSISTANT', assistantName: 'Auxiliar Técnico', moveTime: 0 };
    const pcContext = {
      type,
      clubName: pc.context.clubName,
      managerName: pc.context.managerName,
      opponentName: pc.context.opponentName,
      matchResult: pc.context.matchResult,
      goalsScored: pc.context.goalsScored,
      goalsConceded: pc.context.goalsConceded,
      currentPosition: pc.context.currentPosition,
      isClassic: pc.context.isClassic,
      isFinal: pc.context.isFinal,
      isThreeLossesStreak: pc.context.isThreeLossesStreak,
    };
    pc.responses = [];
    pc.impact = calculatePressConferenceImpact([], pcContext as any, delegationOption);
    pc.status = 'DELEGATED';
    pc.updatedAt = new Date().toISOString();
  }

  state.pressConferences ??= [];
  state.pressConferences.push(pc);
  saveLocalGameState(state);
  return pc;
}

export async function localSubmitPressConferenceAnswers(
  id: string,
  userId: string,
  responses: InterviewResponse[],
  delegationOption?: DelegationOption,
): Promise<LocalPressConference> {
  const state = loadLocalGameState();
  if (!state) throw new Error('Estado offline não encontrado');
  const pc = (state.pressConferences ?? []).find((p) => p.id === id);
  if (!pc) throw new Error('Coletiva não encontrada');
  const club = state.clubs.find((c) => c.id === pc.clubId);
  if (!club) throw new Error('Clube não encontrado');
  if (userId !== LOCAL_USER_ID) throw new Error('Usuário não é o dono do clube');

  const pcContext = {
    type: pc.type,
    clubName: pc.context.clubName,
    managerName: pc.context.managerName,
    opponentName: pc.context.opponentName,
    matchResult: pc.context.matchResult,
    goalsScored: pc.context.goalsScored,
    goalsConceded: pc.context.goalsConceded,
    currentPosition: pc.context.currentPosition,
    isClassic: pc.context.isClassic,
    isFinal: pc.context.isFinal,
    isThreeLossesStreak: pc.context.isThreeLossesStreak,
  };

  pc.responses = responses;
  pc.impact = calculatePressConferenceImpact(responses, pcContext as any, delegationOption);
  pc.status = delegationOption ? 'DELEGATED' : 'SUBMITTED';
  pc.updatedAt = new Date().toISOString();
  saveLocalGameState(state);
  return pc;
}

export async function localGetPressConferenceHistory(
  clubId: string,
  limit = 10,
): Promise<LocalPressConference[]> {
  const state = loadLocalGameState();
  if (!state) return [];
  return [...(state.pressConferences ?? [])]
    .filter((p) => p.clubId === clubId)
    .reverse()
    .slice(0, limit);
}

export async function localGetPressConferenceById(id: string): Promise<LocalPressConference> {
  const state = loadLocalGameState();
  const pc = (state?.pressConferences ?? []).find((p) => p.id === id);
  if (!pc) throw new Error('Coletiva não encontrada');
  return pc;
}

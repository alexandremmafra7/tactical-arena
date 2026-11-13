import { localSessionHeaders } from './localSession.js';
import type { GameMode } from '@tactical-arena/shared';
import type {
  Club,
  KitPattern,
  CountryHistory,
  Cup,
  FormResult,
  League,
  Loan,
  LoanPlanKey,
  Match,
  MatchEvent,
  ModPack,
  ModPackImportResult,
  NewsItem,
  PendingMatchDecision,
  Player,
  PlayerAttributes,
  PlayerFunction,
  PlayerRole,
  Position,
  PreferredFoot,
  Sponsorship,
  StaffMember,
  StaffDelegationConfig,
  StandingRow,
  StadiumUpgradePreview,
  Tactic,
  TacticPreset,
  TacticalAssistantAdvice,
  TrainingFocus,
  TransferListing,
  TransferProposal,
  CategorizedExpiringContracts,
  DeadlineDayState,
  TeamTalkContext,
  TeamTalkResult,
  LockerRoomState,
  OppositionDossier,
  HallOfFameData,
  PlayerStatsEntry,
  CustomChampionshipConfig,
  CreateCareerResult,
} from '@tactical-arena/shared';

import * as localEngine from './localEngine.js';

export function isCapacitorMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'capacitor:' ||
    (window as any).Capacitor !== undefined ||
    (window.location.hostname === 'localhost' && !(window as any).electron && !window.location.port)
  );
}

export function isHostedWebOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  if (isCapacitorMobile()) return false;
  if (window.location.port === '3001') return true;
  if (
    window.location.protocol === 'https:' ||
    (window.location.protocol === 'http:' &&
      window.location.port !== '47812' &&
      window.location.port !== '5173')
  ) {
    return true;
  }
  return false;
}

/**
 * Executes a local fallback only when running in genuine offline / native environment.
 * On a hosted web origin, we NEVER fall back to localEngine — the server is authoritative,
 * and swallowing server errors creates phantom 'Clube não encontrado' bugs from local mock data.
 */
export function localFallback<T>(fallbackFn: () => Promise<T> | T): (err: any) => Promise<T> {
  return (err: any) => {
    if (isHostedWebOrigin()) {
      throw err;
    }
    return Promise.resolve(fallbackFn());
  };
}

export function isOfflineMode(): boolean {
  if (isHostedWebOrigin()) return false;
  if (typeof localStorage === 'undefined') return false;
  const pref = localStorage.getItem('game_network_mode');
  if (pref === 'online') return false;
  if (pref === 'offline') return true;
  return isCapacitorMobile() || (import.meta.env.PROD && !import.meta.env['VITE_API_BASE']);
}

export function setOfflineMode(offline: boolean) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('game_network_mode', offline ? 'offline' : 'online');
  }
}

export function getCustomApiBase(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('custom_api_base') ?? '';
  }
  return '';
}

export function getApiBase(): string {
  if (isHostedWebOrigin()) {
    return '';
  }
  const custom = getCustomApiBase();
  if (custom && custom.trim().length > 0) {
    return custom.trim().replace(/\/+$/, '');
  }

  if (import.meta.env['VITE_API_BASE']) {
    return (import.meta.env['VITE_API_BASE'] as string).replace(/\/+$/, '');
  }

  // On Mobile / Capacitor apps, if no custom server is specified, default to http://192.168.1.139:3001
  if (isCapacitorMobile()) {
    return 'http://192.168.1.139:3001';
  }

  return import.meta.env.PROD ? '' : 'http://localhost:3001';
}

export function setCustomApiBase(url: string) {
  if (typeof localStorage !== 'undefined') {
    if (!url || url.trim() === '') {
      localStorage.removeItem('custom_api_base');
    } else {
      localStorage.setItem('custom_api_base', url.trim().replace(/\/+$/, ''));
    }
  }
}

export async function checkServerHealth(url?: string): Promise<boolean> {
  const base = url ? url.trim().replace(/\/+$/, '') : getApiBase();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${base}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = await res.json().catch(() => ({}));
    return !!body.ok;
  } catch {
    return false;
  }
}

// In dev, the web and server run on separate ports, so we need an absolute URL. In a production
// build (e.g. the desktop package), the server serves this app itself — same origin, relative calls.
export const API_BASE = import.meta.env['VITE_API_BASE'] ?? (import.meta.env.PROD ? '' : 'http://localhost:3001');

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensureServerAuthSession(base: string): Promise<{ token: string; userId: string } | null> {
  try {
    const email = `tecnico_${Date.now()}_${Math.floor(Math.random() * 10000)}@tactical.fc`;
    const password = `pass_${Date.now()}`;
    const res = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.token && data?.userId && typeof localStorage !== 'undefined') {
      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.userId);
      setOfflineMode(false);
      return { token: data.token, userId: data.userId };
    }
  } catch {}
  return null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBase();
  try {
    let res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(path.startsWith('/saves') ? await localSessionHeaders(base) : {}),
        ...authHeaders(),
        ...options.headers,
      },
    });

    let body = await res.json().catch(() => ({}));
    if (
      !res.ok &&
      res.status === 401 &&
      !path.startsWith('/auth') &&
      (body.error === 'Token inválido' || body.error === 'Token ausente')
    ) {
      const refreshed = await ensureServerAuthSession(base);
      if (refreshed) {
        res = await fetch(`${base}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(path.startsWith('/saves') ? await localSessionHeaders(base) : {}),
            ...authHeaders(),
            ...options.headers,
          },
        });
        body = await res.json().catch(() => ({}));
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('token');
      }
    }

    if (!res.ok) {
      throw new Error(body.error ?? `Erro na requisição (${res.status})`);
    }
    return body as T;
  } catch (err: any) {
    if (err instanceof TypeError || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      setOfflineMode(true);
    }
    throw err;
  }
}


export function register(email: string, password: string) {
  if (isOfflineMode()) return localEngine.localRegister();
  return request<{ token: string; userId: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string) {
  if (isOfflineMode()) return localEngine.localLogin();
  return request<{ token: string; userId: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function createClub(name: string, country: string) {
  if (isOfflineMode()) return localEngine.localCreateClub(name, country);
  return request<Club>('/clubs', { method: 'POST', body: JSON.stringify({ name, country }) }).catch(localFallback(() => localEngine.localCreateClub(name, country)));
}

export function createCustomChampionship(
  config: CustomChampionshipConfig,
  userClubId: string,
  managerName: string,
  participatingClubs?: Club[]
) {
  if (isOfflineMode()) {
    return localEngine.localCreateCustomChampionship(config, userClubId, managerName, participatingClubs);
  }
  return request<CreateCareerResult>('/custom-championships', {
    method: 'POST',
    body: JSON.stringify({ config, userClubId, managerName, participatingClubs }),
  }).catch(localFallback(() => localEngine.localCreateCustomChampionship(config, userClubId, managerName, participatingClubs)));
}

export function listMyClubs() {
  if (isOfflineMode()) return localEngine.localListMyClubs();
  return request<Club[]>('/clubs/mine').catch(localFallback(() => localEngine.localListMyClubs()));
}

export function getClub(id: string) {
  if (isOfflineMode()) return localEngine.localGetClub(id);
  return request<Club>(`/clubs/${id}`).catch(localFallback(() => localEngine.localGetClub(id)));
}

/**
 * Os países que o modo offline consegue montar. Online devolve null, e a tela mostra a lista inteira.
 *
 * A tela oferecia os 98 países da lista estática e o mundo offline tinha três, então escolher Chile dava
 * "nenhum clube disponível" sem explicar. Offline são 29, contados do banco que veio no APK.
 */
export function listPlayableCountries(): Promise<string[] | null> {
  if (isOfflineMode()) return localEngine.localPlayableCountries();
  return Promise.resolve(null);
}

export function listAvailableClubs(country?: string, division?: number) {
  if (isOfflineMode()) return localEngine.localListAvailableClubs(country, division);
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  if (division !== undefined) params.set('division', String(division));
  const query = params.toString();
  return request<Club[]>(`/clubs/available${query ? `?${query}` : ''}`).catch(localFallback(() => localEngine.localListAvailableClubs(country, division)));
}

/** Countries with a second division, which is where founding a club has somewhere to lead. */
export function listFoundableCountries() {
  if (isOfflineMode()) return localEngine.localListFoundableCountries();
  return request<{ code: string; accessDivision: number; size: number }[]>('/clubs/foundable-countries').catch(localFallback(() => localEngine.localListFoundableCountries(),));
}

/** Founds a club in its country's access division, taking the weakest side's place (see foundClub). */
export function foundClub(input: {
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
}) {
  /**
   * Offline não havia caminho nenhum: isto ia direto ao servidor, então no Android o botão "Fundar o meu
   * clube" abria o formulário e o envio morria numa requisição para um servidor que não existe.
   */
  if (isOfflineMode()) return localEngine.localFoundClub(input);
  return request<Club>('/clubs/found', { method: 'POST', body: JSON.stringify(input) }).catch((err) => {
    if (isOfflineMode()) return localEngine.localFoundClub(input);
    throw err;
  });
}

export function claimClub(clubId: string, gameMode?: GameMode) {
  if (isOfflineMode()) return localEngine.localClaimClub(clubId);
  return request<Club>(`/clubs/${clubId}/claim`, {
    method: 'POST',
    body: JSON.stringify({ gameMode }),
  }).catch((err) => {
    if (isOfflineMode()) return localEngine.localClaimClub(clubId);
    throw err;
  });
}

/** Last few results, oldest first — the V-E-D-V-V strip. */
export function getClubForm(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetClubForm(clubId);
  return request<FormResult[]>(`/clubs/${clubId}/form`).catch(localFallback(() => localEngine.localGetClubForm(clubId)));
}

export function getClubNews(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetClubNews(clubId);
  return request<NewsItem[]>(`/clubs/${clubId}/news`).catch(localFallback(() => localEngine.localGetClubNews(clubId)));
}

/** Market-wide transfers, not just this club's — the id only routes the request (see listTransferNews). */
export function getTransferNews(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetClubNews(clubId);
  return request<NewsItem[]>(`/clubs/${clubId}/news/transfers`).catch(localFallback(() => localEngine.localGetClubNews(clubId)));
}

export function getClubLockerRoom(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetLockerRoom(clubId);
  return request<LockerRoomState>(`/clubs/${clubId}/locker-room`).catch(localFallback(() => localEngine.localGetLockerRoom(clubId)));
}

export function applyTeamTalk(
  clubId: string,
  talkId: string,
  context: TeamTalkContext,
  scoreDifferential = 0,
) {
  if (isOfflineMode()) return localEngine.localApplyTeamTalk(clubId, talkId, context, scoreDifferential);
  return request<TeamTalkResult>(`/clubs/${clubId}/team-talk`, {
    method: 'POST',
    body: JSON.stringify({ talkId, context, scoreDifferential }),
  }).catch(localFallback(() => localEngine.localApplyTeamTalk(clubId, talkId, context, scoreDifferential)));
}

/** URL for a club's real crest image, if one was provided via the content pipeline — 404s if not. */
/**
 * Contratos: ver, renovar, e assinar quem está livre.
 *
 * Sem desvio offline por enquanto, e o motivo é honesto: contrato vence na virada de temporada, e o motor
 * offline não tem virada de temporada nem tick semanal. Ligar isto lá sem a semana existir mostraria prazos
 * que nunca correm.
 */
export interface ManagerView {
  name: string;
  nationality: string | null;
  reputation: number;
  /** Só vem para o clube do próprio técnico. */
  confidence?: number;
  confidenceReason?: string | null;
  warnings?: number;
  mood?: string;
  moodLabel?: string;
}

/**
 * O treinador de um clube, e a confiança da diretoria nele.
 *
 * Sem desvio offline pelo mesmo motivo dos contratos: a confiança se move no tick semanal, e o motor offline
 * não tem semana. Uma nota parada seria pior que nenhuma, porque pareceria funcionar.
 */
export function getClubManager(clubId: string) {
  return request<ManagerView | null>(`/clubs/${clubId}/manager`);
}

export function getContracts(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetContracts(clubId);
  return request<{
    seasonYear: number;
    players: { playerId: string; contractUntil: number | null; seasonsRemaining: number; costByYears: Record<string, number> }[];
    expiringAnalysis?: CategorizedExpiringContracts;
  }>(`/clubs/${clubId}/contracts`).catch(localFallback(() => localEngine.localGetContracts(clubId)));
}

export function batchRenewContracts(
  clubId: string,
  playerIds: string[],
  optionsOrYears: number | { years?: number; yearsMap?: Record<string, number> } = 2,
) {
  const payload =
    typeof optionsOrYears === 'number'
      ? { playerIds, years: optionsOrYears }
      : { playerIds, years: optionsOrYears.years ?? 2, yearsMap: optionsOrYears.yearsMap };

  if (isOfflineMode()) return localEngine.localBatchRenewContracts(clubId, playerIds, optionsOrYears);
  return request<{
    club: Club;
    totalCost: number;
    renewedCount: number;
    failedPlayerIds: string[];
  }>(`/clubs/${clubId}/contracts/batch-renew`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).catch(localFallback(() => localEngine.localBatchRenewContracts(clubId, playerIds, optionsOrYears)));
}

export function renewPlayerContract(clubId: string, playerId: string, years: number) {
  if (isOfflineMode()) return localEngine.localRenewPlayerContract(clubId, playerId, years);
  return request<{ club: Club; cost: number }>(`/clubs/${clubId}/players/${playerId}/renew`, {
    method: 'POST',
    body: JSON.stringify({ years }),
  }).catch(localFallback(() => localEngine.localRenewPlayerContract(clubId, playerId, years)));
}

export function listFreeAgents(clubId: string, options: { position?: string; limit?: number } = {}) {
  if (isOfflineMode()) return localEngine.localListFreeAgents(clubId, options);
  const query = new URLSearchParams();
  if (options.position) query.set('position', options.position);
  if (options.limit) query.set('limit', String(options.limit));
  const sufixo = query.toString() ? `?${query}` : '';
  return request<{ id: string; player: Player; sinceSeason: number }[]>(`/clubs/${clubId}/free-agents${sufixo}`).catch(localFallback(() => localEngine.localListFreeAgents(clubId, options),));
}

export function signFreeAgent(clubId: string, freeAgentId: string, years?: number) {
  if (isOfflineMode()) return localEngine.localSignFreeAgent(clubId, freeAgentId, years);
  return request<{ club: Club; cost: number; player: Player }>(`/clubs/${clubId}/free-agents/${freeAgentId}/sign`, {
    method: 'POST',
    body: JSON.stringify({ years: years ?? 3 }),
  }).catch(localFallback(() => localEngine.localSignFreeAgent(clubId, freeAgentId, years)));
}

export function crestUrl(slug: string) {
  if (isOfflineMode()) {
    return `/crests/${slug}.png`;
  }
  const base = getApiBase();
  return base ? `${base}/crests/${slug}.png` : `/crests/${slug}.png`;
}


export function createMatch(homeClubId: string, awayClubId: string) {
  return request<Match>('/matches', { method: 'POST', body: JSON.stringify({ homeClubId, awayClubId }) });
}

export function getMatch(id: string) {
  if (isOfflineMode()) return localEngine.localGetMatch(id);
  return request<Match>(`/matches/${id}`).catch(localFallback(() => localEngine.localGetMatch(id)));
}

/** The one match (if any) this club should act on right now — still waiting on a tactic or already live. */
export function getNextMatch(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetNextMatch(clubId);
  return request<Match | null>(`/matches/next/${clubId}`).catch(localFallback(() => localEngine.localGetNextMatch(clubId)));
}

export function submitTactic(matchId: string, tactic: Tactic) {
  if (isOfflineMode()) return localEngine.localSubmitTactic(matchId, tactic);
  return request<Match>(`/matches/${matchId}/tactic`, { method: 'POST', body: JSON.stringify(tactic) }).catch(localFallback(() => localEngine.localSubmitTactic(matchId, tactic)));
}

/**
 * Plays the live match forward to `toMinute` (45 for halftime, 90 for fulltime, or anywhere in between).
 *
 * `interactive` tells the server a manager is watching this tick by tick, so an injury to their side halts
 * the match and comes back as `live.pendingDecision` instead of being substituted for them.
 */
export function advanceLiveMatch(matchId: string, toMinute: number, interactive = true) {
  if (isOfflineMode()) return localEngine.localAdvanceLiveMatch(matchId, toMinute);
  return request<Match>(`/matches/${matchId}/live/advance`, {
    method: 'POST',
    body: JSON.stringify({ toMinute, interactive }),
  }).catch(localFallback(() => localEngine.localAdvanceLiveMatch(matchId, toMinute)));
}

/**
 * Espia os próximos minutos da partida ao vivo sem avançá-la: devolve os lances que o avanço de verdade vai
 * produzir até `toMinute`. Só o campo 2D usa, para ter a bola perto do gol quando o lance for revelado.
 * Qualquer falha (offline, servidor antigo) vira lista vazia: sem espiada o campo só reage ao lance depois.
 */
export async function peekLiveMatch(matchId: string, toMinute: number, interactive = true): Promise<MatchEvent[]> {
  if (isOfflineMode()) return [];
  try {
    const res = await request<{ events?: MatchEvent[] }>(`/matches/${matchId}/live/peek`, {
      method: 'POST',
      body: JSON.stringify({ toMinute, interactive }),
    });
    return Array.isArray(res?.events) ? res.events : [];
  } catch {
    return [];
  }
}

/** Changes one side's tactic/lineup/subs while the live match is paused. */
export function updateLiveMatchTactic(matchId: string, tactic: Tactic) {
  if (isOfflineMode()) return localEngine.localUpdateLiveMatchTactic(matchId, tactic);
  return request<Match>(`/matches/${matchId}/live/tactic`, { method: 'POST', body: JSON.stringify(tactic) }).catch(localFallback(() => localEngine.localUpdateLiveMatchTactic(matchId, tactic)));
}

export function resetLiveMatch(matchId: string) {
  if (isOfflineMode()) return localEngine.localResetLiveMatch(matchId);
  return request<Match>(`/matches/${matchId}/live/reset`, { method: 'POST' }).catch(localFallback(() => localEngine.localResetLiveMatch(matchId)));
}

export interface InjuryDecisionOptions {
  decision: PendingMatchDecision;
  /** Bench players the engine will accept right now — empty when the bench or the changes are spent. */
  candidates: Player[];
  /** Who the touchline would send on; shown highlighted, never applied on its own. */
  suggestedId: string | null;
}

/** Who may come on while play is halted for an injury. */
export function getInjuryDecision(matchId: string) {
  if (isOfflineMode()) return localEngine.localGetInjuryDecision(matchId);
  return request<InjuryDecisionOptions>(`/matches/${matchId}/live/decision`).catch(localFallback(() => localEngine.localGetInjuryDecision(matchId),));
}

/** Answers the halt so the clock can restart. `null` plays on a man short. */
export function resolveInjuryDecision(matchId: string, replacementPlayerId: string | null) {
  if (isOfflineMode()) return localEngine.localResolveInjuryDecision(matchId, replacementPlayerId);
  return request<Match>(`/matches/${matchId}/live/decision`, {
    method: 'POST',
    body: JSON.stringify({ replacementPlayerId }),
  }).catch(localFallback(() => localEngine.localResolveInjuryDecision(matchId, replacementPlayerId)));
}

/**
 * Answers a dismissal. `lineupPlayerIds` is the eleven slots in order, rearranged — the sent-off player
 * included, since where he sits is what marks the position the side gives up. `null` keeps the shape as it
 * was, leaving the hole where he was standing.
 */
export function resolveRedCardDecision(matchId: string, lineupPlayerIds: string[] | null) {
  if (isOfflineMode()) return localEngine.localResolveRedCardDecision(matchId, lineupPlayerIds);
  return request<Match>(`/matches/${matchId}/live/decision/reorganize`, {
    method: 'POST',
    body: JSON.stringify({ lineupPlayerIds }),
  }).catch(localFallback(() => localEngine.localResolveRedCardDecision(matchId, lineupPlayerIds)));
}

export type MatchCompetition =
  | { type: 'league'; name: string; division: number; round: number }
  | { type: 'cup'; name: string; round: number; totalRounds: number };

/** The competition banner (name + round) and every other fixture in this match's round — the live-match
 *  banner and round ticker's data source. Both are null/empty for a bare PvP challenge. */
export function getMatchSiblings(matchId: string) {
  if (isOfflineMode()) return localEngine.localGetMatchSiblings(matchId);
  return request<{ competition: MatchCompetition | null; fixtures: Match[] }>(`/matches/${matchId}/siblings`).catch(localFallback(() => localEngine.localGetMatchSiblings(matchId),));
}

/** Paces a fixture nobody owns forward, in lockstep with the match a human is actually watching. */
export function tickLiveMatch(matchId: string, toMinute: number) {
  if (isOfflineMode()) return localEngine.localTickLiveMatch(matchId, toMinute);
  return request<Match>(`/matches/${matchId}/live/tick`, { method: 'POST', body: JSON.stringify({ toMinute }) }).catch(localFallback(() => localEngine.localTickLiveMatch(matchId, toMinute),));
}

export function listTransferListings() {
  if (isOfflineMode()) return localEngine.localListTransferListings();
  return request<TransferListing[]>('/transfers/listings').catch(localFallback(() => localEngine.localListTransferListings()));
}

export function listPlayerForTransfer(clubId: string, playerId: string, askingPrice: number) {
  return request<TransferListing>('/transfers/listings', {
    method: 'POST',
    body: JSON.stringify({ clubId, playerId, askingPrice }),
  });
}

export function cancelTransferListing(listingId: string) {
  return request<void>(`/transfers/listings/${listingId}`, { method: 'DELETE' });
}

export function buyTransferListing(listingId: string, buyerClubId: string) {
  if (isOfflineMode()) return localEngine.localBuyTransferListing(listingId, buyerClubId);
  return request<void>(`/transfers/listings/${listingId}/buy`, {
    method: 'POST',
    body: JSON.stringify({ buyerClubId }),
  }).catch(localFallback(() => localEngine.localBuyTransferListing(listingId, buyerClubId)));
}

export function payReleaseClause(sellerClubId: string, playerId: string, buyerClubId: string) {
  if (isOfflineMode()) return localEngine.localPayReleaseClause(sellerClubId, playerId, buyerClubId);
  return request<void>('/transfers/release-clause', {
    method: 'POST',
    body: JSON.stringify({ sellerClubId, playerId, buyerClubId }),
  }).catch(localFallback(() => localEngine.localPayReleaseClause(sellerClubId, playerId, buyerClubId)));
}

export function listTransferProposals(clubId: string) {
  if (isOfflineMode()) return localEngine.localListTransferProposals(clubId);
  return request<TransferProposal[]>(`/transfers/proposals?clubId=${clubId}`).catch(localFallback(() => localEngine.localListTransferProposals(clubId)));
}

export function createTransferProposal(params: {
  buyerClubId: string;
  sellerClubId: string;
  targetPlayerId: string;
  cashAmount: number;
  installments: number;
  offeredPlayerIds: string[];
  hasBankGuarantee?: boolean;
}) {
  if (isOfflineMode()) return localEngine.localCreateTransferProposal(params);
  return request<TransferProposal>('/transfers/proposals', { method: 'POST', body: JSON.stringify(params) }).catch(localFallback(() => localEngine.localCreateTransferProposal(params)));
}

export function acceptTransferProposal(proposalId: string) {
  return request<void>(`/transfers/proposals/${proposalId}/accept`, { method: 'POST' });
}

export function rejectTransferProposal(proposalId: string) {
  return request<void>(`/transfers/proposals/${proposalId}/reject`, { method: 'POST' });
}

export function listContinentalTournaments() {
  if (isOfflineMode()) return localEngine.localListContinentalTournaments();
  return request<any[]>('/continental-tournaments').catch(localFallback(() => localEngine.localListContinentalTournaments()));
}


export function withdrawTransferProposal(proposalId: string) {
  return request<void>(`/transfers/proposals/${proposalId}/withdraw`, { method: 'POST' });
}

export function getNationalTeam(teamCode: string) {
  if (isOfflineMode()) return localEngine.localGetNationalTeam(teamCode);
  return request<any>(`/national-teams/${teamCode}`).catch(localFallback(() => localEngine.localGetNationalTeam(teamCode)));
}

export function saveNationalSquad(teamCode: string, playerIds: string[]) {
  if (isOfflineMode()) return localEngine.localSaveNationalSquad(teamCode, playerIds);
  return request<void>(`/national-teams/${teamCode}/squad`, { method: 'POST', body: JSON.stringify({ playerIds }) }).catch(localFallback(() => localEngine.localSaveNationalSquad(teamCode, playerIds)));
}

export function listNationalJobOffers() {
  if (isOfflineMode()) return localEngine.localListNationalJobOffers();
  return request<any[]>('/national-teams/job-offers').catch(localFallback(() => localEngine.localListNationalJobOffers()));
}

export function claimNationalTeamByOffer(offerId: string) {
  if (isOfflineMode()) return localEngine.localClaimNationalTeamByOffer(offerId);
  return request<void>(`/national-teams/job-offers/${offerId}/accept`, { method: 'POST' }).catch(localFallback(() => localEngine.localClaimNationalTeamByOffer(offerId)));
}

export function resignNationalTeam() {
  if (isOfflineMode()) return localEngine.localResignNationalTeam();
  return request<void>('/national-teams/resign', { method: 'POST' }).catch(localFallback(() => localEngine.localResignNationalTeam()));
}


export function getDeadlineDay(clubId: string) {
  if (isOfflineMode()) return Promise.resolve(localEngine.localGetDeadlineDay(clubId));
  return request<DeadlineDayState>(`/transfers/deadline-day?clubId=${encodeURIComponent(clubId)}`).catch(localFallback(() => localEngine.localGetDeadlineDay(clubId)));
}

export function placeDeadlineDayBid(input: {
  auctionId: string;
  buyerClubId: string;
  amount: number;
  wageOffer: number;
}) {
  if (isOfflineMode()) return Promise.resolve(localEngine.localPlaceDeadlineDayBid(input));
  return request<DeadlineDayState>('/transfers/deadline-day/bid', {
    method: 'POST',
    body: JSON.stringify(input),
  }).catch(localFallback(() => localEngine.localPlaceDeadlineDayBid(input)));
}

export function advanceDeadlineDay(clubId: string) {
  if (isOfflineMode()) return Promise.resolve(localEngine.localAdvanceDeadlineDay(clubId));
  return request<DeadlineDayState>('/transfers/deadline-day/advance', {
    method: 'POST',
    body: JSON.stringify({ clubId }),
  }).catch(localFallback(() => localEngine.localAdvanceDeadlineDay(clubId)));
}

export function listScoutingDatabase(country?: string) {
  if (isOfflineMode()) return localEngine.localListScoutingDatabase(country);
  const query = country ? `?country=${country}` : '';
  return request<Array<{ id: string; name: string; country: string; slug: string | null; players: Player[]; stadiumCapacity: number; titlesWon: number }>>(`/transfers/scouting${query}`).catch(localFallback(() => localEngine.localListScoutingDatabase(country),));
}

export function updatePlayerReleaseClause(clubId: string, playerId: string, newReleaseClause: number) {
  if (isOfflineMode()) return localEngine.localUpdateReleaseClause(clubId, playerId, newReleaseClause);
  return request<Club>(`/clubs/${clubId}/release-clause`, {
    method: 'POST',
    body: JSON.stringify({ playerId, newReleaseClause }),
  }).catch(localFallback(() => localEngine.localUpdateReleaseClause(clubId, playerId, newReleaseClause)));
}

export function autoShieldSquadReleaseClauses(clubId: string) {
  if (isOfflineMode()) return localEngine.localAutoShieldReleaseClauses(clubId);
  return request<Club>(`/clubs/${clubId}/auto-shield`, { method: 'POST' }).catch(localFallback(() => localEngine.localAutoShieldReleaseClauses(clubId)));
}

export function listStaffMarket(clubId: string) {
  if (isOfflineMode()) return localEngine.localListStaffMarket(clubId);
  return request<StaffMember[]>(`/clubs/${clubId}/staff-market`).catch(localFallback(() => localEngine.localListStaffMarket(clubId)));
}

export function hireStaff(clubId: string, staff: StaffMember) {
  if (isOfflineMode()) return localEngine.localHireStaff(clubId, staff.id);
  return request<Club>(`/clubs/${clubId}/staff`, {
    method: 'POST',
    body: JSON.stringify(staff),
  }).catch(localFallback(() => localEngine.localHireStaff(clubId, staff.id)));
}

export type LeagueStats = {
  topScorers: PlayerStatsEntry[];
  topAssistants: PlayerStatsEntry[];
};

export function getActiveLeague(clubId: string) {
  if (isOfflineMode()) return localEngine.getActiveLeague(clubId);
  return request<(League & { standings: StandingRow[] }) | null>(`/leagues/active?clubId=${clubId}`).catch(localFallback(() => localEngine.getActiveLeague(clubId)));
}

export function getLeagueStats(leagueId: string): Promise<LeagueStats> {
  if (isOfflineMode()) return localEngine.getLeagueStats(leagueId);
  return request<LeagueStats>(`/leagues/${leagueId}/stats`).catch(localFallback(() => localEngine.getLeagueStats(leagueId)));
}

export function getWorldStats(): Promise<LeagueStats> {
  if (isOfflineMode()) return localEngine.getWorldStats();
  return request<LeagueStats>(`/game/world-stats`).catch(localFallback(() => localEngine.getWorldStats()));
}

export function fireStaff(clubId: string, staffId: string) {
  if (isOfflineMode()) return localEngine.localFireStaff(clubId, staffId);
  return request<Club>(`/clubs/${clubId}/staff/${staffId}`, { method: 'DELETE' }).catch(localFallback(() => localEngine.localFireStaff(clubId, staffId)));
}

export function updateStaffDelegationConfig(clubId: string, config: StaffDelegationConfig): Promise<Club> {
  if (isOfflineMode()) return localEngine.localUpdateStaffDelegation(clubId, config);
  return request<Club>(`/clubs/${clubId}/staff/delegation`, {
    method: 'PUT',
    body: JSON.stringify(config),
  }).catch(localFallback(() => localEngine.localUpdateStaffDelegation(clubId, config)));
}

export function getTacticalAdvice(clubId: string, opponentId?: string) {
  if (isOfflineMode()) return localEngine.localGetTacticalAdvice(clubId, opponentId);
  const query = opponentId ? `?opponentId=${opponentId}` : '';
  // Spelled out inline, this drifted from the report the server actually sends the moment the report grew.
  return request<TacticalAssistantAdvice>(`/clubs/${clubId}/tactical-advice${query}`).catch(localFallback(() => localEngine.localGetTacticalAdvice(clubId, opponentId),));
}

export function getOppositionDossier(clubId: string, opponentId: string) {
  if (isOfflineMode()) return localEngine.localGetOppositionDossier(clubId, opponentId);
  return request<OppositionDossier>(`/clubs/${clubId}/opposition-dossier?opponentId=${opponentId}`).catch(localFallback(() => localEngine.localGetOppositionDossier(clubId, opponentId),));
}

export function autoTrainSquad(clubId: string) {
  if (isOfflineMode()) return localEngine.localAutoTrainSquad(clubId);
  return request<{
    club: Club;
    actions: { playerId: string; playerName: string; focus: string; cost: number; reason: string }[];
    message: string;
  }>(`/clubs/${clubId}/auto-train`, { method: 'POST' }).catch(localFallback(() => localEngine.localAutoTrainSquad(clubId)));
}

export function autoTrainAcademy(clubId: string) {
  if (isOfflineMode()) return localEngine.localAutoTrainAcademy(clubId);
  return request<{
    club: Club;
    actions: { playerId: string; playerName: string; focus: string; cost: number; reason: string }[];
    message: string;
  }>(`/clubs/${clubId}/auto-train-academy`, { method: 'POST' }).catch(localFallback(() => localEngine.localAutoTrainAcademy(clubId)));
}

export function autoPrepareTactics(clubId: string, opponentId?: string) {
  if (isOfflineMode()) return localEngine.localAutoPrepareTactics(clubId);
  return request<{
    club: Club;
    tactic: any;
    message: string;
  }>(`/clubs/${clubId}/auto-tactics`, { method: 'POST', body: JSON.stringify({ opponentId }) }).catch(localFallback(() => localEngine.localAutoPrepareTactics(clubId)));
}

export function trainPlayer(clubId: string, playerId: string, focus?: TrainingFocus | null) {
  if (isOfflineMode()) return localEngine.localTrainPlayer(clubId, playerId, focus ?? null);
  return request<Club>(`/clubs/${clubId}/players/${playerId}/train`, { method: 'POST', body: JSON.stringify({ focus: focus ?? null }) }).catch(localFallback(() => localEngine.localTrainPlayer(clubId, playerId, focus ?? null)));
}

export function setCaptain(clubId: string, playerId: string | null) {
  if (isOfflineMode()) return localEngine.localSetCaptain(clubId, playerId ?? '');
  return request<Club>(`/clubs/${clubId}/captain`, { method: 'POST', body: JSON.stringify({ playerId }) }).catch(localFallback(() => localEngine.localSetCaptain(clubId, playerId ?? '')));
}

export function setTutor(clubId: string, playerId: string | null) {
  if (isOfflineMode()) return localEngine.localSetTutor(clubId, playerId ?? '');
  return request<Club>(`/clubs/${clubId}/tutor`, { method: 'POST', body: JSON.stringify({ playerId }) }).catch(localFallback(() => localEngine.localSetTutor(clubId, playerId ?? '')));
}

export function setPlayerRole(clubId: string, playerId: string, role: PlayerRole, assign: boolean) {
  if (isOfflineMode()) return localEngine.localSetPlayerRole(clubId, playerId, role, assign);
  return request<Club>(`/clubs/${clubId}/player-role`, { method: 'POST', body: JSON.stringify({ playerId, role, assign }) }).catch(localFallback(() => localEngine.localSetPlayerRole(clubId, playerId, role, assign)));
}

export function setPlayerFunctions(clubId: string, playerId: string, functions: PlayerFunction[]) {
  if (isOfflineMode()) return localEngine.localSetPlayerFunctions(clubId, playerId, functions);
  return request<Club>(`/clubs/${clubId}/players/${playerId}/functions`, { method: 'POST', body: JSON.stringify({ functions }) }).catch(localFallback(() => localEngine.localSetPlayerFunctions(clubId, playerId, functions)));
}

export function listTacticPresets(clubId: string) {
  if (isOfflineMode()) return localEngine.localListTacticPresets(clubId);
  return request<TacticPreset[]>(`/clubs/${clubId}/tactic-presets`).catch(localFallback(() => localEngine.localListTacticPresets(clubId)));
}

export function saveTacticPreset(clubId: string, name: string, tactic: Tactic) {
  if (isOfflineMode()) return localEngine.localSaveTacticPreset(clubId, { name, tactic });
  return request<TacticPreset>(`/clubs/${clubId}/tactic-presets`, {
    method: 'POST',
    body: JSON.stringify({ name, tactic }),
  }).catch(localFallback(() => localEngine.localSaveTacticPreset(clubId, { name, tactic })));
}

export function deleteTacticPreset(clubId: string, presetId: string) {
  if (isOfflineMode()) return localEngine.localDeleteTacticPreset(clubId, presetId);
  return request<void>(`/clubs/${clubId}/tactic-presets/${presetId}`, { method: 'DELETE' }).catch(localFallback(() => localEngine.localDeleteTacticPreset(clubId, presetId)));
}

export function setDefaultTacticPreset(clubId: string, presetId: string) {
  if (isOfflineMode()) return localEngine.localSetDefaultTacticPreset(clubId, presetId);
  return request<TacticPreset>(`/clubs/${clubId}/tactic-presets/${presetId}/default`, { method: 'POST' }).catch(localFallback(() => localEngine.localSetDefaultTacticPreset(clubId, presetId)));
}

export function setRoundTactic(clubId: string, tactic: Tactic) {
  if (isOfflineMode()) return localEngine.localSetRoundTactic(clubId, tactic);
  return request<Club>(`/clubs/${clubId}/round-tactic`, { method: 'POST', body: JSON.stringify(tactic) }).catch(localFallback(() => localEngine.localSetRoundTactic(clubId, tactic)));
}

export function clearRoundTactic(clubId: string) {
  if (isOfflineMode()) return localEngine.localClearRoundTactic(clubId);
  return request<Club>(`/clubs/${clubId}/round-tactic`, { method: 'DELETE' }).catch(localFallback(() => localEngine.localClearRoundTactic(clubId)));
}

export interface GameStateView {
  currentDate: string;
  seasonYear: number;
  phase: 'PRE_SEASON' | 'IN_SEASON' | 'OFF_SEASON';
  lastWeeklyTickDate: string | null;
  seasonStartDate: string;
  seasonEndDate: string;
}

export function getGameState() {
  if (isOfflineMode()) return localEngine.localGetGameState();
  return request<GameStateView>('/game/state').catch(localFallback(() => localEngine.localGetGameState()));
}

export function getDetailedGameState() {
  if (isOfflineMode()) return Promise.resolve(localEngine.loadLocalGameState());
  return request<any>('/game/detailed-state').catch(localFallback(() => localEngine.loadLocalGameState()));
}


export interface CalendarEntry {
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

export interface ScheduledRound {
  kind: 'LEAGUE' | 'CUP';
  competitionId: string;
  competitionName: string;
  round: number;
  date: string;
}

export interface MatchdayOutcome {
  date: string;
  seasonYear: number;
  played: ScheduledRound[];
  matchId: string | null;
  /** O clube perdido nesta passagem, quando a diretoria demitiu o técnico. */
  sackedFromClubId: string | null;
}

export function getNextMatchday() {
  if (isOfflineMode()) return localEngine.localGetNextMatchday();
  return request<ScheduledRound | null>('/game/next-matchday').catch(localFallback(() => localEngine.localGetNextMatchday()));
}

export function advanceMatchday(clubId?: string) {
  if (isOfflineMode()) return localEngine.localAdvanceMatchday();
  return request<MatchdayOutcome>('/game/advance', {
    method: 'POST',
    body: clubId ? JSON.stringify({ clubId }) : undefined,
  }).catch(localFallback(() => localEngine.localAdvanceMatchday()));
}

export function fastAdvanceToNextMatch(clubId?: string) {
  if (isOfflineMode()) return localEngine.localFastAdvanceToNextMatch(clubId);
  return request<import('@tactical-arena/shared').FastAdvanceResult>(`/game/fast-advance${clubId ? `?clubId=${clubId}` : ''}`, { method: 'POST' }).catch(localFallback(() => localEngine.localFastAdvanceToNextMatch(clubId)));
}


export function getClubCalendar(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetClubCalendar(clubId);
  return request<{ clubId: string; seasonYear: number | null; entries: CalendarEntry[] }>(
    `/game/calendar?clubId=${clubId}`,
  ).catch(localFallback(() => localEngine.localGetClubCalendar(clubId)));
}



export function listLeagues(country?: string, division?: number) {
  if (isOfflineMode()) return localEngine.localListLeagues(country, division);
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  if (division !== undefined) params.set('division', String(division));
  const query = params.toString();
  return request<League[]>(`/leagues${query ? `?${query}` : ''}`).catch(localFallback(() => localEngine.localListLeagues(country, division)));
}

export function getLeague(leagueId: string) {
  if (isOfflineMode()) return localEngine.localGetLeagueById(leagueId);
  return request<League & { standings: StandingRow[] }>(`/leagues/${leagueId}`).catch(localFallback(() => localEngine.localGetLeagueById(leagueId)));
}


export function forceStartLeague(leagueId: string) {
  return request<League>(`/leagues/${leagueId}/force-start`, { method: 'POST' });
}

export function advanceLeagueRound(leagueId: string) {
  return request<League>(`/leagues/${leagueId}/advance-round`, { method: 'POST' });
}

export function listCups(country?: string) {
  if (isOfflineMode()) return localEngine.localListCups(country);
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  const query = params.toString();
  return request<Cup[]>(`/cups${query ? `?${query}` : ''}`).catch(localFallback(() => localEngine.localListCups(country)));
}

export function getCup(cupId: string) {
  if (isOfflineMode()) return localEngine.localGetCupById(cupId);
  return request<Cup>(`/cups/${cupId}`).catch(localFallback(() => localEngine.localGetCupById(cupId)));
}


export function createCup(name: string, countryCode: string, clubIds: string[]) {
  return request<Cup>('/cups', { method: 'POST', body: JSON.stringify({ name, countryCode, clubIds }) });
}

export function createOfficialCopaDoBrasil(season?: number) {
  return request<Cup>('/cups/copa-do-brasil', { method: 'POST', body: JSON.stringify({ season }) });
}

export function advanceCupRound(cupId: string) {
  return request<Cup>(`/cups/${cupId}/advance-round`, { method: 'POST' });
}

export function promoteAcademyPlayer(clubId: string, playerId: string) {
  if (isOfflineMode()) return localEngine.localPromoteAcademyPlayer(clubId, playerId);
  return request<Club>(`/clubs/${clubId}/academy/${playerId}/promote`, { method: 'POST' }).catch(localFallback(() => localEngine.localPromoteAcademyPlayer(clubId, playerId),));
}

export function releaseAcademyPlayer(clubId: string, playerId: string) {
  if (isOfflineMode()) return localEngine.localReleaseAcademyPlayer(clubId, playerId);
  return request<Club>(`/clubs/${clubId}/academy/${playerId}/release`, { method: 'POST' }).catch(localFallback(() => localEngine.localReleaseAcademyPlayer(clubId, playerId),));
}

/** `focus` is optional — omitted, the session still buys development points, just with no attribute nudge. */
export function trainAcademyPlayer(clubId: string, playerId: string, focus?: TrainingFocus | null) {
  if (isOfflineMode()) return localEngine.localTrainAcademyPlayer(clubId, playerId, focus ?? null);
  return request<Club>(`/clubs/${clubId}/academy/${playerId}/train`, {
    method: 'POST',
    body: JSON.stringify({ focus: focus ?? null }),
  }).catch(localFallback(() => localEngine.localTrainAcademyPlayer(clubId, playerId, focus ?? null)));
}

export function getSponsorshipOffers(clubId: string) {
  if (isOfflineMode()) return localEngine.localSponsorshipOffers(clubId);
  return request<Sponsorship[]>(`/clubs/${clubId}/finance/sponsorship-offers`).catch(localFallback(() => localEngine.localSponsorshipOffers(clubId),));
}

export function signSponsorship(clubId: string, offer: Sponsorship) {
  if (isOfflineMode()) return localEngine.localSignSponsorship(clubId, offer);
  return request<Club>(`/clubs/${clubId}/finance/sponsorships`, { method: 'POST', body: JSON.stringify(offer) });
}

export function takeLoan(clubId: string, amount: number, planKey: LoanPlanKey) {
  return request<Club>(`/clubs/${clubId}/finance/loans`, { method: 'POST', body: JSON.stringify({ amount, planKey }) });
}

export function getStadiumPreview(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetStadiumPreview(clubId);
  return request<StadiumUpgradePreview>(`/clubs/${clubId}/stadium/preview`).catch(localFallback(() => localEngine.localGetStadiumPreview(clubId)));
}

export function upgradeStadium(clubId: string) {
  if (isOfflineMode()) return localEngine.localUpgradeStadium(clubId);
  return request<Club>(`/clubs/${clubId}/stadium/upgrade`, { method: 'POST' }).catch(localFallback(() => localEngine.localUpgradeStadium(clubId)));
}

export function getHistory() {
  if (isOfflineMode()) return localEngine.localGetHistory();
  return request<CountryHistory[]>('/history').catch(localFallback(() => localEngine.localGetHistory()));
}

export function getHallOfFame(clubId?: string) {
  if (isOfflineMode()) return localEngine.localGetHallOfFame(clubId);
  return request<HallOfFameData>('/history/hall-of-fame').catch(localFallback(() => localEngine.localGetHallOfFame(clubId),));
}

export function resignClub(clubId: string) {
  if (isOfflineMode()) return localEngine.localResignClub(clubId);
  return request<Club>(`/clubs/${clubId}/resign`, { method: 'POST' }).catch(localFallback(() => localEngine.localResignClub(clubId)));
}

export interface CareerTenure {
  clubId: string;
  clubName: string;
  countryCode: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
}

export interface CareerTitle {
  type: 'league' | 'cup';
  name: string;
  season: number;
  division?: number;
}

export interface Career {
  tenures: CareerTenure[];
  titles: CareerTitle[];
  activeClubIds: string[];
}

export function getCareer() {
  if (isOfflineMode()) return localEngine.localGetCareer();
  return request<Career>('/career').catch(localFallback(() => localEngine.localGetCareer()));
}

export interface JobOffer {
  id: string;
  clubId: string;
  clubName: string;
  createdAt: string;
}

export interface ApproachView {
  id: string;
  clubId: string;
  clubName: string;
  clubCountry: string;
  /** Estatura do clube interessado, para comparar com o clube atual. */
  visibility: number;
  division: number;
  /** Verdadeiro quando o modo de carreira não deixa aceitar. */
  locked: boolean;
  lockReason: string | null;
  createdAt: string;
}

/**
 * Sondagens: clubes que querem o técnico enquanto ele ainda tem emprego.
 *
 * Sem desvio offline, pelo mesmo motivo dos contratos e da confiança — a sondagem nasce quando uma vaga
 * abre no tick semanal, e o motor offline não tem semana. Devolver lista vazia é a resposta honesta.
 */
export function getApproaches() {
  if (isOfflineMode()) return Promise.resolve([] as ApproachView[]);
  return request<ApproachView[]>('/career/approaches').catch(() => [] as ApproachView[]);
}

export function acceptApproach(id: string) {
  return request<Club>(`/career/approaches/${id}/accept`, { method: 'POST' });
}

export function declineApproach(id: string) {
  return request<{ ok: boolean }>(`/career/approaches/${id}/decline`, { method: 'POST' });
}

export function getJobOffers() {
  if (isOfflineMode()) return localEngine.localGetJobOffers();
  return request<JobOffer[]>('/career/offers').catch(localFallback(() => localEngine.localGetJobOffers()));
}

export function acceptJobOffer(offerId: string) {
  if (isOfflineMode()) return localEngine.localAcceptJobOffer(offerId);
  return request<Club>(`/career/offers/${offerId}/accept`, { method: 'POST' });
}

/** Whether this server is a packaged desktop build — the only place the team editor is allowed to run
 *  (see requireDesktopMode server-side, the real gate; this just decides whether to show the entry point). */
export function getGameConfig() {
  if (isOfflineMode()) return Promise.resolve({ desktopMode: false });
  return request<{ desktopMode: boolean }>('/config').catch(() => ({ desktopMode: false }));
}


export interface PlayerEditPatch {
  name?: string;
  age?: number;
  nationality?: string;
  position?: Position;
  preferredFoot?: PreferredFoot;
  attributes?: Partial<PlayerAttributes>;
}

export interface NewPlayerInput {
  name: string;
  age: number;
  nationality: string;
  position: Position;
  preferredFoot: PreferredFoot;
  attributes: PlayerAttributes;
}

export interface NewEditorClubInput {
  name: string;
  slug: string;
  country: string;
  division: number;
}

/** Every club in the save, not just "mine" or the unclaimed pool — the editor curates the whole database. */
export function listAllClubsForEditor() {
  if (isOfflineMode()) {
    return localEngine.localListAllClubsForEditor();
  }
  return request<Club[]>('/team-editor/clubs').catch(localFallback(() => localEngine.localListAllClubsForEditor()));
}

export function updateEditorPlayer(clubId: string, playerId: string, patch: PlayerEditPatch) {
  return request<Club>(`/team-editor/clubs/${clubId}/players/${playerId}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function createEditorPlayer(clubId: string, input: NewPlayerInput) {
  return request<Club>(`/team-editor/clubs/${clubId}/players`, { method: 'POST', body: JSON.stringify(input) });
}

export function deleteEditorPlayer(clubId: string, playerId: string) {
  return request<Club>(`/team-editor/clubs/${clubId}/players/${playerId}`, { method: 'DELETE' });
}

export function moveEditorTransfer(playerId: string, fromClubId: string, toClubId: string) {
  return request<{ from: Club; to: Club }>('/team-editor/transfers', {
    method: 'POST',
    body: JSON.stringify({ playerId, fromClubId, toClubId }),
  });
}

export function createEditorClub(input: NewEditorClubInput) {
  return request<Club>('/team-editor/clubs', { method: 'POST', body: JSON.stringify(input) });
}

export function updateEditorClubIdentity(clubId: string, patch: any) {
  return request<Club>(`/team-editor/clubs/${clubId}/identity`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function autoGenerateEditorSquad(clubId: string) {
  return request<Club>(`/team-editor/clubs/${clubId}/autosquad`, { method: 'POST' });
}

export function uploadEditorCrest(slug: string, base64Png: string) {
  if (isOfflineMode()) return localEngine.localUploadEditorCrest(slug, base64Png);
  return request<void>(`/team-editor/clubs/${slug}/crest`, { method: 'POST', body: JSON.stringify({ base64Png }) }).catch(localFallback(() => localEngine.localUploadEditorCrest(slug, base64Png),));
}

export function exportModPack() {
  return request<ModPack>('/team-editor/export');
}

export function importModPack(pack: ModPack) {
  return request<ModPackImportResult>('/team-editor/import', { method: 'POST', body: JSON.stringify(pack) });
}

export type ClockFormat = 'HALF_45' | 'FULL_90';

export interface ManagerProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string;
  style: string;
  avatar: string;
  clockFormat?: ClockFormat;
  /** O modo de carreira, que decide o que a tela libera. Ver gameMode.ts no shared. */
  gameMode?: GameMode;
  birthYear?: number;
}

export interface SaveSlot {
  id: string;
  name: string;
  fileName: string;
  managerFirstName?: string;
  managerLastName?: string;
  managerName?: string;
  managerNationality?: string;
  managerStyle?: string;
  managerAvatar?: string;
  clockFormat?: ClockFormat;
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

export interface CreateSaveParams {
  name?: string;
  managerFirstName?: string;
  managerLastName?: string;
  managerNationality?: string;
  managerStyle?: string;
  managerAvatar?: string;
  clockFormat?: ClockFormat;
  /** O modo de carreira, escolhido na criação e imutável depois. Ver gameMode.ts no shared. */
  gameMode?: GameMode;
}

export function listSaves() {
  if (isOfflineMode()) return localEngine.localListSaves() as any;
  return request<{ currentSaveId: string; currentManager: ManagerProfile | null; saves: SaveSlot[] }>('/saves').catch(
    () => localEngine.localListSaves() as any
  );
}

export function createNewSave(params: CreateSaveParams | string) {
  if (isOfflineMode()) return localEngine.localCreateNewSave(params) as any;
  const existingToken = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const existingUserId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;
  const body = typeof params === 'string' ? { name: params } : params;
  return request<{
    ok: boolean;
    save: SaveSlot;
    token?: string;
    userId?: string;
  }>('/saves/new', {
    method: 'POST',
    body: JSON.stringify(body),
  })
    .then((res) => {
      if (res.token) localStorage.setItem('token', res.token);
      if (res.userId) localStorage.setItem('userId', res.userId);
      return res;
    })
    .catch(async () => {
      const fallback = (await localEngine.localCreateNewSave(params)) as any;
      const base = getApiBase();
      if (existingToken && !existingToken.startsWith('local-token')) {
        const check = await fetch(`${base}/clubs`, {
          headers: { Authorization: `Bearer ${existingToken}` },
        }).catch(() => null);
        if (check && check.ok) {
          localStorage.setItem('token', existingToken);
          if (existingUserId) localStorage.setItem('userId', existingUserId);
          setOfflineMode(false);
          return {
            ...fallback,
            token: existingToken,
            userId: existingUserId ?? fallback.userId,
          };
        }
      }
      const autoAuth = await ensureServerAuthSession(base);
      if (autoAuth) {
        return {
          ...fallback,
          token: autoAuth.token,
          userId: autoAuth.userId,
        };
      }
      return fallback;
    });
}

export function loadSave(id: string) {
  if (isOfflineMode()) return localEngine.localLoadSave(id) as any;
  return request<{ ok: boolean; save: SaveSlot; token?: string; userId?: string; claimedClubId?: string }>(`/saves/${id}/load`, {
    method: 'POST',
  })
    .then((res) => {
      if (res.token) localStorage.setItem('token', res.token);
      if (res.userId) localStorage.setItem('userId', res.userId);
      return res;
    })
    .catch(localFallback(() => localEngine.localLoadSave(id) as any));
}


export function renameSave(id: string, name: string) {
  return request<{ ok: boolean; save: SaveSlot }>(`/saves/${id}/rename`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function deleteSave(id: string) {
  return request<{ ok: boolean }>(`/saves/${id}`, {
    method: 'DELETE',
  });
}

export function duplicateSave(id: string, name?: string) {
  return request<{ ok: boolean; save: SaveSlot }>(`/saves/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function getClubTrophyRoom(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetClubTrophyRoom(clubId) as any;
  return request<any>(`/clubs/${clubId}/trophy-room`).catch(
    () => localEngine.localGetClubTrophyRoom(clubId) as any
  );
}

export async function getCareerTrophyRoom() {
  if (isOfflineMode()) return localEngine.localGetCareerTrophyRoom() as any;
  return request<any>('/career/trophy-room').catch(
    () => localEngine.localGetCareerTrophyRoom() as any
  );
}

export async function createPressConference(clubId: string, type: string, trigger: any) {
  if (isOfflineMode()) return localEngine.localCreatePressConference(clubId, 'local_manager_1', type as any, trigger) as any;
  return request<any>('/press-conferences', { method: 'POST', body: JSON.stringify({ clubId, type, trigger }) });
}

export async function getPressConferenceHistory(clubId: string, limit = 10) {
  if (isOfflineMode()) return localEngine.localGetPressConferenceHistory(clubId, limit) as any;
  return request<any>(`/press-conferences/history/${clubId}?limit=${limit}`);
}

export async function getPressConferenceById(id: string) {
  if (isOfflineMode()) return localEngine.localGetPressConferenceById(id) as any;
  return request<any>(`/press-conferences/${id}`);
}

export async function submitPressConferenceAnswers(id: string, responses: any[], delegationOption?: string) {
  if (isOfflineMode()) return localEngine.localSubmitPressConferenceAnswers(id, 'local_manager_1', responses, delegationOption as any) as any;
  return request<any>(`/press-conferences/${id}/submit`, { method: 'POST', body: JSON.stringify({ responses, delegationOption }) });
}

export type { Loan, Sponsorship };



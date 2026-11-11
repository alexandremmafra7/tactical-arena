import { randomUUID } from 'node:crypto';
import {
  applyMatchMembershipImpact,
  applyAutomatedMedicalCare,
  calculateInitialMembers,
  membershipCeiling,
  applyCommitment,
  applySquadHarmony,
  calculateStoppageTime,
  Club,
  COUNTRIES,
  DEFAULT_STAFF_DELEGATION_CONFIG,
  LiveMatchState,
  MATCH_MINUTES,
  Match,
  MatchEvent,
  MatchCompetitionType,
  FormResult,
  MatchResult,
  MatchSide,
  MatchWeather,
  PRESSING_MODIFIERS,
  PendingMatchDecision,
  Player,
  Tactic,
  applyForcedSubstitution,
  availableReplacements,
  derivePossession,
  fatigueOverloadMultiplier,
  hashSeed,
  matchDevelopmentPoints,
  minutesPlayedByPlayerId,
  missingPlayerMinutes,
  pressingOf,
  resolveLineupPlayers,
  fixtureWeatherKey,
  weatherFactors,
  weatherFor,
  resumableRngFromState,
  simulateMatch,
  simulateMatchSegment,
  suggestedReplacement,
  validateSubstitutesAndPlan,
  resolveMatchBroadcaster,
  calculateMatchBroadcastPayout,
  calculateCombatPerformanceBonus,
  getAutomatedMedicalCareSettings,
  BOT_OWNER_ID,
  BroadcasterChannel,
  type MedicalRecovery,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub } from './clubService.js';
import { updateSuspensions } from './suspensionService.js';
import { getManagerStyle } from './managerStyleService.js';
import { updateInjuries } from './injuryService.js';
import { applyMoraleAndFatigue, matchMoraleDelta } from './moraleService.js';
import { generateMatchNews, generateMedicalRecoveryNews } from './newsService.js';
import { evaluateMatchStaffRecords } from './staffRecordService.js';
import { getGameState } from './gameStateService.js';

export class MatchError extends Error {}

/** Live state persisted before the extended stats (shots on target, corners, fouls, possession) existed
 *  won't have them in the stored JSON — default those to 0 (50/50 for possession) so nothing downstream
 *  ever has to guard against `undefined`. */
function normalizeLiveState(live: LiveMatchState): LiveMatchState {
  return {
    ...live,
    homeShotsOnTarget: live.homeShotsOnTarget ?? 0,
    awayShotsOnTarget: live.awayShotsOnTarget ?? 0,
    homeCorners: live.homeCorners ?? 0,
    awayCorners: live.awayCorners ?? 0,
    homeFouls: live.homeFouls ?? 0,
    awayFouls: live.awayFouls ?? 0,
    homePressRecoveries: live.homePressRecoveries ?? 0,
    awayPressRecoveries: live.awayPressRecoveries ?? 0,
    homeGoalsFromPressRecovery: live.homeGoalsFromPressRecovery ?? 0,
    awayGoalsFromPressRecovery: live.awayGoalsFromPressRecovery ?? 0,
    homeXg: live.homeXg ?? 0,
    awayXg: live.awayXg ?? 0,
    homeBigChances: live.homeBigChances ?? 0,
    awayBigChances: live.awayBigChances ?? 0,
    homeSaves: live.homeSaves ?? 0,
    awaySaves: live.awaySaves ?? 0,
    homeWoodwork: live.homeWoodwork ?? 0,
    awayWoodwork: live.awayWoodwork ?? 0,
    homeBlockedShots: live.homeBlockedShots ?? 0,
    awayBlockedShots: live.awayBlockedShots ?? 0,
    homePossession: live.homePossession ?? 50,
    awayPossession: live.awayPossession ?? 50,
    pendingDecision: live.pendingDecision ?? null,
  };
}

/**
 * Every roster-affecting consequence of a simulated match (suspensions, injuries, morale, fatigue, coach
 * commitment, dressing-room harmony), computed from the same pre-match snapshot and written back in a
 * single update per club — layering these as separate writes each starting from that snapshot would let a
 * later one silently clobber an earlier one.
 */
/**
 * What a match did to the two squads, without saving it.
 *
 * Split from the writing because a background round plays ten of these at once, and paying two database
 * round trips per fixture is what made a matchday across a world of leagues unaffordable: measured at
 * 27.7 ms a match, of which the simulation itself is 0.62 ms. The caller decides when to persist, so a
 * whole round can go back in one go (see `playLeagueRound`).
 */
export function computePostMatchRosters(
  homeClub: Club,
  awayClub: Club,
  homeTactic: Tactic,
  awayTactic: Tactic,
  result: MatchResult,
  competitionId: string | null,
  /** O tempo do jogo. Ausente é seco, que não cobra nada a mais das pernas. */
  weather: MatchWeather = 'DRY',
): { homePlayers: Player[]; awayPlayers: Player[] } {
  // Two separate bills on the same legs. Covering the same pitch with fewer men costs the survivors extra,
  // so a red card keeps hurting into the *next* fixture too (numericalDisadvantage.ts); and pressing high is
  // the most physically expensive way to defend, where a low block lets players rest (PRESSING_MODIFIERS) —
  // which is what stops a high press from being a free upgrade you leave switched on all season.
  //
  // O calor é a terceira conta na mesma cadeia: joga-se o mesmo futebol, custa mais caro. Ele sobe também
  // a chance de lesão sem uma linha a mais, porque `injuryProbability` já lê a fadiga média do time.
  const conditions = weatherFactors(weather);
  const homeOverload =
    fatigueOverloadMultiplier(missingPlayerMinutes(result.events, 'home')) *
    PRESSING_MODIFIERS[pressingOf(homeTactic)].fatigue *
    conditions.fatigue;
  const awayOverload =
    fatigueOverloadMultiplier(missingPlayerMinutes(result.events, 'away')) *
    PRESSING_MODIFIERS[pressingOf(awayTactic)].fatigue *
    conditions.fatigue;

  const homeStyle = getManagerStyle(homeClub.ownerId);
  const awayStyle = getManagerStyle(awayClub.ownerId);

  const homePlayers = applySquadHarmony(
    applyCommitment(
      applyMoraleAndFatigue(
        updateInjuries(updateSuspensions(homeClub.players, result.events, competitionId), result.events),
        homeTactic,
        matchMoraleDelta(result.homeGoals, result.awayGoals, homeStyle),
        homeOverload,
      ),
      homeTactic,
    ),
    homeTactic,
    homeClub.tutorPlayerId,
  );
  const awayPlayers = applySquadHarmony(
    applyCommitment(
      applyMoraleAndFatigue(
        updateInjuries(updateSuspensions(awayClub.players, result.events, competitionId), result.events),
        awayTactic,
        matchMoraleDelta(result.awayGoals, result.homeGoals, awayStyle),
        awayOverload,
      ),
      awayTactic,
    ),
    awayTactic,
    awayClub.tutorPlayerId,
  );

  /**
   * Minutes on the pitch develop a footballer — for every club in the world, not just the one a human runs.
   *
   * `developmentPoints` used to come only from the manager pressing "treinar", so every player outside
   * their squad earned nothing, ever. With the world running its own leagues in the background that would
   * leave the entire opposition frozen at its starting overall while the manager's squad pulled away.
   * Awarding it here, in the hook both the watched and the result-only path already run, is what keeps one
   * rule applying to everyone (see `matchDevelopmentPoints`).
   */
  const withMatchDevelopment = (players: Player[], tactic: Tactic, managerStyle?: string | null): Player[] => {
    const minutes = minutesPlayedByPlayerId(tactic);
    return players.map((player) => {
      const played = minutes.get(player.id) ?? 0;
      if (played <= 0) return player;
      return {
        ...player,
        developmentPoints: player.developmentPoints + matchDevelopmentPoints(player.age, played, managerStyle),
      };
    });
  };

  return {
    homePlayers: withMatchDevelopment(homePlayers, homeTactic, homeStyle),
    awayPlayers: withMatchDevelopment(awayPlayers, awayTactic, awayStyle),
  };
}

/** Computes and saves in one step — the watched path, where matches arrive one at a time. */
async function applyPostMatchRosterUpdates(
  homeClub: Club,
  awayClub: Club,
  homeTactic: Tactic,
  awayTactic: Tactic,
  result: MatchResult,
  competitionId: string | null,
  weather: MatchWeather = 'DRY',
): Promise<{ homeRecoveries: MedicalRecovery[]; awayRecoveries: MedicalRecovery[] }> {
  const { homePlayers, awayPlayers } = computePostMatchRosters(
    homeClub,
    awayClub,
    homeTactic,
    awayTactic,
    result,
    competitionId,
    weather,
  );

  const applyCare = (club: Club, players: Player[]) => {
    if (club.ownerId === BOT_OWNER_ID) return { players, recoveries: [] };
    const settings = getAutomatedMedicalCareSettings(club);
    if (!settings) return { players, recoveries: [] };
    const care = applyAutomatedMedicalCare({ ...club, players }, settings.chiefDoctorRating, settings.mode);
    return { players: care.club.players, recoveries: care.recoveries };
  };

  const homeMedical = applyCare(homeClub, homePlayers);
  const awayMedical = applyCare(awayClub, awayPlayers);
  await prisma.club.update({ where: { id: homeClub.id }, data: { playersJson: JSON.stringify(homeMedical.players) } });
  await prisma.club.update({ where: { id: awayClub.id }, data: { playersJson: JSON.stringify(awayMedical.players) } });

  return {
    homeRecoveries: homeMedical.recoveries,
    awayRecoveries: awayMedical.recoveries,
  };
}

export async function createMatch(homeClubId: string, awayClubId: string): Promise<Match> {
  if (homeClubId === awayClubId) {
    throw new MatchError('Um clube não pode desafiar a si mesmo');
  }

  // Ensure both clubs exist before creating the match.
  await getClub(homeClubId);
  await getClub(awayClubId);

  const id = randomUUID();
  const seed = randomUUID();

  await prisma.match.create({
    data: { id, homeClubId, awayClubId, seed, status: 'WAITING_TACTICS' },
  });

  return { id, homeClubId, awayClubId, seed, status: 'WAITING_TACTICS' };
}

/**
 * The one match (if any) this club should act on right now: still waiting on a tactic (either side,
 * including this club) or already under way — never a finished or stale past-round one.
 */
export async function getNextActionableMatch(clubId: string): Promise<Match | null> {
  // 1. Check active in-progress leagues first to pick the exact current round
  const leagueRecords = await prisma.league.findMany({
    where: { status: 'IN_PROGRESS' },
  });

  for (const lr of leagueRecords) {
    const clubIds: string[] = JSON.parse(lr.clubIdsJson);
    if (!clubIds.includes(clubId)) continue;

    const fixtures: Array<{ round: number; homeClubId: string; awayClubId: string; matchId: string | null }> = JSON.parse(
      lr.fixturesJson,
    );
    const matchesForClub = fixtures.filter(
      (f) => f.matchId !== null && (f.homeClubId === clubId || f.awayClubId === clubId),
    );
    const maxRoundWithMatch = matchesForClub.reduce((max, f) => Math.max(max, f.round), 0);

    if (maxRoundWithMatch > 0) {
      // Auto-resolve any abandoned live matches from older rounds
      for (const f of fixtures) {
        if (f.round < maxRoundWithMatch && f.matchId) {
          await tickLiveMatchSystem(f.matchId).catch(() => null);
        }
      }

      const activeFixture = matchesForClub.find((f) => f.round === maxRoundWithMatch);
      if (activeFixture?.matchId) {
        const matchRecord = await prisma.match.findUnique({ where: { id: activeFixture.matchId } });
        if (matchRecord && matchRecord.status !== 'SIMULATED') {
          return toDomain(matchRecord);
        }
      }
    }
  }

  // 2. Fallback to latest unsimulated match
  const record = await prisma.match.findFirst({
    where: {
      OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
      status: { in: ['WAITING_TACTICS', 'LIVE'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  return record ? toDomain(record) : null;
}

/**
 * The club's last `limit` finished results, oldest first — the V-E-D-V-V strip on the dashboard.
 *
 * Read straight off the Match table rather than walking a league's fixtures, so cup ties count too and one
 * query covers a club playing in several competitions at once.
 */
/**
 * Move os sócios dos dois clubes conforme o placar.
 *
 * Um clássico entre dois clubes grandes mexe mais que um jogo qualquer: `isHighProfile` liga quando os dois
 * têm torcida de porte, e aí a vitória vale quase o dobro.
 */
async function applyMembershipAfterMatch(
  homeClub: { id: string; stadiumCapacity: number; membersCount?: number | null; players: unknown[] },
  awayClub: { id: string; stadiumCapacity: number; membersCount?: number | null; players: unknown[] },
  result: { homeGoals: number; awayGoals: number },
): Promise<void> {
  const socios = (club: typeof homeClub) =>
    club.membersCount ?? calculateInitialMembers(club as never, 1);

  const daCasa = socios(homeClub);
  const deFora = socios(awayClub);
  const grande = daCasa >= 45_000 && deFora >= 45_000;

  const resultado = (golsPro: number, golsContra: number) =>
    golsPro > golsContra ? ('WIN' as const) : golsPro === golsContra ? ('DRAW' as const) : ('LOSS' as const);

  const novoCasa = applyMatchMembershipImpact(
    daCasa, resultado(result.homeGoals, result.awayGoals), grande, membershipCeiling(homeClub.stadiumCapacity),
  ).newMembers;
  const novoFora = applyMatchMembershipImpact(
    deFora, resultado(result.awayGoals, result.homeGoals), grande, membershipCeiling(awayClub.stadiumCapacity),
  ).newMembers;

  await prisma.$transaction([
    prisma.club.update({ where: { id: homeClub.id }, data: { membersCount: novoCasa } }),
    prisma.club.update({ where: { id: awayClub.id }, data: { membersCount: novoFora } }),
  ]);
}

async function applyBroadcastFacilityFeeAfterMatch(
  homeClub: { id: string },
  awayClub: { id: string },
  broadcaster?: BroadcasterChannel,
): Promise<void> {
  if (!broadcaster || !broadcaster.facilityFeeBonus || broadcaster.facilityFeeBonus <= 0) return;

  const homePayout = calculateMatchBroadcastPayout(broadcaster, true);
  const awayPayout = calculateMatchBroadcastPayout(broadcaster, false);

  if (homePayout > 0 || awayPayout > 0) {
    await prisma.$transaction([
      prisma.club.update({ where: { id: homeClub.id }, data: { budget: { increment: homePayout } } }),
      prisma.club.update({ where: { id: awayClub.id }, data: { budget: { increment: awayPayout } } }),
    ]);
  }
}

async function applyCombatBonusAfterMatch(
  homeClub: Club,
  awayClub: Club,
  result: MatchResult,
): Promise<void> {
  const homeAvg =
    homeClub.players.length > 0 ? homeClub.players.reduce((s, p) => s + p.overall, 0) / homeClub.players.length : 0;
  const awayAvg =
    awayClub.players.length > 0 ? awayClub.players.reduce((s, p) => s + p.overall, 0) / awayClub.players.length : 0;

  const homeBonus = calculateCombatPerformanceBonus({
    events: result.events,
    mySide: 'home',
    myGoals: result.homeGoals,
    opponentGoals: result.awayGoals,
    pressRecoveries: result.stats?.home?.pressRecoveries ?? 0,
    isUnderdog: homeAvg < awayAvg - 3,
  });

  const awayBonus = calculateCombatPerformanceBonus({
    events: result.events,
    mySide: 'away',
    myGoals: result.awayGoals,
    opponentGoals: result.homeGoals,
    pressRecoveries: result.stats?.away?.pressRecoveries ?? 0,
    isUnderdog: awayAvg < homeAvg - 3,
  });

  const updates = [];
  if (homeBonus.totalBonus > 0) {
    updates.push(
      prisma.club.update({
        where: { id: homeClub.id },
        data: { budget: { increment: homeBonus.totalBonus } },
      }),
    );
  }
  if (awayBonus.totalBonus > 0) {
    updates.push(
      prisma.club.update({
        where: { id: awayClub.id },
        data: { budget: { increment: awayBonus.totalBonus } },
      }),
    );
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

export async function recentForm(clubId: string, limit: number = 5): Promise<FormResult[]> {
  const records = await prisma.match.findMany({
    where: { status: 'SIMULATED', OR: [{ homeClubId: clubId }, { awayClubId: clubId }] },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return records
    .reverse()
    .map((record) => {
      const result = record.resultJson ? (JSON.parse(record.resultJson) as MatchResult) : null;
      if (!result) return null;
      const isHome = record.homeClubId === clubId;
      const mine = isHome ? result.homeGoals : result.awayGoals;
      const theirs = isHome ? result.awayGoals : result.homeGoals;
      return mine > theirs ? 'V' : mine === theirs ? 'E' : 'D';
    })
    .filter((r): r is FormResult => r !== null);
}

export async function getMatch(matchId: string): Promise<Match> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }
  return toDomain(record);
}

/**
 * Submits a tactic on behalf of `requestingUserId`. Once both sides have submitted,
 * the match is simulated immediately, server-side only — the client never computes a result.
 */
export async function submitTactic(matchId: string, requestingUserId: string, tactic: Tactic): Promise<Match> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }
  if (record.status === 'SIMULATED') {
    throw new MatchError('Partida já foi simulada');
  }

  const side = tactic.clubId === record.homeClubId ? 'home' : tactic.clubId === record.awayClubId ? 'away' : null;
  if (!side) {
    throw new MatchError('Este clube não faz parte desta partida');
  }

  const club = await getClub(tactic.clubId);
  if (club.ownerId !== requestingUserId) {
    throw new MatchError('Você não é o dono deste clube');
  }

  // Throws if the lineup references players outside this club's squad.
  resolveLineupPlayers(club, tactic, record.competitionId);
  // Throws if the bench, planned substitutions, or penalty taker are invalid.
  validateSubstitutesAndPlan(club, tactic, record.competitionId);

  const update: Record<string, string> = side === 'home' ? { homeTacticJson: JSON.stringify(tactic) } : { awayTacticJson: JSON.stringify(tactic) };
  let updated = await prisma.match.update({ where: { id: matchId }, data: update });

  const homeTacticJson = side === 'home' ? JSON.stringify(tactic) : updated.homeTacticJson;
  const awayTacticJson = side === 'away' ? JSON.stringify(tactic) : updated.awayTacticJson;

  if (homeTacticJson && awayTacticJson) {
    // Both sides are in — kicks off a live, pausable match instead of resolving it instantly, so the
    // managers can actually watch it unfold (and step in with subs/tactic changes) minute by minute.
    const homeTactic: Tactic = JSON.parse(homeTacticJson);
    const awayTactic: Tactic = JSON.parse(awayTacticJson);
    const broadcaster = resolveMatchBroadcaster(updated.competitionId ?? 'default', 1, 14, false, updated.seed);
    const live: LiveMatchState = {
      currentMinute: 0,
      rngState: hashSeed(updated.seed),
      broadcaster,
      homeTactic,
      awayTactic,
      homeGoals: 0,
      awayGoals: 0,
      homeShots: 0,
      awayShots: 0,
      homeShotsOnTarget: 0,
      awayShotsOnTarget: 0,
      homeCorners: 0,
      awayCorners: 0,
      homeFouls: 0,
      awayFouls: 0,
      homePressRecoveries: 0,
      awayPressRecoveries: 0,
      homeGoalsFromPressRecovery: 0,
      awayGoalsFromPressRecovery: 0,
      homePossession: 50,
      awayPossession: 50,
      events: [],
    };

    updated = await prisma.match.update({
      where: { id: matchId },
      data: { status: 'LIVE', liveStateJson: JSON.stringify(live) },
    });
  }

  return toDomain(updated);
}

function requireParticipant(homeClub: Club, awayClub: Club, requestingUserId: string): void {
  if (homeClub.ownerId !== requestingUserId && awayClub.ownerId !== requestingUserId) {
    throw new MatchError('Você não participa desta partida');
  }
}

/** Which sides this user is managing in this fixture — the sides whose injuries should stop the clock. */
function watchedSides(homeClub: Club, awayClub: Club, userId: string): { home?: boolean; away?: boolean } {
  const homeConfig = homeClub.staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG;
  const awayConfig = awayClub.staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG;
  const homeAutoSub = homeConfig.autoSubstitutionsInMatch === true;
  const awayAutoSub = awayConfig.autoSubstitutionsInMatch === true;

  return {
    home: homeClub.ownerId === userId && !homeAutoSub,
    away: awayClub.ownerId === userId && !awayAutoSub,
  };
}

function sideTactic(live: LiveMatchState, side: MatchSide): Tactic {
  return side === 'home' ? live.homeTactic : live.awayTactic;
}

function withSideTactic(live: LiveMatchState, side: MatchSide, tactic: Tactic): LiveMatchState {
  return side === 'home' ? { ...live, homeTactic: tactic } : { ...live, awayTactic: tactic };
}

/**
 * Applies a halted decision without a manager: the same touchline heuristic the engine uses when nobody
 * is watching. Called when a stop outlives the manager who owed the answer, so an abandoned fixture still
 * reaches full time instead of sitting frozen at the minute someone pulled a hamstring.
 */
function autoResolvePendingDecision(live: LiveMatchState, homeClub: Club, awayClub: Club): LiveMatchState {
  const decision = live.pendingDecision;
  if (!decision) return live;

  // A dismissal has no automatic fix to apply: nobody replaces a sent-off player, and leaving the hole
  // where he was standing is exactly what happens when no manager reshapes the side. Clearing the halt is
  // the whole resolution.
  if (decision.type === 'redCard') return { ...live, pendingDecision: null };

  const club = decision.side === 'home' ? homeClub : awayClub;
  const tactic = sideTactic(live, decision.side);
  const injured = club.players.find((p) => p.id === decision.playerId);
  const replacement = injured
    ? suggestedReplacement(availableReplacements(decision.side, tactic, club, live.events), tactic, injured)
    : null;

  // No replacement available (bench spent, or all changes used) is a legitimate outcome, not an error:
  // the side simply plays on a man down, which is exactly what the numerical-disadvantage model is for.
  if (!injured || !replacement) return { ...live, pendingDecision: null };

  const events = [...live.events];
  const patched = applyForcedSubstitution(decision.side, decision.minute, tactic, injured, replacement, events);
  return { ...withSideTactic(live, decision.side, patched), events, pendingDecision: null };
}

/**
 * Plays the live match forward from its current minute up to (and including) `toMinute`, using
 * whichever tactic each side currently has set (a manager may have changed it mid-match — see
 * `updateLiveMatchTactic`). Reaching minute 90 finalizes the match: post-match roster updates
 * (suspensions, morale, fatigue, commitment, harmony) applied once. Shared by the participant-authenticated
 * `advanceLiveMatch` and the unattended `autoCompleteLiveMatch` — every match in this game is a live match
 * under the hood, this is the one and only place minutes actually get simulated.
 */
/**
 * O tempo desta partida.
 *
 * Derivado, nunca guardado: `weatherFor` é função pura de (data, continente, id), então o mesmo jogo dá o
 * mesmo tempo em toda releitura, e nada disso pede coluna nova. Depois do estrago que a última coluna
 * esquecida causou no ensureSchema, não precisar de migração vale mais que a leitura poupada.
 *
 * O mando decide o clima: quem viaja é que pega o tempo da casa do outro.
 */
async function weatherOfFixture(homeClub: Club, awayClubId: string): Promise<MatchWeather> {
  const state = await getGameState().catch(() => null);
  const continent = COUNTRIES.find((c) => c.code === homeClub.country)?.continent ?? 'SOUTH_AMERICA';
  return weatherFor(state?.currentDate ?? null, continent, fixtureWeatherKey(homeClub.id, awayClubId));
}

/**
 * Argumentos de `simulateMatchSegment` para continuar a partida de onde o estado ao vivo parou. Um só lugar
 * monta isso para o avanço de verdade e para a espiada (`peekLiveMatch`), de modo que as duas simulem
 * exatamente a mesma coisa e a espiada nunca diverja do que vai ser gravado.
 */
function liveSegmentInput(
  live: LiveMatchState,
  homeClub: Club,
  awayClub: Club,
  rng: () => number,
  startMinute: number,
  endMinute: number,
  interruptOnInjury: { home?: boolean; away?: boolean },
  weather: MatchWeather,
  stoppageHalf: 1 | 2 | undefined,
): Parameters<typeof simulateMatchSegment>[0] {
  return {
    home: { club: homeClub, tactic: live.homeTactic },
    away: { club: awayClub, tactic: live.awayTactic },
    rng,
    startMinute,
    endMinute,
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
    interruptOnInjury,
    interruptOnRedCard: interruptOnInjury,
    crowdIntensity: live.crowdIntensity,
    weather,
    stoppageHalf,
  };
}

async function advanceLiveMatchUnchecked(
  record: NonNullable<Awaited<ReturnType<typeof prisma.match.findUnique>>>,
  homeClub: Club,
  awayClub: Club,
  toMinute: number,
  /** Sides being watched by a manager who must be asked before play restarts — see `interruptOnInjury`. */
  interruptOnInjury: { home?: boolean; away?: boolean } = {},
): Promise<Match> {
  if (record.status !== 'LIVE' || !record.liveStateJson) {
    throw new MatchError('Esta partida não está em andamento');
  }

  let live: LiveMatchState = normalizeLiveState(JSON.parse(record.liveStateJson));
  let autoResolved = false;

  if (live.pendingDecision) {
    // Someone is owed a decision. If the side is still being watched, the clock simply doesn't move: the
    // caller polls, sees `pendingDecision`, and shows the panel. If nobody is watching it any more (an
    // unattended tick, a manager who closed the tab and let the round finish itself), the touchline
    // resolves it the way it always did, so a fixture can never be stranded mid-match.
    if (interruptOnInjury[live.pendingDecision.side]) {
      return toDomain(record);
    }
    live = autoResolvePendingDecision(live, homeClub, awayClub);
    autoResolved = true;
  }

  const stoppage = calculateStoppageTime(live.events);
  const half1Ceiling = 45 + stoppage.half1;
  const half2Ceiling = MATCH_MINUTES + stoppage.half2;

  // Determine current period
  const isOneShotFulltime = Math.round(toMinute) >= MATCH_MINUTES;
  let isFirstHalf = live.period === '1T' || (!live.period && live.currentMinute < 45);
  if (live.period === 'HT' || live.period === '2T' || (!live.period && live.currentMinute >= 45 && Math.round(toMinute) > 45)) {
    isFirstHalf = false;
  }

  // Target minute for current segment
  const target = isFirstHalf
    ? (isOneShotFulltime ? half1Ceiling : Math.max(live.currentMinute, Math.min(half1Ceiling, Math.round(toMinute))))
    : (isOneShotFulltime ? half2Ceiling : Math.max(live.currentMinute, Math.min(half2Ceiling, Math.round(toMinute))));

  if (target === live.currentMinute && !autoResolved) {
    return toDomain(record);
  }

  const startMinute = isFirstHalf ? live.currentMinute + 1 : Math.max(46, live.currentMinute + 1);
  const stoppageHalf = isFirstHalf ? (target > 45 ? 1 : undefined) : (target > 90 ? 2 : undefined);

  const rng = resumableRngFromState(live.rngState);
  const weather = await weatherOfFixture(homeClub, record.awayClubId);
  let segment = simulateMatchSegment(
    liveSegmentInput(live, homeClub, awayClub, rng.next, startMinute, target, interruptOnInjury, weather, stoppageHalf),
  );

  let allEvents = [...live.events, ...segment.events];

  // If one-shot advance to fulltime and first half completed without halt, immediately run second half
  if (isOneShotFulltime && isFirstHalf && !segment.stoppedAtMinute) {
    const stoppageH2 = calculateStoppageTime(allEvents).half2;
    const finalCeiling = MATCH_MINUTES + stoppageH2;

    const h2Segment = simulateMatchSegment({
      home: { club: homeClub, tactic: segment.homeTactic },
      away: { club: awayClub, tactic: segment.awayTactic },
      rng: rng.next,
      startMinute: 46,
      endMinute: finalCeiling,
      priorEvents: allEvents,
      homeGoals: segment.homeGoals,
      awayGoals: segment.awayGoals,
      homeShots: segment.homeShots,
      awayShots: segment.awayShots,
      homeShotsOnTarget: segment.homeShotsOnTarget,
      awayShotsOnTarget: segment.awayShotsOnTarget,
      homeCorners: segment.homeCorners,
      awayCorners: segment.awayCorners,
      homeFouls: segment.homeFouls,
      awayFouls: segment.awayFouls,
      homePressRecoveries: segment.homePressRecoveries,
      awayPressRecoveries: segment.awayPressRecoveries,
      homeGoalsFromPressRecovery: segment.homeGoalsFromPressRecovery,
      awayGoalsFromPressRecovery: segment.awayGoalsFromPressRecovery,
      interruptOnInjury,
      interruptOnRedCard: interruptOnInjury,
      crowdIntensity: live.crowdIntensity,
      weather,
      stoppageHalf: 2,
    });

    allEvents = [...allEvents, ...h2Segment.events];
    segment = h2Segment;
    isFirstHalf = false;
  }

  const possession = derivePossession(segment.homeStrength, segment.awayStrength, segment.homeTactic, segment.awayTactic);
  const stoppedMinute = segment.stoppedAtMinute ?? target;
  const isHaltedForDecision = !!segment.stoppedAtMinute;
  const reachedHalftime = isFirstHalf && !isHaltedForDecision && stoppedMinute >= half1Ceiling;
  const reachedFullTime = !isFirstHalf && !isHaltedForDecision && (isOneShotFulltime || stoppedMinute >= half2Ceiling);

  const updatedLive: LiveMatchState = {
    currentMinute: reachedHalftime ? 45 : stoppedMinute,
    period: reachedHalftime ? 'HT' : isFirstHalf ? '1T' : '2T',
    pendingDecision: segment.pendingDecision ?? null,
    rngState: rng.getState(),
    homeTactic: segment.homeTactic,
    awayTactic: segment.awayTactic,
    homeGoals: segment.homeGoals,
    awayGoals: segment.awayGoals,
    homeShots: segment.homeShots,
    awayShots: segment.awayShots,
    homeShotsOnTarget: segment.homeShotsOnTarget,
    awayShotsOnTarget: segment.awayShotsOnTarget,
    homeCorners: segment.homeCorners,
    awayCorners: segment.awayCorners,
    homeFouls: segment.homeFouls,
    awayFouls: segment.awayFouls,
    homePressRecoveries: segment.homePressRecoveries,
    awayPressRecoveries: segment.awayPressRecoveries,
    homeGoalsFromPressRecovery: segment.homeGoalsFromPressRecovery,
    awayGoalsFromPressRecovery: segment.awayGoalsFromPressRecovery,
    homeXg: segment.homeXg,
    awayXg: segment.awayXg,
    homeBigChances: segment.homeBigChances,
    awayBigChances: segment.awayBigChances,
    homeSaves: segment.homeSaves,
    awaySaves: segment.awaySaves,
    homeWoodwork: segment.homeWoodwork,
    awayWoodwork: segment.awayWoodwork,
    homeBlockedShots: segment.homeBlockedShots,
    awayBlockedShots: segment.awayBlockedShots,
    homePossession: possession.home,
    awayPossession: possession.away,
    events: allEvents,
    crowdIntensity: live.crowdIntensity,
    broadcaster: live.broadcaster,
  };

  // If match has NOT reached full time, persist liveState and return LIVE!
  if (!reachedFullTime) {
    const updated = await prisma.match.update({ where: { id: record.id }, data: { liveStateJson: JSON.stringify(updatedLive) } });
    return toDomain(updated);
  }

  const result: MatchResult = {
    homeGoals: updatedLive.homeGoals,
    awayGoals: updatedLive.awayGoals,
    events: updatedLive.events,
    stats: {
      home: {
        shots: updatedLive.homeShots,
        shotsOnTarget: updatedLive.homeShotsOnTarget,
        possession: updatedLive.homePossession,
        corners: updatedLive.homeCorners,
        fouls: updatedLive.homeFouls,
        pressRecoveries: updatedLive.homePressRecoveries,
        goalsFromPressRecovery: updatedLive.homeGoalsFromPressRecovery,
        xg: updatedLive.homeXg ?? 0,
        bigChances: updatedLive.homeBigChances ?? 0,
        saves: updatedLive.homeSaves ?? 0,
        woodwork: updatedLive.homeWoodwork ?? 0,
        blockedShots: updatedLive.homeBlockedShots ?? 0,
      },
      away: {
        shots: updatedLive.awayShots,
        shotsOnTarget: updatedLive.awayShotsOnTarget,
        possession: updatedLive.awayPossession,
        corners: updatedLive.awayCorners,
        fouls: updatedLive.awayFouls,
        pressRecoveries: updatedLive.awayPressRecoveries,
        goalsFromPressRecovery: updatedLive.awayGoalsFromPressRecovery,
        xg: updatedLive.awayXg ?? 0,
        bigChances: updatedLive.awayBigChances ?? 0,
        saves: updatedLive.awaySaves ?? 0,
        woodwork: updatedLive.awayWoodwork ?? 0,
        blockedShots: updatedLive.awayBlockedShots ?? 0,
      },
    },
  };

  const medical = await applyPostMatchRosterUpdates(homeClub, awayClub, updatedLive.homeTactic, updatedLive.awayTactic, result, record.competitionId, weather);

  /**
   * Settle whatever the comissao predicted about this fixture.
   *
   * Each side is judged against the opponent it was actually scouting, and stamped with the game's own
   * date rather than the wall clock: a save sitting in January 2035 must not record that its fitness coach
   * was proved right in 2026.
   */
  const injuredIds = result.events.filter((e) => e.type === 'injury' && e.playerId).map((e) => e.playerId);
  const { currentDate } = await getGameState();
  await evaluateMatchStaffRecords(homeClub, awayClub.id, updatedLive.awayTactic, injuredIds, currentDate).catch((err) =>
    console.error('evaluateMatchStaffRecords home failed:', err),
  );
  await evaluateMatchStaffRecords(awayClub, homeClub.id, updatedLive.homeTactic, injuredIds, currentDate).catch((err) =>
    console.error('evaluateMatchStaffRecords away failed:', err),
  );

  /**
   * A torcida reage ao resultado.
   *
   * `applyMatchMembershipImpact` estava escrita e nunca foi chamada por ninguém, então o número de sócios de
   * um clube era fixo para sempre: ganhar não trazia sócio, perder não levava. Agora vitória e empate
   * aproximam do teto e derrota tira uma fatia de quem está lá, que é a assimetria certa — sair é decisão de
   * quem já é sócio, entrar depende de haver espaço.
   *
   * Best-effort de propósito, como a notícia logo abaixo: a partida já gravou o resultado e um tropeço aqui
   * não pode desfazê-la.
   */
  await applyMembershipAfterMatch(homeClub, awayClub, result).catch((err) =>
    console.error('applyMembershipAfterMatch failed:', err),
  );

  await applyBroadcastFacilityFeeAfterMatch(homeClub, awayClub, updatedLive.broadcaster).catch((err) =>
    console.error('applyBroadcastFacilityFeeAfterMatch failed:', err),
  );

  await applyCombatBonusAfterMatch(homeClub, awayClub, result).catch((err) =>
    console.error('applyCombatBonusAfterMatch failed:', err),
  );

  // Best-effort: a news-generation hiccup shouldn't fail the match itself, which already committed the
  // roster updates above.
  await generateMatchNews(homeClub, awayClub, result).catch((err) => console.error('generateMatchNews failed:', err));
  await Promise.all([
    generateMedicalRecoveryNews(homeClub.id, medical.homeRecoveries),
    generateMedicalRecoveryNews(awayClub.id, medical.awayRecoveries),
  ]).catch((err) => console.error('generateMedicalRecoveryNews failed:', err));

  const updated = await prisma.match.update({
    where: { id: record.id },
    data: {
      status: 'SIMULATED',
      resultJson: JSON.stringify(result),
      liveStateJson: null,
      // Whichever tactic was actually in effect at the final whistle (may differ from kickoff's if a
      // manager changed it mid-match) — callers that need "what was this match played with" should see that.
      homeTacticJson: JSON.stringify(updatedLive.homeTactic),
      awayTacticJson: JSON.stringify(updatedLive.awayTactic),
    },
  });
  return toDomain(updated);
}

/**
 * Participant-authenticated entry point — a manager pausing/resuming/watching their own match.
 *
 * `interactive` is the caller saying "I am watching this minute by minute, stop and ask me": only then do
 * this user's own injuries halt the clock. It is opt-in rather than inferred from ownership because plenty
 * of legitimate callers own a side and still just want the fixture resolved — fast-forwarding a round,
 * finishing an abandoned match — and those must never come back halted with nobody to answer.
 */
export async function advanceLiveMatch(
  matchId: string,
  requestingUserId: string,
  toMinute: number,
  interactive = false,
): Promise<Match> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }

  const homeClub = await getClub(record.homeClubId);
  const awayClub = await getClub(record.awayClubId);
  requireParticipant(homeClub, awayClub, requestingUserId);

  const interrupt = interactive ? watchedSides(homeClub, awayClub, requestingUserId) : {};
  return advanceLiveMatchUnchecked(record, homeClub, awayClub, toMinute, interrupt);
}

/**
 * Espia os próximos minutos SEM gravar nada: simula a partir do estado ao vivo atual, com uma cópia do RNG, e
 * devolve só os lances que o avanço de verdade vai produzir. O campo 2D usa isso para já ter a bola perto do
 * gol quando o lance for revelado, em vez de correr atrás dele; o placar, o som e a pausa continuam esperando
 * o relógio chegar ao minuto, como sempre.
 *
 * A espiada vale para o estado de agora: se o técnico mexer na tática ou nas substituições, quem chama deve
 * pedir de novo. Não cobre o apito final (nada a mostrar além do que o campo já tem).
 */
export async function peekLiveMatch(
  matchId: string,
  requestingUserId: string,
  toMinute: number,
  interactive = false,
): Promise<MatchEvent[]> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }
  const homeClub = await getClub(record.homeClubId);
  const awayClub = await getClub(record.awayClubId);
  requireParticipant(homeClub, awayClub, requestingUserId);

  if (record.status !== 'LIVE' || !record.liveStateJson) return [];
  const live: LiveMatchState = normalizeLiveState(JSON.parse(record.liveStateJson));
  // Alguém deve uma decisão: o relógio não anda, não há futuro para espiar.
  if (live.pendingDecision) return [];

  const interrupt = interactive ? watchedSides(homeClub, awayClub, requestingUserId) : {};
  const stoppage = calculateStoppageTime(live.events);
  const half1Ceiling = 45 + stoppage.half1;
  const half2Ceiling = MATCH_MINUTES + stoppage.half2;

  // Mesma regra de tempo do avanço de verdade.
  let isFirstHalf = live.period === '1T' || (!live.period && live.currentMinute < 45);
  if (live.period === 'HT' || live.period === '2T' || (!live.period && live.currentMinute >= 45 && Math.round(toMinute) > 45)) {
    isFirstHalf = false;
  }
  const target = isFirstHalf
    ? Math.max(live.currentMinute, Math.min(half1Ceiling, Math.round(toMinute)))
    : Math.max(live.currentMinute, Math.min(half2Ceiling, Math.round(toMinute)));
  if (target === live.currentMinute) return [];

  const startMinute = isFirstHalf ? live.currentMinute + 1 : Math.max(46, live.currentMinute + 1);
  const stoppageHalf = isFirstHalf ? (target > 45 ? 1 : undefined) : (target > 90 ? 2 : undefined);
  const rng = resumableRngFromState(live.rngState);
  const weather = await weatherOfFixture(homeClub, record.awayClubId);
  const segment = simulateMatchSegment(
    liveSegmentInput(live, homeClub, awayClub, rng.next, startMinute, target, interrupt, weather, stoppageHalf),
  );
  return segment.events;
}

/**
 * The manager's answer to a stoppage: who comes on for the player who went down, or `null` to play on a
 * man short. Clears the halt so the clock can restart. The chosen player must be one the engine itself
 * would have accepted (see `availableReplacements`) — a client offering anything else is rejected rather
 * than quietly corrected, since silently subbing on someone other than who the manager picked is worse
 * than an error message.
 */
export async function resolveInjuryDecision(
  matchId: string,
  requestingUserId: string,
  replacementPlayerId: string | null,
): Promise<Match> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }
  if (record.status !== 'LIVE' || !record.liveStateJson) {
    throw new MatchError('Esta partida não está em andamento');
  }

  const homeClub = await getClub(record.homeClubId);
  const awayClub = await getClub(record.awayClubId);
  requireParticipant(homeClub, awayClub, requestingUserId);

  const live: LiveMatchState = normalizeLiveState(JSON.parse(record.liveStateJson));
  const decision = live.pendingDecision;
  if (!decision) {
    throw new MatchError('Não há nenhuma decisão pendente nesta partida');
  }

  if (decision.type !== 'injury') {
    throw new MatchError('A decisão pendente não é uma substituição');
  }

  const club = decision.side === 'home' ? homeClub : awayClub;
  if (club.ownerId !== requestingUserId) {
    throw new MatchError('A decisão pendente é do outro clube');
  }

  const tactic = sideTactic(live, decision.side);
  const injured = club.players.find((p) => p.id === decision.playerId);
  if (!injured) {
    throw new MatchError('Jogador lesionado não encontrado no elenco');
  }

  let updatedLive: LiveMatchState;
  if (replacementPlayerId === null) {
    updatedLive = { ...live, pendingDecision: null };
  } else {
    const candidates = availableReplacements(decision.side, tactic, club, live.events);
    const replacement = candidates.find((p) => p.id === replacementPlayerId);
    if (!replacement) {
      throw new MatchError('Este jogador não pode entrar agora');
    }
    const events = [...live.events];
    const patched = applyForcedSubstitution(decision.side, decision.minute, tactic, injured, replacement, events);
    updatedLive = { ...withSideTactic(live, decision.side, patched), events, pendingDecision: null };
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { liveStateJson: JSON.stringify(updatedLive) },
  });
  return toDomain(updated);
}

/**
 * The manager's answer to a dismissal: the eleven slots rearranged, or `null` to leave the shape alone and
 * carry the hole where the sent-off player was standing.
 *
 * The new lineup must be a rearrangement of the same eleven names, nothing more. A dismissal costs a side
 * a player for good, so a client that tried to slide a substitute into the empty shirt would be undoing the
 * punishment; keeping this to a permutation means the only thing the manager can change is *which position*
 * the side gives up, which is the actual decision a touchline faces.
 *
 * The sent-off player stays in the lineup on purpose: he is the marker for the abandoned slot. Everything
 * downstream already filters him out of the eleven (see offPitchPlayerIds), so wherever the manager parks
 * him is the zone that goes unmanned.
 */
export async function resolveRedCardDecision(
  matchId: string,
  requestingUserId: string,
  lineupPlayerIds: string[] | null,
): Promise<Match> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }
  if (record.status !== 'LIVE' || !record.liveStateJson) {
    throw new MatchError('Esta partida não está em andamento');
  }

  const homeClub = await getClub(record.homeClubId);
  const awayClub = await getClub(record.awayClubId);
  requireParticipant(homeClub, awayClub, requestingUserId);

  const live: LiveMatchState = normalizeLiveState(JSON.parse(record.liveStateJson));
  const decision = live.pendingDecision;
  if (!decision) {
    throw new MatchError('Não há nenhuma decisão pendente nesta partida');
  }
  if (decision.type !== 'redCard') {
    throw new MatchError('A decisão pendente não é uma reorganização');
  }

  const club = decision.side === 'home' ? homeClub : awayClub;
  if (club.ownerId !== requestingUserId) {
    throw new MatchError('A decisão pendente é do outro clube');
  }

  if (lineupPlayerIds === null) {
    const updated = await prisma.match.update({
      where: { id: matchId },
      data: { liveStateJson: JSON.stringify({ ...live, pendingDecision: null }) },
    });
    return toDomain(updated);
  }

  const tactic = sideTactic(live, decision.side);
  const current = tactic.lineup.map((slot) => slot.playerId);
  if (lineupPlayerIds.length !== current.length || !sameMultiset(current, lineupPlayerIds)) {
    throw new MatchError('A reorganização precisa usar exatamente os mesmos jogadores, apenas em outras posições');
  }

  // Slots keep their own pitch side; only who stands in them moves.
  const reorganized: Tactic = {
    ...tactic,
    lineup: tactic.lineup.map((slot, i) => ({ ...slot, playerId: lineupPlayerIds[i] })),
  };

  const updatedLive: LiveMatchState = { ...withSideTactic(live, decision.side, reorganized), pendingDecision: null };
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { liveStateJson: JSON.stringify(updatedLive) },
  });
  return toDomain(updated);
}

function sameMultiset(a: string[], b: string[]): boolean {
  const counts = new Map<string, number>();
  for (const id of a) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const id of b) {
    const left = counts.get(id);
    if (!left) return false;
    counts.set(id, left - 1);
  }
  return true;
}

/**
 * The options a manager may pick from while play is halted: everyone the engine would accept, plus who it
 * would have chosen on its own (highlighted for the manager, never applied without an explicit answer).
 */
export async function injuryDecisionOptions(
  matchId: string,
  requestingUserId: string,
): Promise<{ decision: PendingMatchDecision; candidates: Player[]; suggestedId: string | null }> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }
  if (record.status !== 'LIVE' || !record.liveStateJson) {
    throw new MatchError('Esta partida não está em andamento');
  }

  const homeClub = await getClub(record.homeClubId);
  const awayClub = await getClub(record.awayClubId);
  requireParticipant(homeClub, awayClub, requestingUserId);

  const live: LiveMatchState = normalizeLiveState(JSON.parse(record.liveStateJson));
  const decision = live.pendingDecision;
  if (!decision) {
    throw new MatchError('Não há nenhuma decisão pendente nesta partida');
  }

  // A dismissal has no bench options at all — nobody replaces a sent-off player. Returning an empty list
  // rather than erroring keeps a single "what is this stoppage" call usable for either kind.
  if (decision.type !== 'injury') {
    return { decision, candidates: [], suggestedId: null };
  }

  const club = decision.side === 'home' ? homeClub : awayClub;
  const tactic = sideTactic(live, decision.side);
  const injured = club.players.find((p) => p.id === decision.playerId);
  const candidates = availableReplacements(decision.side, tactic, club, live.events);
  const suggested = injured ? suggestedReplacement(candidates, tactic, injured) : null;

  return { decision, candidates, suggestedId: suggested?.id ?? null };
}

/**
 * System-driven entry point — no specific manager owns this tick. Two uses: (1) a fixture with no human
 * on either side, ticked straight to full time right after kickoff since nobody is around to pace it; (2)
 * a bot-owned fixture *in the same round* as one a human is actively watching — the client paces every
 * fixture in that round together (see the round-siblings ticker), calling this each time it calls
 * `advanceLiveMatch` for its own match, so the whole round's scoreboard updates in lockstep. Same engine,
 * same event-by-event simulation either way; the only difference from `advanceLiveMatch` is that nobody
 * needs to be a participant to drive it.
 */
export async function tickLiveMatchSystem(matchId: string, toMinute: number = MATCH_MINUTES): Promise<Match> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }
  if (record.status !== 'LIVE') {
    return toDomain(record);
  }

  const homeClub = await getClub(record.homeClubId);
  const awayClub = await getClub(record.awayClubId);

  return advanceLiveMatchUnchecked(record, homeClub, awayClub, toMinute);
}

/**
 * Lets a manager change their tactic (formation, lineup, subs, mentality...) while the match is paused
 * — takes effect starting from whatever minute `advanceLiveMatch` resumes at next. Doesn't touch minutes
 * already played; nothing retroactively changes.
 */
export async function updateLiveMatchTactic(matchId: string, requestingUserId: string, tactic: Tactic): Promise<Match> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }
  if (record.status !== 'LIVE' || !record.liveStateJson) {
    throw new MatchError('Esta partida não está em andamento');
  }

  const side = tactic.clubId === record.homeClubId ? 'home' : tactic.clubId === record.awayClubId ? 'away' : null;
  if (!side) {
    throw new MatchError('Este clube não faz parte desta partida');
  }

  const club = await getClub(tactic.clubId);
  if (club.ownerId !== requestingUserId) {
    throw new MatchError('Você não é o dono deste clube');
  }

  resolveLineupPlayers(club, tactic, record.competitionId);
  validateSubstitutesAndPlan(club, tactic, record.competitionId);

  const live: LiveMatchState = normalizeLiveState(JSON.parse(record.liveStateJson));
  const updatedLive: LiveMatchState = side === 'home' ? { ...live, homeTactic: tactic } : { ...live, awayTactic: tactic };

  const updated = await prisma.match.update({ where: { id: matchId }, data: { liveStateJson: JSON.stringify(updatedLive) } });
  return toDomain(updated);
}

/**
 * Creates a match paused at minute 0 — the only way a match is ever created in this game, whether it's
 * a PvP challenge, a league fixture, or a cup tie. A human-involved fixture stays paused for its manager
 * to drive (see advanceLiveMatch); a bot-vs-bot fixture gets immediately fast-forwarded to full time by
 * the caller via autoCompleteLiveMatch. Either way it's the same live, minute-by-minute engine — never a
 * separate "instant result" shortcut.
 */
/** What a result-only fixture keeps: the score, and enough about the goals to build a scorers and assistants table. */

/**
 * Resets a live match back to minute 0 with fresh seed, cleared score and empty events.
 * Allows the manager to restart the match simulation directly from the broadcast bar.
 */
export async function resetLiveMatch(matchId: string, requestingUserId: string): Promise<Match> {
  const record = await prisma.match.findUnique({ where: { id: matchId } });
  if (!record) {
    throw new MatchError(`Partida ${matchId} não encontrada`);
  }

  const homeClub = await getClub(record.homeClubId);
  const awayClub = await getClub(record.awayClubId);
  requireParticipant(homeClub, awayClub, requestingUserId);

  const prevLive: LiveMatchState | null = record.liveStateJson ? normalizeLiveState(JSON.parse(record.liveStateJson)) : null;
  const homeTactic: Tactic = record.homeTacticJson
    ? JSON.parse(record.homeTacticJson)
    : prevLive
    ? prevLive.homeTactic
    : ({ clubId: homeClub.id, formation: '4-3-3', lineup: [] } as any);
  const awayTactic: Tactic = record.awayTacticJson
    ? JSON.parse(record.awayTacticJson)
    : prevLive
    ? prevLive.awayTactic
    : ({ clubId: awayClub.id, formation: '4-3-3', lineup: [] } as any);
  const compKey = record.competitionId ?? 'default';
  const broadcaster = resolveMatchBroadcaster(compKey, 1, 14, false, record.seed);

  const resetLiveState: LiveMatchState = {
    currentMinute: 0,
    rngState: hashSeed(`${record.seed}-reset-${Date.now()}`),
    broadcaster,
    homeTactic,
    awayTactic,
    homeGoals: 0,
    awayGoals: 0,
    homeShots: 0,
    awayShots: 0,
    homeShotsOnTarget: 0,
    awayShotsOnTarget: 0,
    homeCorners: 0,
    awayCorners: 0,
    homeFouls: 0,
    awayFouls: 0,
    homePressRecoveries: 0,
    awayPressRecoveries: 0,
    homeGoalsFromPressRecovery: 0,
    awayGoalsFromPressRecovery: 0,
    homePossession: 50,
    awayPossession: 50,
    events: [],
    period: '1T',
  };

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'LIVE',
      liveStateJson: JSON.stringify(resetLiveState),
      resultJson: null,
    },
  });

  return toDomain(updated);
}


export interface ResultOnlyOutcome {
  homeGoals: number;
  awayGoals: number;
  scorers: { playerId: string; clubId: string; name: string }[];
  /** A compact list of every credited assistant, mirroring `scorers`. */
  assists: { playerId: string; clubId: string; name: string }[];
  /** The two squads as the match left them, for a caller that saves a whole round at once. */
  rosters: { homePlayers: Player[]; awayPlayers: Player[] };
}

/**
 * Plays a fixture nobody is watching, keeping only the result.
 *
 * The simulation is exactly the same engine, with exactly the same tactics, crowd and squads — this is not
 * a cheaper or coarser model, and the scoreline is identical to what the live path would have produced from
 * the same seed. The difference is only what survives afterwards: no `Match` row, no stored minute-by-minute
 * timeline, no tactic blobs. One stored match costs around 5.7 KB, which is nothing for the fixtures a
 * manager opens and ruinous across a world of leagues where a single season would add tens of megabytes of
 * commentary nobody will ever read.
 *
 * Squads still take the full consequences — fatigue, injuries, bookings, suspensions — through the same
 * `applyPostMatchRosterUpdates` the live path uses, so a computer-run club that plays a hard midweek is just
 * as tired on Sunday as it would have been.
 */
export async function simulateFixtureResultOnly(
  homeClub: Club,
  awayClub: Club,
  homeTactic: Tactic,
  awayTactic: Tactic,
  competition: { type: MatchCompetitionType; id: string } | null = null,
  crowdIntensity?: number,
  /**
   * Whether to save the two squads here, or hand them back for the caller to save with the rest of the
   * round. A round plays ten of these, and two round trips each is what made a world-sized matchday cost
   * seconds — almost none of it simulation.
   */
  persistRosters = true,
): Promise<ResultOnlyOutcome> {
  const weather = await weatherOfFixture(homeClub, awayClub.id);
  const result = simulateMatch({
    home: { club: homeClub, tactic: homeTactic },
    away: { club: awayClub, tactic: awayTactic },
    seed: randomUUID(),
    crowdIntensity,
    weather,
  });

  const rosters = computePostMatchRosters(homeClub, awayClub, homeTactic, awayTactic, result, competition?.id ?? null, weather);
  if (persistRosters) {
    await prisma.club.update({ where: { id: homeClub.id }, data: { playersJson: JSON.stringify(rosters.homePlayers) } });
    await prisma.club.update({ where: { id: awayClub.id }, data: { playersJson: JSON.stringify(rosters.awayPlayers) } });
  }

  const scorers = (result.events ?? [])
    .filter((event) => event.type === 'goal' && event.playerId)
    .map((event) => ({
      playerId: event.playerId as string,
      clubId: event.team === 'home' ? homeClub.id : awayClub.id,
      name:
        (event.team === 'home' ? homeClub : awayClub).players.find((p) => p.id === event.playerId)?.name ??
        'Desconhecido',
    }));

  // The engine hands goals a credited assistant (see `GOAL_WITH_ASSIST_PHRASES`), and a world whose
  // matches nobody watches should still tally its playmakers — otherwise a computer-run club's assists
  // would simply never exist, and its midfielders would never appear on an assists table.
  const assists = (result.events ?? [])
    .filter((event) => event.type === 'goal' && event.assistPlayerId)
    .map((event) => ({
      playerId: event.assistPlayerId as string,
      clubId: event.team === 'home' ? homeClub.id : awayClub.id,
      name:
        (event.team === 'home' ? homeClub : awayClub).players.find((p) => p.id === event.assistPlayerId)?.name ??
        event.assistPlayerName ??
        'Desconhecido',
    }));

  return { homeGoals: result.homeGoals, awayGoals: result.awayGoals, scorers, assists, rosters };
}

export async function createLiveMatch(
  homeClubId: string,
  awayClubId: string,
  homeTactic: Tactic,
  awayTactic: Tactic,
  competition: { type: MatchCompetitionType; id: string } | null = null,
  /**
   * How full the home ground is for this fixture (see `LiveMatchState.crowdIntensity`). Supplied by the
   * caller because working it out needs the league table, and leagueService already imports this module —
   * reaching back the other way would be a cycle. Omitted (a cup tie, a bare challenge) means the
   * league-average crowd, which is the honest answer when there is no table to read.
   */
  crowdIntensity?: number,
): Promise<Match> {
  const id = randomUUID();
  const seed = randomUUID();
  const compKey = competition?.id ?? 'default';
  const broadcaster = resolveMatchBroadcaster(compKey, 1, 14, false, seed);
  const live: LiveMatchState = {
    currentMinute: 0,
    rngState: hashSeed(seed),
    crowdIntensity,
    broadcaster,
    homeTactic,
    awayTactic,
    homeGoals: 0,
    awayGoals: 0,
    homeShots: 0,
    awayShots: 0,
    homeShotsOnTarget: 0,
    awayShotsOnTarget: 0,
    homeCorners: 0,
    awayCorners: 0,
    homeFouls: 0,
    awayFouls: 0,
    homePressRecoveries: 0,
    awayPressRecoveries: 0,
    homeGoalsFromPressRecovery: 0,
    awayGoalsFromPressRecovery: 0,
    homePossession: 50,
    awayPossession: 50,
    events: [],
  };

  await prisma.match.create({
    data: {
      id,
      homeClubId,
      awayClubId,
      seed,
      status: 'LIVE',
      homeTacticJson: JSON.stringify(homeTactic),
      awayTacticJson: JSON.stringify(awayTactic),
      liveStateJson: JSON.stringify(live),
      competitionType: competition?.type ?? null,
      competitionId: competition?.id ?? null,
    },
  });

  return {
    id,
    homeClubId,
    awayClubId,
    seed,
    status: 'LIVE',
    homeTactic,
    awayTactic,
    live,
    broadcaster,
    competitionType: competition?.type ?? null,
    competitionId: competition?.id ?? null,
  };
}

interface MatchRecord {
  id: string;
  homeClubId: string;
  awayClubId: string;
  seed: string;
  status: string;
  homeTacticJson: string | null;
  awayTacticJson: string | null;
  resultJson: string | null;
  liveStateJson?: string | null;
  competitionType?: string | null;
  competitionId?: string | null;
}

function toDomain(record: MatchRecord): Match {
  const live = record.liveStateJson ? normalizeLiveState(JSON.parse(record.liveStateJson)) : undefined;
  const compKey = record.competitionId ?? 'default';
  const broadcaster = live?.broadcaster ?? resolveMatchBroadcaster(compKey, 1, 14, false, record.seed);
  if (live && !live.broadcaster) {
    live.broadcaster = broadcaster;
  }

  return {
    id: record.id,
    homeClubId: record.homeClubId,
    awayClubId: record.awayClubId,
    seed: record.seed,
    status: record.status as Match['status'],
    homeTactic: record.homeTacticJson ? JSON.parse(record.homeTacticJson) : undefined,
    awayTactic: record.awayTacticJson ? JSON.parse(record.awayTacticJson) : undefined,
    result: record.resultJson ? JSON.parse(record.resultJson) : undefined,
    live,
    broadcaster,
    competitionType: (record.competitionType as Match['competitionType']) ?? null,
    competitionId: record.competitionId ?? null,
  };
}

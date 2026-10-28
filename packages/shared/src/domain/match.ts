import { PressingIntensity, Tactic } from './tactic.js';

export type MatchEventType = 'chance' | 'goal' | 'card' | 'injury' | 'substitution';
export type MatchSide = 'home' | 'away';

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  team: MatchSide;
  playerId: string;
  description: string;
  /** Which half of the match this event occurred in ('1T' or '2T'). */
  period?: '1T' | '2T';
  /** Only set during stoppage time: additional minute past 45 or 90 (e.g., 2 for 45+2' or 90+2'). */
  stoppageMinute?: number;
  /** Only set on red-card events: how many subsequent matches the player must sit out. */
  suspensionMatches?: number;
  /** Only set on 'injury' events: how many subsequent matches the player is expected to be out. */
  injuryWeeks?: number;
  /** Only set on 'substitution' events: the player coming on (`playerId` is the one going off). */
  relatedPlayerId?: string;
  /** Only set on 'goal'/'chance' events that came from a penalty kick. */
  isPenalty?: boolean;
  /** Expected Goals (xG) value of this specific shot/attempt. */
  xg?: number;
  /** Specific shot resolution outcome. */
  shotOutcome?: 'goal' | 'saved' | 'woodwork' | 'blocked' | 'off_target';
  /** Geometry of the attempt, retained so tactical shot selection remains explainable and testable. */
  shotType?: 'PENALTY' | 'ONE_ON_ONE' | 'BOX_SHOT' | 'LONG_SHOT' | 'HEADER' | 'REBOUND';
  /** Set if this chance resulted from an immediate rebound after a keeper save. */
  isRebound?: boolean;
  /** Set if a corner was directly conceded from a goalkeeper save. */
  isDerivedCorner?: boolean;
  /** Only set on 'goal' events: player ID who made the assist. */
  assistPlayerId?: string;
  /** Name of the assistant player for easy display. */
  assistPlayerName?: string;
}

/** Formats an event minute string accurately according to stoppage time and clock format. */
export function formatMatchEventMinute(
  event: Pick<MatchEvent, 'minute' | 'period' | 'stoppageMinute'>,
  clockFormat: 'HALF_45' | 'FULL_90' = 'HALF_45',
): string {
  if (event.period === '1T' && event.stoppageMinute && event.stoppageMinute > 0) {
    return `45+${event.stoppageMinute}'`;
  }
  if (event.period === '2T' && event.stoppageMinute && event.stoppageMinute > 0) {
    return clockFormat === 'HALF_45' ? `45+${event.stoppageMinute}' (2ºT)` : `90+${event.stoppageMinute}'`;
  }
  if (event.minute <= 45) {
    return `${event.minute}'`;
  }
  if (event.minute > 90) {
    const extra = event.minute - 90;
    return clockFormat === 'HALF_45' ? `45+${extra}' (2ºT)` : `90+${extra}'`;
  }
  return clockFormat === 'HALF_45' ? `${event.minute - 45}' (2ºT)` : `${event.minute}'`;
}

/** `pressRecoveries`/`goalsFromPressRecovery` back the "Feedback Pós-Jogo" tactical report — see
 *  `buildPressingReport` and engine.ts's `pressRecoveryProbability`. */
export interface MatchSideStats {
  shots: number;
  shotsOnTarget: number;
  possession: number;
  corners: number;
  fouls: number;
  pressRecoveries: number;
  goalsFromPressRecovery: number;
  /** Cumulative Expected Goals (xG), rounded to 2 decimal places. */
  xg: number;
  /** Number of high-quality chances (xG >= 0.30) created. */
  bigChances: number;
  /** Goalkeeper saves made. */
  saves: number;
  /** Attempts hitting the post or crossbar. */
  woodwork: number;
  /** Shots blocked by defenders. */
  blockedShots: number;
}

export interface MatchStats {
  home: MatchSideStats;
  away: MatchSideStats;
}

export type PenaltyTargetZone = 1 | 2 | 3 | 4 | 5;
export type PenaltyShotOutcome = 'GOL' | 'DEFESA' | 'FORA' | 'TRAVE';

export interface PenaltyKickResult {
  roundNumber: number;
  team: MatchSide;
  kickerId: string;
  kickerName: string;
  goalkeeperId: string;
  goalkeeperName: string;
  targetZone: PenaltyTargetZone;
  gkZone: PenaltyTargetZone;
  outcome: PenaltyShotOutcome;
  scoreBefore: { home: number; away: number };
  scoreAfter: { home: number; away: number };
  isSuddenDeath: boolean;
}

export interface PenaltyShootoutResult {
  winnerClubId: string;
  winnerSide: MatchSide;
  homeScore: number;
  awayScore: number;
  kicks: PenaltyKickResult[];
  homeOrder: string[];
  awayOrder: string[];
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  stats: MatchStats;
  penaltyShootout?: PenaltyShootoutResult;
}

const PRESSING_LABEL: Record<PressingIntensity, string> = {
  LOW_BLOCK: 'Sua pressão baixa',
  MEDIUM: 'Sua pressão',
  HIGH_PRESS: 'Sua pressão alta',
};

/**
 * The "Feedback Pós-Jogo" line the Submenu Tática/Escalação spec (3.9) asks for — e.g. "Sua pressão alta
 * recuperou 8 bolas no campo ofensivo, resultando em 2 gols". Built from `MatchStats`' pressRecoveries/
 * goalsFromPressRecovery, which come from a same-minute proxy for "this recovery led to that goal" (see
 * engine.ts's pressRecoveryProbability), not a literally simulated causal chain — the wording below is
 * phrased to report what happened, not to overclaim a tighter causal link than the model actually tracks.
 */
export function buildPressingReport(pressing: PressingIntensity, stats: Pick<MatchSideStats, 'pressRecoveries' | 'goalsFromPressRecovery'>): string {
  const label = PRESSING_LABEL[pressing];
  if (stats.pressRecoveries === 0) {
    return `${label} não recuperou bolas no campo ofensivo nesta partida.`;
  }
  const recoveries = `${stats.pressRecoveries} bola${stats.pressRecoveries === 1 ? '' : 's'}`;
  if (stats.goalsFromPressRecovery === 0) {
    return `${label} recuperou ${recoveries} no campo ofensivo.`;
  }
  const goals = `${stats.goalsFromPressRecovery} gol${stats.goalsFromPressRecovery === 1 ? '' : 's'}`;
  return `${label} recuperou ${recoveries} no campo ofensivo, resultando em ${goals}.`;
}

export type MatchStatus = 'WAITING_TACTICS' | 'LIVE' | 'SIMULATED';

/**
 * A stoppage the simulation cannot resolve on its own: the referee has halted play and the manager of
 * `side` owes the game an answer before the clock restarts. The engine records one of these instead of
 * quietly patching the team up, because deciding who comes on for a player carried off is the match
 * being played, not bookkeeping around it.
 *
 * Only ever set for a side a human is actually managing and watching: an unattended fixture (bot clubs,
 * or a round ticking along in the background) resolves the same situation automatically, since there is
 * nobody at the touchline to ask and the match still has to finish.
 */
export interface PendingMatchDecision {
  /**
   * `injury`: who comes on for the injured player.
   * `redCard`: which slot the manager gives up for 10 men.
   * `penaltyKick`: manager chooses taker and aim zone during live match.
   * `penaltyShootout`: manager orders takers / kicks during cup shootout.
   */
  type: 'injury' | 'redCard' | 'penaltyKick' | 'penaltyShootout';
  side: MatchSide;
  /** The player who went down, was sent off, or default penalty taker. */
  playerId: string;
  minute: number;
}

/**
 * Snapshot of a match mid-simulation — everything needed to resume from `currentMinute` exactly where
 * it left off: the RNG's own internal state (see rng.ts's resumable variant), the running score/events,
 * and each side's *current* tactic (which the manager may have changed since kickoff or halftime).
 */
export interface LiveMatchState {
  currentMinute: number;
  /** Current period of the match ('1T' for 1st half, 'HT' for halftime, '2T' for 2nd half). */
  period?: '1T' | 'HT' | '2T';
  rngState: number;
  homeTactic: Tactic;
  awayTactic: Tactic;
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  /** Live-updated match stats beyond goals/shots — see `MatchStats`. Live state persisted before these
   *  fields existed won't have them in the stored JSON; the service layer normalizes to 0 (or 50/50 for
   *  possession) the moment it's read back, so nothing downstream ever sees them missing. */
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  /** Same normalize-missing-to-0 treatment as the fields above for live state persisted before this
   *  existed — see the field comment on homeShotsOnTarget. */
  homePressRecoveries: number;
  awayPressRecoveries: number;
  homeGoalsFromPressRecovery: number;
  awayGoalsFromPressRecovery: number;
  homeXg?: number;
  awayXg?: number;
  homeBigChances?: number;
  awayBigChances?: number;
  homeSaves?: number;
  awaySaves?: number;
  homeWoodwork?: number;
  awayWoodwork?: number;
  homeBlockedShots?: number;
  awayBlockedShots?: number;
  homePossession: number;
  awayPossession: number;
  events: MatchEvent[];
  /** Set while play is halted waiting on a manager (see `PendingMatchDecision`). The clock cannot advance
   *  until it is resolved, so this doubles as the "referee has the game stopped" flag for the live screen.
   *  Absent on live state persisted before interruptions existed, which simply means nothing is pending. */
  pendingDecision?: PendingMatchDecision | null;
  /**
   * How full the home ground was at kickoff, 0 to 1 — the venue effect's input (see homeAdvantage.ts).
   * Fixed once when the match is created rather than recomputed each tick: the crowd that turned up does
   * not change at half-time, and re-deriving it every few seconds would mean a league-table query on every
   * clock tick. Absent on live state persisted before the mando existed, which falls back to the
   * league-average crowd.
   */
  crowdIntensity?: number;
  /** Designated official media channel / broadcaster for this live match. */
  broadcaster?: import('./broadcastRights.js').BroadcasterChannel;
}

export type MatchCompetitionType = 'league' | 'cup';

export interface Match {
  id: string;
  homeClubId: string;
  awayClubId: string;
  seed: string;
  status: MatchStatus;
  homeTactic?: Tactic;
  awayTactic?: Tactic;
  result?: MatchResult;
  /** Only set while status is LIVE — the in-progress simulation state. */
  live?: LiveMatchState;
  /** Which competition (if any) this fixture belongs to — null for an ad-hoc PvP challenge. Scopes red-card
   *  suspensions (see `Suspension`) to the competition they were earned in. */
  competitionType?: MatchCompetitionType | null;
  competitionId?: string | null;
  /** Designated official media channel / broadcaster for this match. */
  broadcaster?: import('./broadcastRights.js').BroadcasterChannel;
}

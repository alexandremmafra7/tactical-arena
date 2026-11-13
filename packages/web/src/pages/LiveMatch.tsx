import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  bookedPlayerIds,
  formatMatchEventMinute,
  defensiveLineOf,
  calculateInMatchStamina,
  calculateMatchRatings,
  computeStandings,
  type AttackApproach,
  type AttackStyle,
  type Club,
  type DefensiveLineHeight,
  type Formation,
  type League,
  type MarkingStyle,
  type Match,
  type MatchEvent,
  type Mentality,
  type PenaltyShotOutcome,
  type PenaltyTargetZone,
  type Player,
  type PressingIntensity,
  type Tactic,
  type LiveMatchState,
  canUseMatchSpeed,
  explainBlock,
  type GameMode,
  isStoppageTimeClimax,
  computeLiveMomentumResource,
  getMomentumSkillStatuses,
  computeAssistantSubSuggestions,
  sentOffPlayerIds,
  buildHalftimeAssistantBriefing,
  buildQuickPostMatchPressQuestions,
  type MomentumSkillId,
  type HalftimeToneChoice,
  type QuickPressOption,
} from '@tactical-arena/shared';
import {
  advanceLiveMatch,
  applyTeamTalk,
  getActiveLeague,
  getClub,
  getInjuryDecision,
  getMatch,
  getMatchSiblings,
  listMyClubs,
  listSaves,
  peekLiveMatch,
  resolveInjuryDecision,
  resolveRedCardDecision,
  tickLiveMatch,
  updateLiveMatchTactic,
  type ClockFormat,
  type InjuryDecisionOptions,
  type MatchCompetition,
} from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { BroadcastLogo, LiveBroadcastWatermark } from '../components/BroadcastLogo.js';
import { GoalCelebrationOverlay } from '../components/GoalCelebrationOverlay.js';
import { LiveTacticalModal, type LiveTacticalModalMode } from '../components/LiveTacticalModal.js';
import {
  MatchTimelineBar,
  PenaltyShootoutGridWidget,
} from '../components/MatchDramaWidgets.js';
import { MatchEventDramaticModal, type DramaticEventData } from '../components/MatchEventDramaticModal.js';
import { MatchStatsPanel } from '../components/MatchStatsPanel.js';
import { OptionsMenuModal } from '../components/OptionsMenuModal.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { PenaltyInteractiveModal } from '../components/PenaltyInteractiveModal.js';
import { PitchField, getFormationSlots } from '../components/PitchField.js';
import { calculateStoppageTime, formatMatchClock } from '../lib/matchClock.js';
import { eventIcon, eventVariant } from '../lib/matchEventDisplay.js';
import { useClubColor } from '../lib/useClubColor.js';
import { soundFx } from '../lib/soundEffects.js';
import { PitchVisualizer } from '../components/PitchVisualizer.js';
import { TouchlineAssistantCard, findBestSubstitute } from '../components/TouchlineAssistantCard.js';
import { resetScrollToTop } from '../components/ScrollToTop.js';
import { ClockIcon, SquadIcon, TacticsIcon, LightningIcon, ShieldIcon, SoccerBallIcon, EyeIcon, RefreshIcon, SwordsIcon, FlameIcon, AlertTriangleIcon } from '../components/icons/AppIcons.js';

interface RoundGoalNotice {
  id: string;
  matchId: string;
  minute: number;
  headline: string;
  scoreline: string;
  isRival: boolean;
}

interface GoalQueueItem {
  event: MatchEvent;
  club: Club | null;
  scoreline: string;
  isOpponent: boolean;
}

function getEventKey(ev: MatchEvent): string {
  return `${ev.minute}-${ev.type}-${ev.team}-${ev.playerId ?? ''}-${ev.description?.slice(0, 15) ?? ''}`;
}

function getScorelineAtEvent(events: MatchEvent[], targetEvent: MatchEvent): string {
  let home = 0;
  let away = 0;
  for (const ev of events) {
    if (ev.minute > targetEvent.minute) break;
    if (ev.type === 'goal') {
      if (ev.team === 'home') home++;
      else if (ev.team === 'away') away++;
    }
  }
  return `${home} - ${away}`;
}

interface ClubInfo {
  name: string;
  slug: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

const TOTAL_MINUTES = 90;
const TICK_MS = 600;

type SpeedKey = 'slow' | 'normal' | 'fast' | 'superfast';
const SPEED_OPTIONS: { key: SpeedKey; label: string; durationMs: number }[] = [
  { key: 'slow', label: 'Lento', durationMs: 150 * 1000 },
  { key: 'normal', label: 'Normal', durationMs: 75 * 1000 },
  { key: 'fast', label: 'Rápido', durationMs: 37.5 * 1000 },
  { key: 'superfast', label: 'Muito rápido', durationMs: 20 * 1000 },
];

function competitionRoundLabel(competition: MatchCompetition): string {
  if (competition.type === 'league') return `${competition.division}ª Divisão - ${competition.round}ª rodada`;
  const fromEnd = competition.totalRounds - competition.round;
  if (fromEnd === 0) return `${competition.name} - Final`;
  if (fromEnd === 1) return `${competition.name} - Semifinal`;
  if (fromEnd === 2) return `${competition.name} - Quartas de final`;
  if (fromEnd === 3) return `${competition.name} - Oitavas de final`;
  return `${competition.name} - Rodada ${competition.round}`;
}

function computeMomentum(events: MatchEvent[], currentMinute: number): number {
  const windowMinutes = 10;
  const from = Math.max(0, currentMinute - windowMinutes);
  const recent = events.filter((e) => e.minute >= from && e.minute <= currentMinute);

  let homeScore = 1;
  let awayScore = 1;
  for (const ev of recent) {
    const weight = ev.type === 'goal' ? 5 : ev.type === 'card' ? -2 : 1;
    if (ev.team === 'home') homeScore += weight;
    if (ev.team === 'away') awayScore += weight;
  }
  const total = homeScore + awayScore;
  return Math.round((homeScore / total) * 100);
}

function momentumLabel(momentumHome: number, homeName: string, awayName: string): string {
  if (momentumHome >= 65) return `Pressão intensa do ${homeName}`;
  if (momentumHome >= 55) return `${homeName} com mais volume`;
  if (momentumHome <= 35) return `Pressão intensa do ${awayName}`;
  if (momentumHome <= 45) return `${awayName} com mais volume`;
  return 'Jogo equilibrado';
}

function lastHighlightEvent(events: MatchEvent[]): MatchEvent | undefined {
  return [...events].reverse().find((e) => e.type === 'goal' || e.type === 'card' || e.type === 'injury');
}

/** Retorna o melhor jogador reserva disponível para substituir o titular lesionado */
function getBestSubstituteCandidate(
  myClub: Club | null,
  tactic: Tactic | null,
  injuredPlayerId: string | undefined,
  events: MatchEvent[],
  side: 'home' | 'away' | null,
  decisionOptions: InjuryDecisionOptions | null,
): Player | null {
  if (!myClub) return null;
  if (decisionOptions?.suggestedId) {
    const candidate = myClub.players.find((p) => p.id === decisionOptions.suggestedId);
    if (candidate) return candidate;
  }
  if (decisionOptions?.candidates && decisionOptions.candidates.length > 0) {
    return decisionOptions.candidates[0];
  }
  if (!tactic || !side) return null;

  const injured = injuredPlayerId ? myClub.players.find((p) => p.id === injuredPlayerId) : null;
  const starterIds = new Set(tactic.lineup.map((s) => s.playerId));
  const subbedOutIds = new Set<string>();
  events.forEach((ev) => {
    if (ev.type === 'substitution' && ev.team === side && ev.playerId) {
      subbedOutIds.add(ev.playerId);
    }
  });

  const availableBench = myClub.players.filter(
    (p) =>
      !starterIds.has(p.id) &&
      !subbedOutIds.has(p.id) &&
      (p.injuryWeeks ?? 0) === 0 &&
      (p.suspensions?.length ?? 0) === 0,
  );

  if (availableBench.length === 0) return null;

  if (injured) {
    const samePosition = availableBench.filter((p) => p.position === injured.position);
    if (samePosition.length > 0) {
      samePosition.sort((a, b) => b.overall - a.overall || (a.fatigue ?? 0) - (b.fatigue ?? 0));
      return samePosition[0];
    }
  }

  availableBench.sort((a, b) => b.overall - a.overall || (a.fatigue ?? 0) - (b.fatigue ?? 0));
  return availableBench[0];
}

export function LiveMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [match, setMatch] = useState<Match | null>(null);
  const [homeClub, setHomeClub] = useState<Club | null>(null);
  const [awayClub, setAwayClub] = useState<Club | null>(null);
  const [myClub, setMyClub] = useState<Club | null>(null);
  const [mySide, setMySide] = useState<'home' | 'away' | null>(null);
  const mySideRef = useRef<'home' | 'away' | null>(null);
  const myClubRef = useRef<Club | null>(null);
  const homeClubRef = useRef<Club | null>(null);
  const awayClubRef = useRef<Club | null>(null);

  useEffect(() => {
    mySideRef.current = mySide;
  }, [mySide]);
  useEffect(() => {
    myClubRef.current = myClub;
  }, [myClub]);
  useEffect(() => {
    homeClubRef.current = homeClub;
  }, [homeClub]);
  useEffect(() => {
    awayClubRef.current = awayClub;
  }, [awayClub]);
  const [competition, setCompetition] = useState<MatchCompetition | null>(null);
  const [siblings, setSiblings] = useState<Match[]>([]);
  const [siblingClubInfo, setSiblingClubInfo] = useState<Record<string, ClubInfo>>({});

  const [displayMinute, setDisplayMinute] = useState(0);
  const [speedKey, setSpeedKey] = useState<SpeedKey>('fast');
  /** O modo da carreira, que decide quais velocidades estão abertas. */
  const [gameMode, setGameMode] = useState<GameMode>('STANDARD');
  /** A explicação de uma velocidade recusada, para o cadeado nunca ser um botão que não faz nada. */
  const [speedBlock, setSpeedBlock] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState<'halftime' | 'stoppage' | 'manual' | null>(null);
  const [halftimeSeen, setHalftimeSeen] = useState(false);
  const [clockFormat, setClockFormat] = useState<ClockFormat>('HALF_45');

  // Opponent goal alert state (danger flash on scoreboard)
  const [opponentGoalAlert, setOpponentGoalAlert] = useState(false);
  const opponentGoalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tactical Pop-up Modal State
  const [tacticalModalOpen, setTacticalModalOpen] = useState(false);
  const [tacticalModalMode, setTacticalModalMode] = useState<LiveTacticalModalMode>('manual');
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [pitchViewTab, setPitchViewTab] = useState<'RADAR_2D' | 'TACTICAL_XI'>('RADAR_2D');
  const [rightSidebarTab, setRightSidebarTab] = useState<'LANCES' | 'STATS'>('LANCES');
  const [onlyImportantEvents, setOnlyImportantEvents] = useState(false);
  const [autoPauseCritical, setAutoPauseCritical] = useState(true);
  const autoPauseCriticalRef = useRef(true);
  useEffect(() => {
    autoPauseCriticalRef.current = autoPauseCritical;
  }, [autoPauseCritical]);
  const [selectedReplayEvent, setSelectedReplayEvent] = useState<MatchEvent | null>(null);
  const [spiedMatchId, setSpiedMatchId] = useState<string | null>(null);
  const [tacticControlMode, setTacticControlMode] = useState<'DIRECT' | 'TACTICAL'>('DIRECT');
  const [goldenWindowUntilMinute, setGoldenWindowUntilMinute] = useState<number | null>(null);
  const [activeLeague, setActiveLeague] = useState<League | null>(null);
  const [spentMomentum, setSpentMomentum] = useState<number>(0);
  const [lastSpendMinute, setLastSpendMinute] = useState<number | null>(null);
  const [tacticalBoostCount, setTacticalBoostCount] = useState<number>(0);
  const [activeMomentumSkill, setActiveMomentumSkill] = useState<MomentumSkillId | null>(null);
  const [roundGoalNotices, setRoundGoalNotices] = useState<RoundGoalNotice[]>([]);
  const [activeRoundBanner, setActiveRoundBanner] = useState<RoundGoalNotice | null>(null);
  const seenSiblingGoalsRef = useRef<Record<string, number>>({});
  const [halftimeTalkResult, setHalftimeTalkResult] = useState<{
    label: string;
    effect: string;
    message: string;
  } | null>(null);
  const [halftimeTalkBusy, setHalftimeTalkBusy] = useState(false);
  const [pressAnswers, setPressAnswers] = useState<Record<string, QuickPressOption>>({});
  const [pressDelegated, setPressDelegated] = useState(false);

  // Stoppage decision state
  const [decisionOptions, setDecisionOptions] = useState<InjuryDecisionOptions | null>(null);

  // Goal celebrations queue & dramatic popups
  const [goalQueue, setGoalQueue] = useState<GoalQueueItem[]>([]);
  const currentGoalEvent = goalQueue[0] ?? null;
  const seenGoalKeysRef = useRef<Set<string>>(new Set());
  const seenEventKeysRef = useRef<Set<string>>(new Set());
  const [dramaticEvent, setDramaticEvent] = useState<DramaticEventData | null>(null);
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [interactiveTaker, setInteractiveTaker] = useState<Player | null>(null);
  const [interactivePenaltyOutcome, setInteractivePenaltyOutcome] = useState<{
    outcome: PenaltyShotOutcome;
    targetZone: PenaltyTargetZone;
    gkZone: PenaltyTargetZone;
  } | null>(null);
  const pendingPenaltyEventRef = useRef<MatchEvent | null>(null);

  const [busy, setBusy] = useState(false);
  const [quickTacticBusy, setQuickTacticBusy] = useState(false);
  const [autoSubNotification, setAutoSubNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playAnchorRef = useRef<{ realTime: number; gameMinute: number } | null>(null);
  const requestedMinuteRef = useRef(0);
  const advancingRef = useRef(false);
  const siblingsRequestedMinuteRef = useRef<Record<string, number>>({});
  const lastSeenGoalCountRef = useRef(0);
  const seenDramaticKeysRef = useRef<Set<string>>(new Set());
  /** Latest event timeline, so the tick loop recomputes the announced stoppage as events accrue mid-half. */
  const liveEventsRef = useRef<MatchEvent[]>([]);

  const clubColor = useClubColor(myClub);

  // Garante que ao entrar na partida a visualização comece sempre no topo (placar visível)
  useEffect(() => {
    resetScrollToTop('instant');
  }, [matchId]);

  function handleStartMatch() {
    playAnchorRef.current = { realTime: Date.now(), gameMinute: requestedMinuteRef.current };
    setPauseReason(null);
    resetScrollToTop('smooth');
  }

  // Load initial match data & manager preferences
  useEffect(() => {
    if (!matchId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [data, myClubs, savesRes] = await Promise.all([
          getMatch(matchId),
          listMyClubs(),
          listSaves().catch(() => null),
        ]);

        if (data.status !== 'LIVE' && !data.live) {
          navigate(`/match/${matchId}/result`, { replace: true });
          return;
        }

        setMatch(data);
        const initialEvents = data.live?.events ?? data.result?.events ?? [];
        liveEventsRef.current = initialEvents;
        initialEvents.forEach((e) => {
          const k = getEventKey(e);
          seenEventKeysRef.current.add(k);
          if (e.type === 'goal') seenGoalKeysRef.current.add(k);
        });

        if (savesRes?.currentManager?.gameMode) {
          setGameMode(savesRes.currentManager.gameMode);
        }
        if (savesRes?.currentManager?.clockFormat) {
          setClockFormat(savesRes.currentManager.clockFormat);
        }

        const [h, a] = await Promise.all([getClub(data.homeClubId), getClub(data.awayClubId)]);
        setHomeClub(h);
        setAwayClub(a);
        homeClubRef.current = h;
        awayClubRef.current = a;

        const managerClubId = savesRes?.currentManager?.clubId;
        const isHome = myClubs.some((c) => c.id === data.homeClubId) || managerClubId === data.homeClubId;
        const isAway = myClubs.some((c) => c.id === data.awayClubId) || managerClubId === data.awayClubId;
        const side = isHome ? 'home' : isAway ? 'away' : null;
        const resolvedMyClub = isHome ? h : isAway ? a : null;
        setMySide(side);
        setMyClub(resolvedMyClub);
        mySideRef.current = side;
        myClubRef.current = resolvedMyClub;

        const startMinute = data.live?.currentMinute ?? 0;
        setDisplayMinute(startMinute);
        requestedMinuteRef.current = startMinute;
        if (data.live?.period === 'HT') {
          setHalftimeSeen(false);
          setPauseReason('halftime');
          setTacticalModalMode('halftime');
          setTacticalModalOpen(true);
        } else if (data.live?.period === '2T' || startMinute > 45) {
          setHalftimeSeen(true);
          setPauseReason(data.live?.pendingDecision ? 'stoppage' : null);
        } else if (startMinute === 0) {
          setHalftimeSeen(false);
          setPauseReason(data.live?.pendingDecision ? 'stoppage' : null);
        } else {
          setHalftimeSeen(false);
          setPauseReason(data.live?.pendingDecision ? 'stoppage' : null);
        }

        if (data.live?.pendingDecision && data.live.pendingDecision.side === side) {
          const userClub = resolvedMyClub;
          if (data.live.pendingDecision.type === 'injury') {
            const injured = userClub?.players.find((p) => p.id === data.live?.pendingDecision?.playerId);
            const injuryEvent = data.live.events.find(
              (e) => e.type === 'injury' && e.playerId === data.live?.pendingDecision?.playerId,
            );
            setDramaticEvent({
              type: 'injury',
              minute: data.live.pendingDecision.minute,
              period: injuryEvent?.period,
              stoppageMinute: injuryEvent?.stoppageMinute,
              player: injured,
              club: userClub ?? undefined,
            });
          } else if (data.live.pendingDecision.type === 'redCard') {
            const sentOff = userClub?.players.find((p) => p.id === data.live?.pendingDecision?.playerId);
            const cardEvent = data.live.events.find(
              (e) => e.type === 'card' && e.playerId === data.live?.pendingDecision?.playerId,
            );
            setDramaticEvent({
              type: 'red_card',
              minute: data.live.pendingDecision.minute,
              period: cardEvent?.period,
              stoppageMinute: cardEvent?.stoppageMinute,
              player: sentOff,
              club: userClub ?? undefined,
            });
          }
        }

        const { competition: comp, fixtures: siblingMatches } = await getMatchSiblings(matchId);
        setCompetition(comp);
        setSiblings(siblingMatches);
        siblingMatches.forEach((m) => {
          siblingsRequestedMinuteRef.current[m.id] = m.live?.currentMinute ?? 0;
          const totalG = m.result ? m.result.homeGoals + m.result.awayGoals : m.live ? m.live.homeGoals + m.live.awayGoals : 0;
          seenSiblingGoalsRef.current[m.id] = totalG;
        });

        const siblingClubIds = [...new Set(siblingMatches.flatMap((m) => [m.homeClubId, m.awayClubId]))];
        const siblingClubs = await Promise.all(siblingClubIds.map((id) => getClub(id).catch(() => null)));
        const info: Record<string, ClubInfo> = {};
        siblingClubs.forEach((c) => {
          if (c) {
            info[c.id] = {
              name: c.name,
              slug: c.slug,
              crestBase64: c.crestBase64,
              primaryColor: c.primaryColor,
              secondaryColor: c.secondaryColor,
            };
          }
        });
        setSiblingClubInfo(info);

        if (comp?.type === 'league' && (resolvedMyClub?.id || data.homeClubId)) {
          getActiveLeague(resolvedMyClub?.id ?? data.homeClubId)
            .then((lg) => {
              if (lg) setActiveLeague(lg);
            })
            .catch(() => {});
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [matchId]);

  const [isFullTime, setIsFullTime] = useState(false);

  function enterStoppage(stoppedAt: number) {
    requestedMinuteRef.current = stoppedAt;
    setDisplayMinute(stoppedAt);
    playAnchorRef.current = null;
    setPauseReason('stoppage');
  }

  
  async function handleGoToResult() {
    if (!matchId) return;
    const dueSiblings = siblings.filter((s) => s.status === 'LIVE');
    if (dueSiblings.length > 0) {
      await Promise.all(dueSiblings.map((s) => tickLiveMatch(s.id, TOTAL_MINUTES).catch(() => null)));
    }
    navigate(`/match/${matchId}/result`);
  }

  // Notice: The screen no longer abruptly kicks the player out upon final whistle!
  // Instead, the final score and full-time celebration/button are preserved for the player.

  // Kickoff whistle on match load
  const hasPlayedKickoffWhistleRef = useRef(false);
  useEffect(() => {
    if (match && match.status === 'LIVE' && !hasPlayedKickoffWhistleRef.current) {
      hasPlayedKickoffWhistleRef.current = true;
      soundFx.playWhistle('start');
    }
  }, [match?.status]);

  function handleDismissGoal() {
    setGoalQueue((prev) => {
      const next = prev.slice(1);
      if (next.length === 0) {
        const stoppage = calculateStoppageTime(liveEventsRef.current);
        const half1Limit = 45 + stoppage.half1;
        if (!halftimeSeen && (match?.live?.currentMinute ?? clockMinute) >= half1Limit) {
          playAnchorRef.current = null;
          requestedMinuteRef.current = half1Limit;
          setDisplayMinute(half1Limit);
          setPauseReason('halftime');
          setTacticalModalMode('halftime');
          setTacticalModalOpen(true);
        } else if (match?.status === 'SIMULATED' || isFullTime) {
          setPauseReason('manual');
        } else {
          setPauseReason(null);
        }
      } else {
        const nextGoal = next[0];
        if (nextGoal.isOpponent) {
          soundFx.playWhistle('event');
        } else {
          soundFx.playGoalCheer();
          soundFx.playWhistle('short');
        }
        playAnchorRef.current = null;
        requestedMinuteRef.current = nextGoal.event.minute;
        setDisplayMinute(nextGoal.event.minute);
        setPauseReason('manual');
      }
      return next;
    });
  }

  // Simulation tick effect
  useEffect(() => {
    if (pauseReason !== null || !match || match.status !== 'LIVE' || isFullTime) return;

    playAnchorRef.current = { realTime: Date.now(), gameMinute: requestedMinuteRef.current };
    const msPerGameMinute = (SPEED_OPTIONS.find((s) => s.key === speedKey) ?? SPEED_OPTIONS[0]).durationMs / TOTAL_MINUTES;

    const interval = setInterval(async () => {
      const anchor = playAnchorRef.current;
      if (!anchor || advancingRef.current) return;

      // Recomputed every tick so the announced added time tracks the events that actually accrued in the
      // half — a sub or a goal after the 60th minute genuinely pushes the board out.
      const stoppage = calculateStoppageTime(liveEventsRef.current);
      const halfCeiling = halftimeSeen ? TOTAL_MINUTES + stoppage.half2 : 45 + stoppage.half1;

      const elapsed = Date.now() - anchor.realTime;
      const target = Math.min(halfCeiling, anchor.gameMinute + elapsed / msPerGameMinute);
      setDisplayMinute(target);

      const serverTargetInt = Math.floor(target);

      if (serverTargetInt > requestedMinuteRef.current) {
        advancingRef.current = true;
        requestedMinuteRef.current = serverTargetInt;
        try {
          const updated = await advanceLiveMatch(matchId!, serverTargetInt);
          setMatch((prev) => {
            const allEvents = updated.live?.events ?? updated.result?.events ?? [];
            liveEventsRef.current = allEvents;

            const newEvents = allEvents.filter((ev) => {
              const k = getEventKey(ev);
              if (seenEventKeysRef.current.has(k)) return false;
              seenEventKeysRef.current.add(k);
              return true;
            });

            // Enfileira novos gols detectados (apenas do próprio time tem celebração em tela cheia)
            const newGoalItems: GoalQueueItem[] = [];
            const currentSide = mySideRef.current ?? mySide;
            const currentClub = myClubRef.current ?? myClub;
            const currentHome = homeClubRef.current ?? homeClub;
            const currentAway = awayClubRef.current ?? awayClub;

            for (const ev of newEvents) {
              if (ev.type === 'goal') {
                const goalKey = getEventKey(ev);
                if (!seenGoalKeysRef.current.has(goalKey)) {
                  seenGoalKeysRef.current.add(goalKey);
                  // Se for pênalti do usuário, a cobrança interativa já enfileira a celebração ao confirmar
                  if (ev.isPenalty && currentSide !== null && ev.team === currentSide) {
                    // Mantém para o fluxo do modal interativo de pênalti abaixo
                  } else if (currentSide !== null && ev.team !== currentSide) {
                    // Gol adversário: apenas som de vaia/decepção e destaque vermelho no placar.
                    // Sem animação overlay de celebração e sem pausar a partida!
                    soundFx.playOpponentGoalBoo();
                    setOpponentGoalAlert(true);
                    if (opponentGoalTimerRef.current) clearTimeout(opponentGoalTimerRef.current);
                    opponentGoalTimerRef.current = setTimeout(() => {
                      setOpponentGoalAlert(false);
                    }, 4000);
                  } else if (currentSide !== null && ev.team === currentSide) {
                    const scoringClub = ev.team === 'home' ? currentHome : currentAway;
                    const scoreline = getScorelineAtEvent(allEvents, ev);
                    newGoalItems.push({
                      event: ev,
                      club: scoringClub ?? currentClub,
                      scoreline,
                      isOpponent: false,
                    });
                  }
                }
              }
            }

            if (newGoalItems.length > 0) {
              if (autoPauseCriticalRef.current) {
                setGoalQueue((prev) => {
                  const isQueueEmpty = prev.length === 0;
                  if (isQueueEmpty) {
                    const first = newGoalItems[0];
                    soundFx.playGoalCheer();
                    soundFx.playWhistle('short');
                    playAnchorRef.current = null;
                    requestedMinuteRef.current = first.event.minute;
                    setDisplayMinute(first.event.minute);
                    setPauseReason('manual');
                  }
                  return [...prev, ...newGoalItems];
                });
              } else {
                soundFx.playGoalCheer();
              }
            }

            // Checa eventos dramáticos para o time do usuário (pênalti, cartão vermelho, substituição)
            for (const ev of newEvents) {
              const eventKey = `${ev.type}_${ev.minute}_${ev.playerId ?? '0'}`;
              if (ev.isPenalty && currentSide !== null && ev.team === currentSide && currentClub) {
                if (!seenDramaticKeysRef.current.has(eventKey)) {
                  seenDramaticKeysRef.current.add(eventKey);
                  soundFx.playWhistle('event');
                  const pt = currentClub.players.find((p) => p.id === ev.playerId) ?? currentClub.players[0];
                  playAnchorRef.current = null;
                  requestedMinuteRef.current = ev.minute;
                  setDisplayMinute(ev.minute);
                  setPauseReason('manual');
                  setInteractiveTaker(pt);
                  pendingPenaltyEventRef.current = ev;
                  setInteractivePenaltyOutcome(null);
                  setPenaltyModalOpen(true);
                }
              } else if (
                ev.type === 'card' &&
                currentSide !== null &&
                ev.team === currentSide &&
                currentClub &&
                (ev.suspensionMatches !== undefined || ev.description.toLowerCase().includes('vermelho'))
              ) {
                if (!seenDramaticKeysRef.current.has(eventKey)) {
                  seenDramaticKeysRef.current.add(eventKey);
                  soundFx.playWhistle('event');
                  const sentOff = currentClub.players.find((p) => p.id === ev.playerId);
                  playAnchorRef.current = null;
                  requestedMinuteRef.current = ev.minute;
                  setDisplayMinute(ev.minute);
                  setPauseReason('stoppage');
                  setDramaticEvent({
                    type: 'red_card',
                    minute: ev.minute,
                    period: ev.period,
                    stoppageMinute: ev.stoppageMinute,
                    player: sentOff,
                    club: currentClub,
                  });
                }
              } else if (ev.type === 'substitution' && currentSide !== null && ev.team === currentSide && currentClub) {
                if (!seenDramaticKeysRef.current.has(eventKey)) {
                  seenDramaticKeysRef.current.add(eventKey);
                  const outPlayer = currentClub.players.find((p) => p.id === ev.playerId);
                  const inPlayer = currentClub.players.find((p) => p.id === ev.relatedPlayerId);
                  const outName = outPlayer?.name ?? 'Titular';
                  const inName = inPlayer?.name ?? 'Reserva';
                  setAutoSubNotification(`Substituição Automática (Lesão): ${inName} entra no lugar de ${outName}`);
                  setTimeout(() => setAutoSubNotification(null), 6000);
                }
              }
            }

            if (updated.live?.pendingDecision && currentSide !== null && updated.live.pendingDecision.side === currentSide && currentClub) {
              const pending = updated.live.pendingDecision;
              const pendingKey = `${pending.type}_${pending.minute}_${pending.playerId ?? '0'}`;
              if (!seenDramaticKeysRef.current.has(pendingKey)) {
                seenDramaticKeysRef.current.add(pendingKey);
                soundFx.playWhistle('event');
                playAnchorRef.current = null;
                requestedMinuteRef.current = pending.minute;
                setDisplayMinute(pending.minute);
                setPauseReason('stoppage');
                if (pending.type === 'injury') {
                  const injured = currentClub.players.find((p) => p.id === pending.playerId);
                  const injuryEvent = (updated.live.events ?? []).find(
                    (e) => e.type === 'injury' && e.playerId === pending.playerId,
                  );
                  setDramaticEvent({
                    type: 'injury',
                    minute: pending.minute,
                    period: injuryEvent?.period,
                    stoppageMinute: injuryEvent?.stoppageMinute,
                    player: injured,
                    club: currentClub,
                  });
                } else if (pending.type === 'redCard') {
                  const sentOff = currentClub.players.find((p) => p.id === pending.playerId);
                  const cardEvent = (updated.live.events ?? []).find(
                    (e) => e.type === 'card' && e.playerId === pending.playerId,
                  );
                  setDramaticEvent({
                    type: 'red_card',
                    minute: pending.minute,
                    period: cardEvent?.period,
                    stoppageMinute: cardEvent?.stoppageMinute,
                    player: sentOff,
                    club: currentClub,
                  });
                }
              }
            }
            return updated;
          });

          if (updated.status === 'SIMULATED') {
            soundFx.playWhistle('fulltime');
            setIsFullTime(true);
            setPauseReason('manual');
          }

          if (!halftimeSeen && (updated.live?.period === 'HT' || serverTargetInt >= halfCeiling)) {
            soundFx.playWhistle('halftime');
            playAnchorRef.current = null;
            setDisplayMinute(halfCeiling);
            requestedMinuteRef.current = halfCeiling;
            setPauseReason('halftime');
            setTacticalModalMode('halftime');
            setTacticalModalOpen(true);
            return;
          }

          if (updated.live?.pendingDecision) {
            enterStoppage(updated.live.currentMinute);
            return;
          }
        } catch (err) {
          setError((err as Error).message);
        } finally {
          advancingRef.current = false;
        }
      }

      if (!halftimeSeen && (target >= halfCeiling || match.live?.period === 'HT')) {
        soundFx.playWhistle('halftime');
        playAnchorRef.current = null;
        setDisplayMinute(halfCeiling);
        requestedMinuteRef.current = halfCeiling;
        setPauseReason('halftime');
        setTacticalModalMode('halftime');
        setTacticalModalOpen(true);
      }

      const dueSiblings = siblings.filter(
        (s) => s.status === 'LIVE' && serverTargetInt > (siblingsRequestedMinuteRef.current[s.id] ?? 0),
      );
      if (dueSiblings.length > 0) {
        dueSiblings.forEach((s) => {
          siblingsRequestedMinuteRef.current[s.id] = serverTargetInt;
        });
        const updates = await Promise.all(dueSiblings.map((s) => tickLiveMatch(s.id, serverTargetInt).catch(() => null)));
        setSiblings((prev) => {
          const byId = new Map(prev.map((s) => [s.id, s]));
          updates.forEach((u) => {
            if (u) byId.set(u.id, u);
          });
          return [...byId.values()];
        });
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [pauseReason, match?.status, speedKey, halftimeSeen, isFullTime, mySide]);

  // Lances que o motor já decidiu para os próximos minutos (espiada, sem gravar nada). Só o campo 2D usa isto,
  // para a bola já estar perto do gol quando o relógio revelar o lance. Placar, som, pausa e eventos na tela
  // continuam esperando o relógio, como sempre. Qualquer mudança no estado do motor (minuto, sorteio, tática,
  // substituição) invalida a previsão e pede outra.
  const [lookahead, setLookahead] = useState<MatchEvent[]>([]);
  const minuteMs = (SPEED_OPTIONS.find((o) => o.key === speedKey) ?? SPEED_OPTIONS[0]).durationMs / TOTAL_MINUTES;
  const peekSignature = useMemo(() => {
    const l = match?.live;
    if (!l || match?.status !== 'LIVE' || l.pendingDecision) return '';
    return [l.currentMinute, l.period ?? '', l.rngState, JSON.stringify([l.homeTactic, l.awayTactic])].join('|');
  }, [match?.live, match?.status]);
  const peekFromMinute = match?.live?.currentMinute ?? 0;
  useEffect(() => {
    if (!peekSignature || !matchId) {
      setLookahead([]);
      return;
    }
    // Olha ~5 s reais à frente (um pouco mais que a janela de preparação do campo), qualquer que seja a velocidade.
    const minutes = Math.min(30, Math.max(2, Math.ceil(5000 / minuteMs)));
    let cancelled = false;
    void peekLiveMatch(matchId, peekFromMinute + minutes).then((events) => {
      if (!cancelled) setLookahead(events);
    });
    return () => {
      cancelled = true;
    };
  }, [peekSignature, matchId, minuteMs]);


  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      if (!match || match.status !== 'LIVE') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (goalQueue.length > 0) {
          handleDismissGoal();
          return;
        }
        if (isFullTime) {
          void handleGoToResult();
          return;
        }
        if (pauseReason === 'manual' && clockMinute === 0) {
          handleStartMatch();
          return;
        }
        if (pauseReason === 'halftime') {
          openTacticalCenter('halftime');
          return;
        }
        setPauseReason((prev) => (prev === 'stoppage' ? prev : prev === null ? 'manual' : null));
        return;
      }

      const speedIndex = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (speedIndex !== -1 && SPEED_OPTIONS[speedIndex]) {
        setSpeedKey(SPEED_OPTIONS[speedIndex].key);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [match?.status]);

  // AUTOMATIC TRIGGER: Halftime (45') opens the tactical modal
  useEffect(() => {
    if (pauseReason === 'halftime') {
      setTacticalModalMode('halftime');
      setTacticalModalOpen(true);
    }
  }, [pauseReason]);

  // AUTOMATIC TRIGGER: Decisão de expulsão abre o modal dramático de cartão vermelho
  useEffect(() => {
    const pending = match?.live?.pendingDecision;
    const currentSide = mySideRef.current ?? mySide;
    const currentClub = myClubRef.current ?? myClub;
    if (pending && currentSide === pending.side && currentClub && !dramaticEvent) {
      if (pending.type === 'redCard') {
        const sentOff = currentClub.players.find((p) => p.id === pending.playerId);
        setDramaticEvent({
          type: 'red_card',
          minute: pending.minute,
          player: sentOff,
          club: currentClub,
        });
        setPauseReason('stoppage');
      }
    }
  }, [match?.live?.pendingDecision?.playerId, match?.live?.pendingDecision?.minute, mySide]);

  // Fetch injury options when an injury decision occurs
  useEffect(() => {
    const pending = match?.live?.pendingDecision;
    if (!pending || pending.type !== 'injury' || !matchId) {
      setDecisionOptions(null);
      return;
    }
    let cancelled = false;
    getInjuryDecision(matchId)
      .then((options) => {
        if (!cancelled) setDecisionOptions(options);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, match?.live?.pendingDecision?.playerId, match?.live?.pendingDecision?.minute]);

  function openTacticalCenter(mode: LiveTacticalModalMode = 'manual') {
    if (!match?.live) return;
    if (mode === 'manual' && pauseReason === null) {
      setPauseReason('manual');
    }
    setTacticalModalMode(mode);
    setTacticalModalOpen(true);
  }

  // Handle saving changes from Tactical Modal
  async function handleSaveTacticalModal(updated: {
    formation: Formation;
    mentality: Mentality;
    attackStyle: AttackStyle;
    markingStyle: MarkingStyle;
    attackApproach: AttackApproach;
    pressing: PressingIntensity;
    lineup: string[];
    subOutId?: string;
    subInId?: string;
  }) {
    if (!match?.live || !myClub || !mySide) return;
    setBusy(true);
    setError(null);
    try {
      const current = mySide === 'home' ? match.live.homeTactic : match.live.awayTactic;
      const plannedSubstitutions = [...current.plannedSubstitutions];
      if (updated.subOutId && updated.subInId) {
        plannedSubstitutions.push({
          id: `live-sub-${Date.now()}`,
          minute: Math.min(TOTAL_MINUTES, Math.floor(displayMinute) + 1),
          outPlayerId: updated.subOutId,
          inPlayerId: updated.subInId,
        });
      }

      const formationSlots = getFormationSlots(updated.formation);
      const tactic = {
        clubId: myClub.id,
        formation: updated.formation,
        mentality: updated.mentality,
        attackStyle: updated.attackStyle,
        markingStyle: updated.markingStyle,
        attackApproach: updated.attackApproach,
        pressing: updated.pressing,
        lineup: updated.lineup.map((playerId, i) => ({
          slotIndex: i,
          playerId,
          role: (formationSlots[i]?.position ?? 'MC') as any,
        })),
        substitutes: current.substitutes,
        plannedSubstitutions,
      };

      if (match.live.pendingDecision?.type === 'redCard') {
        const updatedMatch = await resolveRedCardDecision(match.id, updated.lineup);
        setMatch(updatedMatch);
      } else if (match.live.pendingDecision?.type === 'injury') {
        const candidateIn = updated.subInId ?? updated.lineup.find((id) => id !== match.live?.pendingDecision?.playerId) ?? null;
        const updatedMatch = await resolveInjuryDecision(match.id, candidateIn);
        setMatch(updatedMatch);
      } else {
        const updatedMatch = await updateLiveMatchTactic(match.id, tactic);
        setMatch(updatedMatch);
      }

      if (pauseReason === 'halftime' || tacticalModalMode === 'halftime' || (!halftimeSeen && (match.live?.currentMinute ?? clockMinute) >= 45)) {
        setHalftimeSeen(true);
        const stoppage = calculateStoppageTime(liveEventsRef.current);
        const resumeMinute = 45 + stoppage.half1;
        setDisplayMinute(resumeMinute);
        requestedMinuteRef.current = resumeMinute;
        playAnchorRef.current = { realTime: Date.now(), gameMinute: resumeMinute };
      }

      setDecisionOptions(null);
      setDramaticEvent(null);
      setTacticalModalOpen(false);
      setPauseReason(null); // Auto-resume match upon saving tactics!
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveStoppage(replacementPlayerId: string | null) {
    await submitDecision(() => resolveInjuryDecision(matchId!, replacementPlayerId));
    setDramaticEvent(null);
    setTacticalModalOpen(false);
  }

  async function handleResolveRedCard(lineupPlayerIds: string[] | null) {
    await submitDecision(() => resolveRedCardDecision(matchId!, lineupPlayerIds));
    setDramaticEvent(null);
    setTacticalModalOpen(false);
  }

  async function submitDecision(send: () => Promise<Match>) {
    if (!matchId) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await send();
      setMatch(updated);
      setDecisionOptions(null);
      setDramaticEvent(null);
      setPauseReason(null); // Auto-resume match immediately!
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  type LiveTacticalStance = 'press' | 'counter' | 'balanced';

  function getActiveTacticalStance(tactic?: Tactic | null): LiveTacticalStance {
    if (!tactic) return 'balanced';
    if (tactic.attackApproach === 'COUNTER_ATTACK' || (tactic.mentality === 'defensive' && tactic.pressing === 'LOW_BLOCK')) {
      return 'counter';
    }
    if (tactic.pressing === 'HIGH_PRESS' || tactic.mentality === 'attacking' || tactic.attackApproach === 'TOTAL_ATTACK') {
      return 'press';
    }
    return 'balanced';
  }

  async function quickApplyTacticalStance(stance: LiveTacticalStance) {
    if (!match?.live || !myClub || !mySide || quickTacticBusy) return;
    soundFx.playTacticalClick();
    setQuickTacticBusy(true);
    try {
      const current = (mySide === 'home' ? match.live.homeTactic : match.live.awayTactic) ?? effectiveTactic;
      let patch: Partial<Tactic> = {};
      if (stance === 'press') {
        patch = { mentality: 'attacking', pressing: 'HIGH_PRESS', attackApproach: 'TOTAL_ATTACK' };
      } else if (stance === 'counter') {
        patch = { mentality: 'defensive', pressing: 'LOW_BLOCK', attackApproach: 'COUNTER_ATTACK' };
      } else {
        patch = { mentality: 'balanced', pressing: 'MEDIUM', attackApproach: 'BALANCED' };
      }
      const updated = await updateLiveMatchTactic(match.id, { ...current, ...patch });
      setMatch(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setQuickTacticBusy(false);
    }
  }

  async function quickUpdateTacticField<K extends keyof Tactic>(field: K, value: Tactic[K]) {
    if (!match?.live || !myClub || !mySide || quickTacticBusy) return;
    soundFx.playTacticalClick();
    setQuickTacticBusy(true);
    try {
      const current = (mySide === 'home' ? match.live.homeTactic : match.live.awayTactic) ?? effectiveTactic;
      const updated = await updateLiveMatchTactic(match.id, { ...current, [field]: value });
      setMatch(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setQuickTacticBusy(false);
    }
  }

  async function quickApplySubstitution(subOutId: string, subInId: string) {
    if (!match?.live || !myClub || !mySide || busy) return;
    soundFx.playTacticalClick();
    setBusy(true);
    try {
      const current = (mySide === 'home' ? match.live.homeTactic : match.live.awayTactic) ?? effectiveTactic;
      const outPlayer = myClub.players.find((p) => p.id === subOutId);
      const inPlayer = myClub.players.find((p) => p.id === subInId);
      const plannedSubstitutions = [
        ...current.plannedSubstitutions,
        {
          id: `live-sub-${Date.now()}`,
          minute: Math.min(TOTAL_MINUTES, Math.floor(displayMinute) + 1),
          outPlayerId: subOutId,
          inPlayerId: subInId,
        },
      ];
      const newLineup = current.lineup.map((slot) =>
        slot.playerId === subOutId ? { ...slot, playerId: subInId } : slot
      );
      const updatedTactic = {
        ...current,
        lineup: newLineup,
        plannedSubstitutions,
      };
      const updated = await updateLiveMatchTactic(match.id, updatedTactic);
      setMatch(updated);
      setAutoSubNotification(
        `Substituição imediata: sai ${outPlayer?.name ?? 'titular'}, entra ${inPlayer?.name ?? 'reserva'}!`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function quickApplyTacticalChange(changes: Partial<Tactic>) {
    if (!match?.live || !myClub || !mySide || quickTacticBusy) return;
    soundFx.playTacticalClick();
    setQuickTacticBusy(true);
    try {
      const current = (mySide === 'home' ? match.live.homeTactic : match.live.awayTactic) ?? effectiveTactic;
      const updated = await updateLiveMatchTactic(match.id, { ...current, ...changes });
      setMatch(updated);
      setTacticalBoostCount((prev) => prev + 1);
      setAutoSubNotification('Ajuste tático de beira de campo aplicado com sucesso!');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setQuickTacticBusy(false);
    }
  }

  // Detect goals in simultaneous round matches and notify with live standing impact
  useEffect(() => {
    if (!siblings || siblings.length === 0 || !match) return;
    const newNotices: RoundGoalNotice[] = [];

    for (const s of siblings) {
      const hGoals = s.result ? s.result.homeGoals : s.live ? s.live.homeGoals : 0;
      const aGoals = s.result ? s.result.awayGoals : s.live ? s.live.awayGoals : 0;
      const totalG = hGoals + aGoals;
      const prevG = seenSiblingGoalsRef.current[s.id] ?? totalG;

      if (totalG > prevG) {
        seenSiblingGoalsRef.current[s.id] = totalG;
        const hName = siblingClubInfo[s.homeClubId]?.name ?? s.homeClubId;
        const aName = siblingClubInfo[s.awayClubId]?.name ?? s.awayClubId;
        const lastEv = (s.live?.events ?? s.result?.events ?? []).filter((e) => e.type === 'goal').slice(-1)[0];
        const scorerClub = lastEv?.team === 'away' ? aName : hName;
        const minuteVal = lastEv?.minute ?? Math.floor(displayMinute);

        // Compute live table position after this round goal
        let posSuffix = '';
        const targetClubId = myClub?.id ?? homeClub?.id;
        if (activeLeague && competition?.type === 'league' && targetClubId) {
          const pastResults = activeLeague.fixtures
            .filter((f) => f.round < competition.round && f.result)
            .map((f) => ({
              homeClubId: f.homeClubId,
              awayClubId: f.awayClubId,
              homeGoals: f.result!.homeGoals,
              awayGoals: f.result!.awayGoals,
            }));
          const allFixtures = [match, ...siblings].map((m) => ({
            homeClubId: m.homeClubId,
            awayClubId: m.awayClubId,
            homeGoals: m.result ? m.result.homeGoals : m.live ? m.live.homeGoals : 0,
            awayGoals: m.result ? m.result.awayGoals : m.live ? m.live.awayGoals : 0,
          }));
          const tableNow = computeStandings(activeLeague.clubIds, [...pastResults, ...allFixtures]);
          const rankNow = tableNow.findIndex((r) => r.clubId === targetClubId) + 1;
          if (rankNow > 0) {
            posSuffix = ` · Sua posição agora: ${rankNow}º`;
          }
        }

        newNotices.push({
          id: `${s.id}-${totalG}-${minuteVal}`,
          matchId: s.id,
          minute: minuteVal,
          headline: `Gol do ${scorerClub} na rodada (${hName} ${hGoals} x ${aGoals} ${aName})${posSuffix}`,
          scoreline: `${hName} ${hGoals} x ${aGoals} ${aName}`,
          isRival: true,
        });
      } else {
        seenSiblingGoalsRef.current[s.id] = totalG;
      }
    }

    if (newNotices.length > 0) {
      setRoundGoalNotices((prev) => [...newNotices, ...prev].slice(0, 6));
      setActiveRoundBanner(newNotices[0]);
    }
  }, [siblings]);

  if (loading) return <div className="page">Carregando...</div>;
  if (error && !match) return <div className="page error">{error}</div>;
  // Never return null here: a bare null renders an empty page with no error and no way out, which is
  // exactly how the final-whistle blank screen went unnoticed. Always say something.
  const live: LiveMatchState | null =
    match?.live ??
    (match?.result
      ? {
          period: '2T' as const,
          currentMinute: TOTAL_MINUTES + calculateStoppageTime(match.result.events).half2,
          rngState: 0,
          homeTactic: match.homeTactic ?? ({ formation: '4-3-3', lineup: [] } as unknown as Tactic),
          awayTactic: match.awayTactic ?? ({ formation: '4-3-3', lineup: [] } as unknown as Tactic),
          homeGoals: match.result.homeGoals,
          awayGoals: match.result.awayGoals,
          homeShots: match.result.stats?.home?.shots ?? 0,
          awayShots: match.result.stats?.away?.shots ?? 0,
          homeShotsOnTarget: match.result.stats?.home?.shotsOnTarget ?? 0,
          awayShotsOnTarget: match.result.stats?.away?.shotsOnTarget ?? 0,
          homeCorners: match.result.stats?.home?.corners ?? 0,
          awayCorners: match.result.stats?.away?.corners ?? 0,
          homeFouls: match.result.stats?.home?.fouls ?? 0,
          awayFouls: match.result.stats?.away?.fouls ?? 0,
          homePressRecoveries: match.result.stats?.home?.pressRecoveries ?? 0,
          awayPressRecoveries: match.result.stats?.away?.pressRecoveries ?? 0,
          homeGoalsFromPressRecovery: match.result.stats?.home?.goalsFromPressRecovery ?? 0,
          awayGoalsFromPressRecovery: match.result.stats?.away?.goalsFromPressRecovery ?? 0,
          homeXg: match.result.stats?.home?.xg ?? 0,
          awayXg: match.result.stats?.away?.xg ?? 0,
          homeBigChances: match.result.stats?.home?.bigChances ?? 0,
          awayBigChances: match.result.stats?.away?.bigChances ?? 0,
          homeSaves: match.result.stats?.home?.saves ?? 0,
          awaySaves: match.result.stats?.away?.saves ?? 0,
          homeWoodwork: match.result.stats?.home?.woodwork ?? 0,
          awayWoodwork: match.result.stats?.away?.woodwork ?? 0,
          homeBlockedShots: match.result.stats?.home?.blockedShots ?? 0,
          awayBlockedShots: match.result.stats?.away?.blockedShots ?? 0,
          homePossession: match.result.stats?.home?.possession ?? 50,
          awayPossession: match.result.stats?.away?.possession ?? 50,
          events: match.result.events,
          pendingDecision: null,
          broadcaster: match.broadcaster,
          crowdIntensity: 0.8,
        }
      : null);

  if (!match || !live || !homeClub || !awayClub) {
    return (
      <div className="page">
        Carregando a partida...
      </div>
    );
  }
  // Not clamped at 90: once the match plays into the added time the board must show 45+N', not a stale 90'.
  const clockMinute = Math.floor(displayMinute);
  const stoppage = calculateStoppageTime(live.events);
  const clock = formatMatchClock(clockMinute, clockFormat, stoppage, halftimeSeen);

  const crowd = typeof live.crowdIntensity === 'number' ? Math.round(homeClub.stadiumCapacity * live.crowdIntensity) : null;
  const momentum = computeMomentum(live.events, clockMinute);
  const effectiveSide = mySide ?? 'home';
  const effectiveClub = myClub ?? (effectiveSide === 'away' ? awayClub : homeClub);
  const defaultFallbackTactic: Tactic = { formation: '4-3-3', lineup: [] } as unknown as Tactic;
  const effectiveTactic: Tactic =
    (mySide === 'home' ? live.homeTactic : mySide === 'away' ? live.awayTactic : live.homeTactic) ??
    live.homeTactic ??
    defaultFallbackTactic;
  const myBookedIds = bookedPlayerIds(live.events, effectiveSide);
  const myTactic: Tactic = effectiveTactic;

  const vacatedIds = (() => {
    const ids = sentOffPlayerIds(live?.events ?? [], effectiveSide);
    if (live?.pendingDecision?.type === 'redCard' && live.pendingDecision.playerId) {
      ids.add(live.pendingDecision.playerId);
    }
    return ids;
  })();

  const mostExhaustedStarter = (() => {
    if (!effectiveClub || !myTactic) return null;
    const starterPlayers = myTactic.lineup
      .map((s) => effectiveClub.players.find((p) => p.id === s.playerId))
      .filter((p): p is Player => p !== undefined && !vacatedIds.has(p.id));

    const exhausted = starterPlayers
      .map((p) => ({ player: p, stamina: calculateInMatchStamina(p, clockMinute) }))
      .filter((item) => item.stamina < 50)
      .sort((a, b) => a.stamina - b.stamina);

    if (exhausted.length === 0) return null;
    const target = exhausted[0].player;
    const sub = findBestSubstitute(effectiveClub.players, myTactic, target);
    return sub ? { target, sub } : null;
  })();

  const hasHighLineVulnerability = (() => {
    const isHighLine =
      (myTactic.defensiveLine ?? defensiveLineOf(myTactic)) === 'HIGH' ||
      myTactic.pressing === 'HIGH_PRESS';
    const oppShots = effectiveSide === 'home' ? live.awayShots : live.homeShots;
    const oppXg = (effectiveSide === 'home' ? live.awayXg : live.homeXg) ?? 0;
    return isHighLine && (oppShots >= 3 || oppXg >= 0.8);
  })();
  const activeStance = getActiveTacticalStance(myTactic);

  const roundRows = [match, ...siblings];
  function clubInfoFor(clubId: string): ClubInfo | undefined {
    if (clubId === homeClub!.id) {
      return {
        name: homeClub!.name,
        slug: homeClub!.slug,
        crestBase64: homeClub!.crestBase64,
        primaryColor: homeClub!.primaryColor,
        secondaryColor: homeClub!.secondaryColor,
      };
    }
    if (clubId === awayClub!.id) {
      return {
        name: awayClub!.name,
        slug: awayClub!.slug,
        crestBase64: awayClub!.crestBase64,
        primaryColor: awayClub!.primaryColor,
        secondaryColor: awayClub!.secondaryColor,
      };
    }
    return siblingClubInfo[clubId];
  }

  // Live League Standing & Direct Rivals computation
  const liveStandingSummary = (() => {
    const targetClubId = effectiveClub.id;
    if (!activeLeague || competition?.type !== 'league') return null;

    const currentRound = competition.round;
    // Past rounds already played
    const pastResults = activeLeague.fixtures
      .filter((f) => f.round < currentRound && f.result)
      .map((f) => ({
        homeClubId: f.homeClubId,
        awayClubId: f.awayClubId,
        homeGoals: f.result!.homeGoals,
        awayGoals: f.result!.awayGoals,
      }));

    const preStandings = computeStandings(activeLeague.clubIds, pastResults);
    const preIndex = preStandings.findIndex((r) => r.clubId === targetClubId);
    const prePos = preIndex >= 0 ? preIndex + 1 : null;

    // Live results from current round
    const liveRoundResults = roundRows.map((m) => ({
      homeClubId: m.homeClubId,
      awayClubId: m.awayClubId,
      homeGoals: m.result ? m.result.homeGoals : m.live ? m.live.homeGoals : 0,
      awayGoals: m.result ? m.result.awayGoals : m.live ? m.live.awayGoals : 0,
    }));

    const liveStandings = computeStandings(activeLeague.clubIds, [...pastResults, ...liveRoundResults]);
    const liveIndex = liveStandings.findIndex((r) => r.clubId === targetClubId);
    if (liveIndex < 0) return null;

    const livePos = liveIndex + 1;
    const delta = prePos !== null ? prePos - livePos : 0; // positive means climbed up

    // Direct rival club IDs (within 2 positions in live table)
    const rivalIds = new Set<string>();
    liveStandings.forEach((row, idx) => {
      if (row.clubId !== targetClubId && Math.abs(idx - liveIndex) <= 2) {
        rivalIds.add(row.clubId);
      }
    });

    // Scenario hint: what happens if we score 1 more goal?
    const hypotheticalResults = liveRoundResults.map((r) => {
      if (r.homeClubId === targetClubId) return { ...r, homeGoals: r.homeGoals + 1 };
      if (r.awayClubId === targetClubId) return { ...r, awayGoals: r.awayGoals + 1 };
      return r;
    });
    const hypoStandings = computeStandings(activeLeague.clubIds, [...pastResults, ...hypotheticalResults]);
    const hypoPos = hypoStandings.findIndex((r) => r.clubId === targetClubId) + 1;

    let scenarioText = `${liveStandings[liveIndex].points} pts`;
    if (hypoPos > 0 && hypoPos < livePos) {
      if (hypoPos === 1) scenarioText = 'A 1 gol da Liderança!';
      else if (hypoPos <= 4 && livePos > 4) scenarioText = 'A 1 gol do G4!';
      else scenarioText = `1 gol sobe p/ ${hypoPos}º lugar`;
    } else if (livePos === 1) {
      scenarioText = 'Líder isolado ao vivo!';
    } else if (livePos <= 4) {
      scenarioText = `Dentro do G4 (${liveStandings[liveIndex].points} pts)`;
    }

    return {
      livePos,
      delta,
      scenarioText,
      rivalIds,
      liveStandings,
    };
  })();

  // Live player ratings for left sidebar & pitch
  const liveRatingsByPlayerId = (() => {
    const map = new Map<string, number>();
    const hPlayers = (live.homeTactic?.lineup ?? [])
      .map((s) => homeClub.players.find((p) => p.id === s.playerId))
      .filter((p): p is Player => !!p);
    const aPlayers = (live.awayTactic?.lineup ?? [])
      .map((s) => awayClub.players.find((p) => p.id === s.playerId))
      .filter((p): p is Player => !!p);
    if (hPlayers.length > 0 || aPlayers.length > 0) {
      const computed = calculateMatchRatings(hPlayers, aPlayers, live.events, live.homeGoals, live.awayGoals);
      computed.home.forEach((r) => map.set(r.playerId, r.rating));
      computed.away.forEach((r) => map.set(r.playerId, r.rating));
    }
    return map;
  })();

  const myLineupPlayers = effectiveTactic.lineup
    .map((slot) => ({
      slot,
      player: effectiveClub.players.find((p) => p.id === slot.playerId),
    }))
    .filter((item): item is { slot: typeof effectiveTactic.lineup[number]; player: Player } => !!item.player);

  const starterIdSet = new Set(effectiveTactic.lineup.map((s) => s.playerId));
  const subbedOutSet = new Set(
    live.events
      .filter((e) => e.type === 'substitution' && e.team === effectiveSide && e.playerId)
      .map((e) => e.playerId),
  );
  const myBenchPlayers = effectiveClub.players
    .filter(
      (p) =>
        !starterIdSet.has(p.id) &&
        !subbedOutSet.has(p.id) &&
        (p.injuryWeeks ?? 0) === 0 &&
        (p.suspensions?.length ?? 0) === 0,
    )
    .slice(0, 7);

  // Stamina map for all current starters
  const staminaByPlayerId = new Map<string, number>();
  myLineupPlayers.forEach(({ player }) => {
    staminaByPlayerId.set(player.id, calculateInMatchStamina(player, clockMinute));
  });

  // Assistant Quick-Sub Recommendations (Fase 2)
  const assistantSubSuggestions = computeAssistantSubSuggestions({
    starters: myLineupPlayers.map((x) => x.player),
    bench: myBenchPlayers,
    staminaByPlayerId,
    ratingByPlayerId: liveRatingsByPlayerId,
    bookedPlayerIds: myBookedIds,
    vacatedPlayerIds: vacatedIds,
    markingStyle: effectiveTactic.markingStyle,
    currentMinute: clockMinute,
  });
  const topSubSuggestion = assistantSubSuggestions[0] ?? null;
  const flaggedStarterIds = new Set(assistantSubSuggestions.map((s) => s.outPlayerId));

  // Momentum as a real spendable resource (Fase 2)
  const myPossession = effectiveSide === 'away' ? live.awayPossession : live.homePossession;
  const myShots = effectiveSide === 'away' ? live.awayShots : live.homeShots;
  const oppShots = effectiveSide === 'away' ? live.homeShots : live.awayShots;
  const myCorners = effectiveSide === 'away' ? live.awayCorners : live.homeCorners;
  const oppCorners = effectiveSide === 'away' ? live.homeCorners : live.awayCorners;

  const momentumResource = computeLiveMomentumResource({
    events: live.events,
    currentMinute: clockMinute,
    mySide: effectiveSide,
    myPossession,
    myShots,
    opponentShots: oppShots,
    myCorners,
    opponentCorners: oppCorners,
    tacticalBoostCount,
    spentMomentum,
    lastSpendMinute,
  });

  const myMomentum = momentumResource.effectiveMomentum;
  const isGoldenWindowActive = goldenWindowUntilMinute !== null && clockMinute <= goldenWindowUntilMinute;
  const effectiveActiveSkill: MomentumSkillId | null = isGoldenWindowActive
    ? activeMomentumSkill ?? 'JANELA_DE_OURO'
    : activeStance === 'press'
      ? 'PRESSIONAR'
      : activeStance === 'counter'
        ? 'SEGURAR_JOGO'
        : null;
  const momentumSkills = getMomentumSkillStatuses(myMomentum, effectiveActiveSkill);

  async function triggerMomentumSkill(skillId: MomentumSkillId) {
    if (!match?.live || !myClub || !mySide || quickTacticBusy) return;
    soundFx.playTacticalClick();

    if (skillId === 'PRESSIONAR') {
      if (myMomentum < 30) return;
      setActiveMomentumSkill('PRESSIONAR');
      await quickApplyTacticalChange({
        mentality: 'attacking',
        pressing: 'HIGH_PRESS',
        attackApproach: 'BALANCED',
      });
      return;
    }

    if (skillId === 'JANELA_DE_OURO') {
      if (myMomentum < 60) return;
      setSpentMomentum((prev) => prev + 40);
      setLastSpendMinute(clockMinute);
      setActiveMomentumSkill('JANELA_DE_OURO');
      setGoldenWindowUntilMinute(clockMinute + 8);
      await quickApplyTacticalChange({
        mentality: 'attacking',
        pressing: 'HIGH_PRESS',
        attackApproach: 'TOTAL_ATTACK',
        defensiveLine: 'HIGH',
      });
      setAutoSubNotification('Janela de Ouro ativada (-40 Momentum): Ataque Total no terço final por 8 minutos!');
      return;
    }

    if (skillId === 'AVALANCHE_TOTAL') {
      if (myMomentum < 85) return;
      setSpentMomentum((prev) => prev + 55);
      setLastSpendMinute(clockMinute);
      setActiveMomentumSkill('AVALANCHE_TOTAL');
      setGoldenWindowUntilMinute(clockMinute + 6);
      await quickApplyTacticalChange({
        mentality: 'attacking',
        pressing: 'HIGH_PRESS',
        attackApproach: 'TOTAL_ATTACK',
        defensiveLine: 'HIGH',
        transitionStyle: 'COUNTERPRESS',
      });
      setAutoSubNotification('Avalanche acionada (-55 Momentum): Blitz ofensiva máxima por 6 minutos!');
      return;
    }

    if (skillId === 'SEGURAR_JOGO') {
      setSpentMomentum((prev) => Math.max(0, prev - 12));
      setActiveMomentumSkill('SEGURAR_JOGO');
      setGoldenWindowUntilMinute(null);
      await quickApplyTacticalChange({
        mentality: 'defensive',
        pressing: 'LOW_BLOCK',
        attackApproach: 'COUNTER_ATTACK',
        defensiveLine: 'DEEP',
      });
      setAutoSubNotification('Postura de contenção ativada: Bloco baixo e saída rápida em contra-ataque.');
    }
  }

  function classifyEventImportance(ev: MatchEvent): 'critical' | 'relevant' | 'routine' {
    if (
      ev.type === 'goal' ||
      ev.isPenalty ||
      ev.type === 'injury' ||
      (ev.type === 'card' && (ev.suspensionMatches !== undefined || ev.description.toLowerCase().includes('vermelho')))
    ) {
      return 'critical';
    }
    if (
      ev.type === 'card' ||
      ev.type === 'substitution' ||
      ev.shotOutcome === 'saved' ||
      ev.shotOutcome === 'woodwork' ||
      (ev.xg !== undefined && ev.xg >= 0.25)
    ) {
      return 'relevant';
    }
    return 'routine';
  }

  const filteredEvents = [...live.events]
    .reverse()
    .filter((ev) => !onlyImportantEvents || classifyEventImportance(ev) !== 'routine');

  const spiedMatch = spiedMatchId ? roundRows.find((r) => r.id === spiedMatchId) ?? null : null;

  // Fase 3: Halftime Assistant Briefing & Quick Post-Match Press Conference
  const myGoals = effectiveSide === 'away' ? live.awayGoals : live.homeGoals;
  const oppGoals = effectiveSide === 'away' ? live.homeGoals : live.awayGoals;
  const myXgVal = (effectiveSide === 'away' ? live.awayXg : live.homeXg) ?? 0;
  const oppXgVal = (effectiveSide === 'away' ? live.homeXg : live.awayXg) ?? 0;
  const opponentClub = effectiveSide === 'away' ? homeClub : awayClub;
  const myPressRecoveries = (effectiveSide === 'away' ? live.awayPressRecoveries : live.homePressRecoveries) ?? 0;

  const exhaustedCount = Array.from(staminaByPlayerId.values()).filter((s) => s < 58).length;

  const halftimeBriefing = buildHalftimeAssistantBriefing({
    myGoals,
    oppGoals,
    myShots,
    oppShots,
    myXg: myXgVal,
    oppXg: oppXgVal,
    myPossession,
    bookedCount: myBookedIds.size,
    exhaustedCount,
  });

  const quickPressQuestions = buildQuickPostMatchPressQuestions({
    myClubName: effectiveClub.name,
    oppClubName: opponentClub.name,
    myGoals,
    oppGoals,
    myShots,
    oppShots,
    myPressRecoveries,
  });

  const answeredPressOptions = Object.values(pressAnswers);
  const totalPressMoraleDelta = pressDelegated
    ? 1
    : answeredPressOptions.reduce((acc, opt) => acc + opt.moraleDelta, 0);
  const totalPressBoardDelta = pressDelegated
    ? 1
    : answeredPressOptions.reduce((acc, opt) => acc + opt.boardDelta, 0);

  async function handleApplyHalftimeTone(choice: HalftimeToneChoice) {
    if (!effectiveClub?.id || halftimeTalkBusy) return;
    setHalftimeTalkBusy(true);
    soundFx.playTacticalClick();
    try {
      const res = await applyTeamTalk(effectiveClub.id, choice.talkId, 'HALF_TIME', myGoals - oppGoals);
      setHalftimeTalkResult({
        label: choice.label,
        effect: choice.moraleEffectLabel,
        message: res.message || choice.subtitle,
      });
      const refreshed = await getClub(effectiveClub.id);
      setMyClub(refreshed);
    } catch {
      setHalftimeTalkResult({
        label: choice.label,
        effect: choice.moraleEffectLabel,
        message: choice.subtitle,
      });
    } finally {
      setHalftimeTalkBusy(false);
    }
  }

  function handleResumeSecondHalf() {
    soundFx.playWhistle('start');
    setHalftimeSeen(true);
    setTacticalModalOpen(false);
    setPauseReason(null);
  }

  async function handleAnswerQuickPress(questionId: string, option: QuickPressOption) {
    if (pressDelegated) return;
    soundFx.playTacticalClick();
    setPressAnswers((prev) => ({ ...prev, [questionId]: option }));
    if (effectiveClub?.id && Object.keys(pressAnswers).length === 0) {
      const talkId =
        myGoals > oppGoals ? 'PM_WIN_CALM' : myGoals === oppGoals ? 'PM_DRAW_CALM' : 'PM_LOSS_CALM';
      applyTeamTalk(effectiveClub.id, talkId, 'POST_MATCH', myGoals - oppGoals)
        .then(() => getClub(effectiveClub.id))
        .then((refreshed) => setMyClub(refreshed))
        .catch(() => null);
    }
  }

  function handleDelegateQuickPress() {
    soundFx.playTacticalClick();
    setPressDelegated(true);
  }

  return (
    <div className="page live-match-page live-cockpit-v2">
      {error && <p className="error">{error}</p>}

      {autoSubNotification && (
        <div className="cockpit-toast-banner">
          <span>{autoSubNotification}</span>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
            onClick={() => setAutoSubNotification(null)}
          >
            Fechar
          </button>
        </div>
      )}

      {activeRoundBanner && (
        <div className="cockpit-round-goal-banner" role="status">
          <div className="cockpit-round-goal-banner-left">
            <span className="cockpit-round-goal-tag">GOL NA RODADA</span>
            <strong>{activeRoundBanner.headline}</strong>
          </div>
          <div className="cockpit-round-goal-actions">
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '3px 10px', fontSize: '0.74rem' }}
              onClick={() => {
                setSpiedMatchId(activeRoundBanner.matchId);
                setActiveRoundBanner(null);
              }}
            >
              Espiar Jogo
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '3px 8px', fontSize: '0.74rem' }}
              onClick={() => setActiveRoundBanner(null)}
            >
              Ocultar
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP BROADCAST SCOREBOARD BAR */}
      <div className="cockpit-top-header">
        {/* Left: Live Clock, Play/Pause, Speeds & Auto-Pause */}
        <div className="cockpit-top-left">
          <div className="cockpit-live-clock-row">
            <span className={`cockpit-live-pill ${pauseReason === null ? 'is-live' : 'is-paused'}`}>
              <span className="cockpit-live-dot" />
              {isFullTime
                ? 'FIM DE JOGO'
                : pauseReason === 'halftime'
                  ? 'INTERVALO'
                  : `AO VIVO • ${clock.displayMinute} ${clock.periodLabel}`}
            </span>
            {clock.stoppageSign && (
              <span className="stoppage-board-pill" title="Acréscimos determinados pela arbitragem">
                +{clock.stoppageMinutes}'
              </span>
            )}
          </div>

          <div className="cockpit-transport-row">
            {pauseReason === null ? (
              <button
                type="button"
                className="cockpit-playpause-btn"
                onClick={() => setPauseReason('manual')}
                title="Partida em andamento. Clique para Pausar (Espaço)"
              >
                <ClockIcon size={13} style={{ marginRight: 5 }} />
                Pausar
              </button>
            ) : isFullTime ? (
              <button
                type="button"
                className="broadcast-start-btn"
                onClick={handleGoToResult}
                title="Partida encerrada! Clique para ver o resumo da rodada"
              >
                FIM DE JOGO • RESUMO
              </button>
            ) : pauseReason === 'manual' && clockMinute === 0 ? (
              <button
                type="button"
                className="broadcast-start-btn"
                onClick={handleStartMatch}
                title="Dar a saída e iniciar a partida agora! (Espaço)"
              >
                INICIAR PARTIDA
              </button>
            ) : pauseReason === 'manual' ? (
              <button
                type="button"
                className="broadcast-resume-btn"
                onClick={() => setPauseReason(null)}
                title="Continuar simulação da partida (Espaço)"
              >
                CONTINUAR
              </button>
            ) : pauseReason === 'halftime' ? (
              <button
                type="button"
                className="broadcast-halftime-btn"
                onClick={() => openTacticalCenter('halftime')}
                title="Intervalo de jogo: Abrir Prancheta ou Iniciar 2º Tempo"
              >
                INTERVALO (2º TEMPO)
              </button>
            ) : (
              <button
                type="button"
                className="broadcast-stoppage-btn"
                onClick={() => setTacticalModalOpen(true)}
                title="Jogo parado: Resolver decisão pendente"
              >
                RESOLVER DECISÃO
              </button>
            )}

            <div className="cockpit-speed-group" role="group" aria-label="Velocidade da partida">
              {SPEED_OPTIONS.map((option, idx) => {
                const liberada = canUseMatchSpeed(gameMode, option.key);
                const shortLabels = ['1x', '2x', '3x', '4x'];
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`cockpit-speed-pill${speedKey === option.key ? ' active' : ''}${liberada ? '' : ' locked'}`}
                    onClick={() => (liberada ? setSpeedKey(option.key) : setSpeedBlock(explainBlock(gameMode, 'speed')))}
                    title={liberada ? option.label : explainBlock(gameMode, 'speed')}
                    aria-disabled={!liberada}
                  >
                    {shortLabels[idx] ?? option.label}
                  </button>
                );
              })}
            </div>

            <label className="cockpit-autopause-toggle" title="Pausar automaticamente em gols e lances críticos">
              <span>Auto-Pausa:</span>
              <input
                type="checkbox"
                checked={autoPauseCritical}
                onChange={(e) => setAutoPauseCritical(e.target.checked)}
              />
              <span className="cockpit-toggle-slider" />
            </label>
          </div>
          {speedBlock && (
            <p className="live-speed-aviso" role="status" style={{ margin: '4px 0 0', fontSize: '0.72rem' }}>
              {speedBlock}
            </p>
          )}
        </div>

        {/* Center: Main Match Scoreboard */}
        <div className="match-banner cockpit-center-scoreboard">
          {currentGoalEvent && !currentGoalEvent.isOpponent && (
            <GoalCelebrationOverlay
              key={getEventKey(currentGoalEvent.event)}
              event={currentGoalEvent.event}
              club={currentGoalEvent.club ?? effectiveClub}
              scoreline={currentGoalEvent.scoreline}
              isOpponent={false}
              onDismiss={handleDismissGoal}
            />
          )}

          <div className={`match-banner-scoreboard ${opponentGoalAlert ? 'opponent-goal-danger' : ''}`}>
            <div className="match-banner-team home">
              <div className="match-banner-name-crest">
                <ClubCrest club={homeClub} size={42} />
                <div>
                  <strong className="match-banner-name">{homeClub.name}</strong>
                  {mySide === 'home' && <span className="match-banner-you-tag">Seu Clube</span>}
                </div>
              </div>
              <span className={`match-banner-score ${opponentGoalAlert && mySide === 'away' ? 'score-danger-pulse' : ''}`}>
                {live.homeGoals}
              </span>
            </div>

            <div className="match-banner-divider">
              <span className="match-banner-divider-text">-</span>
              {competition && (
                <span className="cockpit-comp-sub">{competitionRoundLabel(competition)}</span>
              )}
            </div>

            <div className="match-banner-team away">
              <span className={`match-banner-score ${opponentGoalAlert && mySide === 'home' ? 'score-danger-pulse' : ''}`}>
                {live.awayGoals}
              </span>
              <div className="match-banner-name-crest">
                <div>
                  <strong className="match-banner-name">{awayClub.name}</strong>
                  {mySide === 'away' && <span className="match-banner-you-tag">Seu Clube</span>}
                </div>
                <ClubCrest club={awayClub} size={42} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live League Standing Badge & Tactical Button */}
        <div className="cockpit-top-right">
          {liveStandingSummary ? (
            <div className="cockpit-live-standing-box" data-testid="live-standing-box">
              <div className="cockpit-standing-headline">
                <span className="cockpit-standing-label">POSIÇÃO AO VIVO:</span>
                <strong className="cockpit-standing-rank">{liveStandingSummary.livePos}º</strong>
                {liveStandingSummary.delta > 0 && (
                  <span className="cockpit-standing-delta up">+{liveStandingSummary.delta} pos</span>
                )}
                {liveStandingSummary.delta < 0 && (
                  <span className="cockpit-standing-delta down">{liveStandingSummary.delta} pos</span>
                )}
                {liveStandingSummary.delta === 0 && (
                  <span className="cockpit-standing-delta neutral">estável</span>
                )}
              </div>
              <div className="cockpit-standing-scenario">
                • {liveStandingSummary.scenarioText}
              </div>
            </div>
          ) : (
            <div className="cockpit-live-standing-box">
              <div className="cockpit-standing-headline">
                <LiveBroadcastWatermark
                  logoKey={match.broadcaster?.logoKey ?? match.live?.broadcaster?.logoKey ?? 'omnisports'}
                />
              </div>
              <div className="cockpit-standing-scenario">
                {crowd ? `${crowd.toLocaleString('pt-BR')} torcedores` : 'Transmissão Ao Vivo'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. HORIZONTAL ROUND TICKER STRIP ("JOGOS DA RODADA") */}
      <div className="cockpit-round-strip-wrapper">
        <div className="cockpit-round-strip-title">
          <span>JOGOS DA RODADA</span>
        </div>
        <ul className="club-list round-ticker cockpit-round-strip">
          {roundRows.map((s) => {
            const home = clubInfoFor(s.homeClubId);
            const away = clubInfoFor(s.awayClubId);
            const lastEvent = s.live?.events[s.live.events.length - 1];
            const score = s.result
              ? `${s.result.homeGoals} x ${s.result.awayGoals}`
              : s.live
                ? `${s.live.homeGoals} x ${s.live.awayGoals}`
                : '-';
            const mine = s.id === match.id;
            const justScored = s.status === 'LIVE' && lastEvent?.type === 'goal' && Math.abs(lastEvent.minute - clockMinute) <= 1;
            const isDirectRival =
              !mine &&
              !!liveStandingSummary &&
              (liveStandingSummary.rivalIds.has(s.homeClubId) || liveStandingSummary.rivalIds.has(s.awayClubId));
            const isSpied = spiedMatchId === s.id;

            return (
              <li
                key={s.id}
                onClick={() => setSpiedMatchId((prev) => (prev === s.id ? null : s.id))}
                className={`round-ticker-row cockpit-ticker-pill${mine ? ' round-ticker-row-mine' : ''}${justScored ? ' is-goal-flash' : ''}${isDirectRival ? ' is-direct-rival' : ''}${isSpied ? ' is-spied' : ''}`}
                title="Clique para espiar detalhes deste jogo da rodada"
              >
                {justScored && <span className="cockpit-ticker-goal-tag">GOL</span>}
                {!justScored && isDirectRival && <span className="cockpit-ticker-rival-tag">RIVAL DIRETO</span>}
                <span className="crest-name round-ticker-home">
                  {home && (
                    <ClubCrest
                      club={{
                        id: s.homeClubId,
                        name: home.name,
                        slug: home.slug,
                        crestBase64: home.crestBase64,
                        primaryColor: home.primaryColor,
                        secondaryColor: home.secondaryColor,
                      }}
                      size={18}
                    />
                  )}
                  <span className="round-ticker-club-name">{(home?.name ?? s.homeClubId).slice(0, 12)}</span>
                </span>
                <strong className="round-ticker-score">{score}</strong>
                <span className="crest-name">
                  <span className="round-ticker-club-name">{(away?.name ?? s.awayClubId).slice(0, 12)}</span>
                  {away && (
                    <ClubCrest
                      club={{
                        id: s.awayClubId,
                        name: away.name,
                        slug: away.slug,
                        crestBase64: away.crestBase64,
                        primaryColor: away.primaryColor,
                        secondaryColor: away.secondaryColor,
                      }}
                      size={18}
                    />
                  )}
                </span>
                <span className="cockpit-ticker-minute">
                  {s.status === 'LIVE' ? `(${clock.displayMinute})` : '(Fim)'}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Spy Popover when clicking a sibling match */}
        {spiedMatch && (() => {
          const spyHome = clubInfoFor(spiedMatch.homeClubId);
          const spyAway = clubInfoFor(spiedMatch.awayClubId);
          const spyHomeName = spyHome?.name ?? spiedMatch.homeClubId;
          const spyAwayName = spyAway?.name ?? spiedMatch.awayClubId;
          const spyHomeGoals = spiedMatch.result
            ? spiedMatch.result.homeGoals
            : spiedMatch.live
              ? spiedMatch.live.homeGoals
              : 0;
          const spyAwayGoals = spiedMatch.result
            ? spiedMatch.result.awayGoals
            : spiedMatch.live
              ? spiedMatch.live.awayGoals
              : 0;
          const spyHomePoss =
            spiedMatch.live?.homePossession ??
            spiedMatch.result?.stats?.home?.possession ??
            50;
          const spyAwayPoss = 100 - spyHomePoss;
          const spyHomeShots =
            spiedMatch.live?.homeShots ??
            spiedMatch.result?.stats?.home?.shots ??
            0;
          const spyAwayShots =
            spiedMatch.live?.awayShots ??
            spiedMatch.result?.stats?.away?.shots ??
            0;
          const spyHomeXg =
            spiedMatch.live?.homeXg ??
            spiedMatch.result?.stats?.home?.xg ??
            0;
          const spyAwayXg =
            spiedMatch.live?.awayXg ??
            spiedMatch.result?.stats?.away?.xg ??
            0;

          const homeStandingIdx = liveStandingSummary
            ? liveStandingSummary.liveStandings.findIndex((r) => r.clubId === spiedMatch.homeClubId)
            : -1;
          const awayStandingIdx = liveStandingSummary
            ? liveStandingSummary.liveStandings.findIndex((r) => r.clubId === spiedMatch.awayClubId)
            : -1;
          const isRivalGame =
            !!liveStandingSummary &&
            (liveStandingSummary.rivalIds.has(spiedMatch.homeClubId) ||
              liveStandingSummary.rivalIds.has(spiedMatch.awayClubId));

          const spyEvents = (spiedMatch.live?.events ?? spiedMatch.result?.events ?? []).slice(-3).reverse();

          return (
            <div className="cockpit-spy-popover">
              <div className="cockpit-spy-header">
                <div className="cockpit-spy-title-wrap">
                  <span className="cockpit-spy-kicker">
                    {isRivalGame ? 'CONFRONTO DE RIVAL DIRETO' : 'ESPIANDO JOGO DA RODADA'}
                  </span>
                  <strong className="cockpit-spy-matchup">
                    {spyHomeName} {homeStandingIdx >= 0 ? `(${homeStandingIdx + 1}º)` : ''}{' '}
                    <span className="cockpit-spy-score-pill">
                      {spyHomeGoals} x {spyAwayGoals}
                    </span>{' '}
                    {spyAwayName} {awayStandingIdx >= 0 ? `(${awayStandingIdx + 1}º)` : ''}
                  </strong>
                </div>
                <button
                  type="button"
                  className="btn-secondary cockpit-spy-close-btn"
                  onClick={() => setSpiedMatchId(null)}
                >
                  Voltar ao meu jogo
                </button>
              </div>

              {liveStandingSummary && (
                <div className="cockpit-spy-impact-line">
                  <span>
                    Sua posição ao vivo: <strong>{liveStandingSummary.livePos}º lugar</strong> · {liveStandingSummary.scenarioText}
                  </span>
                </div>
              )}

              <div className="cockpit-spy-stats-strip">
                <div className="cockpit-spy-stat-item">
                  <span className="cockpit-spy-stat-val">{spyHomePoss}%</span>
                  <span className="cockpit-spy-stat-lbl">Posse</span>
                  <span className="cockpit-spy-stat-val">{spyAwayPoss}%</span>
                </div>
                <div className="cockpit-spy-poss-bar">
                  <div className="cockpit-spy-poss-fill-home" style={{ width: `${spyHomePoss}%` }} />
                </div>
                <div className="cockpit-spy-stat-row-inline">
                  <span>Finalizações: <strong>{spyHomeShots}</strong> x <strong>{spyAwayShots}</strong></span>
                  <span>xG: <strong>{spyHomeXg.toFixed(2)}</strong> x <strong>{spyAwayXg.toFixed(2)}</strong></span>
                </div>
              </div>

              <div className="cockpit-spy-events">
                {spyEvents.map((ev, idx) => (
                  <div key={idx} className="cockpit-spy-event-row">
                    <strong>{formatMatchEventMinute(ev, clockFormat)}</strong>
                    <span>{ev.description}</span>
                  </div>
                ))}
                {spyEvents.length === 0 && (
                  <span className="muted">Sem lances de destaque até o momento.</span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {isStoppageTimeClimax(clockMinute, live.period, live.homeGoals, live.awayGoals, competition?.type !== 'league') && (
        <div className="climax-box" style={{ margin: '6px 0', textAlign: 'center', padding: '6px 12px' }}>
          <strong style={{ color: '#f87171', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <FlameIcon size={15} color="#f87171" /> CLÍMAX DOS ACRÉSCIMOS — PRESSÃO TOTAL DE TENSÃO MÁXIMA!
          </strong>
        </div>
      )}

      {/* 3. COCKPIT 3-COLUMN MAIN GRID */}
      <div className="cockpit-main-grid">
        {/* LEFT COLUMN: MEU TIME (XI) & SUBSTITUIÇÃO RÁPIDA */}
        <aside className="cockpit-left-sidebar">
          <div className="card cockpit-squad-card">
            <div className="cockpit-panel-header">
              <h2>MEU TIME ({effectiveTactic.formation}) &amp; BANCO</h2>
              <button
                type="button"
                className="cockpit-mini-tactic-btn"
                onClick={() => openTacticalCenter('manual')}
                title="Abrir Prancheta Tática completa"
              >
                <TacticsIcon size={13} /> Prancheta
              </button>
            </div>

            <div className="cockpit-xi-table-head">
              <span>Pos.</span>
              <span>Jogador</span>
              <span>Fôlego</span>
              <span>Nota</span>
            </div>

            <ul className="cockpit-xi-list">
              {myLineupPlayers.map(({ player }) => {
                const stamina = staminaByPlayerId.get(player.id) ?? 80;
                const isBooked = myBookedIds.has(player.id);
                const isSentOff = vacatedIds.has(player.id);
                const isFlagged = flaggedStarterIds.has(player.id);
                const rating = liveRatingsByPlayerId.get(player.id) ?? 6.0;
                const barColor = stamina >= 68 ? '#4ade80' : stamina >= 45 ? '#facc15' : '#ef4444';

                return (
                  <li
                    key={player.id}
                    className={`cockpit-xi-row${isSentOff ? ' is-sent-off' : ''}${isFlagged ? ' is-assistant-flagged' : ''}`}
                  >
                    <span className={`cockpit-pos-badge pos-${player.position.toLowerCase()}`}>
                      {player.position}
                    </span>
                    <span className="cockpit-player-name" title={player.name}>
                      {player.name}
                    </span>
                    <div className="cockpit-stamina-cell">
                      <div className="cockpit-stamina-track" title={`Condição física: ${Math.round(stamina)}%`}>
                        <div className="cockpit-stamina-fill" style={{ width: `${Math.max(5, stamina)}%`, background: barColor }} />
                      </div>
                      {isBooked && <span className="cockpit-card-icon yellow" title="Amarelado" />}
                      {isSentOff && <span className="cockpit-card-icon red" title="Expulso" />}
                    </div>
                    <strong
                      className="cockpit-rating-cell"
                      style={{ color: rating >= 7.2 ? '#4ade80' : rating < 6.0 ? '#f87171' : '#e2e8f0' }}
                    >
                      {rating.toFixed(1)}
                    </strong>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Quick Substitution & Assistant Recommendation Box */}
          <div className="card cockpit-quicksub-card">
            <div className="cockpit-panel-header">
              <h2>SUBSTITUIÇÃO RÁPIDA (1-Clique)</h2>
            </div>

            {topSubSuggestion && (
              <div className={`cockpit-assistant-sub-alert urgency-${topSubSuggestion.urgency.toLowerCase()}`}>
                <div className="cockpit-assistant-sub-head">
                  <AlertTriangleIcon size={13} color={topSubSuggestion.urgency === 'CRITICAL' ? '#f87171' : '#facc15'} />
                  <strong>Alerta do Auxiliar</strong>
                </div>
                <p className="cockpit-assistant-sub-reason">
                  <strong>{topSubSuggestion.outPlayerName}:</strong> {topSubSuggestion.reasonLabel}.
                </p>
                <button
                  type="button"
                  className="cockpit-quicksub-cta"
                  disabled={busy}
                  onClick={() => quickApplySubstitution(topSubSuggestion.outPlayerId, topSubSuggestion.inPlayerId)}
                >
                  <RefreshIcon size={13} color="#181204" />
                  <span>
                    Trocar {topSubSuggestion.outPlayerName.split(' ').slice(-1)[0]} por{' '}
                    {topSubSuggestion.inPlayerName.split(' ').slice(-1)[0]} (OVR {topSubSuggestion.inPlayerOverall})
                  </span>
                </button>
              </div>
            )}

            <div className="cockpit-bench-chips">
              {myBenchPlayers.slice(0, 4).map((benchPlayer) => {
                const targetStarter =
                  (topSubSuggestion ? myLineupPlayers.find((x) => x.player.id === topSubSuggestion.outPlayerId)?.player : undefined) ??
                  mostExhaustedStarter?.target ??
                  myLineupPlayers.find((x) => x.player.position === benchPlayer.position)?.player ??
                  myLineupPlayers[0]?.player;
                return (
                  <button
                    key={benchPlayer.id}
                    type="button"
                    disabled={busy || !targetStarter}
                    className="cockpit-bench-chip"
                    onClick={() => targetStarter && quickApplySubstitution(targetStarter.id, benchPlayer.id)}
                    title={targetStarter ? `Colocar ${benchPlayer.name} (${benchPlayer.position}, OVR ${benchPlayer.overall}) no lugar de ${targetStarter.name}` : benchPlayer.name}
                  >
                    <span className="cockpit-bench-ring">{benchPlayer.position}</span>
                    <span className="cockpit-bench-name">{benchPlayer.name.split(' ').slice(-1)[0]}</span>
                    <span className="cockpit-bench-ovr">{benchPlayer.overall}</span>
                  </button>
                );
              })}
            </div>

            {!topSubSuggestion && (
              <button
                type="button"
                className="cockpit-quicksub-cta secondary"
                onClick={() => openTacticalCenter('manual')}
              >
                <SquadIcon size={14} />
                <span>Gerenciar Substituições</span>
              </button>
            )}
          </div>
        </aside>

        {/* CENTER COLUMN: 2D PITCH + TIMELINE + MOMENTUM HUD */}
        <main className="cockpit-center-column">
          <div className="card cockpit-pitch-card">
            <div className="cockpit-pitch-topbar">
              <div className="live-pitch-tabs" role="tablist" aria-label="Visualização do Campo">
                <button
                  type="button"
                  role="tab"
                  aria-selected={pitchViewTab === 'RADAR_2D'}
                  className={`btn-live-pitch-tab ${pitchViewTab === 'RADAR_2D' ? 'active' : ''}`}
                  onClick={() => setPitchViewTab('RADAR_2D')}
                >
                  <EyeIcon size={14} style={{ marginRight: 5 }} /> Campo 2D Ao Vivo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pitchViewTab === 'TACTICAL_XI'}
                  className={`btn-live-pitch-tab ${pitchViewTab === 'TACTICAL_XI' ? 'active' : ''}`}
                  onClick={() => setPitchViewTab('TACTICAL_XI')}
                >
                  <TacticsIcon size={14} style={{ marginRight: 5 }} /> Prancheta Tática Ao Vivo
                </button>
              </div>
              {isGoldenWindowActive && (
                <span className="cockpit-golden-badge">
                  <LightningIcon size={13} color="#181204" style={{ marginRight: 4 }} />
                  {activeMomentumSkill === 'AVALANCHE_TOTAL' ? 'AVALANCHE OFENSIVA ATIVA' : 'JANELA DE OURO ATIVA'}
                </span>
              )}
            </div>

            {pitchViewTab === 'RADAR_2D' ? (
              <PitchVisualizer
                homeClub={homeClub}
                awayClub={awayClub}
                homeTactic={live.homeTactic}
                awayTactic={live.awayTactic}
                mySide={mySide}
                events={live.events}
                currentMinute={clockMinute}
                momentum={momentumResource.homeMomentum}
                isPaused={pauseReason !== null}
                speedKey={speedKey}
                period={halftimeSeen || live.period === '2T' ? '2T' : '1T'}
                gameTime={displayMinute}
                upcomingEvents={lookahead}
                minuteMs={minuteMs}
                homeGoals={live.homeGoals}
                awayGoals={live.awayGoals}
                selectedEvent={selectedReplayEvent}
                onSelectEvent={setSelectedReplayEvent}
                goldenWindowSide={isGoldenWindowActive ? effectiveSide : null}
              />
            ) : (
              <div className="live-pitchfield-compact-container">
                <PitchField
                  compact
                  formation={effectiveTactic.formation}
                  squad={effectiveClub.players}
                  selections={effectiveTactic.lineup.map((s) => s.playerId)}
                  currentMatchMinute={clockMinute}
                  bookedPlayerIds={myBookedIds}
                  vacatedPlayerIds={vacatedIds}
                  defensiveLine={effectiveTactic.defensiveLine ?? defensiveLineOf(effectiveTactic)}
                  attackStyle={effectiveTactic.attackStyle}
                  pressing={effectiveTactic.pressing}
                  kitColor={clubColor}
                  clubSlug={effectiveClub.slug}
                  isAway={effectiveSide === 'away'}
                  onSelect={() => {}}
                />
              </div>
            )}

            <MatchTimelineBar
              events={live.events}
              currentMinute={clockMinute}
              homeName={homeClub.name}
              awayName={awayClub.name}
            />
          </div>

          {match.result?.penaltyShootout && (
            <PenaltyShootoutGridWidget
              shootout={match.result.penaltyShootout}
              homeName={homeClub.name}
              awayName={awayClub.name}
            />
          )}

          {/* BOTTOM MOMENTUM BAR WITH 4 ZONES & TACTICAL RESOURCE SKILLS */}
          <div className="card cockpit-momentum-card">
            <div className="cockpit-momentum-header">
              <div className="cockpit-momentum-title-group">
                <strong>Momentum Tático</strong>
                <span className="muted" style={{ fontSize: '0.78rem' }}>
                  {momentumLabel(momentumResource.homeMomentum, homeClub.name, awayClub.name)}
                  {momentumResource.remainingDebt > 0 ? ` · Recarregando (-${momentumResource.remainingDebt})` : ''}
                </span>
              </div>
              <span className="cockpit-momentum-pct">{myMomentum}%</span>
            </div>

            <div className="cockpit-momentum-zones">
              <div className={`cockpit-zone z-control ${myMomentum < 30 ? 'active' : ''}`}>
                <span>CONTROLE</span>
              </div>
              <div className={`cockpit-zone z-press ${myMomentum >= 30 && myMomentum < 60 ? 'active' : ''}`}>
                <span>PRESSÃO (30+)</span>
              </div>
              <div className={`cockpit-zone z-domain ${myMomentum >= 60 && myMomentum < 85 ? 'active' : ''}`}>
                <span>DOMÍNIO (60+)</span>
              </div>
              <div className={`cockpit-zone z-avalanche ${myMomentum >= 85 ? 'active' : ''}`}>
                <span>AVALANCHE (85+)</span>
              </div>
              <div className="cockpit-momentum-marker" style={{ left: `${Math.max(3, Math.min(97, myMomentum))}%` }}>
                <span className="cockpit-momentum-marker-tag">{myMomentum}%</span>
              </div>
            </div>

            {/* Momentum Resource Skills with Zone Gates & Costs */}
            <div className="touchline-shouts-bar cockpit-triggers-row" role="group" aria-label="Gatilhos de Momentum">
              {momentumSkills.map((skill) => {
                const isGoldenOrAvalanche = skill.id === 'JANELA_DE_OURO' || skill.id === 'AVALANCHE_TOTAL';
                return (
                  <button
                    key={skill.id}
                    type="button"
                    className={`touchline-shout-btn ${isGoldenOrAvalanche ? 'cockpit-golden-btn' : ''} ${skill.active ? 'active' : ''}`}
                    disabled={quickTacticBusy || !skill.unlocked}
                    onClick={() => triggerMomentumSkill(skill.id)}
                    title={skill.description}
                  >
                    {skill.id === 'PRESSIONAR' && <SoccerBallIcon size={13} color="#f59e0b" />}
                    {skill.id === 'JANELA_DE_OURO' && <LightningIcon size={13} color={skill.unlocked ? '#181204' : '#94a3b8'} />}
                    {skill.id === 'AVALANCHE_TOTAL' && <FlameIcon size={13} color={skill.unlocked ? '#181204' : '#94a3b8'} />}
                    {skill.id === 'SEGURAR_JOGO' && <ShieldIcon size={13} color="#38bdf8" />}
                    <span className="touchline-shout-label">{skill.label}</span>
                    <span className="cockpit-skill-cost-tag">
                      {skill.cost > 0 ? `-${skill.cost}` : skill.id === 'SEGURAR_JOGO' ? 'Rival 62+' : `${skill.minZone}+`}
                    </span>
                  </button>
                );
              })}

              {hasHighLineVulnerability && (
                <button
                  type="button"
                  className="touchline-shout-btn btn-quick-intervention"
                  style={{ border: '1.5px solid #ef4444', color: '#fee2e2' }}
                  disabled={quickTacticBusy}
                  onClick={() =>
                    quickApplyTacticalChange({
                      defensiveLine: 'BALANCED',
                      pressing: 'MEDIUM',
                    })
                  }
                >
                  <ShieldIcon size={14} color="#ef4444" />
                  <span className="touchline-shout-label">Baixar Linha</span>
                </button>
              )}
            </div>
          </div>

          {/* FASE 3: VESTIÁRIO DE INTERVALO NO COCKPIT */}
          {pauseReason === 'halftime' && (
            <div className="card cockpit-halftime-card">
              <div className="cockpit-halftime-header">
                <div className="cockpit-halftime-title-group">
                  <span className="cockpit-halftime-badge">INTERVALO · 45&apos;</span>
                  <strong className="cockpit-halftime-headline">{halftimeBriefing.headline}</strong>
                </div>
                <div className="cockpit-halftime-actions-top">
                  <button
                    type="button"
                    className="btn-secondary cockpit-ht-board-btn"
                    onClick={() => openTacticalCenter('halftime')}
                  >
                    <TacticsIcon size={13} color="#cbd5e1" />
                    <span>Quadro Tático</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary cockpit-ht-resume-btn"
                    onClick={handleResumeSecondHalf}
                  >
                    <span>Iniciar 2º Tempo</span>
                  </button>
                </div>
              </div>

              <div className="cockpit-halftime-briefing">
                <p className="cockpit-halftime-line">{halftimeBriefing.tacticalNote}</p>
              </div>

              <div className="cockpit-halftime-tones-section">
                <div className="cockpit-halftime-tones-header">
                  <span className="cockpit-halftime-tones-label">CONVERSA DE VESTIÁRIO (ESCOLHA O TOM)</span>
                  {halftimeTalkResult && (
                    <span className="cockpit-halftime-feedback-pill">
                      {halftimeTalkResult.label}: {halftimeTalkResult.effect}
                    </span>
                  )}
                </div>
                <div className="cockpit-ht-tones-grid">
                  {halftimeBriefing.choices.map((choice) => {
                    const isSelected = halftimeTalkResult?.label === choice.label;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={halftimeTalkBusy || halftimeTalkResult !== null}
                        className={`cockpit-ht-tone-btn ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => handleApplyHalftimeTone(choice)}
                      >
                        <div className="cockpit-ht-tone-top">
                          <strong className="cockpit-ht-tone-label">{choice.label}</strong>
                          <span className="cockpit-ht-tone-morale">{choice.moraleEffectLabel}</span>
                        </div>
                        <span className="cockpit-ht-tone-sub">{choice.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TOUCHLINE ASSISTANT CAUSAL ALERTS */}
          <TouchlineAssistantCard
            myClub={effectiveClub}
            myTactic={effectiveTactic}
            mySide={effectiveSide}
            match={match}
            currentMinute={clockMinute}
            bookedPlayerIds={myBookedIds}
            vacatedPlayerIds={vacatedIds}
            events={live.events}
            homeShots={live.homeShots}
            awayShots={live.awayShots}
            homeXg={live.homeXg}
            awayXg={live.awayXg}
            isHalftime={pauseReason === 'halftime' || clockMinute === 45}
            onApplySubstitution={quickApplySubstitution}
            onApplyTacticalChange={quickApplyTacticalChange}
          />
        </main>

        {/* RIGHT COLUMN: 3-TIER LANCES FEED, STATS & MODO DIRETO / MODO TÁTICO */}
        <aside className="cockpit-right-sidebar">
          <div className="card live-lances-card cockpit-feed-card">
            <div className="cockpit-feed-tabs-row">
              <div className="cockpit-feed-tabs">
                <button
                  type="button"
                  className={`cockpit-feed-tab ${rightSidebarTab === 'LANCES' ? 'active' : ''}`}
                  onClick={() => setRightSidebarTab('LANCES')}
                >
                  LANCES AO VIVO
                </button>
                <button
                  type="button"
                  className={`cockpit-feed-tab ${rightSidebarTab === 'STATS' ? 'active' : ''}`}
                  onClick={() => setRightSidebarTab('STATS')}
                >
                  ESTATÍSTICAS
                </button>
              </div>

              {rightSidebarTab === 'LANCES' && (
                <label className="cockpit-filter-toggle" title="Ocultar lances de rotina e exibir apenas jogadas relevantes/críticas">
                  <span>Só importantes</span>
                  <input
                    type="checkbox"
                    checked={onlyImportantEvents}
                    onChange={(e) => setOnlyImportantEvents(e.target.checked)}
                  />
                </label>
              )}
            </div>

            {rightSidebarTab === 'LANCES' ? (
              <>
                {roundGoalNotices.length > 0 && (
                  <div className="cockpit-round-feed-notices">
                    {roundGoalNotices.slice(0, 2).map((notice) => (
                      <div
                        key={notice.id}
                        className="cockpit-round-feed-item"
                        onClick={() => setSpiedMatchId(notice.matchId)}
                        title="Clique para espiar esta partida da rodada"
                      >
                        <span className="cockpit-round-feed-badge">{notice.minute}' · RODADA</span>
                        <span>{notice.headline}</span>
                      </div>
                    ))}
                  </div>
                )}
                {filteredEvents.length === 0 && (
                  <p className="muted" style={{ fontSize: '0.84rem', margin: '12px 0' }}>
                    {live.events.length === 0
                      ? 'A partida ainda não teve lances.'
                      : 'Nenhum lance importante registrado ainda.'}
                  </p>
                )}
                <ul className="lances-feed cockpit-lances-feed">
                  {filteredEvents.map((event: MatchEvent, i) => {
                    const tier = classifyEventImportance(event);
                    const isSelected = selectedReplayEvent === event;
                    return (
                      <li
                        key={i}
                        onClick={() => setSelectedReplayEvent((prev) => (prev === event ? null : event))}
                        className={`lance-item lance-${eventVariant(event)} cockpit-lance-tier-${tier}${isSelected ? ' is-selected-replay' : ''}`}
                        title="Clique para destacar este lance no Campo 2D"
                      >
                        <span className="lance-item-icon">{eventIcon(event)}</span>
                        <div className="cockpit-lance-body">
                          <div className="cockpit-lance-top">
                            <strong>{formatMatchEventMinute(event, clockFormat)}</strong>
                            {event.type === 'goal' && <span className="cockpit-lance-badge-goal">GOL</span>}
                          </div>
                          <span className="cockpit-lance-desc">{event.description}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <div style={{ marginTop: 8 }}>
                <MatchStatsPanel
                  home={{
                    shots: live.homeShots,
                    shotsOnTarget: live.homeShotsOnTarget,
                    possession: live.homePossession,
                    corners: live.homeCorners,
                    fouls: live.homeFouls,
                    xg: live.homeXg,
                    bigChances: live.homeBigChances,
                    saves: live.homeSaves,
                  }}
                  away={{
                    shots: live.awayShots,
                    shotsOnTarget: live.awayShotsOnTarget,
                    possession: live.awayPossession,
                    corners: live.awayCorners,
                    fouls: live.awayFouls,
                    xg: live.awayXg,
                    bigChances: live.awayBigChances,
                    saves: live.awaySaves,
                  }}
                />
              </div>
            )}
          </div>

          {/* BOTTOM RIGHT: MODO DIRETO | MODO TÁTICO PANEL */}
          <div className="card cockpit-mode-card">
            <div className="cockpit-mode-header">
              <button
                type="button"
                className={`cockpit-mode-switch-btn ${tacticControlMode === 'DIRECT' ? 'active' : ''}`}
                onClick={() => setTacticControlMode('DIRECT')}
              >
                Modo Direto
              </button>
              <span className="muted">|</span>
              <button
                type="button"
                className={`cockpit-mode-switch-btn ${tacticControlMode === 'TACTICAL' ? 'active' : ''}`}
                onClick={() => setTacticControlMode('TACTICAL')}
              >
                <span className="cockpit-fm-dot" /> Modo Tático
              </button>
            </div>

            {tacticControlMode === 'DIRECT' ? (
              <div className="cockpit-brasfoot-quick">
                <button
                  type="button"
                  className={`cockpit-bf-pill ${activeStance === 'press' ? 'active' : ''}`}
                  disabled={quickTacticBusy}
                  onClick={() => quickApplyTacticalStance('press')}
                >
                  <FlameIcon size={12} color="#f59e0b" style={{ marginRight: 4 }} />
                  Ataque Total
                </button>
                <button
                  type="button"
                  className={`cockpit-bf-pill ${activeStance === 'balanced' ? 'active' : ''}`}
                  disabled={quickTacticBusy}
                  onClick={() => quickApplyTacticalStance('balanced')}
                >
                  <ShieldIcon size={12} color="#34d399" style={{ marginRight: 4 }} />
                  Equilibrado
                </button>
                <button
                  type="button"
                  className={`cockpit-bf-pill ${activeStance === 'counter' ? 'active' : ''}`}
                  disabled={quickTacticBusy}
                  onClick={() => quickApplyTacticalStance('counter')}
                >
                  <SwordsIcon size={12} color="#38bdf8" style={{ marginRight: 4 }} />
                  Contra-Ataque
                </button>
              </div>
            ) : (
              <div className="cockpit-fm-sliders">
                <div className="cockpit-fm-row">
                  <span className="cockpit-fm-label">Mentalidade</span>
                  <div className="cockpit-fm-seg">
                    {(['defensive', 'balanced', 'attacking'] as Mentality[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={quickTacticBusy}
                        className={`cockpit-fm-seg-btn ${effectiveTactic.mentality === m ? 'active' : ''}`}
                        onClick={() => quickUpdateTacticField('mentality', m)}
                      >
                        {m === 'defensive' ? 'Def.' : m === 'balanced' ? 'Equil.' : 'Ofens.'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cockpit-fm-row">
                  <span className="cockpit-fm-label">Linha Defensiva</span>
                  <div className="cockpit-fm-seg">
                    {(['DEEP', 'BALANCED', 'HIGH'] as DefensiveLineHeight[]).map((line) => {
                      const currentLine = effectiveTactic.defensiveLine ?? defensiveLineOf(effectiveTactic);
                      return (
                        <button
                          key={line}
                          type="button"
                          disabled={quickTacticBusy}
                          className={`cockpit-fm-seg-btn ${currentLine === line ? 'active' : ''}`}
                          onClick={() => quickUpdateTacticField('defensiveLine', line)}
                        >
                          {line === 'DEEP' ? 'Baixa' : line === 'BALANCED' ? 'Média' : 'Alta'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="cockpit-fm-row">
                  <span className="cockpit-fm-label">Pressão</span>
                  <div className="cockpit-fm-seg">
                    {(['LOW_BLOCK', 'MEDIUM', 'HIGH_PRESS'] as PressingIntensity[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={quickTacticBusy}
                        className={`cockpit-fm-seg-btn ${effectiveTactic.pressing === p ? 'active' : ''}`}
                        onClick={() => quickUpdateTacticField('pressing', p)}
                      >
                        {p === 'LOW_BLOCK' ? 'Baixa' : p === 'MEDIUM' ? 'Média' : 'Alta'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FASE 3: APÓS O APITO — COLETIVA RÁPIDA */}
          <div className={`card cockpit-postmatch-card ${isFullTime || match.status === 'SIMULATED' ? 'is-unlocked' : 'is-locked'}`}>
            <div className="cockpit-postmatch-header">
              <div className="cockpit-postmatch-title-row">
                <SquadIcon size={14} color={isFullTime || match.status === 'SIMULATED' ? '#f59e0b' : '#64748b'} />
                <span className="cockpit-postmatch-title">APÓS O APITO · COLETIVA RÁPIDA</span>
              </div>
              {(answeredPressOptions.length > 0 || pressDelegated) && (
                <div className="cockpit-postmatch-deltas">
                  <span className={`cockpit-pm-delta-tag ${totalPressMoraleDelta >= 0 ? 'is-pos' : 'is-neg'}`}>
                    Moral {totalPressMoraleDelta >= 0 ? `+${totalPressMoraleDelta}` : totalPressMoraleDelta}
                  </span>
                  <span className={`cockpit-pm-delta-tag ${totalPressBoardDelta >= 0 ? 'is-pos' : 'is-neg'}`}>
                    Diretoria {totalPressBoardDelta >= 0 ? `+${totalPressBoardDelta}` : totalPressBoardDelta}
                  </span>
                </div>
              )}
            </div>

            {!(isFullTime || match.status === 'SIMULATED') ? (
              <p className="cockpit-postmatch-locked-hint">
                Disponível ao apito final: 2 perguntas rápidas da imprensa com impacto direto na moral do elenco e na confiança da diretoria.
              </p>
            ) : pressDelegated ? (
              <div className="cockpit-postmatch-delegated-box">
                <p className="cockpit-pm-delegated-text">
                  O Auxiliar Técnico atendeu a imprensa com discurso equilibrado (Moral +1 · Diretoria +1).
                </p>
                <button
                  type="button"
                  className="btn-primary cockpit-pm-finish-btn"
                  onClick={handleGoToResult}
                >
                  Avançar para o Resumo da Rodada
                </button>
              </div>
            ) : (
              <div className="cockpit-postmatch-body">
                {quickPressQuestions.map((q) => {
                  const chosen = pressAnswers[q.id];
                  return (
                    <div key={q.id} className="cockpit-pm-question-box">
                      <div className="cockpit-pm-outlet">{q.outlet}</div>
                      <p className="cockpit-pm-prompt">{q.question}</p>
                      <div className="cockpit-pm-options">
                        {q.options.map((opt) => {
                          const isChosen = chosen?.id === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={Boolean(chosen)}
                              className={`cockpit-pm-option-btn ${isChosen ? 'is-chosen' : ''}`}
                              onClick={() => handleAnswerQuickPress(q.id, opt)}
                            >
                              <div className="cockpit-pm-option-top">
                                <span className="cockpit-pm-tone-badge">{opt.label}</span>
                                <span className="cockpit-pm-impact-preview">
                                  Moral {opt.moraleDelta >= 0 ? `+${opt.moraleDelta}` : opt.moraleDelta} · Diretoria {opt.boardDelta >= 0 ? `+${opt.boardDelta}` : opt.boardDelta}
                                </span>
                              </div>
                              <span className="cockpit-pm-quote">&ldquo;{opt.quote}&rdquo;</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="cockpit-pm-footer-actions">
                  {answeredPressOptions.length === 0 && (
                    <button
                      type="button"
                      className="btn-secondary cockpit-pm-delegate-btn"
                      onClick={handleDelegateQuickPress}
                    >
                      Delegar ao Auxiliar
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-primary cockpit-pm-finish-btn"
                    onClick={handleGoToResult}
                  >
                    Resumo da Rodada
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* DEDICATED TACTICAL COMMAND POP-UP MODAL */}
      <LiveTacticalModal
        isOpen={tacticalModalOpen}
        mode={tacticalModalMode}
        minute={clockMinute}
        myClub={effectiveClub}
        mySide={effectiveSide}
        tactic={effectiveTactic}
        kitColor={clubColor}
        bookedIds={myBookedIds}
        events={live.events}
        busy={busy}
        error={error}
        homeClub={homeClub}
        awayClub={awayClub}
        homeGoals={live.homeGoals}
        awayGoals={live.awayGoals}
        injuryDecision={live.pendingDecision?.type === 'injury' ? live.pendingDecision : null}
        injuryOptions={decisionOptions}
        onResolveInjury={handleResolveStoppage}
        redCardDecision={live.pendingDecision?.type === 'redCard' ? live.pendingDecision : null}
        onResolveRedCard={handleResolveRedCard}
        onSaveTactic={handleSaveTacticalModal}
        onTeamTalkApplied={async () => {
          if (effectiveClub?.id) {
            try {
              const refreshed = await getClub(effectiveClub.id);
              if (refreshed) {
                if (effectiveSide === 'home') setHomeClub(refreshed);
                else setAwayClub(refreshed);
              }
            } catch {}
          }
        }}
        onClose={() => {
          setTacticalModalOpen(false);
          setDramaticEvent(null);
          if (pauseReason === 'halftime') {
            // Permanece pausado no intervalo para que o botão "INTERVALO (2º TEMPO ➔)" continue visível na barra
          } else if (match?.live?.pendingDecision?.type === 'redCard') {
            handleResolveRedCard(null);
          } else if (!match?.live?.pendingDecision) {
            setPauseReason(null);
          }
        }}
        onResumeHalftime={() => {
          setHalftimeSeen(true);
          const stoppage = calculateStoppageTime(liveEventsRef.current);
          const resumeMinute = 45 + stoppage.half1;
          setDisplayMinute(resumeMinute);
          requestedMinuteRef.current = resumeMinute;
          playAnchorRef.current = { realTime: Date.now(), gameMinute: resumeMinute };
          setTacticalModalOpen(false);
          setPauseReason(null);
        }}
      />

      {/* DRAMATIC EVENT ALERT MODAL */}
      <MatchEventDramaticModal
        event={dramaticEvent}
        suggestedSubstitute={
          dramaticEvent?.type === 'injury'
            ? getBestSubstituteCandidate(
                myClub,
                myTactic,
                live.pendingDecision?.playerId ?? dramaticEvent?.player?.id,
                live.events,
                mySide,
                decisionOptions,
              )
            : null
        }
        busy={busy}
        onSubstituteBest={async () => {
          const candidate = getBestSubstituteCandidate(
            myClub,
            myTactic,
            live.pendingDecision?.playerId ?? dramaticEvent?.player?.id,
            live.events,
            mySide,
            decisionOptions,
          );
          setDramaticEvent(null);
          await handleResolveStoppage(candidate?.id ?? null);
        }}
        onOpenTactics={() => {
          const type = dramaticEvent?.type;
          setDramaticEvent(null);
          openTacticalCenter(type === 'injury' ? 'injury' : type === 'red_card' ? 'redCard' : 'manual');
        }}
        onResume={async () => {
          if (dramaticEvent?.type === 'red_card' && match?.live?.pendingDecision?.type === 'redCard') {
            await handleResolveRedCard(null);
          }
          setDramaticEvent(null);
          setPauseReason(null);
        }}
      />

      {/* INTERACTIVE PENALTY SPOT KICK MODAL */}
      {interactiveTaker && (
        <PenaltyInteractiveModal
          isOpen={penaltyModalOpen}
          taker={interactiveTaker}
          keeper={mySide === 'home' ? awayClub?.players.find((p) => p.position === 'GK') ?? null : homeClub?.players.find((p) => p.position === 'GK') ?? null}
          availableTakers={myTactic.lineup.map((slot) => myClub?.players.find((p) => p.id === slot.playerId)).filter((p): p is Player => !!p)}
          minute={pendingPenaltyEventRef.current?.minute ?? clockMinute}
          onSelectTaker={(p) => setInteractiveTaker(p)}
          onShoot={(zone) => {
            const ev = pendingPenaltyEventRef.current;
            const isGoal = ev?.type === 'goal';
            const isSaved = ev?.shotOutcome === 'saved';
            const isTrave = ev?.shotOutcome === 'woodwork';
            const outcome: PenaltyShotOutcome = isGoal ? 'GOL' : isSaved ? 'DEFESA' : isTrave ? 'TRAVE' : 'FORA';
            const gkGuess = (Math.floor(Math.random() * 5) + 1) as PenaltyTargetZone;
            setInteractivePenaltyOutcome({
              outcome,
              targetZone: zone,
              gkZone: gkGuess,
            });
          }}
          lastOutcome={interactivePenaltyOutcome}
          onConfirmOutcome={() => {
            setPenaltyModalOpen(false);
            const wasGoal = interactivePenaltyOutcome?.outcome === 'GOL';
            const penEvent = pendingPenaltyEventRef.current;
            setInteractivePenaltyOutcome(null);
            pendingPenaltyEventRef.current = null;
            const currentClub = myClubRef.current ?? myClub;

            if (wasGoal && penEvent && currentClub) {
              const goalKey = getEventKey(penEvent);
              seenGoalKeysRef.current.add(goalKey);
              seenEventKeysRef.current.add(goalKey);

              const allEvents = liveEventsRef.current.length > 0 ? liveEventsRef.current : (match?.live?.events ?? match?.result?.events ?? []);
              const scoreline = getScorelineAtEvent(allEvents, penEvent);

              setGoalQueue((prev) => {
                const isQueueEmpty = prev.length === 0;
                if (isQueueEmpty) {
                  soundFx.playGoalCheer();
                  soundFx.playWhistle('short');
                  playAnchorRef.current = null;
                  requestedMinuteRef.current = penEvent.minute;
                  setDisplayMinute(penEvent.minute);
                  setPauseReason('manual');
                }
                return [
                  ...prev,
                  {
                    event: penEvent,
                    club: currentClub,
                    scoreline,
                    isOpponent: false,
                  },
                ];
              });
            } else {
              setPauseReason(null);
            }
          }}
        />
      )}

      {/* IN-GAME OPTIONS MODAL */}
      <OptionsMenuModal isOpen={optionsMenuOpen} onClose={() => setOptionsMenuOpen(false)} />


    </div>
  );
}

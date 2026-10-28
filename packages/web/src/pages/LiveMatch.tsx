import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  bookedPlayerIds,
  formatMatchEventMinute,
  defensiveLineOf,
  calculateInMatchStamina,
  type AttackApproach,
  type AttackStyle,
  type Club,
  type Formation,
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
} from '@tactical-arena/shared';
import {
  advanceLiveMatch,
  getClub,
  getInjuryDecision,
  getMatch,
  getMatchSiblings,
  listMyClubs,
  listSaves,
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
import { ClockIcon, SquadIcon, TacticsIcon, LightningIcon, ShieldIcon, SoccerBallIcon, EyeIcon, RefreshIcon, SwordsIcon, FlameIcon } from '../components/icons/AppIcons.js';

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
        if (!halftimeSeen && (match?.live?.currentMinute ?? clockMinute) >= 45) {
          playAnchorRef.current = null;
          requestedMinuteRef.current = 45;
          setDisplayMinute(45);
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

          if (!halftimeSeen && (updated.live?.period === 'HT' || target >= halfCeiling)) {
            soundFx.playWhistle('halftime');
            playAnchorRef.current = null;
            setDisplayMinute(45 + stoppage.half1);
            requestedMinuteRef.current = 45;
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
        setDisplayMinute(45 + stoppage.half1);
        requestedMinuteRef.current = 45;
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
        setDisplayMinute(45);
        requestedMinuteRef.current = 45;
        playAnchorRef.current = { realTime: Date.now(), gameMinute: 45 };
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
      setAutoSubNotification('Ajuste tático de beira de campo aplicado com sucesso!');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setQuickTacticBusy(false);
    }
  }

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
    const ids = new Set<string>();
    if (!live?.events || !effectiveSide) return ids;
    for (const ev of live.events) {
      const isRed = ev.suspensionMatches !== undefined || ev.description.toLowerCase().includes('vermelho');
      if (ev.team === effectiveSide && ev.type === 'card' && isRed && ev.playerId) {
        ids.add(ev.playerId);
      }
    }
    if (live.pendingDecision?.type === 'redCard' && live.pendingDecision.playerId) {
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

  return (
    <div className="page live-match-page">
      {error && <p className="error">{error}</p>}

      <div className="live-match-layout">
        {/* SIBLINGS ROUND TICKER */}
        <div className="card live-round-panel">
          <h2>Jogos da rodada</h2>
          <ul className="club-list round-ticker">
            {roundRows.map((s) => {
              const home = clubInfoFor(s.homeClubId);
              const away = clubInfoFor(s.awayClubId);
              const lastEvent = s.live?.events[s.live.events.length - 1];
              const score = s.result ? `${s.result.homeGoals} x ${s.result.awayGoals}` : s.live ? `${s.live.homeGoals} x ${s.live.awayGoals}` : '-';
              const mine = s.id === match.id;
              const justScored = s.status === 'LIVE' && lastEvent?.type === 'goal' && lastEvent.minute === clockMinute;
              return (
                <li key={s.id} className={`round-ticker-row${mine ? ' round-ticker-row-mine' : ''}`}>
                  <span className="crest-name round-ticker-home">
                    <span className="round-ticker-club-name">{home?.name ?? s.homeClubId}</span>
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
                        size={22}
                      />
                    )}
                  </span>
                  <span className="round-ticker-score">{score}</span>
                  <span className="crest-name">
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
                        size={22}
                      />
                    )}
                    <span className="round-ticker-club-name">{away?.name ?? s.awayClubId}</span>
                  </span>
                  <div className="round-ticker-meta">
                    {s.status === 'LIVE' ? (
                      <span className={`round-ticker-badge ${justScored ? 'round-ticker-badge-goal' : 'round-ticker-badge-live'}`}>
                        {justScored ? 'Gol ao vivo' : `Ao vivo ${clock.displayMinute}`}
                      </span>
                    ) : (
                      <span className="muted round-ticker-status">Encerrado</span>
                    )}
                    {lastEvent && (
                      <span className="muted round-ticker-event">
                        {eventIcon(lastEvent)} {formatMatchEventMinute(lastEvent, clockFormat)} {lastEvent.description}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* MAIN MATCH SIMULATION VIEW */}
        <div className="live-match-main">
          {autoSubNotification && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(147, 51, 234, 0.25) 100%)',
                border: '1.5px solid #10b981',
                color: '#ecfdf5',
                padding: '10px 18px',
                borderRadius: 8,
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.2)',
                fontWeight: 600,
                fontSize: '0.88rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                
                <span>{autoSubNotification}</span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                onClick={() => setAutoSubNotification(null)}
              >
                ✕
              </button>
            </div>
          )}

          {/* Broadcast Scoreboard Header with Direct Kickoff / Play / Pause Controls */}
          <div className="broadcast-topbar">
            <div className="broadcast-topbar-controls">
              {pauseReason === null ? (
                <button
                  type="button"
                  className="broadcast-live-btn"
                  onClick={() => setPauseReason('manual')}
                  title="Partida em andamento. Clique para Pausar (Espaço)"
                >
                  <span className="broadcast-live-badge">● AO VIVO</span>
                  <span className="btn-pause-hint">⏸ Pausar</span>
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
            </div>

            <span className="broadcast-clock">
              {clock.displayMinute} • {clock.periodLabel}
            </span>
            {clock.stoppageSign && (
              <span className="stoppage-board-pill" title="Acréscimos determinados pela arbitragem">
                +{clock.stoppageMinutes}' ACRÉSCIMOS
              </span>
            )}
            <span className="broadcast-weather-pill">
              Tempo Seco {crowd ? `• ${crowd.toLocaleString('pt-BR')} torcedores` : ''}
            </span>
          </div>

          <div className="match-banner">
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

            {competition && (
              <div className="match-banner-header">
                <span className="match-banner-competition">{competitionRoundLabel(competition)}</span>
                <LiveBroadcastWatermark
                  logoKey={match.broadcaster?.logoKey ?? match.live?.broadcaster?.logoKey ?? 'omnisports'}
                />
                {clock.stoppageSign && (
                  <span className="stoppage-board-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ClockIcon size={12} color="#f59e0b" />
                    <span>{clock.stoppageSign} {clock.isStoppage ? 'ACRÉSCIMOS' : 'ACRÉSCIMOS'}</span>
                  </span>
                )}
                {crowd !== null && (
                  <span className="match-banner-crowd" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <SquadIcon size={13} color="#94a3b8" />
                    <span>{crowd.toLocaleString('pt-BR')}</span>
                  </span>
                )}
                <div className="match-banner-progress">
                  <div className="match-banner-progress-track">
                    <div className="match-banner-progress-fill" style={{ width: `${Math.max(0, Math.min(100, clock.progressPercent))}%` }} />
                  </div>
                  <span>
                    {isFullTime
                      ? 'FIM DE JOGO'
                      : pauseReason === 'halftime'
                        ? 'Intervalo (1º Tempo)'
                        : pauseReason === 'stoppage'
                          ? `Jogo parado - ${clock.displayMinute}`
                          : pauseReason === 'manual' && clockMinute > 0
                            ? `Pausado - ${clock.displayMinute}`
                            : `${clock.displayMinute} - ${clock.periodLabel}`}
                  </span>
                </div>
              </div>
            )}

            <div className={`match-banner-scoreboard ${opponentGoalAlert ? 'opponent-goal-danger' : ''}`}>
              <div className="match-banner-team home">
                <div className="match-banner-name-crest">
                  <ClubCrest club={homeClub} size={48} />
                  <div>
                    <strong className="match-banner-name">{homeClub.name}</strong>
                    {mySide === 'home' && <span className="match-banner-you-tag">Seu Clube</span>}
                  </div>
                </div>
                <span className={`match-banner-score ${opponentGoalAlert && mySide === 'away' ? 'score-danger-pulse' : ''}`}>{live.homeGoals}</span>
              </div>

              <div className="match-banner-divider">
                <span className="match-banner-divider-text">x</span>
              </div>

              <div className="match-banner-team away">
                <span className={`match-banner-score ${opponentGoalAlert && mySide === 'home' ? 'score-danger-pulse' : ''}`}>{live.awayGoals}</span>
                <div className="match-banner-name-crest">
                  <div>
                    <strong className="match-banner-name">{awayClub.name}</strong>
                    {mySide === 'away' && <span className="match-banner-you-tag">Seu Clube</span>}
                  </div>
                  <ClubCrest club={awayClub} size={48} />
                </div>
              </div>
            </div>
          </div>

          {isStoppageTimeClimax(clockMinute, live.period, live.homeGoals, live.awayGoals, competition?.type !== 'league') && (
            <div className="climax-box" style={{ margin: '12px 0', textAlign: 'center' }}>
              <strong style={{ color: '#f87171', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <FlameIcon size={16} color="#f87171" /> CLÍMAX DOS ACRÉSCIMOS — PRESSÃO TOTAL DE TENSÃO MÁXIMA!
              </strong>
            </div>
          )}

          <MatchTimelineBar
            events={live.events}
            currentMinute={clockMinute}
            homeName={homeClub.name}
            awayName={awayClub.name}
          />

          {match.result?.penaltyShootout && (
            <PenaltyShootoutGridWidget
              shootout={match.result.penaltyShootout}
              homeName={homeClub.name}
              awayName={awayClub.name}
            />
          )}

          {/* Touchline Commands HUD */}
          <div className="touchline-shouts-bar">
            <span className="touchline-shout-title">
              Gritos da Beira do Gramado:
            </span>
            <div className="touchline-shouts-list" role="radiogroup" aria-label="Instruções táticas rápidas">
              <button
                type="button"
                role="radio"
                aria-checked={activeStance === 'press'}
                className={`touchline-shout-btn ${activeStance === 'press' ? 'active' : ''}`}
                disabled={quickTacticBusy}
                onClick={() => quickApplyTacticalStance('press')}
                title="Pressionar: mentalidade ofensiva e pressão alta na saída de bola adversária"
              >
                <span className="touchline-shout-icon">
                  <SoccerBallIcon size={14} color="#f59e0b" />
                </span>
                <span className="touchline-shout-label">Pressionar</span>
                {activeStance === 'press' && <span className="touchline-shout-indicator" aria-hidden="true" />}
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={activeStance === 'counter'}
                className={`touchline-shout-btn ${activeStance === 'counter' ? 'active' : ''}`}
                disabled={quickTacticBusy}
                onClick={() => quickApplyTacticalStance('counter')}
                title="Contra-Ataque: bloco baixo defensivo com transição rápida e vertical"
              >
                <span className="touchline-shout-icon">
                  <SwordsIcon size={14} color="#38bdf8" />
                </span>
                <span className="touchline-shout-label">Contra-Ataque</span>
                {activeStance === 'counter' && <span className="touchline-shout-indicator" aria-hidden="true" />}
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={activeStance === 'balanced'}
                className={`touchline-shout-btn ${activeStance === 'balanced' ? 'active' : ''}`}
                disabled={quickTacticBusy}
                onClick={() => quickApplyTacticalStance('balanced')}
                title="Equilibrar: postura balanceada com linhas médias"
              >
                <span className="touchline-shout-icon">
                  <ShieldIcon size={14} color="#34d399" />
                </span>
                <span className="touchline-shout-label">Equilibrar</span>
                {activeStance === 'balanced' && <span className="touchline-shout-indicator" aria-hidden="true" />}
              </button>

              {/* Ações Rápidas em 1 Clique recomendadas pelo Staff */}
              {mostExhaustedStarter && (
                <button
                  type="button"
                  className="touchline-shout-btn btn-quick-intervention"
                  style={{ border: '1.5px solid #f59e0b', color: '#fef3c7' }}
                  disabled={busy}
                  onClick={() =>
                    quickApplySubstitution(
                      mostExhaustedStarter.target.id,
                      mostExhaustedStarter.sub.id
                    )
                  }
                  title={`Substituição Imediata: trocar ${mostExhaustedStarter.target.name} por ${mostExhaustedStarter.sub.name}`}
                >
                  <span className="touchline-shout-icon">
                    <RefreshIcon size={14} color="#f59e0b" />
                  </span>
                  <span className="touchline-shout-label">Trocar Jogador Esgotado</span>
                </button>
              )}

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
                  title="Baixar Linha Defensiva para equilibrada e neutralizar infiltrações adversárias"
                >
                  <span className="touchline-shout-icon">
                    <ShieldIcon size={14} color="#ef4444" />
                  </span>
                  <span className="touchline-shout-label">Baixar Linha Defensiva</span>
                </button>
              )}
            </div>
          </div>

          {/* TOUCHLINE ASSISTANT & CAUSAL ALERTS CARD */}
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

          {/* MAIN LIVE MATCH CONTROLS BAR DIRECTLY BELOW TOUCHLINE SHOUTS */}
          <div className="card live-controls-top">
            <div className="live-controls-actions">
              <button
                type="button"
                className="btn-live-secondary tactical"
                onClick={() => openTacticalCenter('manual')}
                title="Abrir prancheta tática e fazer alterações no time"
              >
                <TacticsIcon size={15} color="currentColor" style={{ marginRight: 6 }} /> Prancheta Tática
              </button>
            </div>

            <div className="live-speed-picker">
              <span className="live-speed-label">Velocidade:</span>
              {SPEED_OPTIONS.map((option) => {
                /**
                 * A velocidade bloqueada aparece, com cadeado, em vez de sumir.
                 *
                 * Escondê-la seria mais limpo e diria menos: o jogador nunca saberia que "Muito rápido"
                 * existe, e o que o premium oferece ficaria invisível. Mostrando, o limite vira informação.
                 */
                const liberada = canUseMatchSpeed(gameMode, option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`live-speed-option${speedKey === option.key ? ' active' : ''}${liberada ? '' : ' live-speed-locked'}`}
                    onClick={() => (liberada ? setSpeedKey(option.key) : setSpeedBlock(explainBlock(gameMode, 'speed')))}
                    title={liberada ? undefined : explainBlock(gameMode, 'speed')}
                    aria-disabled={!liberada}
                  >
                    {liberada ? option.label : `${option.label} (Bloqueado)`}
                  </button>
                );
              })}
            </div>
            {speedBlock && (
              <p className="live-speed-aviso" role="status">
                {speedBlock}
              </p>
            )}
          </div>

          {/* Stats and Commentary Feed */}
          <div className="live-match-columns">
            <div className="live-match-col">
              {/* Radar & Momentum ou Prancheta Tática Ao Vivo */}
              <div className="card">
                <div className="live-pitch-tabs" role="tablist" aria-label="Visualização do Campo">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pitchViewTab === 'RADAR_2D'}
                    className={`btn-live-pitch-tab ${pitchViewTab === 'RADAR_2D' ? 'active' : ''}`}
                    onClick={() => setPitchViewTab('RADAR_2D')}
                  >
                    <EyeIcon size={14} style={{ marginRight: 6 }} /> Radar 2D de Jogo
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pitchViewTab === 'TACTICAL_XI'}
                    className={`btn-live-pitch-tab ${pitchViewTab === 'TACTICAL_XI' ? 'active' : ''}`}
                    onClick={() => setPitchViewTab('TACTICAL_XI')}
                  >
                    <TacticsIcon size={14} style={{ marginRight: 6 }} /> Prancheta Tática Ao Vivo
                  </button>
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
                    momentum={momentum}
                    isPaused={pauseReason !== null}
                    speedKey={speedKey}
                    homeGoals={live.homeGoals}
                    awayGoals={live.awayGoals}
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

                <h2>Momentum do jogo</h2>
                <p className="momentum-label">{momentumLabel(momentum, homeClub.name, awayClub.name)}</p>
                <div className="stat-row-bar momentum-bar">
                  <span className="stat-row-bar-home" style={{ width: `${momentum}%` }} />
                  <span className="stat-row-bar-away" style={{ width: `${100 - momentum}%` }} />
                </div>
                <div className="momentum-pointer-track">
                  <span className="momentum-pointer" style={{ left: `${Math.max(4, Math.min(96, momentum))}%` }}>
                    ▲
                  </span>
                </div>
              </div>

              {/* Match Statistics */}
              <div className="card">
                <h2>Estatísticas</h2>
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
            </div>

            {/* Commentary Lances */}
            <div className="card live-lances-card">
              <h2>Lances</h2>
              {live.events.length === 0 && <p className="muted">A partida ainda não teve lances.</p>}
              <ul className="lances-feed">
                {[...live.events].reverse().map((event: MatchEvent, i) => (
                  <li key={i} className={`lance-item lance-${eventVariant(event)}`}>
                    <span className="lance-item-icon">{eventIcon(event)}</span>
                    <strong>{formatMatchEventMinute(event, clockFormat)}</strong>
                    <span>{event.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
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
          } else if (!match?.live?.pendingDecision) {
            setPauseReason(null);
          }
        }}
        onResumeHalftime={() => {
          setHalftimeSeen(true);
          setDisplayMinute(45);
          requestedMinuteRef.current = 45;
          playAnchorRef.current = { realTime: Date.now(), gameMinute: 45 };
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

import React, { useMemo } from 'react';
import {
  bookedPlayerIds,
  calculateInMatchStamina,
  calculateMatchRatings,
  formatMatchEventMinute,
  sentOffPlayerIds,
  type Formation,
  type MatchEvent,
  type MatchSide,
  type Player,
  type Tactic,
} from '@tactical-arena/shared';
import { useClubKit } from '../lib/useClubKit.js';
import { resolveMatchKits } from '../lib/kitClash.js';
import { attacksRight, eventPeriod, mirrorPoint, type PitchPeriod } from '../lib/pitchOrientation.js';
import { computeMatchTargets, markingStrengthFor, type SpeedKey, type TeamInput } from '../lib/pitchMotion.js';
import { usePitchAgents } from '../lib/usePitchAgents.js';
import type { PlayShot } from '../lib/pitchPlay.js';

export interface PitchVisualizerProps {
  homeClub: { id: string; name: string; slug?: string | null; players?: Player[] };
  awayClub: { id: string; name: string; slug?: string | null; players?: Player[] };
  homeTactic?: Tactic | null;
  awayTactic?: Tactic | null;
  mySide?: MatchSide | null;
  events: MatchEvent[];
  currentMinute: number;
  momentum: number; // 0 to 100 (Home momentum)
  isPaused: boolean;
  speedKey?: SpeedKey;
  /** Tempo de jogo em que a partida está. No intervalo os times trocam de lado: '2T' gira o campo. */
  period?: PitchPeriod;
  /** Minuto fracionário do relógio (currentMinute é só a parte inteira). Opcional: sem ele vale currentMinute. */
  gameTime?: number;
  homeGoals: number;
  awayGoals: number;
  selectedEvent?: MatchEvent | null;
  onSelectEvent?: (event: MatchEvent | null) => void;
  goldenWindowSide?: MatchSide | null;
  /**
   * Lances que o motor já decidiu mas o relógio ainda não revelou (vêm da espiada do servidor). Servem só para o
   * campo chegar ao lance antes dele ser anunciado; nada é escrito na tela sobre eles.
   */
  upcomingEvents?: MatchEvent[];
  /** Duração de um minuto de jogo em milissegundos reais, na velocidade atual. */
  minuteMs?: number;
}

const DEFAULT_FORMATION_SLOTS: Partial<Record<Formation, { x: number; y: number }[]>> = {
  '4-4-2': [
    { x: 7, y: 30 },   // GK
    { x: 18, y: 12 },  // LB
    { x: 17, y: 24 },  // CB
    { x: 17, y: 36 },  // CB
    { x: 18, y: 48 },  // RB
    { x: 30, y: 12 },  // LM
    { x: 28, y: 24 },  // CM
    { x: 28, y: 36 },  // CM
    { x: 30, y: 48 },  // RM
    { x: 42, y: 22 },  // ST
    { x: 42, y: 38 },  // ST
  ],
  '4-3-3': [
    { x: 7, y: 30 },   // GK
    { x: 18, y: 12 },  // LB
    { x: 17, y: 24 },  // CB
    { x: 17, y: 36 },  // CB
    { x: 18, y: 48 },  // RB
    { x: 28, y: 18 },  // CM
    { x: 26, y: 30 },  // DM
    { x: 28, y: 42 },  // CM
    { x: 42, y: 14 },  // LW
    { x: 44, y: 30 },  // ST
    { x: 42, y: 46 },  // RW
  ],
  '3-5-2': [
    { x: 7, y: 30 },   // GK
    { x: 17, y: 16 },  // CB
    { x: 16, y: 30 },  // CB
    { x: 17, y: 44 },  // CB
    { x: 28, y: 10 },  // LWB
    { x: 29, y: 22 },  // CM
    { x: 28, y: 30 },  // DM
    { x: 29, y: 38 },  // CM
    { x: 28, y: 50 },  // RWB
    { x: 42, y: 22 },  // ST
    { x: 42, y: 38 },  // ST
  ],
  '5-3-2': [
    { x: 7, y: 30 },   // GK
    { x: 18, y: 10 },  // LWB
    { x: 16, y: 20 },  // CB
    { x: 15, y: 30 },  // CB
    { x: 16, y: 40 },  // CB
    { x: 18, y: 50 },  // RWB
    { x: 28, y: 20 },  // CM
    { x: 27, y: 30 },  // CM
    { x: 28, y: 40 },  // CM
    { x: 42, y: 22 },  // ST
    { x: 42, y: 38 },  // ST
  ],
  '4-2-3-1': [
    { x: 7, y: 30 },   // GK
    { x: 18, y: 12 },  // LB
    { x: 17, y: 24 },  // CB
    { x: 17, y: 36 },  // CB
    { x: 18, y: 48 },  // RB
    { x: 27, y: 22 },  // DM
    { x: 27, y: 38 },  // DM
    { x: 36, y: 14 },  // LAM
    { x: 37, y: 30 },  // CAM
    { x: 36, y: 46 },  // RAM
    { x: 44, y: 30 },  // ST
  ],
};

const SLOTS_PADRAO = DEFAULT_FORMATION_SLOTS['4-4-2']!;

function shortSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 10);
  const last = parts[parts.length - 1];
  if (last.length <= 3 && parts.length >= 2) {
    return `${parts[parts.length - 2]} ${last}`.slice(0, 11);
  }
  return last.slice(0, 10);
}

function staminaColor(stamina: number): string {
  if (stamina >= 68) return '#4ade80';
  if (stamina >= 45) return '#facc15';
  return '#ef4444';
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

interface PitchEventCoord {
  event: MatchEvent;
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
  isShot: boolean;
}

function computeEventCoordinates(ev: MatchEvent): PitchEventCoord {
  const seed = hashSeed(`${ev.minute}-${ev.type}-${ev.playerId ?? ''}-${ev.description.slice(0, 12)}`);
  const ySpread = ((seed % 28) - 14);
  const toRight = attacksRight(ev.team, eventPeriod(ev));

  if (ev.type === 'goal' || ev.type === 'chance') {
    // O motor só informa tipo, resultado e xG: a distância do chute vem do xG (quanto maior, mais perto do gol
    // e mais central), e o tipo ajusta o ponto. Distância medida a partir da linha de fundo adversária.
    const xg = Math.max(0.02, Math.min(0.95, ev.xg ?? 0.12));
    const frac = (n: number, mod: number) => (Math.abs(n) % mod) / mod; // 0..1 determinístico
    let dist = Math.max(6, Math.min(30, 27 - xg * 36));
    let width = 4 + (1 - xg) * 17; // abertura lateral máxima a partir do centro
    if (ev.shotType === 'LONG_SHOT') dist = Math.max(dist, 22 + frac(seed, 7) * 6);
    else if (ev.shotType === 'ONE_ON_ONE') dist = Math.min(dist, 14);
    else if (ev.shotType === 'REBOUND') dist = Math.min(dist, 9);
    else if (ev.shotType === 'HEADER') dist = Math.min(dist, 12);
    let startDist = dist;
    let startY = Math.max(10, Math.min(50, 30 + (frac(seed, 29) * 2 - 1) * width));
    if (ev.isPenalty) {
      startDist = 11.5;
      startY = 30;
    }
    const startX = toRight ? 100 - startDist : startDist;

    // Alvo no gol: traves em y 25.8 a 34.2. Gols vão para um canto livre; defesas ficam perto do goleiro.
    const goalLine = toRight ? 100 : 0;
    const inGoal = (k: number) => 30 + (k * 2 - 1) * 3.6; // 26.4 a 33.6, dentro das traves
    let endX = toRight ? 99.8 : 0.2; // dentro do viewBox
    let endY = inGoal(frac(seed >> 3, 11));
    if (ev.shotOutcome === 'woodwork') {
      endX = goalLine + (toRight ? -0.4 : 0.4);
      endY = (seed % 2 === 0) ? 25.8 : 34.2;
    } else if (ev.shotOutcome === 'saved') {
      endX = goalLine + (toRight ? -3.5 : 3.5);
      endY = inGoal(frac(seed >> 3, 13)) * 0.6 + 30 * 0.4;
    } else if (ev.shotOutcome === 'off_target') {
      endX = toRight ? 99.8 : 0.2;
      endY = (seed % 2 === 0) ? 22.5 : 37.5;
    } else if (ev.shotOutcome === 'blocked') {
      endX = toRight ? startX + 3.5 : startX - 3.5;
      endY = startY + (frac(seed >> 3, 5) * 2 - 1) * 2;
    }

    return { event: ev, startX, startY, endX, endY, isShot: true };
  }

  if (ev.type === 'card' || ev.type === 'injury') {
    const startX = toRight ? 42 + (seed % 24) : 58 - (seed % 24);
    const startY = Math.max(10, Math.min(50, 30 + ySpread));
    return { event: ev, startX, startY, isShot: false };
  }

  return {
    event: ev,
    startX: 50,
    startY: Math.max(8, Math.min(52, 30 + ySpread)),
    isShot: false,
  };
}

/** Converte um lance do motor (gol ou chance) na finalização que o diretor de jogo encena. */
function toPlayShot(ev: MatchEvent): PlayShot | null {
  if (ev.type !== 'goal' && ev.type !== 'chance') return null;
  const coord = computeEventCoordinates(ev);
  if (!coord.isShot || coord.endX === undefined || coord.endY === undefined) return null;
  return {
    key: `${eventPeriod(ev)}-${ev.minute}-${ev.type}-${ev.playerId ?? ''}-${ev.description.slice(0, 12)}`,
    side: ev.team,
    start: { x: coord.startX, y: coord.startY },
    end: { x: coord.endX, y: coord.endY },
    outcome: ev.type === 'goal' ? 'goal' : ev.shotOutcome ?? 'chance',
  };
}

export const PitchVisualizer: React.FC<PitchVisualizerProps> = ({
  homeClub,
  awayClub,
  homeTactic,
  awayTactic,
  mySide,
  events,
  currentMinute,
  momentum,
  isPaused,
  speedKey = 'normal',
  period = '1T',
  gameTime,
  homeGoals,
  awayGoals,
  selectedEvent,
  onSelectEvent,
  goldenWindowSide,
  upcomingEvents,
  minuteMs,
}) => {
  // Troca de lado: no 2º tempo o mandante ataca para a esquerda.
  const homeAttacksRight = attacksRight('home', period);
  // Sem lado definido o rótulo segue o mandante, como antes.
  const myAttacksLeft = mySide ? !attacksRight(mySide, period) : !homeAttacksRight;
  const clock = gameTime ?? currentMinute;

  const homeClubKit = useClubKit(homeClub as never);
  const awayClubKit = useClubKit(awayClub as never);

  const matchKits = useMemo(() => {
    return resolveMatchKits(homeClubKit, awayClubKit);
  }, [homeClubKit, awayClubKit]);

  const homeColor = matchKits.home.fill;
  const awayColor = matchKits.away.fill;

  const homeFormation: Formation = homeTactic?.formation ?? '4-4-2';
  const awayFormation: Formation = awayTactic?.formation ?? '4-4-2';

  const homeSquadById = useMemo(
    () => new Map((homeClub.players ?? []).map((p) => [p.id, p])),
    [homeClub.players],
  );
  const awaySquadById = useMemo(
    () => new Map((awayClub.players ?? []).map((p) => [p.id, p])),
    [awayClub.players],
  );

  const homeLineupPlayers = useMemo(
    () =>
      (homeTactic?.lineup ?? []).map((slot) => homeSquadById.get(slot.playerId)).filter((p): p is Player => !!p),
    [homeTactic?.lineup, homeSquadById],
  );
  const awayLineupPlayers = useMemo(
    () =>
      (awayTactic?.lineup ?? []).map((slot) => awaySquadById.get(slot.playerId)).filter((p): p is Player => !!p),
    [awayTactic?.lineup, awaySquadById],
  );

  const ratingsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (homeLineupPlayers.length === 0 && awayLineupPlayers.length === 0) return map;
    const computed = calculateMatchRatings(homeLineupPlayers, awayLineupPlayers, events, homeGoals, awayGoals);
    computed.home.forEach((r) => map.set(r.playerId, r.rating));
    computed.away.forEach((r) => map.set(r.playerId, r.rating));
    return map;
  }, [homeLineupPlayers, awayLineupPlayers, events, homeGoals, awayGoals]);

  const homeBooked = useMemo(() => bookedPlayerIds(events, 'home'), [events]);
  const awayBooked = useMemo(() => bookedPlayerIds(events, 'away'), [events]);
  const homeSentOff = useMemo(() => sentOffPlayerIds(events, 'home'), [events]);
  const awaySentOff = useMemo(() => sentOffPlayerIds(events, 'away'), [events]);

  const homeExcludedIndices = useMemo(() => {
    const set = new Set<number>();
    (homeTactic?.lineup ?? []).forEach((slot, idx) => {
      if (slot.playerId && homeSentOff.has(slot.playerId)) {
        set.add(idx);
      }
    });
    return set;
  }, [homeTactic?.lineup, homeSentOff]);

  const awayExcludedIndices = useMemo(() => {
    const set = new Set<number>();
    (awayTactic?.lineup ?? []).forEach((slot, idx) => {
      if (slot.playerId && awaySentOff.has(slot.playerId)) {
        set.add(idx);
      }
    });
    return set;
  }, [awayTactic?.lineup, awaySentOff]);

  const recentEvent = useMemo(() => {
    if (selectedEvent) return selectedEvent;
    return [...events]
      .reverse()
      .find((e) => Math.abs(e.minute - currentMinute) <= 2);
  }, [events, currentMinute, selectedEvent]);

  const pitchMarkers = useMemo(() => {
    // Só os lances do tempo atual: depois da troca de lado, a flecha de um gol do 1º tempo ficaria desenhada
    // no gol que o time passou a defender. Um lance escolhido pelo usuário aparece no lado em que aconteceu.
    const notable = events.filter(
      (e) =>
        (e.type === 'goal' || e.type === 'chance' || e.type === 'card' || e.type === 'injury') &&
        eventPeriod(e) === period,
    );
    const tail = notable.slice(-5);
    if (selectedEvent && !tail.includes(selectedEvent)) {
      tail.push(selectedEvent);
    }
    return tail.map((ev) => ({
      ...computeEventCoordinates(ev),
      isActive: ev === recentEvent || ev === selectedEvent,
    }));
  }, [events, recentEvent, selectedEvent, period]);

  // Para onde a bola quer ir. Quem a leva até lá é o usePitchAgents (velocidade limitada), não um salto.
  const ballTarget = useMemo(() => {
    if (recentEvent) {
      const coord = computeEventCoordinates(recentEvent);
      if (coord.isShot && coord.endX !== undefined && coord.endY !== undefined) {
        return { x: coord.endX, y: coord.endY };
      }
      return { x: coord.startX, y: coord.startY };
    }

    const clampedMomentum = Math.max(15, Math.min(85, momentum));
    const normalizedX = 10 + (clampedMomentum / 100) * 80;
    const oscillationY = 30 + Math.sin(clock * 1.5) * 14;
    return {
      x: homeAttacksRight ? normalizedX : 100 - normalizedX,
      y: Math.max(10, Math.min(50, oscillationY)),
    };
  }, [recentEvent, momentum, clock, homeAttacksRight]);

  const eventClass = recentEvent
    ? recentEvent.type === 'goal'
      ? 'pitch-event-goal'
      : recentEvent.shotOutcome === 'woodwork'
      ? 'pitch-event-woodwork'
      : recentEvent.shotOutcome === 'saved'
      ? 'pitch-event-save'
      : recentEvent.type === 'card'
      ? 'pitch-event-card'
      : 'pitch-event-active'
    : '';

  // Lance do motor para o diretor de jogo encenar: a bola vai ao ponto do chute, chuta e a posse recomeça.
  const pendingShot = useMemo<PlayShot | null>(() => (recentEvent ? toPlayShot(recentEvent) : null), [recentEvent]);

  // Próximo chute já conhecido que o relógio ainda não revelou. Um lance que o usuário abriu para rever manda.
  const upcoming = useMemo(() => {
    if (selectedEvent || !minuteMs || !upcomingEvents?.length) return null;
    const next = upcomingEvents
      .filter((e) => (e.type === 'goal' || e.type === 'chance') && e.minute >= clock)
      .sort((x, y) => x.minute - y.minute)[0];
    const shot = next ? toPlayShot(next) : null;
    return next && shot ? { shot, minutesAhead: Math.max(0, next.minute - clock), minuteMs } : null;
  }, [selectedEvent, upcomingEvents, clock, minuteMs]);

  // As formações estão escritas com o time atacando para a direita: quem ataca para a esquerda é girado.
  const matchSetup = useMemo(() => {
    const orient = (slots: { x: number; y: number }[], toRight: boolean) =>
      toRight ? slots.map((s) => ({ ...s })) : slots.map(mirrorPoint);
    const home: TeamInput = {
      side: 'home',
      attackDir: homeAttacksRight ? 'right' : 'left',
      baseSlots: orient(DEFAULT_FORMATION_SLOTS[homeFormation] ?? SLOTS_PADRAO, homeAttacksRight),
      excluded: homeExcludedIndices,
      markingStrength: markingStrengthFor(homeTactic?.markingStyle),
    };
    const away: TeamInput = {
      side: 'away',
      attackDir: homeAttacksRight ? 'left' : 'right',
      baseSlots: orient(DEFAULT_FORMATION_SLOTS[awayFormation] ?? SLOTS_PADRAO, !homeAttacksRight),
      excluded: awayExcludedIndices,
      markingStrength: markingStrengthFor(awayTactic?.markingStyle),
    };
    return { home, away };
  }, [homeAttacksRight, homeFormation, awayFormation, homeExcludedIndices, awayExcludedIndices, homeTactic?.markingStyle, awayTactic?.markingStyle]);

  const homePace = useMemo(
    () => Array.from({ length: 11 }, (_, i) => homeSquadById.get(homeTactic?.lineup[i]?.playerId ?? '')?.attributes.pace),
    [homeSquadById, homeTactic?.lineup],
  );
  const awayPace = useMemo(
    () => Array.from({ length: 11 }, (_, i) => awaySquadById.get(awayTactic?.lineup[i]?.playerId ?? '')?.attributes.pace),
    [awaySquadById, awayTactic?.lineup],
  );

  // Os 22 jogadores e a bola andam de verdade: cada um segue o seu alvo com a velocidade do seu `pace`.
  const frame = usePitchAgents({
    computeTargets: (ball, phase, detail, possessionSide) =>
      computeMatchTargets({ ...matchSetup, ball, momentum, phase, possessionSide, detail }),
    ballTarget,
    pendingShot,
    upcoming,
    momentum,
    homeAttacksRight,
    excludedHome: homeExcludedIndices,
    excludedAway: awayExcludedIndices,
    resetKey: [period, homeFormation, awayFormation, [...homeExcludedIndices].join(','), [...awayExcludedIndices].join(',')].join('|'),
    speedKey,
    isPaused,
    homePace,
    awayPace,
  });
  const homePlayerCoords = frame.home;
  const awayPlayerCoords = frame.away;
  const ballPos = frame.ball;

  return (
    <div className="pitch-visualizer-container" aria-label="Visualizador 2D do Campo de Futebol">
      {/* Dynamic Event Status Bar */}
      <div className={`pitch-action-header ${eventClass}`}>
        <div className="pitch-action-live-indicator">
          <span className={`pitch-live-dot ${isPaused ? 'paused' : 'live'}`} />
          <span className="pitch-action-minute">
            {recentEvent ? formatMatchEventMinute(recentEvent) : `${currentMinute}'`}
          </span>
        </div>
        <div className="pitch-action-text">
          {recentEvent ? (
            <span className="pitch-event-headline">
              <strong>{recentEvent.team === 'home' ? homeClub.name : awayClub.name}:</strong> {recentEvent.description}
              {recentEvent.xg !== undefined && recentEvent.xg > 0 ? ` (xG: ${recentEvent.xg.toFixed(2)})` : ''}
            </span>
          ) : (
            <span className="pitch-action-flow">
              {momentum >= 60
                ? `Pressao no campo de ataque: ${homeClub.name}`
                : momentum <= 40
                ? `Pressao no campo de ataque: ${awayClub.name}`
                : 'Disputa intensa no meio-campo'}
            </span>
          )}
        </div>
        {selectedEvent && onSelectEvent ? (
          <button
            type="button"
            className="pitch-clear-replay-btn"
            onClick={() => onSelectEvent(null)}
            title="Voltar ao lance ao vivo"
          >
            Voltar ao vivo
          </button>
        ) : (
          <div className="pitch-score-badge">
            {homeGoals} x {awayGoals}
          </div>
        )}
      </div>

      {/* SVG 2D Interactive Pitch */}
      <div className="pitch-svg-wrapper">
        <svg
          viewBox="0 0 100 60"
          className="pitch-visualizer-svg"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Campo de Futebol Top-Down"
        >
          <defs>
            <linearGradient id="turfPattern" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#144526" />
              <stop offset="10%" stopColor="#144526" />
              <stop offset="10.1%" stopColor="#19522e" />
              <stop offset="20%" stopColor="#19522e" />
              <stop offset="20.1%" stopColor="#144526" />
              <stop offset="30%" stopColor="#144526" />
              <stop offset="30.1%" stopColor="#19522e" />
              <stop offset="40%" stopColor="#19522e" />
              <stop offset="40.1%" stopColor="#144526" />
              <stop offset="50%" stopColor="#144526" />
              <stop offset="50.1%" stopColor="#19522e" />
              <stop offset="60%" stopColor="#19522e" />
              <stop offset="60.1%" stopColor="#144526" />
              <stop offset="70%" stopColor="#144526" />
              <stop offset="70.1%" stopColor="#19522e" />
              <stop offset="80%" stopColor="#19522e" />
              <stop offset="80.1%" stopColor="#144526" />
              <stop offset="90%" stopColor="#144526" />
              <stop offset="90.1%" stopColor="#19522e" />
              <stop offset="100%" stopColor="#19522e" />
            </linearGradient>
            <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0.8" stdDeviation="0.7" floodColor="#000" floodOpacity="0.7" />
              <feDropShadow dx="0" dy="0" stdDeviation="1.4" floodColor="#fef08a" floodOpacity="0.9" />
            </filter>
            <filter id="playerShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0.5" stdDeviation="0.45" floodColor="#000" floodOpacity="0.65" />
            </filter>
            <marker id="shotArrowGoal" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#facc15" />
            </marker>
            <marker id="shotArrowChance" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Background Turf with stripes */}
          <rect x="0" y="0" width="100" height="60" fill="url(#turfPattern)" rx="2.5" />

          {/* 3 Territorial Zones */}
          <g className="pitch-territorial-zones" opacity="0.26">
            <rect
              x="2"
              y="2"
              width="32"
              height="56"
              fill={homeAttacksRight ? (momentum < 45 ? awayColor : 'transparent') : (momentum > 55 ? homeColor : 'transparent')}
              className="pitch-zone-rect"
            />
            <rect
              x="34"
              y="2"
              width="32"
              height="56"
              fill={Math.abs(momentum - 50) <= 10 ? '#38bdf8' : 'transparent'}
              className="pitch-zone-rect"
            />
            <rect
              x="66"
              y="2"
              width="32"
              height="56"
              fill={homeAttacksRight ? (momentum > 55 ? homeColor : 'transparent') : (momentum < 45 ? awayColor : 'transparent')}
              className="pitch-zone-rect"
            />
          </g>

          {goldenWindowSide && (
            <g className="pitch-golden-window-zone">
              <rect
                x={attacksRight(goldenWindowSide, period) ? 66 : 2}
                y="2"
                width="32"
                height="56"
                fill="rgba(229, 169, 60, 0.16)"
                stroke="#e5a93c"
                strokeWidth="0.7"
                strokeDasharray="2 1"
                rx="1"
              />
              <rect x="36" y="2.2" width="28" height="4.2" rx="1.2" fill="#e5a93c" />
              <text x="50" y="5.1" fill="#181204" fontSize="2.1" fontWeight="800" textAnchor="middle">
                JANELA DE OURO ATIVA
              </text>
            </g>
          )}

          {/* Field Markings */}
          <g stroke="rgba(255, 255, 255, 0.48)" strokeWidth="0.55" fill="none">
            <rect x="2" y="2" width="96" height="56" rx="1" />
            <line x1="50" y1="2" x2="50" y2="58" />
            <circle cx="50" cy="30" r="7.5" className="pitch-center-circle" />
            <circle cx="50" cy="30" r="0.6" fill="rgba(255, 255, 255, 0.75)" stroke="none" />

            <rect x="2" y="14" width="13" height="32" />
            <rect x="2" y="21" width="4.5" height="18" />
            <circle cx="9" cy="30" r="0.5" fill="rgba(255, 255, 255, 0.75)" stroke="none" />
            <path d="M 15 24 A 6 6 0 0 1 15 36" />

            <rect x="85" y="14" width="13" height="32" />
            <rect x="93.5" y="21" width="4.5" height="18" />
            <circle cx="91" cy="30" r="0.5" fill="rgba(255, 255, 255, 0.75)" stroke="none" />
            <path d="M 85 24 A 6 6 0 0 0 85 36" />

            <rect x="0.5" y="24" width="1.5" height="12" stroke="#fff" strokeWidth="0.7" fill="rgba(255,255,255,0.15)" />
            <rect x="98" y="24" width="1.5" height="12" stroke="#fff" strokeWidth="0.7" fill="rgba(255,255,255,0.15)" />
          </g>

          <g fill="rgba(255, 255, 255, 0.42)" fontSize="2.4" fontWeight="700" textAnchor="middle">
            <text x="18" y="56.2">{myAttacksLeft ? 'Ataque' : 'Defesa'}</text>
            <text x="50" y="56.2">Meio</text>
            <text x="82" y="56.2">{myAttacksLeft ? 'Defesa' : 'Ataque'}</text>
          </g>

          {/* Event Markers */}
          <g className="pitch-event-markers">
            {pitchMarkers.map((m, idx) => {
              const isGoal = m.event.type === 'goal';
              const isSave = m.event.shotOutcome === 'saved';
              const isCard = m.event.type === 'card';
              const opacity = m.isActive ? 0.96 : 0.35 + (idx / Math.max(1, pitchMarkers.length)) * 0.25;
              const strokeColor = isGoal ? '#facc15' : isSave ? '#38bdf8' : '#cbd5e1';

              return (
                <g
                  key={`marker-${idx}-${m.event.minute}`}
                  opacity={opacity}
                  style={{ cursor: onSelectEvent ? 'pointer' : 'default' }}
                  onClick={() => onSelectEvent?.(m.event)}
                >
                  {m.isShot && m.endX !== undefined && m.endY !== undefined && (
                    <line
                      x1={m.startX}
                      y1={m.startY}
                      x2={m.endX}
                      y2={m.endY}
                      stroke={strokeColor}
                      strokeWidth={m.isActive ? '0.85' : '0.45'}
                      strokeDasharray={isGoal ? 'none' : '1.4 0.9'}
                      markerEnd={isGoal ? 'url(#shotArrowGoal)' : 'url(#shotArrowChance)'}
                    />
                  )}
                  <circle
                    cx={m.startX}
                    cy={m.startY}
                    r={m.isActive ? 1.45 : 1.0}
                    fill={isGoal ? '#facc15' : isCard ? '#eab308' : isSave ? '#38bdf8' : '#e2e8f0'}
                    stroke="#0b0b0d"
                    strokeWidth="0.35"
                  />
                </g>
              );
            })}
          </g>

          {/* Home Players */}
          <g className="pitch-home-team">
            {homePlayerCoords.map((coord, idx) => {
              const playerId = homeTactic?.lineup[idx]?.playerId;
              const player = playerId ? homeSquadById.get(playerId) : undefined;
              const isSentOff = homeExcludedIndices.has(idx);
              const px = coord.x;
              const py = coord.y;
              const kit = matchKits.home;
              const tokenFill = idx === 0 ? kit.gk : kit.fill;

              if (isSentOff) {
                return (
                  <g key={`home-player-${idx}`} className="pitch-player-node pitch-player-sent-off" style={{ transform: `translate(${px}px, ${py}px)` }} opacity="0.45">
                    <circle cx={0} cy={0} r="1.6" fill="rgba(15, 23, 42, 0.6)" stroke="#ef4444" strokeWidth="0.4" strokeDasharray="1 1" />
                    <rect x={-0.7} y={-1.0} width="1.4" height="2.0" rx="0.3" fill="#ef4444" stroke="#0b0b0d" strokeWidth="0.2" />
                    {player && (
                      <text x={0} y={3.8} fill="#ef4444" fontSize="1.35" fontWeight="700" textAnchor="middle">
                        {shortSurname(player.name)} (EXP)
                      </text>
                    )}
                  </g>
                );
              }

              const stamina = player ? calculateInMatchStamina(player, currentMinute) : 85;
              const rating = player ? ratingsMap.get(player.id) : undefined;
              const isBooked = player ? homeBooked.has(player.id) : false;
              const ringCircumference = 2 * Math.PI * 2.25;
              const ringDash = `${(Math.max(10, stamina) / 100) * ringCircumference} ${ringCircumference}`;

              return (
                <g key={`home-player-${idx}`} filter="url(#playerShadow)" className="pitch-player-node pitch-player-home" style={{ transform: `translate(${px}px, ${py}px)` }}>
                  {frame.possession.side === 'home' && frame.possession.carrier === idx && (
                    <circle className="pitch-carrier-ring" cx={0} cy={0} r="3.2" fill="none" stroke="#fde047" strokeWidth="0.5" />
                  )}
                  <circle
                    cx={0}
                    cy={0}
                    r="2.25"
                    fill="rgba(11, 11, 13, 0.75)"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="0.45"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r="2.25"
                    fill="none"
                    stroke={staminaColor(stamina)}
                    strokeWidth="0.5"
                    strokeDasharray={ringDash}
                    transform="rotate(-90)"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r="1.65"
                    fill={tokenFill}
                    stroke={kit.trim}
                    strokeWidth="0.4"
                  />
                  <circle cx={0} cy={0} r="0.5" fill="#ffffff" />

                  {isBooked && (
                    <rect
                      x={1.5}
                      y={-2.6}
                      width="1.2"
                      height="1.65"
                      rx="0.2"
                      fill="#facc15"
                      stroke="#0b0b0d"
                      strokeWidth="0.2"
                    />
                  )}

                  {player && (
                    <g pointerEvents="none">
                      <text
                        x={0}
                        y={3.9}
                        fill="#f8fafc"
                        fontSize="1.65"
                        fontWeight="700"
                        textAnchor="middle"
                        style={{ textShadow: '0 1px 2px #000' }}
                      >
                        {shortSurname(player.name)}
                      </text>
                      {rating !== undefined && (
                        <text
                          x={0}
                          y={5.4}
                          fill={rating >= 7.2 ? '#4ade80' : rating < 6.0 ? '#f87171' : '#e5a93c'}
                          fontSize="1.4"
                          fontWeight="800"
                          textAnchor="middle"
                        >
                          {rating.toFixed(1)}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Away Players */}
          <g className="pitch-away-team">
            {awayPlayerCoords.map((coord, idx) => {
              const playerId = awayTactic?.lineup[idx]?.playerId;
              const player = playerId ? awaySquadById.get(playerId) : undefined;
              const isSentOff = awayExcludedIndices.has(idx);
              const px = coord.x;
              const py = coord.y;
              const kit = matchKits.away;
              const tokenFill = idx === 0 ? kit.gk : kit.fill;

              if (isSentOff) {
                return (
                  <g key={`away-player-${idx}`} className="pitch-player-node pitch-player-sent-off" style={{ transform: `translate(${px}px, ${py}px)` }} opacity="0.45">
                    <circle cx={0} cy={0} r="1.6" fill="rgba(15, 23, 42, 0.6)" stroke="#ef4444" strokeWidth="0.4" strokeDasharray="1 1" />
                    <rect x={-0.7} y={-1.0} width="1.4" height="2.0" rx="0.3" fill="#ef4444" stroke="#0b0b0d" strokeWidth="0.2" />
                    {player && (
                      <text x={0} y={3.8} fill="#ef4444" fontSize="1.35" fontWeight="700" textAnchor="middle">
                        {shortSurname(player.name)} (EXP)
                      </text>
                    )}
                  </g>
                );
              }

              const stamina = player ? calculateInMatchStamina(player, currentMinute) : 85;
              const rating = player ? ratingsMap.get(player.id) : undefined;
              const isBooked = player ? awayBooked.has(player.id) : false;
              const ringCircumference = 2 * Math.PI * 2.25;
              const ringDash = `${(Math.max(10, stamina) / 100) * ringCircumference} ${ringCircumference}`;

              return (
                <g key={`away-player-${idx}`} filter="url(#playerShadow)" className="pitch-player-node pitch-player-away" style={{ transform: `translate(${px}px, ${py}px)` }}>
                  {frame.possession.side === 'away' && frame.possession.carrier === idx && (
                    <circle className="pitch-carrier-ring" cx={0} cy={0} r="3.2" fill="none" stroke="#fde047" strokeWidth="0.5" />
                  )}
                  <circle
                    cx={0}
                    cy={0}
                    r="2.25"
                    fill="rgba(11, 11, 13, 0.75)"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="0.45"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r="2.25"
                    fill="none"
                    stroke={staminaColor(stamina)}
                    strokeWidth="0.5"
                    strokeDasharray={ringDash}
                    transform="rotate(-90)"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r="1.65"
                    fill={tokenFill}
                    stroke={kit.trim}
                    strokeWidth="0.4"
                  />
                  <circle cx={0} cy={0} r="0.5" fill="#ffffff" />

                  {isBooked && (
                    <rect
                      x={1.5}
                      y={-2.6}
                      width="1.2"
                      height="1.65"
                      rx="0.2"
                      fill="#facc15"
                      stroke="#0b0b0d"
                      strokeWidth="0.2"
                    />
                  )}

                  {player && (
                    <g pointerEvents="none">
                      <text
                        x={0}
                        y={3.9}
                        fill="#e2e8f0"
                        fontSize="1.6"
                        fontWeight="600"
                        textAnchor="middle"
                        style={{ textShadow: '0 1px 2px #000' }}
                      >
                        {shortSurname(player.name)}
                      </text>
                      {rating !== undefined && (
                        <text
                          x={0}
                          y={5.4}
                          fill={rating >= 7.2 ? '#4ade80' : rating < 6.0 ? '#f87171' : '#cbd5e1'}
                          fontSize="1.35"
                          fontWeight="700"
                          textAnchor="middle"
                        >
                          {rating.toFixed(1)}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* Active Ball */}
          <g
            className="pitch-ball-node"
            filter="url(#ballGlow)"
            transform={`translate(${ballPos.x}, ${ballPos.y})`}
            style={{
              transform: `translate(${ballPos.x}px, ${ballPos.y}px)`,
              transition: isPaused ? 'none' : 'transform 110ms linear',
            }}
          >
            <circle cx="0" cy="0" r="1.35" fill="#ffffff" stroke="#1f2937" strokeWidth="0.3" />
            <polygon points="-0.5,-0.2 0,-0.7 0.5,-0.2 0.3,0.5 -0.3,0.5" fill="#1f2937" />
          </g>
        </svg>
      </div>

      {/* Territorial Possession Bar Footer */}
      <div className="pitch-footer-radar">
        <div className="pitch-footer-team home" style={{ color: homeColor }}>
          <span className="pitch-footer-name">{homeClub.name}</span>
          {mySide === 'home' && <span className="pitch-you-tag">VOCE</span>}
        </div>
        <div className="pitch-possession-track">
          <div className="pitch-possession-bar home" style={{ width: `${momentum}%`, background: homeColor }} />
          <div className="pitch-possession-bar away" style={{ width: `${100 - momentum}%`, background: awayColor }} />
        </div>
        <div className="pitch-footer-team away" style={{ color: awayColor }}>
          {mySide === 'away' && <span className="pitch-you-tag">VOCE</span>}
          <span className="pitch-footer-name">{awayClub.name}</span>
        </div>
      </div>
    </div>
  );
};

import React, { useMemo } from 'react';
import {
  bookedPlayerIds,
  calculateInMatchStamina,
  calculateMatchRatings,
  formatMatchEventMinute,
  type Formation,
  type MatchEvent,
  type MatchSide,
  type Player,
  type Tactic,
} from '@tactical-arena/shared';
import { useClubColor } from '../lib/useClubColor.js';

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
  speedKey?: 'slow' | 'normal' | 'fast' | 'superfast';
  homeGoals: number;
  awayGoals: number;
  selectedEvent?: MatchEvent | null;
  onSelectEvent?: (event: MatchEvent | null) => void;
  goldenWindowSide?: MatchSide | null;
}

// 11 default slot positions for standard formations mapped to horizontal field (x: 0..100, y: 0..60)
// Home team plays Left -> Right (attacking right)
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

/** O 4-4-2 está literalmente no mapa acima, então serve de piso para toda formação ainda sem layout. */
const SLOTS_PADRAO = DEFAULT_FORMATION_SLOTS['4-4-2']!;

function getAwaySlots(homeSlots: { x: number; y: number }[]): { x: number; y: number }[] {
  return homeSlots.map((s) => ({
    x: 100 - s.x,
    y: 60 - s.y,
  }));
}

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
  const ySpread = ((seed % 28) - 14); // -14 to +13 around center y=30
  const isHome = ev.team === 'home';

  if (ev.type === 'goal' || ev.type === 'chance') {
    let startX = isHome ? 80 : 20;
    let startY = Math.max(12, Math.min(48, 30 + ySpread));
    if (ev.isPenalty) {
      startX = isHome ? 88.5 : 11.5;
      startY = 30;
    } else if (ev.shotType === 'LONG_SHOT') {
      startX = isHome ? 72 + (seed % 6) : 28 - (seed % 6);
    } else if (ev.shotType === 'ONE_ON_ONE' || ev.shotType === 'REBOUND') {
      startX = isHome ? 90 : 10;
      startY = 30 + ((seed % 10) - 5);
    } else if (ev.shotType === 'HEADER') {
      startX = isHome ? 89 : 11;
      startY = 30 + ((seed % 12) - 6);
    } else {
      startX = isHome ? 83 + (seed % 5) : 17 - (seed % 5);
    }

    let endX = isHome ? 98 : 2;
    let endY = 30 + ((seed % 8) - 4);
    if (ev.shotOutcome === 'woodwork') {
      endX = isHome ? 97.5 : 2.5;
      endY = (seed % 2 === 0) ? 24.2 : 35.8;
    } else if (ev.shotOutcome === 'saved') {
      endX = isHome ? 95 : 5;
      endY = 30 + ((seed % 6) - 3);
    } else if (ev.shotOutcome === 'off_target') {
      endX = isHome ? 99 : 1;
      endY = (seed % 2 === 0) ? 19 : 41;
    } else if (ev.shotOutcome === 'blocked') {
      endX = isHome ? startX + 5 : startX - 5;
      endY = startY + ((seed % 4) - 2);
    }

    return { event: ev, startX, startY, endX, endY, isShot: true };
  }

  if (ev.type === 'card' || ev.type === 'injury') {
    const startX = isHome ? 42 + (seed % 24) : 58 - (seed % 24);
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
  homeGoals,
  awayGoals,
  selectedEvent,
  onSelectEvent,
  goldenWindowSide,
}) => {
  const homeColor = useClubColor(homeClub as never) ?? '#ef4444';
  const awayColor = useClubColor(awayClub as never) ?? '#3b82f6';

  const homeFormation: Formation = homeTactic?.formation ?? '4-4-2';
  const awayFormation: Formation = awayTactic?.formation ?? '4-4-2';

  const homePlayers = DEFAULT_FORMATION_SLOTS[homeFormation] ?? SLOTS_PADRAO;
  const awayPlayers = useMemo(() => {
    const slots = DEFAULT_FORMATION_SLOTS[awayFormation] ?? SLOTS_PADRAO;
    return getAwaySlots(slots);
  }, [awayFormation]);

  // Resolve lineup players, ratings, stamina and bookings when squad arrays are provided
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

  // Find most recent highlight event happening in the last 2 minutes (or selectedEvent if user clicked one)
  const recentEvent = useMemo(() => {
    if (selectedEvent) return selectedEvent;
    return [...events]
      .reverse()
      .find((e) => Math.abs(e.minute - currentMinute) <= 2);
  }, [events, currentMinute, selectedEvent]);

  // Recent markers to display on the grass (last 5 notable events + selectedEvent)
  const pitchMarkers = useMemo(() => {
    const notable = events.filter((e) => e.type === 'goal' || e.type === 'chance' || e.type === 'card' || e.type === 'injury');
    const tail = notable.slice(-5);
    if (selectedEvent && !tail.includes(selectedEvent)) {
      tail.push(selectedEvent);
    }
    return tail.map((ev) => ({
      ...computeEventCoordinates(ev),
      isActive: ev === recentEvent || ev === selectedEvent,
    }));
  }, [events, recentEvent, selectedEvent]);

  // Calculate ball coordinates
  const ballPos = useMemo(() => {
    if (recentEvent) {
      const coord = computeEventCoordinates(recentEvent);
      if (coord.isShot && coord.endX !== undefined && coord.endY !== undefined) {
        return { x: coord.endX, y: coord.endY };
      }
      return { x: coord.startX, y: coord.startY };
    }

    // Default fluid movement based on momentum and current minute oscillation
    const clampedMomentum = Math.max(15, Math.min(85, momentum));
    const normalizedX = 10 + (clampedMomentum / 100) * 80;
    const oscillationY = 30 + Math.sin(currentMinute * 1.5) * 14;
    return { x: normalizedX, y: Math.max(10, Math.min(50, oscillationY)) };
  }, [recentEvent, momentum, currentMinute]);

  // Determine active event class
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

  // Slight dynamic horizontal shift of outfield players with momentum
  const momentumShift = ((momentum - 50) / 50) * 3.2;

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
                ? `Pressão no campo de ataque: ${homeClub.name}`
                : momentum <= 40
                ? `Pressão no campo de ataque: ${awayClub.name}`
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
          {/* Defs for turf patterns, markers and shadows */}
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

          {/* 3 Territorial Zones (Defense, Midfield, Attack) */}
          <g className="pitch-territorial-zones" opacity="0.26">
            <rect
              x="2"
              y="2"
              width="32"
              height="56"
              fill={momentum < 45 ? awayColor : 'transparent'}
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
              fill={momentum > 55 ? homeColor : 'transparent'}
              className="pitch-zone-rect"
            />
          </g>

          {/* Golden Window Highlight Zone if active */}
          {goldenWindowSide && (
            <g className="pitch-golden-window-zone">
              <rect
                x={goldenWindowSide === 'home' ? 66 : 2}
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

            {/* Home Penalty Area (Left) */}
            <rect x="2" y="14" width="13" height="32" />
            <rect x="2" y="21" width="4.5" height="18" />
            <circle cx="9" cy="30" r="0.5" fill="rgba(255, 255, 255, 0.75)" stroke="none" />
            <path d="M 15 24 A 6 6 0 0 1 15 36" />

            {/* Away Penalty Area (Right) */}
            <rect x="85" y="14" width="13" height="32" />
            <rect x="93.5" y="21" width="4.5" height="18" />
            <circle cx="91" cy="30" r="0.5" fill="rgba(255, 255, 255, 0.75)" stroke="none" />
            <path d="M 85 24 A 6 6 0 0 0 85 36" />

            {/* Goal Posts */}
            <rect x="0.5" y="24" width="1.5" height="12" stroke="#fff" strokeWidth="0.7" fill="rgba(255,255,255,0.15)" />
            <rect x="98" y="24" width="1.5" height="12" stroke="#fff" strokeWidth="0.7" fill="rgba(255,255,255,0.15)" />
          </g>

          {/* Zone Labels */}
          <g fill="rgba(255, 255, 255, 0.42)" fontSize="2.4" fontWeight="700" textAnchor="middle">
            <text x="18" y="56.2">Defesa</text>
            <text x="50" y="56.2">Meio</text>
            <text x="82" y="56.2">Ataque</text>
          </g>

          {/* Event Trajectories & Markers on the Grass */}
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
            {homePlayers.map((slot, idx) => {
              const playerId = homeTactic?.lineup[idx]?.playerId;
              const player = playerId ? homeSquadById.get(playerId) : undefined;
              const stamina = player ? calculateInMatchStamina(player, currentMinute) : 85;
              const rating = player ? ratingsMap.get(player.id) : undefined;
              const isBooked = player ? homeBooked.has(player.id) : false;
              const px = idx === 0 ? slot.x : Math.max(6, Math.min(92, slot.x + momentumShift));
              const py = slot.y;
              const ringCircumference = 2 * Math.PI * 2.25;
              const ringDash = `${(Math.max(10, stamina) / 100) * ringCircumference} ${ringCircumference}`;

              return (
                <g key={`home-player-${idx}`} filter="url(#playerShadow)" className="pitch-player-node pitch-player-home">
                  {/* Outer Stamina Ring */}
                  <circle
                    cx={px}
                    cy={py}
                    r="2.25"
                    fill="rgba(11, 11, 13, 0.75)"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="0.45"
                  />
                  <circle
                    cx={px}
                    cy={py}
                    r="2.25"
                    fill="none"
                    stroke={staminaColor(stamina)}
                    strokeWidth="0.5"
                    strokeDasharray={ringDash}
                    transform={`rotate(-90 ${px} ${py})`}
                  />
                  {/* Team Token */}
                  <circle
                    cx={px}
                    cy={py}
                    r="1.65"
                    fill={homeColor}
                    stroke="#ffffff"
                    strokeWidth="0.35"
                  />
                  <circle cx={px} cy={py} r="0.5" fill="#ffffff" />

                  {/* Yellow Card mini-badge */}
                  {isBooked && (
                    <rect
                      x={px + 1.5}
                      y={py - 2.6}
                      width="1.2"
                      height="1.65"
                      rx="0.2"
                      fill="#facc15"
                      stroke="#0b0b0d"
                      strokeWidth="0.2"
                    />
                  )}

                  {/* Surname & Rating Label */}
                  {player && (
                    <g pointerEvents="none">
                      <text
                        x={px}
                        y={py + 3.9}
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
                          x={px}
                          y={py + 5.4}
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
            {awayPlayers.map((slot, idx) => {
              const playerId = awayTactic?.lineup[idx]?.playerId;
              const player = playerId ? awaySquadById.get(playerId) : undefined;
              const stamina = player ? calculateInMatchStamina(player, currentMinute) : 85;
              const rating = player ? ratingsMap.get(player.id) : undefined;
              const isBooked = player ? awayBooked.has(player.id) : false;
              const px = idx === 0 ? slot.x : Math.max(8, Math.min(94, slot.x + momentumShift));
              const py = slot.y;
              const ringCircumference = 2 * Math.PI * 2.25;
              const ringDash = `${(Math.max(10, stamina) / 100) * ringCircumference} ${ringCircumference}`;

              return (
                <g key={`away-player-${idx}`} filter="url(#playerShadow)" className="pitch-player-node pitch-player-away">
                  <circle
                    cx={px}
                    cy={py}
                    r="2.25"
                    fill="rgba(11, 11, 13, 0.75)"
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="0.45"
                  />
                  <circle
                    cx={px}
                    cy={py}
                    r="2.25"
                    fill="none"
                    stroke={staminaColor(stamina)}
                    strokeWidth="0.5"
                    strokeDasharray={ringDash}
                    transform={`rotate(-90 ${px} ${py})`}
                  />
                  <circle
                    cx={px}
                    cy={py}
                    r="1.65"
                    fill={awayColor}
                    stroke="#ffffff"
                    strokeWidth="0.35"
                  />
                  <circle cx={px} cy={py} r="0.5" fill="#ffffff" />

                  {isBooked && (
                    <rect
                      x={px + 1.5}
                      y={py - 2.6}
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
                        x={px}
                        y={py + 3.9}
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
                          x={px}
                          y={py + 5.4}
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
            style={{
              transform: `translate(${ballPos.x}px, ${ballPos.y}px)`,
              transition: isPaused ? 'none' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
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
          {mySide === 'home' && <span className="pitch-you-tag">VOCÊ</span>}
        </div>
        <div className="pitch-possession-track">
          <div className="pitch-possession-bar home" style={{ width: `${momentum}%`, background: homeColor }} />
          <div className="pitch-possession-bar away" style={{ width: `${100 - momentum}%`, background: awayColor }} />
        </div>
        <div className="pitch-footer-team away" style={{ color: awayColor }}>
          {mySide === 'away' && <span className="pitch-you-tag">VOCÊ</span>}
          <span className="pitch-footer-name">{awayClub.name}</span>
        </div>
      </div>
    </div>
  );
};

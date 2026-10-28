import React, { useMemo } from 'react';
import type { Formation, MatchEvent, MatchSide, Tactic } from '@tactical-arena/shared';
import { useClubColor } from '../lib/useClubColor.js';

export interface PitchVisualizerProps {
  homeClub: { id: string; name: string; slug?: string | null };
  awayClub: { id: string; name: string; slug?: string | null };
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

  // Find most recent highlight event happening in the last 2 minutes
  const recentEvent = useMemo(() => {
    return [...events]
      .reverse()
      .find((e) => Math.abs(e.minute - currentMinute) <= 2);
  }, [events, currentMinute]);

  // Calculate ball coordinates
  const ballPos = useMemo(() => {
    if (recentEvent) {
      if (recentEvent.type === 'goal') {
        return recentEvent.team === 'home' ? { x: 96, y: 30 } : { x: 4, y: 30 };
      }
      if (recentEvent.shotOutcome === 'woodwork') {
        return recentEvent.team === 'home' ? { x: 93.5, y: 22 } : { x: 6.5, y: 38 };
      }
      if (recentEvent.shotOutcome === 'saved') {
        return recentEvent.team === 'home' ? { x: 92, y: 30 } : { x: 8, y: 30 };
      }
      if (recentEvent.isPenalty) {
        return recentEvent.team === 'home' ? { x: 88.5, y: 30 } : { x: 11.5, y: 30 };
      }
      if (recentEvent.type === 'card' || recentEvent.type === 'injury') {
        return recentEvent.team === 'home' ? { x: 55, y: 30 } : { x: 45, y: 30 };
      }
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

  return (
    <div className="pitch-visualizer-container" aria-label="Visualizador 2D do Campo de Futebol">
      {/* Dynamic Event Status Bar */}
      <div className={`pitch-action-header ${eventClass}`}>
        <div className="pitch-action-live-indicator">
          <span className={`pitch-live-dot ${isPaused ? 'paused' : 'live'}`} />
          <span className="pitch-action-minute">{currentMinute}'</span>
        </div>
        <div className="pitch-action-text">
          {recentEvent ? (
            <span className="pitch-event-headline">
              <strong>{recentEvent.team === 'home' ? homeClub.name : awayClub.name}:</strong> {recentEvent.description}
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
        <div className="pitch-score-badge">
          {homeGoals} x {awayGoals}
        </div>
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
          {/* Defs for turf patterns and shadows */}
          <defs>
            <linearGradient id="turfPattern" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#17502c" />
              <stop offset="20%" stopColor="#1a5831" />
              <stop offset="40%" stopColor="#17502c" />
              <stop offset="60%" stopColor="#1a5831" />
              <stop offset="80%" stopColor="#17502c" />
              <stop offset="100%" stopColor="#1a5831" />
            </linearGradient>
            <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#000" floodOpacity="0.6" />
              <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#fef08a" floodOpacity="0.8" />
            </filter>
            <filter id="playerShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0.6" stdDeviation="0.5" floodColor="#000" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Background Turf with stripes */}
          <rect x="0" y="0" width="100" height="60" fill="url(#turfPattern)" rx="3" />

          {/* 3 Territorial Zones (Defense, Midfield, Attack) */}
          <g className="pitch-territorial-zones" opacity="0.35">
            {/* Left Third (Home Defense / Away Attack) */}
            <rect
              x="2"
              y="2"
              width="32"
              height="56"
              fill={momentum < 45 ? awayColor : 'transparent'}
              className="pitch-zone-rect"
            />
            {/* Middle Third (Midfield Battle) */}
            <rect
              x="34"
              y="2"
              width="32"
              height="56"
              fill={Math.abs(momentum - 50) <= 10 ? '#38bdf8' : 'transparent'}
              className="pitch-zone-rect"
            />
            {/* Right Third (Home Attack / Away Defense) */}
            <rect
              x="66"
              y="2"
              width="32"
              height="56"
              fill={momentum > 55 ? homeColor : 'transparent'}
              className="pitch-zone-rect"
            />
          </g>

          {/* Field Markings */}
          <g stroke="rgba(255, 255, 255, 0.45)" strokeWidth="0.6" fill="none">
            {/* Outer boundary */}
            <rect x="2" y="2" width="96" height="56" rx="1" />

            {/* Halfway line */}
            <line x1="50" y1="2" x2="50" y2="58" />

            {/* Center Circle & Spot */}
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
            <rect x="0.5" y="24" width="1.5" height="12" stroke="#fff" strokeWidth="0.8" fill="rgba(255,255,255,0.15)" />
            <rect x="98" y="24" width="1.5" height="12" stroke="#fff" strokeWidth="0.8" fill="rgba(255,255,255,0.15)" />
          </g>

          {/* Zone Labels */}
          <g fill="rgba(255, 255, 255, 0.55)" fontSize="2.8" fontWeight="700" textAnchor="middle">
            <text x="18" y="55">Defesa</text>
            <text x="50" y="55">Meio</text>
            <text x="82" y="55">Ataque</text>
          </g>

          {/* Home Players */}
          <g className="pitch-home-team">
            {homePlayers.map((player, idx) => (
              <g key={`home-player-${idx}`} filter="url(#playerShadow)" className="pitch-player-node pitch-player-home">
                <circle
                  cx={player.x}
                  cy={player.y}
                  r="1.7"
                  fill={homeColor}
                  stroke="#ffffff"
                  strokeWidth="0.5"
                />
                <circle cx={player.x} cy={player.y} r="0.6" fill="#ffffff" />
              </g>
            ))}
          </g>

          {/* Away Players */}
          <g className="pitch-away-team">
            {awayPlayers.map((player, idx) => (
              <g key={`away-player-${idx}`} filter="url(#playerShadow)" className="pitch-player-node pitch-player-away">
                <circle
                  cx={player.x}
                  cy={player.y}
                  r="1.7"
                  fill={awayColor}
                  stroke="#ffffff"
                  strokeWidth="0.5"
                />
                <circle cx={player.x} cy={player.y} r="0.6" fill="#ffffff" />
              </g>
            ))}
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
            <circle cx="0" cy="0" r="1.3" fill="#ffffff" stroke="#1f2937" strokeWidth="0.3" />
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

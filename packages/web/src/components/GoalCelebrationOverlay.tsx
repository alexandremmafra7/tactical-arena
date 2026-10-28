import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Club, MatchEvent } from '@tactical-arena/shared';
import { ClubCrest } from './ClubCrest.js';
import { isBigChance, formatMatchEventMinute } from '@tactical-arena/shared';

interface GoalCelebrationOverlayProps {
  event: MatchEvent;
  club: Club;
  scoreline: string;
  isOpponent?: boolean;
  onDismiss?: () => void;
}

export function GoalCelebrationOverlay({ event, club, scoreline, isOpponent = false, onDismiss }: GoalCelebrationOverlayProps) {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; top: number; size: number; delay: number; color: string; anim: string }>>([]);

  useEffect(() => {
    // Generate energetic confetti and firework particles in team and gold tones (or red/dramatic for opponent)
    const colors = isOpponent
      ? ['#ef4444', '#dc2626', '#ffffff', '#f59e0b', '#f87171', '#94a3b8']
      : ['#d4af37', '#ffd700', '#ffffff', '#00ff88', '#ff4500', '#00e5ff', '#ff0055'];
    const newParticles = Array.from({ length: 36 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.floor(Math.random() * 10) + 6,
      delay: Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      anim: Math.random() > 0.5 ? 'float-up' : 'burst-out',
    }));
    setParticles(newParticles);

    // Auto-dismiss after celebration so the match automatically resumes without requiring a click
    const timer = setTimeout(() => {
      onDismiss?.();
    }, 3500);
    return () => clearTimeout(timer);
  }, [onDismiss, isOpponent]);

  const isPenalty = !!event.isPenalty;
  const isRebound = !!event.isRebound;
  const xgVal = event.xg ?? 0;
  const bigChance = isBigChance(xgVal);

  // Portalled to <body>. Unlike every other overlay in the app this one is mounted inside a content
  // container (`.match-banner` in LiveMatch) rather than at the page root, and a position:fixed
  // element only resolves against the viewport while no ancestor creates a containing block. Nothing
  // on that chain does today, but a single `transform` or `filter` added to the banner later would
  // silently shrink this celebration to the banner's box. The portal takes the chain out of play.
  const content = (
    <div className="goal-overlay-backdrop" onClick={onDismiss} role="dialog" aria-label={isOpponent ? 'Gol Adversário' : 'Comemoração de Gol'}>
      {/* Particle & Confetti Rain Field */}
      <div className="goal-overlay-particles">
        {particles.map((p) => (
          <span
            key={p.id}
            className={`goal-confetti-particle ${p.anim}`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size * (p.id % 2 === 0 ? 1.8 : 1)}px`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Radiant Shockwave Rings */}
      <div className="goal-shockwave-ring ring-1" />
      <div className="goal-shockwave-ring ring-2" />
      <div className="goal-shockwave-ring ring-3" />

      {/* Main Celebration Billboard */}
      <div className={`goal-overlay-card ${isOpponent ? 'opponent' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="goal-overlay-header">
          <span className={`goal-overlay-badge ${isOpponent ? 'opponent-badge' : ''}`}>
            {isOpponent
              ? isPenalty
                ? 'PÊNALTI SOFRIDO'
                : isRebound
                  ? 'GOL SOFRIDO NO REBOTE'
                  : 'GOL ADVERSÁRIO'
              : isPenalty
                ? 'PÊNALTI CONVERTIDO!'
                : isRebound
                  ? 'GOL NO REBOTE!'
                  : 'GOLAÇO!'}
          </span>
          <span className="goal-overlay-scoreline">{scoreline}</span>
        </div>

        {/* Explosive Big Typography */}
        <div className="goal-shout-container">
          <h1 className={`goal-shout-title ${isOpponent ? 'opponent-title' : ''}`}>
            {isOpponent ? 'GOL ADVERSÁRIO' : 'GOOOOOOL!'}
          </h1>
          <div className="goal-equalizer-bars">
            <span className="bar bar-1" />
            <span className="bar bar-2" />
            <span className="bar bar-3" />
            <span className="bar bar-4" />
            <span className="bar bar-5" />
            <span className="bar bar-6" />
            <span className="bar bar-5" />
            <span className="bar bar-4" />
            <span className="bar bar-3" />
            <span className="bar bar-2" />
            <span className="bar bar-1" />
          </div>
        </div>

        {/* Club Crest and Spotlight Information */}
        <div className="goal-spotlight-hero">
          <div className="goal-crest-wrapper">
            <div className="goal-crest-halo" />
            <ClubCrest club={club} size={84} />
          </div>

          <div className="goal-hero-details">
            <h2 className="goal-team-name">{club.name}</h2>
            <div className="goal-event-headline">
              <span className="goal-minute-pill">⏱️ {formatMatchEventMinute(event)}</span>
              {xgVal > 0 && (
                <span className={`goal-xg-pill ${bigChance ? 'big-chance' : ''}`}>
                  xG {xgVal.toFixed(2)} {bigChance ? '• Grande Chance' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Narrative Description */}
        <p className="goal-narrative-text">"{event.description}"</p>

        {/* Dismiss hint */}
        <button className="goal-overlay-close-btn" onClick={onDismiss} type="button">
          Continuar partida
        </button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
}

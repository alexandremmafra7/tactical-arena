import type React from 'react';
import type { PlayerTier } from '@tactical-arena/shared';
import { PLAYER_TIER_LABEL, PLAYER_TIER_DESCRIPTION } from '@tactical-arena/shared';

export interface SpecialPlayerIconProps {
  tier: PlayerTier;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  showGlow?: boolean;
  title?: string;
}

const SIZE_MAP: Record<string, number> = {
  xs: 11,
  sm: 14,
  md: 20,
  lg: 38,
  xl: 64,
};

/**
 * High-fidelity 3D faceted gold icon matching the "Gênio / Extraclasse" tier.
 */
export function GenioStarIcon({
  size = 24,
  className = '',
  showGlow = true,
}: {
  size?: number;
  className?: string;
  showGlow?: boolean;
}) {
  return (
    <img
      src="/icons/genio.png"
      alt="Gênio / Extraclasse"
      width={size}
      height={size}
      className={`special-player-icon genio-star-icon ${className}`}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: showGlow
          ? 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.7)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))'
          : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}

/**
 * High-fidelity Neon icon matching "Baita Jogador / Diferenciado".
 */
export function BaitaChevronIcon({
  size = 24,
  className = '',
  showGlow = true,
}: {
  size?: number;
  className?: string;
  showGlow?: boolean;
}) {
  return (
    <img
      src="/icons/diferenciado-v2.png"
      alt="Baita Jogador / Diferenciado"
      width={size}
      height={size}
      className={`special-player-icon baita-chevron-icon ${className}`}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: showGlow
          ? 'drop-shadow(0 0 6px rgba(0, 229, 255, 0.7)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))'
          : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}

/**
 * High-fidelity icon matching "Promessa Sub-20 / Joia da Base".
 */
export function PromessaSub20Icon({
  size = 24,
  className = '',
  showGlow = true,
}: {
  size?: number;
  className?: string;
  showGlow?: boolean;
}) {
  return (
    <img
      src="/icons/promessa-sub20-v2.png"
      alt="Promessa Sub-20"
      width={size}
      height={size}
      className={`special-player-icon promessa-sub20-icon ${className}`}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: showGlow
          ? 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.7)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))'
          : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}

/**
 * Universal component to render Genio Star, Baita Double Chevron, or Promessa Sub-20 icon.
 */
export function SpecialPlayerIcon({
  tier,
  size = 'md',
  className = '',
  showGlow = true,
  title,
}: SpecialPlayerIconProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] ?? 20;
  const defaultTitle = `${PLAYER_TIER_LABEL[tier]} • ${PLAYER_TIER_DESCRIPTION[tier]}`;

  return (
    <span
      className={`special-player-icon-wrapper tier-${tier.toLowerCase()} ${className}`}
      title={title ?? defaultTitle}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {tier === 'GENIO' ? (
        <GenioStarIcon size={pixelSize} showGlow={showGlow} />
      ) : tier === 'PROMESSA' ? (
        <PromessaSub20Icon size={pixelSize} showGlow={showGlow} />
      ) : (
        <BaitaChevronIcon size={pixelSize} showGlow={showGlow} />
      )}
    </span>
  );
}

/**
 * Badge with icon and text label for tables, cards, and profile screens.
 */
export function SpecialPlayerBadge({
  tier,
  size = 'sm',
  showLabel = true,
  className = '',
}: {
  tier: PlayerTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}) {
  const label = PLAYER_TIER_LABEL[tier];
  const desc = PLAYER_TIER_DESCRIPTION[tier];
  const tierClass = tier === 'GENIO' ? 'tier-badge-genio' : tier === 'PROMESSA' ? 'tier-badge-promessa' : 'tier-badge-baita';

  return (
    <span
      className={`player-tier-badge ${tierClass} size-${size} ${className}`}
      title={`${label}: ${desc}`}
    >
      <SpecialPlayerIcon tier={tier} size={size === 'lg' ? 'md' : 'sm'} />
      {showLabel && <span className="tier-badge-text">{label}</span>}
    </span>
  );
}

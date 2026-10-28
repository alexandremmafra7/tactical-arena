import { useState, type CSSProperties } from 'react';
import type { KitPattern } from '@tactical-arena/shared';
import { ModernJersey2D } from './ModernJersey2D.js';

export interface TeamJerseyProps {
  clubSlug?: string | null;
  kitColor?: string | null;
  kitPattern?: KitPattern | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  isKeeper?: boolean;
  isAway?: boolean;
  awayPrimaryColor?: string | null;
  awaySecondaryColor?: string | null;
  awayKitPattern?: KitPattern | null;
  className?: string;
  size?: number;
  style?: CSSProperties;
}

export function buildKitBackground(
  kitPattern?: KitPattern | null,
  primaryColor?: string | null,
  secondaryColor?: string | null,
  fallbackColor?: string | null,
): string {
  const primary = primaryColor || fallbackColor || '#1e293b';
  const secondary = secondaryColor || '#ffffff';

  switch (kitPattern) {
    case 'STRIPES_VERTICAL':
      return `repeating-linear-gradient(90deg, ${primary}, ${primary} 5px, ${secondary} 5px, ${secondary} 10px)`;
    case 'STRIPES_HORIZONTAL':
      return `repeating-linear-gradient(0deg, ${primary}, ${primary} 5px, ${secondary} 5px, ${secondary} 10px)`;
    case 'DIAGONAL_SASH':
      return `linear-gradient(135deg, ${primary} 0%, ${primary} 38%, ${secondary} 38%, ${secondary} 62%, ${primary} 62%, ${primary} 100%)`;
    case 'HALVES':
      return `linear-gradient(90deg, ${primary} 50%, ${secondary} 50%)`;
    case 'GRADIENT':
      return `linear-gradient(180deg, ${primary} 0%, ${secondary} 100%)`;
    case 'SOLID':
    default:
      return primary;
  }
}

/**
 * Renderiza o uniforme do clube:
 * - Se houver PNG oficial da camisa real em /jerseys/{slug}.png, exibe a arte real com object-fit contain.
 * - Caso contrário (clubes criados, genéricos ou sem PNG pré-existente), renderiza
 *   a nova camiseta 2D atlética de alta definição (ModernJersey2D).
 */
export function TeamJersey({
  clubSlug,
  kitColor,
  kitPattern,
  primaryColor,
  secondaryColor,
  isKeeper = false,
  isAway = false,
  className = 'pitch-slot-jersey',
  size,
  style,
}: TeamJerseyProps) {
  const [imgError, setImgError] = useState(false);
  const src = !imgError && clubSlug && !isKeeper ? `/jerseys/${clubSlug}${isAway ? '_away' : ''}.png` : null;

  const combinedStyle: CSSProperties = {
    width: size ? `${size}px` : '100%',
    height: size ? `${size}px` : '100%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  if (src) {
    return (
      <span
        className={`${className} has-real-jersey`}
        style={combinedStyle}
        aria-hidden="true"
      >
        <img
          src={src}
          alt=""
          className="jersey-art-img"
          onError={() => setImgError(true)}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            imageRendering: 'auto',
            display: 'block',
          }}
        />
      </span>
    );
  }

  // Renderiza a nova camiseta 2D de qualidade profissional
  const effectivePrimary = isKeeper ? '#facc15' : primaryColor || kitColor || '#1e293b';
  const effectiveSecondary = isKeeper ? '#0f172a' : secondaryColor || '#ffffff';
  const effectivePattern = isKeeper ? 'SOLID' : kitPattern || 'SOLID';

  return (
    <span className={className} style={combinedStyle} aria-hidden="true">
      <ModernJersey2D
        primaryColor={effectivePrimary}
        secondaryColor={effectiveSecondary}
        kitPattern={effectivePattern}
        size={size || '100%'}
        isAway={isAway}
        showBrand={false}
        showMasterSponsor={false}
        showOptionalSponsor={false}
      />
    </span>
  );
}

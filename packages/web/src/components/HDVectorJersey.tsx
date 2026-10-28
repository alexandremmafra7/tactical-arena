import type { Club, KitPattern } from '@tactical-arena/shared';
import { ModernJersey2D } from './ModernJersey2D.js';

export interface HDVectorJerseyProps {
  club: Club;
  isAway?: boolean;
  awayPrimaryColor?: string | null;
  awaySecondaryColor?: string | null;
  awayKitPattern?: KitPattern | null;
  size?: number | string;
  className?: string;
  masterSponsorName?: string | null;
  supplierSponsorName?: string | null;
  optionalSponsorName?: string | null;
  showOptionalSponsor?: boolean;
}

/**
 * HDVectorJersey agora é alimentado pelo motor ModernJersey2D profissional,
 * preservando total retrocompatibilidade de API.
 */
export function HDVectorJersey({
  club,
  isAway = false,
  size = 160,
  className = '',
  masterSponsorName,
  supplierSponsorName,
  optionalSponsorName,
  showOptionalSponsor,
}: HDVectorJerseyProps) {
  // Encontra patrocinador opcional caso não tenha sido passado explicitamente
  const regionalSponsor = optionalSponsorName ?? club.sponsorships?.find((s) => s.type === 'REGIONAL')?.sponsorName;

  return (
    <ModernJersey2D
      club={club}
      primaryColor={club.primaryColor}
      secondaryColor={club.secondaryColor}
      kitPattern={club.kitPattern}
      size={size}
      className={`hd-vector-jersey-container ${className}`}
      isAway={isAway}
      supplierName={supplierSponsorName}
      masterSponsorName={masterSponsorName}
      optionalSponsorName={regionalSponsor}
      showOptionalSponsor={showOptionalSponsor ?? Boolean(regionalSponsor)}
    />
  );
}

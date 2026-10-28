import { useState } from 'react';
import type { SponsorshipType } from '@tactical-arena/shared';
import { getSponsorLogoUrl } from '@tactical-arena/shared';
import { SponsorLogo } from './SponsorLogo.js';

interface SponsorArtProps {
  sponsorName: string;
  type: SponsorshipType;
}

/** A real sponsor banner if the content pipeline provided one (`/sponsors/<category>/<slug>.webp`) for this name,
 *  otherwise the small procedural badge — same fallback pattern as ClubCrest for club crests. The real
 *  banners already bake in the sponsor name and type, so they render full-width instead of alongside text. */
export function SponsorArt({ sponsorName, type }: SponsorArtProps) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!imageFailed) {
    return (
      <img
        className="sponsor-banner"
        src={getSponsorLogoUrl(sponsorName, type)}
        alt={sponsorName}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return <SponsorLogo sponsorName={sponsorName} type={type} />;
}


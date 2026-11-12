import { useState } from 'react';
import { getClubCrestTheme } from '@tactical-arena/shared';
import { crestUrl } from '../api/client.js';

interface ClubCrestProps {
  club: {
    id: string;
    name: string;
    slug?: string | null;
    crestBase64?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
  };
  size?: number;
}

const CREST_SLUG_ALIASES: Record<string, string> = {
  'red-bull-bragantino': 'rb-bragantino',
  'mirassol-futebol-clube-sp': 'mirassol',
  'inter-miami-cf': 'inter-miami',
  'red-bull-salzburg': 'salzburg_aut',
  'zenit-st-petersburg': 'zenit_rus',
  'stade-brest-29': 'brest',
  'fc-stade-rennes': 'rennes',
  'new-york-red-bulls': 'nyredbulls_eua',
  'club-atletico-union': 'union_arg',
  'fortuna-sittard': 'fortuna_hol',
  'sk-rapid-wien': 'austria-wien-aut',
  'fk-austria-wien': 'austria-wien-aut',
  'spartak-moskau': 'spartak_rus',
  'viking-stavanger': 'viking_nor',
  'lokomotiv-moskau': 'lokomotiv_rus',
};

/** A real crest image if available, a base64 custom crest, or a procedurally generated shield matching club colors. */
export function ClubCrest({ club, size = 22 }: ClubCrestProps) {
  const rawSlug =
    club.slug ||
    (club.name
      ? club.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
      : null) ||
    club.id;

  const effectiveSlug = rawSlug ? (CREST_SLUG_ALIASES[rawSlug] ?? rawSlug) : null;

  const [imageFailed, setImageFailed] = useState(false);
  const [prevSlug, setPrevSlug] = useState<string | null>(effectiveSlug);

  // Reset error state when the club/slug changes across matches or ticker rows
  if (effectiveSlug !== prevSlug) {
    setPrevSlug(effectiveSlug);
    setImageFailed(false);
  }

  if (club.crestBase64) {
    const src = club.crestBase64.startsWith('data:')
      ? club.crestBase64
      : `data:image/png;base64,${club.crestBase64}`;
    return (
      <img
        className="crest"
        src={src}
        alt={club.name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', borderRadius: 4 }}
      />
    );
  }

  if (effectiveSlug && !imageFailed) {
    return (
      <img
        className="crest"
        src={crestUrl(effectiveSlug)}
        alt={club.name}
        width={size}
        height={size}
        style={{ objectFit: 'contain', borderRadius: 4 }}
        onError={() => setImageFailed(true)}
      />
    );
  }

  const { hue, initials } = getClubCrestTheme(club);
  const light = club.primaryColor || `hsl(${hue}, 70%, 55%)`;
  const dark = club.secondaryColor || `hsl(${hue}, 65%, 32%)`;
  const gradientId = `crest-grad-${club.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return (
    <svg
      className="crest"
      width={size}
      height={size}
      viewBox="0 0 32 36"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={club.name}
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>
      <path
        d="M16 1 L30 6 V17 C30 27 24 33 16 35 C8 33 2 27 2 17 V6 Z"
        fill={`url(#${gradientId})`}
        stroke="#ffffff55"
        strokeWidth="1"
      />
      <text x="16" y="21" textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff" fontFamily="inherit">
        {initials}
      </text>
    </svg>
  );
}

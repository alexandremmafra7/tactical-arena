import type { SponsorshipType } from '@tactical-arena/shared';
import { getSponsorLogoTheme } from '@tactical-arena/shared';

interface SponsorLogoProps {
  sponsorName: string;
  type: SponsorshipType;
  size?: number;
}

/** Procedurally generated sponsor badge — same name+type always renders the same look, no image assets
 *  needed. Each of the 5 sponsorship types gets its own shape, so the finance panel reads at a glance
 *  even before the label is legible. */
export function SponsorLogo({ sponsorName, type, size = 40 }: SponsorLogoProps) {
  const { hue, initials, shape } = getSponsorLogoTheme(sponsorName, type);
  const light = `hsl(${hue}, 70%, 55%)`;
  const dark = `hsl(${hue}, 65%, 30%)`;
  const gradientId = `sponsor-grad-${hue}-${shape}-${initials}`;

  return (
    <svg
      className="sponsor-logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={sponsorName}
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>
      {shape === 'circle' && <circle cx="16" cy="16" r="14.5" fill={`url(#${gradientId})`} stroke="#ffffff55" strokeWidth="1" />}
      {shape === 'shield' && (
        <path
          d="M16 1 L29 5.5 V15 C29 23.5 23.5 28.5 16 31 C8.5 28.5 3 23.5 3 15 V5.5 Z"
          fill={`url(#${gradientId})`}
          stroke="#ffffff55"
          strokeWidth="1"
        />
      )}
      {shape === 'hexagon' && (
        <path d="M16 1 L29 8.5 V23.5 L16 31 L3 23.5 V8.5 Z" fill={`url(#${gradientId})`} stroke="#ffffff55" strokeWidth="1" />
      )}
      {shape === 'diamond' && (
        <rect x="6" y="6" width="20" height="20" rx="3" fill={`url(#${gradientId})`} stroke="#ffffff55" strokeWidth="1" transform="rotate(45 16 16)" />
      )}
      {shape === 'roundedSquare' && (
        <rect x="2" y="2" width="28" height="28" rx="8" fill={`url(#${gradientId})`} stroke="#ffffff55" strokeWidth="1" />
      )}
      <text x="16" y="21" textAnchor="middle" fontSize="12" fontWeight="700" fill="#ffffff" fontFamily="inherit">
        {initials}
      </text>
    </svg>
  );
}

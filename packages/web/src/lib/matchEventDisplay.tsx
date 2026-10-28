import React from 'react';
import type { MatchEvent } from '@tactical-arena/shared';

/** Icon for a match event — shared by the live match's banner/Lances feed and the post-match replay,
 *  rendered with clean vector SVGs instead of emojis. */
export function eventIcon(event: MatchEvent): React.ReactNode {
  const size = 15;
  const style: React.CSSProperties = {
    verticalAlign: 'middle',
    display: 'inline-block',
    marginRight: 4,
    flexShrink: 0,
  };

  if (event.type === 'goal') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    );
  }

  if (event.type === 'substitution') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
        aria-hidden="true"
      >
        <path d="M16 3l4 4-4 4" />
        <path d="M20 7H4" />
        <path d="M8 21l-4-4 4-4" />
        <path d="M4 17h16" />
      </svg>
    );
  }

  if (event.type === 'card') {
    const isRed = !!event.suspensionMatches;
    return (
      <svg
        width={size - 3}
        height={size + 1}
        viewBox="0 0 12 16"
        fill={isRed ? '#ef4444' : '#eab308'}
        stroke={isRed ? '#b91c1c' : '#ca8a04'}
        strokeWidth="1"
        style={style}
        aria-hidden="true"
      >
        <rect x="0.5" y="0.5" width="11" height="15" rx="2" />
      </svg>
    );
  }

  if (event.type === 'injury') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ef4444"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="4" fill="#fee2e2" />
        <path d="M12 8v8M8 12h8" stroke="#ef4444" />
      </svg>
    );
  }

  if (event.type === 'chance' && event.isPenalty) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="22" y1="12" x2="18" y2="12" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="12" y1="22" x2="12" y2="18" />
      </svg>
    );
  }

  if (event.type === 'chance') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }

  if ((event.type as string) === 'tactical_adjustment') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#a855f7"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
        aria-hidden="true"
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6M9 13h6M9 17h3" />
      </svg>
    );
  }

  return <span style={{ marginRight: 4 }}>•</span>;
}

/** Which color treatment a lance chip gets — a yellow and a red card read very differently, so 'card'
 *  alone isn't specific enough (unlike `eventIcon`, which already branches on `suspensionMatches`). */
export function eventVariant(event: MatchEvent): string {
  if (event.type === 'card') return event.suspensionMatches ? 'card-red' : 'card-yellow';
  if ((event.type as string) === 'tactical_adjustment') return 'tactical-adjustment';
  return event.type;
}

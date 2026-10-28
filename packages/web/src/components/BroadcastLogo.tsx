import React from 'react';
import { BroadcasterLogoKey, ALL_BROADCASTER_CHANNELS } from '@tactical-arena/shared';

interface BroadcastLogoProps {
  logoKey?: BroadcasterLogoKey | string;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  className?: string;
}

export function BroadcastLogo({
  logoKey = 'omnisports',
  size = 'md',
  showBadge = true,
  className = '',
}: BroadcastLogoProps) {
  const channel = ALL_BROADCASTER_CHANNELS[logoKey as BroadcasterLogoKey] ?? ALL_BROADCASTER_CHANNELS.omnisports;

  const height = size === 'sm' ? 22 : size === 'lg' ? 36 : 28;

  function renderVectorIcon() {
    switch (logoKey) {
      case 'omnisports':
        return (
          <svg viewBox="0 0 32 32" width={height} height={height} className="broadcast-svg-icon" aria-hidden="true">
            <defs>
              <linearGradient id="omni-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F0FF" />
                <stop offset="100%" stopColor="#0066FF" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="14" fill="url(#omni-grad)" />
            <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="#FFFFFF" strokeWidth="1.8" transform="rotate(-25 16 16)" />
            <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="#FFFFFF" strokeWidth="1.8" transform="rotate(35 16 16)" />
            <circle cx="16" cy="16" r="4.5" fill="#FFFFFF" />
            <circle cx="16" cy="16" r="2.5" fill="#0066FF" />
          </svg>
        );

      case 'aura_tv':
        return (
          <svg viewBox="0 0 32 32" width={height} height={height} className="broadcast-svg-icon" aria-hidden="true">
            <defs>
              <linearGradient id="aura-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFD200" />
                <stop offset="100%" stopColor="#FF7A00" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#aura-grad)" />
            <path d="M16 6 L19 13 L26 16 L19 19 L16 26 L13 19 L6 16 L13 13 Z" fill="#111118" />
            <circle cx="16" cy="16" r="3" fill="#FFD200" />
          </svg>
        );

      case 'skyline_sports':
        return (
          <svg viewBox="0 0 32 32" width={height} height={height} className="broadcast-svg-icon" aria-hidden="true">
            <defs>
              <linearGradient id="sky-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF1E40" />
                <stop offset="100%" stopColor="#B3001E" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="6" fill="#0A1931" stroke="#FF1E40" strokeWidth="1.5" />
            <path d="M5 24 L10 17 L15 21 L22 10 L27 24 Z" fill="url(#sky-grad)" />
            <circle cx="22" cy="8" r="2.5" fill="#FFD200" />
          </svg>
        );

      case 'novaplay':
        return (
          <svg viewBox="0 0 32 32" width={height} height={height} className="broadcast-svg-icon" aria-hidden="true">
            <defs>
              <linearGradient id="nova-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EC4899" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="8" fill="#181126" stroke="#8B5CF6" strokeWidth="1.5" />
            <polygon points="12,9 23,16 12,23" fill="url(#nova-grad)" />
            <circle cx="24" cy="9" r="2" fill="#00F0FF" />
          </svg>
        );

      case 'vertex_arena':
        return (
          <svg viewBox="0 0 32 32" width={height} height={height} className="broadcast-svg-icon" aria-hidden="true">
            <defs>
              <linearGradient id="vertex-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="6" fill="#0B1510" stroke="#10B981" strokeWidth="1.5" />
            <polygon points="16,5 27,24 5,24" fill="none" stroke="url(#vertex-grad)" strokeWidth="2.5" strokeLinejoin="round" />
            <polygon points="16,11 22,22 10,22" fill="url(#vertex-grad)" />
          </svg>
        );

      case 'zenith_premiere':
        return (
          <svg viewBox="0 0 32 32" width={height} height={height} className="broadcast-svg-icon" aria-hidden="true">
            <defs>
              <linearGradient id="zenith-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="14" fill="#0F172A" stroke="url(#zenith-grad)" strokeWidth="2" />
            <path d="M9 20 L11 12 L16 16 L21 12 L23 20 Z" fill="url(#zenith-grad)" />
            <circle cx="16" cy="10" r="1.8" fill="#FFFFFF" />
          </svg>
        );

      case 'pulse_live':
      default:
        return (
          <svg viewBox="0 0 32 32" width={height} height={height} className="broadcast-svg-icon" aria-hidden="true">
            <defs>
              <linearGradient id="pulse-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF4D4D" />
                <stop offset="100%" stopColor="#B91C1C" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="6" fill="#1F0E11" stroke="#EF4444" strokeWidth="1.5" />
            <path
              d="M5 16 L10 16 L13 9 L17 23 L20 13 L23 16 L27 16"
              fill="none"
              stroke="url(#pulse-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
    }
  }

  return (
    <div
      className={`broadcast-badge-root broadcast-size-${size} ${className}`}
      style={
        {
          '--broadcast-brand': channel.brandColor,
          '--broadcast-accent': channel.accentColor,
          '--broadcast-text': channel.textColor,
        } as React.CSSProperties
      }
      title={`${channel.name} • ${channel.slogan} (${channel.conglomerateName})`}
    >
      <div className="broadcast-logo-wrapper">{renderVectorIcon()}</div>
      <div className="broadcast-info-wrapper">
        <span className="broadcast-channel-name">{channel.shortName}</span>
        {showBadge && <span className="broadcast-live-pill">{channel.badgeLabel}</span>}
      </div>
    </div>
  );
}

/**
 * High-definition Scorebug Watermark overlaid during live matches (similar to real TV broadcasts).
 */
export function LiveBroadcastWatermark({ logoKey }: { logoKey?: BroadcasterLogoKey | string }) {
  const channel = ALL_BROADCASTER_CHANNELS[logoKey as BroadcasterLogoKey] ?? ALL_BROADCASTER_CHANNELS.omnisports;

  return (
    <div className="live-broadcast-watermark" title={`Transmissão Oficial: ${channel.name} (${channel.conglomerateName})`}>
      <BroadcastLogo logoKey={channel.logoKey} size="sm" showBadge={false} />
      <span className="broadcast-watermark-divider">|</span>
      <span className="broadcast-watermark-live-dot" />
      <span className="broadcast-watermark-live-text">{channel.badgeLabel.split('•')[0].trim()}</span>
    </div>
  );
}

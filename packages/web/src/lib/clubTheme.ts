import type { CSSProperties } from 'react';
import { getClubCrestTheme } from '@tactical-arena/shared';

interface ClubLike {
  id: string;
  name: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

/**
 * Calculates relative luminance according to WCAG 2.1 specifications.
 * Helps determine whether white or black text gives the highest contrast.
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Converts HSL values to RGB (0-255).
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Converts a hex string, rgb(), or hsl() color into RGB numbers.
 */
function parseColorToRgb(color: string): { r: number; g: number; b: number } {
  const clean = color.trim();

  const hexMatch = clean.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }

  const shortHex = clean.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
  if (shortHex) {
    return {
      r: parseInt(shortHex[1] + shortHex[1], 16),
      g: parseInt(shortHex[2] + shortHex[2], 16),
      b: parseInt(shortHex[3] + shortHex[3], 16),
    };
  }

  const rgbMatch = clean.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10))),
      g: Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10))),
      b: Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10))),
    };
  }

  const hslMatch = clean.match(/^hsla?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%?\s*,\s*(\d+(?:\.\d+)?)%?/i);
  if (hslMatch) {
    return hslToRgb(
      parseFloat(hslMatch[1]),
      parseFloat(hslMatch[2]),
      parseFloat(hslMatch[3]),
    );
  }

  // Fallback safe default (golden / amber)
  return { r: 212, g: 175, b: 55 };
}

/**
 * Resolves the primary, secondary, and contrast colors for a given club.
 */
export function getClubColors(club: ClubLike) {
  const { hue } = getClubCrestTheme(club);
  const primary = club.primaryColor || `hsl(${hue}, 75%, 48%)`;
  const secondary = club.secondaryColor || `hsl(${hue}, 65%, 30%)`;

  const rgb = parseColorToRgb(primary);
  const lum = getLuminance(rgb.r, rgb.g, rgb.b);

  // Determine contrast text for when this color is used as a background
  const contrast = lum > 0.45 ? '#0b0b0d' : '#ffffff';

  // For text and accents on dark backgrounds (--bg: #0b0b0d, luminance ~0.003),
  // WCAG AA requires at least 4.5:1 ratio (luminance >= 0.19). For high legibility,
  // we target luminance >= 0.30. If the color is too dark, lighten it by blending with white
  // while preserving the club's distinctive hue.
  let readableRgb = { ...rgb };
  let readableLum = lum;

  if (readableLum < 0.28) {
    for (let factor = 0.45; factor <= 0.88; factor += 0.05) {
      const r = Math.round(rgb.r + (255 - rgb.r) * factor);
      const g = Math.round(rgb.g + (255 - rgb.g) * factor);
      const b = Math.round(rgb.b + (255 - rgb.b) * factor);
      readableRgb = { r, g, b };
      readableLum = getLuminance(r, g, b);
      if (readableLum >= 0.32) {
        break;
      }
    }
  }

  const readable = `#${[readableRgb.r, readableRgb.g, readableRgb.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;

  return {
    primary,
    secondary,
    contrast,
    readable,
    glow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`,
    borderGlow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`,
  };
}

/**
 * Returns a React CSSProperties object that overrides global accent variables
 * with the club's specific primary identity.
 * Always ensures --accent is readable on dark UI surfaces.
 */
export function getClubThemeStyle(club: ClubLike | null | undefined): CSSProperties {
  if (!club) return {};

  const colors = getClubColors(club);

  return {
    '--accent': colors.readable,
    '--accent-contrast': colors.contrast,
    '--club-primary': colors.primary,
    '--club-secondary': colors.secondary,
    '--club-readable': colors.readable,
    '--club-glow': colors.glow,
    '--club-border-glow': colors.borderGlow,
  } as CSSProperties;
}

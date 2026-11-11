import type { Club } from './club.js';
import { resolveClubKit } from './clubKits.js';

export interface ClubTingimentoColors {
  primaryColor: string;
  secondaryColor: string;
  darkColor: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return '#' + [r, g, b].map(x => clamp(x).toString(16).padStart(2, '0')).join('');
}

function darkenHex(hex: string, percent: number): string {
  try {
    const { r, g, b } = hexToRgb(hex);
    const factor = 1 - percent / 100;
    return rgbToHex(r * factor, g * factor, b * factor);
  } catch {
    return '#090d16';
  }
}

export function getClubTingimentoColors(club?: Partial<Club> | null): ClubTingimentoColors {
  const defaultPrimary = '#1e3a8a'; // Blue royal
  const defaultSecondary = '#ffffff';

  if (!club) {
    return {
      primaryColor: defaultPrimary,
      secondaryColor: defaultSecondary,
      darkColor: darkenHex(defaultPrimary, 30),
    };
  }

  const resolved = resolveClubKit(club as any);
  const finalPrimary = resolved.primaryColor;
  const finalSecondary = resolved.secondaryColor;
  const darkColor = darkenHex(finalPrimary, 35);

  return {
    primaryColor: finalPrimary,
    secondaryColor: finalSecondary,
    darkColor,
  };
}

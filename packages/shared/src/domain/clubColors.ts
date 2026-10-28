import type { Club } from './club.js';

export interface ClubTingimentoColors {
  primaryColor: string;
  secondaryColor: string;
  darkColor: string;
}

const CLUB_COLOR_OVERRIDES: Record<string, { primaryColor: string; secondaryColor: string }> = {
  flamengo: {
    primaryColor: '#e11d48',
    secondaryColor: '#000000',
  },
  palmeiras: {
    primaryColor: '#047857',
    secondaryColor: '#ffffff',
  },
  sao_paulo: {
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
  },
  corinthians: {
    primaryColor: '#18181b',
    secondaryColor: '#ffffff',
  },
};

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

  let primary = club.primaryColor;
  let secondary = club.secondaryColor;

  const slugKey = club.slug?.toLowerCase();
  const nameKey = club.name?.toLowerCase().replace(/\s+/g, '_');

  if (slugKey && CLUB_COLOR_OVERRIDES[slugKey]) {
    primary = primary || CLUB_COLOR_OVERRIDES[slugKey].primaryColor;
    secondary = secondary || CLUB_COLOR_OVERRIDES[slugKey].secondaryColor;
  } else if (nameKey && CLUB_COLOR_OVERRIDES[nameKey]) {
    primary = primary || CLUB_COLOR_OVERRIDES[nameKey].primaryColor;
    secondary = secondary || CLUB_COLOR_OVERRIDES[nameKey].secondaryColor;
  }

  const finalPrimary = primary && primary.startsWith('#') ? primary : defaultPrimary;
  const finalSecondary = secondary && secondary.startsWith('#') ? secondary : defaultSecondary;
  const darkColor = darkenHex(finalPrimary, 35);

  return {
    primaryColor: finalPrimary,
    secondaryColor: finalSecondary,
    darkColor,
  };
}

export const KIT_CLASH_THRESHOLD = 50;

export interface Kit {
  primary: string;
  secondary: string | null;
}

export interface TeamKit {
  fill: string;
  trim: string;
  gk: string;
  awayUsedFallback?: 'secondary' | 'contrast';
}

export interface MatchKits {
  home: TeamKit;
  away: TeamKit;
}

export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r, g, b];
}

function fLab(t: number): number {
  const delta = 6 / 29;
  if (t > delta * delta * delta) {
    return Math.cbrt(t);
  }
  return (t / (3 * delta * delta)) + (4 / 29);
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rf = r / 255;
  let gf = g / 255;
  let bf = b / 255;

  rf = rf > 0.04045 ? Math.pow((rf + 0.055) / 1.055, 2.4) : rf / 12.92;
  gf = gf > 0.04045 ? Math.pow((gf + 0.055) / 1.055, 2.4) : gf / 12.92;
  bf = bf > 0.04045 ? Math.pow((bf + 0.055) / 1.055, 2.4) : bf / 12.92;

  const x = rf * 0.4124564 + gf * 0.3575761 + bf * 0.1804375;
  const y = rf * 0.2126729 + gf * 0.7151522 + bf * 0.0721750;
  const z = rf * 0.0193339 + gf * 0.1191920 + bf * 0.9503041;

  const xn = 95.047;
  const yn = 100.000;
  const zn = 108.883;

  const fx = fLab((x * 100) / xn);
  const fy = fLab((y * 100) / yn);
  const fz = fLab((z * 100) / zn);

  const l = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b_val = 200 * (fy - fz);
  return [l, a, b_val];
}

export function deltaE(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const lab1 = rgbToLab(...rgb1);
  const lab2 = rgbToLab(...rgb2);

  const dl = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}

function resolveTrim(fill: string, secondary: string | null, originalPrimary?: string, usedFallback?: boolean): string {
  if (secondary && deltaE(secondary, fill) >= 15) {
    return secondary;
  }
  if (usedFallback && originalPrimary && deltaE(originalPrimary, fill) >= 15) {
    return originalPrimary;
  }
  const l = rgbToLab(...hexToRgb(fill))[0];
  return l < 55 ? '#ffffff' : '#0b0b0d';
}

export function resolveMatchKits(home: Kit | null, away: Kit | null): MatchKits {
  const hPrimary = home?.primary ?? '#ef4444';
  const hSecondary = home?.secondary ?? null;
  const aPrimary = away?.primary ?? '#3b82f6';
  const aSecondary = away?.secondary ?? null;

  const homeFill = hPrimary;

  let awayFill = aPrimary;
  let awayUsedFallback: 'secondary' | 'contrast' | undefined = undefined;

  if (deltaE(aPrimary, homeFill) < KIT_CLASH_THRESHOLD) {
    if (aSecondary && deltaE(aSecondary, homeFill) >= KIT_CLASH_THRESHOLD) {
      awayFill = aSecondary;
      awayUsedFallback = 'secondary';
    } else {
      const contrastOptions = ['#f8fafc', '#facc15', '#1e293b'];
      const chosen = contrastOptions.find(c => deltaE(c, homeFill) >= KIT_CLASH_THRESHOLD);
      if (chosen) {
        awayFill = chosen;
      } else {
        awayFill = '#f8fafc';
      }
      awayUsedFallback = 'contrast';
    }
  }

  const homeTrim = resolveTrim(homeFill, hSecondary);
  const awayTrim = resolveTrim(
    awayFill,
    awayUsedFallback === 'secondary' ? aSecondary : (awayUsedFallback === 'contrast' ? null : aSecondary),
    aPrimary,
    awayUsedFallback !== undefined
  );

  const gkPalette = ['#facc15', '#84cc16', '#475569', '#f97316'];

  let homeGk = gkPalette.find(g => deltaE(g, homeFill) >= KIT_CLASH_THRESHOLD && deltaE(g, awayFill) >= KIT_CLASH_THRESHOLD) ?? gkPalette[0];

  let awayGk = gkPalette.find(g =>
    deltaE(g, homeFill) >= KIT_CLASH_THRESHOLD &&
    deltaE(g, awayFill) >= KIT_CLASH_THRESHOLD &&
    deltaE(g, homeGk) >= KIT_CLASH_THRESHOLD
  ) ?? gkPalette.find(g => g !== homeGk) ?? gkPalette[1];

  return {
    home: {
      fill: homeFill,
      trim: homeTrim,
      gk: homeGk,
    },
    away: {
      fill: awayFill,
      trim: awayTrim,
      gk: awayGk,
      awayUsedFallback,
    },
  };
}

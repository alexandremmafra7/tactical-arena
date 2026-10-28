import { hashSeed } from '../simulation/rng.js';
import { SponsorshipType, SPONSOR_TYPES } from './finance.js';

export type SponsorLogoShape = 'circle' | 'shield' | 'hexagon' | 'diamond' | 'roundedSquare';

export interface SponsorLogoTheme {
  /** 0-359 hue, stable per sponsor name — the logo's base color. */
  hue: number;
  /** Up to 2 uppercase letters derived from the sponsor name. */
  initials: string;
  /** One shape per sponsorship type, so the 5 slots stay visually distinct at a glance even before reading the label. */
  shape: SponsorLogoShape;
}

const SHAPE_BY_TYPE: Record<SponsorshipType, SponsorLogoShape> = {
  MASTER: 'shield',
  KIT_SUPPLIER: 'hexagon',
  STADIUM_NAMING: 'diamond',
  REGIONAL: 'roundedSquare',
  TECH_EQUIPMENT: 'circle',
};

/** Subfolder names grouping artwork under `/sponsors/<category>/` */
export type SponsorCategoryFolder = 'master' | 'kit-supplier' | 'stadium-naming' | 'regional' | 'tech';

export const SPONSOR_TYPE_TO_FOLDER: Record<SponsorshipType, SponsorCategoryFolder> = {
  MASTER: 'master',
  KIT_SUPPLIER: 'kit-supplier',
  STADIUM_NAMING: 'stadium-naming',
  REGIONAL: 'regional',
  TECH_EQUIPMENT: 'tech',
};

/** Deterministic "generated logo" theme: same sponsor name always yields the same look, no image assets needed. */
export function getSponsorLogoTheme(sponsorName: string, type: SponsorshipType): SponsorLogoTheme {
  const hue = hashSeed(sponsorName) % 360;
  const words = sponsorName.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : (words[0]?.slice(0, 2) ?? '?').toUpperCase();

  return { hue, initials, shape: SHAPE_BY_TYPE[type] };
}

/** Filename-safe slug for a sponsor's real artwork (`/sponsors/<slug>.webp`), if one has been provided —
 *  falls back to the procedural logo above when no matching file exists. */
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function sponsorArtSlug(sponsorName: string): string {
  return sponsorName
    .normalize('NFKD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

let sponsorNameToFolderMap: Map<string, SponsorCategoryFolder> | null = null;

function getFolderByName(name: string): SponsorCategoryFolder | undefined {
  if (!sponsorNameToFolderMap) {
    sponsorNameToFolderMap = new Map();
    for (const st of SPONSOR_TYPES) {
      const folder = SPONSOR_TYPE_TO_FOLDER[st.type];
      if (st.names) {
        for (const n of st.names) {
          sponsorNameToFolderMap.set(n.toLowerCase().trim(), folder);
          sponsorNameToFolderMap.set(sponsorArtSlug(n), folder);
        }
      }
    }
  }
  return sponsorNameToFolderMap.get(name.toLowerCase().trim()) ?? sponsorNameToFolderMap.get(sponsorArtSlug(name));
}

/**
 * Resolves the category folder ('master', 'kit-supplier', etc.) for a sponsor type or name.
 */
export function getSponsorCategoryFolder(sponsorNameOrType: SponsorshipType | string): SponsorCategoryFolder | undefined {
  if (sponsorNameOrType in SPONSOR_TYPE_TO_FOLDER) {
    return SPONSOR_TYPE_TO_FOLDER[sponsorNameOrType as SponsorshipType];
  }
  return getFolderByName(sponsorNameOrType);
}

/**
 * Returns the public URL for a sponsor's artwork file.
 * Automatically resolves the category subfolder (`/sponsors/<category>/<slug>.webp`).
 */
export function getSponsorLogoUrl(sponsorName: string, type?: SponsorshipType, markOnly = false): string {
  const slug = sponsorArtSlug(sponsorName);
  const file = markOnly ? `${slug}-mark.webp` : `${slug}.webp`;
  const folder = (type && SPONSOR_TYPE_TO_FOLDER[type]) || getFolderByName(sponsorName);
  return folder ? `/sponsors/${folder}/${file}` : `/sponsors/${file}`;
}


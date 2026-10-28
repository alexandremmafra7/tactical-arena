import { hashSeed } from '../simulation/rng.js';

export interface ClubCrestTheme {
  /** 0-359 hue, stable per club id — the crest's base color. */
  hue: number;
  /** Up to 2 uppercase letters derived from the club name. */
  initials: string;
}

/** Deterministic "generated crest" theme: same club id/name always yields the same look, no image assets needed. */
export function getClubCrestTheme(club: { id: string; name: string }): ClubCrestTheme {
  const hue = hashSeed(club.id) % 360;
  const words = club.name.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2 ? `${words[0][0]}${words[1][0]}`.toUpperCase() : (words[0]?.slice(0, 2) ?? '?').toUpperCase();

  return { hue, initials };
}

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildCountry } from './offlineWorld.js';

/**
 * The offline world reads the same club database the server imports.
 *
 * Offline the game invented its clubs: twenty-four hand-written names with squads out of `generateSquad`, so
 * on Android the manager took charge of a Flamengo whose players did not exist and a league whose table meant
 * nothing. These tests run against the file that actually ships in `packages/web/public`, because a parser
 * that works on a fixture and not on the shipped data is worth nothing.
 */
const PUBLIC = path.resolve(__dirname, '../../public');

function rows(file: string): string[][] {
  return fs
    .readFileSync(path.join(PUBLIC, file), 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const out: string[] = [];
      let current = '';
      let quoted = false;
      for (const ch of line) {
        if (ch === '"') quoted = !quoted;
        else if (ch === ',' && !quoted) {
          out.push(current);
          current = '';
        } else current += ch;
      }
      out.push(current);
      return out;
    });
}

describe('the offline world is the real one', () => {
  const clubs = rows('clubs.csv');
  const squads = new Map<string, { name: string; position: string; age: number; rating: number }[]>();
  for (const cells of rows('players.csv')) {
    const numeric = (v: string) => /^\d+$/.test((v ?? '').trim());
    const [age, pos, rating] = numeric(cells[3])
      ? [Number(cells[3]), cells[2], Number(cells[5])]
      : [Number(cells[2]), cells[3], Number(cells[4])];
    const position = ({ GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'ATT', DEF: 'DEF', LAT: 'LAT', MID: 'MID', ATT: 'ATT' } as Record<string, string>)[
      (pos ?? '').toUpperCase().trim()
    ];
    if (!position || !Number.isInteger(age)) continue;
    const list = squads.get(cells[0]) ?? [];
    if (list.length < 26) list.push({ name: cells[1], position, age, rating });
    squads.set(cells[0], list);
  }

  it('ships the club database inside the app bundle', () => {
    // If these are not in `public`, the APK has no world to read and silently falls back to invented clubs.
    expect(fs.existsSync(path.join(PUBLIC, 'clubs.csv'))).toBe(true);
    expect(fs.existsSync(path.join(PUBLIC, 'players.csv'))).toBe(true);
    expect(clubs.length).toBeGreaterThan(1_000);
  });

  it('fills both Brazilian divisions with real clubs and real players', () => {
    const [primeira, segunda] = buildCountry(clubs, squads as never, 'BRA', 20);

    expect(primeira).toHaveLength(20);
    expect(segunda).toHaveLength(20);

    // Real names off the file, not `Clube 3` out of a generator.
    const nomes = primeira.map((c) => c.name);
    expect(nomes.some((n) => /Flamengo|Palmeiras|Corinthians|São Paulo/.test(n))).toBe(true);

    // A full squad each, with every position covered, or the autofill has no eleven to pick.
    for (const club of primeira) {
      expect(club.players.length).toBeGreaterThanOrEqual(11);
      expect(new Set(club.players.map((p) => p.position)).size).toBeGreaterThan(2);
      expect(club.players.every((p) => p.name.trim().length > 0)).toBe(true);
      expect(club.players.every((p) => p.age >= 15 && p.age <= 45)).toBe(true);
      expect(club.stadiumCapacity).toBeGreaterThan(0);
    }
  });

  it('puts the stronger clubs in the first division', () => {
    const [primeira, segunda] = buildCountry(clubs, squads as never, 'BRA', 20);
    const media = (tier: typeof primeira) =>
      tier.reduce((sum, c) => sum + c.players.reduce((s, p) => s + p.overall, 0) / c.players.length, 0) / tier.length;

    // Otherwise promotion and relegation moves clubs in the wrong direction from the first season on.
    expect(media(primeira)).toBeGreaterThanOrEqual(media(segunda) - 1);
  });

  it('never hands a league an odd number of clubs', () => {
    /**
     * A double round robin over an odd count leaves a club without a fixture every round, and the offline
     * engine has no bye. Uruguay is the case that matters: it has fewer clubs than the tier asks for.
     */
    for (const country of ['BRA', 'ARG', 'URU']) {
      for (const tier of buildCountry(clubs, squads as never, country, 20)) {
        expect(tier.length % 2, `${country} com ${tier.length} clubes`).toBe(0);
        expect(tier.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('gives every club its own players', () => {
    const [primeira] = buildCountry(clubs, squads as never, 'BRA', 20);
    const ids = primeira.flatMap((c) => c.players.map((p) => p.id));

    // Two clubs sharing a player id is how a transfer moves a man to a club he already plays for.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stays the same world every time it is built', () => {
    const um = buildCountry(clubs, squads as never, 'BRA', 20);
    const dois = buildCountry(clubs, squads as never, 'BRA', 20);

    // Seeded on the country, so reopening the app does not reshuffle the league a career is being played in.
    expect(JSON.stringify(um)).toBe(JSON.stringify(dois));
  });
});

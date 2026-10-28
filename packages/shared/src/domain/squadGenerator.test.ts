import { describe, it, expect } from 'vitest';
import {
  ACADEMY_SIZE,
  buildPlayerFromRating,
  generateAcademy,
  generateAcademyProspect,
  generateStarterSquad,
  regenerateRetiredPlayer,
} from './squadGenerator.js';
import { isValidCountryCode } from './country.js';
import { hasRetired } from './development.js';
import { createRng } from '../simulation/rng.js';
import { makePlayer } from '../simulation/testFactories.js';

describe('generateStarterSquad trait rarity', () => {
  it('deals LEADER out far less often than the problematic traits, across many squads', () => {
    let leaderCount = 0;
    let aggressiveCount = 0;
    let total = 0;

    for (let i = 0; i < 60; i++) {
      const players = generateStarterSquad(`trait-club-${i}`, 'BRA', `trait-seed-${i}`);
      for (const p of players) {
        total++;
        if (p.traits.includes('LEADER')) leaderCount++;
        if (p.traits.includes('AGGRESSIVE')) aggressiveCount++;
      }
    }

    expect(total).toBeGreaterThan(0);
    expect(leaderCount).toBeLessThan(aggressiveCount);
  });
});

describe('generateStarterSquad nationalities', () => {
  it('assigns only valid country codes to every player', () => {
    const players = generateStarterSquad('club-1', 'BRA');
    for (const p of players) {
      expect(isValidCountryCode(p.nationality)).toBe(true);
    }
  });

  it('assigns the club country to most, but not necessarily all, players across many squads', () => {
    let homeCount = 0;
    let total = 0;

    for (let i = 0; i < 30; i++) {
      const players = generateStarterSquad(`club-${i}`, 'BRA', `seed-${i}`);
      for (const p of players) {
        total++;
        if (p.nationality === 'BRA') homeCount++;
      }
    }

    const homeShare = homeCount / total;
    // Expect a clear majority to be home-country, but some foreign signings too.
    expect(homeShare).toBeGreaterThan(0.5);
    expect(homeShare).toBeLessThan(0.95);
  });

  it('is deterministic for the same seed', () => {
    const a = generateStarterSquad('club-x', 'GER', 'fixed-seed');
    const b = generateStarterSquad('club-x', 'GER', 'fixed-seed');
    expect(a.map((p) => p.nationality)).toEqual(b.map((p) => p.nationality));
    expect(a.map((p) => p.name)).toEqual(b.map((p) => p.name));
  });
});

describe('generateStarterSquad skillLevel override', () => {
  it('produces a squad with a notably higher average overall for a high skillLevel than a low one', () => {
    const strong = generateStarterSquad('strong-club', 'BRA', 'skill-seed', 78);
    const weak = generateStarterSquad('weak-club', 'BRA', 'skill-seed', 58);

    const avg = (players: typeof strong) => players.reduce((sum, p) => sum + p.overall, 0) / players.length;
    expect(avg(strong)).toBeGreaterThan(avg(weak));
  });

  it('falls back to the normal random range when skillLevel is omitted, still producing valid overalls', () => {
    const players = generateStarterSquad('random-club', 'BRA', 'skill-seed-2');
    for (const p of players) {
      expect(p.overall).toBeGreaterThanOrEqual(1);
      expect(p.overall).toBeLessThanOrEqual(99);
    }
  });
});

describe('regenerateRetiredPlayer', () => {
  it('reuses the same id and position, but comes back young, unretired and with a clean slate', () => {
    const rng = createRng('rebirth-seed');
    const veteran = makePlayer('slot-7', {
      name: 'Velho Capitão',
      position: 'DEF',
      age: 36,
      overall: 60,
      starLevel: 'NONE',
      developmentPoints: 40,
      suspensions: [{ competitionId: null, matchesRemaining: 2 }],
    });
    expect(hasRetired(veteran)).toBe(true);

    const reborn = regenerateRetiredPlayer(veteran, 'BRA', rng);

    expect(reborn.id).toBe(veteran.id);
    expect(reborn.position).toBe(veteran.position);
    expect(reborn.age).toBeGreaterThanOrEqual(16);
    expect(reborn.age).toBeLessThanOrEqual(21);
    expect(hasRetired(reborn)).toBe(false);
    expect(reborn.developmentPoints).toBe(0);
    expect(reborn.suspensions).toEqual([]);
    expect(isValidCountryCode(reborn.nationality)).toBe(true);
  });

  it('keeps a squad at full strength indefinitely: repeated rebirths never leave a retired player behind', () => {
    const rng = createRng('endless-squad-seed');
    let player = makePlayer('endless-slot', { position: 'ATT', age: 33, overall: 55 });

    // Mirrors the real tick order: age first, then rebirth immediately if that crossed retirement —
    // so the squad is never left holding a retired player at rest between ticks.
    for (let tick = 0; tick < 50; tick++) {
      player = { ...player, age: player.age + 1 };
      if (hasRetired(player)) {
        player = regenerateRetiredPlayer(player, 'BRA', rng);
      }
    }

    expect(hasRetired(player)).toBe(false);
  });
});

describe('youth academy generation', () => {
  it('generates exactly ACADEMY_SIZE prospects, all strictly sub-20', () => {
    const academy = generateAcademy('club-y', 'BRA');
    expect(academy).toHaveLength(ACADEMY_SIZE);
    for (const p of academy) {
      expect(p.age).toBeLessThan(20);
      expect(p.developmentPoints).toBe(0);
      expect(p.suspensions).toEqual([]);
    }
  });

  it('spreads a wider potential ceiling than a regular signing at the same overall (unproven, high-upside bets)', () => {
    const rng = createRng('upside-seed');
    let widerCount = 0;
    const trials = 200;

    for (let i = 0; i < trials; i++) {
      const prospect = generateAcademyProspect(`prospect-${i}`, 'MID', 'BRA', rng);
      if (prospect.potential - prospect.overall > 10) widerCount++;
    }

    // Not every roll produces a big gap, but a meaningful share should show real upside spread.
    expect(widerCount / trials).toBeGreaterThan(0.2);
  });

  it('is deterministic for the same seed', () => {
    const a = generateAcademy('club-z', 'FRA', 'fixed-academy-seed');
    const b = generateAcademy('club-z', 'FRA', 'fixed-academy-seed');
    expect(a.map((p) => p.name)).toEqual(b.map((p) => p.name));
    expect(a.map((p) => p.potential)).toEqual(b.map((p) => p.potential));
  });
});

describe('buildPlayerFromRating (real-roster import)', () => {
  it('keeps the supplied identity fields untouched', () => {
    const rng = createRng('import-seed-1');
    const player = buildPlayerFromRating(
      { id: 'real-p1', name: 'Fulano da Silva', position: 'DEF', age: 27, nationality: 'BRA', rating: 70 },
      rng,
    );
    expect(player.id).toBe('real-p1');
    expect(player.name).toBe('Fulano da Silva');
    expect(player.position).toBe('DEF');
    expect(player.age).toBe(27);
    expect(player.nationality).toBe('BRA');
  });

  it('a high rating produces a clearly higher overall than a low rating, for the same position', () => {
    const rng = createRng('import-seed-2');
    const star = buildPlayerFromRating({ id: 'star', name: 'Star', position: 'ATT', age: 27, nationality: 'BRA', rating: 90 }, rng);
    const scrub = buildPlayerFromRating({ id: 'scrub', name: 'Scrub', position: 'ATT', age: 27, nationality: 'BRA', rating: 40 }, rng);
    expect(star.overall).toBeGreaterThan(scrub.overall);
  });

  it('boosts the position-relevant attribute on average (finishing for attackers, defending for defenders)', () => {
    const rng = createRng('import-seed-3');
    let finishingTotal = 0;
    let passingTotal = 0;
    const trials = 100;

    for (let i = 0; i < trials; i++) {
      const attacker = buildPlayerFromRating({ id: `a${i}`, name: 'A', position: 'ATT', age: 25, nationality: 'BRA', rating: 60 }, rng);
      finishingTotal += attacker.attributes.finishing;
      passingTotal += attacker.attributes.passing;
    }

    expect(finishingTotal / trials).toBeGreaterThan(passingTotal / trials);
  });

  it('gives a young player a potential at or above their overall, and an older player potential equal to overall', () => {
    const rng = createRng('import-seed-4');
    const young = buildPlayerFromRating({ id: 'y1', name: 'Y', position: 'MID', age: 19, nationality: 'BRA', rating: 60 }, rng);
    const veteran = buildPlayerFromRating({ id: 'v1', name: 'V', position: 'MID', age: 34, nationality: 'BRA', rating: 60 }, rng);
    expect(young.potential).toBeGreaterThanOrEqual(young.overall);
    expect(veteran.potential).toBe(veteran.overall);
  });

  it('is deterministic for the same rng sequence', () => {
    const input = { id: 'det', name: 'Det', position: 'MID' as const, age: 24, nationality: 'BRA', rating: 65 };
    const a = buildPlayerFromRating(input, createRng('same-seed'));
    const b = buildPlayerFromRating(input, createRng('same-seed'));
    expect(a).toEqual(b);
  });

  it('honours an externally-supplied starLevel (e.g. a real top-mundial star in the roster CSV)', () => {
    const rng = createRng('import-seed-star');
    const star = buildPlayerFromRating(
      { id: 'star1', name: 'Astro', position: 'ATT', age: 27, nationality: 'BRA', rating: 90, starLevel: 'NATURAL' },
      rng,
    );
    const scrub = buildPlayerFromRating({ id: 'scrub1', name: 'Comum', position: 'ATT', age: 27, nationality: 'BRA', rating: 40 }, rng);

    expect(star.starLevel).toBe('NATURAL');
    expect(scrub.starLevel).toBe('NONE');
    expect(star.marketValue).toBeGreaterThan(scrub.marketValue);
  });

  it('carries an externally-supplied diferenciado flag (real-world standout in the roster CSV)', () => {
    const rng = createRng('import-seed-dif');
    const star = buildPlayerFromRating(
      { id: 'dif1', name: 'Craque', position: 'ATT', age: 25, nationality: 'BRA', rating: 82, diferenciado: true },
      rng,
    );
    const scrub = buildPlayerFromRating({ id: 'scrub2', name: 'Comum', position: 'ATT', age: 27, nationality: 'BRA', rating: 40 }, rng);

    expect(star.diferenciado).toBe(true);
    expect(scrub.diferenciado).toBeUndefined();
  });
});

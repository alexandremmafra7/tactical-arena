import {
  Player,
  PersonalityTrait,
  Position,
  StarLevel,
  calculateMarketValue,
  calculateOverall,
  calculateReleaseClause,
  calculateWage,
  pickPreferredFoot,
} from './player.js';
import { generateDetailedAttributes, resolveAttributeRole } from './detailedAttributes.js';
import { COUNTRIES, getCountry } from './country.js';
import { generatePlayerName } from './nameGenerator.js';
import { createRng } from '../simulation/rng.js';

// 32 players — matches the real Brasileirão Série A's average full-squad size (clubs ranged roughly
// 26-41 registered professionals across the 2024 season). Same position mix as a 4-4-2 XI, just twice
// over, so there's real rotation depth (two credible options at every slot) instead of a bare bench.
const SQUAD_TEMPLATE: Position[] = [
  'GK',
  'GK',
  'GK',
  'GK',
  'LAT',
  'LAT',
  'LAT',
  'LAT',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'MID',
  'ATT',
  'ATT',
  'ATT',
  'ATT',
  'ATT',
  'ATT',
];

/** Five youth prospects: a small, position-balanced pipeline rather than a full second squad. */
export const ACADEMY_SIZE = 5;
const ACADEMY_TEMPLATE: Position[] = ['GK', 'DEF', 'MID', 'MID', 'ATT'];

/** Youth-only, deliberately rare: the wonderkid roll. */
const NATURAL_STAR_MAX_AGE = 21;
const NATURAL_STAR_CHANCE = 0.03;
const PROBLEMATIC_TRAIT_CHANCE = 0.15;
/** LEADER is deliberately rarer than the problematic traits — a natural leader is meant to stand out. */
const LEADER_TRAIT_CHANCE = 0.06;
/** DETERMINED provides half the leadership bonus of LEADER; adjust frequency as needed. */
const DETERMINED_TRAIT_CHANCE = 0.08;
const TRAIT_CHANCE: Record<PersonalityTrait, number> = {
  AGGRESSIVE: PROBLEMATIC_TRAIT_CHANCE,
  PROVOCATIVE: PROBLEMATIC_TRAIT_CHANCE,
  TEMPERAMENTAL: PROBLEMATIC_TRAIT_CHANCE,
  UNDISCIPLINED: PROBLEMATIC_TRAIT_CHANCE,
  SELFISH: PROBLEMATIC_TRAIT_CHANCE,
  LEADER: LEADER_TRAIT_CHANCE,
  DETERMINED: DETERMINED_TRAIT_CHANCE,
};
const ALL_TRAITS: PersonalityTrait[] = ['AGGRESSIVE', 'PROVOCATIVE', 'TEMPERAMENTAL', 'UNDISCIPLINED', 'SELFISH', 'LEADER', 'DETERMINED'];

/** Most of a club's squad shares the club's home country; the rest are foreign signings from anywhere in the world. */
const HOME_NATIONALITY_CHANCE = 0.7;

/** A brand-new club's founding squad spans a realistic career-age range. */
const FOUNDING_SQUAD_AGE_MIN = 18;
const FOUNDING_SQUAD_AGE_SPAN = 15; // 18-33

/** A retired player's slot is reborn as an academy graduate breaking into the squad. */
const ROOKIE_AGE_MIN = 16;
const ROOKIE_AGE_SPAN = 5; // 16-21

/** Academy prospects are strictly sub-20 — future bets, not the finished article. */
const ACADEMY_AGE_MIN = 14;
const ACADEMY_AGE_SPAN = 5; // 14-19

function pickNationality(clubCountry: string, rng: () => number): string {
  if (rng() < HOME_NATIONALITY_CHANCE) return clubCountry;
  return COUNTRIES[Math.floor(rng() * COUNTRIES.length)].code;
}

interface GeneratePlayerOptions {
  ageMin: number;
  ageSpan: number;
  /** Widens the potential ceiling: unproven prospects might bust, or might become a star. */
  highUpside?: boolean;
  /** Overrides the random 45-65 base every attribute jitters around — lets a caller pin a club's overall
   *  quality to something real instead of leaving it to chance (see `skillLevelFromRealStanding` in
   *  import-content.ts, which derives this from a real league's actual final standings). */
  skillLevel?: number;
}

/** Generates one player for `position`, at `id`, with age drawn from `ageMin`..`ageMin+ageSpan`. */
function generatePlayer(id: string, position: Position, clubCountry: string, rng: () => number, options: GeneratePlayerOptions): Player {
  const jitter = (base: number, spread: number) => Math.max(1, Math.min(99, Math.round(base + (rng() - 0.5) * spread)));

  const nationality = pickNationality(clubCountry, rng);
  const continent = getCountry(nationality)?.continent ?? 'SOUTH_AMERICA';
  const name = generatePlayerName(continent, rng);
  // Each player still jitters individually around the base (squad depth naturally varies), but the base
  // itself is pinned instead of rolled when the caller wants a specific overall club quality. A pinned
  // base also jitters on a tighter spread (12 instead of the usual 20) — a 16-player sample is small
  // enough that the usual wide per-player noise can otherwise swallow a real (but modest) gap between two
  // similarly-ranked real clubs, e.g. a title winner reading weaker on average than the runner-up.
  const base = options.skillLevel ?? 45 + rng() * 20;
  const spread = options.skillLevel !== undefined ? 12 : 20;
  const age = options.ageMin + Math.round(rng() * options.ageSpan);

  const attributes = {
    pace: jitter(position === 'LAT' ? base + 8 : base, spread),
    finishing: jitter(position === 'ATT' ? base + 10 : base, spread),
    passing: jitter(base, spread),
    defending: jitter(position === 'DEF' ? base + 10 : position === 'LAT' ? base + 5 : base, spread),
    physical: jitter(base, spread),
    goalkeeping: position === 'GK' ? jitter(base + 15, spread) : 10,
  };

  const overall = calculateOverall(position, attributes);
  const preferredFoot = pickPreferredFoot(rng, position);

  const isNaturalStar = age <= NATURAL_STAR_MAX_AGE && rng() < NATURAL_STAR_CHANCE;
  const starLevel: StarLevel = isNaturalStar ? 'NATURAL' : 'NONE';
  const potential = isNaturalStar
    ? Math.min(99, 90 + Math.round(rng() * 9))
    : options.highUpside
      ? Math.min(99, Math.max(overall, overall + Math.round(rng() * 30)))
      : Math.max(overall, Math.min(99, overall + Math.round((rng() - 0.3) * 10)));

  const traits: PersonalityTrait[] = ALL_TRAITS.filter((trait) => rng() < TRAIT_CHANCE[trait]);
  const marketValue = calculateMarketValue(age, overall, potential, starLevel);
  const detailedAttributes = generateDetailedAttributes(resolveAttributeRole(position), rng);

  return {
    id,
    name,
    position,
    preferredFoot,
    age,
    morale: 50,
    fatigue: 0,
    commitment: 50,
    attributes,
    detailedAttributes,
    overall,
    potential,
    starLevel,
    traits,
    functions: [],
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    nationality,
    marketValue,
    wage: calculateWage(marketValue),
    releaseClause: calculateReleaseClause(marketValue),
    seasonGoals: 0,
    seasonAssists: 0,
    seasonMatches: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerMatches: 0,
  };
}

/** Generates a fresh 16-player starter squad (a valid 4-4-2 XI plus bench) for a new club. `skillLevel`
 *  (1-99) pins the whole squad's quality instead of rolling it randomly per player — see `generatePlayer`. */
export function generateStarterSquad(clubId: string, clubCountry: string, seed: string = clubId, skillLevel?: number): Player[] {
  const rng = createRng(seed);
  return SQUAD_TEMPLATE.map((position, index) =>
    generatePlayer(`${clubId}-p${index}`, position, clubCountry, rng, {
      ageMin: FOUNDING_SQUAD_AGE_MIN,
      ageSpan: FOUNDING_SQUAD_AGE_SPAN,
      skillLevel,
    }),
  );
}

/** Generates a squad with an optional target skill level, seed, and club country. */
export function generateSquad(skillLevel?: number, seed: string = 'default-squad', clubCountry: string = 'BRA'): Player[] {
  const rng = createRng(seed);
  return SQUAD_TEMPLATE.map((position, index) =>
    generatePlayer(`${seed}-p${index}`, position, clubCountry, rng, {
      ageMin: FOUNDING_SQUAD_AGE_MIN,
      ageSpan: FOUNDING_SQUAD_AGE_SPAN,
      skillLevel,
    }),
  );
}

/**
 * "Reborn" replacement for a player who just retired: same id and position (so tactics, presets and
 * transfer history that reference this slot keep working), but a brand-new academy graduate — fresh
 * name, nationality, attributes and a young age — takes their place. Keeps squads from shrinking forever
 * as veterans age out, without needing a separate youth-academy/scouting system yet.
 */
export function regenerateRetiredPlayer(retiredPlayer: Player, clubCountry: string, rng: () => number): Player {
  return generatePlayer(retiredPlayer.id, retiredPlayer.position, clubCountry, rng, { ageMin: ROOKIE_AGE_MIN, ageSpan: ROOKIE_AGE_SPAN });
}

/** Generates the initial youth academy (always sub-20, wider potential spread) for a new club. */
export function generateAcademy(clubId: string, clubCountry: string, seed: string = `${clubId}-academy`): Player[] {
  const rng = createRng(seed);
  return ACADEMY_TEMPLATE.map((position, index) =>
    generatePlayer(`${clubId}-a${index}`, position, clubCountry, rng, {
      ageMin: ACADEMY_AGE_MIN,
      ageSpan: ACADEMY_AGE_SPAN,
      highUpside: true,
    }),
  );
}

/** Replaces a graduated (aged out) or released academy slot with a fresh prospect, keeping the pipeline full. */
export function generateAcademyProspect(academySlotId: string, position: Position, clubCountry: string, rng: () => number): Player {
  return generatePlayer(academySlotId, position, clubCountry, rng, { ageMin: ACADEMY_AGE_MIN, ageSpan: ACADEMY_AGE_SPAN, highUpside: true });
}

export interface RealPlayerInput {
  id: string;
  name: string;
  position: Position;
  age: number;
  nationality: string;
  /** A single 1-99 overall estimate, supplied externally (e.g. imported from a CSV of real rosters). */
  rating: number;
  /** Differentiated star billing supplied externally (e.g. a real-world top-mundial star in the roster
   *  CSV). Defaults to 'NONE' when omitted — regular imported players are not stars. */
  starLevel?: StarLevel;
  /** Real-world standout marker from the roster CSV — "diferenciado". Optional; absent means not flagged. */
  diferenciado?: boolean;
}

/**
 * Builds a player from externally-supplied identity (name/position/age/nationality) and a single
 * overall-rating estimate, instead of generating everything at random — the entry point for importing
 * real-world rosters. Reuses the exact same attribute-distribution and economics formulas as procedural
 * generation so an imported player behaves identically to a generated one everywhere else in the game.
 */
export function buildPlayerFromRating(input: RealPlayerInput, rng: () => number): Player {
  const { id, name, position, age, nationality } = input;
  const base = Math.max(1, Math.min(99, input.rating));
  const jitter = (b: number, spread: number) => Math.max(1, Math.min(99, Math.round(b + (rng() - 0.5) * spread)));

  const attributes = {
    pace: jitter(position === 'LAT' ? base + 3 : base, 8),
    finishing: jitter(position === 'ATT' ? base + 3 : base, 8),
    passing: jitter(base, 8),
    defending: jitter(position === 'DEF' ? base + 3 : position === 'LAT' ? base + 2 : base, 8),
    physical: jitter(base, 8),
    goalkeeping: position === 'GK' ? jitter(base, 8) : 10,
  };

  const overall = calculateOverall(position, attributes);
  // Young players get a modest, bounded potential bump; established players are assumed near their ceiling.
  const potential = age <= 23 ? Math.max(overall, Math.min(99, overall + Math.round(rng() * 8))) : overall;
  const starLevel = input.starLevel ?? 'NONE';
  const marketValue = calculateMarketValue(age, overall, potential, starLevel);
  const preferredFoot = pickPreferredFoot(rng, position);
  const detailedAttributes = generateDetailedAttributes(resolveAttributeRole(position), rng);

  return {
    id,
    name,
    position,
    preferredFoot,
    age,
    morale: 50,
    fatigue: 0,
    commitment: 50,
    attributes,
    detailedAttributes,
    overall,
    potential,
    starLevel,
    diferenciado: input.diferenciado,
    traits: [],
    functions: [],
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    nationality,
    marketValue,
    wage: calculateWage(marketValue),
    releaseClause: calculateReleaseClause(marketValue),
    seasonGoals: 0,
    seasonAssists: 0,
    seasonMatches: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerMatches: 0,
  };
}

import type { DetailedAttribute } from './detailedAttributes.js';

/** DEF is a central defender ("zagueiro"); LAT ("lateral") is a fullback/wing-back — same defensive
 *  line, different attribute bias and formation slot (see POSITION_WEIGHTS and squadGenerator.ts). */
export type Position = 'GK' | 'DEF' | 'LAT' | 'MID' | 'ATT';
export type StarLevel = 'NONE' | 'NATURAL' | 'DEVELOPED';
export type PersonalityTrait = 'AGGRESSIVE' | 'PROVOCATIVE' | 'TEMPERAMENTAL' | 'UNDISCIPLINED' | 'SELFISH' | 'LEADER' | 'DETERMINED';
export type PreferredFoot = 'LEFT' | 'RIGHT' | 'BOTH';

/** Which sub-attributes a training session prioritizes — "Submenu Treinamento" spec, see development.ts
 *  applyTrainingFocus. Chosen per `investInPlayer` call; the most recent choice is what the next
 *  development tick applies, same "last click wins" simplification developmentPoints already uses for
 *  repeated training on the same player before the week turns over. */
export type TrainingFocus =
  | 'PHYSICAL'
  | 'TECHNICAL'
  | 'MENTAL'
  | 'FINISHING'
  | 'PASSING'
  | 'DEFENDING'
  | 'PACE';

/** A specific tactical role a coach can assign within a player's base position — e.g. a LAT can be
 *  deployed as a defensive-minded LATERAL or a more advancing ALA. Purely a coach's choice (see
 *  `MAX_PLAYER_FUNCTIONS`); it doesn't affect generation, just how the player is described/used. */
export type PlayerFunction =
  | 'LATERAL'
  | 'ALA'
  | 'VOLANTE'
  | 'MEIA_CRIACAO'
  | 'CENTROAVANTE'
  | 'PONTA'
  | 'SEGUNDO_ATACANTE'
  | 'ZAGUEIRO_REBATEDOR'
  | 'ZAGUEIRO_CONSTRUTOR'
  | 'LATERAL_CONSTRUTOR'
  | 'ALA_OFENSIVO'
  | 'VOLANTE_CAO_DE_GUARDA'
  | 'MEIA_BOX_TO_BOX'
  | 'MEIA_ARMADOR'
  | 'PONTA_INVERTIDO'
  | 'PONTA_LINHA_DE_FUNDO'
  | 'CENTROAVANTE_REFERENCIA'
  | 'FALSO_NOVE';

/** Which functions are available to assign, per base position — GK has none. */
export const FUNCTIONS_BY_POSITION: Record<Position, PlayerFunction[]> = {
  GK: [],
  DEF: ['ZAGUEIRO_REBATEDOR', 'ZAGUEIRO_CONSTRUTOR'],
  LAT: ['LATERAL', 'ALA', 'LATERAL_CONSTRUTOR', 'ALA_OFENSIVO'],
  MID: ['VOLANTE', 'MEIA_CRIACAO', 'VOLANTE_CAO_DE_GUARDA', 'MEIA_BOX_TO_BOX', 'MEIA_ARMADOR'],
  ATT: [
    'CENTROAVANTE',
    'PONTA',
    'SEGUNDO_ATACANTE',
    'PONTA_INVERTIDO',
    'PONTA_LINHA_DE_FUNDO',
    'CENTROAVANTE_REFERENCIA',
    'FALSO_NOVE',
  ],
};

/** A coach can stack at most two functions on one player, to keep the choice meaningful. */
export const MAX_PLAYER_FUNCTIONS = 2;

export interface PlayerAttributes {
  pace: number;
  finishing: number;
  passing: number;
  defending: number;
  physical: number;
  goalkeeping: number;
}

/** One active red-card ban. `competitionId` is the league/cup it was earned in (see `Match.competitionId`)
 *  — a ban only blocks matches in THAT competition, so a league red card doesn't cost a cup appearance and
 *  vice versa. `null` means it was earned in an ad-hoc/friendly match and only blocks other friendlies. */
export interface Suspension {
  competitionId: string | null;
  matchesRemaining: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  secondaryPositions?: Position[];
  preferredFoot: PreferredFoot;
  age: number;
  attributes: PlayerAttributes;
  /** Deeper, position-flavored scouting attributes (see detailedAttributes.ts) — descriptive depth,
   *  not (yet) part of the match simulation math, which still runs on `attributes` above. */
  detailedAttributes: Record<DetailedAttribute, number>;
  morale: number;
  fatigue: number;
  /** How much this player trusts the coach's decisions — driven by playing time relative to their quality. */
  commitment: number;
  marketValue: number;
  /** "Força": overall talent gate (1-99). Governs how much of the raw attributes actually show up in-game. */
  overall: number;
  /** Ceiling `overall` can grow toward via development (see development.ts). */
  potential: number;
  starLevel: StarLevel;
  /** A real-world standout (e.g. Vitor Roque, Paquetá) marked in the roster CSV — "diferenciado". Optional
   *  so older saved players (and generated ones) simply don't carry the flag. Grants the BAITA tier
   *  ("Baita Jogador / Diferenciado") — same on-pitch edge as an 85+ elite (see `getPlayerTier`/`starFactor`). */
  diferenciado?: boolean;
  traits: PersonalityTrait[];
  /** Tactical sub-roles the coach assigned within this player's position (see `FUNCTIONS_BY_POSITION`); empty until set. */
  functions: PlayerFunction[];
  /** Accumulated training investment, consumed by the next development tick. */
  developmentPoints: number;
  /** The focus chosen on the most recent `investInPlayer` call, applied and cleared on the next
   *  development tick alongside `developmentPoints`. Null when no training is pending or the last
   *  session had no focus selected. */
  trainingFocus: TrainingFocus | null;
  /** Active red-card bans, scoped per competition — see `Suspension`. Empty when not suspended anywhere. */
  suspensions: Suspension[];
  /** Matches still out injured; a player with this > 0 cannot be selected in a lineup. Same decrement
   *  cadence as a `Suspension` (once per match the club plays — see injuryService.ts) rather than
   *  calendar time, since the game has no real week clock that reliably ticks for bot-owned clubs. */
  injuryWeeks: number;
  /** Country code (see country.ts). Independent of the club's own country — foreign signings are common. */
  nationality: string;
  /** Weekly wage, part of the club's payroll cost each finance tick. */
  wage: number;
  /** Release clause: pay this in full and the buying club doesn't need the seller's consent at all. */
  releaseClause: number;
  /**
   * A temporada em que o contrato termina. Ver `contract.ts`.
   *
   * Opcional porque saves e elencos anteriores aos contratos não têm um, e são tratados como contrato longo
   * em vez de vencido: a alternativa era um save antigo perder o elenco inteiro na primeira virada de ano.
   */
  contractUntil?: number;
  clubId?: string;
  clubName?: string;
  /** Cláusulas contratuais avançadas (bônus, sell-on, etc.) */
  contractClauses?: import('./contractClauses.js').ContractClauses;
  /** Data da última sessão intensiva de treino (para cooldown semanal da base). */
  lastTrainedDate?: string;
  seasonGoals?: number;
  seasonAssists?: number;
  seasonMatches?: number;
  careerGoals?: number;
  careerAssists?: number;
  careerMatches?: number;
}

export const PEAK_AGE_START = 24;
export const PEAK_AGE_END = 29;
export const ELITE_OVERALL_THRESHOLD = 88;
/** "Gênio / ExtracLasse" — the absolute elite (e.g. a CR7-level import): the max display tier. */
export const GENIO_OVERALL_THRESHOLD = 90;
const YOUNG_PENALTY_PER_YEAR = 0.035;
const VETERAN_DECLINE_PER_YEAR = 0.03;

/** Display tier shown as a badge next to a player everywhere in the UI. Derived from `overall` — which
 *  reflects imported real-world ratings too — plus the development `starLevel` and youth age/potential.
 *  Three distinct tiers exist:
 *   - GENIO (gold 3D faceted star)
 *   - BAITA (cyan double chevron neon)
 *   - PROMESSA (blue neon diamond / Sub-20 youth gem)
 */
export type PlayerTier = 'GENIO' | 'BAITA' | 'PROMESSA';

export const PLAYER_TIER_LABEL: Record<PlayerTier, string> = {
  GENIO: 'Gênio / Extraclasse',
  BAITA: 'Baita Jogador / Diferenciado',
  PROMESSA: 'Promessa Sub-20 / Joia da Base',
};

export const PLAYER_TIER_DESCRIPTION: Record<PlayerTier, string> = {
  GENIO: 'Muda jogos sozinho, quase impossível de anular, decide finais.',
  BAITA: 'Leitura de jogo acima da média, consistente e muito acima do elenco padrão.',
  PROMESSA: 'Jovem talento de altíssimo potencial e rápida evolução com minutos em campo.',
};

const KNOWN_STANDOUT_NAMES = new Set([
  'lucas paqueta',
  'pedro',
  'bruno henrique',
  'giorgian de arrascaeta',
  'arrascaeta',
  'nicolas de la cruz',
  'de la cruz',
  'gerson',
  'estevao',
  'raphael veiga',
  'vitor roque',
  'gustavo gomez',
  'rodrigo garro',
  'memphis depay',
  'depay',
  'lucas moura',
  'jonathan calleri',
  'calleri',
  'hulk',
  'paulinho',
  'matheus pereira',
  'jhon arias',
  'ganso',
  'philippe coutinho',
  'coutinho',
  'dimitri payet',
  'payet',
  'alan patrick',
  'luiz henrique',
  'thiago almada',
  'almada',
  'igor jesus',
  'jefferson savarino',
  'savarino',
  'everton ribeiro',
  'cauly',
  'neymar',
  'lionel messi',
  'messi',
  'cristiano ronaldo',
  'kylian mbappe',
  'mbappe',
  'vinicius junior',
  'vinicius jr',
  'erling haaland',
  'haaland',
  'jude bellingham',
  'bellingham',
  'rodrygo',
  'federico valverde',
  'valverde',
  'lamine yamal',
  'yamal',
  'robert lewandowski',
  'lewandowski',
  'raphinha',
  'pedri',
  'harry kane',
  'kane',
  'jamal musiala',
  'musiala',
  'mohamed salah',
  'salah',
  'virgil van dijk',
  'van dijk',
  'bukayo saka',
  'saka',
  'martin odegaard',
  'odegaard',
  'declan rice',
  'phil foden',
  'foden',
  'kevin de bruyne',
  'de bruyne',
  'rodri',
]);

export function isKnownStandoutName(name?: string): boolean {
  if (!name) return false;
  const norm = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (KNOWN_STANDOUT_NAMES.has(norm)) return true;
  for (const item of KNOWN_STANDOUT_NAMES) {
    if (norm === item || norm.startsWith(`${item} `) || norm.endsWith(` ${item}`) || norm.includes(` ${item} `)) {
      return true;
    }
  }
  return false;
}

/**
 * Highest applicable display tier for a player:
 *  - GENIO ("Gênio / ExtracLasse"): overall in the very-elite band (>= 90) — "muda jogos sozinho";
 *  - BAITA ("Baita Jogador / Diferenciado"): the elite band (>= 88), a natural academy star, or a
 *    CSV-marked "diferenciado" standout with overall >= 80 — "muito acima do elenco padrão".
 *  - PROMESSA ("Promessa Sub-20 / Joia da Base"): young players (age <= 20) with high potential (>= 80)
 *    or natural academy star rating.
 */
export function getPlayerTier(
  overall: number,
  starLevel?: StarLevel,
  diferenciado?: boolean,
  age?: number,
  potential?: number,
  name?: string,
): PlayerTier | null {
  const isStandout = diferenciado === true || starLevel === 'NATURAL' || isKnownStandoutName(name);
  if (overall >= GENIO_OVERALL_THRESHOLD) return 'GENIO';
  if (overall >= ELITE_OVERALL_THRESHOLD) return 'BAITA';
  if (isStandout && overall >= 80) return 'BAITA';
  if (
    age !== undefined &&
    age <= 20 &&
    ((potential !== undefined && potential >= 80) || starLevel === 'NATURAL' || isStandout)
  ) {
    return 'PROMESSA';
  }
  return null;
}

const POSITION_WEIGHTS: Record<Position, Partial<Record<keyof PlayerAttributes, number>>> = {
  GK: { goalkeeping: 0.75, physical: 0.25 },
  DEF: { defending: 0.4, physical: 0.25, passing: 0.15, pace: 0.15, finishing: 0.05 },
  LAT: { pace: 0.3, defending: 0.3, passing: 0.2, physical: 0.1, finishing: 0.1 },
  MID: { passing: 0.3, defending: 0.2, pace: 0.2, finishing: 0.15, physical: 0.15 },
  ATT: { finishing: 0.4, pace: 0.25, passing: 0.15, physical: 0.1, defending: 0.1 },
};

/** BOTH ("Ambidestro") is deliberately rare and reserved for midfielders/attackers — a fullback or
 *  centre-back being genuinely two-footed isn't the special trait it is further up the pitch. */
const AMBIDEXTROUS_POSITIONS: Position[] = ['MID', 'ATT'];

const PREFERRED_FOOT_WEIGHTS: [PreferredFoot, number][] = [
  ['RIGHT', 0.77],
  ['LEFT', 0.2],
  ['BOTH', 0.03],
];
const PREFERRED_FOOT_WEIGHTS_NO_BOTH: [PreferredFoot, number][] = [
  ['RIGHT', 0.79],
  ['LEFT', 0.21],
];

/** Realistic footedness split (~77% right, ~20% left, ~3% ambidextrous — the latter only for MID/ATT). */
export function pickPreferredFoot(rng: () => number, position: Position): PreferredFoot {
  const weights = AMBIDEXTROUS_POSITIONS.includes(position) ? PREFERRED_FOOT_WEIGHTS : PREFERRED_FOOT_WEIGHTS_NO_BOTH;
  const roll = rng();
  let acc = 0;
  for (const [foot, weight] of weights) {
    acc += weight;
    if (roll < acc) return foot;
  }
  return 'RIGHT';
}

/** Composes the position-relevant raw attributes into a single 1-99 "força" rating. */
export function calculateOverall(position: Position, attributes: PlayerAttributes): number {
  const weights = POSITION_WEIGHTS[position];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of Object.keys(weights) as (keyof PlayerAttributes)[]) {
    const weight = weights[key]!;
    weightedSum += attributes[key] * weight;
    totalWeight += weight;
  }
  return Math.round(Math.max(1, Math.min(99, weightedSum / totalWeight)));
}

/**
 * A player is selectable in a lineup only when serving neither an injury nor a suspension that applies
 * to this match. `competitionId` should be the match's own `Match.competitionId` (null for an ad-hoc/
 * friendly match) for an authoritative check. Callers with no match context yet (e.g. a club's default-
 * lineup editor, not tied to any one fixture) can omit it — that conservatively treats a suspension in
 * ANY competition as blocking, since it's not yet known which competition this lineup will be used for.
 */
export function isPlayerAvailable(player: Player, competitionId?: string | null): boolean {
  if (player.injuryWeeks > 0) return false;
  if (competitionId === undefined) {
    return !player.suspensions.some((s) => s.matchesRemaining > 0);
  }
  return !player.suspensions.some((s) => s.matchesRemaining > 0 && s.competitionId === competitionId);
}

export function isEliteQuality(overall: number, starLevel: StarLevel): boolean {
  return overall >= ELITE_OVERALL_THRESHOLD || starLevel !== 'NONE';
}

/** Multiplier applied to every raw attribute in the simulation: força gates how much skill actually shows up. */
export function talentGate(overall: number): number {
  const clamped = Math.max(1, Math.min(99, overall));
  return 0.5 + 0.5 * (clamped / 99);
}

/**
 * Age-driven performance multiplier. Flat 1.0 across the physical prime (24-29). Outside that window,
 * elite players (high overall or any star level) get a flatter curve in both directions: young prodigies
 * ramp up faster, veteran stars decline slower.
 */
export function ageFactor(age: number, overall: number, starLevel: StarLevel): number {
  const attenuation = isEliteQuality(overall, starLevel) ? 0.5 : 1;

  if (age >= PEAK_AGE_START && age <= PEAK_AGE_END) return 1;

  if (age < PEAK_AGE_START) {
    const yearsBelowPeak = PEAK_AGE_START - age;
    return Math.max(0.7, 1 - yearsBelowPeak * YOUNG_PENALTY_PER_YEAR * attenuation);
  }

  const yearsAbovePeak = age - PEAK_AGE_END;
  return Math.max(0.4, 1 - yearsAbovePeak * VETERAN_DECLINE_PER_YEAR * attenuation);
}

/** Values overall/potential/star level rather than raw attributes: a rare prodigy is worth far more than the numbers alone suggest. */
export function calculateMarketValue(age: number, overall: number, potential: number, starLevel: StarLevel): number {
  const ageFactorValue = age <= 28 ? 1 - Math.max(0, 24 - age) * 0.02 : 1 - (age - 28) * 0.06;
  const clampedAgeFactor = Math.max(0.25, Math.min(1, ageFactorValue));

  const potentialBonus = 1 + Math.max(0, potential - overall) * 0.01;
  const starMultiplier = starLevel === 'NATURAL' ? 1.8 : starLevel === 'DEVELOPED' ? 1.5 : 1;

  const baseValue = Math.pow(overall / 50, 3) * 500_000;
  const value = baseValue * clampedAgeFactor * potentialBonus * starMultiplier;
  return Math.max(10_000, Math.round(value / 1000) * 1000);
}

const WAGE_RATE_OF_MARKET_VALUE = 0.005;
const MIN_WEEKLY_WAGE = 100;

/** Weekly wage, roughly proportional to market value — part of the club's payroll cost each finance tick. */
export function calculateWage(marketValue: number): number {
  return Math.max(MIN_WEEKLY_WAGE, Math.round((marketValue * WAGE_RATE_OF_MARKET_VALUE) / 10) * 10);
}

const RELEASE_CLAUSE_MULTIPLIER = 1.6;

/** Release clauses sit above market value on purpose — otherwise nobody would ever sell below it. */
export function calculateReleaseClause(marketValue: number): number {
  return Math.round((marketValue * RELEASE_CLAUSE_MULTIPLIER) / 1000) * 1000;
}

import { Club, STARTING_BUDGET, STARTING_STADIUM_CAPACITY, STARTING_STADIUM_LEVEL } from '../domain/club.js';
import { Player, PersonalityTrait, Position, StarLevel, calculateMarketValue, calculateOverall, calculateReleaseClause, calculateWage } from '../domain/player.js';
import { defaultDetailedAttributes } from '../domain/detailedAttributes.js';
import { Tactic } from '../domain/tactic.js';
import { createRng } from './rng.js';

const SQUAD_TEMPLATE: Position[] = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'ATT', 'ATT'];

export function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  const position: Position = overrides.position ?? 'MID';
  const attributes =
    overrides.attributes ?? {
      pace: 60,
      finishing: 60,
      passing: 60,
      defending: 60,
      physical: 60,
      goalkeeping: position === 'GK' ? 60 : 10,
    };
  const age = overrides.age ?? 26;
  const overall = overrides.overall ?? calculateOverall(position, attributes);
  const potential = overrides.potential ?? overall;
  const starLevel: StarLevel = overrides.starLevel ?? 'NONE';
  const marketValue = overrides.marketValue ?? calculateMarketValue(age, overall, potential, starLevel);

  return {
    id,
    name: overrides.name ?? `Player ${id}`,
    position,
    preferredFoot: overrides.preferredFoot ?? 'RIGHT',
    age,
    attributes,
    detailedAttributes: overrides.detailedAttributes ?? defaultDetailedAttributes(),
    morale: overrides.morale ?? 50,
    fatigue: overrides.fatigue ?? 0,
    commitment: overrides.commitment ?? 50,
    overall,
    potential,
    starLevel,
    traits: overrides.traits ?? [],
    functions: overrides.functions ?? [],
    developmentPoints: overrides.developmentPoints ?? 0,
    trainingFocus: overrides.trainingFocus ?? null,
    suspensions: overrides.suspensions ?? [],
    injuryWeeks: overrides.injuryWeeks ?? 0,
    nationality: overrides.nationality ?? 'BRA',
    marketValue,
    wage: overrides.wage ?? calculateWage(marketValue),
    releaseClause: overrides.releaseClause ?? calculateReleaseClause(marketValue),
    seasonGoals: overrides.seasonGoals ?? 0,
    seasonAssists: overrides.seasonAssists ?? 0,
    seasonMatches: overrides.seasonMatches ?? 0,
    careerGoals: overrides.careerGoals ?? 0,
    careerAssists: overrides.careerAssists ?? 0,
    careerMatches: overrides.careerMatches ?? 0,
    /**
     * Campos que a fábrica não conhece pelo nome, repassados como vieram.
     *
     * Cada campo novo do jogador tinha de ser acrescentado aqui à mão, e esquecer um faz o teste mentir em
     * silêncio: um `contractUntil` passado nas opções e descartado aqui fazia o teste de renovação verificar
     * um jogador sem contrato e passar pelo motivo errado.
     *
     * As chaves com valor `undefined` são retiradas antes: espalhar `{ traits: undefined }` por cima
     * apagaria o padrão calculado e o motor estoura ao ler `traits.includes`.
     */
    ...Object.fromEntries(Object.entries(overrides).filter(([, valor]) => valor !== undefined)),
  };
}

interface MakeClubOptions {
  seed?: string;
  age?: number;
  starLevel?: StarLevel;
  traits?: PersonalityTrait[];
  captainPlayerId?: string | null;
  captainWeeksServed?: number;
  tutorPlayerId?: string | null;
  country?: string;
}

/** Builds a club with a fixed 4-4-2 lineup where every player's attributes are close to `skillLevel` (0-99). */
export function makeClub(id: string, name: string, skillLevel: number, options: MakeClubOptions = {}): Club {
  const rng = createRng(options.seed ?? id);
  const jitter = () => Math.max(1, Math.min(99, Math.round(skillLevel + (rng() - 0.5) * 10)));

  const players: Player[] = SQUAD_TEMPLATE.map((position, index) => {
    const age = options.age ?? 20 + Math.round(rng() * 15);
    const attributes = {
      pace: jitter(),
      finishing: jitter(),
      passing: jitter(),
      defending: jitter(),
      physical: jitter(),
      goalkeeping: position === 'GK' ? jitter() : 10,
    };

    return makePlayer(`${id}-p${index}`, {
      name: `${name} Player ${index + 1}`,
      position,
      age,
      attributes,
      starLevel: options.starLevel,
      traits: options.traits,
    });
  });

  return {
    id,
    name,
    ownerId: `${id}-owner`,
    slug: null,
    pendingRoundTactic: null,
    country: options.country ?? 'BRA',
    players,
    academyPlayers: [],
    budget: STARTING_BUDGET,
    captainPlayerId: options.captainPlayerId ?? null,
    captainWeeksServed: options.captainWeeksServed ?? 0,
    tutorPlayerId: options.tutorPlayerId ?? null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: STARTING_STADIUM_LEVEL,
    stadiumCapacity: STARTING_STADIUM_CAPACITY,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
  };
}

export function makeTactic(club: Club, overrides: Partial<Tactic> = {}): Tactic {
  return {
    clubId: club.id,
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'BALANCED',
    attackApproach: 'COUNTER_ATTACK',
    lineup: club.players.map((p) => ({ playerId: p.id })),
    substitutes: [],
    plannedSubstitutions: [],
    ...overrides,
  };
}

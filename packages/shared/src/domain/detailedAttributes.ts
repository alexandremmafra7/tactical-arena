import type { Position, PlayerFunction } from './player.js';

/**
 * A deeper, position-flavored attribute model layered on top of the six generic simulation
 * attributes (see PlayerAttributes in player.ts) - ported from the "Atributos Jogadores" design
 * spreadsheet. Purely descriptive/scouting depth for now: it feeds the player detail view and
 * function-fit scoring, but does NOT (yet) feed calculateOverall or the match simulation, which
 * keep using the original 6-attribute model unchanged.
 */
export type DetailedAttribute =
  | 'ACCELERATION'
  | 'AERIAL_CLAIMING'
  | 'AEROBIC_STAMINA'
  | 'AGILITY'
  | 'ANTICIPATION'
  | 'BALANCE'
  | 'BALL_CONTROL'
  | 'BALL_RECOVERY'
  | 'BUILD_UP_PLAY'
  | 'COORDINATION'
  | 'COVERING'
  | 'CROSSING'
  | 'CURLED_SHOTS'
  | 'DEFENSIVE_TRACKING'
  | 'DISTRIBUTION'
  | 'DRIBBLING'
  | 'EXPLOSIVENESS'
  | 'FEINTING'
  | 'FINISHING'
  | 'FLEXIBILITY'
  | 'FOOT_SKILLS'
  | 'FREE_KICKS'
  | 'HANDLING'
  | 'HEADING'
  | 'HEIGHT_REACH'
  | 'INTERCEPTION'
  | 'JUMPING'
  | 'LONG_PASSING'
  | 'LONG_SHOTS'
  | 'MARKING'
  | 'MOBILITY'
  | 'OFF_BALL_MOVEMENT'
  | 'ONE_ON_ONE'
  | 'PACE'
  | 'PASSING'
  | 'PENALTY_SAVING'
  | 'PENALTY_TAKING'
  | 'POWER'
  | 'REBOUNDS'
  | 'REFLEXES'
  | 'SHOT_POWER'
  | 'STAMINA'
  | 'STRENGTH'
  | 'STRENGTH_STAMINA'
  | 'TACKLING'
  | 'THROUGH_BALLS'
  | 'TURNING'
  | 'VISION';

/**
 * The 7 role profiles from the spreadsheet - finer-grained than Position: MID splits into
 * VOLANTE/MEIA, ATT splits into PONTA/CENTROAVANTE, matching the PlayerFunction system.
 */
export type AttributeRole = 'GK' | 'DEF' | 'LAT' | 'VOLANTE' | 'MEIA' | 'PONTA' | 'CENTROAVANTE';

export const ALL_DETAILED_ATTRIBUTES: DetailedAttribute[] = [
  'ACCELERATION', 'AERIAL_CLAIMING', 'AEROBIC_STAMINA', 'AGILITY', 'ANTICIPATION', 'BALANCE', 'BALL_CONTROL', 'BALL_RECOVERY', 'BUILD_UP_PLAY', 'COORDINATION', 'COVERING', 'CROSSING', 'CURLED_SHOTS', 'DEFENSIVE_TRACKING', 'DISTRIBUTION', 'DRIBBLING', 'EXPLOSIVENESS', 'FEINTING', 'FINISHING', 'FLEXIBILITY', 'FOOT_SKILLS', 'FREE_KICKS', 'HANDLING', 'HEADING', 'HEIGHT_REACH', 'INTERCEPTION', 'JUMPING', 'LONG_PASSING', 'LONG_SHOTS', 'MARKING', 'MOBILITY', 'OFF_BALL_MOVEMENT', 'ONE_ON_ONE', 'PACE', 'PASSING', 'PENALTY_SAVING', 'PENALTY_TAKING', 'POWER', 'REBOUNDS', 'REFLEXES', 'SHOT_POWER', 'STAMINA', 'STRENGTH', 'STRENGTH_STAMINA', 'TACKLING', 'THROUGH_BALLS', 'TURNING', 'VISION',
];

export const DETAILED_ATTRIBUTE_LABELS: Record<DetailedAttribute, string> = {
  ACCELERATION: 'Aceleração',
  AERIAL_CLAIMING: 'Jogo aéreo',
  AEROBIC_STAMINA: 'Resistência aeróbica',
  AGILITY: 'Agilidade',
  ANTICIPATION: 'Antecipação',
  BALANCE: 'Equilíbrio',
  BALL_CONTROL: 'Controle de bola',
  BALL_RECOVERY: 'Recuperação de bola',
  BUILD_UP_PLAY: 'Saída de bola',
  COORDINATION: 'Coordenação',
  COVERING: 'Cobertura',
  CROSSING: 'Cruzamento',
  CURLED_SHOTS: 'Chute de curva',
  DEFENSIVE_TRACKING: 'Recuo defensivo',
  DISTRIBUTION: 'Reposição de bola',
  DRIBBLING: 'Drible',
  EXPLOSIVENESS: 'Explosão',
  FEINTING: 'Finta',
  FINISHING: 'Finalização',
  FLEXIBILITY: 'Flexibilidade',
  FOOT_SKILLS: 'Jogo com os pés',
  FREE_KICKS: 'Batedor de faltas',
  HANDLING: 'Pegada',
  HEADING: 'Cabeceio',
  HEIGHT_REACH: 'Altura/Envergadura',
  INTERCEPTION: 'Interceptação',
  JUMPING: 'Impulsão',
  LONG_PASSING: 'Passe longo',
  LONG_SHOTS: 'Chute de longa distância',
  MARKING: 'Marcação',
  MOBILITY: 'Mobilidade',
  OFF_BALL_MOVEMENT: 'Movimentação',
  ONE_ON_ONE: 'Defesa no mano a mano',
  PACE: 'Velocidade',
  PASSING: 'Passe',
  PENALTY_SAVING: 'Pegador de pênalti',
  PENALTY_TAKING: 'Pênaltis',
  POWER: 'Potência',
  REBOUNDS: 'Pós-jogada',
  REFLEXES: 'Reflexo',
  SHOT_POWER: 'Chute',
  STAMINA: 'Resistência',
  STRENGTH: 'Força',
  STRENGTH_STAMINA: 'Resistência de força',
  TACKLING: 'Desarme',
  THROUGH_BALLS: 'Lançamento',
  TURNING: 'Giro',
  VISION: 'Visão de jogo',
};

export const DETAILED_ATTRIBUTE_TYPE: Record<DetailedAttribute, 'FISICO' | 'TECNICO'> = {
  ACCELERATION: 'FISICO',
  AERIAL_CLAIMING: 'TECNICO',
  AEROBIC_STAMINA: 'FISICO',
  AGILITY: 'FISICO',
  ANTICIPATION: 'FISICO',
  BALANCE: 'FISICO',
  BALL_CONTROL: 'TECNICO',
  BALL_RECOVERY: 'TECNICO',
  BUILD_UP_PLAY: 'TECNICO',
  COORDINATION: 'FISICO',
  COVERING: 'TECNICO',
  CROSSING: 'TECNICO',
  CURLED_SHOTS: 'TECNICO',
  DEFENSIVE_TRACKING: 'TECNICO',
  DISTRIBUTION: 'TECNICO',
  DRIBBLING: 'TECNICO',
  EXPLOSIVENESS: 'FISICO',
  FEINTING: 'TECNICO',
  FINISHING: 'TECNICO',
  FLEXIBILITY: 'FISICO',
  FOOT_SKILLS: 'TECNICO',
  FREE_KICKS: 'TECNICO',
  HANDLING: 'TECNICO',
  HEADING: 'TECNICO',
  HEIGHT_REACH: 'FISICO',
  INTERCEPTION: 'TECNICO',
  JUMPING: 'FISICO',
  LONG_PASSING: 'TECNICO',
  LONG_SHOTS: 'TECNICO',
  MARKING: 'TECNICO',
  MOBILITY: 'FISICO',
  OFF_BALL_MOVEMENT: 'TECNICO',
  ONE_ON_ONE: 'TECNICO',
  PACE: 'FISICO',
  PASSING: 'TECNICO',
  PENALTY_SAVING: 'TECNICO',
  PENALTY_TAKING: 'TECNICO',
  POWER: 'FISICO',
  REBOUNDS: 'TECNICO',
  REFLEXES: 'TECNICO',
  SHOT_POWER: 'TECNICO',
  STAMINA: 'FISICO',
  STRENGTH: 'FISICO',
  STRENGTH_STAMINA: 'FISICO',
  TACKLING: 'TECNICO',
  THROUGH_BALLS: 'TECNICO',
  TURNING: 'TECNICO',
  VISION: 'TECNICO',
};

export const DETAILED_ATTRIBUTE_DESCRIPTIONS: Record<DetailedAttribute, string> = {
  ACCELERATION: 'Pontas de velocidade em curtos espaços',
  AERIAL_CLAIMING: 'Sair da área e interceptar cruzamentos',
  AEROBIC_STAMINA: 'Vai e volta pelo corredor o jogo inteiro',
  AGILITY: 'Reagir a deflexões e rebotes em frações de segundo',
  ANTICIPATION: 'Ler o jogo para cortar passes e lançamentos',
  BALANCE: 'Manter o controle de bola em contato físico',
  BALL_CONTROL: 'Receber e proteger a bola sob pressão',
  BALL_RECOVERY: 'Pressionar e recuperar a posse rapidamente',
  BUILD_UP_PLAY: 'Passes limpos desde a defesa sem erro',
  COORDINATION: 'Sequência de toques rápidos sob pressão',
  COVERING: 'Cobrir o companheiro quando ele sai da posição',
  CROSSING: 'Bater a bola na área com precisão e qualidade',
  CURLED_SHOTS: 'Finalizações com efeito cortando para o meio',
  DEFENSIVE_TRACKING: 'Voltar rapidamente e recompor a linha defensiva',
  DISTRIBUTION: 'Lançar com as mãos e pés para iniciar contra-ataques',
  DRIBBLING: 'Principal atributo - superar marcadores em velocidade e fintas',
  EXPLOSIVENESS: 'Sair rápido no mano a mano e cobrir o gol em arremessos',
  FEINTING: 'Gestos técnicos para iludir o marcador',
  FINISHING: 'Principal atributo - concluir jogadas com precisão',
  FLEXIBILITY: 'Alcançar bolas nos cantos com alongamento máximo',
  FOOT_SKILLS: 'Participar da saída de bola e passes de qualidade',
  FREE_KICKS: 'Cobranças com técnica e precisão',
  HANDLING: 'Segurar a bola limpa em finalizações rotineiras',
  HEADING: 'Desarmar aéreo defensivo e afastar cruzamentos',
  HEIGHT_REACH: 'Alcance físico natural do goleiro',
  INTERCEPTION: 'Cortar passes e lanços no caminho',
  JUMPING: 'Domina em bolas paradas e cruzamentos',
  LONG_PASSING: 'Lançar bolas para frente com precisão',
  LONG_SHOTS: 'Finalizar de fora da área quando há espaço',
  MARKING: 'Posicionar-se e anular o atacante adversário',
  MOBILITY: 'Transições rápidas entre defesa e ataque',
  OFF_BALL_MOVEMENT: 'Desmarcar-se e encontrar espaços na defesa',
  ONE_ON_ONE: 'Fechar o ângulo e anular o atacante',
  PACE: 'Apoiar o ataque e voltar rapidamente',
  PASSING: 'Distribuição curta e longa com qualidade e visão de jogo',
  PENALTY_SAVING: 'Ler a cobrança e defender pênaltis',
  PENALTY_TAKING: 'Batedor de pênaltis com técnica e frieza',
  POWER: 'Lançamentos longos e finalizações de fora da área',
  REBOUNDS: 'Ser o primeiro a reagir a rebotes e bolas soltas na área',
  REFLEXES: 'Reação instintiva em finalizações de perto',
  SHOT_POWER: 'Finalizações fortes e precisas de qualquer distância',
  STAMINA: 'Cobrir grandes áreas do campo',
  STRENGTH: 'Duelos corpo a corpo e imposição física no jogo aéreo',
  STRENGTH_STAMINA: 'Disputas frequentes com pontas adversários',
  TACKLING: 'Entrada precisa e limpa no meio-campo',
  THROUGH_BALLS: 'Passes profundos e enfiados para os atacantes',
  TURNING: 'Girar rapidamente sobre o marcador e finalizar',
  VISION: 'Enxergar jogadas e espaços antes dos outros',
};

/** Importance (1-5) of each attribute per role, straight from the design spreadsheet - an
 *  attribute missing from a role here is irrelevant to it and generation floors it low. */
export const ATTRIBUTE_WEIGHT_BY_ROLE: Record<AttributeRole, Partial<Record<DetailedAttribute, number>>> = {
  GK: {
    AGILITY: 5,
    EXPLOSIVENESS: 5,
    FLEXIBILITY: 5,
    COORDINATION: 4,
    HEIGHT_REACH: 5,
    REFLEXES: 5,
    ONE_ON_ONE: 5,
    AERIAL_CLAIMING: 4,
    HANDLING: 4,
    DISTRIBUTION: 4,
    PENALTY_SAVING: 3,
    FOOT_SKILLS: 3,
  },
  DEF: {
    STRENGTH: 5,
    JUMPING: 5,
    STAMINA: 4,
    PACE: 4,
    ANTICIPATION: 5,
    HEADING: 5,
    TACKLING: 4,
    MARKING: 5,
    INTERCEPTION: 5,
    BUILD_UP_PLAY: 4,
    LONG_PASSING: 3,
    COVERING: 4,
  },
  LAT: {
    AEROBIC_STAMINA: 5,
    PACE: 5,
    ACCELERATION: 5,
    AGILITY: 4,
    STRENGTH_STAMINA: 4,
    CROSSING: 5,
    DRIBBLING: 4,
    PASSING: 4,
    TACKLING: 4,
    MARKING: 5,
    DEFENSIVE_TRACKING: 5,
    FINISHING: 2,
  },
  VOLANTE: {
    STAMINA: 5,
    STRENGTH: 5,
    COORDINATION: 4,
    MOBILITY: 4,
    POWER: 3,
    TACKLING: 5,
    INTERCEPTION: 5,
    PASSING: 5,
    HEADING: 3,
    MARKING: 5,
    BALL_RECOVERY: 5,
    LONG_SHOTS: 3,
    BALL_CONTROL: 4,
  },
  MEIA: {
    AGILITY: 5,
    ACCELERATION: 4,
    COORDINATION: 5,
    STAMINA: 4,
    BALANCE: 4,
    PASSING: 5,
    VISION: 5,
    DRIBBLING: 4,
    FINISHING: 4,
    BALL_CONTROL: 5,
    LONG_SHOTS: 3,
    FREE_KICKS: 2,
    THROUGH_BALLS: 4,
    HEADING: 2,
  },
  PONTA: {
    PACE: 5,
    ACCELERATION: 5,
    AGILITY: 5,
    COORDINATION: 5,
    STAMINA: 4,
    DRIBBLING: 5,
    CROSSING: 4,
    FINISHING: 4,
    PASSING: 3,
    BALL_CONTROL: 5,
    FEINTING: 4,
    CURLED_SHOTS: 3,
    DEFENSIVE_TRACKING: 2,
  },
  CENTROAVANTE: {
    EXPLOSIVENESS: 5,
    STRENGTH: 4,
    JUMPING: 5,
    AGILITY: 4,
    ACCELERATION: 5,
    FINISHING: 5,
    HEADING: 5,
    SHOT_POWER: 5,
    PENALTY_TAKING: 3,
    BALL_CONTROL: 4,
    DRIBBLING: 3,
    PASSING: 3,
    OFF_BALL_MOVEMENT: 5,
    TURNING: 4,
    REBOUNDS: 4,
  },
};

/**
 * Maps a player's base position + assigned tactical functions to the weight profile that best
 * fits them. Functions are a coach's later choice, so at generation time (no functions yet)
 * MID/ATT always fall back to their default all-round profile (MEIA / CENTROAVANTE).
 */
export function resolveAttributeRole(position: Position, functions: PlayerFunction[] = []): AttributeRole {
  if (position === 'GK') return 'GK';
  if (position === 'DEF') return 'DEF';
  if (position === 'LAT') return 'LAT';
  if (position === 'MID') {
    if (functions.includes('VOLANTE')) return 'VOLANTE';
    return 'MEIA';
  }
  if (functions.includes('PONTA')) return 'PONTA';
  return 'CENTROAVANTE';
}

const BASE_BY_WEIGHT: Record<number, number> = { 5: 68, 4: 58, 3: 48, 2: 38, 1: 25 };
const SPREAD_BY_WEIGHT: Record<number, number> = { 5: 22, 4: 22, 3: 20, 2: 16, 1: 10 };

/**
 * Rolls all 48 named attributes for a player, biased by how much their role's weight table
 * (1-5) values each one - attributes irrelevant to the role land low, near the floor.
 */
export function generateDetailedAttributes(role: AttributeRole, rng: () => number): Record<DetailedAttribute, number> {
  const weights = ATTRIBUTE_WEIGHT_BY_ROLE[role];
  const result = {} as Record<DetailedAttribute, number>;
  for (const key of ALL_DETAILED_ATTRIBUTES) {
    const weight = weights[key] ?? 1;
    const base = BASE_BY_WEIGHT[weight];
    const spread = SPREAD_BY_WEIGHT[weight];
    result[key] = Math.max(1, Math.min(99, Math.round(base + (rng() - 0.5) * spread)));
  }
  return result;
}

/** Flat default (no role bias) - used where a real generation roll doesn't apply, e.g. test fixtures. */
export function defaultDetailedAttributes(value = 50): Record<DetailedAttribute, number> {
  const result = {} as Record<DetailedAttribute, number>;
  for (const key of ALL_DETAILED_ATTRIBUTES) result[key] = value;
  return result;
}

/**
 * How well a set of detailed attributes fits a role's ideal profile, 0-99 (weighted average
 * against that role's attribute weights). Purely informational - helps a coach pick which
 * function to assign a player, no effect on match simulation.
 */
export function roleFitScore(attributes: Record<DetailedAttribute, number>, role: AttributeRole): number {
  const weights = ATTRIBUTE_WEIGHT_BY_ROLE[role];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of Object.keys(weights) as DetailedAttribute[]) {
    const weight = weights[key]!;
    weightedSum += attributes[key] * weight;
    totalWeight += weight;
  }
  return totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight);
}

/** Which AttributeRole a given PlayerFunction corresponds to, for role-fit scoring in the UI. */
export const ROLE_BY_FUNCTION: Record<PlayerFunction, AttributeRole> = {
  LATERAL: 'LAT',
  ALA: 'LAT',
  VOLANTE: 'VOLANTE',
  MEIA_CRIACAO: 'MEIA',
  CENTROAVANTE: 'CENTROAVANTE',
  PONTA: 'PONTA',
  SEGUNDO_ATACANTE: 'CENTROAVANTE',
  ZAGUEIRO_REBATEDOR: 'DEF',
  ZAGUEIRO_CONSTRUTOR: 'DEF',
  LATERAL_CONSTRUTOR: 'LAT',
  ALA_OFENSIVO: 'LAT',
  VOLANTE_CAO_DE_GUARDA: 'VOLANTE',
  MEIA_BOX_TO_BOX: 'VOLANTE',
  MEIA_ARMADOR: 'MEIA',
  PONTA_INVERTIDO: 'PONTA',
  PONTA_LINHA_DE_FUNDO: 'PONTA',
  CENTROAVANTE_REFERENCIA: 'CENTROAVANTE',
  FALSO_NOVE: 'CENTROAVANTE',
};

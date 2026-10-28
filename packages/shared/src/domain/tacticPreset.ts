import type { LineupSlot, Tactic } from './tactic.js';

/** A named, saved `Tactic` a manager can re-apply at any time instead of reconfiguring from scratch. */
export interface TacticPreset {
  id: string;
  clubId: string;
  name: string;
  formation: Tactic['formation'];
  mentality: Tactic['mentality'];
  attackStyle: Tactic['attackStyle'];
  markingStyle: Tactic['markingStyle'];
  attackApproach: Tactic['attackApproach'];
  pressing: NonNullable<Tactic['pressing']>;
  /** Optional because club-owned presets saved before Sprint 2 do not carry this dial. */
  transitionStyle?: Tactic['transitionStyle'];
  /** Optional because club-owned presets saved before Sprint 2 do not carry this dial. */
  restDefenceShape?: Tactic['restDefenceShape'];
  /** Optional because club-owned presets saved before the line-height control do not carry this dial. */
  defensiveLine?: Tactic['defensiveLine'];
  lineup: LineupSlot[];
  /** The bench saved alongside the lineup — so a manager sets XI + substitutes once and both stick
   *  together as their standing tactic, instead of the bench resetting to empty every match. */
  substitutes: LineupSlot[];
  /** When true, league/cup fixtures use this preset instead of auto-filling the lineup. At most one per club. */
  isDefault: boolean;
}

/** Controls every complete tactic must define, excluding club/squad state and optional set-piece choices. */
export type TacticControl = Exclude<
  keyof Tactic,
  'clubId' | 'lineup' | 'substitutes' | 'plannedSubstitutions' | `${string}TakerId`
>;

/** A game-authored tactical template, independent of any club, XI or saved-preset state. */
export type CanonicalTacticPreset = {
  readonly id: string;
  readonly name: string;
} & {
  readonly [Control in TacticControl]-?: Tactic[Control];
};

export const CANONICAL_TACTIC_PRESETS: readonly CanonicalTacticPreset[] = [
  {
    id: 'tiki-taka',
    name: 'Tiki-Taka',
    formation: '4-3-3',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'ZONAL',
    attackApproach: 'BALANCED',
    pressing: 'HIGH_PRESS',
    transitionStyle: 'COUNTERPRESS',
    restDefenceShape: '3+2',
    defensiveLine: 'HIGH'
  },
  {
    id: 'gegenpressing',
    name: 'Gegenpressing',
    formation: '4-2-3-1',
    mentality: 'attacking',
    attackStyle: 'BALANCED',
    markingStyle: 'HEAVY',
    attackApproach: 'TOTAL_ATTACK',
    pressing: 'HIGH_PRESS',
    transitionStyle: 'COUNTERPRESS',
    restDefenceShape: '2+3',
    defensiveLine: 'HIGH'
  },
  {
    id: 'low-block-counter',
    name: 'Bloco Baixo & Contra-Golpe',
    formation: '5-3-2',
    mentality: 'defensive',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'ZONAL',
    attackApproach: 'COUNTER_ATTACK',
    pressing: 'LOW_BLOCK',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'DEEP'
  },
  {
    id: 'wing-play',
    name: 'Ataque pelas Pontas',
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'WINGS',
    markingStyle: 'BALANCED',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'BALANCED'
  },
  {
    id: 'midfield-diamond',
    name: 'Controle de Meio-Campo (Losango)',
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'ZONAL',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'BALANCED'
  },
  {
    id: 'total-football',
    name: 'Ataque Total',
    formation: '3-4-3',
    mentality: 'attacking',
    attackStyle: 'BALANCED',
    markingStyle: 'HEAVY',
    attackApproach: 'TOTAL_ATTACK',
    pressing: 'HIGH_PRESS',
    transitionStyle: 'COUNTERPRESS',
    restDefenceShape: '2+3',
    defensiveLine: 'HIGH'
  },
  {
    id: 'catenaccio',
    name: 'Catenaccio',
    formation: '5-3-2',
    mentality: 'defensive',
    attackStyle: 'BALANCED',
    markingStyle: 'MAN_MARKING',
    attackApproach: 'COUNTER_ATTACK',
    pressing: 'LOW_BLOCK',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'DEEP'
  },
  {
    id: 'balanced-transition',
    name: 'Transição Equilibrada',
    formation: '4-1-4-1',
    mentality: 'balanced',
    attackStyle: 'BALANCED',
    markingStyle: 'BALANCED',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'BALANCED'
  },
];
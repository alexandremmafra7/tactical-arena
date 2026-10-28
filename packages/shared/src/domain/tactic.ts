import type { Position } from './player.js';

export type Formation =
  | '4-4-2'
  | '4-3-3'
  | '3-5-2'
  | '5-3-2'
  | '4-2-3-1'
  | '4-1-4-1'
  | '3-4-3'
  | '4-4-1'
  | '5-3-1'
  | '4-3-2'
  | '3-4-2'
  | '4-5-0';

export const STANDARD_FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-2-3-1', '4-1-4-1', '3-4-3'];
export const CONTINGENCY_FORMATIONS: Formation[] = ['4-4-1', '5-3-1', '4-3-2', '3-4-2', '4-5-0'];
export const ALL_FORMATIONS: Formation[] = [...STANDARD_FORMATIONS, ...CONTINGENCY_FORMATIONS];

export function isContingencyFormation(formation: Formation): boolean {
  return CONTINGENCY_FORMATIONS.includes(formation);
}

/** Which base `Position` each of a formation's lineup slots represents, in the same slot order the
 *  web pitch editor (`PitchField.tsx`) and `Tactic.lineup` both already use. */
export const FORMATION_POSITIONS: Record<Formation, Position[]> = {
  // Standard 11-player formations
  '4-4-2': ['GK', 'LAT', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'MID', 'ATT', 'ATT'],
  '4-3-3': ['GK', 'LAT', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'ATT', 'ATT', 'ATT'],
  '3-5-2': ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'ATT', 'ATT'],
  '5-3-2': ['GK', 'LAT', 'DEF', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'ATT', 'ATT'],
  '4-2-3-1': ['GK', 'LAT', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'MID', 'MID', 'ATT'],
  '4-1-4-1': ['GK', 'LAT', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'MID', 'MID', 'ATT'],
  '3-4-3': ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'ATT', 'ATT', 'ATT'],

  // Contingency 10-player formations (for red cards / numerical disadvantage)
  '4-4-1': ['GK', 'LAT', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'MID', 'ATT'],
  '5-3-1': ['GK', 'LAT', 'DEF', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'ATT'],
  '4-3-2': ['GK', 'LAT', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'ATT', 'ATT'],
  '3-4-2': ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'ATT', 'ATT'],
  '4-5-0': ['GK', 'LAT', 'DEF', 'DEF', 'LAT', 'MID', 'MID', 'MID', 'MID', 'MID'],
};
export type Mentality = 'defensive' | 'balanced' | 'attacking';
export type AttackStyle = 'WINGS' | 'BALANCED' | 'THROUGH_MIDDLE';
export type MarkingStyle = 'LIGHT' | 'BALANCED' | 'HEAVY' | 'MAN_MARKING' | 'ZONAL';
export type AttackApproach = 'COUNTER_ATTACK' | 'BALANCED' | 'TOTAL_ATTACK';
/** Where the team wins the ball back: camped on its own box, halfway, or in the opponent's face. */
export type PressingIntensity = 'LOW_BLOCK' | 'MEDIUM' | 'HIGH_PRESS';
/** How a side reacts in the five seconds after losing the ball: hunt it back immediately, or fall back into shape. */
export type TransitionStyle = 'COUNTERPRESS' | 'RECOMPOSE';
/** The defensive block it holds behind the ball: 3+2 (three defenders, two midfield screens) or 2+3. */
export type RestDefenceShape = '3+2' | '2+3';
/** How high the defensive line sits: deep (protects the box), balanced, or high (pushes up to support the press). */
export type DefensiveLineHeight = 'DEEP' | 'BALANCED' | 'HIGH';

/**
 * Como cada opção tática se chama em português.
 *
 * O jogo vinha mostrando o valor cru ao jogador: "mentalidade balanced", "4-3-3 · attacking · HIGH_PRESS".
 * Enquanto isso só aparecia numa aba pouco visitada dava para conviver; na preleção, que é a tela onde o
 * técnico decide como entrar em campo, ler o enum do banco é pedir para ele não ler.
 */
export const MENTALITY_LABEL: Record<Mentality, string> = {
  defensive: 'defensiva',
  balanced: 'equilibrada',
  attacking: 'ofensiva',
};

export const ATTACK_STYLE_LABEL: Record<AttackStyle, string> = {
  WINGS: 'jogo pelas pontas',
  BALANCED: 'ataque equilibrado',
  THROUGH_MIDDLE: 'jogo por dentro',
};

export const PRESSING_LABEL_PT: Record<PressingIntensity, string> = {
  LOW_BLOCK: 'bloco baixo',
  MEDIUM: 'bloco médio',
  HIGH_PRESS: 'pressão alta',
};
/** Which flank a lineup slot occupies — used to reward/penalize a mismatch with the player's preferredFoot. */
export type LineupSide = 'LEFT' | 'CENTER' | 'RIGHT';

export interface LineupSlot {
  playerId: string;
  /** Optional: absent for older stored tactics, or when the side genuinely doesn't apply. */
  side?: LineupSide;
  /**
   * Where on the pitch the manager actually parked this player, as percentages of the pitch box:
   * x=0 is the left touchline, y=0 is the opponent's goal line and y=100 is our own. Absent means
   * "wherever the formation puts this slot", which is the case for every tactic set before free
   * placement existed and for any slot the manager never dragged.
   *
   * This is NOT decoration. When present it overrides the formation's slot position everywhere it
   * matters (see `effectiveSlotPositions`), so a centre-back dropped on the edge of the opposing box
   * really is playing as a striker — and takes the out-of-position penalty for it.
   */
  x?: number;
  y?: number;
}

/**
 * Which `Position` a point on the pitch represents.
 *
 * The bands mirror where `FORMATION_COORDS` (web pitch editor) already places each line, so dropping a
 * player roughly where the formation would have put them yields exactly the position the formation
 * would have assigned. LAT is a DEF-band player hugging a touchline, which is how the formations
 * themselves distinguish the two (full-backs sit at x=15/85 on the same line as the centre-backs).
 */
export function positionFromPitchPoint(x: number, y: number): Position {
  if (y >= 88) return 'GK';
  if (y >= 66) return x <= 25 || x >= 75 ? 'LAT' : 'DEF';
  if (y >= 36) return 'MID';
  return 'ATT';
}

/**
 * The position each lineup slot actually plays, honouring free placement where the manager used it and
 * falling back to the formation otherwise. Everything that reasons about "what position is this player
 * filling" should go through here rather than reading `FORMATION_POSITIONS` directly, or a dragged
 * player would look repositioned on screen while the simulation quietly kept using the old slot.
 */
export function effectiveSlotPositions(tactic: Pick<Tactic, 'formation' | 'lineup'>): Position[] {
  const fromFormation = FORMATION_POSITIONS[tactic.formation] ?? FORMATION_POSITIONS['4-4-2'];
  return tactic.lineup.map((slot, i) =>
    typeof slot.x === 'number' && typeof slot.y === 'number'
      ? positionFromPitchPoint(slot.x, slot.y)
      : (fromFormation[i] ?? 'MID'),
  );
}

/** A substitution the manager schedules ahead of kickoff, to take effect at a specific minute (46 = halftime). */
export interface PlannedSubstitution {
  id: string;
  minute: number;
  outPlayerId: string;
  inPlayerId: string;
}

export const MAX_SUBSTITUTIONS = 5;

const MATCH_MINUTES = 90;

/** Minutes each player in this matchday squad was actually on the pitch, derived from the lineup and planned substitutions. */
export function minutesPlayedByPlayerId(tactic: Tactic): Map<string, number> {
  const minutes = new Map<string, number>();
  for (const slot of tactic.lineup) {
    minutes.set(slot.playerId, MATCH_MINUTES);
  }
  for (const sub of tactic.plannedSubstitutions) {
    minutes.set(sub.outPlayerId, sub.minute);
    minutes.set(sub.inPlayerId, MATCH_MINUTES - sub.minute);
  }
  return minutes;
}

export interface Tactic {
  clubId: string;
  formation: Formation;
  mentality: Mentality;
  attackStyle: AttackStyle;
  markingStyle: MarkingStyle;
  attackApproach: AttackApproach;
  /** Optional: tactics stored before this dial existed read as DEFAULT_PRESSING (see `pressingOf`). */
  pressing?: PressingIntensity;
  /** How this side reacts to losing the ball — see `transitionStyleOf` for old-tactic fallback. */
  transitionStyle?: TransitionStyle;
  /** The defensive shape it holds in behind the ball — see `restDefenceShapeOf` for old-tactic fallback. */
  restDefenceShape?: RestDefenceShape;
  /** How high the defensive line sits: deep (protects the box), balanced, or high (pushes up to support the press). */
  defensiveLine?: DefensiveLineHeight;
  /** Exactly 11 player ids from the club's squad, one of which must play GK. */
  lineup: LineupSlot[];
  /** Bench: squad players eligible to come on as a substitute (not in `lineup`, not suspended). */
  substitutes: LineupSlot[];
  /** Up to MAX_SUBSTITUTIONS swaps, each tied to the minute it takes effect. 46 = "at halftime". */
  plannedSubstitutions: PlannedSubstitution[];
  /** Who takes a penalty for this team. Undefined = the engine auto-picks the best finisher on the pitch. */
  penaltyTakerId?: string;
}

export const MENTALITY_MODIFIERS: Record<Mentality, { attack: number; defense: number }> = {
  defensive: { attack: 0.90, defense: 1.28 },
  balanced: { attack: 1.0, defense: 1.0 },
  attacking: { attack: 1.25, defense: 0.85 },
};

/** WINGS leans on pace down the flanks; THROUGH_MIDDLE leans on passing/combination play centrally. */
/**
 * BALANCED applies no bias either way, for a squad that is neither wing-heavy nor built around a
 * playmaker. It is 1.05/1.05 rather than the obvious 1.0/1.0 because neither committed style is
 * weight-neutral: attack weighs passing at 0.3 and pace at 0.2, so WINGS totals 0.3(0.85) + 0.2(1.25) =
 * 0.505 and THROUGH_MIDDLE totals 0.545, while a flat 1.0/1.0 totals only 0.500 — strictly worse than
 * both, which would make the middle option a trap. 1.05 puts it on the real midpoint (0.525) while still
 * treating pace and passing equally. See teamStrength.test.ts, which pins exactly this.
 */
export const ATTACK_STYLE_MODIFIERS: Record<AttackStyle, { pace: number; passing: number }> = {
  WINGS: { pace: 1.25, passing: 0.85 },
  BALANCED: { pace: 1.05, passing: 1.05 },
  THROUGH_MIDDLE: { pace: 0.85, passing: 1.25 },
};

/** Heavier/individual marking wins more duels but concedes more fouls; lighter/zonal marking is the opposite trade. */
export const MARKING_STYLE_MODIFIERS: Record<MarkingStyle, { defense: number; foul: number }> = {
  LIGHT: { defense: 0.85, foul: 0.6 },
  BALANCED: { defense: 1.0, foul: 1.0 },
  HEAVY: { defense: 1.2, foul: 1.8 },
  MAN_MARKING: { defense: 1.1, foul: 1.3 },
  ZONAL: { defense: 1.05, foul: 0.8 },
};

/**
 * COUNTER_ATTACK trades chance volume for conversion efficiency and defensive shape; TOTAL_ATTACK is the
 * opposite trade. BALANCED sits on the exact midpoint of all three dials, which keeps it a genuine
 * compromise rather than a free lunch: expected goals land between the two (0.96 / 1.16 / 1.30, chance
 * times conversion) and so does defensive solidity (1.1 / 0.95 / 0.8), so neither committed approach is
 * ever strictly dominated by it.
 */
export const ATTACK_APPROACH_MODIFIERS: Record<AttackApproach, { chance: number; goal: number; defense: number }> = {
  COUNTER_ATTACK: { chance: 0.8, goal: 1.2, defense: 1.1 },
  BALANCED: { chance: 1.05, goal: 1.1, defense: 0.95 },
  TOTAL_ATTACK: { chance: 1.3, goal: 1.0, defense: 0.8 },
};

/**
 * Where the side tries to win the ball back, and what that costs.
 *
 * Pressing analytics (PPDA — passes the opponent completes before a defensive action) all point the same
 * way: pressing high wins the ball closer to the opponent's goal and creates more, but every body committed
 * forward can expose the defensive structure behind it. Line height now owns that channel explicitly (see
 * `DEFENSIVE_LINE_MODIFIERS`), while pressing still determines chance creation, defensive pressure and
 * physical cost. That cost is why `fatigue` is part of this record: a high press should be a
 * season-long commitment with a real bill, not a free tick-box.
 */
export const PRESSING_MODIFIERS: Record<
  PressingIntensity,
  { chance: number; defense: number; fatigue: number }
> = {
  LOW_BLOCK: { chance: 0.88, defense: 1.12, fatigue: 0.9 },
  MEDIUM: { chance: 1.0, defense: 1.0, fatigue: 1.0 },
  HIGH_PRESS: { chance: 1.15, defense: 0.9, fatigue: 1.18 },
};

/** Line height controls the channel behind the defence and how tightly it supports ball recovery. */
export const DEFENSIVE_LINE_MODIFIERS: Record<
  DefensiveLineHeight,
  { spaceBehind: number; recoverySupport: number }
> = {
  DEEP: { spaceBehind: 0.2, recoverySupport: 0.92 },
  BALANCED: { spaceBehind: 0.5, recoverySupport: 1 },
  HIGH: { spaceBehind: 0.9, recoverySupport: 1.17 },
};

/** Stored tactics predate this dial, so absent means the neutral middle rather than a crash. */
export const DEFAULT_PRESSING: PressingIntensity = 'MEDIUM';

export function pressingOf(tactic: { pressing?: PressingIntensity }): PressingIntensity {
  return tactic.pressing ?? DEFAULT_PRESSING;
}

/**
 * Stored tactics predate this dial. Old tactics that already pressed high with an attacking mentality
 * read as COUNTERPRESS (that combination was always the aggressive choice in spirit); every other old
 * tactic reads as RECOMPOSE, the safer default.
 */
export function transitionStyleOf(tactic: {
  transitionStyle?: TransitionStyle;
  pressing?: PressingIntensity;
  mentality: Mentality;
}): TransitionStyle {
  if (tactic.transitionStyle) return tactic.transitionStyle;
  return pressingOf(tactic) === 'HIGH_PRESS' && tactic.mentality === 'attacking' ? 'COUNTERPRESS' : 'RECOMPOSE';
}

/** Stored tactics predate this dial, so absent means the safer, least surprising defensive structure. */
export const DEFAULT_REST_DEFENCE_SHAPE: RestDefenceShape = '3+2';

export function restDefenceShapeOf(tactic: { restDefenceShape?: RestDefenceShape }): RestDefenceShape {
  return tactic.restDefenceShape ?? DEFAULT_REST_DEFENCE_SHAPE;
}

/** Stored tactics predate this dial, so infer the line that their old pressing choice implicitly carried. */
export function defensiveLineOf(tactic: {
  defensiveLine?: DefensiveLineHeight;
  pressing?: PressingIntensity;
}): DefensiveLineHeight {
  if (tactic.defensiveLine) return tactic.defensiveLine;
  const pressing = pressingOf(tactic);
  return pressing === 'HIGH_PRESS' ? 'HIGH' : pressing === 'LOW_BLOCK' ? 'DEEP' : 'BALANCED';
}

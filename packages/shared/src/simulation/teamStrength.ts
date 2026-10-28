import { Club, captainBonus } from '../domain/club.js';
import {
  Formation,
  LineupSide,
  LineupSlot,
  RestDefenceShape,
  Tactic,
  FORMATION_POSITIONS,
  effectiveSlotPositions,
  restDefenceShapeOf,
  MENTALITY_MODIFIERS,
  ATTACK_STYLE_MODIFIERS,
  MARKING_STYLE_MODIFIERS,
  ATTACK_APPROACH_MODIFIERS,
  MAX_SUBSTITUTIONS,
} from '../domain/tactic.js';
import { isPlayerAvailable, Player, Position, ageFactor, getPlayerTier, talentGate } from '../domain/player.js';
import { numericalDisadvantageFactors } from './numericalDisadvantage.js';
import { composure as composureOf } from './penalty.js';

/** A full side. Anything short of this is a numerical disadvantage (see `numericalDisadvantageFactors`). */
const FULL_SIDE = 11;

/** GK(0) — DEF(1) — LAT(2) — MID(3) — ATT(4): a defensive-to-attacking axis used purely to measure how
 *  far a player is being fielded from their natural position (see `positionMismatchFactor`). */
const POSITION_AXIS: Record<Position, number> = { GK: 0, DEF: 1, LAT: 2, MID: 3, ATT: 4 };

/** Every step away from a player's natural position costs a large chunk of effectiveness — the pitch
 *  editor lets a manager freely drop anyone anywhere (see PitchField.tsx), but doing so is a real gamble,
 *  not a free tactical tweak. 0.7 per step of distance: one step off (e.g. DEF at LAT) keeps ~70%, the
 *  extreme GK<->ATT swap keeps ~24% — exponential, not linear, so wildly-out-of-position picks are
 *  punished far harder than a merely-adjacent repositioning. */
const POSITION_MISMATCH_DECAY = 0.7;

/** Chance-creation multipliers for WINGS according to actual flank occupation. */
const WINGS_WITH_FLANK_COVERAGE = 1.06;
const WINGS_WITHOUT_FLANK_COVERAGE = 0.88;

/**
 * Measures whether the XI actually occupies a lateral corridor. Formation/free-placement decides the
 * effective role; only attackers need an explicit flank because a LAT slot is lateral by definition.
 */
export function calculateFlankCoverage(formation: Formation, lineup: LineupSlot[]): number {
  const positions = effectiveSlotPositions({ formation, lineup });
  const hasFlankCoverage = lineup.some(
    (slot, index) =>
      positions[index] === 'LAT' ||
      (positions[index] === 'ATT' && (slot.side === 'LEFT' || slot.side === 'RIGHT')),
  );
  return hasFlankCoverage ? WINGS_WITH_FLANK_COVERAGE : WINGS_WITHOUT_FLANK_COVERAGE;
}

/** How much of a player's normal effectiveness carries over when fielded at `slotPosition` instead of
 *  their own `nativePosition`. 1 when they match exactly. */
export function positionMismatchFactor(nativePosition: Position, slotPosition: Position, player?: Player): number {
  if (nativePosition === slotPosition) return 1.0;
  if (player?.secondaryPositions?.includes(slotPosition)) return 0.98;
  const distance = Math.abs(POSITION_AXIS[nativePosition] - POSITION_AXIS[slotPosition]);
  return POSITION_MISMATCH_DECAY ** distance;
}

/** "Star power" multiplier applied to a player's on-pitch contribution. Deliberately tiered and modest —
 *  the badge (getPlayerTier) is about display rarity; this is the on-pitch share of that rarity, so raw
 *  skill (talentGate) and age still dominate. A top-mundial NATURAL star ("muda jogos sozinho") bends the
 *  game around themselves more than a gold-star (90+) elite, who in turn bends it more than a
 *  double-chevron (85-89) elite — and a regular player gets no star boost at all. A CSV-marked
 *  "diferenciado" (see player.ts) lands on the BAITA tier ("Baita Jogador / Diferenciado"), the same 1.04
 *  edge an 85+ elite gets. */
export function starFactor(player: Player): number {
  if (player.starLevel === 'NATURAL') return 1.20;
  const tier = getPlayerTier(player.overall, player.starLevel, player.diferenciado, player.age, player.potential, player.name);
  if (tier === 'GENIO') return 1.15;
  if (tier === 'BAITA') return 1.08;
  return 1;
}

export interface TeamStrength {
  attack: number;
  defense: number;
  goalkeeping: number;
  /** Only those actually on the pitch — anyone sent off or injured-and-unreplaced is already excluded. */
  lineupPlayers: Player[];
  /** How many of the eleven are missing right now: 0 at full strength. */
  missingPlayers: number;
  /** Multiplier applied to this team's chance-creation probability in the match engine. */
  chanceModifier: number;
  /** Multiplier applied to this team's chance-to-goal conversion probability. */
  goalModifier: number;
  /** Multiplier applied to this team's baseline foul probability. */
  foulProbabilityModifier: number;
  /** WINGS chance creation reflects actual flank occupation; other attack styles remain neutral. */
  attackStyleCompatibility: number;
  /**
   * The purely tactical part of `attack` and `defense`, kept separately so the engine can work out what
   * this same side would have produced with neutral tactics.
   *
   * It needs that reference because tactical modifiers apply to both sides at once and multiply together:
   * two cautious line-ups compound into a match that is not football at all (measured: 0.47 goals and 62%
   * goalless when both sides sat deep). Dividing these out gives the engine the neutral figure to pull
   * the shared part of that back toward — see `dampenSharedTacticalVolume`. Deliberately excludes the
   * numerical-disadvantage factors, which are a red card, not a decision.
   */
  tacticalAttackMultiplier: number;
  tacticalDefenseMultiplier: number;
  /** How well the fielded XI matches its chosen `restDefenceShape` — see `computeRestDefenceCompatibility`. */
  restDefence: RestDefenceModifiers;
  /** Collective attributes averaged over on-pitch players only — the counterpress duel's inputs (see engine.ts). */
  teamwork: number;
  anticipation: number;
  firstTouch: number;
  composure: number;
}

/**
 * Tactical modifiers derived from how well the fielded XI matches its `restDefenceShape`, plus the raw
 * `compatibility` score (0-1) so callers/tests can explain the result. All three modifiers are neutral (1)
 * at zero compatibility and interpolate toward the shape's target as compatibility rises — see
 * `computeRestDefenceCompatibility`.
 */
export interface RestDefenceModifiers {
  /** Multiplies opponent central counterattack chance/goal probability. <1 = harder to breach centrally. */
  centralExposure: number;
  /** Multiplies this side's own chance-creation probability. >1 = better territorial control. */
  territorialRetention: number;
  /** Multiplies the counterattack-chance bonus this side concedes after a failed counterpress out wide. */
  flankVulnerability: number;
  /** 0 (no match) to 1 (full match) for the chosen shape. */
  compatibility: number;
}

export class LineupValidationError extends Error {}

/** `competitionId` should be the match's own `Match.competitionId` (null for an ad-hoc match) so a
 *  suspension earned in a different competition doesn't wrongly block this lineup. */
export function resolveLineupPlayers(club: Club, tactic: Tactic, competitionId: string | null = null): Player[] {
  const byId = new Map(club.players.map((p) => [p.id, p]));
  const players = tactic.lineup
    .map((slot) => byId.get(slot.playerId))
    .filter((p): p is Player => !!p);

  const seen = new Set<string>();
  const duplicated = players.find((p) => {
    if (seen.has(p.id)) return true;
    seen.add(p.id);
    return false;
  });
  if (duplicated) {
    throw new LineupValidationError(`Escalação inválida: ${duplicated.name} aparece mais de uma vez no XI.`);
  }

  const unavailable = players.filter((p) => !isPlayerAvailable(p, competitionId));
  if (unavailable.length > 0) {
    throw new LineupValidationError(`Lineup includes suspended or injured players: ${unavailable.map((p) => p.name).join(', ')}`);
  }

  const expectedCount = FORMATION_POSITIONS[tactic.formation]?.length ?? 11;
  if (players.length !== expectedCount) {
    throw new LineupValidationError(`Lineup must contain exactly ${expectedCount} valid players from club ${club.id}, got ${players.length}`);
  }

  return players;
}

/**
 * Validates the bench and the planned-substitution schedule submitted alongside a tactic.
 * v1 rule (deliberately simple — full substitution rules are a future round): each of the 11
 * starters can only go "out" once, each bench player can only come "in" once, no mid-swap chaining.
 */
export function validateSubstitutesAndPlan(club: Club, tactic: Tactic, competitionId: string | null = null): void {
  const lineupIds = new Set(tactic.lineup.map((slot) => slot.playerId));
  const byId = new Map(club.players.map((p) => [p.id, p]));

  const substitutes = tactic.substitutes
    .map((slot) => byId.get(slot.playerId))
    .filter((p): p is Player => !!p);
  if (substitutes.length !== tactic.substitutes.length) {
    throw new LineupValidationError('Substitutes include players outside this club\'s squad');
  }
  const unavailableSubs = substitutes.filter((p) => !isPlayerAvailable(p, competitionId));
  if (unavailableSubs.length > 0) {
    throw new LineupValidationError(`Substitutes include suspended or injured players: ${unavailableSubs.map((p) => p.name).join(', ')}`);
  }
  const substituteIds = new Set(substitutes.map((p) => p.id));
  for (const id of substituteIds) {
    if (lineupIds.has(id)) {
      throw new LineupValidationError('A player cannot be both a starter and a substitute');
    }
  }

  if (tactic.plannedSubstitutions.length > MAX_SUBSTITUTIONS) {
    throw new LineupValidationError(`No more than ${MAX_SUBSTITUTIONS} substitutions are allowed`);
  }

  const usedOutIds = new Set<string>();
  const usedInIds = new Set<string>();
  for (const sub of tactic.plannedSubstitutions) {
    if (!Number.isInteger(sub.minute) || sub.minute < 1 || sub.minute > 90) {
      throw new LineupValidationError('Substitution minute must be between 1 and 90');
    }
    if (!lineupIds.has(sub.outPlayerId) || usedOutIds.has(sub.outPlayerId)) {
      throw new LineupValidationError('Substitution "out" player must be one of the 11 starters, used at most once');
    }
    if (!substituteIds.has(sub.inPlayerId) || usedInIds.has(sub.inPlayerId)) {
      throw new LineupValidationError('Substitution "in" player must be one of the bench substitutes, used at most once');
    }
    usedOutIds.add(sub.outPlayerId);
    usedInIds.add(sub.inPlayerId);
  }

  if (tactic.penaltyTakerId !== undefined && !lineupIds.has(tactic.penaltyTakerId)) {
    throw new LineupValidationError('Penalty taker must be one of the 11 starters');
  }
}

/** Player-plus-flank-plus-slot-position triples, aligned by lineup index (not affected by
 *  `resolveLineupPlayers`'s own filtering). `slotPosition` is which `Position` the formation calls for at
 *  that index — the pitch editor lets a manager field anyone anywhere, so this can differ from the
 *  player's own `position` (see `positionMismatchFactor`). Falls back to the player's own position (no
 *  mismatch penalty) if the lineup is somehow longer than the formation's own slot list. */
function resolveLineupWithSides(club: Club, tactic: Tactic): { player: Player; side?: LineupSide; slotPosition: Position }[] {
  const byId = new Map(club.players.map((p) => [p.id, p]));
  // Free placement wins over the formation: a slot the manager dragged somewhere else plays where it
  // was dropped, formation label notwithstanding.
  const slotPositions = effectiveSlotPositions(tactic);
  const result: { player: Player; side?: LineupSide; slotPosition: Position }[] = [];
  tactic.lineup.forEach((slot, i) => {
    const player = byId.get(slot.playerId);
    if (!player) return;
    result.push({ player, side: slot.side, slotPosition: slotPositions[i] ?? player.position });
  });
  return result;
}

/**
 * A player stationed on their weaker flank (e.g. a right-footed player at left-back) underperforms;
 * one on their natural side, or comfortable on either (BOTH), gets a small edge. No effect centrally.
 */
export function footFactor(player: Player, side: LineupSide | undefined): number {
  if (!side || side === 'CENTER') return 1;
  if (player.preferredFoot === 'BOTH') return 1.04;
  const natural = player.preferredFoot === 'RIGHT' ? 'RIGHT' : 'LEFT';
  return side === natural ? 1.05 : 0.93;
}

type LineupEntry = { player: Player; side?: LineupSide; slotPosition: Position };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** A MID-slot player who can screen the back line: the same VOLANTE-or-defending-75+ test `calculateSectorSynergy` already uses for `hasVolante`. */
function isMidfieldProtector(entry: LineupEntry): boolean {
  return (
    entry.slotPosition === 'MID' &&
    (entry.player.functions.includes('VOLANTE') ||
      entry.player.functions.includes('VOLANTE_CAO_DE_GUARDA') ||
      entry.player.functions.includes('MEIA_BOX_TO_BOX') ||
      entry.player.attributes.defending >= 75)
  );
}

/** Full-compatibility targets for each rest-defence shape, interpolated from neutral (1) by `compatibility`. */
const REST_DEFENCE_TARGETS: Record<RestDefenceShape, { centralExposure: number; territorialRetention: number; flankVulnerability: number }> = {
  '3+2': { centralExposure: 0.8, territorialRetention: 1.0, flankVulnerability: 1.0 },
  '2+3': { centralExposure: 0.95, territorialRetention: 1.1, flankVulnerability: 1.2 },
};

/**
 * How well the fielded XI (already off-pitch-filtered, free-placement-resolved) matches its chosen
 * `restDefenceShape`, and the resulting tactical modifiers. Neither shape is illegal to field without the
 * right personnel — a mismatch just interpolates back toward the neutral {1,1,1} rather than failing.
 *
 * 3+2 wants three base defenders (a LAT can stand in for a missing DEF, up to two of them) plus two
 * midfield protectors. 2+3 wants two DEF plus three containment bodies drawn from protectors and laterals.
 */
function computeRestDefenceCompatibility(withSides: LineupEntry[], shape: RestDefenceShape): RestDefenceModifiers {
  const defCount = withSides.filter((e) => e.slotPosition === 'DEF').length;
  const latCount = withSides.filter((e) => e.slotPosition === 'LAT').length;
  const protectorCount = withSides.filter(isMidfieldProtector).length;

  let compatibility: number;
  if (shape === '3+2') {
    const effectiveDefenders = defCount + Math.min(latCount, Math.max(0, 3 - defCount));
    const defenderScore = clamp01(effectiveDefenders / 3);
    const protectorScore = clamp01(protectorCount / 2);
    compatibility = (defenderScore + protectorScore) / 2;
  } else {
    const defenderScore = clamp01(defCount / 2);
    const containmentScore = clamp01((protectorCount + latCount) / 3);
    compatibility = (defenderScore + containmentScore) / 2;
  }

  const target = REST_DEFENCE_TARGETS[shape];
  return {
    centralExposure: 1 + (target.centralExposure - 1) * compatibility,
    territorialRetention: 1 + (target.territorialRetention - 1) * compatibility,
    flankVulnerability: 1 + (target.flankVulnerability - 1) * compatibility,
    compatibility,
  };
}

/** `player.commitment`, nudged by LEADER/UNDISCIPLINED traits — the same derived-stat precedent as `composure` in penalty.ts. */
function teamworkOf(player: Player): number {
  let value = player.commitment;
  if (player.traits.includes('LEADER')) value += 8;
  if (player.traits.includes('UNDISCIPLINED')) value -= 8;
  return Math.max(1, Math.min(99, value));
}

function averageOf<T>(entries: T[], selector: (entry: T) => number, fallback = 50): number {
  if (entries.length === 0) return fallback;
  return entries.reduce((sum, e) => sum + selector(e), 0) / entries.length;
}

/**
 * Aggregates raw player attributes into attack/defense/goalkeeping ratings, weighted by every tactical
 * dimension. Deliberately does NOT re-validate suspension/injury availability here (unlike
 * `resolveLineupPlayers`) — that's an input-time check for whether a tactic was legal to *submit*, not a
 * standing invariant the engine re-enforces on every minute it simulates. A live match's tactic is locked
 * in once created; re-throwing here would crash an already-in-progress match the moment a player's
 * suspension/injury status happens to change from some other match completing in between ticks.
 *
 * `offPitchPlayerIds` are players who started but are no longer out there — sent off, or injured with
 * nobody on to replace them yet (see numericalDisadvantage.ts). They stop contributing entirely *and* the
 * side takes a headcount penalty on top: without that second part, dropping one of eleven would barely
 * move an average-based rating, which is nothing like what being a man down actually costs.
 */
export function computeTeamStrength(club: Club, tactic: Tactic, offPitchPlayerIds?: ReadonlySet<string>): TeamStrength {
  const allWithSides = resolveLineupWithSides(club, tactic);
  const withSides =
    offPitchPlayerIds && offPitchPlayerIds.size > 0
      ? allWithSides.filter((e) => !offPitchPlayerIds.has(e.player.id))
      : allWithSides;
  const players = withSides.map((e) => e.player);
  const restDefence = computeRestDefenceCompatibility(withSides, restDefenceShapeOf(tactic));
  const teamwork = averageOf(players, teamworkOf);
  const anticipation = averageOf(players, (p) => p.detailedAttributes.ANTICIPATION);
  const firstTouch = averageOf(players, (p) => p.detailedAttributes.BALL_CONTROL);
  const teamComposure = averageOf(players, composureOf);
  const missingPlayers = Math.max(0, FULL_SIDE - withSides.length);
  const disadvantage = numericalDisadvantageFactors(missingPlayers);
  const mentalityMod = MENTALITY_MODIFIERS[tactic.mentality];
  const markingMod = MARKING_STYLE_MODIFIERS[tactic.markingStyle];
  const approachMod = ATTACK_APPROACH_MODIFIERS[tactic.attackApproach];
  const attackStyleMod = ATTACK_STYLE_MODIFIERS[tactic.attackStyle];
  const fieldedPlayerIds = new Set(withSides.map(({ player }) => player.id));
  const fieldedLineup = tactic.lineup.map((slot) =>
    fieldedPlayerIds.has(slot.playerId) ? slot : { ...slot, x: 50, y: 50, side: 'CENTER' as const },
  );
  const attackStyleCompatibility =
    tactic.attackStyle === 'WINGS'
      ? calculateFlankCoverage(tactic.formation, fieldedLineup)
      : 1;

  // Classified by which slot they're actually fielded in, not their own natural position — a manager can
  // freely field anyone anywhere (see PitchField.tsx); whoever's in the GK slot keeps goal, full stop.
  const outfield = withSides.filter((e) => e.slotPosition !== 'GK');
  const goalkeeperEntry = withSides.find((e) => e.slotPosition === 'GK');

  const synergy = calculateSectorSynergy(withSides);

  const attackRaw =
    (outfield.reduce(
      (sum, e) =>
        sum + effectiveAttack(e.player, club, attackStyleMod, e.slotPosition) * moraleFactor(e.player) * footFactor(e.player, e.side) * starFactor(e.player),
      0,
    ) / Math.max(1, outfield.length)) * synergy.attackSynergy;

  const defenseRaw =
    (outfield.reduce(
      (sum, e) =>
        sum + effectiveDefense(e.player, club, e.slotPosition) * moraleFactor(e.player) * footFactor(e.player, e.side) * starFactor(e.player),
      0,
    ) / Math.max(1, outfield.length)) * synergy.defenseSynergy;

  const goalkeeping = goalkeeperEntry
    ? effectiveAttribute(goalkeeperEntry.player, goalkeeperEntry.player.attributes.goalkeeping, club) *
      positionMismatchFactor(goalkeeperEntry.player.position, 'GK') *
      starFactor(goalkeeperEntry.player)
    : 30;

  return {
    attack: attackRaw * mentalityMod.attack * disadvantage.attack,
    defense: defenseRaw * mentalityMod.defense * markingMod.defense * approachMod.defense * disadvantage.defense,
    goalkeeping,
    lineupPlayers: players,
    missingPlayers,
    chanceModifier: approachMod.chance,
    goalModifier: approachMod.goal,
    foulProbabilityModifier: markingMod.foul,
    attackStyleCompatibility,
    tacticalAttackMultiplier: mentalityMod.attack,
    tacticalDefenseMultiplier: mentalityMod.defense * markingMod.defense * approachMod.defense,
    restDefence,
    teamwork,
    anticipation,
    firstTouch,
    composure: teamComposure,
  };
}

export interface SectorChemistryItem {
  name: string;
  score: number;
  label: string;
  activeBonuses: string[];
}

export interface SectorChemistryBreakdown {
  defense: SectorChemistryItem;
  midfield: SectorChemistryItem;
  attack: SectorChemistryItem;
  flanks: SectorChemistryItem;
  overallScore: number;
  overallLabel: string;
  attackSynergy: number;
  defenseSynergy: number;
}

/**
 * Detailed Sectoral Chemistry & Synergy Engine (PDF Game Design Document & Section 7).
 * Analyzes positional cohesion, complementary tactical functions, and flank duos.
 */
export function calculateSectorSynergy(
  lineup: { player: Player; side?: LineupSide; slotPosition: Position }[],
): { attackSynergy: number; defenseSynergy: number; breakdown: SectorChemistryBreakdown } {
  const attackers = lineup.filter((e) => e.slotPosition === 'ATT');
  const defenders = lineup.filter((e) => e.slotPosition === 'DEF');
  const laterals = lineup.filter((e) => e.slotPosition === 'LAT');
  const midfielders = lineup.filter((e) => e.slotPosition === 'MID');

  let attackSynergy = 1.0;
  let defenseSynergy = 1.0;

  // 1. DEFENSIVE SECTOR
  let defScore = 30;
  const defBonuses: string[] = [];
  if (defenders.length >= 2 && defenders.every((e) => e.player.position === 'DEF')) {
    defenseSynergy *= 1.03;
    defScore += 35;
    defBonuses.push('Dupla de zaga com especialistas naturais');
  }
  if (defenders.some((e) => e.player.attributes.passing >= 70)) {
    attackSynergy *= 1.015;
    defScore += 20;
    defBonuses.push('Zagueiro construtor com saída de bola qualificada');
  }
  if (defenders.some((e) => e.player.traits?.includes('LEADER'))) {
    defenseSynergy *= 1.03;
    defScore += 20;
    defBonuses.push('Liderança e voz de comando na linha defensiva (+3% de sinergia defensiva)');
  } else if (lineup.some((e) => e.player.traits?.includes('LEADER'))) {
    defenseSynergy *= 1.02;
    defScore += 10;
    defBonuses.push('Liderança em campo orientando o posicionamento defensivo (+2% de sinergia defensiva)');
  }
  defScore = Math.min(100, defScore);

  // 2. MIDFIELD SECTOR
  let midScore = 30;
  const midBonuses: string[] = [];
  const midFunctions = new Set(midfielders.flatMap((e) => e.player.functions ?? []));
  const hasVolante =
    midFunctions.has('VOLANTE') ||
    midFunctions.has('VOLANTE_CAO_DE_GUARDA') ||
    midFunctions.has('MEIA_BOX_TO_BOX') ||
    midfielders.some((e) => e.player.attributes.defending >= 75);
  const hasMeia =
    midFunctions.has('MEIA_CRIACAO') ||
    midFunctions.has('MEIA_ARMADOR') ||
    midFunctions.has('MEIA_BOX_TO_BOX') ||
    midfielders.some((e) => e.player.attributes.passing >= 75);

  if (hasVolante) {
    defenseSynergy *= 1.02;
    midScore += 25;
    midBonuses.push('Sustentação e combate de primeiro volante');
  }
  if (hasMeia) {
    attackSynergy *= 1.02;
    midScore += 25;
    midBonuses.push('Armação e visão de jogo de meia articulador');
  }
  if (hasVolante && hasMeia) {
    attackSynergy *= 1.02;
    defenseSynergy *= 1.02;
    midScore += 20;
    midBonuses.push('Meio-campo completo: combate + criação combinados');
  }
  midScore = Math.min(100, midScore);

  // 3. ATTACKING SECTOR
  let attScore = 30;
  const attBonuses: string[] = [];
  const attFunctions = new Set(attackers.flatMap((e) => e.player.functions ?? []));
  const hasPonta =
    attFunctions.has('PONTA') ||
    attFunctions.has('PONTA_INVERTIDO') ||
    attFunctions.has('PONTA_LINHA_DE_FUNDO') ||
    attackers.some((e) => e.player.attributes.pace >= 80);
  const hasCentroavante =
    attFunctions.has('CENTROAVANTE') ||
    attFunctions.has('CENTROAVANTE_REFERENCIA') ||
    attFunctions.has('FALSO_NOVE') ||
    attackers.some((e) => e.player.attributes.finishing >= 78);
  const hasSegundoAtacante = attFunctions.has('SEGUNDO_ATACANTE');

  if (hasPonta && hasCentroavante) {
    attackSynergy *= 1.035;
    attScore += 40;
    attBonuses.push('Parceria letal: velocidade na ponta + centroavante finalizador');
  } else if (hasSegundoAtacante && hasCentroavante) {
    attackSynergy *= 1.025;
    attScore += 30;
    attBonuses.push('Ataque móvel com segundo atacante e homem de referência');
  } else if (attackers.length >= 2) {
    attackSynergy *= 1.015;
    attScore += 20;
    attBonuses.push('Dupla de ataque sintonizada');
  }
  attScore = Math.min(100, attScore);

  // 4. FLANKS / CORRIDORS
  let flankScore = 30;
  const flankBonuses: string[] = [];
  const leftLaterals = laterals.filter((e) => e.side === 'LEFT');
  const leftAttackers = attackers.filter((e) => e.side === 'LEFT');
  const rightLaterals = laterals.filter((e) => e.side === 'RIGHT');
  const rightAttackers = attackers.filter((e) => e.side === 'RIGHT');

  if (leftLaterals.length > 0 && leftAttackers.length > 0) {
    attackSynergy *= 1.02;
    flankScore += 35;
    flankBonuses.push('Dobradinha lateral e ponta no corredor esquerdo');
  }
  if (rightLaterals.length > 0 && rightAttackers.length > 0) {
    attackSynergy *= 1.02;
    flankScore += 35;
    flankBonuses.push('Dobradinha lateral e ponta no corredor direito');
  }
  flankScore = Math.min(100, flankScore);

  // Overall Chemistry
  const overallScore = Math.round((defScore + midScore + attScore + flankScore) / 4);
  const getLabel = (s: number) =>
    s >= 85 ? 'Excelente' : s >= 65 ? 'Boa' : s >= 45 ? 'Média' : 'Em Formação';

  const breakdown: SectorChemistryBreakdown = {
    defense: { name: 'Defesa', score: defScore, label: getLabel(defScore), activeBonuses: defBonuses },
    midfield: { name: 'Meio-Campo', score: midScore, label: getLabel(midScore), activeBonuses: midBonuses },
    attack: { name: 'Ataque', score: attScore, label: getLabel(attScore), activeBonuses: attBonuses },
    flanks: { name: 'Flancos / Alas', score: flankScore, label: getLabel(flankScore), activeBonuses: flankBonuses },
    overallScore,
    overallLabel: overallScore >= 80 ? 'Química Excelente' : overallScore >= 60 ? 'Bom Entrosamento' : 'Em Construção',
    attackSynergy,
    defenseSynergy,
  };

  return { attackSynergy, defenseSynergy, breakdown };
}

export function analyzeSquadChemistry(club: Club, tactic: Tactic): SectorChemistryBreakdown {
  const lineupWithSides = resolveLineupWithSides(club, tactic);
  return calculateSectorSynergy(lineupWithSides).breakdown;
}

/** Gates a raw attribute by força/idade, plus a captaincy bonus (tenure-based) for whoever wears the armband. */
export function effectiveAttribute(player: Player, rawValue: number, club: Club): number {
  const captainMultiplier = club.captainPlayerId === player.id ? captainBonus(club.captainWeeksServed) : 1;
  return rawValue * talentGate(player.overall) * ageFactor(player.age, player.overall, player.starLevel) * captainMultiplier;
}

function effectiveAttack(player: Player, club: Club, attackStyleMod: { pace: number; passing: number }, slotPosition: Position): number {
  const mismatch = positionMismatchFactor(player.position, slotPosition);
  return (
    (effectiveAttribute(player, player.attributes.finishing, club) * 0.5 +
      effectiveAttribute(player, player.attributes.passing, club) * 0.3 * attackStyleMod.passing +
      effectiveAttribute(player, player.attributes.pace, club) * 0.2 * attackStyleMod.pace) *
    mismatch
  );
}

function effectiveDefense(player: Player, club: Club, slotPosition: Position): number {
  const mismatch = positionMismatchFactor(player.position, slotPosition);
  return (
    (effectiveAttribute(player, player.attributes.defending, club) * 0.6 +
      effectiveAttribute(player, player.attributes.physical, club) * 0.3 +
      effectiveAttribute(player, player.attributes.pace, club) * 0.1) *
    mismatch
  );
}

function moraleFactor(player: Player): number {
  // Morale/fatigue nudge performance by up to +/-10%, never enough to fully offset skill gaps.
  const moraleAdj = (player.morale - 50) / 500;
  const fatigueAdj = -player.fatigue / 1000;
  return 1 + moraleAdj + fatigueAdj;
}

/**
 * SPORTS PHYSIOLOGY & RECOVERY KINETICS (Based on peer-reviewed sports science literature:
 * Mohr, Krustrup & Bangsbo 2003/2005; Nédélec et al. 2012/2013; Bangsbo 2014; FIFA Medical Network).
 */

/** Baseline fatigue accumulated by an average outfield player across a standard 90-minute match (0-100 scale). */
export const BASELINE_MATCH_FATIGUE_GAIN = 18;

/**
 * Halftime transient recovery factor: Percentage of 1st-half accumulated fatigue restored
 * during the 15-minute halftime break through PCr resynthesis, H+ ion clearance, and carbohydrate rehydration.
 * Studies by Mohr, Krustrup & Bangsbo demonstrate a ~10-15% transient recovery of high-intensity capacity.
 */
export const HALFTIME_TRANSIENT_RECOVERY_RATE = 0.15;

/** Full weekly fatigue recovery baseline (7 days of rest and regular training). */
export const BASELINE_WEEKLY_FATIGUE_RECOVERY = 30;

/**
 * Microcycle rest recovery percentage by elapsed days post-match:
 * - 24h (1 day): ~25% recovery (peak muscle soreness, low glycogen)
 * - 48h (2 days): ~50% recovery (DOMS peak)
 * - 72h (3 days / midweek turnaround): ~78% recovery (~85% for high-physical athletes)
 * - 96h (4 days): ~92% recovery
 * - 168h (7 days / 1 week): ~100% recovery of baseline single-match load
 */
export const RECOVERY_KINETICS_BY_DAY: Record<number, number> = {
  1: 0.25,
  2: 0.50,
  3: 0.78,
  4: 0.92,
  5: 0.96,
  6: 0.98,
  7: 1.0,
};

/**
 * Computes dynamic in-match stamina percentage (0-100%) for a player at `minute` (0 to 90+),
 * factoring in pre-match fatigue, individual physical attribute, and the 15-minute halftime recovery boost.
 */
export function calculateInMatchStamina(player: Player, minute: number = 0): number {
  const initialStamina = Math.max(0, 100 - (player.fatigue ?? 0));
  const physical = player.attributes?.physical ?? 50;

  // Goalkeepers cover ~4-5km with minimal sprinting; outfielders cover ~10-12km
  const isGoalkeeper = player.position === 'GK';
  const roleFactor = isGoalkeeper ? 0.35 : 1.0;

  // Physical attribute (1-99) scaling: 99 physical loses 25% less stamina, 1 physical loses 25% more
  const physicalResistance = 1 - ((physical - 50) / 49) * 0.25;
  const totalMatchDrain = BASELINE_MATCH_FATIGUE_GAIN * roleFactor * physicalResistance;

  if (minute <= 0) return Math.round(initialStamina);

  if (minute <= 45) {
    // 1st Half: Linear depletion over 45 minutes
    const half1Drain = totalMatchDrain * 0.48 * (minute / 45);
    return Math.round(Math.max(10, initialStamina - half1Drain));
  }

  // 1st Half accumulated fatigue
  const half1TotalDrain = totalMatchDrain * 0.48;

  // Halftime recovery boost: 15% of 1st half fatigue restored during 15-min break
  const halftimeRecovered = half1TotalDrain * HALFTIME_TRANSIENT_RECOVERY_RATE;

  // 2nd Half: Initial recovery + progressive fatigue with glycogen depletion acceleration in min 75-90
  const minuteInHalf2 = Math.min(45, minute - 45);
  let half2DrainRatio: number;

  if (minuteInHalf2 <= 30) {
    // Min 46 to 75: Regular second-half pace
    half2DrainRatio = (minuteInHalf2 / 45) * 0.6;
  } else {
    // Min 75 to 90: Accelerated fatigue due to glycogen depletion in type-II muscle fibers
    const extraMinutes = minuteInHalf2 - 30;
    half2DrainRatio = (30 / 45) * 0.6 + (extraMinutes / 15) * 0.4;
  }

  const half2Drain = totalMatchDrain * 0.52 * half2DrainRatio;
  const currentStamina = initialStamina - half1TotalDrain + halftimeRecovered - half2Drain;

  return Math.round(Math.max(10, Math.min(100, currentStamina)));
}

/**
 * Calculates between-match recovery for a given rest window in days (e.g. 3 days for midweek cup, 7 days for weekly league).
 */
export function calculateMicrocycleRecovery(
  currentFatigue: number,
  daysOfRest: number,
  physical: number = 50,
  age: number = 25,
): number {
  const cappedDays = Math.min(7, Math.max(1, Math.round(daysOfRest)));
  const dayRate = RECOVERY_KINETICS_BY_DAY[cappedDays] ?? 1.0;

  const physicalBonus = 1 + ((physical - 50) / 49) * 0.25;
  const veteranPenalty = age > 30 ? 0.9 : 1.0;

  const totalRecoveryPoints = BASELINE_WEEKLY_FATIGUE_RECOVERY * dayRate * physicalBonus * veteranPenalty;

  return Math.max(0, Math.round(currentFatigue - totalRecoveryPoints));
}

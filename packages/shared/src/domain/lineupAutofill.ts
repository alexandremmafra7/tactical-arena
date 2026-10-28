import { Club } from './club.js';
import { isPlayerAvailable, Player, Position } from './player.js';
import {
  ATTACK_STYLE_MODIFIERS,
  AttackStyle,
  Formation,
  FORMATION_POSITIONS,
  LineupSide,
  MARKING_STYLE_MODIFIERS,
  MarkingStyle,
  Tactic,
} from './tactic.js';
import { LineupValidationError } from '../simulation/teamStrength.js';

/** Default tactical flank sides matching formation geometries */
export const FORMATION_DEFAULT_SIDES: Record<Formation, LineupSide[]> = {
  '4-4-2': ['CENTER', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'CENTER', 'CENTER'],
  '4-3-3': ['CENTER', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'RIGHT'],
  '3-5-2': ['CENTER', 'LEFT', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'RIGHT'],
  '5-3-2': ['CENTER', 'LEFT', 'CENTER', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'RIGHT', 'LEFT', 'RIGHT'],
  '4-2-3-1': ['CENTER', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'CENTER', 'CENTER', 'LEFT', 'CENTER', 'RIGHT', 'CENTER'],
  '4-1-4-1': ['CENTER', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'CENTER', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'CENTER'],
  '3-4-3': ['CENTER', 'LEFT', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'RIGHT'],
  '4-4-1': ['CENTER', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'CENTER'],
  '5-3-1': ['CENTER', 'LEFT', 'CENTER', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'RIGHT', 'CENTER'],
  '4-3-2': ['CENTER', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'RIGHT', 'LEFT', 'RIGHT'],
  '3-4-2': ['CENTER', 'LEFT', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'RIGHT'],
  '4-5-0': ['CENTER', 'LEFT', 'CENTER', 'CENTER', 'RIGHT', 'LEFT', 'CENTER', 'CENTER', 'CENTER', 'RIGHT'],
};

/**
 * Positional affinity hierarchy used strictly as fallback ONLY when a squad does not have enough
 * players of the exact natural position available.
 *
 * Rules:
 * 1. Outfield slots NEVER pick a GK unless literally ZERO outfield players exist in the club.
 * 2. GK slot NEVER picks an outfield player unless literally ZERO GKs exist in the club.
 * 3. Closest positional roles are prioritized first (e.g. LAT uses DEF/MID before ATT).
 */
const FALLBACK_PREFERENCES: Record<Position, Position[]> = {
  GK: ['DEF', 'LAT', 'MID', 'ATT'], // Outfield at GK only if literally zero GKs exist
  LAT: ['DEF', 'MID', 'ATT'],        // Lateral fallback: Defender or Midfielder first, Attacker last, never GK
  DEF: ['LAT', 'MID', 'ATT'],        // Defender fallback: Lateral or Midfielder first, Attacker last, never GK
  MID: ['LAT', 'ATT', 'DEF'],        // Midfielder fallback: Lateral or Attacker first, Defender last, never GK
  ATT: ['MID', 'LAT', 'DEF'],        // Attacker fallback: Midfielder first, Lateral second, Defender last, never GK
};

/**
 * Picks the strongest available (non-suspended, non-injured) 11 players into a valid, balanced lineup
 * matching the target formation.
 *
 * Guarantees:
 * - Natural positions are ALWAYS matched first (GKs in GK, LATs in LAT, DEFs in DEF, MIDs in MID, ATTs in ATT).
 * - Out-of-position picks will NEVER occur unless the club literally lacks available players of that position.
 */
export function autoFillLineup(
  club: Club,
  competitionId: string | null = null,
  formation: Formation = '4-4-2',
): Tactic {
  const slotPositions = FORMATION_POSITIONS[formation] ?? FORMATION_POSITIONS['4-4-2'];
  const sides = FORMATION_DEFAULT_SIDES[formation] ?? FORMATION_DEFAULT_SIDES['4-4-2'];

  const starterIds = pickPlayersForSlots(club.players, slotPositions, 'overall', competitionId, undefined, formation);
  const usedIds = new Set(starterIds.filter((id): id is string => !!id));

  // If squad has fewer than 11 available players due to severe suspension/injury crunch,
  // fill remaining empty slots with unavailable players as emergency fallback
  if (starterIds.some((id) => !id)) {
    const unavailable = club.players.filter((p) => !isPlayerAvailable(p, competitionId) && !usedIds.has(p.id));
    for (let i = 0; i < starterIds.length; i++) {
      if (!starterIds[i]) {
        const slotPos = slotPositions[i];
        // Match natural position first among unavailable
        const natural = unavailable
          .filter((p) => p.position === slotPos && !usedIds.has(p.id))
          .sort((a, b) => b.overall - a.overall)[0];
        const candidate =
          natural ??
          unavailable
            .filter((p) => (slotPos !== 'GK' ? p.position !== 'GK' : true) && !usedIds.has(p.id))
            .sort((a, b) => b.overall - a.overall)[0] ??
          unavailable.filter((p) => !usedIds.has(p.id)).sort((a, b) => b.overall - a.overall)[0];

        if (candidate) {
          starterIds[i] = candidate.id;
          usedIds.add(candidate.id);
        }
      }
    }
  }

  const validStarterIds = starterIds.filter((id): id is string => !!id);
  if (validStarterIds.length < slotPositions.length) {
    throw new LineupValidationError(
      `Club ${club.id} has fewer than ${slotPositions.length} players in its squad — cannot auto-fill a lineup at all`,
    );
  }

  const substitutes = pickBenchPlayers(club.players, usedIds, 'overall', DEFAULT_BENCH_SIZE, competitionId);

  return {
    clubId: club.id,
    formation,
    mentality: 'balanced',
    attackStyle: 'BALANCED',
    markingStyle: 'BALANCED',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    lineup: validStarterIds.map((playerId, i) => ({
      playerId,
      side: sides[i] ?? 'CENTER',
    })),
    substitutes: substitutes.map((playerId) => ({ playerId })),
    plannedSubstitutions: [],
  };
}

export type LineupAutofillStrategy = 'overall' | 'stamina' | 'balanced' | 'style' | 'assistant';

export interface AutofillStyleContext {
  attackStyle: AttackStyle;
  markingStyle: MarkingStyle;
}

function balancedScore(player: Player): number {
  return (player.overall + player.morale + (100 - player.fatigue)) / 3;
}

function assistantScore(player: Player): number {
  const fitness = Math.max(0, 100 - (player.fatigue ?? 0));
  const fitnessPenalty = fitness < 80 ? (80 - fitness) * 3.5 : 0;
  const formBonus = ((player.morale ?? 70) - 50) * 0.3;
  return player.overall + formBonus - fitnessPenalty;
}

function styleScore(player: Player, slotPosition: Position, style: AutofillStyleContext): number {
  if (slotPosition === 'GK') return player.attributes.goalkeeping;
  if (slotPosition === 'DEF') {
    const markingMod = MARKING_STYLE_MODIFIERS[style.markingStyle];
    return player.attributes.defending * 0.6 * markingMod.defense + player.attributes.physical * 0.3 + player.attributes.pace * 0.1;
  }
  const attackMod = ATTACK_STYLE_MODIFIERS[style.attackStyle];
  return player.attributes.finishing * 0.5 + player.attributes.passing * 0.3 * attackMod.passing + player.attributes.pace * 0.2 * attackMod.pace;
}

function compareFor(strategy: LineupAutofillStrategy, styleContext: AutofillStyleContext | undefined, slotPosition?: Position) {
  if (strategy === 'stamina') return (a: Player, b: Player) => a.fatigue - b.fatigue;
  if (strategy === 'balanced') return (a: Player, b: Player) => balancedScore(b) - balancedScore(a);
  if (strategy === 'assistant') return (a: Player, b: Player) => assistantScore(b) - assistantScore(a);
  if (strategy === 'style' && styleContext) {
    return (a: Player, b: Player) =>
      styleScore(b, slotPosition ?? b.position, styleContext) - styleScore(a, slotPosition ?? a.position, styleContext);
  }
  return (a: Player, b: Player) => b.overall - a.overall;
}

/**
 * Fills a formation's slots (in order — one entry per `slotPositions`) with the best available player for that position.
 *
 * CRITICAL RULE:
 * 1) Pass 1 matches ONLY players with the exact natural position of each slot.
 * 2) Pass 2 executes ONLY when a slot has NO available player of that natural position in the squad.
 *    In Pass 2, it follows strict positional affinity (e.g. DEF/MID for LAT, never GK for outfield).
 */
export function pickPlayersForSlots(
  players: Player[],
  slotPositions: Position[],
  strategy: LineupAutofillStrategy = 'overall',
  competitionId: string | null = null,
  styleContext?: AutofillStyleContext,
  formation: Formation = '4-4-2',
): (string | null)[] {
  const available = players.filter((p) => isPlayerAvailable(p, competitionId));
  const used = new Set<string>();
  const sides = FORMATION_DEFAULT_SIDES[formation] ?? FORMATION_DEFAULT_SIDES['4-4-2'];

  // 1) First pass: Strict exact natural position match for every slot (with LAT side foot preference)
  const result: (string | null)[] = slotPositions.map((position, i) => {
    const compare = compareFor(strategy, styleContext, position);
    const side = sides[i] ?? 'CENTER';
    const candidates = available.filter((p) => p.position === position && !used.has(p.id));

    if (position === 'LAT') {
      candidates.sort((a, b) => {
        const aMatchFoot = (side === 'LEFT' && (a.preferredFoot === 'LEFT' || a.preferredFoot === 'BOTH')) ||
                           (side === 'RIGHT' && (a.preferredFoot === 'RIGHT' || a.preferredFoot === 'BOTH'));
        const bMatchFoot = (side === 'LEFT' && (b.preferredFoot === 'LEFT' || b.preferredFoot === 'BOTH')) ||
                           (side === 'RIGHT' && (b.preferredFoot === 'RIGHT' || b.preferredFoot === 'BOTH'));
        if (aMatchFoot && !bMatchFoot) return -1;
        if (!aMatchFoot && bMatchFoot) return 1;
        return compare(a, b);
      });
    } else {
      candidates.sort(compare);
    }

    const candidate = candidates[0];
    if (!candidate) return null;
    used.add(candidate.id);
    return candidate.id;
  });

  // 1.5) Secondary positions pass: if any slot is still null, check secondaryPositions
  for (let i = 0; i < result.length; i++) {
    if (result[i] === null) {
      const slotPos = slotPositions[i];
      const side = sides[i] ?? 'CENTER';
      const compare = compareFor(strategy, styleContext, slotPos);
      const secCandidates = available.filter((p) => p.secondaryPositions?.includes(slotPos) && !used.has(p.id));

      if (slotPos === 'LAT') {
        secCandidates.sort((a, b) => {
          const aMatchFoot = (side === 'LEFT' && (a.preferredFoot === 'LEFT' || a.preferredFoot === 'BOTH')) ||
                             (side === 'RIGHT' && (a.preferredFoot === 'RIGHT' || a.preferredFoot === 'BOTH'));
          const bMatchFoot = (side === 'LEFT' && (b.preferredFoot === 'LEFT' || b.preferredFoot === 'BOTH')) ||
                             (side === 'RIGHT' && (b.preferredFoot === 'RIGHT' || b.preferredFoot === 'BOTH'));
          if (aMatchFoot && !bMatchFoot) return -1;
          if (!aMatchFoot && bMatchFoot) return 1;
          return compare(a, b);
        });
      } else {
        secCandidates.sort(compare);
      }

      const secCandidate = secCandidates[0];
      if (secCandidate) {
        used.add(secCandidate.id);
        result[i] = secCandidate.id;
      }
    }
  }

  // 2) Second pass: Fallback ONLY if a slot has NO available player of that natural or secondary position left
  for (let i = 0; i < result.length; i++) {
    if (result[i] === null) {
      const slotPos = slotPositions[i];
      const preferredFallbackPositions = FALLBACK_PREFERENCES[slotPos] ?? [];

      let fallbackCandidate: Player | undefined;
      for (const prefPos of preferredFallbackPositions) {
        const compare = compareFor(strategy, styleContext, slotPos);
        const candidatesOfPos = available
          .filter((p) => p.position === prefPos && !used.has(p.id))
          .sort(compare);
        if (candidatesOfPos.length > 0) {
          fallbackCandidate = candidatesOfPos[0];
          break;
        }
      }

      // Emergency last resort (e.g. if only GK is left for outfield, or only outfield for GK)
      if (!fallbackCandidate) {
        const compare = compareFor(strategy, styleContext, slotPos);
        const remaining = available.filter((p) => !used.has(p.id)).sort(compare);
        if (remaining.length > 0) {
          fallbackCandidate = remaining[0];
        }
      }

      if (fallbackCandidate) {
        used.add(fallbackCandidate.id);
        result[i] = fallbackCandidate.id;
      }
    }
  }

  return result;
}

/** A real matchday squad's bench, not just the XI — same size regardless of formation. */
export const DEFAULT_BENCH_SIZE = 7;

const BENCH_CORE_POSITIONS: Position[] = ['GK', 'LAT', 'DEF', 'MID', 'ATT'];

/**
 * Fills the bench alongside `pickPlayersForSlots`: ensures at least 1 player of each position
 * (GK, LAT, DEF, MID, ATT) is covered if available, and never places more than 1 goalkeeper on the bench.
 * Remaining slots are filled with the highest-ranked outfield candidates according to the chosen strategy.
 */
export function pickBenchPlayers(
  players: Player[],
  excludeIds: Set<string>,
  strategy: LineupAutofillStrategy = 'overall',
  benchSize: number = DEFAULT_BENCH_SIZE,
  competitionId: string | null = null,
  styleContext?: AutofillStyleContext,
): string[] {
  const available = players.filter((p) => isPlayerAvailable(p, competitionId) && !excludeIds.has(p.id));
  const benchIds: string[] = [];
  const pickedIds = new Set<string>();

  // 1) First pass: Pick 1 player of each natural position (GK, LAT, DEF, MID, ATT) if available
  for (const pos of BENCH_CORE_POSITIONS) {
    if (benchIds.length >= benchSize) break;
    const compare = compareFor(strategy, styleContext, pos);
    const candidate = available.filter((p) => p.position === pos && !pickedIds.has(p.id)).sort(compare)[0];
    if (candidate) {
      benchIds.push(candidate.id);
      pickedIds.add(candidate.id);
    }
  }

  // 2) Second pass: Fill remaining slots with the best outfield players (strictly non-GK so max 1 GK is enforced)
  const remainingOutfield = available
    .filter((p) => p.position !== 'GK' && !pickedIds.has(p.id))
    .sort(compareFor(strategy, styleContext));

  for (const p of remainingOutfield) {
    if (benchIds.length >= benchSize) break;
    benchIds.push(p.id);
    pickedIds.add(p.id);
  }

  // Emergency pass: only if bench is still not full and only GKs remain
  if (benchIds.length < benchSize) {
    const remainingAny = available.filter((p) => !pickedIds.has(p.id)).sort(compareFor(strategy, styleContext));
    for (const p of remainingAny) {
      if (benchIds.length >= benchSize) break;
      benchIds.push(p.id);
      pickedIds.add(p.id);
    }
  }

  // Sort final selected bench players by the strategy comparator
  const byId = new Map(players.map((p) => [p.id, p]));
  return benchIds
    .map((id) => byId.get(id))
    .filter((p): p is Player => !!p)
    .sort(compareFor(strategy, styleContext))
    .map((p) => p.id);
}

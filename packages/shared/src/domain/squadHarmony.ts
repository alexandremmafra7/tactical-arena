import { Player, PersonalityTrait } from './player.js';
import { Tactic } from './tactic.js';

const PROBLEMATIC_TRAITS: PersonalityTrait[] = ['AGGRESSIVE', 'PROVOCATIVE', 'TEMPERAMENTAL', 'UNDISCIPLINED', 'SELFISH'];
/** One difficult starter isn't a crisis — every squad has one. */
const FREE_PROBLEMATIC_ALLOWANCE = 1;
const SQUAD_HARMONY_PENALTY_PER_PLAYER = 4;
const MAX_SQUAD_HARMONY_PENALTY = 15;

const MORALE_MIN = 0;
const MORALE_MAX = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Post-match roster update: a starting XI overloaded with problem personalities drags the whole squad's
 * morale down, tempered by any LEADER on the pitch (each one cancels out one problematic starter), the
 * manager's designated tutor (see clubService.setTutor — counts if called up at all, bench included, since
 * their role is dressing-room presence rather than minutes played), and a free allowance so a single
 * difficult player isn't treated as a crisis. Pure so callers can layer it on top of other post-match
 * updates before writing the roster once.
 */
export function applySquadHarmony(players: Player[], tactic: Tactic, tutorPlayerId: string | null): Player[] {
  const starterIds = new Set(tactic.lineup.map((slot) => slot.playerId));
  const starters = players.filter((p) => starterIds.has(p.id));
  const squadIds = new Set([...tactic.lineup, ...tactic.substitutes].map((slot) => slot.playerId));

  const problematicCount = starters.filter((p) => p.traits.some((t) => PROBLEMATIC_TRAITS.includes(t))).length;
  const leaderCount = starters.filter((p) => p.traits.includes('LEADER')).length;
  const tutorCalledUp = tutorPlayerId !== null && squadIds.has(tutorPlayerId) ? 1 : 0;
  const netProblematic = Math.max(0, problematicCount - leaderCount - tutorCalledUp - FREE_PROBLEMATIC_ALLOWANCE);

  if (netProblematic <= 0) return players;

  const penalty = Math.min(MAX_SQUAD_HARMONY_PENALTY, netProblematic * SQUAD_HARMONY_PENALTY_PER_PLAYER);
  return players.map((p) => ({ ...p, morale: clamp(p.morale - penalty, MORALE_MIN, MORALE_MAX) }));
}

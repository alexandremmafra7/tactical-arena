import { Club } from './club.js';
import { averageSquadOverall } from './finance.js';
import { AttackApproach, AttackStyle, Formation, MarkingStyle, Mentality, PressingIntensity, Tactic } from './tactic.js';
import { hashSeed } from '../simulation/rng.js';
import { autoFillLineup } from './lineupAutofill.js';

/**
 * A tactical personality for a club nobody is managing.
 *
 * Without this every unmanaged side lines up identically (see `autoFillLineup`, which is deliberately
 * neutral), and the whole matchup layer in tacticalMatchup.ts becomes invisible: there is never anything
 * specific to read or counter, because every opponent is the same shape. Giving each club a standing
 * identity is what turns "pick the biggest number" into "who are we playing this week".
 *
 * Two inputs decide it, in this order:
 *  - **Squad strength.** Big clubs press high and commit forward because they can afford to; weak ones sit
 *    deep and counter, because that is the only version of the game they can win. This is the same logic real
 *    tables run on, and it means the identity a manager reads off an opponent is *informative* rather than
 *    arbitrary.
 *  - **The club id.** Within a tier, which archetype a club gets is fixed by a hash of its id, so the league
 *    holds a spread of styles and — crucially — a given club plays the same way every single week. A manager
 *    can learn that this opponent parks the bus and plan for it, which is impossible if it is re-rolled.
 */
export interface TacticalIdentity {
  name: string;
  formation: Formation;
  mentality: Mentality;
  attackStyle: AttackStyle;
  markingStyle: MarkingStyle;
  attackApproach: AttackApproach;
  pressing: PressingIntensity;
}

/** Suffocate them high up the pitch and score more than they do. Only viable with the legs to run it. */
const GEGENPRESS: TacticalIdentity = {
  name: 'Pressão alta',
  formation: '4-3-3',
  mentality: 'attacking',
  attackStyle: 'WINGS',
  markingStyle: 'HEAVY',
  attackApproach: 'TOTAL_ATTACK',
  pressing: 'HIGH_PRESS',
};

/** Keep the ball, work it through the middle, strangle the game rather than out-run it. */
const POSSESSION: TacticalIdentity = {
  name: 'Toque e posse',
  formation: '4-3-3',
  mentality: 'balanced',
  attackStyle: 'THROUGH_MIDDLE',
  markingStyle: 'ZONAL',
  attackApproach: 'BALANCED',
  pressing: 'MEDIUM',
};

/** No strong opinion in either direction — the honest mid-table side. */
const ORTHODOX: TacticalIdentity = {
  name: 'Equilibrado',
  formation: '4-4-2',
  mentality: 'balanced',
  attackStyle: 'BALANCED',
  markingStyle: 'BALANCED',
  attackApproach: 'BALANCED',
  pressing: 'MEDIUM',
};

/** Sit off, stay compact, break at speed down the flanks the moment the ball turns over. */
const COUNTER_PUNCHER: TacticalIdentity = {
  name: 'Contragolpe',
  formation: '4-4-2',
  mentality: 'balanced',
  attackStyle: 'WINGS',
  markingStyle: 'MAN_MARKING',
  attackApproach: 'COUNTER_ATTACK',
  pressing: 'LOW_BLOCK',
};

/** Five at the back and everyone behind the ball. Ugly, and genuinely hard to beat. */
const PARKED_BUS: TacticalIdentity = {
  name: 'Retranca',
  formation: '5-3-2',
  mentality: 'defensive',
  attackStyle: 'BALANCED',
  markingStyle: 'ZONAL',
  attackApproach: 'COUNTER_ATTACK',
  pressing: 'LOW_BLOCK',
};

export const TACTICAL_IDENTITIES = [GEGENPRESS, POSSESSION, ORTHODOX, COUNTER_PUNCHER, PARKED_BUS];

/** Squad-overall cutoffs between tiers. Tuned against generated squads, which cluster in the 50s-70s. */
const STRONG_SQUAD = 68;
const MID_SQUAD = 58;

/** Two candidates per tier, so clubs of similar quality still don't all line up the same way. */
function candidatesFor(avgOverall: number): TacticalIdentity[] {
  if (avgOverall >= STRONG_SQUAD) return [GEGENPRESS, POSSESSION];
  if (avgOverall >= MID_SQUAD) return [POSSESSION, ORTHODOX];
  return [COUNTER_PUNCHER, PARKED_BUS];
}

/** The standing tactical identity of `club` — stable for the life of the club, never re-rolled. */
export function tacticalIdentityOf(club: Club): TacticalIdentity {
  const candidates = candidatesFor(averageSquadOverall(club.players));
  return candidates[hashSeed(club.id) % candidates.length];
}

/**
 * `autoFillLineup`'s XI, dressed in the club's own tactical identity. Used for clubs the computer is
 * running; a human club falls back to the neutral auto-fill, since inventing a style for someone's own team
 * behind their back would be worse than picking nothing.
 */
export function botTactic(club: Club, autoFilled?: Tactic): Tactic {
  const identity = tacticalIdentityOf(club);
  const base = autoFilled ?? autoFillLineup(club, null, identity.formation);

  return {
    ...base,
    formation: base.formation,
    mentality: identity.mentality,
    attackStyle: identity.attackStyle,
    markingStyle: identity.markingStyle,
    attackApproach: identity.attackApproach,
    pressing: identity.pressing,
  };
}

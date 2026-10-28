import { MatchEvent, MatchSide } from '../domain/match.js';

const MATCH_MINUTES = 90;

/**
 * Handicap for a side playing short: a sent-off player, or one carried off injured that nobody has come
 * on to replace yet. Until this existed, a red card and an injury were purely cosmetic timeline entries —
 * the engine kept computing strength from the original eleven, so being a man down cost a team nothing
 * inside the match it happened in.
 *
 * Calibration targets come from Vecer, Kopřiva & Ichiba (JQAS 2009), who estimated both sides' scoring
 * intensities from live in-play betting odds around real red cards (World Cup 2006 + Euro 2008):
 *   - the penalized team's own scoring rate falls to roughly **two thirds** of what it was;
 *   - the opponent's scoring rate rises by roughly a factor of **1.2**.
 * The engine's own goal rate is the product of a chance probability and a conversion probability, both of
 * which move with `attack`, so those two multipliers are what the constants below were fitted to reproduce
 * rather than being applied to the scoring rate directly.
 *
 * Because the fit runs through that whole funnel, it is **not** independent of the funnel's scale. When the
 * engine's chance and conversion rates were corrected to match real football (see CHANCE_BASE_PROB), these
 * constants silently lost about half their bite — 0.80x and 1.10x against the targets — and had to be
 * refitted. Anything that moves the scoring scale again has to re-run scripts/match-profile.ts, which now
 * measures these two ratios alongside everything else.
 *
 * That is exactly what happened the next time the goal funnel moved and this was not re-run: the handicap
 * drifted to 0.74x and 1.16x, quietly handing a side down to ten a quarter of its punishment back. Refitted
 * against the profile again here. This warning is not decoration — the fit genuinely does not survive a
 * change to the scoring scale.
 */

/** Attack lost per "effective missing player" before the superlinear exponent below is applied. */
const MISSING_ATTACK_PENALTY = 0.40;
/** Defense lost per "effective missing player". Lower than the attack side: a team going down to ten
 *  almost always drops a forward and sits deeper, so it defends far better than it attacks short-handed. */
const MISSING_DEFENSE_PENALTY = 0.31;
/**
 * Being two down is worse than twice being one down: the first loss can be absorbed by dropping a striker
 * into midfield, the second starts leaving genuine holes. >1 makes each additional missing player cost more
 * than the one before.
 *
 * Came down from 1.25 when the penalties above were refitted. The exponent has no effect at all on one
 * missing player (1 raised to anything is 1), which is what the Vecer targets are measured against — but a
 * heavier per-player penalty compounds fast, and at 1.25 a side two men down came out below the floor,
 * which flattened the curve into exactly the "twice as bad" this exists to avoid.
 */
const MISSING_PENALTY_EXPONENT = 1.15;

/**
 * Floors so an absurd number of dismissals degrades toward, but never through, zero.
 *
 * The attack floor came down from 0.2 for the same reason. A floor is meant to catch the absurd cases, and
 * two dismissals is not absurd — it is a match that happens a few times a season. At 0.2 it was binding
 * there and silently capping the punishment; the curve now reaches the floor only from the third onward.
 */
const MIN_ATTACK_FACTOR = 0.10;
const MIN_DEFENSE_FACTOR = 0.25;

/**
 * How long a side stays scrambled right after losing a player to a dismissal, and how much of its defence
 * that costs while it lasts.
 *
 * Distinct from the steady-state handicap above, which is about *how many* players are on the pitch. This
 * one is about the minutes before anyone has settled into the new shape: everyone is still standing where
 * the old formation put them, one zone has nobody in it, and the opposition knows exactly where. It decays
 * to nothing as the side reorganizes, so a dismissal in the 89th minute barely registers while one in the
 * 20th is a genuinely dangerous spell to survive.
 *
 * Applied to both sides alike, human or bot: reorganizing is what the manager's interruption is for, and
 * where they choose to put the hole is already priced by the positional model. Charging the same team a
 * second, separate fine for "not reorganizing" would be billing twice for one mistake.
 */
const DISMISSAL_SETTLING_MINUTES = 6;
const DISMISSAL_SETTLING_DEFENSE_LOSS = 0.12;

/**
 * Defensive multiplier for `side` at `minute`, reflecting how recently it was reduced to ten. 1 when no
 * dismissal is recent enough to matter, dropping to `1 - DISMISSAL_SETTLING_DEFENSE_LOSS` in the minute
 * the card came out and climbing back linearly from there.
 */
export function dismissalSettlingFactor(events: MatchEvent[], side: MatchSide, minute: number): number {
  let mostRecent: number | null = null;
  for (const event of events) {
    if (event.team !== side || !isSendingOff(event)) continue;
    if (event.minute <= minute && (mostRecent === null || event.minute > mostRecent)) mostRecent = event.minute;
  }
  if (mostRecent === null) return 1;

  const elapsed = minute - mostRecent;
  if (elapsed >= DISMISSAL_SETTLING_MINUTES) return 1;
  const remaining = (DISMISSAL_SETTLING_MINUTES - elapsed) / DISMISSAL_SETTLING_MINUTES;
  return 1 - DISMISSAL_SETTLING_DEFENSE_LOSS * remaining;
}

/**
 * How much extra fatigue the players still on the pitch accumulate, per full match played one man short.
 * Numerical-inferiority research consistently finds the remaining players absorb more high-intensity load
 * (sprints and accelerations) even as total distance flattens out, since they cover the same pitch with
 * fewer legs — this is the in-game cost of that, and the reason a red card keeps hurting into the *next*
 * match too, not just the one it happened in.
 */
const FATIGUE_OVERLOAD_PER_MISSING_FULL_MATCH = 0.15;

/** Whether this event is a dismissal (a red card, distinguished from a yellow by carrying a suspension). */
function isSendingOff(event: MatchEvent): boolean {
  return event.type === 'card' && event.suspensionMatches !== undefined;
}

/**
 * Players sent off for `side` so far. Separate from `offPitchPlayerIds` because a dismissal is permanent:
 * the shirt stays empty for the rest of the match and, unlike an injury, no substitute may fill it.
 */
export function sentOffPlayerIds(events: MatchEvent[], side: MatchSide): Set<string> {
  const sentOff = new Set<string>();
  for (const event of events) {
    if (event.team === side && isSendingOff(event)) sentOff.add(event.playerId);
  }
  return sentOff;
}

/**
 * Players on `side` carrying a yellow card. A second one sends them off (see resolveFoul), so this is the
 * warning a manager needs in order to decide whether to take someone off before it costs them a man —
 * nothing in the squad data records it, since a booking only exists inside this match's timeline.
 */
export function bookedPlayerIds(events: MatchEvent[], side: MatchSide): Set<string> {
  const booked = new Set<string>();
  for (const event of events) {
    if (event.team === side && event.type === 'card' && event.suspensionMatches === undefined) {
      booked.add(event.playerId);
    }
  }
  return booked;
}

/**
 * Everyone missing from `side`'s eleven right now: sent off (permanently), or injured and not yet
 * replaced. An injury only costs a team numbers until a substitute comes on for that player — which is
 * precisely what a `substitution` event naming them as the outgoing player records.
 */
export function offPitchPlayerIds(events: MatchEvent[], side: MatchSide): Set<string> {
  const sentOff = new Set<string>();
  const awaitingReplacement = new Set<string>();

  for (const event of events) {
    if (event.team !== side) continue;
    if (isSendingOff(event)) {
      sentOff.add(event.playerId);
    } else if (event.type === 'injury') {
      awaitingReplacement.add(event.playerId);
    } else if (event.type === 'substitution') {
      awaitingReplacement.delete(event.playerId);
    }
  }

  return new Set([...sentOff, ...awaitingReplacement]);
}

/**
 * Total player-minutes `side` spent a man short — one player missing for 30 minutes and two missing for
 * 15 both come to 30. Drives the post-match fatigue overload, so a dismissal in the 88th minute barely
 * registers while one in the 10th is felt by everyone who had to cover for it.
 */
export function missingPlayerMinutes(events: MatchEvent[], side: MatchSide, throughMinute: number = MATCH_MINUTES): number {
  const sentOff = new Set<string>();
  /** playerId -> the minute they left the pitch, for spells not yet closed by a substitution. */
  const leftAt = new Map<string, number>();
  let total = 0;

  for (const event of events) {
    if (event.team !== side) continue;
    if (isSendingOff(event)) {
      sentOff.add(event.playerId);
      leftAt.set(event.playerId, event.minute);
    } else if (event.type === 'injury') {
      leftAt.set(event.playerId, event.minute);
    } else if (event.type === 'substitution' && !sentOff.has(event.playerId)) {
      const start = leftAt.get(event.playerId);
      if (start !== undefined) {
        total += Math.max(0, event.minute - start);
        leftAt.delete(event.playerId);
      }
    }
  }

  // Whatever is still open ran to the final whistle (or to wherever the match has been played up to).
  for (const start of leftAt.values()) {
    total += Math.max(0, throughMinute - start);
  }

  return total;
}

/**
 * Attack/defense multipliers for a side missing `missingCount` players. 1/1 at full strength, degrading
 * superlinearly and asymmetrically (attack suffers more than defense) from there.
 */
export function numericalDisadvantageFactors(missingCount: number): { attack: number; defense: number } {
  if (missingCount <= 0) return { attack: 1, defense: 1 };
  const scaled = missingCount ** MISSING_PENALTY_EXPONENT;
  return {
    attack: Math.max(MIN_ATTACK_FACTOR, 1 - MISSING_ATTACK_PENALTY * scaled),
    defense: Math.max(MIN_DEFENSE_FACTOR, 1 - MISSING_DEFENSE_PENALTY * scaled),
  };
}

/** Post-match fatigue multiplier for a side that spent `missingMinutes` player-minutes short-handed. */
export function fatigueOverloadMultiplier(missingMinutes: number): number {
  return 1 + FATIGUE_OVERLOAD_PER_MISSING_FULL_MATCH * (missingMinutes / MATCH_MINUTES);
}

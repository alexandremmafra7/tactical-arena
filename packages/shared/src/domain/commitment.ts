import { Player, Position } from './player.js';
import { Tactic, minutesPlayedByPlayerId } from './tactic.js';

const PLAYED_COMMITMENT_GAIN = 4;
/** Called up to the bench but never got on — remembered, just not used. */
const BENCH_UNUSED_SNUB = 1;
/** Not even part of the matchday squad — a harsher snub than an unused substitute. */
const NOT_SELECTED_SNUB = 3;
/** Extra penalty per point of `overall` this player exceeds the average of whoever started in their position. */
const SNUB_QUALITY_WEIGHT = 0.4;
const MAX_SNUB_PENALTY = 10;
/** Being benched for a SELFISH teammate stings more than being benched for a team player of the same quality. */
const SELFISH_SNUB_AMPLIFIER = 1.5;

const COMMITMENT_MIN = 0;
const COMMITMENT_MAX = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function averageOverallByPosition(starters: Player[]): Map<Position, number> {
  const totals = new Map<Position, { sum: number; count: number }>();
  for (const player of starters) {
    const entry = totals.get(player.position) ?? { sum: 0, count: 0 };
    entry.sum += player.overall;
    entry.count += 1;
    totals.set(player.position, entry);
  }
  return new Map([...totals.entries()].map(([position, { sum, count }]) => [position, sum / count]));
}

/**
 * Post-match roster update: a player who took the pitch gains commitment flat, regardless of quality —
 * playing is playing. A player left out feels it more the better they are compared to whoever started in
 * their position ("why does he play and not me?"), and more still if they weren't even named among the
 * substitutes. Pure so callers can layer it on top of other post-match updates before writing the roster once.
 */
export function applyCommitment(players: Player[], tactic: Tactic): Player[] {
  const minutes = minutesPlayedByPlayerId(tactic);
  const substituteIds = new Set(tactic.substitutes.map((slot) => slot.playerId));
  const starterIds = new Set(tactic.lineup.map((slot) => slot.playerId));
  const starters = players.filter((p) => starterIds.has(p.id));
  const starterOverallByPosition = averageOverallByPosition(starters);
  const positionsWithSelfishStarter = new Set(starters.filter((p) => p.traits.includes('SELFISH')).map((p) => p.position));

  return players.map((player) => {
    const minutesPlayed = minutes.get(player.id) ?? 0;
    if (minutesPlayed > 0) {
      return { ...player, commitment: clamp(player.commitment + PLAYED_COMMITMENT_GAIN, COMMITMENT_MIN, COMMITMENT_MAX) };
    }

    const peerAverage = starterOverallByPosition.get(player.position);
    const qualityGap = peerAverage !== undefined ? Math.max(0, player.overall - peerAverage) : 0;
    const baseSnub = substituteIds.has(player.id) ? BENCH_UNUSED_SNUB : NOT_SELECTED_SNUB;
    const snubAmplifier = positionsWithSelfishStarter.has(player.position) ? SELFISH_SNUB_AMPLIFIER : 1;
    const penalty = Math.min(MAX_SNUB_PENALTY, baseSnub + qualityGap * SNUB_QUALITY_WEIGHT * snubAmplifier);

    return { ...player, commitment: clamp(player.commitment - penalty, COMMITMENT_MIN, COMMITMENT_MAX) };
  });
}

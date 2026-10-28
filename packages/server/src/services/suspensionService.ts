import { MatchEvent, Player, Suspension } from '@tactical-arena/shared';

/**
 * One match just passed for this squad, in competition `competitionId` (null for an ad-hoc match):
 * every existing suspension entry that applies to THIS competition counts down by one (others — earned in
 * a different competition — are left untouched, since this match didn't serve any of that ban), then any
 * red card from this very match overwrites/adds this competition's entry with its fresh suspension length.
 * Entries that reach zero are dropped. Pure so callers can layer other post-match updates on top before
 * writing the roster once. Shared by the ad-hoc PvP challenge flow and league/cup fixtures alike.
 */
export function updateSuspensions(players: Player[], events: MatchEvent[], competitionId: string | null): Player[] {
  const freshSuspensionByPlayerId = new Map<string, number>();
  for (const event of events) {
    if (event.type === 'card' && event.suspensionMatches) {
      freshSuspensionByPlayerId.set(event.playerId, event.suspensionMatches);
    }
  }

  return players.map((p) => {
    const decremented: Suspension[] = p.suspensions
      .map((s) => (s.competitionId === competitionId ? { ...s, matchesRemaining: s.matchesRemaining - 1 } : s))
      .filter((s) => s.matchesRemaining > 0);

    const fresh = freshSuspensionByPlayerId.get(p.id);
    if (fresh === undefined) {
      return { ...p, suspensions: decremented };
    }

    const withoutThisCompetition = decremented.filter((s) => s.competitionId !== competitionId);
    return { ...p, suspensions: [...withoutThisCompetition, { competitionId, matchesRemaining: fresh }] };
  });
}

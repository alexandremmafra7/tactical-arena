import { MatchEvent, Player } from '@tactical-arena/shared';

/**
 * One match just passed for this squad: existing injuries count down by one, then any fresh injury from
 * this very match overwrites that with its own (worse) count — same shape as `updateSuspensions`, and
 * deliberately the same cadence (decremented per match played, not per calendar week): the game has no
 * real week/season clock that reliably ticks for bot-owned clubs (`advanceWeek` is a manual, per-owner
 * action), so a week-based recovery would leave bot squads' injuries never healing. Pure so callers can
 * layer it on top of other post-match updates before writing the roster once.
 */
export function updateInjuries(players: Player[], events: MatchEvent[]): Player[] {
  const freshInjuryByPlayerId = new Map<string, number>();
  for (const event of events) {
    if (event.type === 'injury' && event.injuryWeeks) {
      freshInjuryByPlayerId.set(event.playerId, event.injuryWeeks);
    }
  }

  return players.map((p) => ({
    ...p,
    injuryWeeks: freshInjuryByPlayerId.get(p.id) ?? Math.max(0, p.injuryWeeks - 1),
  }));
}

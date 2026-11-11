import { advanceMatchday, getNextMatch } from '../api/client';

/**
 * The one answer to "ir para a partida".
 */
export async function goToMatchday(clubId: string): Promise<string | null> {
  /**
   * A match already under way wins over starting a new one. Without this, a manager who navigated away
   * mid-game and came back would advance the clock past their own match instead of returning to it.
   */
  const current = await getNextMatch(clubId).catch(() => null);
  if (current && (current.status === 'LIVE' || current.status === 'WAITING_TACTICS')) {
    return current.id;
  }

  for (let step = 0; step < 12; step++) {
    const outcome = await advanceMatchday();

    if (outcome.sackedFromClubId) {
      window.location.href = `/career?sacked=${outcome.sackedFromClubId}`;
      return null;
    }

    if (outcome.matchId) return outcome.matchId;

    const next = await getNextMatch(clubId).catch(() => null);
    if (next && (next.status === 'LIVE' || next.status === 'WAITING_TACTICS')) {
      return next.id;
    }

    if (!outcome.played || outcome.played.length === 0) break;
  }

  return (await getNextMatch(clubId).catch(() => null))?.id ?? null;
}

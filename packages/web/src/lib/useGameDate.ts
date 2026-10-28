import { useEffect, useState } from 'react';
import { getGameState, type GameStateView } from '../api/client.js';

/**
 * The game clock, for any screen that wants to show what day it is.
 *
 * Refetched on mount rather than held in a global store: the date only moves when the player advances
 * time, which always remounts or navigates, and a stale date on screen would be worse than one extra
 * request. Fails silently to null — a screen should never break because the clock did not answer.
 */
export function useGameDate(): GameStateView | null {
  const [state, setState] = useState<GameStateView | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGameState()
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

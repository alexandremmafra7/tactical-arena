import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '@tactical-arena/shared';
import { getNextMatch } from '../api/client.js';

interface NextMatchButtonProps {
  clubId: string;
  /**
   * Where to send someone when there's no open match yet. A league fixture has no match row at all until
   * the round is advanced, so without this the button would simply vanish for most of the time a manager
   * spends on the escalação screen — pointing them at the competition screen (where the round is actually
   * kicked off) keeps "ir para a partida" meaningful instead of leaving a hole in the layout.
   */
  fallbackTo?: string;
  className?: string;
}

/** Shortcut to whichever match this club should act on right now — still waiting on a tactic (goes to
 *  the tactic screen) or already live (goes straight to the live match). With no match open it falls back
 *  to `fallbackTo`, or renders nothing if none was given. Shared by the club home dashboard and the
 *  Tática/Escalação screen. */
export function NextMatchButton({ clubId, fallbackTo, className }: NextMatchButtonProps) {
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNextMatch(clubId)
      .then((m) => {
        if (!cancelled) setMatch(m);
      })
      .catch(() => {
        if (!cancelled) setMatch(null);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (!match && !fallbackTo) return null;

  const to = match ? `/match/${match.id}/live` : fallbackTo!;
  const label = !match ? 'Ir para a partida' : 'Ir para a partida ao vivo';

  return (
    <Link to={to} className={className ? `next-match-button ${className}` : 'next-match-button'}>
      {label}
    </Link>
  );
}

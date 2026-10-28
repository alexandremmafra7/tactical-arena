import type { PlayerRole, PlayerTier } from '@tactical-arena/shared';
import { SpecialPlayerIcon } from './SpecialPlayerIcon.js';

interface PlayerStatusMarksProps {
  /** Out with a knock — `Player.injuryWeeks > 0`. Persists between matches. */
  injured?: boolean;
  /** Banned — `Player.suspensions`. Persists between matches. */
  suspended?: boolean;
  /** Booked in the match being played right now — see `bookedPlayerIds`. Lives only in that timeline. */
  booked?: boolean;
  /** Tactical roles assigned to this player (e.g. CAPTAIN, PENALTY_TAKER, FREE_KICK_TAKER, etc.) */
  roles?: PlayerRole[];
  /** Display tier from `getPlayerTier` — the badge: a gold 3D star for GENIO ("Gênio / Extraclasse"),
   *  a cyan double chevron for BAITA ("Baita Jogador / Diferenciado"). */
  tier?: PlayerTier | null;
}

/**
 * Visual status marks and role badges shown in the corner of player chips and pitch slots.
 */
export function PlayerStatusMarks({ injured, suspended, booked, tier }: PlayerStatusMarksProps) {
  const hasMarks = injured || suspended || booked || !!tier;
  if (!hasMarks) return null;

  return (
    <span className="player-status-marks" aria-hidden="true">
      {tier && (
        <span className={`player-tier-mark tier-${tier.toLowerCase()}`}>
          <SpecialPlayerIcon tier={tier} size={tier === 'GENIO' ? 14 : 12} />
        </span>
      )}
      {injured && (
        <span className="player-status-mark status-injured" title="Lesionado">
          ✚
        </span>
      )}
      {suspended && <span className="player-status-mark status-suspended" title="Suspenso" />}
      {booked && <span className="player-status-mark status-booked" title="Cartão amarelo" />}
    </span>
  );
}

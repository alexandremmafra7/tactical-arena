import type { PlayerRole } from '@tactical-arena/shared';

const ROLE_TITLES: Record<PlayerRole, string> = {
  CAPTAIN: 'Capitão',
  FREE_KICK_TAKER: 'Batedor de faltas',
  PENALTY_TAKER: 'Batedor de pênaltis',
  CORNER_RIGHT_TAKER: 'Escanteio pela direita',
  CORNER_LEFT_TAKER: 'Escanteio pela esquerda',
};

// Small gold tags (matching the button/accent styling elsewhere in the app) — the settled design,
// not a placeholder for artwork.
const ROLE_GLYPHS: Record<PlayerRole, string> = {
  CAPTAIN: 'C',
  FREE_KICK_TAKER: 'F',
  PENALTY_TAKER: 'P',
  CORNER_RIGHT_TAKER: 'ED',
  CORNER_LEFT_TAKER: 'EE',
};

/** One tag per role this player currently holds — a player can hold several at once. */
export function RoleIcons({ roles }: { roles: PlayerRole[] }) {
  if (roles.length === 0) return null;
  return (
    <span className="role-icons">
      {roles.map((role) => (
        <span key={role} className="role-icon" title={ROLE_TITLES[role]}>
          {ROLE_GLYPHS[role]}
        </span>
      ))}
    </span>
  );
}

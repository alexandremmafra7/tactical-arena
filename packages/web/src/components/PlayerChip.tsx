import type React from 'react';
import type { KitPattern, Player } from '@tactical-arena/shared';
import { getPlayerTier } from '@tactical-arena/shared';
import { positionLabel } from '../lib/positionLabel.js';
import { DND_PLAYER_ID, DND_PLAYER_POSITION, setDraggedPlayerPosition } from './PitchField.js';
import { PlayerStatusMarks } from './PlayerStatusMarks.js';
import { TeamJersey } from './TeamJersey.js';

interface PlayerChipProps {
  player: Player;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  draggable?: boolean;
  booked?: boolean;
  kitColor?: string | null;
  kitPattern?: KitPattern | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  clubSlug?: string | null;
  isAway?: boolean;
}

export function PlayerChip({
  player,
  onClick,
  disabled,
  active,
  draggable,
  booked,
  kitColor,
  kitPattern,
  primaryColor,
  secondaryColor,
  clubSlug,
  isAway,
}: PlayerChipProps) {
  const injured = (player.injuryWeeks ?? 0) > 0;
  const suspended = (player.suspensions?.length ?? 0) > 0;
  const statusTitle = [
    player.name,
    injured ? `Lesionado (${player.injuryWeeks} semana(s))` : null,
    suspended ? 'Suspenso' : null,
    booked ? 'Amarelado, risco de expulsão' : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <button
      type="button"
      className={`player-chip${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={statusTitle}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.setData(DND_PLAYER_ID, player.id);
              e.dataTransfer.setData(DND_PLAYER_POSITION, player.position);
              e.dataTransfer.effectAllowed = 'move';
              setDraggedPlayerPosition(player.position);
            }
          : undefined
      }
      onDragEnd={draggable ? () => setDraggedPlayerPosition(null) : undefined}
    >
      <span className="player-chip-jersey" style={kitColor ? ({ ['--kit-color']: kitColor } as React.CSSProperties) : undefined}>
        <TeamJersey
          clubSlug={clubSlug}
          kitColor={kitColor}
          kitPattern={kitPattern}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          isKeeper={player.position === 'GK'}
          isAway={isAway}
          className="player-chip-jersey-art"
        />
        <span className="player-chip-jersey-label">{positionLabel(player.position)}</span>
        <PlayerStatusMarks injured={injured} suspended={suspended} booked={booked} tier={getPlayerTier(player.overall, player.starLevel, player.diferenciado, player.age, player.potential, player.name)} />
      </span>
      <span className="player-chip-name">{player.name}</span>
      <span className="player-chip-overall">{player.overall}</span>
    </button>
  );
}

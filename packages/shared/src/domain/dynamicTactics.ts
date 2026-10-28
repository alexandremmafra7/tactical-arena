import type { Position, Player } from './player.js';
import { positionMismatchFactor } from '../simulation/teamStrength.js';

export interface DynamicTacticalRole {
  position: Position;
  label: string;
  shortLabel: string;
  factor: number;
}

export function getDynamicTacticalRole(x: number, y: number, player: Player): DynamicTacticalRole {
  // Goleiro natural ou posicionado na área de meta (y >= 80)
  if (player.position === 'GK' || y >= 80) {
    return {
      position: 'GK',
      label: 'Goleiro',
      shortLabel: 'Goleiro',
      factor: positionMismatchFactor(player.position, 'GK', player),
    };
  }

  const side = x < 30 ? 'LEFT' : x > 70 ? 'RIGHT' : 'CENTER';
  let pos: Position = 'MID';
  let label = 'Meia Central';
  let shortLabel = 'Meia';

  if (y >= 58) {
    if (side === 'LEFT' || side === 'RIGHT') {
      pos = 'LAT';
      const isInverted = (side === 'LEFT' && player.preferredFoot === 'RIGHT') || (side === 'RIGHT' && player.preferredFoot === 'LEFT');
      label = isInverted ? 'Lateral Invertido' : 'Lateral';
      shortLabel = isInverted ? 'Lat. Invertido' : 'Lateral';
    } else {
      pos = 'DEF';
      label = 'Zagueiro';
      shortLabel = 'Zagueiro';
    }
  } else if (y >= 32) {
    pos = 'MID';
    if (side === 'LEFT' || side === 'RIGHT') {
      label = 'Ala / Meia Lateral';
      shortLabel = 'Ala / Meia';
    } else if (y < 46) {
      label = 'Meia Ofensivo (CAM)';
      shortLabel = 'Meia Ofensivo';
    } else {
      label = 'Volante / Meia Central';
      shortLabel = 'Volante';
    }
  } else {
    pos = 'ATT';
    if (side === 'LEFT' || side === 'RIGHT') {
      label = 'Extremo Aberto (Ponta)';
      shortLabel = 'Ponta';
    } else if (y <= 12 || player.functions?.includes('CENTROAVANTE_REFERENCIA') || player.functions?.includes('CENTROAVANTE')) {
      label = 'Centroavante';
      shortLabel = 'Centroavante';
    } else {
      label = 'Segundo Atacante';
      shortLabel = 'Seg. Atacante';
    }
  }

  let factor = positionMismatchFactor(player.position, pos, player);

  const pace = player.attributes?.pace ?? 50;
  const finishing = player.attributes?.finishing ?? 50;
  const passing = player.attributes?.passing ?? 50;
  const defending = player.attributes?.defending ?? 50;

  if (pos === 'ATT' && (pace >= 70 || finishing >= 70)) {
    factor = Math.min(1.02, factor * 1.05);
  } else if (pos === 'MID' && (passing >= 70 || pace >= 70)) {
    factor = Math.min(1.02, factor * 1.05);
  } else if (pos === 'LAT' && (pace >= 70 || defending >= 70)) {
    factor = Math.min(1.02, factor * 1.04);
  }

  return {
    position: pos,
    label,
    shortLabel,
    factor: Math.max(0.60, Number(factor.toFixed(2))),
  };
}

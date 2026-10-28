import type { Position } from '@tactical-arena/shared';

const POSITION_LABELS: Record<Position, string> = {
  GK: 'GOL',
  DEF: 'ZAG',
  LAT: 'LAT',
  MID: 'MEI',
  ATT: 'ATA',
};

/** PT-BR abbreviation for a position — GK/DEF/MID/ATT are the domain's internal (English) codes. */
export function positionLabel(position: Position): string {
  return POSITION_LABELS[position];
}

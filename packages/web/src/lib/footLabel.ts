import type { PreferredFoot } from '@tactical-arena/shared';

const FOOT_LABELS: Record<PreferredFoot, string> = {
  RIGHT: 'Destro',
  LEFT: 'Canhoto',
  BOTH: 'Ambidestro',
};

export function footLabel(foot: PreferredFoot): string {
  return FOOT_LABELS[foot];
}

const FOOT_LETTERS: Record<PreferredFoot, string> = {
  RIGHT: 'D',
  LEFT: 'E',
  BOTH: 'D/E',
};

/** Compact D/E (destro/canhoto) form — for tight table columns where the full word doesn't fit. */
export function footLetter(foot: PreferredFoot): string {
  return FOOT_LETTERS[foot];
}

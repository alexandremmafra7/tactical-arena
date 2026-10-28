import type { CareerClubChoice } from './createCareer.js';
import {
  canTakeOverDivision,
  explainBlock,
  mustFoundOwnClub,
  type GameMode,
} from './gameMode.js';

export interface CareerEntryPolicy {
  path: 'CHOOSE' | 'FOUND_ONLY';
  canTakeOver: boolean;
  mustFound: boolean;
  restriction: string | null;
}

export function careerEntryPolicy(mode: GameMode): CareerEntryPolicy {
  const mustFound = mustFoundOwnClub(mode);
  return {
    path: mustFound ? 'FOUND_ONLY' : 'CHOOSE',
    canTakeOver: !mustFound,
    mustFound,
    restriction: mustFound ? explainBlock(mode, 'division') : null,
  };
}

export function eligibleTakeoverDivisions(
  mode: GameMode,
  divisions: readonly number[],
): number[] {
  return divisions.filter(
    (division) =>
      Number.isInteger(division) &&
      division > 0 &&
      canTakeOverDivision(mode, division),
  );
}

export function validateCareerClubChoice(
  mode: GameMode,
  choice: CareerClubChoice,
  takeoverDivision?: number,
):
  | { ok: true }
  | { ok: false; code: 'MODE_RESTRICTION'; message: string } {
  if (choice.kind === 'FOUND') return { ok: true };
  if (
    !Number.isInteger(takeoverDivision) ||
    (takeoverDivision as number) <= 0 ||
    !canTakeOverDivision(mode, takeoverDivision as number)
  ) {
    return {
      ok: false,
      code: 'MODE_RESTRICTION',
      message: explainBlock(mode, 'division'),
    };
  }
  return { ok: true };
}

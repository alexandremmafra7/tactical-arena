import { describe, expect, it } from 'vitest';
import {
  careerEntryPolicy,
  eligibleTakeoverDivisions,
  validateCareerClubChoice,
} from './careerEntryPolicy.js';

describe('careerEntryPolicy', () => {
  it.each(['STANDARD', 'PREMIUM'] as const)(
    'lets %s choose between taking over and founding',
    (mode) => {
      expect(careerEntryPolicy(mode)).toEqual({
        path: 'CHOOSE',
        canTakeOver: true,
        mustFound: false,
        restriction: null,
      });
    },
  );

  it('requires Iron Man to found a club', () => {
    expect(careerEntryPolicy('HARDCORE')).toEqual({
      path: 'FOUND_ONLY',
      canTakeOver: false,
      mustFound: true,
      restriction:
        'No modo Iron Man você comanda o clube que fundou, e nenhum outro.',
    });
  });
});

describe('eligibleTakeoverDivisions', () => {
  it('uses the shared mode thresholds for every numerically lower tier', () => {
    expect(eligibleTakeoverDivisions('STANDARD', [1, 2, 3, 4])).toEqual([
      2, 3, 4,
    ]);
    expect(eligibleTakeoverDivisions('PREMIUM', [1, 2, 3, 4])).toEqual([
      1, 2, 3, 4,
    ]);
    expect(eligibleTakeoverDivisions('HARDCORE', [1, 2, 3, 4])).toEqual([]);
    expect(eligibleTakeoverDivisions('STANDARD', [1, 2, 4, 5, 6])).toEqual([
      2, 4, 5, 6,
    ]);
    expect(eligibleTakeoverDivisions('PREMIUM', [1, 2, 4, 5, 6])).toEqual([
      1, 2, 4, 5, 6,
    ]);
  });

  it('excludes invalid division values', () => {
    expect(
      eligibleTakeoverDivisions('PREMIUM', [0, -1, 1.5, 1, Number.NaN]),
    ).toEqual([1]);
  });
});

describe('validateCareerClubChoice', () => {
  const takeover = { kind: 'TAKE_OVER', clubId: 'club-a' } as const;
  const foundation = {
    kind: 'FOUND',
    countryCode: 'BRA',
    name: 'Aurora',
    city: 'Curitiba',
    citySize: 'MEDIUM',
    kitPattern: 'SOLID',
    primaryColor: '#112233',
    secondaryColor: '#ffffff',
    crest: { crestBase64: null },
  } as const;

  it('accepts foundation in every mode', () => {
    for (const mode of ['STANDARD', 'PREMIUM', 'HARDCORE'] as const) {
      expect(validateCareerClubChoice(mode, foundation)).toEqual({ ok: true });
    }
  });

  it('applies the exact takeover matrix', () => {
    expect(validateCareerClubChoice('HARDCORE', takeover, 4).ok).toBe(false);
    expect(validateCareerClubChoice('STANDARD', takeover, 1).ok).toBe(false);
    expect(validateCareerClubChoice('STANDARD', takeover, 2)).toEqual({ ok: true });
    expect(validateCareerClubChoice('STANDARD', takeover, 4)).toEqual({ ok: true });
    expect(validateCareerClubChoice('PREMIUM', takeover, 1)).toEqual({ ok: true });
    expect(validateCareerClubChoice('PREMIUM', takeover, 4)).toEqual({ ok: true });
  });

  it('rejects a missing or invalid takeover division', () => {
    expect(validateCareerClubChoice('STANDARD', takeover).ok).toBe(false);
    expect(validateCareerClubChoice('STANDARD', takeover, 0).ok).toBe(false);
    expect(validateCareerClubChoice('STANDARD', takeover, 1.5).ok).toBe(false);
  });
});

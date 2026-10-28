import { describe, expect, it } from 'vitest';
import {
  MANAGER_STYLES,
  DEFAULT_MANAGER_STYLE,
  getManagerStyleDefinition,
  isValidManagerStyle,
  applyTacticalAdviceStyleBonus,
  applyMoraleStyleBonus,
  applyMatchDevelopmentStyleBonus,
  applySponsorshipStyleBonus,
} from './managerStyle.js';

describe('managerStyle domain definitions', () => {
  it('defines the 4 unified styles matching save slots and career screen', () => {
    expect(MANAGER_STYLES.map((s) => s.id)).toEqual(['Estrategista', 'Ofensivo', 'Formador', 'Gestor']);
    expect(MANAGER_STYLES.every((s) => s.label && s.desc && s.icon)).toBe(true);
  });

  it('provides default fallback for missing or unknown style', () => {
    expect(DEFAULT_MANAGER_STYLE).toBe('Estrategista');
    expect(getManagerStyleDefinition(null).id).toBe('Estrategista');
    expect(getManagerStyleDefinition('desconhecido').id).toBe('Estrategista');
    expect(getManagerStyleDefinition('Ofensivo').id).toBe('Ofensivo');
    expect(getManagerStyleDefinition('ofensivo').id).toBe('Ofensivo');
  });

  it('validates style ids strictly', () => {
    expect(isValidManagerStyle('Estrategista')).toBe(true);
    expect(isValidManagerStyle('Ofensivo')).toBe(true);
    expect(isValidManagerStyle('Formador')).toBe(true);
    expect(isValidManagerStyle('Gestor')).toBe(true);
    expect(isValidManagerStyle('TACTICIAN')).toBe(false);
    expect(isValidManagerStyle('MOTIVATOR')).toBe(false);
  });

  describe('Estrategista style mechanical bonus (applyTacticalAdviceStyleBonus)', () => {
    it('applies +0.12 boost to readingAccuracy when style is Estrategista', () => {
      const baseAccuracy = 0.65;
      const boosted = applyTacticalAdviceStyleBonus(baseAccuracy, 'Estrategista');
      expect(boosted).toBeCloseTo(0.77, 5);
    });

    it('caps accuracy at 0.98', () => {
      const boosted = applyTacticalAdviceStyleBonus(0.95, 'Estrategista');
      expect(boosted).toBe(0.98);
    });

    it('leaves accuracy unchanged for other styles or undefined', () => {
      expect(applyTacticalAdviceStyleBonus(0.65, undefined)).toBe(0.65);
      expect(applyTacticalAdviceStyleBonus(0.65, 'Ofensivo')).toBe(0.65);
      expect(applyTacticalAdviceStyleBonus(0.65, 'Formador')).toBe(0.65);
      expect(applyTacticalAdviceStyleBonus(0.65, 'Gestor')).toBe(0.65);
    });
  });

  describe('Ofensivo style mechanical bonus (applyMoraleStyleBonus)', () => {
    it('applies +2 on win and extra +1 per goal above 1 (max +2) when Ofensivo', () => {
      // 1-0 win: win bonus (+2), goalsFor < 2 so extra=0 -> total extra +2
      const delta1_0 = applyMoraleStyleBonus(10, 1, 0, 'Ofensivo');
      expect(delta1_0).toBe(12);

      // 3-1 win: win bonus (+2), goalsFor=3 (3-1=2 extra) -> total extra +4
      const delta3_1 = applyMoraleStyleBonus(10, 3, 1, 'Ofensivo');
      expect(delta3_1).toBe(14);

      // 4-0 win: win bonus (+2), goalsFor=4 (capped at 2 extra) -> total extra +4
      const delta4_0 = applyMoraleStyleBonus(11, 4, 0, 'Ofensivo');
      expect(delta4_0).toBe(15);

      // 2-2 draw: no win, goalsFor=2 (extra=1) -> total extra +1
      const delta2_2 = applyMoraleStyleBonus(1, 2, 2, 'Ofensivo');
      expect(delta2_2).toBe(2);

      // 0-2 loss: no win, goalsFor=0 (extra=0) -> total extra +0
      const delta0_2 = applyMoraleStyleBonus(-10, 0, 2, 'Ofensivo');
      expect(delta0_2).toBe(-10);
    });

    it('leaves morale delta unchanged for non-Ofensivo styles or undefined', () => {
      expect(applyMoraleStyleBonus(10, 3, 1, undefined)).toBe(10);
      expect(applyMoraleStyleBonus(10, 3, 1, 'Estrategista')).toBe(10);
      expect(applyMoraleStyleBonus(10, 3, 1, 'Formador')).toBe(10);
      expect(applyMoraleStyleBonus(10, 3, 1, 'Gestor')).toBe(10);
    });
  });

  describe('Formador style mechanical bonus (applyMatchDevelopmentStyleBonus)', () => {
    it('applies 1.25x multiplier for young players (age <= 23) when Formador', () => {
      const basePoints = 4.0;
      expect(applyMatchDevelopmentStyleBonus(basePoints, 18, 'Formador')).toBe(5.0);
      expect(applyMatchDevelopmentStyleBonus(basePoints, 23, 'Formador')).toBe(5.0);
    });

    it('does not apply bonus for players older than 23 even if Formador', () => {
      const basePoints = 4.0;
      expect(applyMatchDevelopmentStyleBonus(basePoints, 24, 'Formador')).toBe(4.0);
      expect(applyMatchDevelopmentStyleBonus(basePoints, 30, 'Formador')).toBe(4.0);
    });

    it('leaves points unchanged for other styles or undefined', () => {
      expect(applyMatchDevelopmentStyleBonus(4.0, 18, undefined)).toBe(4.0);
      expect(applyMatchDevelopmentStyleBonus(4.0, 18, 'Estrategista')).toBe(4.0);
      expect(applyMatchDevelopmentStyleBonus(4.0, 18, 'Ofensivo')).toBe(4.0);
      expect(applyMatchDevelopmentStyleBonus(4.0, 18, 'Gestor')).toBe(4.0);
    });
  });

  describe('Gestor style mechanical bonus (applySponsorshipStyleBonus)', () => {
    it('applies +5% weekly and +8% signing bonus rounded to thousands when Gestor', () => {
      const result = applySponsorshipStyleBonus(100_000, 500_000, 'Gestor');
      expect(result.weeklyAmount).toBe(105_000);
      expect(result.signingBonus).toBe(540_000);
    });

    it('leaves amounts unchanged for other styles or undefined', () => {
      const baseline = { weeklyAmount: 100_000, signingBonus: 500_000 };
      expect(applySponsorshipStyleBonus(100_000, 500_000, undefined)).toEqual(baseline);
      expect(applySponsorshipStyleBonus(100_000, 500_000, 'Estrategista')).toEqual(baseline);
      expect(applySponsorshipStyleBonus(100_000, 500_000, 'Ofensivo')).toEqual(baseline);
      expect(applySponsorshipStyleBonus(100_000, 500_000, 'Formador')).toEqual(baseline);
    });
  });
});

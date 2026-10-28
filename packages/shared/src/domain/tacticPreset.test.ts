import { describe, expect, it } from 'vitest';
import { CANONICAL_TACTIC_PRESETS, type TacticControl } from './tacticPreset.js';
import {
  ALL_FORMATIONS,
  ATTACK_APPROACH_MODIFIERS,
  ATTACK_STYLE_MODIFIERS,
  MARKING_STYLE_MODIFIERS,
  MENTALITY_MODIFIERS,
  PRESSING_MODIFIERS,
  DEFENSIVE_LINE_MODIFIERS,
} from './tactic.js';

const EXPECTED_PRESETS = [
  {
    id: 'tiki-taka',
    name: 'Tiki-Taka',
    formation: '4-3-3',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'ZONAL',
    attackApproach: 'BALANCED',
    pressing: 'HIGH_PRESS',
    transitionStyle: 'COUNTERPRESS',
    restDefenceShape: '3+2',
    defensiveLine: 'HIGH',
  },
  {
    id: 'gegenpressing',
    name: 'Gegenpressing',
    formation: '4-2-3-1',
    mentality: 'attacking',
    attackStyle: 'BALANCED',
    markingStyle: 'HEAVY',
    attackApproach: 'TOTAL_ATTACK',
    pressing: 'HIGH_PRESS',
    transitionStyle: 'COUNTERPRESS',
    restDefenceShape: '2+3',
    defensiveLine: 'HIGH',
  },
  {
    id: 'low-block-counter',
    name: 'Bloco Baixo & Contra-Golpe',
    formation: '5-3-2',
    mentality: 'defensive',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'ZONAL',
    attackApproach: 'COUNTER_ATTACK',
    pressing: 'LOW_BLOCK',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'DEEP',
  },
  {
    id: 'wing-play',
    name: 'Ataque pelas Pontas',
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'WINGS',
    markingStyle: 'BALANCED',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'BALANCED',
  },
  {
    id: 'midfield-diamond',
    name: 'Controle de Meio-Campo (Losango)',
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'ZONAL',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'BALANCED',
  },
  {
    id: 'total-football',
    name: 'Ataque Total',
    formation: '3-4-3',
    mentality: 'attacking',
    attackStyle: 'BALANCED',
    markingStyle: 'HEAVY',
    attackApproach: 'TOTAL_ATTACK',
    pressing: 'HIGH_PRESS',
    transitionStyle: 'COUNTERPRESS',
    restDefenceShape: '2+3',
    defensiveLine: 'HIGH',
  },
  {
    id: 'catenaccio',
    name: 'Catenaccio',
    formation: '5-3-2',
    mentality: 'defensive',
    attackStyle: 'BALANCED',
    markingStyle: 'MAN_MARKING',
    attackApproach: 'COUNTER_ATTACK',
    pressing: 'LOW_BLOCK',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'DEEP',
  },
  {
    id: 'balanced-transition',
    name: 'Transição Equilibrada',
    formation: '4-1-4-1',
    mentality: 'balanced',
    attackStyle: 'BALANCED',
    markingStyle: 'BALANCED',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '3+2',
    defensiveLine: 'BALANCED',
  },
] as const;

describe('canonical tactical presets', () => {
  it('contains the eight canonical configurations with stable ids', () => {
    expect(CANONICAL_TACTIC_PRESETS).toEqual(EXPECTED_PRESETS);
  });

  it('uses unique ids and names', () => {
    const ids = CANONICAL_TACTIC_PRESETS.map(({ id }) => id);
    const names = CANONICAL_TACTIC_PRESETS.map(({ name }) => name);

    expect(new Set(ids).size).toBe(8);
    expect(new Set(names).size).toBe(8);
  });

  it('uses only values supported by the current tactical domain', () => {
    for (const preset of CANONICAL_TACTIC_PRESETS) {
      expect(ALL_FORMATIONS).toContain(preset.formation);
      expect(Object.keys(MENTALITY_MODIFIERS)).toContain(preset.mentality);
      expect(Object.keys(ATTACK_STYLE_MODIFIERS)).toContain(preset.attackStyle);
      expect(Object.keys(MARKING_STYLE_MODIFIERS)).toContain(preset.markingStyle);
      expect(Object.keys(ATTACK_APPROACH_MODIFIERS)).toContain(preset.attackApproach);
      expect(Object.keys(PRESSING_MODIFIERS)).toContain(preset.pressing);
      expect(['COUNTERPRESS', 'RECOMPOSE']).toContain(preset.transitionStyle);
      expect(['3+2', '2+3']).toContain(preset.restDefenceShape);
      expect(Object.keys(DEFENSIVE_LINE_MODIFIERS)).toContain(preset.defensiveLine);
    }
  });

  it('defines every current tactical control on every canonical preset', () => {
    const controls = {
      formation: true,
      mentality: true,
      attackStyle: true,
      markingStyle: true,
      attackApproach: true,
      pressing: true,
      transitionStyle: true,
      restDefenceShape: true,
      defensiveLine: true,
    } satisfies Record<TacticControl, true>;

    for (const preset of CANONICAL_TACTIC_PRESETS) {
      for (const control of Object.keys(controls) as Array<keyof typeof controls>) {
        expect(preset[control]).toBeDefined();
      }
    }
  });

  it('keeps canonical templates separate from club-owned saved presets', () => {
    for (const preset of CANONICAL_TACTIC_PRESETS) {
      expect(preset).not.toHaveProperty('clubId');
      expect(preset).not.toHaveProperty('lineup');
      expect(preset).not.toHaveProperty('substitutes');
      expect(preset).not.toHaveProperty('isDefault');
    }
  });
});

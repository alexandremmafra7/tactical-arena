import { describe, it, expect } from 'vitest';
import { calculateCombatPerformanceBonus, COMBAT_BONUS_CONFIG } from './finance.js';
import type { MatchEvent } from './match.js';

describe('calculateCombatPerformanceBonus', () => {
  const baseEvent = (type: MatchEvent['type'], team: 'home' | 'away', extra: Partial<MatchEvent> = {}): MatchEvent => ({
    minute: 30,
    type,
    team,
    playerId: 'p1',
    description: 'lance',
    ...extra,
  });

  it('awards all 5 combat bonuses when every performance threshold is met', () => {
    const events: MatchEvent[] = [
      baseEvent('goal', 'home', { minute: 15 }),
      baseEvent('goal', 'home', { minute: 40 }),
      baseEvent('goal', 'home', { minute: 75 }),
      baseEvent('goal', 'home', { minute: 88 }),
      baseEvent('card', 'away', { suspensionMatches: 1 }), // Red card for away team, home is clean
    ];

    const result = calculateCombatPerformanceBonus({
      events,
      mySide: 'home',
      myGoals: 4,
      opponentGoals: 0,
      pressRecoveries: 6,
      isUnderdog: true,
    });

    expect(result.items).toHaveLength(5);
    expect(result.items.map((i) => i.id)).toEqual([
      'CLEAN_SHEET',
      'HIGH_PRESS',
      'UNDERDOG_RESILIENCE',
      'FAIR_PLAY',
      'DOMINANT_MARGIN',
    ]);

    const expectedTotal =
      COMBAT_BONUS_CONFIG.CLEAN_SHEET +
      COMBAT_BONUS_CONFIG.HIGH_PRESS +
      COMBAT_BONUS_CONFIG.UNDERDOG +
      COMBAT_BONUS_CONFIG.FAIR_PLAY +
      COMBAT_BONUS_CONFIG.DOMINANT_MARGIN;

    expect(result.totalBonus).toBe(expectedTotal);
    expect(result.totalBonus).toBe(110_000);
  });

  it('does not grant clean sheet bonus on a 0-0 draw, but awards underdog resilience and fair play', () => {
    const result = calculateCombatPerformanceBonus({
      events: [],
      mySide: 'home',
      myGoals: 0,
      opponentGoals: 0,
      pressRecoveries: 2,
      isUnderdog: true,
    });

    expect(result.items.some((i) => i.id === 'CLEAN_SHEET')).toBe(false);
    expect(result.items.some((i) => i.id === 'UNDERDOG_RESILIENCE')).toBe(true);
    expect(result.items.some((i) => i.id === 'FAIR_PLAY')).toBe(true);
    expect(result.totalBonus).toBe(COMBAT_BONUS_CONFIG.UNDERDOG + COMBAT_BONUS_CONFIG.FAIR_PLAY);
  });

  it('denies fair play bonus if team suffered a direct red card', () => {
    const events: MatchEvent[] = [
      baseEvent('card', 'home', { suspensionMatches: 2, description: 'Cartão vermelho direto' }),
    ];

    const result = calculateCombatPerformanceBonus({
      events,
      mySide: 'home',
      myGoals: 1,
      opponentGoals: 0,
      pressRecoveries: 3,
      isUnderdog: false,
    });

    expect(result.items.some((i) => i.id === 'FAIR_PLAY')).toBe(false);
    expect(result.items.some((i) => i.id === 'CLEAN_SHEET')).toBe(true);
  });

  it('ignores opponent red card when calculating home fair play', () => {
    const events: MatchEvent[] = [
      baseEvent('card', 'away', { suspensionMatches: 1, description: 'Cartão vermelho adversário' }),
    ];

    const result = calculateCombatPerformanceBonus({
      events,
      mySide: 'home',
      myGoals: 1,
      opponentGoals: 1,
      pressRecoveries: 0,
      isUnderdog: false,
    });

    expect(result.items.some((i) => i.id === 'FAIR_PLAY')).toBe(true);
  });

  it('correctly evaluates dominant margin (>= 3 goals gap)', () => {
    // 3-0 win: margin 3 -> awarded
    const res3_0 = calculateCombatPerformanceBonus({
      events: [],
      mySide: 'home',
      myGoals: 3,
      opponentGoals: 0,
    });
    expect(res3_0.items.some((i) => i.id === 'DOMINANT_MARGIN')).toBe(true);

    // 2-0 win: margin 2 -> not awarded
    const res2_0 = calculateCombatPerformanceBonus({
      events: [],
      mySide: 'home',
      myGoals: 2,
      opponentGoals: 0,
    });
    expect(res2_0.items.some((i) => i.id === 'DOMINANT_MARGIN')).toBe(false);

    // 4-1 win: margin 3 -> awarded
    const res4_1 = calculateCombatPerformanceBonus({
      events: [],
      mySide: 'home',
      myGoals: 4,
      opponentGoals: 1,
    });
    expect(res4_1.items.some((i) => i.id === 'DOMINANT_MARGIN')).toBe(true);
  });

  it('evaluates high press threshold (>= 5 recoveries)', () => {
    const res4 = calculateCombatPerformanceBonus({
      events: [],
      mySide: 'away',
      myGoals: 1,
      opponentGoals: 1,
      pressRecoveries: 4,
    });
    expect(res4.items.some((i) => i.id === 'HIGH_PRESS')).toBe(false);

    const res5 = calculateCombatPerformanceBonus({
      events: [],
      mySide: 'away',
      myGoals: 1,
      opponentGoals: 1,
      pressRecoveries: 5,
    });
    expect(res5.items.some((i) => i.id === 'HIGH_PRESS')).toBe(true);
  });

  it('returns empty items (except fair play if no red) when losing without thresholds', () => {
    const events: MatchEvent[] = [
      baseEvent('card', 'home', { suspensionMatches: 1 }),
    ];
    const result = calculateCombatPerformanceBonus({
      events,
      mySide: 'home',
      myGoals: 0,
      opponentGoals: 2,
      pressRecoveries: 1,
      isUnderdog: false,
    });

    expect(result.items).toHaveLength(0);
    expect(result.totalBonus).toBe(0);
  });
});

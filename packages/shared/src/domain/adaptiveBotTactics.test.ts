import { describe, expect, it } from 'vitest';
import { computeMidMatchAdaptiveTactic } from './adaptiveBotTactics.js';
import type { Tactic } from './tactic.js';

const baseTactic: Tactic = {
  clubId: 'club-test',
  formation: '4-4-2',
  lineup: [
    { playerId: 'p1' },
    { playerId: 'p2' },
    { playerId: 'p3' },
    { playerId: 'p4' },
    { playerId: 'p5' },
    { playerId: 'p6' },
    { playerId: 'p7' },
    { playerId: 'p8' },
    { playerId: 'p9' },
    { playerId: 'p10' },
    { playerId: 'p11' },
  ],
  substitutes: [],
  plannedSubstitutions: [],
  mentality: 'balanced',
  attackStyle: 'BALANCED',
  markingStyle: 'BALANCED',
  attackApproach: 'BALANCED',
  pressing: 'MEDIUM',
};



describe('Adaptive Bot Tactics Engine', () => {
  it('does not adjust tactic in early normal game when score is tied', () => {
    const outcome = computeMidMatchAdaptiveTactic({
      minute: 25,
      currentScore: { home: 0, away: 0 },
      botSide: 'away',
      botCurrentTactic: baseTactic,
    });

    expect(outcome.adjusted).toBe(false);
    expect(outcome.newTactic.mentality).toBe('balanced');
  });

  it('triggers ATTACKING_SURGE when trailing by 1 goal at 68th minute', () => {
    const outcome = computeMidMatchAdaptiveTactic({
      minute: 68,
      currentScore: { home: 1, away: 0 },
      botSide: 'away',
      botCurrentTactic: baseTactic,
    });

    expect(outcome.adjusted).toBe(true);
    expect(outcome.adjustmentType).toBe('ATTACKING_SURGE');
    expect(outcome.newTactic.mentality).toBe('attacking');
    expect(outcome.newTactic.pressing).toBe('HIGH_PRESS');
  });

  it('triggers DESPERATE_CHASE when trailing by 2 goals at 80th minute', () => {
    const outcome = computeMidMatchAdaptiveTactic({
      minute: 80,
      currentScore: { home: 3, away: 1 },
      botSide: 'away',
      botCurrentTactic: baseTactic,
    });

    expect(outcome.adjusted).toBe(true);
    expect(outcome.adjustmentType).toBe('DESPERATE_CHASE');
    expect(outcome.newTactic.mentality).toBe('attacking');
    expect(outcome.newTactic.attackApproach).toBe('TOTAL_ATTACK');
  });


  it('triggers DEFEND_NARROW_LEAD when winning 1-0 at 82nd minute', () => {
    const outcome = computeMidMatchAdaptiveTactic({
      minute: 82,
      currentScore: { home: 0, away: 1 },
      botSide: 'away',
      botCurrentTactic: baseTactic,
    });

    expect(outcome.adjusted).toBe(true);
    expect(outcome.adjustmentType).toBe('DEFEND_NARROW_LEAD');
    expect(outcome.newTactic.mentality).toBe('defensive');
    expect(outcome.newTactic.pressing).toBe('LOW_BLOCK');
  });

  it('triggers RED_CARD_RECOMPOSE immediately when a bot player is sent off', () => {
    const outcome = computeMidMatchAdaptiveTactic({
      minute: 35,
      currentScore: { home: 0, away: 0 },
      botSide: 'home',
      botCurrentTactic: baseTactic,
      hasRedCard: true,
    });

    expect(outcome.adjusted).toBe(true);
    expect(outcome.adjustmentType).toBe('RED_CARD_RECOMPOSE');
    expect(outcome.newTactic.pressing).toBe('LOW_BLOCK');
  });

  it('triggers MAN_ADVANTAGE_EXPLOIT when opponent receives a red card and game is tied', () => {
    const outcome = computeMidMatchAdaptiveTactic({
      minute: 50,
      currentScore: { home: 1, away: 1 },
      botSide: 'home',
      botCurrentTactic: baseTactic,
      opponentHasRedCard: true,
    });

    expect(outcome.adjusted).toBe(true);
    expect(outcome.adjustmentType).toBe('MAN_ADVANTAGE_EXPLOIT');
    expect(outcome.newTactic.attackStyle).toBe('WINGS');
    expect(outcome.newTactic.pressing).toBe('HIGH_PRESS');
  });
});

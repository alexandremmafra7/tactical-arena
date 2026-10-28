import { describe, expect, it } from 'vitest';
import {
  evaluateFastAdvanceInterruption,
  formatFastAdvanceSummary,
  type FastAdvanceResult,
} from './fastAdvance.js';

describe('Fast Advance & Calendar Simulation Domain', () => {
  it('allows unblocked advance when squad is healthy and no urgent notices exist', () => {
    const check = evaluateFastAdvanceInterruption({
      players: [
        { id: 'p1', name: 'Gerson', stamina: 90, star_level: 4 },
        { id: 'p2', name: 'Pedro', stamina: 85, star_level: 4 },
      ],
      pendingOffersCount: 1,
      urgentBoardNotice: false,
    });

    expect(check.interrupted).toBe(false);
    expect(check.reason).toBeUndefined();
  });

  it('interrupts fast advance if a star player (star_level >= 4) gets injured', () => {
    const check = evaluateFastAdvanceInterruption({
      players: [
        { id: 'p1', name: 'Arrascaeta', stamina: 40, isInjured: true, star_level: 5 },
      ],
    });

    expect(check.interrupted).toBe(true);
    expect(check.reason?.type).toBe('INJURY');
    expect(check.reason?.description).toContain('Arrascaeta');
  });

  it('interrupts fast advance if an urgent board notice is triggered', () => {
    const check = evaluateFastAdvanceInterruption({
      players: [],
      urgentBoardNotice: true,
    });

    expect(check.interrupted).toBe(true);
    expect(check.reason?.type).toBe('BOARD_CRISIS');
  });

  it('interrupts fast advance when there are 3 or more pending transfer offers', () => {
    const check = evaluateFastAdvanceInterruption({
      players: [],
      pendingOffersCount: 3,
    });

    expect(check.interrupted).toBe(true);
    expect(check.reason?.type).toBe('TRANSFER_OFFER');
  });

  it('formats human-readable summary accurately', () => {
    const result: FastAdvanceResult = {
      stepsAdvanced: 3,
      initialDate: '2026-04-05',
      finalDate: '2026-04-26',
      nextMatch: {
        matchId: 'match-123',
        opponentId: 'club-palmeiras',
        opponentName: 'Palmeiras',
        isHome: true,
        competitionName: 'Série A',
        round: 4,
        date: '2026-04-26',
      },
      eventsSummary: ['Elenco recuperou 15% de fôlego'],
      interrupted: false,
      staminaRecovered: true,
    };

    const text = formatFastAdvanceSummary(result);
    expect(text).toContain('Avanço concluído até 2026-04-26');
    expect(text).toContain('Palmeiras');
    expect(text).toContain('em casa');
  });
});

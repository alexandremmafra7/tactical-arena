import type { MatchEvent } from '../domain/match.js';

export interface StoppageInfo {
  half1: number;
  half2: number;
}

/**
 * Calculates additional stoppage time according to modern IFAB/FIFA/CBF football regulations.
 * Factors:
 * - Goals + celebrations (~1 min)
 * - Medical attendances / serious injuries (~1.5 - 2 min)
 * - Red cards / major delays / VAR reviews (~1.5 min)
 * - Substitutions (~0.5 min each)
 *
 * Shared by the server (which must actually simulate the added minutes past 90) and the web client
 * (which renders the board and paces the clock) so the announced stoppage can never drift apart.
 */
export function calculateStoppageTime(events: MatchEvent[]): StoppageInfo {
  const h1Events = events.filter((e) => e.period === '1T' || (!e.period && e.minute <= 45));
  const h2Events = events.filter((e) => e.period === '2T' || (!e.period && e.minute > 45));

  let h1 = 1.0; // Standard minimal 1st half baseline
  for (const ev of h1Events) {
    if (ev.type === 'goal') h1 += 1.0;
    else if (ev.type === 'injury') h1 += 1.5;
    else if (ev.type === 'card' && (ev.suspensionMatches !== undefined || ev.description.toLowerCase().includes('vermelho'))) h1 += 1.5;
    else if (ev.type === 'substitution') h1 += 0.5;
  }

  let h2 = 3.0; // Standard 2nd half baseline with substitutions
  for (const ev of h2Events) {
    if (ev.type === 'goal') h2 += 1.0;
    else if (ev.type === 'injury') h2 += 1.5;
    else if (ev.type === 'card' && (ev.suspensionMatches !== undefined || ev.description.toLowerCase().includes('vermelho'))) h2 += 1.5;
    else if (ev.type === 'substitution') h2 += 0.5;
  }

  return {
    half1: Math.min(8, Math.max(1, Math.round(h1))),
    half2: Math.min(10, Math.max(2, Math.round(h2))),
  };
}

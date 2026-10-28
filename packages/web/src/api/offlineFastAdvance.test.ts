import { describe, expect, it } from 'vitest';
import {
  prepareOfflineWorld,
  loadLocalGameState,
  localClaimClub,
  localFastAdvanceToNextMatch,
  resetInMemoryGameState,
} from './localEngine.js';

describe('Offline Fast Advance to Next Match', () => {
  it('advances until manager reaches the next active matchday and recovers stamina', async () => {
    await prepareOfflineWorld();
    const state = loadLocalGameState();
    const club = state.clubs[0];
    await localClaimClub(club.id);





    // Initial check
    const result = await localFastAdvanceToNextMatch(club.id);

    expect(result.stepsAdvanced).toBeGreaterThanOrEqual(1);
    expect(result.finalDate).toBeDefined();
    expect(result.staminaRecovered).toBe(true);
    expect(result.eventsSummary.length).toBeGreaterThan(0);
  });
});

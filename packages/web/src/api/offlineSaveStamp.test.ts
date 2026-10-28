import { describe, expect, it, beforeEach } from 'vitest';
import { loadLocalGameState, saveLocalGameState, resetInMemoryGameState } from './localEngine.js';

const KEY = 'tactical_arena_offline_save_v1';

/** Writes are debounced by 100 ms, so a career is only on disk a moment after the screen thinks it is. */
const gravado = () => new Promise((resolve) => setTimeout(resolve, 150));

/**
 * A save belongs to the build that wrote it.
 *
 * `localStorage` outlives reinstalls, so a career started on an older build opens on a newer one carrying
 * that older build's world. That is exactly how the invented squads survived the day the real club database
 * shipped: the code was right and the save on the phone was not. While the game changes daily, the save is
 * dropped rather than migrated.
 */
describe('a save from another build is not opened', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInMemoryGameState();
  });

  it('stamps every save it writes', async () => {
    saveLocalGameState(loadLocalGameState());
    await gravado();

    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(typeof stored.buildStamp).toBe('string');
    expect(stored.buildStamp.length).toBeGreaterThan(0);
  });

  it('throws away a career written by a different build', () => {
    const antigo = loadLocalGameState();
    antigo.clubs[0].name = 'Clube De Uma Versão Velha';
    localStorage.setItem(KEY, JSON.stringify({ ...antigo, buildStamp: 'uma-build-antiga' }));
    resetInMemoryGameState();

    // Rebuilt from scratch rather than healed, which is what the loader does for every other kind of drift.
    expect(loadLocalGameState().clubs.some((c) => c.name === 'Clube De Uma Versão Velha')).toBe(false);
  });

  it('keeps a career being played on this build', async () => {
    const atual = loadLocalGameState();
    atual.clubs[0].budget = 12_345;
    saveLocalGameState(atual);
    await gravado();
    resetInMemoryGameState();

    /**
     * The half that matters as much as the discard: the stamp changes when a build is generated, not when the
     * app is opened, so a session in progress must not lose its money between two screens.
     */
    expect(loadLocalGameState().clubs[0].budget).toBe(12_345);
  });

  it('survives a save that is not readable at all', () => {
    localStorage.setItem(KEY, '{ isso não é json');
    resetInMemoryGameState();

    // Corrupt storage used to be a blank screen with no way back in, which on a phone is an uninstall.
    expect(loadLocalGameState().clubs.length).toBeGreaterThan(0);
  });
});

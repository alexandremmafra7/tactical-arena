import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  prepareOfflineWorld,
  localGetClub,
  localUpdateStaffDelegation,
  loadLocalGameState,
  resetInMemoryGameState,
} from './localEngine.js';
import { getStaffDelegationPreset } from '@tactical-arena/shared';

const PUBLIC = path.resolve(__dirname, '../../public');

describe('offline staff delegation', () => {
  beforeEach(async () => {
    localStorage.clear();
    resetInMemoryGameState();
    globalThis.fetch = (async (url: string) => {
      const file = path.join(PUBLIC, String(url).replace(/^\//, ''));
      if (!fs.existsSync(file)) return { ok: false } as Response;
      return { ok: true, text: async () => fs.readFileSync(file, 'utf8') } as Response;
    }) as typeof fetch;
    await prepareOfflineWorld();
  });

  it('updates delegation config offline and persists across save reloads', async () => {
    const state = loadLocalGameState();
    const clubId = state.clubs[0].id;

    const customConfig = getStaffDelegationPreset('football_manager_hardcore');
    const updated = await localUpdateStaffDelegation(clubId, customConfig);

    expect(updated.staffDelegationConfig?.presetMode).toBe('football_manager_hardcore');
    expect(updated.staffDelegationConfig?.autoSubstitutionsInMatch).toBe(false);

    const reloadedClub = await localGetClub(clubId);
    expect(reloadedClub.staffDelegationConfig?.presetMode).toBe('football_manager_hardcore');
    expect(reloadedClub.staffDelegationConfig?.autoSubstitutionsInMatch).toBe(false);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  prepareOfflineWorld,
  localGetClub,
  localGetContracts,
  localBatchRenewContracts,
  loadLocalGameState,
  resetInMemoryGameState,
  saveLocalGameState,
} from './localEngine.js';

const PUBLIC = path.resolve(__dirname, '../../public');

describe('offline contract batch renewals', () => {
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

  it('provides contract overview with expiring analysis and executes batch renewals offline', async () => {
    const state = loadLocalGameState();
    const club = state.clubs[0];

    // Set 2 players to expiring in current season
    club.players[0].contractUntil = state.currentSeason ?? 2026;
    club.players[1].contractUntil = state.currentSeason ?? 2026;
    saveLocalGameState(state);

    const contractsOverview = await localGetContracts(club.id);
    expect(contractsOverview.expiringAnalysis).toBeDefined();
    expect(contractsOverview.expiringAnalysis.allExpiring.length).toBeGreaterThanOrEqual(2);

    const p0Id = club.players[0].id;
    const p1Id = club.players[1].id;

    const batchResult = await localBatchRenewContracts(club.id, [p0Id, p1Id], 2);
    expect(batchResult.renewedCount).toBe(2);
    expect(batchResult.totalCost).toBeGreaterThan(0);

    const reloaded = await localGetClub(club.id);
    const p0 = reloaded.players.find((p) => p.id === p0Id);
    const p1 = reloaded.players.find((p) => p.id === p1Id);

    expect(p0?.contractUntil).toBe((state.currentSeason ?? 2026) + 2);
    expect(p1?.contractUntil).toBe((state.currentSeason ?? 2026) + 2);
  });
});

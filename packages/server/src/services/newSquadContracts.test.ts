import { describe, expect, it } from 'vitest';
import { generateStarterSquad } from '@tactical-arena/shared';
import { stampContractsForSeason } from './newSquadContracts.js';

describe('stampContractsForSeason', () => {
  it('uses the supplied staged season without reading global game state', () => {
    const players = generateStarterSquad('club-a', 'BRA');
    const stamped = stampContractsForSeason(players, 'club-a', 2042);

    expect(stamped).toHaveLength(players.length);
    expect(stamped.every((player) => (player.contractUntil ?? 0) > 2042)).toBe(true);
  });
});

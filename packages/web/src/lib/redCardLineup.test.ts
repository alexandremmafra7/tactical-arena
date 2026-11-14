import { describe, expect, it } from 'vitest';
import type { Tactic } from '@tactical-arena/shared';
import { reorderedLineup } from './redCardLineup';

const tactic = {
  lineup: ['gk', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((playerId, slotIndex) => ({
    slotIndex,
    playerId,
    role: 'MC',
  })),
} as unknown as Tactic;

describe('reorderedLineup', () => {
  it('aceita os 11 com outra ordem', () => {
    const ids = ['gk', 'b', 'a', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    expect(reorderedLineup(tactic, ids)).toEqual(ids);
  });

  it('com só os 10 restantes, devolve o expulso ao slot dele', () => {
    const ids = ['gk', 'a', 'b', 'c', 'e', 'f', 'g', 'h', 'i', 'j'];
    expect(reorderedLineup(tactic, ids)).toEqual(['gk', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
  });

  it('recusa jogador que não estava em campo', () => {
    const ids = ['gk', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'reserva'];
    expect(reorderedLineup(tactic, ids)).toBeNull();
  });
});

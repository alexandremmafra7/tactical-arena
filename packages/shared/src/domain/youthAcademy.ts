import type { Player } from './player.js';
import type { StaffDelegationConfig } from './staffDelegationConfig.js';

export const MAX_SQUAD_SIZE = 35;

export interface PromotionResult {
  players: Player[];
  academyPlayers: Player[];
  promoted: Player[];
}

export function isYouthGem(player: Player): boolean {
  return player.potential >= 82 || player.starLevel === 'NATURAL' || player.diferenciado === true;
}

export function resolveYouthPromotions(
  players: Player[],
  prospects: Player[],
  config: StaffDelegationConfig,
): PromotionResult {
  if (config.youthPromotions !== 'auto_promote_high_potential') {
    return {
      players,
      academyPlayers: prospects,
      promoted: [],
    };
  }

  const availableSlots = Math.max(0, MAX_SQUAD_SIZE - players.length);
  if (availableSlots <= 0) {
    return {
      players,
      academyPlayers: prospects,
      promoted: [],
    };
  }

  // Ready jewels (overall >= 70 & potential >= 82) and aged-out prospects (age >= 20)
  const readyJewels = prospects.filter((p) => p.overall >= 70 && p.potential >= 82);
  const agedOut = prospects.filter((p) => p.age >= 20 && !readyJewels.some((r) => r.id === p.id));

  const candidates = [...readyJewels, ...agedOut].sort((a, b) => b.overall - a.overall);
  const toPromote = candidates.slice(0, availableSlots);
  const promotedIds = new Set(toPromote.map((p) => p.id));
  const remainingAcademy = prospects.filter((p) => !promotedIds.has(p.id));

  return {
    players: [...players, ...toPromote],
    academyPlayers: remainingAcademy,
    promoted: toPromote,
  };
}

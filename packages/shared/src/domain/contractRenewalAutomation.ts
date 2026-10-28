import type { Club } from './club.js';
import type { Player, PlayerTier } from './player.js';
import { calculateWage, getPlayerTier } from './player.js';
import { renewContract, renewalCost, seasonsRemaining } from './contract.js';
import { getDirectorTransferDiscount } from './staff.js';
import { DEFAULT_STAFF_DELEGATION_CONFIG } from './staffDelegationConfig.js';

export type ExpiringContractCategory = 'KEY_PLAYER' | 'SQUAD_PLAYER' | 'SURPLUS';

export interface ExpiringContractItem {
  player: Player;
  category: ExpiringContractCategory;
  seasonsRemaining: number;
  recommendedWage: number;
  estimatedRenewalCost: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  directorRecommendation: string;
  tier: PlayerTier | null;
}

export interface CategorizedExpiringContracts {
  allExpiring: ExpiringContractItem[];
  keyPlayers: ExpiringContractItem[];
  squadPlayers: ExpiringContractItem[];
  surplusPlayers: ExpiringContractItem[];
  recommendedBatchPlayerIds: string[];
  totalBatchCost: number;
}

export interface BatchRenewOptions {
  years?: number;
  yearsMap?: Record<string, number>;
  updateWages?: boolean;
}

export interface BatchRenewResult {
  updatedClub: Club;
  renewedPlayers: Player[];
  totalCost: number;
  failedPlayerIds: string[];
}

/**
 * Calculates a realistic and fair wage adjustment based on player rating, age, potential, and status.
 */
export function computeRecommendedWage(
  player: Player,
  club?: Club,
  divisionAvgRating?: number,
): number {
  const currentWage = player.wage || calculateWage(player.marketValue);
  const marketWage = calculateWage(player.marketValue);
  const tier = getPlayerTier(player.overall, player.starLevel, player.diferenciado);

  let targetWage = Math.max(currentWage, marketWage);

  // Star & Standout bonuses
  if (tier === 'GENIO') {
    targetWage = Math.round(targetWage * 1.25);
  } else if (tier === 'BAITA') {
    targetWage = Math.round(targetWage * 1.15);
  }

  // Young promise bonus
  if (player.age <= 22 && player.potential >= 80) {
    targetWage = Math.round(targetWage * 1.12);
  }

  // Veteran adjustment (31+ without star tier should have modest wage demands)
  if (player.age >= 31 && !tier) {
    targetWage = Math.round(Math.min(targetWage, currentWage * 1.05));
  }

  // Division benchmark adjustment if provided
  if (divisionAvgRating && divisionAvgRating > 0) {
    const delta = player.overall - divisionAvgRating;
    if (delta > 5) {
      targetWage = Math.round(targetWage * 1.1);
    }
  }

  return Math.max(100, Math.round(targetWage / 50) * 50);
}

/**
 * Identifies and categorizes expiring contracts in a squad.
 * Supports passing either a Club or a list of Players directly.
 */
export function identifyExpiringContracts(
  clubOrPlayers: Club | Player[],
  warningWeeksThreshold = 10,
  currentSeason = 2026,
  maybeClub?: Club,
): CategorizedExpiringContracts {
  const isClub = !Array.isArray(clubOrPlayers) && typeof clubOrPlayers === 'object' && 'players' in clubOrPlayers;
  const club: Club | undefined = isClub ? (clubOrPlayers as Club) : maybeClub;
  const players: Player[] = isClub ? (clubOrPlayers as Club).players ?? [] : (clubOrPlayers as Player[]) ?? [];

  if (players.length === 0) {
    return {
      allExpiring: [],
      keyPlayers: [],
      squadPlayers: [],
      surplusPlayers: [],
      recommendedBatchPlayerIds: [],
      totalBatchCost: 0,
    };
  }

  const seasonYear = currentSeason;
  const footballDirector = club?.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const squadAvg = Math.round(players.reduce((sum, p) => sum + p.overall, 0) / players.length);
  const maxOverall = Math.max(...players.map((p) => p.overall));

  const allExpiring: ExpiringContractItem[] = [];
  const keyPlayers: ExpiringContractItem[] = [];
  const squadPlayers: ExpiringContractItem[] = [];
  const surplusPlayers: ExpiringContractItem[] = [];

  // Determine expiring players (<= 1 season remaining or warning threshold)
  // In season-based model, <= 1 season is expiring or near expiration
  const expiringPlayers = players.filter((p) => {
    const remaining = seasonsRemaining(p, seasonYear);
    return remaining <= 1;
  });

  for (const player of expiringPlayers) {
    const remaining = seasonsRemaining(player, seasonYear);
    const tier = getPlayerTier(player.overall, player.starLevel, player.diferenciado);
    const recommendedWage = computeRecommendedWage(player, club);
    const renewalYears = 2;
    const estimatedRenewalCost = renewalCost(player, seasonYear, renewalYears, footballDirector);

    // 1. Key Players / Stars check
    const rawStarLevel = (player as unknown as { star_level?: number })?.star_level;
    const isNumericStar = typeof rawStarLevel === 'number' && rawStarLevel >= 4;
    const isKeyPlayer =
      tier === 'GENIO' ||
      tier === 'BAITA' ||
      player.starLevel === 'NATURAL' ||
      player.starLevel === 'DEVELOPED' ||
      isNumericStar ||
      Boolean(player.diferenciado) ||
      player.overall >= 82 ||
      (player.overall >= maxOverall - 1 && players.length >= 11);

    // 2. Surplus check (low-tier veterans or low-potential academy prospects)
    const isSurplus =
      !isKeyPlayer &&
      ((player.age >= 31 && player.overall < squadAvg - 1) ||
        (player.age <= 22 && player.potential < 72 && player.overall < squadAvg - 3) ||
        (player.overall < squadAvg - 5 && player.potential <= squadAvg));

    let category: ExpiringContractCategory;
    let urgency: 'HIGH' | 'MEDIUM' | 'LOW';
    let directorRecommendation: string;

    if (isKeyPlayer) {
      category = 'KEY_PLAYER';
      urgency = 'HIGH';
      directorRecommendation = `Craque/Pilar da equipe (${player.overall} OVR). Renove com urgência para não perder de graça!`;
    } else if (isSurplus) {
      category = 'SURPLUS';
      urgency = 'LOW';
      directorRecommendation = `Excedente/Abaixo do padrão do elenco. Diretor recomenda deixar o contrato encerrar.`;
    } else {
      category = 'SQUAD_PLAYER';
      urgency = remaining <= 0 ? 'HIGH' : 'MEDIUM';
      directorRecommendation = `Peça importante de rotação do elenco (${player.position}, ${player.overall} OVR). Recomendada renovação rápida.`;
    }

    const item: ExpiringContractItem = {
      player,
      category,
      seasonsRemaining: remaining,
      recommendedWage,
      estimatedRenewalCost,
      urgency,
      directorRecommendation,
      tier,
    };

    allExpiring.push(item);
    if (category === 'KEY_PLAYER') keyPlayers.push(item);
    else if (category === 'SURPLUS') surplusPlayers.push(item);
    else squadPlayers.push(item);
  }

  // Sort by urgency and quality
  allExpiring.sort((a, b) => {
    const urgScore = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return urgScore[b.urgency] - urgScore[a.urgency] || b.player.overall - a.player.overall;
  });

  // Recommended batch includes key players and squad players (not surplus)
  const recommendedBatchItems = [...keyPlayers, ...squadPlayers];
  const recommendedBatchPlayerIds = recommendedBatchItems.map((i) => i.player.id);
  const totalBatchCost = recommendedBatchItems.reduce((sum, i) => sum + i.estimatedRenewalCost, 0);

  return {
    allExpiring,
    keyPlayers,
    squadPlayers,
    surplusPlayers,
    recommendedBatchPlayerIds,
    totalBatchCost,
  };
}

/**
 * Applies contract renewals in batch atomically for selected players with calculated wage adjustment
 * and new contract duration.
 */
export function batchRenewContracts(
  club: Club,
  playerIds: string[],
  currentSeason = 2026,
  options: BatchRenewOptions = {},
): BatchRenewResult {
  const defaultYears = Math.max(1, Math.min(5, Math.round(options.years ?? 2)));
  const updateWages = options.updateWages ?? true;
  const footballDirector = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');

  let remainingBudget = club.budget;
  const renewedPlayers: Player[] = [];
  const failedPlayerIds: string[] = [];
  let totalCost = 0;

  const playerMap = new Map((club.players ?? []).map((p) => [p.id, p]));
  const updatedPlayersList = [...(club.players ?? [])];

  for (const playerId of playerIds) {
    const player = playerMap.get(playerId);
    if (!player) {
      failedPlayerIds.push(playerId);
      continue;
    }

    const playerYears = options.yearsMap?.[playerId]
      ? Math.max(1, Math.min(5, Math.round(options.yearsMap[playerId])))
      : defaultYears;

    const cost = renewalCost(player, currentSeason, playerYears, footballDirector);
    if (remainingBudget < cost) {
      failedPlayerIds.push(playerId);
      continue;
    }

    // Apply renewal
    let renewed = renewContract(player, currentSeason, playerYears);
    if (updateWages) {
      const newWage = computeRecommendedWage(renewed, club);
      renewed = { ...renewed, wage: newWage };
    }

    const playerIndex = updatedPlayersList.findIndex((p) => p.id === playerId);
    if (playerIndex !== -1) {
      updatedPlayersList[playerIndex] = renewed;
    }

    remainingBudget -= cost;
    totalCost += cost;
    renewedPlayers.push(renewed);
  }

  const updatedClub: Club = {
    ...club,
    players: updatedPlayersList,
    budget: remainingBudget,
  };

  return {
    updatedClub,
    renewedPlayers,
    totalCost,
    failedPlayerIds,
  };
}

/**
 * Processes automated contract renewals driven by the Director of Football delegation settings.
 */
export function processDirectorContractDelegation(
  club: Club,
  currentSeason = 2026,
): {
  club: Club;
  renewedCount: number;
  renewedPlayers: Player[];
  keyPlayersRequiringDecision: ExpiringContractItem[];
  headline: string | null;
} {
  const config = club.staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG;
  const delegation = config.contractRenewals ?? (config.presetMode === 'football_manager_hardcore' ? 'manual' : 'director_handles_routine');

  const analysis = identifyExpiringContracts(club, 10, currentSeason);

  // If manual (or football_manager_hardcore preset), director does not auto-renew anything
  if (delegation === 'manual') {
    return {
      club,
      renewedCount: 0,
      renewedPlayers: [],
      keyPlayersRequiringDecision: analysis.allExpiring,
      headline: null,
    };
  }

  // If notify_only_key_players: no automatic renewal, just report key players
  if (delegation === 'notify_only_key_players') {
    return {
      club,
      renewedCount: 0,
      renewedPlayers: [],
      keyPlayersRequiringDecision: analysis.keyPlayers,
      headline: null,
    };
  }

  // If director_handles_routine (or brasfoot_casual preset / default)
  const routinePlayerIds = analysis.squadPlayers.map((item) => item.player.id);
  if (routinePlayerIds.length === 0) {
    return {
      club,
      renewedCount: 0,
      renewedPlayers: [],
      keyPlayersRequiringDecision: analysis.keyPlayers,
      headline: null,
    };
  }

  const batchResult = batchRenewContracts(club, routinePlayerIds, currentSeason, { years: 2, updateWages: true });
  const count = batchResult.renewedPlayers.length;

  let headline: string | null = null;
  if (count > 0) {
    headline =
      count === 1
        ? '📝 O Diretor de Futebol renovou o contrato de 1 atleta da equipe.'
        : `📝 O Diretor de Futebol renovou o contrato de ${count} atletas da equipe.`;
  }

  return {
    club: batchResult.updatedClub,
    renewedCount: count,
    renewedPlayers: batchResult.renewedPlayers,
    keyPlayersRequiringDecision: analysis.keyPlayers,
    headline,
  };
}

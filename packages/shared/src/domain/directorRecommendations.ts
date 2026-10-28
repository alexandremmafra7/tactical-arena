import type { Club } from './club.js';
import type { Player, Position } from './player.js';
import { getPlayerTier } from './player.js';
import { getDirectorTransferDiscount } from './staff.js';

export interface CandidateScoutPlayer {
  clubId: string;
  clubName: string;
  player: Player;
  askingPrice?: number;
}

export interface DirectorTransferRecommendation {
  player: Player;
  sellerClubId: string;
  sellerClubName: string;
  suggestedOfferPrice: number;
  askingPrice?: number;
  rationale: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  targetPosition: Position;
  isStarterUpgrade: boolean;
  fitScore: number;
  comparisonWithStarter?: {
    currentStarterName?: string;
    currentStarterOverall?: number;
    overallDifference: number;
  };
}

export interface SquadDepthAnalysis {
  counts: Record<Position, number>;
  starters: Record<Position, Player | null>;
  shortages: {
    position: Position;
    currentCount: number;
    targetCount: number;
    urgency: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
  }[];
  qualityGaps: {
    position: Position;
    starterOverall: number;
    benchmarkOverall: number;
    starterName?: string;
  }[];
}

const POSITION_LABELS: Record<Position, string> = {
  GK: 'Goleiro',
  DEF: 'Zagueiro',
  LAT: 'Lateral',
  MID: 'Meio-campista',
  ATT: 'Atacante',
};

/** Minimum squad depth thresholds recommended by modern football directors */
export const SQUAD_DEPTH_TARGETS: Record<Position, number> = {
  GK: 2,
  DEF: 4,
  LAT: 2,
  MID: 5,
  ATT: 4,
};

/**
 * Analyzes squad composition, position count thresholds, and starter quality against benchmark.
 */
export function analyzeSquadDepth(club: Club, divisionAvgRating?: number): SquadDepthAnalysis {
  const players = club.players ?? [];
  const counts: Record<Position, number> = {
    GK: 0,
    DEF: 0,
    LAT: 0,
    MID: 0,
    ATT: 0,
  };
  const starters: Record<Position, Player | null> = {
    GK: null,
    DEF: null,
    LAT: null,
    MID: null,
    ATT: null,
  };

  for (const p of players) {
    if (counts[p.position] !== undefined) {
      counts[p.position]++;
      const currentBest = starters[p.position];
      if (!currentBest || p.overall > currentBest.overall) {
        starters[p.position] = p;
      }
    }
  }

  const squadAvg = players.length > 0
    ? Math.round(players.reduce((sum, p) => sum + p.overall, 0) / players.length)
    : 70;
  const benchmark = divisionAvgRating && divisionAvgRating > 0 ? divisionAvgRating : Math.max(68, squadAvg);

  const shortages: SquadDepthAnalysis['shortages'] = [];
  const qualityGaps: SquadDepthAnalysis['qualityGaps'] = [];

  // 1. Check Depth Shortages
  // GK < 2
  if (counts.GK < SQUAD_DEPTH_TARGETS.GK) {
    shortages.push({
      position: 'GK',
      currentCount: counts.GK,
      targetCount: SQUAD_DEPTH_TARGETS.GK,
      urgency: 'HIGH',
      reason: counts.GK === 0 ? 'Sem nenhum goleiro no elenco' : 'Apenas 1 goleiro no elenco (risco crítico de suspensão/lesão)',
    });
  }

  // DEF < 4 or DEF + LAT < 5
  if (counts.DEF < SQUAD_DEPTH_TARGETS.DEF || (counts.DEF + counts.LAT < 5)) {
    shortages.push({
      position: 'DEF',
      currentCount: counts.DEF,
      targetCount: SQUAD_DEPTH_TARGETS.DEF,
      urgency: counts.DEF < 2 ? 'HIGH' : 'MEDIUM',
      reason: `Zaga com poucas opções (${counts.DEF} zagueiros)`,
    });
  }

  // LAT < 2
  if (counts.LAT < SQUAD_DEPTH_TARGETS.LAT) {
    shortages.push({
      position: 'LAT',
      currentCount: counts.LAT,
      targetCount: SQUAD_DEPTH_TARGETS.LAT,
      urgency: counts.LAT === 0 ? 'HIGH' : 'MEDIUM',
      reason: `Laterais escassos (${counts.LAT} no elenco)`,
    });
  }

  // MID < 5
  if (counts.MID < SQUAD_DEPTH_TARGETS.MID) {
    shortages.push({
      position: 'MID',
      currentCount: counts.MID,
      targetCount: SQUAD_DEPTH_TARGETS.MID,
      urgency: counts.MID < 3 ? 'HIGH' : 'MEDIUM',
      reason: `Meio-campo desguarnecido (${counts.MID} meias)`,
    });
  }

  // ATT < 4
  if (counts.ATT < SQUAD_DEPTH_TARGETS.ATT) {
    shortages.push({
      position: 'ATT',
      currentCount: counts.ATT,
      targetCount: SQUAD_DEPTH_TARGETS.ATT,
      urgency: counts.ATT < 2 ? 'HIGH' : 'MEDIUM',
      reason: `Ataque com carência de peças (${counts.ATT} atacantes)`,
    });
  }

  // 2. Check Quality Gaps (Starter below standard)
  const allPositions: Position[] = ['GK', 'DEF', 'LAT', 'MID', 'ATT'];
  for (const pos of allPositions) {
    const starter = starters[pos];
    const starterOvr = starter?.overall ?? 0;
    if (starterOvr < benchmark) {
      qualityGaps.push({
        position: pos,
        starterOverall: starterOvr,
        benchmarkOverall: benchmark,
        starterName: starter?.name,
      });
    }
  }

  return {
    counts,
    starters,
    shortages,
    qualityGaps,
  };
}

function normalizeCandidate(item: any): CandidateScoutPlayer | null {
  if (!item) return null;
  if (item.player && (item.clubId || item.id)) {
    return {
      clubId: item.clubId || item.id,
      clubName: item.clubName || item.name || 'Clube Vendedor',
      player: item.player,
      askingPrice: item.askingPrice,
    };
  }
  if (item.position && item.overall !== undefined) {
    return {
      clubId: item.clubId || 'free_agents',
      clubName: item.clubName || 'Mercado Livre',
      player: item as Player,
      askingPrice: item.askingPrice ?? item.marketValue,
    };
  }
  return null;
}

/**
 * Computes prime target recommendations for the Director of Football based on squad depth,
 * starter standards, budget viability, and player profiles.
 */
export function computeDirectorTransferRecommendations(
  club: Club,
  availablePlayers: Array<CandidateScoutPlayer | any>,
  divisionAvgRating?: number,
): DirectorTransferRecommendation[] {
  if (!club || !availablePlayers || availablePlayers.length === 0) {
    return [];
  }

  const depth = analyzeSquadDepth(club, divisionAvgRating);
  const footballDirector = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const directorDiscount = getDirectorTransferDiscount(footballDirector);
  const directorRating = footballDirector?.rating ?? 50;
  const clubBudget = club.budget ?? 0;

  const squadPlayerIds = new Set((club.players ?? []).map((p) => p.id));
  const normalizedCandidates: CandidateScoutPlayer[] = [];

  for (const raw of availablePlayers) {
    // If raw is a club with players list
    if (raw && Array.isArray(raw.players)) {
      if (raw.id === club.id) continue;
      for (const pl of raw.players) {
        if (!squadPlayerIds.has(pl.id)) {
          normalizedCandidates.push({
            clubId: raw.id,
            clubName: raw.name,
            player: pl,
            askingPrice: pl.marketValue,
          });
        }
      }
    } else {
      const cand = normalizeCandidate(raw);
      if (cand && cand.clubId !== club.id && !squadPlayerIds.has(cand.player.id)) {
        normalizedCandidates.push(cand);
      }
    }
  }

  if (normalizedCandidates.length === 0) {
    return [];
  }

  const scoredList: DirectorTransferRecommendation[] = [];

  for (const cand of normalizedCandidates) {
    const p = cand.player;
    const pos = p.position;
    const currentStarter = depth.starters[pos];
    const starterOvr = currentStarter?.overall ?? 0;
    const isStarterUpgrade = p.overall > starterOvr;
    const ovrDelta = p.overall - starterOvr;

    const shortage = depth.shortages.find((s) => s.position === pos);
    const qualityGap = depth.qualityGaps.find((q) => q.position === pos);

    // Calculate fair suggested offer price
    const basePrice = cand.askingPrice && cand.askingPrice > 0 ? cand.askingPrice : p.marketValue;
    const suggestedOfferPrice = Math.max(
      50_000,
      Math.round((basePrice * (1 - directorDiscount * 0.5)) / 10_000) * 10_000,
    );

    // Calculate Urgency
    let urgency: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (shortage?.urgency === 'HIGH' || (qualityGap && qualityGap.benchmarkOverall - starterOvr >= 5 && isStarterUpgrade)) {
      urgency = 'HIGH';
    } else if (shortage?.urgency === 'MEDIUM' || (qualityGap && isStarterUpgrade) || ovrDelta >= 3) {
      urgency = 'MEDIUM';
    }

    // Fit Score Calculation
    let fitScore = 40;

    // 1. Positional Need & Shortage
    if (shortage) {
      fitScore += shortage.urgency === 'HIGH' ? 35 : 20;
    }
    if (qualityGap) {
      fitScore += 15;
    }

    // 2. Starter Quality Delta
    if (isStarterUpgrade) {
      fitScore += Math.min(30, Math.max(5, ovrDelta * 5));
    } else if (p.overall >= starterOvr - 2) {
      fitScore += 8; // Competent backup/rotation
    } else {
      fitScore -= 15; // Too weak to help
    }

    // 3. Special Tiers & Young Promises
    const tier = getPlayerTier(p.overall, p.starLevel, p.diferenciado);
    if (tier === 'GENIO') fitScore += 25;
    else if (tier === 'BAITA') fitScore += 15;

    if (p.age <= 21 && p.potential >= 80) {
      fitScore += 20;
    } else if (p.age <= 23 && p.potential > p.overall + 4) {
      fitScore += 10;
    }

    // 4. Budget Viability
    if (clubBudget > 0) {
      if (suggestedOfferPrice <= clubBudget * 0.4) {
        fitScore += 20;
      } else if (suggestedOfferPrice <= clubBudget) {
        fitScore += 10;
      } else if (suggestedOfferPrice <= clubBudget * 1.5) {
        fitScore += 0;
      } else {
        fitScore -= 25;
      }
    } else {
      if (suggestedOfferPrice <= 1_500_000) {
        fitScore += 10;
      } else {
        fitScore -= 20;
      }
    }

    // 5. Director Quality & Chemistry
    fitScore += Math.round((directorRating - 50) * 0.2);

    // Build Rationale
    let rationale = '';
    const posName = POSITION_LABELS[pos] ?? pos;

    if (pos === 'GK' && depth.counts.GK < 2) {
      rationale = `Goleiro confiável para suprir carência crítica na meta (apenas ${depth.counts.GK} no elenco).`;
    } else if (isStarterUpgrade && (tier === 'GENIO' || tier === 'BAITA')) {
      rationale = `${posName} de nível extraclasse para ser o grande astro da equipe.`;
    } else if (isStarterUpgrade && ovrDelta >= 4) {
      rationale = `${posName} de alto nível para assumir a titularidade (+${ovrDelta} OVR vs titular atual).`;
    } else if (isStarterUpgrade) {
      rationale = `${posName} qualificado para assumir a posição titular imediatamente.`;
    } else if (p.age <= 21 && p.potential >= 80) {
      rationale = `Jovem promessa com grande potencial (${p.potential} POT) e alto retorno esportivo e financeiro.`;
    } else if (shortage) {
      rationale = `Reforço pontual para dar profundidade ao setor de ${posName.toLowerCase()}s e evitar sobrecarga.`;
    } else if (suggestedOfferPrice <= clubBudget * 0.35) {
      rationale = `Opção acessível com excelente custo-benefício para compor elenco.`;
    } else {
      rationale = `Oportunidade de mercado avaliada pelo Diretor de Futebol para fortalecer o elenco.`;
    }

    scoredList.push({
      player: p,
      sellerClubId: cand.clubId,
      sellerClubName: cand.clubName,
      suggestedOfferPrice,
      askingPrice: cand.askingPrice,
      rationale,
      urgency,
      targetPosition: pos,
      isStarterUpgrade,
      fitScore,
      comparisonWithStarter: {
        currentStarterName: currentStarter?.name,
        currentStarterOverall: currentStarter?.overall,
        overallDifference: ovrDelta,
      },
    });
  }

  // Sort by fit score descending
  scoredList.sort((a, b) => b.fitScore - a.fitScore);

  // Pick top 3 to 5 recommendations with diversity across positions
  const picked: DirectorTransferRecommendation[] = [];
  const pickedPositionsCount: Record<string, number> = {};

  for (const rec of scoredList) {
    if (picked.length >= 5) break;
    const pos = rec.targetPosition;
    const currentCountForPos = pickedPositionsCount[pos] || 0;

    // Allow at most 2 recommendations per position unless we have fewer than 3 items
    if (currentCountForPos >= 2 && scoredList.length > 5) {
      continue;
    }

    picked.push(rec);
    pickedPositionsCount[pos] = currentCountForPos + 1;
  }

  // If we couldn't fill at least 3 with diversity, top-up from the best remaining
  if (picked.length < 3) {
    for (const rec of scoredList) {
      if (picked.length >= 3 || picked.length >= 5) break;
      if (!picked.some((p) => p.player.id === rec.player.id)) {
        picked.push(rec);
      }
    }
  }

  return picked.slice(0, 5);
}

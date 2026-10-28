import type { Player } from './player.js';

export type ScoutKnowledgeLevel = 'REVEALED' | 'PARTIAL' | 'UNKNOWN';

export interface MaskedAttributeRange {
  min: number;
  max: number;
  isExact: boolean;
}

export type MaskedPlayerAttributes = Record<string, MaskedAttributeRange>;

export type ScoutRegion = 'CONMEBOL' | 'UEFA_WEST' | 'UEFA_EAST' | 'AFRICA' | 'ASIA';

export interface ScoutProfile {
  id: string;
  name: string;
  abilityRating: number; // 50 a 99
  potentialRating: number; // 50 a 99
  region: ScoutRegion;
  assignedMissionId?: string | null;
}

export type GlobalScoutMissionType = 'REGIONAL_HUNT' | 'POSITION_SEARCH' | 'INDIVIDUAL_REPORT';

export interface GlobalScoutMission {
  id: string;
  scoutId: string;
  type: GlobalScoutMissionType;
  region?: ScoutRegion;
  targetPosition?: string;
  targetPlayerId?: string;
  weeksRemaining: number;
  totalWeeks: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  discoveredPlayerIds: string[];
}

export type ScoutReportGrade = 'RECOMMENDED_STAR' | 'HIDDEN_GEM' | 'SQUAD_ROTATION' | 'NOT_RECOMMENDED';

export interface ScoutPlayerReport {
  playerId: string;
  playerName: string;
  position: string;
  age: number;
  overallEstimate: { min: number; max: number };
  potentialEstimate: { min: number; max: number };
  estimatedMarketValue: number;
  grade: ScoutReportGrade;
  summary: string;
}

/**
 * Aplica a Névoa de Guerra (Fog of War) aos atributos de um jogador com base no nível de conhecimento do clube.
 */
export function maskPlayerAttributes(player: Player, level: ScoutKnowledgeLevel): MaskedPlayerAttributes {
  const masked: MaskedPlayerAttributes = {};
  const sampleAttrs = {
    overall: player.overall,
    potential: player.potential,
    pace: (player.attributes as any)?.pace ?? 70,
    finishing: (player.attributes as any)?.finishing ?? 70,
    passing: (player.attributes as any)?.passing ?? 70,
    defending: (player.attributes as any)?.defending ?? 70,
    physical: (player.attributes as any)?.physical ?? 70,
    goalkeeping: (player.attributes as any)?.goalkeeping ?? 70,
  };

  for (const [key, val] of Object.entries(sampleAttrs)) {
    if (level === 'REVEALED') {
      masked[key] = { min: val, max: val, isExact: true };
    } else if (level === 'PARTIAL') {
      const spread = 4;
      const min = Math.max(1, Math.round(val - spread));
      const max = Math.min(99, Math.round(val + spread));
      masked[key] = { min, max, isExact: false };
    } else {
      const spread = 10;
      const min = Math.max(1, Math.round(val - spread));
      const max = Math.min(99, Math.round(val + spread));
      masked[key] = { min, max, isExact: false };
    }
  }

  return masked;
}

/**
 * Gera um relatório profissional de olheiro para um atleta observado.
 */
export function generateScoutReport(player: Player): ScoutPlayerReport {
  const isHiddenGem = player.age <= 21 && player.potential >= 82 && player.overall < 78;
  const isStar = player.overall >= 84;
  const isRotation = player.overall >= 74;

  let grade: ScoutReportGrade = 'NOT_RECOMMENDED';
  let summary = 'Atleta abaixo dos padrões exigidos para o nosso nível competitivo atual.';

  if (isHiddenGem) {
    grade = 'HIDDEN_GEM';
    summary = `💎 JOIA OCULTA! Jogador jovem (${player.age} anos) com enorme teto de evolução (Potencial ${player.potential}). Altamente recomendado para valorização futura.`;
  } else if (isStar) {
    grade = 'RECOMMENDED_STAR';
    summary = `⭐ CRAQUE CONFIRMADO! Atleta de elite pronto para assumir a titularidade absoluta e elevar o patamar do time.`;
  } else if (isRotation) {
    grade = 'SQUAD_ROTATION';
    summary = `🔄 OPÇÃO SÓLIDA. Bom complemento de elenco para rodagem e profundidade tática.`;
  }

  return {
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    age: player.age,
    overallEstimate: { min: Math.max(1, player.overall - 2), max: Math.min(99, player.overall + 2) },
    potentialEstimate: { min: Math.max(1, player.potential - 3), max: Math.min(99, player.potential + 3) },
    estimatedMarketValue: player.marketValue,
    grade,
    summary,
  };
}

import type { Player, Position } from './player.js';

export type PartnershipSector = 'DEFENSE' | 'MIDFIELD' | 'ATTACK';
export type PartnershipLevel = 'NEW' | 'DEVELOPING' | 'ESTABLISHED' | 'VETERAN';

export interface PartnershipAffinity {
  score: number; // 0 a 100
  level: PartnershipLevel;
  bonusMultiplier: number;
  pressureErrorRisk: number; // 0 a 1 (ex: 0.10 = +10% risco de erro sob pressão)
}

export interface PartnershipPair {
  sector: PartnershipSector;
  player1: Player;
  player2: Player;
  matchesTogether: number;
  affinity: PartnershipAffinity;
  label: string;
}

/**
 * Calcula a escala de afinidade (0 a 100) e bônus de entrosamento
 * entre dois atletas que atuam juntos no mesmo setor crítico.
 *
 * Conforme Master Plan (Tarefa 3.1):
 * - 0 a 5 jogos (0-25 score): Recém-contratados / falta de química. +10% de risco de erro sob pressão.
 * - 6 a 15 jogos (26-50 score): Em desenvolvimento. Neutro.
 * - 16 a 30 jogos (51-75 score): Estabelecidos. +3% de bônus em coberturas / passes.
 * - 31+ jogos (76-100 score): Veteranos entrosados. +6% em antecipação coletiva e coberturas.
 */
export function calculatePartnershipAffinity(matchesTogether: number): PartnershipAffinity {
  const matches = Math.max(0, matchesTogether);

  if (matches <= 5) {
    // 0..5 jogos -> score linear de 5 a 25
    const score = Math.round(5 + (matches / 5) * 20);
    return {
      score,
      level: 'NEW',
      bonusMultiplier: 0.98,
      pressureErrorRisk: 0.10,
    };
  }

  if (matches <= 15) {
    // 6..15 jogos -> score de 26 a 50
    const ratio = (matches - 5) / 10;
    const score = Math.round(26 + ratio * 24);
    return {
      score,
      level: 'DEVELOPING',
      bonusMultiplier: 1.0,
      pressureErrorRisk: 0.0,
    };
  }

  if (matches <= 30) {
    // 16..30 jogos -> score de 51 a 75
    const ratio = (matches - 15) / 15;
    const score = Math.round(51 + ratio * 24);
    return {
      score,
      level: 'ESTABLISHED',
      bonusMultiplier: 1.03,
      pressureErrorRisk: 0.0,
    };
  }

  // 31+ jogos -> score de 76 a 100
  const bonusMatches = Math.min(20, matches - 30);
  const score = Math.min(100, Math.round(76 + (bonusMatches / 20) * 24));
  return {
    score,
    level: 'VETERAN',
    bonusMultiplier: 1.06,
    pressureErrorRisk: 0.0,
  };
}

/**
 * Cria uma chave determinística de par para histórico (independe da ordem dos IDs).
 */
export function partnershipKey(id1: string, id2: string): string {
  return id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
}

export interface LineupSlotWithPlayer {
  player: Player;
  slotPosition: Position;
}

/**
 * Detecta as parcerias críticas dentro do 11 titular escalado:
 * 1. Dupla de Zaga (DEF + DEF)
 * 2. Dupla de Meio-Campo (VOL/MID de marcação + MID de criação)
 * 3. Parceria de Ataque (ATT + ATT / PONTA + CENTROAVANTE)
 */
export function findCriticalPartnerships(
  lineup: LineupSlotWithPlayer[],
  matchesHistory?: Map<string, number>,
): PartnershipPair[] {
  const pairs: PartnershipPair[] = [];

  const getMatches = (p1Id: string, p2Id: string) => {
    if (!matchesHistory) return 20; // Padrão realista caso histórico não seja passado
    return matchesHistory.get(partnershipKey(p1Id, p2Id)) ?? 0;
  };

  // 1. Zaga (DEF + DEF)
  const defenders = lineup.filter((s) => s.slotPosition === 'DEF');
  if (defenders.length >= 2) {
    const d1 = defenders[0].player;
    const d2 = defenders[1].player;
    const m = getMatches(d1.id, d2.id);
    pairs.push({
      sector: 'DEFENSE',
      player1: d1,
      player2: d2,
      matchesTogether: m,
      affinity: calculatePartnershipAffinity(m),
      label: `Dupla de Zaga (${d1.name} & ${d2.name})`,
    });
  }

  // 2. Meio-Campo (VOL/MID + MEI/MID)
  const midfielders = lineup.filter((s) => s.slotPosition === 'MID');
  if (midfielders.length >= 2) {
    const m1 = midfielders[0].player;
    const m2 = midfielders[1].player;
    const m = getMatches(m1.id, m2.id);
    pairs.push({
      sector: 'MIDFIELD',
      player1: m1,
      player2: m2,
      matchesTogether: m,
      affinity: calculatePartnershipAffinity(m),
      label: `Eixo Central de Meio (${m1.name} & ${m2.name})`,
    });
  }

  // 3. Ataque (ATT + ATT ou ATT + PONTA)
  const attackers = lineup.filter((s) => s.slotPosition === 'ATT');
  if (attackers.length >= 2) {
    const a1 = attackers[0].player;
    const a2 = attackers[1].player;
    const m = getMatches(a1.id, a2.id);
    pairs.push({
      sector: 'ATTACK',
      player1: a1,
      player2: a2,
      matchesTogether: m,
      affinity: calculatePartnershipAffinity(m),
      label: `Dupla de Ataque (${a1.name} & ${a2.name})`,
    });
  }

  return pairs;
}

/**
 * Consolida o multiplicador de química setorial de parcerias para a equipe.
 */
export function calculateSquadPartnershipSynergy(partnerships: PartnershipPair[]): {
  defenseBonus: number;
  attackBonus: number;
  averageAffinityScore: number;
  maxPressureErrorRisk: number;
} {
  if (partnerships.length === 0) {
    return {
      defenseBonus: 1.0,
      attackBonus: 1.0,
      averageAffinityScore: 50,
      maxPressureErrorRisk: 0,
    };
  }

  let defBonus = 1.0;
  let attBonus = 1.0;
  let totalScore = 0;
  let maxRisk = 0;

  for (const pair of partnerships) {
    totalScore += pair.affinity.score;
    maxRisk = Math.max(maxRisk, pair.affinity.pressureErrorRisk);

    if (pair.sector === 'DEFENSE') {
      defBonus *= pair.affinity.bonusMultiplier;
    } else if (pair.sector === 'ATTACK') {
      attBonus *= pair.affinity.bonusMultiplier;
    } else if (pair.sector === 'MIDFIELD') {
      // Meio-campo influencia tanto combate defensivo quanto distribuição
      const half = 1 + (pair.affinity.bonusMultiplier - 1) / 2;
      defBonus *= half;
      attBonus *= half;
    }
  }

  return {
    defenseBonus: Number(defBonus.toFixed(3)),
    attackBonus: Number(attBonus.toFixed(3)),
    averageAffinityScore: Math.round(totalScore / partnerships.length),
    maxPressureErrorRisk: maxRisk,
  };
}

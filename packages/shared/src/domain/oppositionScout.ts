import type { Club } from './club.js';
import type { StaffMember } from './staff.js';
import type { Tactic } from './tactic.js';
import type { Player } from './player.js';
import { calculateOverall } from './player.js';
import { CANONICAL_TACTIC_PRESETS } from './tacticPreset.js';

export type ScoutingMissionType = 'PROMISES_SUB20' | 'BARGAINS_EXPIRING' | 'POSITION_REINFORCEMENT';

export interface ScoutingMission {
  id: string;
  clubId: string;
  type: ScoutingMissionType;
  targetPosition?: 'GK' | 'DEF' | 'LAT' | 'MID' | 'ATT' | 'DF' | 'MF' | 'FW';
  assignedScoutId?: string;
  budgetCap: number;
}

export interface ScoutingMissionResult {
  missionId: string;
  recommendedPlayerIds: string[];
  costBenefitScore: number;
  report: string;
}

export interface TacticalCountermeasure {
  param: string;
  recommendedValue: string;
  reason: string;
}

export interface OppositionDossier {
  opponentClubId: string;
  opponentName: string;
  confidenceRating: number;
  presetIdentification: {
    presetId: string;
    presetName: string;
    certainty: number;
  };
  defensiveLineAnalysis: {
    height: 'DEEP' | 'BALANCED' | 'HIGH';
    restDefence: '2+3' | '3+2' | 'UNKNOWN';
    description: string;
  };
  keyThreats: Array<{
    playerId: string;
    playerName: string;
    threatReason: string;
    overall: number;
  }>;
  vulnerabilities: Array<{
    area: string;
    description: string;
  }>;
  countermeasures: TacticalCountermeasure[];
}

function getPlayerOverall(p: Player): number {
  if (typeof p.overall === 'number' && p.overall > 0) return p.overall;
  try {
    return calculateOverall(p.position, p.attributes);
  } catch {
    return 70;
  }
}

export function evaluateScoutingMission(mission: ScoutingMission, availablePlayers: Player[], scout?: StaffMember): ScoutingMissionResult {
  const confidence = scout ? getStaffConfidence(scout) : 50;

  let candidates = availablePlayers.filter(p => !((p as any).isRetired || (p.attributes as any)?.isRetired));

  if (mission.type === 'PROMISES_SUB20') {
    candidates = candidates.filter(p => p.age <= 20);
  } else if (mission.type === 'BARGAINS_EXPIRING') {
    candidates = candidates.filter(p => {
      const years = (p as any).contract?.yearsRemaining ?? (p.contractUntil ? Math.max(0, p.contractUntil - 2026) : 1);
      const wage = (p as any).contract?.wage ?? p.wage ?? 0;
      return years <= 1 && wage <= mission.budgetCap / 52;
    });
  } else if (mission.type === 'POSITION_REINFORCEMENT' && mission.targetPosition) {
    const target = mission.targetPosition;
    candidates = candidates.filter(p => {
      if (p.position === (target as any)) return true;
      if (target === 'DF' && (p.position === 'DEF' || p.position === 'LAT')) return true;
      if (target === 'MF' && p.position === 'MID') return true;
      if (target === 'FW' && p.position === 'ATT') return true;
      return false;
    });
  }

  candidates = candidates.filter(p => (p.marketValue ?? 0) <= mission.budgetCap);

  // Sort by overall but add some noise based on scout confidence
  const scoredCandidates = candidates.map(p => {
    const realOverall = getPlayerOverall(p);
    // Noise increases as confidence decreases
    const noise = ((100 - confidence) / 100) * (Math.random() * 10 - 5);
    return {
      player: p,
      perceivedOverall: realOverall + noise
    };
  });

  scoredCandidates.sort((a, b) => b.perceivedOverall - a.perceivedOverall);

  const recommended = scoredCandidates.slice(0, 3).map(c => c.player.id);

  // High confidence means better cost-benefit score calculation
  const scoreBase = recommended.length > 0 ? 80 : 20;
  const costBenefitScore = Math.min(100, Math.max(0, scoreBase + (confidence / 5)));

  return {
    missionId: mission.id,
    recommendedPlayerIds: recommended,
    costBenefitScore,
    report: recommended.length > 0
      ? `Encontrados ${recommended.length} alvos potenciais alinhados com o orçamento de $${mission.budgetCap}.`
      : 'Nenhum jogador encontrado dentro dos parâmetros exigidos.'
  };
}

function getStaffConfidence(staff: StaffMember): number {
  const tier = (staff.tier as string)?.toUpperCase();
  if (tier === 'DIAMANTE' || tier === 'DIAMOND') return 95;
  if (tier === 'OURO' || tier === 'GOLD') return 80;
  if (tier === 'PRATA' || tier === 'SILVER') return 60;
  return 40; // BRONZE
}

function resolveTacticPreset(tactic: Tactic): { presetId: string; presetName: string; certainty: number } {
  let bestMatch = CANONICAL_TACTIC_PRESETS[0];
  let highestScore = 0;

  for (const preset of CANONICAL_TACTIC_PRESETS) {
    let score = 0;
    let possible = 9;

    if (preset.formation === tactic.formation) score += 2;
    if (preset.mentality === tactic.mentality) score += 1;
    if (preset.attackStyle === tactic.attackStyle) score += 1;
    if (preset.markingStyle === tactic.markingStyle) score += 1;
    if (preset.attackApproach === tactic.attackApproach) score += 1;
    if (preset.pressing === tactic.pressing) score += 1;
    if (preset.transitionStyle === tactic.transitionStyle) score += 1;
    if (preset.restDefenceShape === tactic.restDefenceShape) score += 1;
    if (preset.defensiveLine === tactic.defensiveLine) score += 1;

    // extra weight for formation
    possible += 1;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = preset;
    }
  }

  // Base certainty on how many dials match
  const matchingPct = Math.round((highestScore / 10) * 100);

  return {
    presetId: bestMatch.id,
    presetName: bestMatch.name,
    certainty: Math.min(99, Math.max(10, matchingPct))
  };
}

export function generateOppositionDossier(
  opponentClub: Club,
  opponentTactic: Tactic,
  assistant?: StaffMember
): OppositionDossier {
  const confidenceRating = assistant ? getStaffConfidence(assistant) : 50;

  const presetMatch = resolveTacticPreset(opponentTactic);
  // blur certainty if low confidence
  if (confidenceRating < 80) {
    presetMatch.certainty = Math.max(10, presetMatch.certainty - (100 - confidenceRating) / 2);
  }

  const defLine = opponentTactic.defensiveLine || 'BALANCED';
  const restDef = opponentTactic.restDefenceShape || 'UNKNOWN';

  let defDescription = 'Linha equilibrada mantendo controle espacial moderado.';
  if (defLine === 'HIGH') defDescription = 'Linha muito alta, propensa a bolas nas costas.';
  if (defLine === 'DEEP') defDescription = 'Linha baixa, compactando a entrada da área.';

  // Find Key Threats (highest overall players in lineup)
  const threats = [];
  const lineupPlayers = opponentClub.players.filter(p =>
    opponentTactic.lineup.some(slot => slot.playerId === p.id)
  );

  const sortedPlayers = [...lineupPlayers].sort((a, b) =>
    getPlayerOverall(b) - getPlayerOverall(a)
  );

  const keyPlayer = sortedPlayers[0];
  if (keyPlayer) {
    threats.push({
      playerId: keyPlayer.id,
      playerName: keyPlayer.name,
      threatReason: `Principal construtor de jogadas (${keyPlayer.position})`,
      overall: getPlayerOverall(keyPlayer)
    });
  }

  // Vulnerabilities & Countermeasures based on tactic
  const vulnerabilities = [];
  const countermeasures: TacticalCountermeasure[] = [];

  if (defLine === 'HIGH') {
    vulnerabilities.push({
      area: 'Defesa Central',
      description: 'Defesa muito avançada oferece vasto espaço nas costas dos centrais.'
    });
    countermeasures.push({
      param: 'Mentality',
      recommendedValue: 'ATTACKING',
      reason: 'Aproveitar o espaço nas costas da defesa alta.'
    });
    countermeasures.push({
      param: 'AttackApproach',
      recommendedValue: 'DIRECT',
      reason: 'Lançamentos diretos para punir a linha alta.'
    });
  } else if (defLine === 'DEEP') {
    vulnerabilities.push({
      area: 'Entrelinhas',
      description: 'Pouca pressão à frente da área permite remates de longe.'
    });
    countermeasures.push({
      param: 'AttackApproach',
      recommendedValue: 'PATIENT',
      reason: 'Trabalhar a bola com calma até abrir uma brecha no bloco baixo.'
    });
  }

  if (opponentTactic.formation === '4-2-3-1' || opponentTactic.formation === '4-3-3') {
    if (opponentTactic.attackStyle === 'THROUGH_MIDDLE') {
      vulnerabilities.push({
        area: 'Flancos',
        description: 'Concentração ofensiva no centro deixa corredores laterais expostos nos contra-ataques.'
      });
      countermeasures.push({
        param: 'AttackStyle',
        recommendedValue: 'FLANKS',
        reason: 'Explorar os corredores que ficam desguarnecidos.'
      });
    }
  }

  if (countermeasures.length === 0) {
    countermeasures.push({
      param: 'Mentality',
      recommendedValue: 'BALANCED',
      reason: 'Manter a estabilidade, adversário bem balanceado.'
    });
  }

  return {
    opponentClubId: opponentClub.id,
    opponentName: opponentClub.name,
    confidenceRating,
    presetIdentification: presetMatch,
    defensiveLineAnalysis: {
      height: defLine,
      restDefence: restDef as '2+3' | '3+2' | 'UNKNOWN',
      description: defDescription
    },
    keyThreats: threats,
    vulnerabilities,
    countermeasures
  };
}

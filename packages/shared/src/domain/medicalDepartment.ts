import type { Club } from './club.js';
import type { Player } from './player.js';
import { DEFAULT_STAFF_DELEGATION_CONFIG } from './staffDelegationConfig.js';

export type InjuryRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface InjuryRiskResult {
  riskPercentage: number;
  riskLevel: InjuryRiskLevel;
  description: string;
}

export interface SquadInjuryAlert extends InjuryRiskResult {
  playerId: string;
  playerName: string;
  isStarter: boolean;
  suggestion: string;
}

export type MedicalCareMode =
  | 'auto_fastest'
  | 'auto_balanced'
  | 'manual_medical_clinic';

export interface MedicalRecovery {
  playerId: string;
  playerName: string;
  previousInjuryWeeks: number;
  injuryWeeks: number;
  weeksReduced: number;
}

export interface MedicalCareResult {
  club: Club;
  recoveries: MedicalRecovery[];
}

export interface MedicalCareSettings {
  mode: Exclude<MedicalCareMode, 'manual_medical_clinic'>;
  chiefDoctorRating: number;
}

const LEVEL_RANK: Record<InjuryRiskLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function physicalResistance(player: Player): number {
  const detailed = player.detailedAttributes as Partial<Player['detailedAttributes']> | undefined;
  const values = [
    detailed?.STAMINA,
    detailed?.AEROBIC_STAMINA,
    detailed?.STRENGTH_STAMINA,
  ].filter((value): value is number => Number.isFinite(value));

  const fallback = Number.isFinite(player.attributes.physical)
    ? player.attributes.physical
    : 50;
  const resistance = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : fallback;

  return clamp(resistance, 0, 100);
}

function percentageLevel(riskPercentage: number): InjuryRiskLevel {
  if (riskPercentage < 25) return 'LOW';
  if (riskPercentage < 50) return 'MODERATE';
  if (riskPercentage < 75) return 'HIGH';
  return 'CRITICAL';
}

function conditionRisk(condition: number): {
  baseRisk: number;
  minimumLevel: InjuryRiskLevel;
  description: string;
} {
  if (condition >= 70) {
    return { baseRisk: 10, minimumLevel: 'LOW', description: 'Condição boa' };
  }
  if (condition >= 50) {
    return { baseRisk: 35, minimumLevel: 'MODERATE', description: 'Condição regular' };
  }
  if (condition >= 30) {
    return { baseRisk: 60, minimumLevel: 'HIGH', description: 'Condição baixa' };
  }
  return { baseRisk: 85, minimumLevel: 'CRITICAL', description: 'Condição crítica' };
}

export function calculatePlayerInjuryRisk(
  player: Player,
  matchStamina = 100,
  isRain = false,
): InjuryRiskResult {
  const condition = clamp(Number.isFinite(matchStamina) ? matchStamina : 100, 0, 100);
  const resistance = physicalResistance(player);
  const conditionRule = conditionRisk(condition);
  const riskPercentage = clamp(
    conditionRule.baseRisk + (50 - resistance) * 0.3 + (isRain ? 12 : 0),
    0,
    100,
  );
  const calculatedLevel = percentageLevel(riskPercentage);
  const riskLevel = LEVEL_RANK[calculatedLevel] < LEVEL_RANK[conditionRule.minimumLevel]
    ? conditionRule.minimumLevel
    : calculatedLevel;
  const weather = isRain ? 'chuva aumenta o risco' : 'sem impacto climático';

  return {
    riskPercentage: Math.round(riskPercentage * 10) / 10,
    riskLevel,
    description: `${conditionRule.description}; resistência ${Math.round(resistance)}%; ${weather}.`,
  };
}

export function getSquadInjuryAlerts(
  squad: Player[],
  startingLineupIds: string[],
): SquadInjuryAlert[] {
  const starters = new Set(startingLineupIds);

  return squad.flatMap((player) => {
    const risk = calculatePlayerInjuryRisk(player, 100 - player.fatigue);
    if (risk.riskLevel !== 'HIGH' && risk.riskLevel !== 'CRITICAL') return [];

    const isStarter = starters.has(player.id);
    return [{
      ...risk,
      playerId: player.id,
      playerName: player.name,
      isStarter,
      suggestion: isStarter
        ? 'Poupar o atleta e considerar substituição.'
        : 'Recomendar descanso e monitoramento.',
    }];
  });
}

export function getAutomatedMedicalCareSettings(club: Club): MedicalCareSettings | null {
  const config = {
    ...DEFAULT_STAFF_DELEGATION_CONFIG,
    ...club.staffDelegationConfig,
  };
  const mode = config.presetMode === 'brasfoot_casual'
    ? 'auto_fastest'
    : config.injuryRehab;

  if (mode === 'manual_medical_clinic') return null;

  const coach = club.staff?.find((member) => member.role === 'FITNESS_COACH');
  const chiefDoctorRating = coach
    ? clamp(Math.floor((coach.rating - 50) / 10) + 1, 1, 5)
    : 3;

  return { mode, chiefDoctorRating };
}

function careReduction(chiefDoctorRating: number, mode: MedicalCareMode): number {
  const rating = clamp(Math.floor(chiefDoctorRating), 1, 5);
  if (mode === 'auto_fastest') return rating >= 4 ? 2 : 1;
  if (mode === 'auto_balanced') return rating >= 3 ? 1 : 0;
  return 0;
}

export function applyAutomatedMedicalCare(
  club: Club,
  chiefDoctorRating = 3,
  mode: MedicalCareMode = 'auto_balanced',
): MedicalCareResult {
  const maximumReduction = careReduction(chiefDoctorRating, mode);
  const recoveries: MedicalRecovery[] = [];
  let changed = false;
  const players = club.players.map((player) => {
    const previousInjuryWeeks = Number.isFinite(player.injuryWeeks)
      ? Math.max(0, Math.floor(player.injuryWeeks))
      : 0;
    const injuryWeeks = Math.max(0, previousInjuryWeeks - maximumReduction);
    const weeksReduced = previousInjuryWeeks - injuryWeeks;
    const needsNormalization = player.injuryWeeks !== previousInjuryWeeks;
    if (weeksReduced === 0 && !needsNormalization) return player;

    changed = true;
    if (weeksReduced > 0) {
      recoveries.push({
        playerId: player.id,
        playerName: player.name,
        previousInjuryWeeks,
        injuryWeeks,
        weeksReduced,
      });
    }
    return { ...player, injuryWeeks };
  });

  return {
    club: changed ? { ...club, players } : club,
    recoveries,
  };
}

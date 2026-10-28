import type { ContinentalSlot, EliteCountryCode } from './worldLeagues.js';

export type NationalCupFormat = 'SINGLE_LEG_KNOCKOUT' | 'TWO_LEGGED_FROM_ROUND_OF_32' | 'MIXED_COPA_DO_BRASIL';

export interface NationalCupStageConfig {
  name: string;
  round: number;
  entrants: number;
  tieFormat: 'SINGLE_LEG' | 'TWO_LEGGED';
}

export interface NationalCupConfig {
  id: string;
  countryCode: EliteCountryCode;
  name: string;
  shortName: string;
  trophyAsset: string;
  flagAsset: string;
  format: NationalCupFormat;
  continentalReward: ContinentalSlot;
  stages: NationalCupStageConfig[];
}

export interface SuperCupConfig {
  id: string;
  countryCode: EliteCountryCode;
  name: string;
  trophyAsset: string;
  flagAsset: string;
}

const flag = (countryCode: EliteCountryCode) => `${countryCode}.svg`;
const cupTrophy = (code: string) => `tr_copa_${code}.png`;
const superCupTrophy = (code: string) => `tr_supercopa_${code}.png`;

const standardKnockoutStages: NationalCupStageConfig[] = [
  { name: 'Oitavas de Final', round: 1, entrants: 16, tieFormat: 'SINGLE_LEG' },
  { name: 'Quartas de Final', round: 2, entrants: 8, tieFormat: 'SINGLE_LEG' },
  { name: 'Semifinal', round: 3, entrants: 4, tieFormat: 'SINGLE_LEG' },
  { name: 'Final', round: 4, entrants: 2, tieFormat: 'SINGLE_LEG' },
];

const brazilStages: NationalCupStageConfig[] = [
  { name: '1ª Fase (Preliminar)', round: 1, entrants: 80, tieFormat: 'SINGLE_LEG' },
  { name: '2ª Fase (Preliminar)', round: 2, entrants: 40, tieFormat: 'SINGLE_LEG' },
  { name: '3ª Fase (32 Clubes)', round: 3, entrants: 32, tieFormat: 'TWO_LEGGED' },
  { name: 'Oitavas de Final', round: 5, entrants: 16, tieFormat: 'TWO_LEGGED' },
  { name: 'Quartas de Final', round: 7, entrants: 8, tieFormat: 'TWO_LEGGED' },
  { name: 'Semifinal', round: 9, entrants: 4, tieFormat: 'TWO_LEGGED' },
  { name: 'Final', round: 11, entrants: 2, tieFormat: 'TWO_LEGGED' },
];

function nationalCup(
  countryCode: EliteCountryCode,
  trophyCode: string,
  name: string,
  shortName: string,
  continentalReward: ContinentalSlot,
  format: NationalCupFormat = 'SINGLE_LEG_KNOCKOUT',
  stages: NationalCupStageConfig[] = standardKnockoutStages,
): NationalCupConfig {
  return {
    id: `${countryCode}_NATIONAL_CUP`,
    countryCode,
    name,
    shortName,
    trophyAsset: cupTrophy(trophyCode),
    flagAsset: flag(countryCode),
    format,
    continentalReward,
    stages,
  };
}

export const NATIONAL_CUPS: NationalCupConfig[] = [
  nationalCup('BRA', 'BRA', 'Copa do Brasil', 'Copa do Brasil', 'LIBERTADORES', 'MIXED_COPA_DO_BRASIL', brazilStages),
  nationalCup('ENG', 'ING', 'FA Cup', 'FA Cup', 'EUROPA_LEAGUE'),
  nationalCup('ENG', 'ING', 'EFL Cup', 'EFL Cup', 'CONFERENCE_LEAGUE'),
  nationalCup('ESP', 'ESP', 'Copa del Rey', 'Copa del Rey', 'EUROPA_LEAGUE'),
  nationalCup('ITA', 'ITA', 'Coppa Italia', 'Coppa Italia', 'EUROPA_LEAGUE'),
  nationalCup('GER', 'ALE', 'DFB-Pokal', 'DFB-Pokal', 'EUROPA_LEAGUE'),
  nationalCup('FRA', 'FRA', 'Coupe de France', 'Coupe de France', 'EUROPA_LEAGUE'),
  nationalCup('POR', 'POR', 'Taça de Portugal', 'Taça de Portugal', 'EUROPA_LEAGUE'),
  nationalCup('NED', 'HOL', 'KNVB Beker', 'KNVB Beker', 'EUROPA_LEAGUE'),
  nationalCup('ARG', 'ARG', 'Copa Argentina', 'Copa Argentina', 'LIBERTADORES'),
  nationalCup('KSA', 'ARS', "King's Cup", "King's Cup", 'AFC_CHAMPIONS_LEAGUE'),
];

export const NATIONAL_SUPER_CUPS: SuperCupConfig[] = [
  { id: 'BRA_SUPER_CUP', countryCode: 'BRA', name: 'Supercopa do Brasil', trophyAsset: superCupTrophy('BRA'), flagAsset: 'BRA.svg' },
  { id: 'ESP_SUPER_CUP', countryCode: 'ESP', name: 'Supercopa de España', trophyAsset: superCupTrophy('ESP'), flagAsset: 'ESP.svg' },
  { id: 'ITA_SUPER_CUP', countryCode: 'ITA', name: 'Supercoppa Italiana', trophyAsset: superCupTrophy('ITA'), flagAsset: 'ITA.svg' },
  { id: 'GER_SUPER_CUP', countryCode: 'GER', name: 'DFL-Supercup', trophyAsset: superCupTrophy('ALE'), flagAsset: 'GER.svg' },
  { id: 'FRA_SUPER_CUP', countryCode: 'FRA', name: 'Trophée des Champions', trophyAsset: superCupTrophy('FRA'), flagAsset: 'FRA.svg' },
  { id: 'POR_SUPER_CUP', countryCode: 'POR', name: 'Supertaça Cândido de Oliveira', trophyAsset: superCupTrophy('POR'), flagAsset: 'POR.svg' },
  { id: 'NED_SUPER_CUP', countryCode: 'NED', name: 'Johan Cruyff Shield', trophyAsset: superCupTrophy('HOL'), flagAsset: 'NED.svg' },
  { id: 'ARG_SUPER_CUP', countryCode: 'ARG', name: 'Supercopa Argentina', trophyAsset: superCupTrophy('ARG'), flagAsset: 'ARG.svg' },
  { id: 'KSA_SUPER_CUP', countryCode: 'KSA', name: 'Saudi Super Cup', trophyAsset: superCupTrophy('ARS'), flagAsset: 'KSA.svg' },
];

export function getNationalCupConfig(idOrNameOrCountry: string): NationalCupConfig | undefined {
  const normalized = idOrNameOrCountry.trim().toLowerCase();
  return NATIONAL_CUPS.find((cup) => (
    cup.id.toLowerCase() === normalized ||
    cup.name.toLowerCase() === normalized ||
    cup.shortName.toLowerCase() === normalized ||
    cup.countryCode.toLowerCase() === normalized
  ));
}

export function getNationalCupsForCountry(countryCode: string): NationalCupConfig[] {
  return NATIONAL_CUPS.filter((cup) => cup.countryCode === countryCode);
}

export function getSuperCupForCountry(countryCode: string): SuperCupConfig | undefined {
  return NATIONAL_SUPER_CUPS.find((cup) => cup.countryCode === countryCode);
}

export function stageNameForNationalCup(cupName: string, entrantsRemaining: number, leg?: 1 | 2): string {
  const cup = getNationalCupConfig(cupName);
  const base = cup?.stages.find((stage) => stage.entrants === entrantsRemaining)?.name
    ?? (entrantsRemaining === 16 ? 'Oitavas de Final'
      : entrantsRemaining === 8 ? 'Quartas de Final'
        : entrantsRemaining === 4 ? 'Semifinal'
          : entrantsRemaining === 2 ? 'Final'
            : 'Mata-Mata');
  if (!leg) return base;
  return `${base} (${leg === 1 ? 'Ida' : 'Volta'})`;
}

export function trophyAssetForCompetitionName(competitionName: string): string | null {
  const cup = getNationalCupConfig(competitionName);
  if (cup) return cup.trophyAsset;
  const superCup = NATIONAL_SUPER_CUPS.find((candidate) => candidate.name.toLowerCase() === competitionName.trim().toLowerCase());
  return superCup?.trophyAsset ?? null;
}

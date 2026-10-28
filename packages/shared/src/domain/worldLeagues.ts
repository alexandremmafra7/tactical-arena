import { getNationalCupConfig, type NationalCupConfig } from './nationalCups.js';

export type EliteCountryCode = 'BRA' | 'ENG' | 'ESP' | 'ITA' | 'GER' | 'FRA' | 'POR' | 'NED' | 'ARG' | 'KSA';

export type ContinentalSlot =
  | 'LIBERTADORES'
  | 'SUDAMERICANA'
  | 'CHAMPIONS_LEAGUE'
  | 'EUROPA_LEAGUE'
  | 'CONFERENCE_LEAGUE'
  | 'AFC_CHAMPIONS_LEAGUE';

export interface WorldLeagueDivisionConfig {
  id: string;
  countryCode: EliteCountryCode;
  division: number;
  name: string;
  shortName: string;
  trophyAsset: string;
  flagAsset: string;
  qualifyingSlots: ContinentalSlot[];
}

export interface WorldLeagueCountryConfig {
  code: EliteCountryCode;
  name: string;
  flagAsset: string;
  confederation: 'CONMEBOL' | 'UEFA' | 'AFC';
  leagueTrophyCode: string;
  cupTrophyCode: string;
  superCupTrophyCode?: string;
  divisions: WorldLeagueDivisionConfig[];
}

export interface LeagueStandingInput {
  clubId: string;
  position: number;
}

export interface ContinentalQualification {
  clubId: string;
  competition: ContinentalSlot;
  source: 'LEAGUE' | 'NATIONAL_CUP';
  sourceName: string;
}

const flag = (code: EliteCountryCode) => `${code}.svg`;
const trophy = (code: string, division?: number) => division ? `tr_nacional_${code}_d${division}.png` : `tr_nacional_${code}.png`;

const topFlightSlots = (code: EliteCountryCode): ContinentalSlot[] => {
  if (code === 'BRA' || code === 'ARG') return ['LIBERTADORES', 'LIBERTADORES', 'LIBERTADORES', 'LIBERTADORES'];
  if (code === 'KSA') return ['AFC_CHAMPIONS_LEAGUE', 'AFC_CHAMPIONS_LEAGUE', 'AFC_CHAMPIONS_LEAGUE', 'AFC_CHAMPIONS_LEAGUE'];
  return ['CHAMPIONS_LEAGUE', 'CHAMPIONS_LEAGUE', 'CHAMPIONS_LEAGUE', 'CHAMPIONS_LEAGUE'];
};

function division(
  countryCode: EliteCountryCode,
  trophyCode: string,
  divisionNumber: number,
  name: string,
  shortName = name,
  trophyAsset = trophy(trophyCode, divisionNumber),
): WorldLeagueDivisionConfig {
  return {
    id: `${countryCode}_D${divisionNumber}`,
    countryCode,
    division: divisionNumber,
    name,
    shortName,
    trophyAsset,
    flagAsset: flag(countryCode),
    qualifyingSlots: divisionNumber === 1 ? topFlightSlots(countryCode) : [],
  };
}

export const WORLD_LEAGUE_COUNTRIES: WorldLeagueCountryConfig[] = [
  {
    code: 'BRA',
    name: 'Brasil',
    flagAsset: 'BRA.svg',
    confederation: 'CONMEBOL',
    leagueTrophyCode: 'BRA',
    cupTrophyCode: 'BRA',
    superCupTrophyCode: 'BRA',
    divisions: [
      division('BRA', 'BRA', 1, 'Brasileirão Série A'),
      division('BRA', 'BRA', 2, 'Brasileirão Série B'),
      division('BRA', 'BRA', 3, 'Brasileirão Série C'),
      division('BRA', 'BRA', 4, 'Brasileirão Série D'),
    ],
  },
  {
    code: 'ENG',
    name: 'Inglaterra',
    flagAsset: 'ENG.svg',
    confederation: 'UEFA',
    leagueTrophyCode: 'ING',
    cupTrophyCode: 'ING',
    divisions: [
      division('ENG', 'ING', 1, 'Premier League', 'Premier League', 'tr_nacional_ING.png'),
      division('ENG', 'ING', 2, 'EFL Championship', 'Championship', 'tr_nacional_ING.png'),
    ],
  },
  {
    code: 'ESP',
    name: 'Espanha',
    flagAsset: 'ESP.svg',
    confederation: 'UEFA',
    leagueTrophyCode: 'ESP',
    cupTrophyCode: 'ESP',
    superCupTrophyCode: 'ESP',
    divisions: [
      division('ESP', 'ESP', 1, 'La Liga', 'La Liga', 'tr_nacional_ESP.png'),
      division('ESP', 'ESP', 2, 'La Liga 2', 'La Liga 2', 'tr_nacional_ESP_d2.png'),
    ],
  },
  {
    code: 'ITA',
    name: 'Itália',
    flagAsset: 'ITA.svg',
    confederation: 'UEFA',
    leagueTrophyCode: 'ITA',
    cupTrophyCode: 'ITA',
    superCupTrophyCode: 'ITA',
    divisions: [
      division('ITA', 'ITA', 1, 'Serie A', 'Serie A', 'tr_nacional_ITA.png'),
      division('ITA', 'ITA', 2, 'Serie B', 'Serie B', 'tr_nacional_ITA.png'),
    ],
  },
  {
    code: 'GER',
    name: 'Alemanha',
    flagAsset: 'GER.svg',
    confederation: 'UEFA',
    leagueTrophyCode: 'ALE',
    cupTrophyCode: 'ALE',
    superCupTrophyCode: 'ALE',
    divisions: [
      division('GER', 'ALE', 1, 'Bundesliga'),
      division('GER', 'ALE', 2, '2. Bundesliga'),
    ],
  },
  {
    code: 'FRA',
    name: 'França',
    flagAsset: 'FRA.svg',
    confederation: 'UEFA',
    leagueTrophyCode: 'FRA',
    cupTrophyCode: 'FRA',
    superCupTrophyCode: 'FRA',
    divisions: [
      division('FRA', 'FRA', 1, 'Ligue 1'),
      division('FRA', 'FRA', 2, 'Ligue 2'),
    ],
  },
  {
    code: 'POR',
    name: 'Portugal',
    flagAsset: 'POR.svg',
    confederation: 'UEFA',
    leagueTrophyCode: 'POR',
    cupTrophyCode: 'POR',
    superCupTrophyCode: 'POR',
    divisions: [
      division('POR', 'POR', 1, 'Primeira Liga'),
      division('POR', 'POR', 2, 'Liga Portugal 2'),
    ],
  },
  {
    code: 'NED',
    name: 'Holanda',
    flagAsset: 'NED.svg',
    confederation: 'UEFA',
    leagueTrophyCode: 'HOL',
    cupTrophyCode: 'HOL',
    superCupTrophyCode: 'HOL',
    divisions: [
      division('NED', 'HOL', 1, 'Eredivisie'),
      division('NED', 'HOL', 2, 'Eerste Divisie'),
    ],
  },
  {
    code: 'ARG',
    name: 'Argentina',
    flagAsset: 'ARG.svg',
    confederation: 'CONMEBOL',
    leagueTrophyCode: 'ARG',
    cupTrophyCode: 'ARG',
    superCupTrophyCode: 'ARG',
    divisions: [
      division('ARG', 'ARG', 1, 'Liga Profesional'),
      division('ARG', 'ARG', 2, 'Primera Nacional'),
    ],
  },
  {
    code: 'KSA',
    name: 'Arábia Saudita',
    flagAsset: 'KSA.svg',
    confederation: 'AFC',
    leagueTrophyCode: 'ARS',
    cupTrophyCode: 'ARS',
    superCupTrophyCode: 'ARS',
    divisions: [
      division('KSA', 'ARS', 1, 'Saudi Pro League'),
    ],
  },
];

export const WORLD_LEAGUES: WorldLeagueDivisionConfig[] = WORLD_LEAGUE_COUNTRIES.flatMap((country) => country.divisions);

export function getWorldLeagueCountry(code: string): WorldLeagueCountryConfig | undefined {
  return WORLD_LEAGUE_COUNTRIES.find((country) => country.code === code);
}

export function getWorldLeagueDivision(countryCode: string, divisionNumber: number): WorldLeagueDivisionConfig | undefined {
  return WORLD_LEAGUES.find((league) => league.countryCode === countryCode && league.division === divisionNumber);
}

export function isWorldLeagueCountry(code: string): code is EliteCountryCode {
  return WORLD_LEAGUE_COUNTRIES.some((country) => country.code === code);
}

export function qualifyLeagueTopFour(
  countryCode: string,
  finalStandings: LeagueStandingInput[],
): ContinentalQualification[] {
  const config = getWorldLeagueDivision(countryCode, 1);
  if (!config) return [];
  const sorted = [...finalStandings].sort((a, b) => a.position - b.position).slice(0, config.qualifyingSlots.length);
  return sorted.map((standing, index) => ({
    clubId: standing.clubId,
    competition: config.qualifyingSlots[index],
    source: 'LEAGUE',
    sourceName: config.name,
  }));
}

export function qualifyNationalCupWinner(
  cupConfigOrId: NationalCupConfig | string,
  winnerClubId: string | null | undefined,
): ContinentalQualification[] {
  if (!winnerClubId) return [];
  const cup = typeof cupConfigOrId === 'string' ? getNationalCupConfig(cupConfigOrId) : cupConfigOrId;
  if (!cup?.continentalReward) return [];
  return [{
    clubId: winnerClubId,
    competition: cup.continentalReward,
    source: 'NATIONAL_CUP',
    sourceName: cup.name,
  }];
}

export function mergeContinentalQualifications(
  leagueQualifications: ContinentalQualification[],
  cupQualifications: ContinentalQualification[],
): ContinentalQualification[] {
  const merged: ContinentalQualification[] = [];
  const seen = new Set<string>();
  for (const qualification of [...cupQualifications, ...leagueQualifications]) {
    const key = `${qualification.competition}:${qualification.clubId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(qualification);
  }
  return merged;
}

export function inferWorldCompetitionCountry(competitionName: string): EliteCountryCode | null {
  const normalized = competitionName.trim().toLowerCase();
  for (const country of WORLD_LEAGUE_COUNTRIES) {
    if (country.divisions.some((divisionConfig) => divisionConfig.name.toLowerCase() === normalized || divisionConfig.shortName.toLowerCase() === normalized)) {
      return country.code;
    }
  }
  const cup = getNationalCupConfig(competitionName);
  return cup?.countryCode ?? null;
}

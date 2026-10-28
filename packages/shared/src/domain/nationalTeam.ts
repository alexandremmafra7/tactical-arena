// ============================================================================
// NATIONAL TEAMS & DYNAMIC SQUAD SELECTION — FIFA 26-PLAYER STANDARD & BENEFITS
//
// Gerencia as Seleções Nacionais, catálogo de 62 países, camisas oficiais,
// convocação dinâmica de 26 atletas baseada estritamente em nacionalidade, mérito e sem lesão,
// e o Programa de Benefícios e Proteção Financeira da FIFA (Club Protection & Benefits).
// ============================================================================

import type { Player, Position } from './player.js';
import type { ContinentalConfederation } from './fifaClubWorldCup.js';

export interface NationalTeamConfig {
  id: string; // ISO-3 (ex: 'BRA', 'ARG', 'FRA', etc.)
  name: string; // Nome oficial (ex: 'Brasil', 'Argentina')
  confederation: ContinentalConfederation;
  fifaRanking: number; // Posição no ranking
  fifaPoints: number; // Pontos Elo no Ranking FIFA
  jerseyAsset: string; // Caminho para a camisa (ex: 'content/national-jerseys/BRA.png')
  flagAsset: string; // Caminho para a bandeira (ex: 'content/flags/BRA.svg')
}

export interface NationalSquadEntry {
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  position: Position;
  overall: number;
  morale: number;
  caps: number; // Partidas internacionais
  goals: number; // Gols internacionais
  isStarter: boolean; // Titular ou reserva dos 26
}

export interface NationalTeamSquadState {
  teamId: string;
  coachId?: string; // ID do treinador humano se assumiu a seleção
  squad: NationalSquadEntry[]; // Exatamente 26 convocados
  tactics?: {
    formation: string;
    mentality: string;
  };
}

/**
 * Catálogo completo de Seleções Nacionais (62 seleções oficiais)
 */
export const NATIONAL_TEAMS: NationalTeamConfig[] = [
  // CONMEBOL (10)
  { id: 'BRA', name: 'Brasil', confederation: 'CONMEBOL', fifaRanking: 1, fifaPoints: 1850, jerseyAsset: 'content/national-jerseys/BRA.png', flagAsset: 'content/flags/BRA.svg' },
  { id: 'ARG', name: 'Argentina', confederation: 'CONMEBOL', fifaRanking: 2, fifaPoints: 1840, jerseyAsset: 'content/national-jerseys/ARG.png', flagAsset: 'content/flags/ARG.svg' },
  { id: 'URU', name: 'Uruguai', confederation: 'CONMEBOL', fifaRanking: 11, fifaPoints: 1680, jerseyAsset: 'content/national-jerseys/URU.png', flagAsset: 'content/flags/URU.svg' },
  { id: 'COL', name: 'Colômbia', confederation: 'CONMEBOL', fifaRanking: 12, fifaPoints: 1670, jerseyAsset: 'content/national-jerseys/COL.png', flagAsset: 'content/flags/COL.svg' },
  { id: 'ECU', name: 'Equador', confederation: 'CONMEBOL', fifaRanking: 27, fifaPoints: 1530, jerseyAsset: 'content/national-jerseys/ECU.png', flagAsset: 'content/flags/ECU.svg' },
  { id: 'PER', name: 'Peru', confederation: 'CONMEBOL', fifaRanking: 32, fifaPoints: 1500, jerseyAsset: 'content/national-jerseys/PER.png', flagAsset: 'content/flags/PER.svg' },
  { id: 'CHI', name: 'Chile', confederation: 'CONMEBOL', fifaRanking: 40, fifaPoints: 1470, jerseyAsset: 'content/national-jerseys/CHI.png', flagAsset: 'content/flags/CHI.svg' },
  { id: 'PAR', name: 'Paraguai', confederation: 'CONMEBOL', fifaRanking: 45, fifaPoints: 1440, jerseyAsset: 'content/national-jerseys/PAR.png', flagAsset: 'content/flags/PAR.svg' },
  { id: 'VEN', name: 'Venezuela', confederation: 'CONMEBOL', fifaRanking: 50, fifaPoints: 1410, jerseyAsset: 'content/national-jerseys/VEN.png', flagAsset: 'content/flags/VEN.svg' },
  { id: 'BOL', name: 'Bolívia', confederation: 'CONMEBOL', fifaRanking: 75, fifaPoints: 1300, jerseyAsset: 'content/national-jerseys/BOL.png', flagAsset: 'content/flags/BOL.svg' },

  // UEFA (33 países)
  { id: 'FRA', name: 'França', confederation: 'UEFA', fifaRanking: 3, fifaPoints: 1820, jerseyAsset: 'content/national-jerseys/FRA.png', flagAsset: 'content/flags/FRA.svg' },
  { id: 'ENG', name: 'Inglaterra', confederation: 'UEFA', fifaRanking: 4, fifaPoints: 1810, jerseyAsset: 'content/national-jerseys/ENG.png', flagAsset: 'content/flags/ENG.svg' },
  { id: 'BEL', name: 'Bélgica', confederation: 'UEFA', fifaRanking: 5, fifaPoints: 1790, jerseyAsset: 'content/national-jerseys/BEL.png', flagAsset: 'content/flags/BEL.svg' },
  { id: 'ESP', name: 'Espanha', confederation: 'UEFA', fifaRanking: 6, fifaPoints: 1780, jerseyAsset: 'content/national-jerseys/ESP.png', flagAsset: 'content/flags/ESP.svg' },
  { id: 'POR', name: 'Portugal', confederation: 'UEFA', fifaRanking: 7, fifaPoints: 1760, jerseyAsset: 'content/national-jerseys/POR.png', flagAsset: 'content/flags/POR.svg' },
  { id: 'NED', name: 'Holanda', confederation: 'UEFA', fifaRanking: 8, fifaPoints: 1740, jerseyAsset: 'content/national-jerseys/NED.png', flagAsset: 'content/flags/NED.svg' },
  { id: 'ITA', name: 'Itália', confederation: 'UEFA', fifaRanking: 9, fifaPoints: 1720, jerseyAsset: 'content/national-jerseys/ITA.png', flagAsset: 'content/flags/ITA.svg' },
  { id: 'GER', name: 'Alemanha', confederation: 'UEFA', fifaRanking: 10, fifaPoints: 1700, jerseyAsset: 'content/national-jerseys/GER.png', flagAsset: 'content/flags/GER.svg' },
  { id: 'CRO', name: 'Croácia', confederation: 'UEFA', fifaRanking: 13, fifaPoints: 1650, jerseyAsset: 'content/national-jerseys/CRO.png', flagAsset: 'content/flags/CRO.svg' },
  { id: 'SUI', name: 'Suíça', confederation: 'UEFA', fifaRanking: 15, fifaPoints: 1620, jerseyAsset: 'content/national-jerseys/SUI.png', flagAsset: 'content/flags/SUI.svg' },
  { id: 'DEN', name: 'Dinamarca', confederation: 'UEFA', fifaRanking: 18, fifaPoints: 1600, jerseyAsset: 'content/national-jerseys/DEN.png', flagAsset: 'content/flags/DEN.svg' },
  { id: 'AUT', name: 'Áustria', confederation: 'UEFA', fifaRanking: 22, fifaPoints: 1580, jerseyAsset: 'content/national-jerseys/AUT.png', flagAsset: 'content/flags/AUT.svg' },
  { id: 'UKR', name: 'Ucrânia', confederation: 'UEFA', fifaRanking: 24, fifaPoints: 1560, jerseyAsset: 'content/national-jerseys/UKR.png', flagAsset: 'content/flags/UKR.svg' },
  { id: 'POL', name: 'Polônia', confederation: 'UEFA', fifaRanking: 28, fifaPoints: 1520, jerseyAsset: 'content/national-jerseys/POL.png', flagAsset: 'content/flags/POL.svg' },
  { id: 'SWE', name: 'Suécia', confederation: 'UEFA', fifaRanking: 30, fifaPoints: 1510, jerseyAsset: 'content/national-jerseys/SWE.png', flagAsset: 'content/flags/SWE.svg' },
  { id: 'WAL', name: 'País de Gales', confederation: 'UEFA', fifaRanking: 31, fifaPoints: 1505, jerseyAsset: 'content/national-jerseys/WAL.png', flagAsset: 'content/flags/WAL.svg' },
  { id: 'HUN', name: 'Hungria', confederation: 'UEFA', fifaRanking: 33, fifaPoints: 1490, jerseyAsset: 'content/national-jerseys/HUN.png', flagAsset: 'content/flags/HUN.svg' },
  { id: 'SRB', name: 'Sérvia', confederation: 'UEFA', fifaRanking: 35, fifaPoints: 1480, jerseyAsset: 'content/national-jerseys/SRB.png', flagAsset: 'content/flags/SRB.svg' },
  { id: 'TUR', name: 'Turquia', confederation: 'UEFA', fifaRanking: 36, fifaPoints: 1475, jerseyAsset: 'content/national-jerseys/TUR.png', flagAsset: 'content/flags/TUR.svg' },
  { id: 'SCO', name: 'Escócia', confederation: 'UEFA', fifaRanking: 38, fifaPoints: 1460, jerseyAsset: 'content/national-jerseys/SCO.png', flagAsset: 'content/flags/SCO.svg' },
  { id: 'CZE', name: 'República Tcheca', confederation: 'UEFA', fifaRanking: 41, fifaPoints: 1450, jerseyAsset: 'content/national-jerseys/CZE.png', flagAsset: 'content/flags/CZE.svg' },
  { id: 'NOR', name: 'Noruega', confederation: 'UEFA', fifaRanking: 47, fifaPoints: 1420, jerseyAsset: 'content/national-jerseys/NOR.png', flagAsset: 'content/flags/NOR.svg' },
  { id: 'GRE', name: 'Grécia', confederation: 'UEFA', fifaRanking: 52, fifaPoints: 1395, jerseyAsset: 'content/national-jerseys/GRE.png', flagAsset: 'content/flags/GRE.svg' },
  { id: 'ROU', name: 'Romênia', confederation: 'UEFA', fifaRanking: 55, fifaPoints: 1380, jerseyAsset: 'content/national-jerseys/ROU.png', flagAsset: 'content/flags/ROU.svg' },
  { id: 'SVK', name: 'Eslováquia', confederation: 'UEFA', fifaRanking: 58, fifaPoints: 1370, jerseyAsset: 'content/national-jerseys/SVK.png', flagAsset: 'content/flags/SVK.svg' },
  { id: 'IRL', name: 'Irlanda', confederation: 'UEFA', fifaRanking: 60, fifaPoints: 1360, jerseyAsset: 'content/national-jerseys/IRL.png', flagAsset: 'content/flags/IRL.svg' },
  { id: 'FIN', name: 'Finlândia', confederation: 'UEFA', fifaRanking: 63, fifaPoints: 1350, jerseyAsset: 'content/national-jerseys/FIN.png', flagAsset: 'content/flags/FIN.svg' },
  { id: 'SVN', name: 'Eslovênia', confederation: 'UEFA', fifaRanking: 65, fifaPoints: 1340, jerseyAsset: 'content/national-jerseys/SVN.png', flagAsset: 'content/flags/SVN.svg' },
  { id: 'ISL', name: 'Islândia', confederation: 'UEFA', fifaRanking: 70, fifaPoints: 1320, jerseyAsset: 'content/national-jerseys/ISL.png', flagAsset: 'content/flags/ISL.svg' },
  { id: 'ALB', name: 'Albânia', confederation: 'UEFA', fifaRanking: 66, fifaPoints: 1335, jerseyAsset: 'content/national-jerseys/ALB.png', flagAsset: 'content/flags/ALB.svg' },
  { id: 'BIH', name: 'Bósnia', confederation: 'UEFA', fifaRanking: 71, fifaPoints: 1315, jerseyAsset: 'content/national-jerseys/BIH.png', flagAsset: 'content/flags/BIH.svg' },
  { id: 'MKD', name: 'Macedônia do Norte', confederation: 'UEFA', fifaRanking: 73, fifaPoints: 1310, jerseyAsset: 'content/national-jerseys/MKD.png', flagAsset: 'content/flags/MKD.svg' },
  { id: 'MNE', name: 'Montenegro', confederation: 'UEFA', fifaRanking: 72, fifaPoints: 1312, jerseyAsset: 'content/national-jerseys/MNE.png', flagAsset: 'content/flags/MNE.svg' },

  // CONCACAF (6)
  { id: 'USA', name: 'Estados Unidos', confederation: 'CONCACAF', fifaRanking: 14, fifaPoints: 1640, jerseyAsset: 'content/national-jerseys/USA.png', flagAsset: 'content/flags/USA.svg' },
  { id: 'MEX', name: 'México', confederation: 'CONCACAF', fifaRanking: 16, fifaPoints: 1615, jerseyAsset: 'content/national-jerseys/MEX.png', flagAsset: 'content/flags/MEX.svg' },
  { id: 'CAN', name: 'Canadá', confederation: 'CONCACAF', fifaRanking: 48, fifaPoints: 1415, jerseyAsset: 'content/national-jerseys/CAN.png', flagAsset: 'content/flags/CAN.svg' },
  { id: 'CRC', name: 'Costa Rica', confederation: 'CONCACAF', fifaRanking: 54, fifaPoints: 1385, jerseyAsset: 'content/national-jerseys/CRC.png', flagAsset: 'content/flags/CRC.svg' },
  { id: 'PAN', name: 'Panamá', confederation: 'CONCACAF', fifaRanking: 43, fifaPoints: 1445, jerseyAsset: 'content/national-jerseys/PAN.png', flagAsset: 'content/flags/PAN.svg' },
  { id: 'JAM', name: 'Jamaica', confederation: 'CONCACAF', fifaRanking: 59, fifaPoints: 1365, jerseyAsset: 'content/national-jerseys/JAM.png', flagAsset: 'content/flags/JAM.svg' },

  // AFC (6)
  { id: 'JPN', name: 'Japão', confederation: 'AFC', fifaRanking: 17, fifaPoints: 1605, jerseyAsset: 'content/national-jerseys/JPN.png', flagAsset: 'content/flags/JPN.svg' },
  { id: 'KOR', name: 'Coreia do Sul', confederation: 'AFC', fifaRanking: 22, fifaPoints: 1575, jerseyAsset: 'content/national-jerseys/KOR.png', flagAsset: 'content/flags/KOR.svg' },
  { id: 'IRN', name: 'Irã', confederation: 'AFC', fifaRanking: 20, fifaPoints: 1590, jerseyAsset: 'content/national-jerseys/IRN.png', flagAsset: 'content/flags/IRN.svg' },
  { id: 'AUS', name: 'Austrália', confederation: 'AFC', fifaRanking: 25, fifaPoints: 1555, jerseyAsset: 'content/national-jerseys/AUS.png', flagAsset: 'content/flags/AUS.svg' },
  { id: 'KSA', name: 'Arábia Saudita', confederation: 'AFC', fifaRanking: 56, fifaPoints: 1375, jerseyAsset: 'content/national-jerseys/KSA.png', flagAsset: 'content/flags/KSA.svg' },
  { id: 'QAT', name: 'Catar', confederation: 'AFC', fifaRanking: 37, fifaPoints: 1470, jerseyAsset: 'content/national-jerseys/QAT.png', flagAsset: 'content/flags/QAT.svg' },

  // CAF (6)
  { id: 'MAR', name: 'Marrocos', confederation: 'CAF', fifaRanking: 13, fifaPoints: 1660, jerseyAsset: 'content/national-jerseys/MAR.png', flagAsset: 'content/flags/MAR.svg' },
  { id: 'SEN', name: 'Senegal', confederation: 'CAF', fifaRanking: 19, fifaPoints: 1595, jerseyAsset: 'content/national-jerseys/SEN.png', flagAsset: 'content/flags/SEN.svg' },
  { id: 'EGY', name: 'Egito', confederation: 'CAF', fifaRanking: 36, fifaPoints: 1478, jerseyAsset: 'content/national-jerseys/EGY.png', flagAsset: 'content/flags/EGY.svg' },
  { id: 'NGA', name: 'Nigéria', confederation: 'CAF', fifaRanking: 39, fifaPoints: 1455, jerseyAsset: 'content/national-jerseys/NGA.png', flagAsset: 'content/flags/NGA.svg' },
  { id: 'ALG', name: 'Argélia', confederation: 'CAF', fifaRanking: 44, fifaPoints: 1442, jerseyAsset: 'content/national-jerseys/ALG.png', flagAsset: 'content/flags/ALG.svg' },
  { id: 'CIV', name: 'Costa do Marfim', confederation: 'CAF', fifaRanking: 38, fifaPoints: 1465, jerseyAsset: 'content/national-jerseys/CIV.png', flagAsset: 'content/flags/CIV.svg' },

  // OFC (1)
  { id: 'NZL', name: 'Nova Zelândia', confederation: 'OFC', fifaRanking: 94, fifaPoints: 1220, jerseyAsset: 'content/national-jerseys/NZL.png', flagAsset: 'content/flags/NZL.svg' }
];

/**
 * Conoca automaticamente exatamente 26 jogadores para uma Seleção Nacional
 * com base estrita na nacionalidade e ausência de lesão, por mérito puro (Overall + Moral + Traços).
 * Padrão FIFA Oficial: 3 GK, 5 DEF, 4 LAT, 7 MID, 7 ATT.
 */
export function autoSelectNationalSquad(
  teamId: string,
  availablePlayers: (Player & { clubId?: string; clubName?: string })[]
): NationalTeamSquadState {
  // Elegibilidade estrita: mesma nacionalidade e sem lesão ativa
  const eligiblePlayers = availablePlayers.filter(
    p => p.nationality === teamId && (!p.injuryWeeks || p.injuryWeeks === 0)
  );

  const getTopByPosition = (pos: Position, count: number): Player[] => {
    const sorted = eligiblePlayers
      .filter(p => p.position === pos)
      .sort((a, b) => {
        let scoreA = a.overall + (a.morale / 10);
        let scoreB = b.overall + (b.morale / 10);
        if (a.traits?.includes('LEADER') || a.traits?.includes('DETERMINED')) scoreA += 3;
        if (b.traits?.includes('LEADER') || b.traits?.includes('DETERMINED')) scoreB += 3;
        return scoreB - scoreA;
      });
    return sorted.slice(0, count);
  };

  // Padrão FIFA Oficial de 26 Atletas: 3 GK, 5 DEF, 4 LAT, 7 MID, 7 ATT
  const gks = getTopByPosition('GK', 3);
  const defs = getTopByPosition('DEF', 5);
  const lats = getTopByPosition('LAT', 4);
  const mids = getTopByPosition('MID', 7);
  const atts = getTopByPosition('ATT', 7);

  const selectedPlayers: Player[] = [...gks, ...defs, ...lats, ...mids, ...atts];

  // Se faltar atletas por pool insuficiente, preencher com os melhores elegíveis restantes
  if (selectedPlayers.length < 26) {
    const remainingNeeded = 26 - selectedPlayers.length;
    const selectedIds = new Set(selectedPlayers.map(p => p.id));
    const leftovers = eligiblePlayers
      .filter(p => !selectedIds.has(p.id))
      .sort((a, b) => b.overall - a.overall)
      .slice(0, remainingNeeded);
    selectedPlayers.push(...leftovers);
  }

  const squadEntries: NationalSquadEntry[] = selectedPlayers.slice(0, 26).map((p, idx) => ({
    playerId: p.id,
    playerName: p.name,
    clubId: p.clubId || 'FREE_AGENT',
    clubName: p.clubName || 'Sem Clube',
    position: p.position,
    overall: p.overall,
    morale: p.morale || 70,
    caps: Math.floor(Math.random() * 40) + 1,
    goals: p.position === 'ATT' ? Math.floor(Math.random() * 18) : Math.floor(Math.random() * 3),
    isStarter: idx < 11 // Primeiros 11 são titulares
  }));

  return {
    teamId,
    squad: squadEntries,
    tactics: {
      formation: '4-3-3',
      mentality: 'BALANCED'
    }
  };
}

/**
 * Calcula a diária paga pela FIFA ao clube por ceder o atleta (Programa de Proteção e Benefícios)
 */
export function calculateFifaReleaseCompensation(player: Player, daysCount = 10): number {
  const dailyRate = 35000 + (player.overall * 800);
  return Math.round(dailyRate * daysCount);
}

/**
 * Calcula a indenização da FIFA ao clube quando o jogador se lesiona a serviço da seleção nacional
 */
export function calculateFifaInjuryIndemnity(player: Player, injuryWeeks: number): number {
  const weeklyWage = player.wage || 25000;
  const medicalCostPerWeek = 20000;
  return Math.round((weeklyWage + medicalCostPerWeek) * injuryWeeks);
}

/**
 * Calcula o repasse de premiação financeira aos clubes que forneceram atletas para seleções campeãs ou finalistas
 */
export function calculateNationalTournamentBonus(clubPlayersCount: number, prizeTier: 'CHAMPION' | 'FINALIST' | 'PODIUM'): number {
  let tierMultiplier = 1000000;
  if (prizeTier === 'CHAMPION') tierMultiplier = 3000000;
  else if (prizeTier === 'FINALIST') tierMultiplier = 1800000;
  else if (prizeTier === 'PODIUM') tierMultiplier = 1000000;
  return tierMultiplier * clubPlayersCount;
}

/**
 * Calcula a alteração de pontos no Ranking FIFA após uma partida internacional
 */
export function calculateFifaRankingChange(
  teamPoints: number,
  opponentPoints: number,
  matchResult: 'WIN' | 'DRAW' | 'LOSS',
  isImportantTournament = false
): { newPoints: number; pointsDiff: number } {
  const K = isImportantTournament ? 40 : 25;
  const expectedScore = 1 / (1 + Math.pow(10, (opponentPoints - teamPoints) / 400));

  let actualScore = 0.5;
  if (matchResult === 'WIN') actualScore = 1.0;
  else if (matchResult === 'LOSS') actualScore = 0.0;

  const diff = Math.round(K * (actualScore - expectedScore));
  return {
    newPoints: Math.max(100, teamPoints + diff),
    pointsDiff: diff
  };
}

export interface NationalJobOffer {
  id: string;
  teamCode: string;
  teamName: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

/**
 * Avalia se o treinador humano recebeu convite para assumir uma seleção nacional
 */
export function evaluateNationalJobOffer(
  managerReputation: number,
  managerTrophiesCount: number,
  nationalTeamId: string
): boolean {
  const threshold = 55;
  if (managerReputation >= threshold || managerTrophiesCount >= 1) {
    return true;
  }
  return false;
}

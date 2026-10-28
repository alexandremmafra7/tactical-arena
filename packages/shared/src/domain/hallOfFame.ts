import type { Club } from './club.js';
import type { Player, Position, StarLevel } from './player.js';

export interface AllTimeTopScorerEntry {
  rank: number;
  playerId: string;
  playerName: string;
  clubId?: string | null;
  clubName: string;
  clubSlug?: string | null;
  nationality?: string;
  age: number;
  position: Position;
  overall: number;
  starLevel?: StarLevel;
  diferenciado?: boolean;
  totalGoals: number;
  matchesPlayed: number;
  goalsPerMatch: number;
  isActive: boolean;
  marketValue?: number;
  notableClub?: string;
  era?: string;
  distinction?: string;
}

export interface ClubTrophyRankingEntry {
  rank: number;
  clubId: string;
  clubName: string;
  clubSlug?: string | null;
  country: string;
  points: number;
  titlesWon: number;
  mundialCount: number;
  continentalCount: number;
  leagueCount: number;
  cupCount: number;
}

export interface ManagerHallOfFameEntry {
  rank: number;
  managerId: string;
  managerName: string;
  nationality?: string;
  isUser: boolean;
  currentClubName?: string;
  points: number;
  totalTitles: number;
  mundialTitles: number;
  continentalTitles: number;
  leagueTitles: number;
  cupTitles: number;
}

export interface HallOfFameData {
  topScorers: AllTimeTopScorerEntry[];
  topClubs: ClubTrophyRankingEntry[];
  topManagers: ManagerHallOfFameEntry[];
}

/**
 * Base histórica dos maiores artilheiros de todos os tempos do futebol mundial (Homenagem Oficial FIFA/RSSSF).
 * Ordenada estritamente de forma decrescente pela contagem histórica consagrada (Pelé em 1º com 1.282 gols).
 */
export interface LegendaryScorerSeed {
  name: string;
  officialGoals: number;
  totalMatches: number;
  position: Position;
  nationality: string;
  isActive: boolean;
  notableClub: string;
  era: string;
  distinction?: string;
}

export const ALL_TIME_GREATEST_SCORERS: readonly LegendaryScorerSeed[] = [
  { name: 'Pelé', officialGoals: 1282, totalMatches: 1363, position: 'ATT', nationality: 'BRA', isActive: false, notableClub: 'Santos / Cosmos / Brasil', era: '1956-1977', distinction: 'O Rei do Futebol / Atleta do Século' },
  { name: 'Romário', officialGoals: 1002, totalMatches: 1209, position: 'ATT', nationality: 'BRA', isActive: false, notableClub: 'Vasco / PSV / Barcelona / Flamengo', era: '1985-2009', distinction: 'O Gênio da Grande Área / Tetracampeão Mundial' },
  { name: 'Cristiano Ronaldo', officialGoals: 907, totalMatches: 1245, position: 'ATT', nationality: 'POR', isActive: true, notableClub: 'Real Madrid / Al-Nassr', era: '2002-Atual', distinction: 'Maior Artilheiro Contemporâneo' },
  { name: 'Lionel Messi', officialGoals: 849, totalMatches: 1078, position: 'ATT', nationality: 'ARG', isActive: true, notableClub: 'Barcelona / Inter Miami', era: '2004-Atual', distinction: 'Campeão do Mundo & 8x Ballon d\'Or' },
  { name: 'Ferenc Puskás', officialGoals: 808, totalMatches: 794, position: 'ATT', nationality: 'HUN', isActive: false, notableClub: 'Honvéd / Real Madrid', era: '1943-1966', distinction: 'Major Galopante / Lenda Mundial' },
  { name: 'Josef Bican', officialGoals: 805, totalMatches: 530, position: 'ATT', nationality: 'AUT', isActive: false, notableClub: 'Slavia Praga / Rapid Viena', era: '1931-1955', distinction: 'Média Histórica de 1.52 gols/jogo' },
  { name: 'Gerd Müller', officialGoals: 735, totalMatches: 793, position: 'ATT', nationality: 'GER', isActive: false, notableClub: 'Bayern de Munique', era: '1964-1981', distinction: 'Der Bomber / Campeão do Mundo 1974' },
  { name: 'Robert Lewandowski', officialGoals: 682, totalMatches: 935, position: 'ATT', nationality: 'POL', isActive: true, notableClub: 'Bayern / Barcelona', era: '2006-Atual', distinction: 'Chuteira de Ouro Europeia' },
  { name: 'Eusébio', officialGoals: 623, totalMatches: 639, position: 'ATT', nationality: 'POR', isActive: false, notableClub: 'Benfica / Portugal', era: '1957-1979', distinction: 'Pantera Negra / Ballon d\'Or 1965' },
  { name: 'Zlatan Ibrahimović', officialGoals: 573, totalMatches: 988, position: 'ATT', nationality: 'SWE', isActive: false, notableClub: 'Ajax / Milan / PSG', era: '1999-2023', distinction: 'Gols em 4 décadas diferentes' },
  { name: 'Luis Suárez', officialGoals: 571, totalMatches: 950, position: 'ATT', nationality: 'URU', isActive: true, notableClub: 'Liverpool / Barcelona / Inter Miami', era: '2005-Atual', distinction: 'El Pistolero / 2x Chuteira de Ouro' },
  { name: 'Arthur Friedenreich', officialGoals: 557, totalMatches: 561, position: 'ATT', nationality: 'BRA', isActive: false, notableClub: 'Paulistano / São Paulo', era: '1909-1935', distinction: 'Pioneiro & Primeiro Craque Brasileiro' },
  { name: 'Zico', officialGoals: 522, totalMatches: 770, position: 'MID', nationality: 'BRA', isActive: false, notableClub: 'Flamengo / Udinese / Kashima', era: '1971-1994', distinction: 'Galinho de Quintino (800+ gols totais)' },
  { name: 'Alfredo Di Stéfano', officialGoals: 515, totalMatches: 706, position: 'ATT', nationality: 'ARG', isActive: false, notableClub: 'Millonarios / Real Madrid', era: '1945-1966', distinction: 'Saeta Rubia / 5x Campeão Europeu' },
  { name: 'Karim Benzema', officialGoals: 475, totalMatches: 915, position: 'ATT', nationality: 'FRA', isActive: true, notableClub: 'Real Madrid / Al-Ittihad', era: '2004-Atual', distinction: 'Ballon d\'Or 2022' },
  { name: 'Neymar Jr', officialGoals: 439, totalMatches: 718, position: 'ATT', nationality: 'BRA', isActive: true, notableClub: 'Santos / Barcelona / PSG / Al-Hilal', era: '2009-Atual', distinction: 'Maior Artilheiro da Seleção Brasileira (FIFA)' },
  { name: 'Raúl González', officialGoals: 432, totalMatches: 1017, position: 'ATT', nationality: 'ESP', isActive: false, notableClub: 'Real Madrid / Schalke 04', era: '1994-2015', distinction: 'Eterno Camisa 7 Merengue' },
  { name: 'Sergio Agüero', officialGoals: 426, totalMatches: 786, position: 'ATT', nationality: 'ARG', isActive: false, notableClub: 'Atlético de Madrid / Man City', era: '2003-2021', distinction: 'Maior Goleador Estrangeiro da Premier League' },
  { name: 'Hulk', officialGoals: 422, totalMatches: 795, position: 'ATT', nationality: 'BRA', isActive: true, notableClub: 'Porto / Zenit / Atlético-MG', era: '2004-Atual', distinction: 'Artilheiro Multicampeão Continental' },
  { name: 'Ronaldo Fenômeno', officialGoals: 414, totalMatches: 616, position: 'ATT', nationality: 'BRA', isActive: false, notableClub: 'PSV / Barcelona / Inter / Real Madrid', era: '1993-2011', distinction: 'O Fenômeno / 2x Campeão Mundial & 2x Ballon d\'Or' },
  { name: 'Thierry Henry', officialGoals: 411, totalMatches: 917, position: 'ATT', nationality: 'FRA', isActive: false, notableClub: 'Arsenal / Barcelona / França', era: '1994-2014', distinction: 'Lenda Invencível dos Gunners' },
  { name: 'Ruud van Nistelrooy', officialGoals: 384, totalMatches: 659, position: 'ATT', nationality: 'NED', isActive: false, notableClub: 'PSV / Man United / Real Madrid', era: '1993-2012', distinction: 'Predador de Área Holandês' },
  { name: 'Rivaldo', officialGoals: 377, totalMatches: 813, position: 'MID', nationality: 'BRA', isActive: false, notableClub: 'Palmeiras / Barcelona / Deportivo', era: '1991-2015', distinction: 'Ballon d\'Or 1999 & Campeão Mundial 2002' },
  { name: 'Diego Maradona', officialGoals: 358, totalMatches: 680, position: 'MID', nationality: 'ARG', isActive: false, notableClub: 'Argentinos / Boca / Napoli / Argentina', era: '1976-1997', distinction: 'D10S / Campeão Mundial 1986' },
  { name: 'Gabriel Batistuta', officialGoals: 356, totalMatches: 633, position: 'ATT', nationality: 'ARG', isActive: false, notableClub: 'Fiorentina / Roma / Argentina', era: '1988-2005', distinction: 'Batigol / Lenda da Serie A' },
];

/**
 * Base histórica de técnicos vitoriosos para compor o Hall da Fama.
 */
const HISTORICAL_MANAGERS_SEED: Array<{
  name: string;
  nationality: string;
  mundial: number;
  continental: number;
  league: number;
  cup: number;
}> = [
  { name: 'Alex Ferguson', nationality: 'SCO', mundial: 2, continental: 2, league: 13, cup: 9 },
  { name: 'Pep Guardiola', nationality: 'ESP', mundial: 4, continental: 3, league: 12, cup: 7 },
  { name: 'Carlo Ancelotti', nationality: 'ITA', mundial: 3, continental: 5, league: 6, cup: 4 },
  { name: 'Abel Ferreira', nationality: 'POR', mundial: 0, continental: 2, league: 2, cup: 1 },
  { name: 'Tite', nationality: 'BRA', mundial: 1, continental: 1, league: 2, cup: 1 },
  { name: 'Renato Gaúcho', nationality: 'BRA', mundial: 0, continental: 1, league: 0, cup: 2 },
  { name: 'Dorival Júnior', nationality: 'BRA', mundial: 0, continental: 1, league: 0, cup: 3 },
  { name: 'Jorge Jesus', nationality: 'POR', mundial: 0, continental: 1, league: 4, cup: 3 },
  { name: 'Marcelo Gallardo', nationality: 'ARG', mundial: 0, continental: 2, league: 1, cup: 3 },
  { name: 'Felipão (Scolari)', nationality: 'BRA', mundial: 1, continental: 2, league: 2, cup: 4 },
  { name: 'Muricy Ramalho', nationality: 'BRA', mundial: 0, continental: 1, league: 4, cup: 0 },
  { name: 'Vanderlei Luxemburgo', nationality: 'BRA', mundial: 0, continental: 0, league: 5, cup: 1 },
];

/**
 * Calcula os dados completos do Hall da Fama para o universo da simulação.
 */
export function buildHallOfFameData(
  clubs: Club[],
  userManager?: { name?: string; titlesWon?: number; trophies?: Array<{ type?: string; competitionType?: string }> } | null,
): HallOfFameData {
  // 1. TOP SCORERS: Homenagem Oficial aos Maiores da História + Recordistas Ativos
  const playerMap = new Map<string, AllTimeTopScorerEntry>();

  // Mapa de jogadores ativos do banco de dados para vincular aos maiores artilheiros por NOME EXATO
  const activePlayersByName = new Map<string, { player: Player; club: Club }>();
  for (const club of clubs) {
    for (const player of club.players) {
      const norm = player.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      if (!activePlayersByName.has(norm)) {
        activePlayersByName.set(norm, { player, club });
      }
    }
  }

  // 1.1 Inclui todas as Lendas do Futebol Mundial (Oficiais FIFA / RSSSF)
  ALL_TIME_GREATEST_SCORERS.forEach((legend, idx) => {
    const norm = legend.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    // Correspondência EXATA por nome completo, sem fallback de substring frouxa para evitar falsos positivos
    const matchedActive = legend.isActive ? activePlayersByName.get(norm) : undefined;

    if (matchedActive && legend.isActive) {
      // Jogador em atividade no banco de dados com nome exatamente igual
      playerMap.set(matchedActive.player.id, {
        rank: 0,
        playerId: matchedActive.player.id,
        playerName: legend.name,
        clubId: matchedActive.club.id,
        clubName: matchedActive.club.name,
        clubSlug: matchedActive.club.slug,
        nationality: legend.nationality,
        age: matchedActive.player.age,
        position: legend.position,
        overall: Math.round(matchedActive.player.overall),
        starLevel: matchedActive.player.starLevel,
        diferenciado: matchedActive.player.diferenciado ?? true,
        totalGoals: legend.officialGoals,
        matchesPlayed: legend.totalMatches,
        goalsPerMatch: Math.round((legend.officialGoals / legend.totalMatches) * 100) / 100,
        isActive: true,
        marketValue: matchedActive.player.marketValue,
        notableClub: legend.notableClub,
        era: legend.era,
        distinction: legend.distinction,
      });
    } else {
      // Lenda Histórica Consagrada ou Atleta sem correspondência exata no save local:
      // Nunca associar clubSlug de clubes do save brasileiro/aleatório.
      const ovr = legend.name === 'Pelé' ? 99 : legend.officialGoals >= 700 ? 96 : legend.officialGoals >= 500 ? 94 : 91;
      playerMap.set(`legend-${idx}`, {
        rank: 0,
        playerId: `legend-${idx}`,
        playerName: legend.name,
        clubId: null,
        clubName: legend.notableClub,
        clubSlug: null, // Sem clube local do save para lendas/estrangeiros sem match exato
        nationality: legend.nationality,
        age: legend.isActive ? 37 : 40,
        position: legend.position,
        overall: ovr,
        starLevel: 'NATURAL',
        diferenciado: true,
        totalGoals: legend.officialGoals,
        matchesPlayed: legend.totalMatches,
        goalsPerMatch: Math.round((legend.officialGoals / legend.totalMatches) * 100) / 100,
        isActive: legend.isActive,
        notableClub: legend.notableClub,
        era: legend.era,
        distinction: legend.distinction,
      });
    }
  });

  // 1.2 Jogadores do save/carreira que atingiram marcas históricas expressivas (ex: >= 150 gols de carreira)
  for (const club of clubs) {
    for (const player of club.players) {
      if (playerMap.has(player.id)) continue;
      const matchGoals = (player as any).careerGoals ?? (player as any).goals ?? 0;
      if (matchGoals >= 150) {
        const matchesPlayed = (player as any).careerMatches ?? (player as any).matchesPlayed ?? Math.max(30, player.age * 12);
        playerMap.set(player.id, {
          rank: 0,
          playerId: player.id,
          playerName: player.name,
          clubId: club.id,
          clubName: club.name,
          clubSlug: club.slug,
          nationality: (player as any).nationality ?? 'BRA',
          age: player.age,
          position: player.position,
          overall: Math.round(player.overall),
          starLevel: player.starLevel,
          diferenciado: player.diferenciado,
          totalGoals: matchGoals,
          matchesPlayed,
          goalsPerMatch: matchesPlayed > 0 ? Math.round((matchGoals / matchesPlayed) * 100) / 100 : 0,
          isActive: true,
          marketValue: player.marketValue,
          notableClub: club.name,
          era: 'Carreira Atual',
          distinction: 'Artilheiro do Save',
        });
      }
    }
  }

  const sortedScorers = Array.from(playerMap.values())
    .sort((a, b) => b.totalGoals - a.totalGoals)
    .slice(0, 50)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  // 2. TOP CLUBS (Ranking de Títulos)
  const clubEntries: ClubTrophyRankingEntry[] = clubs.map((club) => {
    const trophies = club.trophies || [];
    let mundialCount = 0;
    let continentalCount = 0;
    let leagueCount = 0;
    let cupCount = 0;

    for (const t of trophies) {
      if (t.competitionType === 'CLUB_WORLD_CUP' || t.competitionType === 'INTERCONTINENTAL') mundialCount++;
      else if (t.competitionType === 'LIBERTADORES' || t.competitionType === 'CHAMPIONS_LEAGUE') continentalCount++;
      else if (t.competitionType === 'LEAGUE') leagueCount++;
      else if (t.competitionType === 'CUP') cupCount++;
    }

    if (trophies.length === 0 && (club.titlesWon ?? 0) > 0) {
      const total = club.titlesWon;
      mundialCount = Math.floor(total / 10);
      continentalCount = Math.floor((total % 10) / 4);
      leagueCount = Math.floor(total * 0.6);
      cupCount = Math.max(0, total - mundialCount - continentalCount - leagueCount);
    }

    const points = mundialCount * 10 + continentalCount * 7 + leagueCount * 5 + cupCount * 4;

    return {
      rank: 0,
      clubId: club.id,
      clubName: club.name,
      clubSlug: club.slug,
      country: club.country,
      points,
      titlesWon: club.titlesWon || (mundialCount + continentalCount + leagueCount + cupCount),
      mundialCount,
      continentalCount,
      leagueCount,
      cupCount,
    };
  });

  const sortedClubs = clubEntries
    .sort((a, b) => b.points - a.points || b.titlesWon - a.titlesWon)
    .slice(0, 50)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  // 3. TOP MANAGERS
  const managerList: ManagerHallOfFameEntry[] = HISTORICAL_MANAGERS_SEED.map((m, idx) => {
    const points = m.mundial * 10 + m.continental * 7 + m.league * 5 + m.cup * 4;
    return {
      rank: 0,
      managerId: `seed-mgr-${idx}`,
      managerName: m.name,
      nationality: m.nationality,
      isUser: false,
      currentClubName: undefined,
      points,
      totalTitles: m.mundial + m.continental + m.league + m.cup,
      mundialTitles: m.mundial,
      continentalTitles: m.continental,
      leagueTitles: m.league,
      cupTitles: m.cup,
    };
  });

  if (userManager) {
    let userMundial = 0;
    let userContinental = 0;
    let userLeague = 0;
    let userCup = 0;
    (userManager.trophies || []).forEach((t) => {
      const typeStr = (t.type || t.competitionType || '').toUpperCase();
      if (typeStr.includes('WORLD') || typeStr.includes('INTERCONTINENTAL')) userMundial++;
      else if (typeStr.includes('LIBERTADORES') || typeStr.includes('CHAMPIONS')) userContinental++;
      else if (typeStr.includes('LEAGUE')) userLeague++;
      else if (typeStr.includes('CUP')) userCup++;
    });

    const userTitles = userManager.titlesWon ?? (userMundial + userContinental + userLeague + userCup);
    const userPoints = userMundial * 10 + userContinental * 7 + userLeague * 5 + userCup * 4;

    managerList.push({
      rank: 0,
      managerId: 'user-manager',
      managerName: userManager.name || 'Você (Treinador)',
      nationality: 'BRA',
      isUser: true,
      currentClubName: clubs[0]?.name,
      points: userPoints,
      totalTitles: userTitles,
      mundialTitles: userMundial,
      continentalTitles: userContinental,
      leagueTitles: userLeague,
      cupTitles: userCup,
    });
  }

  const sortedManagers = managerList
    .sort((a, b) => b.points - a.points || b.totalTitles - a.totalTitles)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return {
    topScorers: sortedScorers,
    topClubs: sortedClubs,
    topManagers: sortedManagers,
  };
}

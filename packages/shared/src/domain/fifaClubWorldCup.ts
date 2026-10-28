// ============================================================================
// FIFA CLUB WORLD CUP - Domínio dos Mundiais de Clubes da FIFA
//
// Define os dois formatos máximos da FIFA para clubes:
// 1. Copa Intercontinental da FIFA (Mundial Anual de Dezembro)
// 2. Super Mundial de Clubes FIFA (Quadrienal de 32 Clubes)
//
// @see 12_MUNDIAIS_DE_CLUBES_DA_FIFA_SPEC.md
// ============================================================================

// ============================================================================
// TIPOS BÁSICOS
// ============================================================================

/**
 * Confederações continentais (para identificação de campeões)
 */
export type ContinentalConfederation =
  | 'UEFA' // União das Associações Europeias de Futebol
  | 'CONMEBOL' // Confederação Sul-Americana de Futebol
  | 'CONCACAF' // Confederação de Futebol da América do Norte, Central e Caribe
  | 'AFC' // Confederação Asiática de Futebol
  | 'CAF' // Confederação Africana de Futebol
  | 'OFC' // Confederação de Futebol da Oceânia;

/**
 * Mapeamento de confederações para seus torneios continentais
 */
export const CONTINENTAL_TOURNAMENTS: Record<ContinentalConfederation, string> = {
  UEFA: 'CL',      // Champions League
  CONMEBOL: 'UL',  // Libertadores
  CONCACAF: 'CC',  // CONCACAF Champions Cup
  AFC: 'ACL',      // AFC Champions League
  CAF: 'CAFCL',    // CAF Champions League
  OFC: 'OCL',      // OFC Champions League
};

/**
 * Resultados das competições continentais (campeões por confederação)
 */
export type ContinentalChampions = Partial<Record<ContinentalConfederation, string>>;

// ============================================================================
// COPA INTERCONTINENTAL DA FIFA (MUNDIAL ANUAL)
// ============================================================================

/**
 * Fases da Copa Intercontinental da FIFA
 */
export type IntercontinentalPhase =
  | 'PLAYOFF_AF_ASIA_PACIFIC' // Fase 1: OFC vs AFC → vencedor enfrenta CAF
  | 'DERBI_DAS_AMERICAS'      // Fase 2: Libertadores vs CONCACAF Champions Cup
  | 'COPA_CHALLENGER'         // Fase 3: Vencedor África-Ásia-Pacífico vs Vencedor Dérbi das Américas
  | 'GRANDE_FINAL'            // Fase 4: Vencedor da Challenger vs Campeão da UEFA Champions League

/**
 * Estado de uma partida na Copa Intercontinental
 */
export interface IntercontinentalMatch {
  id: string;
  phase: IntercontinentalPhase;
  homeTeam: string;   // ID do time da casa
  awayTeam: string;   // ID do time visitante
  homeScore?: number; // Gols da casa (undefined se não jogou)
  awayScore?: number; // Gols do visitante (undefined se não jogou)
  isKnockout: true;   // Sempre mata-mata
  neutralVenue: boolean; // Indica se é em campo neutro (apenas a Grande Final)
}

/**
 * Estado do torneio da Copa Intercontinental
 */
export interface IntercontinentalTournamentState {
  matches: IntercontinentalMatch[];
  currentPhase: IntercontinentalPhase;
  isCompleted: boolean;
  champion?: string; // ID do time campeão (definido quando completado)
}

// ============================================================================
// SUPER MUNDIAL DE CLUBES FIFA (32 CLUBES)
// ============================================================================

/**
 * Fase do Super Mundial de Clubes
 */
export type SuperWorldCupPhase =
  | 'GROUP_STAGE'   // Fase de grupos (8 grupos de 4 times)
  | 'ROUND_OF_16'   // Oitavas de final
  | 'QUARTER_FINAL' // Quartas de final
  | 'SEMI_FINAL'    // Semifinais
  | 'FINAL'         // Final

/**
 * Resultado de uma partida no Super Mundial
 */
export interface SuperWorldCupMatch {
  id: string;
  phase: SuperWorldCupPhase;
  group?: string;     // Grupo (A-H) - apenas na fase de grupos
  homeTeam: string;   // ID do time da casa
  awayTeam: string;   // ID do time visitante
  homeScore: number;  // Gols da casa
  awayScore: number;  // Gols do visitante
  isKnockout: boolean; // True a partir das oitavas de final
}

/**
 * Estado de um time na fase de grupos do Super Mundial
 */
export interface SuperWorldCupGroupStanding {
  teamId: string;
  points: number;      // Pontos (3 vitória, 1 empate, 0 derrota)
  gamesPlayed: number; // Jogos realizados
  goalsFor: number;    // Gols pró
  goalsAgainst: number; // Gols contra
  goalDifference: number; // Saldo de gols
}

/**
 * Estado do Super Mundial de Clubes
 */
export interface SuperWorldCupState {
  groups: Record<string, string[]>; // Grupo (A-H) → array de 4 IDs de times
  standings: Record<string, SuperWorldCupGroupStanding[]>; // Grupo → classificação
  matches: SuperWorldCupMatch[];
  currentPhase: SuperWorldCupPhase;
  isCompleted: boolean;
  champion?: string; // ID do time campeão (definido quando completado)
}

// ============================================================================
// FUNÇÕES PURAS
// ============================================================================

/**
 * Gera o chaveamento oficial da Copa Intercontinental da FIFA
 * @param continentalChampions - Campeões continentais por confederação
 * @returns Estado do torneio da Intercontinental
 */
export function generateIntercontinentalBracket(
  continentalChampions: ContinentalChampions
): IntercontinentalTournamentState {
  const matches: IntercontinentalMatch[] = [];

  // Verificar se temos os campeões necessários
  const uefachampion = continentalChampions['UEFA'];
  const conmebolchampion = continentalChampions['CONMEBOL'];
  const concacafchampion = continentalChampions['CONCACAF'];
  const afchampion = continentalChampions['AFC'];
  const cafchampion = continentalChampions['CAF'];
  const ofchampion = continentalChampions['OFC'];

  // Se não tivermos pelo menos os campeões essenciais, retornar estado vazio
  if (!uefachampion || !conmebolchampion || !concacafchampion) {
    return {
      matches: [],
      currentPhase: 'PLAYOFF_AF_ASIA_PACIFIC',
      isCompleted: false
    };
  }

  // Fase 1: Playoff África-Ásia-Pacífico
  // OFC vs AFC → vencedor enfrenta CAF
  if (afchampion && ofchampion) {
    const match1Id = 'intercontinental_playoff_af_asia_pacific_1';
    matches.push({
      id: match1Id,
      phase: 'PLAYOFF_AF_ASIA_PACIFIC',
      homeTeam: afchampion,
      awayTeam: ofchampion,
      isKnockout: true,
      neutralVenue: false
    });

    // O vencedor enfrenta o CAF (se existir)
    if (cafchampion) {
      const match2Id = 'intercontinental_playoff_af_asia_pacific_2';
      matches.push({
        id: match2Id,
        phase: 'PLAYOFF_AF_ASIA_PACIFIC',
        homeTeam: cafchampion, // CAF em casa por convenção
        awayTeam: `TBD_${match1Id}`, // Placeholder para o vencedor do match 1
        isKnockout: true,
        neutralVenue: false
      });
    }
  }

  // Fase 2: Dérbi das Américas
  // Libertadores vs CONCACAF Champions Cup
  if (conmebolchampion && concacafchampion) {
    const matchId = 'intercontinental_derbi_das_americas';
    matches.push({
      id: matchId,
      phase: 'DERBI_DAS_AMERICAS',
      homeTeam: conmebolchampion, // CONMEBOL em casa por convenção
      awayTeam: concacafchampion,
      isKnockout: true,
      neutralVenue: false
    });
  }

  // Fase 3: Copa Challenger da FIFA
  // Vencedor África-Ásia-Pacífico vs Vencedor Dérbi das Américas
  // (Placeholders - serão preenchidos após as fases anteriores)
  const match3Id = 'intercontinental_copa_challenger';
  matches.push({
    id: match3Id,
    phase: 'COPA_CHALLENGER',
    homeTeam: 'TBD_af_asia_pacific_winner', // Placeholder
    awayTeam: 'TBD_derbi_americas_winner',  // Placeholder
    isKnockout: true,
    neutralVenue: false
  });

  // Fase 4: Grande Final da FIFA
  // Vencedor da Challenger vs Campeão da UEFA Champions League (campo neutro)
  if (uefachampion) {
    const match4Id = 'intercontinental_grande_final';
    matches.push({
      id: match4Id,
      phase: 'GRANDE_FINAL',
      homeTeam: 'TBD_challenger_winner', // Placeholder
      awayTeam: uefachampion,
      isKnockout: true,
      neutralVenue: true // Campo neutro
    });
  }

  return {
    matches,
    currentPhase: 'PLAYOFF_AF_ASIA_PACIFIC',
    isCompleted: false
  };
}

/**
 * Gera o Super Mundial de Clubes FIFA (formato 32 clubes)
 * @param qualifiedClubs - Lista de 32 clubes classificados (IDs)
 * @param seedRng - Semente opcional para o sorteio (para reprodutibilidade)
 * @returns Estado do Super Mundial
 */
export function generateSuperClubWorldCup(
  qualifiedClubs: string[],
  seedRng?: number
): SuperWorldCupState {
  // Validar se temos exatamente 32 clubes
  if (qualifiedClubs.length !== 32) {
    throw new Error('Super Mundial requer exatamente 32 clubes classificados');
  }

  // Configurar seed para reprodutibilidade se fornecido
  const rng = seedRng !== undefined
    ? (() => {
        // Simples LCG para demonstração
        let seed = seedRng;
        return () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };
      })()
    : Math.random;

  // Embaralhar os clubes para o sorteio
  const shuffledClubs = [...qualifiedClubs];
  for (let i = shuffledClubs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledClubs[i], shuffledClubs[j]] = [shuffledClubs[j], shuffledClubs[i]];
  }

  // Distribuir em 8 grupos de 4 (A-H)
  const groups: Record<string, string[]> = {};
  const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  for (let i = 0; i < 8; i++) {
    const group = groupLetters[i];
    groups[group] = shuffledClubs.slice(i * 4, (i + 1) * 4);
  }

  // Gerar partidas da fase de grupos (turno único)
  const matches: SuperWorldCupMatch[] = [];
  let matchId = 1;

  for (const group of groupLetters) {
    const teams = groups[group];
    // Cada time joga contra os outros 3 do grupo (turno único)
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `superworldcup_group_${group}_match_${matchId++}`,
          phase: 'GROUP_STAGE',
          group,
          homeTeam: teams[i],
          awayTeam: teams[j],
          homeScore: 0, // Placeholder - será atualizado após simulação
          awayScore: 0, // Placeholder
          isKnockout: false
        });
      }
    }
  }

  // Inicializar classificações vazias
  const standings: Record<string, SuperWorldCupGroupStanding[]> = {};
  for (const group of groupLetters) {
    standings[group] = groups[group].map(teamId => ({
      teamId,
      points: 0,
      gamesPlayed: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0
    }));
  }

  return {
    groups,
    standings,
    matches,
    currentPhase: 'GROUP_STAGE',
    isCompleted: false
  };
}

/**
 * Calcula pontos de ranking para qualificação ao Super Mundial
 * Baseado no desempenho continental nos últimos 4 anos
 * @param clubResults - Resultados do clube em competições continentais
 * @returns Pontos de ranking (quanto maior, melhor)
 */
export function calculateClubWorldCupRankingPoints(clubResults: {
  continentalTournamentWins: number;   // Vitórias em torneios continentais
  continentalTournamentFinals: number; // Finais de torneios continentais
  continentalTournamentSemis: number;  // Semifinais de torneios continentais
  nationalLeaguePoints: number;        // Pontos no campeonato nacional (último ano)
}): number {
  // Fórmula de ponderação (exemplo - pode ser ajustada)
  // Título continental: 100 pontos
  // Final continental: 50 pontos
  // Semifinal continental: 25 pontos
  // 100 pontos no nacional: 1 ponto

  const continentalPoints =
    clubResults.continentalTournamentWins * 100 +
    clubResults.continentalTournamentFinals * 50 +
    clubResults.continentalTournamentSemis * 25;

  const nationalPoints = Math.floor(clubResults.nationalLeaguePoints / 100);

  return continentalPoints + nationalPoints;
}

// ============================================================================
// TIPOS DE TROFÉUS
// ============================================================================

/**
 * Tipos de competições do Mundial de Clubes
 */
export type ClubWorldCupCompetitionType =
  | 'INTERCONTINENTAL' // Copa Intercontinental da FIFA
  | 'CLUB_WORLD_CUP';  // Super Mundial de Clubes FIFA

/**
 * Entrada na Sala de Troféus para títulos mundiais
 */
export interface TrophyEntry {
  id: string;
  competitionType: ClubWorldCupCompetitionType;
  season: number; // Ano da conquista
  clubId: string; // ID do clube vencedor
  trophyImage: string; // Path da imagem do troféu
}



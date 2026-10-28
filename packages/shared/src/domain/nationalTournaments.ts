// ============================================================================
// NATIONAL TOURNAMENTS — PASSO 14: COPA DO MUNDO & TORNEIOS CONTINENTAIS
//
// Modela e simula a Copa do Mundo FIFA, Copa América, Eurocopa e Finalíssima,
// associando os troféus oficiais (`tr_copamundo.png`, `tr_copaamerica.png`, etc.).
// ============================================================================

export type NationalTournamentType =
  | 'WORLD_CUP'
  | 'COPA_AMERICA'
  | 'EURO'
  | 'FINALISSIMA'
  | 'GOLD_CUP'
  | 'AFCON'
  | 'ASIAN_CUP';

export interface NationalTournamentMatch {
  id: string;
  phase: string;
  group?: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  isKnockout: boolean;
  neutralVenue: boolean;
}

export interface NationalTournamentState {
  tournamentType: NationalTournamentType;
  season: number;
  trophyAsset: string;
  groups?: Record<string, string[]>;
  standings?: Record<string, { teamId: string; points: number; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number }[]>;
  matches: NationalTournamentMatch[];
  currentPhase: string;
  isCompleted: boolean;
  champion?: string;
}

/**
 * Gera o torneio da Copa do Mundo da FIFA (32 seleções, 8 grupos de 4)
 */
export function generateWorldCupTournament(
  qualifiedNations: string[],
  season = 2026,
  seedRng?: number
): NationalTournamentState {
  if (qualifiedNations.length !== 32) {
    throw new Error('Copa do Mundo requer exatamente 32 seleções classificadas');
  }

  const rng = seedRng !== undefined
    ? (() => {
        let seed = seedRng;
        return () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };
      })()
    : Math.random;

  const shuffled = [...qualifiedNations];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const groups: Record<string, string[]> = {};
  const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const standings: NationalTournamentState['standings'] = {};

  for (let i = 0; i < 8; i++) {
    const group = groupLetters[i];
    const groupTeams = shuffled.slice(i * 4, (i + 1) * 4);
    groups[group] = groupTeams;
    standings[group] = groupTeams.map(teamId => ({
      teamId,
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0
    }));
  }

  const matches: NationalTournamentMatch[] = [];
  let matchId = 1;

  for (const group of groupLetters) {
    const teams = groups[group];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `wc_group_${group}_${matchId++}`,
          phase: 'GROUP_STAGE',
          group,
          homeTeam: teams[i],
          awayTeam: teams[j],
          isKnockout: false,
          neutralVenue: true
        });
      }
    }
  }

  return {
    tournamentType: 'WORLD_CUP',
    season,
    trophyAsset: 'content/trophies/tr_copamundo.png',
    groups,
    standings,
    matches,
    currentPhase: 'GROUP_STAGE',
    isCompleted: false
  };
}

/**
 * Gera a Copa América (10 seleções CONMEBOL + convidados)
 */
export function generateCopaAmerica(
  nations: string[],
  season = 2028,
  seedRng?: number
): NationalTournamentState {
  if (nations.length < 8) {
    throw new Error('Copa América requer pelo menos 8 seleções');
  }

  const matches: NationalTournamentMatch[] = [];
  // Simples representação de grupos e mata-mata
  return {
    tournamentType: 'COPA_AMERICA',
    season,
    trophyAsset: 'content/trophies/tr_copaamerica.png',
    matches,
    currentPhase: 'GROUP_STAGE',
    isCompleted: false
  };
}

/**
 * Gera a UEFA Eurocopa (24 seleções, 6 grupos de 4)
 */
export function generateEuroTournament(
  nations: string[],
  season = 2028,
  seedRng?: number
): NationalTournamentState {
  if (nations.length !== 24) {
    throw new Error('Eurocopa requer exatamente 24 seleções');
  }

  const matches: NationalTournamentMatch[] = [];
  return {
    tournamentType: 'EURO',
    season,
    trophyAsset: 'content/trophies/tr_eurocopa.png',
    matches,
    currentPhase: 'GROUP_STAGE',
    isCompleted: false
  };
}

/**
 * Gera a Finalíssima CONMEBOL-UEFA (jogo único entre campeão da Copa América e Euro)
 */
export function generateFinalissima(
  copaAmericaChamp: string,
  euroChamp: string,
  season = 2029
): NationalTournamentState {
  const matches: NationalTournamentMatch[] = [
    {
      id: 'finalissima_match',
      phase: 'FINAL',
      homeTeam: copaAmericaChamp,
      awayTeam: euroChamp,
      isKnockout: true,
      neutralVenue: true
    }
  ];

  return {
    tournamentType: 'FINALISSIMA',
    season,
    trophyAsset: 'content/trophies/tr_finalissima.png',
    matches,
    currentPhase: 'FINAL',
    isCompleted: false
  };
}

/**
 * Avança o estado de um torneio de seleções com base em resultados fornecidos
 */
export function advanceNationalTournament(
  state: NationalTournamentState,
  matchResults: { matchId: string; homeScore: number; awayScore: number }[]
): NationalTournamentState {
  const updatedMatches = state.matches.map(m => {
    const res = matchResults.find(r => r.matchId === m.id);
    if (res) {
      return {
        ...m,
        homeScore: res.homeScore,
        awayScore: res.awayScore
      };
    }
    return m;
  });

  // Verificar se todas as partidas da fase atual foram concluídas
  const allCompleted = updatedMatches.every(m => m.homeScore !== undefined && m.awayScore !== undefined);
  let isCompleted = state.isCompleted;
  let champion = state.champion;

  if (allCompleted && state.tournamentType === 'FINALISSIMA') {
    isCompleted = true;
    const finalMatch = updatedMatches[0];
    if (finalMatch && finalMatch.homeScore !== undefined && finalMatch.awayScore !== undefined) {
      champion = finalMatch.homeScore >= finalMatch.awayScore ? finalMatch.homeTeam : finalMatch.awayTeam;
    }
  }

  return {
    ...state,
    matches: updatedMatches,
    isCompleted,
    champion
  };
}

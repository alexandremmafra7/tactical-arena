import type { CupFixture } from './cup.js';

/**
 * Competições Continentais e Mundiais suportadas pelo ecossistema do Tactical Arena FC.
 */
export type ContinentalTournamentType =
  | 'LIBERTADORES'
  | 'SUDAMERICANA'
  | 'RECOPA_SUDAMERICANA'
  | 'CHAMPIONS_LEAGUE'
  | 'EUROPA_LEAGUE'
  | 'CONFERENCE_LEAGUE'
  | 'UEFA_SUPER_CUP'
  | 'UEFA_CONMEBOL_CHALLENGE'
  | 'FIFA_INTERCONTINENTAL'
  | 'FIFA_CLUB_WORLD_CUP';

export interface TournamentMetadata {
  type: ContinentalTournamentType;
  name: string;
  shortName: string;
  region: 'CONMEBOL' | 'UEFA' | 'WORLD' | 'INTERCONTINENTAL';
  totalClubs: number;
  format: 'GROUPS_AND_KNOCKOUT' | 'KNOCKOUT_ONLY' | 'SINGLE_MATCH';
  groupCount?: number;
  clubsPerGroup?: number;
  advancingPerGroup?: number;
  thirdPlaceDropsTo?: ContinentalTournamentType;
}

export const TOURNAMENT_CONFIGS: Record<ContinentalTournamentType, TournamentMetadata> = {
  LIBERTADORES: {
    type: 'LIBERTADORES',
    name: 'Copa CONMEBOL Libertadores',
    shortName: 'Libertadores',
    region: 'CONMEBOL',
    totalClubs: 32,
    format: 'GROUPS_AND_KNOCKOUT',
    groupCount: 8,
    clubsPerGroup: 4,
    advancingPerGroup: 2,
    thirdPlaceDropsTo: 'SUDAMERICANA',
  },
  SUDAMERICANA: {
    type: 'SUDAMERICANA',
    name: 'Copa CONMEBOL Sudamericana',
    shortName: 'Sul-Americana',
    region: 'CONMEBOL',
    totalClubs: 32,
    format: 'GROUPS_AND_KNOCKOUT',
    groupCount: 8,
    clubsPerGroup: 4,
    advancingPerGroup: 2,
  },
  RECOPA_SUDAMERICANA: {
    type: 'RECOPA_SUDAMERICANA',
    name: 'CONMEBOL Recopa',
    shortName: 'Recopa',
    region: 'CONMEBOL',
    totalClubs: 2,
    format: 'KNOCKOUT_ONLY',
  },
  CHAMPIONS_LEAGUE: {
    type: 'CHAMPIONS_LEAGUE',
    name: 'UEFA Champions League',
    shortName: 'Champions League',
    region: 'UEFA',
    totalClubs: 32,
    format: 'GROUPS_AND_KNOCKOUT',
    groupCount: 8,
    clubsPerGroup: 4,
    advancingPerGroup: 2,
    thirdPlaceDropsTo: 'EUROPA_LEAGUE',
  },
  EUROPA_LEAGUE: {
    type: 'EUROPA_LEAGUE',
    name: 'UEFA Europa League',
    shortName: 'Europa League',
    region: 'UEFA',
    totalClubs: 32,
    format: 'GROUPS_AND_KNOCKOUT',
    groupCount: 8,
    clubsPerGroup: 4,
    advancingPerGroup: 2,
    thirdPlaceDropsTo: 'CONFERENCE_LEAGUE',
  },
  CONFERENCE_LEAGUE: {
    type: 'CONFERENCE_LEAGUE',
    name: 'UEFA Conference League',
    shortName: 'Conference League',
    region: 'UEFA',
    totalClubs: 32,
    format: 'GROUPS_AND_KNOCKOUT',
    groupCount: 8,
    clubsPerGroup: 4,
    advancingPerGroup: 2,
  },
  UEFA_SUPER_CUP: {
    type: 'UEFA_SUPER_CUP',
    name: 'Supercopa da UEFA',
    shortName: 'Supercopa UEFA',
    region: 'UEFA',
    totalClubs: 2,
    format: 'SINGLE_MATCH',
  },
  UEFA_CONMEBOL_CHALLENGE: {
    type: 'UEFA_CONMEBOL_CHALLENGE',
    name: 'Desafio de Clubes UEFA–CONMEBOL',
    shortName: 'Club Challenge',
    region: 'INTERCONTINENTAL',
    totalClubs: 2,
    format: 'SINGLE_MATCH',
  },
  FIFA_INTERCONTINENTAL: {
    type: 'FIFA_INTERCONTINENTAL',
    name: 'Copa Intercontinental da FIFA',
    shortName: 'Copa Intercontinental',
    region: 'WORLD',
    totalClubs: 6,
    format: 'KNOCKOUT_ONLY',
  },
  FIFA_CLUB_WORLD_CUP: {
    type: 'FIFA_CLUB_WORLD_CUP',
    name: 'Super Mundial de Clubes FIFA',
    shortName: 'Super Mundial',
    region: 'WORLD',
    totalClubs: 32,
    format: 'GROUPS_AND_KNOCKOUT',
    groupCount: 8,
    clubsPerGroup: 4,
    advancingPerGroup: 2,
  },
};

export interface GroupStandingRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export type GroupLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface TournamentGroup {
  letter: GroupLetter;
  clubIds: string[];
  standings: GroupStandingRow[];
  fixtures: CupFixture[];
}

export interface ContinentalTournamentState {
  id: string;
  type: ContinentalTournamentType;
  name: string;
  season: number;
  status: 'IN_PROGRESS' | 'FINISHED';
  currentStage: 'GROUP_STAGE' | 'ROUND_OF_16' | 'QUARTER_FINALS' | 'SEMI_FINALS' | 'FINAL';
  groups: TournamentGroup[];
  knockoutFixtures: CupFixture[];
  championClubId: string | null;
  runnerUpClubId: string | null;
}

export interface ClubPotEntry {
  clubId: string;
  countryCode: string;
  reputationOrRating: number;
}

/**
 * Gera 8 grupos de 4 equipes distribuindo potes por ranking/reputação
 * e evitando confrontos do mesmo país no mesmo grupo quando possível.
 */
export function generateContinentalGroups(
  entries: ClubPotEntry[],
  rng: () => number = Math.random,
): TournamentGroup[] {
  if (entries.length !== 32) {
    throw new Error(`Torneio com fase de grupos exige exatamente 32 clubes (recebido: ${entries.length})`);
  }

  // Ordenar por força/reputação para montar 4 potes de 8 clubes
  const sorted = [...entries].sort((a, b) => b.reputationOrRating - a.reputationOrRating);
  const pot1 = sorted.slice(0, 8);
  const pot2 = sorted.slice(8, 16);
  const pot3 = sorted.slice(16, 24);
  const pot4 = sorted.slice(24, 32);

  const letters: GroupLetter[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const groups: TournamentGroup[] = letters.map((letter) => ({
    letter,
    clubIds: [],
    standings: [],
    fixtures: [],
  }));

  // Embaralhar cada pote antes de sortear
  const shuffle = <T>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[j], copy[i]] = [copy[i], copy[j]];
    }
    return copy;
  };

  const pots = [shuffle(pot1), shuffle(pot2), shuffle(pot3), shuffle(pot4)];

  pots.forEach((pot) => {
    pot.forEach((club, groupIndex) => {
      groups[groupIndex].clubIds.push(club.clubId);
    });
  });

  // Para cada grupo, gerar os 6 jogos de ida e volta (Round Robin de 4 times = 6 rodadas)
  groups.forEach((group) => {
    const [c1, c2, c3, c4] = group.clubIds;
    const schedule = [
      { round: 1, home: c1, away: c2 },
      { round: 1, home: c3, away: c4 },
      { round: 2, home: c4, away: c1 },
      { round: 2, home: c2, away: c3 },
      { round: 3, home: c1, away: c3 },
      { round: 3, home: c2, away: c4 },
      { round: 4, home: c3, away: c1 },
      { round: 4, home: c4, away: c2 },
      { round: 5, home: c1, away: c4 },
      { round: 5, home: c3, away: c2 },
      { round: 6, home: c2, away: c1 },
      { round: 6, home: c4, away: c3 },
    ];

    group.fixtures = schedule.map((s) => ({
      round: s.round,
      stageName: `Grupo ${group.letter} • Rodada ${s.round}`,
      homeClubId: s.home,
      awayClubId: s.away,
      matchId: null,
      winnerClubId: null,
      wentToPenalties: false,
    }));

    group.standings = group.clubIds.map((clubId) => ({
      clubId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    }));
  });

  return groups;
}

/**
 * Recalcula a tabela de classificação de um grupo com base nos resultados das partidas.
 */
export function calculateGroupStandings(
  clubIds: string[],
  fixtures: CupFixture[],
  matchScores: Record<string, { homeGoals: number; awayGoals: number }>,
): GroupStandingRow[] {
  const standingsMap = new Map<string, GroupStandingRow>();

  clubIds.forEach((id) => {
    standingsMap.set(id, {
      clubId: id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  fixtures.forEach((f) => {
    if (!f.matchId || !matchScores[f.matchId]) return;
    const score = matchScores[f.matchId];
    const home = standingsMap.get(f.homeClubId);
    const away = standingsMap.get(f.awayClubId);
    if (!home || !away) return;

    home.played += 1;
    away.played += 1;
    home.goalsFor += score.homeGoals;
    home.goalsAgainst += score.awayGoals;
    away.goalsFor += score.awayGoals;
    away.goalsAgainst += score.homeGoals;

    if (score.homeGoals > score.awayGoals) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (score.awayGoals > score.homeGoals) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      home.points += 1;
      away.drawn += 1;
      away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  });

  // Ordenação: 1. Pontos | 2. Saldo de Gols | 3. Gols Pró | 4. Vitórias
  return Array.from(standingsMap.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return b.won - a.won;
  });
}

/**
 * Gera os confrontos de Oitavas de Final a partir dos 1º e 2º colocados de cada grupo (A a H).
 * Cruzamento tradicional:
 * 1º A x 2º B, 1º C x 2º D, 1º E x 2º F, 1º G x 2º H
 * 1º B x 2º A, 1º D x 2º C, 1º F x 2º E, 1º H x 2º G
 */
export function generateRoundOf16FromGroups(
  groups: TournamentGroup[],
  startRoundNumber: number = 7,
  twoLegged: boolean = true,
): CupFixture[] {
  if (groups.length !== 8) {
    throw new Error('Oitavas de final exigem exatamente 8 grupos (A a H)');
  }

  const groupMap = new Map<GroupLetter, GroupStandingRow[]>();
  groups.forEach((g) => groupMap.set(g.letter, g.standings));

  const pairings: Array<{ home: string; away: string; tieId: string; label: string }> = [
    { home: groupMap.get('B')![1]?.clubId ?? '', away: groupMap.get('A')![0]?.clubId ?? '', tieId: 'OIT_1', label: 'Oitavas 1' },
    { home: groupMap.get('A')![1]?.clubId ?? '', away: groupMap.get('B')![0]?.clubId ?? '', tieId: 'OIT_2', label: 'Oitavas 2' },
    { home: groupMap.get('D')![1]?.clubId ?? '', away: groupMap.get('C')![0]?.clubId ?? '', tieId: 'OIT_3', label: 'Oitavas 3' },
    { home: groupMap.get('C')![1]?.clubId ?? '', away: groupMap.get('D')![0]?.clubId ?? '', tieId: 'OIT_4', label: 'Oitavas 4' },
    { home: groupMap.get('F')![1]?.clubId ?? '', away: groupMap.get('E')![0]?.clubId ?? '', tieId: 'OIT_5', label: 'Oitavas 5' },
    { home: groupMap.get('E')![1]?.clubId ?? '', away: groupMap.get('F')![0]?.clubId ?? '', tieId: 'OIT_6', label: 'Oitavas 6' },
    { home: groupMap.get('H')![1]?.clubId ?? '', away: groupMap.get('G')![0]?.clubId ?? '', tieId: 'OIT_7', label: 'Oitavas 7' },
    { home: groupMap.get('G')![1]?.clubId ?? '', away: groupMap.get('H')![0]?.clubId ?? '', tieId: 'OIT_8', label: 'Oitavas 8' },
  ];

  const fixtures: CupFixture[] = [];

  pairings.forEach((p) => {
    if (twoLegged) {
      // Jogo de Ida (2º colocado joga em casa primeiro)
      fixtures.push({
        round: startRoundNumber,
        stageName: `${p.label} (Ida)`,
        homeClubId: p.home,
        awayClubId: p.away,
        matchId: null,
        winnerClubId: '__LEG1__',
        wentToPenalties: false,
        leg: 1,
        tieId: p.tieId,
      });
      // Jogo de Volta (1º colocado decide em casa)
      fixtures.push({
        round: startRoundNumber + 1,
        stageName: `${p.label} (Volta)`,
        homeClubId: p.away,
        awayClubId: p.home,
        matchId: null,
        winnerClubId: null,
        wentToPenalties: false,
        leg: 2,
        tieId: p.tieId,
      });
    } else {
      fixtures.push({
        round: startRoundNumber,
        stageName: p.label,
        homeClubId: p.home,
        awayClubId: p.away,
        matchId: null,
        winnerClubId: null,
        wentToPenalties: false,
      });
    }
  });

  return fixtures;
}

/**
 * Critérios de qualificação por liga para as copas continentais.
 */
export interface ContinentalQualifications {
  libertadores: string[];
  sudamericana: string[];
  championsLeague: string[];
  europaLeague: string[];
  conferenceLeague: string[];
}

/**
 * Determina as vagas continentais ao término da temporada com base na classificação da liga nacional.
 */
export function determineContinentalSpots(
  countryCode: string,
  finalLeagueStandings: Array<{ clubId: string; position: number }>,
  nationalCupWinnerClubId?: string,
): { primarySpots: string[]; secondarySpots: string[]; tertiarySpots: string[] } {
  const primarySpots: string[] = [];
  const secondarySpots: string[] = [];
  const tertiarySpots: string[] = [];

  const standings = [...finalLeagueStandings].sort((a, b) => a.position - b.position);

  if (countryCode === 'BRA') {
    // Brasil: G-4 garantido + Campeão da Copa do Brasil
    if (nationalCupWinnerClubId && !primarySpots.includes(nationalCupWinnerClubId)) {
      primarySpots.push(nationalCupWinnerClubId);
    }
    standings.forEach((s) => {
      if (primarySpots.length < 6 && !primarySpots.includes(s.clubId)) {
        primarySpots.push(s.clubId);
      } else if (secondarySpots.length < 6 && !secondarySpots.includes(s.clubId)) {
        secondarySpots.push(s.clubId);
      }
    });
  } else if (['ENG', 'ESP', 'ITA', 'GER'].includes(countryCode)) {
    // Grandes Ligas Europeias: Top 4 Champions, 5-6 Europa League, 7 Conference League
    standings.forEach((s) => {
      if (primarySpots.length < 4) {
        primarySpots.push(s.clubId);
      } else if (secondarySpots.length < 2) {
        secondarySpots.push(s.clubId);
      } else if (tertiarySpots.length < 1) {
        tertiarySpots.push(s.clubId);
      }
    });
  } else {
    // Demais ligas: Campeão e vice no torneio principal, 3º e 4º no secundário
    standings.forEach((s) => {
      if (primarySpots.length < 2) {
        primarySpots.push(s.clubId);
      } else if (secondarySpots.length < 2) {
        secondarySpots.push(s.clubId);
      }
    });
  }

  return { primarySpots, secondarySpots, tertiarySpots };
}

export type PreSeasonTournamentType = 'FLORIDA_CUP' | 'TROFEO_RAMON_CARRANZA' | 'SUMMER_ASIA_TOUR' | 'COPA_DOS_CAMPEOES_REGIONAL';

export interface PreSeasonTournament {
  id: string;
  name: string;
  type: PreSeasonTournamentType;
  hostCountry: string;
  hostCity: string;
  appearanceFee: number; // Cota fixa de participação paga ao clube
  prizePool: number; // Prêmio extra ao campeão
  minPrestige: number;
  participants: string[]; // Nomes dos 4 clubes participantes
}

export interface PreSeasonBracket {
  tournamentId: string;
  semiFinals: {
    homeClub: string;
    awayClub: string;
    winner?: string;
  }[];
  thirdPlaceMatch: {
    homeClub: string;
    awayClub: string;
    winner?: string;
  };
  finalMatch: {
    homeClub: string;
    awayClub: string;
    winner?: string;
  };
}

/**
 * Gera opções de torneios de pré-temporada por convite com base no prestígio do clube.
 */
export function generatePreSeasonInvitations(clubPrestige: number): PreSeasonTournament[] {
  const tournaments: PreSeasonTournament[] = [
    {
      id: 'tour-florida',
      name: 'Florida Winter Cup',
      type: 'FLORIDA_CUP',
      hostCountry: 'Estados Unidos',
      hostCity: 'Orlando',
      appearanceFee: 1_500_000,
      prizePool: 3_000_000,
      minPrestige: 70,
      participants: ['Seu Clube', 'Everton', 'Flamengo', 'River Plate'],
    },
    {
      id: 'tour-carranza',
      name: 'Troféu Ramón de Carranza',
      type: 'TROFEO_RAMON_CARRANZA',
      hostCountry: 'Espanha',
      hostCity: 'Cádiz',
      appearanceFee: 1_200_000,
      prizePool: 2_500_000,
      minPrestige: 75,
      participants: ['Seu Clube', 'Cádiz', 'Benfica', 'Lazio'],
    },
    {
      id: 'tour-asia',
      name: 'Asia Summer Tour',
      type: 'SUMMER_ASIA_TOUR',
      hostCountry: 'Japão',
      hostCity: 'Tóquio',
      appearanceFee: 2_500_000,
      prizePool: 4_000_000,
      minPrestige: 80,
      participants: ['Seu Clube', 'Yokohama Marinos', 'Bayern de Munique', 'Arsenal'],
    },
    {
      id: 'tour-regional',
      name: 'Copa dos Campeões de Verão',
      type: 'COPA_DOS_CAMPEOES_REGIONAL',
      hostCountry: 'Brasil',
      hostCity: 'Florianópolis',
      appearanceFee: 500_000,
      prizePool: 1_000_000,
      minPrestige: 40,
      participants: ['Seu Clube', 'Avaí', 'Coritiba', 'Goiás'],
    },
  ];

  return tournaments.filter((t) => clubPrestige >= t.minPrestige - 15);
}

/**
 * Cria o chaveamento quadrangular (Semifinais -> Disputa 3º lugar e Final).
 */
export function createPreSeasonBracket(tournament: PreSeasonTournament, userClubName: string): PreSeasonBracket {
  const others = tournament.participants.filter((p) => p !== 'Seu Clube');
  const actualOthers = others.length >= 3 ? others : ['Rival A', 'Rival B', 'Rival C'];

  return {
    tournamentId: tournament.id,
    semiFinals: [
      { homeClub: userClubName, awayClub: actualOthers[0] },
      { homeClub: actualOthers[1], awayClub: actualOthers[2] },
    ],
    thirdPlaceMatch: { homeClub: 'Perdedor SF1', awayClub: 'Perdedor SF2' },
    finalMatch: { homeClub: 'Vencedor SF1', awayClub: 'Vencedor SF2' },
  };
}

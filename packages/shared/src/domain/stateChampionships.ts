import { generateDoubleRoundRobinFixtures, LeagueFixture } from './league.js';

export interface StateChampionshipDefinition {
  stateCode: string;
  key: string;
  name: string;
  shortName: string;
  rounds: number;
  prizeMoneyChampion: number;
}

export const STATE_CHAMPIONSHIPS: StateChampionshipDefinition[] = [
  { stateCode: 'SP', key: 'estadual-sp', name: 'Campeonato Paulista', shortName: 'Paulistão', rounds: 12, prizeMoneyChampion: 5_000_000 },
  { stateCode: 'RJ', key: 'estadual-rj', name: 'Campeonato Carioca', shortName: 'Carioca', rounds: 11, prizeMoneyChampion: 4_000_000 },
  { stateCode: 'RS', key: 'estadual-rs', name: 'Campeonato Gaúcho', shortName: 'Gaúcho', rounds: 11, prizeMoneyChampion: 2_000_000 },
  { stateCode: 'MG', key: 'estadual-mg', name: 'Campeonato Mineiro', shortName: 'Mineiro', rounds: 11, prizeMoneyChampion: 2_500_000 },
  { stateCode: 'PR', key: 'estadual-pr', name: 'Campeonato Paranaense', shortName: 'Paranaense', rounds: 11, prizeMoneyChampion: 1_500_000 },
  { stateCode: 'SC', key: 'estadual-sc', name: 'Campeonato Catarinense', shortName: 'Catarinense', rounds: 9, prizeMoneyChampion: 1_200_000 },
  { stateCode: 'BA', key: 'estadual-ba', name: 'Campeonato Baiano', shortName: 'Baiano', rounds: 9, prizeMoneyChampion: 1_200_000 },
  { stateCode: 'PE', key: 'estadual-pe', name: 'Campeonato Pernambucano', shortName: 'Pernambucano', rounds: 9, prizeMoneyChampion: 1_000_000 },
  { stateCode: 'CE', key: 'estadual-ce', name: 'Campeonato Cearense', shortName: 'Cearense', rounds: 9, prizeMoneyChampion: 1_000_000 },
  { stateCode: 'GO', key: 'estadual-go', name: 'Campeonato Goiano', shortName: 'Goiano', rounds: 9, prizeMoneyChampion: 1_000_000 },
];

export const REGIONAL_TOURNAMENTS = {
  COPA_NORDESTE: { key: 'copa-nordeste', name: 'Copa do Nordeste', prizeMoney: 3_000_000 },
  COPA_VERDE: { key: 'copa-verde', name: 'Copa Verde', prizeMoney: 2_000_000 },
};

const NORTHEAST_STATES = new Set(['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA']);
const NORTH_CENTERWEST_STATES = new Set(['AM', 'PA', 'MT', 'MS', 'DF', 'RO', 'AC', 'AP', 'RR', 'TO']);

export function getStateChampionship(state?: string | null): StateChampionshipDefinition | undefined {
  if (!state) return undefined;
  return STATE_CHAMPIONSHIPS.find((sc) => sc.stateCode.toUpperCase() === state.toUpperCase());
}

export function getRegionalTournamentForState(state?: string | null): { key: string; name: string; prizeMoney: number } | undefined {
  if (!state) return undefined;
  const upper = state.toUpperCase();
  if (NORTHEAST_STATES.has(upper)) return REGIONAL_TOURNAMENTS.COPA_NORDESTE;
  if (NORTH_CENTERWEST_STATES.has(upper) || upper === 'ES') return REGIONAL_TOURNAMENTS.COPA_VERDE;
  return undefined;
}

export function generateStateFixtures(clubIds: string[], seed?: string | number): LeagueFixture[] {
  let ids = [...clubIds];
  if (ids.length % 2 !== 0) {
    ids.push('dummy-club');
  }
  return generateDoubleRoundRobinFixtures(ids, seed);
}

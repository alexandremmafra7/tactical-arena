import { COUNTRIES } from './country.js';

/**
 * Como as competições se chamam.
 *
 * Isto vivia dentro do `leagueService`, no servidor, cobrindo oito países. O modo offline não alcança o
 * servidor, então inventava o nome sozinho e escrevia o código do país na tela: o jogador via
 * "RODADA 1 • SÉRIE A - BRA" e "Copa Nacional (BRA)", que é a sigla de um arquivo, não o nome de um
 * campeonato. Ficando no `shared`, as duas plataformas dizem a mesma coisa.
 *
 * O que não tem nome próprio aqui cai num nome montado com o nome do país por extenso, nunca com a sigla.
 */

/** Divisão de cima e, quando existe, a de baixo. */
const LIGAS: Record<string, string[]> = {
  BRA: ['Brasileirão Série A', 'Brasileirão Série B', 'Brasileirão Série C', 'Brasileirão Série D'],
  ARG: ['Liga Profesional', 'Primera Nacional'],
  ENG: ['Premier League', 'EFL Championship'],
  ESP: ['LaLiga', 'LaLiga Hypermotion'],
  ITA: ['Serie A', 'Serie B'],
  GER: ['Bundesliga', '2. Bundesliga'],
  FRA: ['Ligue 1', 'Ligue 2'],
  POR: ['Primeira Liga', 'Liga Portugal 2'],
  NED: ['Eredivisie', 'Eerste Divisie'],
  URU: ['Primera División', 'Segunda División'],
  CHI: ['Primera División de Chile'],
  COL: ['Categoría Primera A'],
  PER: ['Liga 1'],
  ECU: ['LigaPro Serie A'],
  PAR: ['División Profesional'],
  BOL: ['División Profesional da Bolívia'],
  VEN: ['Liga FUTVE'],
  MEX: ['Liga MX'],
  USA: ['Major League Soccer'],
  CAN: ['Canadian Premier League'],
  JPN: ['J1 League'],
  KOR: ['K League 1'],
  CHN: ['Chinese Super League'],
  KSA: ['Saudi Pro League'],
  TUR: ['Süper Lig'],
  GRE: ['Super League da Grécia'],
  SCO: ['Scottish Premiership', 'Scottish Championship'],
  SUI: ['Super Liga Suíça'],
  BEL: ['Pro League'],
  AUT: ['Bundesliga Austríaca'],
  POL: ['Ekstraklasa'],
  CZE: ['Fortuna Liga'],
  RUS: ['Premier Liga Russa'],
  UKR: ['Liga Premier da Ucrânia'],
  CRO: ['HNL'],
  SRB: ['SuperLiga Sérvia'],
  ROU: ['Liga I'],
  BUL: ['Parva Liga'],
  HUN: ['NB I'],
  SVK: ['Superliga Eslovaca'],
  SVN: ['PrvaLiga'],
  DEN: ['Superliga Dinamarquesa'],
  NOR: ['Eliteserien'],
  SWE: ['Allsvenskan'],
  FIN: ['Veikkausliiga'],
  ISR: ['Ligat haAl'],
  CYP: ['Primeira Divisão do Chipre'],
  KAZ: ['Premier Liga do Cazaquistão'],
  BLR: ['Vysheyshaya Liga'],
  NZL: ['National League'],
  EGY: ['Premier League Egípcia'],
  RSA: ['Premier Division'],
};

const COPAS: Record<string, string> = {
  BRA: 'Copa do Brasil',
  ARG: 'Copa Argentina',
  ENG: 'FA Cup',
  ESP: 'Copa del Rey',
  ITA: 'Coppa Italia',
  GER: 'DFB Pokal',
  FRA: 'Coupe de France',
  POR: 'Taça de Portugal',
  NED: 'KNVB Beker',
  URU: 'Copa Uruguay',
  CHI: 'Copa Chile',
  COL: 'Copa Colombia',
  MEX: 'Copa MX',
  USA: 'US Open Cup',
  JPN: 'Copa do Imperador',
  TUR: 'Copa da Turquia',
  SCO: 'Scottish Cup',
  GRE: 'Copa da Grécia',
  BEL: 'Copa da Bélgica',
  POL: 'Copa da Polônia',
  RUS: 'Copa da Rússia',
  DEN: 'Copa da Dinamarca',
  NOR: 'Copa da Noruega',
  SWE: 'Svenska Cupen',
};

/**
 * O artigo que o nome do país pede, para "Copa do Cazaquistão" e não "Copa da Cazaquistão".
 *
 * O feminino cobre a maioria dos nomes de país em português, então ele é o padrão e só as exceções ficam
 * escritas. Sem isto o nome montado sai errado em quinze dos cinquenta e um países.
 */
const ARTIGO: Record<string, string> = {
  BRA: 'do', CHI: 'do', PAR: 'do', URU: 'do', PER: 'do', ECU: 'do', EGY: 'do', JPN: 'do',
  KAZ: 'do', CAN: 'do', MEX: 'do', CYP: 'do', KSA: 'da', USA: 'dos', NED: 'da',
  POR: 'de', ISR: 'de', SVN: 'da', SRB: 'da', ENG: 'da', SCO: 'da', GER: 'da',
};

function artigo(code: string): string {
  return ARTIGO[code] ?? 'da';
}

/** O nome do país por extenso, que é o que vai para a tela quando não há nome próprio. */
export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/**
 * O nome da liga de um país numa divisão.
 *
 * A alternativa diz "Liga da Croácia, Divisão 2" e não "Liga de CRO". Sem travessão, que a casa não usa.
 */
export function leagueName(countryCode: string, division: number): string {
  const proprio = LIGAS[countryCode]?.[division - 1];
  if (proprio) return proprio;

  const pais = `${artigo(countryCode)} ${countryName(countryCode)}`;
  return division === 1 ? `Liga ${pais}` : `Liga ${pais}, Divisão ${division}`;
}

/** O nome da copa nacional de um país. */
export function cupName(countryCode: string): string {
  return COPAS[countryCode] ?? `Copa ${artigo(countryCode)} ${countryName(countryCode)}`;
}

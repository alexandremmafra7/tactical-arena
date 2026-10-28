import { COUNTRIES, fixtureWeatherKey, weatherFor, type MatchWeather } from '@tactical-arena/shared';
import type { CalendarEntry } from '../api/client.js';

/**
 * O tempo do próximo jogo, do lado do cliente.
 *
 * A regra que faz o clima ser mecânica e não sorteio é que o técnico saiba **antes** de escalar. Por isso
 * `weatherFor` é chaveado no confronto (`fixtureWeatherKey`) e não no id da partida: a tela consegue
 * calcular hoje o mesmo tempo que o servidor vai aplicar amanhã, sem que nada precise ser guardado.
 *
 * Duas coisas têm que bater com o servidor, ou a preleção mente:
 *
 * O continente sai do país de **quem joga em casa** — é o tempo da cidade do jogo, não o do visitante. E a
 * ordem dos ids na chave é casa, depois visitante, sempre. As duas pontas chamam a mesma função para isso.
 */
export function weatherOfEntry(
  entry: CalendarEntry | null,
  myClubId: string,
  /** País do mandante. Sem ele não dá para saber o clima do lugar, e o retorno é tempo seco. */
  homeCountry: string | null | undefined,
): MatchWeather {
  if (!entry || !homeCountry) return 'DRY';
  const continent = COUNTRIES.find((c) => c.code === homeCountry)?.continent;
  if (!continent) return 'DRY';

  const [homeId, awayId] = entry.isHome ? [myClubId, entry.opponentClubId] : [entry.opponentClubId, myClubId];
  return weatherFor(entry.date, continent, fixtureWeatherKey(homeId, awayId));
}

export const WEATHER_LABEL: Record<MatchWeather, string> = {
  DRY: 'Tempo seco',
  RAIN: 'Campo pesado',
  HOT: 'Calor forte',
};

/**
 * O que o tempo cobra, em uma frase.
 *
 * Metade da regra é o técnico saber antes; a outra metade é ele entender o que aquilo significa. Um ícone
 * de chuva sozinho não informa nada que ele possa usar para decidir.
 */
export const WEATHER_NOTE: Record<MatchWeather, string> = {
  DRY: 'Gramado em ordem. Nada muda no que o time faz melhor.',
  RAIN: 'Bola pesada e passe arriscado. O jogo por dentro rende menos, o jogo pelas pontas rende mais.',
  HOT: 'Os noventa minutos custam mais caro. Quem entra em campo sai mais desgastado, e o banco pesa mais.',
};

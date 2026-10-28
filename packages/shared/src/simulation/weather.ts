import type { Continent } from '../domain/country.js';
import { createRng } from './rng.js';

/**
 * O tempo no dia do jogo.
 *
 * ## Por que existe
 *
 * `MatchWeather` estava declarado na entrada do motor desde sempre e ninguém preenchia nem lia. A tela
 * inicial escrevia "Gramado Molhado" a cada terceira rodada, texto inventado que não movia uma bola. Isto
 * aqui é o oposto: o clima só entra no jogo porque muda o preço de decisões que o técnico já toma.
 *
 * ## O que ele faz, e o que deliberadamente não faz
 *
 * Campo pesado castiga quem depende de passe e alivia quem joga direto. Não é uma penalidade fixa: entra
 * multiplicando os mesmos `ATTACK_STYLE_MODIFIERS` que o jogo já usa, então quem escolheu THROUGH_MIDDLE
 * (passing 1.25) perde mais que quem escolheu WINGS (pace 1.25), e a decisão de estilo passa a ter um dia
 * em que a resposta certa é outra. Calor não mexe em estilo nenhum: mexe em fôlego, e o desgaste é o que
 * transforma substituição planejada em decisão de verdade.
 *
 * Fora, de propósito: vento, degradação do gramado ao longo da temporada, drenagem por estádio, previsão
 * com precisão amarrada à comissão. Cada um é plausível e nenhum muda uma decisão que o jogo já não tenha.
 *
 * Pressão também ficou fora nesta primeira versão, embora chuva encarecer a pressão alta seja real: seria
 * um quinto multiplicador entrando na mesma conta que o `dampenSharedTacticalVolume` já segura com
 * dificuldade, e os dois efeitos abaixo já produzem as escolhas interessantes. Entra quando der para medir.
 *
 * ## Tamanho dos números
 *
 * Pequenos, e por escolha. O clima é para inclinar uma decisão, não para ser o assunto da partida — se um
 * dia de chuva decidisse o jogo sozinho, o jogador aprenderia que o resultado não é dele. Um efeito de 8%
 * sobre a contribuição do passe é da ordem de meia chance criada num jogo inteiro: perceptível para quem
 * escala pensando nisso, invisível para quem não olha.
 */
export type MatchWeather = 'DRY' | 'RAIN' | 'HOT';

export interface WeatherFactors {
  /**
   * Multiplica o quanto o passe contribui para o ataque. Abaixo de 1 num campo encharcado, onde a bola
   * para na poça e o toque curto vira risco.
   */
  passing: number;
  /** Multiplica o quanto a velocidade contribui. Acima de 1 na chuva: o jogo direto ganha valor relativo. */
  pace: number;
  /** Multiplica a conversão das chances. A bola molhada escapa da mão do goleiro e do pé do atacante. */
  goal: number;
  /** Multiplica o desgaste acumulado na partida. Acima de 1 no calor. */
  fatigue: number;
}

/** Tempo seco: o baseline contra o qual o motor inteiro foi calibrado. Nenhum efeito. */
export const NEUTRAL_WEATHER: WeatherFactors = { passing: 1, pace: 1, goal: 1, fatigue: 1 };

const WEATHER_FACTORS: Record<MatchWeather, WeatherFactors> = {
  DRY: NEUTRAL_WEATHER,
  /**
   * Campo pesado. O passe perde, a corrida ganha, e a finalização perde um pouco para os dois lados.
   * Fôlego intacto: chuva cansa menos que calor, e somar tudo de uma vez transformaria um dia chuvoso em
   * castigo geral em vez de uma troca.
   */
  RAIN: { passing: 0.92, pace: 1.06, goal: 0.96, fatigue: 1.0 },
  /**
   * Calor. Nada muda no que funciona em campo, tudo muda no quanto custa. O desgaste extra é cobrado por
   * `applyMoraleAndFatigue` depois do apito, e sobe também a chance de lesão pela via que já existe
   * (`injuryProbability` lê a fadiga média), sem uma linha a mais.
   */
  HOT: { passing: 1.0, pace: 1.0, goal: 1.0, fatigue: 1.18 },
};

/** Os multiplicadores de um tempo. Sem argumento, tempo seco. */
export function weatherFactors(weather: MatchWeather = 'DRY'): WeatherFactors {
  return WEATHER_FACTORS[weather] ?? NEUTRAL_WEATHER;
}

/**
 * Quanto o estilo de ataque de um time sofre com o tempo, num número só.
 *
 * `ATTACK_STYLE_MODIFIERS` já descreve cada estilo como uma mistura de passe e velocidade. Em vez de
 * inventar uma regra por estilo, o clima reprecifica os dois ingredientes e a mistura de cada um decide
 * quanto ele perde. WINGS é 1.25 de velocidade contra 0.85 de passe, então na chuva ele sai ganhando;
 * THROUGH_MIDDLE é o inverso e sai perdendo; BALANCED quase não sente. É a mesma abstração do jogo,
 * cobrando outro preço.
 */
export function weatherAttackFactor(style: { pace: number; passing: number }, factors: WeatherFactors): number {
  const total = style.pace + style.passing;
  if (total <= 0) return 1;
  return (style.pace * factors.pace + style.passing * factors.passing) / total;
}

/**
 * Que tempo faz neste jogo.
 *
 * Não é sorteio puro: a estação decide a probabilidade e o sorteio decide o dia, que é como o tempo
 * funciona. Um jogo de janeiro no Brasil tem muito mais chance de pegar chuva que um de julho, e no
 * hemisfério norte é o contrário — o mesmo mês, a estação oposta.
 *
 * É função pura de `(data, continente, chave do confronto)`. A chave é `fixtureWeatherKey`, e não o id da
 * partida, por um motivo prático: a preleção precisa anunciar o tempo **antes** de a partida existir, e um
 * id que ainda não foi gerado não serve para nada. Os dois lados montam a mesma chave a partir do que
 * ambos sabem, então o que a preleção promete é o que o jogo cumpre. Reabrir a preleção, recarregar a página ou
 * ressimular não muda o tempo, e nada disso precisa de coluna nova no banco. Depois do estrago que a
 * última coluna esquecida causou no `ensureSchema`, não precisar de migração é vantagem de verdade.
 */
export function weatherFor(isoDate: string | null | undefined, continent: Continent, fixtureKey: string): MatchWeather {
  if (!isoDate) return 'DRY';
  const month = Number(isoDate.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) return 'DRY';

  const { rain, hot } = climate(month, continent);
  const roll = createRng(`weather-${fixtureKey}-${isoDate}`)();

  if (roll < rain) return 'RAIN';
  if (roll < rain + hot) return 'HOT';
  return 'DRY';
}

/**
 * A chave de um confronto, para o tempo.
 *
 * Dois clubes não se enfrentam duas vezes no mesmo dia, então os dois ids mais a data identificam o jogo
 * sem precisar do id da partida — que só nasce quando o jogo começa, tarde demais para a preleção.
 *
 * As duas pontas têm que chamar isto, e não montar a string à mão: no dia em que uma delas inverter a
 * ordem dos ids, a preleção passa a mentir e ninguém percebe, porque continua devolvendo um tempo válido.
 */
export function fixtureWeatherKey(homeClubId: string, awayClubId: string): string {
  return `${homeClubId}-vs-${awayClubId}`;
}

/**
 * A chance de chuva e de calor num mês, por hemisfério e por faixa climática.
 *
 * Continente é a única geografia que o jogo guarda (ver `Country`), então é com ela que dá para trabalhar
 * honestamente. Duas correções que a primeira versão errava e o teste pegou:
 *
 * O hemisfério sul não é o norte com outro nome de mês, é a estação oposta — janeiro no Brasil é o mês de
 * julho da Europa. E, principalmente, **no trópico a estação chuvosa é a quente**, não a fria: chove no
 * verão brasileiro, de novembro a março, enquanto no clima temperado a chuva vem no outono e no inverno.
 * Aplicar o padrão europeu ao Brasil produzia janeiro seco e julho encharcado, o oposto do país inteiro.
 *
 * A maioria dos jogos continua em tempo seco em qualquer mês, mesmo no pico. Clima é tempero.
 */
function climate(month: number, continent: Continent): { rain: number; hot: number } {
  const sul = continent === 'SOUTH_AMERICA' || continent === 'AFRICA' || continent === 'OCEANIA';
  // Meio ano de deslocamento: o verão de um hemisfério é o inverno do outro.
  const mesNorte = sul ? ((month + 5) % 12) + 1 : month;
  const verao = mesNorte >= 6 && mesNorte <= 8;

  if (continent === 'SOUTH_AMERICA' || continent === 'AFRICA') {
    // Trópico: chuva e calor andam juntos, ambos no verão.
    return verao ? { rain: 0.26, hot: 0.18 } : { rain: 0.1, hot: 0.08 };
  }

  // Temperado: chuva no outono e inverno, calor só no auge do verão.
  const invernoChuvoso = mesNorte >= 10 || mesNorte <= 3;
  if (invernoChuvoso) return { rain: 0.26, hot: 0.02 };
  return verao ? { rain: 0.1, hot: 0.2 } : { rain: 0.14, hot: 0.04 };
}

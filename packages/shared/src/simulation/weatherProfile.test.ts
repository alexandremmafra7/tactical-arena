import { describe, it, expect } from 'vitest';
import { simulateMatch } from './engine.js';
import { generateStarterSquad } from '../domain/squadGenerator.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';
import { makeClub } from './testFactories.js';
import type { AttackStyle } from '../domain/tactic.js';
import type { MatchWeather } from './weather.js';

/**
 * O que o tempo faz com a partida, medido em vez de afirmado.
 *
 * O `weather.test.ts` prova que os multiplicadores apontam para o lado certo. Isto aqui prova a única coisa
 * que importa depois disso: que eles chegam ao placar, e chegam na dose combinada.
 *
 * As duas metades deste arquivo respondem perguntas diferentes e as duas precisam ser verdade.
 *
 * A primeira é a garantia de que nada foi quebrado. Nenhum dos 572 testes existentes passa clima, então
 * todos rodam em tempo seco — e se seco não for **exatamente** o que era antes, a calibragem inteira do
 * motor (gols por jogo, taxa de empate, chutes, conversão, escanteios, cartões) estaria se movendo sem que
 * nenhum deles avisasse. Um efeito de clima que vaza para o tempo seco é o pior desfecho possível aqui.
 *
 * A segunda é a garantia de que a mecânica existe de verdade. Um efeito pequeno demais é decoração cara: o
 * jogador nunca perceberia, e teríamos escrito um módulo para nada.
 */
describe('perfil do tempo', () => {
  function club(id: string, seed: string) {
    return { ...makeClub(id, id, 70), players: generateStarterSquad(id, 'BRA', seed, undefined) };
  }

  const home = club('home-weather', 'weather-squad');
  const away = club('away-weather', 'weather-squad');

  const N = 1200;

  /** Roda N partidas idênticas num tempo, com um estilo de ataque para os dois lados. */
  function perfil(weather: MatchWeather | undefined, attackStyle: AttackStyle) {
    const homeTactic = { ...autoFillLineup(home), clubId: home.id, attackStyle };
    const awayTactic = { ...autoFillLineup(away), clubId: away.id, attackStyle };

    let goals = 0;
    let shots = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `weather-${i}`,
        weather,
      });
      goals += r.homeGoals + r.awayGoals;
      shots += r.stats.home.shots + r.stats.away.shots;
    }
    return { goals: goals / N, shots: shots / N };
  }

  it('não move uma vírgula em tempo seco, que é onde toda a calibragem existente vive', () => {
    const semClima = perfil(undefined, 'BALANCED');
    const seco = perfil('DRY', 'BALANCED');

    // Idêntico, não parecido: mesma semente, mesmo resultado. Qualquer diferença aqui é vazamento.
    expect(seco.goals).toBe(semClima.goals);
    expect(seco.shots).toBe(semClima.shots);
  });

  it('o calor não mexe no que acontece em campo, só no que custa depois', () => {
    const seco = perfil('DRY', 'BALANCED');
    const calor = perfil('HOT', 'BALANCED');

    // O desgaste é cobrado fora do motor, em applyMoraleAndFatigue. Dentro dos 90 minutos, nada muda.
    expect(calor.goals).toBe(seco.goals);
    expect(calor.shots).toBe(seco.shots);
  });

  it('a chuva derruba o placar, e derruba pouco', () => {
    const seco = perfil('DRY', 'BALANCED');
    const chuva = perfil('RAIN', 'BALANCED');

    expect(chuva.goals).toBeLessThan(seco.goals);
    // Entre 1% e 12%: perceptível para quem escala pensando nisso, longe de decidir a partida sozinho.
    const queda = 1 - chuva.goals / seco.goals;
    expect(queda).toBeGreaterThan(0.01);
    expect(queda).toBeLessThan(0.12);
  });

  /**
   * O coração da mecânica: na chuva, a escolha de estilo passa a valer diferente. Sem isto o clima é só
   * uma penalidade geral, que é dado viciado com passos extras.
   */
  it('faz o jogo pelas pontas render melhor que o jogo por dentro, o que em tempo seco não acontece', () => {
    const secoPontas = perfil('DRY', 'WINGS');
    const secoDentro = perfil('DRY', 'THROUGH_MIDDLE');
    const chuvaPontas = perfil('RAIN', 'WINGS');
    const chuvaDentro = perfil('RAIN', 'THROUGH_MIDDLE');

    const vantagemSeca = secoPontas.goals - secoDentro.goals;
    const vantagemChuva = chuvaPontas.goals - chuvaDentro.goals;

    // A chuva move a comparação a favor das pontas, seja qual for o ponto de partida em tempo seco.
    expect(vantagemChuva).toBeGreaterThan(vantagemSeca);
  });
});

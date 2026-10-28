import { describe, expect, it } from 'vitest';
import {
  boardConfidence,
  moodFor,
  shouldSack,
  shouldWarn,
  attractsInterest,
  CONFIDENCE_START,
  GRACE_ROUNDS,
  SACK_FLOOR,
  WARNING_FLOOR,
  type BoardConfidenceInput,
} from './boardConfidence.js';
import { seasonObjective } from './clubBriefing.js';
import type { FormResult } from './clubBriefing.js';

/**
 * A confiança da diretoria, e sobretudo a paciência dela.
 *
 * O que estes testes protegem não é a aritmética — é o ritmo. Um sistema de demissão que dispara cedo demais
 * ou por motivo errado não é difícil, é injusto, e a diferença entre as duas coisas é o jogador desinstalar
 * o jogo. Por isso a maior parte daqui prova quando a diretoria **não** age.
 */
const LIGA = 20;
const RODADAS = 38;

function entrada(overrides: Partial<BoardConfidenceInput> = {}): BoardConfidenceInput {
  return {
    // Elenco mediano numa liga de 20: a diretoria pede a metade de cima.
    objective: seasonObjective(10, LIGA, 10, 19, RODADAS),
    currentPosition: 10,
    totalClubs: LIGA,
    roundsPlayed: 19,
    totalRounds: RODADAS,
    form: [],
    runwayWeeks: Number.POSITIVE_INFINITY,
    wageRatio: 0.5,
    ...overrides,
  };
}

/** Roda várias semanas seguidas, que é como a nota realmente se move no jogo. */
function semanas(quantas: number, overrides: Partial<BoardConfidenceInput> = {}): number {
  let nota = CONFIDENCE_START;
  for (let i = 0; i < quantas; i += 1) {
    nota = boardConfidence({ ...entrada(overrides), previous: nota }).score;
  }
  return nota;
}

const DERROTAS: FormResult[] = ['D', 'D', 'D', 'D', 'D'];
const VITORIAS: FormResult[] = ['V', 'V', 'V', 'V', 'V'];

describe('confiança da diretoria', () => {
  it('cobra o elenco forte e perdoa o fraco na mesma posição', () => {
    /**
     * O teste que define o sistema inteiro.
     *
     * Décimo lugar numa liga de 20 é bom para quem tem o pior elenco e é fracasso para quem tem o melhor. Se
     * a nota não distinguir os dois casos, o jogo passa a premiar quem escolheu o clube mais rico e a
     * carreira perde o sentido — o técnico do Palmeiras seria sempre melhor que o do Criciúma por definição.
     */
    const melhorElenco = boardConfidence(
      entrada({ objective: seasonObjective(1, LIGA, 10, 19, RODADAS), previous: CONFIDENCE_START }),
    );
    const piorElenco = boardConfidence(
      entrada({ objective: seasonObjective(20, LIGA, 10, 19, RODADAS), previous: CONFIDENCE_START }),
    );

    expect(melhorElenco.delta).toBeLessThan(0);
    expect(piorElenco.delta).toBeGreaterThan(0);
    expect(piorElenco.score).toBeGreaterThan(melhorElenco.score);
  });

  it('quase não se move nas primeiras rodadas', () => {
    /**
     * A defesa mais importante daqui. Uma tabela de três rodadas não diz nada, e demitir por ela é o erro
     * mais fácil de cometer neste sistema.
     */
    const cedo = boardConfidence(
      entrada({ roundsPlayed: 3, currentPosition: 20, form: DERROTAS, previous: CONFIDENCE_START }),
    );
    const tarde = boardConfidence(
      entrada({ roundsPlayed: 30, currentPosition: 20, form: DERROTAS, previous: CONFIDENCE_START }),
    );

    expect(Math.abs(cedo.delta)).toBeLessThan(Math.abs(tarde.delta));
    expect(cedo.score).toBeGreaterThan(WARNING_FLOOR);
  });

  it('nunca demite dentro da janela de paciência, por pior que esteja', () => {
    // Último lugar, cinco derrotas, clube quebrado — e ainda assim a rodada 5 não é motivo para demitir.
    let nota = CONFIDENCE_START;
    for (let rodada = 1; rodada < GRACE_ROUNDS; rodada += 1) {
      nota = boardConfidence({
        ...entrada({
          roundsPlayed: rodada,
          currentPosition: 20,
          form: DERROTAS,
          runwayWeeks: 1,
          wageRatio: 1.4,
        }),
        previous: nota,
      }).score;
    }

    expect(shouldSack(nota, 1)).toBe(false);
  });

  it('a sequência ruim pesa antes de a tabela mudar', () => {
    // Mesma posição, mesma rodada: só o que aconteceu nos últimos cinco jogos difere.
    const ganhando = boardConfidence(entrada({ form: VITORIAS, previous: CONFIDENCE_START }));
    const perdendo = boardConfidence(entrada({ form: DERROTAS, previous: CONFIDENCE_START }));

    expect(ganhando.delta).toBeGreaterThan(perdendo.delta);
    expect(perdendo.reason).toContain('sequência');
  });

  it('o jogo mais recente pesa mais que o mais antigo', () => {
    const melhorando = boardConfidence(entrada({ form: ['V', 'V', 'D', 'D', 'D'], previous: CONFIDENCE_START }));
    const piorando = boardConfidence(entrada({ form: ['D', 'D', 'V', 'V', 'V'], previous: CONFIDENCE_START }));

    expect(melhorando.delta).toBeGreaterThan(piorando.delta);
  });

  it('caixa no fim derruba mesmo com o time indo bem', () => {
    const solvente = boardConfidence(entrada({ currentPosition: 2, form: VITORIAS, previous: CONFIDENCE_START }));
    const quebrado = boardConfidence(
      entrada({ currentPosition: 2, form: VITORIAS, runwayWeeks: 2, wageRatio: 1.3, previous: CONFIDENCE_START }),
    );

    expect(quebrado.delta).toBeLessThan(solvente.delta);
    expect(quebrado.reason).toContain('financeira');
  });

  it('a copa compra tempo e a eliminação vexatória custa', () => {
    const campanha = boardConfidence(entrada({ cupRoundsWon: 3, previous: CONFIDENCE_START }));
    const vexame = boardConfidence(entrada({ cupUpsetLoss: true, previous: CONFIDENCE_START }));

    expect(campanha.delta).toBeGreaterThan(vexame.delta);
    expect(vexame.reason).toContain('copa');
  });

  it('trata ligas de tamanhos diferentes da mesma forma', () => {
    /**
     * Cinco posições abaixo do pedido tem que doer o mesmo numa liga de 8 e numa de 20. Sem normalizar pelo
     * tamanho, dirigir numa liga pequena seria muito mais perigoso, sem nenhuma razão de futebol.
     */
    // Os postos de elenco escolhidos caem na mesma faixa de objetivo nas duas ligas (5/8 e 12/20 dão ambos
    // "metade de cima"), senão o teste compararia exigências diferentes e não tamanhos de liga.
    const pequena = boardConfidence({
      ...entrada({ objective: seasonObjective(5, 8, 8, 10, 14), currentPosition: 8, totalClubs: 8, roundsPlayed: 10, totalRounds: 14 }),
      previous: CONFIDENCE_START,
    });
    const grande = boardConfidence({
      ...entrada({ objective: seasonObjective(12, 20, 20, 27, 38), currentPosition: 20, totalClubs: 20, roundsPlayed: 27, totalRounds: 38 }),
      previous: CONFIDENCE_START,
    });

    expect(Math.abs(pequena.delta - grande.delta)).toBeLessThan(4);
  });

  it('anda aos poucos, para a corda apertar em vez de estourar', () => {
    /**
     * Nenhuma semana isolada pode mover a nota de tranquilo a demissível. É isso que faz o aviso do
     * presidente ser um aviso, e não um susto.
     */
    const pior = boardConfidence(
      entrada({ currentPosition: 20, form: DERROTAS, runwayWeeks: 0, wageRatio: 2, cupUpsetLoss: true, roundsPlayed: 37, previous: CONFIDENCE_START }),
    );

    expect(Math.abs(pior.delta)).toBeLessThan(CONFIDENCE_START - SACK_FLOOR);
  });

  it('a nota nunca sai do intervalo, por mais semanas que passem', () => {
    const afundando = semanas(60, { currentPosition: 20, form: DERROTAS, runwayWeeks: 0, wageRatio: 2 });
    const voando = semanas(60, { currentPosition: 1, form: VITORIAS, cupRoundsWon: 5 });

    expect(afundando).toBeGreaterThanOrEqual(0);
    expect(voando).toBeLessThanOrEqual(100);
  });

  it('uma temporada ruim inteira acaba em demissão', () => {
    // O contrapeso de toda a paciência acima: quem afunda a temporada toda tem que ser demitido, senão a
    // nota é decoração.
    const nota = semanas(20, { currentPosition: 19, form: DERROTAS, roundsPlayed: 30 });
    expect(shouldWarn(nota, 0) || shouldSack(nota, 1)).toBe(true);
  });

  it('uma temporada boa atrai outros clubes', () => {
    const nota = semanas(20, { currentPosition: 1, form: VITORIAS, cupRoundsWon: 2 });
    expect(attractsInterest(nota)).toBe(true);
  });
});

describe('as decisões que a nota autoriza', () => {
  it('não demite sem ter avisado', () => {
    /**
     * A regra que separa consequência de sorteio. Sem aviso, o jogador é demitido por um número que nunca
     * viu; com aviso, foi ele quem não reagiu.
     */
    expect(shouldSack(0, 0)).toBe(false);
    expect(shouldSack(0, 1)).toBe(true);
  });

  it('avisa uma vez só', () => {
    // Um ultimato repetido toda semana deixa de ser ultimato e vira o pop-up que o jogador fecha sem ler.
    expect(shouldWarn(WARNING_FLOOR - 1, 0)).toBe(true);
    expect(shouldWarn(WARNING_FLOOR - 1, 1)).toBe(false);
  });

  it('não avisa quem está acima do piso', () => {
    expect(shouldWarn(WARNING_FLOOR, 0)).toBe(false);
  });

  it('dá a cada faixa um nome que o técnico entende', () => {
    for (const nota of [0, 20, 40, 60, 80, 95]) {
      const { label } = moodFor(nota);
      expect(label.trim().length).toBeGreaterThan(3);
    }
    expect(moodFor(95).mood).toBe('idolo');
    expect(moodFor(10).mood).toBe('insustentavel');
  });
});

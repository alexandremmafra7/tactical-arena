import { describe, expect, it } from 'vitest';
import {
  boardConfidence,
  attractsInterest,
  CONFIDENCE_START,
  SACK_FLOOR,
  WARNING_FLOOR,
} from './boardConfidence.js';
import { seasonObjective, type FormResult } from './clubBriefing.js';

/**
 * A temporada inteira, rodada a rodada.
 *
 * Os testes unitários da nota olham uma semana de cada vez, e por isso deixaram passar os dois piores
 * defeitos que este módulo teve. Só correndo 38 rodadas apareceu que a nota não tinha âncora: quem cumpria o
 * objetivo exatamente via a confiança escorrer de 60 para 45 sem nada acontecer, e o pior elenco do
 * campeonato, salvo do rebaixamento, chegava ao piso de demissão na rodada 28. Foi também aqui que se viu o
 * campeão com o melhor elenco terminar em 72, abaixo de quem chegou em terceiro com elenco mediano.
 *
 * Nenhum desses três é um erro de conta. São erros de comportamento ao longo do tempo, e não existe forma de
 * os ver sem simular o tempo.
 */
const LIGA = 20;
const RODADAS = 38;

interface Temporada {
  /** Nota ao fim da temporada. */
  final: number;
  /** Rodada em que a nota cruzou o piso de aviso, ou null. */
  avisoNa: number | null;
  /** Rodada em que cruzou o piso de demissão, ou null. */
  demissaoNa: number | null;
}

function correrTemporada(options: {
  squadRank: number;
  position: number;
  form: FormResult[];
  runwayWeeks?: number;
  wageRatio?: number;
  cupRoundsWon?: number;
}): Temporada {
  let nota = CONFIDENCE_START;
  let avisoNa: number | null = null;
  let demissaoNa: number | null = null;

  for (let rodada = 1; rodada <= RODADAS; rodada += 1) {
    nota = boardConfidence({
      previous: nota,
      objective: seasonObjective(options.squadRank, LIGA, options.position, rodada, RODADAS),
      currentPosition: options.position,
      totalClubs: LIGA,
      roundsPlayed: rodada,
      totalRounds: RODADAS,
      form: options.form,
      runwayWeeks: options.runwayWeeks ?? Number.POSITIVE_INFINITY,
      wageRatio: options.wageRatio ?? 0.5,
      cupRoundsWon: options.cupRoundsWon,
    }).score;

    if (avisoNa === null && nota < WARNING_FLOOR) avisoNa = rodada;
    if (demissaoNa === null && nota < SACK_FLOOR) demissaoNa = rodada;
  }

  return { final: nota, avisoNa, demissaoNa };
}

const IRREGULAR: FormResult[] = ['D', 'V', 'D', 'E', 'V'];
const DESASTRE: FormResult[] = ['D', 'D', 'D', 'D', 'D'];
const EMBALADO: FormResult[] = ['V', 'V', 'V', 'E', 'V'];

describe('a nota ao longo de uma temporada', () => {
  it('fica parada em quem cumpre exatamente o que foi pedido', () => {
    /**
     * O teste que a primeira versão do módulo reprovava. Cumprir o objetivo tem que ser um estado estável,
     * senão a nota é um passeio aleatório e todo técnico acaba em 0 ou em 100 por acúmulo, não por mérito.
     */
    const noAlvo = correrTemporada({ squadRank: 10, position: 10, form: IRREGULAR });

    expect(noAlvo.avisoNa).toBeNull();
    expect(noAlvo.demissaoNa).toBeNull();
    expect(noAlvo.final).toBeGreaterThan(CONFIDENCE_START - 5);
  });

  it('não demite quem salva um elenco ruim do rebaixamento', () => {
    // O pior elenco da liga em 16º de 20 fez o que lhe cabia. Uma temporada inteira disso não pode terminar
    // em demissão — e terminava, na rodada 28.
    const salvo = correrTemporada({ squadRank: 20, position: 16, form: ['D', 'E', 'D', 'V', 'E'] });

    expect(salvo.demissaoNa).toBeNull();
    expect(salvo.final).toBeGreaterThan(WARNING_FLOOR);
  });

  it('demite quem afunda o melhor elenco da liga no meio da tabela', () => {
    const desperdicio = correrTemporada({ squadRank: 1, position: 10, form: IRREGULAR });

    expect(desperdicio.avisoNa).not.toBeNull();
    expect(desperdicio.demissaoNa).not.toBeNull();
  });

  it('dá pelo menos um mês e meio antes de chegar ao piso de demissão', () => {
    /**
     * O pior caso possível: elenco mediano em último lugar perdendo tudo. Mesmo assim a diretoria leva
     * rodadas para chegar lá, e o aviso vem antes. Se este número encolher para meia dúzia de rodadas, a
     * demissão deixa de ser história e vira armadilha.
     */
    const fundo = correrTemporada({ squadRank: 10, position: 20, form: DESASTRE });

    expect(fundo.avisoNa).toBeGreaterThanOrEqual(GRACE_MINIMO);
    expect(fundo.demissaoNa!).toBeGreaterThan(fundo.avisoNa!);
  });

  it('faz do campeão um ídolo, mesmo quando vencer era a obrigação', () => {
    /**
     * Quando a diretoria pede o título, a folga sobre o pedido nunca passa de zero, e o campeão do melhor
     * elenco terminava em 72 — abaixo de quem chegou em terceiro com elenco mediano. Ganhar tudo o que havia
     * para ganhar não pode valer menos do que superar uma expectativa modesta.
     */
    const campeao = correrTemporada({ squadRank: 1, position: 1, form: EMBALADO });
    const terceiro = correrTemporada({ squadRank: 10, position: 3, form: EMBALADO });

    expect(campeao.final).toBeGreaterThan(80);
    expect(Math.abs(campeao.final - terceiro.final)).toBeLessThan(12);
  });

  it('transforma quem supera muito o pedido em alvo de outros clubes', () => {
    const superacao = correrTemporada({ squadRank: 20, position: 10, form: IRREGULAR });
    expect(attractsInterest(superacao.final) || superacao.final > 75).toBe(true);
  });

  it('coloca sob observação quem cumpre em campo e quebra o clube', () => {
    // Entregar a tabela pedida não compra licença para deixar o caixa no fim, mas também não demite sozinho.
    const quebrado = correrTemporada({ squadRank: 10, position: 10, form: EMBALADO, runwayWeeks: 2, wageRatio: 1.3 });
    const solvente = correrTemporada({ squadRank: 10, position: 10, form: EMBALADO });

    expect(quebrado.final).toBeLessThan(solvente.final - 20);
    expect(quebrado.demissaoNa).toBeNull();
  });
});

/** A rodada mais cedo em que se aceita um aviso. Antes disto a tabela ainda não diz nada. */
const GRACE_MINIMO = 6;

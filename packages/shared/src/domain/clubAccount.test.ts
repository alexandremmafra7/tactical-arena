import { describe, expect, it } from 'vitest';
import { buildAccountStatement, runwayWeeks, wageRatio } from './clubAccount.js';
import { makeClub, makePlayer } from '../simulation/testFactories.js';

/**
 * O extrato de uma conta corrente, montado do estado do clube.
 *
 * O jogo não guarda lançamento nenhum: não há tabela de movimentação e portanto não há passado. O que este
 * módulo faz é refazer, em forma de extrato, a mesma conta que o `weeklyTickService` executa toda semana,
 * para o técnico ver a soma antes de ela acontecer em vez de descobrir o saldo depois.
 *
 * O risco de escrever a conta duas vezes é ela divergir, e este projeto já teve isso três vezes: nome de
 * liga, divisão de campeonato e partida ao vivo. Por isso a conta mora no shared, e por isso estes testes
 * cravam as somas.
 */
/**
 * Um clube como o jogo o cria, não como a fábrica de testes o deixa.
 *
 * `makeClub` não dá patrocínio nenhum, e no jogo todo clube nasce com o quadro que `buildSponsorBoard`
 * monta. Sem isso o extrato saía sem a linha de patrocínio, que é justamente a maior delas.
 */
function clube(overrides: Record<string, unknown> = {}) {
  return {
    ...makeClub('conta', 'Conta FC', 70),
    budget: 10_000_000,
    stadiumCapacity: 30_000,
    membersCount: 30_000,
    sponsorships: [
      { id: 's1', type: 'MASTER', sponsorName: 'Marca', weeklyAmount: 80_000, weeksRemaining: 40 },
      { id: 's2', type: 'KIT_SUPPLIER', sponsorName: 'Outra', weeklyAmount: 40_000, weeksRemaining: 40 },
    ],
    ...overrides,
  } as never;
}

/** Um clube que gasta mais do que arrecada, para os indicadores terem o que apontar. */
function clubeNoVermelho(overrides: Record<string, unknown> = {}) {
  return clube({
    players: Array.from({ length: 30 }, (_, i) => makePlayer(`caro${i}`, { overall: 90 })),
    ...overrides,
  });
}

describe('extrato da conta corrente', () => {
  it('separa o que entra do que sai, e fecha a soma', () => {
    const extrato = buildAccountStatement(clube());

    expect(extrato.totalIncome).toBe(extrato.income.reduce((s, l) => s + l.amount, 0));
    expect(extrato.totalExpenses).toBe(extrato.expenses.reduce((s, l) => s + l.amount, 0));
    expect(extrato.net).toBe(extrato.totalIncome - extrato.totalExpenses);

    // As três fontes de receita que o clube tem, e nenhuma inventada.
    expect(extrato.income.map((l) => l.key).sort()).toEqual(['gate', 'members', 'sponsors']);
  });

  it('não lista linha zerada', () => {
    // Um clube sem empréstimo não deve ver "Empréstimos: R$ 0"; a linha some em vez de ocupar espaço.
    const semDivida = buildAccountStatement(clube({ loans: [], pendingTransferPayments: [] }));
    expect(semDivida.expenses.some((l) => l.key === 'loans')).toBe(false);
    expect(semDivida.expenses.every((l) => l.amount > 0)).toBe(true);
  });

  it('conta o fôlego em semanas, e não promete prazo a quem tem lucro', () => {
    expect(runwayWeeks(1_000, -100)).toBe(10);
    expect(runwayWeeks(1_000, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(runwayWeeks(1_000, 500)).toBe(Number.POSITIVE_INFINITY);

    // Caixa negativo com prejuízo é zero semanas, não um número negativo de semanas.
    expect(runwayWeeks(-500, -100)).toBe(0);
  });

  it('mede a folha contra a receita, que é o indicador que decide a saúde', () => {
    expect(wageRatio(60, 100)).toBe(0.6);
    expect(wageRatio(0, 0)).toBe(0);

    // Sem receita e com folha, o clube está com cem por cento comprometido, não com divisão por zero.
    expect(wageRatio(50, 0)).toBe(1);
  });

  it('alerta quando o caixa está curto e sossega quando não está', () => {
    const rico = buildAccountStatement(clube({ budget: 500_000_000 }));
    const quebrado = buildAccountStatement(clubeNoVermelho({ budget: 1_000 }));

    // O cenário só prova alguma coisa se um dos dois estiver mesmo perdendo dinheiro.
    expect(quebrado.net).toBeLessThan(0);

    const folego = (e: ReturnType<typeof buildAccountStatement>) => e.indicators.find((i) => i.key === 'runway')!;
    expect(folego(rico).level).toBe('good');
    expect(folego(quebrado).level).toBe('bad');

    /**
     * O texto precisa dizer o que o número significa. "12 semanas" sozinho não avisa ninguém; é o mesmo
     * defeito da meta que anunciava "0% Concluído" e do sócio que exibia receita que não entrava.
     */
    expect(folego(quebrado).hint.length).toBeGreaterThan(10);
  });

  it('projeta o saldo semana a semana a partir de hoje', () => {
    const extrato = buildAccountStatement(clube());

    expect(extrato.projection[0]).toBe(extrato.cash);
    expect(extrato.projection[1]).toBe(extrato.cash + extrato.net);
    expect(extrato.projection).toHaveLength(21);

    // A projeção é reta de propósito: responde "se nada mudar", que é a pergunta antes de assinar salário.
    const passo = extrato.projection[5] - extrato.projection[4];
    expect(extrato.projection[10] - extrato.projection[9]).toBe(passo);
  });

  it('cobra caro de quem tem elenco caro', () => {
    const barato = buildAccountStatement(clube({ players: [makePlayer('a', { overall: 60 })] }));
    const caro = buildAccountStatement(clube({
      players: Array.from({ length: 25 }, (_, i) => makePlayer(`p${i}`, { overall: 88 })),
    }));

    const folha = (e: ReturnType<typeof buildAccountStatement>) =>
      e.expenses.find((l) => l.key === 'squad')?.amount ?? 0;
    expect(folha(caro)).toBeGreaterThan(folha(barato));
    expect(caro.net).toBeLessThan(barato.net);
  });

  it('dá um rótulo e uma explicação a cada linha', () => {
    const extrato = buildAccountStatement(clube());
    for (const linha of [...extrato.income, ...extrato.expenses]) {
      expect(linha.label.trim().length, linha.key).toBeGreaterThan(2);
      expect(linha.hint.trim().length, linha.key).toBeGreaterThan(10);
    }
    // E os indicadores também, senão viram número sem sentido na tela.
    for (const ind of extrato.indicators) {
      expect(ind.value.trim().length, ind.key).toBeGreaterThan(0);
      expect(['good', 'warning', 'bad']).toContain(ind.level);
    }
  });
});

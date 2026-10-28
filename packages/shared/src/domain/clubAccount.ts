import type { Club } from './club.js';
import {
  calculateMaintenanceCost,
  calculateStadiumRevenue,
  calculateWageBill,
} from './finance.js';
import { calculateInitialMembers, calculateMembershipWeeklyRevenue } from './clubMembership.js';

/**
 * O extrato semanal de um clube: de onde o dinheiro vem, para onde vai, e quanto tempo ele dura.
 *
 * Não é um histórico. O jogo não guarda lançamento nenhum, não existe tabela de movimentação, então não há
 * passado a mostrar: o que existe é o estado do clube agora, e desse estado sai exatamente a mesma conta que
 * o `weeklyTickService` faz toda semana. Este módulo refaz essa conta em forma de extrato, para o técnico
 * poder ver a soma antes de ela acontecer, em vez de descobrir o saldo depois.
 *
 * Ficou no `shared` de propósito. A tela precisa dela para desenhar, e um dia o servidor vai precisar dela
 * para gravar histórico de verdade; a alternativa era escrever a conta duas vezes e deixá-las divergir, que
 * é o defeito que este projeto já teve com nome de liga, divisão e partida ao vivo.
 */

export interface AccountLine {
  key: string;
  label: string;
  amount: number;
  /** O que explica a linha para quem nunca abriu esta tela. */
  hint: string;
}

export type HealthLevel = 'good' | 'warning' | 'bad';

export interface HealthIndicator {
  key: string;
  label: string;
  value: string;
  level: HealthLevel;
  hint: string;
}

export interface AccountStatement {
  cash: number;
  income: AccountLine[];
  expenses: AccountLine[];
  totalIncome: number;
  totalExpenses: number;
  /** Positivo é lucro semanal, negativo é prejuízo. */
  net: number;
  /** Semanas de caixa no ritmo atual. `Infinity` quando o clube não perde dinheiro. */
  runwayWeeks: number;
  indicators: HealthIndicator[];
  /** Saldo projetado semana a semana, para o gráfico. O índice 0 é hoje. */
  projection: number[];
}

/** Quantas semanas o caixa aguenta no ritmo atual. Sem prejuízo, aguenta para sempre. */
export function runwayWeeks(cash: number, net: number): number {
  if (net >= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor(cash / -net));
}

/**
 * Quanto da receita vai embora em salário.
 *
 * É o indicador que decide a saúde de um clube de futebol de verdade, e o que o jogador precisa ver antes de
 * assinar mais um contrato. Acima de 70% qualquer temporada ruim vira crise.
 */
export function wageRatio(wageBill: number, totalIncome: number): number {
  if (totalIncome <= 0) return wageBill > 0 ? 1 : 0;
  return wageBill / totalIncome;
}

function nivelDoFolego(semanas: number): HealthLevel {
  if (semanas === Number.POSITIVE_INFINITY || semanas >= 26) return 'good';
  return semanas >= 8 ? 'warning' : 'bad';
}

function nivelDaFolha(razao: number): HealthLevel {
  if (razao <= 0.6) return 'good';
  return razao <= 0.8 ? 'warning' : 'bad';
}

/** Semanas mostradas no gráfico de projeção: meia temporada, o bastante para ver a curva virar. */
const PROJECTION_WEEKS = 20;

export function buildAccountStatement(club: Club): AccountStatement {
  const stadiumRevenue = calculateStadiumRevenue(club.stadiumCapacity);
  const sponsorship = (club.sponsorships ?? []).reduce((sum, s) => sum + s.weeklyAmount, 0);
  const members = club.membersCount ?? calculateInitialMembers(club, 1);
  const membership = calculateMembershipWeeklyRevenue(members);

  const squadWages = calculateWageBill(club.players ?? []);
  const academyWages = calculateWageBill(club.academyPlayers ?? []);
  const staffWages = (club.staff ?? []).reduce((sum, s) => sum + s.wage, 0);
  const wageBill = squadWages + academyWages + staffWages;

  const maintenance = calculateMaintenanceCost(stadiumRevenue, wageBill);
  const loans = (club.loans ?? []).reduce((sum, l) => sum + l.weeklyPayment, 0);
  const instalments = (club.pendingTransferPayments ?? []).reduce((sum, p) => sum + p.weeklyAmount, 0);

  const income: AccountLine[] = [
    { key: 'gate', label: 'Bilheteria', amount: stadiumRevenue, hint: 'Público pagante no seu estádio' },
    { key: 'sponsors', label: 'Patrocínios', amount: sponsorship, hint: 'Contratos ativos, somados por semana' },
    { key: 'members', label: 'Sócio torcedor', amount: membership, hint: `${members.toLocaleString('pt-BR')} sócios pagando mensalidade` },
  ].filter((l) => l.amount > 0);

  const expenses: AccountLine[] = [
    { key: 'squad', label: 'Salários do elenco', amount: squadWages, hint: 'Folha dos jogadores profissionais' },
    { key: 'academy', label: 'Base', amount: academyWages, hint: 'Folha das categorias de base' },
    { key: 'staff', label: 'Comissão técnica', amount: staffWages, hint: 'Salários da comissão contratada' },
    { key: 'maintenance', label: 'Manutenção', amount: maintenance, hint: 'Custo de manter estádio e estrutura' },
    { key: 'loans', label: 'Empréstimos', amount: loans, hint: 'Parcelas semanais dos bancos' },
    { key: 'instalments', label: 'Parcelas de contratação', amount: instalments, hint: 'Transferências compradas a prazo' },
  ].filter((l) => l.amount > 0);

  const totalIncome = income.reduce((sum, l) => sum + l.amount, 0);
  const totalExpenses = expenses.reduce((sum, l) => sum + l.amount, 0);
  const net = totalIncome - totalExpenses;
  const folego = runwayWeeks(club.budget, net);
  const razaoFolha = wageRatio(wageBill, totalIncome);

  /**
   * O resultado da semana não está aqui de propósito: a tela já o mostra em cima, grande, ao lado do caixa.
   * Estes quatro respondem o que o número sozinho não responde, que é quanto tempo ele dura e por quê.
   */
  const indicators: HealthIndicator[] = [
    {
      key: 'runway',
      label: 'Fôlego de caixa',
      value: folego === Number.POSITIVE_INFINITY ? 'Sem prazo' : `${folego} semanas`,
      level: nivelDoFolego(folego),
      hint:
        folego === Number.POSITIVE_INFINITY
          ? 'No ritmo atual o caixa não acaba'
          : 'Semanas até o caixa zerar, se nada mudar',
    },
    {
      key: 'wages',
      label: 'Folha sobre receita',
      value: `${Math.round(razaoFolha * 100)}%`,
      level: nivelDaFolha(razaoFolha),
      hint: 'Quanto do que entra já está comprometido com salário',
    },
    {
      key: 'debt',
      label: 'Dívida semanal',
      value: `R$ ${(loans + instalments).toLocaleString('pt-BR')}`,
      level: loans + instalments === 0 ? 'good' : (loans + instalments) / Math.max(1, totalIncome) > 0.25 ? 'bad' : 'warning',
      hint: 'Empréstimos e parcelas de contratação, por semana',
    },
  ];

  /**
   * A projeção repete o resultado da semana atual, e é honesta sobre isso.
   *
   * Não tenta prever contrato que vence nem obra que termina: é a resposta a "se nada mudar, onde eu estou
   * daqui a vinte semanas", que é exatamente a pergunta que o técnico faz antes de assinar mais um salário.
   */
  const projection = Array.from({ length: PROJECTION_WEEKS + 1 }, (_, semana) => club.budget + net * semana);

  return {
    cash: club.budget,
    income,
    expenses,
    totalIncome,
    totalExpenses,
    net,
    runwayWeeks: folego,
    indicators,
    projection,
  };
}

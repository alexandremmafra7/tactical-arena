import { describe, expect, it } from 'vitest';
import {
  buildMeetingQueue,
  deferMeeting,
  weeklyBudgetSpent,
  MEETINGS_PER_WEEK,
  BOARD_MUTE_WEEKS,
  DEFER_SEASON_WEEKS,
  type MeetingContext,
} from './staffMeetings.js';
import type { StaffMember, StaffRole } from './staff.js';
import { makeClub, makePlayer } from '../simulation/testFactories.js';

/**
 * A sala de reuniões, e sobretudo o silêncio dela.
 *
 * O pedido foi "pop-ups que não sejam chatos", e a parte que decide isso não é o cartão, é o ritmo: quando
 * falar, quanto esperar, quando desistir. Um sistema de avisos morre por excesso, e quando morre o jogador
 * aprende a fechar sem ler — a partir daí nem o aviso que importava chega.
 *
 * Por isso a maior parte destes testes prova que o jogo fica calado, e não que ele fala.
 */
function pessoa(role: StaffRole, name = 'Marco Aurélio'): StaffMember {
  return {
    id: role, name, role, tier: 'OURO', rating: 85, specialty: '', description: '',
    wage: 10_000, minClubVisibility: 0, minCareerTitles: 0, avatar: '👔', nationality: 'BRA',
  };
}

const VESPERA: MeetingContext = { hasLineup: false, daysToNextMatch: 1, currentWeek: 10 };

function clube(overrides: Record<string, unknown> = {}) {
  return { ...makeClub('reuniao', 'Reunião FC', 70), staff: [], ...overrides } as never;
}

describe('pedidos de reunião', () => {
  it('nunca entrega mais de um pedido de cada vez', () => {
    /**
     * A regra que sozinha separa este sistema dos que irritam. Um clube pode ter tudo pendente ao mesmo
     * tempo, e ainda assim o jogador vê um cartão, não uma fila deles.
     */
    const tudoErrado = clube({
      players: [makePlayer('ml', { name: 'Machucado', injuryWeeks: 3 })],
      sponsorships: [],
    });
    const fila = buildMeetingQueue(tudoErrado, { ...VESPERA, bestSponsorUpgrade: 90_000, academyReady: 2 });

    expect(fila).toHaveLength(1);
  });

  it('manda o assunto mais caro primeiro', () => {
    // Escalação em falta na véspera custa a partida. Patrocínio parado custa dinheiro que espera mais um dia.
    const fila = buildMeetingQueue(clube({ sponsorships: [] }), { ...VESPERA, bestSponsorUpgrade: 90_000 });
    expect(fila[0].topic).toBe('lineup');
  });

  it('não interrompe por escalação faltando com uma semana pela frente', () => {
    /**
     * O ponto mais fácil de errar. "Sem escalação" é verdade o tempo todo depois de uma partida, e virar
     * reunião por isso seria um pop-up por dia. Só a véspera justifica.
     */
    const longe = buildMeetingQueue(clube(), { ...VESPERA, daysToNextMatch: 6 });
    expect(longe.some((p) => p.topic === 'lineup')).toBe(false);
  });

  it('não interrompe por vaga de patrocínio sem proposta que valha', () => {
    // Vaga aberta é estado, e estado é trabalho do aviso discreto. Reunião pede uma decisão concreta.
    const semProposta = buildMeetingQueue(clube({ sponsorships: [] }), {
      hasLineup: true, daysToNextMatch: 5, currentWeek: 10,
    });
    expect(semProposta).toHaveLength(0);
  });

  it('fica calado quando não há nada a decidir', () => {
    // Nunca um cartão para dizer que está tudo bem. Isso é o que ensina o jogador a fechar sem ler.
    const emOrdem = buildMeetingQueue(clube({ sponsorships: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }] }), {
      hasLineup: true, daysToNextMatch: 5, currentWeek: 10,
    });
    expect(emOrdem).toHaveLength(0);
  });

  it('respeita o "agora não" pelas quatro semanas seguintes', () => {
    const contexto = { ...VESPERA, hasLineup: true, daysToNextMatch: 5, bestSponsorUpgrade: 90_000 };
    const clubeComVaga = clube({ sponsorships: [] });

    const adiado = deferMeeting('sponsors', 10);
    expect(buildMeetingQueue(clubeComVaga, { ...contexto, currentWeek: 12 }, adiado)).toHaveLength(0);
    expect(buildMeetingQueue(clubeComVaga, { ...contexto, currentWeek: 13 }, adiado)).toHaveLength(0);

    // E volta quando o prazo passa, porque o assunto continua existindo.
    expect(buildMeetingQueue(clubeComVaga, { ...contexto, currentWeek: 14 }, adiado)).toHaveLength(1);
  });

  it('trata o segundo "agora não" como resposta, e cala a temporada', () => {
    /**
     * Quem recusa duas vezes o mesmo assunto não quer ser lembrado dele. Insistir depois disso é a definição
     * do que o usuário pediu para evitar.
     */
    const primeira = deferMeeting('academy', 10);
    const segunda = deferMeeting('academy', 14, primeira);

    expect(segunda[0].times).toBe(2);
    expect(segunda[0].mutedUntilWeek - 14).toBeGreaterThanOrEqual(40);

    const contexto = { hasLineup: true, daysToNextMatch: 5, currentWeek: 30, academyReady: 3 };
    expect(buildMeetingQueue(clube(), contexto, segunda)).toHaveLength(0);
  });

  it('conta o teto semanal, para o jogo calar mesmo tendo assunto', () => {
    expect(weeklyBudgetSpent(MEETINGS_PER_WEEK - 1)).toBe(false);
    expect(weeklyBudgetSpent(MEETINGS_PER_WEEK)).toBe(true);
  });
});

describe('quem assina o pedido', () => {
  it('põe o profissional da área a falar em primeira pessoa', () => {
    const comDiretor = clube({ staff: [pessoa('FINANCIAL_DIRECTOR', 'Marco Aurélio')], sponsorships: [] });
    const pedido = buildMeetingQueue(comDiretor, {
      hasLineup: true, daysToNextMatch: 5, currentWeek: 10, bestSponsorUpgrade: 124_000,
    })[0];

    expect(pedido.speakerName).toBe('Marco Aurélio');
    expect(pedido.role).toBe('FINANCIAL_DIRECTOR');
    expect(pedido.message).toContain('124.000');
    expect(pedido.actionPath).toBe('sponsors');
  });

  it('faz da ausência a própria mensagem quando o cargo está vago', () => {
    /**
     * Era tentador simplesmente não falar quando não há ninguém no posto, e seria o pior dos dois mundos: o
     * técnico que não contratou coordenador de base é exatamente quem precisa ouvir que ninguém está
     * olhando a base.
     */
    const semNinguem = buildMeetingQueue(clube(), {
      hasLineup: true, daysToNextMatch: 5, currentWeek: 10, academyReady: 2,
    })[0];

    expect(semNinguem.role).toBeNull();
    expect(semNinguem.speakerName).toBe('Diretoria');
    expect(semNinguem.speakerTitle).toContain('vago');
    expect(semNinguem.message).toMatch(/nenhum|ninguém/i);
  });

  it('o diretor de futebol avisa quando há contrato a vencer', () => {
    const pedido = buildMeetingQueue(clube({ staff: [pessoa('FOOTBALL_DIRECTOR', 'Zé Diretor')] }), {
      hasLineup: true, daysToNextMatch: 5, currentWeek: 10, expiringContracts: 3,
    })[0];

    expect(pedido.topic).toBe('contracts');
    expect(pedido.speakerName).toBe('Zé Diretor');
    expect(pedido.actionPath).toBe('contracts');
    expect(pedido.message).toContain('3');
  });

  it('não fala de contrato quando não há nenhum a vencer', () => {
    // O assunto mais fácil de transformar em ruído: contrato existe sempre, vencimento não.
    const fila = buildMeetingQueue(clube({ staff: [pessoa('FOOTBALL_DIRECTOR')] }), {
      hasLineup: true, daysToNextMatch: 5, currentWeek: 10, expiringContracts: 0,
    });

    expect(fila).toHaveLength(0);
  });

  it('escalação na véspera ainda vem antes de contrato a vencer', () => {
    // Contrato custa dinheiro no fim da temporada; escalação em falta custa a partida de amanhã.
    const fila = buildMeetingQueue(clube(), { ...VESPERA, expiringContracts: 5 });
    expect(fila[0].topic).toBe('lineup');
  });

  it('põe o presidente à frente de tudo, porque só ele pode acabar com o emprego', () => {
    // Escalação em falta custa a partida de amanhã; o presidente custa a carreira no clube.
    const fila = buildMeetingQueue(clube(), { ...VESPERA, boardWarning: true, boardConcern: 'a distância para o objetivo da temporada' });

    expect(fila[0].topic).toBe('board');
    expect(fila[0].speakerName).toBe('Presidente');
    expect(fila[0].role).toBeNull();
    expect(fila[0].message).toContain('a distância para o objetivo da temporada');
  });

  it('não chama o presidente enquanto a diretoria não decidiu avisar', () => {
    // A decisão de avisar é do servidor, no tick semanal. A tela não a reinventa a partir da nota.
    const fila = buildMeetingQueue(clube(), { hasLineup: true, daysToNextMatch: 5, currentWeek: 10, boardConfidence: 12 });
    expect(fila).toHaveLength(0);
  });

  it('deixa o presidente voltar depois de duas semanas, e não depois de uma temporada', () => {
    /**
     * Todo outro assunto aceita "não" como resposta definitiva. Este não pode: um ultimato que se consegue
     * silenciar deixa de ser ultimato, e a demissão que vem depois passa a chegar sem aviso nenhum.
     */
    const adiado = deferMeeting('board', 10, deferMeeting('board', 10));
    const doPresidente = adiado.find((d) => d.topic === 'board')!;
    expect(doPresidente.mutedUntilWeek).toBe(10 + BOARD_MUTE_WEEKS);

    const outroAssunto = deferMeeting('academy', 10, deferMeeting('academy', 10));
    expect(outroAssunto.find((d) => d.topic === 'academy')!.mutedUntilWeek).toBe(10 + DEFER_SEASON_WEEKS);
  });

  it('dá a todo pedido um destino e um botão', () => {
    const fila = buildMeetingQueue(clube({ sponsorships: [] }), { ...VESPERA, bestSponsorUpgrade: 50_000 });
    for (const pedido of fila) {
      expect(pedido.actionPath.trim().length, pedido.topic).toBeGreaterThan(2);
      expect(pedido.actionLabel.trim().length, pedido.topic).toBeGreaterThan(2);
      expect(pedido.speakerIcon.trim().length, pedido.topic).toBeGreaterThan(0);
    }
  });
});

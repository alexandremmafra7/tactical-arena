import { describe, it, expect } from 'vitest';
import type { Club } from '@tactical-arena/shared';
import { financeHubStatus, teamHubStatus } from './hubStatus.js';

/**
 * A faixa dos cards de hub.
 *
 * O que importa aqui não é o texto, é o tom: se um card em ordem acender âmbar, o jogador aprende a
 * ignorar âmbar, e aí a pastilha deixa de valer para os casos em que havia mesmo algo a resolver.
 */
function makeClub(over: Partial<Club> = {}): Club {
  return {
    id: 'c1',
    name: 'Teste',
    players: [],
    academyPlayers: [],
    budget: 1_000_000,
    stadiumCapacity: 20_000,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
    pendingRoundTactic: null,
    staff: [],
    ...over,
  } as unknown as Club;
}

function player(over: Record<string, unknown> = {}) {
  return { id: 'p', name: 'Jogador', wage: 1000, injuryWeeks: 0, suspensions: [], trainingFocus: 'PHYSICAL', contractUntil: 2030, ...over };
}

describe('faixa do hub Minha equipe', () => {
  it('fica em cinza quando não há nada a resolver', () => {
    const club = makeClub({ players: [player(), player()] as never });
    const status = teamHubStatus(club, 2026);

    expect(status.squad).toMatchObject({ value: '2', tone: 'neutral' });
    expect(status.training.tone).toBe('neutral');
    expect(status.contracts.tone).toBe('neutral');
  });

  it('acende vermelho no elenco quando alguém está lesionado, e âmbar quando é só suspensão', () => {
    const lesionado = teamHubStatus(makeClub({ players: [player({ injuryWeeks: 2 })] as never }), 2026);
    expect(lesionado.squad).toMatchObject({ value: '1', label: 'jogador fora', tone: 'urgent' });

    const suspenso = teamHubStatus(makeClub({ players: [player({ suspensions: [{}] })] as never }), 2026);
    expect(suspenso.squad.tone).toBe('attention');
  });

  it('trata time desescalado como urgente e mostra o quanto falta', () => {
    const vazio = teamHubStatus(makeClub(), 2026);
    expect(vazio.tactics).toMatchObject({ value: '0/11', tone: 'urgent' });

    const escalado = makeClub({
      pendingRoundTactic: { formation: '4-3-3', lineup: Array.from({ length: 11 }, () => ({ playerId: 'p' })) } as never,
    });
    expect(teamHubStatus(escalado, 2026).tactics).toMatchObject({ value: '4-3-3', tone: 'neutral' });
  });

  it('conta contrato vencendo só quando conhece a temporada corrente', () => {
    const club = makeClub({ players: [player({ contractUntil: 2026 }), player({ contractUntil: 2031 })] as never });

    expect(teamHubStatus(club, 2026).contracts).toMatchObject({ value: '1', tone: 'attention' });
    // Sem relógio não se inventa vencimento: seria um alarme falso a cada carregamento lento.
    expect(teamHubStatus(club, null).contracts.tone).toBe('neutral');
  });

  it('avisa cargo vago na comissão', () => {
    expect(teamHubStatus(makeClub(), 2026).staff).toMatchObject({ value: '5', tone: 'attention' });
  });
});

describe('faixa do hub Financeiro', () => {
  it('marca as contas no vermelho quando a semana fecha negativa', () => {
    const quebrado = makeClub({ players: Array.from({ length: 30 }, () => player({ wage: 200_000 })) as never });
    expect(financeHubStatus(quebrado).finance.tone).toBe('urgent');
  });

  it('deixa as contas em cinza quando a semana fecha positiva', () => {
    const saudavel = makeClub({ sponsorships: [{ weeklyAmount: 500_000 }] as never });
    expect(financeHubStatus(saudavel).finance.tone).toBe('neutral');
  });

  it('conta as cotas de patrocínio em aberto', () => {
    expect(financeHubStatus(makeClub()).sponsors).toMatchObject({ value: '5', tone: 'attention' });
  });

  it('mostra a obra em andamento no lugar da capacidade', () => {
    const obra = makeClub({ stadiumConstruction: { targetLevel: 3, weeksRemaining: 4 } as never });
    expect(financeHubStatus(obra).stadium).toMatchObject({ value: '4', label: 'semanas de obra', tone: 'attention' });
  });
});

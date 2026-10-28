import { describe, expect, it } from 'vitest';
import {
  contractEndFor,
  defaultContractYears,
  hasExpired,
  isExpiring,
  renewContract,
  renewalCost,
  seasonsRemaining,
} from './contract.js';
import type { StaffMember } from './staff.js';
import { makePlayer } from '../simulation/testFactories.js';

/**
 * O contrato, que o jogo não tinha.
 *
 * Um jogador tinha salário e multa rescisória e nenhum prazo, e a consequência era maior do que parece: sem
 * data de fim, nenhum jogador tem motivo para sair, e o mundo fica parado por falta de um relógio, não por
 * falta de inteligência de mercado. Era também o que deixava o diretor de futebol sem trabalho de verdade.
 */
const diretor = (nota: number): StaffMember => ({
  id: 'd', name: 'Diretor', role: 'FOOTBALL_DIRECTOR', tier: 'OURO', rating: nota, specialty: '',
  description: '', wage: 0, minClubVisibility: 0, minCareerTitles: 0, avatar: '', nationality: 'BRA',
});

describe('contrato', () => {
  it('dá contrato longo a quem é jovem e curto a quem está no fim', () => {
    // Um clube aposta cinco anos num garoto e um ano num veterano, que é como o futebol trata as duas pontas.
    expect(defaultContractYears(19)).toBe(5);
    expect(defaultContractYears(26)).toBe(4);
    expect(defaultContractYears(31)).toBe(2);
    expect(defaultContractYears(34)).toBe(1);
  });

  it('guarda o ano de término, e não um contador de anos', () => {
    /**
     * O prazo é uma data, não um número que alguém precisa lembrar de decrementar toda virada. Um contador
     * esquecido numa das quatro passagens da virada de temporada seria invisível durante anos.
     */
    expect(contractEndFor(19, 2026)).toBe(2031);
    expect(contractEndFor(34, 2026)).toBe(2027);
  });

  it('trata contrato ausente como longo, e não como vencido', () => {
    /**
     * A regressão que isto guarda vale um save inteiro: elencos criados antes de os contratos existirem não
     * têm `contractUntil`, e tratá-los como vencidos apagaria o time todo na primeira virada de ano.
     */
    const antigo = makePlayer('velho', { age: 25 });
    expect(antigo.contractUntil).toBeUndefined();
    expect(hasExpired(antigo, 2026)).toBe(false);
    expect(seasonsRemaining(antigo, 2026)).toBeGreaterThan(0);
  });

  it('separa quem vence agora de quem já venceu', () => {
    const vence = makePlayer('a', { age: 25, contractUntil: 2026 });
    const venceu = makePlayer('b', { age: 25, contractUntil: 2025 });

    // As duas perguntas levam a ações diferentes: uma pede renovação, a outra já tirou o jogador do clube.
    expect(isExpiring(vence, 2026)).toBe(true);
    expect(hasExpired(vence, 2026)).toBe(false);
    expect(hasExpired(venceu, 2026)).toBe(true);
  });

  it('cobra mais caro de quem já pode sair de graça', () => {
    const folgado = makePlayer('c', { age: 25, wage: 10_000, contractUntil: 2030 });
    const apertado = makePlayer('d', { age: 25, wage: 10_000, contractUntil: 2027 });
    const nofim = makePlayer('e', { age: 25, wage: 10_000, contractUntil: 2026 });

    /**
     * É a decisão inteira do diretor de futebol: renovar cedo é mais barato, e deixar chegar ao último ano
     * custa metade a mais, porque o jogador sabe que a alternativa dele é sair sem o clube receber nada.
     */
    expect(renewalCost(folgado, 2026, 2)).toBeLessThan(renewalCost(apertado, 2026, 2));
    expect(renewalCost(apertado, 2026, 2)).toBeLessThan(renewalCost(nofim, 2026, 2));
  });

  it('faz o diretor de futebol pagar o próprio salário', () => {
    const jogador = makePlayer('f', { age: 25, wage: 20_000, contractUntil: 2028 });

    const semDiretor = renewalCost(jogador, 2026, 3);
    const comBom = renewalCost(jogador, 2026, 3, diretor(95));

    // O desconto dele valia só na compra. Renovação é a outra metade do trabalho, e a que existe todo ano.
    expect(comBom).toBeLessThan(semDiretor);
    expect(comBom / semDiretor).toBeGreaterThan(0.75);
  });

  it('soma ao renovar cedo, em vez de encurtar', () => {
    const jogador = makePlayer('g', { age: 25, contractUntil: 2030 });

    // Renovar com quatro anos pela frente por mais dois dá seis, não dois. O erro contrário puniria quem age cedo.
    expect(renewContract(jogador, 2026, 2).contractUntil).toBe(2032);
  });

  it('recoloca no futuro quem já estava vencido', () => {
    const vencido = makePlayer('h', { age: 25, contractUntil: 2024 });
    // Renovar um contrato vencido conta da temporada corrente, senão o novo prazo nasceria no passado.
    expect(renewContract(vencido, 2026, 3).contractUntil).toBe(2029);
  });
});

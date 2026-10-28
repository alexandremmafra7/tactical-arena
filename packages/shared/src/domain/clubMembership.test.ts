import { describe, expect, it } from 'vitest';
import {
  MEMBERSHIP_TIERS,
  getMembershipTier,
  calculateInitialMembers,
  membershipCeiling,
  calculateMembershipWeeklyRevenue,
  applyMatchMembershipImpact,
  applyTitleMembershipBoost,
  applyStarSigningMembershipBoost,
} from './clubMembership.js';

/**
 * O sócio torcedor, que era um número na tela.
 *
 * As três regras de crescimento estavam escritas e tinham zero chamadas: ganhar não trazia sócio, título não
 * trazia, craque não trazia. E a receita semanal era calculada no painel de finanças e nunca creditada, o
 * que é pior que não existir, porque o jogador via um dinheiro que não chegava.
 *
 * Ligá-las como estavam quebrava a economia, e é isso que estes testes guardam.
 */
describe('sócio torcedor', () => {
  const TETO = membershipCeiling(50_000);

  it('não deixa a torcida passar do que o estádio comporta', () => {
    expect(TETO).toBe(150_000);

    /**
     * Sem teto o crescimento é composto e explode: medido com as taxas originais, cinco temporadas de título
     * levavam de 74 mil a 1,64 milhão de sócios pagando R$ 36 milhões por semana.
     */
    let socios = 74_250;
    for (let temporada = 0; temporada < 20; temporada += 1) {
      for (let i = 0; i < 24; i += 1) socios = applyMatchMembershipImpact(socios, 'WIN', false, TETO).newMembers;
      socios = applyTitleMembershipBoost(socios, 'league', TETO).newMembers;
    }
    expect(socios).toBeLessThanOrEqual(TETO);
  });

  it('cresce depressa no começo e devagar perto do teto', () => {
    // O ganho é uma fatia do espaço que falta, então ele desacelera sozinho. É assim que torcida satura.
    const cedo = applyMatchMembershipImpact(50_000, 'WIN', false, TETO).diff;
    const tarde = applyMatchMembershipImpact(140_000, 'WIN', false, TETO).diff;

    expect(cedo).toBeGreaterThan(tarde);
    expect(tarde).toBeGreaterThanOrEqual(0);
  });

  it('tira sócio de quem perde, e tira dos que existem', () => {
    /**
     * A assimetria que importa: entrar depende de haver espaço, sair não. Um clube encostado no teto
     * continua perdendo sócio quando perde jogo, senão ficar grande viraria imunidade.
     */
    const noTeto = applyMatchMembershipImpact(TETO, 'LOSS', false, TETO);
    expect(noTeto.diff).toBeLessThan(0);
    expect(noTeto.newMembers).toBeLessThan(TETO);
  });

  it('nunca esvazia o clube por completo', () => {
    let socios = 5_000;
    for (let i = 0; i < 500; i += 1) socios = applyMatchMembershipImpact(socios, 'LOSS', false, TETO).newMembers;
    expect(socios).toBeGreaterThanOrEqual(500);
  });

  it('paga mais por sócio conforme o plano sobe, e não dispara', () => {
    // Eram 8 a 22 por sócio, o que dava a um clube grande cinco vezes e meia a receita de patrocínio.
    expect(MEMBERSHIP_TIERS.map((t) => t.weeklyFeePerMember)).toEqual([2, 3, 4, 5, 6]);

    const grande = calculateMembershipWeeklyRevenue(74_250);
    expect(grande).toBeGreaterThan(200_000);
    expect(grande, 'sócio não pode enterrar o patrocínio, que é o que o técnico negocia').toBeLessThan(400_000);
  });

  it('só reage a craque de verdade', () => {
    expect(applyStarSigningMembershipBoost(50_000, 79, TETO).diff).toBe(0);
    expect(applyStarSigningMembershipBoost(50_000, 92, TETO).diff).toBeGreaterThan(
      applyStarSigningMembershipBoost(50_000, 82, TETO).diff,
    );
  });

  it('mantém o comportamento antigo quando ninguém informa o teto', () => {
    // As três funções ganharam um parâmetro novo, e quem já as chamava sem ele não pode mudar de resposta.
    expect(applyTitleMembershipBoost(10_000, 'league').diff).toBe(2_500);
    expect(applyMatchMembershipImpact(10_000, 'WIN').diff).toBe(180);
  });

  /**
   * As três funções que já eram chamadas pelo painel de finanças.
   *
   * Este arquivo tinha cinco testes e eu o sobrescrevi ao acrescentar os de cima, em vez de anexar. Estes
   * recompõem a cobertura da parte que já funcionava, que é justamente a que ninguém ia notar quebrada:
   * ela só aparece como um número na tela.
   */
  it('escolhe o plano pela faixa de sócios', () => {
    expect(getMembershipTier(0).tier).toBe('BRONZE');
    expect(getMembershipTier(14_999).tier).toBe('BRONZE');
    expect(getMembershipTier(15_000).tier).toBe('PRATA');
    expect(getMembershipTier(45_000).tier).toBe('OURO');
    expect(getMembershipTier(90_000).tier).toBe('DIAMANTE');
    expect(getMembershipTier(150_000).tier).toBe('ELITE_GLOBAL');
    expect(getMembershipTier(9_000_000).tier, 'acima do topo continua no topo').toBe('ELITE_GLOBAL');
  });

  it('cobra a mensalidade do plano em que o clube está', () => {
    expect(calculateMembershipWeeklyRevenue(10_000)).toBe(20_000);
    expect(calculateMembershipWeeklyRevenue(0)).toBe(0);

    // Cruzar a faixa vale mais que o sócio a mais: 15.000 sobem de plano e pagam 3 em vez de 2.
    expect(calculateMembershipWeeklyRevenue(15_000)).toBeGreaterThan(calculateMembershipWeeklyRevenue(14_999) + 3);
  });

  it('dá ao clube uma torcida à altura do estádio e da divisão', () => {
    const clube = (capacidade: number, media: number) =>
      ({ stadiumCapacity: capacidade, players: Array.from({ length: 26 }, () => ({ overall: media })) }) as never;

    // Estádio maior, mais sócios; e a primeira divisão vale muito mais que a segunda.
    expect(calculateInitialMembers(clube(50_000, 70), 1)).toBeGreaterThan(calculateInitialMembers(clube(20_000, 70), 1));
    expect(calculateInitialMembers(clube(50_000, 70), 1)).toBeGreaterThan(calculateInitialMembers(clube(50_000, 70), 2));
    expect(calculateInitialMembers(clube(50_000, 78), 1), 'elenco forte atrai sócio').toBeGreaterThan(
      calculateInitialMembers(clube(50_000, 70), 1),
    );

    // E o clube sem estádio informado não fica sem torcida nenhuma.
    expect(calculateInitialMembers({ players: [] } as never, 3)).toBeGreaterThan(0);
  });
});

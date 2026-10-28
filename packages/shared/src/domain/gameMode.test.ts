import { describe, expect, it } from 'vitest';
import {
  availableMatchSpeeds,
  canBeApproachedBy,
  canBeSacked,
  canResign,
  canTakeOverDivision,
  canTakeOverAfterGoal,
  canUseMatchSpeed,
  explainBlock,
  hardcoreGoal,
  GAME_MODES,
  GAME_MODE_INFO,
  mustFoundOwnClub,
} from './gameMode.js';

/**
 * Os três modos, e sobretudo os limites entre eles.
 *
 * O que estes testes protegem é a distinção entre **escolher** e **conquistar**. Um teto que barra a escolha
 * é o produto; um teto que barra a conquista transformaria acesso e rebaixamento em decoração para quem não
 * paga, e faria do modo padrão uma demonstração em vez de um jogo.
 */
describe('modos de carreira', () => {
  it('deixa o premium assumir qualquer divisão, e o padrão só da segunda para baixo', () => {
    expect(canTakeOverDivision('PREMIUM', 1)).toBe(true);
    expect(canTakeOverDivision('PREMIUM', 3)).toBe(true);

    expect(canTakeOverDivision('STANDARD', 1)).toBe(false);
    expect(canTakeOverDivision('STANDARD', 2)).toBe(true);
    expect(canTakeOverDivision('STANDARD', 4)).toBe(true);
  });

  it('não deixa o modo do zero assumir clube nenhum, nem da divisão mais baixa', () => {
    // A premissa do modo é o clube ser dele. Assumir um pronto, por pior que fosse, seria outro jogo.
    for (const divisao of [1, 2, 3, 4]) {
      expect(canTakeOverDivision('HARDCORE', divisao), `divisão ${divisao}`).toBe(false);
    }
    expect(mustFoundOwnClub('HARDCORE')).toBe(true);
    expect(mustFoundOwnClub('STANDARD')).toBe(false);
    expect(mustFoundOwnClub('PREMIUM')).toBe(false);
  });

  it('só liberta o modo do zero depois de ganhar tudo o que havia para ganhar', () => {
    expect(canResign('HARDCORE', false)).toBe(false);
    expect(canResign('HARDCORE', true)).toBe(true);
  });

  it('deixa os outros modos sair quando quiserem', () => {
    // Sair já custa reputação, e o preço é o que regula a decisão — uma trava seria cobrar duas vezes.
    expect(canResign('STANDARD', false)).toBe(true);
    expect(canResign('PREMIUM', false)).toBe(true);
  });

  it('cumpre o objetivo só quando nada falta, e nunca com a lista vazia', () => {
    /**
     * A lista vazia é o caso perigoso: significa que o clube ainda não chegou à divisão mais alta, ou que o
     * país não foi lido. Nos dois, libertar seria dar de graça o que o modo inteiro existe para cobrar.
     */
    expect(hardcoreGoal([]).met).toBe(false);

    const faltando = hardcoreGoal([
      { id: 'l1', name: 'Brasileirão Série A', won: true },
      { id: 'c1', name: 'Copa do Brasil', won: false },
    ]);
    expect(faltando.met).toBe(false);
    expect(faltando.missing).toEqual(['Copa do Brasil']);
    expect(faltando.won).toEqual(['Brasileirão Série A']);

    const completo = hardcoreGoal([
      { id: 'l1', name: 'Brasileirão Série A', won: true },
      { id: 'c1', name: 'Copa do Brasil', won: true },
    ]);
    expect(completo.met).toBe(true);
    expect(completo.missing).toEqual([]);
  });

  it('tira o teto de quem venceu o modo do zero', () => {
    /**
     * Ele fundou um clube do nada e ganhou tudo. Prendê-lo depois disso às regras de entrada do modo padrão
     * seria castigar quem venceu o modo mais difícil do jogo.
     */
    expect(canTakeOverAfterGoal('HARDCORE', false, 3)).toBe(false);
    expect(canTakeOverAfterGoal('HARDCORE', true, 1)).toBe(true);

    // E não muda nada para os outros dois modos, que não têm objetivo a cumprir.
    expect(canTakeOverAfterGoal('STANDARD', true, 1)).toBe(false);
    expect(canTakeOverAfterGoal('PREMIUM', false, 1)).toBe(true);
  });

  it('torna o técnico do modo do zero indemissível, e só ele', () => {
    /**
     * A contrapartida da trava. Se a diretoria pudesse demitir, a única coisa que o modo pede — chegar à
     * primeira divisão — poderia ser tornada impossível por uma sequência ruim, e a trava na saída
     * voluntária não protegeria nada.
     */
    expect(canBeSacked('HARDCORE')).toBe(false);
    expect(canBeSacked('STANDARD')).toBe(true);
    expect(canBeSacked('PREMIUM')).toBe(true);
  });

  it('usa a mesma régua para sondagem e para contratação', () => {
    // Duas réguas diferentes deixariam um clube de elite contratar por sondagem quem não pode contratar
    // pela porta da frente, e o teto do modo padrão vazaria por ali.
    for (const divisao of [1, 2, 3]) {
      expect(canBeApproachedBy('STANDARD', divisao)).toBe(canTakeOverDivision('STANDARD', divisao));
      expect(canBeApproachedBy('PREMIUM', divisao)).toBe(canTakeOverDivision('PREMIUM', divisao));
    }
  });

  it('dá as quatro velocidades ao premium e as duas do meio aos outros', () => {
    expect(availableMatchSpeeds('PREMIUM')).toHaveLength(4);
    expect(availableMatchSpeeds('STANDARD')).toEqual(['normal', 'fast']);
    expect(availableMatchSpeeds('HARDCORE')).toEqual(['normal', 'fast']);

    expect(canUseMatchSpeed('STANDARD', 'superfast')).toBe(false);
    expect(canUseMatchSpeed('STANDARD', 'slow')).toBe(false);
    expect(canUseMatchSpeed('PREMIUM', 'superfast')).toBe(true);
  });

  it('deixa todo modo jogar, mesmo que só nas velocidades do meio', () => {
    // Um modo sem nenhuma velocidade disponível seria um jogo que não abre. Vale a pena provar.
    for (const modo of GAME_MODES) {
      expect(availableMatchSpeeds(modo).length, modo).toBeGreaterThan(0);
    }
  });

  it('explica todo bloqueio em vez de apenas recusar', () => {
    /**
     * Um bloqueio sem motivo lê-se como defeito do jogo. Com motivo, lê-se como regra do modo — e essa é a
     * diferença entre o jogador achar que quebrou e entender o que está a jogar.
     */
    for (const modo of GAME_MODES) {
      for (const o of ['division', 'resign', 'speed'] as const) {
        expect(explainBlock(modo, o).trim().length, `${modo}/${o}`).toBeGreaterThan(20);
      }
    }
    expect(explainBlock('HARDCORE', 'division')).toContain('fundou');
    expect(explainBlock('STANDARD', 'division')).toContain('Premium');
  });

  it('dá a cada modo um nome e uma explicação que cabem numa tela de escolha', () => {
    for (const modo of GAME_MODES) {
      const info = GAME_MODE_INFO[modo];
      expect(info.label.trim().length, modo).toBeGreaterThan(2);
      expect(info.tagline.trim().length, modo).toBeGreaterThan(10);
      expect(info.description.trim().length, modo).toBeGreaterThan(40);
      expect(info.icon.trim().length, modo).toBeGreaterThan(0);
    }
  });

  it('preserva os ids persistidos e usa os nomes aprovados na interface', () => {
    expect(GAME_MODES).toEqual(['STANDARD', 'PREMIUM', 'HARDCORE']);
    expect(GAME_MODE_INFO.STANDARD.label).toBe('Standard');
    expect(GAME_MODE_INFO.PREMIUM.label).toBe('Premium');
    expect(GAME_MODE_INFO.HARDCORE.label).toBe('Iron Man');
    expect(explainBlock('HARDCORE', 'division')).toContain('Iron Man');
    expect(explainBlock('HARDCORE', 'division')).not.toContain('Do Zero');
  });
});

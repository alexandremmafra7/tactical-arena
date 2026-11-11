import { describe, expect, it } from 'vitest';
import { stagedTargets, PREP_WINDOW, isScene, anchoredBall, ZONE_ANCHOR, initialPlay, pickReceiver, rand01, stepPlay, turnoverChance, zoneX, type PlayContext, type PlayShot, type PlayState } from './pitchPlay.js';
import { stepBall, BALL_MAX_SPEED } from './pitchMotion.js';
import type { Slot } from './pitchPositions.js';

const HOME: Slot[] = [
  { x: 7, y: 30 }, { x: 18, y: 12 }, { x: 17, y: 24 }, { x: 17, y: 36 }, { x: 18, y: 48 },
  { x: 30, y: 12 }, { x: 28, y: 24 }, { x: 28, y: 36 }, { x: 30, y: 48 }, { x: 42, y: 22 }, { x: 42, y: 38 },
];
const AWAY: Slot[] = HOME.map((s) => ({ x: 100 - s.x, y: 60 - s.y }));

function ctx(over: Partial<PlayContext> = {}): PlayContext {
  return { home: HOME, away: AWAY, ball: { x: 50, y: 30 }, momentum: 50, homeAttacksRight: true, pending: null, speed: 1, dt: 0.1, ...over };
}

/** Roda o diretor com a bola andando de verdade (jogadores parados nas posições base). */
function run(seconds: number, over: Partial<PlayContext> = {}, start: PlayState = initialPlay()) {
  let state = start;
  let ball: Slot = { x: 50, y: 30 };
  const sides: string[] = [];
  const kinds: string[] = [];
  for (let t = 0; t < seconds; t += 0.1) {
    const step = stepPlay(state, ctx({ ...over, ball }));
    state = step.state;
    ball = stepBall(ball, step.ballTarget, 0.1, BALL_MAX_SPEED * (over.speed ?? 1) * step.ballSpeedMul);
    sides.push(state.side);
    kinds.push(state.kind);
  }
  return { state, ball, sides, kinds };
}

const SHOT: PlayShot = { key: 'g1', side: 'home', start: { x: 84, y: 30 }, end: { x: 98, y: 30 }, outcome: 'goal' };

describe('pitchPlay', () => {
  it('sorteio é determinístico e fica entre 0 e 1', () => {
    expect(rand01(5, 3)).toBe(rand01(5, 3));
    for (let i = 0; i < 200; i++) {
      const r = rand01(i, 11);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('mesmo estado e contexto dão o mesmo resultado', () => {
    expect(stepPlay(initialPlay(), ctx())).toEqual(stepPlay(initialPlay(), ctx()));
  });

  it('passa para um companheiro de verdade: nunca para si, nem para expulso', () => {
    for (let seq = 1; seq < 80; seq++) {
      const r = pickReceiver(HOME, 6, true, 60, seq, new Set([9]));
      expect(r).not.toBe(6);
      expect(r).not.toBe(9);
    }
  });

  it('o goleiro só recebe de quem está perto do próprio gol', () => {
    for (let seq = 1; seq < 60; seq++) expect(pickReceiver(HOME, 10, true, 60, seq)).not.toBe(0);
  });

  it('tende a passar para frente quando a zona do jogo está à frente', () => {
    let forward = 0;
    for (let seq = 1; seq <= 200; seq++) {
      const r = pickReceiver(HOME, 6, true, 80, seq);
      if (HOME[r].x > HOME[6].x) forward++;
    }
    expect(forward).toBeGreaterThan(110);
  });

  it('é simétrico: time atacando para a esquerda escolhe o espelho', () => {
    const mirrored = HOME.map((s) => ({ x: 100 - s.x, y: 60 - s.y }));
    for (let seq = 1; seq < 40; seq++) {
      expect(pickReceiver(mirrored, 6, false, 100 - 70, seq)).toBe(pickReceiver(HOME, 6, true, 70, seq));
    }
  });

  it('perde mais a bola quem está sendo dominado', () => {
    expect(turnoverChance('home', 20)).toBeGreaterThan(turnoverChance('home', 80));
    expect(turnoverChance('away', 80)).toBeGreaterThan(turnoverChance('away', 20));
  });

  it('a posse acompanha o momento da partida', () => {
    const share = (momentum: number) => {
      const { sides } = run(240, { momentum });
      return sides.filter((s) => s === 'home').length / sides.length;
    };
    expect(share(80)).toBeGreaterThan(share(50));
    expect(share(50)).toBeGreaterThan(share(20));
  });

  it('a zona do jogo vira para o outro lado depois da troca de campo', () => {
    expect(zoneX(80, true)).toBeGreaterThan(50);
    expect(zoneX(80, false)).toBeLessThan(50);
    expect(zoneX(80, false)).toBeCloseTo(100 - zoneX(80, true), 9);
  });

  it('um gol do motor leva a bola ao ponto do chute, chuta, e a saída de bola é do time que sofreu', () => {
    const { kinds, state, sides } = run(8, { pending: SHOT });
    expect(kinds).toContain('approach');
    expect(kinds).toContain('shot');
    expect(kinds).toContain('aftermath');
    expect(state.handled).toContain('g1');
    expect(sides[sides.length - 1]).toBe('away');
  });

  it('defesa: o goleiro de quem defendeu fica com a bola', () => {
    const pending = { ...SHOT, key: 's1', outcome: 'saved' as const, end: { x: 95, y: 30 } };
    let state = initialPlay();
    let ball: Slot = { x: 50, y: 30 };
    let restart: PlayState | null = null;
    let seenAftermath = false;
    for (let t = 0; t < 10 && !restart; t += 0.1) {
      const step = stepPlay(state, ctx({ pending, ball }));
      state = step.state;
      ball = stepBall(ball, step.ballTarget, 0.1, BALL_MAX_SPEED * step.ballSpeedMul);
      if (state.kind === 'aftermath') seenAftermath = true;
      else if (seenAftermath && state.kind === 'carry') restart = state;
    }
    expect(restart?.side).toBe('away');
    expect(restart?.carrier).toBe(0);
  });

  it('o mesmo lance não é jogado duas vezes', () => {
    const first = run(8, { pending: SHOT });
    const second = run(4, { pending: SHOT }, first.state);
    expect(second.state.handled.filter((k) => k === 'g1')).toHaveLength(1);
    expect(second.kinds.filter((k) => k === 'approach')).toHaveLength(0);
  });

  it('em velocidade muito rápida o lance também termina', () => {
    const { kinds } = run(6, { pending: SHOT, speed: 3.4 });
    expect(kinds).toContain('aftermath');
  });

  it('o bloco é ancorado na zona do jogo, não só na bola', () => {
    const a = anchoredBall({ x: 30, y: 20 }, 80, true);
    expect(a.y).toBe(20);
    expect(a.x).toBeCloseTo(30 + (zoneX(80, true) - 30) * ZONE_ANCHOR, 9);
    // espelhado no 2º tempo
    const b = anchoredBall({ x: 70, y: 20 }, 80, false);
    expect(100 - b.x).toBeCloseTo(a.x, 9);
  });

  it('o campo não chega atrasado: do meio-campo, a bola está no ponto do chute em menos de 1 s (velocidade lenta)', () => {
    let state = initialPlay();
    let ball: Slot = { x: 50, y: 30 };
    let t = 0;
    for (; t < 3 && state.kind !== 'shot'; t += 0.1) {
      const step = stepPlay(state, ctx({ pending: SHOT, ball }));
      state = step.state;
      ball = stepBall(ball, step.ballTarget, 0.1, BALL_MAX_SPEED * step.ballSpeedMul);
    }
    expect(state.kind).toBe('shot');
    expect(t).toBeLessThan(1);
    expect(Math.hypot(ball.x - SHOT.start.x, ball.y - SHOT.start.y)).toBeLessThan(2);
  });

  it('isScene vale só para chegada, chute e depois do chute', () => {
    expect(isScene({ ...initialPlay(), kind: 'carry' })).toBe(false);
    expect(isScene({ ...initialPlay(), kind: 'pass' })).toBe(false);
    for (const kind of ['approach', 'shot', 'aftermath'] as const) expect(isScene({ ...initialPlay(), kind })).toBe(true);
  });

  describe('adiantamento do lance (espiada)', () => {
    const FAR = { x: 30, y: 30 };
    const upcoming = (eta: number) => ({ shot: SHOT, eta });
    const nearStart: Slot = { x: 82, y: 30 };

    it('fora da janela de preparação nada muda', () => {
      const base = stepPlay(initialPlay('away'), ctx({ ball: FAR }));
      const far = stepPlay(initialPlay('away'), ctx({ ball: FAR, upcoming: upcoming(PREP_WINDOW + 5) }));
      expect(far.staging).toBe(false);
      expect(far.state).toEqual(base.state);
    });

    it('dentro da janela o time do lance toma a bola', () => {
      const r = stepPlay({ ...initialPlay('away'), hold: 0 }, ctx({ ball: FAR, upcoming: upcoming(2) }));
      expect(r.staging).toBe(true);
      expect(r.state.side).toBe('home');
      expect(r.state.kind).toBe('pass');
    });

    it('não perde a bola enquanto prepara: a posse fica com o time do lance', () => {
      let state: PlayState = { ...initialPlay('home'), hold: 0 };
      let ball: Slot = FAR;
      for (let t = 0; t < 3; t += 0.1) {
        const step = stepPlay(state, ctx({ ball, upcoming: upcoming(3 - t), momentum: 5 }));
        state = step.state;
        ball = stepBall(ball, step.ballTarget, 0.1, BALL_MAX_SPEED * step.ballSpeedMul);
        expect(state.side).toBe('home');
      }
    });

    it('com a bola já no ponto do chute, segura até o relógio revelar', () => {
      const a = stepPlay({ ...initialPlay('home'), hold: 0, carrier: 9 }, ctx({ ball: nearStart, upcoming: upcoming(1) }));
      expect(a.staging).toBe(true);
      expect(a.state.kind).toBe('carry');
      const b = stepPlay(a.state, ctx({ ball: nearStart, upcoming: upcoming(0.5) }));
      expect(b.state.kind).toBe('carry');
      expect(b.state.carrier).toBe(a.state.carrier);
    });

    it('na revelação, a bola preparada chuta quase na hora', () => {
      let state: PlayState = { ...initialPlay('home'), hold: 0 };
      let ball: Slot = nearStart;
      let kinds: string[] = [];
      for (let t = 0; t < 0.6; t += 0.1) {
        const step = stepPlay(state, ctx({ ball, pending: SHOT }));
        state = step.state;
        ball = stepBall(ball, step.ballTarget, 0.1, BALL_MAX_SPEED * step.ballSpeedMul);
        kinds.push(state.kind);
      }
      expect(kinds).toContain('shot');
      expect(kinds.indexOf('shot')).toBeLessThan(4);
    });

    it('desiste se a revelação nunca chega', () => {
      const r = stepPlay({ ...initialPlay('away'), hold: 0 }, ctx({ ball: FAR, upcoming: upcoming(-4) }));
      expect(r.staging).toBe(false);
      expect(r.state.side).toBe('away');
    });

    it('um lance já tratado não é preparado de novo', () => {
      const r = stepPlay({ ...initialPlay('away'), hold: 0, handled: [SHOT.key] }, ctx({ ball: FAR, upcoming: upcoming(1) }));
      expect(r.staging).toBe(false);
    });

    it('o bloco do time do lance sobe e o adversário recua; goleiro e expulso ficam', () => {
      const t = { home: HOME, away: AWAY };
      expect(stagedTargets(t, 'home', true, 0)).toBe(t);
      const r = stagedTargets(t, 'home', true, 1, new Set([4]));
      expect(r.home[0]).toEqual(HOME[0]);
      expect(r.home[4]).toEqual(HOME[4]);
      expect(r.home[9].x).toBeGreaterThan(HOME[9].x + 20);
      expect(r.away[9].x).toBeGreaterThan(AWAY[9].x);
      expect(r.home[9].x - HOME[9].x).toBeGreaterThan(r.away[9].x - AWAY[9].x);
      expect(r.away[0]).toEqual(AWAY[0]);
      for (const p of [...r.home, ...r.away]) {
        expect(p.x).toBeGreaterThanOrEqual(3);
        expect(p.x).toBeLessThanOrEqual(97);
      }
    });

    it('no 2º tempo (mandante ataca para a esquerda) o bloco sobe para o outro lado', () => {
      const t = { home: HOME.map((s) => ({ x: 100 - s.x, y: 60 - s.y })), away: AWAY.map((s) => ({ x: 100 - s.x, y: 60 - s.y })) };
      const r = stagedTargets(t, 'home', false, 1);
      expect(r.home[9].x).toBeLessThan(t.home[9].x - 20);
    });
  });
});

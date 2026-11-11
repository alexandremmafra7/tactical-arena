import { describe, expect, it } from 'vitest';
import {
  SPEED_PROFILE,
  agentMaxSpeeds,
  applyIndividualBehavior,
  computeMatchTargets,
  markingStrengthFor,
  stepAgents,
  stepBall,
  type MatchTargetsInput,
  type TeamInput,
} from './pitchMotion.js';
import { mirrorPoint } from './pitchOrientation.js';
import { computePlayerPositions, type Slot } from './pitchPositions.js';

// 4-4-2 com o time atacando para a direita (mesma tabela do PitchVisualizer)
const RAW: Slot[] = [
  { x: 7, y: 30 },
  { x: 18, y: 12 },
  { x: 17, y: 24 },
  { x: 17, y: 36 },
  { x: 18, y: 48 },
  { x: 30, y: 12 },
  { x: 28, y: 24 },
  { x: 28, y: 36 },
  { x: 30, y: 48 },
  { x: 42, y: 22 },
  { x: 42, y: 38 },
];
const MIRRORED = RAW.map((s) => mirrorPoint(s));

const home = (over: Partial<TeamInput> = {}): TeamInput => ({
  side: 'home',
  attackDir: 'right',
  baseSlots: RAW,
  excluded: [],
  markingStrength: 0.65,
  ...over,
});
const away = (over: Partial<TeamInput> = {}): TeamInput => ({
  side: 'away',
  attackDir: 'left',
  baseSlots: MIRRORED,
  excluded: [],
  markingStrength: 0.65,
  ...over,
});
const input = (over: Partial<MatchTargetsInput> = {}): MatchTargetsInput => ({
  home: home(),
  away: away(),
  ball: { x: 50, y: 30 },
  momentum: 50,
  phase: 1,
  possessionSide: 'home',
  detail: 1,
  ...over,
});

describe('computeMatchTargets', () => {
  it('é determinístico', () => {
    const a = computeMatchTargets(input({ ball: { x: 70, y: 14 }, phase: 3.3 }));
    const b = computeMatchTargets(input({ ball: { x: 70, y: 14 }, phase: 3.3 }));
    expect(a).toEqual(b);
  });

  it('mantém os 22 jogadores dentro do campo em qualquer cenário', () => {
    for (const bx of [4, 30, 50, 75, 96]) {
      for (const by of [4, 30, 56]) {
        for (const possessionSide of ['home', 'away'] as const) {
          for (const detail of [0, 0.4, 1]) {
            const t = computeMatchTargets(input({ ball: { x: bx, y: by }, possessionSide, detail, phase: bx + by }));
            for (const p of [...t.home, ...t.away]) {
              expect(p.x).toBeGreaterThanOrEqual(3);
              expect(p.x).toBeLessThanOrEqual(97);
              expect(p.y).toBeGreaterThanOrEqual(4);
              expect(p.y).toBeLessThanOrEqual(56);
            }
          }
        }
      }
    }
  });

  it('não se movem em bloco: lateral do lado da bola sobe mais que o do lado oposto', () => {
    // bola no corredor esquerdo (y=12) do mandante, que tem a posse: o lateral esquerdo (idx 1) apoia por fora,
    // o direito (idx 4) fecha por dentro. No bloco os dois subiriam juntos.
    const t = computeMatchTargets(input({ ball: { x: 75, y: 12 }, possessionSide: 'home' }));
    expect(t.home[1].x - t.home[4].x).toBeGreaterThan(1.5);
  });

  it('cada jogador de uma mesma linha recebe um deslocamento diferente', () => {
    const ball = { x: 70, y: 20 };
    const block = computePlayerPositions({
      side: 'home',
      baseSlots: RAW,
      ball,
      momentum: 50,
      currentMinute: 1,
      possessionSide: 'home',
    });
    const t = computeMatchTargets(input({ ball }));
    const shifts = [1, 2, 3, 4].map((i) => Math.round((t.home[i].x - block[i].x) * 100) / 100);
    expect(new Set(shifts).size).toBeGreaterThan(2);
  });

  it('detail 0 desliga as regras individuais (fica perto do bloco)', () => {
    const ball = { x: 75, y: 12 };
    const block = computePlayerPositions({
      side: 'home',
      baseSlots: RAW,
      ball,
      momentum: 50,
      currentMinute: 1,
      possessionSide: 'home',
    });
    const t0 = computeMatchTargets(input({ ball, detail: 0 }));
    const t1 = computeMatchTargets(input({ ball, detail: 1 }));
    const dist = (a: Slot[], b: Slot[]) => Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));
    expect(dist(t0.home, block)).toBeLessThan(4);
    expect(dist(t1.home, block)).toBeGreaterThan(dist(t0.home, block));
  });

  it('com a bola, atacantes não passam da linha de impedimento', () => {
    const ball = { x: 85, y: 30 };
    const awayBlock = computePlayerPositions({
      side: 'away',
      baseSlots: MIRRORED,
      ball,
      momentum: 80,
      currentMinute: 2,
      possessionSide: 'home',
    });
    const deepest = Math.max(...awayBlock.slice(1).map((p) => p.x));
    const t = computeMatchTargets(input({ ball, momentum: 80, phase: 2, possessionSide: 'home' }));
    for (const i of [9, 10]) {
      expect(t.home[i].x).toBeLessThanOrEqual(Math.max(50, deepest) - 0.8 + 1e-9);
    }
  });

  it('jogador expulso fica parado no slot', () => {
    const t = computeMatchTargets(input({ home: home({ excluded: [3] }), ball: { x: 70, y: 40 } }));
    expect(t.home[3]).toEqual(RAW[3]);
  });

  it('goleiro acompanha a bola na boca do gol e o x só avança com a posse', () => {
    const baixo = computeMatchTargets(input({ ball: { x: 40, y: 8 }, possessionSide: 'away' }));
    const alto = computeMatchTargets(input({ ball: { x: 40, y: 54 }, possessionSide: 'away' }));
    expect(baixo.home[0].y).toBeLessThan(alto.home[0].y);
    expect(baixo.home[0].y).toBeGreaterThanOrEqual(24);
    expect(alto.home[0].y).toBeLessThanOrEqual(36);
  });
});

describe('applyIndividualBehavior', () => {
  const homeBlock = RAW.map((s) => ({ ...s }));
  // Um atacante adversário (idx 9) já dentro do campo de defesa do mandante, ao lado do zagueiro idx 2.
  const oppBlock = MIRRORED.map((s) => ({ ...s }));
  oppBlock[9] = { x: 20, y: 22 };

  const run = (strength: number) =>
    applyIndividualBehavior({
      team: home({ markingStrength: strength }),
      block: homeBlock,
      oppBlock,
      ball: { x: 25, y: 25 },
      possessionSide: 'away',
      phase: 0,
      detail: 1,
    });

  it('zagueiro marca o atacante mais próximo, pelo lado do gol', () => {
    const solto = run(0);
    const marcando = run(0.65);
    const alvo = { x: 20 - 2.2, y: 22 + (30 - 22) * 0.08 };
    const d = (p: Slot) => Math.hypot(p.x - alvo.x, p.y - alvo.y);
    expect(d(marcando[2])).toBeLessThan(d(solto[2]));
  });

  it('é simétrico: time atacando para a esquerda é o espelho exato do que ataca para a direita', () => {
    const base = {
      block: homeBlock,
      oppBlock,
      ball: { x: 62, y: 18 },
      possessionSide: 'home' as const,
      phase: 2.5,
      detail: 1,
    };
    const normal = applyIndividualBehavior({ ...base, team: home() });
    const espelhado = applyIndividualBehavior({
      team: home({ attackDir: 'left', baseSlots: MIRRORED }),
      block: base.block.map((s) => mirrorPoint(s)),
      oppBlock: base.oppBlock.map((s) => mirrorPoint(s)),
      ball: mirrorPoint(base.ball),
      possessionSide: base.possessionSide,
      phase: base.phase,
      detail: base.detail,
    });
    normal.forEach((p, i) => {
      const m = mirrorPoint(espelhado[i]);
      expect(m.x).toBeCloseTo(p.x, 9);
      expect(m.y).toBeCloseTo(p.y, 9);
    });
  });

  it('dois jogadores do mesmo time não ficam um em cima do outro', () => {
    const empilhado = RAW.map((s) => ({ ...s }));
    empilhado[5] = { x: 30, y: 30 };
    empilhado[6] = { x: 30.2, y: 30.1 };
    const out = applyIndividualBehavior({
      team: home(),
      block: empilhado,
      oppBlock,
      ball: { x: 50, y: 30 },
      possessionSide: 'home',
      phase: 0,
      detail: 0,
    });
    expect(Math.hypot(out[5].x - out[6].x, out[5].y - out[6].y)).toBeGreaterThanOrEqual(3.3);
  });
});

describe('stepAgents / stepBall', () => {
  it('nunca anda mais que a velocidade máxima no passo', () => {
    const next = stepAgents([{ x: 0, y: 0 }], [{ x: 100, y: 0 }], 0.1, [20]);
    expect(next[0].x).toBeLessThanOrEqual(2 + 1e-9);
    expect(next[0].x).toBeGreaterThan(0);
  });

  it('chega ao alvo e para, sem passar dele', () => {
    let p = [{ x: 0, y: 0 }];
    for (let i = 0; i < 200; i++) {
      p = stepAgents(p, [{ x: 30, y: 20 }], 0.1, [25]);
      expect(p[0].x).toBeLessThanOrEqual(30 + 1e-9);
      expect(p[0].y).toBeLessThanOrEqual(20 + 1e-9);
    }
    expect(p[0].x).toBeCloseTo(30, 3);
    expect(p[0].y).toBeCloseTo(20, 3);
  });

  it('dt 0 mantém todos parados', () => {
    const next = stepAgents([{ x: 5, y: 5 }], [{ x: 50, y: 50 }], 0, [30]);
    expect(next[0]).toEqual({ x: 5, y: 5 });
  });

  it('o mais rápido chega antes que o mais lento', () => {
    let p = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    const alvo = [{ x: 40, y: 0 }, { x: 40, y: 0 }];
    for (let i = 0; i < 10; i++) p = stepAgents(p, alvo, 0.1, [32, 16]);
    expect(p[0].x).toBeGreaterThan(p[1].x);
  });

  it('listas de tamanhos diferentes viram o alvo direto', () => {
    const next = stepAgents([{ x: 1, y: 1 }], [{ x: 9, y: 9 }, { x: 8, y: 8 }], 0.1, [20]);
    expect(next).toEqual([{ x: 9, y: 9 }, { x: 8, y: 8 }]);
  });

  it('a bola também anda com velocidade limitada', () => {
    const b = stepBall({ x: 10, y: 10 }, { x: 90, y: 10 }, 0.1, 70);
    expect(b.x - 10).toBeLessThanOrEqual(7 + 1e-9);
  });
});

describe('perfil de velocidade e atributos', () => {
  it('quanto mais rápida a partida, menos detalhe individual e mais velocidade de deslocamento', () => {
    const ordem = ['slow', 'normal', 'fast', 'superfast'] as const;
    for (let i = 1; i < ordem.length; i++) {
      expect(SPEED_PROFILE[ordem[i]].detail).toBeLessThan(SPEED_PROFILE[ordem[i - 1]].detail);
      expect(SPEED_PROFILE[ordem[i]].speed).toBeGreaterThan(SPEED_PROFILE[ordem[i - 1]].speed);
    }
  });

  it('pace maior = jogador mais veloz; goleiro é mais lento; sem jogador vale a média', () => {
    const [gk, lento, rapido, desconhecido] = agentMaxSpeeds([50, 10, 95, undefined], 1);
    expect(rapido).toBeGreaterThan(lento);
    expect(gk).toBeLessThan(lento);
    expect(desconhecido).toBeCloseTo(agentMaxSpeeds([0, 50], 1)[1], 9);
  });

  it('o fator de velocidade multiplica todos', () => {
    const base = agentMaxSpeeds([50, 70], 1);
    const dobro = agentMaxSpeeds([50, 70], 2);
    expect(dobro[1]).toBeCloseTo(base[1] * 2, 9);
  });

  it('estilos de marcação: homem a homem gruda mais que zona', () => {
    expect(markingStrengthFor('MAN_MARKING')).toBeGreaterThan(markingStrengthFor('ZONAL'));
    expect(markingStrengthFor('HEAVY')).toBeGreaterThan(markingStrengthFor('LIGHT'));
    expect(markingStrengthFor(undefined)).toBe(markingStrengthFor('BALANCED'));
  });
});

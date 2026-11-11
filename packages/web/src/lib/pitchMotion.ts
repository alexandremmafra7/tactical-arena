import { mirrorPoint } from './pitchOrientation.js';
import { computePlayerPositions, type Slot } from './pitchPositions.js';

/**
 * Movimento individual dos 22 jogadores no campo 2D.
 *
 * Duas camadas, ambas puras (mesma entrada, mesma saída, sem Math.random nem Date):
 *  1. ALVOS: onde cada jogador "quer" estar agora. Parte do bloco de `computePlayerPositions` (linhas que
 *     sobem e descem com a bola) e soma o papel de cada um: lateral apoia por fora, atacante ataca a
 *     profundidade sem passar da linha de impedimento, meia oferece linha de passe, zagueiro marca o
 *     atacante mais próximo pelo lado do gol.
 *  2. INTEGRADOR (`stepAgents`): cada jogador anda até o alvo com velocidade limitada pelo seu `pace`, em vez
 *     de teletransportar. É isso que faz o time deixar de se mover em bloco: cada um chega a seu tempo.
 *
 * A simulação roda a poucos minutos de jogo por segundo real (ver SPEED_PROFILE), então não dá para mostrar
 * passe por passe: `detail` reduz as regras individuais nas velocidades altas, onde virariam ruído.
 */

export type SpeedKey = 'slow' | 'normal' | 'fast' | 'superfast';

/**
 * - `detail` (0..1): quanto das regras individuais aparece. Em "Muito rápido" um minuto dura ~0,2 s reais.
 * - `speed`: fator sobre a velocidade dos jogadores e da bola, porque a partida inteira passa mais depressa.
 */
export const SPEED_PROFILE: Record<SpeedKey, { detail: number; speed: number }> = {
  slow: { detail: 1, speed: 1 },
  normal: { detail: 0.85, speed: 1.5 },
  fast: { detail: 0.6, speed: 2.2 },
  superfast: { detail: 0.4, speed: 3.4 },
};

export interface TeamInput {
  side: 'home' | 'away';
  /** Para que lado o time ataca neste tempo de jogo. */
  attackDir: 'left' | 'right';
  /** Slots da formação na orientação real do campo (já girados se o time ataca para a esquerda). */
  baseSlots: Slot[];
  /** Índices de slots de jogadores expulsos: ficam parados no slot, e não atraem nem marcam ninguém. */
  excluded: Set<number> | number[];
  /** 0..1: o quanto os defensores grudam no adversário. Vem do `markingStyle` da tática. */
  markingStrength: number;
}

export interface MatchTargetsInput {
  home: TeamInput;
  away: TeamInput;
  ball: Slot;
  momentum: number;
  /** Fase do micro movimento (segundos reais vezes um fator), não minuto de jogo. */
  phase: number;
  possessionSide: 'home' | 'away';
  detail: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Quanto cada estilo de marcação gruda no adversário. */
export function markingStrengthFor(style: string | null | undefined): number {
  switch (style) {
    case 'MAN_MARKING':
      return 0.65;
    case 'HEAVY':
      return 0.55;
    case 'LIGHT':
      return 0.25;
    case 'ZONAL':
      return 0.3;
    default:
      return 0.4;
  }
}

type Line = 'def' | 'mid' | 'att';

function lineOf(baseX: number): Line {
  return baseX <= 22 ? 'def' : baseX <= 50 ? 'mid' : 'att';
}

const MIN_SPACING = 3.4;

interface IndividualParams {
  team: TeamInput;
  block: Slot[];
  oppBlock: Slot[];
  ball: Slot;
  possessionSide: 'home' | 'away';
  phase: number;
  detail: number;
}

/**
 * Camada individual de UM time. Trabalha com o time sempre atacando para +x (gira a entrada e devolve na
 * orientação real). Só lê o bloco do adversário, nunca o resultado individual dele: sem dependência circular.
 */
export function applyIndividualBehavior({ team, block, oppBlock, ball, possessionSide, phase, detail }: IndividualParams): Slot[] {
  const mirrored = team.attackDir === 'left';
  const norm = (s: Slot): Slot => (mirrored ? mirrorPoint(s) : { x: s.x, y: s.y });

  const own = block.map(norm);
  const opp = oppBlock.map(norm);
  const base = team.baseSlots.map(norm);
  const ballN = norm(ball);
  const excluded = new Set(team.excluded);
  const poss = possessionSide === team.side;
  const d = clamp(detail, 0, 1);
  const push = clamp((ballN.x - 50) / 50, -1, 1);
  const lead = Math.max(0, push);

  const out: Slot[] = own.map((s) => ({ x: s.x, y: s.y }));
  const active: number[] = [];
  for (let i = 1; i < out.length; i++) if (!excluded.has(i)) active.push(i);

  // Linha de impedimento: o adversário mais recuado (goleiro fora da conta). Em campo próprio não há impedimento.
  let deepestOpp = 0;
  for (let k = 1; k < opp.length; k++) deepestOpp = Math.max(deepestOpp, opp[k].x);
  const offsideLine = Math.max(50, deepestOpp);

  // 1) Papel de cada um
  for (const i of active) {
    const sx = base[i].x;
    const sy = base[i].y;
    const line = lineOf(sx);
    const wide = Math.abs(sy - 30) >= 13;
    const sign = sy >= 30 ? 1 : -1;
    const ballSameSide = (ballN.y - 30) * sign > 0;
    let dx = 0;
    let dy = 0;

    if (poss) {
      if (line === 'att') {
        const burst = Math.max(0, Math.sin(phase * 1.3 + i * 2.4));
        dx = 3 + 2 * lead + 3 * burst;
        dy = (i % 2 === 0 ? 1 : -1) * 3 * (0.5 + 0.5 * burst);
      } else if (wide) {
        if (ballSameSide) {
          dx = (line === 'def' ? 6 : 4) * (0.4 + 0.6 * lead);
          dy = sign * 2.5;
        } else {
          dx = 1.5;
          dy = -sign * 3.5;
        }
      } else if (line === 'mid') {
        dx = Math.min(0, ballN.x - 4 - out[i].x) * 0.4;
        dy = (ballN.y - out[i].y) * 0.12;
      } else {
        dy = (sy - 30) * 0.12;
      }
    } else if (line === 'att') {
      dx = -(4 + 3 * Math.max(0, -push));
      dy = (ballN.y - out[i].y) * 0.15;
    } else if (wide) {
      dx = -3;
      dy = ballSameSide ? 0 : -sign * 3;
    } else if (line === 'mid') {
      dx = -2;
      dy = (ballN.y - out[i].y) * 0.1;
    } else {
      dy = (ballN.y - out[i].y) * 0.05;
    }

    out[i].x += dx * d;
    out[i].y += dy * d;
  }

  // 2) Marcação individual sem a bola: cada defensor/volante fecha o atacante mais próximo, pelo lado do gol
  if (!poss && d > 0 && team.markingStrength > 0) {
    // Atribuição global pela menor distância (desempate por índice): quem está colado no atacante o marca,
    // em vez de quem aparece primeiro na lista.
    const pairs: { i: number; k: number; dist: number }[] = [];
    for (const i of active) {
      if (lineOf(base[i].x) === 'att') continue;
      for (let k = 1; k < opp.length; k++) {
        if (opp[k].x > 64) continue;
        const dist = Math.hypot(opp[k].x - out[i].x, opp[k].y - out[i].y);
        if (dist <= 22) pairs.push({ i, k, dist });
      }
    }
    pairs.sort((a, b) => a.dist - b.dist || a.i - b.i || a.k - b.k);
    const marker = new Set<number>();
    const marked = new Set<number>();
    const moves: { i: number; k: number }[] = [];
    for (const { i, k } of pairs) {
      if (marker.has(i) || marked.has(k)) continue;
      marker.add(i);
      marked.add(k);
      moves.push({ i, k });
    }
    // As posições de partida de todos são lidas antes de qualquer um se mover, para a ordem não importar.
    const start = out.map((s) => ({ x: s.x, y: s.y }));
    for (const { i, k } of moves) {
      const w = team.markingStrength * (lineOf(base[i].x) === 'def' ? 1 : 0.6) * d;
      const tx = opp[k].x - 2.2;
      const ty = opp[k].y + (30 - opp[k].y) * 0.08;
      out[i].x = start[i].x + (tx - start[i].x) * w;
      out[i].y = start[i].y + (ty - start[i].y) * w;
    }
  }

  // 3) Goleiro sai um pouco do gol quando o time ataca longe (goleiro-líbero)
  if (!excluded.has(0) && poss && ballN.x > 55) {
    out[0].x += Math.min(6, (ballN.x - 55) * 0.2) * d;
  }

  // 3b) Respiração individual (depois da marcação, para não mudar quem marca quem): cada um oscila com
  //     frequência e fase próprias, quebrando o movimento em bloco.
  for (const i of active) {
    out[i].x += Math.sin(phase * (0.9 + (i % 5) * 0.17) + i * 1.9) * 1.3 * d;
    out[i].y += Math.cos(phase * (0.7 + (i % 4) * 0.21) + i * 2.7) * 1.6 * d;
  }

  // 4) Espaçamento: dois do mesmo time não ocupam o mesmo ponto
  for (let a = 0; a < active.length; a++) {
    for (let b = a + 1; b < active.length; b++) {
      const p = out[active[a]];
      const q = out[active[b]];
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (dist >= MIN_SPACING) continue;
      const ux = dist > 1e-6 ? (q.x - p.x) / dist : Math.cos(active[a]);
      const uy = dist > 1e-6 ? (q.y - p.y) / dist : Math.sin(active[a]);
      const push2 = (MIN_SPACING - dist) / 2;
      p.x -= ux * push2;
      p.y -= uy * push2;
      q.x += ux * push2;
      q.y += uy * push2;
    }
  }

  // 5) Impedimento (depois do espaçamento, para nada empurrar um atacante além da linha): com a bola, os
  //    atacantes não passam do penúltimo adversário
  if (poss) {
    for (const i of active) {
      if (lineOf(base[i].x) === 'att') out[i].x = Math.min(out[i].x, offsideLine - 0.8);
    }
  }

  // 6) Limites do campo e zagueiros nunca além do meio-campo
  for (const i of active) {
    if (lineOf(base[i].x) === 'def') out[i].x = Math.min(out[i].x, 46);
    out[i].x = clamp(out[i].x, 3, 97);
    out[i].y = clamp(out[i].y, 4, 56);
  }
  if (!excluded.has(0)) {
    out[0].x = clamp(out[0].x, 3, 97);
    out[0].y = clamp(out[0].y, 4, 56);
  }
  for (const i of excluded) {
    if (i >= 0 && i < out.length) out[i] = { x: base[i].x, y: base[i].y };
  }

  return mirrored ? out.map(mirrorPoint) : out;
}

/** Alvos dos 22 jogadores: bloco (linhas sobem e descem) mais camada individual. */
export function computeMatchTargets(input: MatchTargetsInput): { home: Slot[]; away: Slot[] } {
  const { home, away, ball, momentum, phase, possessionSide, detail } = input;
  const blockOf = (t: TeamInput) =>
    computePlayerPositions({
      side: t.side,
      baseSlots: t.baseSlots,
      ball,
      momentum,
      currentMinute: phase,
      possessionSide,
      excluded: t.excluded,
      attackDir: t.attackDir,
    });
  const homeBlock = blockOf(home);
  const awayBlock = blockOf(away);
  return {
    home: applyIndividualBehavior({ team: home, block: homeBlock, oppBlock: awayBlock, ball, possessionSide, phase, detail }),
    away: applyIndividualBehavior({ team: away, block: awayBlock, oppBlock: homeBlock, ball, possessionSide, phase, detail }),
  };
}

// ── Integrador ─────────────────────────────────────────────────────────────────────────────────────────

/** Ganho da aproximação: perto do alvo o jogador desacelera em vez de parar de uma vez. */
const AGENT_GAIN = 5;
/** Velocidade da bola, em unidades do campo por segundo, na velocidade "Lento". */
export const BALL_MAX_SPEED = 70;

/**
 * Anda cada ponto em direção ao alvo, no máximo `maxSpeeds[i] * dtSec`. Puro: devolve pontos novos.
 * Listas de tamanhos diferentes (troca de formação, expulsão) viram o alvo direto.
 */
export function stepAgents(current: Slot[], targets: Slot[], dtSec: number, maxSpeeds: number[]): Slot[] {
  if (current.length !== targets.length) return targets.map((s) => ({ x: s.x, y: s.y }));
  return current.map((c, i) => {
    const t = targets[i];
    const dx = t.x - c.x;
    const dy = t.y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return { x: t.x, y: t.y };
    if (dtSec <= 0) return { x: c.x, y: c.y };
    const maxStep = (maxSpeeds[i] ?? 20) * dtSec;
    // Cada jogador reage com um ganho próprio (3,2 a 6,8): as linhas deixam de chegar juntas ao alvo.
    const gain = AGENT_GAIN * (0.64 + ((i * 7) % 11) * 0.072);
    const step = Math.min(maxStep, dist * Math.min(1, gain * dtSec));
    const f = step / dist;
    return { x: c.x + dx * f, y: c.y + dy * f };
  });
}

export function stepBall(current: Slot, target: Slot, dtSec: number, maxSpeed: number): Slot {
  return stepAgents([current], [target], dtSec, [maxSpeed])[0];
}

/**
 * Velocidade máxima de cada jogador (unidades por segundo) a partir do atributo `pace` (0..100).
 * Goleiro é mais lento; sem jogador conhecido, vale a média.
 */
export function agentMaxSpeeds(pace: (number | null | undefined)[], speedFactor: number): number[] {
  return pace.map((p, i) => {
    const p01 = clamp((p ?? 50) / 100, 0, 1);
    const base = i === 0 ? 12 : 16 + 14 * p01;
    return base * speedFactor;
  });
}

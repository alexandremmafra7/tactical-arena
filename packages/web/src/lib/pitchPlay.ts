import type { Slot } from './pitchPositions.js';

/**
 * Diretor de jogo do campo 2D: decide QUEM está com a bola, para QUEM ela vai e quando a posse muda.
 * É puro e determinístico (mesmo estado + mesmo contexto = mesmo resultado), então dá para testar sem React.
 *
 * O motor da partida só informa lances (chance, gol) quando o relógio chega neles. Por isso a construção
 * (passes, troca de posse) é sintetizada aqui, puxada pelo momento da partida (`momentum`), e o lance do
 * motor assume a bola quando chega: ela vai até o ponto da finalização, chuta, e a posse recomeça de
 * acordo com o desfecho (gol = saída de bola, defesa/trave/bloqueio/fora = goleiro do outro time).
 */

export type PlaySide = 'home' | 'away';
export type PlayKind = 'carry' | 'pass' | 'approach' | 'shot' | 'aftermath';
export type ShotOutcome = 'goal' | 'saved' | 'woodwork' | 'blocked' | 'off_target' | 'chance';

export interface PlayShot {
  /** Identifica o lance do motor, para não repetir a mesma finalização. */
  key: string;
  side: PlaySide;
  start: Slot;
  end: Slot;
  outcome: ShotOutcome;
}

export interface PlayState {
  /** Time com a bola. */
  side: PlaySide;
  /** Índice (0 a 10) do portador dentro do time com a bola. */
  carrier: number;
  /** Quem passou a bola para o portador atual (-1 se ninguém): evita o vai e volta. */
  previous: number;
  /** Índice do destino do passe em andamento (mesmo time de `side`). */
  receiver: number;
  kind: PlayKind;
  /** Segundos que o portador ainda segura a bola antes da próxima ação. */
  hold: number;
  /** Segundos desde que a ação atual começou (para não travar esperando chegar). */
  t: number;
  /** Contador que alimenta o sorteio determinístico. */
  seq: number;
  shot: PlayShot | null;
  /** Últimos lances já tratados. */
  handled: string[];
}

/** Chute que o motor já decidiu mas o relógio ainda não revelou (veio da espiada). */
export interface UpcomingShot {
  shot: PlayShot;
  /** Segundos reais até o relógio revelar o lance. Negativo = já deveria ter sido revelado. */
  eta: number;
}

export interface PlayContext {
  home: Slot[];
  away: Slot[];
  ball: Slot;
  /** Momento do mandante, 0 a 100. */
  momentum: number;
  homeAttacksRight: boolean;
  excludedHome?: ReadonlySet<number>;
  excludedAway?: ReadonlySet<number>;
  /** Lance do motor ainda não tratado (o chamador entrega o mais recente). */
  pending: PlayShot | null;
  /** Próximo chute já conhecido pela espiada; o campo prepara a jogada antes da revelação. */
  upcoming?: UpcomingShot | null;
  /** Fator de velocidade do relógio (SPEED_PROFILE[...].speed). */
  speed: number;
  dt: number;
}

export interface PlayStep {
  state: PlayState;
  ballTarget: Slot;
  /** Fração da velocidade máxima da bola: passe é mais lento que chute. */
  ballSpeedMul: number;
  /** O time está levando a bola ao ponto de um chute que ainda não foi revelado. */
  staging: boolean;
  /** 0 no começo da preparação, 1 quando o chute vai ser revelado. */
  stageProgress: number;
}

type CoreStep = Omit<PlayStep, 'staging' | 'stageProgress'>;

const NO_EXCLUDED: ReadonlySet<number> = new Set();
const PASS_SPEED_MUL = 0.55;
const SHOT_SPEED_MUL = 1;
/** A bola chega rápido ao ponto do chute: o lance já aconteceu no motor, o campo não pode chegar atrasado. */
const APPROACH_SPEED_MUL = 1.6;
const ARRIVE = 1.6;
/** Quanto antes da revelação o time começa a levar a bola ao ponto do chute. */
export const PREP_WINDOW = 4.5;
/** Passa a esperar o relógio quando a bola chega a esta distância do ponto do chute. */
const HOLD_NEAR = 7;
/** Passa mais rápido enquanto prepara o lance, para chegar a tempo. */
const STAGE_PASS_MUL = 1.1;
/** Se a revelação demora mais que isto além do previsto, a previsão é abandonada. */
const STAGE_GIVE_UP = -3;
const KICKOFF: Slot = { x: 50, y: 30 };

export function initialPlay(side: PlaySide = 'home'): PlayState {
  return { side, carrier: 9, receiver: 9, previous: -1, kind: 'carry', hold: 0.4, t: 0, seq: 1, shot: null, handled: [] };
}

/** Sorteio determinístico de 0 a 1 a partir de dois inteiros. */
export function rand01(seq: number, salt: number): number {
  let h = (Math.imul(seq | 0, 0x9e3779b1) ^ Math.imul((salt | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Chance de o time com a bola perdê-la neste passe: cresce quando o adversário domina a partida. */
export function turnoverChance(side: PlaySide, momentum: number): number {
  const m = Math.max(0, Math.min(100, momentum)) / 100;
  const opponentEdge = side === 'home' ? 1 - m : m;
  return 0.08 + 0.34 * opponentEdge;
}

/** Coluna em que a partida "pede" a bola, pelo momento. É a mesma regra da bola sem lance. */
export function zoneX(momentum: number, homeAttacksRight: boolean): number {
  const x = 10 + (Math.max(15, Math.min(85, momentum)) / 100) * 80;
  return homeAttacksRight ? x : 100 - x;
}

function teamOf(ctx: PlayContext, side: PlaySide): Slot[] {
  return side === 'home' ? ctx.home : ctx.away;
}

function excludedOf(ctx: PlayContext, side: PlaySide): ReadonlySet<number> {
  return (side === 'home' ? ctx.excludedHome : ctx.excludedAway) ?? NO_EXCLUDED;
}

function attacksRightFor(side: PlaySide, ctx: PlayContext): boolean {
  return (side === 'home') === ctx.homeAttacksRight;
}

/** Linha do campo pela profundidade: 0 zaga, 1 meio, 2 ataque. */
function lineOf(x: number, attackRight: boolean): number {
  const depth = attackRight ? x : 100 - x;
  return depth < 22 ? 0 : depth < 36 ? 1 : 2;
}

/** Escolhe para quem passar: gosta de passe de 8 a 20, de ir para frente e de ficar perto da zona do jogo. */
export function pickReceiver(
  team: Slot[],
  carrier: number,
  attackRight: boolean,
  desiredX: number,
  seq: number,
  excluded: ReadonlySet<number> = NO_EXCLUDED,
  avoid = -1,
  zoneWeight = 0.06,
): number {
  const c = team[carrier];
  if (!c) return carrier;
  const ownGoalX = attackRight ? 0 : 100;
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < team.length; i++) {
    if (i === carrier || excluded.has(i)) continue;
    const p = team[i];
    const dist = Math.hypot(p.x - c.x, p.y - c.y);
    const forward = attackRight ? p.x - c.x : c.x - p.x;
    let score = -Math.abs(dist - 14) * 0.08 + forward * 0.02 + (Math.abs(c.x - desiredX) - Math.abs(p.x - desiredX)) * zoneWeight;
    // Circular entre linhas (zaga, meio, ataque) em vez de ficar só entre os dois mais avançados.
    if (lineOf(p.x, attackRight) !== lineOf(c.x, attackRight)) score += 0.6;
    if (dist < 4) score -= 1.5;
    // Goleiro só recebe de quem está perto do próprio gol.
    if (i === 0 && Math.abs(c.x - ownGoalX) > 26) score -= 4;
    if (i === avoid) score -= 2.5;
    score += rand01(seq, i + 1) * 1.6;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best === -1 ? carrier : best;
}

function nearestIndex(team: Slot[], to: Slot, excluded: ReadonlySet<number>, skipGk = false): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = skipGk ? 1 : 0; i < team.length; i++) {
    if (excluded.has(i)) continue;
    const d = Math.hypot(team[i].x - to.x, team[i].y - to.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best === -1 ? 0 : best;
}

function holdFor(seq: number, speed: number): number {
  return (0.45 + rand01(seq, 91) * 0.7) / Math.max(0.5, speed);
}

function opposite(side: PlaySide): PlaySide {
  return side === 'home' ? 'away' : 'home';
}

/** Depois de um lance: quem pega a bola e onde. */
function restartAfter(shot: PlayShot, ctx: PlayContext, state: PlayState): PlayState {
  const conceding = opposite(shot.side);
  if (shot.outcome === 'goal') {
    // Saída de bola do time que sofreu o gol, no meio-campo.
    const team = teamOf(ctx, conceding);
    const starter = nearestIndex(team, KICKOFF, excludedOf(ctx, conceding), true);
    return { ...state, side: conceding, carrier: starter, receiver: starter, previous: -1, kind: 'carry', hold: 0.9 / Math.max(0.5, ctx.speed), t: 0, shot: null };
  }
  // Defesa, trave, bloqueio ou para fora: o goleiro de quem defendeu repõe.
  return { ...state, side: conceding, carrier: 0, receiver: 0, previous: -1, kind: 'carry', hold: 0.8 / Math.max(0.5, ctx.speed), t: 0, shot: null };
}

export function stepPlay(prev: PlayState, ctx: PlayContext): PlayStep {
  const pendingNew = !!ctx.pending && !prev.handled.includes(ctx.pending.key);
  const up = ctx.upcoming ?? null;
  const staging =
    up && !pendingNew && !isScene(prev) && !prev.handled.includes(up.shot.key) && up.eta <= PREP_WINDOW && up.eta > STAGE_GIVE_UP
      ? up.shot
      : null;
  const out = stepCore(prev, ctx, staging);
  const on = staging !== null && !isScene(out.state);
  const progress = on && up ? Math.max(0, Math.min(1, 1 - up.eta / PREP_WINDOW)) : 0;
  return { ...out, staging: on, stageProgress: progress };
}

function stepCore(prev: PlayState, ctx: PlayContext, staging: PlayShot | null): CoreStep {
  const speed = Math.max(0.5, ctx.speed);
  let s: PlayState = { ...prev, t: prev.t + ctx.dt };

  // 1. Lance novo do motor: a bola vai até o ponto da finalização.
  if (ctx.pending && !s.handled.includes(ctx.pending.key) && s.kind !== 'shot') {
    const shot = ctx.pending;
    const team = teamOf(ctx, shot.side);
    const shooter = nearestIndex(team, shot.start, excludedOf(ctx, shot.side), true);
    s = {
      ...s,
      side: shot.side,
      carrier: shooter,
      receiver: shooter,
      previous: -1,
      kind: 'approach',
      t: 0,
      hold: 0,
      shot,
      handled: [...s.handled.slice(-7), shot.key],
    };
  }

  const team = teamOf(ctx, s.side);
  const attackRight = attacksRightFor(s.side, ctx);

  switch (s.kind) {
    case 'approach': {
      const shot = s.shot!;
      const arrived = Math.hypot(ctx.ball.x - shot.start.x, ctx.ball.y - shot.start.y) < ARRIVE;
      if (arrived || s.t > 1.2 / speed) {
        s = { ...s, kind: 'shot', t: 0, hold: 0.18 / speed };
      }
      return { state: s, ballTarget: shot.start, ballSpeedMul: APPROACH_SPEED_MUL };
    }
    case 'shot': {
      const shot = s.shot!;
      if (s.hold > 0) {
        s = { ...s, hold: s.hold - ctx.dt };
        return { state: s, ballTarget: shot.start, ballSpeedMul: SHOT_SPEED_MUL };
      }
      const arrived = Math.hypot(ctx.ball.x - shot.end.x, ctx.ball.y - shot.end.y) < ARRIVE;
      if (arrived || s.t > 2 / speed) {
        s = { ...s, kind: 'aftermath', t: 0, hold: (shot.outcome === 'goal' ? 1.6 : 1) / speed };
      }
      return { state: s, ballTarget: shot.end, ballSpeedMul: SHOT_SPEED_MUL };
    }
    case 'aftermath': {
      const shot = s.shot!;
      if (s.hold > 0) {
        s = { ...s, hold: s.hold - ctx.dt };
        return { state: s, ballTarget: shot.end, ballSpeedMul: SHOT_SPEED_MUL };
      }
      s = restartAfter(shot, ctx, s);
      const t = teamOf(ctx, s.side)[s.carrier] ?? KICKOFF;
      return { state: s, ballTarget: t, ballSpeedMul: PASS_SPEED_MUL };
    }
    case 'pass': {
      const target = team[s.receiver] ?? ctx.ball;
      const arrived = Math.hypot(ctx.ball.x - target.x, ctx.ball.y - target.y) < ARRIVE;
      if (arrived || s.t > 3 / speed) {
        s = { ...s, previous: s.carrier, carrier: s.receiver, kind: 'carry', t: 0, hold: holdFor(s.seq, speed) * (staging ? 0.5 : 1), seq: s.seq + 1 };
      }
      return { state: s, ballTarget: target, ballSpeedMul: staging ? STAGE_PASS_MUL : PASS_SPEED_MUL };
    }
    default: {
      // carry: o portador segura a bola e, quando acaba o tempo, passa (ou perde a posse).
      const holder = team[s.carrier] ?? ctx.ball;
      if (staging) {
        if (s.side !== staging.side) {
          // O time do lance toma a bola: o jogador mais perto dela a recebe.
          const taker = nearestIndex(teamOf(ctx, staging.side), ctx.ball, excludedOf(ctx, staging.side));
          s = { ...s, side: staging.side, receiver: taker, previous: -1, kind: 'pass', t: 0, seq: s.seq + 1 };
          return { state: s, ballTarget: teamOf(ctx, staging.side)[taker] ?? holder, ballSpeedMul: STAGE_PASS_MUL };
        }
        // Já está no ponto do chute: segura a bola até o relógio revelar o lance.
        if (Math.hypot(ctx.ball.x - staging.start.x, ctx.ball.y - staging.start.y) < HOLD_NEAR) {
          return { state: s, ballTarget: holder, ballSpeedMul: PASS_SPEED_MUL };
        }
      }
      if (s.hold > 0) {
        s = { ...s, hold: s.hold - ctx.dt * (staging ? 2 : 1) };
        return { state: s, ballTarget: holder, ballSpeedMul: PASS_SPEED_MUL };
      }
      const seq = s.seq + 1;
      if (!staging && rand01(seq, 7) < turnoverChance(s.side, ctx.momentum)) {
        const other = opposite(s.side);
        const taker = nearestIndex(teamOf(ctx, other), ctx.ball, excludedOf(ctx, other));
        s = { ...s, side: other, receiver: taker, previous: -1, kind: 'pass', t: 0, seq };
        return { state: s, ballTarget: teamOf(ctx, other)[taker] ?? holder, ballSpeedMul: PASS_SPEED_MUL };
      }
      const receiver = staging
        ? pickReceiver(team, s.carrier, attackRight, staging.start.x, seq, excludedOf(ctx, s.side), s.previous, 0.25)
        : pickReceiver(team, s.carrier, attackRight, zoneX(ctx.momentum, ctx.homeAttacksRight), seq, excludedOf(ctx, s.side), s.previous);
      s = { ...s, receiver, kind: 'pass', t: 0, seq };
      return { state: s, ballTarget: team[receiver] ?? holder, ballSpeedMul: staging ? STAGE_PASS_MUL : PASS_SPEED_MUL };
    }
  }
}

/** Peso da zona do jogo na posição que o bloco de jogadores enxerga (o resto é a bola de verdade). */
export const ZONE_ANCHOR = 0.55;

/**
 * Posição de bola que serve de referência para montar o bloco dos times. A bola agora circula entre
 * jogadores; se o bloco seguisse só a bola, nada o prenderia ao momento da partida. Misturar com a zona do
 * jogo mantém o campo coerente com a simulação e ainda deixa a bola e o portador visíveis.
 */
export function anchoredBall(ball: Slot, momentum: number, homeAttacksRight: boolean, weight = ZONE_ANCHOR): Slot {
  const zone = zoneX(momentum, homeAttacksRight);
  return { x: ball.x + (zone - ball.x) * weight, y: ball.y };
}

/**
 * Posição de bola que o bloco enxerga enquanto o time prepara um chute: vai do ponto onde a bola está até o ponto do
 * chute à medida que a revelação se aproxima. Sem isto o bloco só segue a bola e ninguém "sobe" para os passes
 * irem para frente.
 */
export function stagedBall(ball: Slot, start: Slot, progress: number): Slot {
  return { x: ball.x + (start.x - ball.x) * progress, y: ball.y + (start.y - ball.y) * progress * 0.5 };
}

/** Quanto o time do lance sobe, no máximo, e quanto o adversário recua, ao fim da preparação. */
const STAGE_PUSH = 26;
const STAGE_RETREAT = 14;

/**
 * Sobe o bloco do time do lance em direção ao gol adversário (e faz o adversário recuar um pouco) à medida que
 * a revelação se aproxima. O bloco normal só desloca o time uns 8 pontos pela posição da bola e só os três
 * mais perto dela chegam até ela, então sem isto o ataque nunca passa do meio-campo para os passes irem à frente.
 * Goleiros e expulsos não se mexem.
 */
export function stagedTargets(
  targets: { home: Slot[]; away: Slot[] },
  side: PlaySide,
  homeAttacksRight: boolean,
  progress: number,
  excludedHome: ReadonlySet<number> = NO_EXCLUDED,
  excludedAway: ReadonlySet<number> = NO_EXCLUDED,
): { home: Slot[]; away: Slot[] } {
  if (progress <= 0) return targets;
  const dir = (side === 'home') === homeAttacksRight ? 1 : -1;
  const shift = (team: Slot[], dx: number, excluded: ReadonlySet<number>) =>
    team.map((p, i) => (i === 0 || excluded.has(i) ? p : { x: Math.max(3, Math.min(97, p.x + dir * dx)), y: p.y }));
  const homeIsAttacker = side === 'home';
  return {
    home: shift(targets.home, (homeIsAttacker ? STAGE_PUSH : STAGE_RETREAT) * progress, excludedHome),
    away: shift(targets.away, (homeIsAttacker ? STAGE_RETREAT : STAGE_PUSH) * progress, excludedAway),
  };
}

/** Cena de lance do motor em andamento (chegada, chute ou depois do chute). */
export function isScene(state: PlayState): boolean {
  return state.kind === 'approach' || state.kind === 'shot' || state.kind === 'aftermath';
}

/** Peso da zona enquanto uma cena roda: o bloco acompanha a bola de verdade. */
export const SCENE_ANCHOR = 0.1;

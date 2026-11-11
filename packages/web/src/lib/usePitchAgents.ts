import { useEffect, useRef, useState } from 'react';
import {
  BALL_MAX_SPEED,
  SPEED_PROFILE,
  agentMaxSpeeds,
  stepAgents,
  stepBall,
  type SpeedKey,
} from './pitchMotion.js';
import { anchoredBall, initialPlay, isScene, SCENE_ANCHOR, stagedBall, stagedTargets, ZONE_ANCHOR, stepPlay, type PlayShot, type PlaySide, type PlayState } from './pitchPlay.js';
import type { Slot } from './pitchPositions.js';

export interface PitchFrame {
  home: Slot[];
  away: Slot[];
  ball: Slot;
  /** Quem está com a bola agora (posse e portador). */
  possession: { side: PlaySide; carrier: number };
}

export interface UsePitchAgentsParams {
  /** Alvos dos 22 jogadores dado onde a bola está agora. Deve ser puro; é chamado a cada passo. */
  computeTargets: (ball: Slot, phase: number, detail: number, possessionSide: PlaySide) => { home: Slot[]; away: Slot[] };
  /** Onde a bola começa e onde ela fica com a animação reduzida. */
  ballTarget: Slot;
  /** Lance do motor para jogar agora (gol/chance); null se não houver. */
  pendingShot: PlayShot | null;
  /** Próximo chute já conhecido (espiada do motor): quantos minutos de jogo faltam e quanto dura um minuto. */
  upcoming?: { shot: PlayShot; minutesAhead: number; minuteMs: number } | null;
  momentum: number;
  homeAttacksRight: boolean;
  excludedHome?: ReadonlySet<number>;
  excludedAway?: ReadonlySet<number>;
  /** Muda quando os jogadores precisam aparecer direto no alvo, sem deslizar (troca de lado, de formação). */
  resetKey: string;
  speedKey: SpeedKey;
  isPaused: boolean;
  homePace: (number | null | undefined)[];
  awayPace: (number | null | undefined)[];
}

/** ~30 quadros por segundo: a 10 Hz o movimento parecia dar saltos. */
const STEP_MS = 33;
/** Velocidade do micro movimento: segundos reais vezes este fator. */
const PHASE_RATE = 0.6;

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/**
 * Mantém os 22 jogadores e a bola andando de verdade: a cada 100 ms recalcula os alvos olhando para onde a
 * bola está AGORA (a bola também anda, com velocidade limitada) e move cada jogador até o seu alvo.
 * O ritmo depende só de `speedKey` (perfil de velocidade), então as quatro velocidades usam o mesmo código.
 *
 * Na renderização no servidor (testes com renderToStaticMarkup) os efeitos não rodam: vale o quadro inicial,
 * que já são os alvos calculados.
 */
export function usePitchAgents(params: UsePitchAgentsParams): PitchFrame {
  const latest = useRef(params);
  latest.current = params;

  const [frame, setFrame] = useState<PitchFrame>(() => {
    const profile = SPEED_PROFILE[params.speedKey];
    const targets = params.computeTargets(params.ballTarget, 0, profile.detail, 'home');
    return { home: targets.home, away: targets.away, ball: { ...params.ballTarget }, possession: { side: 'home', carrier: 9 } };
  });
  const frameRef = useRef(frame);
  const phaseRef = useRef(0);
  const playRef = useRef<PlayState>(initialPlay());
  // Quando (relógio do navegador) o relógio da partida vai revelar o chute que já se conhece.
  const deadlineRef = useRef<{ key: string; at: number } | null>(null);
  const upKey = params.upcoming?.shot.key;
  const upAhead = params.upcoming?.minutesAhead;
  useEffect(() => {
    const u = latest.current.upcoming;
    deadlineRef.current = u ? { key: u.shot.key, at: performance.now() + u.minutesAhead * u.minuteMs } : null;
    // Ao despausar, o prazo recomeça a contar a partir de agora.
  }, [upKey, upAhead, params.isPaused]);

  // Troca de lado, de formação, expulsão: aparece direto no lugar, sem atravessar o campo.
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) {
      firstReset.current = false;
      return;
    }
    const p = latest.current;
    const profile = SPEED_PROFILE[p.speedKey];
    // A bola volta para o centro da zona do jogo e a posse recomeça do mandante (ou de quem estava com ela).
    const restart: PlayState = { ...initialPlay(playRef.current.side), handled: playRef.current.handled, seq: playRef.current.seq };
    playRef.current = restart;
    const targets = p.computeTargets(frameRef.current.ball, phaseRef.current, profile.detail, restart.side);
    const snapped: PitchFrame = {
      home: targets.home,
      away: targets.away,
      ball: frameRef.current.ball,
      possession: { side: restart.side, carrier: restart.carrier },
    };
    frameRef.current = snapped;
    setFrame(snapped);
  }, [params.resetKey]);

  useEffect(() => {
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;

      const p = latest.current;
      // Pausado, o relógio para; mas a jogada de um gol/chance já revelado termina de ser mostrada.
      const pendingKey = p.pendingShot?.key;
      const sceneNow = isScene(playRef.current) || (pendingKey !== undefined && !playRef.current.handled.includes(pendingKey));
      if (p.isPaused && !sceneNow) return;

      const profile = SPEED_PROFILE[p.speedKey];
      const reduce = prefersReducedMotion();
      phaseRef.current += dt * PHASE_RATE;

      const prev = frameRef.current;
      // O diretor decide posse e destino da bola olhando para onde os jogadores estão agora.
      const play = stepPlay(playRef.current, {
        home: prev.home,
        away: prev.away,
        ball: prev.ball,
        momentum: p.momentum,
        homeAttacksRight: p.homeAttacksRight,
        excludedHome: p.excludedHome,
        excludedAway: p.excludedAway,
        pending: p.pendingShot,
        upcoming: p.upcoming && deadlineRef.current?.key === p.upcoming.shot.key
          ? { shot: p.upcoming.shot, eta: (deadlineRef.current.at - performance.now()) / 1000 }
          : null,
        speed: profile.speed,
        dt,
      });
      playRef.current = play.state;
      const possession = { side: play.state.side, carrier: play.state.carrier };
      const ball = reduce
        ? { ...play.ballTarget }
        : stepBall(prev.ball, play.ballTarget, dt, BALL_MAX_SPEED * profile.speed * play.ballSpeedMul);
      const base = p.computeTargets(play.staging && p.upcoming ? stagedBall(ball, p.upcoming.shot.start, play.stageProgress) : anchoredBall(ball, p.momentum, p.homeAttacksRight, isScene(play.state) ? SCENE_ANCHOR : ZONE_ANCHOR), phaseRef.current, profile.detail, play.state.side);
      // Preparando um chute que ainda não foi revelado: o time do lance sobe o bloco rumo ao gol adversário.
      const targets = play.staging && p.upcoming
        ? stagedTargets(base, p.upcoming.shot.side, p.homeAttacksRight, play.stageProgress, p.excludedHome, p.excludedAway)
        : base;
      const next: PitchFrame = reduce
        ? { home: targets.home, away: targets.away, ball, possession }
        : {
            home: stepAgents(prev.home, targets.home, dt, agentMaxSpeeds(p.homePace, profile.speed)),
            away: stepAgents(prev.away, targets.away, dt, agentMaxSpeeds(p.awayPace, profile.speed)),
            ball,
            possession,
          };
      frameRef.current = next;
      setFrame(next);
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return frame;
}

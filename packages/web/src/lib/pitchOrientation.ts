export type PitchPeriod = '1T' | '2T';
export type PitchSide = 'home' | 'away';

export interface PitchPoint {
  x: number;
  y: number;
}

/**
 * Para qual gol cada time ataca. No 1º tempo o mandante ataca para a direita (+x); no intervalo os times
 * trocam de lado, então no 2º tempo é o visitante que ataca para a direita. O campo é um retângulo 100x60
 * visto de cima, e a troca é uma rotação de 180 graus (x e y), que mantém cada lateral no lado que era dele.
 */
export function attacksRight(side: PitchSide, period: PitchPeriod): boolean {
  return (side === 'home') === (period === '1T');
}

/**
 * Período em que um evento aconteceu. O próprio evento manda: um lance dos acréscimos do 1º tempo continua no
 * lado do 1º tempo mesmo quando o evento é reaberto já no 2º. Sem `period`, vale o minuto.
 */
export function eventPeriod(ev: { period?: PitchPeriod; minute: number }): PitchPeriod {
  return ev.period ?? (ev.minute > 45 ? '2T' : '1T');
}

/** Rotação de 180 graus do campo, usada para trabalhar sempre com "o time ataca para +x". */
export function mirrorPoint<T extends PitchPoint>(p: T): T {
  return { ...p, x: 100 - p.x, y: 60 - p.y };
}

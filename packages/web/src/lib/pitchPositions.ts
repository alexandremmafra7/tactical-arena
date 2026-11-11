export interface Slot {
  x: number;
  y: number;
}

export interface ComputePositionsParams {
  side: 'home' | 'away';
  baseSlots: Slot[];
  ball: Slot;
  momentum: number;
  currentMinute: number;
  possessionSide: 'home' | 'away';
  excluded?: Set<number> | number[];
  /**
   * Para que lado o time ataca. Sem informar, mandante ataca para a direita e visitante para a esquerda
   * (1º tempo). `baseSlots` e `ball` estão sempre na orientação real do campo.
   */
  attackDir?: 'left' | 'right';
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function computePlayerPositions({
  side,
  baseSlots,
  ball,
  momentum,
  currentMinute,
  possessionSide,
  excluded = [],
  attackDir,
}: ComputePositionsParams): Slot[] {
  const mirrored = (attackDir ?? (side === 'home' ? 'right' : 'left')) === 'left';
  const excludedSet = new Set(excluded);

  const normBall = mirrored ? { x: 100 - ball.x, y: 60 - ball.y } : { ...ball };
  const normSlots = mirrored ? baseSlots.map(s => ({ x: 100 - s.x, y: 60 - s.y })) : baseSlots.map(s => ({ ...s }));

  const push = clamp((normBall.x - 50) / 50, -1, 1);
  const poss = possessionSide === side;

  const computed: Slot[] = normSlots.map((slot, idx) => {
    if (excludedSet.has(idx)) {
      return { ...slot };
    }
    if (idx === 0) {
      const gkY = clamp(30 + (normBall.y - 30) * 0.3, 24.5, 35.5);
      return { x: slot.x, y: gkY };
    }

    const sx = slot.x;
    let dx = 0;
    if (sx <= 22) {
      dx = 9 * push + (poss ? 3 : -3);
    } else if (sx <= 50) {
      dx = 11 * push + (poss ? 3 : -3);
    } else {
      dx = 6 * push + (poss ? 2 : 0);
    }

    let x = sx + dx;
    let y = slot.y;
    return { x, y };
  });

  let sumX = 0;
  let countX = 0;
  for (let i = 1; i < computed.length; i++) {
    if (!excludedSet.has(i)) {
      sumX += computed[i].x;
      countX++;
    }
  }
  const meanX = countX > 0 ? sumX / countX : 30;

  for (let i = 1; i < computed.length; i++) {
    if (excludedSet.has(i)) continue;
    computed[i].x = meanX + (computed[i].x - meanX) * (1 - 0.18 * Math.abs(push));
    computed[i].y += (normBall.y - computed[i].y) * 0.18;
  }

  const outfieldIndices: number[] = [];
  for (let i = 1; i < computed.length; i++) {
    if (!excludedSet.has(i)) {
      outfieldIndices.push(i);
    }
  }

  outfieldIndices.sort((a, b) => {
    const distA = Math.hypot(computed[a].x - normBall.x, computed[a].y - normBall.y);
    const distB = Math.hypot(computed[b].x - normBall.x, computed[b].y - normBall.y);
    if (Math.abs(distA - distB) < 1e-6) {
      return a - b;
    }
    return distA - distB;
  });

  const top3 = outfieldIndices.slice(0, 3);

  if (poss) {
    if (top3.length > 0) {
      const idx = top3[0];
      const p = computed[idx];
      const targetX = normBall.x;
      const targetY = normBall.y;
      const dX = (targetX - p.x) * 0.6;
      const dY = (targetY - p.y) * 0.6;
      const dist = Math.hypot(dX, dY);
      const limit = Math.min(dist, 10);
      const factor = dist > 0 ? limit / dist : 0;
      p.x += dX * factor;
      p.y += dY * factor;
    }
    for (let k = 1; k < top3.length; k++) {
      const idx = top3[k];
      const p = computed[idx];
      const supportY = p.y < normBall.y ? normBall.y - 7 : normBall.y + 7;
      const targetX = normBall.x + 5;
      const targetY = supportY;
      const weight = k === 1 ? 0.35 : 0.2;
      const dX = (targetX - p.x) * weight;
      const dY = (targetY - p.y) * weight;
      const dist = Math.hypot(dX, dY);
      const limit = Math.min(dist, 10);
      const factor = dist > 0 ? limit / dist : 0;
      p.x += dX * factor;
      p.y += dY * factor;
    }
  } else {
    const weights = [0.6, 0.4, 0.25];
    for (let k = 0; k < top3.length; k++) {
      const idx = top3[k];
      const p = computed[idx];
      const targetX = normBall.x;
      const targetY = normBall.y;
      const weight = weights[k] ?? 0.25;
      const dX = (targetX - p.x) * weight;
      const dY = (targetY - p.y) * weight;
      const dist = Math.hypot(dX, dY);
      const limit = Math.min(dist, 10);
      const factor = dist > 0 ? limit / dist : 0;
      p.x += dX * factor;
      p.y += dY * factor;
    }
  }

  for (let i = 0; i < computed.length; i++) {
    if (excludedSet.has(i)) continue;
    const p = computed[i];
    const isGk = i === 0;
    const playerSeedIndex = side === 'away' ? i + 11 : i;

    const dy = Math.sin(currentMinute * 2 + playerSeedIndex) * (isGk ? 0.3 * 1.2 : 1.2);
    const dx = isGk ? 0 : Math.cos(currentMinute * 1.3 + playerSeedIndex * 2.1) * 0.8;

    p.x += dx;
    p.y += dy;

    const baseSx = normSlots[i].x;
    if (baseSx <= 22 && !isGk) {
      p.x = Math.min(p.x, 46);
    }

    p.x = clamp(p.x, 3, 97);
    p.y = clamp(p.y, 4, 56);
  }

  if (mirrored) {
    return computed.map(s => ({ x: 100 - s.x, y: 60 - s.y }));
  }

  return computed;
}

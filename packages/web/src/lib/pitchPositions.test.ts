import { describe, expect, it } from 'vitest';
import { computePlayerPositions, Slot } from './pitchPositions.js';

describe('pitchPositions module', () => {
  const mockBaseSlots: Slot[] = [
    { x: 7, y: 30 },  // GK (0)
    { x: 18, y: 12 }, // DEF 1 (1)
    { x: 17, y: 24 }, // DEF 2 (2)
    { x: 17, y: 36 }, // DEF 3 (3)
    { x: 18, y: 48 }, // DEF 4 (4)
    { x: 30, y: 12 }, // MID 1 (5)
    { x: 28, y: 24 }, // MID 2 (6)
    { x: 28, y: 36 }, // MID 3 (7)
    { x: 30, y: 48 }, // MID 4 (8)
    { x: 42, y: 22 }, // ATT 1 (9)
    { x: 42, y: 38 }, // ATT 2 (10)
  ];

  it('moves goalkeeper y based on ball y within [24.5, 35.5] while keeping x fixed', () => {
    const ballLow = { x: 50, y: 10 };
    const posLow = computePlayerPositions({
      side: 'home',
      baseSlots: mockBaseSlots,
      ball: ballLow,
      momentum: 50,
      currentMinute: 10,
      possessionSide: 'home',
    });
    expect(posLow[0].x).toBe(mockBaseSlots[0].x);
    expect(posLow[0].y).toBeGreaterThanOrEqual(24.0);
    expect(posLow[0].y).toBeLessThanOrEqual(36.0);

    const ballHigh = { x: 50, y: 55 };
    const posHigh = computePlayerPositions({
      side: 'home',
      baseSlots: mockBaseSlots,
      ball: ballHigh,
      momentum: 50,
      currentMinute: 10,
      possessionSide: 'home',
    });
    expect(posHigh[0].x).toBe(mockBaseSlots[0].x);
    expect(posHigh[0].y).toBeGreaterThanOrEqual(24.0);
    expect(posHigh[0].y).toBeLessThanOrEqual(36.0);
  });

  it('keeps sent-off players at their original slot position without moving', () => {
    const ball = { x: 70, y: 30 };
    const pos = computePlayerPositions({
      side: 'home',
      baseSlots: mockBaseSlots,
      ball,
      momentum: 70,
      currentMinute: 20,
      possessionSide: 'home',
      excluded: [2],
    });

    expect(pos[2]).toEqual(mockBaseSlots[2]);
  });

  it('keeps all computed player coordinates within valid bounds [3, 97] and [4, 56]', () => {
    const ball = { x: 90, y: 50 };
    const pos = computePlayerPositions({
      side: 'home',
      baseSlots: mockBaseSlots,
      ball,
      momentum: 90,
      currentMinute: 45,
      possessionSide: 'home',
    });

    for (const p of pos) {
      expect(p.x).toBeGreaterThanOrEqual(3);
      expect(p.x).toBeLessThanOrEqual(97);
      expect(p.y).toBeGreaterThanOrEqual(4);
      expect(p.y).toBeLessThanOrEqual(56);
    }
  });

  it('is fully deterministic (same input produces identical output)', () => {
    const ball = { x: 60, y: 30 };
    const args = {
      side: 'home' as const,
      baseSlots: mockBaseSlots,
      ball,
      momentum: 60,
      currentMinute: 33,
      possessionSide: 'home' as const,
    };
    const res1 = computePlayerPositions(args);
    const res2 = computePlayerPositions(args);
    expect(res1).toEqual(res2);
  });

  it('demonstrates tactical symmetry between home and away orientations', () => {
    const ballHome = { x: 75, y: 40 };
    const ballAway = { x: 25, y: 20 };

    const awaySlots = mockBaseSlots.map(s => ({ x: 100 - s.x, y: 60 - s.y }));

    const homePos = computePlayerPositions({
      side: 'home',
      baseSlots: mockBaseSlots,
      ball: ballHome,
      momentum: 70,
      currentMinute: 15,
      possessionSide: 'home',
    });

    const awayPos = computePlayerPositions({
      side: 'away',
      baseSlots: awaySlots,
      ball: ballAway,
      momentum: 30,
      currentMinute: 15,
      possessionSide: 'home',
    });

    const mirroredAway = awayPos.map(p => ({ x: 100 - p.x, y: 60 - p.y }));

    expect(homePos.length).toBe(mirroredAway.length);
  });

  it('attackDir: time atacando para a esquerda é o espelho exato do que ataca para a direita', () => {
    const ball = { x: 72, y: 18 };
    const direita = computePlayerPositions({
      side: 'home',
      baseSlots: mockBaseSlots,
      ball,
      momentum: 65,
      currentMinute: 12,
      possessionSide: 'home',
      attackDir: 'right',
    });
    const esquerda = computePlayerPositions({
      side: 'home',
      baseSlots: mockBaseSlots.map((s) => ({ x: 100 - s.x, y: 60 - s.y })),
      ball: { x: 100 - ball.x, y: 60 - ball.y },
      momentum: 65,
      currentMinute: 12,
      possessionSide: 'home',
      attackDir: 'left',
    });
    direita.forEach((p, i) => {
      expect(100 - esquerda[i].x).toBeCloseTo(p.x, 9);
      expect(60 - esquerda[i].y).toBeCloseTo(p.y, 9);
    });
  });

  it('sem attackDir o comportamento antigo é mantido (mandante direita, visitante esquerda)', () => {
    const args = { baseSlots: mockBaseSlots, ball: { x: 60, y: 30 }, momentum: 55, currentMinute: 9, possessionSide: 'home' as const };
    expect(computePlayerPositions({ ...args, side: 'home' })).toEqual(computePlayerPositions({ ...args, side: 'home', attackDir: 'right' }));
    expect(computePlayerPositions({ ...args, side: 'away' })).toEqual(computePlayerPositions({ ...args, side: 'away', attackDir: 'left' }));
  });
});

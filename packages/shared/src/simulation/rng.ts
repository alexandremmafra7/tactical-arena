/** Deterministic PRNG (mulberry32) returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hashes an arbitrary string seed into a 32-bit int usable by mulberry32. */
export function hashSeed(seed: string): number {
  let h = 0xdeadbeef;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

export function createRng(seed: string): () => number {
  return mulberry32(hashSeed(seed));
}

/**
 * A resumable variant for live/pausable simulations: mulberry32's whole state is one 32-bit int, so
 * exposing it lets a match be simulated in chunks across separate requests (persist `getState()`
 * between calls, rebuild with `resumableRngFromState` next time) instead of needing one uninterrupted
 * function call. `createRng` above stays untouched for every other (non-resumable) caller — this is the
 * exact same algorithm, just with its internal state readable instead of hidden in the closure.
 */
export interface ResumableRng {
  next: () => number;
  getState: () => number;
}

export function resumableRngFromState(state: number): ResumableRng {
  let a = state;
  return {
    next: () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState: () => a,
  };
}

export function createResumableRng(seed: string): ResumableRng {
  return resumableRngFromState(hashSeed(seed));
}

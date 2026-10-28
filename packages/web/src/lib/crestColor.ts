/**
 * The club's own colour, pulled out of its crest.
 *
 * Every screen was the same gold-on-black regardless of who you managed, which is a lot of personality to
 * leave on the table when each club already ships a crest full of it. Rather than adding a colour column
 * nobody would maintain (and that mod packs would immediately get wrong), this samples the crest that is
 * already on screen — so a club imported by a player through the team editor themes itself for free.
 */

const CACHE = new Map<string, string | null>();

/** Ignore near-white, near-black and grey pixels: crests are mostly outline and background. */
function isChromatic(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 40 || min > 225) return false;
  return max - min > 40;
}

/** Nudges a sampled colour into a range that stays legible as an accent on the dark UI. */
export function normalize(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  // Too dark to read against near-black panels, or so pale it washes out — pull it back toward mid.
  const target = Math.min(0.62, Math.max(0.42, l));
  const scale = l === 0 ? 1 : target / l;
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v * scale)));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

/**
 * Dominant chromatic colour of `src`, or null if it can't be read (missing crest, tainted canvas, a crest
 * that is purely black and white). Cached per URL — the dashboard re-renders far more often than crests change.
 */
export async function dominantCrestColor(src: string): Promise<string | null> {
  const cached = CACHE.get(src);
  if (cached !== undefined) return cached;

  const result = await new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Bucket by coarse hue-ish key so shades of the same colour reinforce each other.
        const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
          if (a < 128 || !isChromatic(r, g, b)) continue;
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const e = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
          e.count++;
          e.r += r;
          e.g += g;
          e.b += b;
          buckets.set(key, e);
        }
        if (buckets.size === 0) return resolve(null);

        const best = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
        resolve(normalize(best.r / best.count, best.g / best.count, best.b / best.count));
      } catch {
        // Canvas can be tainted by cross-origin rules — fall back to the default theme rather than crash.
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

  CACHE.set(src, result);
  return result;
}

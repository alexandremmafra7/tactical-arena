import { getApiBase } from '../api/client.js';
import { normalize } from './crestColor.js';

/**
 * The club's real kit colour, from content/kits.json (slug → hex, no '#').
 *
 * This is the primary source for club theming: it's shipped by the content pipeline like the crests, so
 * the club's own accent colour comes from its actual jersey rather than being sampled out of an image at
 * runtime. Where a club has no kit entry (mod-pack clubs, clubs added after this file shipped) the caller
 * falls back to sampling the crest — see useClubColor.ts.
 */

const CACHE = new Map<string, Map<string, string>>();

/** slug → hex (no '#'), or an empty map when the file isn't there (e.g. an older embedded server). */
export async function getKitColors(): Promise<Map<string, string>> {
  const cached = CACHE.get('all');
  if (cached !== undefined) return cached;

  try {
    let res = await fetch('kits.json').catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`${getApiBase()}/kits.json`).catch(() => null);
    }
    if (!res || !res.ok) throw new Error(`kits.json not found`);
    const json = (await res.json()) as Record<string, string>;
    const map = new Map(Object.entries(json));
    CACHE.set('all', map);
    return map;
  } catch {
    CACHE.set('all', new Map());
    return new Map();
  }

}

/** A kit colour as a legible accent on the dark UI, or null when there's no entry for `slug`. */
export async function kitAccent(slug: string): Promise<string | null> {
  const hex = (await getKitColors()).get(slug);
  if (!hex) return null;
  const value = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!/^[0-9A-Fa-f]{6}$/.test(value)) return null;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return normalize(r, g, b);
}

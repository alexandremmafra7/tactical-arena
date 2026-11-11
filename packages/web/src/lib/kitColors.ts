import { getApiBase } from '../api/client.js';
import { normalize } from './crestColor.js';

export interface KitDefinition {
  primary: string;
  secondary?: string;
  accent?: string;
}

export type KitEntry = KitDefinition | string;

const CACHE = new Map<string, Map<string, KitDefinition>>();

export async function getKitColorsMap(): Promise<Map<string, KitDefinition>> {
  const cached = CACHE.get('all');
  if (cached !== undefined) return cached;

  try {
    let res = await fetch('kits.json').catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`${getApiBase()}/kits.json`).catch(() => null);
    }
    if (!res || !res.ok) throw new Error(`kits.json not found`);
    const json = (await res.json()) as Record<string, KitEntry>;
    const map = new Map<string, KitDefinition>();
    for (const [slug, val] of Object.entries(json)) {
      if (typeof val === 'string') {
        map.set(slug, { primary: val });
      } else if (val && typeof val === 'object' && typeof val.primary === 'string') {
        map.set(slug, {
          primary: val.primary,
          secondary: val.secondary,
          accent: val.accent,
        });
      }
    }
    CACHE.set('all', map);
    return map;
  } catch {
    const empty = new Map<string, KitDefinition>();
    CACHE.set('all', empty);
    return empty;
  }
}

/** Legacy helper returning slug -> primary hex string map */
export async function getKitColors(): Promise<Map<string, string>> {
  const map = await getKitColorsMap().catch(() => new Map<string, KitDefinition>());
  const res = new Map<string, string>();
  for (const [slug, kit] of map.entries()) {
    res.set(slug, kit.primary);
  }
  return res;
}

function normalizeHex(hex: string): string | null {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return `#${clean.toLowerCase()}`;
}

export async function getKit(slug: string): Promise<{ primary: string; secondary: string | null } | null> {
  const map = await getKitColorsMap().catch(() => new Map<string, KitDefinition>());
  const entry = map.get(slug);
  if (!entry) return null;
  const primary = normalizeHex(entry.primary);
  if (!primary) return null;
  const secondary = entry.secondary ? normalizeHex(entry.secondary) : null;
  return { primary, secondary };
}

/** A kit colour as a legible accent on the dark UI, or null when there's no entry for `slug`. */
export async function kitAccent(slug: string): Promise<string | null> {
  const kit = await getKit(slug).catch(() => null);
  if (!kit) return null;
  const value = kit.primary.startsWith('#') ? kit.primary.slice(1) : kit.primary;
  if (!/^[0-9A-Fa-f]{6}$/.test(value)) return null;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return normalize(r, g, b);
}

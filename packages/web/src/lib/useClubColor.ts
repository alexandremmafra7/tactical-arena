import { useEffect, useState } from 'react';
import type { Club } from '@tactical-arena/shared';
import { crestUrl } from '../api/client.js';
import { dominantCrestColor } from './crestColor.js';
import { kitAccent } from './kitColors.js';

/**
 * The club's colour. Its real kit colour from the content pipeline's kits.json when one shipped for this
 * club, otherwise sampled from its crest — see crestColor.ts for why the crest path reads the image rather
 * than a stored field. Null until it resolves, and null for good if the club has neither a kit colour nor a
 * crest with a usable colour in it; every caller treats that as "keep the default theme".
 */
export function useClubColor(club: Club | null): string | null {
  const [color, setColor] = useState<string | null>(null);
  const slug = club?.slug ?? null;

  useEffect(() => {
    if (!slug) {
      setColor(null);
      return;
    }
    let cancelled = false;
    kitAccent(slug).then((kit) => {
      if (cancelled) return;
      if (kit) {
        setColor(kit);
        return;
      }
      dominantCrestColor(crestUrl(slug)).then((c) => {
        if (!cancelled) setColor(c);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return color;
}

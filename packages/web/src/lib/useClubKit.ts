import { useEffect, useState } from 'react';
import type { Club } from '@tactical-arena/shared';
import { crestUrl } from '../api/client.js';
import { dominantCrestColor } from './crestColor.js';
import { getKit } from './kitColors.js';

export interface ClubKit {
  primary: string;
  secondary: string | null;
}

export function useClubKit(club: Club | null): ClubKit | null {
  const [kit, setKit] = useState<ClubKit | null>(null);
  const slug = club?.slug ?? null;

  useEffect(() => {
    if (!slug) {
      setKit(null);
      return;
    }
    let cancelled = false;
    getKit(slug)
      .then((res) => {
        if (cancelled) return;
        if (res) {
          setKit(res);
          return;
        }
        dominantCrestColor(crestUrl(slug))
          .then((c) => {
            if (!cancelled) {
              if (c) {
                setKit({ primary: c, secondary: null });
              } else {
                setKit({ primary: '#3b82f6', secondary: null });
              }
            }
          })
          .catch(() => {
            if (!cancelled) setKit({ primary: '#3b82f6', secondary: null });
          });
      })
      .catch(() => {
        if (!cancelled) setKit({ primary: '#3b82f6', secondary: null });
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return kit;
}

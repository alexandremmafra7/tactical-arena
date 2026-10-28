import { Player } from './player.js';
import { KitPattern } from './club.js';

/** One club's shareable content — the fields a mod pack can carry, not the whole `Club` (finances,
 *  sponsorships, captain/tactic state etc. stay purely local to each save). */
export interface ModPackClub {
  slug: string;
  name: string;
  country: string;
  division: number;
  players: Player[];
  academyPlayers: Player[];
  /** Raw PNG bytes, base64-encoded — null if this club has no crest file to bundle. */
  crestBase64: string | null;
  kitPattern?: KitPattern;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  stadiumCapacity?: number;
  stadiumName?: string | null;
  city?: string | null;
  budget?: number;
}

export interface ModPack {
  version: 1;
  clubs: ModPackClub[];
}

/** Reported back after an import so the UI can show exactly what happened per club, instead of a bare
 *  success/failure — see teamEditorService.importModPack. */
export interface ModPackImportResult {
  created: string[];
  updated: string[];
  /** Slugs that matched a club currently managed by a real user (not the bot pool) — skipped rather than
   *  silently overwriting someone's actual career. */
  skippedOwned: string[];
}

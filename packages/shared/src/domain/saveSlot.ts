import {
  GAME_MODES,
  type GameMode,
} from './gameMode.js';
import {
  isValidManagerStyle,
  type ManagerStyleId,
} from './managerStyle.js';

export const SAVE_SLOT_SCHEMA_VERSION = 2 as const;
export type SaveSlotSchemaVersion = typeof SAVE_SLOT_SCHEMA_VERSION;
export type ClockFormat = 'HALF_45' | 'FULL_90';
export type SaveSeasonPhase = 'PRE_SEASON' | 'IN_SEASON' | 'OFF_SEASON';

const CLOCK_FORMATS: readonly ClockFormat[] = ['HALF_45', 'FULL_90'];
const SAVE_SEASON_PHASES: readonly SaveSeasonPhase[] = ['PRE_SEASON', 'IN_SEASON', 'OFF_SEASON'];

export interface SaveSlot {
  schemaVersion: SaveSlotSchemaVersion;
  id: string;
  name: string;
  fileName: string;
  managerFirstName: string;
  managerLastName: string;
  managerName: string;
  managerNationality: string;
  managerStyle: ManagerStyleId;
  managerAvatar: string;
  clockFormat: ClockFormat;
  gameMode: GameMode;
  managerUserId: string;
  clubId: string;
  clubName: string;
  clubCountry: string;
  division: number;
  season: number;
  round: number;
  budget: number;
  titlesWon: number;
  /** Optional live snapshot used by the career picker; older save indexes remain valid. */
  clubSlug?: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  currentDate?: string;
  leaguePosition?: number;
  nextOpponentName?: string;
  nextOpponentSlug?: string | null;
  nextMatchDate?: string;
  seasonPhase?: SaveSeasonPhase;
  transferWindowOpen?: boolean;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

export type LegacySaveSlot = Partial<Omit<SaveSlot, 'schemaVersion'>> & {
  schemaVersion?: 1;
  id: string;
  name: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  claimedClubId?: string;
  managerToken?: string;
};

export interface LegacySaveEvidence {
  users: readonly { id: string }[];
  clubs: readonly {
    id: string;
    name: string;
    country: string;
    ownerId: string;
    division: number;
    budget: number;
    titlesWon: number;
  }[];
  managers: readonly {
    id: string;
    name: string;
    nationality: string | null;
    userId: string | null;
    clubId: string | null;
  }[];
  openTenures: readonly { userId: string; clubId: string }[];
  season: number;
  round: number;
}

export type NormalizeSaveSlotResult =
  | { ok: true; slot: SaveSlot; migrated: boolean }
  | {
      ok: false;
      code: 'AMBIGUOUS_OWNERSHIP' | 'INVALID_LEGACY_SAVE';
      saveId: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isGameDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isOptional<T>(value: unknown, predicate: (candidate: unknown) => candidate is T): boolean {
  return value === undefined || predicate(value);
}

function isNullableNonEmptyString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isSaveSeasonPhase(value: unknown): value is SaveSeasonPhase {
  return typeof value === 'string' && SAVE_SEASON_PHASES.includes(value as SaveSeasonPhase);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isClockFormat(value: unknown): value is ClockFormat {
  return typeof value === 'string' && CLOCK_FORMATS.includes(value as ClockFormat);
}

function isGameMode(value: unknown): value is GameMode {
  return typeof value === 'string' && GAME_MODES.includes(value as GameMode);
}

function isCurrentSaveSlot(raw: Record<string, unknown>): raw is Record<string, unknown> & SaveSlot {
  return (
    raw.schemaVersion === SAVE_SLOT_SCHEMA_VERSION &&
    isNonEmptyString(raw.id) &&
    isNonEmptyString(raw.name) &&
    isNonEmptyString(raw.fileName) &&
    isNonEmptyString(raw.managerFirstName) &&
    isNonEmptyString(raw.managerLastName) &&
    isNonEmptyString(raw.managerName) &&
    isNonEmptyString(raw.managerNationality) &&
    typeof raw.managerStyle === 'string' &&
    isValidManagerStyle(raw.managerStyle) &&
    isNonEmptyString(raw.managerAvatar) &&
    isClockFormat(raw.clockFormat) &&
    isGameMode(raw.gameMode) &&
    isNonEmptyString(raw.managerUserId) &&
    isNonEmptyString(raw.clubId) &&
    isNonEmptyString(raw.clubName) &&
    isNonEmptyString(raw.clubCountry) &&
    isPositiveInteger(raw.division) &&
    isPositiveInteger(raw.season) &&
    isNonNegativeInteger(raw.round) &&
    isFiniteNumber(raw.budget) &&
    isNonNegativeInteger(raw.titlesWon) &&
    isOptional(raw.clubSlug, isNullableNonEmptyString) &&
    isOptional(raw.crestBase64, isNullableNonEmptyString) &&
    isOptional(raw.primaryColor, isNullableNonEmptyString) &&
    isOptional(raw.secondaryColor, isNullableNonEmptyString) &&
    isOptional(raw.currentDate, isGameDate) &&
    isOptional(raw.leaguePosition, isPositiveInteger) &&
    isOptional(raw.nextOpponentName, isNonEmptyString) &&
    isOptional(raw.nextOpponentSlug, isNullableNonEmptyString) &&
    isOptional(raw.nextMatchDate, isGameDate) &&
    isOptional(raw.seasonPhase, isSaveSeasonPhase) &&
    (raw.transferWindowOpen === undefined || typeof raw.transferWindowOpen === 'boolean') &&
    isIsoTimestamp(raw.createdAt) &&
    isIsoTimestamp(raw.updatedAt) &&
    typeof raw.isCurrent === 'boolean'
  );
}

function invalid(raw: Record<string, unknown>): NormalizeSaveSlotResult {
  return {
    ok: false,
    code: 'INVALID_LEGACY_SAVE',
    saveId: typeof raw.id === 'string' ? raw.id : '',
  };
}

export function normalizeSaveSlot(
  raw: unknown,
  evidence?: LegacySaveEvidence,
): NormalizeSaveSlotResult {
  if (!isRecord(raw)) return invalid({});

  if (raw.schemaVersion === SAVE_SLOT_SCHEMA_VERSION) {
    return isCurrentSaveSlot(raw)
      ? { ok: true, slot: { ...raw }, migrated: false }
      : invalid(raw);
  }

  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) {
    return invalid(raw);
  }

  if (
    !evidence ||
    !isNonEmptyString(raw.id) ||
    !isNonEmptyString(raw.name) ||
    !isNonEmptyString(raw.fileName) ||
    !isIsoTimestamp(raw.createdAt) ||
    !isIsoTimestamp(raw.updatedAt)
  ) {
    return invalid(raw);
  }

  const requestedUserId = isNonEmptyString(raw.managerUserId)
    ? raw.managerUserId
    : undefined;
  const requestedClubIds = [raw.clubId, raw.claimedClubId].filter(
    isNonEmptyString,
  );
  if (new Set(requestedClubIds).size > 1) return invalid(raw);
  const requestedClubId = requestedClubIds[0];

  const candidates = evidence.managers.flatMap((manager) => {
    if (!isNonEmptyString(manager.userId) || !isNonEmptyString(manager.clubId)) {
      return [];
    }
    if (requestedUserId && manager.userId !== requestedUserId) return [];
    if (requestedClubId && manager.clubId !== requestedClubId) return [];

    const user = evidence.users.find(({ id }) => id === manager.userId);
    const club = evidence.clubs.find(
      ({ id, ownerId }) => id === manager.clubId && ownerId === manager.userId,
    );
    const tenures = evidence.openTenures.filter(
      ({ userId, clubId }) =>
        userId === manager.userId && clubId === manager.clubId,
    );

    return user && club
      ? tenures.map((tenure) => ({ user, club, manager, tenure }))
      : [];
  });

  if (candidates.length === 0) return invalid(raw);
  if (candidates.length > 1) {
    return {
      ok: false,
      code: 'AMBIGUOUS_OWNERSHIP',
      saveId: raw.id,
    };
  }

  const { user, club, manager } = candidates[0];
  const managerName = isNonEmptyString(raw.managerName)
    ? raw.managerName.trim()
    : manager.name.trim();
  const managerFirstName = isNonEmptyString(raw.managerFirstName)
    ? raw.managerFirstName.trim()
    : managerName.split(/\s+/)[0] ?? '';
  const managerLastName = isNonEmptyString(raw.managerLastName)
    ? raw.managerLastName.trim()
    : managerName.split(/\s+/).slice(1).join(' ');
  const managerNationality = isNonEmptyString(raw.managerNationality)
    ? raw.managerNationality.trim()
    : manager.nationality?.trim() ?? '';

  if (
    !isNonEmptyString(managerName) ||
    !isNonEmptyString(managerFirstName) ||
    !isNonEmptyString(managerLastName) ||
    !isNonEmptyString(managerNationality) ||
    !isNonEmptyString(club.name) ||
    !isNonEmptyString(club.country) ||
    !isPositiveInteger(club.division) ||
    !isFiniteNumber(club.budget) ||
    !isNonNegativeInteger(club.titlesWon) ||
    !isPositiveInteger(evidence.season) ||
    !isNonNegativeInteger(evidence.round)
  ) {
    return invalid(raw);
  }

  const managerStyle =
    typeof raw.managerStyle === 'string' && isValidManagerStyle(raw.managerStyle)
      ? raw.managerStyle
      : 'Estrategista';
  const gameMode = isGameMode(raw.gameMode) ? raw.gameMode : 'STANDARD';
  const clockFormat = isClockFormat(raw.clockFormat)
    ? raw.clockFormat
    : 'HALF_45';

  return {
    ok: true,
    migrated: true,
    slot: {
      schemaVersion: SAVE_SLOT_SCHEMA_VERSION,
      id: raw.id,
      name: raw.name.trim(),
      fileName: raw.fileName.trim(),
      managerFirstName,
      managerLastName,
      managerName,
      managerNationality,
      managerStyle,
      managerAvatar: isNonEmptyString(raw.managerAvatar)
        ? raw.managerAvatar.trim()
        : '👔',
      clockFormat,
      gameMode,
      managerUserId: user.id,
      clubId: club.id,
      clubName: club.name,
      clubCountry: club.country,
      division: club.division,
      season: evidence.season,
      round: evidence.round,
      budget: club.budget,
      titlesWon: club.titlesWon,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      isCurrent: typeof raw.isCurrent === 'boolean' ? raw.isCurrent : false,
    },
  };
}

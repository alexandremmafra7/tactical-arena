import type { Club, KitPattern } from './club.js';
import { CREST_SPEC } from './crestSpec.js';
import { isValidCountryCode } from './country.js';
import { GAME_MODES, type GameMode } from './gameMode.js';
import {
  isValidManagerStyle,
  type ManagerStyleId,
} from './managerStyle.js';
import type { ClockFormat, SaveSlot } from './saveSlot.js';

export type CareerCitySize = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface CareerCrest {
  crestBase64: string | null;
}

export interface CareerManager {
  firstName: string;
  lastName: string;
  nationality: string;
  style: ManagerStyleId;
  avatar: string;
  clockFormat: ClockFormat;
}

export interface FoundCareerClub {
  kind: 'FOUND';
  countryCode: string;
  name: string;
  city: string;
  citySize: CareerCitySize;
  kitPattern: KitPattern;
  primaryColor: string;
  secondaryColor: string;
  crest: CareerCrest;
  awayKitPattern?: KitPattern | null;
  awayPrimaryColor?: string | null;
  awaySecondaryColor?: string | null;
  supplierName?: string | null;
  masterSponsorName?: string | null;
  optionalSponsorName?: string | null;
  showOptionalSponsor?: boolean;
}

export type CareerClubChoice =
  | { kind: 'TAKE_OVER'; clubId: string }
  | FoundCareerClub;

export interface CreateCareerInput {
  idempotencyKey: string;
  saveName: string;
  manager: CareerManager;
  gameMode: GameMode;
  club: CareerClubChoice;
}

export interface CreateCareerResult {
  save: SaveSlot;
  token: string;
  userId: string;
  club: Club;
  reused: boolean;
}

export interface LoadSaveResult {
  save: SaveSlot;
  token: string;
  userId: string;
  club: Club;
}

export type CareerCreationDomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'CLUB_UNAVAILABLE'
  | 'MODE_RESTRICTION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'STORAGE_ERROR'
  | 'RECOVERY_REQUIRED';

export interface CareerInputValidationError {
  code: 'VALIDATION_ERROR';
  field: string;
  message: string;
}

type ValidationResult =
  | { ok: true; value: CreateCareerInput }
  | { ok: false; error: CareerInputValidationError };

const CLOCK_FORMATS: readonly ClockFormat[] = ['HALF_45', 'FULL_90'];
const CITY_SIZES: readonly CareerCitySize[] = ['SMALL', 'MEDIUM', 'LARGE'];
const KIT_PATTERNS: readonly KitPattern[] = [
  'SOLID',
  'STRIPES_VERTICAL',
  'STRIPES_HORIZONTAL',
  'DIAGONAL_SASH',
  'HALVES',
  'GRADIENT',
];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fail(field: string, message: string): ValidationResult {
  return {
    ok: false,
    error: { code: 'VALIDATION_ERROR', field, message },
  };
}

function decodedBase64Bytes(value: string): number | null {
  const data = value.startsWith('data:image/png;base64,')
    ? value.slice('data:image/png;base64,'.length)
    : value;
  if (!data || data.length % 4 !== 0 || !BASE64.test(data)) return null;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return (data.length * 3) / 4 - padding;
}

export function validateCreateCareerInput(input: unknown): ValidationResult {
  if (!isRecord(input)) return fail('', 'Dados da carreira inválidos.');

  const idempotencyKey = text(input.idempotencyKey);
  if (!idempotencyKey) return fail('idempotencyKey', 'Informe a chave da tentativa.');
  const saveName = text(input.saveName);
  if (!saveName) return fail('saveName', 'Informe o nome da carreira.');
  if (!isRecord(input.manager)) return fail('manager', 'Informe o treinador.');

  const firstName = text(input.manager.firstName);
  if (!firstName) return fail('manager.firstName', 'Informe o primeiro nome.');
  const lastName = text(input.manager.lastName);
  if (!lastName) return fail('manager.lastName', 'Informe o sobrenome.');
  const nationality = text(input.manager.nationality);
  if (!nationality || !isValidCountryCode(nationality)) {
    return fail('manager.nationality', 'Escolha uma nacionalidade válida.');
  }
  const avatar = text(input.manager.avatar);
  if (!avatar) return fail('manager.avatar', 'Escolha um avatar.');
  if (
    typeof input.manager.style !== 'string' ||
    !isValidManagerStyle(input.manager.style)
  ) {
    return fail('manager.style', 'Escolha um estilo válido.');
  }
  if (
    typeof input.manager.clockFormat !== 'string' ||
    !CLOCK_FORMATS.includes(input.manager.clockFormat as ClockFormat)
  ) {
    return fail('manager.clockFormat', 'Escolha um formato de relógio válido.');
  }
  if (
    typeof input.gameMode !== 'string' ||
    !GAME_MODES.includes(input.gameMode as GameMode)
  ) {
    return fail('gameMode', 'Escolha um modo de carreira válido.');
  }
  if (!isRecord(input.club)) return fail('club', 'Escolha ou funde um clube.');

  const manager: CareerManager = {
    firstName,
    lastName,
    nationality,
    style: input.manager.style,
    avatar,
    clockFormat: input.manager.clockFormat as ClockFormat,
  };

  if (input.club.kind === 'TAKE_OVER') {
    const clubId = text(input.club.clubId);
    if (!clubId) return fail('club.clubId', 'Escolha um clube.');
    return {
      ok: true,
      value: {
        idempotencyKey,
        saveName,
        manager,
        gameMode: input.gameMode as GameMode,
        club: { kind: 'TAKE_OVER', clubId },
      },
    };
  }

  if (input.club.kind !== 'FOUND') {
    return fail('club.kind', 'Escolha uma forma válida de entrada.');
  }

  const countryCode = text(input.club.countryCode);
  if (!countryCode || !isValidCountryCode(countryCode)) {
    return fail('club.countryCode', 'Escolha um país válido.');
  }
  const name = text(input.club.name);
  if (!name) return fail('club.name', 'Informe o nome do clube.');
  const city = text(input.club.city);
  if (!city) return fail('club.city', 'Informe a cidade.');
  if (
    typeof input.club.citySize !== 'string' ||
    !CITY_SIZES.includes(input.club.citySize as CareerCitySize)
  ) {
    return fail('club.citySize', 'Escolha um porte de cidade válido.');
  }
  if (
    typeof input.club.kitPattern !== 'string' ||
    !KIT_PATTERNS.includes(input.club.kitPattern as KitPattern)
  ) {
    return fail('club.kitPattern', 'Escolha um padrão de uniforme válido.');
  }
  if (typeof input.club.primaryColor !== 'string' || !HEX_COLOR.test(input.club.primaryColor)) {
    return fail('club.primaryColor', 'Informe uma cor hexadecimal válida.');
  }
  if (typeof input.club.secondaryColor !== 'string' || !HEX_COLOR.test(input.club.secondaryColor)) {
    return fail('club.secondaryColor', 'Informe uma cor hexadecimal válida.');
  }
  if (!isRecord(input.club.crest)) {
    return fail('club.crest', 'Informe a configuração do escudo.');
  }

  const crestBase64 = input.club.crest.crestBase64;
  if (crestBase64 !== null) {
    if (typeof crestBase64 !== 'string') {
      return fail('club.crest.crestBase64', 'Informe um escudo PNG em base64.');
    }
    const bytes = decodedBase64Bytes(crestBase64);
    if (bytes === null || bytes > CREST_SPEC.maxBytes) {
      return fail(
        'club.crest.crestBase64',
        `O escudo deve ser base64 e ter no máximo ${CREST_SPEC.maxBytes} bytes.`,
      );
    }
  }

  return {
    ok: true,
    value: {
      idempotencyKey,
      saveName,
      manager,
      gameMode: input.gameMode as GameMode,
      club: {
        kind: 'FOUND',
        countryCode,
        name,
        city,
        citySize: input.club.citySize as CareerCitySize,
        kitPattern: input.club.kitPattern as KitPattern,
        primaryColor: input.club.primaryColor,
        secondaryColor: input.club.secondaryColor,
        crest: { crestBase64 },
        awayKitPattern: typeof input.club.awayKitPattern === 'string' ? (input.club.awayKitPattern as KitPattern) : null,
        awayPrimaryColor: typeof input.club.awayPrimaryColor === 'string' ? input.club.awayPrimaryColor : null,
        awaySecondaryColor: typeof input.club.awaySecondaryColor === 'string' ? input.club.awaySecondaryColor : null,
        supplierName: typeof input.club.supplierName === 'string' ? input.club.supplierName : null,
        masterSponsorName: typeof input.club.masterSponsorName === 'string' ? input.club.masterSponsorName : null,
        optionalSponsorName: typeof input.club.optionalSponsorName === 'string' ? input.club.optionalSponsorName : null,
        showOptionalSponsor: Boolean(input.club.showOptionalSponsor),
      },
    },
  };
}

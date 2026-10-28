import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  normalizeSaveSlot,
  type LeagueFixture,
  type LegacySaveEvidence,
  type SaveSlot,
} from '@tactical-arena/shared';
import { makePrisma } from '../db/prisma.js';

export interface SavesIndex {
  schemaVersion: 2;
  currentSaveId: string;
  saves: SaveSlot[];
  idempotency: Record<string, { payloadHash: string; saveId: string }>;
}

export interface SavePaths {
  databasePath: string;
  templatePath: string;
  savesDirectory: string;
  indexPath: string;
  markerPath: string;
}

export function resolveSavePaths(
  env: NodeJS.ProcessEnv = process.env,
): SavePaths {
  const databaseUrl = env.DATABASE_URL ?? 'file:./dev.db';
  if (!databaseUrl.startsWith('file:')) {
    throw new Error('DATABASE_URL precisa usar o protocolo file:.');
  }
  const databasePath = path.resolve(databaseUrl.slice('file:'.length));
  const parent = path.dirname(databasePath);
  const configuredTemplatePath =
    env.TACTICAL_ARENA_TEMPLATE_DATABASE_PATH?.trim();
  let serverPackageDirectory: string | null = null;
  try {
    serverPackageDirectory = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
    );
  } catch {
    // The Electron CJS bundle supplies the packaged template path explicitly.
  }
  const savesDirectory = path.join(parent, 'saves');
  const templateCandidates = [
    ...(configuredTemplatePath
      ? [path.resolve(configuredTemplatePath)]
      : []),
    path.join(parent, 'template.db'),
    ...(serverPackageDirectory
      ? [
          path.join(serverPackageDirectory, 'prisma', 'template.db'),
          path.join(serverPackageDirectory, '..', 'desktop', 'resources', 'template.db'),
        ]
      : []),
    path.join(process.cwd(), 'resources', 'template.db'),
  ];
  const templatePath =
    templateCandidates.find((candidate) => fsSync.existsSync(candidate)) ??
    templateCandidates[0];

  return {
    databasePath,
    templatePath,
    savesDirectory,
    indexPath: path.join(savesDirectory, 'saves_index.json'),
    markerPath: path.join(savesDirectory, 'career_creation.json'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalValue(value: unknown, root: boolean): unknown {
  if (
    value === undefined ||
    typeof value === 'bigint' ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    throw new TypeError('Payload de carreira inválido.');
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalValue(item, false));
  }
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !(root && key === 'idempotencyKey'))
      .sort()
      .map((key) => [key, canonicalValue(value[key], false)]),
  );
}

export function canonicalCareerPayload(input: unknown): string {
  const serialized = JSON.stringify(canonicalValue(input, true));
  if (serialized === undefined) {
    throw new TypeError('Payload de carreira inválido.');
  }
  return serialized;
}

export function careerPayloadHash(input: unknown): string {
  return createHash('sha256')
    .update(canonicalCareerPayload(input))
    .digest('hex');
}

function parseCurrentIndex(raw: string): SavesIndex {
  const parsed: unknown = JSON.parse(raw);
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== 2 ||
    typeof parsed.currentSaveId !== 'string' ||
    !Array.isArray(parsed.saves) ||
    !isRecord(parsed.idempotency)
  ) {
    throw new Error('Índice de saves inválido.');
  }

  const saves = parsed.saves.map((candidate) => {
    const normalized = normalizeSaveSlot(candidate);
    if (!normalized.ok || normalized.migrated) {
      throw new Error('Índice de saves inválido.');
    }
    return normalized.slot;
  });
  const saveIds = new Set(saves.map((save) => save.id));
  if (saveIds.size !== saves.length) {
    throw new Error('Índice de saves inválido.');
  }
  if (
    (parsed.currentSaveId && !saveIds.has(parsed.currentSaveId)) ||
    (!parsed.currentSaveId && saves.length > 0)
  ) {
    throw new Error('Índice de saves inválido.');
  }
  if (
    saves.some(
      (save) => save.isCurrent !== (save.id === parsed.currentSaveId),
    )
  ) {
    throw new Error('Índice de saves inválido.');
  }

  const idempotency: SavesIndex['idempotency'] = {};
  for (const [key, value] of Object.entries(parsed.idempotency)) {
    if (
      !key.trim() ||
      !isRecord(value) ||
      typeof value.payloadHash !== 'string' ||
      !value.payloadHash.trim() ||
      typeof value.saveId !== 'string' ||
      !saveIds.has(value.saveId)
    ) {
      throw new Error('Índice de saves inválido.');
    }
    idempotency[key] = {
      payloadHash: value.payloadHash,
      saveId: value.saveId,
    };
  }

  return {
    schemaVersion: 2,
    currentSaveId: parsed.currentSaveId,
    saves,
    idempotency,
  };
}

function sqliteUrl(databasePath: string): string {
  return `file:${path.resolve(databasePath).replace(/\\/g, '/')}`;
}

function isLeagueFixture(value: unknown): value is LeagueFixture {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.round) ||
    (value.round as number) <= 0 ||
    typeof value.homeClubId !== 'string' ||
    !value.homeClubId ||
    typeof value.awayClubId !== 'string' ||
    !value.awayClubId ||
    !Object.hasOwn(value, 'matchId') ||
    (value.matchId !== null && typeof value.matchId !== 'string') ||
    (Object.hasOwn(value, 'result') && value.result !== null && !isRecord(value.result))
  ) {
    return false;
  }

  if (isRecord(value.result)) {
    return (
      Number.isInteger(value.result.homeGoals) &&
      (value.result.homeGoals as number) >= 0 &&
      Number.isInteger(value.result.awayGoals) &&
      (value.result.awayGoals as number) >= 0
    );
  }

  return true;
}

function isPlayedFixture(fixture: LeagueFixture): boolean {
  return fixture.result != null || fixture.matchId !== null;
}

function currentLeagueRound(fixturesJson: string): number {
  let fixtures: unknown;
  try {
    fixtures = JSON.parse(fixturesJson);
  } catch {
    throw new Error('Evidência de rodada inválida no banco do save.');
  }
  if (!Array.isArray(fixtures) || !fixtures.every(isLeagueFixture)) {
    throw new Error('Evidência de rodada inválida no banco do save.');
  }

  const parsed = fixtures;
  const pending = parsed
    .filter((fixture) =>
      Number.isInteger(fixture.round) &&
      fixture.round > 0 &&
      !isPlayedFixture(fixture),
    )
    .map((fixture) => fixture.round);
  if (pending.length > 0) return Math.min(...pending);

  const played = parsed
    .filter((fixture) =>
      Number.isInteger(fixture.round) &&
      fixture.round > 0 &&
      isPlayedFixture(fixture),
    )
    .map((fixture) => fixture.round);
  return played.length > 0 ? Math.max(...played) : 0;
}

export async function collectLegacySaveEvidence(
  databasePath: string,
): Promise<LegacySaveEvidence> {
  const resolvedDatabasePath = path.resolve(databasePath);
  await fs.access(resolvedDatabasePath, fsSync.constants.R_OK);
  const db = makePrisma(sqliteUrl(resolvedDatabasePath));
  try {
    const [users, clubs, managers, openTenures, state, leagues] =
      await Promise.all([
        db.user.findMany({ select: { id: true } }),
        db.club.findMany({
          select: {
            id: true,
            name: true,
            country: true,
            ownerId: true,
            budget: true,
            titlesWon: true,
          },
        }),
        db.manager.findMany({
          select: {
            id: true,
            name: true,
            nationality: true,
            userId: true,
            clubId: true,
          },
        }),
        db.managerTenure.findMany({
          where: { endedAt: null },
          select: { userId: true, clubId: true },
        }),
        db.gameState.findUnique({
          where: { id: 'singleton' },
          select: { seasonYear: true },
        }),
        db.league.findMany({
          select: {
            countryCode: true,
            division: true,
            clubIdsJson: true,
            fixturesJson: true,
            season: true,
            status: true,
          },
        }),
      ]);

    if (!state) {
      throw new Error('Evidência de relógio ausente no banco do save.');
    }

    const seasonLeagues = leagues.filter(
      (league) => league.season === state.seasonYear,
    );
    const currentLeagues = seasonLeagues.filter(
      (league) => league.status === 'IN_PROGRESS',
    );
    const divisionByClub = new Map<string, number>();
    for (const league of seasonLeagues) {
      let clubIds: unknown;
      try {
        clubIds = JSON.parse(league.clubIdsJson);
      } catch {
        throw new Error('Evidência de divisão inválida no banco do save.');
      }
      if (
        !Array.isArray(clubIds) ||
        !clubIds.every((id) => typeof id === 'string')
      ) {
        throw new Error('Evidência de divisão inválida no banco do save.');
      }
      for (const clubId of clubIds) {
        const previous = divisionByClub.get(clubId);
        if (previous !== undefined && previous !== league.division) {
          throw new Error('Evidência de divisão ambígua no banco do save.');
        }
        divisionByClub.set(clubId, league.division);
      }
    }

    return {
      users,
      clubs: clubs.flatMap((club) => {
        const division = divisionByClub.get(club.id);
        return division === undefined ? [] : [{ ...club, division }];
      }),
      managers,
      openTenures,
      season: state.seasonYear,
      round: currentLeagues.reduce(
        (round, league) => Math.max(round, currentLeagueRound(league.fixturesJson)),
        0,
      ),
    };
  } finally {
    await db.$disconnect();
  }
}

export async function readSavesIndex(
  paths: SavePaths = resolveSavePaths(),
): Promise<SavesIndex> {
  return parseCurrentIndex(await fs.readFile(paths.indexPath, 'utf8'));
}

export async function writeSavesIndexAtomic(
  index: SavesIndex,
  paths: SavePaths = resolveSavePaths(),
): Promise<void> {
  const serialized = JSON.stringify(index, null, 2);
  parseCurrentIndex(serialized);
  await fs.mkdir(paths.savesDirectory, { recursive: true });
  const temporaryPath = path.join(
    paths.savesDirectory,
    `.saves_index.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporaryPath, serialized, 'utf8');
    await fs.rename(temporaryPath, paths.indexPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readOrCreateSavesIndex(
  paths: SavePaths = resolveSavePaths(),
): Promise<SavesIndex> {
  try {
    return await readSavesIndex(paths);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const initial: SavesIndex = {
      schemaVersion: 2,
      currentSaveId: '',
      saves: [],
      idempotency: {},
    };
    await writeSavesIndexAtomic(initial, paths);
    return initial;
  }
}

export interface MigrateSavesIndexOptions {
  evidenceForSave?: (
    raw: unknown,
  ) => Promise<LegacySaveEvidence>;
  paths?: SavePaths;
}

function legacyFileName(raw: unknown): string {
  if (!isRecord(raw) || typeof raw.fileName !== 'string' || !raw.fileName.trim()) {
    throw new Error('Índice legado de saves inválido.');
  }
  const fileName = raw.fileName.trim();
  if (path.basename(fileName) !== fileName) {
    throw new Error('Índice legado de saves inválido.');
  }
  return fileName;
}

export async function migrateSavesIndex(
  options?: MigrateSavesIndexOptions,
): Promise<SavesIndex> {
  const paths = options?.paths ?? resolveSavePaths();
  const evidenceForSave = options?.evidenceForSave ?? ((raw: unknown) =>
    collectLegacySaveEvidence(
      path.join(paths.savesDirectory, legacyFileName(raw)),
    ));
  let raw: string;
  try {
    raw = await fs.readFile(paths.indexPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return readOrCreateSavesIndex(paths);
  }

  const parsed: unknown = JSON.parse(raw);
  if (isRecord(parsed) && parsed.schemaVersion === 2) {
    return parseCurrentIndex(raw);
  }
  if (
    !isRecord(parsed) ||
    typeof parsed.currentSaveId !== 'string' ||
    !Array.isArray(parsed.saves)
  ) {
    throw new Error('Índice legado de saves inválido.');
  }

  await fs.mkdir(paths.savesDirectory, { recursive: true });
  const backupPath = `${paths.indexPath}.backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}`;
  await fs.copyFile(paths.indexPath, backupPath);

  const migratedSlots: SaveSlot[] = [];
  for (const rawSlot of parsed.saves) {
    const normalized = normalizeSaveSlot(
      rawSlot,
      await evidenceForSave(rawSlot),
    );
    if (!normalized.ok) {
      throw new Error(
        `${normalized.code}: não foi possível migrar o save ${normalized.saveId}.`,
      );
    }
    migratedSlots.push(normalized.slot);
  }
  const migrated: SavesIndex = {
    schemaVersion: 2,
    currentSaveId: parsed.currentSaveId,
    saves: migratedSlots.map((slot) => ({
      ...slot,
      isCurrent: slot.id === parsed.currentSaveId,
    })),
    idempotency: {},
  };
  await writeSavesIndexAtomic(migrated, paths);
  return migrated;
}

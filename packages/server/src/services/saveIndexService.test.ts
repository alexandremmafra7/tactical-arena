import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  canonicalCareerPayload,
  careerPayloadHash,
  collectLegacySaveEvidence,
  migrateSavesIndex,
  readSavesIndex,
  resolveSavePaths,
  writeSavesIndexAtomic,
  type SavePaths,
} from './saveIndexService.js';
import {
  SAVE_SLOT_SCHEMA_VERSION,
  type LegacySaveEvidence,
  type SaveSlot,
} from '@tactical-arena/shared';

const directories: string[] = [];

function paths(): SavePaths {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'save-index-test-'));
  directories.push(root);
  const savesDirectory = path.join(root, 'saves');
  return {
    databasePath: path.join(root, 'active.db'),
    templatePath: path.join(root, 'template.db'),
    savesDirectory,
    indexPath: path.join(savesDirectory, 'saves_index.json'),
    markerPath: path.join(savesDirectory, 'career_creation.json'),
  };
}

function currentSlot(overrides: Partial<SaveSlot> = {}): SaveSlot {
  return {
    schemaVersion: SAVE_SLOT_SCHEMA_VERSION,
    id: 'save-a',
    name: 'Career',
    fileName: 'save-a.db',
    managerFirstName: 'Alex',
    managerLastName: 'Ribeiro',
    managerName: 'Alex Ribeiro',
    managerNationality: 'BRA',
    managerStyle: 'Estrategista',
    managerAvatar: '👔',
    clockFormat: 'HALF_45',
    gameMode: 'STANDARD',
    managerUserId: 'user-a',
    clubId: 'club-a',
    clubName: 'Aurora',
    clubCountry: 'BRA',
    division: 2,
    season: 2026,
    round: 0,
    budget: 4_000_000,
    titlesWon: 0,
    createdAt: '2026-09-09T10:00:00.000Z',
    updatedAt: '2026-09-09T10:00:00.000Z',
    isCurrent: true,
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('saveIndexService', () => {
  it('canonicalizes career payload keys recursively while preserving array order', () => {
    expect(canonicalCareerPayload({
      idempotencyKey: 'attempt-a',
      z: [{ b: 2, a: 1 }, 'second'],
      a: { d: 4, c: 3 },
    })).toBe('{"a":{"c":3,"d":4},"z":[{"a":1,"b":2},"second"]}');
  });

  it('rejects non-JSON career payload values before hashing', () => {
    expect(() => canonicalCareerPayload({ saveName: undefined })).toThrow(
      'Payload de carreira inválido.',
    );
  });

  it('hashes equivalent career payloads equally without the idempotency key', () => {
    const first = {
      idempotencyKey: 'attempt-a',
      saveName: 'Career',
      manager: { lastName: 'Ribeiro', firstName: 'Alex' },
      club: { kind: 'TAKE_OVER', clubId: 'club-a' },
    };
    const reordered = {
      club: { clubId: 'club-a', kind: 'TAKE_OVER' },
      manager: { firstName: 'Alex', lastName: 'Ribeiro' },
      saveName: 'Career',
      idempotencyKey: 'attempt-b',
    };

    expect(careerPayloadHash(first)).toBe(careerPayloadHash(reordered));
    expect(careerPayloadHash(first)).toMatch(/^[0-9a-f]{64}$/);
    expect(careerPayloadHash({ ...first, saveName: 'Other' })).not.toBe(
      careerPayloadHash(first),
    );
  });

  it('derives every save path from the configured database', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'save-index-paths-'));
    directories.push(root);
    const databasePath = path.join(root, 'active.db');
    const templatePath = path.join(root, 'template.db');
    fs.writeFileSync(templatePath, 'template');

    expect(resolveSavePaths({ DATABASE_URL: `file:${databasePath}` })).toEqual({
      databasePath: path.resolve(databasePath),
      templatePath,
      savesDirectory: path.join(root, 'saves'),
      indexPath: path.join(root, 'saves', 'saves_index.json'),
      markerPath: path.join(root, 'saves', 'career_creation.json'),
    });
  });

  it('keeps the module-relative template fallback used by server builds', () => {
    const databaseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'career-paths-'));
    directories.push(databaseRoot);
    const databasePath = path.join(databaseRoot, 'active.db');
    const packagedTemplate = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      'prisma',
      'template.db',
    );

    expect(resolveSavePaths({ DATABASE_URL: `file:${databasePath}` }).templatePath).toBe(
      packagedTemplate,
    );
  });

  it('uses an explicit packaged template path without depending on process cwd', () => {
    const databaseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'career-paths-'));
    directories.push(databaseRoot);
    const databasePath = path.join(databaseRoot, 'active.db');
    const templatePath = path.join(databaseRoot, 'packaged-template.db');
    fs.writeFileSync(templatePath, 'template');

    expect(resolveSavePaths({
      DATABASE_URL: `file:${databasePath}`,
      TACTICAL_ARENA_TEMPLATE_DATABASE_PATH: templatePath,
    }).templatePath).toBe(path.resolve(templatePath));
  });

  it('writes a complete index through a same-directory temporary file', async () => {
    const location = paths();
    const index = {
      schemaVersion: 2 as const,
      currentSaveId: '',
      saves: [],
      idempotency: {},
    };
    await writeSavesIndexAtomic(index, location);
    expect(await readSavesIndex(location)).toEqual(index);
    expect(fs.readdirSync(location.savesDirectory)).toEqual(['saves_index.json']);
  });

  it('writes an empty initial index without a current slot', async () => {
    const location = paths();
    const index = {
      schemaVersion: 2 as const,
      currentSaveId: '',
      saves: [],
      idempotency: {},
    };

    await expect(writeSavesIndexAtomic(index, location)).resolves.toBeUndefined();
  });

  it('refuses to persist an internally inconsistent index', async () => {
    const location = paths();
    const invalid = {
      schemaVersion: 2 as const,
      currentSaveId: 'save-a',
      saves: [currentSlot({ isCurrent: false })],
      idempotency: {},
    };

    await expect(writeSavesIndexAtomic(invalid, location)).rejects.toThrow(
      'Índice de saves inválido.',
    );
    expect(fs.existsSync(location.indexPath)).toBe(false);
  });

  it('rejects persisted slots without a currentSaveId', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    fs.writeFileSync(location.indexPath, JSON.stringify({
      schemaVersion: 2,
      currentSaveId: '',
      saves: [currentSlot({ isCurrent: false })],
      idempotency: {},
    }));

    await expect(readSavesIndex(location)).rejects.toThrow(
      'Índice de saves inválido.',
    );
  });

  it('rejects a current slot flag that disagrees with currentSaveId', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    fs.writeFileSync(location.indexPath, JSON.stringify({
      schemaVersion: 2,
      currentSaveId: 'save-a',
      saves: [currentSlot({ isCurrent: false })],
      idempotency: {},
    }));

    await expect(readSavesIndex(location)).rejects.toThrow(
      'Índice de saves inválido.',
    );
  });

  it('throws instead of replacing malformed index data', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    fs.writeFileSync(location.indexPath, '{bad');
    await expect(readSavesIndex(location)).rejects.toThrow();
  });

  it('runtime-validates every schema-2 slot instead of trusting the JSON shape', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    fs.writeFileSync(
      location.indexPath,
      JSON.stringify({
        schemaVersion: 2,
        currentSaveId: 'save-a',
        saves: [{ schemaVersion: 2, id: 'save-a' }],
        idempotency: {},
      }),
    );

    await expect(readSavesIndex(location)).rejects.toThrow('Índice de saves inválido.');
  });

  it('rejects idempotency entries that do not point to a persisted slot', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    fs.writeFileSync(
      location.indexPath,
      JSON.stringify({
        schemaVersion: 2,
        currentSaveId: 'save-a',
        saves: [currentSlot()],
        idempotency: {
          attempt: { payloadHash: 'hash-a', saveId: 'missing-save' },
        },
      }),
    );

    await expect(readSavesIndex(location)).rejects.toThrow('Índice de saves inválido.');
  });

  it('collects exact ownership evidence from a save SQLite database', async () => {
    const location = paths();
    const databasePath = path.join(location.savesDirectory, 'legacy.db');
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    const templatePath = resolveSavePaths(process.env).templatePath;
    fs.copyFileSync(templatePath, databasePath);

    const { makePrisma } = await import('../db/prisma.js');
    const db = makePrisma(`file:${databasePath.replace(/\\/g, '/')}`);
    /**
     * O template é um artefato antigo, e cada coluna nova quebrava este teste.
     *
     * `ensureSchema` existe exatamente para isso: é o diferenciador de DDL que cura um banco anterior à
     * coluna. Rodá-lo na cópia é o que o próprio jogo faz ao abrir um save antigo.
     */
    const { ensureSchema } = await import('../db/ensureSchema.js');
    await ensureSchema(db);
    try {
      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: 'user-a',
            email: 'user-a@manager.game',
            passwordHash: 'not-used',
          },
        });
        await tx.club.create({
          data: {
            id: 'club-a',
            name: 'Aurora',
            country: 'BRA',
            ownerId: 'user-a',
            playersJson: '[]',
            budget: 4_000_000,
            titlesWon: 1,
          },
        });
        await tx.manager.create({
          data: {
            id: 'manager-a',
            name: 'Alex Ribeiro',
            nationality: 'BRA',
            userId: 'user-a',
            clubId: 'club-a',
          },
        });
        await tx.managerTenure.create({
          data: {
            id: 'tenure-a',
            userId: 'user-a',
            clubId: 'club-a',
            clubName: 'Aurora',
            countryCode: 'BRA',
          },
        });
        await tx.gameState.upsert({
          where: { id: 'singleton' },
          update: {
            currentDate: '2042-05-02',
            seasonYear: 2042,
          },
          create: {
            id: 'singleton',
            currentDate: '2042-05-02',
            seasonYear: 2042,
          },
        });
        await tx.league.create({
          data: {
            id: 'league-a',
            countryCode: 'BRA',
            division: 2,
            name: 'Liga',
            capacity: 1,
            status: 'IN_PROGRESS',
            clubIdsJson: '["club-a"]',
            fixturesJson: JSON.stringify([
              {
                round: 1,
                homeClubId: 'club-a',
                awayClubId: 'club-b',
                matchId: null,
                result: { homeGoals: 1, awayGoals: 0 },
              },
              {
                round: 2,
                homeClubId: 'club-b',
                awayClubId: 'club-a',
                matchId: null,
              },
            ]),
            season: 2042,
          },
        });
      });
    } finally {
      await db.$disconnect();
    }

    const evidence = await collectLegacySaveEvidence(databasePath);
    expect(evidence.season).toBe(2042);
    expect(evidence.round).toBe(2);
    expect(evidence.users).toContainEqual({ id: 'user-a' });
    expect(evidence.clubs).toContainEqual({
      id: 'club-a',
      name: 'Aurora',
      country: 'BRA',
      ownerId: 'user-a',
      division: 2,
      budget: 4_000_000,
      titlesWon: 1,
    });
    expect(evidence.managers).toContainEqual({
      id: 'manager-a',
      name: 'Alex Ribeiro',
      nationality: 'BRA',
      userId: 'user-a',
      clubId: 'club-a',
    });
    expect(evidence.openTenures).toContainEqual({
      userId: 'user-a',
      clubId: 'club-a',
    });
  });

  it('rejects malformed fixtures instead of treating missing matchId as played', async () => {
    const location = paths();
    const databasePath = path.join(location.savesDirectory, 'legacy.db');
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    fs.copyFileSync(resolveSavePaths(process.env).templatePath, databasePath);

    const { makePrisma } = await import('../db/prisma.js');
    const db = makePrisma(`file:${databasePath.replace(/\\/g, '/')}`);
    try {
      await db.gameState.upsert({
        where: { id: 'singleton' },
        update: { currentDate: '2042-01-01', seasonYear: 2042 },
        create: { id: 'singleton', currentDate: '2042-01-01', seasonYear: 2042 },
      });
      await db.league.create({
        data: {
          id: 'malformed-fixtures-league',
          countryCode: 'BRA',
          division: 2,
          name: 'Liga',
          capacity: 2,
          status: 'IN_PROGRESS',
          clubIdsJson: '["club-a","club-b"]',
          fixturesJson: JSON.stringify([{
            round: 1,
            homeClubId: 'club-a',
            awayClubId: 'club-b',
          }]),
          season: 2042,
        },
      });
    } finally {
      await db.$disconnect();
    }

    await expect(collectLegacySaveEvidence(databasePath)).rejects.toThrow(
      'Evidência de rodada inválida',
    );
  });

  it('rejects a club listed in two current divisions as ambiguous evidence', async () => {
    const location = paths();
    const databasePath = path.join(location.savesDirectory, 'legacy.db');
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    fs.copyFileSync(resolveSavePaths(process.env).templatePath, databasePath);

    const { makePrisma } = await import('../db/prisma.js');
    const db = makePrisma(`file:${databasePath.replace(/\\/g, '/')}`);
    try {
      await db.gameState.upsert({
        where: { id: 'singleton' },
        update: { currentDate: '2042-01-01', seasonYear: 2042 },
        create: { id: 'singleton', currentDate: '2042-01-01', seasonYear: 2042 },
      });
      await db.league.createMany({
        data: [2, 3].map((division) => ({
          id: `league-${division}`,
          countryCode: 'BRA',
          division,
          name: `Liga ${division}`,
          capacity: 1,
          status: 'IN_PROGRESS',
          clubIdsJson: '["shared-club"]',
          fixturesJson: '[]',
          season: 2042,
        })),
      });
    } finally {
      await db.$disconnect();
    }

    await expect(collectLegacySaveEvidence(databasePath)).rejects.toThrow(
      'Evidência de divisão ambígua',
    );
  });

  it('does not create a SQLite file when legacy evidence is missing', async () => {
    const location = paths();
    const missingPath = path.join(location.savesDirectory, 'missing.db');

    await expect(collectLegacySaveEvidence(missingPath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(fs.existsSync(missingPath)).toBe(false);
  });

  it('does not create missing game state while collecting evidence', async () => {
    const location = paths();
    const databasePath = path.join(location.savesDirectory, 'legacy.db');
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    fs.copyFileSync(resolveSavePaths(process.env).templatePath, databasePath);

    const { makePrisma } = await import('../db/prisma.js');
    const db = makePrisma(`file:${databasePath.replace(/\\/g, '/')}`);
    try {
      await db.gameState.deleteMany();
    } finally {
      await db.$disconnect();
    }

    await expect(collectLegacySaveEvidence(databasePath)).rejects.toThrow(
      'Evidência de relógio ausente',
    );

    const reopened = makePrisma(`file:${databasePath.replace(/\\/g, '/')}`);
    try {
      await expect(reopened.gameState.count()).resolves.toBe(0);
    } finally {
      await reopened.$disconnect();
    }
  });

  it('rejects legacy save file names that escape the saves directory', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    const timestamp = '2026-09-09T10:00:00.000Z';
    fs.writeFileSync(location.indexPath, JSON.stringify({
      currentSaveId: 'save-a',
      saves: [{
        id: 'save-a',
        name: 'Legacy',
        fileName: '../active.db',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }));

    await expect(migrateSavesIndex({ paths: location })).rejects.toThrow(
      'Índice legado de saves inválido.',
    );
  });

  it('uses each legacy slot database as migration evidence by default', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    const databasePath = path.join(location.savesDirectory, 'save-a.db');
    fs.copyFileSync(resolveSavePaths(process.env).templatePath, databasePath);

    const { makePrisma } = await import('../db/prisma.js');
    const db = makePrisma(`file:${databasePath.replace(/\\/g, '/')}`);
    /**
     * O template é um artefato antigo, e cada coluna nova quebrava este teste.
     *
     * `ensureSchema` existe exatamente para isso: é o diferenciador de DDL que cura um banco anterior à
     * coluna. Rodá-lo na cópia é o que o próprio jogo faz ao abrir um save antigo.
     */
    const { ensureSchema } = await import('../db/ensureSchema.js');
    await ensureSchema(db);
    try {
      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: { id: 'user-a', email: 'migration@manager.game', passwordHash: 'x' },
        });
        await tx.club.create({
          data: {
            id: 'club-a',
            name: 'Aurora',
            ownerId: 'user-a',
            country: 'BRA',
            playersJson: '[]',
          },
        });
        await tx.manager.create({
          data: {
            id: 'manager-a',
            name: 'Alex Ribeiro',
            nationality: 'BRA',
            userId: 'user-a',
            clubId: 'club-a',
          },
        });
        await tx.managerTenure.create({
          data: {
            id: 'tenure-a',
            userId: 'user-a',
            clubId: 'club-a',
            clubName: 'Aurora',
            countryCode: 'BRA',
          },
        });
        await tx.gameState.upsert({
          where: { id: 'singleton' },
          update: { currentDate: '2042-01-01', seasonYear: 2042 },
          create: { id: 'singleton', currentDate: '2042-01-01', seasonYear: 2042 },
        });
        await tx.league.create({
          data: {
            id: 'league-a',
            countryCode: 'BRA',
            division: 2,
            name: 'Liga',
            capacity: 1,
            status: 'IN_PROGRESS',
            clubIdsJson: '["club-a"]',
            fixturesJson: '[]',
            season: 2042,
          },
        });
      });
    } finally {
      await db.$disconnect();
    }

    const timestamp = '2026-09-09T10:00:00.000Z';
    fs.writeFileSync(location.indexPath, JSON.stringify({
      currentSaveId: 'save-a',
      saves: [{
        id: 'save-a',
        name: 'Legacy',
        fileName: 'save-a.db',
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }));

    const migrated = await migrateSavesIndex({ paths: location });
    expect(migrated.saves[0]).toMatchObject({
      managerUserId: 'user-a',
      clubId: 'club-a',
      season: 2042,
      round: 0,
    });
  });

  it('backs up and migrates schema 1 only with exact database evidence', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    const timestamp = '2026-09-09T10:00:00.000Z';
    const old = {
      currentSaveId: 'save-a',
      saves: [{
        id: 'save-a',
        name: 'Legacy',
        fileName: 'save-a.db',
        createdAt: timestamp,
        updatedAt: timestamp,
        managerToken: 'must-not-survive',
      }],
    };
    fs.writeFileSync(location.indexPath, JSON.stringify(old));
    const evidence: LegacySaveEvidence = {
      users: [{ id: 'user-a' }],
      clubs: [{
        id: 'club-a', name: 'Aurora', country: 'BRA', ownerId: 'user-a',
        division: 2, budget: 4_000_000, titlesWon: 1,
      }],
      managers: [{
        id: 'manager-a', name: 'Alex Ribeiro', nationality: 'BRA',
        userId: 'user-a', clubId: 'club-a',
      }],
      openTenures: [{ userId: 'user-a', clubId: 'club-a' }],
      season: 2026,
      round: 3,
    };

    const migrated = await migrateSavesIndex({
      evidenceForSave: async () => evidence,
      paths: location,
    });
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      currentSaveId: 'save-a',
      saves: [{
        schemaVersion: 2,
        id: 'save-a',
        managerUserId: 'user-a',
        clubId: 'club-a',
        isCurrent: true,
      }],
      idempotency: {},
    });
    expect(migrated.saves[0]).not.toHaveProperty('managerToken');
    const files = fs.readdirSync(location.savesDirectory);
    expect(files.some((file) => file.startsWith('saves_index.json.backup-'))).toBe(true);
    expect(await readSavesIndex(location)).toEqual(migrated);
  });

  it('backs up but does not replace the index when ownership is ambiguous', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    const old = {
      currentSaveId: 'save-a',
      saves: [{
        id: 'save-a', name: 'Legacy', fileName: 'save-a.db',
        createdAt: '2026-09-09T10:00:00.000Z',
        updatedAt: '2026-09-09T10:00:00.000Z',
      }],
    };
    fs.writeFileSync(location.indexPath, JSON.stringify(old));
    const ambiguous: LegacySaveEvidence = {
      users: [{ id: 'user-a' }, { id: 'user-b' }],
      clubs: [
        { id: 'club-a', name: 'A', country: 'BRA', ownerId: 'user-a', division: 2, budget: 1, titlesWon: 0 },
        { id: 'club-b', name: 'B', country: 'ARG', ownerId: 'user-b', division: 2, budget: 1, titlesWon: 0 },
      ],
      managers: [
        { id: 'manager-a', name: 'Alex A', nationality: 'BRA', userId: 'user-a', clubId: 'club-a' },
        { id: 'manager-b', name: 'Bia B', nationality: 'ARG', userId: 'user-b', clubId: 'club-b' },
      ],
      openTenures: [
        { userId: 'user-a', clubId: 'club-a' },
        { userId: 'user-b', clubId: 'club-b' },
      ],
      season: 2026,
      round: 1,
    };

    await expect(
      migrateSavesIndex({
        evidenceForSave: async () => ambiguous,
        paths: location,
      }),
    ).rejects.toThrow('AMBIGUOUS_OWNERSHIP');
    expect(
      fs
        .readdirSync(location.savesDirectory)
        .some((file) => file.startsWith('saves_index.json.backup-')),
    ).toBe(true);
    expect(JSON.parse(fs.readFileSync(location.indexPath, 'utf8'))).toEqual(old);
  });

  it('backs up but does not replace the index when database evidence is missing', async () => {
    const location = paths();
    fs.mkdirSync(location.savesDirectory, { recursive: true });
    const old = {
      currentSaveId: 'save-a',
      saves: [{
        id: 'save-a', name: 'Legacy', fileName: 'save-a.db',
        createdAt: '2026-09-09T10:00:00.000Z',
        updatedAt: '2026-09-09T10:00:00.000Z',
      }],
    };
    fs.writeFileSync(location.indexPath, JSON.stringify(old));

    await expect(
      migrateSavesIndex({
        evidenceForSave: async () => {
          throw new Error('A migração de saves legados exige evidência do banco.');
        },
        paths: location,
      }),
    ).rejects.toThrow('A migração de saves legados exige evidência do banco.');
    expect(
      fs
        .readdirSync(location.savesDirectory)
        .some((file) => file.startsWith('saves_index.json.backup-')),
    ).toBe(true);
    expect(JSON.parse(fs.readFileSync(location.indexPath, 'utf8'))).toEqual(old);
  });
});

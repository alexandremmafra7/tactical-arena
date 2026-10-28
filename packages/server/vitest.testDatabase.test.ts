import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  SERVER_TEST_DIRECTORY_ENV,
  assertSafeServerTestDatabase,
} from './vitest.testDatabase.js';
import { prisma } from './src/db/prisma.js';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const safeDirectory = path.join(
  os.tmpdir(),
  'tactical-arena-server-tests-unit',
);
const safeDatabase = path.join(safeDirectory, 'active.db');
const repositoryDevDb = path.join(
  serverDirectory,
  'prisma',
  'dev.db',
);
const outsideDatabase = path.join(os.tmpdir(), 'outside.db');

describe('assertSafeServerTestDatabase', () => {
  test('rejects a missing DATABASE_URL', () => {
    expect(() =>
      assertSafeServerTestDatabase({
        VITEST: 'true',
        [SERVER_TEST_DIRECTORY_ENV]: safeDirectory,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  test('rejects the repository development database', () => {
    expect(() =>
      assertSafeServerTestDatabase({
        VITEST: 'true',
        DATABASE_URL: `file:${repositoryDevDb}`,
        [SERVER_TEST_DIRECTORY_ENV]: safeDirectory,
      }),
    ).toThrow(/dev\.db/);
  });

  test('rejects a database outside the generated directory', () => {
    expect(() =>
      assertSafeServerTestDatabase({
        VITEST: 'true',
        DATABASE_URL: `file:${outsideDatabase}`,
        [SERVER_TEST_DIRECTORY_ENV]: safeDirectory,
      }),
    ).toThrow(/fora|outside/i);
  });

  test('returns the normalized database inside a safe directory', () => {
    expect(
      assertSafeServerTestDatabase({
        VITEST: 'true',
        DATABASE_URL: `file:${safeDatabase.replace(/\\/g, '/')}`,
        [SERVER_TEST_DIRECTORY_ENV]: safeDirectory,
      }),
    ).toBe(path.resolve(safeDatabase));
  });
});

test(
  'the global Prisma client is connected only to this run temporary database',
  async () => {
    const expected = assertSafeServerTestDatabase(process.env);
    const databases = await prisma.$queryRawUnsafe<
      Array<{ seq: number; name: string; file: string }>
    >('PRAGMA database_list');
    const main = databases.find(
      (database) => database.name === 'main',
    );

    expect(main).toBeDefined();
    expect(path.resolve(main!.file)).toBe(expected);
    expect(expected).not.toBe(path.resolve(repositoryDevDb));
  },
);

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SERVER_TEST_DIRECTORY_ENV,
  assertSafeServerTestDatabase,
} from './vitest.testDatabase.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Starts every run from an immutable template copied into an isolated temporary directory. */
export default function setup() {
  const template = path.join(here, 'prisma', 'template.db');
  if (!fs.existsSync(template)) {
    throw new Error(`Banco-base de testes ausente: ${template}`);
  }

  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousTemplatePath = process.env.TACTICAL_ARENA_TEMPLATE_DATABASE_PATH;
  const previousTestDirectory = process.env[SERVER_TEST_DIRECTORY_ENV];
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'tactical-arena-server-tests-'),
  );
  const databasePath = path.join(temporaryDirectory, 'active.db');

  try {
    fs.copyFileSync(template, databasePath);
    process.env.DATABASE_URL = `file:${databasePath.replace(/\\/g, '/')}`;
    process.env.TACTICAL_ARENA_TEMPLATE_DATABASE_PATH = template;
    process.env[SERVER_TEST_DIRECTORY_ENV] = temporaryDirectory;
    assertSafeServerTestDatabase(process.env);
  } catch (error) {
    fs.rmSync(temporaryDirectory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
    throw error;
  }

  return () => {
    try {
      fs.rmSync(temporaryDirectory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    } finally {
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;

      if (previousTemplatePath === undefined) {
        delete process.env.TACTICAL_ARENA_TEMPLATE_DATABASE_PATH;
      } else {
        process.env.TACTICAL_ARENA_TEMPLATE_DATABASE_PATH = previousTemplatePath;
      }

      if (previousTestDirectory === undefined) {
        delete process.env[SERVER_TEST_DIRECTORY_ENV];
      } else {
        process.env[SERVER_TEST_DIRECTORY_ENV] = previousTestDirectory;
      }
    }
  };
}

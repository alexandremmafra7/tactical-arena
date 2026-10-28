import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_TEST_DIRECTORY_ENV =
  'TACTICAL_ARENA_SERVER_TEST_DIRECTORY' as const;

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDevDb = path.resolve(
  serverDirectory,
  'prisma',
  'dev.db',
);

function comparablePath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32'
    ? resolved.toLowerCase()
    : resolved;
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function assertSafeServerTestDatabase(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl?.startsWith('file:')) {
    throw new Error(
      'DATABASE_URL de teste deve existir e usar o protocolo file:.',
    );
  }

  const configuredDirectory = env[SERVER_TEST_DIRECTORY_ENV];
  if (!configuredDirectory) {
    throw new Error(`${SERVER_TEST_DIRECTORY_ENV} não foi definido.`);
  }

  const temporaryRoot = comparablePath(os.tmpdir());
  const testDirectory = comparablePath(configuredDirectory);
  const directoryName = path.basename(testDirectory);
  if (
    !directoryName.startsWith('tactical-arena-server-tests-') ||
    !isInside(temporaryRoot, testDirectory)
  ) {
    throw new Error(
      'O diretório do banco de teste está fora do diretório temporário seguro.',
    );
  }

  const databasePath = comparablePath(databaseUrl.slice('file:'.length));
  if (databasePath === comparablePath(repositoryDevDb)) {
    throw new Error(
      'O banco de teste nunca pode apontar para packages/server/prisma/dev.db.',
    );
  }
  if (!isInside(testDirectory, databasePath)) {
    throw new Error(
      'O banco de teste está fora do diretório temporário gerado.',
    );
  }

  return path.resolve(databaseUrl.slice('file:'.length));
}

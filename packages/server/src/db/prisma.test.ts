import { beforeEach, describe, expect, it, vi } from 'vitest';

const { client, extend } = vi.hoisted(() => {
  const client = {};
  return {
    client,
    extend: vi.fn((_config: unknown) => client),
  };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({ $extends: extend })),
}));

vi.mock('../services/squadRating.js', () => ({
  computeSquadRating: vi.fn(() => ({
    attack: 1,
    defense: 2,
    goalkeeping: 3,
  })),
  computeScorerPool: vi.fn(() => []),
}));

describe('makePrisma', () => {
  beforeEach(() => {
    extend.mockClear();
  });

  it('installs every existing club write hook on a new client', async () => {
    // vitest.setup.ts imports src/db/ensureSchema.js (for its own ensureSchema() call), which imports
    // this file's real target (./prisma.js) and, transitively, the real '@prisma/client' — caching both
    // before this file's vi.mock('@prisma/client', ...) above ever runs. Without resetting the module
    // registry, the dynamic import below resolves to that already-cached real module and this test ends
    // up asserting against a live PrismaClient instead of the mock.
    vi.resetModules();
    const { makePrisma } = await import('./prisma.js');
    expect(makePrisma('file:test.db')).toBe(client);

    const extension = extend.mock.calls.at(-1)?.[0] as {
      query: { club: Record<string, unknown> };
    };
    expect(Object.keys(extension.query.club).sort()).toEqual([
      'create',
      'update',
      'updateMany',
      'upsert',
    ]);
  });
});

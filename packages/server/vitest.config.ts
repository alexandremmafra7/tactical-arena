import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // Global setup copies the immutable template into a unique os.tmpdir() directory and exports its URL
    // before workers load this setup file or any module that can construct the global Prisma client.
    globalSetup: ['./vitest.globalSetup.ts'],
    // Integration files intentionally share that one temporary database, so they must not race each other.
    fileParallelism: false,
  },
});

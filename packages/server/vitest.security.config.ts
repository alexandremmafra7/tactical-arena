import {defineConfig} from 'vitest/config';
// Deliberately excludes the legacy globalSetup, which clears dev.db.
export default defineConfig({test: {include: ['security-tests/**/*.test.ts'], fileParallelism: false}});

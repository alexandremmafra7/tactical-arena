import 'dotenv/config';
import { assertSafeServerTestDatabase } from './vitest.testDatabase.js';

assertSafeServerTestDatabase(process.env);

const { ensureSchema } = await import('./src/db/ensureSchema.js');
await ensureSchema();

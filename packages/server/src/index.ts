import 'dotenv/config';
import { createApp } from './app.js';
import { ensureSchema } from './db/ensureSchema.js';
import { backfillDerivedSquadFields } from './db/backfillDerivedSquadFields.js';
import { backfillContracts } from './db/backfillContracts.js';
import { ensureManagersForAllClubs, ensureUnemployedPool } from './services/managerService.js';

const port = Number(process.env['PORT'] ?? 3001);
const host = process.env['HOST'] ?? '127.0.0.1';

async function main() {
  // Validate security settings before any schema/bootstrap write.
  const app = createApp();
  await ensureSchema();
  await backfillDerivedSquadFields();
  await backfillContracts();
  // Clube fundado depois da importação ganha comando aqui. Num mundo já importado não há nada a fazer, e a
  // primeira consulta só traz ids — ver ensureManagersForAllClubs.
  await ensureManagersForAllClubs();
  await ensureUnemployedPool();
  app.listen(port, host, () => {
    console.log(`Tactical Arena FC API rodando em http://${host === '0.0.0.0' ? 'localhost' : host}:${port} (e acessível na rede local)`);
  });
}

main();

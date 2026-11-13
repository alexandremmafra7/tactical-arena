import 'dotenv/config';
import { createApp } from './app.js';
import { ensureSchema } from './db/ensureSchema.js';
import { prisma } from './db/prisma.js';
import { isLocalMode } from './middleware/security.js';
import { backfillDerivedSquadFields } from './db/backfillDerivedSquadFields.js';
import { backfillContracts } from './db/backfillContracts.js';
import { ensureManagersForAllClubs, ensureUnemployedPool } from './services/managerService.js';

const port = Number(process.env['PORT'] ?? 3001);
const host = process.env['HOST'] ?? '127.0.0.1';

/**
 * No mundo hospedado o SQLite passa a gravar em WAL.
 *
 * Avançar uma data são centenas de escritas pequenas, cada uma com a própria transação; no diário de
 * rollback padrão cada commit cria, sincroniza e apaga um arquivo. Medido num mundo completo: 8–10 s por
 * data no modo padrão contra 5–6 s em WAL, sem mudar uma linha das regras do jogo.
 *
 * Só no modo hospedado, de propósito: no desktop os saves são cópias do arquivo .db, e em WAL parte dos
 * dados mora no arquivo -wal ao lado — copiar só o .db levaria um save incompleto.
 */
async function enableWriteAheadLogWhenHosted(): Promise<void> {
  if (isLocalMode()) return;
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  } catch (err) {
    console.error('Não foi possível ativar o modo WAL do SQLite; seguindo no modo padrão.', err);
  }
}

async function main() {
  // Validate security settings before any schema/bootstrap write.
  const app = createApp();
  await enableWriteAheadLogWhenHosted();
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

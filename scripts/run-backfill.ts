import { backfillDerivedSquadFields } from '../packages/server/src/db/backfillDerivedSquadFields.js';
import { prisma } from '../packages/server/src/db/prisma.js';

async function main() {
  const total = await prisma.club.count();
  const started = Date.now();
  const n = await backfillDerivedSquadFields();
  console.log(`backfill: ${n} de ${total} clubes em ${Date.now() - started} ms`);
  await prisma.$disconnect();
}
void main();

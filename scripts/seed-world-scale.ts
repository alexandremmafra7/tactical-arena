/** Seeds a world-sized population so the weekly tick can be measured at the scale that matters. */
import { BOT_OWNER_ID } from '../packages/shared/src/index.js';
import { prisma } from '../packages/server/src/db/prisma.js';
import { createClub } from '../packages/server/src/services/clubService.js';

const TARGET = Number(process.env.TARGET ?? 2000);

async function main() {
  const existing = await prisma.club.count();
  const toCreate = Math.max(0, TARGET - existing);
  console.log(`clubes existentes: ${existing} | criando ${toCreate}`);
  const started = Date.now();
  for (let i = 0; i < toCreate; i += 1) {
    await createClub(BOT_OWNER_ID, `Escala ${i}`, 'KSA');
    if (i > 0 && i % 500 === 0) console.log(`  ${i} criados (${Date.now() - started} ms)`);
  }
  console.log(`total agora: ${await prisma.club.count()} clubes em ${Date.now() - started} ms`);
  await prisma.$disconnect();
}

void main();

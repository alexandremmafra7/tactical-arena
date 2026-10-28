/**
 * How long a week of the whole world takes.
 *
 * The weekly tick runs for every club that exists, roughly 36 times a season. That is fine for a country
 * and an open question for a world, so this measures it rather than guessing.
 */
import { prisma } from '../packages/server/src/db/prisma.js';
import { processWeeklyTick } from '../packages/server/src/services/weeklyTickService.js';
import { toDomain } from '../packages/server/src/services/clubService.js';

async function main() {
  const clubs = await prisma.club.count();
  const sample = await prisma.club.findMany({ take: 50, select: { playersJson: true } });
  const avgSquad = sample.reduce((sum, c) => sum + (JSON.parse(c.playersJson) as unknown[]).length, 0) / (sample.length || 1);
  console.log(`clubes: ${clubs} | elenco médio: ${avgSquad.toFixed(1)} jogadores`);

  for (let run = 1; run <= 3; run += 1) {
    const started = Date.now();
    const out = await processWeeklyTick(`2035-04-0${run}`);
    const ms = Date.now() - started;
    console.log(`semana ${run}: ${ms} ms para ${out.clubsProcessed} clubes (${(ms / Math.max(1, out.clubsProcessed)).toFixed(2)} ms/clube)`);
  }

  /**
   * The other half of the trade. Rest is no longer applied every Monday to every club; it is applied on
   * the way out of the database, to whoever is actually read. This is what that costs when a manager
   * opens a club that has been resting for a while.
   */
  const records = await prisma.club.findMany({ take: 200 });
  const readStart = Date.now();
  for (const record of records) toDomain(record);
  const readMs = Date.now() - readStart;
  console.log(`ler ${records.length} clubes com a folga acumulada: ${readMs} ms (${(readMs / records.length).toFixed(2)} ms/clube)`);

  await prisma.$disconnect();
}

void main();

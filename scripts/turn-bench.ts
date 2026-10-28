/**
 * Where the time goes in one press of the button at the turn of a year: the squads ageing, or the
 * pre-season weeks that follow it.
 */
import { prisma } from '../packages/server/src/db/prisma.js';
import { turnSeasonForAllClubs } from '../packages/server/src/services/seasonTurnService.js';
import { processWeeklyTick } from '../packages/server/src/services/weeklyTickService.js';

async function main() {
  const clubs = await prisma.club.count();
  console.log(`clubes: ${clubs}`);

  const t1 = Date.now();
  const turn = await turnSeasonForAllClubs(9001);
  console.log(`virada de ano: ${Date.now() - t1} ms para ${turn.clubsProcessed} clubes`);

  const t2 = Date.now();
  await processWeeklyTick('9001-01-07');
  console.log(`uma semana:    ${Date.now() - t2} ms`);

  await prisma.$disconnect();
}

void main();

/**
 * What a twenty-club season actually costs to play.
 *
 * The top flight went from eight clubs to twenty, which is 380 league matches a season instead of 56 —
 * a factor of 6.8. The plan said to measure that before closing the stage rather than assume it, because
 * every one of those matches is simulated minute by minute even when nobody is watching.
 */
import { LEAGUE_CAPACITY, generateDoubleRoundRobinFixtures } from '../packages/shared/src/index.js';
import { prisma } from '../packages/server/src/db/prisma.js';
import { createClub } from '../packages/server/src/services/clubService.js';
import { playLeagueRound } from '../packages/server/src/services/leagueService.js';
import { BOT_OWNER_ID } from '../packages/shared/src/index.js';
import { randomUUID } from 'node:crypto';

async function main() {
  const clubIds: string[] = [];
  const started = Date.now();
  for (let i = 0; i < LEAGUE_CAPACITY; i += 1) {
    const club = await createClub(BOT_OWNER_ID, `Volume ${i} ${randomUUID().slice(0, 6)}`, 'KSA');
    clubIds.push(club.id);
  }
  console.log(`${LEAGUE_CAPACITY} clubes criados em ${Date.now() - started} ms`);

  const fixtures = generateDoubleRoundRobinFixtures(clubIds);
  const rounds = new Set(fixtures.map((f) => f.round)).size;
  console.log(`calendário: ${rounds} rodadas, ${fixtures.length} jogos`);

  const leagueId = randomUUID();
  await prisma.league.create({
    data: {
      id: leagueId,
      countryCode: 'KSA',
      division: 90,
      name: 'Liga de Volume',
      capacity: LEAGUE_CAPACITY,
      status: 'IN_PROGRESS',
      clubIdsJson: JSON.stringify(clubIds),
      fixturesJson: JSON.stringify(fixtures),
      season: (await prisma.gameState.findUnique({ where: { id: 'singleton' } }))?.seasonYear ?? 2026,
    },
  });

  const playStart = Date.now();
  for (let round = 1; round <= rounds; round += 1) {
    await playLeagueRound(leagueId);
  }
  const ms = Date.now() - playStart;

  const row = await prisma.league.findUnique({ where: { id: leagueId } });
  const played = (JSON.parse(row!.fixturesJson) as { result?: unknown; matchId: string | null }[]).filter(
    (f) => f.result || f.matchId,
  ).length;

  console.log(`temporada inteira: ${ms} ms para ${played} jogos (${(ms / Math.max(1, played)).toFixed(1)} ms/jogo)`);
  console.log(`tamanho da liga no banco: ${(row!.fixturesJson.length / 1024).toFixed(0)} KB de calendário`);
  console.log(`partidas gravadas no banco: ${await prisma.match.count()}`);

  await prisma.$disconnect();
}

void main();

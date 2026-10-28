/** What a matchday costs across the whole world, measured rather than extrapolated. */
import { prisma } from '../packages/server/src/db/prisma.js';
import { playLeagueRound } from '../packages/server/src/services/leagueService.js';

async function main() {
  const leagues = await prisma.league.findMany({ where: { status: 'IN_PROGRESS' }, select: { id: true, fixturesJson: true } });
  const fixtures = leagues.reduce((sum, l) => sum + (JSON.parse(l.fixturesJson) as unknown[]).length, 0);
  console.log(`${leagues.length} ligas em andamento, ${fixtures} jogos na temporada`);

  for (const round of [1, 2]) {
    const started = Date.now();
    let played = 0;
    for (const league of leagues) {
      const before = await prisma.league.findUnique({ where: { id: league.id }, select: { fixturesJson: true } });
      const pendingBefore = (JSON.parse(before!.fixturesJson) as { matchId: string | null; result?: unknown }[]).filter(
        (f) => f.matchId === null && !f.result,
      ).length;
      await playLeagueRound(league.id).catch(() => null);
      const after = await prisma.league.findUnique({ where: { id: league.id }, select: { fixturesJson: true } });
      const pendingAfter = (JSON.parse(after!.fixturesJson) as { matchId: string | null; result?: unknown }[]).filter(
        (f) => f.matchId === null && !f.result,
      ).length;
      played += pendingBefore - pendingAfter;
    }
    const ms = Date.now() - started;
    console.log(`rodada ${round}: ${ms} ms para ${played} jogos (${(ms / Math.max(1, played)).toFixed(2)} ms/jogo)`);
  }

  await prisma.$disconnect();
}
void main();

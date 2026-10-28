/**
 * What #93 is actually about: the cost of asking "which round does this match belong to?"
 *
 * `findLeagueRoundContext` scans every league and parses its whole fixture list to find one match id.
 * That was cheap when a league held 8 clubs and 56 fixtures. A twenty-club league carries 380, and its
 * calendar serialises to about 156 KB — so the question is whether adding columns to Match is worth it,
 * or whether this is a cold path that nobody feels.
 */
import { prisma } from '../packages/server/src/db/prisma.js';
import { findLeagueRoundContext } from '../packages/server/src/services/leagueService.js';
import { findCupRoundContext } from '../packages/server/src/services/cupService.js';

async function main() {
  const leagues = await prisma.league.count();
  const cups = await prisma.cup.count();
  const rows = await prisma.league.findMany({ select: { fixturesJson: true } });
  const totalKb = rows.reduce((sum, r) => sum + r.fixturesJson.length, 0) / 1024;
  console.log(`ligas: ${leagues} | copas: ${cups} | calendário total: ${totalKb.toFixed(0)} KB (${(totalKb / Math.max(1, leagues)).toFixed(1)} KB por liga)`);

  // A real match id, so the scan runs the way it does in the game.
  const withMatch = rows
    .map((r) => (JSON.parse(r.fixturesJson) as { matchId: string | null }[]).find((f) => f.matchId)?.matchId)
    .find(Boolean);
  if (!withMatch) {
    console.log('nenhuma partida gravada neste banco — nada a medir');
    await prisma.$disconnect();
    return;
  }

  const RUNS = 20;
  let leagueMs = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const t = Date.now();
    await findLeagueRoundContext(withMatch);
    leagueMs += Date.now() - t;
  }
  let cupMs = 0;
  for (let i = 0; i < RUNS; i += 1) {
    const t = Date.now();
    await findCupRoundContext(withMatch);
    cupMs += Date.now() - t;
  }

  console.log(`findLeagueRoundContext: ${(leagueMs / RUNS).toFixed(1)} ms por chamada`);
  console.log(`findCupRoundContext:    ${(cupMs / RUNS).toFixed(1)} ms por chamada`);
  await prisma.$disconnect();
}

void main();

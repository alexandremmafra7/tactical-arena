/**
 * Review harness for the xG engine: does the number of goals correspond to the real-world pattern?
 * Measures goals, shots, xG, conversion rate, big chances, and scoreline distribution over a large
 * sample, plus the xG-to-goals relationship that real analytics expect (sum(xG) ≈ sum(goals)).
 */
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import { generateStarterSquad } from '../packages/shared/src/domain/squadGenerator.js';
import { autoFillLineup } from '../packages/shared/src/domain/lineupAutofill.js';
import { makeClub } from '../packages/shared/src/simulation/testFactories.js';

function club(id: string, seed: string, skill: number) {
  return { ...makeClub(id, id, skill), players: generateStarterSquad(id, 'BRA', seed, skill) };
}

function measure(home: ReturnType<typeof club>, away: ReturnType<typeof club>, N: number, label: string) {
  const homeTactic = { ...autoFillLineup(home), clubId: home.id };
  const awayTactic = { ...autoFillLineup(away), clubId: away.id };

  let goals = 0;
  let shots = 0;
  let onTarget = 0;
  let xgSum = 0;
  let bigChances = 0;
  let penalties = 0;
  let nilNil = 0;
  let draws = 0;
  let homeWins = 0;
  let awayWins = 0;
  const goalsDist: number[] = [];

  for (let i = 0; i < N; i++) {
    const r = simulateMatch({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      seed: `xg-review-${label}-${i}`,
    });
    const total = r.homeGoals + r.awayGoals;
    goals += total;
    goalsDist[total] = (goalsDist[total] ?? 0) + 1;
    shots += r.stats.home.shots + r.stats.away.shots;
    onTarget += r.stats.home.shotsOnTarget + r.stats.away.shotsOnTarget;
    xgSum += r.stats.home.xg + r.stats.away.xg;
    bigChances += r.stats.home.bigChances + r.stats.away.bigChances;
    penalties += r.events.filter((e) => e.isPenalty).length;
    if (r.homeGoals === 0 && r.awayGoals === 0) nilNil++;
    if (r.homeGoals === r.awayGoals) draws++;
    else if (r.homeGoals > r.awayGoals) homeWins++;
    else awayWins++;
  }

  const perMatch = (v: number) => (v / N).toFixed(2);
  console.log(`\n=== ${label} (${N} jogos) ===`);
  console.log(`  gols/jogo        : ${perMatch(goals)}   (real ~2.7)`);
  console.log(`  xG/jogo          : ${perMatch(xgSum)}   (real ~2.5-2.8)`);
  console.log(`  gols vs xG       : ${perMatch(goals)} gols x ${perMatch(xgSum)} xG  (real: devem convergir)`);
  console.log(`  finalizações/jogo: ${perMatch(shots)}   (real ~25)`);
  console.log(`  no gol/jogo      : ${perMatch(onTarget)}   (real ~8.4)`);
  console.log(`  grandes chances  : ${perMatch(bigChances)}   (real ~3-4)`);
  console.log(`  pênaltis/jogo    : ${perMatch(penalties)}   (real ~0.27)`);
  console.log(`  conversão        : ${((goals / shots) * 100).toFixed(1)}%   (real ~10.5%)`);
  console.log(`  no gol/finalizaç. : ${((onTarget / shots) * 100).toFixed(1)}%   (real ~34%)`);
  console.log(`  xG médio por chute: ${(xgSum / shots).toFixed(3)}   (real ~0.10-0.12)`);
  console.log(`  0x0: ${((nilNil / N) * 100).toFixed(1)}% (real ~7%)`);
  console.log(`  empates: ${((draws / N) * 100).toFixed(1)}% (real ~25%)`);
  console.log(`  mandante: ${((homeWins / N) * 100).toFixed(1)}% | visitante: ${((awayWins / N) * 100).toFixed(1)}%`);
  console.log(
    `  distribuição de gols: ${goalsDist.map((c, i) => `${i} gol${i === 1 ? '' : 's'}: ${((c / N) * 100).toFixed(1)}%`).join(' | ')}`,
  );
  console.log(`  (real ~: 0=7% 1=20% 2=25% 3=22% 4=14% 5+=12%)`);
}

// Evenly matched sides — the pure shape of the engine, no quality gap skewing the funnel.
measure(club('home-prof', 'prof-squad', 70), club('away-prof', 'prof-squad', 70), 5000, 'Times equilibrados (70 x 70)');

// A realistic favourite vs underdog gap, mid-table vs relegation.
measure(club('home-strong', 'strong', 82), club('away-weak', 'weak', 58), 3000, 'Favorito (82) x Azarão (58)');

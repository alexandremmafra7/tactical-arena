/**
 * How much do the tactical dials actually decide?
 *
 * Every lever has a modifier somewhere in the code; that is not the same as the lever mattering at the
 * final whistle. This plays thousands of matches between identical squads, changing one decision at a
 * time, and reports the swing in points per match. Identical squads is the whole point: any difference
 * that shows up is the decision and nothing else.
 */
import { makeClub, makeTactic } from '../packages/shared/src/simulation/testFactories.js';
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import type { Tactic } from '../packages/shared/src/domain/tactic.js';
import type { Club } from '../packages/shared/src/domain/club.js';

const N = 1200;

function playSeries(home: Club, away: Club, homeTactic: Tactic, awayTactic: Tactic, tag: string) {
  let hp = 0;
  let hg = 0;
  let ag = 0;
  let wins = 0;
  let draws = 0;
  for (let i = 0; i < N; i += 1) {
    const r = simulateMatch({ seed: `${tag}-${i}`, home: { club: home, tactic: homeTactic }, away: { club: away, tactic: awayTactic } });
    hg += r.homeGoals;
    ag += r.awayGoals;
    if (r.homeGoals > r.awayGoals) { hp += 3; wins += 1; } else if (r.homeGoals === r.awayGoals) { hp += 1; draws += 1; }
  }
  return {
    ppg: hp / N,
    winPct: (wins / N) * 100,
    drawPct: (draws / N) * 100,
    gf: hg / N,
    ga: ag / N,
  };
}

function row(label: string, r: ReturnType<typeof playSeries>) {
  console.log(
    `  ${label.padEnd(34)} ${r.ppg.toFixed(2).padStart(5)} pts  ${r.winPct.toFixed(0).padStart(3)}% V  ` +
      `${r.gf.toFixed(2)} x ${r.ga.toFixed(2)}`,
  );
}

const A = makeClub('aaa', 'Time A', 70, { seed: 'sa' });
const B = makeClub('bbb', 'Time B', 70, { seed: 'sb' });
const base = makeTactic(A);
const oppBase = makeTactic(B, { clubId: B.id, lineup: B.players.map((p) => ({ playerId: p.id })) });

console.log(`${N} partidas por linha, esquadras idênticas em força (70), variando só a decisão.\n`);

console.log('MENTALIDADE (adversário equilibrado):');
for (const m of ['defensive', 'balanced', 'attacking'] as const) {
  row(m, playSeries(A, B, { ...base, mentality: m }, oppBase, `men-${m}`));
}

console.log('\nPOSTURA OFENSIVA (adversário equilibrado):');
for (const a of ['COUNTER_ATTACK', 'BALANCED', 'TOTAL_ATTACK'] as const) {
  row(a, playSeries(A, B, { ...base, attackApproach: a }, oppBase, `app-${a}`));
}

console.log('\nMARCAÇÃO (adversário joga pelo meio):');
for (const mk of ['LIGHT', 'BALANCED', 'HEAVY', 'MAN_MARKING', 'ZONAL'] as const) {
  row(mk, playSeries(A, B, { ...base, markingStyle: mk }, { ...oppBase, attackStyle: 'THROUGH_MIDDLE' }, `mk-${mk}`));
}

console.log('\nPRESSÃO (adversário no contra-ataque):');
for (const p of ['LOW_BLOCK', 'MEDIUM', 'HIGH_PRESS'] as const) {
  row(p, playSeries(A, B, { ...base, pressing: p }, { ...oppBase, attackApproach: 'COUNTER_ATTACK' }, `pr-${p}`));
}

console.log('\nESTILO x FORMAÇÃO DO ADVERSÁRIO (5-3-2 fechado vs 4-3-3 aberto):');
for (const st of ['WINGS', 'BALANCED', 'THROUGH_MIDDLE'] as const) {
  row(`${st} vs 5-3-2`, playSeries(A, B, { ...base, attackStyle: st, formation: '4-3-3' }, { ...oppBase, formation: '5-3-2' }, `st-${st}-532`));
}
for (const st of ['WINGS', 'THROUGH_MIDDLE'] as const) {
  row(`${st} vs 4-3-3`, playSeries(A, B, { ...base, attackStyle: st, formation: '4-3-3' }, { ...oppBase, formation: '4-3-3' }, `st-${st}-433`));
}

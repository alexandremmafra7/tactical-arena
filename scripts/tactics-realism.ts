/**
 * Does the match still look like football when the manager picks something other than the default?
 *
 * scripts/match-profile.ts calibrates the engine against real data, but it does so with `autoFillLineup`,
 * which sets every tactical dial to BALANCED. That is one point in the space. This walks the same
 * measurement across the dials a manager actually touches, to see whether the shape of the game survives.
 */
import { makeClub } from '../packages/shared/src/simulation/testFactories.js';
import { autoFillLineup } from '../packages/shared/src/domain/lineupAutofill.js';
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import type { Tactic } from '../packages/shared/src/domain/tactic.js';

const N = 2000;
const home = makeClub('h', 'Casa', 70, { seed: 'h' });
const away = makeClub('a', 'Fora', 70, { seed: 'a' });
const baseHome = { ...autoFillLineup(home), clubId: home.id } as Tactic;
const baseAway = { ...autoFillLineup(away), clubId: away.id } as Tactic;

function measure(h: Tactic, a: Tactic, tag: string) {
  let goals = 0;
  let draws = 0;
  let nil = 0;
  let shots = 0;
  for (let i = 0; i < N; i += 1) {
    const r = simulateMatch({ seed: `${tag}-${i}`, home: { club: home, tactic: h }, away: { club: away, tactic: a } });
    goals += r.homeGoals + r.awayGoals;
    if (r.homeGoals === r.awayGoals) draws += 1;
    if (r.homeGoals + r.awayGoals === 0) nil += 1;
    shots += (r.stats?.home.shots ?? 0) + (r.stats?.away.shots ?? 0);
  }
  return { goals: goals / N, draws: (draws / N) * 100, nil: (nil / N) * 100, shots: shots / N };
}

function row(label: string, m: ReturnType<typeof measure>) {
  console.log(
    `  ${label.padEnd(30)} ${m.goals.toFixed(2)} gols  ${m.draws.toFixed(0).padStart(2)}% empates  ` +
      `${m.nil.toFixed(0).padStart(2)}% 0x0  ${m.shots.toFixed(1)} finalizações`,
  );
}

console.log(`Alvo real: 2,70 gols | 25% empates | ~7% 0x0 | 25 finalizações\n`);
console.log('AMBOS OS LADOS COM A MESMA POSTURA:');
for (const ap of ['COUNTER_ATTACK', 'BALANCED', 'TOTAL_ATTACK'] as const) {
  row(ap, measure({ ...baseHome, attackApproach: ap }, { ...baseAway, attackApproach: ap }, `ap-${ap}`));
}

console.log('\nAMBOS COM A MESMA MENTALIDADE:');
for (const m of ['defensive', 'balanced', 'attacking'] as const) {
  row(m, measure({ ...baseHome, mentality: m }, { ...baseAway, mentality: m }, `me-${m}`));
}

console.log('\nAMBOS COM A MESMA PRESSÃO:');
for (const p of ['LOW_BLOCK', 'MEDIUM', 'HIGH_PRESS'] as const) {
  row(p, measure({ ...baseHome, pressing: p }, { ...baseAway, pressing: p }, `pr-${p}`));
}

console.log('\nPIOR CASO REALISTA (dois times fechados):');
row(
  'defensivo+contra+low block',
  measure(
    { ...baseHome, mentality: 'defensive', attackApproach: 'COUNTER_ATTACK', pressing: 'LOW_BLOCK' },
    { ...baseAway, mentality: 'defensive', attackApproach: 'COUNTER_ATTACK', pressing: 'LOW_BLOCK' },
    'worst',
  ),
);

/**
 * What the eleven you pick is worth, measured the same way: identical squads, one decision changed.
 */
import { makeClub } from '../packages/shared/src/simulation/testFactories.js';
import { autoFillLineup } from '../packages/shared/src/domain/lineupAutofill.js';
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import { positionMismatchFactor } from '../packages/shared/src/simulation/teamStrength.js';
import type { Tactic } from '../packages/shared/src/domain/tactic.js';

const N = 1500;
const home = makeClub('h', 'Casa', 70, { seed: 'h' });
const away = makeClub('a', 'Fora', 70, { seed: 'a' });
const baseAway = { ...autoFillLineup(away), clubId: away.id } as Tactic;
const proper = { ...autoFillLineup(home), clubId: home.id } as Tactic;

/** Same eleven players, shirts shuffled: the goalkeeper stays, everyone else is put somewhere else. */
const scrambled: Tactic = {
  ...proper,
  lineup: [proper.lineup[0], ...[...proper.lineup.slice(1)].reverse()],
};

function series(h: Tactic, tag: string) {
  let pts = 0;
  let gf = 0;
  let ga = 0;
  for (let i = 0; i < N; i += 1) {
    const r = simulateMatch({ seed: `${tag}-${i}`, home: { club: home, tactic: h }, away: { club: away, tactic: baseAway } });
    gf += r.homeGoals;
    ga += r.awayGoals;
    if (r.homeGoals > r.awayGoals) pts += 3;
    else if (r.homeGoals === r.awayGoals) pts += 1;
  }
  return { ppg: pts / N, gf: gf / N, ga: ga / N };
}

const a = series(proper, 'proper');
const b = series(scrambled, 'scrambled');
console.log('Mesmos onze jogadores, só mudando quem joga onde:\n');
console.log(`  escalação por posição   ${a.ppg.toFixed(2)} pts   ${a.gf.toFixed(2)} x ${a.ga.toFixed(2)}`);
console.log(`  posições embaralhadas   ${b.ppg.toFixed(2)} pts   ${b.gf.toFixed(2)} x ${b.ga.toFixed(2)}`);
console.log(`  custo de escalar errado ${(a.ppg - b.ppg).toFixed(2)} pts por partida\n`);

console.log('Perda de eficiência por passo fora da posição natural:');
for (const [nat, slot] of [['DEF', 'DEF'], ['DEF', 'LAT'], ['DEF', 'MID'], ['DEF', 'ATT'], ['GK', 'ATT']] as const) {
  console.log(`  ${nat} jogando de ${slot.padEnd(3)}  ${(positionMismatchFactor(nat, slot) * 100).toFixed(0)}% do rendimento`);
}

/**
 * The dials that should be an underdog's tools, tested where an underdog actually lives.
 *
 * Measuring only between equals hides half of what a tactic is for: sitting deep and seeing a game out is
 * not supposed to beat an equal opponent, it is supposed to steal something from a better one.
 */
import { makeClub } from '../packages/shared/src/simulation/testFactories.js';
import { autoFillLineup } from '../packages/shared/src/domain/lineupAutofill.js';
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import type { Tactic } from '../packages/shared/src/domain/tactic.js';

const N = 1200;

function scenario(label: string, ourSkill: number, theirSkill: number) {
  const us = makeClub('u', 'Nós', ourSkill, { seed: `u${ourSkill}` });
  const them = makeClub('t', 'Eles', theirSkill, { seed: `t${theirSkill}` });
  const bu = { ...autoFillLineup(us), clubId: us.id } as Tactic;
  const bt = { ...autoFillLineup(them), clubId: them.id } as Tactic;

  const ppg = (h: Tactic, tag: string) => {
    let pts = 0;
    for (let i = 0; i < N; i += 1) {
      const r = simulateMatch({ seed: `${tag}-${i}`, home: { club: us, tactic: h }, away: { club: them, tactic: bt } });
      if (r.homeGoals > r.awayGoals) pts += 3;
      else if (r.homeGoals === r.awayGoals) pts += 1;
    }
    return pts / N;
  };

  console.log(`\n${label} (nós ${ourSkill} x eles ${theirSkill}):`);
  const men = (['defensive', 'balanced', 'attacking'] as const).map(
    (m) => `${m} ${ppg({ ...bu, mentality: m }, `${label}-m-${m}`).toFixed(2)}`,
  );
  console.log(`  mentalidade  ${men.join('  |  ')}`);
  const pr = (['LOW_BLOCK', 'MEDIUM', 'HIGH_PRESS'] as const).map(
    (p) => `${p} ${ppg({ ...bu, pressing: p }, `${label}-p-${p}`).toFixed(2)}`,
  );
  console.log(`  pressão      ${pr.join('  |  ')}`);
}

scenario('AZARÃO', 55, 75);
scenario('IGUAIS', 65, 65);
scenario('FAVORITO', 75, 55);

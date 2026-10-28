/**
 * Does the cheap rule produce the same football as the engine it stands in for?
 *
 * A background league that scores differently from a watched one would show up in every table in the
 * world. This plays the same fixtures both ways and compares the distributions, not just the averages.
 */
import { makeClub } from '../packages/shared/src/simulation/testFactories.js';
import { autoFillLineup } from '../packages/shared/src/domain/lineupAutofill.js';
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import { computeTeamStrength } from '../packages/shared/src/simulation/teamStrength.js';
import { simulateBackgroundResult } from '../packages/shared/src/simulation/backgroundResult.js';
import type { Tactic } from '../packages/shared/src/domain/tactic.js';

const N = 4000;

function compare(label: string, homeSkill: number, awaySkill: number) {
  const home = makeClub(`bg-h-${homeSkill}`, 'Casa', homeSkill, { seed: `bg-h-${homeSkill}` });
  const away = makeClub(`bg-a-${awaySkill}`, 'Fora', awaySkill, { seed: `bg-a-${awaySkill}` });
  const th = { ...autoFillLineup(home), clubId: home.id } as Tactic;
  const ta = { ...autoFillLineup(away), clubId: away.id } as Tactic;
  const hs = computeTeamStrength(home, th);
  const as = computeTeamStrength(away, ta);

  const tally = (name: string, play: (i: number) => { homeGoals: number; awayGoals: number }) => {
    let g = 0, d = 0, hw = 0, nil = 0, ms = 0;
    const t0 = Date.now();
    for (let i = 0; i < N; i += 1) {
      const r = play(i);
      g += r.homeGoals + r.awayGoals;
      if (r.homeGoals === r.awayGoals) d += 1;
      if (r.homeGoals > r.awayGoals) hw += 1;
      if (r.homeGoals + r.awayGoals === 0) nil += 1;
    }
    ms = Date.now() - t0;
    return `${name.padEnd(8)} ${(g / N).toFixed(2)} gols  ${((d / N) * 100).toFixed(0).padStart(2)}% E  ${((hw / N) * 100).toFixed(0).padStart(2)}% V casa  ${((nil / N) * 100).toFixed(0).padStart(2)}% 0x0  ${(ms / N).toFixed(3)} ms`;
  };

  console.log(`\n${label} (${homeSkill} x ${awaySkill}):`);
  console.log('  ' + tally('motor', (i) => simulateMatch({ seed: `cmp-${label}-${i}`, home: { club: home, tactic: th }, away: { club: away, tactic: ta } })));
  console.log('  ' + tally('regra', (i) => simulateBackgroundResult(hs, as, `cmp-${label}-${i}`)));
}

compare('IGUAIS', 65, 65);
compare('FAVORITO EM CASA', 78, 58);
compare('AZARAO EM CASA', 55, 75);

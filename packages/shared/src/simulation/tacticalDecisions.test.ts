import { describe, expect, it } from 'vitest';
import { makeClub } from './testFactories.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';
import { simulateMatch } from './engine.js';
import type { Tactic } from '../domain/tactic.js';

const N = 400;

function ppgOver(ourSkill: number, theirSkill: number, ours: Partial<Tactic>, theirs: Partial<Tactic>, tag: string) {
  const us = makeClub(`d-${ourSkill}`, 'Nós', ourSkill, { seed: `d-u-${ourSkill}` });
  const them = makeClub(`d-${theirSkill}-x`, 'Eles', theirSkill, { seed: `d-t-${theirSkill}` });
  const ourTactic = { ...autoFillLineup(us), clubId: us.id, ...ours } as Tactic;
  const theirTactic = { ...autoFillLineup(them), clubId: them.id, ...theirs } as Tactic;

  let points = 0;
  for (let i = 0; i < N; i += 1) {
    const r = simulateMatch({ seed: `${tag}-${i}`, home: { club: us, tactic: ourTactic }, away: { club: them, tactic: theirTactic } });
    if (r.homeGoals > r.awayGoals) points += 3;
    else if (r.homeGoals === r.awayGoals) points += 1;
  }
  return points / N;
}

/**
 * The two dials that used to decide nothing.
 *
 * Mentality and pressing both carried a modifier, and both were a flat symmetric trade applied in every
 * minute of every match regardless of anything else — fifteen percent of attack for fifteen percent of
 * defence, take it or leave it. Measured over a thousand matches, the three mentalities finished within
 * six hundredths of a point of each other and the three pressing settings within seven. They were two
 * buttons on a screen that changed how the match read and not who won it.
 *
 * What was missing in both cases was context. A tactic is a decision, and a decision can only be worth
 * something if it can be wrong: these tests hold the situations in which each is right and the ones in
 * which it costs.
 */
describe('tactical decisions', () => {
  it('makes pressing a read on how the opponent is trying to play', () => {
    // Against a side committed to passing through the middle, pressing high is a bet on beating exactly
    // what they are good at. Against one going round the outside, it is a trap worth setting.
    const vsPossession = ppgOver(62, 62, { pressing: 'HIGH_PRESS' }, { attackStyle: 'THROUGH_MIDDLE' }, 'press-poss');
    const vsDirect = ppgOver(62, 62, { pressing: 'HIGH_PRESS' }, { attackStyle: 'WINGS' }, 'press-direct');

    expect(vsDirect, `contra jogo direto ${vsDirect.toFixed(2)} x contra posse ${vsPossession.toFixed(2)}`).toBeGreaterThan(
      vsPossession,
    );

    // And there has to be real upside somewhere, or the read is just a penalty in disguise: squeezing a
    // weaker side high up the pitch is the case where pressing is unambiguously the right call.
    const pressTheWeak = ppgOver(75, 55, { pressing: 'HIGH_PRESS' }, {}, 'press-weak');
    const sitOffTheWeak = ppgOver(75, 55, { pressing: 'LOW_BLOCK' }, {}, 'off-weak');
    expect(
      pressTheWeak,
      `pressionando o fraco ${pressTheWeak.toFixed(2)} x recuando ${sitOffTheWeak.toFixed(2)}`,
    ).toBeGreaterThan(sitOffTheWeak);
  });

  it('makes mentality a decision about the match you are in, not a slider', () => {
    // As the weaker side, seeing the game out is worth more than chasing it.
    const underdogDefensive = ppgOver(55, 75, { mentality: 'defensive' }, {}, 'ud-def');
    const underdogBalanced = ppgOver(55, 75, { mentality: 'balanced' }, {}, 'ud-bal');
    expect(
      underdogDefensive,
      `azarão defensivo ${underdogDefensive.toFixed(2)} x equilibrado ${underdogBalanced.toFixed(2)}`,
    ).toBeGreaterThan(underdogBalanced);

    // As the stronger side, the same choice throws away the advantage it was supposed to press.
    const favouriteDefensive = ppgOver(75, 55, { mentality: 'defensive' }, {}, 'fv-def');
    const favouriteAttacking = ppgOver(75, 55, { mentality: 'attacking' }, {}, 'fv-att');
    expect(
      favouriteAttacking,
      `favorito ofensivo ${favouriteAttacking.toFixed(2)} x defensivo ${favouriteDefensive.toFixed(2)}`,
    ).toBeGreaterThan(favouriteDefensive);
  });

  it('leaves the balanced setup exactly as the calibration found it', () => {
    /**
     * Both rules are deliberately silent in the middle: pressing only reads the opponent when it is high
     * or low, and mentality only manages a game when it is committed one way. That is what lets the whole
     * of scripts/match-profile.ts stay valid — it measures with every dial balanced, and neither of these
     * may move that match by so much as a goal.
     */
    const before = ppgOver(65, 65, {}, {}, 'neutral');
    const after = ppgOver(65, 65, { mentality: 'balanced', pressing: 'MEDIUM' }, {}, 'neutral');
    expect(after).toBe(before);
  });
});

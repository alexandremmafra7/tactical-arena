import { describe, expect, it } from 'vitest';
import { makeClub } from './testFactories.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';
import { simulateMatch } from './engine.js';
import { computeTeamStrength } from './teamStrength.js';
import { simulateBackgroundResult } from './backgroundResult.js';
import type { Tactic } from '../domain/tactic.js';

const N = 1500;

function sides(homeSkill: number, awaySkill: number) {
  const home = makeClub(`br-h-${homeSkill}`, 'Casa', homeSkill, { seed: `br-h-${homeSkill}` });
  const away = makeClub(`br-a-${awaySkill}`, 'Fora', awaySkill, { seed: `br-a-${awaySkill}` });
  const th = { ...autoFillLineup(home), clubId: home.id } as Tactic;
  const ta = { ...autoFillLineup(away), clubId: away.id } as Tactic;
  return { home, away, th, ta, hs: computeTeamStrength(home, th), as: computeTeamStrength(away, ta) };
}

function tally(play: (i: number) => { homeGoals: number; awayGoals: number }) {
  let goals = 0;
  let draws = 0;
  let homeWins = 0;
  for (let i = 0; i < N; i += 1) {
    const r = play(i);
    goals += r.homeGoals + r.awayGoals;
    if (r.homeGoals === r.awayGoals) draws += 1;
    else if (r.homeGoals > r.awayGoals) homeWins += 1;
  }
  return { goals: goals / N, draws: draws / N, homeWins: homeWins / N };
}

/**
 * The rule that stands in for the engine when nobody is watching.
 *
 * A world with two divisions everywhere plays over five hundred fixtures on the same Sunday, and playing
 * each of them out minute by minute is not the expensive part — the engine is 0.62 ms. What was expensive
 * was that every one of them opened two 42 KB squads. So the rule works from ratings kept beside the club
 * and never touches a roster, which is the whole saving.
 *
 * What it must not do is play a different game. A background league that scored differently from a
 * watched one would show up in every table in the world, in the transfer market, and in whoever the
 * manager ends up facing in a continental cup.
 */
describe('background result rule', () => {
  it('produces the same football as the engine it stands in for', () => {
    const { home, away, th, ta, hs, as } = sides(65, 65);
    const engine = tally((i) => simulateMatch({ seed: `agree-${i}`, home: { club: home, tactic: th }, away: { club: away, tactic: ta } }));
    const rule = tally((i) => simulateBackgroundResult(hs, as, `agree-${i}`));

    expect(rule.goals, `regra ${rule.goals.toFixed(2)} x motor ${engine.goals.toFixed(2)}`).toBeGreaterThan(engine.goals * 0.9);
    expect(rule.goals).toBeLessThan(engine.goals * 1.1);
    expect(Math.abs(rule.draws - engine.draws), 'taxa de empates').toBeLessThan(0.05);
  }, 60000);

  it('knows a better side from a worse one, and keeps the home edge', () => {
    const strong = sides(80, 55);
    const favourite = tally((i) => simulateBackgroundResult(strong.hs, strong.as, `fav-${i}`));
    const even = sides(65, 65);
    const level = tally((i) => simulateBackgroundResult(even.hs, even.as, `lvl-${i}`));

    expect(favourite.homeWins).toBeGreaterThan(level.homeWins + 0.15);
    // Playing at home is worth something even between equals — the venue effect is in the rule too.
    expect(level.homeWins).toBeGreaterThan(1 - level.homeWins - level.draws);
  }, 60000);

  it('gives the same fixture the same score every time it is asked', () => {
    const { hs, as } = sides(70, 66);
    const first = simulateBackgroundResult(hs, as, 'liga-7-casa-fora');
    const second = simulateBackgroundResult(hs, as, 'liga-7-casa-fora');
    // A round recomputed must not quietly rewrite history.
    expect(second).toEqual(first);
  });
});

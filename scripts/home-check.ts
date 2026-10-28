/**
 * Calibration harness for the venue effect (homeAdvantage.ts).
 *
 * Two squads built by the game's own generator, from the same seed, set up by the same auto-fill: whatever
 * the home side takes beyond half the points is the mando and nothing else. Real squads rather than the
 * test factories on purpose — the factory clubs barely score, and a target expressed in goal difference is
 * meaningless in a league where most matches finish nil-nil.
 *
 * Targets, from the research quoted in homeAdvantage.ts: about 57% of the points and a goal difference near
 * +0.3 per match at a typical crowd, easing toward parity as the ground empties.
 */
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import { generateStarterSquad } from '../packages/shared/src/domain/squadGenerator.js';
import { autoFillLineup } from '../packages/shared/src/domain/lineupAutofill.js';
import { makeClub } from '../packages/shared/src/simulation/testFactories.js';

/** A club shell around a real generated squad — same seed both sides, so the sides are genuinely equal. */
function realClub(id: string) {
  const shell = makeClub(id, id, 70);
  return { ...shell, players: generateStarterSquad(id, 'BRA', 'shared-squad-seed') };
}

const home = realClub('home');
const away = realClub('away');
const homeTactic = { ...autoFillLineup(home), clubId: home.id };
const awayTactic = { ...autoFillLineup(away), clubId: away.id };
const N = 6000;

function run(crowdIntensity: number | undefined) {
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  let homeFouls = 0;
  let awayFouls = 0;

  for (let i = 0; i < N; i++) {
    const r = simulateMatch({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      seed: `mando-${i}`,
      crowdIntensity,
    });
    homeGoals += r.homeGoals;
    awayGoals += r.awayGoals;
    homeFouls += r.stats.home.fouls;
    awayFouls += r.stats.away.fouls;
    if (r.homeGoals > r.awayGoals) homeWins++;
    else if (r.homeGoals < r.awayGoals) awayWins++;
    else draws++;
  }

  const homePts = homeWins * 3 + draws;
  const awayPts = awayWins * 3 + draws;
  const label = crowdIntensity === undefined ? 'default' : crowdIntensity.toFixed(2);
  console.log(
    `crowd ${label.padEnd(7)} | pontos ${((homePts / (homePts + awayPts)) * 100).toFixed(1)}%` +
      ` | V ${((homeWins / N) * 100).toFixed(1)}% E ${((draws / N) * 100).toFixed(1)}% D ${((awayWins / N) * 100).toFixed(1)}%` +
      ` | gols ${(homeGoals / N).toFixed(2)} x ${(awayGoals / N).toFixed(2)} (saldo ${((homeGoals - awayGoals) / N).toFixed(2)})` +
      ` | faltas ${(homeFouls / N).toFixed(2)} x ${(awayFouls / N).toFixed(2)}`,
  );
}

for (const intensity of [0, 0.25, 0.6, 1]) run(intensity);
run(undefined);

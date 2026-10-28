/**
 * Calibration harness for what a match actually looks like, against real top-flight football.
 *
 * Every number the engine produces per match, measured over a large sample of evenly-matched fixtures,
 * next to the real-world figure it should resemble. Used to tune the chance funnel in engine.ts.
 */
import { simulateMatch, simulateMatchSegment } from '../packages/shared/src/simulation/engine.js';
import { createRng } from '../packages/shared/src/simulation/rng.js';
import { generateStarterSquad } from '../packages/shared/src/domain/squadGenerator.js';
import { autoFillLineup } from '../packages/shared/src/domain/lineupAutofill.js';
import { makeClub } from '../packages/shared/src/simulation/testFactories.js';
import { calculateMatchRatings } from '../packages/shared/src/domain/matchRatings.js';

/**
 * Real averages per match. Scoring, shots and the home split come from the top five European leagues,
 * which are the best-measured; discipline is taken from the **Brasileirão** specifically, because that is
 * the league this game models and it is a far rougher one — 24.6 fouls a match makes it the second most
 * foul-heavy national league in the world, behind only Portugal. Using European card numbers here would
 * have set the target ~20% too low.
 */
const REAL = {
  goals: 2.7,
  draws: 0.25,
  shots: 25,
  shotsOnTarget: 8.4,
  corners: 10.2,
  fouls: 24.6,
  yellows: 4.42,
  reds: 0.27,
  penalties: 0.27,
  homePoints: 0.57,
  /**
   * Expected goals and big chances per match. xG comes from the same top-five-leagues source as scoring;
   * the sum of xG across a match should converge on the actual goal count. Big chances (clear-cut chances
   * as Opta scores them, worth ~0.6+ xG apiece) run at roughly 3-4 per match.
   */
  xg: 2.65,
  bigChances: 3.5,
  /**
   * Injuries that force the player off, per match, both teams combined.
   *
   * The UEFA Elite Club Injury Study puts match injury incidence around 25 per 1000 hours of match
   * exposure. A match is 33 player-hours (22 players x 1.5h), so ~0.8 time-loss injuries per match --
   * but most of those are knocks the player plays through and only reports afterwards. What this engine
   * models is the incapacitating kind that stops the game and forces a substitution, which is roughly a
   * third of them: about one every three matches.
   */
  injuries: 0.3,
};

function club(id: string, seed: string) {
  return { ...makeClub(id, id, 70), players: generateStarterSquad(id, 'BRA', seed) };
}

// Evenly matched, so nothing here is an artefact of one side simply being better.
const home = club('home-prof', 'profile-squad');
const away = club('away-prof', 'profile-squad');
const homeTactic = { ...autoFillLineup(home), clubId: home.id };
const awayTactic = { ...autoFillLineup(away), clubId: away.id };

const N = 5000;
const t = {
  goals: 0,
  draws: 0,
  homeWins: 0,
  awayWins: 0,
  shots: 0,
  onTarget: 0,
  corners: 0,
  fouls: 0,
  yellows: 0,
  reds: 0,
  penalties: 0,
  nilNil: 0,
  injuries: 0,
  xg: 0,
  bigChances: 0,
  /** Events the commentary actually says out loud, as opposed to attempts that only reach the stat line. */
  narrated: 0,
};

for (let i = 0; i < N; i++) {
  const r = simulateMatch({
    home: { club: home, tactic: homeTactic },
    away: { club: away, tactic: awayTactic },
    seed: `profile-${i}`,
  });

  t.goals += r.homeGoals + r.awayGoals;
  if (r.homeGoals === r.awayGoals) t.draws++;
  if (r.homeGoals > r.awayGoals) t.homeWins++;
  if (r.homeGoals < r.awayGoals) t.awayWins++;
  if (r.homeGoals === 0 && r.awayGoals === 0) t.nilNil++;
  t.shots += r.stats.home.shots + r.stats.away.shots;
  t.onTarget += r.stats.home.shotsOnTarget + r.stats.away.shotsOnTarget;
  t.corners += r.stats.home.corners + r.stats.away.corners;
  t.fouls += r.stats.home.fouls + r.stats.away.fouls;
  t.xg += r.stats.home.xg + r.stats.away.xg;
  t.bigChances += r.stats.home.bigChances + r.stats.away.bigChances;
  t.narrated += r.events.length;
  for (const e of r.events) {
    if (e.type === 'card') e.suspensionMatches === undefined ? t.yellows++ : t.reds++;
    if (e.isPenalty) t.penalties++;
    if (e.type === 'injury') t.injuries++;
  }
}

const homePts = t.homeWins * 3 + t.draws;
const awayPts = t.awayWins * 3 + t.draws;

function row(label: string, got: number, want: number, digits = 2) {
  const ratio = want === 0 ? 1 : got / want;
  const flag = ratio > 1.25 || ratio < 0.8 ? ' <-- fora' : '';
  console.log(
    `${label.padEnd(22)} ${got.toFixed(digits).padStart(7)}   real ${want.toFixed(digits).padStart(7)}   ${(ratio * 100).toFixed(0).padStart(4)}%${flag}`,
  );
}

console.log(`${N} partidas equilibradas\n`);
console.log(`${''.padEnd(22)} ${'jogo'.padStart(7)}        ${'alvo'.padStart(7)}   razão`);
row('gols/partida', t.goals / N, REAL.goals);
row('empates', t.draws / N, REAL.draws);
row('finalizações', t.shots / N, REAL.shots);
row('no gol', t.onTarget / N, REAL.shotsOnTarget);
row('escanteios', t.corners / N, REAL.corners);
row('faltas', t.fouls / N, REAL.fouls);
row('amarelos', t.yellows / N, REAL.yellows);
row('vermelhos', t.reds / N, REAL.reds);
row('pênaltis', t.penalties / N, REAL.penalties);
row('lesões', t.injuries / N, REAL.injuries);
row('pontos mandante', homePts / (homePts + awayPts), REAL.homePoints);
row('xG', t.xg / N, REAL.xg);
row('grandes chances', t.bigChances / N, REAL.bigChances);
console.log('');
console.log(
  `lances narrados por partida: ${(t.narrated / N).toFixed(1)}` +
    ` (de ${(t.shots / N).toFixed(1)} finalizações — o resto fica só na estatística)`,
);
console.log(`0 x 0: ${((t.nilNil / N) * 100).toFixed(1)}% (real ~7%)`);
console.log(`conversão finalização->gol: ${((t.goals / t.shots) * 100).toFixed(1)}% (real ~10.5%)`);
console.log(`no gol / finalizações: ${((t.onTarget / t.shots) * 100).toFixed(1)}% (real ~34%)`);
console.log(`xG médio por chute: ${(t.xg / t.shots).toFixed(3)} (real ~0.10-0.12)`);
console.log(`gols vs xG: ${(t.goals / N).toFixed(2)} gols x ${(t.xg / N).toFixed(2)} xG (real: devem convergir)`);

// Fixing the scoreline must not flatten the league: a much better side has to keep beating a much worse
// one about as often as it did before, or the whole competitive structure of a season changes with it.
const strong = { ...makeClub('strong-prof', 'strong-prof', 90), players: generateStarterSquad('strong-prof', 'BRA', 'strong', 90) };
const weak = { ...makeClub('weak-prof', 'weak-prof', 30), players: generateStarterSquad('weak-prof', 'BRA', 'weak', 30) };
const strongTactic = { ...autoFillLineup(strong), clubId: strong.id };
const weakTactic = { ...autoFillLineup(weak), clubId: weak.id };

let strongWins = 0;
let mismatchDraws = 0;
let strongShots = 0;
let weakShots = 0;
const M = 2000;
for (let i = 0; i < M; i++) {
  const r = simulateMatch({
    home: { club: strong, tactic: strongTactic },
    away: { club: weak, tactic: weakTactic },
    seed: `mismatch-${i}`,
  });
  if (r.homeGoals > r.awayGoals) strongWins++;
  else if (r.homeGoals === r.awayGoals) mismatchDraws++;
  strongShots += r.stats.home.shots;
  weakShots += r.stats.away.shots;
}
console.log('');
console.log(
  `forte (90) x fraco (30): vitórias do forte ${((strongWins / M) * 100).toFixed(1)}%` +
    ` empates ${((mismatchDraws / M) * 100).toFixed(1)}%` +
    ` | finalizações ${(strongShots / M).toFixed(1)} x ${(weakShots / M).toFixed(1)}` +
    ` (${(strongShots / Math.max(1, weakShots)).toFixed(1)}x)`,
);

// Player ratings read the timeline too, and were tuned when a match produced a handful of events. Six
// times as many chances could have quietly pushed every nota up; this is the check that it did not.
let ratingTotal = 0;
let ratingCount = 0;
let bestRating = 0;
let above9 = 0;
const R = 1500;
for (let i = 0; i < R; i++) {
  const r = simulateMatch({
    home: { club: home, tactic: homeTactic },
    away: { club: away, tactic: awayTactic },
    seed: `ratings-${i}`,
  });
  const lineupOf = (c: typeof home, tac: typeof homeTactic) =>
    tac.lineup.map((s) => c.players.find((p) => p.id === s.playerId)!).filter(Boolean);
  const { home: hr, away: ar } = calculateMatchRatings(
    lineupOf(home, homeTactic),
    lineupOf(away, awayTactic),
    r.events,
    r.homeGoals,
    r.awayGoals,
  );
  for (const p of [...hr, ...ar]) {
    ratingTotal += p.rating;
    ratingCount++;
    if (p.rating > bestRating) bestRating = p.rating;
    if (p.rating >= 9) above9++;
  }
}
console.log('');
console.log(
  `notas: média ${(ratingTotal / ratingCount).toFixed(2)} (real ~6.5)` +
    ` | máxima vista ${bestRating.toFixed(1)}` +
    ` | notas >= 9.0: ${((above9 / ratingCount) * 100).toFixed(2)}%`,
);

// The numerical-disadvantage calibration, against Vecer, Kopriva & Ichiba (JQAS 2009): a side reduced to
// ten scores at about 0.67 of its previous rate while the opponent scores at about 1.20 of theirs. Only the
// *direction* of this is pinned by a test, so it is measured here whenever the engine's scale moves.
function shorthandedRates(priorEvents: ReturnType<typeof redCardAt>[]) {
  let mine = 0;
  let theirs = 0;
  const K = 3000;
  for (let i = 0; i < K; i++) {
    // The segment entry point, not simulateMatch: a dismissal already on the timeline is what makes the
    // side short, and only the segment accepts prior events.
    const s = simulateMatchSegment({
      home: { club: home, tactic: homeTactic },
      away: { club: away, tactic: awayTactic },
      rng: createRng(`vecer-${i}`),
      startMinute: 1,
      endMinute: 90,
      priorEvents,
    });
    mine += s.homeGoals;
    theirs += s.awayGoals;
  }
  return { mine: mine / K, theirs: theirs / K };
}
function redCardAt(playerId: string, minute: number) {
  return { minute, type: 'card' as const, team: 'home' as const, playerId, description: 'red', suspensionMatches: 1 };
}

const atFullStrength = shorthandedRates([]);
// Must be someone actually in the eleven — the auto-fill picks by position and overall, so an arbitrary
// index into the squad is usually a substitute, and sending *him* off changes precisely nothing.
const aManDown = shorthandedRates([redCardAt(homeTactic.lineup[5].playerId, 1)]);
console.log(
  `dez contra onze: própria ${(aManDown.mine / atFullStrength.mine).toFixed(2)}x (alvo 0.67)` +
    ` | adversária ${(aManDown.theirs / atFullStrength.theirs).toFixed(2)}x (alvo 1.20)`,
);

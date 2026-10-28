/**
 * Calibration harness for the penalty duel (penalty.ts).
 *
 * Two things to check. First the league-wide conversion rate, which real football puts near 76%. Second the
 * spread: a specialist against a poor keeper should be near-certain, a defender pressed into it against a
 * good one should be a coin flip, and pressure should only bite players who lack the nerve for it.
 */
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import {
  composure,
  penaltyConversionProbability,
  penaltyKeeperScore,
  penaltyPressure,
  penaltyTakerScore,
} from '../packages/shared/src/simulation/penalty.js';
import { generateStarterSquad } from '../packages/shared/src/domain/squadGenerator.js';
import { autoFillLineup } from '../packages/shared/src/domain/lineupAutofill.js';
import { makeClub, makePlayer } from '../packages/shared/src/simulation/testFactories.js';
import type { Player } from '../packages/shared/src/domain/player.js';
import { defaultDetailedAttributes } from '../packages/shared/src/domain/detailedAttributes.js';

// ---- league-wide rate, straight out of the engine ----------------------------------------------------

function club(id: string) {
  const shell = makeClub(id, id, 70);
  return { ...shell, players: generateStarterSquad(id, 'BRA', `${id}-squad`) };
}
const home = club('home-pen');
const away = club('away-pen');
const homeTactic = { ...autoFillLineup(home), clubId: home.id };
const awayTactic = { ...autoFillLineup(away), clubId: away.id };

let penalties = 0;
let scored = 0;
let saved = 0;
let offTarget = 0;
const N = 4000;

for (let i = 0; i < N; i++) {
  const r = simulateMatch({
    home: { club: home, tactic: homeTactic },
    away: { club: away, tactic: awayTactic },
    seed: `pen-${i}`,
  });
  for (const e of r.events) {
    if (!e.isPenalty) continue;
    penalties++;
    if (e.type === 'goal') scored++;
    else if (e.description.includes('defende') || e.description.includes('defendido') || e.description.includes('salva')) saved++;
    else offTarget++;
  }
}

console.log(
  `${penalties} pênaltis em ${N} partidas (${(penalties / N).toFixed(2)}/jogo)` +
    ` | conversão ${((scored / penalties) * 100).toFixed(1)}%` +
    ` | defendidos ${((saved / penalties) * 100).toFixed(1)}%` +
    ` | para fora ${((offTarget / penalties) * 100).toFixed(1)}%`,
);

// ---- the spread, on hand-built extremes ---------------------------------------------------------------

function withAttributes(id: string, overrides: Record<string, number>, extra: Partial<Player> = {}): Player {
  const p = makePlayer(id, extra);
  return { ...p, detailedAttributes: { ...defaultDetailedAttributes(50), ...overrides } as Player['detailedAttributes'] };
}

const specialist = withAttributes('specialist', { PENALTY_TAKING: 95, SHOT_POWER: 88, POWER: 80 }, { morale: 80, fatigue: 10 });
const defender = withAttributes('defender', { PENALTY_TAKING: 20, SHOT_POWER: 40, POWER: 35 }, { morale: 45, fatigue: 70 });
const eliteKeeper = withAttributes('elite-gk', { PENALTY_SAVING: 90, REFLEXES: 92, AGILITY: 88, ANTICIPATION: 80 });
const poorKeeper = withAttributes('poor-gk', { PENALTY_SAVING: 35, REFLEXES: 45, AGILITY: 40, ANTICIPATION: 30 });

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
console.log('');
console.log(`scores: especialista ${penaltyTakerScore(specialist).toFixed(3)} | zagueiro ${penaltyTakerScore(defender).toFixed(3)}`);
console.log(`        goleiro elite ${penaltyKeeperScore(eliteKeeper).toFixed(3)} | goleiro fraco ${penaltyKeeperScore(poorKeeper).toFixed(3)}`);
console.log(`compostura: especialista ${composure(specialist).toFixed(0)} | zagueiro exausto ${composure(defender).toFixed(0)}`);
console.log('');
console.log(`especialista x goleiro fraco : ${pct(penaltyConversionProbability(specialist, poorKeeper))}`);
console.log(`especialista x goleiro elite : ${pct(penaltyConversionProbability(specialist, eliteKeeper))}`);
console.log(`zagueiro     x goleiro fraco : ${pct(penaltyConversionProbability(defender, poorKeeper))}`);
console.log(`zagueiro     x goleiro elite : ${pct(penaltyConversionProbability(defender, eliteKeeper))}`);
console.log('');

const decisive = penaltyPressure(89, 0);
console.log(`pressão aos 89' com jogo empatado: ${decisive.toFixed(2)}`);
console.log(
  `especialista sob pressão : ${pct(penaltyConversionProbability(specialist, eliteKeeper))} ->` +
    ` ${pct(penaltyConversionProbability(specialist, eliteKeeper, decisive))}`,
);
console.log(
  `zagueiro     sob pressão : ${pct(penaltyConversionProbability(defender, eliteKeeper))} ->` +
    ` ${pct(penaltyConversionProbability(defender, eliteKeeper, decisive))}`,
);
console.log(`pressão aos 89' com 4 gols de diferença: ${penaltyPressure(89, 4).toFixed(2)}`);
console.log(`pressão aos 20' com jogo empatado: ${penaltyPressure(20, 0).toFixed(2)}`);

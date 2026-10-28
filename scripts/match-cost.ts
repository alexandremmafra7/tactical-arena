/** Where the 27.7 ms of a background match actually goes: the engine, or the bookkeeping around it. */
import { makeClub } from '../packages/shared/src/simulation/testFactories.js';
import { autoFillLineup } from '../packages/shared/src/domain/lineupAutofill.js';
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import type { Tactic } from '../packages/shared/src/domain/tactic.js';

const home = makeClub('mc-h', 'Casa', 70, { seed: 'mc-h' });
const away = makeClub('mc-a', 'Fora', 70, { seed: 'mc-a' });
const th = { ...autoFillLineup(home), clubId: home.id } as Tactic;
const ta = { ...autoFillLineup(away), clubId: away.id } as Tactic;

const N = 500;
const started = Date.now();
for (let i = 0; i < N; i += 1) {
  simulateMatch({ seed: `cost-${i}`, home: { club: home, tactic: th }, away: { club: away, tactic: ta } });
}
const ms = Date.now() - started;
console.log(`motor puro: ${(ms / N).toFixed(2)} ms por partida (${N} partidas em ${ms} ms)`);

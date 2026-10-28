/** The extension recomputes this on every roster write, so it had better be cheap. */
import { makeClub } from '../packages/shared/src/simulation/testFactories.js';
import { computeSquadRating } from '../packages/server/src/services/squadRating.js';

const club = makeClub('rc', 'Rating', 70, { seed: 'rc' });
const players = club.players;
const N = 300;
const t = Date.now();
for (let i = 0; i < N; i += 1) computeSquadRating(players);
const ms = Date.now() - t;
console.log(`computeSquadRating: ${(ms / N).toFixed(3)} ms (${N} em ${ms} ms)`);
console.log(JSON.stringify(computeSquadRating(players)));

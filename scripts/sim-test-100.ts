import { makeTactic } from '../packages/shared/src/simulation/testFactories.js';
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import { buildStarClub, buildNormalClub, avgOverall } from './sim-clubs.js';

const SAMPLE_SIZE = 100;

const starClub = buildStarClub();
const normalClub = buildNormalClub();
const starTactic = makeTactic(starClub);
const normalTactic = makeTactic(normalClub);

console.log(`${starClub.name} (overall médio: ${avgOverall(starClub.players)}) vs ${normalClub.name} (overall médio: ${avgOverall(normalClub.players)})`);
console.log(`Amostra: ${SAMPLE_SIZE} jogos, mando de campo alternado (metade cada lado) para não viesar o resultado.\n`);

let starWins = 0;
let normalWins = 0;
let draws = 0;
let starGoals = 0;
let normalGoals = 0;
let starShots = 0;
let normalShots = 0;
let starPossessionSum = 0;

for (let i = 1; i <= SAMPLE_SIZE; i++) {
  const starIsHome = i % 2 === 1;
  const seed = `star-vs-normal-100-${i}`;

  const result = simulateMatch({
    home: starIsHome ? { club: starClub, tactic: starTactic } : { club: normalClub, tactic: normalTactic },
    away: starIsHome ? { club: normalClub, tactic: normalTactic } : { club: starClub, tactic: starTactic },
    seed,
  });

  const starScored = starIsHome ? result.homeGoals : result.awayGoals;
  const normalScored = starIsHome ? result.awayGoals : result.homeGoals;
  const starShotsThis = starIsHome ? result.stats.home.shots : result.stats.away.shots;
  const normalShotsThis = starIsHome ? result.stats.away.shots : result.stats.home.shots;
  const starPossessionThis = starIsHome ? result.stats.home.possession : result.stats.away.possession;

  starGoals += starScored;
  normalGoals += normalScored;
  starShots += starShotsThis;
  normalShots += normalShotsThis;
  starPossessionSum += starPossessionThis;

  if (starScored > normalScored) starWins++;
  else if (normalScored > starScored) normalWins++;
  else draws++;
}

const pct = (n: number) => ((n / SAMPLE_SIZE) * 100).toFixed(1);

console.log('=== Resultado agregado ===');
console.log(`${starClub.name}: ${starWins} vitórias (${pct(starWins)}%)`);
console.log(`${normalClub.name}: ${normalWins} vitórias (${pct(normalWins)}%)`);
console.log(`Empates: ${draws} (${pct(draws)}%)\n`);

console.log('=== Gols ===');
console.log(`${starClub.name}: ${starGoals} gols (média ${(starGoals / SAMPLE_SIZE).toFixed(2)}/jogo)`);
console.log(`${normalClub.name}: ${normalGoals} gols (média ${(normalGoals / SAMPLE_SIZE).toFixed(2)}/jogo)`);
console.log(`Saldo de gols do time estrela: ${starGoals - normalGoals >= 0 ? '+' : ''}${starGoals - normalGoals}\n`);

console.log('=== Finalizações e posse ===');
console.log(`${starClub.name}: ${starShots} finalizações (média ${(starShots / SAMPLE_SIZE).toFixed(2)}/jogo)`);
console.log(`${normalClub.name}: ${normalShots} finalizações (média ${(normalShots / SAMPLE_SIZE).toFixed(2)}/jogo)`);
console.log(`Posse média do time estrela: ${(starPossessionSum / SAMPLE_SIZE).toFixed(1)}%`);

import { makeTactic } from '../packages/shared/src/simulation/testFactories.js';
import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import { buildStarClub, buildNormalClub, avgOverall } from './sim-clubs.js';

const starClub = buildStarClub();
const normalClub = buildNormalClub();

const starTactic = makeTactic(starClub);
const normalTactic = makeTactic(normalClub);

console.log('=== Elencos ===');
console.log(`${starClub.name} (overall médio: ${avgOverall(starClub.players)})`);
for (const p of starClub.players) console.log(`  ${p.position.padEnd(4)} ${p.name.padEnd(24)} overall=${p.overall} star=${p.starLevel}`);
console.log(`\n${normalClub.name} (overall médio: ${avgOverall(normalClub.players)})`);
for (const p of normalClub.players) console.log(`  ${p.position.padEnd(4)} ${p.name.padEnd(24)} overall=${p.overall} star=${p.starLevel}`);

console.log('\n=== Simulações (5 jogos, mando de campo fixo: Galacticos em casa) ===\n');

let starWins = 0;
let normalWins = 0;
let draws = 0;
let starGoalsTotal = 0;
let normalGoalsTotal = 0;

for (let i = 1; i <= 5; i++) {
  const seed = `star-vs-normal-${i}`;
  const result = simulateMatch({
    home: { club: starClub, tactic: starTactic },
    away: { club: normalClub, tactic: normalTactic },
    seed,
  });

  starGoalsTotal += result.homeGoals;
  normalGoalsTotal += result.awayGoals;
  if (result.homeGoals > result.awayGoals) starWins++;
  else if (result.awayGoals > result.homeGoals) normalWins++;
  else draws++;

  console.log(`Jogo ${i}: ${starClub.name} ${result.homeGoals} x ${result.awayGoals} ${normalClub.name}`);
  console.log(
    `  Finalizações: ${result.stats.home.shots}-${result.stats.away.shots} | Posse: ${result.stats.home.possession}%-${result.stats.away.possession}%`,
  );
  const goals = result.events.filter((e) => e.type === 'goal');
  for (const g of goals) {
    const scorerClub = g.team === 'home' ? starClub : normalClub;
    const scorer = scorerClub.players.find((p) => p.id === g.playerId);
    console.log(`  ${g.minute}' [${g.team}] ${scorer?.name ?? '???'}${g.isPenalty ? ' (pênalti)' : ''}`);
  }
  const cards = result.events.filter((e) => e.type === 'card');
  for (const c of cards) {
    console.log(`  ${c.minute}' ${c.description}`);
  }
  console.log('');
}

console.log('=== Resumo (5 jogos) ===');
console.log(`${starClub.name}: ${starWins} vitórias, ${starGoalsTotal} gols marcados`);
console.log(`${normalClub.name}: ${normalWins} vitórias, ${normalGoalsTotal} gols marcados`);
console.log(`Empates: ${draws}`);

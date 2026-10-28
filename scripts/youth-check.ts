/**
 * What the academy is actually worth, before and after youth plasticity.
 *
 * Runs a prospect from fourteen to graduation at twenty, with and without a weekly training session, and
 * reports how much `overall` he ends up with. The point of the plasticity curve is that these two numbers
 * pull apart — if training a boy buys the same as training a twenty-three-year-old, the academy is
 * decoration.
 */
import { developmentPlasticity, evolvePlayer } from '../packages/shared/src/domain/development.js';
import { createRng } from '../packages/shared/src/simulation/rng.js';
import { makePlayer } from '../packages/shared/src/simulation/testFactories.js';

const TRAINING_BOOST = 20; // matches TRAINING_DEVELOPMENT_BOOST in academyService

function runCareer(trained: boolean, startAge: number, untilAge: number) {
  const rng = createRng('youth');
  let player = makePlayer('prospect', { age: startAge, overall: 45, potential: 95, developmentPoints: 0 });
  const start = player.overall;
  while (player.age < untilAge) {
    if (trained) player = { ...player, developmentPoints: player.developmentPoints + TRAINING_BOOST };
    player = evolvePlayer(player, rng);
  }
  return { gained: player.overall - start, final: player.overall };
}

console.log('curva de plasticidade por idade');
for (const age of [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]) {
  const p = developmentPlasticity(age);
  console.log(`  ${age} anos: ${p.toFixed(2)}x ${'█'.repeat(Math.round((p - 1) * 20))}`);
}

console.log('');
console.log('do 14 até formar aos 20 (potencial 95, começa em 45):');
const untrained = runCareer(false, 14, 20);
const trained = runCareer(true, 14, 20);
console.log(`  sem treino : +${untrained.gained.toFixed(1)} de força (chega a ${untrained.final.toFixed(1)})`);
console.log(`  com treino : +${trained.gained.toFixed(1)} de força (chega a ${trained.final.toFixed(1)})`);
console.log(`  o treino vale ${(trained.gained / untrained.gained).toFixed(2)}x`);

console.log('');
console.log('mesma janela de 6 temporadas começando mais velho, para comparar:');
for (const startAge of [14, 17, 20]) {
  const r = runCareer(true, startAge, Math.min(24, startAge + 6));
  console.log(`  dos ${startAge} aos ${Math.min(24, startAge + 6)}, treinando: +${r.gained.toFixed(1)}`);
}

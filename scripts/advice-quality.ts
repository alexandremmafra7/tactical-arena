/**
 * Does hiring a better assistant get you a better read?
 *
 * The report used to be identical for a bronze 55 and a diamante 99: the rating was printed in front of the
 * note and changed nothing in it. This measures how often each tier actually identifies what the opponent is
 * doing, across every pattern and every specialty.
 */
import {
  generateTacticalAssistantAdvice,
  STAFF_TIER_CONFIG,
  type StaffMember,
  type StaffSpecialtyKey,
  type StaffTier,
} from '../packages/shared/src/index.js';

const OPPONENTS = [
  { name: 'Fecha Atrás FC', tactic: { formation: '5-3-2', mentality: 'defensive', attackStyle: 'BALANCED', pressing: 'LOW_BLOCK' }, truth: 'LOW_BLOCK_CROWD' },
  { name: 'Linha Alta EC', tactic: { formation: '4-3-3', mentality: 'attacking', attackStyle: 'BALANCED', pressing: 'HIGH_PRESS' }, truth: 'HIGH_LINE' },
  { name: 'Meio Campo AC', tactic: { formation: '4-1-4-1', mentality: 'balanced', attackStyle: 'THROUGH_MIDDLE', pressing: 'MID_BLOCK' }, truth: 'MIDFIELD_BUILD' },
  { name: 'Pelas Pontas SC', tactic: { formation: '4-4-2', mentality: 'balanced', attackStyle: 'WINGS', pressing: 'MID_BLOCK' }, truth: 'WIDE_PLAY' },
];

const SPECIALTIES: StaffSpecialtyKey[] = ['PRESSING_TRANSITION', 'DEFENSIVE_SOLIDITY', 'POSSESSION_CONTROL', 'COUNTER_SET_PIECES'];

function assistant(tier: StaffTier, specialtyKey: StaffSpecialtyKey, n: number): StaffMember {
  const config = STAFF_TIER_CONFIG[tier];
  return {
    id: `aux-${tier}-${specialtyKey}-${n}`, name: `Auxiliar ${n}`, role: 'TACTICAL_ASSISTANT', tier,
    rating: config.maxRating, specialty: 'x', specialtyKey, description: '', wage: config.baseWage,
    minClubVisibility: 0, minCareerTitles: 0, avatar: '', nationality: 'BRA',
  };
}

console.log('tier        acertos   com detalhe   dentro da especialidade');
for (const tier of ['BRONZE', 'PRATA', 'OURO', 'DIAMANTE'] as StaffTier[]) {
  let right = 0, total = 0, detailed = 0, inSpecialty = 0;
  for (const specialtyKey of SPECIALTIES) {
    // Several assistants per combination, since the misread is seeded per assistant.
    for (let n = 0; n < 40; n += 1) {
      for (const opponent of OPPONENTS) {
        const advice = generateTacticalAssistantAdvice(assistant(tier, specialtyKey, n), opponent.tactic, opponent.name);
        total += 1;
        if (advice.readPattern === opponent.truth) right += 1;
        if (advice.detail) detailed += 1;
        if (advice.withinSpecialty) inSpecialty += 1;
      }
    }
  }
  const pct = (n: number) => ((n / total) * 100).toFixed(0).padStart(3) + '%';
  console.log(`${tier.padEnd(10)}${STAFF_TIER_CONFIG[tier].maxRating} OVR ${pct(right)}    ${pct(detailed)}          ${pct(inSpecialty)}`);
}

let interimRight = 0;
for (const opponent of OPPONENTS) {
  if (generateTacticalAssistantAdvice(null, opponent.tactic, opponent.name).readPattern === opponent.truth) interimRight += 1;
}
console.log(`\nsem auxiliar contratado: ${interimRight} de ${OPPONENTS.length} leituras certas`);

console.log('\nexemplo: mesmo adversário, dois auxiliares diferentes\n');
for (const tier of ['BRONZE', 'DIAMANTE'] as StaffTier[]) {
  const a = generateTacticalAssistantAdvice(assistant(tier, 'COUNTER_SET_PIECES', 1), OPPONENTS[0].tactic, OPPONENTS[0].name);
  console.log(`${tier} (${STAFF_TIER_CONFIG[tier].maxRating} OVR, especialista em contra-ataque e bola parada)`);
  console.log(`  ${a.confidenceLabel} (${(a.confidence * 100).toFixed(0)}%)  leu como: ${a.readPattern}  ${a.withinSpecialty ? 'dentro' : 'fora'} da especialidade`);
  console.log(`  ${a.keyWeakness}`);
  console.log(`  ${a.detail ?? 'sem observação específica a oferecer'}\n`);
}

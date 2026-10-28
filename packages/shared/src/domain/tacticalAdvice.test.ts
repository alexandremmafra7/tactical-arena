import { describe, expect, it } from 'vitest';
import {
  STAFF_TIER_CONFIG,
  generateTacticalAssistantAdvice,
  specialtyKeyOf,
  type OpponentPattern,
  type StaffMember,
  type StaffSpecialtyKey,
  type StaffTier,
} from './staff.js';

const OPPONENTS: { name: string; tactic: Record<string, string>; truth: OpponentPattern }[] = [
  { name: 'Fecha Atrás FC', tactic: { formation: '5-3-2', mentality: 'defensive', attackStyle: 'BALANCED', pressing: 'LOW_BLOCK' }, truth: 'LOW_BLOCK_CROWD' },
  { name: 'Linha Alta EC', tactic: { formation: '4-3-3', mentality: 'attacking', attackStyle: 'BALANCED', pressing: 'HIGH_PRESS' }, truth: 'HIGH_LINE' },
  { name: 'Meio Campo AC', tactic: { formation: '4-1-4-1', mentality: 'balanced', attackStyle: 'THROUGH_MIDDLE', pressing: 'MID_BLOCK' }, truth: 'MIDFIELD_BUILD' },
  { name: 'Pelas Pontas SC', tactic: { formation: '4-4-2', mentality: 'balanced', attackStyle: 'WINGS', pressing: 'MID_BLOCK' }, truth: 'WIDE_PLAY' },
];

const ASSISTANT_SPECIALTIES: StaffSpecialtyKey[] = [
  'PRESSING_TRANSITION',
  'DEFENSIVE_SOLIDITY',
  'POSSESSION_CONTROL',
  'COUNTER_SET_PIECES',
];

function assistant(tier: StaffTier, specialtyKey: StaffSpecialtyKey, n = 0): StaffMember {
  const config = STAFF_TIER_CONFIG[tier];
  return {
    id: `aux-${tier}-${specialtyKey}-${n}`,
    name: `Auxiliar ${n}`,
    role: 'TACTICAL_ASSISTANT',
    tier,
    rating: config.maxRating,
    specialty: 'irrelevante para este teste',
    specialtyKey,
    description: '',
    wage: config.baseWage,
    minClubVisibility: 0,
    minCareerTitles: 0,
    avatar: '',
    nationality: 'BRA',
  };
}

/** How often this tier identifies what the opponent is actually doing, across every specialty. */
function accuracyOf(tier: StaffTier): number {
  let right = 0;
  let total = 0;
  for (const specialtyKey of ASSISTANT_SPECIALTIES) {
    for (let n = 0; n < 40; n += 1) {
      for (const opponent of OPPONENTS) {
        const advice = generateTacticalAssistantAdvice(assistant(tier, specialtyKey, n), opponent.tactic, opponent.name);
        if (advice.readPattern === opponent.truth) right += 1;
        total += 1;
      }
    }
  }
  return right / total;
}

/**
 * What the manager is paying an assistant for.
 *
 * The report used to be the same for everyone. `generateTacticalAssistantAdvice` took the assistant and used
 * it to write their name in front of the note; a bronze 55 and a diamante 98 produced identical text, and
 * the specialty was a sentence on a card that no logic anywhere read. Choosing between two candidates of the
 * same overall was a coin toss, and paying R$ 80.000 a week over R$ 4.000 bought a byline.
 *
 * An assistant's job is telling the manager what the other side is doing, so that is what their quality now
 * buys: how often they are right, and how much detail comes with it.
 */
describe('tactical assistant advice', () => {
  it('makes a better assistant read the opponent more often', () => {
    const bronze = accuracyOf('BRONZE');
    const prata = accuracyOf('PRATA');
    const ouro = accuracyOf('OURO');
    const diamante = accuracyOf('DIAMANTE');

    expect(prata, `prata ${prata.toFixed(2)} x bronze ${bronze.toFixed(2)}`).toBeGreaterThan(bronze);
    expect(ouro, `ouro ${ouro.toFixed(2)} x prata ${prata.toFixed(2)}`).toBeGreaterThan(prata);
    expect(diamante, `diamante ${diamante.toFixed(2)} x ouro ${ouro.toFixed(2)}`).toBeGreaterThan(ouro);

    // And a weak one has to be wrong often enough that the manager cannot simply obey it.
    expect(bronze, `bronze acerta ${bronze.toFixed(2)}`).toBeLessThan(0.8);
    // While a great one has to be worth trusting, or the whole hire is a tax.
    expect(diamante, `diamante acerta ${diamante.toFixed(2)}`).toBeGreaterThan(0.85);
  });

  it('gives an assistant a kind of football they know and one they do not', () => {
    const specialist = assistant('OURO', 'COUNTER_SET_PIECES');

    const known = generateTacticalAssistantAdvice(specialist, OPPONENTS[0].tactic, OPPONENTS[0].name);
    const unknown = generateTacticalAssistantAdvice(specialist, OPPONENTS[2].tactic, OPPONENTS[2].name);

    /**
     * A counter-attack and set-piece specialist reads a side that sits deep, and is out of their depth
     * against one that builds patiently through midfield. Same person, same rating, different confidence.
     */
    expect(known.withinSpecialty).toBe(true);
    expect(unknown.withinSpecialty).toBe(false);
    expect(known.confidence).toBeGreaterThan(unknown.confidence);
  });

  it('only offers a specific observation when the assistant is good enough to have one', () => {
    const bronze = generateTacticalAssistantAdvice(assistant('BRONZE', 'DEFENSIVE_SOLIDITY'), OPPONENTS[1].tactic, OPPONENTS[1].name);
    const diamante = generateTacticalAssistantAdvice(assistant('DIAMANTE', 'DEFENSIVE_SOLIDITY'), OPPONENTS[1].tactic, OPPONENTS[1].name);

    expect(bronze.detail).toBeNull();
    expect(diamante.detail).toBeTruthy();
  });

  it('says how sure it is, so the manager can weigh it', () => {
    const guess = generateTacticalAssistantAdvice(null, OPPONENTS[0].tactic, OPPONENTS[0].name);
    const sure = generateTacticalAssistantAdvice(assistant('DIAMANTE', 'COUNTER_SET_PIECES'), OPPONENTS[0].tactic, OPPONENTS[0].name);

    expect(guess.confidence).toBeLessThan(sure.confidence);
    expect(guess.confidenceLabel).not.toBe(sure.confidenceLabel);
    // Without anyone hired the report is barely better than picking one of the four at random.
    expect(guess.confidence).toBeLessThan(0.4);
  });

  it('does not reroll the read when the manager reopens the screen', () => {
    const aux = assistant('BRONZE', 'POSSESSION_CONTROL');
    const first = generateTacticalAssistantAdvice(aux, OPPONENTS[3].tactic, OPPONENTS[3].name);
    const second = generateTacticalAssistantAdvice(aux, OPPONENTS[3].tactic, OPPONENTS[3].name);

    // It is the same person looking at the same match. Being wrong is allowed; changing their mind on a
    // refresh is not.
    expect(second).toEqual(first);
  });

  it('still fills in a report when nobody was hired', () => {
    const advice = generateTacticalAssistantAdvice(null, null, 'o próximo adversário');

    expect(advice.assistantNotes).toContain('Interino');
    expect(advice.recommendedFormation).toBeTruthy();
    expect(advice.detail).toBeNull();
  });

  it('recovers the specialty of somebody hired before specialties had keys', () => {
    /**
     * Staff live inside the club's JSON, so no migration could have backfilled the key: a save made before
     * this carries only the label. Reading it back has to be exact, or every one of those assistants would
     * silently fall back to somebody else's specialty.
     */
    const legacy: StaffMember = { ...assistant('OURO', 'DEFENSIVE_SOLIDITY'), specialty: 'Solidez Defensiva e Linhas Compactas' };
    delete (legacy as { specialtyKey?: unknown }).specialtyKey;

    expect(specialtyKeyOf(legacy)).toBe('DEFENSIVE_SOLIDITY');
  });
});

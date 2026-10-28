import { describe, it, expect } from 'vitest';
import {
  developmentPlasticity,
  applyWeeklyRecovery,
  evolvePlayer,
  hasRetired,
  retirementAge,
  BASE_RETIREMENT_AGE,
  ELITE_RETIREMENT_AGE,
  GROWTH_AGE_CEILING,
  executePlayerTrainingSession,
} from './development.js';
import { createRng } from '../simulation/rng.js';
import { makePlayer } from '../simulation/testFactories.js';

describe('evolvePlayer growth', () => {
  it('grows overall toward potential for a young player with invested development points', () => {
    const rng = createRng('growth-seed');
    let player = makePlayer('young', { age: 19, overall: 60, potential: 85, developmentPoints: 30 });

    for (let i = 0; i < 10; i++) {
      player = evolvePlayer(player, rng);
    }

    expect(player.overall).toBeGreaterThan(60);
    expect(player.overall).toBeLessThanOrEqual(85);
  });

  it('grows an UNDISCIPLINED player slower than an equivalent disciplined one under the same conditions', () => {
    const rngA = createRng('undisciplined-seed');
    const rngB = createRng('undisciplined-seed');
    let disciplined = makePlayer('disciplined', { age: 19, overall: 60, potential: 85, developmentPoints: 30 });
    let undisciplined = makePlayer('undisciplined', { age: 19, overall: 60, potential: 85, developmentPoints: 30, traits: ['UNDISCIPLINED'] });

    for (let i = 0; i < 10; i++) {
      disciplined = evolvePlayer(disciplined, rngA);
      undisciplined = evolvePlayer(undisciplined, rngB);
    }

    expect(undisciplined.overall).toBeLessThan(disciplined.overall);
  });

  it('never grows overall past potential', () => {
    const rng = createRng('cap-seed');
    let player = makePlayer('capped', { age: 19, overall: 84, potential: 85, developmentPoints: 50 });

    for (let i = 0; i < 20; i++) {
      player = evolvePlayer(player, rng);
    }

    expect(player.overall).toBeLessThanOrEqual(85);
  });
});

describe('evolvePlayer decline', () => {
  it('declines overall for a veteran past the peak age window', () => {
    const rng = createRng('decline-seed');
    let player = makePlayer('veteran', { age: 34, overall: 65, potential: 65 });

    for (let i = 0; i < 10; i++) {
      player = evolvePlayer(player, rng);
    }

    expect(player.overall).toBeLessThan(65);
  });

  it('attenuates the decline for an elite veteran compared to a regular veteran under the same conditions', () => {
    const rngA = createRng('same-seed');
    const rngB = createRng('same-seed');

    let regularVeteran = makePlayer('regular', { age: 34, overall: 65, potential: 65, starLevel: 'NONE' });
    let eliteVeteran = makePlayer('elite', { age: 34, overall: 90, potential: 90, starLevel: 'NONE' });

    for (let i = 0; i < 10; i++) {
      regularVeteran = evolvePlayer(regularVeteran, rngA);
      eliteVeteran = evolvePlayer(eliteVeteran, rngB);
    }

    const regularDrop = 65 - regularVeteran.overall;
    const eliteDrop = 90 - eliteVeteran.overall;
    expect(eliteDrop).toBeLessThan(regularDrop);
  });

  it('declines a trained veteran less than an untrained one under the same conditions, without ever growing them', () => {
    const rngA = createRng('mitigation-seed');
    const rngB = createRng('mitigation-seed');

    let untrained = makePlayer('untrained-veteran', { age: 34, overall: 65, potential: 65, developmentPoints: 0 });
    let trained = makePlayer('trained-veteran', { age: 34, overall: 65, potential: 65, developmentPoints: 20 });

    for (let i = 0; i < 5; i++) {
      untrained = evolvePlayer(untrained, rngA);
      trained = evolvePlayer(trained, rngB);
    }

    expect(trained.overall).toBeGreaterThan(untrained.overall);
    expect(trained.overall).toBeLessThanOrEqual(65);
  });
});

describe('evolvePlayer star breakthrough', () => {
  it('never promotes a player below the qualifying overall threshold, even after many ticks', () => {
    const rng = createRng('no-breakthrough-seed');
    const player = makePlayer('mid-tier', { age: 27, overall: 70, potential: 70, developmentPoints: 50, starLevel: 'NONE' });

    let anyBreakthrough = false;
    for (let i = 0; i < 500; i++) {
      const result = evolvePlayer(player, rng);
      if (result.starLevel !== 'NONE') anyBreakthrough = true;
    }

    expect(anyBreakthrough).toBe(false);
  });

  it('promotes a qualifying, sustained-investment player to DEVELOPED in a plausible fraction of independent trials', () => {
    const rng = createRng('breakthrough-seed');
    const qualifyingPlayer = makePlayer('prodigy-adjacent', { age: 27, overall: 92, potential: 92, developmentPoints: 25, starLevel: 'NONE' });

    let breakthroughs = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      const result = evolvePlayer(qualifyingPlayer, rng);
      if (result.starLevel === 'DEVELOPED') breakthroughs++;
    }

    expect(breakthroughs).toBeGreaterThan(0);
    expect(breakthroughs / trials).toBeLessThan(0.15);
  });
});

describe('evolvePlayer aging', () => {
  it('ages the player by one year per tick', () => {
    const rng = createRng('age-seed');
    const player = makePlayer('aging', { age: 22 });
    const result = evolvePlayer(player, rng);

    expect(result.age).toBe(23);
  });
});

describe('applyWeeklyRecovery: morale and fatigue', () => {
  it('recovers fatigue toward zero on a weekly tick', () => {
    const player = makePlayer('tired', { fatigue: 80 });
    const result = applyWeeklyRecovery(player);

    expect(result.fatigue).toBeLessThan(80);
    expect(result.fatigue).toBeGreaterThanOrEqual(0);
  });

  it('never drops fatigue below zero', () => {
    const player = makePlayer('rested', { fatigue: 5 });
    const result = applyWeeklyRecovery(player);

    expect(result.fatigue).toBe(0);
  });

  it('lets the simple preset fitness coach keep recovery at least at an ideal baseline', () => {
    const player = makePlayer('managed', { fatigue: 80 });

    const automatic = applyWeeklyRecovery(player, { simplePreset: true });
    const regular = applyWeeklyRecovery(player);

    expect(automatic.fatigue).toBeLessThan(regular.fatigue);
  });

  it('recovers fatigue faster for a higher-physical player than a lower-physical one under the same conditions', () => {
    const sturdy = makePlayer('sturdy', { fatigue: 80, attributes: { pace: 60, finishing: 60, passing: 60, defending: 60, physical: 95, goalkeeping: 10 } });
    const frail = makePlayer('frail', { fatigue: 80, attributes: { pace: 60, finishing: 60, passing: 60, defending: 60, physical: 5, goalkeeping: 10 } });

    const sturdyResult = applyWeeklyRecovery(sturdy);
    const frailResult = applyWeeklyRecovery(frail);

    expect(sturdyResult.fatigue).toBeLessThan(frailResult.fatigue);
  });

  it('recovers fatigue slower for a player past the physical peak than one still in it, same physical attribute', () => {
    const veteran = makePlayer('veteran-tired', { fatigue: 80, age: 34 });
    const inPeak = makePlayer('peak-tired', { fatigue: 80, age: 27 });

    const veteranResult = applyWeeklyRecovery(veteran);
    const inPeakResult = applyWeeklyRecovery(inPeak);

    expect(veteranResult.fatigue).toBeGreaterThan(inPeakResult.fatigue);
  });

  it('reverts morale partway back toward the neutral baseline in both directions', () => {
    const happy = makePlayer('happy', { morale: 90 });
    const unhappy = makePlayer('unhappy', { morale: 10 });

    const evolvedHappy = applyWeeklyRecovery(happy);
    const evolvedUnhappy = applyWeeklyRecovery(unhappy);

    expect(evolvedHappy.morale).toBeLessThan(90);
    expect(evolvedHappy.morale).toBeGreaterThan(50);
    expect(evolvedUnhappy.morale).toBeGreaterThan(10);
    expect(evolvedUnhappy.morale).toBeLessThan(50);
  });

  it('reverts morale toward this player\'s own commitment, not a flat 50, when commitment is off-center', () => {
    const distrustful = makePlayer('distrustful', { morale: 50, commitment: 20 });
    const devoted = makePlayer('devoted', { morale: 50, commitment: 80 });

    const evolvedDistrustful = applyWeeklyRecovery(distrustful);
    const evolvedDevoted = applyWeeklyRecovery(devoted);

    expect(evolvedDistrustful.morale).toBeLessThan(50);
    expect(evolvedDevoted.morale).toBeGreaterThan(50);
  });
});

describe('individual attribute training', () => {
  const attributes = { pace: 60, finishing: 60, passing: 60, defending: 60, physical: 60, goalkeeping: 10 };

  for (const [focus, attribute] of [
    ['FINISHING', 'finishing'],
    ['PASSING', 'passing'],
    ['DEFENDING', 'defending'],
    ['PACE', 'pace'],
  ] as const) {
    it(`only improves ${attribute} when ${focus} is selected`, () => {
      const player = makePlayer(focus.toLowerCase(), { age: 19, overall: 50, potential: 90, attributes });

      const result = executePlayerTrainingSession(player, focus);

      expect(result.attributes[attribute]).toBeGreaterThan(attributes[attribute]);
      for (const key of ['pace', 'finishing', 'passing', 'defending', 'physical'] as const) {
        if (key !== attribute) expect(result.attributes[key]).toBe(attributes[key]);
      }
    });
  }
});

describe('applyWeeklyRecovery: training focus', () => {
  it('nudges the two PHYSICAL attributes for a young player with a pending PHYSICAL focus, and clears it after', () => {
    /**
     * O potencial precisa ter folga, porque `makePlayer` o iguala ao overall e isso põe o jogador no teto.
     * Um garoto de dezanove anos no jogo real tem espaço para crescer; sem `potential` explícito este teste
     * pedia evolução a quem já chegou ao limite, e o teto agora trava o atributo além de travar a exibição.
     */
    const player = makePlayer('sprinter', { age: 19, potential: 85, trainingFocus: 'PHYSICAL', attributes: { pace: 60, finishing: 60, passing: 60, defending: 60, physical: 60, goalkeeping: 10 } });

    const result = applyWeeklyRecovery(player);

    expect(result.attributes.pace).toBeGreaterThan(60);
    expect(result.attributes.physical).toBeGreaterThan(60);
    expect(result.attributes.passing).toBe(60);
    expect(result.trainingFocus).toBeNull();
  });

  it('nudges the two TECHNICAL attributes for a pending TECHNICAL focus and leaves PHYSICAL ones untouched', () => {
    /**
     * O potencial precisa ter folga, porque `makePlayer` o iguala ao overall e isso põe o jogador no teto.
     * Um garoto de dezanove anos no jogo real tem espaço para crescer; sem `potential` explícito este teste
     * pedia evolução a quem já chegou ao limite, e o teto agora trava o atributo além de travar a exibição.
     */
    const player = makePlayer('playmaker', { age: 19, potential: 85, trainingFocus: 'TECHNICAL', attributes: { pace: 60, finishing: 60, passing: 60, defending: 60, physical: 60, goalkeeping: 10 } });

    const result = applyWeeklyRecovery(player);

    expect(result.attributes.passing).toBeGreaterThan(60);
    expect(result.attributes.finishing).toBeGreaterThan(60);
    expect(result.attributes.physical).toBe(60);
  });

  it('raises commitment instead of any PlayerAttributes field for a pending MENTAL focus', () => {
    const player = makePlayer('captain-material', { age: 19, trainingFocus: 'MENTAL', commitment: 50 });

    const result = applyWeeklyRecovery(player);

    expect(result.commitment).toBeGreaterThan(50);
    expect(result.attributes).toEqual(player.attributes);
  });

  it('does nothing extra when no focus is pending', () => {
    const player = makePlayer('unfocused', { age: 19, trainingFocus: null });

    const result = applyWeeklyRecovery(player);

    expect(result.attributes).toEqual(player.attributes);
  });

  it('gives an UNDISCIPLINED player a smaller (or no) focus boost than an equivalent disciplined one', () => {
    const disciplined = makePlayer('disciplined-focus', { age: 34, trainingFocus: 'PHYSICAL', attributes: { pace: 60, finishing: 60, passing: 60, defending: 60, physical: 60, goalkeeping: 10 } });
    const undisciplined = makePlayer('undisciplined-focus', {
      age: 34,
      trainingFocus: 'PHYSICAL',
      traits: ['UNDISCIPLINED'],
      attributes: { pace: 60, finishing: 60, passing: 60, defending: 60, physical: 60, goalkeeping: 10 },
    });

    const disciplinedGain = applyWeeklyRecovery(disciplined).attributes.physical - 60;
    const undisciplinedGain = applyWeeklyRecovery(undisciplined).attributes.physical - 60;

    expect(undisciplinedGain).toBeLessThanOrEqual(disciplinedGain);
  });

  it('never pushes an attribute above 99', () => {
    const player = makePlayer('maxed', { age: 19, trainingFocus: 'PHYSICAL', attributes: { pace: 99, finishing: 60, passing: 60, defending: 60, physical: 99, goalkeeping: 10 } });

    const result = applyWeeklyRecovery(player);

    expect(result.attributes.pace).toBeLessThanOrEqual(99);
    expect(result.attributes.physical).toBeLessThanOrEqual(99);
  });
});

/**
 * The academy's whole reason to exist. Before this, a fourteen-year-old and a twenty-three-year-old grew at
 * exactly the same rate — the growth branch was flat across its entire age window — so a training slot was
 * always better spent on someone closer to the first team, and the youth pipeline was decoration.
 */
describe('youth plasticity', () => {
  it('is worth nothing extra once a player reaches the top of the growth window', () => {
    expect(developmentPlasticity(GROWTH_AGE_CEILING)).toBe(1);
    expect(developmentPlasticity(30)).toBe(1);
  });

  it('rises steadily the younger the prospect is', () => {
    const ages = [14, 16, 18, 20, 22, GROWTH_AGE_CEILING];
    const values = ages.map(developmentPlasticity);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
    expect(values[0]).toBeGreaterThan(2);
  });

  it('does not keep climbing below the youngest academy age', () => {
    expect(developmentPlasticity(12)).toBe(developmentPlasticity(14));
  });

  it('makes the same year of growth move a boy far more than a near-professional', () => {
    const boy = makePlayer('boy', { age: 15, overall: 50, potential: 90, developmentPoints: 20 });
    const almostPro = makePlayer('almost-pro', { age: 23, overall: 50, potential: 90, developmentPoints: 20 });

    const boyGain = evolvePlayer(boy, createRng('plasticity')).overall - boy.overall;
    const proGain = evolvePlayer(almostPro, createRng('plasticity')).overall - almostPro.overall;

    expect(boyGain).toBeGreaterThan(proGain * 1.8);
  });

  it('still cannot push anyone past their potential', () => {
    const capped = makePlayer('capped', { age: 14, overall: 69, potential: 70, developmentPoints: 60 });
    expect(evolvePlayer(capped, createRng('capped')).overall).toBeLessThanOrEqual(70);
  });

  it('carries into the training focus, so a focused week lands harder on the young', () => {
    const boy = makePlayer('focus-boy', { age: 15, overall: 50, potential: 90, trainingFocus: 'PHYSICAL' });
    const almostPro = makePlayer('focus-pro', { age: 23, overall: 50, potential: 90, trainingFocus: 'PHYSICAL' });

    const boyGain = applyWeeklyRecovery(boy).attributes.physical - boy.attributes.physical;
    const proGain = evolvePlayer(almostPro, createRng('plasticity-focus')).attributes.physical - almostPro.attributes.physical;

    expect(boyGain).toBeGreaterThan(proGain);
  });
});

describe('retirement', () => {
  it('uses the base retirement age for a non-elite player and the extended one for an elite/star player', () => {
    const regular = makePlayer('regular', { overall: 60, starLevel: 'NONE' });
    const elite = makePlayer('elite', { overall: 90, starLevel: 'NONE' });
    const naturalStar = makePlayer('star', { overall: 60, starLevel: 'NATURAL' });

    expect(retirementAge(regular)).toBe(BASE_RETIREMENT_AGE);
    expect(retirementAge(elite)).toBe(ELITE_RETIREMENT_AGE);
    expect(retirementAge(naturalStar)).toBe(ELITE_RETIREMENT_AGE);
  });

  it('retires a regular player at 36 but keeps an elite player of the same age still active', () => {
    const regular = makePlayer('regular-veteran', { age: 36, overall: 60, starLevel: 'NONE' });
    const elite = makePlayer('elite-veteran', { age: 36, overall: 90, starLevel: 'NONE' });

    expect(hasRetired(regular)).toBe(true);
    expect(hasRetired(elite)).toBe(false);
  });

  it('eventually retires even an elite player once they cross the extended threshold', () => {
    const elite = makePlayer('old-elite', { age: 41, overall: 90, starLevel: 'NONE' });
    expect(hasRetired(elite)).toBe(true);
  });
});

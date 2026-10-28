import { describe, expect, it } from 'vitest';
import { analyzeSquadChemistry, calculateSectorSynergy } from './teamStrength.js';
import { makeClub, makePlayer } from './testFactories.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';

describe('Sector Chemistry & Dynamic Synergy System', () => {
  it('detects defensive synergy for natural defenders in backline', () => {
    const d1 = makePlayer('d1', { position: 'DEF', traits: ['LEADER'], attributes: { pace: 70, finishing: 40, passing: 75, defending: 85, physical: 80, goalkeeping: 10 } });
    const d2 = makePlayer('d2', { position: 'DEF', attributes: { pace: 70, finishing: 40, passing: 60, defending: 80, physical: 80, goalkeeping: 10 } });

    const lineup = [
      { player: d1, slotPosition: 'DEF' as const },
      { player: d2, slotPosition: 'DEF' as const },
    ];

    const result = calculateSectorSynergy(lineup);
    expect(result.defenseSynergy).toBeGreaterThan(1.03);
    expect(result.breakdown.defense.score).toBeGreaterThanOrEqual(70);
    expect(result.breakdown.defense.activeBonuses.length).toBeGreaterThanOrEqual(2);
  });

  it('detects midfield balance when combining VOLANTE and MEIA_CRIACAO', () => {
    const vol = makePlayer('m1', { position: 'MID', functions: ['VOLANTE'], attributes: { pace: 70, finishing: 50, passing: 70, defending: 80, physical: 80, goalkeeping: 10 } });
    const mei = makePlayer('m2', { position: 'MID', functions: ['MEIA_CRIACAO'], attributes: { pace: 70, finishing: 65, passing: 88, defending: 40, physical: 65, goalkeeping: 10 } });

    const lineup = [
      { player: vol, slotPosition: 'MID' as const },
      { player: mei, slotPosition: 'MID' as const },
    ];

    const result = calculateSectorSynergy(lineup);
    expect(result.breakdown.midfield.score).toBeGreaterThanOrEqual(80);
    expect(result.attackSynergy).toBeGreaterThan(1.0);
    expect(result.defenseSynergy).toBeGreaterThan(1.0);
  });

  it('detects attacking partnership between PONTA and CENTROAVANTE', () => {
    const ponta = makePlayer('a1', { position: 'ATT', functions: ['PONTA'], attributes: { pace: 90, finishing: 75, passing: 75, defending: 30, physical: 70, goalkeeping: 10 } });
    const ca = makePlayer('a2', { position: 'ATT', functions: ['CENTROAVANTE'], attributes: { pace: 70, finishing: 88, passing: 60, defending: 30, physical: 85, goalkeeping: 10 } });

    const lineup = [
      { player: ponta, slotPosition: 'ATT' as const },
      { player: ca, slotPosition: 'ATT' as const },
    ];

    const result = calculateSectorSynergy(lineup);
    expect(result.breakdown.attack.score).toBeGreaterThanOrEqual(70);
    expect(result.attackSynergy).toBeGreaterThanOrEqual(1.035);
  });

  it('analyzes squad chemistry seamlessly for a complete club tactic', () => {
    const club = makeClub('club-flamengo', 'Flamengo', 80);
    const tactic = autoFillLineup(club);

    const breakdown = analyzeSquadChemistry(club, tactic);
    expect(breakdown.overallScore).toBeGreaterThan(0);
    expect(breakdown.overallScore).toBeLessThanOrEqual(100);
    expect(breakdown.overallLabel).toBeTruthy();
    expect(breakdown.defense).toBeDefined();
    expect(breakdown.midfield).toBeDefined();
    expect(breakdown.attack).toBeDefined();
    expect(breakdown.flanks).toBeDefined();
  });

  it('grants +3% defensive synergy when a defender has the LEADER trait', () => {
    const dWithoutLeader = makePlayer('d1', { position: 'DEF', traits: [], attributes: { pace: 70, finishing: 40, passing: 60, defending: 80, physical: 80, goalkeeping: 10 } });
    const dWithLeader = makePlayer('d2', { position: 'DEF', traits: ['LEADER'], attributes: { pace: 70, finishing: 40, passing: 60, defending: 80, physical: 80, goalkeeping: 10 } });

    const lineupWithout = [{ player: dWithoutLeader, slotPosition: 'DEF' as const }];
    const lineupWith = [{ player: dWithLeader, slotPosition: 'DEF' as const }];

    const resWithout = calculateSectorSynergy(lineupWithout);
    const resWith = calculateSectorSynergy(lineupWith);

    expect(resWith.defenseSynergy).toBeCloseTo(resWithout.defenseSynergy * 1.03, 3);
    expect(resWith.breakdown.defense.activeBonuses).toContain(
      'Liderança e voz de comando na linha defensiva (+3% de sinergia defensiva)',
    );
  });
});

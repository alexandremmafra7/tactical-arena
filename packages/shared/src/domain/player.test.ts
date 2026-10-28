import { describe, it, expect } from 'vitest';
import { calculateOverall, calculateMarketValue, calculateWage, calculateReleaseClause, isPlayerAvailable, getPlayerTier } from './player.js';
import { makePlayer } from '../simulation/testFactories.js';

describe('calculateOverall', () => {
  it('stays within 1-99 for realistic attribute spreads', () => {
    const overall = calculateOverall('ATT', { pace: 80, finishing: 90, passing: 70, defending: 20, physical: 65, goalkeeping: 10 });
    expect(overall).toBeGreaterThanOrEqual(1);
    expect(overall).toBeLessThanOrEqual(99);
  });

  it('weights the position-relevant attributes higher', () => {
    const finisher = calculateOverall('ATT', { pace: 50, finishing: 90, passing: 50, defending: 50, physical: 50, goalkeeping: 10 });
    const defender = calculateOverall('ATT', { pace: 50, finishing: 50, passing: 50, defending: 90, physical: 50, goalkeeping: 10 });
    expect(finisher).toBeGreaterThan(defender);
  });
});

describe('calculateMarketValue', () => {
  it('values a natural star far above an equivalent player with no star level', () => {
    const regular = calculateMarketValue(20, 75, 78, 'NONE');
    const star = calculateMarketValue(20, 75, 96, 'NATURAL');
    expect(star).toBeGreaterThan(regular * 1.3);
  });

  it('values a developed star above the same overall/potential with no star level', () => {
    const regular = calculateMarketValue(27, 90, 90, 'NONE');
    const developed = calculateMarketValue(27, 90, 90, 'DEVELOPED');
    expect(developed).toBeGreaterThan(regular);
  });
});

describe('calculateWage', () => {
  it('scales up with market value but never drops below the wage floor', () => {
    const cheap = calculateWage(50_000);
    const expensive = calculateWage(5_000_000);
    expect(expensive).toBeGreaterThan(cheap);
    expect(cheap).toBeGreaterThanOrEqual(100);
  });
});

describe('calculateReleaseClause', () => {
  it('always sits above market value, so paying it outright is never a bargain', () => {
    const marketValue = 800_000;
    expect(calculateReleaseClause(marketValue)).toBeGreaterThan(marketValue);
  });
});

describe('getPlayerTier', () => {
  it('marks the very elite as GENIO (gold star) regardless of star level', () => {
    expect(getPlayerTier(92, 'NONE')).toBe('GENIO');
    expect(getPlayerTier(90, 'NATURAL')).toBe('GENIO');
  });

  it('marks the elite band (>= 88) as BAITA (cyan chevron), even for imported players with no star level', () => {
    expect(getPlayerTier(88, 'NONE')).toBe('BAITA');
    expect(getPlayerTier(89, 'DEVELOPED')).toBe('BAITA');
  });

  it('marks natural academy stars or diferenciados with overall >= 80 as BAITA', () => {
    expect(getPlayerTier(84, 'NATURAL')).toBe('BAITA');
    expect(getPlayerTier(80, 'NONE', true)).toBe('BAITA');
  });

  it('identifies known standouts like Lucas Paqueta, Pedro, Bruno Henrique by name while leaving Rossi unflagged', () => {
    expect(getPlayerTier(83, 'NONE', false, 28, 83, 'Lucas Paquetá')).toBe('BAITA');
    expect(getPlayerTier(81, 'NONE', false, 29, 81, 'Pedro')).toBe('BAITA');
    expect(getPlayerTier(81, 'NONE', false, 35, 81, 'Bruno Henrique')).toBe('BAITA');
    expect(getPlayerTier(86, 'NONE', false, 30, 86, 'Agustín Rossi')).toBeNull();
  });

  it('returns null for ordinary players, developed academy breakouts, and sub-80 standouts', () => {
    expect(getPlayerTier(78, 'NONE', true)).toBeNull();
    expect(getPlayerTier(78, 'NATURAL')).toBeNull();
    expect(getPlayerTier(70, 'NONE')).toBeNull();
    expect(getPlayerTier(74, 'DEVELOPED')).toBeNull();
    expect(getPlayerTier(85, 'NONE')).toBeNull();
  });
});

describe('isPlayerAvailable', () => {
  it('blocks a lineup in the competition the suspension was earned in, but not a different one', () => {
    const player = makePlayer('p', { suspensions: [{ competitionId: 'league-1', matchesRemaining: 2 }] });
    expect(isPlayerAvailable(player, 'league-1')).toBe(false);
    expect(isPlayerAvailable(player, 'cup-1')).toBe(true);
    expect(isPlayerAvailable(player, null)).toBe(true);
  });

  it('blocks every match when suspended from an ad-hoc/friendly (competitionId null), but only other friendlies', () => {
    const player = makePlayer('p', { suspensions: [{ competitionId: null, matchesRemaining: 1 }] });
    expect(isPlayerAvailable(player, null)).toBe(false);
    expect(isPlayerAvailable(player, 'league-1')).toBe(true);
  });

  it('without a competitionId argument, conservatively blocks if suspended anywhere', () => {
    const player = makePlayer('p', { suspensions: [{ competitionId: 'cup-1', matchesRemaining: 1 }] });
    expect(isPlayerAvailable(player)).toBe(false);
  });

  it('blocks regardless of competition when injured', () => {
    const player = makePlayer('p', { injuryWeeks: 3 });
    expect(isPlayerAvailable(player, 'league-1')).toBe(false);
    expect(isPlayerAvailable(player, 'cup-1')).toBe(false);
    expect(isPlayerAvailable(player)).toBe(false);
  });

  it('is available with no suspensions or injuries', () => {
    const player = makePlayer('p');
    expect(isPlayerAvailable(player, 'league-1')).toBe(true);
    expect(isPlayerAvailable(player)).toBe(true);
  });
});

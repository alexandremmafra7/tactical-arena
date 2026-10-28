import { describe, it, expect } from 'vitest';
import {
  advanceCustomCupBracket,
  advancePlayoffRound,
  generateCustomCupBracket,
  generatePlayoffBracket,
  generateSingleRoundRobinFixtures,
  validateCustomChampionshipConfig,
  type CustomChampionshipConfig,
  type CustomDivisionConfig,
} from './customChampionship.js';
import type { CupFixture } from './cup.js';
import type { StandingRow } from './league.js';

function club(n: number): string {
  return `club-${n}`;
}

function division(overrides: Partial<CustomDivisionConfig> = {}): CustomDivisionConfig {
  return {
    division: 1,
    name: 'Divisão 1',
    clubIds: Array.from({ length: 16 }, (_, i) => club(i + 1)),
    roundsFormat: 'DOUBLE',
    promotionCount: 0,
    relegationCount: 2,
    ...overrides,
  };
}

function baseConfig(overrides: Partial<CustomChampionshipConfig> = {}): CustomChampionshipConfig {
  return {
    id: 'camp-1',
    name: 'Superliga Mundial',
    formatType: 'LEAGUE_PURE',
    divisions: [division()],
    settings: { isContinuousCareer: true, allowTransfers: true, injuriesAndSuspensions: true },
    ...overrides,
  };
}

function decideFixture(fixture: CupFixture, winnerClubId: string): CupFixture {
  return { ...fixture, winnerClubId };
}

describe('validateCustomChampionshipConfig', () => {
  it('accepts a valid LEAGUE_PURE configuration', () => {
    expect(validateCustomChampionshipConfig(baseConfig())).toEqual({ valid: true, errors: [] });
  });

  it('rejects a championship with no name', () => {
    const result = validateCustomChampionshipConfig(baseConfig({ name: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('O campeonato precisa de um nome.');
  });

  it('rejects more than 4 divisions', () => {
    const divisions = Array.from({ length: 5 }, (_, i) => division({ division: i + 1, name: `Divisão ${i + 1}` }));
    const result = validateCustomChampionshipConfig(baseConfig({ formatType: 'CUSTOM_PYRAMID', divisions }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('entre 1 e 4 divisões'))).toBe(true);
  });

  it('rejects a division with an odd number of clubs', () => {
    const result = validateCustomChampionshipConfig(baseConfig({ divisions: [division({ clubIds: Array.from({ length: 15 }, (_, i) => club(i + 1)) })] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('número par de clubes'))).toBe(true);
  });

  it('requires a playoff config when formatType is LEAGUE_WITH_PLAYOFFS', () => {
    const result = validateCustomChampionshipConfig(baseConfig({ formatType: 'LEAGUE_WITH_PLAYOFFS' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('configuração de playoffs'))).toBe(true);
  });

  it('accepts LEAGUE_WITH_PLAYOFFS with a valid playoff config', () => {
    const result = validateCustomChampionshipConfig(
      baseConfig({
        formatType: 'LEAGUE_WITH_PLAYOFFS',
        divisions: [division({ playoffs: { qualifyingSpots: 4, tieFormat: 'SINGLE_LEG', hasThirdPlaceMatch: true, neutralFinal: true } })],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it('requires promotion/relegation spots to match between adjacent divisions in a CUSTOM_PYRAMID', () => {
    const divisions = [
      division({ division: 1, name: 'Ouro', relegationCount: 2 }),
      division({ division: 2, name: 'Prata', promotionCount: 3 }),
    ];
    const result = validateCustomChampionshipConfig(baseConfig({ formatType: 'CUSTOM_PYRAMID', divisions }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('não combinam'))).toBe(true);
  });

  it('requires the cup entrant count to be 8, 16 or 32 for CUP_KNOCKOUT', () => {
    const result = validateCustomChampionshipConfig(
      baseConfig({ formatType: 'CUP_KNOCKOUT', divisions: [], cup: { name: 'Copa', clubIds: Array.from({ length: 12 }, (_, i) => club(i + 1)), tieFormat: 'SINGLE_LEG' } }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('8, 16 ou 32 clubes'))).toBe(true);
  });
});

describe('generateSingleRoundRobinFixtures', () => {
  it('generates n-1 rounds for n clubs with each club playing once per round', () => {
    const clubIds = Array.from({ length: 6 }, (_, i) => club(i + 1));
    const fixtures = generateSingleRoundRobinFixtures(clubIds);

    expect(fixtures).toHaveLength(15); // 6*5/2
    expect(new Set(fixtures.map((f) => f.round)).size).toBe(5);

    for (let round = 1; round <= 5; round += 1) {
      const roundFixtures = fixtures.filter((f) => f.round === round);
      const clubsInRound = roundFixtures.flatMap((f) => [f.homeClubId, f.awayClubId]);
      expect(new Set(clubsInRound).size).toBe(clubsInRound.length);
    }
  });

  it('throws for an odd number of clubs', () => {
    expect(() => generateSingleRoundRobinFixtures([club(1), club(2), club(3)])).toThrow();
  });
});

describe('generatePlayoffBracket / advancePlayoffRound (top 4)', () => {
  const standings: StandingRow[] = Array.from({ length: 6 }, (_, i) => ({
    clubId: club(i + 1),
    played: 10,
    wins: 6 - i,
    draws: 0,
    losses: i,
    goalsFor: 20 - i,
    goalsAgainst: i,
    points: (6 - i) * 3,
  }));

  it('seeds 1v4 and 2v3 for a single-leg top-4 playoff', () => {
    const bracket = generatePlayoffBracket(standings, { qualifyingSpots: 4, tieFormat: 'SINGLE_LEG', hasThirdPlaceMatch: false, neutralFinal: true });

    expect(bracket.seeds).toEqual([club(1), club(2), club(3), club(4)]);
    expect(bracket.fixtures).toHaveLength(2);
    expect(bracket.fixtures[0]).toMatchObject({ homeClubId: club(1), awayClubId: club(4), stageName: 'Semifinal' });
    expect(bracket.fixtures[1]).toMatchObject({ homeClubId: club(2), awayClubId: club(3), stageName: 'Semifinal' });
  });

  it('advances from semifinal to final, then crowns a champion with a runner-up', () => {
    let bracket = generatePlayoffBracket(standings, { qualifyingSpots: 4, tieFormat: 'SINGLE_LEG', hasThirdPlaceMatch: true, neutralFinal: true });

    const semis = bracket.fixtures.map((f) => decideFixture(f, f.homeClubId));
    bracket = advancePlayoffRound(bracket, semis);

    const finalFixtures = bracket.fixtures.filter((f) => f.round === 2);
    expect(finalFixtures).toHaveLength(1);
    expect(finalFixtures[0]).toMatchObject({ homeClubId: club(1), awayClubId: club(2), stageName: 'Final' });
    expect(bracket.thirdPlaceFixture).toMatchObject({ homeClubId: club(4), awayClubId: club(3) });
    expect(bracket.championClubId).toBeNull();

    bracket = advancePlayoffRound(bracket, [decideFixture(finalFixtures[0], club(1))]);
    expect(bracket.championClubId).toBe(club(1));
    expect(bracket.runnerUpClubId).toBe(club(2));
  });

  it('resolves a two-legged tie by the second leg winner (aggregate) rather than the first leg', () => {
    let bracket = generatePlayoffBracket(standings, { qualifyingSpots: 4, tieFormat: 'TWO_LEGGED', hasThirdPlaceMatch: false, neutralFinal: false });
    expect(bracket.fixtures).toHaveLength(4); // 2 ties * 2 legs

    const round1 = bracket.fixtures.map((f) =>
      f.leg === 1 ? decideFixture(f, '__LEG1__') : decideFixture(f, f.awayClubId),
    );
    bracket = advancePlayoffRound(bracket, round1);

    const finalFixtures = bracket.fixtures.filter((f) => f.round === 2);
    // away club of leg 2 for tie 1 (home=club1,away=club4 in leg1 -> leg2 home=club4,away=club1) won => club1 advances
    expect(finalFixtures.map((f) => [f.homeClubId, f.awayClubId]).flat()).toContain(club(1));
  });
});

describe('generatePlayoffBracket (top 8)', () => {
  const standings: StandingRow[] = Array.from({ length: 10 }, (_, i) => ({
    clubId: club(i + 1),
    played: 10,
    wins: 10 - i,
    draws: 0,
    losses: i,
    goalsFor: 20 - i,
    goalsAgainst: i,
    points: (10 - i) * 3,
  }));

  it('seeds 1v8, 2v7, 3v6, 4v5 for the quarter-finals', () => {
    const bracket = generatePlayoffBracket(standings, { qualifyingSpots: 8, tieFormat: 'SINGLE_LEG', hasThirdPlaceMatch: false, neutralFinal: true });

    expect(bracket.fixtures).toHaveLength(4);
    expect(bracket.fixtures.map((f) => `${f.homeClubId}v${f.awayClubId}`)).toEqual([
      `${club(1)}v${club(8)}`,
      `${club(2)}v${club(7)}`,
      `${club(3)}v${club(6)}`,
      `${club(4)}v${club(5)}`,
    ]);
    expect(bracket.fixtures[0].stageName).toBe('Quartas de Final');
  });

  it('runs quarter-finals -> semi-finals -> final to a champion', () => {
    let bracket = generatePlayoffBracket(standings, { qualifyingSpots: 8, tieFormat: 'SINGLE_LEG', hasThirdPlaceMatch: false, neutralFinal: true });

    bracket = advancePlayoffRound(bracket, bracket.fixtures.map((f) => decideFixture(f, f.homeClubId)));
    expect(bracket.fixtures.filter((f) => f.round === 2)).toHaveLength(2);
    expect(bracket.fixtures.find((f) => f.round === 2)?.stageName).toBe('Semifinal');

    const semis = bracket.fixtures.filter((f) => f.round === 2);
    bracket = advancePlayoffRound(bracket, semis.map((f) => decideFixture(f, f.homeClubId)));
    const final = bracket.fixtures.filter((f) => f.round === 3);
    expect(final).toHaveLength(1);
    expect(final[0].stageName).toBe('Final');

    bracket = advancePlayoffRound(bracket, [decideFixture(final[0], final[0].homeClubId)]);
    expect(bracket.championClubId).toBe(club(1));
  });
});

describe('generateCustomCupBracket / advanceCustomCupBracket', () => {
  it.each([8, 16, 32])('builds a single-leg bracket for %d clubs and runs it to a champion', (size) => {
    const clubIds = Array.from({ length: size }, (_, i) => club(i + 1));
    let bracket = generateCustomCupBracket(clubIds, { name: 'Copa Geral', clubIds, tieFormat: 'SINGLE_LEG' });
    expect(bracket.fixtures).toHaveLength(size / 2);

    let round = 1;
    while (bracket.championClubId === null) {
      const roundFixtures = bracket.fixtures.filter((f) => f.round === round);
      bracket = advanceCustomCupBracket(bracket, roundFixtures.map((f) => decideFixture(f, f.homeClubId)));
      round += 1;
    }

    expect(bracket.championClubId).toBe(club(1));
  });

  it('runs a two-legged 8-club cup to a champion, deciding each tie by the second leg', () => {
    const clubIds = Array.from({ length: 8 }, (_, i) => club(i + 1));
    let bracket = generateCustomCupBracket(clubIds, { name: 'Copa Geral', clubIds, tieFormat: 'TWO_LEGGED' });
    expect(bracket.fixtures).toHaveLength(8); // 4 ties * 2 legs

    let round = 1;
    while (bracket.championClubId === null) {
      const roundFixtures = bracket.fixtures.filter((f) => f.round === round);
      const decided = roundFixtures.map((f) => (f.leg === 1 ? decideFixture(f, '__LEG1__') : decideFixture(f, f.homeClubId)));
      bracket = advanceCustomCupBracket(bracket, decided);
      round += 1;
    }

    // Home side of leg 2 always wins here, i.e. the away side of leg 1 in each tie keeps advancing.
    expect(bracket.championClubId).not.toBeNull();
  });

  it('rejects a cup whose entrant count is not 8, 16 or 32', () => {
    const clubIds = Array.from({ length: 12 }, (_, i) => club(i + 1));
    expect(() => generateCustomCupBracket(clubIds, { name: 'Copa Geral', clubIds, tieFormat: 'SINGLE_LEG' })).toThrow();
  });
});

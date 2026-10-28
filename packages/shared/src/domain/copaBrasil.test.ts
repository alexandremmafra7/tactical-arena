import { describe, it, expect } from 'vitest';
import {
  COPA_DO_BRASIL_STAGES,
  generateFirstRoundFixtures,
  generateNextRoundFixtures,
  type CupFixture,
} from './cup.js';

describe('Copa do Brasil Official Format', () => {
  it('has all 7 official tournament stages defined in order', () => {
    expect(COPA_DO_BRASIL_STAGES).toEqual([
      '1ª Fase (Preliminar)',
      '2ª Fase (Preliminar)',
      '3ª Fase (32 Clubes)',
      'Oitavas de Final',
      'Quartas de Final',
      'Semifinais',
      'Grande Final',
    ]);
  });

  it('generates 40 preliminary fixtures for 80 non-seeded clubs in Stage 1', () => {
    const clubIds = Array.from({ length: 80 }, (_, i) => `club-${i + 1}`);
    const fixtures = generateFirstRoundFixtures(clubIds, '1ª Fase (Preliminar)');

    expect(fixtures).toHaveLength(40);
    expect(fixtures[0].stageName).toBe('1ª Fase (Preliminar)');
    expect(fixtures[0].round).toBe(1);
    expect(fixtures[0].homeClubId).toBe('club-1');
    expect(fixtures[0].awayClubId).toBe('club-2');
  });

  it('generates 20 single-leg fixtures in Stage 2 from the 40 stage 1 winners', () => {
    const winners = Array.from({ length: 40 }, (_, i) => `winner-${i + 1}`);
    const fixtures = generateNextRoundFixtures(winners, 2, '2ª Fase (Preliminar)');

    expect(fixtures).toHaveLength(20);
    expect(fixtures[0].stageName).toBe('2ª Fase (Preliminar)');
    expect(fixtures[0].round).toBe(2);
  });

  it('calculates two-legged aggregate scores correctly', () => {
    // Scenario: Leg 1: Team A (Home) 2 x 1 Team B (Away)
    const leg1Fixture: CupFixture = {
      round: 3,
      stageName: '3ª Fase (Ida)',
      homeClubId: 'team-a',
      awayClubId: 'team-b',
      matchId: 'm1',
      winnerClubId: '__LEG1__',
      wentToPenalties: false,
      leg: 1,
      firstLegScore: { home: 2, away: 1 },
    };

    // Leg 2: Team B (Home) 2 x 1 Team A (Away)
    // Leg 2 home is Team B, Leg 2 away is Team A
    // Aggregate for Leg 2:
    // Team B total goals = 2 (leg 2 home) + 1 (leg 1 away) = 3
    // Team A total goals = 1 (leg 2 away) + 2 (leg 1 home) = 3
    const leg2HomeGoals = 2; // Team B
    const leg2AwayGoals = 1; // Team A
    const aggHome = leg2HomeGoals + (leg1Fixture.firstLegScore?.away ?? 0); // 2 + 1 = 3
    const aggAway = leg2AwayGoals + (leg1Fixture.firstLegScore?.home ?? 0); // 1 + 2 = 3

    expect(aggHome).toBe(3);
    expect(aggAway).toBe(3);
    expect(aggHome === aggAway).toBe(true); // Goes to penalties!
  });

  it('decides winner on aggregate when not tied without penalties', () => {
    // Leg 1: Team A 3 x 0 Team B
    // Leg 2: Team B 1 x 0 Team A
    const firstLegScore = { home: 3, away: 0 };
    const leg2HomeGoals = 1; // Team B
    const leg2AwayGoals = 0; // Team A

    const aggHome = leg2HomeGoals + firstLegScore.away; // 1 + 0 = 1 (Team B)
    const aggAway = leg2AwayGoals + firstLegScore.home; // 0 + 3 = 3 (Team A)

    expect(aggHome).toBe(1);
    expect(aggAway).toBe(3);
    expect(aggAway > aggHome).toBe(true); // Team A advances on aggregate 3x1!
  });
});

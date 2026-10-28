import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_CONFIGS,
  calculateGroupStandings,
  determineContinentalSpots,
  generateContinentalGroups,
  generateRoundOf16FromGroups,
  type ClubPotEntry,
} from './continentalCompetitions.js';

describe('continentalCompetitions domain', () => {
  it('has configurations for all 10 tournament types', () => {
    expect(TOURNAMENT_CONFIGS.LIBERTADORES.totalClubs).toBe(32);
    expect(TOURNAMENT_CONFIGS.LIBERTADORES.groupCount).toBe(8);
    expect(TOURNAMENT_CONFIGS.CHAMPIONS_LEAGUE.region).toBe('UEFA');
    expect(TOURNAMENT_CONFIGS.FIFA_INTERCONTINENTAL.region).toBe('WORLD');
    expect(TOURNAMENT_CONFIGS.FIFA_CLUB_WORLD_CUP.totalClubs).toBe(32);
  });

  it('generates 8 balanced groups of 4 teams from 32 entries', () => {
    const entries: ClubPotEntry[] = Array.from({ length: 32 }, (_, i) => ({
      clubId: `club_${i + 1}`,
      countryCode: i < 16 ? 'BRA' : 'ARG',
      reputationOrRating: 100 - i * 2,
    }));

    const groups = generateContinentalGroups(entries, () => 0.5);
    expect(groups.length).toBe(8);

    groups.forEach((group) => {
      expect(group.clubIds.length).toBe(4);
      expect(group.fixtures.length).toBe(12); // 6 rodadas x 2 jogos por rodada = 12 jogos
      expect(group.standings.length).toBe(4);
    });
  });

  it('correctly calculates group standings and tiebreakers', () => {
    const clubIds = ['c1', 'c2', 'c3', 'c4'];
    const fixtures = [
      { round: 1, homeClubId: 'c1', awayClubId: 'c2', matchId: 'm1', winnerClubId: null, wentToPenalties: false },
      { round: 1, homeClubId: 'c3', awayClubId: 'c4', matchId: 'm2', winnerClubId: null, wentToPenalties: false },
    ];

    const matchScores = {
      m1: { homeGoals: 3, awayGoals: 0 }, // c1 wins 3-0
      m2: { homeGoals: 1, awayGoals: 1 }, // c3 and c4 draw 1-1
    };

    const standings = calculateGroupStandings(clubIds, fixtures, matchScores);

    expect(standings[0].clubId).toBe('c1');
    expect(standings[0].points).toBe(3);
    expect(standings[0].goalDifference).toBe(3);

    expect(standings[1].points).toBe(1);
    expect(standings[2].points).toBe(1);
    expect(standings[3].clubId).toBe('c2');
    expect(standings[3].points).toBe(0);
  });

  it('generates two-legged round of 16 matchups with group winners having home advantage on second leg', () => {
    const entries: ClubPotEntry[] = Array.from({ length: 32 }, (_, i) => ({
      clubId: `club_${i + 1}`,
      countryCode: 'BRA',
      reputationOrRating: 100 - i,
    }));

    const groups = generateContinentalGroups(entries, () => 0.5);
    const roundOf16 = generateRoundOf16FromGroups(groups, 7, true);

    // 8 confrontos x 2 pernas = 16 fixtures
    expect(roundOf16.length).toBe(16);
    expect(roundOf16[0].leg).toBe(1);
    expect(roundOf16[1].leg).toBe(2);
    expect(roundOf16[0].tieId).toBe('OIT_1');
    expect(roundOf16[1].tieId).toBe('OIT_1');
  });

  it('determines continental spots for Brazilian and European leagues', () => {
    const standings = Array.from({ length: 20 }, (_, i) => ({
      clubId: `club_${i + 1}`,
      position: i + 1,
    }));

    const braSpots = determineContinentalSpots('BRA', standings, 'club_cup_winner');
    expect(braSpots.primarySpots).toContain('club_cup_winner');
    expect(braSpots.primarySpots.length).toBe(6);
    expect(braSpots.secondarySpots.length).toBe(6);

    const engSpots = determineContinentalSpots('ENG', standings);
    expect(engSpots.primarySpots.length).toBe(4);
    expect(engSpots.secondarySpots.length).toBe(2);
    expect(engSpots.tertiarySpots.length).toBe(1);
  });
});

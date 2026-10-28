import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../db/prisma.js';
import {
  getClubTrophyRoom,
  getCareerTrophyRoom,
  awardTournamentTrophy,
  recordClubHistoricalEvent,
} from './trophyService.js';
import { randomUUID } from 'node:crypto';

describe('trophyService', () => {
  let testClubId: string;
  let testUserId: string;
  let testManagerId: string;

  beforeEach(async () => {
    testClubId = `test-club-${randomUUID()}`;
    testUserId = `test-user-${randomUUID()}`;
    testManagerId = `test-mgr-${randomUUID()}`;

    await prisma.club.create({
      data: {
        id: testClubId,
        name: 'Trophy Stars FC',
        ownerId: testUserId,
        playersJson: '[]',
        trophiesJson: '[]',
        recordBookJson: '{}',
        titlesWon: 0,
      },
    });

    await prisma.manager.create({
      data: {
        id: testManagerId,
        name: 'Master Coach',
        userId: testUserId,
        clubId: testClubId,
        reputation: 60,
        trophiesJson: '[]',
      },
    });
  });

  it('returns an empty trophy room with default record book for a fresh club', async () => {
    const room = await getClubTrophyRoom(testClubId);
    expect(room.clubId).toBe(testClubId);
    expect(room.trophies).toEqual([]);
    expect(room.titlesWon).toBe(0);
    expect(room.recordBook.unbeatenStreakRecord).toBe(0);
    expect(room.recordBook.topScorers).toEqual([]);
  });

  it('awards a tournament trophy and increments titlesWon and manager reputation', async () => {
    const trophy = await awardTournamentTrophy({
      competitionType: 'LIBERTADORES',
      competitionName: 'CONMEBOL Libertadores',
      seasonYear: 2026,
      championClubId: testClubId,
      championClubName: 'Trophy Stars FC',
      managerName: 'Master Coach',
      managerId: testManagerId,
      runnerUpClubName: 'Boca Juniors',
      topScorerPlayerName: 'Garrincha',
      topScorerGoals: 12,
    });

    expect(trophy).not.toBeNull();
    expect(trophy?.competitionType).toBe('LIBERTADORES');

    const room = await getClubTrophyRoom(testClubId);
    expect(room.trophies).toHaveLength(1);
    expect(room.titlesWon).toBe(1);
    expect(room.trophies[0].topScorerPlayerName).toBe('Garrincha');

    const manager = await prisma.manager.findUnique({ where: { id: testManagerId } });
    expect(manager?.reputation).toBeGreaterThan(60);

    const careerRoom = await getCareerTrophyRoom(testUserId);
    expect(careerRoom.trophies).toHaveLength(1);
    expect(careerRoom.titlesCount).toBe(1);
  });

  it('records club historical match events and unbeaten streaks', async () => {
    await recordClubHistoricalEvent(testClubId, {
      type: 'MATCH_FINISHED',
      matchId: 'm1',
      opponentName: 'Rival FC',
      clubGoals: 5,
      opponentGoals: 0,
      year: 2026,
    });

    await recordClubHistoricalEvent(testClubId, {
      type: 'GOAL_SCORED',
      playerId: 'p1',
      playerName: 'Zico',
      count: 3,
      currentYear: 2026,
    });

    const room = await getClubTrophyRoom(testClubId);
    expect(room.recordBook.biggestWin?.score).toBe('5 x 0');
    expect(room.recordBook.biggestWin?.opponentName).toBe('Rival FC');
    expect(room.recordBook.currentUnbeatenStreak).toBe(1);
    expect(room.recordBook.unbeatenStreakRecord).toBe(1);
    expect(room.recordBook.topScorers[0].name).toBe('Zico');
    expect(room.recordBook.topScorers[0].total).toBe(3);
  });
});

import { randomUUID } from 'node:crypto';
import {
  ClubRecordBook,
  CompetitionType,
  RecordEvent,
  TrophyRoomEntry,
  recordTournamentChampion,
  updateClubRecords,
  getTrophyVisualSpec,
  REPUTATION_WEIGHTS,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';

export interface ClubTrophyRoomResponse {
  clubId: string;
  clubName: string;
  trophies: TrophyRoomEntry[];
  recordBook: ClubRecordBook;
  titlesWon: number;
}

export interface CareerTrophyRoomResponse {
  userId: string;
  managerName: string;
  reputation: number;
  trophies: TrophyRoomEntry[];
  titlesCount: number;
}

export function getDefaultRecordBook(): ClubRecordBook {
  return {
    topScorers: [],
    topAssisters: [],
    mostAppearances: [],
    recordSale: null,
    recordPurchase: null,
    biggestWin: null,
    unbeatenStreakRecord: 0,
    currentUnbeatenStreak: 0,
  };
}

export async function getClubTrophyRoom(clubId: string): Promise<ClubTrophyRoomResponse> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) {
    return {
      clubId,
      clubName: 'Clube',
      trophies: [],
      recordBook: getDefaultRecordBook(),
      titlesWon: 0,
    };
  }

  let trophies: TrophyRoomEntry[] = [];
  try {
    trophies = club.trophiesJson ? JSON.parse(club.trophiesJson) : [];
  } catch {
    trophies = [];
  }

  let recordBook: ClubRecordBook = getDefaultRecordBook();
  try {
    if (club.recordBookJson && club.recordBookJson !== '{}') {
      recordBook = { ...getDefaultRecordBook(), ...JSON.parse(club.recordBookJson) };
    }
  } catch {
    recordBook = getDefaultRecordBook();
  }

  return {
    clubId: club.id,
    clubName: club.name,
    trophies: trophies.sort((a, b) => b.seasonYear - a.seasonYear),
    recordBook,
    titlesWon: club.titlesWon || trophies.length,
  };
}

export async function getCareerTrophyRoom(userId: string): Promise<CareerTrophyRoomResponse> {
  const [manager, user] = await Promise.all([
    prisma.manager.findFirst({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  let trophies: TrophyRoomEntry[] = [];
  if (manager?.trophiesJson) {
    try {
      trophies = JSON.parse(manager.trophiesJson);
    } catch {
      trophies = [];
    }
  }

  // Also collect trophies from clubs currently or previously owned by this user
  const clubs = await prisma.club.findMany({ where: { ownerId: userId } });
  for (const c of clubs) {
    if (c.trophiesJson) {
      try {
        const clubTrophies: TrophyRoomEntry[] = JSON.parse(c.trophiesJson);
        for (const t of clubTrophies) {
          if (!trophies.some((existing) => existing.id === t.id)) {
            trophies.push(t);
          }
        }
      } catch {
        // ignore JSON parse error
      }
    }
  }

  return {
    userId,
    managerName: manager?.name ?? user?.email ?? 'Treinador',
    reputation: manager?.reputation ?? 50,
    trophies: trophies.sort((a, b) => b.seasonYear - a.seasonYear),
    titlesCount: trophies.length,
  };
}

export async function awardTournamentTrophy(params: {
  competitionType: CompetitionType;
  competitionName: string;
  seasonYear: number;
  championClubId: string;
  championClubName: string;
  managerName: string;
  managerId?: string;
  runnerUpClubName?: string;
  topScorerPlayerName?: string;
  topScorerGoals?: number;
}): Promise<TrophyRoomEntry | null> {
  const club = await prisma.club.findUnique({ where: { id: params.championClubId } });
  if (!club) return null;

  let existingTrophies: TrophyRoomEntry[] = [];
  try {
    existingTrophies = club.trophiesJson ? JSON.parse(club.trophiesJson) : [];
  } catch {
    existingTrophies = [];
  }

  const spec = getTrophyVisualSpec(params.competitionType);

  const newTrophy: TrophyRoomEntry = {
    id: `trophy-${params.competitionType.toLowerCase()}-${params.seasonYear}-${params.championClubId}`,
    competitionType: params.competitionType,
    competitionName: params.competitionName,
    seasonYear: params.seasonYear,
    clubId: params.championClubId,
    clubName: params.championClubName || club.name,
    managerName: params.managerName,
    managerId: params.managerId,
    runnerUpClubName: params.runnerUpClubName,
    topScorerPlayerName: params.topScorerPlayerName,
    topScorerGoals: params.topScorerGoals,
    trophyIcon: spec.iconEmoji,
    date: new Date().toISOString(),
  };

  const { trophies: updatedTrophies, clubReputationGain, managerReputationGain } = recordTournamentChampion(
    existingTrophies,
    newTrophy,
  );

  // Update club
  await prisma.club.update({
    where: { id: club.id },
    data: {
      trophiesJson: JSON.stringify(updatedTrophies),
      titlesWon: updatedTrophies.length,
    },
  });

  // If manager is associated, update manager
  if (params.managerId) {
    const manager = await prisma.manager.findUnique({ where: { id: params.managerId } });
    if (manager) {
      let managerTrophies: TrophyRoomEntry[] = [];
      try {
        managerTrophies = manager.trophiesJson ? JSON.parse(manager.trophiesJson) : [];
      } catch {
        managerTrophies = [];
      }
      const { trophies: updatedMgrTrophies } = recordTournamentChampion(managerTrophies, newTrophy);
      const currentRep = typeof manager.reputation === 'number' ? manager.reputation : 50;
      const gain = typeof managerReputationGain === 'number' ? managerReputationGain : 10;
      const newReputation = Math.min(99, Math.max(1, currentRep + gain));
      await prisma.manager.update({
        where: { id: manager.id },
        data: {
          trophiesJson: JSON.stringify(updatedMgrTrophies),
          reputation: newReputation,
        },
      });
    }
  }

  return newTrophy;
}

export async function recordClubHistoricalEvent(clubId: string, event: RecordEvent): Promise<ClubRecordBook> {
  const club = await prisma.club.findUnique({ where: { id: clubId } });
  if (!club) throw new Error('Clube não encontrado');

  let recordBook: ClubRecordBook = getDefaultRecordBook();
  try {
    if (club.recordBookJson && club.recordBookJson !== '{}') {
      recordBook = { ...getDefaultRecordBook(), ...JSON.parse(club.recordBookJson) };
    }
  } catch {
    recordBook = getDefaultRecordBook();
  }

  const updatedBook = updateClubRecords(recordBook, event);

  await prisma.club.update({
    where: { id: clubId },
    data: {
      recordBookJson: JSON.stringify(updatedBook),
    },
  });

  return updatedBook;
}

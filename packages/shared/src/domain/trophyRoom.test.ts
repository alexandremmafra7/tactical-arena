import { describe, expect, it } from 'vitest';
import {
  createEmptyRecordBook,
  getTrophyVisualSpec,
  recordTournamentChampion,
  updateClubRecords,
  type TrophyRoomEntry,
} from './trophyRoom.js';

describe('Trophy Room & Hall of Fame Domain', () => {
  it('records a new tournament champion and applies reputation bonus', () => {
    const trophy: TrophyRoomEntry = {
      id: 'libertadores-2026-c1',
      competitionType: 'LIBERTADORES',
      competitionName: 'CONMEBOL Libertadores',
      seasonYear: 2026,
      clubId: 'c1',
      clubName: 'Flamengo',
      managerName: 'Tite',
      runnerUpClubName: 'Palmeiras',
      topScorerPlayerName: 'Pedro',
      topScorerGoals: 12,
      trophyIcon: '🏆',
    };

    const result = recordTournamentChampion([], trophy);
    expect(result.isNewTitle).toBe(true);
    expect(result.trophies).toHaveLength(1);
    expect(result.clubReputationGain).toBe(20);
    expect(result.managerReputationGain).toBe(22);

    // Duplicate prevention
    const secondTry = recordTournamentChampion(result.trophies, trophy);
    expect(secondTry.isNewTitle).toBe(false);
    expect(secondTry.trophies).toHaveLength(1);
    expect(secondTry.clubReputationGain).toBe(0);
  });

  it('updates top scorers and limits to top 3', () => {
    let book = createEmptyRecordBook();

    book = updateClubRecords(book, { type: 'GOAL_SCORED', playerId: 'p1', playerName: 'Pedro', count: 10, currentYear: 2026 });
    book = updateClubRecords(book, { type: 'GOAL_SCORED', playerId: 'p2', playerName: 'Gabigol', count: 15, currentYear: 2026 });
    book = updateClubRecords(book, { type: 'GOAL_SCORED', playerId: 'p3', playerName: 'Arrascaeta', count: 8, currentYear: 2026 });
    book = updateClubRecords(book, { type: 'GOAL_SCORED', playerId: 'p4', playerName: 'Bruno Henrique', count: 12, currentYear: 2026 });

    expect(book.topScorers).toHaveLength(3);
    expect(book.topScorers[0].name).toBe('Gabigol');
    expect(book.topScorers[0].total).toBe(15);
    expect(book.topScorers[1].name).toBe('Bruno Henrique');
    expect(book.topScorers[1].total).toBe(12);
    expect(book.topScorers[2].name).toBe('Pedro');
    expect(book.topScorers[2].total).toBe(10);
  });

  it('tracks transfer records and biggest wins', () => {
    let book = createEmptyRecordBook();

    book = updateClubRecords(book, {
      type: 'TRANSFER_SALE',
      playerId: 'p1',
      playerName: 'Vini Jr',
      amount: 45_000_000,
      buyerClubName: 'Real Madrid',
      year: 2026,
    });

    expect(book.recordSale?.amount).toBe(45_000_000);
    expect(book.recordSale?.playerName).toBe('Vini Jr');

    book = updateClubRecords(book, {
      type: 'TRANSFER_PURCHASE',
      playerId: 'p2',
      playerName: 'De La Cruz',
      amount: 16_000_000,
      sellerClubName: 'River Plate',
      year: 2026,
    });

    expect(book.recordPurchase?.amount).toBe(16_000_000);

    book = updateClubRecords(book, {
      type: 'MATCH_FINISHED',
      matchId: 'm1',
      opponentName: 'Vasco',
      clubGoals: 6,
      opponentGoals: 1,
      year: 2026,
    });

    expect(book.biggestWin?.score).toBe('6 x 1');
    expect(book.biggestWin?.goalDiff).toBe(5);
    expect(book.unbeatenStreakRecord).toBe(1);
    expect(book.currentUnbeatenStreak).toBe(1);

    // Another win extends streak
    book = updateClubRecords(book, {
      type: 'MATCH_FINISHED',
      matchId: 'm2',
      opponentName: 'Fluminense',
      clubGoals: 2,
      opponentGoals: 0,
      year: 2026,
    });

    expect(book.unbeatenStreakRecord).toBe(2);
    expect(book.currentUnbeatenStreak).toBe(2);

    // Defeat resets streak
    book = updateClubRecords(book, {
      type: 'MATCH_FINISHED',
      matchId: 'm3',
      opponentName: 'Botafogo',
      clubGoals: 0,
      opponentGoals: 1,
      year: 2026,
    });

    expect(book.unbeatenStreakRecord).toBe(2);
    expect(book.currentUnbeatenStreak).toBe(0);
  });

  it('provides visual styling spec and official trophy assets for different competition tiers', () => {
    const mundial = getTrophyVisualSpec('CLUB_WORLD_CUP');
    expect(mundial.tier).toBe('MUNDIAL');
    expect(mundial.iconEmoji).toBe('🏆');
    expect(mundial.trophyAsset).toBe('tr_supermundial.png');

    const champions = getTrophyVisualSpec('CHAMPIONS_LEAGUE');
    expect(champions.tier).toBe('CONTINENTAL');
    expect(champions.borderColor).toBe('#3b82f6');
    expect(champions.trophyAsset).toBe('tr_ligacampeoes.png');

    const libertadores = getTrophyVisualSpec('LIBERTADORES');
    expect(libertadores.trophyAsset).toBe('tr_libertadores.png');

    // Generic league fallback
    const league = getTrophyVisualSpec('LEAGUE');
    expect(league.tier).toBe('NACIONAL');
    expect(league.trophyAsset).toBe('tr_nacionalgenerico.png');

    // Specific world leagues
    const pl = getTrophyVisualSpec('LEAGUE', 'Premier League');
    expect(pl.trophyAsset).toBe('tr_nacional_ING.png');

    const laLiga = getTrophyVisualSpec('LEAGUE', 'La Liga');
    expect(laLiga.trophyAsset).toBe('tr_nacional_ESP.png');

    const serieA = getTrophyVisualSpec('LEAGUE', 'Serie A');
    expect(serieA.trophyAsset).toBe('tr_nacional_ITA.png');

    const brasileirao = getTrophyVisualSpec('LEAGUE', 'Brasileirão Série A');
    expect(brasileirao.trophyAsset).toBe('tr_nacional_BRA_d1.png');

    // Specific national cups
    const faCup = getTrophyVisualSpec('CUP', 'FA Cup');
    expect(faCup.trophyAsset).toBe('tr_copa_ING.png');

    const copaBrasil = getTrophyVisualSpec('CUP', 'Copa do Brasil');
    expect(copaBrasil.trophyAsset).toBe('tr_copa_BRA.png');

    const dfbPokal = getTrophyVisualSpec('CUP', 'DFB-Pokal');
    expect(dfbPokal.trophyAsset).toBe('tr_copa_ALE.png');
  });
});

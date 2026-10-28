import { trophyAssetForCompetitionName } from './nationalCups.js';
import { WORLD_LEAGUES } from './worldLeagues.js';

export type CompetitionType =
  | 'LEAGUE'
  | 'CUP'
  | 'LIBERTADORES'
  | 'SUDAMERICANA'
  | 'RECOPA'
  | 'CHAMPIONS_LEAGUE'
  | 'EUROPA_LEAGUE'
  | 'CONFERENCE_LEAGUE'
  | 'SUPER_CUP_UEFA'
  | 'INTERCONTINENTAL'
  | 'CLUB_WORLD_CUP'
  | 'STATE_CHAMPIONSHIP';

export type TrophyTier = 'MUNDIAL' | 'CONTINENTAL' | 'NACIONAL' | 'REGIONAL';

export interface TrophyRoomEntry {
  id: string;
  competitionType: CompetitionType;
  competitionName: string;
  seasonYear: number;
  clubId: string;
  clubName: string;
  managerName: string;
  managerId?: string;
  runnerUpClubName?: string;
  topScorerPlayerName?: string;
  topScorerGoals?: number;
  trophyIcon: string;
  date?: string;
}

export interface HistoricalPlayerRankingEntry {
  playerId: string;
  name: string;
  total: number;
  era: string;
  isCurrentPlayer?: boolean;
}

export interface TransferRecordEntry {
  playerId: string;
  playerName: string;
  amount: number;
  clubName: string;
  year: number;
}

export interface MatchRecordEntry {
  matchId: string;
  opponentName: string;
  score: string;
  goalDiff: number;
  year: number;
}

export interface ClubRecordBook {
  /** Top 3 Maiores Artilheiros de Todos os Tempos */
  topScorers: HistoricalPlayerRankingEntry[];
  /** Top 3 Líderes em Assistências */
  topAssisters: HistoricalPlayerRankingEntry[];
  /** Top 3 Recordistas de Partidas */
  mostAppearances: HistoricalPlayerRankingEntry[];
  /** Maior Venda da História */
  recordSale: TransferRecordEntry | null;
  /** Maior Compra da História */
  recordPurchase: TransferRecordEntry | null;
  /** Maior Goleada Aplicada */
  biggestWin: MatchRecordEntry | null;
  /** Maior Sequência Invicta Histórica */
  unbeatenStreakRecord: number;
  /** Sequência Invicta Atual */
  currentUnbeatenStreak: number;
}

export interface TrophyVisualSpec {
  name: string;
  tier: TrophyTier;
  iconEmoji: string;
  badgeGlow: string;
  bgGradient: string;
  borderColor: string;
  trophyAsset?: string;
}

export const REPUTATION_WEIGHTS: Record<CompetitionType, { clubRep: number; managerRep: number }> = {
  CLUB_WORLD_CUP: { clubRep: 25, managerRep: 30 },
  INTERCONTINENTAL: { clubRep: 20, managerRep: 25 },
  CHAMPIONS_LEAGUE: { clubRep: 22, managerRep: 25 },
  LIBERTADORES: { clubRep: 20, managerRep: 22 },
  EUROPA_LEAGUE: { clubRep: 14, managerRep: 16 },
  SUDAMERICANA: { clubRep: 12, managerRep: 14 },
  RECOPA: { clubRep: 8, managerRep: 10 },
  SUPER_CUP_UEFA: { clubRep: 8, managerRep: 10 },
  CONFERENCE_LEAGUE: { clubRep: 10, managerRep: 12 },
  LEAGUE: { clubRep: 15, managerRep: 18 },
  CUP: { clubRep: 12, managerRep: 15 },
  STATE_CHAMPIONSHIP: { clubRep: 8, managerRep: 10 },
};

export function getTrophyVisualSpec(type: CompetitionType, competitionName?: string): TrophyVisualSpec {
  switch (type) {
    case 'CLUB_WORLD_CUP':
      return {
        name: 'Super Mundial de Clubes FIFA',
        tier: 'MUNDIAL',
        iconEmoji: '🏆',
        badgeGlow: 'rgba(255, 215, 0, 0.6)',
        bgGradient: 'linear-gradient(135deg, rgba(255, 215, 0, 0.25) 0%, rgba(20, 16, 8, 0.95) 100%)',
        borderColor: '#ffd700',
        trophyAsset: 'tr_supermundial.png',
      };
    case 'INTERCONTINENTAL':
      return {
        name: 'Copa Intercontinental FIFA',
        tier: 'MUNDIAL',
        iconEmoji: '🌍',
        badgeGlow: 'rgba(234, 179, 8, 0.5)',
        bgGradient: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(18, 15, 10, 0.95) 100%)',
        borderColor: '#eab308',
        trophyAsset: 'tr_mundial.png',
      };
    case 'CHAMPIONS_LEAGUE':
      return {
        name: 'UEFA Champions League',
        tier: 'CONTINENTAL',
        iconEmoji: '⭐',
        badgeGlow: 'rgba(59, 130, 246, 0.6)',
        bgGradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(10, 15, 30, 0.95) 100%)',
        borderColor: '#3b82f6',
        trophyAsset: 'tr_ligacampeoes.png',
      };
    case 'LIBERTADORES':
      return {
        name: 'CONMEBOL Libertadores',
        tier: 'CONTINENTAL',
        iconEmoji: '🏆',
        badgeGlow: 'rgba(245, 158, 11, 0.6)',
        bgGradient: 'linear-gradient(135deg, rgba(217, 119, 6, 0.25) 0%, rgba(25, 18, 10, 0.95) 100%)',
        borderColor: '#f59e0b',
        trophyAsset: 'tr_libertadores.png',
      };
    case 'EUROPA_LEAGUE':
      return {
        name: 'UEFA Europa League',
        tier: 'CONTINENTAL',
        iconEmoji: '🛡️',
        badgeGlow: 'rgba(249, 115, 22, 0.5)',
        bgGradient: 'linear-gradient(135deg, rgba(234, 88, 12, 0.2) 0%, rgba(25, 15, 10, 0.95) 100%)',
        borderColor: '#f97316',
        trophyAsset: 'tr_ligaeuropa.png',
      };
    case 'SUDAMERICANA':
      return {
        name: 'CONMEBOL Sul-Americana',
        tier: 'CONTINENTAL',
        iconEmoji: '🥈',
        badgeGlow: 'rgba(148, 163, 184, 0.5)',
        bgGradient: 'linear-gradient(135deg, rgba(100, 116, 139, 0.2) 0%, rgba(15, 18, 22, 0.95) 100%)',
        borderColor: '#94a3b8',
        trophyAsset: 'tr_sulamericana.png',
      };
    case 'RECOPA':
    case 'SUPER_CUP_UEFA':
      return {
        name: type === 'RECOPA' ? 'Recopa Sul-Americana' : 'Supercopa da UEFA',
        tier: 'CONTINENTAL',
        iconEmoji: '🎖️',
        badgeGlow: 'rgba(168, 85, 247, 0.5)',
        bgGradient: 'linear-gradient(135deg, rgba(147, 51, 234, 0.2) 0%, rgba(20, 12, 28, 0.95) 100%)',
        borderColor: '#a855f7',
        trophyAsset: type === 'RECOPA' ? 'tr_recopasulamaericana.png' : 'tr_recopaeuropa.png',
      };
    case 'CONFERENCE_LEAGUE':
      return {
        name: 'UEFA Conference League',
        tier: 'CONTINENTAL',
        iconEmoji: '🥉',
        badgeGlow: 'rgba(34, 197, 94, 0.5)',
        bgGradient: 'linear-gradient(135deg, rgba(22, 163, 74, 0.2) 0%, rgba(10, 24, 16, 0.95) 100%)',
        borderColor: '#22c55e',
        trophyAsset: 'tr_conference.png',
      };
    case 'LEAGUE': {
      let asset = 'tr_nacionalgenerico.png';
      if (competitionName) {
        const found = WORLD_LEAGUES.find(
          (l) => l.name.toLowerCase() === competitionName.trim().toLowerCase() ||
                 l.shortName.toLowerCase() === competitionName.trim().toLowerCase(),
        );
        if (found) asset = found.trophyAsset;
        else if (competitionName.toLowerCase().includes('brasileir')) asset = 'tr_nacional_BRA_d1.png';
      }
      return {
        name: competitionName || 'Campeonato Nacional',
        tier: 'NACIONAL',
        iconEmoji: '🥇',
        badgeGlow: 'rgba(212, 175, 55, 0.5)',
        bgGradient: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(20, 18, 12, 0.95) 100%)',
        borderColor: '#d4af37',
        trophyAsset: asset,
      };
    }
    case 'STATE_CHAMPIONSHIP': {
      let asset = 'tr_estadual.png';
      let name = competitionName || 'Campeonato Estadual';
      if (competitionName) {
        const lower = competitionName.toLowerCase();
        if (lower.includes('paulist')) asset = 'tr_estadual_sp.png';
        else if (lower.includes('carioca') || lower.includes('rio')) asset = 'tr_estadual_rj.png';
        else if (lower.includes('gaúcho') || lower.includes('gaucho')) asset = 'tr_estadual_rs.png';
        else if (lower.includes('mineiro')) asset = 'tr_estadual_mg.png';
        else if (lower.includes('paranaense')) asset = 'tr_estadual_pr.png';
        else if (lower.includes('catarinense')) asset = 'tr_estadual_sc.png';
        else if (lower.includes('baiano')) asset = 'tr_estadual_ba.png';
        else if (lower.includes('pernambucano')) asset = 'tr_estadual_pe.png';
        else if (lower.includes('cearense')) asset = 'tr_estadual_ce.png';
        else if (lower.includes('goiano')) asset = 'tr_estadual_go.png';
      }
      return {
        name,
        tier: 'REGIONAL',
        iconEmoji: '🏆',
        badgeGlow: 'rgba(16, 185, 129, 0.5)',
        bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(10, 20, 15, 0.95) 100%)',
        borderColor: '#10b981',
        trophyAsset: asset,
      };
    }
    case 'CUP':
    default: {
      let asset = 'tr_copa.png';
      if (competitionName) {
        const custom = trophyAssetForCompetitionName(competitionName);
        if (custom) asset = custom;
      }
      return {
        name: competitionName || 'Copa Nacional',
        tier: 'NACIONAL',
        iconEmoji: '🏆',
        badgeGlow: 'rgba(56, 189, 248, 0.5)',
        bgGradient: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(10, 18, 26, 0.95) 100%)',
        borderColor: '#38bdf8',
        trophyAsset: asset,
      };
    }
  }
}

export function createEmptyRecordBook(): ClubRecordBook {
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

/**
 * Adiciona um troféu garantindo que o mesmo troféu não seja duplicado na mesma edição.
 */
export function recordTournamentChampion(
  existingTrophies: TrophyRoomEntry[],
  newTrophy: TrophyRoomEntry,
): { trophies: TrophyRoomEntry[]; clubReputationGain: number; managerReputationGain: number; isNewTitle: boolean } {
  const isDuplicate = existingTrophies.some(
    (t) => t.competitionType === newTrophy.competitionType && t.seasonYear === newTrophy.seasonYear && t.clubId === newTrophy.clubId,
  );

  if (isDuplicate) {
    return {
      trophies: existingTrophies,
      clubReputationGain: 0,
      managerReputationGain: 0,
      isNewTitle: false,
    };
  }

  const weights = REPUTATION_WEIGHTS[newTrophy.competitionType] || { clubRep: 10, managerRep: 10 };
  const updatedTrophies = [newTrophy, ...existingTrophies];

  return {
    trophies: updatedTrophies,
    clubReputationGain: weights.clubRep,
    managerReputationGain: weights.managerRep,
    isNewTitle: true,
  };
}

export type RecordEvent =
  | { type: 'MATCH_FINISHED'; matchId: string; opponentName: string; clubGoals: number; opponentGoals: number; year: number }
  | { type: 'GOAL_SCORED'; playerId: string; playerName: string; count: number; currentYear: number }
  | { type: 'ASSIST_PROVIDED'; playerId: string; playerName: string; count: number; currentYear: number }
  | { type: 'MATCH_PLAYED'; playerId: string; playerName: string; currentYear: number }
  | { type: 'TRANSFER_SALE'; playerId: string; playerName: string; amount: number; buyerClubName: string; year: number }
  | { type: 'TRANSFER_PURCHASE'; playerId: string; playerName: string; amount: number; sellerClubName: string; year: number };

function updateTop3Ranking(
  currentRanking: HistoricalPlayerRankingEntry[],
  playerId: string,
  playerName: string,
  addition: number,
  currentYear: number,
): HistoricalPlayerRankingEntry[] {
  const cloned = [...currentRanking];
  const existingIdx = cloned.findIndex((e) => e.playerId === playerId);

  if (existingIdx !== -1) {
    const item = cloned[existingIdx];
    cloned[existingIdx] = {
      ...item,
      name: playerName || item.name,
      total: item.total + addition,
      era: `${item.era.split('-')[0]}-${currentYear}`,
    };
  } else {
    cloned.push({
      playerId,
      name: playerName,
      total: addition,
      era: String(currentYear),
      isCurrentPlayer: true,
    });
  }

  cloned.sort((a, b) => b.total - a.total);
  return cloned.slice(0, 3);
}

/**
 * Atualiza o livro de recordes de forma pura e imutável.
 */
export function updateClubRecords(records: ClubRecordBook, event: RecordEvent): ClubRecordBook {
  const book: ClubRecordBook = {
    topScorers: [...records.topScorers],
    topAssisters: [...records.topAssisters],
    mostAppearances: [...records.mostAppearances],
    recordSale: records.recordSale ? { ...records.recordSale } : null,
    recordPurchase: records.recordPurchase ? { ...records.recordPurchase } : null,
    biggestWin: records.biggestWin ? { ...records.biggestWin } : null,
    unbeatenStreakRecord: records.unbeatenStreakRecord,
    currentUnbeatenStreak: records.currentUnbeatenStreak,
  };

  switch (event.type) {
    case 'GOAL_SCORED':
      book.topScorers = updateTop3Ranking(book.topScorers, event.playerId, event.playerName, event.count, event.currentYear);
      break;

    case 'ASSIST_PROVIDED':
      book.topAssisters = updateTop3Ranking(book.topAssisters, event.playerId, event.playerName, event.count, event.currentYear);
      break;

    case 'MATCH_PLAYED':
      book.mostAppearances = updateTop3Ranking(book.mostAppearances, event.playerId, event.playerName, 1, event.currentYear);
      break;

    case 'TRANSFER_SALE':
      if (!book.recordSale || event.amount > book.recordSale.amount) {
        book.recordSale = {
          playerId: event.playerId,
          playerName: event.playerName,
          amount: event.amount,
          clubName: event.buyerClubName,
          year: event.year,
        };
      }
      break;

    case 'TRANSFER_PURCHASE':
      if (!book.recordPurchase || event.amount > book.recordPurchase.amount) {
        book.recordPurchase = {
          playerId: event.playerId,
          playerName: event.playerName,
          amount: event.amount,
          clubName: event.sellerClubName,
          year: event.year,
        };
      }
      break;

    case 'MATCH_FINISHED': {
      const isWin = event.clubGoals > event.opponentGoals;
      const isDraw = event.clubGoals === event.opponentGoals;
      const goalDiff = event.clubGoals - event.opponentGoals;

      if (isWin || isDraw) {
        book.currentUnbeatenStreak += 1;
        if (book.currentUnbeatenStreak > book.unbeatenStreakRecord) {
          book.unbeatenStreakRecord = book.currentUnbeatenStreak;
        }
      } else {
        book.currentUnbeatenStreak = 0;
      }

      if (isWin && goalDiff >= 3) {
        if (!book.biggestWin || goalDiff > book.biggestWin.goalDiff) {
          book.biggestWin = {
            matchId: event.matchId,
            opponentName: event.opponentName,
            score: `${event.clubGoals} x ${event.opponentGoals}`,
            goalDiff,
            year: event.year,
          };
        }
      }
      break;
    }
  }

  return book;
}
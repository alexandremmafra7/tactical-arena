import type {
  CupFixture,
  CupTieFormat,
} from './cup.js';

/**
 * Continental competitions (Libertadores, Champions League, etc.)
 * Follow similar structure to cups but with confederation-specific qualification
 */

/** Confederation identifiers matching country codes in competitionNames.ts */
export type ConfederationCode =
  | 'CONMEBOL' // South America
  | 'UEFA'     // Europe
  | 'CONCACAF' // North/Central America & Caribbean
  | 'AFC'      // Asia
  | 'CAF'      // Africa
  | 'OFC';     // Oceania

/** Stage of continental competition */
export type ContinentalStage =
  | 'GROUP_STAGE'
  | 'ROUND_OF_16'
  | 'QUARTER_FINALS'
  | 'SEMI_FINALS'
  | 'FINAL';

export interface ContinentalFixture extends CupFixture {
  stage?: ContinentalStage;
  /** For group stage: points earned (3 for win, 1 for draw, 0 for loss) */
  points?: number;
  /** For group stage: goal difference */
  goalDifference?: number;
}

/**
 * Continental competition structure
 * Similar to Cup but with confederation and qualification tracking
 */
export interface ContinentalCompetition {
  id: string;
  name: string;
  confederationCode: ConfederationCode;
  /** Original entrants in competition order */
  clubIds: string[];
  /** All fixtures across all rounds/stages */
  fixtures: ContinentalFixture[];
  status: 'IN_PROGRESS' | 'FINISHED';
  championClubId: string | null;
  championOwnerId: string | null;
  /** Runner-up for historical records */
  runnerUpClubId: string | null;
  /** In-game "year" this competition was created in */
  season: number;
  /** Top scorer once finished */
  topScorerPlayerId: string | null;
  topScorerName: string | null;
  topScorerGoals: number | null;
  topScorerClubId: string | null;
  /** Seeded clubs entering at later stages (if applicable) */
  seededClubIds?: string[];
  /** Current stage being played */
  currentStage?: ContinentalStage;
  /** Points awarded for Super Mundial qualification */
  superMundialPoints?: number;
}

/**
 * Qualification pathways for continental competitions
 * Based on league positions and cup victories from previous season
 */
export interface ContinentalQualificationPath {
  /** League position that qualifies (1-based, e.g. 1 for champion) */
  leaguePosition: number;
  /** Confederation this applies to */
  confederationCode: ConfederationCode;
  /** Which continental competition this path leads to */
  competitionType:
    | 'LIBERTADORES'
    | 'CHAMPIONS_LEAGUE'
    | 'SUDAMERICANA'
    | 'EUROPA_LEAGUE'
    | 'CONFERENCE_LEAGUE'
    | 'CONCACAF_CHAMPIONS_CUP'
    | 'AFC_CHAMPIONS_LEAGUE'
    | 'CAF_CHAMPIONS_LEAGUE'
    | 'OFC_CHAMPIONS_LEAGUE';
  /** Additional requirements (e.g. "must be cup winner") */
  additionalRequirements?: string[];
}

/**
 * Format specifications for different continental competitions
 */
export interface ContinentalFormat {
  /** Number of groups in group stage */
  groupCount?: number;
  /** Teams per group */
  teamsPerGroup?: number;
  /** Knockout rounds format */
  knockoutFormat?: CupTieFormat;
  /** Whether to have third place match */
  hasThirdPlaceMatch?: boolean;
}

/**
 * Prize money structure for continental competitions
 */
export interface ContinentalPrizeMoney {
  /** Base participation fee */
  participationFee: number;
  /** Prize for winning each match */
  matchWinBonus: number;
  /** Prize for drawing each match */
  matchDrawBonus: number;
  /** Prize for advancing to each stage */
  stageAdvancement: Record<ContinentalStage, number>;
  /** Winner prize */
  winnerPrize: number;
  /** Runner-up prize */
  runnerUpPrize: number;
}

/**
 * Calculate points for group stage match result
 */
export function calculateGroupStagePoints(
  homeGoals: number,
  awayGoals: number
): { homePoints: number; awayPoints: number } {
  if (homeGoals > awayGoals) {
    return { homePoints: 3, awayPoints: 0 };
  }
  if (homeGoals < awayGoals) {
    return { homePoints: 0, awayPoints: 3 };
  }
  // Draw
  return { homePoints: 1, awayPoints: 1 };
}

/**
 * Determine if a club qualified for continental competition
 * based on league position and cup results
 */
export function didQualifyForContinental(
  leaguePosition: number,
  wonNationalCup: boolean,
  qualificationPaths: ContinentalQualificationPath[]
): ContinentalQualificationPath | null {
  for (const path of qualificationPaths) {
    if (leaguePosition === path.leaguePosition) {
      // Check additional requirements if any
      if (path.additionalRequirements?.includes('CUP_WINNER') && !wonNationalCup) {
        continue;
      }
      return path;
    }
  }
  return null;
}
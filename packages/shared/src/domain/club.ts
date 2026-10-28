import { Player } from './player.js';
import { BankGuarantee, Loan, Sponsorship, StadiumConstruction, STARTING_STADIUM_CAPACITY, STARTING_STADIUM_LEVEL } from './finance.js';
import { StaffMember, StaffRecordEntry } from './staff.js';
import { TransferInstallmentPlan } from './transferProposal.js';
import { Tactic } from './tactic.js';
import { StaffDelegationConfig } from './staffDelegationConfig.js';
import type { TrophyRoomEntry, ClubRecordBook } from './trophyRoom.js';

export type KitPattern = 'SOLID' | 'STRIPES_VERTICAL' | 'STRIPES_HORIZONTAL' | 'DIAGONAL_SASH' | 'HALVES' | 'GRADIENT';

export interface Club {
  id: string;
  name: string;
  ownerId: string;
  /** Stable, human-readable identifier for premade clubs (crest filename, CSV import key). Null for randomly-created clubs. */
  slug: string | null;
  country: string;
  players: Player[];
  /** Youth academy: always sub-20 prospects, managed separately from the main squad. */
  academyPlayers: Player[];
  budget: number;
  captainPlayerId: string | null;
  /** Consecutive ticks the current captain has held the armband; resets whenever the captain changes. */
  captainWeeksServed: number;
  /** The manager's designated dressing-room peacemaker — see squadHarmony.ts. At most one per club. */
  tutorPlayerId: string | null;
  /** Roster-level set-piece designations — informational picks made from the squad screen (a match's own
   *  Tactic can still name its own penaltyTakerId, which takes precedence for that match). At most one
   *  player per role, but one player can hold several roles at once; see PlayerRole/setPlayerRole. */
  penaltyTakerId: string | null;
  freeKickTakerId: string | null;
  cornerLeftTakerId: string | null;
  cornerRightTakerId: string | null;
  stadiumLevel: number;
  stadiumCapacity: number;
  stadiumName?: string | null;
  division?: number;
  stadiumTier?: number;
  stadiumStep?: number | null;
  stadiumUpgradeWeek?: number | null;
  /** Null unless an expansion is currently underway — see StadiumConstruction. */
  stadiumConstruction: StadiumConstruction | null;
  /** Leagues + cups this club has ever won — see ClubPrestigeInputs.titlesWon. */
  titlesWon: number;
  sponsorships: Sponsorship[];
  loans: Loan[];
  /** Installments this club still owes to others from a negotiated transfer (see transferProposal.ts). */
  pendingTransferPayments: TransferInstallmentPlan[];
  /** The manager's chosen lineup and tactic. Stands for every fixture, league or cup, until they change or
   *  cancel it — playing a match no longer clears it (see leagueService.resolveLeagueTactic). */
  pendingRoundTactic: Tactic | null;
  /** Active membership count (Sócio-Torcedor). */
  membersCount?: number;
  /** Visibility & prestige score (0-100). */
  visibilityScore?: number;
  /** Active specialized coaching staff and directors. */
  staff?: StaffMember[];
  /** History of staff recommendations, reads, and evaluations. */
  staffRecords?: StaffRecordEntry[];
  /** Where the club is from, for a club a manager founded. Absent for every imported club. */
  city?: string | null;
  /** Estado (UF) do clube, para mapeamento geográfico e estadual. */
  state?: string | null;
  /** Available institutional bank guarantees. */
  bankGuarantees?: BankGuarantee[];
  /** Pattern of the club's jersey kit (SOLID, STRIPES_VERTICAL, etc.). */
  kitPattern?: KitPattern;
  /** Primary hex color for uniform and theme (e.g. "#e11d48"). */
  primaryColor?: string | null;
  /** Secondary hex color for uniform stripes/accent (e.g. "#ffffff"). */
  secondaryColor?: string | null;
  awayKitPattern?: KitPattern | null;
  awayPrimaryColor?: string | null;
  awaySecondaryColor?: string | null;
  /** Base64 encoded custom crest image for created/founded clubs. */
  crestBase64?: string | null;
  /** Staff delegation configuration. */
  staffDelegationConfig?: StaffDelegationConfig;
  /** Historical trophies won by this club. */
  trophies?: TrophyRoomEntry[];
  /** Club all-time record book. */
  recordBook?: ClubRecordBook;
}

export const STARTING_BUDGET = 5_000_000;

/** Reserved owner id for premade clubs nobody has claimed yet. Not a real User row — ownerId has no FK. */
export const BOT_OWNER_ID = '__bot__';

export const CAPTAIN_BONUS_PER_WEEK = 0.004;
export const CAPTAIN_MAX_BONUS = 0.15;

/** Multiplier applied on top of a captain's effective attributes; grows with tenure, capped so it never dominates raw skill. */
export function captainBonus(weeksServed: number): number {
  return 1 + Math.min(CAPTAIN_MAX_BONUS, weeksServed * CAPTAIN_BONUS_PER_WEEK);
}

export { STARTING_STADIUM_CAPACITY, STARTING_STADIUM_LEVEL };

/** A single squad-wide designation — at most one player per role, but a player can hold several
 *  roles simultaneously (e.g. the captain can also be the penalty taker); see `Club`'s `*TakerId` fields. */
export type PlayerRole = 'CAPTAIN' | 'PENALTY_TAKER' | 'FREE_KICK_TAKER' | 'CORNER_LEFT_TAKER' | 'CORNER_RIGHT_TAKER';

export const PLAYER_ROLES: PlayerRole[] = ['CAPTAIN', 'FREE_KICK_TAKER', 'PENALTY_TAKER', 'CORNER_RIGHT_TAKER', 'CORNER_LEFT_TAKER'];

/** Which `Club` field backs each role — the single source of truth for both the API route and the service. */
export const PLAYER_ROLE_CLUB_FIELD: Record<PlayerRole, 'captainPlayerId' | 'penaltyTakerId' | 'freeKickTakerId' | 'cornerLeftTakerId' | 'cornerRightTakerId'> = {
  CAPTAIN: 'captainPlayerId',
  PENALTY_TAKER: 'penaltyTakerId',
  FREE_KICK_TAKER: 'freeKickTakerId',
  CORNER_LEFT_TAKER: 'cornerLeftTakerId',
  CORNER_RIGHT_TAKER: 'cornerRightTakerId',
};

/** Every role `playerId` currently holds on `club` — a player can hold any number of them at once. */
export function playerRoles(club: Club, playerId: string): PlayerRole[] {
  return PLAYER_ROLES.filter((role) => club[PLAYER_ROLE_CLUB_FIELD[role]] === playerId);
}

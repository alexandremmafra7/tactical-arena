import { Club } from './club.js';
import { Tactic } from './tactic.js';
import { MatchEvent } from './match.js';

export type OnlineTournamentType = '1V1_DUEL' | 'KNOCKOUT_4' | 'KNOCKOUT_8' | 'FANTASY_DRAFT';

export interface OnlineParticipant {
  peerId: string;
  name: string;
  club: Club;
  isHost: boolean;
  isReady: boolean;
  avatar: string;
}

export interface OnlineLobbyState {
  roomCode: string;
  tournamentType: OnlineTournamentType;
  participants: OnlineParticipant[];
  status: 'LOBBY' | 'DRAFTING' | 'IN_MATCH' | 'FINISHED';
  currentMatchId?: string;
}

export type P2PMessagePayload =
  | { type: 'JOIN_LOBBY'; participant: OnlineParticipant }
  | { type: 'LOBBY_STATE'; state: OnlineLobbyState }
  | { type: 'SUBMIT_TACTIC'; clubId: string; tactic: Tactic }
  | { type: 'MATCH_START'; matchId: string; homeClubId: string; awayClubId: string; seed: string }
  | { type: 'MATCH_TICK'; minute: number; homeGoals: number; awayGoals: number; events: MatchEvent[] }
  | { type: 'TACTICAL_SUB'; inPlayerId: string; outPlayerId: string }
  | { type: 'CHAT_REACTION'; sender: string; emoji: string; text?: string };

/**
 * Gera um código de sala amigável de 6 caracteres (ex: GOL-741, ARENA-88).
 */
export function generateRoomCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const suffix = Array.from({ length: 3 }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
  return `${prefix}-${suffix}`;
}

export function createOnlineLobby(
  hostPeerId: string,
  hostName: string,
  hostClub: Club,
  type: OnlineTournamentType
): OnlineLobbyState {
  const hostParticipant: OnlineParticipant = {
    peerId: hostPeerId,
    name: hostName,
    club: hostClub,
    isHost: true,
    isReady: true,
    avatar: '👑',
  };

  return {
    roomCode: generateRoomCode(),
    tournamentType: type,
    participants: [hostParticipant],
    status: 'LOBBY',
  };
}

export function addParticipantToLobby(state: OnlineLobbyState, participant: OnlineParticipant): OnlineLobbyState {
  if (state.participants.some((p) => p.peerId === participant.peerId)) {
    return state;
  }
  return {
    ...state,
    participants: [...state.participants, participant],
  };
}

export function removeParticipantFromLobby(state: OnlineLobbyState, peerId: string): OnlineLobbyState {
  return {
    ...state,
    participants: state.participants.filter((p) => p.peerId !== peerId),
  };
}

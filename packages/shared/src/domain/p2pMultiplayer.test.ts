import { describe, it, expect } from 'vitest';
import { generateRoomCode, createOnlineLobby, addParticipantToLobby, removeParticipantFromLobby } from './p2pMultiplayer.js';
import { makeClub } from '../simulation/testFactories.js';

describe('p2pMultiplayer domain logic', () => {
  const club = makeClub('c1', 'Flamengo', 78);

  it('generates room codes correctly', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]{3}-\d{3}$/);
  });

  it('creates and manages online lobby participants', () => {
    let lobby = createOnlineLobby('peer-host', 'Nilton', club, '1V1_DUEL');
    expect(lobby.roomCode).toBeTruthy();
    expect(lobby.participants).toHaveLength(1);
    expect(lobby.participants[0].isHost).toBe(true);

    const guestClub = makeClub('c2', 'Palmeiras', 77);
    lobby = addParticipantToLobby(lobby, {
      peerId: 'peer-guest',
      name: 'Carlos',
      club: guestClub,
      isHost: false,
      isReady: true,
      avatar: '⚽',
    });
    expect(lobby.participants).toHaveLength(2);

    lobby = removeParticipantFromLobby(lobby, 'peer-guest');
    expect(lobby.participants).toHaveLength(1);
  });
});

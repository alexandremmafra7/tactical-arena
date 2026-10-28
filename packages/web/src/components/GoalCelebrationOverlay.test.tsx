import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GoalCelebrationOverlay } from './GoalCelebrationOverlay.js';
import type { Club, MatchEvent } from '@tactical-arena/shared';

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<any>('react-dom');
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

const mockClub: Club = {
  id: 'club-1',
  name: 'Flamengo',
  ownerId: 'bot',
  slug: 'flamengo',
  country: 'BRA',
  players: [],
  academyPlayers: [],
  budget: 1000000,
  captainPlayerId: null,
  captainWeeksServed: 0,
  tutorPlayerId: null,
  penaltyTakerId: null,
  freeKickTakerId: null,
  cornerLeftTakerId: null,
  cornerRightTakerId: null,
  stadiumLevel: 1,
  stadiumCapacity: 70000,
  stadiumConstruction: null,
  titlesWon: 0,
  sponsorships: [],
  loans: [],
  pendingTransferPayments: [],
  pendingRoundTactic: null,
  primaryColor: '#c00',
  secondaryColor: '#000',
  kitPattern: 'SOLID',
  staff: [],
  staffRecords: [],
};

const mockEvent: MatchEvent = {
  type: 'goal',
  minute: 34,
  period: '1T',
  team: 'home',
  description: 'Gabigol finaliza com precisão no canto esquerdo!',
  playerId: 'p1',
  xg: 0.65,
};

describe('GoalCelebrationOverlay', () => {
  it('renders correctly for team goal with shout and club details', () => {
    const html = renderToStaticMarkup(
      <GoalCelebrationOverlay
        event={mockEvent}
        club={mockClub}
        scoreline="1 - 0"
        onDismiss={() => {}}
      />
    );
    expect(html).toContain('Flamengo');
    expect(html).toContain('Gabigol');
  });
});

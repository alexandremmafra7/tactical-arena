import { describe, expect, it } from 'vitest';
import { getStaffDelegationPreset, type Club, type Player } from '@tactical-arena/shared';
import { computeSeasonTurn } from './seasonTurnService.js';

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    position: 'MID',
    preferredFoot: 'RIGHT',
    age: 18,
    attributes: { pace: 60, finishing: 60, passing: 60, defending: 60, physical: 60, goalkeeping: 10 },
    detailedAttributes: {} as Player['detailedAttributes'],
    morale: 50,
    fatigue: 0,
    commitment: 50,
    marketValue: 100_000,
    overall: 60,
    potential: 60,
    starLevel: 'NONE',
    traits: [],
    functions: [],
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    nationality: 'BRA',
    wage: 1_000,
    releaseClause: 200_000,
    contractUntil: 2030,
    ...overrides,
  };
}

function clubWithAcademy(mode: 'brasfoot_casual' | 'football_manager_hardcore'): Club {
  return {
    id: 'academy-turn',
    name: 'Academy Turn',
    ownerId: 'owner',
    slug: null,
    pendingRoundTactic: null,
    country: 'BRA',
    players: Array.from({ length: 16 }, (_, index) => player(`senior-${index}`, { age: 25 })),
    academyPlayers: [],
    budget: 1_000_000,
    captainPlayerId: null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: 1,
    stadiumCapacity: 5_000,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
    staffDelegationConfig: getStaffDelegationPreset(mode),
  };
}

describe('computeSeasonTurn youth promotions', () => {
  it('promotes a ready jewel in automatic mode before they turn 20', () => {
    const prospect = player('ready', { age: 17, overall: 70, potential: 90 });
    const club = { ...clubWithAcademy('brasfoot_casual'), academyPlayers: [prospect] };

    const result = computeSeasonTurn(club, () => 0.5, 0, { seasonYear: 2027 });

    expect(result.players.some((candidate) => candidate.id === prospect.id)).toBe(true);
    expect(result.academyPlayers.some((candidate) => candidate.id === prospect.id)).toBe(false);
  });

  it('does not exceed 35 first-team players in automatic mode', () => {
    const prospects = [
      player('best', { age: 17, overall: 75, potential: 90 }),
      player('second', { age: 17, overall: 72, potential: 86 }),
    ];
    const club = {
      ...clubWithAcademy('brasfoot_casual'),
      players: Array.from({ length: 34 }, (_, index) => player(`senior-${index}`, { age: 25 })),
      academyPlayers: prospects,
    };

    const result = computeSeasonTurn(club, () => 0.5, 0, { seasonYear: 2027 });

    expect(result.players).toHaveLength(35);
    expect(result.players.some((candidate) => candidate.id === 'best')).toBe(true);
    expect(result.academyPlayers.some((candidate) => candidate.id === 'second')).toBe(true);
  });

  it('retains an eligible prospect in manual FM mode', () => {
    const prospect = player('manual', { age: 19, overall: 75, potential: 90 });
    const club = { ...clubWithAcademy('football_manager_hardcore'), academyPlayers: [prospect] };

    const result = computeSeasonTurn(club, () => 0.5, 0, { seasonYear: 2027 });

    expect(result.players.some((candidate) => candidate.id === prospect.id)).toBe(false);
    expect(result.academyPlayers.some((candidate) => candidate.id === prospect.id)).toBe(true);
  });
});

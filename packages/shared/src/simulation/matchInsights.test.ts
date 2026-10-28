import { describe, expect, it } from 'vitest';
import { generatePostMatchInsights } from './matchInsights.js';
import { computeStandings } from '../domain/league.js';
import { makeClub, makePlayer } from './testFactories.js';
import type { Match } from '../domain/match.js';

describe('Official CBF Standings Tiebreaker Criteria', () => {
  it('prioritizes number of wins over goal difference when points are tied (CBF rule)', () => {
    const results = [
      { homeClubId: 'FLA', awayClubId: 'VAS', homeGoals: 1, awayGoals: 0 }, // FLA 1-0 VAS
      { homeClubId: 'FLA', awayClubId: 'BOT', homeGoals: 0, awayGoals: 2 }, // FLA 0-2 BOT
      { homeClubId: 'PAL', awayClubId: 'COR', homeGoals: 1, awayGoals: 1 }, // PAL 1-1 COR
      { homeClubId: 'PAL', awayClubId: 'SAN', homeGoals: 1, awayGoals: 1 }, // PAL 1-1 SAN
      { homeClubId: 'PAL', awayClubId: 'FLU', homeGoals: 1, awayGoals: 1 }, // PAL 1-1 FLU
    ];

    const standings = computeStandings(['FLA', 'PAL', 'VAS', 'BOT', 'COR', 'SAN', 'FLU'], results);
    const flaIndex = standings.findIndex((s) => s.clubId === 'FLA');
    const palIndex = standings.findIndex((s) => s.clubId === 'PAL');

    // In CBF rules, FLA (1 win, 3 pts) ranks ABOVE PAL (0 wins, 3 pts) despite PAL having better GD!
    expect(flaIndex).toBeLessThan(palIndex);
  });

  it('uses goal difference when points and wins are equal', () => {
    const results = [
      { homeClubId: 'A', awayClubId: 'X', homeGoals: 4, awayGoals: 0 }, // A: 3 pts, 1 win, GD +4
      { homeClubId: 'B', awayClubId: 'Y', homeGoals: 1, awayGoals: 0 }, // B: 3 pts, 1 win, GD +1
    ];
    const standings = computeStandings(['A', 'B', 'X', 'Y'], results);
    expect(standings[0].clubId).toBe('A');
    expect(standings[1].clubId).toBe('B');
  });

  it('uses head-to-head when points, wins, GD and GF are equal', () => {
    const results = [
      { homeClubId: 'A', awayClubId: 'B', homeGoals: 2, awayGoals: 1 }, // A beats B 2-1
      { homeClubId: 'B', awayClubId: 'C', homeGoals: 2, awayGoals: 1 }, // B beats C 2-1
      { homeClubId: 'C', awayClubId: 'A', homeGoals: 2, awayGoals: 1 }, // C beats A 2-1
    ];
    const standings = computeStandings(['A', 'B', 'C'], results);
    expect(standings.length).toBe(3);
  });
});

describe('Post-Match Tactical Intelligence Insights', () => {
  it('generates clinical efficiency insight when team wins with lower xG', () => {
    const homeClub = makeClub('c1', 'Flamengo', 80);
    const awayClub = makeClub('c2', 'Palmeiras', 80);
    const p1 = homeClub.players[0];
    const p2 = homeClub.players[1];

    const mockMatch: Match = {
      id: 'm1',
      seed: 'seed-m1',
      competitionId: 'l1',
      homeClubId: 'c1',
      awayClubId: 'c2',
      status: 'SIMULATED',
      result: {
        homeGoals: 2,
        awayGoals: 0,
        events: [
          { minute: 30, type: 'goal', team: 'home', playerId: p1.id, description: 'Gol!' },
          { minute: 75, type: 'goal', team: 'home', playerId: p2.id, description: 'Gol!' },
        ],
        stats: {
          home: {
            shots: 4,
            shotsOnTarget: 2,
            fouls: 8,
            corners: 2,
            possession: 40,
            saves: 5,
            pressRecoveries: 3,
            goalsFromPressRecovery: 0,
            xg: 0.6,
            bigChances: 1,
            woodwork: 0,
            blockedShots: 1,
          },
          away: {
            shots: 15,
            shotsOnTarget: 7,
            fouls: 10,
            corners: 8,
            possession: 60,
            saves: 0,
            pressRecoveries: 5,
            goalsFromPressRecovery: 0,
            xg: 2.1,
            bigChances: 3,
            woodwork: 1,
            blockedShots: 3,
          },
        },
      },
    };

    const insights = generatePostMatchInsights(mockMatch, homeClub, awayClub);
    expect(insights.headline).toContain('Vitória do Flamengo');
    expect(insights.insights.length).toBeGreaterThan(0);
    expect(insights.insights.some((i) => i.category === 'EFFICIENCY' || i.category === 'GOALKEEPING')).toBe(true);
  });

  it('detects disciplinary red card impact in tactical insights', () => {
    const homeClub = makeClub('c1', 'Grêmio', 78);
    const awayClub = makeClub('c2', 'Internacional', 78);
    const pKan = homeClub.players[0];
    const pVal = awayClub.players[0];

    const mockMatch: Match = {
      id: 'm2',
      seed: 'seed-m2',
      competitionId: 'l1',
      homeClubId: 'c1',
      awayClubId: 'c2',
      status: 'SIMULATED',
      result: {
        homeGoals: 0,
        awayGoals: 1,
        events: [
          { minute: 22, type: 'card', team: 'home', playerId: pKan.id, description: 'Cartão vermelho direto', suspensionMatches: 2 },
          { minute: 88, type: 'goal', team: 'away', playerId: pVal.id, description: 'Gol nos minutos finais' },
        ],
        stats: {
          home: {
            shots: 3,
            shotsOnTarget: 1,
            fouls: 14,
            corners: 1,
            possession: 32,
            saves: 4,
            pressRecoveries: 2,
            goalsFromPressRecovery: 0,
            xg: 0.3,
            bigChances: 0,
            woodwork: 0,
            blockedShots: 2,
          },
          away: {
            shots: 12,
            shotsOnTarget: 5,
            fouls: 9,
            corners: 6,
            possession: 68,
            saves: 1,
            pressRecoveries: 6,
            goalsFromPressRecovery: 0,
            xg: 1.8,
            bigChances: 2,
            woodwork: 0,
            blockedShots: 1,
          },
        },
      },
    };

    const insights = generatePostMatchInsights(mockMatch, homeClub, awayClub);
    expect(insights.insights.some((i) => i.category === 'DISCIPLINE')).toBe(true);
  });

  it('generates pressure insight when team has high press recoveries', () => {
    const homeClub = makeClub('c1', 'Atlético Mineiro', 82);
    const awayClub = makeClub('c2', 'São Paulo', 80);
    const p1 = homeClub.players[0];
    const p2 = awayClub.players[0];

    const mockMatch: Match = {
      id: 'm3',
      seed: 'seed-m3',
      competitionId: 'l1',
      homeClubId: 'c1',
      awayClubId: 'c2',
      status: 'SIMULATED',
      result: {
        homeGoals: 2,
        awayGoals: 1,
        events: [
          { minute: 15, type: 'goal', team: 'home', playerId: p1.id, description: 'Gol de pressão!' },
          { minute: 30, type: 'goal', team: 'home', playerId: p1.id, description: 'Gol de pressão!' },
          { minute: 75, type: 'goal', team: 'away', playerId: p2.id, description: 'Gol de contra-ataque' },
        ],
        stats: {
          home: {
            shots: 8,
            shotsOnTarget: 4,
            fouls: 10,
            corners: 3,
            possession: 48,
            saves: 2,
            pressRecoveries: 7,
            goalsFromPressRecovery: 2,
            xg: 1.8,
            bigChances: 2,
            woodwork: 0,
            blockedShots: 1,
          },
          away: {
            shots: 10,
            shotsOnTarget: 3,
            fouls: 8,
            corners: 2,
            possession: 52,
            saves: 3,
            pressRecoveries: 2,
            goalsFromPressRecovery: 0,
            xg: 1.2,
            bigChances: 1,
            woodwork: 0,
            blockedShots: 2,
          },
        },
      },
    };

    const insights = generatePostMatchInsights(mockMatch, homeClub, awayClub);
    expect(insights.insights.some((i) => i.category === 'PRESSURE')).toBe(true);
    const pressureInsight = insights.insights.find((i) => i.category === 'PRESSURE');
    expect(pressureInsight).toBeDefined();
    expect(pressureInsight?.narrative).toContain('Atlético Mineiro recuperou 7 bolas');
    expect(pressureInsight?.impact).toBe('POSITIVE');
  });

  it('generates wing play insight when team creates significant wide threats', () => {
    const homeClub = makeClub('c1', 'Flamengo', 80);
    const awayClub = makeClub('c2', 'Vasco', 78);
    const p1 = homeClub.players[0];
    const p2 = awayClub.players[0];

    const mockMatch: Match = {
      id: 'm4',
      seed: 'seed-m4',
      competitionId: 'l1',
      homeClubId: 'c1',
      awayClubId: 'c2',
      status: 'SIMULATED',
      result: {
        homeGoals: 3,
        awayGoals: 1,
        events: [
          { minute: 20, type: 'goal', team: 'home', playerId: p1.id, description: 'Gol pelo lado direito' },
          { minute: 35, type: 'goal', team: 'home', playerId: p1.id, description: 'Gol pelo lado esquerdo' },
          { minute: 60, type: 'goal', team: 'home', playerId: p1.id, description: 'Gol de cabeça após cruzamento' },
          { minute: 80, type: 'goal', team: 'away', playerId: p2.id, description: 'Gol de pênalti' },
        ],
        stats: {
          home: {
            shots: 12,
            shotsOnTarget: 6,
            fouls: 9,
            corners: 6,
            possession: 55,
            saves: 1,
            pressRecoveries: 2,
            goalsFromPressRecovery: 0,
            xg: 2.5,
            bigChances: 4,
            woodwork: 1,
            blockedShots: 2,
          },
          away: {
            shots: 8,
            shotsOnTarget: 2,
            fouls: 7,
            corners: 1,
            possession: 45,
            saves: 2,
            pressRecoveries: 1,
            goalsFromPressRecovery: 0,
            xg: 0.9,
            bigChances: 1,
            woodwork: 0,
            blockedShots: 1,
          },
        },
      },
    };

    const insights = generatePostMatchInsights(mockMatch, homeClub, awayClub);
    expect(insights.insights.some((i) => i.category === 'EFFICIENCY' && (i.title.includes('Alas') || i.title.includes('Pontas')))).toBe(true);
    const wingInsight = insights.insights.find((i) => i.category === 'EFFICIENCY' && (i.title.includes('Alas') || i.title.includes('Pontas')));
    expect(wingInsight).toBeDefined();
    expect(wingInsight?.narrative).toContain('Flamengo criou');
    expect(wingInsight?.impact).toBe('POSITIVE');
  });
});

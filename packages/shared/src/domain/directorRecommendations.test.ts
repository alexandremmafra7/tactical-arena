import { describe, expect, it } from 'vitest';
import { makeClub, makePlayer } from '../simulation/testFactories.js';
import {
  analyzeSquadDepth,
  computeDirectorTransferRecommendations,
} from './directorRecommendations.js';

describe('analyzeSquadDepth', () => {
  it('identifies critical shortage when club has fewer than 2 goalkeepers', () => {
    const club = {
      ...makeClub('club_1', 'União FC', 75),
      players: [
        makePlayer('gk1', { position: 'GK', overall: 72 }),
        makePlayer('d1', { position: 'DEF', overall: 75 }),
        makePlayer('d2', { position: 'DEF', overall: 74 }),
        makePlayer('d3', { position: 'DEF', overall: 73 }),
        makePlayer('d4', { position: 'DEF', overall: 71 }),
        makePlayer('l1', { position: 'LAT', overall: 72 }),
        makePlayer('l2', { position: 'LAT', overall: 70 }),
        makePlayer('m1', { position: 'MID', overall: 76 }),
        makePlayer('m2', { position: 'MID', overall: 75 }),
        makePlayer('m3', { position: 'MID', overall: 74 }),
        makePlayer('m4', { position: 'MID', overall: 73 }),
        makePlayer('m5', { position: 'MID', overall: 72 }),
        makePlayer('a1', { position: 'ATT', overall: 78 }),
        makePlayer('a2', { position: 'ATT', overall: 76 }),
        makePlayer('a3', { position: 'ATT', overall: 74 }),
        makePlayer('a4', { position: 'ATT', overall: 72 }),
      ],
    };

    const analysis = analyzeSquadDepth(club);
    expect(analysis.counts.GK).toBe(1);
    const gkShortage = analysis.shortages.find((s) => s.position === 'GK');
    expect(gkShortage).toBeDefined();
    expect(gkShortage?.urgency).toBe('HIGH');
  });

  it('detects starter quality gaps against division benchmark', () => {
    const club = {
      ...makeClub('club_1', 'União FC', 75),
      players: [
        makePlayer('gk1', { position: 'GK', overall: 65 }),
        makePlayer('gk2', { position: 'GK', overall: 62 }),
        makePlayer('d1', { position: 'DEF', overall: 80 }),
        makePlayer('d2', { position: 'DEF', overall: 79 }),
        makePlayer('d3', { position: 'DEF', overall: 78 }),
        makePlayer('d4', { position: 'DEF', overall: 77 }),
        makePlayer('l1', { position: 'LAT', overall: 76 }),
        makePlayer('l2', { position: 'LAT', overall: 75 }),
        makePlayer('m1', { position: 'MID', overall: 80 }),
        makePlayer('m2', { position: 'MID', overall: 78 }),
        makePlayer('m3', { position: 'MID', overall: 77 }),
        makePlayer('m4', { position: 'MID', overall: 76 }),
        makePlayer('m5', { position: 'MID', overall: 75 }),
        makePlayer('a1', { position: 'ATT', overall: 82 }),
        makePlayer('a2', { position: 'ATT', overall: 80 }),
        makePlayer('a3', { position: 'ATT', overall: 78 }),
        makePlayer('a4', { position: 'ATT', overall: 77 }),
      ],
    };

    const analysis = analyzeSquadDepth(club, 78); // Division benchmark is 78
    const gkGap = analysis.qualityGaps.find((g) => g.position === 'GK');
    expect(gkGap).toBeDefined();
    expect(gkGap?.starterOverall).toBe(65);
    expect(gkGap?.benchmarkOverall).toBe(78);
  });
});

describe('computeDirectorTransferRecommendations', () => {
  it('returns empty array when no available players or empty squad', () => {
    const club = makeClub('club_1', 'União FC', 75);
    expect(computeDirectorTransferRecommendations(club, [])).toEqual([]);
  });

  it('prioritizes urgent goalkeeper shortage with high urgency and clear rationale', () => {
    const club = {
      ...makeClub('club_1', 'União FC', 75),
      players: [
        makePlayer('gk1', { name: 'Goleiro Único', position: 'GK', overall: 68 }),
        makePlayer('d1', { position: 'DEF', overall: 75 }),
        makePlayer('d2', { position: 'DEF', overall: 74 }),
        makePlayer('d3', { position: 'DEF', overall: 73 }),
        makePlayer('d4', { position: 'DEF', overall: 72 }),
        makePlayer('l1', { position: 'LAT', overall: 74 }),
        makePlayer('l2', { position: 'LAT', overall: 73 }),
        makePlayer('m1', { position: 'MID', overall: 75 }),
        makePlayer('m2', { position: 'MID', overall: 75 }),
        makePlayer('m3', { position: 'MID', overall: 74 }),
        makePlayer('m4', { position: 'MID', overall: 73 }),
        makePlayer('m5', { position: 'MID', overall: 72 }),
        makePlayer('a1', { position: 'ATT', overall: 76 }),
        makePlayer('a2', { position: 'ATT', overall: 75 }),
        makePlayer('a3', { position: 'ATT', overall: 74 }),
        makePlayer('a4', { position: 'ATT', overall: 72 }),
      ],
    };

    const marketPlayers = [
      {
        clubId: 'seller_1',
        clubName: 'Rival FC',
        player: makePlayer('target_gk', { name: 'Goleiro Titular', position: 'GK', overall: 77, marketValue: 2_500_000 }),
      },
      {
        clubId: 'seller_2',
        clubName: 'Inter FC',
        player: makePlayer('target_att', { name: 'Atacante Reserva', position: 'ATT', overall: 73, marketValue: 1_800_000 }),
      },
      {
        clubId: 'seller_3',
        clubName: 'Grêmio FC',
        player: makePlayer('target_mid', { name: 'Meia Promissor', position: 'MID', overall: 74, marketValue: 2_000_000 }),
      },
    ];

    const recommendations = computeDirectorTransferRecommendations(club, marketPlayers);
    expect(recommendations.length).toBeGreaterThanOrEqual(1);

    const gkRec = recommendations.find((r) => r.targetPosition === 'GK');
    expect(gkRec).toBeDefined();
    expect(gkRec?.urgency).toBe('HIGH');
    expect(gkRec?.isStarterUpgrade).toBe(true);
    expect(gkRec?.rationale).toContain('Goleiro');
    expect(gkRec?.comparisonWithStarter?.overallDifference).toBe(9); // 77 - 68
  });

  it('applies football director discount to suggested purchase price', () => {
    const club = {
      ...makeClub('club_1', 'União FC', 75),
      staff: [
        {
          id: 'dir_1',
          name: 'Alexandre Mattos',
          role: 'FOOTBALL_DIRECTOR' as const,
          rating: 85,
          tier: 'DIAMANTE' as const,
          nationality: 'BRA',
          wage: 40_000,
          specialty: 'Negociações Agressivas',
          description: 'Especialista em contratações de impacto.',
          minClubVisibility: 50,
          minCareerTitles: 0,
          avatar: '👔',
        },
      ],
      players: [
        makePlayer('gk1', { position: 'GK', overall: 75 }),
        makePlayer('gk2', { position: 'GK', overall: 72 }),
      ],
    };

    const candidate = {
      clubId: 'seller_1',
      clubName: 'Santos FC',
      player: makePlayer('cand_1', { name: 'Lateral Craque', position: 'LAT', overall: 82, marketValue: 10_000_000 }),
    };

    const recommendations = computeDirectorTransferRecommendations(club, [candidate]);
    expect(recommendations.length).toBe(1);
    // With a diamante director (85 OVR), discount is applied, making suggested price < marketValue
    expect(recommendations[0].suggestedOfferPrice).toBeLessThan(10_000_000);
  });

  it('recommends young promises and star players with high fit scores', () => {
    const club = {
      ...makeClub('club_1', 'União FC', 75),
      budget: 20_000_000,
      players: [
        makePlayer('gk1', { position: 'GK', overall: 75 }),
        makePlayer('gk2', { position: 'GK', overall: 74 }),
      ],
    };

    const candidates = [
      {
        clubId: 'seller_1',
        clubName: 'Flamengo',
        player: makePlayer('cand_promise', {
          name: 'Jovem Joia',
          position: 'ATT',
          age: 19,
          overall: 76,
          potential: 88,
          marketValue: 5_000_000,
        }),
      },
      {
        clubId: 'seller_2',
        clubName: 'Palmeiras',
        player: makePlayer('cand_genio', {
          name: 'Craque Extraclasse',
          position: 'MID',
          age: 26,
          overall: 88,
          potential: 89,
          diferenciado: true,
          starLevel: 'NATURAL',
          marketValue: 15_000_000,
        }),
      },
    ];

    const recommendations = computeDirectorTransferRecommendations(club, candidates);
    expect(recommendations.length).toBe(2);
    expect(recommendations.some((r) => r.player.name === 'Jovem Joia')).toBe(true);
    expect(recommendations.some((r) => r.player.name === 'Craque Extraclasse')).toBe(true);
  });

  it('filters out players that are already in the club squad', () => {
    const ownPlayer = makePlayer('own_p1', { name: 'Meu Jogador', position: 'MID', overall: 75 });
    const club = {
      ...makeClub('club_1', 'União FC', 75),
      players: [ownPlayer],
    };

    const candidates = [
      {
        clubId: 'other_club',
        clubName: 'Outro Time',
        player: ownPlayer,
      },
    ];

    const recommendations = computeDirectorTransferRecommendations(club, candidates);
    expect(recommendations.length).toBe(0);
  });
});

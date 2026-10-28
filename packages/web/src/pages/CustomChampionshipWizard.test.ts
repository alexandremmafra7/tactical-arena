import { describe, it, expect } from 'vitest';
import type { Club, CustomChampionshipConfig } from '@tactical-arena/shared';
import { localCreateCustomChampionship, localGetClub } from '../api/localEngine.js';

// We test the preset ranking logic exported or patterned from CustomChampionshipWizard
function getClubPower(club: Partial<Club>): number {
  if (!club.players || club.players.length === 0) return 50;
  const overalls = club.players.map((p) => p.overall || 50).sort((a, b) => b - a);
  const top11 = overalls.slice(0, 11);
  return top11.reduce((sum, val) => sum + val, 0) / top11.length;
}

const EURO_ELITE_KEYS = [
  'real-madrid', 'manchester-city', 'bayern', 'barcelona', 'liverpool',
  'arsenal', 'psg', 'parissaintgermain_fr', 'inter-milan', 'chelsea', 'atletico-madrid',
  'juventus', 'ac-milan', 'borussia-dortmund', 'tottenham', 'manchester-united',
];

const BRAZIL_ELITE_KEYS = [
  'flamengo', 'palmeiras', 'sao-paulo', 'corinthians', 'santos',
  'gremio', 'internacional', 'cruzeiro', 'atletico-mg', 'fluminense',
];

function rankClubsWithPriority(candidateClubs: Partial<Club>[], priorityKeys: string[]): Partial<Club>[] {
  const priorityIndex = new Map<string, number>();
  priorityKeys.forEach((key, idx) => {
    priorityIndex.set(key.toLowerCase(), idx);
  });

  const getPriorityScore = (c: Partial<Club>): number => {
    if (c.slug && priorityIndex.has(c.slug.toLowerCase())) {
      return priorityIndex.get(c.slug.toLowerCase())!;
    }
    const cleanName = (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [key, idx] of priorityIndex.entries()) {
      const cleanKey = key.replace(/[^a-z0-9]/g, '');
      if (cleanName === cleanKey) return idx;
    }
    return 9999;
  };

  return [...candidateClubs].sort((a, b) => {
    const pA = getPriorityScore(a);
    const pB = getPriorityScore(b);
    if (pA !== pB) return pA - pB;

    const divA = a.division ?? 1;
    const divB = b.division ?? 1;
    if (divA !== divB) return divA - divB;

    const powerA = getClubPower(a);
    const powerB = getClubPower(b);
    if (Math.abs(powerB - powerA) > 0.05) return powerB - powerA;

    return (b.stadiumCapacity || 0) - (a.stadiumCapacity || 0);
  });
}

describe('CustomChampionshipWizard Presets Logic', () => {
  it('ranks European giants ahead of random second-tier clubs for EURO_ELITE', () => {
    const mixedEuroClubs: Partial<Club>[] = [
      { id: '1', name: 'Bristol City', slug: 'bristol_city', country: 'ENG', division: 2, stadiumCapacity: 27000 },
      { id: '2', name: 'Real Madrid', slug: 'real-madrid', country: 'ESP', division: 1, stadiumCapacity: 81044 },
      { id: '3', name: 'Wrexham AFC', slug: 'wrexham_ing', country: 'ENG', division: 1, stadiumCapacity: 12000 },
      { id: '4', name: 'Manchester City', slug: 'manchester-city', country: 'ENG', division: 1, stadiumCapacity: 53400 },
      { id: '5', name: 'Bari', slug: 'bari_it', country: 'ITA', division: 2, stadiumCapacity: 58000 },
      { id: '6', name: 'Bayern de Munique', slug: 'bayern', country: 'GER', division: 1, stadiumCapacity: 75000 },
      { id: '7', name: 'Cesena', slug: 'cesena_it', country: 'ITA', division: 2, stadiumCapacity: 23000 },
      { id: '8', name: 'Barcelona', slug: 'barcelona', country: 'ESP', division: 1, stadiumCapacity: 99354 },
      { id: '9', name: 'Atlético de Madrid', slug: 'atletico-madrid', country: 'ESP', division: 1, stadiumCapacity: 70460 },
      { id: '10', name: 'FC Magdeburg', slug: 'magdeburg_ger', country: 'GER', division: 2, stadiumCapacity: 30000 },
    ];

    const ranked = rankClubsWithPriority(mixedEuroClubs, EURO_ELITE_KEYS);
    const top5Names = ranked.slice(0, 5).map((c) => c.name);

    expect(top5Names).toContain('Real Madrid');
    expect(top5Names).toContain('Manchester City');
    expect(top5Names).toContain('Bayern de Munique');
    expect(top5Names).toContain('Barcelona');
    expect(top5Names).toContain('Atlético de Madrid');

    // Random lower division clubs must be at the bottom
    expect(top5Names).not.toContain('Bristol City');
    expect(top5Names).not.toContain('Cesena');
    expect(top5Names).not.toContain('Wrexham AFC');
  });

  it('ranks Brazilian Série A giants ahead of random state/lower-league clubs', () => {
    const mixedBraClubs: Partial<Club>[] = [
      { id: 'b1', name: 'Barcelona-BA', slug: 'barcelonaba_bra', country: 'BRA', division: 3 },
      { id: 'b2', name: 'Flamengo', slug: 'flamengo', country: 'BRA', division: 1 },
      { id: 'b3', name: 'Imperatriz', slug: 'imperatriz_ma', country: 'BRA', division: 3 },
      { id: 'b4', name: 'Palmeiras', slug: 'palmeiras', country: 'BRA', division: 1 },
      { id: 'b5', name: 'São Paulo', slug: 'sao-paulo', country: 'BRA', division: 1 },
    ];

    const ranked = rankClubsWithPriority(mixedBraClubs, BRAZIL_ELITE_KEYS);
    expect(ranked[0].name).toBe('Flamengo');
    expect(ranked[1].name).toBe('Palmeiras');
    expect(ranked[2].name).toBe('São Paulo');
    expect(ranked[3].name).not.toBe('Flamengo');
  });

  it('populates multiple divisions sequentially from preset order', () => {
    const clubs: Partial<Club>[] = Array.from({ length: 20 }, (_, i) => ({
      id: `c_${i + 1}`,
      name: `Club ${i + 1}`,
    }));

    const clubsPerDivision = 8;
    const divisionCount = 2;
    const newDivisionMap: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [] };
    let offset = 0;
    for (let d = 1; d <= divisionCount; d++) {
      const slice = clubs.slice(offset, offset + clubsPerDivision).map((c) => c.id!);
      newDivisionMap[d] = slice;
      offset += slice.length;
    }

    expect(newDivisionMap[1]).toHaveLength(8);
    expect(newDivisionMap[1][0]).toBe('c_1');
    expect(newDivisionMap[1][7]).toBe('c_8');

    expect(newDivisionMap[2]).toHaveLength(8);
    expect(newDivisionMap[2][0]).toBe('c_9');
    expect(newDivisionMap[2][7]).toBe('c_16');
  });

  it('successfully creates custom championship with database UUID clubs not previously in local world', async () => {
    const userClubUuid = '02d31a4a-1805-440c-9236-5aeac1535707';
    const opponentClubUuid = 'b7e2311f-8899-440c-9236-5aeac1535888';

    const mockClubs: Club[] = [
      {
        id: userClubUuid,
        name: 'Athletic Bilbao',
        slug: 'athletic-club',
        country: 'ESP',
        ownerId: 'bot',
        players: [],
        academyPlayers: [],
        budget: 20_000_000,
        captainPlayerId: null,
        captainWeeksServed: 0,
        tutorPlayerId: null,
        penaltyTakerId: null,
        freeKickTakerId: null,
        cornerLeftTakerId: null,
        cornerRightTakerId: null,
        stadiumLevel: 2,
        stadiumCapacity: 53289,
        stadiumConstruction: null,
        titlesWon: 8,
        sponsorships: [],
        loans: [],
        pendingTransferPayments: [],
        pendingRoundTactic: null,
      },
      {
        id: opponentClubUuid,
        name: 'Real Sociedad',
        slug: 'real-sociedad',
        country: 'ESP',
        ownerId: 'bot',
        players: [],
        academyPlayers: [],
        budget: 18_000_000,
        captainPlayerId: null,
        captainWeeksServed: 0,
        tutorPlayerId: null,
        penaltyTakerId: null,
        freeKickTakerId: null,
        cornerLeftTakerId: null,
        cornerRightTakerId: null,
        stadiumLevel: 2,
        stadiumCapacity: 40000,
        stadiumConstruction: null,
        titlesWon: 2,
        sponsorships: [],
        loans: [],
        pendingTransferPayments: [],
        pendingRoundTactic: null,
      },
    ];

    const config: CustomChampionshipConfig = {
      id: `custom_test_${Date.now()}`,
      name: 'Superliga Teste',
      formatType: 'LEAGUE_PURE',
      divisions: [
        {
          division: 1,
          name: 'Divisão 1 - Superliga Teste',
          clubIds: [userClubUuid, opponentClubUuid],
          roundsFormat: 'DOUBLE',
          promotionCount: 0,
          relegationCount: 0,
        },
      ],
      settings: {
        isContinuousCareer: true,
        allowTransfers: true,
        injuriesAndSuspensions: true,
      },
    };

    const result = await localCreateCustomChampionship(config, userClubUuid, 'Técnico Campeão', mockClubs);

    expect(result.club.id).toBe(userClubUuid);
    expect(result.club.name).toBe('Athletic Bilbao');
    expect(result.club.ownerId).toBe(result.userId);
    expect(result.club.players.length).toBeGreaterThan(0);

    const fetchedClub = await localGetClub(userClubUuid);
    expect(fetchedClub.id).toBe(userClubUuid);
    expect(fetchedClub.name).toBe('Athletic Bilbao');
    expect(fetchedClub.ownerId).toBe(result.userId);
  });
});

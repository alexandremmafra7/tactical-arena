import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { createManagerToken } from './services/authService.js';
import { getGameState } from './services/gameStateService.js';
import { generateStarterSquad, getStaffDelegationPreset } from '@tactical-arena/shared';

const app = createApp();

describe('Contract Batch Renewal & Staff Delegation Flow', () => {
  const userId = 'user-contract-batch-test';
  const token = createManagerToken(userId);

  beforeEach(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'batchrenew@test.com',
        passwordHash: 'hash',
      },
    });
  });

  it('performs batch renewal for selected players and deducts cost atomically', async () => {
    const { seasonYear } = await getGameState();
    const starterPlayers = generateStarterSquad('batch-club-1', 'BRA');
    // Set 3 players to expiring in current season
    starterPlayers[0].contractUntil = seasonYear;
    starterPlayers[1].contractUntil = seasonYear;
    starterPlayers[2].contractUntil = seasonYear;

    const club = await prisma.club.create({
      data: {
        name: 'Batch Renewal FC',
        ownerId: userId,
        country: 'BRA',
        budget: 5_000_000,
        stadiumLevel: 1,
        stadiumCapacity: 10000,
        titlesWon: 0,
        playersJson: JSON.stringify(starterPlayers),
        academyPlayersJson: '[]',
        sponsorshipsJson: '[]',
        loansJson: '[]',
        pendingTransferPaymentsJson: '[]',
        staffJson: JSON.stringify([
          {
            id: 'dir-1',
            name: 'Alexandre Mattos',
            role: 'FOOTBALL_DIRECTOR',
            tier: 'OURO',
            rating: 85,
            specialty: 'Especialista em Negociações de Mercado',
            description: 'Diretor experiente',
            wage: 35000,
            minClubVisibility: 50,
            minCareerTitles: 1,
            avatar: '👔',
            nationality: 'BRA',
          },
        ]),
      },
    });

    // 1. Get contract overview
    const overviewRes = await request(app)
      .get(`/clubs/${club.id}/contracts`)
      .set('Authorization', `Bearer ${token}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.expiringAnalysis).toBeDefined();
    expect(overviewRes.body.expiringAnalysis.allExpiring.length).toBeGreaterThanOrEqual(3);

    // 2. Perform Batch Renewal
    const toRenew = [starterPlayers[0].id, starterPlayers[1].id];
    const batchRes = await request(app)
      .post(`/clubs/${club.id}/contracts/batch-renew`)
      .set('Authorization', `Bearer ${token}`)
      .send({ playerIds: toRenew, years: 2 });

    expect(batchRes.status).toBe(200);
    expect(batchRes.body.renewedCount).toBe(2);
    expect(batchRes.body.totalCost).toBeGreaterThan(0);
    expect(batchRes.body.club.budget).toBe(5_000_000 - batchRes.body.totalCost);

    // Verify updated contracts
    const p0 = batchRes.body.club.players.find((p: any) => p.id === starterPlayers[0].id);
    const p1 = batchRes.body.club.players.find((p: any) => p.id === starterPlayers[1].id);
    const p2 = batchRes.body.club.players.find((p: any) => p.id === starterPlayers[2].id);

    expect(p0.contractUntil).toBe(seasonYear + 2);
    expect(p1.contractUntil).toBe(seasonYear + 2);
    expect(p2.contractUntil).toBe(seasonYear);
  });

  it('supports per-player yearsMap in batch renewals', async () => {
    const { seasonYear } = await getGameState();
    const starterPlayers = generateStarterSquad('batch-club-2', 'BRA');
    starterPlayers[0].contractUntil = seasonYear;
    starterPlayers[1].contractUntil = seasonYear;

    const club = await prisma.club.create({
      data: {
        name: 'Custom Years FC',
        ownerId: userId,
        country: 'BRA',
        budget: 5_000_000,
        stadiumLevel: 1,
        stadiumCapacity: 10000,
        titlesWon: 0,
        playersJson: JSON.stringify(starterPlayers),
        academyPlayersJson: '[]',
        sponsorshipsJson: '[]',
        loansJson: '[]',
        pendingTransferPaymentsJson: '[]',
        staffJson: '[]',
      },
    });

    const batchRes = await request(app)
      .post(`/clubs/${club.id}/contracts/batch-renew`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        playerIds: [starterPlayers[0].id, starterPlayers[1].id],
        years: 2,
        yearsMap: {
          [starterPlayers[0].id]: 4,
          [starterPlayers[1].id]: 1,
        },
      });

    expect(batchRes.status).toBe(200);
    expect(batchRes.body.renewedCount).toBe(2);

    const p0 = batchRes.body.club.players.find((p: any) => p.id === starterPlayers[0].id);
    const p1 = batchRes.body.club.players.find((p: any) => p.id === starterPlayers[1].id);

    expect(p0.contractUntil).toBe(seasonYear + 4);
    expect(p1.contractUntil).toBe(seasonYear + 1);
  });

  it('automatically renews routine squad players and logs alert for key players during weekly tick', async () => {
    const { seasonYear } = await getGameState();
    const starterPlayers = generateStarterSquad('batch-club-3', 'BRA');

    // Make starterPlayers[0] a star player with contract expiring
    starterPlayers[0].overall = 89;
    starterPlayers[0].starLevel = 'NATURAL';
    starterPlayers[0].contractUntil = seasonYear;

    // Make starterPlayers[1] a regular squad player with contract expiring
    starterPlayers[1].overall = 75;
    starterPlayers[1].starLevel = 'NONE';
    starterPlayers[1].contractUntil = seasonYear;

    const club = await prisma.club.create({
      data: {
        name: 'Delegated Tick FC',
        ownerId: userId,
        country: 'BRA',
        budget: 5_000_000,
        stadiumLevel: 1,
        stadiumCapacity: 10000,
        titlesWon: 0,
        playersJson: JSON.stringify(starterPlayers),
        academyPlayersJson: '[]',
        sponsorshipsJson: '[]',
        loansJson: '[]',
        pendingTransferPaymentsJson: '[]',
        staffJson: JSON.stringify({
          staff: [
            {
              id: 'dir-1',
              name: 'Alexandre Mattos',
              role: 'FOOTBALL_DIRECTOR',
              tier: 'OURO',
              rating: 85,
              specialty: 'Especialista em Negociações de Mercado',
              description: 'Diretor experiente',
              wage: 35000,
              minClubVisibility: 50,
              minCareerTitles: 1,
              avatar: '👔',
              nationality: 'BRA',
            },
          ],
          delegationConfig: {
            ...getStaffDelegationPreset('brasfoot_casual'),
            contractRenewals: 'director_handles_routine',
          },
        }),
      },
    });

    const { processWeeklyTickForClub } = await import('./services/weeklyTickService.js');
    await processWeeklyTickForClub(club.id, '2026-03-02');

    const updated = await prisma.club.findUnique({ where: { id: club.id } });
    const players = JSON.parse(updated!.playersJson);

    const star = players.find((p: any) => p.id === starterPlayers[0].id);
    const routine = players.find((p: any) => p.id === starterPlayers[1].id);

    // Routine squad player was automatically renewed (+2 years)
    expect(routine.contractUntil).toBe(seasonYear + 2);
    // Star player remained untouched for manager intervention
    expect(star.contractUntil).toBe(seasonYear);

    // News item was logged for the club
    const news = await prisma.newsItem.findMany({ where: { clubId: club.id } });
    expect(news.some((n) => n.headline.includes('O Diretor de Futebol renovou o contrato'))).toBe(true);
    expect(news.some((n) => n.headline.includes('Alerta da Diretoria'))).toBe(true);
  });
});

import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { calculateMatchBroadcastPayout, calculateCombatPerformanceBonus } from '@tactical-arena/shared';

const app = createApp();

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.userId as string };
}

describe('Broadcast Finance & Target Flow', () => {
  beforeEach(async () => {
    await prisma.match.deleteMany();
    await prisma.league.deleteMany();
    await prisma.cup.deleteMany();
    await prisma.club.deleteMany();
    await prisma.user.deleteMany();
  });

  it('credits the broadcaster facility fee to home and away clubs on match completion', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();

    const clubARes = await request(app)
      .post('/clubs')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ name: 'Clube Transmissao Casa', country: 'BRA' });
    expect(clubARes.status).toBe(201);
    const clubA = clubARes.body;

    const clubBRes = await request(app)
      .post('/clubs')
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ name: 'Clube Transmissao Fora', country: 'BRA' });
    expect(clubBRes.status).toBe(201);
    const clubB = clubBRes.body;

    const initialBudgetA = clubA.budget;
    const initialBudgetB = clubB.budget;

    // Create match
    const matchRes = await request(app)
      .post('/matches')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ homeClubId: clubA.id, awayClubId: clubB.id });
    expect(matchRes.status).toBe(201);
    const match = matchRes.body;

    const tacticFor = (c: any) => ({
      clubId: c.id,
      formation: '4-4-2',
      mentality: 'balanced',
      attackStyle: 'THROUGH_MIDDLE',
      markingStyle: 'BALANCED',
      attackApproach: 'COUNTER_ATTACK',
      lineup: c.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
    });

    await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send(tacticFor(clubA));

    const afterB = await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send(tacticFor(clubB));
    expect(afterB.status).toBe(200);
    expect(afterB.body.status).toBe('LIVE');

    // Advance match to 90
    const finalRes = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 90 });
    expect(finalRes.status).toBe(200);
    expect(finalRes.body.status).toBe('SIMULATED');

    const broadcaster = finalRes.body.broadcaster;
    expect(broadcaster).toBeDefined();

    const expectedHomeFee = calculateMatchBroadcastPayout(broadcaster, true);
    const expectedAwayFee = calculateMatchBroadcastPayout(broadcaster, false);

    const matchResult = finalRes.body.result;
    const avgA = clubA.players.length > 0 ? clubA.players.reduce((s: number, p: any) => s + p.overall, 0) / clubA.players.length : 0;
    const avgB = clubB.players.length > 0 ? clubB.players.reduce((s: number, p: any) => s + p.overall, 0) / clubB.players.length : 0;

    const expectedCombatBonusA = calculateCombatPerformanceBonus({
      events: matchResult.events,
      mySide: 'home',
      myGoals: matchResult.homeGoals,
      opponentGoals: matchResult.awayGoals,
      pressRecoveries: matchResult.stats?.home?.pressRecoveries ?? 0,
      isUnderdog: avgA < avgB - 3,
    });
    const expectedCombatBonusB = calculateCombatPerformanceBonus({
      events: matchResult.events,
      mySide: 'away',
      myGoals: matchResult.awayGoals,
      opponentGoals: matchResult.homeGoals,
      pressRecoveries: matchResult.stats?.away?.pressRecoveries ?? 0,
      isUnderdog: avgB < avgA - 3,
    });

    const updatedClubA = await prisma.club.findUnique({ where: { id: clubA.id } });
    const updatedClubB = await prisma.club.findUnique({ where: { id: clubB.id } });

    expect(updatedClubA?.budget).toBe(initialBudgetA + expectedHomeFee + expectedCombatBonusA.totalBonus);
    expect(updatedClubB?.budget).toBe(initialBudgetB + expectedAwayFee + expectedCombatBonusB.totalBonus);
  });
});

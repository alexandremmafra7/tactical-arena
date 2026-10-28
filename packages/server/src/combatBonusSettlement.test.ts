import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { calculateCombatPerformanceBonus } from '@tactical-arena/shared';

const app = createApp();

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.userId as string };
}

describe('Combat Performance Bonus Settlement Flow', () => {
  beforeEach(async () => {
    await prisma.match.deleteMany();
    await prisma.league.deleteMany();
    await prisma.cup.deleteMany();
    await prisma.club.deleteMany();
    await prisma.user.deleteMany();
  });

  it('credits combat bonuses to club balance upon match finalization', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();

    const clubARes = await request(app)
      .post('/clubs')
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ name: 'Clube Combate Alpha', country: 'BRA' });
    expect(clubARes.status).toBe(201);
    const clubA = clubARes.body;

    const clubBRes = await request(app)
      .post('/clubs')
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ name: 'Clube Combate Beta', country: 'BRA' });
    expect(clubBRes.status).toBe(201);
    const clubB = clubBRes.body;

    const budgetBeforeA = clubA.budget;
    const budgetBeforeB = clubB.budget;

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

    await request(app)
      .post(`/matches/${match.id}/tactic`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send(tacticFor(clubB));

    // Simulate to 90
    const finalRes = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${managerA.token}`)
      .send({ toMinute: 90 });
    expect(finalRes.status).toBe(200);
    expect(finalRes.body.status).toBe('SIMULATED');

    const result = finalRes.body.result;
    expect(result).toBeDefined();

    const avgA = clubA.players.length > 0 ? clubA.players.reduce((s: number, p: any) => s + p.overall, 0) / clubA.players.length : 0;
    const avgB = clubB.players.length > 0 ? clubB.players.reduce((s: number, p: any) => s + p.overall, 0) / clubB.players.length : 0;

    const bonusA = calculateCombatPerformanceBonus({
      events: result.events,
      mySide: 'home',
      myGoals: result.homeGoals,
      opponentGoals: result.awayGoals,
      pressRecoveries: result.stats?.home?.pressRecoveries ?? 0,
      isUnderdog: avgA < avgB - 3,
    });

    const bonusB = calculateCombatPerformanceBonus({
      events: result.events,
      mySide: 'away',
      myGoals: result.awayGoals,
      opponentGoals: result.homeGoals,
      pressRecoveries: result.stats?.away?.pressRecoveries ?? 0,
      isUnderdog: avgB < avgA - 3,
    });

    const updatedA = await prisma.club.findUnique({ where: { id: clubA.id } });
    const updatedB = await prisma.club.findUnique({ where: { id: clubB.id } });

    // Both clubs earned at least their broadcast fee + combat bonuses
    expect(updatedA?.budget).toBeGreaterThanOrEqual(budgetBeforeA + bonusA.totalBonus);
    expect(updatedB?.budget).toBeGreaterThanOrEqual(budgetBeforeB + bonusB.totalBonus);
  });
});

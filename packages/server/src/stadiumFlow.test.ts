import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { processWeeklyTickForClub } from './services/weeklyTickService.js';

const app = createApp();

/**
 * A week passes for this club, then it is read back.
 *
 * There is no per-club "avançar semana" route any more: time is not something a manager does to their
 * own club, it is something that happens to everyone at once. These tests are about one club, so they
 * drive the single-club form — running the whole world here would make every suite pay for every other
 * suite's leftover clubs, and this database is shared and never emptied.
 */
let weekCursor = 0;
async function tickWeek(clubId: string, token: string) {
  weekCursor += 1;
  await processWeeklyTickForClub(clubId, `2035-04-${String(weekCursor).padStart(2, "0")}`);
  return (await request(app).get(`/clubs/${clubId}`).set("Authorization", `Bearer ${token}`)).body;
}


async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string };
}

async function createClubFor(token: string, name: string) {
  const res = await request(app).post('/clubs').set('Authorization', `Bearer ${token}`).send({ name, country: 'BRA' });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Stadium expansion flow', () => {
  it('deducts the cost and starts a timed construction instead of upgrading instantly, only applying the new capacity once it finishes', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Obra FC');

    const upgradeRes = await request(app).post(`/clubs/${club.id}/stadium/upgrade`).set('Authorization', `Bearer ${manager.token}`);
    expect(upgradeRes.status).toBe(200);
    expect(upgradeRes.body.budget).toBe(club.budget - 2_000_000);
    // Still on the OLD level/capacity — the expansion hasn't finished yet.
    expect(upgradeRes.body.stadiumLevel).toBe(1);
    expect(upgradeRes.body.stadiumCapacity).toBe(club.stadiumCapacity);
    expect(upgradeRes.body.stadiumConstruction).toEqual({ targetLevel: 2, weeksRemaining: 4 });

    // A second upgrade can't be started while one is already underway.
    const secondUpgradeRes = await request(app).post(`/clubs/${club.id}/stadium/upgrade`).set('Authorization', `Bearer ${manager.token}`);
    expect(secondUpgradeRes.status).toBe(400);

    let current = upgradeRes.body;
    for (let week = 1; week <= 4; week++) {
      current = await tickWeek(club.id, manager.token);

      if (week < 4) {
        expect(current.stadiumLevel).toBe(1);
        expect(current.stadiumConstruction.weeksRemaining).toBe(4 - week);
      }
    }

    // After the 4th week, the expansion is finished: level/capacity bumped, no construction pending.
    expect(current.stadiumLevel).toBe(2);
    expect(current.stadiumCapacity).toBe(15_000);
    expect(current.stadiumConstruction).toBeNull();
  }, 30000);
});

describe('Stadium upgrade preview', () => {
  it('projects bigger crowds, more matchday revenue and a payback estimate for the next level', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Preview FC');

    const res = await request(app).get(`/clubs/${club.id}/stadium/preview`).set('Authorization', `Bearer ${manager.token}`);
    expect(res.status).toBe(200);
    expect(res.body.current.level).toBe(1);
    expect(res.body.current.capacity).toBe(club.stadiumCapacity);
    expect(res.body.next.level).toBe(2);
    expect(res.body.next.upgradeCost).toBe(2_000_000);
    expect(res.body.next.publicoMedio).toBeGreaterThan(res.body.current.publicoMedio);
    expect(res.body.next.receitaPorJogo).toBeGreaterThan(res.body.current.receitaPorJogo);
    expect(res.body.next.paybackMatches).toBeGreaterThan(0);
  });

  it('has no next level once the stadium is maxed out', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Maxed FC');
    // Reaching level 5 by paying for every step costs far more than a fresh club's starting budget —
    // jump straight there the way developmentFlow.test.ts pins other financial edge cases.
    await prisma.club.update({ where: { id: club.id }, data: { stadiumLevel: 5, stadiumCapacity: 120_000 } });

    const res = await request(app).get(`/clubs/${club.id}/stadium/preview`).set('Authorization', `Bearer ${manager.token}`);
    expect(res.status).toBe(200);
    expect(res.body.current.level).toBe(5);
    expect(res.body.next).toBeNull();
  });
});

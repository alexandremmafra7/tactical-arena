import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { seasonWindow } from '@tactical-arena/shared';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

const app = createApp();

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

/**
 * The game clock.
 *
 * Until now the game had no notion of a date at all: `advanceWeek` was a per-club button that aged players
 * a year per click and never ran for bot clubs, and nothing anywhere said what day it was. This is the row
 * everything else about the calendar hangs off.
 */
describe('Game clock', () => {
  it('creates itself on first use and reports a civil date', async () => {
    const token = await registerAndLogin();
    const res = await request(app).get('/game/state').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const state = res.body;
    // A civil date, not an instant: no time, no zone, no trailing Z.
    expect(state.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof state.seasonYear).toBe('number');
    expect(['PRE_SEASON', 'IN_SEASON', 'OFF_SEASON']).toContain(state.phase);

    // The season window comes from the same pure function the calendar uses, so the two can never drift.
    const { startDate, endDate } = seasonWindow(state.seasonYear);
    expect(state.seasonStartDate).toBe(startDate);
    expect(state.seasonEndDate).toBe(endDate);
  });

  it('keeps exactly one clock, however many times it is asked', async () => {
    const token = await registerAndLogin();
    await Promise.all([
      request(app).get('/game/state').set('Authorization', `Bearer ${token}`),
      request(app).get('/game/state').set('Authorization', `Bearer ${token}`),
      request(app).get('/game/state').set('Authorization', `Bearer ${token}`),
    ]);
    expect(await prisma.gameState.count()).toBe(1);
  });

  it('reports the same date on every read until something moves it', async () => {
    const token = await registerAndLogin();
    const first = (await request(app).get('/game/state').set('Authorization', `Bearer ${token}`)).body;
    const second = (await request(app).get('/game/state').set('Authorization', `Bearer ${token}`)).body;
    expect(second.currentDate).toBe(first.currentDate);
    expect(second.seasonYear).toBe(first.seasonYear);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/game/state');
    expect(res.status).toBe(401);
  });
});

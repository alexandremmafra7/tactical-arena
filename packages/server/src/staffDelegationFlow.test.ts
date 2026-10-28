import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { createManagerToken } from './services/authService.js';
import { getStaffDelegationPreset, autoFillLineup, generateStarterSquad } from '@tactical-arena/shared';

const app = createApp();

describe('Staff Delegation Flow', () => {
  const userId = 'user-staff-delegation-test';
  const token = createManagerToken(userId);

  beforeEach(async () => {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: 'delegation@test.com',
        passwordHash: 'hash',
      },
    });
  });

  it('updates staff delegation config and persists across club queries', async () => {
    const club = await prisma.club.create({
      data: {
        name: 'Delegation FC',
        ownerId: userId,
        country: 'BRA',
        budget: 10_000_000,
        stadiumLevel: 1,
        stadiumCapacity: 10000,
        titlesWon: 0,
        playersJson: '[]',
        academyPlayersJson: '[]',
        sponsorshipsJson: '[]',
        loansJson: '[]',
        pendingTransferPaymentsJson: '[]',
        staffJson: '[]',
      },
    });

    const fmConfig = getStaffDelegationPreset('football_manager_hardcore');

    const updateRes = await request(app)
      .put(`/clubs/${club.id}/staff/delegation`)
      .set('Authorization', `Bearer ${token}`)
      .send(fmConfig);

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.staffDelegationConfig?.presetMode).toBe('football_manager_hardcore');
    expect(updateRes.body.staffDelegationConfig?.autoSubstitutionsInMatch).toBe(false);

    // Verify fetching club has delegationConfig
    const getRes = await request(app)
      .get(`/clubs/${club.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.staffDelegationConfig?.presetMode).toBe('football_manager_hardcore');
    expect(getRes.body.staffDelegationConfig?.autoSubstitutionsInMatch).toBe(false);
  });

  it('allows switching to brasfoot_casual mode with full automation', async () => {
    const club = await prisma.club.create({
      data: {
        name: 'Brasfoot Casual FC',
        ownerId: userId,
        country: 'BRA',
        budget: 10_000_000,
        stadiumLevel: 1,
        stadiumCapacity: 10000,
        titlesWon: 0,
        playersJson: '[]',
        academyPlayersJson: '[]',
        sponsorshipsJson: '[]',
        loansJson: '[]',
        pendingTransferPaymentsJson: '[]',
        staffJson: '[]',
      },
    });

    const casualConfig = getStaffDelegationPreset('brasfoot_casual');

    const updateRes = await request(app)
      .put(`/clubs/${club.id}/staff/delegation`)
      .set('Authorization', `Bearer ${token}`)
      .send(casualConfig);

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.staffDelegationConfig?.presetMode).toBe('brasfoot_casual');
    expect(updateRes.body.staffDelegationConfig?.autoSubstitutionsInMatch).toBe(true);
    expect(updateRes.body.staffDelegationConfig?.autoLineup).toBe('best_eleven');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from './db/prisma.js';
import { createClub } from './services/clubService.js';
import { createProposal } from './services/transferService.js';
import { BOT_OWNER_ID } from '@tactical-arena/shared';

describe('Transfer Negotiation Engine AI Flow', () => {
  const userId = `user-neg-${randomUUID()}`;
  let userClubId: string;
  let botClubId: string;

  beforeEach(async () => {
    // Create user club
    const uClub = await createClub(userId, 'Grêmio Estudantil', 'BRA');
    userClubId = uClub.id;

    // Create bot club with strong players
    const bClub = await createClub(BOT_OWNER_ID, 'Flamengo Bot', 'BRA');
    botClubId = bClub.id;
  });

  it('rejects an underpriced cash offer and saves realistic rejection reason in responseMessage', async () => {
    const botClub = await prisma.club.findUniqueOrThrow({ where: { id: botClubId } });
    const botPlayers = JSON.parse(botClub.playersJson);
    const targetPlayer = botPlayers[0];

    const proposal = await createProposal({
      buyerClubId: userClubId,
      sellerClubId: botClubId,
      targetPlayerId: targetPlayer.id,
      cashAmount: 100_000, // Very low offer
      installments: 1,
      offeredPlayerIds: [],
      requestingUserId: userId,
    });

    expect(proposal.status).toBe('REJECTED');
    expect(proposal.responseMessage).toBeDefined();
    expect(proposal.responseMessage).toContain('muito abaixo da pedida');
  });

  it('demands bank guarantee for large installment proposal without bank guarantee', async () => {
    const botClub = await prisma.club.findUniqueOrThrow({ where: { id: botClubId } });
    const botPlayers = JSON.parse(botClub.playersJson);
    const targetPlayer = botPlayers[0];

    const proposal = await createProposal({
      buyerClubId: userClubId,
      sellerClubId: botClubId,
      targetPlayerId: targetPlayer.id,
      cashAmount: 8_000_000,
      installments: 6,
      offeredPlayerIds: [],
      requestingUserId: userId,
      hasBankGuarantee: false,
    });

    expect(proposal.status).toBe('REJECTED');
    expect(proposal.requiresBankGuarantee).toBe(true);
    expect(proposal.responseMessage).toContain('Garantia Bancária');
  });

  it('accepts fair offer and executes transfer immediately with success response', async () => {
    const botClub = await prisma.club.findUniqueOrThrow({ where: { id: botClubId } });
    const botPlayers = JSON.parse(botClub.playersJson);
    const targetPlayer = botPlayers[0];

    // Give buyer sufficient budget
    await prisma.club.update({
      where: { id: userClubId },
      data: { budget: 30_000_000 },
    });

    const proposal = await createProposal({
      buyerClubId: userClubId,
      sellerClubId: botClubId,
      targetPlayerId: targetPlayer.id,
      cashAmount: Math.round(targetPlayer.marketValue * 1.5),
      installments: 1,
      offeredPlayerIds: [],
      requestingUserId: userId,
    });

    expect(proposal.status).toBe('ACCEPTED');
    expect(proposal.responseMessage).toContain('Proposta aceita');

    // Confirm player moved to user club
    const updatedUserClub = await prisma.club.findUniqueOrThrow({ where: { id: userClubId } });
    const updatedUserPlayers = JSON.parse(updatedUserClub.playersJson);
    expect(updatedUserPlayers.some((p: any) => p.id === targetPlayer.id)).toBe(true);
  });
});

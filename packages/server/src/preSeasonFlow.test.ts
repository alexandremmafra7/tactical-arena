import { describe, it, expect } from 'vitest';
import { generatePreSeasonInvitations, createPreSeasonBracket } from '@tactical-arena/shared';

describe('Pre-Season Tournaments Backend Integration Flow', () => {
  it('generates pre-season tournament invitations and bracket', () => {
    const invitations = generatePreSeasonInvitations(80);
    expect(invitations.length).toBeGreaterThan(0);

    const tournament = invitations[0]!;
    const bracket = createPreSeasonBracket(tournament, 'Tactical FC');
    expect(bracket.tournamentId).toBe(tournament.id);
    expect(bracket.semiFinals).toHaveLength(2);
  });
});

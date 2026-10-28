import { describe, it, expect } from 'vitest';
import { generatePreSeasonInvitations, createPreSeasonBracket } from './preSeasonTournaments.js';

describe('Pre-Season Tournaments Domain', () => {
  it('generates invitations matching club prestige', () => {
    const invitations = generatePreSeasonInvitations(85);
    expect(invitations.length).toBeGreaterThan(0);
    expect(invitations.some((i) => i.type === 'FLORIDA_CUP')).toBe(true);
  });

  it('creates quadrangular tournament bracket correctly', () => {
    const invitations = generatePreSeasonInvitations(85);
    const bracket = createPreSeasonBracket(invitations[0]!, 'Tactical FC');
    expect(bracket.semiFinals).toHaveLength(2);
    expect(bracket.semiFinals[0]?.homeClub).toBe('Tactical FC');
    expect(bracket.finalMatch).toBeDefined();
  });
});

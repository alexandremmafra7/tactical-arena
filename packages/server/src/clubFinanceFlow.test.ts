import { describe, it, expect } from 'vitest';
import { BOT_OWNER_ID, MAX_SPONSORSHIPS, STARTING_BUDGET } from '@tactical-arena/shared';
import { prisma } from './db/prisma.js';
import { createClub, getClub } from './services/clubService.js';
import { processWeeklyTickForClub } from './services/weeklyTickService.js';
import { turnSeasonForClub } from './services/seasonTurnService.js';

/** Dedicated, never-reused country. */
const COUNTRY = 'ISL';

/** A full Brazilian-model season, April to December. */
const SEASON_WEEKS = 36;

/**
 * Whether a club can pay for itself.
 *
 * It could not. Signing a sponsorship requires the requesting user to own the club, and every club was
 * created with an empty board, so the entire computer-run world earned nothing but gate money and ran at a
 * permanent loss. Measured across the 1.526 clubs of the shipped database, the median club burned
 * R$ 151.000 a week and only 31% of them could finish a year in the black. A cash floor kept the bots
 * standing, so nothing ever looked wrong; the manager's own club had no such floor and went broke in
 * November of its first season.
 */
describe('Club finances', () => {
  it('gives a new club the sponsors its ground earns, and leaves it room to negotiate', async () => {
    const club = await createClub(BOT_OWNER_ID, `Patrocínio ${Date.now()}`, COUNTRY);

    expect(club.sponsorships.length).toBeGreaterThan(0);
    // A starter ground is the smallest there is, so it must not arrive with a full board.
    expect(club.sponsorships.length).toBeLessThan(MAX_SPONSORSHIPS);
    for (const deal of club.sponsorships) {
      expect(deal.weeklyAmount).toBeGreaterThan(0);
      expect(deal.weeksRemaining).toBeGreaterThan(0);
    }

    // The board is what was persisted, not something assembled on the way out.
    expect((await getClub(club.id)).sponsorships).toEqual(club.sponsorships);
  }, 60000);

  it('does not hand the club a signing bonus it never negotiated', async () => {
    const club = await createClub(BOT_OWNER_ID, `Luvas ${Date.now()}`, COUNTRY);

    /**
     * `signSponsorship` credits a signing bonus, which for a Mecenas Master deal reaches R$ 25 milhões.
     * Paying that to every club in the world at creation would be a far worse bug than the one this fixes.
     */
    expect(club.budget).toBe(STARTING_BUDGET);
    for (const deal of club.sponsorships) expect(deal.signingBonus ?? 0).toBe(0);
  }, 60000);

  it('survives a season on what it earns', async () => {
    const club = await createClub(BOT_OWNER_ID, `Sobrevive ${Date.now()}`, COUNTRY);

    let week = Date.UTC(2041, 3, 7);
    for (let i = 0; i < SEASON_WEEKS; i += 1) {
      await processWeeklyTickForClub(club.id, new Date(week).toISOString().slice(0, 10));
      week += 7 * 24 * 60 * 60 * 1000;
    }

    /**
     * Not "makes a profit" — a club scraping through on its television money is a perfectly good football
     * club. What must not happen is the thing that used to: the opening budget gone before December, every
     * season, for every club in the world at once.
     */
    const after = await getClub(club.id);
    expect(after.budget).toBeGreaterThan(0);
  }, 120000);

  it('renegotiates for a club nobody manages, so the board does not starve away', async () => {
    const club = await createClub(BOT_OWNER_ID, `Renova ${Date.now()}`, COUNTRY);

    // Every deal is one week from running out. The tick drops them at zero.
    await prisma.club.update({
      where: { id: club.id },
      data: { sponsorshipsJson: JSON.stringify(club.sponsorships.map((s) => ({ ...s, weeksRemaining: 1 }))) },
    });
    await processWeeklyTickForClub(club.id, '2041-12-15');
    expect((await getClub(club.id)).sponsorships).toHaveLength(0);

    /**
     * The off-season is where a club renegotiates, and a club with nobody at the wheel has to do it by
     * itself: only an owner can sign, so without this the computer-run world would starve one expiring
     * contract at a time and end up exactly where it started.
     */
    await turnSeasonForClub(club.id, 2042);
    expect((await getClub(club.id)).sponsorships.length).toBeGreaterThan(0);
  }, 120000);

  it('leaves the manager to do their own negotiating', async () => {
    const manager = `manager-${Date.now()}`;
    const club = await createClub(manager, `Do Técnico ${Date.now()}`, COUNTRY);

    await prisma.club.update({ where: { id: club.id }, data: { sponsorshipsJson: '[]' } });
    await turnSeasonForClub(club.id, 2042);

    /**
     * A club the computer runs gets its board filled in because nothing else ever would. A manager has the
     * offers screen, and choosing a sponsor is one of the few decisions the game asks of them off the
     * pitch — filling it in for them would quietly take that away.
     */
    expect((await getClub(club.id)).sponsorships).toHaveLength(0);
  }, 120000);
});

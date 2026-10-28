import { describe, it, expect } from 'vitest';
import { BOT_OWNER_ID, calculateWageBill } from '@tactical-arena/shared';
import { prisma } from './db/prisma.js';
import { createClub, getClub } from './services/clubService.js';
import { processWeeklyTick, processWeeklyTickForClub, BOT_CASH_FLOOR } from './services/weeklyTickService.js';
import { turnSeasonForAllClubs } from './services/seasonTurnService.js';

/** Dedicated, never-reused country. */
const COUNTRY = 'IRN';

/**
 * A week that happens to everybody.
 *
 * Time used to be a button on one screen: `advanceWeek` took a club id and an owner, so wages, stadium
 * works and loan repayments only ever happened to the club a human was looking at. Everything else in the
 * world sat frozen on its founding balance with a half-built stand it would never finish. And because the
 * same call also aged every player a year, a manager who pressed it weekly ran their squad into
 * retirement in a season.
 */
describe('Weekly tick', () => {
  it('moves the finances of a club nobody owns', async () => {
    const bot = await createClub(BOT_OWNER_ID, `Bot Semanal ${Date.now()}`, COUNTRY);
    // Well clear of the floor, so what is measured is the tick and not the guard rail.
    await prisma.club.update({ where: { id: bot.id }, data: { budget: 50_000_000 } });

    const before = await getClub(bot.id);
    await processWeeklyTick('2036-03-02');
    const after = await getClub(bot.id);

    expect(after.budget).not.toBe(before.budget);
  }, 60000);

  it('does not age anyone', async () => {
    const club = await createClub(BOT_OWNER_ID, `Bot Idade ${Date.now()}`, COUNTRY);
    const agesBefore = (await getClub(club.id)).players.map((p) => p.age);

    await processWeeklyTickForClub(club.id, '2036-03-09');
    await processWeeklyTickForClub(club.id, '2036-03-16');
    await processWeeklyTickForClub(club.id, '2036-03-23');

    /**
     * The whole reason the tick was split. Three weeks of rest used to be three years of ageing, which
     * was tolerable only while a human had to click for each one and only their own squad was affected.
     */
    expect((await getClub(club.id)).players.map((p) => p.age)).toEqual(agesBefore);
  }, 60000);

  it('heals injuries by the week rather than by the match', async () => {
    const club = await createClub(BOT_OWNER_ID, `Bot Lesao ${Date.now()}`, COUNTRY);
    const squad = (await getClub(club.id)).players;
    const injured = squad[0];
    await prisma.club.update({
      where: { id: club.id },
      data: {
        playersJson: JSON.stringify(squad.map((p) => (p.id === injured.id ? { ...p, injuryWeeks: 3 } : p))),
      },
    });

    await processWeeklyTickForClub(club.id, '2036-03-30');
    const afterOne = (await getClub(club.id)).players.find((p) => p.id === injured.id);
    expect(afterOne?.injuryWeeks).toBe(2);

    await processWeeklyTickForClub(club.id, '2036-04-06');
    await processWeeklyTickForClub(club.id, '2036-04-13');
    const afterThree = (await getClub(club.id)).players.find((p) => p.id === injured.id);
    expect(afterThree?.injuryWeeks).toBe(0);

    // And it stops at nothing rather than going negative.
    await processWeeklyTickForClub(club.id, '2036-04-20');
    expect((await getClub(club.id)).players.find((p) => p.id === injured.id)?.injuryWeeks).toBe(0);
  }, 60000);

  it('keeps a computer-run club solvent, and lets a human club go under', async () => {
    const bot = await createClub(BOT_OWNER_ID, `Bot Falido ${Date.now()}`, COUNTRY);
    const human = await createClub('a-real-manager', `Humano Falido ${Date.now()}`, COUNTRY);
    await prisma.club.update({ where: { id: bot.id }, data: { budget: -5_000_000 } });
    await prisma.club.update({ where: { id: human.id }, data: { budget: -5_000_000 } });

    await processWeeklyTickForClub(bot.id, '2036-04-27');
    await processWeeklyTickForClub(human.id, '2036-04-27');

    /**
     * Bot finances have never run before, so nothing about them is calibrated: a squad with wages, no
     * sponsors and no transfer income drifts into permanent debt within a season and drags its own
     * morale down with it. The floor is a guard rail until the bot economy exists, not a model of
     * anything — and it deliberately does not apply to the club a manager is responsible for.
     */
    expect((await getClub(bot.id)).budget).toBe(BOT_CASH_FLOOR);
    expect((await getClub(human.id)).budget).toBeLessThan(0);
  }, 60000);

  it('never touches a roster, and rests the squad anyway', async () => {
    const club = await createClub(BOT_OWNER_ID, `Bot Parado ${Date.now()}`, COUNTRY);

    // Put some fatigue on the books, the way a match would.
    const squad = (await getClub(club.id)).players;
    await prisma.club.update({
      where: { id: club.id },
      data: { playersJson: JSON.stringify(squad.map((p) => ({ ...p, fatigue: 60 }))) },
    });

    const stored = () => prisma.club.findUnique({ where: { id: club.id } });
    const before = await stored();
    expect(before?.pendingRestWeeks).toBe(0); // writing the roster cleared it — see the prisma extension

    await processWeeklyTickForClub(club.id, '2036-05-04');
    await processWeeklyTickForClub(club.id, '2036-05-11');
    const after = await stored();

    /**
     * The roster on disk is untouched, byte for byte, and that is the whole point: a squad serialises to
     * some 42 KB, and rewriting every one of them every Monday to move three small numbers per player was
     * 87% of what a week cost across a world of clubs. The weeks are counted instead.
     */
    expect(after?.playersJson).toBe(before?.playersJson);
    expect(after?.pendingRestWeeks).toBe(2);

    // And yet the squad has genuinely rested, because the owed weeks are folded in on the way out.
    const rested = await getClub(club.id);
    expect(rested.players.every((p) => p.fatigue < 60)).toBe(true);
  }, 60000);

  it('keeps the cached wage bill honest through the one door every roster write passes', async () => {
    const club = await createClub(BOT_OWNER_ID, `Bot Folha ${Date.now()}`, COUNTRY);

    const stored = await prisma.club.findUnique({ where: { id: club.id } });
    const squad = (await getClub(club.id)).players;
    expect(stored?.weeklyWageBill).toBe(Math.round(calculateWageBill(squad)));

    /**
     * The week charges wages from this column rather than reading a roster to add them up, so it is only
     * ever right if it is updated on *every* roster write — and rosters are written from two dozen places
     * across nine services. Nobody is asked to remember: the prisma extension recomputes it, and this is
     * the proof, using a raw write that knows nothing about any of it.
     */
    const richer = squad.map((p) => ({ ...p, wage: p.wage + 1000 }));
    await prisma.club.update({ where: { id: club.id }, data: { playersJson: JSON.stringify(richer) } });

    const after = await prisma.club.findUnique({ where: { id: club.id } });
    expect(after?.weeklyWageBill).toBe(Math.round(calculateWageBill(richer)));
    // The same write also clears the owed rest, because those players were read already rested.
    expect(after?.pendingRestWeeks).toBe(0);
  }, 60000);

  it('turns the year separately, and only then does anyone get older', async () => {
    const club = await createClub(BOT_OWNER_ID, `Bot Virada ${Date.now()}`, COUNTRY);
    const before = (await getClub(club.id)).players;

    await turnSeasonForAllClubs(2036);

    const after = (await getClub(club.id)).players;
    // Retirement recycles a slot into a rookie, so compare only the players who are still themselves.
    const survivors = after.filter((p) => before.some((b) => b.id === p.id && b.name === p.name));
    expect(survivors.length).toBeGreaterThan(0);
    for (const player of survivors) {
      const was = before.find((b) => b.id === player.id)!;
      expect(player.age, player.name).toBe(was.age + 1);
    }
  }, 60000);

  it('applies fastest medical care after weekly recovery for human clubs', async () => {
    const club = await createClub('human-manager', `Human Time ${Date.now()}`, COUNTRY);

    // Get the club to access its players
    const clubData = await getClub(club.id);
    const players = clubData.players;

    // Set up a player with 4 injury weeks
    const injuredPlayer = { ...players[0], injuryWeeks: 4 };
    const updatedPlayers = [injuredPlayer, ...players.slice(1)];

    // Set up a 95-rated FITNESS_COACH
    const staff = [{
      id: 'fitness',
      name: 'Fisiologista',
      role: 'FITNESS_COACH',
      tier: 'OURO',
      rating: 95,
      specialty: 'Recuperação rápida',
      description: '',
      wage: 1,
      minClubVisibility: 0,
      minCareerTitles: 0,
      avatar: '⚡',
      nationality: 'BRA',
    }];

    // Configure for auto_fastest via custom delegation
    await prisma.club.update({
      where: { id: club.id },
      data: {
        playersJson: JSON.stringify(updatedPlayers),
        staffJson: JSON.stringify({
          staff,
          delegationConfig: {
            presetMode: 'custom',
            injuryRehab: 'auto_fastest',
          },
        }),
      },
    });

    // Process one weekly tick
    await processWeeklyTickForClub(club.id, '2036-06-01');

    // Check that the player progressed: 4 -> 3 (weekly) -> 1 (medical)
    const afterClub = await getClub(club.id);
    const afterPlayer = afterClub.players.find(p => p.id === injuredPlayer.id);
    expect(afterPlayer?.injuryWeeks).toBe(1);

    // Check that exactly one medical news item was created for this player
    const news = await prisma.newsItem.findMany({
      where: { clubId: club.id },
      orderBy: { createdAt: 'desc' },
    });

    const medicalNews = news.filter(n =>
      n.category === 'INJURY' &&
      n.headline.startsWith('🏥 Fisioterapia:') &&
      n.headline.includes(afterPlayer!.name) &&
      n.headline.includes('2 semanas')
    );

    expect(medicalNews).toHaveLength(1);
  }, 60000);

  it('applies no medical care in manual mode for human clubs', async () => {
    const club = await createClub('human-manager', `Human Time ${Date.now()}`, COUNTRY);

    // Get the club to access its players
    const clubData = await getClub(club.id);
    const players = clubData.players;

    // Set up a player with 4 injury weeks
    const injuredPlayer = { ...players[0], injuryWeeks: 4 };
    const updatedPlayers = [injuredPlayer, ...players.slice(1)];

    // Set up a 95-rated FITNESS_COACH
    const staff = [{
      id: 'fitness',
      name: 'Fisiologista',
      role: 'FITNESS_COACH',
      tier: 'OURO',
      rating: 95,
      specialty: 'Recuperação rápida',
      description: '',
      wage: 1,
      minClubVisibility: 0,
      minCareerTitles: 0,
      avatar: '⚡',
      nationality: 'BRA',
    }];

    // Configure for manual_medical_clinic via custom delegation
    await prisma.club.update({
      where: { id: club.id },
      data: {
        playersJson: JSON.stringify(updatedPlayers),
        staffJson: JSON.stringify({
          staff,
          delegationConfig: {
            presetMode: 'custom',
            injuryRehab: 'manual_medical_clinic',
          },
        }),
      },
    });

    // Process one weekly tick
    await processWeeklyTickForClub(club.id, '2036-06-01');

    // Check that the player progressed only by weekly recovery: 4 -> 3
    const afterClub = await getClub(club.id);
    const afterPlayer = afterClub.players.find(p => p.id === injuredPlayer.id);
    expect(afterPlayer?.injuryWeeks).toBe(3);

    // Check that no medical news items were created
    const news = await prisma.newsItem.findMany({
      where: { clubId: club.id },
      orderBy: { createdAt: 'desc' },
    });

    const medicalNews = news.filter(n =>
      n.category === 'INJURY' &&
      n.headline.startsWith('🏥 Fisioterapia:')
    );

    expect(medicalNews).toHaveLength(0);
  }, 60000);
});

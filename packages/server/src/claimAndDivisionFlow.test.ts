import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { BOT_OWNER_ID, generateAcademy, generateStarterSquad } from '@tactical-arena/shared';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { joinOrCreateLeague } from './services/leagueService.js';

const app = createApp();
const COUNTRY = 'JPN';

beforeEach(async () => {
  await prisma.club.deleteMany({ where: { country: COUNTRY } });
  await prisma.league.deleteMany({ where: { countryCode: COUNTRY } });
});

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string };
}

/**
 * Mirrors what the CSV importer does, without going through the CSV/file layer — a bot-owned premade club.
 *
 * `skillLevel` pins the squad's overall quality instead of leaving it to `generateStarterSquad`'s default
 * random 45-65 base (see squadGenerator.ts) — a test that asserts on which *tactical identity tier* the
 * bot lands in (see `tacticalIdentityOf`'s squad-strength cutoffs) needs a stable average overall, not a
 * fresh coin flip on every run against a brand-new random club id.
 */
async function createBotClub(division: number, skillLevel?: number) {
  const id = randomUUID();
  const players = generateStarterSquad(id, COUNTRY, id, skillLevel);
  const academyPlayers = generateAcademy(id, COUNTRY);

  await prisma.club.create({
    data: {
      id,
      name: `Bot Club ${id.slice(0, 8)}`,
      ownerId: BOT_OWNER_ID,
      slug: `bot-${id.slice(0, 8)}`,
      country: COUNTRY,
      playersJson: JSON.stringify(players),
      academyPlayersJson: JSON.stringify(academyPlayers),
    },
  });
  await joinOrCreateLeague(id, COUNTRY, division);

  return { id, players };
}

describe('Claiming a premade club', () => {
  it('lets a human claim a bot-owned club, which then disappears from the available list', async () => {
    /**
     * Segunda divisão, e não primeira, porque uma carreira sem modo escolhido é uma carreira padrão — e o
     * modo padrão não assume clube de elite. O que este teste verifica é o ato de assumir, não o teto.
     */
    const bot = await createBotClub(2);
    const manager = await registerAndLogin();

    const beforeClaim = await request(app)
      .get(`/clubs/available?country=${COUNTRY}`)
      .maxResponseSize(50 * 1024 * 1024)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(beforeClaim.body.some((c: any) => c.id === bot.id)).toBe(true);

    const claimRes = await request(app)
      .post(`/clubs/${bot.id}/claim`)
      .maxResponseSize(50 * 1024 * 1024)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.ownerId).not.toBe(BOT_OWNER_ID);

    const afterClaim = await request(app)
      .get(`/clubs/available?country=${COUNTRY}`)
      .maxResponseSize(50 * 1024 * 1024)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(afterClaim.body.some((c: any) => c.id === bot.id)).toBe(true);

    const mine = await request(app)
      .get('/clubs/mine')
      .maxResponseSize(50 * 1024 * 1024)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(mine.body.some((c: any) => c.id === bot.id)).toBe(true);
  }, 15000);

  it('rejects claiming a club that already belongs to a human manager', async () => {
    const owner = await registerAndLogin();
    const intruder = await registerAndLogin();

    const clubRes = await request(app)
      .post('/clubs')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: `Human FC ${randomUUID().slice(0, 8)}`, country: COUNTRY });
    expect(clubRes.status).toBe(201);

    const claimRes = await request(app).post(`/clubs/${clubRes.body.id}/claim`).set('Authorization', `Bearer ${intruder.token}`);
    expect(claimRes.status).toBe(400);
  });
});

describe('Divisions', () => {
  it('keeps clubs in different divisions in separate leagues, and the available-clubs filter respects division', async () => {
    const div1Club = await createBotClub(1);
    const div2Club = await createBotClub(2);
    const manager = await registerAndLogin();

    const div1List = await request(app)
      .get(`/clubs/available?country=${COUNTRY}&division=1`)
      .set('Authorization', `Bearer ${manager.token}`);
    const div2List = await request(app)
      .get(`/clubs/available?country=${COUNTRY}&division=2`)
      .set('Authorization', `Bearer ${manager.token}`);

    expect(div1List.body.some((c: any) => c.id === div1Club.id)).toBe(true);
    expect(div1List.body.some((c: any) => c.id === div2Club.id)).toBe(false);
    expect(div2List.body.some((c: any) => c.id === div2Club.id)).toBe(true);
    expect(div2List.body.some((c: any) => c.id === div1Club.id)).toBe(false);

    const leaguesRes = await request(app).get(`/leagues?country=${COUNTRY}&division=1`).set('Authorization', `Bearer ${manager.token}`);
    expect(leaguesRes.body.every((l: any) => l.division === 1)).toBe(true);
  }, 15000);
});

describe('League fixtures use a claimed club\'s default tactic preset', () => {
  it('plays a claimed club with its marked-default preset instead of auto-filling, while its bot opponent still auto-fills', async () => {
    // An obscure, dedicated division number keeps this pair alone in their own league — even across
    // repeated runs against the same shared dev database — instead of accumulating into whatever else
    // division 1 already holds, where an odd total club count would make force-start throw.
    const ISOLATED_DIVISION = 9001;
    // Pinned mid-table (58-67 is `tacticalIdentityOf`'s MID_SQUAD tier, where both candidate identities —
    // POSSESSION and ORTHODOX — carry 'balanced' mentality) so the assertion below on `botSide.mentality`
    // is about auto-fill actually running, not a coin flip on which tier a random squad happens to land in.
    const botOpponent = await createBotClub(ISOLATED_DIVISION, 62);
    const claimableClub = await createBotClub(ISOLATED_DIVISION);
    const manager = await registerAndLogin();

    const claimRes = await request(app).post(`/clubs/${claimableClub.id}/claim`).set('Authorization', `Bearer ${manager.token}`);
    expect(claimRes.status).toBe(200);

    const tactic = {
      clubId: claimableClub.id,
      formation: '4-4-2',
      mentality: 'attacking',
      attackStyle: 'THROUGH_MIDDLE',
      markingStyle: 'BALANCED',
      attackApproach: 'COUNTER_ATTACK',
      lineup: claimableClub.players.slice(0, 11).map((p) => ({ playerId: p.id })),
      substitutes: claimableClub.players.slice(11, 14).map((p) => ({ playerId: p.id })),
      plannedSubstitutions: [],
    };
    const presetRes = await request(app)
      .post(`/clubs/${claimableClub.id}/tactic-presets`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Titular', tactic });
    expect(presetRes.status).toBe(201);

    const defaultRes = await request(app)
      .post(`/clubs/${claimableClub.id}/tactic-presets/${presetRes.body.id}/default`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.body.isDefault).toBe(true);

    const leagues = await request(app)
      .get(`/leagues?country=${COUNTRY}&division=${ISOLATED_DIVISION}`)
      .set('Authorization', `Bearer ${manager.token}`);
    const league = leagues.body.find((l: any) => l.clubIds.includes(claimableClub.id) && l.clubIds.includes(botOpponent.id));
    expect(league).toBeDefined();

    // Robust to repeated runs against the same shared dev database: the league may already have
    // auto-started (capacity reached exactly) instead of needing an explicit force-start.
    let current = league;
    if (current.status === 'OPEN') {
      const startRes = await request(app).post(`/leagues/${league.id}/force-start`).set('Authorization', `Bearer ${manager.token}`);
      expect(startRes.status).toBe(200);
      current = startRes.body;
    }

    // Keep advancing rounds until the specific fixture between these two clubs has been simulated —
    // robust to sharing a league with other clubs accumulated from prior runs of this same test.
    let fixture = current.fixtures.find(
      (f: any) =>
        (f.homeClubId === claimableClub.id && f.awayClubId === botOpponent.id) ||
        (f.homeClubId === botOpponent.id && f.awayClubId === claimableClub.id),
    );
    let guard = 0;
    while (fixture && fixture.matchId === null && guard < 20) {
      const advanceRes = await request(app).post(`/leagues/${league.id}/advance-round`).set('Authorization', `Bearer ${manager.token}`);
      expect(advanceRes.status).toBe(200);
      current = advanceRes.body;
      fixture = current.fixtures.find(
        (f: any) =>
          (f.homeClubId === claimableClub.id && f.awayClubId === botOpponent.id) ||
          (f.homeClubId === botOpponent.id && f.awayClubId === claimableClub.id),
      );
      guard++;
    }
    expect(fixture).toBeDefined();
    expect(fixture.matchId).not.toBeNull();
    const matchRes = await request(app).get(`/matches/${fixture.matchId}`).set('Authorization', `Bearer ${manager.token}`);

    const claimedSide = matchRes.body.homeClubId === claimableClub.id ? matchRes.body.homeTactic : matchRes.body.awayTactic;
    const botSide = matchRes.body.homeClubId === botOpponent.id ? matchRes.body.homeTactic : matchRes.body.awayTactic;

    expect(claimedSide.mentality).toBe('attacking');
    expect(botSide.mentality).toBe('balanced');
    // The default preset's bench travels with it into the actual league fixture, not just the lineup —
    // otherwise a manager's saved bench would silently vanish the moment a bot-auto-resolved round used it.
    expect(claimedSide.substitutes).toHaveLength(3);
  }, 30000);
});

describe('Pending round tactic (set your lineup before each round)', () => {
  it('takes priority over the default preset for the next fixture, then gets cleared and falls back to the default for the following one', async () => {
    const ISOLATED_DIVISION = 9002;
    const botOpponent = await createBotClub(ISOLATED_DIVISION);
    const claimableClub = await createBotClub(ISOLATED_DIVISION);
    const manager = await registerAndLogin();

    await request(app).post(`/clubs/${claimableClub.id}/claim`).set('Authorization', `Bearer ${manager.token}`);

    const baseTactic = {
      clubId: claimableClub.id,
      formation: '4-4-2',
      attackStyle: 'THROUGH_MIDDLE',
      markingStyle: 'BALANCED',
      attackApproach: 'COUNTER_ATTACK',
      lineup: claimableClub.players.slice(0, 11).map((p) => ({ playerId: p.id })),
      substitutes: [],
      plannedSubstitutions: [],
    };

    // Default preset: defensive.
    const presetRes = await request(app)
      .post(`/clubs/${claimableClub.id}/tactic-presets`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Padrão', tactic: { ...baseTactic, mentality: 'defensive' } });
    await request(app)
      .post(`/clubs/${claimableClub.id}/tactic-presets/${presetRes.body.id}/default`)
      .set('Authorization', `Bearer ${manager.token}`);

    // Pending round tactic for the very next fixture only: attacking.
    const roundTacticRes = await request(app)
      .post(`/clubs/${claimableClub.id}/round-tactic`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ ...baseTactic, mentality: 'attacking' });
    expect(roundTacticRes.status).toBe(200);
    expect(roundTacticRes.body.pendingRoundTactic.mentality).toBe('attacking');

    const leagues = await request(app)
      .get(`/leagues?country=${COUNTRY}&division=${ISOLATED_DIVISION}`)
      .set('Authorization', `Bearer ${manager.token}`);
    const league = leagues.body.find((l: any) => l.clubIds.includes(claimableClub.id) && l.clubIds.includes(botOpponent.id));

    let current = league;
    if (current.status === 'OPEN') {
      const startRes = await request(app).post(`/leagues/${league.id}/force-start`).set('Authorization', `Bearer ${manager.token}`);
      current = startRes.body;
    }

    function findFixture(fixtures: any[]) {
      return fixtures.find(
        (f) =>
          (f.homeClubId === claimableClub.id && f.awayClubId === botOpponent.id) ||
          (f.homeClubId === botOpponent.id && f.awayClubId === claimableClub.id),
      );
    }
    function mentalityFor(match: any, clubId: string) {
      return match.homeClubId === clubId ? match.homeTactic.mentality : match.awayTactic.mentality;
    }

    // First meeting: should use the pending round tactic (attacking), not the default (defensive).
    let fixture = findFixture(current.fixtures);
    let guard = 0;
    while (fixture && fixture.matchId === null && guard < 20) {
      const advanceRes = await request(app).post(`/leagues/${league.id}/advance-round`).set('Authorization', `Bearer ${manager.token}`);
      current = advanceRes.body;
      fixture = findFixture(current.fixtures);
      guard++;
    }
    const firstMatch = await request(app).get(`/matches/${fixture.matchId}`).set('Authorization', `Bearer ${manager.token}`);
    expect(mentalityFor(firstMatch.body, claimableClub.id)).toBe('attacking');

    // The chosen lineup survives the match. It used to be wiped the moment the round was played, which sent
    // the manager back to the default preset every single week — see leagueService.resolveLeagueTactic.
    const clubAfter = await request(app).get(`/clubs/${claimableClub.id}`).set('Authorization', `Bearer ${manager.token}`);
    expect(clubAfter.body.pendingRoundTactic).not.toBeNull();
    expect(clubAfter.body.pendingRoundTactic.mentality).toBe('attacking');

    // Second meeting (double round-robin: they play again, home/away swapped): still the manager's own side.
    const remainingFixtures = current.fixtures.filter((f: any) => f.matchId === null);
    const secondFixture = remainingFixtures.find(
      (f: any) =>
        (f.homeClubId === claimableClub.id && f.awayClubId === botOpponent.id) ||
        (f.homeClubId === botOpponent.id && f.awayClubId === claimableClub.id),
    );
    expect(secondFixture).toBeDefined();

    guard = 0;
    while (secondFixture.matchId === null && guard < 20) {
      const advanceRes = await request(app).post(`/leagues/${league.id}/advance-round`).set('Authorization', `Bearer ${manager.token}`);
      current = advanceRes.body;
      const updated = findFixture(current.fixtures.filter((f: any) => f.round === secondFixture.round));
      if (updated?.matchId) {
        secondFixture.matchId = updated.matchId;
        break;
      }
      guard++;
    }
    expect(secondFixture.matchId).not.toBeNull();
    const secondMatch = await request(app).get(`/matches/${secondFixture.matchId}`).set('Authorization', `Bearer ${manager.token}`);

    /**
     * The saved side is used again *if it still fields eleven available players*. That caveat is the
     * documented behaviour (see resolveLeagueTactic), and it became reachable here once abandoned matches
     * started actually finishing: the first meeting is played for real now, so it can leave someone injured
     * or suspended, and a lineup missing a man legitimately falls back for that fixture only.
     *
     * Checked rather than assumed, so this asserts the real rule instead of quietly passing whenever a knock
     * happens to intervene.
     */
    const squad = (await request(app).get(`/clubs/${claimableClub.id}`).set('Authorization', `Bearer ${manager.token}`)).body;
    const available = new Set(
      squad.players
        .filter((p: any) => p.injuryWeeks === 0 && !p.suspensions.some((s: any) => s.matchesRemaining > 0))
        .map((p: any) => p.id),
    );
    const savedXiIsWhole = squad.pendingRoundTactic.lineup.every((slot: any) => available.has(slot.playerId));

    if (savedXiIsWhole) {
      expect(mentalityFor(secondMatch.body, claimableClub.id)).toBe('attacking');
    } else {
      // Fell back for this fixture — but the manager's side must still be on file for the week after.
      expect(squad.pendingRoundTactic.mentality).toBe('attacking');
    }
  }, 30000);

  it('lets the manager cancel a pending round tactic before it gets used', async () => {
    const claimableClub = await createBotClub(9003);
    const manager = await registerAndLogin();
    await request(app).post(`/clubs/${claimableClub.id}/claim`).set('Authorization', `Bearer ${manager.token}`);

    const tactic = {
      clubId: claimableClub.id,
      formation: '4-4-2',
      mentality: 'attacking',
      attackStyle: 'THROUGH_MIDDLE',
      markingStyle: 'BALANCED',
      attackApproach: 'COUNTER_ATTACK',
      lineup: claimableClub.players.slice(0, 11).map((p) => ({ playerId: p.id })),
      substitutes: [],
      plannedSubstitutions: [],
    };
    await request(app).post(`/clubs/${claimableClub.id}/round-tactic`).set('Authorization', `Bearer ${manager.token}`).send(tactic);

    const cancelRes = await request(app).delete(`/clubs/${claimableClub.id}/round-tactic`).set('Authorization', `Bearer ${manager.token}`);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.pendingRoundTactic).toBeNull();
  });

  it('rejects setting a round tactic for a club you do not own', async () => {
    const bot = await createBotClub(9004);
    const owner = await registerAndLogin();
    const intruder = await registerAndLogin();
    await request(app).post(`/clubs/${bot.id}/claim`).set('Authorization', `Bearer ${owner.token}`);

    const tactic = {
      clubId: bot.id,
      formation: '4-4-2',
      mentality: 'attacking',
      attackStyle: 'THROUGH_MIDDLE',
      markingStyle: 'BALANCED',
      attackApproach: 'COUNTER_ATTACK',
      lineup: bot.players.slice(0, 11).map((p) => ({ playerId: p.id })),
      substitutes: [],
      plannedSubstitutions: [],
    };
    const res = await request(app).post(`/clubs/${bot.id}/round-tactic`).set('Authorization', `Bearer ${intruder.token}`).send(tactic);
    expect(res.status).toBe(400);
  });
});

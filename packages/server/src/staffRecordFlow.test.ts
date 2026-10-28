import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { BOT_OWNER_ID, autoFillLineup, generateStaffMarket, type StaffMember } from '@tactical-arena/shared';
import { prisma } from './db/prisma.js';
import { createClub, getClub, setPendingRoundTactic } from './services/clubService.js';
import { promoteAcademyPlayer } from './services/academyService.js';
import { evaluateMatchStaffRecords, recordPredictionOnce } from './services/staffRecordService.js';

/** Dedicated, never-reused country. */
const COUNTRY = 'CRO';

function hire(role: StaffMember['role'], rating: number): StaffMember {
  const candidate = generateStaffMarket().find((s) => s.role === role)!;
  return { ...candidate, id: `${role}-${randomUUID()}`, rating };
}

async function clubWithStaff(name: string, staff: StaffMember[], ownerId = 'manager-record') {
  const club = await createClub(ownerId, `${name} ${Date.now()}`, COUNTRY);
  await prisma.club.update({ where: { id: club.id }, data: { staffJson: JSON.stringify(staff) } });
  return getClub(club.id);
}

/**
 * What the comissão said, and whether it turned out right.
 *
 * The pipeline was built end to end and broken in two places at once: nothing ever called
 * `addStaffRecordEntry`, and `toDomain` never mapped `staffRecordJson` onto the club, so both evaluators
 * returned on their first line and the staff screen showed "Aguardando histórico" for the life of the save.
 * Every assertion here is about the loop actually closing.
 */
describe('Staff track record', () => {
  it('carries the log back out of the database', async () => {
    const club = await clubWithStaff('Registro', []);

    await recordPredictionOnce(club.id, () => false, {
      staffId: 'x',
      staffName: 'Alguém',
      role: 'FITNESS_COACH',
      rating: 70,
      dateString: '2035-04-07',
      recommendationType: 'INJURY_WARNING',
      details: 'teste',
      playerId: club.players[0].id,
    });

    /**
     * The line that made everything else inert. Without `staffRecords` on the domain club, the record is in
     * the row and invisible to every reader in the game.
     */
    const reloaded = await getClub(club.id);
    expect(reloaded.staffRecords).toHaveLength(1);
    expect(reloaded.staffRecords![0].status).toBe('PENDING');
  }, 60000);

  it('does not write the same outstanding prediction twice', async () => {
    const club = await clubWithStaff('Duplicata', []);
    const entry = {
      staffId: 'y',
      staffName: 'Alguém',
      role: 'TACTICAL_ASSISTANT' as const,
      rating: 70,
      dateString: '2035-04-07',
      recommendationType: 'TACTIC_PATTERN' as const,
      details: 'leu o adversário',
      metaJson: JSON.stringify({ opponentClubId: 'rival-1', readPattern: 'HIGH_LINE' }),
    };
    const sameOpponent = (rec: { metaJson?: string }) => JSON.parse(rec.metaJson ?? '{}').opponentClubId === 'rival-1';

    /**
     * The scouting report is a GET that fires every time the modal opens. Counting one opinion a dozen times
     * would make the accuracy figure a measure of how often the manager clicked.
     */
    await recordPredictionOnce(club.id, sameOpponent, entry);
    await recordPredictionOnce(club.id, sameOpponent, entry);
    await recordPredictionOnce(club.id, sameOpponent, entry);

    expect((await getClub(club.id)).staffRecords).toHaveLength(1);
  }, 60000);

  it('records the fitness coach warning about a player the manager picked anyway', async () => {
    const coach = hire('FITNESS_COACH', 95);
    const club = await clubWithStaff('Desgaste', [coach]);

    // One starter who will not last the ninety minutes, and a coach good enough to notice.
    const tactic = autoFillLineup(club);
    const pickedId = tactic.lineup[5].playerId;
    const players = club.players.map((p) => (p.id === pickedId ? { ...p, fatigue: 82 } : { ...p, fatigue: 10 }));
    await prisma.club.update({ where: { id: club.id }, data: { playersJson: JSON.stringify(players) } });

    await setPendingRoundTactic(club.id, 'manager-record', { ...tactic, clubId: club.id });

    const records = (await getClub(club.id)).staffRecords ?? [];
    const warning = records.find((r) => r.recommendationType === 'INJURY_WARNING');
    expect(warning, 'o preparador devia ter avisado').toBeTruthy();
    expect(warning!.playerId).toBe(pickedId);
    expect(warning!.staffName).toBe(coach.name);
  }, 60000);

  it('settles a tactical read against the opponent it was actually about', async () => {
    const assistant = hire('TACTICAL_ASSISTANT', 80);
    const club = await clubWithStaff('Leitura', [assistant]);

    const record = (opponentClubId: string, readPattern: string) =>
      recordPredictionOnce(club.id, () => false, {
        staffId: assistant.id,
        staffName: assistant.name,
        role: 'TACTICAL_ASSISTANT',
        rating: assistant.rating,
        dateString: '2035-04-07',
        recommendationType: 'TACTIC_PATTERN',
        details: `leu ${opponentClubId}`,
        metaJson: JSON.stringify({ opponentClubId, readPattern }),
      });

    await record('rival-a', 'HIGH_LINE');
    await record('rival-b', 'LOW_BLOCK_CROWD');

    // Rival A really does push up: the read about them was right, and the one about B is nobody's business.
    await evaluateMatchStaffRecords(
      await getClub(club.id),
      'rival-a',
      { formation: '4-3-3', mentality: 'attacking', attackStyle: 'BALANCED', pressing: 'HIGH_PRESS' },
      [],
      '2035-04-14',
    );

    const records = (await getClub(club.id)).staffRecords ?? [];
    const aboutA = records.find((r) => r.details.includes('rival-a'))!;
    const aboutB = records.find((r) => r.details.includes('rival-b'))!;

    expect(aboutA.status).toBe('CORRECT');
    expect(aboutA.evaluatedAt).toBe('2035-04-14');
    /**
     * The prediction about a fixture that has not been played yet must survive untouched. Judging every
     * outstanding read against whichever side happened to take the field first would mark a perfectly good
     * assistant wrong for a match they were never asked about.
     */
    expect(aboutB.status).toBe('PENDING');
  }, 60000);

  it('marks a wrong read wrong', async () => {
    const assistant = hire('TACTICAL_ASSISTANT', 60);
    const club = await clubWithStaff('Errou', [assistant]);

    await recordPredictionOnce(club.id, () => false, {
      staffId: assistant.id,
      staffName: assistant.name,
      role: 'TACTICAL_ASSISTANT',
      rating: assistant.rating,
      dateString: '2035-04-07',
      recommendationType: 'TACTIC_PATTERN',
      details: 'leu errado',
      metaJson: JSON.stringify({ opponentClubId: 'rival-c', readPattern: 'LOW_BLOCK_CROWD' }),
    });

    // They sit deep, said the assistant. They pushed up.
    await evaluateMatchStaffRecords(
      await getClub(club.id),
      'rival-c',
      { formation: '4-3-3', mentality: 'attacking', attackStyle: 'BALANCED', pressing: 'HIGH_PRESS' },
      [],
      '2035-04-14',
    );

    expect((await getClub(club.id)).staffRecords![0].status).toBe('INCORRECT');
  }, 60000);

  it('records the coordinator backing a prospect they brought up', async () => {
    const coordinator = hire('YOUTH_COORDINATOR', 90);
    const club = await clubWithStaff('Base', [coordinator]);
    const prospect = club.academyPlayers[0];

    await promoteAcademyPlayer(club.id, 'manager-record', prospect.id);

    const records = (await getClub(club.id)).staffRecords ?? [];
    const backing = records.find((r) => r.recommendationType === 'YOUTH_PROMOTION');
    expect(backing, 'o coordenador devia ficar no gancho pelo garoto').toBeTruthy();
    expect(backing!.playerId).toBe(prospect.id);
    expect(JSON.parse(backing!.metaJson!).predictedPotential).toBe(prospect.potential);
  }, 60000);

  it('says nothing at all for a club with nobody in the post', async () => {
    const club = await clubWithStaff('Vazio', []);
    const tactic = autoFillLineup(club);
    const players = club.players.map((p) => ({ ...p, fatigue: 95 }));
    await prisma.club.update({ where: { id: club.id }, data: { playersJson: JSON.stringify(players) } });

    await setPendingRoundTactic(club.id, 'manager-record', { ...tactic, clubId: club.id });

    // An empty dugout has no opinion to be right or wrong about, however tired the eleven are.
    expect((await getClub(club.id)).staffRecords ?? []).toHaveLength(0);
  }, 60000);
});

/** Keeps the bot pool untouched by this suite. */
export const OWNER = BOT_OWNER_ID;

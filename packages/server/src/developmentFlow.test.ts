import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { processWeeklyTickForClub } from './services/weeklyTickService.js';
import { turnSeasonForClub } from './services/seasonTurnService.js';

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


/** A year passes for every squad in the world, then this club is read back. */
let seasonCursor = 2026;
async function turnYear(clubId: string, token: string) {
  seasonCursor += 1;
  await turnSeasonForClub(clubId, seasonCursor);
  return (await request(app).get(`/clubs/${clubId}`).set('Authorization', `Bearer ${token}`)).body;
}

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.userId as string };
}

async function createClubFor(token: string, name: string) {
  const res = await request(app).post('/clubs').set('Authorization', `Bearer ${token}`).send({ name, country: 'BRA' });
  expect(res.status).toBe(201);
  return res.body;
}

describe('Player development flow', () => {
  it('lets an owner train a player (spending budget, boosting developmentPoints) and turn the year (consuming those points)', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Treino FC');
    /**
     * Alguém com folga até o potencial. O primeiro do elenco pode já estar no teto, e treinar quem está no
     * teto passou a ser recusado em vez de cobrado por nada.
     */
    const player = club.players.find((p: any) => p.overall < p.potential) ?? club.players[0];

    const trainRes = await request(app)
      .post(`/clubs/${club.id}/players/${player.id}/train`)
      .set('Authorization', `Bearer ${manager.token}`);
    expect(trainRes.status).toBe(200);
    expect(trainRes.body.budget).toBeLessThan(club.budget);

    const trainedPlayer = trainRes.body.players.find((p: any) => p.id === player.id);
    expect(trainedPlayer.developmentPoints).toBe(20);

    // Points bank up over the season and are cashed in at the turn — a week of rest does not spend them.
    const afterYear = await turnYear(club.id, manager.token);

    const evolvedPlayer = afterYear.players.find((p: any) => p.id === player.id);
    expect(evolvedPlayer.developmentPoints).toBe(10);
  }, 30000);

  it('applies a chosen training focus to the matching attributes on the next week turn, then clears it', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Foco FC');
    /**
     * Alguém jovem **e com folga até o potencial**.
     *
     * Só a idade não basta: um elenco gerado traz jogadores de vinte e poucos anos que já nasceram no teto
     * deles, e treinar quem está no teto passou a ser recusado em vez de cobrado. Antes o clube pagava e não
     * recebia nada, o que é o defeito que este comportamento corrige.
     */
    const player = club.players.find((p: any) => p.age <= 23 && p.overall < p.potential);
    expect(player, 'o elenco precisa ter ao menos um jovem com potencial por atingir').toBeDefined();

    const trainRes = await request(app)
      .post(`/clubs/${club.id}/players/${player.id}/train`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ focus: 'PHYSICAL' });
    expect(trainRes.status).toBe(200);

    const trainedPlayer = trainRes.body.players.find((p: any) => p.id === player.id);
    expect(trainedPlayer.trainingFocus).toBe('PHYSICAL');

    // A focused week is a week: the coaching lands on the next Monday, not at the end of the season.
    const afterWeek = await tickWeek(club.id, manager.token);

    const evolvedPlayer = afterWeek.players.find((p: any) => p.id === player.id);
    expect(evolvedPlayer.attributes.physical).toBeGreaterThan(player.attributes.physical);
    expect(evolvedPlayer.attributes.pace).toBeGreaterThan(player.attributes.pace);
    expect(evolvedPlayer.trainingFocus).toBeNull();
  }, 30000);

  it('ignores an unrecognized focus value instead of rejecting the training request', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'FocoInvalido FC');
    // Com folga até o potencial: quem está no teto é recusado, e este teste é sobre o foco inválido.
    const player = club.players.find((p: any) => p.overall < p.potential) ?? club.players[0];

    const trainRes = await request(app)
      .post(`/clubs/${club.id}/players/${player.id}/train`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ focus: 'NOT_A_REAL_FOCUS' });
    expect(trainRes.status).toBe(200);

    const trainedPlayer = trainRes.body.players.find((p: any) => p.id === player.id);
    expect(trainedPlayer.trainingFocus).toBeNull();
  });

  it('deixa o aposentado sair, em vez de reciclar a vaga dele', async () => {
    /**
     * O comportamento antigo repunha cada aposentado por um garoto de dezasseis a vinte e um anos, na mesma
     * vaga. Isso inflava o elenco, porque o substituto entrava **e** o formado da base entrava por cima:
     * medido em vinte temporadas, um elenco de 32 chegava a 56 jogadores. E o garoto que nascia assim tinha
     * 3,6 pontos de folga até o potencial contra 15,8 de quem sobe da base, ou seja, nascia reserva eterno.
     *
     * Agora quem se aposenta vai embora e a base é a única fonte de gente nova.
     */
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Eterna FC');
    const nomesOriginais = new Map(club.players.map((p: any) => [p.id, p.name]));

    let current = club;
    // Os elencos de fundação vão dos 18 aos 33, então oito anos levam os mais velhos além dos 35.
    for (let i = 0; i < 8; i++) current = await turnYear(club.id, manager.token);

    /**
     * Nenhuma vaga é herdada: um id que sumiu sumiu, e um id que ficou continua com o mesmo nome. Antes
     * disto, o mesmo id reaparecia com outro nome e outra idade, que era a "reciclagem".
     */
    const reciclados = current.players.filter(
      (p: any) => nomesOriginais.has(p.id) && p.name !== nomesOriginais.get(p.id),
    );
    expect(reciclados, 'ninguém renasce no lugar de quem se aposentou').toEqual([]);

    // Alguém saiu de facto, senão o teste não prova nada.
    const saiu = [...nomesOriginais.keys()].filter((id) => !current.players.some((p: any) => p.id === id));
    expect(saiu.length, 'oito anos têm de aposentar alguém').toBeGreaterThan(0);

    // E o piso segura o elenco num tamanho que ainda dá para escalar.
    expect(current.players.length).toBeGreaterThanOrEqual(16);
  }, 30000);

  it('docks morale for the main squad on a week spent deep in the red, leaving academy prospects untouched', async () => {
    const manager = await registerAndLogin();
    const club = await createClubFor(manager.token, 'Falido FC');

    // Deep enough in the red (many weeks of payroll underwater) that the financial-morale penalty is unmistakable.
    await prisma.club.update({ where: { id: club.id }, data: { budget: -50_000_000 } });

    const afterWeek = await tickWeek(club.id, manager.token);

    for (const player of afterWeek.players) {
      expect(player.morale).toBeLessThan(50);
    }
    for (const prospect of afterWeek.academyPlayers) {
      expect(prospect.morale).toBe(50);
    }
  }, 30000);

  /**
   * The half of this that covered advancing someone else's week is gone with the route: time is not a
   * thing one manager does to one club any more, so there is no per-club advance left to refuse.
   * Training still is, and still is refused.
   */
  it('rejects training a player at a club you do not own', async () => {
    const owner = await registerAndLogin();
    const intruder = await registerAndLogin();
    const club = await createClubFor(owner.token, 'Clube Protegido');

    const trainRes = await request(app)
      // Com folga até o potencial: treinar quem está no teto é recusado, e o teste é sobre o foco inválido.
      .post(`/clubs/${club.id}/players/${(club.players.find((p: any) => p.overall < p.potential) ?? club.players[0]).id}/train`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(trainRes.status).toBe(400);
  });
});

import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';

const app = createApp();

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string };
}

async function createClubFor(token: string, name: string, country: string = 'BRA') {
  const res = await request(app).post('/clubs').set('Authorization', `Bearer ${token}`).send({ name, country });
  expect(res.status).toBe(201);
  return res.body;
}

async function getNews(token: string, clubId: string) {
  const res = await request(app).get(`/clubs/${clubId}/news`).set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body as { category: string; headline: string; clubId: string }[];
}

describe('News engine', () => {
  it('generates a match result headline for both sides once a match finishes', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const clubA = await createClubFor(managerA.token, `Notícia A ${randomUUID().slice(0, 8)}`);
    const clubB = await createClubFor(managerB.token, `Notícia B ${randomUUID().slice(0, 8)}`);

    const storedClubA = await prisma.club.findUniqueOrThrow({ where: { id: clubA.id } });
    const players = JSON.parse(storedClubA.playersJson);
    const patient = players[players.length - 1];
    patient.injuryWeeks = 4;
    await prisma.club.update({
      where: { id: clubA.id },
      data: {
        playersJson: JSON.stringify(players),
        staffJson: JSON.stringify({
          staff: [{
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
          }],
          delegationConfig: { presetMode: 'custom', injuryRehab: 'auto_fastest' },
        }),
      },
    });

    const match = (
      await request(app)
        .post('/matches')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ homeClubId: clubA.id, awayClubId: clubB.id })
    ).body;

    const tacticFor = (club: any) => ({
      clubId: club.id,
      formation: '4-4-2',
      mentality: 'balanced',
      attackStyle: 'THROUGH_MIDDLE',
      markingStyle: 'BALANCED',
      attackApproach: 'COUNTER_ATTACK',
      lineup: club.players.slice(0, 11).map((p: any) => ({ playerId: p.id })),
    });

    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerA.token}`).send(tacticFor(clubA));
    await request(app).post(`/matches/${match.id}/tactic`).set('Authorization', `Bearer ${managerB.token}`).send(tacticFor(clubB));

    const fulltime = await request(app)
      .post(`/matches/${match.id}/live/advance`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ toMinute: 90 });
    expect(fulltime.status).toBe(200);
    expect(fulltime.body.status).toBe('SIMULATED');

    const newsA = await getNews(managerA.token, clubA.id);
    const newsB = await getNews(managerB.token, clubB.id);

    const resultA = newsA.find((n) => n.category === 'MATCH_RESULT');
    const resultB = newsB.find((n) => n.category === 'MATCH_RESULT');
    expect(resultA).toBeDefined();
    expect(resultB).toBeDefined();
    expect(resultA!.headline).toContain(clubA.name);
    expect(resultA!.headline).toContain(clubB.name);
    expect(resultB!.headline).toContain(clubA.name);
    expect(resultB!.headline).toContain(clubB.name);

    const updatedClubA = await prisma.club.findUniqueOrThrow({ where: { id: clubA.id } });
    const updatedPatient = JSON.parse(updatedClubA.playersJson).find((player: { id: string }) => player.id === patient.id);
    expect(updatedPatient.injuryWeeks).toBe(1);
    const patientMedicalNews = newsA.filter((item) =>
      item.headline.startsWith('🏥 Fisioterapia:') && item.headline.includes(patient.name),
    );
    expect(patientMedicalNews).toHaveLength(1);
    expect(patientMedicalNews[0].headline).toContain('2 semanas');
  });

  it('generates transfer in/out headlines for buyer and seller when a listing is bought', async () => {
    const managerA = await registerAndLogin();
    const managerB = await registerAndLogin();
    const clubA = await createClubFor(managerA.token, `Vendedor Notícia ${randomUUID().slice(0, 8)}`);
    const clubB = await createClubFor(managerB.token, `Comprador Notícia ${randomUUID().slice(0, 8)}`);
    const player = clubA.players[0];

    const listing = (
      await request(app)
        .post('/transfers/listings')
        .set('Authorization', `Bearer ${managerA.token}`)
        .send({ clubId: clubA.id, playerId: player.id, askingPrice: 10_000 })
    ).body;

    const buyRes = await request(app)
      .post(`/transfers/listings/${listing.id}/buy`)
      .set('Authorization', `Bearer ${managerB.token}`)
      .send({ buyerClubId: clubB.id });
    expect(buyRes.status).toBe(204);

    const sellerNews = await getNews(managerA.token, clubA.id);
    const buyerNews = await getNews(managerB.token, clubB.id);

    const transferOut = sellerNews.find((n) => n.category === 'TRANSFER_OUT');
    const transferIn = buyerNews.find((n) => n.category === 'TRANSFER_IN');
    expect(transferOut).toBeDefined();
    expect(transferIn).toBeDefined();
    expect(transferOut!.headline).toContain(player.name);
    expect(transferIn!.headline).toContain(player.name);
  });

  it('generates a title headline for the league champion once the season finishes', async () => {
    const COUNTRY = 'PER';
    const managers = await Promise.all([registerAndLogin(), registerAndLogin(), registerAndLogin(), registerAndLogin()]);
    const clubs: any[] = [];
    for (let i = 0; i < managers.length; i++) {
      clubs.push(await createClubFor(managers[i].token, `Título Liga ${randomUUID().slice(0, 8)}`, COUNTRY));
    }
    const clubIdToToken: Record<string, string> = {};
    clubs.forEach((c, i) => {
      clubIdToToken[c.id] = managers[i].token;
    });

    const leaguesRes = await request(app).get(`/leagues?country=${COUNTRY}`).set('Authorization', `Bearer ${managers[0].token}`);
    const league = leaguesRes.body.find((l: any) => l.clubIds.includes(clubs[0].id));
    expect(league).toBeDefined();

    const startRes = await request(app).post(`/leagues/${league.id}/force-start`).set('Authorization', `Bearer ${managers[0].token}`);
    expect(startRes.status).toBe(200);

    let current = startRes.body;
    let guard = 0;
    while (current.status !== 'FINISHED' && guard < 60) {
      const advanceRes = await request(app).post(`/leagues/${league.id}/advance-round`).set('Authorization', `Bearer ${managers[0].token}`);
      expect(advanceRes.status).toBe(200);
      current = advanceRes.body;
      for (const fixture of current.fixtures) {
        if (!fixture.matchId) continue;
        const token = clubIdToToken[fixture.homeClubId] ?? clubIdToToken[fixture.awayClubId];
        if (!token) continue;
        const match = (await request(app).get(`/matches/${fixture.matchId}`).set('Authorization', `Bearer ${token}`)).body;
        if (match.status === 'LIVE') {
          await request(app).post(`/matches/${fixture.matchId}/live/advance`).set('Authorization', `Bearer ${token}`).send({ toMinute: 90 });
        }
      }
      guard++;
    }
    expect(current.status).toBe('FINISHED');

    const detailRes = await request(app).get(`/leagues/${league.id}`).set('Authorization', `Bearer ${managers[0].token}`);
    const championId: string = detailRes.body.championClubId;
    expect(championId).toBeDefined();

    const championToken = clubIdToToken[championId];
    const championNews = await getNews(championToken, championId);
    const title = championNews.find((n) => n.category === 'TITLE');
    expect(title).toBeDefined();
    expect(title!.headline).toContain(league.name);
  }, 60000);

  it('generates a title headline for the cup champion once the bracket finishes', async () => {
    const COUNTRY = 'KOR';
    const owner = await registerAndLogin();
    const clubs = [];
    for (let i = 0; i < 4; i++) {
      clubs.push(await createClubFor(owner.token, `Copa Notícia ${randomUUID().slice(0, 8)}`, COUNTRY));
    }
    const clubIds = clubs.map((c) => c.id);

    const createRes = await request(app)
      .post('/cups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Copa das Notícias', countryCode: COUNTRY, clubIds });
    expect(createRes.status).toBe(201);

    let current = createRes.body;
    let guard = 0;
    while (current.status !== 'FINISHED' && guard < 20) {
      const advanceRes = await request(app).post(`/cups/${current.id}/advance-round`).set('Authorization', `Bearer ${owner.token}`);
      expect(advanceRes.status).toBe(200);
      current = advanceRes.body;
      for (const fixture of current.fixtures) {
        if (!fixture.matchId || fixture.winnerClubId !== null) continue;
        const match = (await request(app).get(`/matches/${fixture.matchId}`).set('Authorization', `Bearer ${owner.token}`)).body;
        if (match.status === 'LIVE') {
          await request(app).post(`/matches/${fixture.matchId}/live/advance`).set('Authorization', `Bearer ${owner.token}`).send({ toMinute: 90 });
        }
      }
      guard++;
    }
    expect(current.status).toBe('FINISHED');

    const championId: string = current.championClubId;
    const championNews = await getNews(owner.token, championId);
    const title = championNews.find((n) => n.category === 'TITLE');
    expect(title).toBeDefined();
    expect(title!.headline).toContain('Copa das Notícias');
  }, 60000);
});

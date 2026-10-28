// The team editor is desktop-only in real usage (see middleware/desktopOnly.ts) — DESKTOP_MODE is only
// ever set by packages/desktop/src/main.js in a packaged build. Setting it here, before createApp() is
// even called, is the only way to exercise the editor's routes against the dev server in tests.
process.env['DESKTOP_MODE'] = 'true';

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { BOT_OWNER_ID, generateAcademy, generateStarterSquad } from '@tactical-arena/shared';
import { createApp } from './app.js';
import { prisma } from './db/prisma.js';
import { joinOrCreateLeague } from './services/leagueService.js';

const app = createApp();
const COUNTRY = 'JPN';
let divisionCounter = 9200;
function nextDivision() {
  return divisionCounter++;
}

async function registerAndLogin() {
  const email = `${randomUUID()}@test.com`;
  const res = await request(app).post('/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { token: res.body.token as string };
}

async function createBotClub(division: number, country = COUNTRY) {
  const id = randomUUID();
  const players = generateStarterSquad(id, country);
  const academyPlayers = generateAcademy(id, country);
  const slug = `editor-test-${id.slice(0, 8)}`;

  await prisma.club.create({
    data: {
      id,
      name: `Bot Club ${id.slice(0, 8)}`,
      ownerId: BOT_OWNER_ID,
      slug,
      country,
      playersJson: JSON.stringify(players),
      academyPlayersJson: JSON.stringify(academyPlayers),
    },
  });
  await joinOrCreateLeague(id, country, division);

  return { id, slug, players };
}

const VALID_PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');
const INVALID_PNG_BASE64 = Buffer.from('not actually a png').toString('base64');

describe('Team editor — desktop gate', () => {
  it('rejects every editor route with 403 when DESKTOP_MODE is not set', async () => {
    delete process.env['DESKTOP_MODE'];
    try {
      const res = await request(app).get('/team-editor/clubs');
      expect(res.status).toBe(403);
    } finally {
      process.env['DESKTOP_MODE'] = 'true';
    }
  });
});

describe('Team editor — edit player', () => {
  it('recomputes overall/marketValue/wage/releaseClause from edited attributes, and ignores an attempt to smuggle potential/starLevel', async () => {
    const manager = await registerAndLogin();
    const club = await createBotClub(nextDivision());
    const player = club.players[0];
    const originalPotential = player.potential;

    const res = await request(app)
      .patch(`/team-editor/clubs/${club.id}/players/${player.id}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        attributes: { finishing: 99, pace: 99, passing: 99, defending: 99, physical: 99, goalkeeping: 99 },
        // Not part of PlayerEditPatch's shape — the service never reads these fields at all.
        potential: 99,
        starLevel: 'NATURAL',
      });

    expect(res.status).toBe(200);
    const updated = res.body.players.find((p: any) => p.id === player.id);
    expect(updated.attributes.finishing).toBe(99);
    expect(updated.overall).toBeGreaterThan(player.overall);
    expect(updated.potential).toBe(originalPotential);
    expect(updated.starLevel).toBe(player.starLevel);
    expect(updated.marketValue).toBeGreaterThan(0);
  });

  it('404s (via 400) editing a player who does not belong to the club', async () => {
    const manager = await registerAndLogin();
    const club = await createBotClub(nextDivision());

    const res = await request(app)
      .patch(`/team-editor/clubs/${club.id}/players/nonexistent-id`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Novo Nome' });

    expect(res.status).toBe(400);
  });
});

describe('Team editor — create/delete player', () => {
  it('creates a player with starLevel NONE and potential equal to overall, even if the request tries to force otherwise', async () => {
    const manager = await registerAndLogin();
    const club = await createBotClub(nextDivision());

    const res = await request(app)
      .post(`/team-editor/clubs/${club.id}/players`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        name: 'Novo Camisa 10',
        age: 22,
        nationality: 'BRA',
        position: 'ATT',
        preferredFoot: 'RIGHT',
        attributes: { pace: 80, finishing: 85, passing: 70, defending: 20, physical: 60, goalkeeping: 5 },
        potential: 99,
        starLevel: 'NATURAL',
      });

    expect(res.status).toBe(201);
    const created = res.body.players.find((p: any) => p.name === 'Novo Camisa 10');
    expect(created.starLevel).toBe('NONE');
    expect(created.potential).toBe(created.overall);
  });

  it('deletes a player and clears role fields that pointed at them', async () => {
    const manager = await registerAndLogin();
    const club = await createBotClub(nextDivision());
    const player = club.players[0];

    await prisma.club.update({ where: { id: club.id }, data: { tutorPlayerId: player.id } });

    const res = await request(app)
      .delete(`/team-editor/clubs/${club.id}/players/${player.id}`)
      .set('Authorization', `Bearer ${manager.token}`);

    expect(res.status).toBe(200);
    expect(res.body.players.some((p: any) => p.id === player.id)).toBe(false);
    expect(res.body.tutorPlayerId).toBeNull();
  });
});

describe('Team editor — instant transfer', () => {
  it('moves a player between two clubs instantly and clears role fields on the source club', async () => {
    const manager = await registerAndLogin();
    const from = await createBotClub(nextDivision());
    const to = await createBotClub(nextDivision());
    const player = from.players[0];

    await prisma.club.update({ where: { id: from.id }, data: { captainPlayerId: player.id } });

    const res = await request(app)
      .post('/team-editor/transfers')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ playerId: player.id, fromClubId: from.id, toClubId: to.id });

    expect(res.status).toBe(200);
    expect(res.body.from.players.some((p: any) => p.id === player.id)).toBe(false);
    expect(res.body.from.captainPlayerId).toBeNull();
    expect(res.body.to.players.some((p: any) => p.id === player.id)).toBe(true);
  });
});

describe('Team editor — create club', () => {
  it('creates a club that joins the requested league/division', async () => {
    const manager = await registerAndLogin();
    const division = nextDivision();
    const slug = `new-editor-club-${randomUUID().slice(0, 8)}`;

    const res = await request(app)
      .post('/team-editor/clubs')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Clube Novo FC', slug, country: COUNTRY, division });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe(slug);

    const leaguesRes = await request(app).get(`/leagues?country=${COUNTRY}&division=${division}`).set('Authorization', `Bearer ${manager.token}`);
    const league = leaguesRes.body.find((l: any) => l.clubIds.includes(res.body.id));
    expect(league).toBeDefined();
  });

  it('rejects a duplicate slug with a clear 400, not a raw 500', async () => {
    const manager = await registerAndLogin();
    const division = nextDivision();
    const slug = `dup-slug-${randomUUID().slice(0, 8)}`;

    const first = await request(app)
      .post('/team-editor/clubs')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Primeiro', slug, country: COUNTRY, division });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/team-editor/clubs')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Segundo', slug, country: COUNTRY, division: nextDivision() });
    expect(second.status).toBe(400);
  });

  it('rejects a slug outside the allowed pattern', async () => {
    const manager = await registerAndLogin();

    const res = await request(app)
      .post('/team-editor/clubs')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ name: 'Clube Malicioso', slug: '../../etc/passwd', country: COUNTRY, division: nextDivision() });

    expect(res.status).toBe(400);
  });
});

describe('Team editor — crest upload', () => {
  it('accepts a valid small PNG', async () => {
    const manager = await registerAndLogin();
    const club = await createBotClub(nextDivision());

    const res = await request(app)
      .post(`/team-editor/clubs/${club.slug}/crest`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ base64Png: VALID_PNG_BASE64 });

    expect(res.status).toBe(204);
    const crestFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'content', 'crests', `${club.slug}.png`);
    fs.rmSync(crestFile, { force: true });
  });

  it('rejects content without a valid PNG magic number', async () => {
    const manager = await registerAndLogin();
    const club = await createBotClub(nextDivision());

    const res = await request(app)
      .post(`/team-editor/clubs/${club.slug}/crest`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ base64Png: INVALID_PNG_BASE64 });

    expect(res.status).toBe(400);
  });

  it('rejects a slug outside the allowed pattern', async () => {
    const manager = await registerAndLogin();

    const res = await request(app)
      .post('/team-editor/clubs/../../malicious/crest')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({ base64Png: VALID_PNG_BASE64 });

    // Express normalizes the path-traversal segments out of the URL itself before routing — either way,
    // this must never reach a filesystem write outside the crests directory.
    expect([400, 404]).toContain(res.status);
  });
});

describe('Team editor — mod pack export/import', () => {
  it('exports every club that has a slug', async () => {
    const manager = await registerAndLogin();
    const club = await createBotClub(nextDivision());

    const res = await request(app).get('/team-editor/export').set('Authorization', `Bearer ${manager.token}`);

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.clubs.some((c: any) => c.slug === club.slug)).toBe(true);
  });

  it('updates an existing bot-owned club and clears its role fields, skips a club owned by a real user, and creates a brand-new club', async () => {
    const manager = await registerAndLogin();
    const botClub = await createBotClub(nextDivision());
    await prisma.club.update({ where: { id: botClub.id }, data: { captainPlayerId: botClub.players[0].id } });

    const ownedClub = await createBotClub(nextDivision());
    await prisma.club.update({ where: { id: ownedClub.id }, data: { ownerId: 'some-real-user-id' } });

    const newSlug = `brand-new-${randomUUID().slice(0, 8)}`;
    const pack = {
      version: 1,
      clubs: [
        {
          slug: botClub.slug,
          name: 'Elenco Atualizado',
          country: COUNTRY,
          division: nextDivision(),
          players: botClub.players,
          academyPlayers: [],
          crestBase64: null,
        },
        {
          slug: ownedClub.slug,
          name: 'Não Deveria Aplicar',
          country: COUNTRY,
          division: nextDivision(),
          players: [],
          academyPlayers: [],
          crestBase64: null,
        },
        {
          slug: newSlug,
          name: 'Clube Recém-Chegado',
          country: COUNTRY,
          division: nextDivision(),
          players: generateStarterSquad(newSlug, COUNTRY),
          academyPlayers: [],
          crestBase64: null,
        },
      ],
    };

    const res = await request(app).post('/team-editor/import').set('Authorization', `Bearer ${manager.token}`).send(pack);

    expect(res.status).toBe(200);
    expect(res.body.updated).toContain(botClub.slug);
    expect(res.body.skippedOwned).toContain(ownedClub.slug);
    expect(res.body.created).toContain(newSlug);

    const updatedBotClub = await prisma.club.findUnique({ where: { id: botClub.id } });
    expect(updatedBotClub?.name).toBe('Elenco Atualizado');
    expect(updatedBotClub?.captainPlayerId).toBeNull();

    const untouchedOwnedClub = await prisma.club.findUnique({ where: { id: ownedClub.id } });
    expect(untouchedOwnedClub?.name).not.toBe('Não Deveria Aplicar');
  });
});

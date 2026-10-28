import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { describe, it, expect, afterEach } from 'vitest';
import { ensureSchema, TABLE_MIGRATIONS } from './ensureSchema.js';

/**
 * Regression coverage for a bug class that has bitten this project three separate times: a returning
 * player's save predates some table/column the current build's schema.prisma expects, and every query
 * touching it throws "no such table"/"no such column" — surfacing as a bare "erro interno do servidor"
 * with no other clue. Builds a genuinely old/incomplete database by hand (not through Prisma, which would
 * always create the CURRENT schema) and proves ensureSchema heals it into something the real app can
 * actually query afterward.
 */
describe('ensureSchema', () => {
  const scratchClients: PrismaClient[] = [];
  const scratchFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(scratchClients.map((c) => c.$disconnect()));
    scratchClients.length = 0;
    for (const file of scratchFiles) {
      fs.rmSync(file, { force: true });
    }
    scratchFiles.length = 0;
  });

  function scratchClient(): PrismaClient {
    const file = path.join(os.tmpdir(), `ensure-schema-test-${randomUUID()}.db`);
    scratchFiles.push(file);
    const client = new PrismaClient({ datasources: { db: { url: `file:${file.replace(/\\/g, '/')}` } } });
    scratchClients.push(client);
    return client;
  }

  it('adds a column missing from an existing table (the actual Club.pendingRoundTacticJson regression)', async () => {
    const client = scratchClient();
    // A deliberately old Club table: has titlesWon (an earlier migration) but predates
    // pendingRoundTacticJson — exactly the gap that shipped to a beta tester's save.
    await client.$executeRawUnsafe(`CREATE TABLE "Club" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "ownerId" TEXT NOT NULL,
      "slug" TEXT,
      "country" TEXT NOT NULL DEFAULT 'BRA',
      "playersJson" TEXT NOT NULL,
      "academyPlayersJson" TEXT NOT NULL DEFAULT '[]',
      "budget" INTEGER NOT NULL DEFAULT 5000000,
      "captainPlayerId" TEXT,
      "captainWeeksServed" INTEGER NOT NULL DEFAULT 0,
      "tutorPlayerId" TEXT,
      "penaltyTakerId" TEXT,
      "freeKickTakerId" TEXT,
      "cornerLeftTakerId" TEXT,
      "cornerRightTakerId" TEXT,
      "stadiumLevel" INTEGER NOT NULL DEFAULT 1,
      "stadiumCapacity" INTEGER NOT NULL DEFAULT 20000,
      "titlesWon" INTEGER NOT NULL DEFAULT 0,
      "sponsorshipsJson" TEXT NOT NULL DEFAULT '[]',
      "loansJson" TEXT NOT NULL DEFAULT '[]',
      "pendingTransferPaymentsJson" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await client.$executeRawUnsafe(
      `INSERT INTO "Club" (id, name, ownerId, playersJson) VALUES ('c1', 'Old Save FC', 'u1', '[]')`,
    );

    await ensureSchema(client);

    const columns = await client.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Club")`);
    expect(columns.some((c) => c.name === 'pendingRoundTacticJson')).toBe(true);

    // Not just present in the schema — actually queryable, the way clubService.toDomain reads it.
    const row = await client.$queryRawUnsafe<Array<{ pendingRoundTacticJson: string | null }>>(
      `SELECT pendingRoundTacticJson FROM "Club" WHERE id = 'c1'`,
    );
    expect(row[0].pendingRoundTacticJson).toBeNull();

    const lockerRoom = await client.$queryRawUnsafe<Array<{ lockerRoomJson: string }>>(
      `SELECT lockerRoomJson FROM "Club" WHERE id = 'c1'`,
    );
    expect(lockerRoom[0].lockerRoomJson).toBe('{}');
  });

  it('creates a table missing entirely from an old save (e.g. ManagerTenure, added with the career feature)', async () => {
    const client = scratchClient();
    await client.$executeRawUnsafe(`CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

    await ensureSchema(client);

    const tables = await client.$queryRawUnsafe<Array<{ name: string }>>(`SELECT name FROM sqlite_master WHERE type='table'`);
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('ManagerTenure');
    expect(tableNames).toContain('JobOffer');
    expect(tableNames).toContain('Club');

    // A fresh CREATE TABLE gets every current column, including ones added long after the table itself.
    await client.$executeRawUnsafe(
      `INSERT INTO "ManagerTenure" (id, userId, clubId, clubName, countryCode) VALUES ('t1', 'u1', 'c1', 'Nova FC', 'BRA')`,
    );
    const rows = await client.$queryRawUnsafe<Array<{ endReason: string | null }>>(`SELECT endReason FROM "ManagerTenure" WHERE id = 't1'`);
    expect(rows[0].endReason).toBeNull();
  });

  it('is idempotent — running it twice in a row does not error or duplicate columns', async () => {
    const client = scratchClient();
    await ensureSchema(client);
    await expect(ensureSchema(client)).resolves.not.toThrow();
  });

  /**
   * O guarda que faltava.
   *
   * As duas coberturas acima provam que `ensureSchema` cura o que ele conhece. Não provam que ele conhece
   * tudo — e a quarta ocorrência deste bug foi exatamente essa: `kitPattern`, `primaryColor`,
   * `secondaryColor` e `crestBase64` entraram no schema.prisma e não entraram na lista, então todo save
   * anterior a elas quebrava em qualquer leitura de clube, com P2022, e não só na tela do uniforme.
   *
   * Este teste lê o schema.prisma de verdade em vez de uma cópia: uma cópia envelhece igual à lista que
   * ela deveria vigiar.
   */
  it('conhece toda coluna escalar do schema.prisma, para nenhuma migração ficar para trás', () => {
    const schemaPath = fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url));
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    const ESCALARES = ['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'BigInt', 'Decimal'];
    const conhecidas = new Map(TABLE_MIGRATIONS.map((t) => [t.table, new Set(t.columns.map((c) => c.name))]));

    const faltando: string[] = [];
    for (const [, modelo, corpo] of schema.matchAll(/model (\w+) \{([^}]*)\}/g)) {
      const colunas = corpo
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
        .map((l) => l.split(/\s+/))
        .filter((p) => p.length >= 2)
        // Relação (o tipo é outro model) e lista não viram coluna na tabela.
        .filter(([, tipo]) => ESCALARES.some((e) => tipo.startsWith(e)) && !tipo.endsWith('[]'))
        .map(([campo]) => campo);

      const tem = conhecidas.get(modelo);
      if (!tem) {
        faltando.push(`${modelo}: tabela inteira ausente do ensureSchema`);
        continue;
      }
      for (const coluna of colunas) {
        if (!tem.has(coluna)) faltando.push(`${modelo}.${coluna}`);
      }
    }

    expect(faltando).toEqual([]);
  });
});

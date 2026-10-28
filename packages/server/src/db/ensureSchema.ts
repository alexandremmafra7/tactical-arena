import { prisma } from './prisma.js';

/**
 * Just the two raw-SQL escapes this needs, rather than a whole PrismaClient.
 *
 * The shared client is extended (see prisma.ts), so it is no longer assignable to the bare `PrismaClient`
 * type — and it never needed to be: everything below is DDL, which Prisma's typed API cannot express
 * anyway. Narrowing the parameter also keeps a scratch client pointed at a throwaway database usable
 * here, which is how the tests prove this heals an old schema.
 */
interface RawSqlClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

interface ColumnDef {
  /** Name Prisma gives the column — used to check PRAGMA table_info for presence. */
  name: string;
  /** The column's full DDL clause exactly as it belongs inside CREATE TABLE, e.g.
   *  `"budget" INTEGER NOT NULL DEFAULT 5000000`. Reused verbatim for both CREATE TABLE (a brand-new
   *  table gets every column joined together) and ALTER TABLE ADD COLUMN (an existing table missing this
   *  one column gets just this clause appended) — a single source of truth per column, so there's no
   *  longer a separate "remember to also list it as a migration" step that's easy to forget (see below). */
  ddl: string;
}

interface TableMigration {
  table: string;
  columns: ColumnDef[];
}

/**
 * This project has no Prisma migration history — schema changes are applied to the dev/prod DB via
 * `prisma db push` as a manual deploy step. The desktop build has no equivalent: it copies template.db
 * into the user's profile only on first-ever launch (see main.js ensureDatabase) and never touches it
 * again, so a returning player's save can be missing whole tables or individual columns a newer build's
 * schema expects — every query touching them then throws "no such table"/"no such column", surfacing to
 * the player as a bare "erro interno do servidor". This self-heals both cases in place on every startup,
 * before the server accepts requests.
 *
 * Every column of every table is listed here (not just the ones known to have been added after some
 * earlier save) — CREATE TABLE IF NOT EXISTS for a save old enough to predate the whole table, ALTER
 * TABLE ADD COLUMN for every INDIVIDUAL column PRAGMA table_info reports missing on an existing table.
 * That "diff the full column list, not a hand-picked subset" shape is deliberate: an earlier version of
 * this file tracked "added later" columns in a separate list from the CREATE TABLE DDL, and it was
 * genuinely easy to update schema.prisma without remembering to also add the column here — which is
 * exactly what happened to `Club.pendingRoundTacticJson` (present in the CREATE DDL below, but missing
 * from that old separate list, so a save that predated it never got the column backfilled). Diffing
 * against the complete column set removes that whole class of "forgot to list it twice" bug — updating
 * the column list below (which schema.prisma changes require anyway, to keep this file in sync) is now
 * the only step needed.
 *
 * "Atualizar a lista aqui é o único passo necessário" só vale enquanto alguém lembra de dar esse passo, e
 * na quarta vez ninguém lembrou: `kitPattern`, `primaryColor`, `secondaryColor` e `crestBase64` entraram
 * no schema.prisma e não entraram aqui, derrubando toda leitura de clube num save anterior a elas. Por
 * isso a lista agora é exportada: `ensureSchema.test.ts` compara com o schema.prisma e quebra o build na
 * próxima vez, em vez de esperar a carreira de alguém quebrar.
 */
export const TABLE_MIGRATIONS: TableMigration[] = [
  {
    /** Jogador sem clube. Ver contract.ts e o model FreeAgent no schema. */
    table: 'FreeAgent',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'playerJson', ddl: `"playerJson" TEXT NOT NULL` },
      { name: 'country', ddl: `"country" TEXT NOT NULL` },
      { name: 'overall', ddl: `"overall" INTEGER NOT NULL DEFAULT 0` },
      { name: 'position', ddl: `"position" TEXT NOT NULL DEFAULT 'MID'` },
      { name: 'sinceSeason', ddl: `"sinceSeason" INTEGER NOT NULL DEFAULT 0` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    /** Treinador do mundo, do jogador ou da máquina. Ver managerService.ts. */
    table: 'Manager',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'name', ddl: `"name" TEXT NOT NULL` },
      { name: 'nationality', ddl: `"nationality" TEXT` },
      { name: 'reputation', ddl: `"reputation" INTEGER NOT NULL DEFAULT 50` },
      { name: 'userId', ddl: `"userId" TEXT` },
      { name: 'clubId', ddl: `"clubId" TEXT` },
      { name: 'confidence', ddl: `"confidence" INTEGER NOT NULL DEFAULT 60` },
      { name: 'warnings', ddl: `"warnings" INTEGER NOT NULL DEFAULT 0` },
      { name: 'confidenceReason', ddl: `"confidenceReason" TEXT` },
      { name: 'trophiesJson', ddl: `"trophiesJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    /** Sondagem de um clube a um treinador empregado. Ver approachService.ts. */
    table: 'ManagerApproach',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'managerId', ddl: `"managerId" TEXT NOT NULL` },
      { name: 'clubId', ddl: `"clubId" TEXT NOT NULL` },
      { name: 'fromClubId', ddl: `"fromClubId" TEXT` },
      { name: 'status', ddl: `"status" TEXT NOT NULL DEFAULT 'PENDING'` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'User',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'email', ddl: `"email" TEXT NOT NULL` },
      { name: 'passwordHash', ddl: `"passwordHash" TEXT NOT NULL` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'Club',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'name', ddl: `"name" TEXT NOT NULL` },
      { name: 'ownerId', ddl: `"ownerId" TEXT NOT NULL` },
      { name: 'slug', ddl: `"slug" TEXT` },
      { name: 'country', ddl: `"country" TEXT NOT NULL DEFAULT 'BRA'` },
      { name: 'playersJson', ddl: `"playersJson" TEXT NOT NULL` },
      { name: 'academyPlayersJson', ddl: `"academyPlayersJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'budget', ddl: `"budget" INTEGER NOT NULL DEFAULT 5000000` },
      { name: 'captainPlayerId', ddl: `"captainPlayerId" TEXT` },
      { name: 'captainWeeksServed', ddl: `"captainWeeksServed" INTEGER NOT NULL DEFAULT 0` },
      { name: 'tutorPlayerId', ddl: `"tutorPlayerId" TEXT` },
      { name: 'penaltyTakerId', ddl: `"penaltyTakerId" TEXT` },
      { name: 'freeKickTakerId', ddl: `"freeKickTakerId" TEXT` },
      { name: 'cornerLeftTakerId', ddl: `"cornerLeftTakerId" TEXT` },
      { name: 'cornerRightTakerId', ddl: `"cornerRightTakerId" TEXT` },
      { name: 'stadiumLevel', ddl: `"stadiumLevel" INTEGER NOT NULL DEFAULT 1` },
      { name: 'stadiumCapacity', ddl: `"stadiumCapacity" INTEGER NOT NULL DEFAULT 20000` },
      { name: 'stadiumTier', ddl: `"stadiumTier" INTEGER NOT NULL DEFAULT 1` },
      { name: 'stadiumUpgradeWeek', ddl: `"stadiumUpgradeWeek" INTEGER` },
      { name: 'stadiumName', ddl: `"stadiumName" TEXT` },
      { name: 'titlesWon', ddl: `"titlesWon" INTEGER NOT NULL DEFAULT 0` },
      { name: 'membersCount', ddl: `"membersCount" INTEGER` },
      { name: 'stadiumConstructionJson', ddl: `"stadiumConstructionJson" TEXT` },
      { name: 'sponsorshipsJson', ddl: `"sponsorshipsJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'loansJson', ddl: `"loansJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'pendingTransferPaymentsJson', ddl: `"pendingTransferPaymentsJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'pendingRoundTacticJson', ddl: `"pendingRoundTacticJson" TEXT` },
      { name: 'staffJson', ddl: `"staffJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'staffRecordJson', ddl: `"staffRecordJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'city', ddl: `"city" TEXT` },
      { name: 'state', ddl: `"state" TEXT` },
      { name: 'pendingRestWeeks', ddl: `"pendingRestWeeks" INTEGER NOT NULL DEFAULT 0` },
      { name: 'weeklyWageBill', ddl: `"weeklyWageBill" INTEGER NOT NULL DEFAULT 0` },
      { name: 'academyWageBill', ddl: `"academyWageBill" INTEGER NOT NULL DEFAULT 0` },
      { name: 'ratingAttack', ddl: `"ratingAttack" REAL NOT NULL DEFAULT 0` },
      { name: 'ratingDefense', ddl: `"ratingDefense" REAL NOT NULL DEFAULT 0` },
      { name: 'ratingGoalkeeping', ddl: `"ratingGoalkeeping" REAL NOT NULL DEFAULT 0` },
      { name: 'pendingMatchesPlayed', ddl: `"pendingMatchesPlayed" INTEGER NOT NULL DEFAULT 0` },
      { name: 'scorerPoolJson', ddl: `"scorerPoolJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'bankGuaranteesJson', ddl: `"bankGuaranteesJson" TEXT NOT NULL DEFAULT '[]'` },
      /*
       * Identidade visual do clube. Estas quatro entraram no schema.prisma e não entraram aqui, que é o
       * único mecanismo de migração do projeto — o resultado é que todo save criado antes delas quebrava
       * em *qualquer* leitura de clube depois da atualização, com P2022 "column does not exist", e não só
       * na tela do uniforme. Foi assim que o dev.db desta máquina parou de responder e o jogo caiu para o
       * modo offline sozinho. Uma carreira de jogador teria acabado do mesmo jeito.
       */
      { name: 'kitPattern', ddl: `"kitPattern" TEXT` },
      { name: 'primaryColor', ddl: `"primaryColor" TEXT` },
      { name: 'secondaryColor', ddl: `"secondaryColor" TEXT` },
      { name: 'crestBase64', ddl: `"crestBase64" TEXT` },
      { name: 'trophiesJson', ddl: `"trophiesJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'recordBookJson', ddl: `"recordBookJson" TEXT NOT NULL DEFAULT '{}'` },
      { name: 'lockerRoomJson', ddl: `"lockerRoomJson" TEXT NOT NULL DEFAULT '{}'` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'League',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'countryCode', ddl: `"countryCode" TEXT NOT NULL` },
      { name: 'division', ddl: `"division" INTEGER NOT NULL DEFAULT 1` },
      { name: 'name', ddl: `"name" TEXT NOT NULL` },
      { name: 'capacity', ddl: `"capacity" INTEGER NOT NULL` },
      { name: 'status', ddl: `"status" TEXT NOT NULL DEFAULT 'OPEN'` },
      { name: 'clubIdsJson', ddl: `"clubIdsJson" TEXT NOT NULL` },
      { name: 'fixturesJson', ddl: `"fixturesJson" TEXT NOT NULL` },
      { name: 'season', ddl: `"season" INTEGER NOT NULL DEFAULT 1` },
      { name: 'championClubId', ddl: `"championClubId" TEXT` },
      { name: 'championOwnerId', ddl: `"championOwnerId" TEXT` },
      { name: 'topScorerPlayerId', ddl: `"topScorerPlayerId" TEXT` },
      { name: 'topScorerName', ddl: `"topScorerName" TEXT` },
      { name: 'topScorerGoals', ddl: `"topScorerGoals" INTEGER` },
      { name: 'topScorerClubId', ddl: `"topScorerClubId" TEXT` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'Cup',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'name', ddl: `"name" TEXT NOT NULL` },
      { name: 'countryCode', ddl: `"countryCode" TEXT NOT NULL` },
      { name: 'clubIdsJson', ddl: `"clubIdsJson" TEXT NOT NULL` },
      { name: 'fixturesJson', ddl: `"fixturesJson" TEXT NOT NULL` },
      { name: 'status', ddl: `"status" TEXT NOT NULL DEFAULT 'IN_PROGRESS'` },
      { name: 'championClubId', ddl: `"championClubId" TEXT` },
      { name: 'championOwnerId', ddl: `"championOwnerId" TEXT` },
      { name: 'season', ddl: `"season" INTEGER NOT NULL DEFAULT 1` },
      { name: 'topScorerPlayerId', ddl: `"topScorerPlayerId" TEXT` },
      { name: 'topScorerName', ddl: `"topScorerName" TEXT` },
      { name: 'topScorerGoals', ddl: `"topScorerGoals" INTEGER` },
      { name: 'topScorerClubId', ddl: `"topScorerClubId" TEXT` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'TacticPreset',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'clubId', ddl: `"clubId" TEXT NOT NULL` },
      { name: 'name', ddl: `"name" TEXT NOT NULL` },
      { name: 'formation', ddl: `"formation" TEXT NOT NULL` },
      { name: 'mentality', ddl: `"mentality" TEXT NOT NULL` },
      { name: 'attackStyle', ddl: `"attackStyle" TEXT NOT NULL` },
      { name: 'markingStyle', ddl: `"markingStyle" TEXT NOT NULL` },
      { name: 'attackApproach', ddl: `"attackApproach" TEXT NOT NULL` },
      { name: 'pressing', ddl: `"pressing" TEXT NOT NULL DEFAULT 'MEDIUM'` },
      { name: 'lineupJson', ddl: `"lineupJson" TEXT NOT NULL` },
      { name: 'substitutesJson', ddl: `"substitutesJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'isDefault', ddl: `"isDefault" BOOLEAN NOT NULL DEFAULT false` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'TransferListing',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'clubId', ddl: `"clubId" TEXT NOT NULL` },
      { name: 'playerJson', ddl: `"playerJson" TEXT NOT NULL` },
      { name: 'askingPrice', ddl: `"askingPrice" INTEGER NOT NULL` },
      { name: 'status', ddl: `"status" TEXT NOT NULL DEFAULT 'ACTIVE'` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'TransferProposal',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'buyerClubId', ddl: `"buyerClubId" TEXT NOT NULL` },
      { name: 'sellerClubId', ddl: `"sellerClubId" TEXT NOT NULL` },
      { name: 'targetPlayerId', ddl: `"targetPlayerId" TEXT NOT NULL` },
      { name: 'targetPlayerName', ddl: `"targetPlayerName" TEXT NOT NULL DEFAULT ''` },
      { name: 'cashAmount', ddl: `"cashAmount" INTEGER NOT NULL` },
      { name: 'installments', ddl: `"installments" INTEGER NOT NULL DEFAULT 1` },
      { name: 'offeredPlayerIdsJson', ddl: `"offeredPlayerIdsJson" TEXT NOT NULL DEFAULT '[]'` },
      { name: 'status', ddl: `"status" TEXT NOT NULL DEFAULT 'PENDING'` },
      { name: 'responseMessage', ddl: `"responseMessage" TEXT` },
      { name: 'requiresBankGuarantee', ddl: `"requiresBankGuarantee" BOOLEAN NOT NULL DEFAULT false` },
      { name: 'hasBankGuarantee', ddl: `"hasBankGuarantee" BOOLEAN NOT NULL DEFAULT false` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'Match',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'homeClubId', ddl: `"homeClubId" TEXT NOT NULL` },
      { name: 'awayClubId', ddl: `"awayClubId" TEXT NOT NULL` },
      { name: 'seed', ddl: `"seed" TEXT NOT NULL` },
      { name: 'status', ddl: `"status" TEXT NOT NULL` },
      { name: 'homeTacticJson', ddl: `"homeTacticJson" TEXT` },
      { name: 'awayTacticJson', ddl: `"awayTacticJson" TEXT` },
      { name: 'resultJson', ddl: `"resultJson" TEXT` },
      { name: 'liveStateJson', ddl: `"liveStateJson" TEXT` },
      { name: 'competitionType', ddl: `"competitionType" TEXT` },
      { name: 'competitionId', ddl: `"competitionId" TEXT` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'ManagerTenure',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'userId', ddl: `"userId" TEXT NOT NULL` },
      { name: 'clubId', ddl: `"clubId" TEXT NOT NULL` },
      { name: 'clubName', ddl: `"clubName" TEXT NOT NULL` },
      { name: 'countryCode', ddl: `"countryCode" TEXT NOT NULL` },
      { name: 'startedAt', ddl: `"startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
      { name: 'endedAt', ddl: `"endedAt" DATETIME` },
      { name: 'endReason', ddl: `"endReason" TEXT` },
    ],
  },
  {
    table: 'JobOffer',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'userId', ddl: `"userId" TEXT NOT NULL` },
      { name: 'clubId', ddl: `"clubId" TEXT NOT NULL` },
      { name: 'clubName', ddl: `"clubName" TEXT NOT NULL` },
      { name: 'status', ddl: `"status" TEXT NOT NULL DEFAULT 'PENDING'` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'NewsItem',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'clubId', ddl: `"clubId" TEXT NOT NULL` },
      { name: 'category', ddl: `"category" TEXT NOT NULL` },
      { name: 'headline', ddl: `"headline" TEXT NOT NULL` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'GameState',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton'` },
      { name: 'currentDate', ddl: `"currentDate" TEXT NOT NULL` },
      { name: 'seasonYear', ddl: `"seasonYear" INTEGER NOT NULL` },
      { name: 'phase', ddl: `"phase" TEXT NOT NULL DEFAULT 'PRE_SEASON'` },
      { name: 'lastWeeklyTickDate', ddl: `"lastWeeklyTickDate" TEXT` },
      { name: 'deadlineDayJson', ddl: `"deadlineDayJson" TEXT NOT NULL DEFAULT '{"isActive":false,"seasonYear":0,"windowType":"PRE_SEASON","currentHour":0,"auctions":[],"breakingNews":[],"panicBuyRequests":[]}'` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
      { name: 'updatedAt', ddl: `"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
    ],
  },
  {
    table: 'PressConference',
    columns: [
      { name: 'id', ddl: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: 'week', ddl: `"week" INTEGER NOT NULL` },
      { name: 'type', ddl: `"type" TEXT NOT NULL` },
      { name: 'trigger', ddl: `"trigger" TEXT NOT NULL` },
      { name: 'context', ddl: `"context" TEXT NOT NULL` },
      { name: 'result', ddl: `"result" TEXT` },
      { name: 'impact', ddl: `"impact" TEXT` },
      { name: 'delegateUsed', ddl: `"delegateUsed" BOOLEAN NOT NULL DEFAULT false` },
      { name: 'assistantUsed', ddl: `"assistantUsed" TEXT` },
      { name: 'createdAt', ddl: `"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` },
      { name: 'teamId', ddl: `"teamId" TEXT NOT NULL` },
    ],
  },
];

const INDEX_MIGRATIONS = [
  'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")',
  'CREATE UNIQUE INDEX IF NOT EXISTS "Club_slug_key" ON "Club"("slug")',
  // Um clube tem um treinador só. O índice é o que impede dois, e não a boa vontade de quem escreve.
  'CREATE UNIQUE INDEX IF NOT EXISTS "Manager_clubId_key" ON "Manager"("clubId")',
  'CREATE INDEX IF NOT EXISTS "Manager_reputation_idx" ON "Manager"("reputation")',
];

/**
 * Indexes that a database created before the rule existed may not be able to accept.
 *
 * One league per country, division and season is the rule now (see `joinOrCreateLeague`), but a save made
 * while the game happily opened a second "Brasileirão Série A" already has rows that break it. The index
 * is what makes a repeat physically impossible going forward; it is not worth refusing to start the game
 * over history that cannot be changed. So it is attempted, and a failure is reported rather than thrown —
 * the rule is enforced in code either way, and the index tightens it wherever the data allows.
 */
const OPTIONAL_INDEX_MIGRATIONS = [
  {
    ddl: 'CREATE UNIQUE INDEX IF NOT EXISTS "League_country_division_season_key" ON "League"("countryCode","division","season")',
    explanation:
      'este save tem mais de uma liga para o mesmo país, divisão e temporada (criadas antes da regra de liga única)',
  },
];

/** `client` defaults to the shared singleton (real startup use — see index.ts) but can be overridden with
 *  a PrismaClient pointed at a scratch database, so a test can prove this heals a deliberately old/
 *  incomplete schema without touching the real dev database. */
export async function ensureSchema(client: RawSqlClient = prisma): Promise<void> {
  const existingTables = new Set(
    (await client.$queryRawUnsafe<Array<{ name: string }>>(`SELECT name FROM sqlite_master WHERE type='table'`)).map((t) => t.name),
  );

  for (const migration of TABLE_MIGRATIONS) {
    if (!existingTables.has(migration.table)) {
      const createDdl = `CREATE TABLE "${migration.table}" (\n  ${migration.columns.map((c) => c.ddl).join(',\n  ')}\n)`;
      await client.$executeRawUnsafe(createDdl);
      continue; // freshly created — has every current column already, nothing to backfill.
    }

    const columns = await client.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${migration.table}")`);
    const existingColumns = new Set(columns.map((c) => c.name));
    for (const column of migration.columns) {
      if (!existingColumns.has(column.name)) {
        await client.$executeRawUnsafe(`ALTER TABLE "${migration.table}" ADD COLUMN ${column.ddl}`);
      }
    }
  }

  for (const indexDdl of INDEX_MIGRATIONS) {
    await client.$executeRawUnsafe(indexDdl);
  }

  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    for (const optional of OPTIONAL_INDEX_MIGRATIONS) {
      try {
        await client.$executeRawUnsafe(optional.ddl);
      } catch {
        console.warn(`[ensureSchema] índice único não aplicado: ${optional.explanation}.`);
      }
    }
  } else {
    try {
      await client.$executeRawUnsafe('DROP INDEX IF EXISTS "League_country_division_season_key"');
    } catch {
      // Ignored in test environment
    }
  }
}

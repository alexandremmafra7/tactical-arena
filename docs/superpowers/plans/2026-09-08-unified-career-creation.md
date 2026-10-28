# Unified Career Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one immersive, accessible, atomic, and idempotent career-creation flow with explicit online/offline parity.

**Architecture:** The React wizard owns one transient `CareerDraft` and submits once through a shared contract. Online creation runs against a staging SQLite database with durable recovery; offline creation stages and persists one real slot without ever switching runtime silently.

**Tech Stack:** TypeScript, React 18, React Router, Vite, Express, Prisma, SQLite, Vitest, Supertest, Playwright, Electron, Capacitor.

**Spec:** `docs/second-brain/04_CAREER_FLOW_SPEC.md`

## Global Constraints

- preserve/migrate saves;
- no silent runtime fallback;
- final-confirmation persistence only;
- no real `dev.db` or player saves in tests;
- no timestamp IDs;
- no token in persisted slot;
- no new state/design/DOM-test dependencies;
- accessibility and responsive requirements;
- no commit steps because the workspace currently has no `.git`.

---

### Phase 0 — Safe Test Boundary

### Task 0: Isolate Every Server Test Run from Real Databases

**Safety prerequisite:** Complete this task before running any server Vitest command in this plan. The current global setup deletes and replaces `packages/server/prisma/dev.db`; therefore there is intentionally no red Vitest run before the harness is replaced. No test process may point at the repository database or at a player database.

**Files:**
- Create: `packages/server/vitest.testDatabase.ts`
- Create: `packages/server/vitest.testDatabase.test.ts`
- Modify: `packages/server/vitest.globalSetup.ts`
- Modify: `packages/server/vitest.setup.ts`
- Modify: `packages/server/vitest.config.ts`

**Interfaces:**
- Consumes: immutable `packages/server/prisma/template.db`; Node `fs`, `os`, `path`, and Vitest 2 global-setup lifecycle.
- Produces:

```ts
export const SERVER_TEST_DIRECTORY_ENV =
  'TACTICAL_ARENA_SERVER_TEST_DIRECTORY' as const;

export function assertSafeServerTestDatabase(
  env?: NodeJS.ProcessEnv,
): string;
```

`assertSafeServerTestDatabase()` returns the resolved temporary SQLite path only when all of these are true:

- `DATABASE_URL` is present and uses `file:`;
- `TACTICAL_ARENA_SERVER_TEST_DIRECTORY` is present;
- the generated directory is inside `os.tmpdir()` and its basename starts with `tactical-arena-server-tests-`;
- the database resolves inside that generated directory;
- the database does not resolve to `packages/server/prisma/dev.db`.

It throws before Prisma is imported if any invariant fails. Path comparisons use `path.resolve()`/`path.relative()` and case-insensitive comparison on Windows; string-prefix checks alone are forbidden.

- [ ] **Step 1: Add the pure safety guard and its focused vectors without executing Vitest**

Create `vitest.testDatabase.ts` with the interface above. Keep it free of Prisma imports and filesystem mutations. Create `vitest.testDatabase.test.ts` with explicit vectors for:

```ts
expect(() =>
  assertSafeServerTestDatabase({
    VITEST: 'true',
    DATABASE_URL: undefined,
    TACTICAL_ARENA_SERVER_TEST_DIRECTORY: safeDirectory,
  }),
).toThrow(/DATABASE_URL/);

expect(() =>
  assertSafeServerTestDatabase({
    VITEST: 'true',
    DATABASE_URL: `file:${repositoryDevDb}`,
    TACTICAL_ARENA_SERVER_TEST_DIRECTORY: safeDirectory,
  }),
).toThrow(/dev\.db/);

expect(() =>
  assertSafeServerTestDatabase({
    VITEST: 'true',
    DATABASE_URL: `file:${outsideDatabase}`,
    TACTICAL_ARENA_SERVER_TEST_DIRECTORY: safeDirectory,
  }),
).toThrow(/outside|fora/i);

expect(
  assertSafeServerTestDatabase({
    VITEST: 'true',
    DATABASE_URL: `file:${safeDatabase.replace(/\\/g, '/')}`,
    TACTICAL_ARENA_SERVER_TEST_DIRECTORY: safeDirectory,
  }),
).toBe(path.resolve(safeDatabase));
```

Use unique paths under `os.tmpdir()` in the test vectors; do not create, copy, delete, or inspect the repository `dev.db`.

- [ ] **Step 2: Replace the destructive global setup before running any test**

Replace `vitest.globalSetup.ts` with one setup function that:

1. resolves `packages/server/prisma/template.db` and throws if it is missing;
2. creates a unique directory with `fs.mkdtempSync(path.join(os.tmpdir(), 'tactical-arena-server-tests-'))`;
3. copies the template to `<temporaryDirectory>/active.db` without modifying the source template;
4. assigns an absolute normalized `file:` URL to `process.env.DATABASE_URL`;
5. assigns the directory to `process.env.TACTICAL_ARENA_SERVER_TEST_DIRECTORY`;
6. calls `assertSafeServerTestDatabase(process.env)` immediately;
7. returns a teardown function that removes only the generated directory with `fs.rmSync(temporaryDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })`, then restores the two prior environment values in a `finally` block.

The setup must remember previous environment values before assignment. Teardown must never derive its deletion target from `DATABASE_URL`, the save index, the current working directory, or test-controlled data; close over the exact directory returned by `mkdtempSync()`.

- [ ] **Step 3: Guard before importing Prisma in the worker setup**

Replace `vitest.setup.ts` with this import order:

```ts
import 'dotenv/config';
import { assertSafeServerTestDatabase } from './vitest.testDatabase.js';

assertSafeServerTestDatabase(process.env);

const { ensureSchema } = await import('./src/db/ensureSchema.js');
await ensureSchema();
```

The dynamic import is required: the guard must execute before `ensureSchema` can import the global Prisma client. `dotenv` may remain because it does not override the `DATABASE_URL` already supplied by global setup.

- [ ] **Step 4: Keep one shared temporary database and document the Vitest lifecycle**

Update only the stale comments in `vitest.config.ts`. Retain:

```ts
test: {
  setupFiles: ['./vitest.setup.ts'],
  globalSetup: ['./vitest.globalSetup.ts'],
  fileParallelism: false,
}
```

Vitest 2 invokes global setup before creating/running test workers; its worker environment is built from `process.env` plus `config.env`. Thus the `DATABASE_URL` assigned by global setup is visible before setup files and test modules load. Keep `fileParallelism: false` because the existing integration files intentionally share this one temporary database during a run.

- [ ] **Step 5: Prove both environment propagation and the Prisma connection target**

Add one integration assertion to `vitest.testDatabase.test.ts` after the pure vectors:

```ts
import { prisma } from './src/db/prisma.js';

test('the global Prisma client is connected only to this run temporary database', async () => {
  const expected = assertSafeServerTestDatabase(process.env);
  const databases = await prisma.$queryRawUnsafe<
    Array<{ seq: number; name: string; file: string }>
  >('PRAGMA database_list');
  const main = databases.find((database) => database.name === 'main');

  expect(main).toBeDefined();
  expect(path.resolve(main!.file)).toBe(expected);
  expect(expected).not.toBe(
    path.resolve(serverDirectory, 'prisma', 'dev.db'),
  );
});
```

Resolve `serverDirectory` from `import.meta.url`; do not hard-code a drive or checkout path. This test proves the global-setup environment reached the worker before Prisma construction, rather than merely testing path parsing.

- [ ] **Step 6: Run the first safe server checks**

```bash
npm run test:server -- --run vitest.testDatabase.test.ts
npm run test:server
```

Expected: the focused guard test and all existing server tests run against a fresh temporary `active.db`; global teardown removes only that run directory. At no point is `packages/server/prisma/dev.db` opened, removed, copied over, or mutated. If the temporary directory cannot be removed, fail the run and report its exact path rather than widening cleanup scope.

### Phase 1 — Shared Contract and Policy

### Task 1: Canonical Save-Slot Contract and Evidence-Backed Legacy Normalization

**Files:**
- Create: `packages/shared/src/domain/saveSlot.ts`
- Create: `packages/shared/src/domain/saveSlot.test.ts`
- Modify: `packages/shared/src/index.ts` (export `saveSlot.js` in this task)

**Interfaces:**
- Consumes: existing `GameMode`, `ManagerStyleId`.
- Produces the one slot type used by server and web; delete the three later copies from `saveService.ts`, `client.ts`, and `localEngine.ts` when their owning tasks run.

```ts
export const SAVE_SLOT_SCHEMA_VERSION = 2 as const;
export type SaveSlotSchemaVersion =
  typeof SAVE_SLOT_SCHEMA_VERSION;
export type ClockFormat = 'HALF_45' | 'FULL_90';

export interface SaveSlot {
  schemaVersion: SaveSlotSchemaVersion;
  id: string;
  name: string;
  fileName: string;
  managerFirstName: string;
  managerLastName: string;
  managerName: string;
  managerNationality: string;
  managerStyle: ManagerStyleId;
  managerAvatar: string;
  clockFormat: ClockFormat;
  gameMode: GameMode;
  managerUserId: string;
  clubId: string;
  clubName: string;
  clubCountry: string;
  division: number;
  season: number;
  round: number;
  budget: number;
  titlesWon: number;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

export type LegacySaveSlot = Partial<
  Omit<SaveSlot, 'schemaVersion'>
> & {
  schemaVersion?: 1;
  id: string;
  name: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  claimedClubId?: string;
  managerToken?: string;
};

export interface LegacySaveEvidence {
  users: readonly { id: string }[];
  clubs: readonly {
    id: string;
    name: string;
    country: string;
    ownerId: string;
    division: number;
    budget: number;
    titlesWon: number;
  }[];
  managers: readonly {
    id: string;
    name: string;
    nationality: string | null;
    userId: string | null;
    clubId: string | null;
  }[];
  openTenures: readonly {
    userId: string;
    clubId: string;
  }[];
  season: number;
  round: number;
}

export type NormalizeSaveSlotResult =
  | { ok: true; slot: SaveSlot; migrated: boolean }
  | {
      ok: false;
      code:
        | 'AMBIGUOUS_OWNERSHIP'
        | 'INVALID_LEGACY_SAVE';
      saveId: string;
    };

export function normalizeSaveSlot(
  raw: unknown,
  evidence?: LegacySaveEvidence,
): NormalizeSaveSlotResult;
```

`SaveSlot` deliberately retains every current compatibility/profile/summary field, adds `schemaVersion` and `clubId`, and omits `managerToken`. `isCurrent` remains for current consumers even though the index also carries `currentSaveId`; removing that compatibility field is outside this refactor.

- [ ] **Step 1: Add red runtime tests, not erased-interface assertions**

Construct synthetic objects and call `normalizeSaveSlot()`; TypeScript interfaces cannot be inspected at runtime. Cover:

- a complete schema-2 slot passes through with `migrated: false`;
- a schema-2 slot missing any required identity/club field, containing an invalid style/mode/clock value, a non-positive division, or invalid ISO timestamp returns `INVALID_LEGACY_SAVE`;
- an unknown schema version returns `INVALID_LEGACY_SAVE`;
- an unstamped or schema-1 slot ignores (and therefore drops) `managerToken` and `claimedClubId`;
- absent legacy `gameMode`, valid style, avatar, and clock fields normalize to `STANDARD`, `Estrategista`, `👔`, and `HALF_45`; missing summary fields use `evidence.season`, `evidence.round`, and the proven club's budget/title values;
- exactly one evidence tuple proves ownership only when all four relationships agree: the user exists, `club.ownerId === user.id`, one manager has the same `userId` and `clubId`, and one open tenure has that same pair;
- a legacy `managerUserId`, `clubId`, or `claimedClubId`, when present, narrows candidates but never overrides contradictory database evidence;
- zero proven tuples returns `INVALID_LEGACY_SAVE`; two or more proven tuples return `AMBIGUOUS_OWNERSHIP` without choosing one;
- the result has no `managerToken` property.

Use synthetic UUIDs and dates such as `2026-09-09T10:00:00.000Z`; never read a real save index in a shared test.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:shared -- --run src/domain/saveSlot.test.ts
```

Expected: module or `normalizeSaveSlot` is missing.

- [ ] **Step 3: Implement deterministic normalization**

Validate schema-2 values directly. For legacy data, enumerate candidate `(user, club, manager, open tenure)` tuples from `LegacySaveEvidence`, apply any IDs already present in the slot as filters, and accept exactly one tuple. Never infer ownership from display names, country, array order, the first non-bot club, a token, or a default user ID.

Profile copy may use the legacy slot's non-empty values, then the proven manager's name/nationality where those exact fields are absent, then the compatibility defaults above. Club identity and live summary fields come from the proven club/evidence, not stale display metadata. Return a new object; do not mutate `raw` or `evidence`.

- [ ] **Step 4: Export and run focused checks**

Add:

```ts
export * from './domain/saveSlot.js';
```

to `packages/shared/src/index.ts`, then run:

```bash
npm run test:shared -- --run src/domain/saveSlot.test.ts
npm run build --workspace @tactical-arena/shared
```

Expected: pure normalization tests pass in Node and the shared package builds.

### Task 2: Runtime-Neutral Career-Creation Contract and Validation

**Files:**
- Create: `packages/shared/src/domain/createCareer.ts`
- Create: `packages/shared/src/domain/createCareer.test.ts`
- Modify: `packages/shared/src/index.ts` (export `createCareer.js` in this task)

**Interfaces:**
- Consumes: `ClockFormat` and `SaveSlot` from Task 1; existing `ManagerStyleId`, `GameMode`, `KitPattern`, `Club`, `CREST_SPEC`, `isValidManagerStyle`, and country validation.
- Produces:

```ts
export type CareerCitySize =
  | 'SMALL'
  | 'MEDIUM'
  | 'LARGE';

export interface CareerCrest {
  crestBase64: string | null;
}

export interface CareerManager {
  firstName: string;
  lastName: string;
  nationality: string;
  style: ManagerStyleId;
  avatar: string;
  clockFormat: ClockFormat;
}

export interface FoundCareerClub {
  kind: 'FOUND';
  countryCode: string;
  name: string;
  city: string;
  citySize: CareerCitySize;
  kitPattern: KitPattern;
  primaryColor: string;
  secondaryColor: string;
  crest: CareerCrest;
}

export type CareerClubChoice =
  | { kind: 'TAKE_OVER'; clubId: string }
  | FoundCareerClub;

export interface CreateCareerInput {
  idempotencyKey: string;
  saveName: string;
  manager: CareerManager;
  gameMode: GameMode;
  club: CareerClubChoice;
}

export interface CreateCareerResult {
  save: SaveSlot;
  token: string;
  userId: string;
  club: Club;
  reused: boolean;
}

export interface LoadSaveResult {
  save: SaveSlot;
  token: string;
  userId: string;
  club: Club;
}

export type CareerCreationDomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'CLUB_UNAVAILABLE'
  | 'MODE_RESTRICTION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'STORAGE_ERROR'
  | 'RECOVERY_REQUIRED';

export interface CareerInputValidationError {
  code: 'VALIDATION_ERROR';
  field: string;
  message: string;
}

export function validateCreateCareerInput(
  input: unknown,
):
  | { ok: true; value: CreateCareerInput }
  | { ok: false; error: CareerInputValidationError };
```

`NETWORK_ERROR` is intentionally absent: it is a browser transport classification, not a server/offline domain result. `CareerDraft` is intentionally absent: its two preserved club branches are UI transient state and belong to Task 13, while this shared contract contains only the active final choice.

- [ ] **Step 1: Add red behavioral validation tests**

Do not claim to inspect TypeScript interfaces at runtime. Invoke `validateCreateCareerInput()` with complete synthetic takeover/foundation payloads and assert returned values retain every field, including `citySize`, `kitPattern`, colors, and `crest.crestBase64`. Cover one invalid vector per trust-boundary rule:

- missing/blank idempotency key, save name, manager names, nationality, avatar, takeover `clubId`, foundation name/country/city;
- unknown `GameMode`, manager style, clock format, city size, or kit pattern;
- invalid hex color;
- non-null crest that is not base64 or whose decoded bytes exceed `CREST_SPEC.maxBytes`.

The validator requires a client key; it never generates one. Use `field` paths such as `idempotencyKey`, `manager.firstName`, and `club.citySize` so the UI can focus the source control. Keep image dimension/PNG conversion in the controlled-form task; shared payload validation checks only the persisted base64 boundary already representable in Node.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:shared -- --run src/domain/createCareer.test.ts
```

Expected: module or validator missing.

- [ ] **Step 3: Implement the exact shared types and validator**

Use existing arrays/guards rather than copied enum lists where available. Return a normalized, trimmed value without mutating input. Keep `CareerCrest` as the thin persisted representation; `null` means the existing procedural fallback. Do not add a new crest schema or game mode.

- [ ] **Step 4: Export and run focused checks**

Add:

```ts
export * from './domain/createCareer.js';
```

to `packages/shared/src/index.ts`, then run:

```bash
npm run test:shared -- --run src/domain/createCareer.test.ts
npm run build --workspace @tactical-arena/shared
```

Expected: runtime validation tests pass and shared barrel builds.

### Task 3: Career Entry Policy Selectors and Approved Labels

**Files:**
- Create: `packages/shared/src/domain/careerEntryPolicy.ts`
- Create: `packages/shared/src/domain/careerEntryPolicy.test.ts`
- Modify: `packages/shared/src/domain/gameMode.ts`
- Modify: `packages/shared/src/domain/gameMode.test.ts`
- Modify: `packages/shared/src/index.ts` (export `careerEntryPolicy.js` in this task)

**Interfaces:**
- Consumes: existing `GameMode`, `canTakeOverDivision()`, `mustFoundOwnClub()`, and `explainBlock()` plus Task 2 `CareerClubChoice`.
- Produces:

```ts
export interface CareerEntryPolicy {
  path: 'CHOOSE' | 'FOUND_ONLY';
  canTakeOver: boolean;
  mustFound: boolean;
  restriction: string | null;
}

export function careerEntryPolicy(
  mode: GameMode,
): CareerEntryPolicy;

export function eligibleTakeoverDivisions(
  mode: GameMode,
  divisions: readonly number[],
): number[];

export function validateCareerClubChoice(
  mode: GameMode,
  choice: CareerClubChoice,
  takeoverDivision?: number,
):
  | { ok: true }
  | {
      ok: false;
      code: 'MODE_RESTRICTION';
      message: string;
    };
```

- [ ] **Step 1: Add red policy and visible-copy tests**

In `careerEntryPolicy.test.ts`, cover:

- Standard policy is `CHOOSE`, takeover true, foundation not mandatory;
- Premium policy is identical at path level;
- Iron Man policy is `FOUND_ONLY`, takeover false, foundation mandatory, and uses the shared `explainBlock('HARDCORE', 'division')` restriction;
- `eligibleTakeoverDivisions('STANDARD', [1, 2, 3, 4])` returns `[2, 3, 4]`;
- `eligibleTakeoverDivisions('PREMIUM', [1, 2, 3, 4])` returns `[1, 2, 3, 4]`;
- `eligibleTakeoverDivisions('HARDCORE', [1, 2, 3, 4])` returns `[]`;
- lower tiers continue numerically (`[1, 2, 4, 5, 6]` gives Standard `[2, 4, 5, 6]` and Premium all values);
- invalid/non-positive/non-integer input divisions are excluded rather than becoming normal policy vectors;
- validation rejects Iron Man takeover and Standard division 1, accepts Standard divisions 2 and 4, accepts Premium divisions 1 and 4, and accepts foundation in every mode;
- missing takeover division returns a validation failure instead of substituting division `0`.

Extend `gameMode.test.ts` with exact visible labels:

```ts
expect(GAME_MODE_INFO.STANDARD.label).toBe('Standard');
expect(GAME_MODE_INFO.PREMIUM.label).toBe('Premium');
expect(GAME_MODE_INFO.HARDCORE.label).toBe('Iron Man');
expect(explainBlock('HARDCORE', 'division')).toContain('Iron Man');
expect(explainBlock('HARDCORE', 'division')).not.toContain('Do Zero');
```

Keep persisted IDs exactly `STANDARD`, `PREMIUM`, and `HARDCORE`; do not introduce Academy Challenge.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:shared -- --run src/domain/careerEntryPolicy.test.ts src/domain/gameMode.test.ts
```

Expected: selector module is missing and old labels/copy fail.

- [ ] **Step 3: Implement by composition only**

Call `mustFoundOwnClub()` once inside `careerEntryPolicy()` and use `explainBlock()` for restriction prose. `eligibleTakeoverDivisions()` first rejects values that are not positive integers, then filters solely through `canTakeOverDivision()`. `validateCareerClubChoice()` accepts `FOUND`; for `TAKE_OVER`, it returns a validation failure if `takeoverDivision` is not a positive integer, otherwise delegates solely to `canTakeOverDivision()` and uses `explainBlock(mode, 'division')` when denied. Do not copy the `mode === 'PREMIUM' ? 1 : 2` threshold.

Update only the visible labels in `GAME_MODE_INFO` and replace stale user-facing “Do Zero” wording with “Iron Man”; keep taglines, descriptions, icons, IDs, and all existing source-of-truth rule functions intact.

- [ ] **Step 4: Export and run focused checks**

Add:

```ts
export * from './domain/careerEntryPolicy.js';
```

to `packages/shared/src/index.ts`, then run:

```bash
npm run test:shared -- --run src/domain/careerEntryPolicy.test.ts src/domain/gameMode.test.ts
npm run build --workspace @tactical-arena/shared
```

Expected: exact division semantics, approved labels, existing game-mode behaviors, and shared barrel build pass.

### Phase 2 — Server-Side Transaction and Persistence

### Task 4: Reusable Prisma Construction Without Losing Club Invariants

**Files:**
- Create: `packages/server/src/db/prisma.ts`
- Create: `packages/server/src/db/prisma.test.ts`

**Interfaces:**
- Consumes: none (reads `DATABASE_URL` from env).
- Produces:

```ts
export function makePrisma(url?: string): ExtendedPrismaClient;
export type Db = ReturnType<typeof makePrisma>;
export const prisma: Db;
```

- [ ] **Step 1: Add red tests for extension preservation**

Use Vitest to mock `PrismaClient` and assert the extension contains:

- `club.create`
- `club.update`
- `club.updateMany`
- `club.upsert`

with the existing `withDerivedSquadFields()` logic unchanged.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:server -- --run src/db/prisma.test.ts
```

Expected: makePrisma missing.

- [ ] **Step 3: Implement factory and export**

Copy the existing global Prisma client creation into `makePrisma()`, preserving the extension. Export a default instance `prisma` for non-staging use.

- [ ] **Step 4: Run focused tests/server build**

```bash
npm run test:server -- --run src/db/prisma.test.ts
npm run build --workspace @tactical-arena/server
```

Expected: extension tests pass and server builds.

### Task 5: Transaction-Aware Existing Domain Helpers

**Files:**
- Modify: `packages/server/src/services/tenureService.ts`
- Modify: `packages/server/src/services/managerService.ts`
- Modify: `packages/server/src/services/tacticService.ts`
- Modify: `packages/server/src/services/foundClubService.ts`
- Modify: `packages/server/src/services/clubService.ts`
- Create: `packages/server/src/services/tenureService.test.ts`
- Create: `packages/server/src/services/managerService.test.ts`
- Create: `packages/server/src/services/tacticService.test.ts`
- Create: `packages/server/src/services/foundClubService.test.ts`
- Create: `packages/server/src/services/clubService.test.ts`

**Interfaces:**
- Consumes: `Db` from `makePrisma()`.
- Produces:

```ts
export function assertModeCanTakeOver(
  mode: GameMode,
  division: number,
): void;

export async function openTenure(
  userId: string,
  clubId: string,
  clubName: string,
  countryCode: string,
  db: Db = prisma,
): Promise<void>;

export async function seatUserAsManager(
  clubId: string,
  userId: string,
  identity?: { name: string; nationality: string | null },
  db: Db = prisma,
): Promise<void>;

export async function fieldDefaultTactic(
  club: Club,
  db: Db = prisma,
): Promise<void>;

export async function foundClub(
  ownerId: string,
  input: FoundClubInput,
  db: Db = prisma,
  options?: {
    openManagerTenure?: boolean;
    syncActiveSave?: boolean;
  },
): Promise<Club>;
```

- [ ] **Step 1: Add red tests for db parameter propagation**

Use Vitest to mock `PrismaClient` and assert each function passes the `db` parameter through to all nested Prisma calls. Test `foundClub` asserts it seats the manager and fields a default tactic when `options.openManagerTenure` and `options.syncActiveSave` are true (default).

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:server -- --run src/services/tenureService.test.ts
npm run test:server -- --run src/services/managerService.test.ts
npm run test:server -- --run src/services/tacticService.test.ts
npm run test:server -- --run src/services/foundClubService.test.ts
npm run test:server -- --run src/services/clubService.test.ts
```

Expected: db parameter missing or global Pr utilisée.

- [ ] **Step 3: Inject db parameter through all helpers**

Modify each service to accept an optional `db: Db` parameter (defaulting to the exported `prisma`). Update all internal calls to use the passed `db`. Ensure `foundClub` seats the manager and fields a default tactic as part of the transaction (via the injected `db`).

- [ ] **Step 4: Run focused tests/server build**

```bash
npm run test:server -- --run src/services/tenureService.test.ts
npm run test:server -- --run src/services/managerService.test.ts
npm run test:server -- --run src/services/tacticService.test.ts
npm run test:server -- --run src/services/foundClubService.test.ts
npm run test:server -- --run src/services/clubService.test.ts
npm run build --workspace @tactical-arena/server
```

Expected: db parameter tests pass and server builds.

### Task 6: Atomic Save Index and Conservative Migration

**Files:**
- Create: `packages/server/src/services/saveIndexService.ts`
- Create: `packages/server/src/services/saveIndexService.test.ts`

**Interfaces:**
- Consumes: `Db` from `makePrisma()`, `fs` promises.
- Produces:

```ts
export interface SavesIndex {
  schemaVersion: 2;
  currentSaveId: string;
  saves: StoredSaveSlot[];
  idempotency: Record<
    string,
    { payloadHash: string; saveId: string }
  >;
}

export interface SavePaths {
  databasePath: string;
  templatePath: string;
  savesDirectory: string;
  indexPath: string;
  markerPath: string;
}

export function resolveSavePaths(
  env?: NodeJS.ProcessEnv,
): SavePaths;

export function readSavesIndex(
  paths?: SavePaths,
): SavesIndex;

export function writeSavesIndexAtomic(
  index: SavesIndex,
  paths?: SavePaths,
): void;

export function migrateSavesIndex(
  paths?: SavePaths,
): SavesIndex;
```

- [ ] **Step 1: Add red tests for atomic write and migration**

Use Vitest with a mock `fs/promises` to assert:

- `writeSavesIndexAtomic` writes to a temporary file and renames atomically;
- `migrateSavesIndex` converts schemaVersion 1 to 2, preserves all slots, and leaves idempotency empty;
- `readSavesIndex` returns the parsed JSON or throws if malformed;
- `resolveSavePaths` returns correct paths from env or cwd.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:server -- --run src/services/saveIndexService.test.ts
```

Expected: saveIndexService missing.

- [ ] **Step 3: Implement atomic write and migration**

Use `fs.promises.writeFile` to a temporary file in the same directory, then `fs.promises.rename` over the target. For migration, read the index, if schemaVersion is 1, upgrade to 2 and clear idempotency (or keep if desired; the plan says migration uses schema version axis). Write the migrated index atomically.

- [ ] **Step 4: Run focused tests/server build**

```bash
npm run test:server -- --run src/services/saveIndexService.test.ts
npm run build --workspace @tactical-arena/server
```

Expected: saveIndex tests pass and server builds.

### Task 7: Complete Staging Creation Transaction

**Files:**
- Create: `packages/server/src/services/careerCreationService.ts`
- Create: `packages/server/src/services/careerCreationService.test.ts`

**Interfaces:**
- Consumes: `CreateCareerInput`, `SavePaths`, `makePrisma`.
- Produces:

```ts
export interface CareerCreationMarker {
  state: 'prepared' | 'database-promoted';
  creationId: string;
  idempotencyKey: string;
  payloadHash: string;
  stagingPath: string;
  previousDatabaseBackupPath: string;
  previousIndexBackupPath: string;
  slot: SaveSlot;
}

export class CareerCreationError extends Error {
  constructor(
    public readonly code: CareerCreationErrorCode,
    message: string,
    public readonly status: number,
    public readonly field?: string,
  );
}

export async function createCareer(
  input: CreateCareerInput,
  options?: {
    paths?: SavePaths;
    makeDb?: typeof makePrisma;
  },
): Promise<CreateCareerResult>;

export async function recoverCareerCreation(
  options?: { paths?: SavePaths },
): Promise<void>;
```

- [ ] **Step 1: Add red tests for transaction steps**

Use Vitest to mock `fs/promises` and `PrismaClient`. Assert the service:

- validates input via shared selectors;
- computes canonical payload hash excluding the idempotency key;
- checks for completed idempotency key and returns existing result;
- creates a same-volume staging copy;
- instantiates a dedicated staging Prisma client;
- looks up the exact division club;
- runs one interactive transaction that:
  - for TAKE_OVER: asserts bot ownership, updates owner, calls `openTenure`, `seatUserAsManager`, `fieldDefaultTactic`;
  - for FOUND: calls `foundClub` with `openManagerTenure: true` and `syncActiveSave: true`;
  - writes the slot to the staging database;
  - writes the marker with state `prepared`;
- promotes the marker to `database-promoted` after successful transaction;
- promotes the slot into the index idempotently;
- removes the marker;
- returns a fresh token and userId;
- on any error, cleans up staging and marker according to state machine.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:server -- --run src/services/careerCreationService.test.ts
```

Expected: careerCreationService missing.

- [ ] **Step 3: Implement the service with exact steps**

Follow the plan steps precisely. Use `crypto.createHash('sha256')` for payload hash. Use `randomUUID()` for `creationId` and `idempotencyKey` (if not provided). Use `fs.promises.copyFile` for same-volume staging copy. Ensure the staging Prisma client uses the staging database path. Use `Prisma.TransactionOptions` for isolation level. In the transaction, use the injected `db` (the staging client) for all operations. After transaction, write the marker with updated state. Then promote the slot into the index using the helper from Task 6. Finally, delete the marker file.

- [ ] **Step 4: Run focused tests/server build**

```bash
npm run test:server -- --run src/services/careerCreationService.test.ts
npm run build --workspace @tactical-arena/server
```

Expected: service tests pass and server builds.

### Task 8: Durable Crash Recovery

**Files:**
- Modify: `packages/server/src/services/careerCreationService.ts` (add recovery logic)
- Create: `packages/server/src/services/careerCreationService.test.ts` (add recovery tests)

**Interfaces:**
- Consumes: same as Task 7.
- Produces: same as Task 7, with recovery logic.

- [ ] **Step 1: Add red tests for state machine**

Use Vitest to mock `fs/promises` and `PrismaClient`. Assert:

- if marker.state === `prepared` and staging database has a club with `creationId`, advance marker to `database-promoted`;
- if marker.state === `prepared` and staging database does NOT have the club, remove staging and marker;
- if marker.state === `database-promoted`, promote slot into index idempotently and remove marker;
- if no marker exists, do nothing;
- recovery is idempotent and safe to call multiple times.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:server -- --run src/services/careerCreationService.test.ts
```

Expected: recovery logic missing.

- [ ] **Step 3: Implement recovery state machine**

Add the recovery function that reads the marker file (if exists) and branches on `state`. Use the same helpers from Tasks 6 and 7 for validation and promotion. Ensure recovery runs before schema/bootstrap writes and before traffic.

- [ ] **Step 4: Run focused tests/server build**

```bash
npm run test:server -- --run src/services/careerCreationService.test.ts
npm run build --workspace @tactical-arena/server
```

Expected: recovery tests pass and server builds.

### Task 9: Complete `/saves/new` Contract and Stable Errors

**Files:**
- Modify: `packages/server/src/routes/saves.ts`
- Create: `packages/server/src/routes/saves.test.ts`

**Interfaces:**
- Consumes: `createCareer` from Task 7.
- Produces:

```ts
// POST /saves/new
// -> { ok: true, ...CreateCareerResult }
// -> {
//   ok: false,
//   code: CareerCreationErrorCode,
//   message: string,
//   field?: string
// }
```

- [ ] **Step 1: Add red tests for contract and error shape**

Use Supertest to assert the endpoint:

- returns 200 with the exact `CreateCareerResult` shape on success;
- returns 400/409/500 with `{ ok: false, code, message, field? }` on error;
- does NOT return `claimedClubId`;
- does NOT silently fall back to offline on network error;
- returns `IDEMPOTENCY_CONFLICT` with `field: undefined` on retry with same payload;
- returns `NETWORK_ERROR` on Axios/network failure;
- returns `STORAGE_ERROR` on filesystem/index failure;
- returns `RECOVERY_REQUIRED` when a marker exists and recovery is needed.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:server -- --run src/routes/saves.test.ts
```

Expected: `/saves/new` still reconstructs old partial input.

- [ ] **Step 3: Implement thin handler**

Replace the current handler with:

```ts
import { createCareer, CareerCreationError } from '../services/careerCreationService';

export async function handler(req: Request, res: Response) {
  try {
    const input = await req.json();
    const result = await createCareer(input);
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof CareerCreationError) {
      res.status(err.status).json({
        ok: false,
        code: err.code,
        message: err.message,
        field: err.field,
      });
    } else {
      console.error(err);
      res.status(500).json({
        ok: false,
        code: 'STORAGE_ERROR',
        message: 'Unexpected error',
      });
    }
  }
}
```

- [ ] **Step 4: Run focused tests/server build**

```bash
npm run test:server -- --run src/routes/saves.test.ts
npm run build --workspace @tactical-arena/server
```

Expected: endpoint tests pass and server builds.

### Phase 3 — Offline Parity and Migration

### Task 10: Real Offline Slot Index and Legacy Migration

**Files:**
- Modify: `packages/web/src/api/localEngine.ts`
- Create: `packages/web/src/api/localEngine.test.ts`

**Interfaces:**
- Consumes: none.
- Produces:

```ts
export const OFFLINE_LEGACY_SAVE_KEY =
  'tactical_arena_offline_save_v1';

export const OFFLINE_SAVE_INDEX_KEY =
  'tactical_arena_offline_saves_v1';

export const OFFLINE_SAVE_KEY_PREFIX =
  'tactical_arena_offline_save_v1:';

interface OfflineSaveIndex {
  schemaVersion: 2;
  currentSaveId: string;
  saves: SaveSlot[];
  idempotency: Record<
    string,
    { payloadHash: string; saveId: string }
  >;
}

export async function flushLocalSave(): Promise<void>;

export async function localListSaves(): Promise<{
  currentSaveId: string;
  currentManager: ManagerProfile | null;
  saves: SaveSlot[];
}>;

export async function localLoadSave(
  id: string,
): Promise<{
  save: SaveSlot;
  token: string;
  userId: string;
  claimedClubId: string;
}>;
```

- [ ] **Step 1: Add red tests for schema migration**

Use Vitest with a `Map`-based localStorage mock to assert:

- legacy key `OFFLINE_LEGACY_SAVE_KEY` (schemaVersion 1) is read and migrated to version 2 index;
- migrated index has `schemaVersion: 2`, `currentSaveId` set, saves array with migrated slot, empty idempotency;
- no ownership reassignment occurs during migration;
- `localListSaves` returns the migrated index shape;
- `localLoadSave` returns the slot with fresh token/userId and claimedClubId;
- `flushLocalSave` writes the current slot to its key and updates the index.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/api/localEngine.test.ts
```

Expected: localEngine missing migration logic.

- [ ] **Step 3: Implement schema-version migration**

On startup/read, check for the legacy key. If present and schemaVersion is missing or 1, migrate to version 2 by constructing an index with the legacy slot (converted to `SaveSlot` shape). Do not heuristically reassign ownership; if the legacy slot lacks managerUserId, treat as invalid and do not migrate (return error). Write the migrated index and remove the legacy key.

- [ ] **Step 4: Run focused tests/web build**

```bash
npm run test:web -- --run src/api/localEngine.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: migration tests pass and web builds.

### Task 11: Atomic and Idempotent Offline Career Creation

**Files:**
- Modify: `packages/web/src/api/localEngine.ts`
- Create: `packages/web/src/api/localEngine.test.ts` (add creation tests)

**Interfaces:**
- Consumes: shared `CareerDraft`, `CareerClubChoice`, policy selectors.
- Produces:

```ts
export async function localCreateNewSave(
  input: CreateCareerInput,
): Promise<CreateCareerResult>;
```

- [ ] **Step 1: Add red tests for atomic offline creation**

Use Vitest with a `Map`-based localStorage mock to assert:

- validates input via shared selectors (same as online);
- creates per-career user and token (random UUIDs);
- applies one takeover/foundation branch using helpers that mirror online service;
- persists final slot once to `OFFLINE_SAVE_KEY_PREFIX + saveId`;
- updates index atomically (write to temp key, rename);
- rollback the new slot if index promotion fails (delete the slot key);
- preserves all old slots on quota failure (catch QUOTA_EXCEEDED and revert index);
- returns `reused: true` for exact retry (same idempotency key and payload);
- conflicts on changed payload (different idempotency key or payload);
- does NOT rebuild world on retry.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/api/localEngine.test.ts
```

Expected: localCreateNewSave missing or incomplete.

- [ ] **Step 3: Implement mutation-only helpers**

Create `claimClubInState` and `foundClubInState` that accept a `LocalGameState` (or equivalent) and mutate it in place, mirroring the online service's behavior but working on the in-memory state. Use the same shared policy selectors. Ensure `foundClubInState` seats the manager and fields a default tactic.

- [ ] **Step 4: Implement the creation flow**

```ts
export async function localCreateNewSave(
  input: CreateCareerInput,
): Promise<CreateCareerResult> {
  // 1. Validate via shared selectors (throws on invalid)
  // 2. Generate idempotency key if not provided (use input.idempotencyKey or randomUUID)
  // 3. Check local index for completed key -> return existing result with reused: true
  // 4. Create per-career userId and token (random UUIDs)
  // 5. Clone current LocalGameState to staging state
  // 6. Apply takeover or foundation branch using helpers on staging state
  // 7. Construct final SaveSlot from staging state (schemaVersion: 2, no token)
  // 8. Write slot to OFFLINE_SAVE_KEY_PREFIX + saveId
  // 9. Attempt to update index: read, add slot, update currentSaveId, update idempotency, write to temp key, rename
  // 10. If index update fails, delete the slot key and throw
  // 11. On quota failure during index write, revert index and throw QUOTA_ERROR (treated as STORAGE_ERROR)
  // 12. Return { save, token, userId, club, reused: false }
}
```

- [ ] **Step 5: Run focused tests/web build**

```bash
npm run test:web -- --run src/api/localEngine.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: offline creation tests pass and web builds.

### Task 12: Keep Offline Metadata Semantics Equal to Server

**Files:**
- Modify: `packages/web/src/api/localEngine.ts`
- Create: `packages/web/src/api/localEngine.test.ts` (add metadata tests)

**Interfaces:**
- Consumes: none.
- Produces:

```ts
export async function localListAvailableClubs(
  country?: string,
  division?: number,
): Promise<Club[]>;
```

- [ ] **Step 1: Add red tests for metadata parity**

Use Vitest with a `Map`-based localStorage mock to assert:

- `localListAvailableClubs` returns clubs filtered by both `country` and `division` when provided;
- if only `country` is provided, returns clubs in that country across all divisions;
- if only `division` is provided, returns clubs in that division across all countries;
- if neither provided, returns all clubs;
- offline behavior now matches online policy (does not ignore division and does not bypass mode ceiling).

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/api/localEngine.test.ts
```

Expected: localListAvailableClubs still ignores division.

- [ ] **Step 3: Implement filtered listing**

Modify `localListAvailableClubs` to read the offline index (or compute from saved slots) and filter by the provided `country` and `division` parameters. Ensure the function uses the same shared data as online (the saved slots in the index).

- [ ] **Step 4: Run focused tests/web build**

```bash
npm run test:web -- --run src/api/localEngine.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: metadata tests pass and web builds.

## Phase 4 — Single Four-Act Web Journey

### Task 13: Pure Wizard Reducer and Payload Construction

**Files:**
- Create: `packages/web/src/components/careerCreationState.ts`
- Create: `packages/web/src/components/careerCreationState.test.ts`

**Interfaces:**
- Consumes: shared `CareerDraft`, `CareerClubChoice`, `CreateCareerInput`, policy selectors.
- Produces:

```ts
export interface CountryOption {
  code: string;
  accessDivision?: number;
  size?: number;
}

export interface CareerCreationState {
  step: 1 | 2 | 3 | 4;
  draft: CareerDraft;
  metadata: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    playableCountries: CountryOption[];
    foundableCountries: CountryOption[];
  };
  clubs: {
    status: 'idle' | 'loading' | 'ready' | 'error';
    items: Club[];
    cacheKey?: string;
    requestId: number;
  };
  submission: {
    status: 'idle' | 'submitting' | 'success' | 'error';
    error?: string;
  };
}

export function makeInitialCareerState(idempotencyKey: string): CareerCreationState;
export function careerCreationReducer(state: CareerCreationState, action: CareerCreationAction): CareerCreationState;
export function buildCreateCareerInput(state: CareerCreationState, idempotencyKey: string): CreateCareerInput;
export function firstInvalidField(state: CareerCreationState): string | null;
export function clubCacheKey(countryCode: string, division: number): string;
```

- [ ] **Step 1: Add reducer invariants as red Node tests**

Test concrete action sequences:

```ts
let state = makeInitialCareerState('68fcc012-6174-4c25-8711-2020915ae355');
state = careerCreationReducer(state, { type: 'PATCH_MANAGER', patch: { firstName: 'Alex', lastName: 'Ribeiro' } });
state = careerCreationReducer(state, { type: 'GO_TO_STEP', step: 2 });
state = careerCreationReducer(state, { type: 'SET_GAME_MODE', mode: 'HARDCORE' });
state = careerCreationReducer(state, { type: 'GO_TO_STEP', step: 2 });
state = careerCreationReducer(state, { type: 'GO_TO_STEP', step: 3 });
state = careerCreationReducer(state, { type: 'PATCH_FOUND_CLUB', patch: { name: 'Aurora', city: 'Recife' } });
state = careerCreationReducer(state, { type: 'GO_TO_STEP', step: 2 });
state = careerCreationReducer(state, { type: 'GO_TO_STEP', step: 3 });
expect(state.draft.manager.firstName).toBe('Alex');
expect(state.draft.club).toMatchObject({ kind: 'FOUND', name: 'Aurora', city: 'Recife' });
```

Also assert:

- selecting Iron Man changes the branch to `FOUND` but preserves prior foundation customizations;
- derived policy/divisions are not stored in state;
- one metadata `START/RESOLVE/REJECT` state covers both country calls;
- a club response with stale `requestId` is ignored;
- cached key is `countryCode:division`;
- submit error leaves draft and idempotency key unchanged;
- final payload includes every manager/mode/club field exactly once;
- validation identifies the first invalid field in visual order.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/components/careerCreationState.test.ts
```

Expected: module missing.

- [ ] **Step 3: Implement one reducer and pure selectors**

Use exhaustive action switching with a `never` guard. Do not duplicate `mustFoundOwnClub()` or division rules. Preserve branch drafts either as two private subdrafts inside `CareerDraft` if the approved shared shape allows it, or retain the last foundation draft in reducer-only state; only the selected branch enters `CreateCareerInput`.

No reducer action performs I/O or creates a new idempotency key.

- [ ] **Step 4: Run focused tests and web build**

```bash
npm run test:web -- --run src/components/careerCreationState.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: pure reducer tests pass in the current Node Vitest environment.

### Task 14: Metadata Loader and Transient Club Cache

**Files:**
- Create: `packages/web/src/components/careerCreationData.ts`
- Create: `packages/web/src/components/careerCreationData.test.ts`
- Modify: `packages/web/src/components/OnboardingWizard.tsx`

**Interfaces:**
- Consumes: client metadata functions and Task 13 reducer actions.
- Produces:

```ts
export async function loadCareerMetadata(api: Pick<CareerApi, 'listPlayableCountries' | 'listFoundableCountries'>): Promise<CareerMetadata>;

export function createClubListLoader(
  fetchClubs: (countryCode: string, division: number, signal?: AbortSignal) => Promise<Club[]>,
): {
  load(countryCode: string, division: number): Promise<{ key: string; requestId: number; clubs: Club[] }>;
  clear(): void;
};
```

- [ ] **Step 1: Add red parallel/cache/race tests with deferred promises**

Verify both metadata functions are called synchronously before either promise resolves, and one rejection rejects the combined operation. For club lists, verify same key calls the API once, different keys independently cache, and a slower first request cannot become the accepted latest result after a faster second request.

Use hand-written deferred promises; add no test dependency.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/components/careerCreationData.test.ts
```

Expected: loader module missing.

- [ ] **Step 3: Implement Promise.all plus Map and monotonic request ID**

```ts
export async function loadCareerMetadata(api: CareerMetadataApi): Promise<CareerMetadata> {
  const [playableCountries, foundableCountries] = await Promise.all([
    api.listPlayableCountries(),
    api.listFoundableCountries(),
  ]);
  return { playableCountries, foundableCountries };
}
```

Use one in-memory `Map<string, Promise<Club[]>>` for the wizard lifetime. Delete failed promises from cache so Retry can call again. Use `AbortController` when supported plus `requestId` in reducer as the authoritative stale-result guard.

- [ ] **Step 4: Wire only effects and consolidated status**

On wizard mount dispatch one metadata `START`, resolve both together, or reject once. Load clubs only when step 3, branch `TAKE_OVER`, and country/division are valid. Reserve stable content space during loading. Retry reuses the draft and calls the loader again.

- [ ] **Step 5: Run focused tests/build**

```bash
npm run test:web -- --run src/components/careerCreationData.test.ts src/components/careerCreationState.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: parallelism/cache/race behavior and TS build pass.

### Task 15: Controlled Foundation Editor

**Files:**
- Modify: `packages/web/src/components/FoundClubForm.tsx`
- Create: `packages/web/src/components/foundClubDraft.test.ts`
- Optionally create: `packages/web/src/components/foundClubDraft.ts` only if file/base64 normalization cannot stay pure in `careerCreationState.ts`

**Interfaces:**
- Consumes: `FoundCareerClub`, foundable country options.
- Produces component props:

```ts
interface FoundClubFormProps {
  value: FoundCareerClub;
  foundable: CountryOption[];
  onChange: (next: FoundCareerClub) => void;
  errors?: Record<string, string>;
}
```

- [ ] **Step 1: Add red pure customization tests**

Because Vitest runs in Node and excludes `.test.tsx`, test the pure draft updater/file normalization. Assert changing country/name/city/city size/kit/colors/crest returns a complete `FoundCareerClub` and leaves other values unchanged. Test PNG file conversion with a small synthetic `data:image/png;base64,...` string and enforce the existing crest byte limit.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/components/foundClubDraft.test.ts
```

Expected: controlled draft helper missing or current form owns internal state.

- [ ] **Step 3: Remove persistence and duplicated local state from the form**

Delete imports/calls to `foundClub()` and `uploadEditorCrest()`, `busy`, and `onFounded/onError`. Every control updates `value` through `onChange`. Keep current `ClubCrest`, `CountryFlag`, `TeamJersey`, `CITY_SIZES`, kit choices, color presets, prompt generation, PNG read, and live preview.

Use `<fieldset><legend>` for city size, kit, colors, and crest groups. Choice buttons keep `aria-pressed`. Label the hidden file input through an actual `<label htmlFor>` and expose file/read errors next to it with `role="alert"`.

- [ ] **Step 4: Run tests/build**

```bash
npm run test:web -- --run src/components/foundClubDraft.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: form compiles as a controlled editor and has no write API import.

### Task 16: Four-Stage Onboarding and One Final Submission

**Files:**
- Modify: `packages/web/src/components/OnboardingWizard.tsx`
- Modify: `packages/web/src/components/OnboardingWizardStyles.test.ts`
- Modify: `packages/web/src/styles.css`

**Interfaces:**
- Consumes: reducer/data loader, controlled foundation editor, shared domain copy/bonuses, `createNewSave()`.
- Produces:

```ts
interface OnboardingWizardProps {
  onCompleted: (result: CreateCareerResult) => void;
  onCancel?: () => void;
}
```

- [ ] **Step 1: Add red source-contract tests for the JSX boundary**

Retain Node Vitest. Extend the current source/style test by reading `OnboardingWizard.tsx` and `FoundClubForm.tsx` with `node:fs` and asserting only stable safety properties:

```ts
expect(wizardSource.match(/createNewSave\(/g)).toHaveLength(1);
expect(wizardSource).not.toContain('claimClub(');
expect(wizardSource).not.toContain('foundClub(');
expect(foundFormSource).not.toContain('../api/client');
expect(wizardSource).toContain('aria-current="step"');
expect(wizardSource).toContain('aria-live="polite"');
expect(wizardSource).toContain('role="alert"');
expect(wizardSource).toContain('<fieldset');
```

Do not snapshot the full component or lock prose/classes with brittle assertions. Browser semantics are covered by Task 20.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/components/OnboardingWizardStyles.test.ts
```

Expected: multiple creation calls and missing four-stage semantics fail.

- [ ] **Step 3: Build stages 1–3 on one draft**

Render one shell with desktop rail and compact mobile progress. Use native buttons for stage navigation and selection cards. Stage 1 renders official credential, real `MANAGER_STYLES`, and bonus copy derived from the existing bonus functions/constants (for example +0.12 tactical reading, Formador 1.25x, Gestor 5%/8%); do not invent stats.

Stage 2 renders contracts from `GAME_MODE_INFO` with immutable consequences and shared restriction copy. Selecting Iron Man forces foundation. Stage 3 renders:

- takeover showcase: crest, colors, country, real division, budget, board expectation if already exposed by `Club`; unavailable cards explain why;
- controlled foundation preview with all persisted customization.

No stage calls a write API.

- [ ] **Step 4: Build stage 4 review, submission, and presentation**

Before submit, show a complete review and **Assinar contrato**. Validate/focus the first invalid field. While submitting, set `aria-busy`, announce real activity without percentage, and disable duplicate controls. Call exactly once per submit attempt:

```ts
const result = await createNewSave(buildCreateCareerInput(state, idempotencyKey));
dispatch({ type: 'SUBMIT_SUCCEEDED' });
setPresentation(result);
```

A network error stays on stage 4, retains draft/key, and exposes retry. `CLUB_UNAVAILABLE` refreshes the club cache and keeps selections. `MODE_RESTRICTION` shows shared copy. On success, render:

```text
O Treinador {managerName} é apresentado oficialmente no {club.name}.
```

Then invoke `onCompleted(result)` after the short CSS transition; reduced-motion completes immediately. A reload after server success relies on idempotent retry/load rather than creating again.

- [ ] **Step 5: Add focus and responsive CSS**

On step change, focus the stage heading (`tabIndex={-1}`). Use `.career-journey` with side rail at desktop and one-column/mobile progress below the existing 820px breakpoint. Add explicit `:focus-visible`. Animate only opacity/transform; under:

```css
@media (prefers-reduced-motion: reduce) {
  .career-stage,
  .career-presentation { animation: none; transition: none; transform: none; }
}
```

Keep body from horizontal scrolling; wide club lists scroll within their own container.

- [ ] **Step 6: Run focused and package checks**

```bash
npm run test:web -- --run src/components/OnboardingWizardStyles.test.ts src/components/careerCreationState.test.ts src/components/careerCreationData.test.ts src/components/foundClubDraft.test.ts
npm run test:web
npm run build --workspace @tactical-arena/web
```

Expected: one write call, complete four-stage compilation, and web suite/build pass.

## Phase 5 — UI Integration and Focus Lifecycle

### Task 17: Replace Duplicate Creation Form in StartSubmenuModal

**Files:**
- Modify: `packages/web/src/components/StartSubmenuModal.tsx`
- Modify: `packages/web/src/components/StartSubmenuModal.test.ts`

**Interfaces:**
- Consumes: shared domain, `createNewSave()`, `signIn()`.
- Produces:

```ts
interface StartSubmenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewCareer: (result: CreateCareerResult) => void;
  onLoadCareer: (saveId: string) => void;
}
```

- [ ] **Step 1: Add red tests for single creation path and auth flow**

Write Node Vitest that reads the file with `fs` and asserts:

```ts
expect(modalSource).not.toContain('createNewSave(');
expect(modalSource).not.toContain('claimClub(');
expect(modalSource).not.toContain('foundClub(');
expect(modalSource).toContain('createNewSave(');
expect(modalSource).toContain('signIn(');
```

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/components/StartSubmenuModal.test.ts
```

Expected: duplicated manager/mode form still present.

- [ ] **Step 3: Remove internal manager/profile and mode state**

Delete local `useState` for firstName, lastName, nationality, style, gameMode. Remove duplicated form JSX.

- [ ] **Step 4: Replace with thin controller that delegates to wizard**

Render `<OnboardingWizard onCompleted={handleNewCareer} onCancel={onClose} />` inside the modal when tab is "new". Keep `continue` and `load` tabs unchanged. On wizard success, call `signIn(result.token, result.userId)` then `onNewCareer(result)`. Propagate errors via modal's existing error state.

- [ ] **Step 5: Run tests/build**

```bash
npm run test:web -- --run src/components/StartSubmenuModal.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: modal compiles without duplicated form and delegates creation to wizard.

### Task 18: Make Start.tsx the Career Hub Entry without Fake Login

**Files:**
- Modify: `packages/web/src/pages/Start.tsx`
- Modify: `packages/web/src/pages/Start.test.ts`

**Interfaces:**
- Consumes: auth state, `signIn()`, navigation.
- Produces:

```tsx
export default function Start() {
  const { token, userId, isAuthenticated } = useAuth();
  // ...
}
```

- [ ] **Step 1: Add red tests for auth-gated navigation and no fallback**

Read the file and assert:

```ts
expect(startSource).not.toContain('login(');
expect(startSource).not.toContain('local_manager_token_1');
expect(startSource).not.toContain('local_manager_1');
expect(startSource).toContain('isAuthenticated');
expect(startSource).toContain('navigate');
```

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/components/Start.test.ts
```

Expected: fake login attempt still present.

- [ ] **Step 3: Remove try/catch login block**

Delete the entire block that attempts login with hardcoded credentials and falls back to fake identity.

- [ ] **Step 4: Guard Career Hub with auth and show appropriate UI**

If `!isAuthenticated`, show a message prompting to sign in via existing server flow (outside scope; assume `signIn` is called elsewhere). If authenticated, render `<StartSubmenuModal isOpen={true} onClose={() => {}} onNewCareer={handleNew} onLoadCareer={handleLoad} />` inside the page (or reuse existing modal controller). Keep `continue` and `load` logic unchanged: they already use `signIn` with returned token/user.

- [ ] **Step 5: Run tests/build**

```bash
npm run test:web -- --run src/components/Start.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: Start page compiles without fake login and relies on auth state.

### Task 19: Strip Dashboard of All Creation State and API Calls

**Files:**
- Modify: `packages/web/src/pages/Dashboard.tsx`
- Modify: `packages/web/src/pages/Dashboard.test.ts`

**Interfaces:**
- Consumes: club data, saves list, auth.
- Produces:

```tsx
export default function Dashboard() {
  const { saves, token, userId } = useGameState();
  // ...
}
```

- [ ] **Step 1: Add red tests for absent creation state and API usage**

Read the file and assert:

```ts
expect(dashSource).not.toContain('gameMode');
expect(dashSource).not.toContain('foundableCountries');
expect(dashSource).not.toContain('playableCountries');
expect(dashSource).not.toContain('selectedCountry');
expect(dashSource).not.toContain('selectedDivision');
expect(dashSource).not.toContain('clubListing');
expect(dashSource).not.toContain('currentManager');
expect(dashSource).not.toContain('listFoundableCountries(');
expect(dashSource).not.toContain('listPlayableCountries(');
expect(dashSource).not.toContain('listAvailableClubs(');
expect(dashSource).not.toContain('OnboardingWizard');
```

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/components/Dashboard.test.ts
```

Expected: obsolete creation state still present.

- [ ] **Step 3: Delete all creation-related state and effects**

Remove `useState` for mode, gameMode, foundableCountries, playableCountries, selectedCountry, selectedDivision, clubListing, wizard visibility, current manager. Delete effects that call metadata/listing functions. Remove conditional rendering of `OnboardingWizard`.

- [ ] **Step 4: Keep only dashboard consumer logic**

Retain saves list, continue/load/new buttons that open `StartSubmenuModal`, and club navigation. Ensure `useGameState` provides `saves`, `token`, `userId`.

- [ ] **Step 5: Run tests/build**

```bash
npm run test:web -- --run src/components/Dashboard.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: Dashboard compiles as pure consumer with no creation state/API.

### Task 20: Implement Focus Lifecycle, Modal Trap, and Presentation Navigation

**Files:**
- Modify: `packages/web/src/components/OnboardingWizard.tsx`
- Modify: `packages/web/src/components/StartSubmenuModal.tsx`
- Create: `packages/web/src/components/focusUtils.ts`
- Create: `packages/web/src/components/focusUtils.test.ts`

**Interfaces:**
- Consumes: none.
- Produces:

```ts
export function trapFocus(container: HTMLElement): () => void;
export function restoreFocus(): void;
export function focusFirstFocusable(container: HTMLElement): void;
export function focusLastFocusable(container: HTMLElement): void;
```

- [ ] **Step 1: Add red tests for focus utility behavior**

Use jsdom-like environment via Vitest (still Node) to assert trap/restore and first/last focusable.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/components/focusUtils.test.ts
```

Expected: focus utilities missing.

- [ ] **Step 3: Implement trap/restore with tab loop and focusable selectors**

Use `[tabindex]:not([tabindex="-1"]), button, [input], select, textarea, [contenteditable]` and store previous activeElement on trap, restore on return function call.

- [ ] **Step 4: Wire wizard modal and StartSubmenuModal**

On wizard mount, trap focus inside the modal container and store the return cleanup. On unmount, call cleanup and restore focus to the trigger button (passed via `onCancel` or props). On step change, focus the stage heading (`tabIndex={-1}`). On validation error, focus the first invalid field.

- [ ] **Step 5: Run focused tests/build**

```bash
npm run test:web -- --run src/components/focusUtils.test.ts src/components/OnboardingWizard.test.ts src/components/StartSubmenuModal.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: focus utilities pass and modals trap/restore focus.

### Task 21: Add Responsive, Reduced-Motion, and Accessibility CSS

**Files:**
- Modify: `packages/web/src/styles.css`

**Interfaces:**
- Consumes: none.
- Produces:

```css
/* career journey layout */
.career-journey { display: grid; grid-template-columns: 15rem minmax(0, 1fr); gap: 1.2rem; }
@media (max-width: 700px) { .career-journey { grid-template-columns: 1fr; } }
/* rail */
.rail { /* existing vars */ }
/* stage */
.career-stage { /* existing vars */ }
/* reduced motion */
@media (prefers-reduced-motion: reduce) {
  .career-stage,
  .career-presentation { animation: none; transition: none; transform: none; }
}
/* focus visible */
:focus-visible { outline: 2px solid #d9ac3b; outline-offset: 2px; }
/* wide club list scrolling */
.club-list { overflow-x: auto; }
/* alert role styling */
[role="alert"] { /* existing vars */ }
```

- [ ] **Step 1: Add red tests for CSS class presence and media rules**

Read the CSS file and assert:

```ts
expect(css).toContain('.career-journey');
expect(css).toContain('@media (prefers-reduced-motion: reduce)');
expect(css).toContain(':focus-visible');
expect(css).toContain('.club-list');
expect(css).toContain('[role="alert"]');
```

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:web -- --run src/components/OnboardingWizardStyles.test.ts
```

Expected: missing responsive/reduced-motion/a11y rules.

- [ ] **Step 3: Append the exact CSS blocks**

Use existing CSS variable names from the approved visual mockup (e.g., `--clr-gold`, `--clr-dark`). Keep horizontal scroll only on club lists; wide country lists also scroll if needed.

- [ ] **Step 4: Run focused tests/build**

```bash
npm run test:web -- --run src/components/OnboardingWizardStyles.test.ts
npm run build --workspace @tactical-arena/web
```

Expected: CSS compiles and wizard suite passes.

## Phase 6 — Verification and Handoff

### Task 22: Browser E2E Online/Offline with Playwright

**Files:**
- Create: `packages/e2e/tests/career-creation.spec.ts`
- Create: `packages/e2e/playwright.config.ts` (if missing)
- Modify: `packages/e2e/package.json` (add scripts if needed)

**Interfaces:**
- Consumes: built web/desktop/android, server binary.
- Produces:

```ts
test.describe('career creation flow', () => {
  test('online takeover in permitted division', async ({ page }) => { /* ... */ });
  test('online foundation with customization', async ({ page }) => { /* ... */ });
  test('offline creation mirrors online rules', async ({ page }) => { /* ... */ });
  test('double-click idempotency', async ({ page }) => { /* ... */ });
  test('network interruption no runtime fallback', async ({ page }) => { /* ... */ });
  test('legacy migration preserves saves', async ({ page }) => { /* ... */ });
  test('desktop/mobile accessibility', async ({ page }) => { /* ... */ });
});
```

- [ ] **Step 1: Add red E2E spec for one online takeover**

Use `page.goto()` to local dev server, fill wizard, submit, assert navigation to `/clubs/:clubId` and correct club data.

- [ ] **Step 2: Run and confirm red**

```bash
npm run test:e2e
```

Expected: missing test file or Playwright not configured.

- [ ] **Step 3: Add minimal Playwright config**

If `packages/e2e/playwright.config.ts` does not exist, create with:

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:3000' },
});
```

- [ ] **Step 4: Implement remaining scenarios using existing API mocks or dev server**

Leverage the existing dev server (`npm run dev`) or start server/binary in `beforeAll`. Use `page.waitForResponse()` for API calls. Test offline by toggling network or using Capacitor/Android build if available; otherwise simulate via service worker or mock `isOfflineMode()`.

- [ ] **Step 5: Run focused E2E and package checks**

```bash
npm run test:e2e -- --grep "career creation"
npm run test:e2e
```

Expected: E2E specs pass in headless Chromium.

### Task 23: Add Root Build Script and Run Full Verification

**Files:**
- Modify: `package.json` (root)

**Interfaces:**
- Consumes: none.
- Produces:

```json
{
  "scripts": {
    "build": "npm run build:shared && npm run build:web && npm run build:desktop && npm run build:android"
  }
}
```

- [ ] **Step 1: Add red test for missing root build script**

Run `npm run build` and expect failure.

- [ ] **Step 2: Run and confirm red**

```bash
npm run build
```

Expected: missing script.

- [ ] **Step 3: Add exact build script as above**

Use existing workspace scripts: `build:shared`, `build:web`, `build:desktop`, `build:android`. If any missing, create them to run `tsc` or `vite build` as appropriate.

- [ ] **Step 4: Run full verification chain**

```bash
npm run test
npm run build
```

Expected: all packages test and build without TypeScript errors.

### Task 24: Manual Smoke Test: Creation Opens Synchronized ClubHome

**Files:**
- None (manual step).

**Interfaces:**
- Consumes: running dev server.
- Produces: visual confirmation.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Create a new career online (takeover)**

Navigate to Start → New Career → fill credentials → choose Standard mode → select an available club in division 2 or lower → submit → assert navigation to `/clubs/:clubId` with correct club name and manager.

- [ ] **Step 3: Create a new career offline (foundation)**

Toggle offline mode (if available) → fill credentials → choose Iron Man mode → found a club with name, city, colors, crest → submit → assert same synchronization.

- [ ] **Step 4: Verify no orphan saves, no token in slot, correct metadata**

Inspect IndexedDB/localStorage or save index via dev tools; assert `managerToken` absent, `schemaVersion: 2`, fields present.

- [ ] **Step 5: Test retry and double-click idempotency**

Click submit twice fast or after network delay; assert only one save created and `reused: true` on second.

- [ ] **Step 6: Test network interruption without fallback**

Block `/saves/new` after submission; assert error shown, draft preserved, no silent offline write.

- [ ] **Step 7: Test legacy migration**

Insert a legacy `schemaVersion: 1` save (if any) → start app → assert migration to version 2 without data loss or ownership reassignment.

- [ ] **Step 8: Test desktop/mobile accessibility**

Tab through wizard, assert visible focus, trap in modals, announce live regions, reduced motion disables animations.

### Task 25: Final Plan Self-Review and Handoff

**Files:**
- Read: `docs/superpowers/plans/2026-09-08-unified-career-creation.md`
- Read: `docs/second-brain/04_CAREER_FLOW_SPEC.md`

**Interfaces:**
- Consumes: none.
- Produces: confirmed plan.

- [ ] **Step 1: Spec coverage checklist**

Iterate each requirement in the approved spec and map to a task number. Mark any gaps.

- [ ] **Step 2: Placeholder scan**

Search for `TBD`, `TODO`, `TODO`, `unimplemented`, `placeholder`, `fix later`. Remove any.

- [ ] **Step 3: Type consistency check**

Verify that `CareerDraft`, `CareerClubChoice`, `CareerCrest` usage matches shared definitions across reducer, data loader, form, wizard.

- [ ] **Step 4: Fix stale `CrestSpec` prose**

Locate the remaining occurrence in `docs/second-brain/04_CAREER_FLOW_SPEC.md` line 98 and change `CrestSpec` to `CareerCrest`.

- [ ] **Step 5: Resolve server-plan ambiguities**

Confirm transaction seams: `fieldDefaultTactic` must not swallow errors; `seatUserAsManager` and `foundClub` must receive `db` parameter through all nested calls; `creationId` stored in a dedicated marker table or existing metadata row (decide: add `creationId` to `CareerCreationMarker` table). Ensure no global Prisma leakage.

- [ ] **Step 6: Confirm execution handoff readiness**

After tasks #24 and #25 are complete, offer only the approved execution choices:

1. Subagent-Driven Development — recommended.
2. Inline Execution using `superpowers:executing-plans`.

Do not begin production implementation before that handoff choice.
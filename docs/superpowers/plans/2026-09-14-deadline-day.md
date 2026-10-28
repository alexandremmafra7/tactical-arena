# Deadline Day and Live Auction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Deadline Day live auction engine with identical behavior on the server and offline `localEngine`.

**Architecture:** Keep all auction state transitions and bid rules as pure functions in `@tactical-arena/shared`. The server and `localEngine` load/persist state and settle winning transfers using their native storage mechanisms.

**Tech Stack:** TypeScript 5.8, Vitest, Express, Prisma/SQLite, React, React Router, localStorage.

**Spec:** `docs/superpowers/specs/2026-09-14-deadline-day-design.md`

## Global Constraints

- Server and offline mode must call the same shared auction transitions.
- Do not add dependencies.
- Auction hours advance exactly `12 → 8 → 4 → 2 → 1 → 0`.
- The opening bid must meet `minimumBid`; later bids must be at least 5% above `currentBid`.
- Panic sell discounts stay between 15% and 30% and never mutate `Player.marketValue`.
- Settlement revalidates clubs, seller ownership of the player, and buyer budget.
- Persist one complete transition per action; never leave money or a player partially moved.
- Saves without Deadline Day data load with a valid inactive default.
- This directory has no Git metadata. Treat commit steps as local checkpoints unless Git is restored.

---

## File Structure

### Create

- `packages/shared/src/domain/deadlineDay.ts` — types and pure state transitions.
- `packages/shared/src/domain/deadlineDay.test.ts` — shared rules and deterministic behavior.
- `packages/server/src/services/deadlineDayService.ts` — Prisma adapter, seeding, authorization, and settlement.
- `packages/server/src/deadlineDayFlow.test.ts` — authenticated HTTP and atomic settlement flow.

### Modify

- `packages/shared/src/index.ts` — export the shared domain.
- `packages/server/prisma/schema.prisma` — persist `GameState.deadlineDayJson`.
- `packages/server/src/db/ensureSchema.ts` — add the field to old SQLite saves.
- `packages/server/src/routes/transfers.ts` — add read, bid, and advance endpoints.
- `packages/web/src/api/localEngine.ts` — offline persistence, actions, and settlement.
- `packages/web/src/api/localEngine.test.ts` — offline behavior and save compatibility.
- `packages/web/src/api/client.ts` — unified HTTP/offline contract.
- `packages/web/src/pages/TransfersHub.tsx` — Deadline Day tab.
- `packages/web/src/styles.css` — minimal responsive styles.

---

### Task 1: Shared Deadline Day state machine

**Files:**
- Create: `packages/shared/src/domain/deadlineDay.ts`
- Create: `packages/shared/src/domain/deadlineDay.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `Player`, `Position`, and injected `rng: () => number`.
- Produces:

```ts
export interface AuctionBid {
  clubId: string;
  clubName: string;
  amount: number;
  wageOffer: number;
  timestamp: string;
  isUserBid: boolean;
}
export interface DeadlineAuctionItem {
  id: string;
  player: Player;
  sellerClubId: string;
  sellerClubName: string;
  minimumBid: number;
  currentBid: number;
  highestBidderClubId: string | null;
  highestBidderClubName: string | null;
  bids: AuctionBid[];
  hoursRemaining: number;
  status: 'ACTIVE' | 'RESOLVED_SOLD' | 'RESOLVED_UNSOLD';
  isPanicSell?: boolean;
  panicDiscountPct?: number;
}
export interface DeadlineDayState {
  isActive: boolean;
  seasonYear: number;
  windowType: 'PRE_SEASON' | 'MID_SEASON';
  currentHour: number;
  auctions: DeadlineAuctionItem[];
  breakingNews: string[];
  panicBuyRequests: Array<{
    clubId: string;
    clubName: string;
    positionNeeded: Position;
    budgetMax: number;
  }>;
}
export interface DeadlineBidInput {
  auctionId: string;
  clubId: string;
  clubName: string;
  amount: number;
  wageOffer: number;
  timestamp: string;
  isUserBid: boolean;
  availableBudget: number;
}
export interface DeadlineAiClub {
  clubId: string;
  clubName: string;
  availableBudget: number;
  positionNeeded: Position;
}
export interface DeadlineSettlement {
  auctionId: string;
  playerId: string;
  sellerClubId: string;
  buyerClubId: string;
  amount: number;
  wageOffer: number;
}
export interface DeadlineAdvanceResult {
  state: DeadlineDayState;
  settlements: DeadlineSettlement[];
}
export class DeadlineDayError extends Error {}
export const DEADLINE_HOURS = [12, 8, 4, 2, 1, 0] as const;
export function inactiveDeadlineDay(seasonYear: number): DeadlineDayState;
export function createDeadlineDayState(input: {
  seasonYear: number;
  windowType: DeadlineDayState['windowType'];
  auctions: DeadlineAuctionItem[];
  panicBuyRequests?: DeadlineDayState['panicBuyRequests'];
}): DeadlineDayState;
export function nextMinimumBid(item: DeadlineAuctionItem): number;
export function placeDeadlineBid(state: DeadlineDayState, input: DeadlineBidInput): DeadlineDayState;
export function applyPanicSell(item: DeadlineAuctionItem, discountPct: number): DeadlineAuctionItem;
export function advanceDeadlineDay(
  state: DeadlineDayState,
  aiClubs: DeadlineAiClub[],
  timestamp: string,
  rng: () => number,
): DeadlineAdvanceResult;
```

- [ ] **Step 1: Write failing shared tests**

Create `deadlineDay.test.ts` with a fixture auction and these exact cases:

```ts
it('requires the opening bid and then a rounded 5% raise', () => {
  expect(nextMinimumBid(auction())).toBe(1_000_000);
  const placed = placeDeadlineBid(state(), {
    auctionId: 'auction-1', clubId: 'buyer', clubName: 'Comprador',
    amount: 1_000_000, wageOffer: 20_000,
    timestamp: '2026-01-31T09:00:00.000Z', isUserBid: true,
    availableBudget: 2_000_000,
  });
  expect(nextMinimumBid(placed.auctions[0])).toBe(1_050_000);
});

it('rejects invalid, self, closed, under-minimum, and unaffordable bids', () => {
  const input = {
    auctionId: 'auction-1', clubId: 'seller', clubName: 'Vendedor',
    amount: 1_000_000, wageOffer: 20_000,
    timestamp: '2026-01-31T09:00:00.000Z', isUserBid: true,
    availableBudget: 2_000_000,
  };
  expect(() => placeDeadlineBid(state(), input)).toThrow(DeadlineDayError);
  expect(() => placeDeadlineBid(state(), { ...input, clubId: 'buyer', amount: Number.NaN })).toThrow(DeadlineDayError);
  expect(() => placeDeadlineBid(state(), { ...input, clubId: 'buyer', availableBudget: 999_999 })).toThrow(DeadlineDayError);
  expect(() => placeDeadlineBid({ ...state(), currentHour: 0 }, { ...input, clubId: 'buyer' })).toThrow(DeadlineDayError);
});

it('bounds panic sell without changing market value', () => {
  expect(() => applyPanicSell(auction(), 14)).toThrow(DeadlineDayError);
  const discounted = applyPanicSell(auction(), 20);
  expect(discounted.minimumBid).toBe(800_000);
  expect(discounted.player.marketValue).toBe(auction().player.marketValue);
});

it('advances 12, 8, 4, 2, 1, 0 and settles only at zero', () => {
  let result = { state: stateWithBid(), settlements: [] };
  for (const hour of [8, 4, 2, 1, 0]) {
    result = advanceDeadlineDay(result.state, [], '2026-01-31T10:00:00.000Z', () => 0.99);
    expect(result.state.currentHour).toBe(hour);
  }
  expect(result.state.auctions[0].status).toBe('RESOLVED_SOLD');
  expect(result.settlements[0]).toMatchObject({ buyerClubId: 'buyer', amount: 1_000_000 });
});

it('uses injected RNG for repeatable AI bids', () => {
  const ai = [{ clubId: 'ai', clubName: 'IA FC', availableBudget: 2_000_000, positionNeeded: auction().player.position }];
  expect(advanceDeadlineDay(state(), ai, '2026-01-31T10:00:00.000Z', () => 0))
    .toEqual(advanceDeadlineDay(state(), ai, '2026-01-31T10:00:00.000Z', () => 0));
});
```

Use a small literal `Player` fixture or an existing deterministic player generator; do not depend on random test data.

- [ ] **Step 2: Verify the tests fail**

Run:

```bash
npm run test -w packages/shared -- --run src/domain/deadlineDay.test.ts
```

Expected: FAIL because `./deadlineDay.js` does not exist.

- [ ] **Step 3: Implement the immutable state machine**

Implement cloning with object/array spreads. `nextMinimumBid` returns `minimumBid` before any bid, then:

```ts
Math.ceil((item.currentBid * 1.05) / 1_000) * 1_000
```

Use `DEADLINE_HOURS` to advance. Allow at most one bid per matching AI club and auction per hour when `rng() < 0.45`; every AI attempt must call `placeDeadlineBid`. At 4, 2, or 1 hours, auctions without bids can enter panic sell using:

```ts
const discountPct = 15 + Math.floor(rng() * 16);
```

At zero, resolve every auction and emit one settlement per sold item. Keep only the latest 30 news entries with `.slice(-30)`.

- [ ] **Step 4: Export and verify**

Append to `packages/shared/src/index.ts`:

```ts
export * from './domain/deadlineDay.js';
```

Run:

```bash
npm run test -w packages/shared -- --run src/domain/deadlineDay.test.ts
npm run build -w packages/shared
```

Expected: PASS.

- [ ] **Step 5: Local checkpoint**

Record the two new shared files and barrel export. If Git is restored, commit `feat: add shared deadline day auction engine`.

---

### Task 2: Server persistence and settlement adapter

**Files:**
- Modify: `packages/server/prisma/schema.prisma`
- Modify: `packages/server/src/db/ensureSchema.ts`
- Create: `packages/server/src/services/deadlineDayService.ts`
- Test: `packages/server/src/deadlineDayFlow.test.ts`

**Interfaces:**
- Consumes: Task 1 functions, Prisma, existing club conversion/role-vacating helpers, and seeded RNG.
- Produces:

```ts
export async function getDeadlineDay(clubId: string): Promise<DeadlineDayState>;
export async function placeDeadlineDayBid(input: {
  auctionId: string;
  buyerClubId: string;
  amount: number;
  wageOffer: number;
  requestingUserId: string;
}): Promise<DeadlineDayState>;
export async function advanceDeadlineDayHour(input: {
  clubId: string;
  requestingUserId: string;
}): Promise<DeadlineDayState>;
```

- [ ] **Step 1: Write a failing server flow test**

Follow `transferFlow.test.ts` helpers to register two managers and create seller/buyer clubs. Create an active listing, then assert:

```ts
const initial = await request(app)
  .get(`/transfers/deadline-day?clubId=${buyer.id}`)
  .set('Authorization', `Bearer ${buyerManager.token}`)
  .expect(200);
const auction = initial.body.auctions.find((item: any) => item.player.id === seller.players[0].id);
expect(auction).toBeTruthy();

await request(app).post('/transfers/deadline-day/bid')
  .set('Authorization', `Bearer ${buyerManager.token}`)
  .send({ auctionId: auction.id, buyerClubId: buyer.id, amount: askingPrice, wageOffer: seller.players[0].wage })
  .expect(200);

for (let i = 0; i < 5; i += 1) {
  await request(app).post('/transfers/deadline-day/advance')
    .set('Authorization', `Bearer ${buyerManager.token}`)
    .send({ clubId: buyer.id })
    .expect(200);
}
```

Re-fetch both clubs and assert the player moved once, the seller gained the winning amount, and the buyer lost it. Add a second case proving an authenticated manager cannot bid through a club they do not own.

- [ ] **Step 2: Verify the flow test fails**

Run:

```bash
npm run test -w packages/server -- --run src/deadlineDayFlow.test.ts
```

Expected: FAIL with `404` for `/transfers/deadline-day`.

- [ ] **Step 3: Add persistence**

Add to `GameState` in `schema.prisma`:

```prisma
deadlineDayJson String @default("{\"isActive\":false,\"seasonYear\":0,\"windowType\":\"PRE_SEASON\",\"currentHour\":0,\"auctions\":[],\"breakingNews\":[],\"panicBuyRequests\":[]}")
```

Add the matching `GameState` entry in `ensureSchema.ts`:

```ts
{
  name: 'deadlineDayJson',
  ddl: `"deadlineDayJson" TEXT NOT NULL DEFAULT '{"isActive":false,"seasonYear":0,"windowType":"PRE_SEASON","currentHour":0,"auctions":[],"breakingNews":[],"panicBuyRequests":[]}'`,
},
```

Run:

```bash
npx prisma generate --schema packages/server/prisma/schema.prisma
npm run build -w packages/server
```

Expected: PASS.

- [ ] **Step 4: Implement the focused service**

Use these private boundaries:

```ts
function auctionFromListing(record: TransferListingRecord, sellerName: string): DeadlineAuctionItem;
async function loadOrCreateDeadlineDay(): Promise<DeadlineDayState>;
async function persistDeadlineDay(state: DeadlineDayState): Promise<void>;
async function settleDeadlineDay(result: DeadlineAdvanceResult): Promise<DeadlineDayState>;
```

`loadOrCreateDeadlineDay` reads singleton `GameState`, parses `deadlineDayJson`, and returns current active state. Otherwise it maps active `TransferListing` records to 12-hour auctions, preserving listing IDs as auction IDs.

`placeDeadlineDayBid` verifies `buyer.ownerId === requestingUserId`, supplies the buyer's current budget and `new Date().toISOString()` to shared `placeDeadlineBid`, then persists.

`advanceDeadlineDayHour` verifies ownership of the requesting club, maps bot-owned clubs to `DeadlineAiClub`, and injects:

```ts
createRng(`deadline-${state.seasonYear}-${state.currentHour}-${state.auctions.length}`)
```

In one interactive Prisma transaction, `settleDeadlineDay` re-fetches every seller/buyer. If a club vanished, the player left, buyer equals seller, or funds are insufficient, mark that auction unsold. Otherwise remove the player from seller, assign `settlement.wageOffer`, append once to buyer, credit/debit the bid, clear seller player-role IDs with the existing helper, mark matching listing sold, and update `GameState.deadlineDayJson` in that same transaction.

- [ ] **Step 5: Build the service**

Run:

```bash
npm run build -w packages/server
```

Expected: PASS. The HTTP test remains red until Task 3 adds routes.

- [ ] **Step 6: Local checkpoint**

Record schema, migration, service, and test. If Git is restored, commit `feat: persist and settle deadline day auctions`.

---

### Task 3: HTTP routes and unified API client

**Files:**
- Modify: `packages/server/src/routes/transfers.ts`
- Modify: `packages/web/src/api/client.ts`

**Interfaces:**
- Consumes: Task 2 service functions.
- Produces:

```ts
export function getDeadlineDay(clubId: string): Promise<DeadlineDayState>;
export function placeDeadlineDayBid(input: {
  auctionId: string;
  buyerClubId: string;
  amount: number;
  wageOffer: number;
}): Promise<DeadlineDayState>;
export function advanceDeadlineDay(clubId: string): Promise<DeadlineDayState>;
```

- [ ] **Step 1: Add an invalid-body HTTP assertion**

Extend `deadlineDayFlow.test.ts`:

```ts
const invalid = await request(app)
  .post('/transfers/deadline-day/bid')
  .set('Authorization', `Bearer ${buyerManager.token}`)
  .send({ auctionId: 4, buyerClubId: buyer.id, amount: '50000', wageOffer: null });
expect(invalid.status).toBe(400);
expect(invalid.body.error).toContain('auctionId');
```

- [ ] **Step 2: Add authenticated routes**

Add these before parameterized routes:

```ts
transfersRouter.get('/deadline-day', async (req, res) => {
  const clubId = typeof req.query.clubId === 'string' ? req.query.clubId : undefined;
  if (!clubId) return void res.status(400).json({ error: 'clubId é obrigatório' });
  try { res.json(await getDeadlineDay(clubId)); }
  catch (error) { handleDeadlineError(error, res); }
});

transfersRouter.post('/deadline-day/bid', async (req: AuthedRequest, res) => {
  const { auctionId, buyerClubId, amount, wageOffer } = req.body ?? {};
  if (typeof auctionId !== 'string' || typeof buyerClubId !== 'string' ||
      typeof amount !== 'number' || typeof wageOffer !== 'number') {
    return void res.status(400).json({ error: 'auctionId, buyerClubId, amount e wageOffer são obrigatórios' });
  }
  try {
    res.json(await placeDeadlineDayBid({ auctionId, buyerClubId, amount, wageOffer, requestingUserId: req.userId! }));
  } catch (error) { handleDeadlineError(error, res); }
});

transfersRouter.post('/deadline-day/advance', async (req: AuthedRequest, res) => {
  const { clubId } = req.body ?? {};
  if (typeof clubId !== 'string') return void res.status(400).json({ error: 'clubId é obrigatório' });
  try { res.json(await advanceDeadlineDayHour({ clubId, requestingUserId: req.userId! })); }
  catch (error) { handleDeadlineError(error, res); }
});
```

Map known Deadline/transfer domain errors to status 400; pass unknown errors to the existing Express error behavior.

- [ ] **Step 3: Run server tests**

```bash
npm run test -w packages/server -- --run src/deadlineDayFlow.test.ts
npm run build -w packages/server
```

Expected: PASS.

- [ ] **Step 4: Add client dispatch functions**

Import `DeadlineDayState` and add alongside transfer methods:

```ts
export function getDeadlineDay(clubId: string) {
  if (isOfflineMode()) return localEngine.localGetDeadlineDay(clubId);
  return request<DeadlineDayState>(`/transfers/deadline-day?clubId=${encodeURIComponent(clubId)}`)
    .catch(() => localEngine.localGetDeadlineDay(clubId));
}
export function placeDeadlineDayBid(input: {
  auctionId: string; buyerClubId: string; amount: number; wageOffer: number;
}) {
  if (isOfflineMode()) return localEngine.localPlaceDeadlineDayBid(input);
  return request<DeadlineDayState>('/transfers/deadline-day/bid', {
    method: 'POST', body: JSON.stringify(input),
  }).catch(() => localEngine.localPlaceDeadlineDayBid(input));
}
export function advanceDeadlineDay(clubId: string) {
  if (isOfflineMode()) return localEngine.localAdvanceDeadlineDay(clubId);
  return request<DeadlineDayState>('/transfers/deadline-day/advance', {
    method: 'POST', body: JSON.stringify({ clubId }),
  }).catch(() => localEngine.localAdvanceDeadlineDay(clubId));
}
```

- [ ] **Step 5: Check the dependency boundary**

Run:

```bash
npm run build -w packages/server
npm run build -w packages/web
```

Expected: server PASS; web FAIL only because Task 4's three local exports do not exist.

- [ ] **Step 6: Local checkpoint**

Record routes and client functions. If Git is restored, commit `feat: expose deadline day API`.

---

### Task 4: Offline adapter with server parity

**Files:**
- Modify: `packages/web/src/api/localEngine.ts`
- Modify: `packages/web/src/api/localEngine.test.ts`

**Interfaces:**
- Consumes: Task 1 state machine and Task 3 client signatures.
- Produces:

```ts
export async function localGetDeadlineDay(clubId: string): Promise<DeadlineDayState>;
export async function localPlaceDeadlineDayBid(input: {
  auctionId: string; buyerClubId: string; amount: number; wageOffer: number;
}): Promise<DeadlineDayState>;
export async function localAdvanceDeadlineDay(clubId: string): Promise<DeadlineDayState>;
```

- [ ] **Step 1: Write a failing offline flow test**

Import the local functions. Claim a local club, insert an active listing from another club with synthetic ID `offline-deadline-listing`, save, and assert:

```ts
const initial = await localGetDeadlineDay('club_BRA_1');
const auction = initial.auctions.find((item) => item.player.id === player.id)!;
await localPlaceDeadlineDayBid({
  auctionId: auction.id,
  buyerClubId: 'club_BRA_1',
  amount: 10_000,
  wageOffer: player.wage,
});
for (let i = 0; i < 5; i += 1) await localAdvanceDeadlineDay('club_BRA_1');

const after = loadLocalGameState();
expect(after.clubs.find((club) => club.id === 'club_BRA_1')!.players.some((item) => item.id === player.id)).toBe(true);
expect(after.clubs.find((club) => club.id === seller.id)!.players.some((item) => item.id === player.id)).toBe(false);
expect(after.deadlineDay?.currentHour).toBe(0);
```

Add a second case that removes `deadlineDay` from saved JSON, reloads, and confirms a valid default is supplied.

- [ ] **Step 2: Verify the test fails**

```bash
npm run test -w packages/web -- --run src/api/localEngine.test.ts
```

Expected: FAIL because the local functions do not exist.

- [ ] **Step 3: Add save compatibility**

Add to `LocalGameState`:

```ts
deadlineDay?: DeadlineDayState;
```

Initialize new saves with `inactiveDeadlineDay(2026)`. Normalize existing saves after parsing:

```ts
parsed.deadlineDay ??= inactiveDeadlineDay(parsed.currentSeason || parsed.gameDate.year);
```

- [ ] **Step 4: Implement local actions**

`localGetDeadlineDay` validates the club and lazily creates state from active listings. Keep listing IDs as auction IDs.

`localPlaceDeadlineDayBid` validates the buyer, calls shared `placeDeadlineBid` with `buyer.budget`, saves, and returns.

`localAdvanceDeadlineDay` constructs bot `DeadlineAiClub` inputs and uses:

```ts
const rng = createRng(`deadline-${deadline.seasonYear}-${deadline.currentHour}-${deadline.auctions.length}`);
const result = advanceDeadlineDay(deadline, aiClubs, new Date().toISOString(), rng);
```

Settle all results in memory with the same validation order as the server. On success, remove from seller, assign the offered wage, append once to buyer, move the bid value, and remove/cancel the listing. On failure, mark the corresponding auction unsold. Call `saveLocalGameState` once after all settlements.

- [ ] **Step 5: Verify offline behavior**

```bash
npm run test -w packages/web -- --run src/api/localEngine.test.ts
npm run build -w packages/web
```

Expected: PASS.

- [ ] **Step 6: Local checkpoint**

Record state migration and local actions. If Git is restored, commit `feat: add offline deadline day parity`.

---

### Task 5: Deadline Day transfer UI

**Files:**
- Modify: `packages/web/src/pages/TransfersHub.tsx`
- Modify: `packages/web/src/styles.css`

**Interfaces:**
- Consumes: Task 3 client functions, Task 1 types and `nextMinimumBid`.
- Produces: a `deadline` tab inside the existing transfer hub; no new route or component hierarchy.

- [ ] **Step 1: Reuse any existing page test harness**

Search:

```bash
rg "TransfersHubPage" packages/web/src --glob "*.test.ts*"
```

If a test exists, add an assertion that an active state renders `Deadline Day`, `12h`, and its player. If no harness exists, do not create a new router/auth scaffold solely for static markup; the local contract test and production build are the runnable checks.

- [ ] **Step 2: Add state and loading**

Extend:

```ts
type TabKey = 'scouting' | 'market' | 'proposals' | 'clauses' | 'deadline';
```

Add:

```ts
const [deadlineDay, setDeadlineDay] = useState<DeadlineDayState | null>(null);
const [deadlineBid, setDeadlineBid] = useState<Record<string, string>>({});
const [deadlineWage, setDeadlineWage] = useState<Record<string, string>>({});
const [deadlineBusy, setDeadlineBusy] = useState(false);
```

Include `getDeadlineDay(clubId)` in the existing initial `Promise.all` and set the result with other transfer data.

- [ ] **Step 3: Add bid and advance handlers**

Use existing banners and notification patterns:

```ts
async function handleDeadlineBid(item: DeadlineAuctionItem) {
  if (!club) return;
  setDeadlineBusy(true);
  setError(null);
  try {
    const updated = await placeDeadlineDayBid({
      auctionId: item.id,
      buyerClubId: club.id,
      amount: Number(deadlineBid[item.id]) || nextMinimumBid(item),
      wageOffer: Number(deadlineWage[item.id]) || item.player.wage,
    });
    setDeadlineDay(updated);
    notifySuccess(`Lance registrado por ${item.player.name}.`);
  } catch (error) {
    setError((error as Error).message);
  } finally {
    setDeadlineBusy(false);
  }
}
```

Add `handleAdvanceDeadlineDay` with the same busy/error handling and `advanceDeadlineDay(club.id)`.

- [ ] **Step 4: Render the tab**

Add a fifth subnav button labeled `⏰ Deadline Day`. Its pane displays:

- `currentHour` and active/closed status;
- the club's budget;
- each auction's player, seller, minimum/current bid, leader, status, and bid history;
- numeric bid and wage inputs plus bid button;
- latest breaking news;
- advance button, disabled while busy or at zero.

Use native number inputs, `formatMoney`, `positionLabel`, `ClubCrest`, and existing card/button/banner classes. Disable self-bids, resolved auctions, and all actions at zero.

- [ ] **Step 5: Add minimal CSS**

Append:

```css
.deadline-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr); gap: 1rem; }
.deadline-clock { font-size: clamp(2rem, 6vw, 4.5rem); font-weight: 900; color: #ffd700; }
.deadline-auctions { display: grid; gap: .75rem; }
.deadline-auction { border: 1px solid rgba(255,255,255,.12); border-radius: .75rem; padding: 1rem; }
.deadline-bid-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)) auto; gap: .5rem; align-items: end; }
.deadline-news { max-height: 32rem; overflow-y: auto; }
@media (max-width: 800px) {
  .deadline-layout { grid-template-columns: 1fr; }
  .deadline-bid-form { grid-template-columns: 1fr; }
}
```

- [ ] **Step 6: Verify web workspace**

```bash
npm run test -w packages/web
npm run build -w packages/web
```

Expected: PASS.

- [ ] **Step 7: Local checkpoint**

Record UI and CSS changes. If Git is restored, commit `feat: add deadline day transfer hub`.

---

### Task 6: Reject stale season state

**Files:**
- Modify: `packages/server/src/services/deadlineDayService.ts`
- Modify: `packages/web/src/api/localEngine.ts`
- Test: `packages/server/src/deadlineDayFlow.test.ts`
- Test: `packages/web/src/api/localEngine.test.ts`

**Interfaces:**
- Consumes: persisted Deadline state and current server/local season.
- Produces: fresh state whenever persisted `seasonYear` differs from the current season.

- [ ] **Step 1: Add stale-state tests**

Offline: save `deadlineDay` with `seasonYear: currentSeason - 1`, call `localGetDeadlineDay`, then assert:

```ts
expect(refreshed.seasonYear).toBe(loadLocalGameState().currentSeason);
expect(refreshed.auctions.some((item) => item.status !== 'ACTIVE')).toBe(false);
```

Server: persist a stale `deadlineDayJson` for the singleton through the test database, call the GET route, and assert the returned year equals `GameState.seasonYear` with no resolved auction inherited from the stale JSON.

- [ ] **Step 2: Verify stale-state tests fail**

```bash
npm run test -w packages/server -- --run src/deadlineDayFlow.test.ts
npm run test -w packages/web -- --run src/api/localEngine.test.ts
```

Expected: FAIL because adapters still return stale state.

- [ ] **Step 3: Normalize at adapter boundaries**

In `loadOrCreateDeadlineDay` and `localGetDeadlineDay`, discard persisted state when its `seasonYear` differs from `GameState.seasonYear` or `currentSeason`, then rebuild from current active listings. Do not couple auction logic directly into matchday advancement.

- [ ] **Step 4: Verify lifecycle guards**

Run the two commands from Step 2. Expected: PASS.

- [ ] **Step 5: Local checkpoint**

Record lifecycle guards. If Git is restored, commit `fix: reset stale deadline day state`.

---

### Task 7: Full verification and review

**Files:**
- Review every file listed above.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: verified server/offline parity with no known regression.

- [ ] **Step 1: Run focused tests**

```bash
npm run test -w packages/shared -- --run src/domain/deadlineDay.test.ts
npm run test -w packages/server -- --run src/deadlineDayFlow.test.ts
npm run test -w packages/web -- --run src/api/localEngine.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run all tests and builds**

```bash
npm test
npm run build
```

Expected: PASS. If an unrelated baseline failure appears, preserve its exact output and rerun focused checks to distinguish it from a regression.

- [ ] **Step 3: Audit parity**

Confirm both adapters expose equivalent semantics:

```text
GET / localGetDeadlineDay       -> DeadlineDayState
POST / localPlaceDeadlineDayBid -> DeadlineDayState
POST / localAdvanceDeadlineDay  -> DeadlineDayState
```

Confirm the 5% rule, hour progression, panic discount, AI threshold, and resolution exist only in shared code.

- [ ] **Step 4: Run mandatory reviewers**

Invoke `ecc:code-reviewer`, `ecc:typescript-reviewer`, and `ecc:react-reviewer` over the complete change. Because routes accept money and authenticated club IDs, also invoke `ecc:security-reviewer`. Fix confirmed findings with minimal diffs and rerun focused tests.

- [ ] **Step 5: Smoke-test both modes**

Launch the project through its established run workflow and verify:

1. Deadline tab opens without console errors.
2. A listing appears as an auction.
3. A valid bid updates leader and history.
4. Advance follows `12, 8, 4, 2, 1, 0`.
5. At zero, the player and exact winning amount move once.
6. Reload preserves results in server and offline modes.
7. A narrow viewport has no body-level horizontal scrolling.

- [ ] **Step 6: Final checkpoint**

Report exact test/build results and any skipped smoke-test mode. If Git is restored, commit `test: verify deadline day parity`.

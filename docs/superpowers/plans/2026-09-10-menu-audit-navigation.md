# Fase 05 Menu Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every essential club-management destination reachable in at most two deliberate navigation actions, remove static hub gates, and complete ClubHome as an actionable command room.

**Architecture:** Put the club navigation contract in one typed, UI-agnostic module consumed by `ClubNav`, `HubSubnav`, and an exhaustive graph test. Preserve legacy URLs with declarative React Router redirects, keep dynamic competitions as the one useful hub, and reuse ClubHome's already-loaded club/opponent/league data rather than adding endpoints.

**Tech Stack:** React 18.3.1, TypeScript 5.8, React Router DOM 6.28, Vite 5.4, Vitest, root `node:test` plus installed Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-10-menu-audit-navigation-design.md`

## Global Constraints

- The two-action rule applies only to club-management screens; live match, result, and round-summary flows are excluded.
- Essential destinations are Tática/Prancheta, Elenco, Treino, Mercado, Finanças, Tabela da Liga, and Chave de Copa.
- Tabela and Copa are conditional destinations: their IDs come from loaded competition context, so the persistent route is Competições and the second action selects the league/cup.
- Static `TeamHub` and `FinanceHub` must not remain mandatory gateways; their old URLs remain compatible aliases.
- Keep direct visual Elenco ↔ Tática movement; no keyboard shortcuts.
- Use existing canonical color tokens and 48×48 CSS-pixel minimum interactive targets.
- Use Space Grotesk for display text and Inter for body/function text with local assets; do not add a runtime font CDN dependency.
- Add no package dependency unless the installed toolchain cannot perform the check.
- Keep `npm run build -w packages/web` and root `npm run build` green.
- This project copy has no `.git`; commit steps are recorded as unavailable rather than claimed.

---

### Task 1: Make the navigation contract executable

**Files:**
- Create: `packages/web/src/lib/clubNavigation.ts`
- Create: `packages/web/src/lib/clubNavigation.test.ts`
- Modify: `packages/web/src/components/ClubNav.tsx:16-56,97-100,147-219,237-316`
- Modify: `packages/web/src/components/HubSubnav.tsx:13-61`

**Interfaces:**
- Produces: `ClubTab`, `ClubNavGroup`, `clubPath(clubId, destination)`, `DESKTOP_CLUB_NAV`, `MOBILE_PRIMARY_NAV`, and `HUB_SUBNAV_ITEMS`.
- `clubPath` signature: `(clubId: string, destination: ClubDestination) => string`.
- `HUB_SUBNAV_ITEMS.team` contains four high-frequency items only: `squad`, `tactics`, `training`, `contracts`.
- Academy and staff remain directly reachable from the mobile drawer and do not count as essential Phase 05 destinations.

- [ ] **Step 1: Write the failing graph test**

Create `packages/web/src/lib/clubNavigation.test.ts` with real graph reachability, not URL-depth heuristics:

```ts
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_CLUB_NAV,
  HUB_SUBNAV_ITEMS,
  MOBILE_DRAWER_NAV,
  MOBILE_PRIMARY_NAV,
  type ClubDestination,
} from './clubNavigation.js';

const essential: ClubDestination[] = [
  'squad',
  'tactics',
  'training',
  'transfers',
  'finance',
  'league',
  'cup',
];

const managementScreens: ClubDestination[] = [
  'home',
  'squad',
  'tactics',
  'training',
  'academy',
  'staff',
  'contracts',
  'finance',
  'sponsors',
  'stadium',
  'competitions',
  'agenda',
  'transfers',
  'history',
  'career',
];

function shortestDistance(
  edges: ReadonlyMap<ClubDestination, readonly ClubDestination[]>,
  start: ClubDestination,
  target: ClubDestination,
): number {
  const queue: Array<[ClubDestination, number]> = [[start, 0]];
  const visited = new Set<ClubDestination>([start]);
  while (queue.length) {
    const [current, distance] = queue.shift()!;
    if (current === target) return distance;
    for (const next of edges.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([next, distance + 1]);
      }
    }
  }
  return Number.POSITIVE_INFINITY;
}

function navTargets(platform: 'desktop' | 'mobile'): ClubDestination[] {
  const primary = platform === 'desktop' ? DESKTOP_CLUB_NAV : MOBILE_PRIMARY_NAV;
  const targets = primary.map((item) => item.destination);
  if (platform === 'mobile') targets.push(...MOBILE_DRAWER_NAV.map((item) => item.destination));
  return targets;
}

function buildGraph(platform: 'desktop' | 'mobile') {
  const edges = new Map<ClubDestination, readonly ClubDestination[]>();
  for (const screen of managementScreens) {
    const siblingGroup = Object.values(HUB_SUBNAV_ITEMS).find((items) =>
      items.some((item) => item.destination === screen),
    );
    edges.set(screen, [
      ...navTargets(platform),
      ...(siblingGroup?.map((item) => item.destination) ?? []),
    ]);
  }
  edges.set('competitions', [...(edges.get('competitions') ?? []), 'league', 'cup']);
  return edges;
}

for (const platform of ['desktop', 'mobile'] as const) {
  describe(`${platform} club navigation`, () => {
    it.each(managementScreens)('reaches every essential destination from %s within two actions', (start) => {
      const graph = buildGraph(platform);
      for (const target of essential) {
        expect(shortestDistance(graph, start, target), `${start} -> ${target}`).toBeLessThanOrEqual(2);
      }
    });
  });
}

it('keeps the team sibling bar focused', () => {
  expect(HUB_SUBNAV_ITEMS.team.map((item) => item.destination)).toEqual([
    'squad', 'tactics', 'training', 'contracts',
  ]);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run from repository root:

```bash
npm run test:web -- --run packages/web/src/lib/clubNavigation.test.ts
```

Expected: FAIL because `clubNavigation.ts` does not exist.

- [ ] **Step 3: Implement the minimum shared contract**

Create `clubNavigation.ts` with readonly data only. Use these exact destination paths:

```ts
export type ClubDestination =
  | 'home' | 'squad' | 'tactics' | 'training' | 'academy' | 'staff' | 'contracts'
  | 'finance' | 'sponsors' | 'stadium' | 'competitions' | 'agenda' | 'transfers'
  | 'history' | 'career' | 'briefing' | 'league' | 'cup';

export type ClubTab =
  | 'home' | 'team' | 'squad' | 'training' | 'tactics' | 'academy' | 'staff'
  | 'financial' | 'stadium' | 'finance' | 'competitions' | 'agenda'
  | 'transfers' | 'history' | 'career';

export interface ClubNavigationItem {
  key: string;
  label: string;
  destination: ClubDestination;
  icon?: string;
  matches: readonly ClubTab[];
}

export function clubPath(clubId: string, destination: Exclude<ClubDestination, 'league' | 'cup'>): string {
  if (destination === 'home') return `/clubs/${clubId}`;
  if (destination === 'career') return '/career';
  return `/clubs/${clubId}/${destination}`;
}
```

Define:
- `DESKTOP_CLUB_NAV`: Elenco, Tática, Competições, Mercado, Finanças, Clube; Finanças targets `finance`, not `financial`.
- `MOBILE_PRIMARY_NAV`: Início, Elenco, Tática, Competições.
- `MOBILE_DRAWER_NAV`: Finanças, Mercado, Treino, Base, Comissão, Contratos, Clube & Carreira.
- `HUB_SUBNAV_ITEMS.team`: Elenco, Tática, Treino, Contratos.
- Existing financial, competitions, and club sibling items unchanged in meaning.

Refactor `ClubNav.tsx` and `HubSubnav.tsx` to map these constants. Preserve `ClubNav`'s defensive clock formatting and options modal behavior.

- [ ] **Step 4: Run the focused test and confirm GREEN**

```bash
npm run test:web -- --run packages/web/src/lib/clubNavigation.test.ts
```

Expected: PASS, including exhaustive desktop/mobile graph cases.

- [ ] **Step 5: Record the unavailable commit boundary**

Would commit: `refactor(web): centralize club navigation contract`

### Task 2: Remove static hub gates and repair the real Back hierarchy

**Files:**
- Modify: `packages/web/src/App.tsx:1,14-15,124-139`
- Modify: `packages/web/src/pages/Training.tsx:118`
- Modify: `packages/web/src/pages/Academy.tsx:29`
- Modify: `packages/web/src/pages/Staff.tsx:191`
- Modify: `packages/web/src/pages/Contracts.tsx:90,150`
- Modify: `packages/web/src/pages/Finance.tsx:29`
- Modify: `packages/web/src/pages/Sponsors.tsx:36`
- Modify: `packages/web/src/pages/Stadium.tsx:105`
- Modify: `packages/web/src/components/ClubNav.tsx:61-66`
- Test: `packages/web/src/lib/clubNavigation.test.ts`

**Interfaces:**
- Consumes: canonical `clubPath` destinations from Task 1.
- Produces: legacy `/team` → `/squad` and `/financial` → `/finance` aliases using `<Navigate replace>`; leaf Back buttons target ClubHome rather than static aliases.

- [ ] **Step 1: Extend the failing source-contract test**

Add source assertions to `clubNavigation.test.ts` using `readFileSync(new URL(..., import.meta.url), 'utf8')`:

```ts
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const leaf = (name: string) => readFileSync(new URL(`../pages/${name}.tsx`, import.meta.url), 'utf8');

it('keeps legacy hub URLs as redirects, not mounted static hubs', () => {
  expect(app).not.toContain('TeamHubPage');
  expect(app).not.toContain('FinanceHubPage');
  expect(app).toMatch(/path="\/clubs\/:clubId\/team"[\s\S]*?<LegacyClubRedirect destination="squad"/);
  expect(app).toMatch(/path="\/clubs\/:clubId\/financial"[\s\S]*?<LegacyClubRedirect destination="finance"/);
});

it.each(['Training', 'Academy', 'Staff', 'Contracts', 'Finance', 'Sponsors', 'Stadium'])(
  '%s no longer points Back at a static hub alias',
  (name) => {
    expect(leaf(name)).not.toMatch(/backTo=\{`\/clubs\/\$\{club\.id\}\/(team|financial)`\}/);
  },
);
```

- [ ] **Step 2: Run focused test and confirm RED**

```bash
npm run test:web -- --run packages/web/src/lib/clubNavigation.test.ts
```

Expected: FAIL because `App.tsx` still mounts the two static hub pages and leaves still link Back to them.

- [ ] **Step 3: Implement declarative compatibility aliases**

In `App.tsx`, remove `TeamHubPage` and `FinanceHubPage` imports. Add a local route element:

```tsx
function LegacyClubRedirect({ destination }: { destination: 'squad' | 'finance' }) {
  const { clubId } = useParams<{ clubId: string }>();
  return <Navigate to={clubId ? `/clubs/${clubId}/${destination}` : '/dashboard'} replace />;
}
```

Mount it inside the existing `RequireAuth` wrappers for `/team` and `/financial`. Do not create two one-line redirect page files.

Change the seven listed leaf pages to omit `backTo` (the `ClubNav` default is ClubHome), and update the stale `ClubNavProps.backTo` comment plus the stale tactics comment at `ClubTactics.tsx:377-382` to describe the actual hierarchy.

- [ ] **Step 4: Run focused test and confirm GREEN**

```bash
npm run test:web -- --run packages/web/src/lib/clubNavigation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Record the unavailable commit boundary**

Would commit: `fix(web): remove static club hub bottlenecks`

### Task 3: Add direct header actions without crowding mobile

**Files:**
- Modify: `packages/web/src/components/ClubNav.tsx:129-145`
- Modify: `packages/web/src/styles.css:218-268,11791-11850,12090-12107`
- Test: `packages/web/src/lib/clubNavigation.test.ts`

**Interfaces:**
- Consumes: `clubPath(club.id, 'briefing' | 'competitions')`.
- Produces: two accessible topbar action links named `Próximo confronto` and `Competições`; compact icon labels remain understandable to screen readers.

- [ ] **Step 1: Add failing source and CSS assertions**

```ts
const clubNav = readFileSync(new URL('../components/ClubNav.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

it('offers direct topbar actions for the next match and competitions', () => {
  expect(clubNav).toContain('aria-label="Próximo confronto"');
  expect(clubNav).toContain("clubPath(club.id, 'briefing')");
  expect(clubNav).toContain('aria-label="Competições"');
  expect(clubNav).toContain("clubPath(club.id, 'competitions')");
});

it('gives icon actions and sibling links a 48px minimum target', () => {
  expect(css).toMatch(/:is\(\.back-to-panel, \.home-button, \.topbar-opt-btn, \.topbar-shortcut\)[\s\S]*?min-width:\s*48px;[\s\S]*?min-height:\s*48px;/);
  expect(css).toMatch(/\.hub-subnav-btn\s*\{[\s\S]*?min-height:\s*48px;/);
});
```

- [ ] **Step 2: Run focused test and confirm RED**

```bash
npm run test:web -- --run packages/web/src/lib/clubNavigation.test.ts
```

Expected: FAIL because the topbar shortcuts and explicit target rules do not exist.

- [ ] **Step 3: Add the two links and 48px target rules**

Inside `.topbar-actions`, before Home/Options, add links with visible compact labels on desktop and icon plus `aria-label` on mobile. Use existing emoji/icons; add no new image asset.

```tsx
<Link className="topbar-shortcut" to={clubPath(club.id, 'briefing')} aria-label="Próximo confronto">
  <span aria-hidden="true">⚽</span><span className="topbar-shortcut-label">Próximo confronto</span>
</Link>
<Link className="topbar-shortcut" to={clubPath(club.id, 'competitions')} aria-label="Competições">
  <span aria-hidden="true">🏆</span><span className="topbar-shortcut-label">Competições</span>
</Link>
```

Add one shared target rule:

```css
:is(.back-to-panel, .home-button, .topbar-opt-btn, .topbar-shortcut) {
  min-width: 48px;
  min-height: 48px;
}

.hub-subnav-btn { min-height: 48px; }
.mobile-nav-item { min-height: 48px; }
.mobile-drawer-close { min-width: 48px; min-height: 48px; }
.mobile-drawer-tile { min-height: 48px; }
```

At `max-width: 768px`, hide only `.topbar-shortcut-label`; keep both actions available. Use `:focus-visible` with the existing accent token for keyboard focus.

- [ ] **Step 4: Run focused test and confirm GREEN**

```bash
npm run test:web -- --run packages/web/src/lib/clubNavigation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Record the unavailable commit boundary**

Would commit: `feat(web): add club header shortcuts`

### Task 4: Complete ClubHome's quick opponent scout

**Files:**
- Modify: `packages/web/src/pages/ClubHome.tsx:320-330,401-473,738-772`
- Modify: `packages/web/src/styles.css` adjacent to existing ClubHome command-room styles
- Create: `packages/web/src/pages/ClubHomeNavigation.test.ts`

**Interfaces:**
- Consumes: already-loaded `opponent: Club | null`, `league.standings`, and `opponentPosition`.
- Produces: pure helper `quickOpponentScout(opponent, standing)` returning `{ averageOverall, standout, record }`, plus an actionable `Olheiro rápido` widget linked to Tática.
- No opponent-form request and no new endpoint.

- [ ] **Step 1: Write the failing helper/widget contract**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { quickOpponentScout } from './ClubHome.js';

it('derives a stable quick scout without mutating the opponent squad', () => {
  const players = [
    { id: 'a', name: 'A', position: 'ST', overall: 81 },
    { id: 'b', name: 'B', position: 'GK', overall: 75 },
  ];
  const order = players.map((player) => player.id);
  const scout = quickOpponentScout(
    { players } as never,
    { played: 10, wins: 6, draws: 2, losses: 2, points: 20 },
  );
  expect(scout).toEqual({
    averageOverall: 78,
    standout: players[0],
    record: '6V · 2E · 2D',
  });
  expect(players.map((player) => player.id)).toEqual(order);
});

it('renders the scout as an actionable command-room widget', () => {
  const source = readFileSync(new URL('./ClubHome.tsx', import.meta.url), 'utf8');
  expect(source).toContain('Olheiro rápido');
  expect(source).toContain('Força média');
  expect(source).toContain('Destaque');
  expect(source).toContain('Preparar plano de jogo');
  expect(source).toContain("to={`/clubs/${club.id}/tactics`}");
});
```

Use the actual shared `Player` field names found by TypeScript; the test's minimal casts avoid manufacturing a full `Club` fixture.

- [ ] **Step 2: Run focused test and confirm RED**

```bash
npm run test:web -- --run packages/web/src/pages/ClubHomeNavigation.test.ts
```

Expected: FAIL because `quickOpponentScout` and the widget do not exist.

- [ ] **Step 3: Implement the pure helper and widget**

Add a named export near existing ClubHome helpers:

```ts
export function quickOpponentScout(opponent: Club, standing?: LeagueWithStandings['standings'][number]) {
  const standout = opponent.players.reduce<(typeof opponent.players)[number] | null>(
    (best, player) => (!best || player.overall > best.overall ? player : best),
    null,
  );
  const averageOverall = opponent.players.length
    ? Math.round(opponent.players.reduce((sum, player) => sum + player.overall, 0) / opponent.players.length)
    : 0;
  return {
    averageOverall,
    standout,
    record: standing ? `${standing.wins}V · ${standing.draws}E · ${standing.losses}D` : 'Sem dados na liga',
  };
}
```

Render a card next to the existing opponent/upcoming-match content. It shows opponent crest/name, league position when available, record, average overall, standout player, and a 48px `Preparar plano de jogo` link to Tática. Existing next-match, expiring-contract, balance, and morale widgets remain the canonical actions; do not duplicate them.

- [ ] **Step 4: Run focused test and confirm GREEN**

```bash
npm run test:web -- --run packages/web/src/pages/ClubHomeNavigation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Record the unavailable commit boundary**

Would commit: `feat(web): add actionable opponent scout`

### Task 5: Apply Neo-Myth typography and preserve offline operation

**Files:**
- Add: `packages/web/public/fonts/SpaceGrotesk-VariableFont_wght.ttf`
- Add: `packages/web/public/fonts/Inter-VariableFont_opsz,wght.ttf`
- Modify: `packages/web/src/styles.css:1-23`
- Modify: `packages/web/src/lib/clubNavigation.test.ts`

**Interfaces:**
- Consumes: locally stored, license-compatible Space Grotesk and Inter variable font files supplied/downloaded from the official Google Fonts repositories at implementation time.
- Produces: CSS tokens `--font-display` and `--font-body`; no network request at application runtime.

- [ ] **Step 1: Add failing typography assertions**

```ts
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

it('uses local Space Grotesk and Inter assets', () => {
  expect(css).toContain("font-family: 'Space Grotesk'");
  expect(css).toContain("font-family: 'Inter'");
  expect(css).toContain("--font-display: 'Space Grotesk'");
  expect(css).toContain("--font-body: 'Inter'");
  expect(existsSync(fileURLToPath(new URL('../../public/fonts/SpaceGrotesk-VariableFont_wght.ttf', import.meta.url)))).toBe(true);
  expect(existsSync(fileURLToPath(new URL('../../public/fonts/Inter-VariableFont_opsz,wght.ttf', import.meta.url)))).toBe(true);
});
```

- [ ] **Step 2: Run focused test and confirm RED**

```bash
npm run test:web -- --run packages/web/src/lib/clubNavigation.test.ts
```

Expected: FAIL because CSS and local assets still use Bebas Neue/system UI.

- [ ] **Step 3: Add local font assets and replace the root typography tokens**

Add both variable TTF files under `packages/web/public/fonts/`. Replace the current Bebas face with:

```css
@font-face {
  font-family: 'Space Grotesk';
  src: url('/fonts/SpaceGrotesk-VariableFont_wght.ttf') format('truetype');
  font-weight: 300 700;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-VariableFont_opsz,wght.ttf') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  /* existing color tokens stay unchanged */
  --font-display: 'Space Grotesk', 'Inter', -apple-system, 'Segoe UI', sans-serif;
  --font-body: 'Inter', -apple-system, 'Segoe UI', sans-serif;
  font-family: var(--font-body);
}
```

Remove the obsolete `BebasNeue-Regular.ttf` only after confirming no CSS reference remains.

- [ ] **Step 4: Run focused test and confirm GREEN**

```bash
npm run test:web -- --run packages/web/src/lib/clubNavigation.test.ts
```

Expected: PASS and no external runtime font URL in the generated CSS.

- [ ] **Step 5: Record the unavailable commit boundary**

Would commit: `style(web): apply Neo-Myth typography`

### Task 6: Add and run desktop/mobile browser acceptance checks

**Files:**
- Create: `scripts/e2e-menu-audit.mjs`
- Modify: `package.json:10-27`

**Interfaces:**
- Consumes: root-installed `playwright` and the existing development stack at web `:5173` plus API `:3001`, matching current browser scripts.
- Produces: root `test:e2e:menu` script using raw Playwright plus `node:assert`; no `@playwright/test` dependency and no mutation action.

- [ ] **Step 1: Write the browser test with explicit journeys**

Use raw Playwright with Node assertions, following `scripts/shot-dashboard.mjs`:

```js
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const WEB_URL = process.env.WEB_URL ?? 'http://127.0.0.1:5173';
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3001';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
assert.ok(EMAIL && PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD for the isolated test account');

const login = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
assert.equal(login.status, 200, 'isolated E2E account must authenticate');
const { token, userId } = await login.json();
const browser = await chromium.launch();
try {
  // Create desktop/mobile contexts, seed token/userId in localStorage, and execute read-only navigation assertions.
} finally {
  await browser.close();
}
```

Do not use the repository's hard-coded demo account: that may point at a developer save. The test account must be isolated and supplied through environment variables. Cover these read-only acceptance journeys in both a 1440×900 desktop context and a 390×844 mobile context:

1. Enter ClubHome from the synthetic save.
2. Navigate to Elenco and Tática directly.
3. From an arbitrary leaf, reach Treino, Mercado, and Finanças within at most two clicks/taps.
4. Open Competições, then Tabela and every rendered Copa in the second action.
5. Visit legacy `/team` and `/financial` URLs and assert final URLs `/squad` and `/finance` with no hub card grid.
6. Assert header links `Próximo confronto` and `Competições` exist.
7. Assert the ClubHome scout widget and its `Preparar plano de jogo` action exist.
8. Read computed bounding boxes for `.back-to-panel`, `.home-button`, `.topbar-opt-btn`, `.topbar-shortcut`, `.hub-subnav-btn`, visible `.mobile-nav-item`, `.mobile-drawer-close`, and `.mobile-drawer-tile`; every visible target is at least 48×48.
9. Assert computed `font-family` includes Inter for body and Space Grotesk for an `h2`/navigation label.
10. Assert no page-level horizontal overflow at 390px.

Use role/label selectors first. Wait for specific visible state or URL; do not use arbitrary sleeps.

- [ ] **Step 2: Add the root script**

```json
"test:e2e:menu": "node scripts/e2e-menu-audit.mjs"
```

- [ ] **Step 3: Run the E2E test and confirm its first actionable failure**

```bash
npm run build -w packages/web
npm run test:e2e:menu
```

Expected before final UI fixes: at least one clear assertion failure naming the unmet route, target size, typography, or widget contract. If no isolated E2E account is available, report the browser suite as blocked rather than using or mutating a developer/player save.

- [ ] **Step 4: Apply only fixes demonstrated by the browser test**

Adjust responsive CSS/selectors or route actions narrowly. Do not add page objects or a Playwright config for this single acceptance suite.

- [ ] **Step 5: Re-run and confirm desktop/mobile GREEN**

```bash
npm run test:e2e:menu
```

Expected: all desktop/mobile journeys pass.

- [ ] **Step 6: Record the unavailable commit boundary**

Would commit: `test(web): verify menu audit journeys`

### Task 7: Full verification and mandatory reviews

**Files:**
- Review all changed files from Tasks 1-6.
- Modify only files needed to resolve confirmed review/build findings.

**Interfaces:**
- Consumes: complete Phase 05 implementation.
- Produces: green tests/builds and reviewer-confirmed React/TypeScript quality.

- [ ] **Step 1: Run focused and complete web tests**

```bash
npm run test:web -- --run packages/web/src/lib/clubNavigation.test.ts packages/web/src/pages/ClubHomeNavigation.test.ts
npm run test:web
```

Expected: all web tests pass.

- [ ] **Step 2: Build the web package**

```bash
npm run build -w packages/web
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Run the root test suite**

```bash
npm test
```

Expected: shared, web, and server suites pass. Preserve the validated shared/server baselines; do not recalibrate tactical simulation.

- [ ] **Step 4: Run the root build**

```bash
npm run build
```

Expected: shared, server, web, and desktop builds pass.

- [ ] **Step 5: Re-run browser E2E after the production build**

```bash
npm run test:e2e:menu
```

Expected: desktop and mobile journeys pass against the final build.

- [ ] **Step 6: Run mandatory specialist reviews**

Dispatch in parallel against the actual changed files:
- `ecc:code-reviewer`
- `ecc:react-reviewer`
- `ecc:typescript-reviewer`
- `ecc:a11y-architect`

Verify each finding against current code. Apply only confirmed defects, rerun the smallest relevant test, then rerun web build and E2E if UI behavior changed.

- [ ] **Step 7: Produce the audit matrix in the final handoff**

Report one row per essential destination with:
- desktop path and action count,
- mobile path and action count,
- automated graph-test anchor,
- E2E journey result.

State actual test/build counts and any skipped step. Explicitly state that commits were unavailable because this directory contains no `.git` metadata.

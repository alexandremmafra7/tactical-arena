import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_CLUB_NAV,
  HUB_SUBNAV_ITEMS,
  MOBILE_DRAWER_NAV,
  MOBILE_PRIMARY_NAV,
  clubPath,
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
  const targets: ClubDestination[] = primary.map((item) => item.destination);
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

it('keeps the locker room in the team navigation', () => {
  expect(clubPath('c1', 'lockerRoom')).toBe('/clubs/c1/locker-room');
  expect(HUB_SUBNAV_ITEMS.team).toContainEqual(expect.objectContaining({
    destination: 'lockerRoom',
    label: 'Vestiário',
  }));
});

it('keeps all configured club paths registered in App', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const staticDestinations = new Set<ClubDestination>([
    ...DESKTOP_CLUB_NAV.map((item) => item.destination),
    ...MOBILE_PRIMARY_NAV.map((item) => item.destination),
    ...MOBILE_DRAWER_NAV.map((item) => item.destination),
    ...Object.values(HUB_SUBNAV_ITEMS).flatMap((items) => items.map((item) => item.destination)),
  ]);

  for (const destination of staticDestinations) {
    if (destination === 'home' || destination === 'career' || destination === 'lockerRoom' || destination === 'hallOfFame') continue;
    expect(app, destination).toContain(`path="/clubs/:clubId/${destination}"`);
  }
});

const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const leaf = (name: string) => readFileSync(new URL(`../pages/${name}.tsx`, import.meta.url), 'utf8');
const clubNav = readFileSync(new URL('../components/ClubNav.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

it('keeps legacy hub URLs as redirects, not mounted static hubs', () => {
  expect(app).not.toMatch(/<TeamHubPage\b/);
  expect(app).not.toMatch(/<FinanceHubPage\b/);
  expect(app).toMatch(/path="\/clubs\/:clubId\/team"[\s\S]*?<LegacyClubRedirect destination="squad"/);
  expect(app).toMatch(/path="\/clubs\/:clubId\/financial"[\s\S]*?<LegacyClubRedirect destination="finance"/);
});

it.each(['Training', 'Academy', 'Staff', 'Contracts', 'Finance', 'Sponsors', 'Stadium'])(
  '%s no longer points Back at a static hub alias',
  (name) => {
    expect(leaf(name)).not.toMatch(/backTo=\{`\/clubs\/\$\{club\.id\}\/(team|financial)`\}/);
  },
);

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

it('uses local Space Grotesk and Inter assets', async () => {
  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');

  expect(css).toContain("font-family: 'Space Grotesk'");
  expect(css).toContain("font-family: 'Inter'");
  expect(css).toContain("--font-display: 'Space Grotesk'");
  expect(css).toContain("--font-body: 'Inter'");
  expect(existsSync(fileURLToPath(new URL('../../public/fonts/SpaceGrotesk-VariableFont_wght.ttf', import.meta.url)))).toBe(true);
  expect(existsSync(fileURLToPath(new URL('../../public/fonts/Inter-VariableFont_opsz,wght.ttf', import.meta.url)))).toBe(true);
});

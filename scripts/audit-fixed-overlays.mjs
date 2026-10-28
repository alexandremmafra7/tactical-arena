/**
 * Audits every full-screen overlay in the app for the containing-block trap.
 *
 * A `position: fixed` element resolves against the viewport ONLY if no ancestor creates a containing
 * block. `filter`, `backdrop-filter`, `transform`, `perspective`, `will-change` and `contain: paint`
 * all create one — so a "full screen" modal mounted under a blurred panel is silently sized by that
 * panel instead. That is exactly what happened to the Central de Carreiras (StartSubmenuModal), which
 * was rendered inside `.start-menu-panel { backdrop-filter: blur(10px) }` and came out 398x260 in a
 * 1440x900 window.
 *
 * For each overlay this script either opens it and measures its backdrop against the viewport, or,
 * when the overlay needs an unreachable game state, audits the DOM node it mounts under.
 *
 *   node scripts/audit-fixed-overlays.mjs
 *
 * Expects the web dev server on :5173 and the API on :3001.
 */
import { chromium } from 'playwright';

const API = 'http://127.0.0.1:3001';
const WEB = 'http://localhost:5173';
const VIEWPORT = { width: 1440, height: 900 };

async function api(path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

const register = () => api('/auth/register', null, { email: `${crypto.randomUUID()}@test.local`, password: 'password123' });
const fit = (c) => c.players.filter((p) => p.injuryMatches === 0 && !p.suspensions.some((s) => s.matchesRemaining > 0));

const tacticFor = (club, players) => ({
  clubId: club.id,
  formation: '4-4-2',
  mentality: 'balanced',
  attackStyle: 'THROUGH_MIDDLE',
  markingStyle: 'BALANCED',
  attackApproach: 'BALANCED',
  lineup: players.slice(0, 11).map((p) => ({ playerId: p.id })),
  substitutes: players.slice(11, 18).map((p) => ({ playerId: p.id })),
  plannedSubstitutions: [],
});

/** Runs in the page: walks up from `el` reporting every ancestor that traps position:fixed. */
function trapWalker([sel, includeSelf]) {
  const el = document.querySelector(sel);
  if (!el) return { missing: true };
  const traps = [];
  // For a mount point the overlay is a CHILD of `el`, so `el` itself is one of its ancestors and has
  // to be inspected. For an already-open overlay we start one level up, since `el` IS the overlay.
  let node = includeSelf ? el : el.parentElement;
  while (node && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    const props = {
      filter: cs.filter,
      backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
      transform: cs.transform,
      perspective: cs.perspective,
      willChange: cs.willChange,
      contain: cs.contain,
    };
    const hit = Object.entries(props).filter(([k, v]) =>
      v && v !== 'none' && v !== 'auto' && !(k === 'contain' && !/paint|layout|strict|content/.test(v)));
    if (hit.length) {
      traps.push({
        el: node.tagName.toLowerCase() + (node.className ? '.' + String(node.className).trim().split(/\s+/).join('.') : ''),
        props: hit.map(([k, v]) => k + ': ' + v).join(', '),
      });
    }
    node = node.parentElement;
  }
  const r = el.getBoundingClientRect();
  return { traps, rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } };
}

const results = [];

function record(name, kind, data) {
  if (data.missing) {
    results.push({ name, kind, verdict: 'NOT FOUND' });
    return;
  }
  const trapped = data.traps.length > 0;
  const fills = kind === 'overlay'
    ? data.rect.w >= VIEWPORT.width - 1 && data.rect.h >= VIEWPORT.height - 1 && data.rect.x === 0 && data.rect.y === 0
    : null;
  results.push({
    name,
    kind,
    verdict: trapped ? 'TRAPPED' : 'ok',
    fillsViewport: fills,
    rect: `${data.rect.w}x${data.rect.h} @${data.rect.x},${data.rect.y}`,
    traps: data.traps,
  });
}

// ---------------------------------------------------------------- setup
const a = await register();
const b = await register();
const clubA = await api('/clubs', a.token, { name: `Audit ${crypto.randomUUID().slice(0, 5)} FC`, country: 'BRA' });
const clubB = await api('/clubs', b.token, { name: `Probe ${crypto.randomUUID().slice(0, 5)} SC`, country: 'BRA' });
const match = await api('/matches', a.token, { homeClubId: clubA.id, awayClubId: clubB.id });
await api(`/matches/${match.id}/tactic`, a.token, tacticFor(clubA, fit(clubA)));
await api(`/matches/${match.id}/tactic`, b.token, tacticFor(clubB, fit(clubB)));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();

await page.goto(WEB, { waitUntil: 'networkidle' });
await page.evaluate(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('userId', u); },
  [a.token, a.userId]);

// ---------------------------------------------------------------- start screen
await page.goto(WEB, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Iniciar Jogo/ }).click();
await page.waitForSelector('.career-hub-backdrop');
record('StartSubmenuModal (Central de Carreiras)', 'overlay', await page.evaluate(trapWalker, ['.career-hub-backdrop', false]));
await page.keyboard.press('Escape');

// ---------------------------------------------------------------- club nav options
await page.goto(`${WEB}/clubs/${clubA.id}`, { waitUntil: 'networkidle' });
await page.locator('.club-nav-tab', { hasText: 'Opções' }).click();
await page.waitForSelector('.options-modal-backdrop');
record('OptionsMenuModal (ClubNav)', 'overlay', await page.evaluate(trapWalker, ['.options-modal-backdrop', false]));
await page.locator('.options-modal-close').first().click().catch(() => {});

// ClubHome's own inline modal mounts at the page root; audit that root.
record('ClubHome inline modals (mount point)', 'anchor', await page.evaluate(trapWalker, ['.page', true]));

// ---------------------------------------------------------------- tactics screen modals
await page.goto(`${WEB}/clubs/${clubA.id}/tactics`, { waitUntil: 'networkidle' });
const rolesBtn = page.locator('button', { hasText: /Capit|Batedor|Fun(ç|c)(õ|o)es especiais/i }).first();
if (await rolesBtn.count()) {
  await rolesBtn.click();
  if (await page.locator('.options-modal-backdrop').count()) {
    record('ClubTactics roles modal', 'overlay', await page.evaluate(trapWalker, ['.options-modal-backdrop', false]));
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('.options-modal-backdrop').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
  }
}
record('ClubTactics inline modals (mount point)', 'anchor', await page.evaluate(trapWalker, ['.page', true]));

// ---------------------------------------------------------------- transfers hub
await page.goto(`${WEB}/clubs/${clubA.id}/transfers`, { waitUntil: 'networkidle' });
record('TransfersHub inline modals (mount point)', 'anchor', await page.evaluate(trapWalker, ['.page', true]));

// ---------------------------------------------------------------- live match
await page.goto(`${WEB}/match/${match.id}/live`, { waitUntil: 'networkidle' });
await page.waitForSelector('.live-match-page', { timeout: 20000 });

const tacticsBtn = page.locator('.live-controls-actions button', { hasText: /T(á|a)tic/i }).first();
if (await tacticsBtn.count()) {
  await tacticsBtn.click();
  const backdrop = page.locator('.live-tactical-backdrop, .options-modal-backdrop, .modal-backdrop').first();
  if (await backdrop.count()) {
    const cls = await backdrop.evaluate((e) => '.' + String(e.className).trim().split(/\s+/)[0]);
    record('LiveTacticalModal', 'overlay', await page.evaluate(trapWalker, [cls, false]));
    await page.keyboard.press('Escape').catch(() => {});
  }
}

// The dramatic / penalty / options modals are siblings of LiveTacticalModal at the page root, so the
// page root is the anchor that decides all of them.
record('LiveMatch page-root modals (dramatic, penalty, options)', 'anchor',
  await page.evaluate(trapWalker, ['.live-match-page', true]));

// GoalCelebrationOverlay is the odd one out: it mounts INSIDE .match-banner, not at the page root.
record('LiveMatch GoalCelebrationOverlay (mounts inside .match-banner)', 'anchor',
  await page.evaluate(trapWalker, ['.match-banner', true]));

// ---------------------------------------------------------------- match result
await api(`/matches/${match.id}/live/advance`, a.token, { toMinute: 90 }).catch(() => null);
await page.goto(`${WEB}/match/${match.id}/result`, { waitUntil: 'networkidle' });
await page.waitForSelector('.page', { timeout: 20000 });
record('MatchResult GoalCelebrationOverlay (mount point)', 'anchor', await page.evaluate(trapWalker, ['.page', true]));

await browser.close();

// ---------------------------------------------------------------- report
let trappedCount = 0;
for (const r of results) {
  const flag = r.verdict === 'TRAPPED' ? '  ✗ TRAPPED' : r.verdict === 'NOT FOUND' ? '  ? not found' : '  ✓ ok';
  console.log(`${flag}  ${r.name}`);
  if (r.rect) console.log(`        rect ${r.rect}${r.fillsViewport === false ? '   <-- does NOT fill the viewport' : ''}`);
  for (const t of r.traps ?? []) console.log(`        ancestor ${t.el}  {${t.props}}`);
  if (r.verdict === 'TRAPPED') trappedCount += 1;
}
console.log(`\n${trappedCount} trapped of ${results.length} checked (viewport ${VIEWPORT.width}x${VIEWPORT.height})`);

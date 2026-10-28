/**
 * Focused check on the goal celebration banner: it must carry the scoring club's crest.
 *
 * The club used to be captured into state when the goal fired, inside a timeout closure created at the
 * moment the manager pressed play — so a replay started before the clubs had loaded showed every goal
 * without a crest. It is resolved at render time now; this confirms the banner still gets its crest, and
 * that it gets one even when play is pressed the instant the page appears.
 */
import { chromium } from 'playwright';

const API = 'http://127.0.0.1:3001';
const WEB = 'http://localhost:5173';
const OUT = 'C:/Users/mafra/AppData/Local/Temp/claude/D--Code/75ba4f14-ca39-49f5-82bc-b0234117162c/scratchpad';

async function api(path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function register() {
  const email = `${crypto.randomUUID()}@test.local`;
  return api('/auth/register', null, { email, password: 'password123' });
}

const fit = (c) => c.players.filter((p) => p.injuryMatches === 0 && !p.suspensions.some((s) => s.matchesRemaining > 0));
const tacticFor = (club, players) => ({
  clubId: club.id,
  formation: '4-4-2',
  mentality: 'attacking',
  attackStyle: 'THROUGH_MIDDLE',
  markingStyle: 'BALANCED',
  attackApproach: 'TOTAL_ATTACK',
  lineup: players.slice(0, 11).map((p) => ({ playerId: p.id })),
  substitutes: players.slice(11, 18).map((p) => ({ playerId: p.id })),
  plannedSubstitutions: [],
});

const a = await register();
const b = await register();
const clubA = await api('/clubs', a.token, { name: `Banner ${crypto.randomUUID().slice(0, 5)} FC`, country: 'BRA' });
const clubB = await api('/clubs', b.token, { name: `Crest ${crypto.randomUUID().slice(0, 5)} SC`, country: 'BRA' });

// A match with an early goal, so the banner fires soon after the replay starts.
let matchId = null;
for (let attempt = 0; attempt < 40 && !matchId; attempt++) {
  const cur = await api(`/clubs/${clubA.id}`, a.token);
  const curB = await api(`/clubs/${clubB.id}`, b.token);
  if (fit(cur).length < 13 || fit(curB).length < 13) break;

  const match = await api('/matches', a.token, { homeClubId: clubA.id, awayClubId: clubB.id });
  await api(`/matches/${match.id}/tactic`, a.token, tacticFor(cur, fit(cur)));
  await api(`/matches/${match.id}/tactic`, b.token, tacticFor(curB, fit(curB)));
  const done = await api(`/matches/${match.id}/live/advance`, a.token, { toMinute: 90 });
  if (done.status !== 'SIMULATED') continue;

  const firstGoalIndex = done.result.events.findIndex((e) => e.type === 'goal');
  if (firstGoalIndex >= 0 && firstGoalIndex <= 3) matchId = match.id;
}
if (!matchId) {
  console.log('no match with an early goal, rerun');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(WEB);
await page.evaluate(({ t, u }) => {
  localStorage.setItem('token', t);
  localStorage.setItem('userId', u);
}, { t: a.token, u: a.userId });

await page.goto(`${WEB}/match/${matchId}/result`);
// Deliberately no settling wait: press play the moment the button exists, which is the window in which the
// crest used to be missing for the whole replay.
await page.getByRole('button', { name: /melhores momentos/i }).click();

await page.waitForSelector('.goal-banner', { timeout: 20000 });
// `.crest`, not `img`: ClubCrest renders a real image only for a club whose slug has artwork, and falls
// back to a generated shield otherwise. Either way the element is there — and it is there *at all* only
// because the banner now resolves the club instead of freezing it at click time.
const banner = {
  text: await page.locator('.goal-banner').innerText(),
  hasCrest: (await page.locator('.goal-banner .crest').count()) > 0,
  crestLabel: await page.locator('.goal-banner .crest').getAttribute('aria-label').catch(() => null),
};
console.log('BANNER:', JSON.stringify(banner));
await page.screenshot({ path: `${OUT}/goal-banner.png` });

console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

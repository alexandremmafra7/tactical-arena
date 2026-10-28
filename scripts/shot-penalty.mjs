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

function tacticFor(club, players) {
  return {
    clubId: club.id,
    formation: '4-4-2',
    mentality: 'attacking',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'BALANCED',
    attackApproach: 'TOTAL_ATTACK',
    lineup: players.slice(0, 11).map((p) => ({ playerId: p.id })),
    substitutes: players.slice(11, 18).map((p) => ({ playerId: p.id })),
    plannedSubstitutions: [],
  };
}

const a = await register();
const b = await register();
const clubA = await api('/clubs', a.token, { name: `Pen ${crypto.randomUUID().slice(0, 5)} FC`, country: 'BRA' });
const clubB = await api('/clubs', b.token, { name: `Spot ${crypto.randomUUID().slice(0, 5)} SC`, country: 'BRA' });

// Hunt for a finished match containing a penalty, then open its replay.
let found = null;
for (let attempt = 0; attempt < 120 && !found; attempt++) {
  const cur = await api(`/clubs/${clubA.id}`, a.token);
  const curB = await api(`/clubs/${clubB.id}`, b.token);
  if (fit(cur).length < 13 || fit(curB).length < 13) break;

  const match = await api('/matches', a.token, { homeClubId: clubA.id, awayClubId: clubB.id });
  await api(`/matches/${match.id}/tactic`, a.token, tacticFor(cur, fit(cur)));
  await api(`/matches/${match.id}/tactic`, b.token, tacticFor(curB, fit(curB)));
  const done = await api(`/matches/${match.id}/live/advance`, a.token, { toMinute: 90 });
  if (done.status !== 'SIMULATED') continue;

  const penalties = done.result.events.filter((e) => e.isPenalty);
  if (penalties.length > 0) {
    found = { id: match.id, penalties };
  }
}
if (!found) {
  console.log('no penalty found, rerun');
  process.exit(1);
}
console.log('penalties in this match:');
found.penalties.forEach((e) => console.log(`  ${e.minute}' [${e.type}] ${e.team}: ${e.description}`));

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

await page.goto(`${WEB}/match/${found.id}/result`);
await page.waitForTimeout(1500);

// The result card is a summary; the event-by-event feed lives behind the replay button.
await page.getByRole('button', { name: /melhores momentos/i }).click().catch(() => undefined);
// The replay plays out in real time, so give it long enough to reach a late-match penalty.
await page.waitForTimeout(12000);

const text = await page.locator('body').innerText();
for (const e of found.penalties) {
  console.log(`replay shows "${e.description.slice(0, 45)}...": ${text.includes(e.description)}`);
}
await page.screenshot({ path: `${OUT}/penalty-result.png`, fullPage: true });

console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

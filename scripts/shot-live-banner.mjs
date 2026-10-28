import { chromium } from 'playwright';

const API = 'http://127.0.0.1:3001';
const WEB = 'http://localhost:5173';

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

const a = await register();
const b = await register();

const clubA = await api('/clubs', a.token, { name: 'Banner FC', country: 'BRA' });
const clubB = await api('/clubs', b.token, { name: 'Chalkboard SC', country: 'BRA' });

const leagues = await api('/leagues?country=BRA', a.token);
const league = leagues.find((l) => l.clubIds.includes(clubA.id) && l.clubIds.includes(clubB.id) && l.status === 'OPEN');
if (!league) throw new Error('Clubs did not land in the same open league');

await api(`/leagues/${league.id}/force-start`, a.token, {});
const advanced = await api(`/leagues/${league.id}/advance-round`, a.token, {});
const fixture = advanced.fixtures.find((f) => f.matchId);
if (!fixture) throw new Error('No live fixture created');

console.log('match id:', fixture.matchId);

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

await page.goto(`${WEB}/match/${fixture.matchId}/live`);
await page.waitForSelector('.match-banner', { timeout: 10000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'scripts/live-banner.png', fullPage: true });

console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

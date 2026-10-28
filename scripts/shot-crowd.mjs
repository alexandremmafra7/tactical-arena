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

const owner = await register();
const myClub = await api('/clubs', owner.token, { name: `Crowd ${crypto.randomUUID().slice(0, 5)} FC`, country: 'BRA' });

async function myLeague() {
  const leagues = await api('/leagues?country=BRA', owner.token);
  return leagues.find((l) => l.clubIds.includes(myClub.id) && l.status === 'OPEN');
}
let league = await myLeague();
for (let i = 0; i < 8 && league && (league.clubIds.length < 4 || league.clubIds.length % 2 !== 0); i++) {
  const filler = await register();
  await api('/clubs', filler.token, { name: `Filler ${crypto.randomUUID().slice(0, 6)} FC`, country: 'BRA' });
  league = (await myLeague()) ?? league;
}

await api(`/leagues/${league.id}/force-start`, owner.token, {});
const advanced = await api(`/leagues/${league.id}/advance-round`, owner.token, {});
const fixture = advanced.fixtures.find((f) => f.matchId && (f.homeClubId === myClub.id || f.awayClubId === myClub.id));
if (!fixture) throw new Error('no fixture for my club');

const match = await api(`/matches/${fixture.matchId}`, owner.token);
const homeClub = await api(`/clubs/${match.homeClubId}`, owner.token);
console.log(
  `crowdIntensity=${match.live.crowdIntensity} capacity=${homeClub.stadiumCapacity}` +
    ` -> expected ${Math.round(homeClub.stadiumCapacity * match.live.crowdIntensity).toLocaleString('pt-BR')}`,
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(WEB);
await page.evaluate(({ t, u }) => {
  localStorage.setItem('token', t);
  localStorage.setItem('userId', u);
}, { t: owner.token, u: owner.userId });

await page.goto(`${WEB}/match/${fixture.matchId}/live`);
await page.waitForSelector('.match-banner', { timeout: 15000 });
await page.waitForTimeout(600);

const banner = await page.locator('.match-banner-crowd').innerText().catch(() => '(missing)');
console.log('BANNER CROWD:', banner);
await page.screenshot({ path: `${OUT}/crowd-banner.png` });

console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

import { chromium } from 'playwright';

const API = 'http://127.0.0.1:3001';
const WEB = 'http://localhost:5173';
const OUT = 'C:/Users/mafra/AppData/Local/Temp/claude/D--Code/75ba4f14-ca39-49f5-82bc-b0234117162c/scratchpad';

async function api(path, token, body, method) {
  const res = await fetch(`${API}${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
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
const clubA = await api('/clubs', a.token, { name: 'Stoppage FC', country: 'BRA' });
const clubB = await api('/clubs', b.token, { name: 'Medic SC', country: 'BRA' });

async function myOpenLeague() {
  const leagues = await api('/leagues?country=BRA', a.token);
  return leagues.find((l) => l.clubIds.includes(clubA.id) && l.clubIds.includes(clubB.id) && l.status === 'OPEN');
}

// dev.db is shared with the test suites, so this league may already hold an odd number of leftover clubs;
// the fixture generator needs an even count. Top it up rather than failing the run.
let league = await myOpenLeague();
for (let i = 0; league.clubIds.length % 2 !== 0 && i < 4; i++) {
  const filler = await register();
  await api('/clubs', filler.token, { name: `Filler ${crypto.randomUUID().slice(0, 6)} FC`, country: 'BRA' });
  league = await myOpenLeague();
}
await api(`/leagues/${league.id}/force-start`, a.token, {});
const advanced = await api(`/leagues/${league.id}/advance-round`, a.token, {});
// With filler clubs in the league the round has several fixtures; only mine can be driven interactively.
const fixture = advanced.fixtures.find((f) => f.matchId && (f.homeClubId === clubA.id || f.awayClubId === clubA.id));
if (!fixture) throw new Error('my club did not get a fixture in this round');

// Drive the match server-side until it halts for one of my own injuries, so the browser opens straight
// onto the stoppage rather than waiting on a random one.
let halted = null;
for (let minute = 3; minute <= 90; minute += 3) {
  const match = await api(`/matches/${fixture.matchId}/live/advance`, a.token, { toMinute: minute, interactive: true });
  if (match.status === 'SIMULATED') break;
  if (match.live?.pendingDecision) {
    halted = match;
    break;
  }
}
if (!halted) {
  console.log('no stoppage this run, rerun the script');
  process.exit(1);
}
const mySide = halted.homeClubId === clubA.id ? 'home' : 'away';
console.log('halted at', halted.live.currentMinute, 'side', halted.live.pendingDecision.side, '(mine:', mySide + ')');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(WEB);
await page.evaluate(({ t, u }) => {
  localStorage.setItem('token', t);
  localStorage.setItem('userId', u);
}, { t: a.token, u: a.userId });

await page.goto(`${WEB}/match/${fixture.matchId}/live`);
await page.waitForSelector('.stoppage-panel', { timeout: 15000 });
await page.waitForTimeout(800);

const panel = {
  heading: await page.locator('.stoppage-panel h2').innerText(),
  headline: await page.locator('.stoppage-headline').innerText().catch(() => null),
  optionCount: await page.locator('.stoppage-option').count(),
  suggested: await page.locator('.stoppage-option.suggested .stoppage-option-name').innerText().catch(() => null),
  clockLabel: await page.locator('.match-banner-progress span').innerText(),
  resumeButtons: await page.getByRole('button', { name: /Continuar$|Continuar para o 2/ }).count(),
};
console.log('PANEL:', JSON.stringify(panel, null, 2));
await page.screenshot({ path: `${OUT}/stoppage.png`, fullPage: true });

// The clock must not move while the panel is up.
const minuteBefore = (await api(`/matches/${fixture.matchId}`, a.token)).live.currentMinute;
await page.waitForTimeout(3000);
const minuteAfter = (await api(`/matches/${fixture.matchId}`, a.token)).live.currentMinute;
console.log('CLOCK FROZEN:', minuteBefore === minuteAfter, `(${minuteBefore} -> ${minuteAfter})`);

// Pick a replacement and confirm play restarts.
const chosenName = await page.locator('.stoppage-option .stoppage-option-name').first().innerText();
await page.locator('.stoppage-option').first().click();
await page.waitForTimeout(2500);

const after = {
  panelGone: (await page.locator('.stoppage-panel').count()) === 0,
  clockLabel: await page.locator('.match-banner-progress span').innerText(),
  subInFeed: await page.locator('.lances-feed').innerText().then((t) => t.includes(chosenName)),
};
console.log('CHOSE:', chosenName);
console.log('AFTER:', JSON.stringify(after));
await page.screenshot({ path: `${OUT}/stoppage-resolved.png`, fullPage: true });

const resumedMinute = (await api(`/matches/${fixture.matchId}`, a.token)).live?.currentMinute ?? 90;
console.log('RESUMED PAST STOP:', resumedMinute > minuteAfter, `(${minuteAfter} -> ${resumedMinute})`);

console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

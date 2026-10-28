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

const a = await register();
const clubA = await api('/clubs', a.token, { name: `Gate ${crypto.randomUUID().slice(0, 5)} FC`, country: 'BRA' });

/**
 * Only my own club's league matters — whoever it gets drawn against is fine. Pinning two specific clubs to
 * the same league used to work, but dev.db is shared with the test suites and its leagues fill up and start
 * on their own, so two freshly created clubs routinely land in different ones.
 *
 * The fixture generator also needs an even club count, so top the league up when it is short.
 */
async function myOpenLeague() {
  const leagues = await api('/leagues?country=BRA', a.token);
  return leagues.find((l) => l.clubIds.includes(clubA.id) && l.status === 'OPEN');
}
let league = await myOpenLeague();
for (let i = 0; league && (league.clubIds.length < 2 || league.clubIds.length % 2 !== 0) && i < 6; i++) {
  const filler = await register();
  await api('/clubs', filler.token, { name: `Filler ${crypto.randomUUID().slice(0, 6)} FC`, country: 'BRA' });
  league = (await myOpenLeague()) ?? league;
}
if (!league) throw new Error('My club did not land in an open league');

await api(`/leagues/${league.id}/force-start`, a.token, {});
const advanced = await api(`/leagues/${league.id}/advance-round`, a.token, {});
// With fillers in the league the round has several fixtures; only mine can be driven interactively.
const fixture = advanced.fixtures.find((f) => f.matchId && (f.homeClubId === clubA.id || f.awayClubId === clubA.id));
if (!fixture) throw new Error('No live fixture created for my club');

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
try {
  await page.waitForSelector('.match-banner', { timeout: 15000 });
} catch (err) {
  console.log('--- page text ---');
  console.log(await page.evaluate(() => document.body.innerText));
  console.log('--- console errors ---');
  errors.forEach((e) => console.log(' -', e));
  throw err;
}

// The page opens paused ('manual'), so kick off before measuring. Fastest speed puts the interval
// about 10s of wall clock away.
await page.getByRole('button', { name: 'Muito rápido' }).click();
await page.getByRole('button', { name: '▶ Continuar' }).click();
await page.waitForTimeout(4000);

const clock = () => page.locator('.match-banner-progress span').innerText();

const duringPlay = {
  clock: await clock(),
  tacticSummary: await page.locator('.tactic-summary').count(),
  tacticEditor: await page.locator('.live-tactic-editor').count(),
  pitch: await page.locator('.pitch-field').count(),
  statsCard: await page.locator('.live-match-columns .stat-row-label').count() > 0,
  lances: await page.locator('.live-lances-card').count(),
};
console.log('DURING PLAY:', JSON.stringify(duringPlay));
await page.screenshot({ path: `${OUT}/play-no-tactics.png`, fullPage: true });

/**
 * The clock now stops dead for an injury or a dismissal and waits for the manager, so a script that only
 * watches for halftime will sit there forever if one lands first. Answer them in the least intrusive way
 * from the API side while the browser plays on — this run is about the tactic panel, not the stoppages.
 */
let stoppagesSeen = 0;
const answering = setInterval(async () => {
  try {
    const match = await api(`/matches/${fixture.matchId}`, a.token);
    const pending = match.live?.pendingDecision;
    if (!pending) return;
    stoppagesSeen++;
    const url =
      pending.type === 'injury'
        ? `/matches/${fixture.matchId}/live/decision`
        : `/matches/${fixture.matchId}/live/decision/reorganize`;
    const body = pending.type === 'injury' ? { replacementPlayerId: null } : { lineupPlayerIds: null };
    await api(url, a.token, body);
  } catch {
    // The match may have finished between the read and the write; nothing to do.
  }
}, 1000);

// Roll on to the interval.
await page.waitForSelector('text=Intervalo', { timeout: 120000 });
clearInterval(answering);
if (stoppagesSeen > 0) console.log(`(${stoppagesSeen} interrupção(ões) respondida(s) pelo script)`);
await page.waitForTimeout(1500);

const atHalftime = {
  clock: await clock(),
  editorAutoOpen: await page.locator('.live-tactic-editor').count(),
  tacticSummary: await page.locator('.tactic-summary').count(),
  resumeButton: await page.getByRole('button', { name: /Continuar para o 2º tempo/ }).count(),
};
console.log('AT HALFTIME (editor auto-open):', JSON.stringify(atHalftime));
await page.screenshot({ path: `${OUT}/halftime-editor.png`, fullPage: true });

// Close the editor: at the interval the summary card should take its place.
await page.getByRole('button', { name: 'Fechar ajustes' }).click();
await page.waitForTimeout(500);
const halftimeSummary = {
  tacticSummary: await page.locator('.tactic-summary').count(),
  summaryVisible: await page.locator('.tactic-summary').isVisible().catch(() => false),
  hint: await page.locator('.tactic-summary-hint').innerText().catch(() => null),
};
console.log('AT HALFTIME (editor closed):', JSON.stringify(halftimeSummary));
await page.screenshot({ path: `${OUT}/halftime-summary.png`, fullPage: true });

// Second half: tactics must disappear again.
await page.getByRole('button', { name: /Continuar para o 2º tempo/ }).click();
await page.waitForTimeout(3500);
const secondHalf = {
  clock: await clock(),
  tacticSummary: await page.locator('.tactic-summary').count(),
  tacticEditor: await page.locator('.live-tactic-editor').count(),
};
console.log('SECOND HALF:', JSON.stringify(secondHalf));
await page.screenshot({ path: `${OUT}/second-half.png`, fullPage: true });

console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

/**
 * End-to-end check for "ir para a partida" opening a match already under way.
 *
 * Walks the manager's actual path: advance a round, watch part of the match, wander off, advance again,
 * then click the button in the browser and see what minute the live screen opens at.
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

const me = await register();
const myClub = await api('/clubs', me.token, { name: `Next ${crypto.randomUUID().slice(0, 5)} FC`, country: 'BRA' });

/** My league whatever its state — it may have started itself the moment it filled to capacity. */
async function myLeague() {
  const leagues = await api('/leagues?country=BRA', me.token);
  return leagues.find((l) => l.clubIds.includes(myClub.id));
}
let league = await myLeague();
for (let i = 0; i < 8 && league?.status === 'OPEN' && (league.clubIds.length < 4 || league.clubIds.length % 2 !== 0); i++) {
  const filler = await register();
  await api('/clubs', filler.token, { name: `Filler ${crypto.randomUUID().slice(0, 6)} FC`, country: 'BRA' });
  league = (await myLeague()) ?? league;
}
if (league.status === 'OPEN') await api(`/leagues/${league.id}/force-start`, me.token, {});

// A lineup on file, otherwise the button stops at the "time não escalado" warning and never routes.
const squad = await api(`/clubs/${myClub.id}`, me.token);
await api(`/clubs/${myClub.id}/round-tactic`, me.token, {
  clubId: myClub.id,
  formation: '4-4-2',
  mentality: 'balanced',
  attackStyle: 'THROUGH_MIDDLE',
  markingStyle: 'BALANCED',
  attackApproach: 'COUNTER_ATTACK',
  lineup: squad.players.slice(0, 11).map((p) => ({ playerId: p.id })),
  substitutes: squad.players.slice(11, 18).map((p) => ({ playerId: p.id })),
  plannedSubstitutions: [],
});

// Round 1, watched partway and abandoned — the situation that used to poison the button.
await api(`/leagues/${league.id}/advance-round`, me.token, {});
const round1 = await api(`/matches/next/${myClub.id}`, me.token);
await api(`/matches/${round1.id}/live/advance`, me.token, { toMinute: 40, interactive: true });
console.log(`rodada 1 abandonada no minuto ${(await api(`/matches/${round1.id}`, me.token)).live.currentMinute}`);

await api(`/leagues/${league.id}/advance-round`, me.token, {});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(WEB);
await page.evaluate(({ t, u }) => {
  localStorage.setItem('token', t);
  localStorage.setItem('userId', u);
}, { t: me.token, u: me.userId });

await page.goto(`${WEB}/clubs/${myClub.id}`);
await page.waitForSelector('.action-banner, .home-grid, .card', { timeout: 15000 });
await page.waitForTimeout(1200);

const button = page.getByRole('button', { name: /IR PARA A PARTIDA/i }).first();
console.log('botão encontrado:', (await button.count()) > 0);
await button.click();

await page.waitForURL(/\/match\/.+\/live/, { timeout: 20000 });
await page.waitForSelector('.match-banner', { timeout: 15000 });
await page.waitForTimeout(800);

const openedId = page.url().match(/\/match\/([^/]+)\/live/)[1];
const opened = await api(`/matches/${openedId}`, me.token);
console.log('');
console.log(`abriu a partida ${openedId.slice(0, 8)} no minuto ${opened.live?.currentMinute}`);
console.log(`é a abandonada da rodada 1? ${openedId === round1.id}`);
console.log(`abriu sem ter começado? ${(opened.live?.currentMinute ?? 0) === 0}`);
console.log(`a abandonada foi encerrada? ${(await api(`/matches/${round1.id}`, me.token)).status === 'SIMULATED'}`);

await page.screenshot({ path: `${OUT}/next-match.png` });
console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

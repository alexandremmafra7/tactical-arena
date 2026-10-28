import { chromium } from 'playwright';

const CLUB_ID = process.argv[2];
if (!CLUB_ID) {
  console.error('usage: node scripts/shot-all.mjs <clubId>');
  process.exit(1);
}

async function api(path, opts, token) {
  const res = await fetch(`http://127.0.0.1:3001${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts?.headers ?? {}) },
  });
  return res.json();
}

const { token, userId } = await api('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'demo@elifoot.local', password: 'demo123' }),
});

const available = await api(`/clubs/available?country=BRA&division=1`, {}, token);
const opponent = available.find((c) => c.id !== CLUB_ID) ?? available[0];
let matchId = null;
if (opponent) {
  const match = await api('/matches', { method: 'POST', body: JSON.stringify({ homeClubId: CLUB_ID, awayClubId: opponent.id }) }, token);
  matchId = match.id;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const allErrors = {};

async function shot(name, path, waitFor) {
  const errors = [];
  const onErr = (msg) => errors.push(typeof msg === 'string' ? msg : msg.text?.() ?? String(msg));
  page.on('console', (m) => m.type() === 'error' && onErr(m));
  page.on('pageerror', onErr);
  await page.goto(`http://localhost:5173${path}`);
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `scripts/pages/${name}.png`, fullPage: true });
  allErrors[name] = errors;
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
}

await page.goto('http://localhost:5173');
await page.evaluate(({ t, u }) => { localStorage.setItem('token', t); localStorage.setItem('userId', u); }, { t: token, u: userId });

await shot('login', '/login', 'text=Entrar');
await shot('dashboard', '/dashboard', '.card');
await shot('clubhome', `/clubs/${CLUB_ID}`, '.club-menu-grid');
await shot('squad', `/clubs/${CLUB_ID}/squad`, '.flag-icon');
await shot('training', `/clubs/${CLUB_ID}/training`, '.club-nav');
await shot('tactics', `/clubs/${CLUB_ID}/tactics`, '.club-nav');
await shot('stadium', `/clubs/${CLUB_ID}/stadium`, '.club-nav');
await shot('finance', `/clubs/${CLUB_ID}/finance`, '.club-nav');
await shot('academy', `/clubs/${CLUB_ID}/academy`, '.club-nav');
await shot('market', '/market', '.page');
if (matchId) {
  await shot('match-tactic', `/match/${matchId}/tactic`, '.page');
}

console.log(JSON.stringify(allErrors, null, 2));
await browser.close();

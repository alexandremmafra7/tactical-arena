import { chromium } from 'playwright';

const CLUB_ID = '20a0c824-fbba-4740-8ee3-03cf42a4f870';
const EMAIL = 'demo@elifoot.local';
const PASSWORD = 'demo123';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

let n = 0;
async function shot(name) {
  n += 1;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `scripts/walkthrough/${String(n).padStart(2, '0')}-${name}.png`, fullPage: true });
}

// 1. Login screen
await page.goto('http://localhost:5173/login');
await page.waitForSelector('text=Entrar');
await shot('login-empty');

await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await shot('login-filled');

await page.click('button:has-text("Entrar")');
await page.waitForURL('**/dashboard');
await shot('dashboard');

// 2. Club home
await page.click(`a[href="/clubs/${CLUB_ID}"]`);
await page.waitForSelector('.club-menu-grid');
await shot('clubhome');

// 3. Set the lineup for the next round
await page.click('a:has-text("TÁTICA/ESCALAÇÃO")');
await page.waitForSelector('text=Escalação da próxima rodada');
await shot('tactics-before');

const slotSelects = await page.$$('.pitch-slot select');
for (const select of slotSelects) {
  await select.selectOption({ index: 1 });
}
await shot('tactics-lineup-filled');

await page.click('button:has-text("Usar esta escalação na próxima rodada")');
await page.waitForTimeout(500);
await shot('tactics-after-set');

// 4. Back to hub — should now show the next fixture
await page.click('a:has-text("Voltar ao painel")');
await page.waitForSelector('.club-menu-grid');
await shot('clubhome-with-fixture');

await page.click('a:has-text("TABELAS/CAMPEONATOS")');
await page.waitForSelector('text=Classificação');
await shot('league-before-round');

// 5. Advance the round (simulate the fixtures)
await page.click('button:has-text("Avançar rodada")');
await page.waitForTimeout(1500);
await shot('league-after-round');

// 6. Open our match result
const leagueId = page.url().split('/league/')[1];
const loginRes = await fetch('http://127.0.0.1:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const { token } = await loginRes.json();
const league = await fetch(`http://127.0.0.1:3001/leagues/${leagueId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
const ourFixture = [...league.fixtures].reverse().find((f) => (f.homeClubId === CLUB_ID || f.awayClubId === CLUB_ID) && f.matchId);

if (ourFixture) {
  await page.goto(`http://localhost:5173/match/${ourFixture.matchId}/result`);
  await page.waitForSelector('.scoreboard');
  await shot('match-result-final');

  await page.click('button:has-text("Ver melhores momentos")');
  await page.waitForTimeout(2500);
  await shot('match-result-playback');
} else {
  console.log('No fixture/matchId found for our club in this league');
}

console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

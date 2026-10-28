import { chromium } from 'playwright';

const CLUB_ID = process.argv[2];

const loginRes = await fetch('http://127.0.0.1:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@elifoot.local', password: 'demo123' }),
});
const { token, userId } = await loginRes.json();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:5173');
await page.evaluate(
  ({ t, u }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('userId', u);
  },
  { t: token, u: userId },
);
await page.goto(`http://localhost:5173/clubs/${CLUB_ID}`);
await page.waitForSelector('.club-menu-grid');
await page.click('text=TABELAS/CAMPEONATOS');
await page.waitForSelector('text=Classificação', { timeout: 10000 });
await page.screenshot({ path: 'scripts/league-from-hub.png', fullPage: true });

console.log('url after click:', page.url());
console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

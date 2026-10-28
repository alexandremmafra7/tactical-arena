import { chromium } from 'playwright';

const loginRes = await fetch('http://127.0.0.1:3001/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@elifoot.local', password: 'demo123' }),
});
const { token, userId } = await loginRes.json();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:5173');
await page.evaluate(
  ({ t, u }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('userId', u);
  },
  { t: token, u: userId },
);
await page.goto('http://localhost:5173/dashboard');
await page.waitForSelector('.card');
await page.screenshot({ path: 'scripts/dashboard.png', fullPage: true });
await browser.close();

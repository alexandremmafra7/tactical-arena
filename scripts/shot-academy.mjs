/**
 * Checks the academy screen end to end: the plasticity column, the focus selector, and that training with
 * a focus actually persists it onto the prospect (which is what makes the attribute nudge land next tick).
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

const email = `${crypto.randomUUID()}@test.local`;
const me = await api('/auth/register', null, { email, password: 'password123' });
const club = await api('/clubs', me.token, { name: `Base ${crypto.randomUUID().slice(0, 5)} FC`, country: 'BRA' });
console.log('garotos na base:', club.academyPlayers.map((p) => `${p.name} (${p.age}a)`).join(', '));

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

await page.goto(`${WEB}/clubs/${club.id}/academy`);
await page.waitForSelector('table', { timeout: 15000 });
await page.waitForTimeout(600);

const headers = await page.locator('thead th').allInnerTexts();
console.log('colunas:', headers.filter(Boolean).join(' | '));
console.log('seletores de foco:', await page.locator('tbody select').count());

// Ages and the plasticity shown next to them, to confirm the column tracks age rather than being a constant.
const rows = await page.locator('tbody tr').evaluateAll((trs) =>
  trs.map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) => td.textContent?.trim() ?? '');
    return { nome: cells[0], idade: cells[3], plasticidade: cells[6] };
  }),
);
rows.forEach((r) => console.log(`  ${r.idade} anos -> ${r.plasticidade}`));

await page.screenshot({ path: `${OUT}/academy.png` });

// Train the first prospect with a TECHNICAL focus and confirm the server stored it.
const firstId = club.academyPlayers[0].id;
await page.locator('tbody tr').first().locator('select').selectOption('TECHNICAL');
await page.locator('tbody tr').first().getByRole('button', { name: 'Treinar' }).click();
await page.waitForTimeout(1500);

const after = await api(`/clubs/${club.id}`, me.token);
const trainedPlayer = after.academyPlayers.find((p) => p.id === firstId);
console.log('');
console.log('após treinar com foco técnico:');
console.log('  trainingFocus salvo:', trainedPlayer?.trainingFocus);
console.log('  pontos de desenvolvimento:', trainedPlayer?.developmentPoints);
console.log('  orçamento debitado:', after.budget < club.budget);

console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

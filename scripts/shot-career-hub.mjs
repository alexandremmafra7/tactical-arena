/**
 * Screenshots the Central de Carreiras at several resolutions so the fluid layout can be eyeballed
 * in one place: desktop wide, laptop, tablet and phone, plus each of the three tabs.
 *
 *   node scripts/shot-career-hub.mjs [outDir]
 *
 * Expects the web dev server on :5173 and the API on :3001.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? '.shots';
const BASE = 'http://localhost:5173';

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

const TABS = ['Continuar', 'Carregar', 'Novo Técnico'];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /Iniciar Jogo/ }).click();
  await page.waitForSelector('.career-hub-shell');

  for (const tabLabel of TABS) {
    const tab = page.locator('.career-hub-nav-item', { hasText: tabLabel }).first();
    await tab.click();
    await page.waitForTimeout(250);

    const slug = tabLabel.toLowerCase().replace(/[^a-z]/g, '');
    const file = join(OUT, `career-hub-${vp.name}-${slug}.png`);
    await page.screenshot({ path: file });
    console.log('wrote', file);

    // Any horizontal overflow means the fluid layout failed at this width.
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      const shell = document.querySelector('.career-hub-shell');
      const body = document.querySelector('.career-hub-main-body');
      return {
        doc: el.scrollWidth - el.clientWidth,
        shell: shell ? shell.scrollWidth - shell.clientWidth : null,
        panel: body ? body.scrollWidth - body.clientWidth : null,
        shellW: shell ? Math.round(shell.getBoundingClientRect().width) : null,
        shellH: shell ? Math.round(shell.getBoundingClientRect().height) : null,
      };
    });
    console.log('   ', vp.name, slug, JSON.stringify(overflow));
  }

  await context.close();
}

await browser.close();

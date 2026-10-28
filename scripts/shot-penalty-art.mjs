/**
 * Renders the penalty interruption modal on its own so the redrawn banner can be looked at.
 *
 * The modal is driven by `dramaticEvent` state inside LiveMatch, which only fires when the engine happens
 * to award a penalty to the manager's side. Rather than hunting for that, this mounts the component
 * directly through a tiny Vite entry — same CSS, same component, no waiting on a coin flip.
 */
import { chromium } from 'playwright';
import { writeFileSync, rmSync } from 'node:fs';

const WEB = 'http://localhost:5173';
const OUT = 'C:/Users/mafra/AppData/Local/Temp/claude/D--Code/75ba4f14-ca39-49f5-82bc-b0234117162c/scratchpad';
const PAGE = 'D:/Code/elifoot-reforged/packages/web/penalty-art-preview.html';
const ENTRY = 'D:/Code/elifoot-reforged/packages/web/src/penalty-art-preview.tsx';

writeFileSync(
  ENTRY,
  `import { createRoot } from 'react-dom/client';
import { MatchEventDramaticModal } from './components/MatchEventDramaticModal.js';
import './styles.css';

const player: any = { id: 'p1', name: 'Diego Almeida', overall: 84, position: 'ATT' };
createRoot(document.getElementById('root')!).render(
  <MatchEventDramaticModal
    event={{ type: 'penalty', minute: 67, player, penaltyTaker: player }}
    kitColor="#e53935"
    onOpenTactics={() => undefined}
    onResume={() => undefined}
  />,
);
`,
);
writeFileSync(
  PAGE,
  `<!doctype html><html><head><meta charset="utf-8"><title>penalty art</title></head>
<body><div id="root"></div><script type="module" src="/src/penalty-art-preview.tsx"></script></body></html>`,
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

try {
  await page.goto(`${WEB}/penalty-art-preview.html`);
  await page.waitForSelector('.dramatic-event-card', { timeout: 20000 });
  await page.waitForTimeout(600);

  const card = page.locator('.dramatic-event-card');
  await card.screenshot({ path: `${OUT}/penalty-art.png` });
  await page.locator('.dramatic-event-media').screenshot({ path: `${OUT}/penalty-art-banner.png` });

  console.log('título:', await page.locator('.dramatic-event-title').innerText());
  const banner = page.locator('.dramatic-event-media img');
  console.log('arte:', await banner.getAttribute('src'));
  // naturalWidth is 0 when the file is missing or failed to decode — a broken banner still renders an
  // <img> element, so its presence alone proves nothing.
  console.log('carregou:', await banner.evaluate((el) => el.naturalWidth > 0 && el.naturalHeight > 0));
  console.log('dimensões da fonte:', await banner.evaluate((el) => `${el.naturalWidth}x${el.naturalHeight}`));
  console.log('console errors:', errors.length);
  errors.forEach((e) => console.log(' -', e));
} finally {
  await browser.close();
  rmSync(ENTRY, { force: true });
  rmSync(PAGE, { force: true });
}

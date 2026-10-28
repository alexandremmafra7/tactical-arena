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

const fit = (c) => c.players.filter((p) => p.injuryMatches === 0 && !p.suspensions.some((s) => s.matchesRemaining > 0));

function roughTactic(club, players) {
  return {
    clubId: club.id,
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'THROUGH_MIDDLE',
    markingStyle: 'HEAVY',
    attackApproach: 'COUNTER_ATTACK',
    lineup: players.slice(0, 11).map((p) => ({ playerId: p.id })),
    substitutes: players.slice(11, 18).map((p) => ({ playerId: p.id })),
    plannedSubstitutions: [],
  };
}

const a = await register();
const b = await register();
const clubA = await api('/clubs', a.token, { name: `Red ${crypto.randomUUID().slice(0, 5)} FC`, country: 'BRA' });
const clubB = await api('/clubs', b.token, { name: `Card ${crypto.randomUUID().slice(0, 5)} SC`, country: 'BRA' });

// Hunt for a dismissal against my own side, waving injuries through so the search keeps going.
let halted = null;
let matchId = null;
for (let attempt = 0; attempt < 200 && !halted; attempt++) {
  const cur = await api(`/clubs/${clubA.id}`, a.token);
  const curB = await api(`/clubs/${clubB.id}`, b.token);
  if (fit(cur).length < 13 || fit(curB).length < 13) break;

  const match = await api('/matches', a.token, { homeClubId: clubA.id, awayClubId: clubB.id });
  await api(`/matches/${match.id}/tactic`, a.token, roughTactic(cur, fit(cur)));
  await api(`/matches/${match.id}/tactic`, b.token, roughTactic(curB, fit(curB)));

  for (let stop = 0; stop < 12; stop++) {
    const res = await api(`/matches/${match.id}/live/advance`, a.token, { toMinute: 90, interactive: true });
    if (res.status === 'SIMULATED') break;
    const pending = res.live?.pendingDecision;
    if (!pending) break;
    if (pending.type === 'redCard') {
      halted = res;
      matchId = match.id;
      break;
    }
    await api(`/matches/${match.id}/live/decision`, a.token, { replacementPlayerId: null });
  }
}
if (!halted) {
  console.log('no dismissal found, rerun');
  process.exit(1);
}
console.log('dismissal at', halted.live.currentMinute, 'player', halted.live.pendingDecision.playerId);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(WEB);
await page.evaluate(({ t, u }) => {
  localStorage.setItem('token', t);
  localStorage.setItem('userId', u);
}, { t: a.token, u: a.userId });

await page.goto(`${WEB}/match/${matchId}/live`);
await page.waitForSelector('.stoppage-panel', { timeout: 15000 });
await page.waitForTimeout(800);

const panel = {
  heading: await page.locator('.stoppage-panel h2').innerText(),
  headline: await page.locator('.stoppage-headline').innerText(),
  // Only rendered for a fixture inside a competition; this is a bare challenge, so it may be absent.
  clockLabel: await page.locator('.match-banner-progress span').innerText().catch(() => '(no competition header)'),
  resumeButtons: await page.getByRole('button', { name: /Continuar$|Continuar para o 2/ }).count(),
  vacatedSlots: await page.locator('.stoppage-panel .pitch-slot-badge.vacated').count(),
  filledSlots: await page.locator('.stoppage-panel .pitch-slot-badge.filled').count(),
  vacatedLabel: await page.locator('.pitch-slot-vacated').innerText().catch(() => null),
  confirmDisabled: await page.getByRole('button', { name: 'Confirmar reorganização' }).isDisabled(),
};
console.log('PANEL:', JSON.stringify(panel, null, 2));
await page.screenshot({ path: `${OUT}/redcard.png`, fullPage: true });

const before = (await api(`/matches/${matchId}`, a.token)).live.homeTactic.lineup.map((s) => s.playerId);

// Drag a team-mate onto the empty shirt to move the hole.
const vacated = page.locator('.stoppage-panel .pitch-slot-badge.vacated').first();
const mover = page.locator('.stoppage-panel .pitch-slot-badge.filled').last();
await mover.dragTo(vacated);
await page.waitForTimeout(400);
const afterDrag = {
  confirmEnabled: !(await page.getByRole('button', { name: 'Confirmar reorganização' }).isDisabled()),
  vacatedSlots: await page.locator('.stoppage-panel .pitch-slot-badge.vacated').count(),
};
console.log('AFTER DRAG:', JSON.stringify(afterDrag));
await page.screenshot({ path: `${OUT}/redcard-moved.png`, fullPage: true });

await page.getByRole('button', { name: 'Confirmar reorganização' }).click();
await page.waitForTimeout(2500);

const saved = (await api(`/matches/${matchId}`, a.token)).live?.homeTactic.lineup.map((s) => s.playerId) ?? null;
console.log('LINEUP CHANGED:', saved ? JSON.stringify(saved) !== JSON.stringify(before) : 'match ended');
console.log('SAME ELEVEN NAMES:', saved ? JSON.stringify([...saved].sort()) === JSON.stringify([...before].sort()) : 'n/a');

const after = {
  panelGone: (await page.locator('.stoppage-panel').count()) === 0,
  stoppageNotice: await page.locator('.live-controls .muted').count(),
};
console.log('AFTER:', JSON.stringify(after));
await page.screenshot({ path: `${OUT}/redcard-resolved.png`, fullPage: true });

console.log('console errors:', errors.length);
errors.forEach((e) => console.log(' -', e));
await browser.close();

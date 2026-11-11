import { build } from 'esbuild';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/** Matches BOT_OWNER_ID in packages/shared/src/domain/club.ts — a premade club nobody has claimed yet. */
const BOT_OWNER_ID = '__bot__';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopRoot, '..', '..');
const serverRoot = path.join(repoRoot, 'packages', 'server');
const webDist = path.join(repoRoot, 'packages', 'web', 'dist');
const resourcesDir = path.join(desktopRoot, 'resources');

function log(step) {
  console.log(`\n> ${step}`);
}

async function waitForHealth(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server at ${url} did not become healthy in time`);
}

/**
 * Flips the demo clubs from the seed account over to the bot-owned pool (and drops the now-pointless
 * seed account) so a player picks one up through the normal "Escolher um clube" claim flow instead of
 * finding 8 clubs already sitting in a shared login — that's the actual point of the demo.
 */
async function releaseDemoClubsToBotPool(dbPath, clubIds, seedUserId) {
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath.replace(/\\/g, '/')}` } } });
  try {
    const result = await prisma.club.updateMany({ where: { id: { in: clubIds } }, data: { ownerId: BOT_OWNER_ID } });
    await prisma.user.delete({ where: { id: seedUserId } });
    console.log(`  Released ${result.count} clubs to the unclaimed pool and removed the seed account.`);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Boots the just-built server bundle against the template DB, seeds a demo (8-club league + cup, both
 * ready to play, all 8 clubs unclaimed) then kills the server. DEMO_SEED=skip opts out for a blank install.
 */
async function seedDemoData(dbPath) {
  if (process.env.DEMO_SEED === 'skip') {
    log('DEMO_SEED=skip set — leaving the template database blank.');
    return;
  }

  log('Seeding the template database with a demo league + cup (8 unclaimed clubs)...');
  const port = 3979;
  const base = `http://127.0.0.1:${port}`;
  const serverProcess = spawn(process.execPath, ['server-bundle.cjs'], {
    cwd: resourcesDir,
    env: { ...process.env, DATABASE_URL: `file:${dbPath.replace(/\\/g, '/')}`, PORT: String(port), HOST: '127.0.0.1' },
    stdio: 'inherit',
  });

  let clubIds = [];
  let seedUserId = null;
  try {
    await waitForHealth(`${base}/health`);

    // A throwaway account used only to create the clubs through the normal authenticated flow — it
    // gets deleted below once its clubs are released to the unclaimed (bot-owned) pool.
    const regRes = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seed@tacticalarena.fc', password: 'seed12345' }),
    });
    if (!regRes.ok) throw new Error(`Demo seed: register failed (${regRes.status})`);
    const { token, userId } = await regRes.json();
    seedUserId = userId;

    const clubNames = [
      'Pumas do Rio FC',
      'Condores Celestes',
      'Touros da Pradaria',
      'Gaúchos Unidos EC',
      'Estrela do Sul FC',
      'Relâmpago Charrúa',
      'Leões da Cordilheira',
      'Fúria Celeste EC',
    ];
    for (const name of clubNames) {
      const res = await fetch(`${base}/clubs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, country: 'URU' }),
      });
      if (!res.ok) throw new Error(`Demo seed: club "${name}" failed (${res.status})`);
      const club = await res.json();
      clubIds.push(club.id);
    }

    // Creating the 8th club auto-starts the double round-robin league for URU/division 1 (LEAGUE_CAPACITY = 8).
    const cupRes = await fetch(`${base}/cups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Copa Celeste', countryCode: 'URU', clubIds }),
    });
    if (!cupRes.ok) throw new Error(`Demo seed: cup creation failed (${cupRes.status})`);
  } finally {
    serverProcess.kill();
    // give SQLite a moment to flush/release the file lock before the direct Prisma write below
    await new Promise((r) => setTimeout(r, 500));
  }

  await releaseDemoClubsToBotPool(dbPath, clubIds, seedUserId);
  console.log('  Demo ready — 8 unclaimed clubs (Uruguai, Divisão 1) via "Escolher um clube"; league auto-started, cup created, both unplayed.');
}

if (!fs.existsSync(webDist)) {
  throw new Error(`Web build not found at ${webDist} — run "npm run build -w packages/web" first.`);
}

fs.rmSync(resourcesDir, { recursive: true, force: true });
fs.mkdirSync(resourcesDir, { recursive: true });

log('Bundling the server (with @tactical-arena/shared inlined) via esbuild...');
await build({
  entryPoints: [path.join(serverRoot, 'src', 'index.ts')],
  outfile: path.join(resourcesDir, 'server-bundle.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  banner: {
    js: `const __vmPath = require('node:path').join(__dirname, 'vendor_modules'); const __Mod = require('node:module'); if (!__Mod.globalPaths.includes(__vmPath)) { __Mod.globalPaths.push(__vmPath); process.env.NODE_PATH = (process.env.NODE_PATH ? process.env.NODE_PATH + require('node:path').delimiter : '') + __vmPath; if (typeof __Mod._initPaths === 'function') __Mod._initPaths(); }`,
  },
  // The Prisma client ships its own native query engine binary — it can't be bundled, only copied as-is.
  external: ['@prisma/client'],
  logLevel: 'info',
});

log('Copying the generated Prisma client (JS wrapper + native query engine)...');
// Placed directly under resources/node_modules — right next to server-bundle.cjs — so Node's normal
// "look in ./node_modules relative to the requiring file" resolution finds it. A NODE_PATH-based
// approach was tried first and turned out unreliable inside Electron's patched module loader.
const prismaClientModulesOut = path.join(resourcesDir, 'vendor_modules');
fs.mkdirSync(prismaClientModulesOut, { recursive: true });
const skipTmpFiles = (src) => !/\.tmp\d*$/.test(src);
fs.cpSync(path.join(repoRoot, 'node_modules', '@prisma', 'client'), path.join(prismaClientModulesOut, '@prisma', 'client'), {
  recursive: true,
  filter: skipTmpFiles,
});
fs.cpSync(path.join(repoRoot, 'node_modules', '.prisma', 'client'), path.join(prismaClientModulesOut, '.prisma', 'client'), {
  recursive: true,
  filter: skipTmpFiles,
});

log('Generating a schema-ready template database...');
const templateDbTmpPath = path.join(desktopRoot, `.tmp-template-${Date.now()}.db`);
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  const p = templateDbTmpPath + suffix;
  try { if (fs.existsSync(p)) fs.rmSync(p, { force: true }); } catch {}
}
execSync(`npx prisma db push --schema="${path.join(serverRoot, 'prisma', 'schema.prisma')}" --skip-generate`, {
  env: { ...process.env, DATABASE_URL: `file:${templateDbTmpPath.replace(/\\/g, '/')}` },
  stdio: 'inherit',
  cwd: repoRoot,
});

log('Importing real club content (content/clubs.csv + players.csv) into the template database...');
execSync('npx tsx packages/server/scripts/import-content.ts', {
  env: { ...process.env, DATABASE_URL: `file:${templateDbTmpPath.replace(/\\/g, '/')}` },
  stdio: 'inherit',
  cwd: repoRoot,
});

await seedDemoData(templateDbTmpPath);

fs.copyFileSync(templateDbTmpPath, path.join(resourcesDir, 'template.db'));
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  const p = templateDbTmpPath + suffix;
  try { if (fs.existsSync(p)) fs.rmSync(p, { force: true }); } catch {}
}

log('Copying the web production build...');
fs.cpSync(webDist, path.join(resourcesDir, 'web-dist'), { recursive: true });

// The embedded server can't resolve a repo-relative content/crests folder the way the normal dev/prod
// server does (see resolveCrestsDir in app.ts — import.meta.url is empty once esbuild bundles this to
// CJS), so crests ride along as static files under web-dist instead: express.static(webDistPath) is
// already mounted at "/", so a file at web-dist/crests/<slug>.png serves at exactly the /crests/<slug>.png
// URL crestUrl() builds — no server code needed, just get the files into the same folder as the SPA.
const crestsSrc = path.join(repoRoot, 'content', 'crests');
if (fs.existsSync(crestsSrc)) {
  log('Copying real club crests into the web build for the embedded server to serve...');
  fs.cpSync(crestsSrc, path.join(resourcesDir, 'web-dist', 'crests'), { recursive: true });
}

// Same trick as the crests above, for the kit colour map — a file at web-dist/kits.json serves at the
// /kits.json URL kitColors.ts fetches. A club without an entry falls back to crest sampling in the web.
const kitsSrc = path.join(repoRoot, 'content', 'kits.json');
if (fs.existsSync(kitsSrc)) {
  log('Copying the kit colour map into the web build for the embedded server to serve...');
  fs.copyFileSync(kitsSrc, path.join(resourcesDir, 'web-dist', 'kits.json'));
}

const jerseysSrc = path.join(repoRoot, 'content', 'jerseys');
if (fs.existsSync(jerseysSrc)) {
  log('Copying real club jerseys into the web build for the embedded server to serve...');
  fs.cpSync(jerseysSrc, path.join(resourcesDir, 'web-dist', 'jerseys'), { recursive: true });
}

const flagsSrc = path.join(repoRoot, 'content', 'flags');
if (fs.existsSync(flagsSrc)) {
  log('Copying real country flags into the web build for the embedded server to serve...');
  fs.cpSync(flagsSrc, path.join(resourcesDir, 'web-dist', 'flags'), { recursive: true });
}

log('Resources ready at packages/desktop/resources/');

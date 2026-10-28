import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..', '..');
const contentDir = path.join(repoRoot, 'content');
const publicDir = path.join(webRoot, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('📦 Syncing content assets (crests, flags, jerseys, kits.json, club database) to packages/web/public...');

const items = ['crests', 'flags', 'jerseys', 'icons', 'trophies'];
for (const item of items) {
  const src = path.join(contentDir, item);
  const dest = path.join(publicDir, item);
  if (fs.existsSync(src)) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
    console.log(`  ✓ Copied ${item}`);
  }
}

/**
 * The club database, which the offline build reads at startup.
 *
 * Offline there is no server and no template.db, so `clubs.csv` and `players.csv` have to travel inside the
 * app bundle: 2,2 MB against the 108 MB of art already there. Copied here rather than kept as a second copy
 * under version control, so editing `content/` is the only way to change the world on either platform.
 */
for (const file of ['clubs.csv', 'players.csv']) {
  const src = path.join(contentDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(publicDir, file));
    console.log(`  ✓ Copied ${file}`);
  } else {
    console.warn(`  ! ${file} não encontrado: o jogo offline vai cair nos clubes inventados`);
  }
}

const kitsSrc = path.join(contentDir, 'kits.json');
const kitsDest = path.join(publicDir, 'kits.json');
if (fs.existsSync(kitsSrc)) {
  fs.copyFileSync(kitsSrc, kitsDest);
  console.log('  ✓ Copied kits.json');
}

console.log('✨ Content sync completed!');

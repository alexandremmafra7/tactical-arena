import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { verifyResources, waitForServer, startupPage } from './startup.js';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Otherwise Electron derives the userData folder name from package.json's "name" (the scoped
// "@tactical-arena/desktop"), which makes for an ugly/broken AppData path.
app.setName('Tactical Arena FC');
// Explicit isolated profile for diagnostics; ordinary launches preserve the existing profile.
if (process.env['TACTICAL_PROFILE_DIR']) app.setPath('userData', path.resolve(process.env['TACTICAL_PROFILE_DIR']));


const EMBEDDED_SERVER_PORT = 47812;
const ONLINE_HOST_PORT = 3001;
const DEV_WEB_URL = 'http://localhost:5173';
let onlineHostProcess = null;

const logPath = path.join(app.getPath('userData'), 'launch.log');
function log(message) {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // best-effort logging only
  }
}
let bootFailure = null;
process.on('unhandledRejection', (error) => { bootFailure = error instanceof Error ? error : new Error(String(error)); });
process.on('uncaughtException', (err) => log(`uncaughtException: ${err?.stack ?? err}`));
process.on('unhandledRejection', (err) => log(`unhandledRejection: ${err?.stack ?? err}`));

function resourcesDir() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'resources');
}

const DB_VERSION = 3;

function getStoredConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveStoredConfig(newCfg) {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    const config = getStoredConfig();
    const updated = { ...config, ...newCfg };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
  } catch {}
}

/** Copies the schema-ready template database into place on first launch or when template updates. */
function ensureDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'tactical_arena.db');
  const template = path.join(resourcesDir(), 'template.db');
  const config = getStoredConfig();

  if (!fs.existsSync(dbPath) || (config.dbVersion || 0) < DB_VERSION) {
    if (fs.existsSync(template)) {
      try {
        if (fs.existsSync(dbPath)) {
          const bakPath = path.join(app.getPath('userData'), 'tactical_arena_backup_v' + (config.dbVersion || 1) + '.db');
          try { fs.copyFileSync(dbPath, bakPath); } catch {}
        }
        fs.copyFileSync(template, dbPath);
        saveStoredConfig({ dbVersion: DB_VERSION });
        log('Synced template.db to ' + dbPath + ' (dbVersion ' + DB_VERSION + ')');
      } catch (err) {
        log('Failed to copy template.db: ' + err);
      }
    } else {
      log('Warning: template.db not found at ' + template);
    }
  }
  return dbPath;
}

function ensureOnlineDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'tactical_arena_online.db');
  const template = path.join(resourcesDir(), 'template.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(template)) {
    try {
      fs.copyFileSync(template, dbPath);
      log('Created online multiplayer database at ' + dbPath);
    } catch (err) {
      log('Failed to copy template.db for online mode: ' + err);
    }
  }
  return dbPath;
}

function getNetworkInviteLinks(port = ONLINE_HOST_PORT) {
  const interfaces = os.networkInterfaces();
  const links = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (addr.address.startsWith('169.254.')) continue;
      const lower = name.toLowerCase();
      let label = `Rede Local / Wi-Fi (${name})`;
      let isVpn = false;
      if (addr.address.startsWith('26.') || lower.includes('radmin')) {
        label = `Radmin VPN (${name})`;
        isVpn = true;
      } else if (addr.address.startsWith('100.') || lower.includes('tailscale') || lower.includes('zerotier')) {
        label = `Tailscale / ZeroTier (${name})`;
        isVpn = true;
      } else if (addr.address.startsWith('25.') || lower.includes('hamachi')) {
        label = `Hamachi VPN (${name})`;
        isVpn = true;
      } else if (lower.includes('vpn') || lower.includes('tun') || lower.includes('tap') || lower.includes('zt')) {
        label = `Rede VPN (${name})`;
        isVpn = true;
      }
      links.push({
        label,
        ip: addr.address,
        url: `http://${addr.address}:${port}`,
        isVpn,
      });
    }
  }
  links.sort((a, b) => (a.isVpn === b.isVpn ? 0 : a.isVpn ? -1 : 1));
  if (links.length === 0) {
    links.push({
      label: 'Servidor Local (Este PC)',
      ip: '127.0.0.1',
      url: `http://127.0.0.1:${port}`,
      isVpn: false,
    });
  }
  return links;
}

/** Generates a random JWT signing secret on first launch and persists it, instead of shipping a fixed dev secret. */
function ensureJwtSecret() {
  const config = getStoredConfig();
  if (!config.jwtSecret) {
    config.jwtSecret = randomBytes(32).toString('hex');
    saveStoredConfig({ jwtSecret: config.jwtSecret });
  }
  return config.jwtSecret;
}

/**
 * Starts the bundled Express+Prisma server in-process. The Prisma client's native query engine
 * can't be bundled by esbuild, so it's shipped as a raw extra resource under resources/node_modules
 * — right next to server-bundle.cjs — so Node's normal module resolution finds it on its own.
 */
function startEmbeddedServer() {
  const resDir = resourcesDir();
  verifyResources(resDir);
  const dbPath = ensureDatabase();

  const vendorModulesPath = path.join(resDir, 'vendor_modules');
  if (fs.existsSync(vendorModulesPath)) {
    const Module = require('node:module');
    if (!Module.globalPaths.includes(vendorModulesPath)) {
      Module.globalPaths.push(vendorModulesPath);
    }
    process.env['NODE_PATH'] = (process.env['NODE_PATH'] ? process.env['NODE_PATH'] + path.delimiter : '') + vendorModulesPath;
    if (typeof Module._initPaths === 'function') {
      Module._initPaths();
    }
  }

  process.env['DATABASE_URL'] = `file:${dbPath.replace(/\\/g, '/')}`;
  process.env['TACTICAL_ARENA_TEMPLATE_DATABASE_PATH'] = path.join(resDir, 'template.db');
  process.env['JWT_SECRET'] = ensureJwtSecret();
  process.env['PORT'] = String(EMBEDDED_SERVER_PORT);
  process.env['HOST'] = '127.0.0.1';
  process.env['WEB_DIST_PATH'] = path.join(resDir, 'web-dist');
  // Gates the team editor (see middleware/desktopOnly.ts) — only this packaged, single-player build sets
  // it, so the same server code stays safe to host multi-user (real PvP exists) without exposing an
  // attribute-editing cheat surface.
  process.env['DESKTOP_MODE'] = 'true';
  process.env['APP_MODE'] = 'local';

  require(path.join(resDir, 'server-bundle.cjs'));
}

async function createWindow() {
  log(`createWindow start, isPackaged=${app.isPackaged}, resourcesDir=${resourcesDir()}`);
  const config = getStoredConfig();
  const isFullscreen = !!config.fullscreen;

  const win = new BrowserWindow({
    show: process.env['TACTICAL_DIAGNOSTIC_HIDDEN'] !== 'true',
    backgroundColor: '#101b2b',
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 600,
    fullscreen: isFullscreen,
    title: 'Tactical Arena FC',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') },
  });

  win.on('enter-full-screen', () => {
    saveStoredConfig({ fullscreen: true });
    win.webContents.send('app:fullscreen-changed', true);
  });
  win.on('leave-full-screen', () => {
    saveStoredConfig({ fullscreen: false });
    win.webContents.send('app:fullscreen-changed', false);
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F11') {
        const next = !win.isFullScreen();
        win.setFullScreen(next);
        saveStoredConfig({ fullscreen: next });
        event.preventDefault();
      } else if (input.alt && (input.key === 'Enter' || input.code === 'Enter')) {
        const next = !win.isFullScreen();
        win.setFullScreen(next);
        saveStoredConfig({ fullscreen: next });
        event.preventDefault();
      }
    }
  });

  win.webContents.on('render-process-gone', (_event, details) => log(`renderer stopped: ${details.reason}`));
  win.webContents.on('did-fail-load', (_event, code, description, _url, mainFrame) => {
    if (mainFrame) log(`page load failed: ${code} ${description}`);
  });
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 1) log(`[renderer console] ${message} (${sourceId}:${line})`);
  });
  if (app.isPackaged) {
    await win.loadURL(startupPage());
    try {
      startEmbeddedServer();
      log('embedded server require() returned, waiting for health check...');
      await waitForServer(`http://127.0.0.1:${EMBEDDED_SERVER_PORT}/health`, 60_000, () => bootFailure);
      log('embedded server is up, loading window');
      await win.loadURL(`http://127.0.0.1:${EMBEDDED_SERVER_PORT}`);
      log("game page loaded");
    } catch (err) {
      log(`Failed to boot embedded server: ${err?.stack ?? err}`);
      await win.loadURL(startupPage(true));
    }
  } else {
    win.loadURL(DEV_WEB_URL);
  }
}

/** Backs the "Sobre" screen in the Opções menu (see Start.tsx) — version/platform info useful for a beta
 *  tester to include when reporting a bug. */
ipcMain.handle('app:get-info', () => ({
  name: app.getName(),
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  platform: process.platform,
}));

/**
 * "Salvar jogo" in the Opções menu. Every action already persists to SQLite immediately — there's no
 * unsaved in-memory state to flush — so this is a manual backup snapshot instead: a timestamped copy of
 * the live save, there for a beta tester to fall back to if something goes wrong later. Never touches
 * the live tactical_arena.db itself.
 */
ipcMain.handle('app:save-game', () => {
  const dbPath = path.join(app.getPath('userData'), 'tactical_arena.db');
  if (!fs.existsSync(dbPath)) {
    return { ok: false, error: 'Nenhum jogo salvo ainda — escolha um clube primeiro.' };
  }
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `tactical_arena-${stamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    return { ok: true, path: backupPath };
  } catch (err) {
    log(`app:save-game failed: ${err?.stack ?? err}`);
    return { ok: false, error: 'Não foi possível criar a cópia de segurança.' };
  }
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('app:toggle-fullscreen', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return false;
  const next = !win.isFullScreen();
  win.setFullScreen(next);
  saveStoredConfig({ fullscreen: next });
  return next;
});

ipcMain.handle('app:is-fullscreen', () => {
  const [win] = BrowserWindow.getAllWindows();
  return win ? win.isFullScreen() : false;
});

ipcMain.handle('app:set-fullscreen', (_e, flag) => {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return false;
  win.setFullScreen(!!flag);
  saveStoredConfig({ fullscreen: !!flag });
  return !!flag;
});

ipcMain.handle('app:get-online-host-status', async () => {
  const inviteLinks = getNetworkInviteLinks(ONLINE_HOST_PORT);
  try {
    const res = await fetch(`http://127.0.0.1:${ONLINE_HOST_PORT}/health`);
    if (res.ok) {
      return {
        ok: true,
        running: true,
        port: ONLINE_HOST_PORT,
        hostUrl: `http://127.0.0.1:${ONLINE_HOST_PORT}`,
        inviteLinks,
      };
    }
  } catch {}
  return {
    ok: true,
    running: false,
    port: ONLINE_HOST_PORT,
    hostUrl: `http://127.0.0.1:${ONLINE_HOST_PORT}`,
    inviteLinks,
  };
});

ipcMain.handle('app:start-online-host', async () => {
  const inviteLinks = getNetworkInviteLinks(ONLINE_HOST_PORT);
  try {
    const res = await fetch(`http://127.0.0.1:${ONLINE_HOST_PORT}/health`);
    if (res.ok) {
      return {
        ok: true,
        running: true,
        port: ONLINE_HOST_PORT,
        hostUrl: `http://127.0.0.1:${ONLINE_HOST_PORT}`,
        inviteLinks,
      };
    }
  } catch {}

  try {
    const resDir = resourcesDir();
    const onlineDbPath = ensureOnlineDatabase();
    const bundlePath = path.join(resDir, 'server-bundle.cjs');
    const childEnv = { ...process.env };
    childEnv['DESKTOP_MODE'] = 'false';
    childEnv['ELECTRON_RUN_AS_NODE'] = '1';
    childEnv['APP_MODE'] = 'hosted';
    childEnv['HOST'] = '0.0.0.0';
    childEnv['PORT'] = String(ONLINE_HOST_PORT);
    childEnv['CORS_ORIGINS'] = 'http://127.0.0.1:47812,http://localhost:47812,http://127.0.0.1:5173,http://localhost:5173';
    childEnv['DATABASE_URL'] = `file:${onlineDbPath.replace(/\\/g, '/')}`;
    childEnv['TACTICAL_ARENA_TEMPLATE_DATABASE_PATH'] = path.join(resDir, 'template.db');
    childEnv['WEB_DIST_PATH'] = path.join(resDir, 'web-dist');
    childEnv['JWT_SECRET'] = ensureJwtSecret();

    log(`Starting online host server on 0.0.0.0:${ONLINE_HOST_PORT} (${bundlePath})...`);
    onlineHostProcess = spawn(process.execPath, [bundlePath], {
      cwd: resDir,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    onlineHostProcess.stdout?.on('data', (chunk) => log(`[online-host] ${String(chunk).trim()}`));
    onlineHostProcess.stderr?.on('data', (chunk) => log(`[online-host err] ${String(chunk).trim()}`));
    onlineHostProcess.on('exit', (code) => {
      log(`Online host server exited with code ${code}`);
      onlineHostProcess = null;
    });

    await waitForServer(`http://127.0.0.1:${ONLINE_HOST_PORT}/health`, 25_000, () => null);
    log(`Online host server is up on port ${ONLINE_HOST_PORT}`);
    return {
      ok: true,
      running: true,
      port: ONLINE_HOST_PORT,
      hostUrl: `http://127.0.0.1:${ONLINE_HOST_PORT}`,
      inviteLinks,
    };
  } catch (err) {
    log(`Failed to start online host server: ${err?.stack ?? err}`);
    return {
      ok: false,
      running: false,
      error: err instanceof Error ? err.message : String(err),
      inviteLinks,
    };
  }
});

app.on('will-quit', () => {
  if (onlineHostProcess) {
    try { onlineHostProcess.kill(); } catch {}
    onlineHostProcess = null;
  }
});

/**
 * Only ever one copy of the game at a time.
 *
 * The embedded server binds a fixed port (EMBEDDED_SERVER_PORT). A second launch cannot bind it, but
 * waitForServer still succeeds — because the FIRST instance is answering — so the second window
 * happily loads its whole UI from the first instance's server. Close the first one and the survivor is
 * left pointing at a dead origin: every image turns into a broken-image icon and every click does
 * nothing, with no error message to explain it. Focusing the existing window instead makes that
 * situation impossible.
 */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log('another instance is already running, quitting this one');
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(createWindow).catch((err) => log(`createWindow failed: ${err?.stack ?? err}`));

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

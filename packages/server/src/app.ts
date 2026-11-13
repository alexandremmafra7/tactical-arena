import 'express-async-errors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { allowedOrigins, validateSecurityConfiguration, requestBoundary, getLocalSession, requireLocalSession, rateLimit } from './middleware/security.js';
import { assertSigningKey } from './services/authService.js';
import { authRouter } from './routes/auth.js';
import { clubsRouter } from './routes/clubs.js';
import { matchesRouter } from './routes/matches.js';
import { transfersRouter } from './routes/transfers.js';
import { leaguesRouter } from './routes/leagues.js';
import { cupsRouter } from './routes/cups.js';
import { historyRouter } from './routes/history.js';
import { careerRouter } from './routes/career.js';
import { teamEditorRouter } from './routes/teamEditor.js';
import { gameRouter } from './routes/game.js';
import { savesRouter } from './routes/saves.js';
import { pressConferenceRouter } from './routes/pressConference.js';

/**
 * packages/server/{src,dist}/app.{ts,js} are both 3 levels under the repo root either way — but when
 * esbuild bundles this to CJS (the desktop package), `import.meta.url` is empty and `fileURLToPath`
 * throws, so there's no repo-relative crests folder to serve there anyway (none ships in that build).
 */
function resolveContentDir(): string | null {
  try {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    return path.join(dirname, '..', '..', '..', 'content');
  } catch {
    return null;
  }
}
const contentDir = resolveContentDir();

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  validateSecurityConfiguration();
  assertSigningKey();
  app.disable('x-powered-by');
  app.use(requestBoundary);
  app.use(cors({origin: (origin, callback) => callback(null, origin && allowedOrigins().has(origin) ? origin : false)}));
  app.use(express.json({limit: '100kb'}));
  app.get('/local-session', getLocalSession);

  app.get('/health', (_req, res) => res.json({ ok: true }));
  // Unauthenticated on purpose — the client uses this only to decide whether to SHOW the team-editor
  // entry point at all (a UX courtesy). The real gate is requireDesktopMode on the editor router itself.
  app.get('/config', (_req, res) => res.json({ desktopMode: process.env['DESKTOP_MODE'] === 'true' }));
  if (contentDir) {
    app.use('/crests', express.static(path.join(contentDir, 'crests')));
    app.use('/jerseys', express.static(path.join(contentDir, 'jerseys')));
    app.use('/flags', express.static(path.join(contentDir, 'flags')));
    app.use('/trophies', express.static(path.join(contentDir, 'trophies')));
    // Slug → kit colour (hex, no '#'), shipped by the content pipeline just like crests. Unauthenticated
    // on purpose — it's static reference data; the client uses it to theme screens without sampling crests.
    app.get('/kits.json', (_req, res) => {
      res.sendFile(path.join(contentDir, 'kits.json'));
    });
  }
  const authRateLimit = process.env.NODE_ENV === 'test' ? 10_000 : 20;
  const savesRateLimit = process.env.NODE_ENV === 'test' ? 10_000 : 60;

  // Only set when this server is embedded alongside a built web app (e.g. Docker on Render or desktop package).
  // Serves the SPA's static assets and falls back to index.html for client-side browser navigation.
  const webDistPath = process.env['WEB_DIST_PATH'];
  if (webDistPath) {
    app.use(express.static(webDistPath));
    // When a browser navigates directly to a client route that shares a path prefix with an API router
    // (e.g. /clubs/:id, /career, /leagues/:id, /history), the browser requests Accept: text/html.
    // Serving index.html allows React Router to load on the client instead of hitting 401 on the API.
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
        res.sendFile(path.join(webDistPath, 'index.html'));
        return;
      }
      next();
    });
  }

  app.use('/auth', rateLimit(authRateLimit), authRouter);
  app.use('/clubs', clubsRouter);
  app.use('/matches', matchesRouter);
  app.use('/transfers', transfersRouter);
  app.use('/leagues', leaguesRouter);
  app.use('/cups', cupsRouter);
  app.use('/history', historyRouter);
  app.use('/career', careerRouter);
  app.use('/team-editor', teamEditorRouter);
  app.use('/saves', requireLocalSession, rateLimit(savesRateLimit), savesRouter);
  app.use('/game', gameRouter);
  app.use('/press-conferences', pressConferenceRouter);

  if (webDistPath) {
    app.get('*', (_req, res) => res.sendFile(path.join(webDistPath, 'index.html')));
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Erro interno do servidor';
    res.status(500).json({ error: message });
  });

  return app;
}

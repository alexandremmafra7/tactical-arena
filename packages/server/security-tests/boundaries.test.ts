import {afterEach, describe, expect, it, vi} from 'vitest';
import express from 'express';
import request from 'supertest';
vi.mock('../src/db/prisma.js', () => ({prisma: {}}));
vi.mock('../src/services/saveService.js', () => ({
  listAllSaves: async () => ({saves: [{id: 'fixture', managerToken: 'must-not-leak'}]}),
  loadSave: async () => ({save: {id: 'fixture', managerToken: 'must-not-leak'}, token: 'fixture-session', userId: 'fixture-user'}),
  deleteSave: vi.fn(), createNewSave: vi.fn(), renameSave: vi.fn(), duplicateSave: vi.fn(),
}));
import {requestBoundary, getLocalSession, rateLimit, validateSecurityConfiguration} from '../src/middleware/security.js';
import {savesRouter} from '../src/routes/saves.js';
import {assertSigningKey, createManagerToken, verifyToken} from '../src/services/authService.js';
function app() {
  const app = express();
  app.use(requestBoundary, express.json());
  app.get('/local-session', getLocalSession);
  app.use('/saves', savesRouter);
  return app;
}
afterEach(() => vi.unstubAllEnvs());
describe('Security boundaries without real saves', () => {
  it('requires a local capability; listing omits tokens', async () => {
    vi.stubEnv('APP_MODE', 'local');
    const server = app();
    await request(server).get('/saves').expect(401);
    const bootstrap = await request(server).get('/local-session').expect(200);
    const response = await request(server).get('/saves').set('X-Local-Session', bootstrap.body.token).expect(200);
    expect(JSON.stringify(response.body)).not.toContain('must-not-leak');
    await request(server).delete('/saves/fixture').expect(401);
    const loaded = await request(server).post('/saves/fixture/load').set('X-Local-Session', bootstrap.body.token).expect(200);
    expect(loaded.body.token).toBe('fixture-session');
    expect(loaded.body.save.managerToken).toBeUndefined();
  });
  it('blocks all file save access in hosted mode', async () => {
    vi.stubEnv('APP_MODE', 'hosted'); vi.stubEnv('DESKTOP_MODE', 'false');
    await request(app()).get('/saves').expect(403);
    await request(app()).post('/saves/fixture/load').expect(403);
    await request(app()).delete('/saves/fixture').expect(403);
  });
  it('rejects rebinding hosts and malicious browser origins', async () => {
    vi.stubEnv('APP_MODE', 'local');
    await request(app()).get('/local-session').set('Host', 'evil.example').expect(403);
    await request(app()).get('/local-session').set('Origin', 'https://evil.example').expect(403);
  });
  it('fails hosted startup without a strong configured key', () => {
    vi.stubEnv('APP_MODE', 'hosted'); vi.stubEnv('DESKTOP_MODE', 'false'); vi.stubEnv('JWT_SECRET', '');
    expect(assertSigningKey).toThrow();
    vi.stubEnv('JWT_SECRET', 'fixture-key-at-least-32-characters-long');
    expect(verifyToken(createManagerToken('fixture-user'))).toBe('fixture-user');
    expect(() => verifyToken('not-a-token')).toThrow();
  });
  it('refuses a local server bound to the network', () => {
    vi.stubEnv('APP_MODE', 'local'); vi.stubEnv('HOST', '0.0.0.0');
    expect(validateSecurityConfiguration).toThrow();
  });
  it('limits repeated attempts', async () => {
    const server = express(); server.get('/', rateLimit(2), (_req, res) => res.json({ok: true}));
    await request(server).get('/').expect(200); await request(server).get('/').expect(200); await request(server).get('/').expect(429);
  });
  it('rejects conflicting hosted and desktop modes', () => {
    vi.stubEnv('APP_MODE', 'hosted'); vi.stubEnv('DESKTOP_MODE', 'true');
    expect(validateSecurityConfiguration).toThrow();
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { waitForServer, verifyResources, startupPage } from './startup.js';

async function server(t, handler) {
  const instance = http.createServer(handler);
  await new Promise(resolve => instance.listen(0, '127.0.0.1', resolve));
  t.after(() => { instance.closeAllConnections(); instance.close(); });
  return `http://127.0.0.1:${instance.address().port}/health`;
}
test('waits for healthy status, not merely an HTTP response', async t => {
  let calls = 0;
  const url = await server(t, (_q, r) => { r.writeHead(++calls === 1 ? 503 : 200); r.end(); });
  await waitForServer(url, 2000);
  assert.ok(calls >= 2);
});
test('hung response has bounded timeout', async t => {
  const url = await server(t, () => {});
  await assert.rejects(waitForServer(url, 100));
});
test('startup exception is propagated', async () => {
  await assert.rejects(waitForServer('http://127.0.0.1:1', 1000, () => new Error('fixture')),/fixture/);
});
test('missing installation resource is explicit; fallback is self-contained', () => {
  assert.throws(() => verifyResources('missing-fixture-directory'), /Instalação incompleta/);
  const html = decodeURIComponent(startupPage(true));
  assert.ok(html.includes('Não foi possível iniciar'));
  assert.ok(!html.includes('src="/assets/'));
});

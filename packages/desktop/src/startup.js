import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export function verifyResources(root) {
  for (const name of ['server-bundle.cjs', 'web-dist/index.html', 'vendor_modules/@prisma/client/package.json']) {
    if (!fs.existsSync(path.join(root, name))) throw new Error(`Instalação incompleta: arquivo ausente (${name}).`);
  }
}

export function waitForServer(url, timeoutMs, startupError = () => null) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const failure = startupError();
      if (failure) { reject(failure); return; }
      const remaining = deadline - Date.now();
      if (remaining <= 0) { reject(new Error('O servidor interno não ficou pronto. Consulte launch.log.')); return; }
      let settled = false;
      const retry = () => {
        if (settled) return;
        settled = true;
        setTimeout(poll, Math.min(150, Math.max(1, deadline - Date.now())));
      };
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode === 200) { settled = true; resolve(); }
        else retry();
      });
      request.setTimeout(Math.min(1000, remaining), () => request.destroy(new Error('Health request timeout')));
      request.on('error', retry);
    };
    poll();
  });
}

export function startupPage(failed = false) {
  const title = failed ? 'Não foi possível iniciar o Tactical' : 'Preparando o Tactical Arena FC';
  const detail = failed
    ? 'Feche e abra novamente o aplicativo. Se o problema continuar, confira o arquivo launch.log na pasta de dados do Tactical. Não apague seus saves.'
    : 'Aguarde enquanto o jogo prepara o banco e carrega a interface.';
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Tactical Arena FC</title><style>body{background:#101b2b;color:#edf3ff;font:20px system-ui;display:grid;place-content:center;min-height:90vh;margin:30px}main{max-width:720px}p{line-height:1.6;color:#c0ccdc}</style><main><h1>${title}</h1><p>${detail}</p></main></html>`);
}

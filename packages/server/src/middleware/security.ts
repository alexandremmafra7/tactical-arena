import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);
const localSession = randomBytes(32).toString('hex');

export function isLocalMode(): boolean {
  return process.env['DESKTOP_MODE'] === 'true' || process.env['APP_MODE'] === 'local' ||
    (!process.env['APP_MODE'] && process.env['NODE_ENV'] !== 'production');
}

export function allowedOrigins(): Set<string> {
  const values = (process.env['CORS_ORIGINS'] ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (isLocalMode()) values.push('http://localhost:5173', 'http://127.0.0.1:5173');
  return new Set(values);
}

export function validateSecurityConfiguration(): void {
  const mode = process.env['APP_MODE'];
  if (mode === 'hosted' && process.env['DESKTOP_MODE'] === 'true') {
    throw new Error('APP_MODE=hosted não pode ser combinado com DESKTOP_MODE=true.');
  }
  if (mode && mode !== 'local' && mode !== 'hosted') throw new Error('APP_MODE deve ser local ou hosted.');
  if (isLocalMode() && !loopback.has(process.env['HOST'] ?? '127.0.0.1')) {
    throw new Error('Modo local exige HOST de loopback. Para rede, configure APP_MODE=hosted.');
  }
  for (const origin of allowedOrigins()) {
    const url = new URL(origin);
    if (url.origin !== origin || (url.protocol !== 'https:' && !loopback.has(url.hostname))) {
      throw new Error('CORS_ORIGINS deve conter origens HTTPS explícitas (HTTP somente em loopback).');
    }
  }
}

export function requestBoundary(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  if (isLocalMode() && (!loopback.has(req.hostname) || !loopback.has(req.socket.remoteAddress ?? ''))) {
    res.status(403).json({error: 'Serviço local indisponível por este endereço.'}); return;
  }
  const origin = req.get('Origin');
  const sameOrigin = origin === `${req.protocol}://${req.get('Host')}`;
  if (origin && !sameOrigin && !allowedOrigins().has(origin)) {
    res.status(403).json({error: 'Origem não autorizada.'}); return;
  }
  if (isLocalMode() && req.get('Sec-Fetch-Site') === 'cross-site' && !origin) {
    res.status(403).json({error: 'Origem não autorizada.'}); return;
  }
  next();
}

export function getLocalSession(_req: Request, res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.json(isLocalMode() ? {enabled: true, token: localSession} : {enabled: false});
}

export function requireLocalSession(req: Request, res: Response, next: NextFunction): void {
  if (!isLocalMode()) { res.status(403).json({error: 'Saves de arquivo são exclusivos do modo local.'}); return; }
  const provided = Buffer.from(req.get('X-Local-Session') ?? '');
  const expected = Buffer.from(localSession);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    res.status(401).json({error: 'Sessão local necessária.'}); return;
  }
  res.setHeader('Cache-Control', 'no-store');
  next();
}

// Bounded, per-process limiter. Hosted multi-instance deployments also need a shared gateway limit.
export function rateLimit(limit: number, windowMs = 60_000) {
  const buckets = new Map<string, {count: number; expires: number}>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
    const key = req.socket.remoteAddress ?? 'unknown';
    if (!buckets.has(key) && buckets.size >= 10_000) { res.status(429).json({error: 'Tente novamente mais tarde.'}); return; }
    const bucket = buckets.get(key) ?? {count: 0, expires: now + windowMs};
    buckets.set(key, bucket);
    if (++bucket.count > limit) { res.setHeader('Retry-After', String(Math.ceil((bucket.expires - now) / 1000))); res.status(429).json({error: 'Limite de tentativas atingido.'}); return; }
    next();
  };
}

import { describe, it, expect } from 'vitest';
import path from 'node:path';

function sanitizeSlug(slug: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(slug);
}

function resolveSecurePath(baseDir: string, filename: string): string {
  if (!sanitizeSlug(filename)) {
    throw new Error('Tentativa de Path Traversal bloqueada.');
  }
  const resolved = path.resolve(baseDir, `${filename}.png`);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw new Error('Violação de sandbox do sistema de arquivos.');
  }
  return resolved;
}

describe('Path Traversal & File System Sandboxing Tests', () => {
  const baseDir = '/tmp/crests';

  it('rejects path traversal attempts in slugs/filenames', () => {
    expect(() => resolveSecurePath(baseDir, '../../etc/passwd')).toThrow();
    expect(() => resolveSecurePath(baseDir, 'club..%2f..%2fsecret')).toThrow();
    expect(() => resolveSecurePath(baseDir, 'flamengo\0malicious')).toThrow();
  });

  it('accepts clean alphanumeric slugs', () => {
    const safe = resolveSecurePath(baseDir, 'flamengo-2026');
    expect(safe).toContain('flamengo-2026.png');
  });
});

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const startSource = readFileSync(join(__dirname, 'Start.tsx'), 'utf-8');

describe('Start career hub source contract', () => {
  it('never creates a fake authenticated session', () => {
    expect(startSource).not.toContain('login(');
    expect(startSource).not.toContain('local_manager_token_1');
    expect(startSource).not.toContain('local_manager_1');
  });

  it('provides direct access to career modes without login bureaucracy', () => {
    expect(startSource).toContain('handleOpenGameMenu');
    expect(startSource).toContain('Nova Carreira');
    expect(startSource).toContain('Carregar Carreira');
    expect(startSource).toContain('<StartSubmenuModal');
    expect(startSource).toContain('onNewCareer={handleNewCareer}');
    expect(startSource).toContain('onLoadCareer={handleLoadCareer}');
  });
});

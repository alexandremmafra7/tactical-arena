import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MANAGER_STYLES, getManagerStyleDefinition, isValidManagerStyle } from '@tactical-arena/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wizardSource = readFileSync(join(__dirname, 'OnboardingWizard.tsx'), 'utf-8');
const foundFormSource = readFileSync(join(__dirname, 'FoundClubForm.tsx'), 'utf-8');

describe('OnboardingWizard source contract', () => {
  it('keeps FoundClubForm free of direct client writes', () => {
    expect(foundFormSource).not.toContain('../api/client');
  });

  it.todo('keeps the required accessibility semantics for the four-stage wizard');
});

describe('Onboarding and Save Manager Styles alignment', () => {
  it('unifies manager styles across menu, wizard and career view', () => {
    const expectedIds = ['Estrategista', 'Ofensivo', 'Formador', 'Gestor'];
    expect(MANAGER_STYLES.map((s) => s.id)).toEqual(expectedIds);

    // Ensure all styles have required visual and text properties
    for (const style of MANAGER_STYLES) {
      expect(style.id).toBeTruthy();
      expect(style.label).toBeTruthy();
      expect(style.icon).toBeTruthy();
      expect(style.desc).toBeTruthy();
    }
  });

  it('safely resolves any manager style string without crashing', () => {
    expect(getManagerStyleDefinition('Estrategista').label).toBe('Estrategista');
    expect(getManagerStyleDefinition('Ofensivo').label).toBe('Ofensivo');
    expect(getManagerStyleDefinition('Formador').label).toBe('Formador');
    expect(getManagerStyleDefinition('Gestor').label).toBe('Gestor de Elenco');

    // Unknown or legacy keys fallback gracefully to Estrategista
    expect(getManagerStyleDefinition('TACTICIAN').id).toBe('Estrategista');
    expect(getManagerStyleDefinition(undefined).id).toBe('Estrategista');
    expect(getManagerStyleDefinition(null).id).toBe('Estrategista');
  });

  it('guards against divergence between UI styles and valid schema', () => {
    for (const style of MANAGER_STYLES) {
      expect(isValidManagerStyle(style.id)).toBe(true);
    }
  });
});

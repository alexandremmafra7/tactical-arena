import { describe, expect, it } from 'vitest';
import { CREST_RULES, CREST_SPEC, buildCrestPrompt, validateCrestDimensions } from './crestSpec.js';

/**
 * The rules a manager gets before their upload fails.
 *
 * "Bring your own crest" is only a real offer if the game says what it needs up front. These numbers are the
 * single source for three things at once: the list on the creator screen, the check the server runs on the
 * file, and the prompt handed to whoever draws the badge. A rule enforced in only one of those places is
 * either a surprise to the manager or a hole in the validation.
 */
describe('crest spec', () => {
  it('accepts a square badge inside the size band', () => {
    expect(validateCrestDimensions(512, 512).ok).toBe(true);
    expect(validateCrestDimensions(CREST_SPEC.minSize, CREST_SPEC.minSize).ok).toBe(true);
    expect(validateCrestDimensions(CREST_SPEC.maxSize, CREST_SPEC.maxSize).ok).toBe(true);
  });

  it('refuses a badge too small to read, and says why', () => {
    const tiny = validateCrestDimensions(64, 64);
    expect(tiny.ok).toBe(false);
    expect(tiny.problem).toContain(String(CREST_SPEC.minSize));
  });

  it('refuses a badge that is not square', () => {
    // The crest is drawn inside a circle in several places, so a wide one loses its own edges.
    expect(validateCrestDimensions(512, 256).ok).toBe(false);
    expect(validateCrestDimensions(256, 512).ok).toBe(false);
    // A few pixels out is not worth refusing over.
    expect(validateCrestDimensions(512, 500).ok).toBe(true);
  });

  it('refuses a badge far bigger than anything that draws it', () => {
    expect(validateCrestDimensions(4096, 4096).ok).toBe(false);
  });

  it('writes a prompt that carries the club identity and the constraints that matter', () => {
    const prompt = buildCrestPrompt({
      clubName: 'Esperança FC',
      city: 'Ouro Preto',
      countryName: 'Brasil',
      colors: 'verde e branco',
    });

    expect(prompt).toContain('Esperança FC');
    expect(prompt).toContain('Ouro Preto');
    expect(prompt).toContain('verde e branco');
    // The three things the game cannot work around, stated in the prompt itself rather than in a footnote.
    expect(prompt).toContain('transparente');
    expect(prompt).toContain('quadrado');
    expect(prompt).toContain('sem texto pequeno');
  });

  it('still writes a usable prompt when the manager filled in almost nothing', () => {
    const prompt = buildCrestPrompt({ clubName: 'Sem Nome FC', countryName: 'Brasil' });

    expect(prompt).toContain('Sem Nome FC');
    expect(prompt).toContain('Brasil');
    // No colours given means the generator picks, rather than the prompt reading "nas cores ".
    expect(prompt).not.toContain('nas cores ,');
    expect(prompt).toContain('cores fortes');
  });

  it('states every rule it enforces', () => {
    const rules = CREST_RULES.join(' ');
    expect(rules).toContain(CREST_SPEC.format);
    expect(rules).toContain(String(CREST_SPEC.minSize));
    expect(rules).toContain(String(CREST_SPEC.maxSize));
    expect(rules).toContain('transparente');
  });
});

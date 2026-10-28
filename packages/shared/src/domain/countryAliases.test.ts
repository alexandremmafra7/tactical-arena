import { describe, expect, it } from 'vitest';
import { COUNTRIES, COUNTRY_CODE_ALIASES, canonicalCountryCode, isValidCountryCode } from './country.js';

/**
 * The club database and the game did not agree on how to spell a country.
 *
 * The shipped data uses Portuguese-flavoured codes — DIN for Denmark, SUE for Sweden, NIG for Nigeria —
 * and the importer simply dropped every club whose code it did not recognise: 84 of the 144 codes in the
 * file, silently. That is how Russia, Ireland, Denmark and a New Zealand league of thirty-three clubs
 * were all missing from a world that had them on disk the whole time.
 */
describe('country aliases', () => {
  it('resolves every alias to a country the game actually knows', () => {
    for (const [alias, canonical] of Object.entries(COUNTRY_CODE_ALIASES)) {
      expect(isValidCountryCode(canonical), `${alias} aponta para ${canonical}, que não existe`).toBe(true);
    }
  });

  it('never aliases a code that is already a country in its own right', () => {
    // Otherwise a country would resolve away to a different one, and its clubs would emigrate.
    for (const alias of Object.keys(COUNTRY_CODE_ALIASES)) {
      expect(COUNTRIES.some((c) => c.code === alias), `${alias} é apelido e país ao mesmo tempo`).toBe(false);
    }
  });

  it('leaves a code it does not know alone', () => {
    expect(canonicalCountryCode('BRA')).toBe('BRA');
    expect(canonicalCountryCode('XXX')).toBe('XXX');
  });

  it('sends the spellings that meant the same country to the same place', () => {
    // The file carries two codes for several countries; both have to land on one league, not two.
    expect(canonicalCountryCode('AZB')).toBe(canonicalCountryCode('AZE'));
    expect(canonicalCountryCode('TCH')).toBe(canonicalCountryCode('REP'));
    expect(canonicalCountryCode('ELV')).toBe(canonicalCountryCode('ESL'));
    expect(canonicalCountryCode('UBZ')).toBe(canonicalCountryCode('UZB'));
    expect(canonicalCountryCode('EMI')).toBe(canonicalCountryCode('UAE'));
    expect(canonicalCountryCode('PAP')).toBe(canonicalCountryCode('PNG'));
  });

  it('gives every country a continent, which is what the continental cups will read', () => {
    for (const country of COUNTRIES) {
      expect(country.name.length, `${country.code} sem nome`).toBeGreaterThan(0);
      expect(country.flag.length, `${country.code} sem bandeira`).toBeGreaterThan(0);
    }
    // No two entries may claim the same code, or a club's country becomes ambiguous.
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
  });
});

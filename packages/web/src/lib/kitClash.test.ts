import { describe, expect, it } from 'vitest';
import { deltaE, resolveMatchKits, KIT_CLASH_THRESHOLD } from './kitClash.js';

describe('kitClash module', () => {
  it('correctly calculates deltaE and classifies reference pairs', () => {
    // Flamengo vs Internacional primary
    const dFlamengoInter = deltaE('#ff3333', '#c01616');
    expect(dFlamengoInter).toBeLessThan(KIT_CLASH_THRESHOLD);
    expect(Math.abs(dFlamengoInter - 19.2)).toBeLessThan(5); // within measurement tolerance

    // Gremio vs Cruzeiro primary
    const dGremioCruzeiro = deltaE('#409fff', '#053e83');
    expect(dGremioCruzeiro).toBeLessThan(KIT_CLASH_THRESHOLD);
    expect(Math.abs(dGremioCruzeiro - 40.0)).toBeLessThan(5);

    // Sao Paulo vs Fluminense primary
    const dSaoPauloFlu = deltaE('#ffffff', '#ffffff');
    expect(dSaoPauloFlu).toBe(0.0);
    expect(dSaoPauloFlu).toBeLessThan(KIT_CLASH_THRESHOLD);

    // Flamengo vs Palmeiras primary
    const dFlamengoPalmeiras = deltaE('#ff3333', '#028b4c');
    expect(dFlamengoPalmeiras).toBeGreaterThanOrEqual(KIT_CLASH_THRESHOLD);
    expect(Math.abs(dFlamengoPalmeiras - 123.6)).toBeLessThan(10);
  });

  it('resolves match kits without clash for non-clashing teams', () => {
    const home = { primary: '#ff3333', secondary: '#000000' };
    const away = { primary: '#028b4c', secondary: '#ffffff' };
    const kits = resolveMatchKits(home, away);

    expect(kits.home.fill).toBe('#ff3333');
    expect(kits.away.fill).toBe('#028b4c');
    expect(kits.away.awayUsedFallback).toBeUndefined();
  });

  it('resolves kit clash by using away secondary or fallback contrast', () => {
    // Flamengo (#ff3333) vs Internacional (#c01616) - clash
    const home = { primary: '#ff3333', secondary: '#000000' };
    const awayClashing = { primary: '#c01616', secondary: '#ffffff' };
    const kits = resolveMatchKits(home, awayClashing);

    expect(kits.home.fill).toBe('#ff3333');
    expect(kits.away.fill).toBe('#ffffff'); // secondary of internacional is #ffffff, which contrasts with #ff3333
    expect(kits.away.awayUsedFallback).toBe('secondary');
  });

  it('falls back to contrast color when secondary also clashes', () => {
    const home = { primary: '#ff3333', secondary: '#000000' };
    const awayBothClash = { primary: '#c01616', secondary: '#ff1111' }; // secondary also clashes with #ff3333
    const kits = resolveMatchKits(home, awayBothClash);

    expect(kits.home.fill).toBe('#ff3333');
    expect(kits.away.fill).not.toBe('#ff3333');
    expect(kits.away.fill).not.toBe('#c01616');
    expect(kits.away.awayUsedFallback).toBe('contrast');
  });

  it('never changes home team kit fill', () => {
    const home = { primary: '#000000', secondary: '#ffffff' };
    const away = { primary: '#000000', secondary: '#ffffff' }; // identical
    const kits = resolveMatchKits(home, away);

    expect(kits.home.fill).toBe('#000000');
    expect(kits.away.fill).not.toBe('#000000');
  });

  it('defaults to standard kits when kits are missing (null)', () => {
    const kits = resolveMatchKits(null, null);
    expect(kits.home.fill).toBe('#ef4444');
    expect(kits.away.fill).toBe('#3b82f6');
  });

  it('assigns distinct goalkeepers that contrast with field players and each other', () => {
    const home = { primary: '#ff3333', secondary: '#000000' };
    const away = { primary: '#3b82f6', secondary: '#ffffff' };
    const kits = resolveMatchKits(home, away);

    expect(kits.home.gk).toBeDefined();
    expect(kits.away.gk).toBeDefined();
    expect(kits.home.gk).not.toBe(kits.home.fill);
    expect(kits.home.gk).not.toBe(kits.away.fill);
    expect(kits.away.gk).not.toBe(kits.home.fill);
    expect(kits.away.gk).not.toBe(kits.away.fill);
    expect(kits.home.gk).not.toBe(kits.away.gk);
  });

  it('is fully deterministic (same inputs produce identical output)', () => {
    const home = { primary: '#123456', secondary: '#abcdef' };
    const away = { primary: '#654321', secondary: '#fedcba' };
    const r1 = resolveMatchKits(home, away);
    const r2 = resolveMatchKits(home, away);
    expect(r1).toEqual(r2);
  });
});

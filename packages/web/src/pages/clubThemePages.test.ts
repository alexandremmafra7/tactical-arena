import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getClubColors, getClubThemeStyle } from '../lib/clubTheme.js';

const page = (name: string) => readFileSync(new URL(`./${name}.tsx`, import.meta.url), 'utf8');
const styles = () => readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

describe('club-themed player pages', () => {
  it('keeps very dark primary colors readable on the dark UI', () => {
    const { readable } = getClubColors({ id: 'dark', name: 'Dark FC', primaryColor: '#0a0a0a' });
    expect(readable).toMatch(/^#[0-9a-f]{6}$/i);
    expect(readable).not.toBe('#0a0a0a');

    // Navy Blue / dark colors like Mafra (#002244)
    const navy = getClubColors({ id: 'mafra', name: 'Mafra', primaryColor: '#002244' });
    expect(navy.readable).not.toBe('#002244');
    expect(navy.readable).toMatch(/^#[0-9a-f]{6}$/i);

    const style = getClubThemeStyle({ id: 'mafra', name: 'Mafra', primaryColor: '#002244' });
    expect((style as any)['--accent']).toBe(navy.readable);
    expect((style as any)['--club-primary']).toBe('#002244');
  });

  it.each(['PlayerDetail', 'Training', 'Squad'])('%s applies the club theme to its page root', (name) => {
    expect(page(name)).toContain("import { getClubThemeStyle } from '../lib/clubTheme.js';");
    expect(page(name)).toMatch(/className="page[^"]*" style=\{getClubThemeStyle\(club\)\}/);
  });

  it('uses the scoped club colors for actions, attributes, traits and fit scores', () => {
    const css = styles();
    expect(css).not.toMatch(/\.squad-page\) button:not\(:disabled\)/);
    expect(css).toMatch(/:is\(\.player-detail-page, \.training-page, \.squad-page\)[\s\S]*?--accent-contrast/);
    expect(css).toMatch(/\.player-detail-page \.attr-bar-fill[\s\S]*?var\(--club-readable\)/);
    expect(css).toMatch(/:is\(\.player-detail-page, \.squad-page\) \.trait-badge[\s\S]*?var\(--club-readable\)/);
    expect(css).toMatch(/\.player-detail-page \.fit-score[\s\S]*?var\(--club-border-glow\)/);
  });
});

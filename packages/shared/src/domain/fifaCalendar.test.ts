import { describe, it, expect } from 'vitest';
import { isFifaDateWeek, getFifaWindowLabel, FIFA_WINDOW_WEEKS } from './fifaCalendar.js';

describe('Fifa Calendar Domain', () => {
  it('identifies FIFA date weeks correctly', () => {
    expect(isFifaDateWeek(11)).toBe(true);
    expect(isFifaDateWeek(23)).toBe(true);
    expect(isFifaDateWeek(36)).toBe(true);
    expect(isFifaDateWeek(41)).toBe(true);
    expect(isFifaDateWeek(46)).toBe(true);
    expect(isFifaDateWeek(10)).toBe(false);
    expect(isFifaDateWeek(20)).toBe(false);
  });

  it('provides correct window labels', () => {
    expect(getFifaWindowLabel(11)).toContain('Março');
    expect(getFifaWindowLabel(36)).toContain('Setembro');
  });

  it('has 5 standard windows', () => {
    expect(FIFA_WINDOW_WEEKS.length).toBe(5);
  });
});

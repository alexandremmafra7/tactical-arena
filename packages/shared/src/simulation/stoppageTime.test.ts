import { describe, it, expect } from 'vitest';
import { calculateStoppageTime } from './stoppageTime.js';
import { formatMatchEventMinute, type MatchEvent } from '../domain/match.js';
import { simulateMatch } from './engine.js';
import { makeClub, makeTactic } from './testFactories.js';

describe('calculateStoppageTime', () => {
  it('calculates baselines with no events (1m in 1st half, 3m in 2nd half)', () => {
    const info = calculateStoppageTime([]);
    expect(info.half1).toBe(1);
    expect(info.half2).toBe(3);
  });

  it('adds extra time for goals, cards, injuries and subs in respective halves', () => {
    const events: MatchEvent[] = [
      { minute: 15, type: 'goal', team: 'home', playerId: 'p1', description: 'Gol' },
      { minute: 30, type: 'injury', team: 'away', playerId: 'p2', description: 'Lesão' },
      { minute: 60, type: 'substitution', team: 'home', playerId: 'p3', description: 'Sub' },
      { minute: 75, type: 'card', team: 'away', playerId: 'p4', description: 'Cartão Vermelho', suspensionMatches: 1 },
      { minute: 88, type: 'goal', team: 'away', playerId: 'p5', description: 'Gol' },
    ];

    const info = calculateStoppageTime(events);
    // Half 1: 1.0 base + 1.0 goal + 1.5 injury = 3.5 -> round = 4
    expect(info.half1).toBe(4);
    // Half 2: 3.0 base + 0.5 sub + 1.5 red + 1.0 goal = 6.0 -> 6
    expect(info.half2).toBe(6);
  });
});

describe('formatMatchEventMinute', () => {
  it('formats regular 1st half minutes', () => {
    expect(formatMatchEventMinute({ minute: 23, period: '1T' })).toBe("23'");
    expect(formatMatchEventMinute({ minute: 45, period: '1T' })).toBe("45'");
  });

  it('formats 1st half stoppage time minutes with + sign', () => {
    expect(formatMatchEventMinute({ minute: 47, period: '1T', stoppageMinute: 2 })).toBe("45+2'");
    expect(formatMatchEventMinute({ minute: 48, period: '1T', stoppageMinute: 3 })).toBe("45+3'");
  });

  it('formats 2nd half regular minutes in HALF_45 and FULL_90 formats', () => {
    expect(formatMatchEventMinute({ minute: 67, period: '2T' }, 'HALF_45')).toBe("22' (2ºT)");
    expect(formatMatchEventMinute({ minute: 67, period: '2T' }, 'FULL_90')).toBe("67'");
    expect(formatMatchEventMinute({ minute: 90, period: '2T' }, 'HALF_45')).toBe("45' (2ºT)");
    expect(formatMatchEventMinute({ minute: 90, period: '2T' }, 'FULL_90')).toBe("90'");
  });

  it('formats 2nd half stoppage time minutes in HALF_45 and FULL_90 formats', () => {
    expect(formatMatchEventMinute({ minute: 93, period: '2T', stoppageMinute: 3 }, 'HALF_45')).toBe("45+3' (2ºT)");
    expect(formatMatchEventMinute({ minute: 93, period: '2T', stoppageMinute: 3 }, 'FULL_90')).toBe("90+3'");
  });
});

describe('simulateMatch stoppage time simulation', () => {
  it('simulates genuine stoppage minutes across multiple matches', () => {
    const home = makeClub('home-stoppage', 'Home Stoppage FC', 75);
    const away = makeClub('away-stoppage', 'Away Stoppage FC', 75);
    const homeTactic = makeTactic(home);
    const awayTactic = makeTactic(away);

    let sawStoppageEvent = false;

    for (let i = 0; i < 40; i++) {
      const result = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `stoppage-seed-${i}`,
      });

      for (const event of result.events) {
        if (event.stoppageMinute !== undefined && event.stoppageMinute > 0) {
          sawStoppageEvent = true;
          if (event.period === '1T') {
            expect(event.stoppageMinute).toBeGreaterThanOrEqual(1);
          } else if (event.period === '2T') {
            expect(event.stoppageMinute).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }

    expect(sawStoppageEvent).toBe(true);
  });
});

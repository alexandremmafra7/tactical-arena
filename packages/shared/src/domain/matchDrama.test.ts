import { describe, it, expect } from 'vitest';
import { buildMatchTimelineMarkers, computeMomentumBlocks, isStoppageTimeClimax, buildMatchNarrativeReplay } from './matchDrama.js';
import { MatchEvent, MatchResult } from './match.js';

describe('matchDrama domain logic', () => {
  const mockEvents: MatchEvent[] = [
    { minute: 12, type: 'goal', team: 'home', playerId: 'p1', description: 'João chuta forte da entrada da área e marca!', xg: 0.35, period: '1T' },
    { minute: 34, type: 'card', team: 'away', playerId: 'p2', description: 'Cartão amarelo para Carlos por falta dura.', period: '1T' },
    { minute: 55, type: 'chance', team: 'away', playerId: 'p3', description: 'Cabeçada defendida pelo goleiro.', xg: 0.42, period: '2T' },
    { minute: 92, type: 'goal', team: 'away', playerId: 'p4', description: 'Empate dramático nos acréscimos!', xg: 0.55, period: '2T', stoppageMinute: 2 },
  ];

  it('builds timeline markers correctly', () => {
    const markers = buildMatchTimelineMarkers(mockEvents);
    expect(markers).toHaveLength(4);
    expect(markers[0].type).toBe('goal');
    expect(markers[0].scorelineAfter).toBe('1x0');
    expect(markers[3].type).toBe('goal');
    expect(markers[3].scorelineAfter).toBe('1x1');
  });

  it('computes momentum blocks', () => {
    const blocks = computeMomentumBlocks(mockEvents);
    expect(blocks.length).toBeGreaterThan(0);
    const block0to15 = blocks.find((b) => b.startMinute === 0);
    expect(block0to15).toBeDefined();
    expect(block0to15?.homeShare).toBeGreaterThan(50);
  });

  it('detects stoppage time climax correctly', () => {
    expect(isStoppageTimeClimax(45, '1T', 0, 0, true)).toBe(false);
    expect(isStoppageTimeClimax(91, '2T', 1, 1, true)).toBe(true); // Empate em mata-mata nos acréscimos (91 > 90)
    expect(isStoppageTimeClimax(92, '2T', 2, 1, false)).toBe(true); // Diferença de 1 gol nos acréscimos
  });

  it('builds narrative replay items', () => {
    const result: MatchResult = {
      homeGoals: 1,
      awayGoals: 1,
      events: mockEvents,
      stats: {
        home: { shots: 10, shotsOnTarget: 4, possession: 50, corners: 3, fouls: 8, pressRecoveries: 2, goalsFromPressRecovery: 0, xg: 1.2, bigChances: 1, saves: 3, woodwork: 0, blockedShots: 2 },
        away: { shots: 8, shotsOnTarget: 3, possession: 50, corners: 2, fouls: 10, pressRecoveries: 1, goalsFromPressRecovery: 0, xg: 1.1, bigChances: 1, saves: 3, woodwork: 0, blockedShots: 1 },
      },
    };
    const replay = buildMatchNarrativeReplay(result, 'Mandante', 'Visitante');
    expect(replay.length).toBeGreaterThan(0);
    expect(replay[0].title).toContain('GOL');
  });
});

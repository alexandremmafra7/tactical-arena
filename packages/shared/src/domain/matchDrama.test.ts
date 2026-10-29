import { describe, it, expect } from 'vitest';
import {
  buildMatchTimelineMarkers,
  computeMomentumBlocks,
  isStoppageTimeClimax,
  buildMatchNarrativeReplay,
  computeLiveMomentumResource,
  getMomentumSkillStatuses,
  computeAssistantSubSuggestions,
  buildHalftimeAssistantBriefing,
  buildQuickPostMatchPressQuestions,
} from './matchDrama.js';
import { MatchEvent, MatchResult } from './match.js';
import { Player } from './player.js';

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
    expect(isStoppageTimeClimax(91, '2T', 1, 1, true)).toBe(true);
    expect(isStoppageTimeClimax(92, '2T', 2, 1, false)).toBe(true);
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

  it('computes live momentum resource with zone gates and cost deduction', () => {
    const stateBefore = computeLiveMomentumResource({
      events: [
        { minute: 14, type: 'goal', team: 'home', playerId: 'p1', description: 'Gol!' },
        { minute: 16, type: 'chance', team: 'home', playerId: 'p2', description: 'Grande chance!', xg: 0.4 },
      ],
      currentMinute: 18,
      mySide: 'home',
      myPossession: 62,
      myShots: 6,
      opponentShots: 1,
      myCorners: 4,
      opponentCorners: 0,
    });

    expect(stateBefore.rawMomentum).toBeGreaterThanOrEqual(60);
    expect(stateBefore.zone).toMatch(/DOMINIO|AVALANCHE/);

    // Spend 40 momentum on Janela de Ouro at minute 18
    const stateAfterSpend = computeLiveMomentumResource({
      events: [
        { minute: 14, type: 'goal', team: 'home', playerId: 'p1', description: 'Gol!' },
        { minute: 16, type: 'chance', team: 'home', playerId: 'p2', description: 'Grande chance!', xg: 0.4 },
      ],
      currentMinute: 18,
      mySide: 'home',
      myPossession: 62,
      myShots: 6,
      opponentShots: 1,
      myCorners: 4,
      opponentCorners: 0,
      spentMomentum: 40,
      lastSpendMinute: 18,
    });

    expect(stateAfterSpend.effectiveMomentum).toBe(stateBefore.rawMomentum - 40);
    expect(stateAfterSpend.remainingDebt).toBe(40);
  });

  it('unlocks momentum skills according to zone thresholds and rival dominance', () => {
    const skillsAt65 = getMomentumSkillStatuses(65, 'JANELA_DE_OURO');
    expect(skillsAt65.find((s) => s.id === 'PRESSIONAR')?.unlocked).toBe(true);
    expect(skillsAt65.find((s) => s.id === 'JANELA_DE_OURO')?.unlocked).toBe(true);
    expect(skillsAt65.find((s) => s.id === 'JANELA_DE_OURO')?.active).toBe(true);
    expect(skillsAt65.find((s) => s.id === 'AVALANCHE_TOTAL')?.unlocked).toBe(false);
    expect(skillsAt65.find((s) => s.id === 'SEGURAR_JOGO')?.unlocked).toBe(false);

    const skillsUnderRivalDomain = getMomentumSkillStatuses(32, null);
    expect(skillsUnderRivalDomain.find((s) => s.id === 'SEGURAR_JOGO')?.unlocked).toBe(true);
  });

  it('prioritizes booked + tired starters in assistant substitution suggestions', () => {
    const starters = [
      { id: 's1', name: 'Bruno Ribeiro', position: 'MID', overall: 80, fatigue: 20 },
      { id: 's2', name: 'Dani Silva', position: 'ATT', overall: 82, fatigue: 30 },
    ] as unknown as Player[];
    const bench = [
      { id: 'b1', name: 'Lucas Mendes', position: 'MID', overall: 78, fatigue: 0 },
      { id: 'b2', name: 'Pedro Rocha', position: 'ATT', overall: 79, fatigue: 0 },
    ] as unknown as Player[];

    const staminaMap = new Map([
      ['s1', 58],
      ['s2', 49],
    ]);
    const ratingMap = new Map([
      ['s1', 6.5],
      ['s2', 6.4],
    ]);

    const suggestions = computeAssistantSubSuggestions({
      starters,
      bench,
      staminaByPlayerId: staminaMap,
      ratingByPlayerId: ratingMap,
      bookedPlayerIds: new Set(['s1']),
      vacatedPlayerIds: new Set(),
      markingStyle: 'BALANCED',
      currentMinute: 62,
    });

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].outPlayerId).toBe('s1');
    expect(suggestions[0].inPlayerId).toBe('b1');
    expect(suggestions[0].reasonCode).toBe('YELLOW_AND_TIRED');
    expect(suggestions[1].outPlayerId).toBe('s2');
    expect(suggestions[1].reasonCode).toBe('CRITICAL_FATIGUE');
  });

  it('builds halftime assistant briefing with 3 direct locker room tones', () => {
    const briefing = buildHalftimeAssistantBriefing({
      myGoals: 0,
      oppGoals: 1,
      myShots: 7,
      oppShots: 3,
      myXg: 1.15,
      oppXg: 0.45,
      myPossession: 60,
      bookedCount: 2,
      exhaustedCount: 1,
    });

    expect(briefing.headline).toContain('0 x 1');
    expect(briefing.tacticalNote).toContain('2 titulares pendurados');
    expect(briefing.choices).toHaveLength(3);
    expect(briefing.choices.map((c) => c.id)).toEqual(['COBRAR', 'APOIAR', 'CALAR']);
    expect(briefing.choices.find((c) => c.id === 'APOIAR')?.recommended).toBe(true);
  });

  it('builds 2 quick post-match press conference questions with morale & board deltas', () => {
    const questions = buildQuickPostMatchPressQuestions({
      myClubName: 'Mafra FC',
      oppClubName: 'Nacional',
      myGoals: 2,
      oppGoals: 1,
      myShots: 11,
      oppShots: 6,
      myPressRecoveries: 6,
      hadSubGoal: true,
    });

    expect(questions).toHaveLength(2);
    expect(questions[0].question).toContain('2 x 1');
    expect(questions[0].options).toHaveLength(3);
    expect(questions[0].options[0].moraleDelta).toBeGreaterThan(0);
    expect(questions[0].options[0].boardDelta).toBeGreaterThan(0);
    expect(questions[1].id).toBe('qp_bench_impact');
  });
});

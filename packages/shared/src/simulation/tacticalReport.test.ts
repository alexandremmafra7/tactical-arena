import { describe, expect, it } from 'vitest';
import type { Match, MatchEvent } from '../domain/match.js';
import type { Tactic } from '../domain/tactic.js';
import type { Player } from '../domain/player.js';
import {
  generateTacticalMatchReport,
  evaluateTeamRolePerformances,
} from './tacticalReport.js';

describe('generateTacticalMatchReport', () => {
  const baseTactic: Tactic = {
    clubId: 'c1',
    formation: '4-3-3',
    mentality: 'attacking',
    attackStyle: 'WINGS',
    markingStyle: 'ZONAL',
    attackApproach: 'TOTAL_ATTACK',
    pressing: 'HIGH_PRESS',
    transitionStyle: 'COUNTERPRESS',
    restDefenceShape: '3+2',
    defensiveLine: 'HIGH',
    lineup: [],
    substitutes: [],
    plannedSubstitutions: [],
  };

  const opponentTactic: Tactic = {
    clubId: 'c2',
    formation: '5-3-2',
    mentality: 'defensive',
    attackStyle: 'BALANCED',
    markingStyle: 'MAN_MARKING',
    attackApproach: 'COUNTER_ATTACK',
    pressing: 'LOW_BLOCK',
    transitionStyle: 'RECOMPOSE',
    restDefenceShape: '2+3',
    defensiveLine: 'DEEP',
    lineup: [],
    substitutes: [],
    plannedSubstitutions: [],
  };

  const createMatch = (
    homeGoals: number,
    awayGoals: number,
    events: MatchEvent[] = [],
    homeStatsOverrides = {},
    awayStatsOverrides = {},
  ): Match => ({
    id: 'm1',
    seed: 'seed1',
    homeClubId: 'c1',
    awayClubId: 'c2',
    status: 'SIMULATED',
    result: {
      homeGoals,
      awayGoals,
      events,
      stats: {
        home: {
          shots: 14,
          shotsOnTarget: 7,
          possession: 60,
          corners: 6,
          fouls: 9,
          pressRecoveries: 5,
          goalsFromPressRecovery: 1,
          xg: 1.8,
          bigChances: 3,
          saves: 2,
          woodwork: 0,
          blockedShots: 2,
          ...homeStatsOverrides,
        },
        away: {
          shots: 4,
          shotsOnTarget: 2,
          possession: 40,
          corners: 2,
          fouls: 6,
          pressRecoveries: 1,
          goalsFromPressRecovery: 0,
          xg: 0.6,
          bigChances: 1,
          saves: 5,
          woodwork: 0,
          blockedShots: 4,
          ...awayStatsOverrides,
        },
      },
    },
  });

  const createDummyPlayer = (
    id: string,
    name: string,
    position: 'GK' | 'DEF' | 'LAT' | 'MID' | 'ATT',
    functions: any[] = [],
  ): Player => ({
    id,
    name,
    position,
    preferredFoot: 'RIGHT',
    age: 26,
    attributes: { pace: 75, finishing: 75, passing: 75, defending: 75, physical: 75, goalkeeping: 75 },
    detailedAttributes: {} as any,
    morale: 80,
    fatigue: 0,
    commitment: 90,
    marketValue: 1000000,
    overall: 78,
    potential: 82,
    starLevel: 'NONE',
    traits: [],
    functions,
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    nationality: 'BRA',
    wage: 20000,
    releaseClause: 5000000,
  });

  it('retorna null se a partida não estiver com status SIMULATED ou sem resultado', () => {
    const unsimulatedMatch: Match = {
      id: 'm1',
      seed: 'seed1',
      homeClubId: 'c1',
      awayClubId: 'c2',
      status: 'WAITING_TACTICS',
    };

    expect(generateTacticalMatchReport(unsimulatedMatch, baseTactic, opponentTactic)).toBeNull();
  });

  it('avalia as 5 dimensões causais com sucesso para ambos os lados', () => {
    const events: MatchEvent[] = [
      { minute: 12, type: 'goal', team: 'home', playerId: 'p1', shotType: 'HEADER', description: 'Gol de cabeça' },
      { minute: 45, type: 'chance', team: 'home', playerId: 'p2', shotType: 'HEADER', description: 'Cabeceio perigoso' },
      { minute: 60, type: 'chance', team: 'home', playerId: 'p3', shotType: 'HEADER', description: 'Cabeceio defendido' },
    ];

    const match = createMatch(3, 0, events, {
      pressRecoveries: 6,
      goalsFromPressRecovery: 2,
      corners: 7,
      xg: 2.2,
    });

    const report = generateTacticalMatchReport(match, baseTactic, opponentTactic, 'Flamengo', 'Palmeiras');
    expect(report).not.toBeNull();
    if (!report) return;

    expect(report.home.teamName).toBe('Flamengo');
    expect(report.away.teamName).toBe('Palmeiras');

    expect(report.home.evaluations).toHaveLength(5);
    expect(report.away.evaluations).toHaveLength(5);

    const dims = report.home.evaluations.map((e) => e.dimension);
    expect(dims).toEqual(['PRESSING', 'DEFENSIVE_LINE', 'ATTACK_STYLE', 'TRANSITIONS', 'EFFICIENCY']);

    const pressing = report.home.evaluations.find((e) => e.dimension === 'PRESSING')!;
    expect(pressing.status).toBe('POSITIVE');
    expect(pressing.causalExplanation).toContain('High Press sufocou a saída');

    const attackStyle = report.home.evaluations.find((e) => e.dimension === 'ATTACK_STYLE')!;
    expect(attackStyle.status).toBe('POSITIVE');
    expect(attackStyle.metricLabel).toContain('7 escanteios, 3 finalizações aéreas');

    const efficiency = report.home.evaluations.find((e) => e.dimension === 'EFFICIENCY')!;
    expect(efficiency.status).toBe('POSITIVE');
    expect(efficiency.metricLabel).toBe('3 gols vs 2.20 xG');

    expect(report.home.overallVerdict).toContain('4-3-3');
    expect(report.home.overallVerdict).toContain('pressionar e agredir ofensivamente');
  });

  it('avalia situações críticas de linha alta com bolas nas costas (ONE_ON_ONE)', () => {
    const events: MatchEvent[] = [
      { minute: 15, type: 'chance', team: 'away', playerId: 'p5', shotType: 'ONE_ON_ONE', description: 'Cara a cara' },
      { minute: 70, type: 'goal', team: 'away', playerId: 'p5', shotType: 'ONE_ON_ONE', description: 'Gol cara a cara' },
    ];

    const match = createMatch(1, 2, events, {}, {});
    const report = generateTacticalMatchReport(match, baseTactic, opponentTactic, 'Time A', 'Time B');

    expect(report).not.toBeNull();
    if (!report) return;

    const defLine = report.home.evaluations.find((e) => e.dimension === 'DEFENSIVE_LINE')!;
    expect(defLine.status).toBe('CRITICAL');
    expect(defLine.metricLabel).toBe('2 cara-a-cara sofridos');
    expect(defLine.causalExplanation).toContain('Zagueiros jogaram muito adiantados');
  });

  it('avalia eficácia de bloco baixo com disciplina defensiva', () => {
    const match = createMatch(0, 0, [], {}, { fouls: 5, blockedShots: 4, shots: 6, shotsOnTarget: 1 });
    const report = generateTacticalMatchReport(match, baseTactic, opponentTactic, 'Time A', 'Time B');

    expect(report).not.toBeNull();
    if (!report) return;

    const awayPressing = report.away.evaluations.find((e) => e.dimension === 'PRESSING')!;
    expect(awayPressing.status).toBe('POSITIVE');
    expect(awayPressing.title).toBe('Bloco Baixo');
    expect(awayPressing.causalExplanation).toContain('A escolha por Bloco Baixo tirou toda a profundidade');
  });

  it('avalia o desempenho de papéis táticos (PlayerRolePerformance) com titulares', () => {
    const gk = createDummyPlayer('p_gk', 'Rossi', 'GK');
    const lat = createDummyPlayer('p_lat', 'Ayrton Lucas', 'LAT', ['ALA_OFENSIVO']);
    const def = createDummyPlayer('p_def', 'Fabrício Bruno', 'DEF', ['ZAGUEIRO_REBATEDOR']);
    const vol = createDummyPlayer('p_vol', 'Pulgar', 'MID', ['VOLANTE_CAO_DE_GUARDA']);
    const mei = createDummyPlayer('p_mei', 'Arrascaeta', 'MID', ['MEIA_ARMADOR']);
    const att = createDummyPlayer('p_att', 'Pedro', 'ATT', ['CENTROAVANTE_REFERENCIA']);

    const starters = [gk, lat, def, vol, mei, att];

    const events: MatchEvent[] = [
      {
        minute: 20,
        type: 'goal',
        team: 'home',
        playerId: 'p_att',
        shotType: 'HEADER',
        assistPlayerId: 'p_lat',
        assistPlayerName: 'Ayrton Lucas',
        description: 'Pedro marca de cabeça após cruzamento de Ayrton Lucas',
      },
      {
        minute: 40,
        type: 'chance',
        team: 'home',
        playerId: 'p_att',
        shotType: 'HEADER',
        description: 'Pedro cabeceia rente à trave',
      },
    ];

    const match = createMatch(2, 0, events, { saves: 3, corners: 5, pressRecoveries: 6 });
    const ratings = [
      { playerId: 'p_gk', name: 'Rossi', position: 'GK' as const, rating: 7.2 },
      { playerId: 'p_lat', name: 'Ayrton Lucas', position: 'LAT' as const, rating: 7.6 },
      { playerId: 'p_def', name: 'Fabrício Bruno', position: 'DEF' as const, rating: 7.0 },
      { playerId: 'p_vol', name: 'Pulgar', position: 'MID' as const, rating: 7.1 },
      { playerId: 'p_mei', name: 'Arrascaeta', position: 'MID' as const, rating: 6.9 },
      { playerId: 'p_att', name: 'Pedro', position: 'ATT' as const, rating: 8.3 },
    ];

    const roleReport = evaluateTeamRolePerformances(
      starters,
      baseTactic,
      'home',
      match,
      'Flamengo',
      'c1',
      ratings,
    );

    expect(roleReport.teamName).toBe('Flamengo');
    expect(roleReport.starters).toHaveLength(6);

    const strikerPerf = roleReport.starters.find((p) => p.playerId === 'p_att')!;
    expect(strikerPerf.role).toBe('CENTROAVANTE_REFERENCIA');
    expect(strikerPerf.roleName).toContain('Referência');
    expect(strikerPerf.tacticalVerdict).toBe('EXCELENTE');
    expect(strikerPerf.goals).toBe(1);
    expect(strikerPerf.keyStat).toContain('1 gol');
    expect(strikerPerf.keyStat).toContain('de cabeça');
    expect(strikerPerf.explanation).toContain('pivô e finalizador de área');

    const wingPerf = roleReport.starters.find((p) => p.playerId === 'p_lat')!;
    expect(wingPerf.role).toBe('ALA_OFENSIVO');
    expect(wingPerf.assists).toBe(1);
    expect(wingPerf.keyStat).toContain('1 assist.');
    expect(wingPerf.explanation).toContain('amplitude pelo flanco');

    const gkPerf = roleReport.starters.find((p) => p.playerId === 'p_gk')!;
    expect(gkPerf.role).toBe('GOLEIRO');
    expect(gkPerf.keyStat).toContain('3 defesas');
    expect(gkPerf.explanation).toContain('Paredão sob as traves');

    expect(roleReport.tacticalHighlights.length).toBeGreaterThan(0);
    expect(roleReport.tacticalHighlights[0]).toContain('Pedro');
  });

  it('integra rolePerformances dentro de generateTacticalMatchReport quando elencos são fornecidos', () => {
    const homePlayer = createDummyPlayer('h1', 'Gabi', 'ATT', ['CENTROAVANTE']);
    const awayPlayer = createDummyPlayer('a1', 'Veiga', 'MID', ['MEIA_ARMADOR']);

    const match = createMatch(1, 0, [
      { minute: 50, type: 'goal', team: 'home', playerId: 'h1', description: 'Gol' },
    ]);

    const report = generateTacticalMatchReport(
      match,
      baseTactic,
      opponentTactic,
      'Flamengo',
      'Palmeiras',
      [homePlayer],
      [awayPlayer],
      {
        home: [{ playerId: 'h1', name: 'Gabi', position: 'ATT', rating: 7.9 }],
        away: [{ playerId: 'a1', name: 'Veiga', position: 'MID', rating: 6.0 }],
      },
    );

    expect(report).not.toBeNull();
    expect(report?.rolePerformances).toBeDefined();
    expect(report?.rolePerformances?.home.starters[0].name).toBe('Gabi');
    expect(report?.rolePerformances?.home.starters[0].tacticalVerdict).toBe('EXCELENTE');
    expect(report?.rolePerformances?.away.starters[0].name).toBe('Veiga');
  });
});

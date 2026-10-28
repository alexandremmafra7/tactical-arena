import { describe, expect, it } from 'vitest';
import type { Club } from './club.js';
import type { Match, MatchEvent } from './match.js';
import type { Tactic } from './tactic.js';
import {
  generateCausalPressConferenceQuestions,
  calculatePressConferenceImpact,
  type PressConferenceContext,
} from './pressConference.js';

describe('Causal Press Conference System', () => {
  const dummyClub = (id: string, name: string): Club => ({
    id,
    name,
    ownerId: 'user1',
    slug: name.toLowerCase(),
    country: 'BRA',
    players: [],
    academyPlayers: [],
    budget: 10000000,
    captainPlayerId: null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: 1,
    stadiumCapacity: 70000,
    stadiumConstruction: null,
    titlesWon: 0,
    loans: [],
    sponsorships: [],
    pendingTransferPayments: [],
    pendingRoundTactic: null,
  });

  const dummyTactic: Tactic = {
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
    lineup: [{ playerId: 'p1' }, { playerId: 'p2' }],
    substitutes: [{ playerId: 'p_sub' }],
    plannedSubstitutions: [],
  };

  const createMatch = (
    homeGoals: number,
    awayGoals: number,
    events: MatchEvent[] = [],
    homeStatsOverrides = {},
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
          shots: 12,
          shotsOnTarget: 6,
          possession: 58,
          corners: 7,
          fouls: 8,
          pressRecoveries: 6,
          goalsFromPressRecovery: 1,
          xg: 1.9,
          bigChances: 3,
          saves: 3,
          woodwork: 0,
          blockedShots: 2,
          ...homeStatsOverrides,
        },
        away: {
          shots: 5,
          shotsOnTarget: 2,
          possession: 42,
          corners: 3,
          fouls: 10,
          pressRecoveries: 2,
          goalsFromPressRecovery: 0,
          xg: 0.7,
          bigChances: 1,
          saves: 4,
          woodwork: 0,
          blockedShots: 3,
        },
      },
    },
  });

  it('gera perguntas de PRESSÃO ALTA quando time recupera >= 5 bolas no ataque', () => {
    const match = createMatch(2, 0, [], { pressRecoveries: 6, goalsFromPressRecovery: 1 });
    const userClub = dummyClub('c1', 'Flamengo');
    const oppClub = dummyClub('c2', 'Fluminense');

    const questions = generateCausalPressConferenceQuestions(match, userClub, oppClub, dummyTactic);

    expect(questions.length).toBeGreaterThanOrEqual(2);
    const pressingQ = questions.find((q) => q.category === 'PRESSING');
    expect(pressingQ).toBeDefined();
    expect(pressingQ?.question).toContain('pressão sufocante');
    expect(pressingQ?.question).toContain('6 recuperações');
    expect(pressingQ?.mediaOutlet).toBe('ESPN Brasil');
    expect(pressingQ?.answers).toHaveLength(4);

    const shieldAns = pressingQ?.answers?.find((a) => a.stance === 'SHIELD_TEAM');
    expect(shieldAns?.label).toContain('Blindar o Elenco');
    expect(shieldAns?.impact.boardConfidenceDelta).toBe(4);
    expect(shieldAns?.impact.squadCohesionDelta).toBe(8);
    expect(shieldAns?.impact.fanPressureDelta).toBe(-6);
  });

  it('gera pergunta de LINHA ALTA quando zaga joga adiantada e cede bolas nas costas', () => {
    const events: MatchEvent[] = [
      { minute: 30, type: 'chance', team: 'away', playerId: 'opp1', shotType: 'ONE_ON_ONE', description: 'Cara a cara' },
    ];
    const match = createMatch(1, 1, events);
    const userClub = dummyClub('c1', 'Flamengo');
    const oppClub = dummyClub('c2', 'Vasco');

    const questions = generateCausalPressConferenceQuestions(match, userClub, oppClub, dummyTactic);

    const defLineQ = questions.find((q) => q.category === 'DEFENSIVE_LINE');
    expect(defLineQ).toBeDefined();
    expect(defLineQ?.question).toContain('linha de zaga jogou muito adiantada');
    expect(defLineQ?.reporterName).toBe('Eric Faria');
    expect(defLineQ?.mediaOutlet).toBe('Globo Esporte');
  });

  it('gera pergunta de WINGS_SYNERGY quando estilo de ataque é WINGS e tem escanteios', () => {
    const match = createMatch(2, 1, [], { corners: 8 });
    const userClub = dummyClub('c1', 'Flamengo');
    const oppClub = dummyClub('c2', 'Botafogo');

    const questions = generateCausalPressConferenceQuestions(match, userClub, oppClub, dummyTactic);

    const wingsQ = questions.find((q) => q.category === 'WINGS_SYNERGY');
    expect(wingsQ).toBeDefined();
    expect(wingsQ?.question).toContain('corredores laterais');
    expect(wingsQ?.question).toContain('8 escanteios');
  });

  it('gera pergunta de DEDO DO TREINADOR quando substituto marca gol', () => {
    const userClub = dummyClub('c1', 'Flamengo');
    userClub.players = [
      {
        id: 'p_sub',
        name: 'Gabigol',
        position: 'ATT',
        preferredFoot: 'LEFT',
        age: 28,
        attributes: { pace: 80, finishing: 84, passing: 72, defending: 35, physical: 78, goalkeeping: 10 },
        detailedAttributes: {} as any,
        morale: 80,
        fatigue: 0,
        commitment: 90,
        marketValue: 15000000,
        overall: 82,
        potential: 82,
        starLevel: 'NONE',
        traits: [],
        functions: ['CENTROAVANTE'],
        developmentPoints: 0,
        trainingFocus: null,
        suspensions: [],
        injuryWeeks: 0,
        nationality: 'BRA',
        wage: 50000,
        releaseClause: 30000000,
      },
    ];

    const events: MatchEvent[] = [
      {
        minute: 75,
        type: 'goal',
        team: 'home',
        playerId: 'p_sub',
        description: 'Gol de Gabigol',
      },
    ];
    const match = createMatch(1, 0, events);
    const oppClub = dummyClub('c2', 'Corinthians');

    const questions = generateCausalPressConferenceQuestions(match, userClub, oppClub, dummyTactic);

    const subQ = questions.find((q) => q.category === 'SUBSTITUTION');
    expect(subQ).toBeDefined();
    expect(subQ?.question).toContain('Gabigol');
    expect(subQ?.question).toContain('dedo do treinador');
  });

  it('gera pergunta de DISCIPLINA & PÊNALTIS em caso de expulsão ou pênaltis', () => {
    const events: MatchEvent[] = [
      { minute: 40, type: 'card', team: 'home', playerId: 'p1', suspensionMatches: 1, description: 'Cartão vermelho' },
    ];
    const match = createMatch(0, 1, events);
    const userClub = dummyClub('c1', 'Flamengo');
    const oppClub = dummyClub('c2', 'Palmeiras');

    const questions = generateCausalPressConferenceQuestions(match, userClub, oppClub, dummyTactic);

    const discQ = questions.find((q) => q.category === 'DISCIPLINE_PENALTY');
    expect(discQ).toBeDefined();
    expect(discQ?.question).toContain('expulsão');
  });

  it('calcula os impactos matemáticos reais nos 3 pilares conforme a postura adotada', () => {
    const context: PressConferenceContext = {
      type: 'REGULAR',
      trigger: { matchResult: 'W', opponent: 'Palmeiras', position: 1 },
      totalQuestions: 2,
      mandatoryQuestionCount: 2,
      customQuestionsReplaced: 0,
      selectedQuestions: ['q1'],
    };

    const shieldImpact = calculatePressConferenceImpact(
      [{ questionId: 'q1', optionId: 'q1_SHIELD_TEAM' }],
      context,
    );
    expect(shieldImpact.boardConfidenceDelta).toBe(4);
    expect(shieldImpact.squadCohesionDelta).toBe(8);
    expect(shieldImpact.fanPressureDelta).toBe(-6);

    const tacticImpact = calculatePressConferenceImpact(
      [{ questionId: 'q1', optionId: 'q1_PRAISE_TACTIC' }],
      context,
    );
    expect(tacticImpact.boardConfidenceDelta).toBe(8);
    expect(tacticImpact.squadCohesionDelta).toBe(4);
    expect(tacticImpact.fanPressureDelta).toBe(-8);

    const demandImpact = calculatePressConferenceImpact(
      [{ questionId: 'q1', optionId: 'q1_DEMAND_EFFORT' }],
      context,
    );
    expect(demandImpact.boardConfidenceDelta).toBe(3);
    expect(demandImpact.squadCohesionDelta).toBe(-5);
    expect(demandImpact.fanPressureDelta).toBe(6);
  });

  it('permite delegação ao auxiliar técnico com resposta neutra e sem travar gameplay', () => {
    const context: PressConferenceContext = {
      type: 'REGULAR',
      trigger: { matchResult: 'D', opponent: 'Santos', position: 5 },
      totalQuestions: 2,
      mandatoryQuestionCount: 2,
      customQuestionsReplaced: 0,
      selectedQuestions: ['q1'],
    };

    const delegatedImpact = calculatePressConferenceImpact(
      [],
      context,
      { type: 'ASSISTANT', assistantName: 'Auxiliar Técnico', moveTime: 0 },
    );

    expect(delegatedImpact.boardConfidenceDelta).toBe(2);
    expect(delegatedImpact.squadCohesionDelta).toBe(1);
    expect(delegatedImpact.fanPressureDelta).toBe(-2);
    expect(delegatedImpact.breakdown.boardConfidence).toContain('Auxiliar técnico');
  });
});

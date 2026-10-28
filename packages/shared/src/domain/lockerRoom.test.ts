import { describe, expect, it } from 'vitest';
import type { Player } from './player.js';
import { makePlayer } from '../simulation/testFactories.js';
import {
  applyTeamTalk,
  calculateSquadCohesion,
  computeLeadershipScore,
  computeLockerRoomHierarchy,
  computeSocialGroupsSummary,
  evaluateSquadHappinessTick,
  getAvailableTeamTalks,
  getRecommendedTeamTalk,
  generateLockerRoomEvents,
  resolvePlayerConcernWithLeader,
  updateLockerRoom,
} from './lockerRoom.js';

const player = (id: string, overrides: Partial<Player> = {}) => makePlayer(id, {
  age: 24,
  overall: 60,
  morale: 70,
  commitment: 70,
  nationality: 'BRA',
  traits: [],
  ...overrides,
});

describe('computeLeadershipScore', () => {
  it('applies tenure, overall, age, personality and captain weights exactly', () => {
    const captain = player('captain', { age: 30, overall: 80, traits: ['LEADER'] });
    expect(computeLeadershipScore(captain, 20, true)).toBe(102);
  });

  it('supports DETERMINED and the 25-year age band', () => {
    expect(computeLeadershipScore(player('d', { age: 25, overall: 70, traits: ['DETERMINED'] }), 8, false)).toBe(50);
  });
});

describe('computeLockerRoomHierarchy', () => {
  it('assigns at most two leaders and positions 3-5 as highly influential', () => {
    const squad = [
      player('a', { age: 31, overall: 85, traits: ['LEADER'] }),
      player('b', { age: 30, overall: 84, traits: ['LEADER'] }),
      player('c', { overall: 80 }), player('d', { overall: 79 }), player('e', { overall: 78 }),
      player('f', { overall: 60 }), player('g', { age: 18, overall: 40 }),
    ];
    const state = computeLockerRoomHierarchy(squad, { a: 120, b: 100 }, 'a');
    expect(state.hierarchy.map(({ playerId, tier }) => [playerId, tier])).toEqual([
      ['a', 'TEAM_LEADER'], ['b', 'TEAM_LEADER'],
      ['c', 'HIGHLY_INFLUENTIAL'], ['d', 'HIGHLY_INFLUENTIAL'], ['e', 'HIGHLY_INFLUENTIAL'],
      ['f', 'GENERAL_SQUAD'], ['g', 'GENERAL_SQUAD'],
    ]);
  });

  it('uses deterministic social groups and happiness concerns', () => {
    const state = computeLockerRoomHierarchy([
      player('veteran', { age: 30, nationality: 'BRA' }),
      player('academy', { age: 20, nationality: 'BRA' }),
      player('foreign', { age: 24, nationality: 'ARG', commitment: 40 }),
      player('general', { age: 24, nationality: 'BRA' }),
    ]);
    expect(Object.fromEntries(state.hierarchy.map((entry) => [entry.playerId, entry.socialGroup]))).toEqual({
      veteran: 'CORE_VETERANS',
      academy: 'ACADEMY_PROSPECTS',
      foreign: 'FOREIGN_PLAYERS',
      general: 'GENERAL_GROUP',
    });
    expect(state.hierarchy.find((entry) => entry.playerId === 'foreign')).toEqual(expect.objectContaining({
      happiness: 55,
      concern: 'Insatisfeito com poucos minutos em campo',
    }));
  });
});

describe('calculateSquadCohesion', () => {
  it('uses only five recent results and clamps to 10-100', () => {
    const squad = [player('leader', { age: 31, overall: 90, morale: 30, commitment: 30, traits: ['LEADER'] })];
    expect(calculateSquadCohesion(squad, ['W', 'W', 'L', 'D', 'W', 'W'], 1)).toBe(67);
    expect(calculateSquadCohesion(squad, Array(30).fill('L') as ('L')[], 30)).toBe(10);
  });

  it('weights manager support and derives atmosphere', () => {
    const state = computeLockerRoomHierarchy([
      player('leader', { age: 31, overall: 90, morale: 100, commitment: 100, traits: ['LEADER'] }),
      player('high', { overall: 80, morale: 50, commitment: 50 }),
      player('rest', { overall: 50, morale: 0, commitment: 0 }),
    ], { leader: 100 }, 'leader');
    expect(state.managerSupport).toBeGreaterThanOrEqual(60);
    expect(['GOOD', 'NORMAL']).toContain(state.atmosphere);
  });
});

describe('team talks', () => {
  const squad = [
    player('leader', { age: 30, morale: 70, commitment: 70, traits: ['LEADER'] }),
    player('young', { age: 20, morale: 40 }),
    player('plain'),
  ];

  it('returns stable options for every context', () => {
    expect(getAvailableTeamTalks('HALF_TIME', -1, true).map((option) => option.id)).toEqual([
      'HALF_TIME:CALM', 'HALF_TIME:PASSIONATE', 'HALF_TIME:DEMANDING', 'HALF_TIME:ENCOURAGING',
    ]);
  });

  it.each([
    ['PASSIONATE', { leader: 8, young: 4, plain: 4 }],
    ['CALM', { leader: 2, young: 6, plain: 2 }],
    ['ENCOURAGING', { leader: 8, young: 8, plain: 8 }],
  ] as const)('applies %s exactly', (tone, expected) => {
    const option = getAvailableTeamTalks('HALF_TIME', -1, false).find((candidate) => candidate.tone === tone)!;
    expect(applyTeamTalk(squad, option, 'HALF_TIME', -1, () => 0).moraleModifiers).toEqual(expected);
  });

  it('makes demanding rebound when support is below 50', () => {
    const lowSupport = squad.map((candidate) => ({ ...candidate, commitment: 30 }));
    const option = getAvailableTeamTalks('PRE_MATCH', 1, false).find((candidate) => candidate.tone === 'DEMANDING')!;
    expect(new Set(Object.values(applyTeamTalk(lowSupport, option, 'PRE_MATCH', 1, () => 0.9).moraleModifiers))).toEqual(new Set([-6]));
  });

  it('rejects an option from another context and consumes one RNG value', () => {
    const option = getAvailableTeamTalks('PRE_MATCH', 0, false)[0];
    expect(() => applyTeamTalk(squad, option, 'HALF_TIME', 0, () => 0)).toThrow('Preleção inválida para este contexto');

    let calls = 0;
    applyTeamTalk(squad, option, 'PRE_MATCH', 0, () => { calls += 1; return 0; });
    expect(calls).toBe(1);
  });

  it('selects balanced recommended talk for assistant automatic delegation', () => {
    // Normal pre-match defaults to encouraging
    expect(getRecommendedTeamTalk('PRE_MATCH', 0, false).tone).toBe('ENCOURAGING');

    // High pressure / derby defaults to calm
    expect(getRecommendedTeamTalk('PRE_MATCH', 0, true).tone).toBe('CALM');

    // Half-time when trailing defaults to encouraging
    expect(getRecommendedTeamTalk('HALF_TIME', -1, false).tone).toBe('ENCOURAGING');

    // Half-time when leading defaults to calm
    expect(getRecommendedTeamTalk('HALF_TIME', 2, false).tone).toBe('CALM');
  });
});

describe('evaluateSquadHappinessTick', () => {
  it('penalizes missing appearances, emits elite concern and keeps input immutable', () => {
    const squad = [player('star', { overall: 82, morale: 52, commitment: 52 }), player('used')];
    const result = evaluateSquadHappinessTick(squad, { star: 0, used: 2 });
    expect(result.updatedSquad[0]).toEqual(expect.objectContaining({ morale: 46, commitment: 46 }));
    expect(result.incidents[0]).toContain('Player star');
    expect(squad[0].morale).toBe(52);
  });
});

describe('Liderança e Grito de Guerra (Tarefa 3.4)', () => {
  it('dispara LEADERSHIP_RALLY mitigando crise quando o elenco tem um líder com trait LEADER', () => {
    const squadWithLeader = [
      player('leader', { age: 31, overall: 85, traits: ['LEADER'], name: 'Capitão Silva' }),
      player('p1', { overall: 70 }),
      player('p2', { overall: 72 }),
    ];

    const events = generateLockerRoomEvents(
      squadWithLeader,
      ['L', 'L', 'L'], // Seqüência ruim de 3 derrotas (recentFormScore = -3)
      {},
      [],
      [],
      () => 0.5,
      1000,
    );

    const rallyEvent = events.find((e) => e.type === 'LEADERSHIP_RALLY');
    expect(rallyEvent).toBeDefined();
    expect(rallyEvent?.description).toContain('Capitão Silva reuniu o elenco em um grito de guerra');
    expect(rallyEvent?.impact.moraleChange).toBe(-5); // Amortecido (em vez de -15)
    expect(rallyEvent?.impact.cohesionChange).toBe(6); // Gera reação de união positiva
  });

  it('dispara LEADERSHIP_CONFLICT com penalidade severa quando não há nenhum líder no elenco', () => {
    const squadWithoutLeader = [
      player('p1', { overall: 70, traits: [] }),
      player('p2', { overall: 72, traits: [] }),
      player('p3', { overall: 71, traits: [] }),
    ];

    const events = generateLockerRoomEvents(
      squadWithoutLeader,
      ['L', 'L', 'L'],
      {},
      [],
      [],
      () => 0.5,
      1000,
    );

    const conflictEvent = events.find((e) => e.type === 'LEADERSHIP_CONFLICT');
    expect(conflictEvent).toBeDefined();
    expect(conflictEvent?.impact.moraleChange).toBe(-15);
    expect(conflictEvent?.impact.cohesionChange).toBe(-12);
  });

  it('updateLockerRoom aplica LEADERSHIP_RALLY e preserva atmosfera com capitão líder', () => {
    const squad = [
      player('captain', { age: 30, overall: 80, name: 'Zagueiro Líder' }),
      player('p1', { overall: 75 }),
      player('p2', { overall: 74 }),
    ];

    // Passa 'captain' como captainId
    const updatedState = updateLockerRoom(
      squad,
      { captain: 80 },
      'captain',
      ['L', 'L', 'L'],
      {},
      [],
      [],
      () => 0.5,
      1000,
    );

    expect(updatedState.recentIncidents.some((i) => i.includes('grito de guerra'))).toBe(true);
  });
});

describe('computeSocialGroupsSummary (Passo 9)', () => {
  it('agrupa corretamente veteranos, jovens, estrangeiros e grupo geral com estatísticas', () => {
    const squad = [
      player('vet1', { age: 32, morale: 80, commitment: 80, nationality: 'BRA' }),
      player('vet2', { age: 30, morale: 60, commitment: 60, nationality: 'BRA' }),
      player('young1', { age: 19, morale: 90, commitment: 90, nationality: 'BRA' }),
      player('foreign1', { age: 26, morale: 40, commitment: 30, nationality: 'ARG' }), // insatisfeito (commitment < 50)
      player('general1', { age: 25, morale: 70, commitment: 70, nationality: 'BRA' }),
    ];

    const state = computeLockerRoomHierarchy(squad);
    const summary = computeSocialGroupsSummary(state.hierarchy);

    expect(summary).toHaveLength(4);

    const veterans = summary.find((s) => s.group === 'CORE_VETERANS');
    const prospects = summary.find((s) => s.group === 'ACADEMY_PROSPECTS');
    const foreigners = summary.find((s) => s.group === 'FOREIGN_PLAYERS');
    const general = summary.find((s) => s.group === 'GENERAL_GROUP');

    expect(veterans).toBeDefined();
    expect(veterans?.label).toBe('Núcleo de Veteranos');
    expect(veterans?.members.map((m) => m.playerId).sort()).toEqual(['vet1', 'vet2']);
    expect(veterans?.averageHappiness).toBe(70); // (80 + 60) / 2
    expect(veterans?.unsatisfiedCount).toBe(0);

    expect(prospects?.members.map((m) => m.playerId)).toEqual(['young1']);
    expect(prospects?.averageHappiness).toBe(90);

    expect(foreigners?.members.map((m) => m.playerId)).toEqual(['foreign1']);
    expect(foreigners?.unsatisfiedCount).toBe(1); // commitment 30 gera concern

    expect(general?.members.map((m) => m.playerId)).toEqual(['general1']);
  });
});

describe('resolvePlayerConcernWithLeader (Passo 9)', () => {
  const leaderPlayer = player('captain', {
    age: 32,
    overall: 82,
    traits: ['LEADER'],
    name: 'Capitão Carlos',
    morale: 85,
    commitment: 90,
  });

  const unhappyPlayer = player('unhappy', {
    age: 24,
    overall: 78,
    name: 'Atacante Revoltado',
    morale: 40,
    commitment: 35, // concern ativo
  });

  const squad = [leaderPlayer, unhappyPlayer];

  it('CAPTAIN_MEDIATION: capitão líder resolve insatisfação e eleva moral e compromisso', () => {
    const result = resolvePlayerConcernWithLeader(
      squad,
      'unhappy',
      'captain',
      'CAPTAIN_MEDIATION',
    );

    expect(result.success).toBe(true);
    expect(result.resolvedConcern).toBe(true);
    expect(result.moraleChange).toBe(10);
    expect(result.commitmentChange).toBe(15);
    expect(result.message).toContain('Capitão Carlos reuniu-se reservadamente com Atacante Revoltado');

    const updatedUnhappy = result.updatedSquad.find((p) => p.id === 'unhappy');
    expect(updatedUnhappy?.morale).toBe(50);
    expect(updatedUnhappy?.commitment).toBeGreaterThanOrEqual(50);

    // Garante imutabilidade do array original
    expect(squad[1].commitment).toBe(35);
  });

  it('DIPLOMATIC: conversa da comissão técnica promete oportunidades futuras', () => {
    const result = resolvePlayerConcernWithLeader(
      squad,
      'unhappy',
      'captain',
      'DIPLOMATIC',
    );

    expect(result.success).toBe(true);
    expect(result.resolvedConcern).toBe(true);
    expect(result.moraleChange).toBe(8);
    expect(result.commitmentChange).toBe(12);
    expect(result.message).toContain('conversa diplomática');

    const updatedUnhappy = result.updatedSquad.find((p) => p.id === 'unhappy');
    expect(updatedUnhappy?.morale).toBe(48);
  });

  it('DEMAND_COMMITMENT: com líder forte cobra postura profissional com sucesso', () => {
    const result = resolvePlayerConcernWithLeader(
      squad,
      'unhappy',
      'captain',
      'DEMAND_COMMITMENT',
    );

    expect(result.success).toBe(true);
    expect(result.commitmentChange).toBe(15);
    expect(result.message).toContain('cobrança por postura profissional surtiu efeito');
  });

  it('DEMAND_COMMITMENT: sem liderança forte pode gerar atrito', () => {
    const weakLeader = player('weak', { overall: 60, traits: [], age: 22, name: 'Líder Inexperiente' });
    const weakSquad = [weakLeader, unhappyPlayer];

    const result = resolvePlayerConcernWithLeader(
      weakSquad,
      'unhappy',
      'weak',
      'DEMAND_COMMITMENT',
    );

    expect(result.success).toBe(false);
    expect(result.moraleChange).toBe(-10);
    expect(result.commitmentChange).toBe(-5);
    expect(result.message).toContain('gerou atrito');
  });

  it('retorna erro amigável se o jogador alvo não for encontrado', () => {
    const result = resolvePlayerConcernWithLeader(
      squad,
      'inexistente',
      'captain',
      'CAPTAIN_MEDIATION',
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('não encontrado');
  });
});

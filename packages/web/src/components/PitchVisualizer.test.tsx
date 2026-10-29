import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MatchEvent, Player, Tactic } from '@tactical-arena/shared';
import { PitchVisualizer } from './PitchVisualizer.js';

describe('PitchVisualizer Component', () => {
  const mockHomeClub = { id: 'club-home', name: 'Flamengo', slug: 'flamengo' };
  const mockAwayClub = { id: 'club-away', name: 'Vasco', slug: 'vasco' };

  /**
   * A tática do teste, escrita contra os tipos que existem.
   *
   * O mock original usava valores inventados — 'mixed', 'zonal', 'WING_PLAY', 'MID_BLOCK' — e a escalação
   * como lista de ids soltos. `LineupSlot` é objeto, e cada enum tem os seus valores próprios; nada disto
   * era aceito pelo compilador, e só não quebrava os testes porque o vitest não checa tipos.
   */
  const defaultTactic: Tactic = {
    clubId: 'club-home',
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'BALANCED',
    markingStyle: 'ZONAL',
    attackApproach: 'BALANCED',
    pressing: 'MEDIUM',
    lineup: Array.from({ length: 11 }, (_, i) => ({ playerId: `p${i + 1}` })),
    substitutes: [],
    plannedSubstitutions: [],
  };

  it('renders SVG pitch markings and 3 zone labels', () => {
    const html = renderToStaticMarkup(
      <PitchVisualizer
        homeClub={mockHomeClub}
        awayClub={mockAwayClub}
        homeTactic={defaultTactic}
        awayTactic={defaultTactic}
        mySide="home"
        events={[]}
        currentMinute={15}
        momentum={65}
        isPaused={false}
        homeGoals={0}
        awayGoals={0}
      />
    );

    expect(html).toContain('pitch-visualizer-svg');
    expect(html).toContain('pitch-center-circle');
    expect(html).toContain('Defesa');
    expect(html).toContain('Meio');
    expect(html).toContain('Ataque');
  });

  it('renders player nodes for both teams according to formation', () => {
    const html = renderToStaticMarkup(
      <PitchVisualizer
        homeClub={mockHomeClub}
        awayClub={mockAwayClub}
        homeTactic={defaultTactic}
        awayTactic={defaultTactic}
        mySide="home"
        events={[]}
        currentMinute={30}
        momentum={50}
        isPaused={false}
        homeGoals={1}
        awayGoals={0}
      />
    );

    expect(html).toContain('pitch-player-home');
    expect(html).toContain('pitch-player-away');
    expect(html).toContain('pitch-ball-node');
  });

  it('displays action banner with recent dramatic event', () => {
    const events: MatchEvent[] = [
      {
        minute: 22,
        type: 'goal',
        team: 'home',
        playerId: 'p10',
        description: 'Gol de Gabigol!',
        shotOutcome: 'goal',
        shotType: 'BOX_SHOT',
      },
    ];

    const html = renderToStaticMarkup(
      <PitchVisualizer
        homeClub={mockHomeClub}
        awayClub={mockAwayClub}
        homeTactic={defaultTactic}
        awayTactic={defaultTactic}
        mySide="home"
        events={events}
        currentMinute={22}
        momentum={70}
        isPaused={false}
        homeGoals={1}
        awayGoals={0}
      />
    );

    expect(html).toContain('Gol de Gabigol!');
    expect(html).toContain('pitch-event-goal');
  });

  it('displays woodwork or save event highlight correctly', () => {
    const events: MatchEvent[] = [
      {
        minute: 40,
        type: 'chance',
        team: 'away',
        playerId: 'p9',
        description: 'Na trave! Finalização de Vegetti carimba o poste!',
        shotOutcome: 'woodwork',
        shotType: 'HEADER',
      },
    ];

    const html = renderToStaticMarkup(
      <PitchVisualizer
        homeClub={mockHomeClub}
        awayClub={mockAwayClub}
        homeTactic={defaultTactic}
        awayTactic={defaultTactic}
        mySide="home"
        events={events}
        currentMinute={40}
        momentum={30}
        isPaused={false}
        homeGoals={0}
        awayGoals={0}
      />
    );

    expect(html).toContain('Na trave!');
    expect(html).toContain('pitch-event-woodwork');
  });

  it('renders player surnames, live ratings, yellow card badge, and golden window highlight when squad is provided', () => {
    const mockPlayers = Array.from({ length: 11 }, (_, i) => ({
      id: `p${i + 1}`,
      name: i === 9 ? 'Giorgian Arrascaeta' : `Jogador ${i + 1}`,
      age: 26,
      nationality: 'URU',
      position: i === 0 ? ('GK' as const) : ('MID' as const),
      overall: 85,
      potential: 88,
      attributes: { pace: 80, finishing: 82, passing: 86, defending: 60, physical: 78, goalkeeping: 10 },
      marketValue: 10000000,
      wage: 150000,
      contractUntil: 2028,
      fatigue: 10,
    })) as unknown as Player[];

    const events: MatchEvent[] = [
      {
        minute: 18,
        type: 'goal',
        team: 'home',
        playerId: 'p10',
        description: 'Golaço de Arrascaeta no ângulo!',
        shotOutcome: 'goal',
        shotType: 'LONG_SHOT',
        xg: 0.35,
      },
      {
        minute: 25,
        type: 'card',
        team: 'home',
        playerId: 'p2',
        description: 'Cartão amarelo para Jogador 2',
      },
    ];

    const html = renderToStaticMarkup(
      <PitchVisualizer
        homeClub={{ ...mockHomeClub, players: mockPlayers }}
        awayClub={mockAwayClub}
        homeTactic={defaultTactic}
        awayTactic={defaultTactic}
        mySide="home"
        events={events}
        currentMinute={26}
        momentum={72}
        isPaused={false}
        homeGoals={1}
        awayGoals={0}
        goldenWindowSide="home"
      />
    );

    expect(html).toContain('Arrascaeta');
    expect(html).toContain('JANELA DE OURO ATIVA');
    expect(html).toContain('pitch-event-markers');
  });
});

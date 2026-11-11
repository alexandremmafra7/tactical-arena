import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MatchEvent, Player, Tactic } from '@tactical-arena/shared';
import { PitchVisualizer } from './PitchVisualizer.js';

describe('PitchVisualizer Component', () => {
  const mockHomeClub = { id: 'club-home', name: 'Flamengo', slug: 'flamengo' };
  const mockAwayClub = { id: 'club-away', name: 'Vasco', slug: 'vasco' };

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

  it('calibrates zone labels to attacking left when mySide is away', () => {
    const html = renderToStaticMarkup(
      <PitchVisualizer
        homeClub={mockHomeClub}
        awayClub={mockAwayClub}
        homeTactic={defaultTactic}
        awayTactic={defaultTactic}
        mySide="away"
        events={[]}
        currentMinute={15}
        momentum={35}
        isPaused={false}
        homeGoals={0}
        awayGoals={0}
      />
    );

    expect(html).toContain('x="18" y="56.2">Ataque</text>');
    expect(html).toContain('x="82" y="56.2">Defesa</text>');
  });

  it('renders player nodes for both teams with translate style, stroke-width 0.4 and translates ball in viewBox units', () => {
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
    expect(html).toContain('transform:translate(');
    expect(html).toContain('stroke-width="0.4"');
    expect(html).toMatch(/class="pitch-ball-node"[^>]*transform="translate\(\d+(\.\d+)?, \d+(\.\d+)?\)"/);
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
        description: 'Na trave! Finalizacao de Vegetti carimba o poste!',
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
        description: 'Golaco de Arrascaeta no angulo!',
        shotOutcome: 'goal',
        shotType: 'LONG_SHOT',
        xg: 0.35,
      },
      {
        minute: 25,
        type: 'card',
        team: 'home',
        playerId: 'p2',
        description: 'Cartao amarelo para Jogador 2',
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

  it('renders sent-off player with pitch-player-sent-off class and EXP label rather than an active on-pitch player', () => {
    const mockPlayers = Array.from({ length: 11 }, (_, i) => ({
      id: `p${i + 1}`,
      name: i === 1 ? 'Felipe Melo' : `Jogador ${i + 1}`,
      age: 28,
      nationality: 'BRA',
      position: i === 0 ? ('GK' as const) : ('MID' as const),
      overall: 80,
      attributes: { pace: 70, finishing: 60, passing: 75, defending: 80, physical: 85, goalkeeping: 10 },
    })) as unknown as Player[];

    const events: MatchEvent[] = [
      {
        minute: 33,
        type: 'card',
        team: 'home',
        playerId: 'p2',
        description: 'Cartao vermelho para Felipe Melo!',
        suspensionMatches: 2,
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
        currentMinute={45}
        momentum={50}
        isPaused={false}
        homeGoals={0}
        awayGoals={0}
      />
    );

    expect(html).toContain('pitch-player-sent-off');
    expect(html).toContain('Melo (EXP)');
  });
});

describe('PitchVisualizer: troca de lado no intervalo', () => {
  const homeClub = { id: 'club-home', name: 'Flamengo', slug: 'flamengo' };
  const awayClub = { id: 'club-away', name: 'Vasco', slug: 'vasco' };
  const tactic: Tactic = {
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

  const goal = (over: Partial<MatchEvent> = {}): MatchEvent => ({
    minute: 30,
    type: 'goal',
    team: 'home',
    playerId: 'p9',
    description: 'Gol do mandante',
    shotOutcome: 'goal',
    shotType: 'BOX_SHOT',
    ...over,
  });

  const render = (props: Partial<React.ComponentProps<typeof PitchVisualizer>> = {}) =>
    renderToStaticMarkup(
      <PitchVisualizer
        homeClub={homeClub}
        awayClub={awayClub}
        homeTactic={tactic}
        awayTactic={tactic}
        mySide="home"
        events={[]}
        currentMinute={20}
        momentum={50}
        isPaused={false}
        homeGoals={0}
        awayGoals={0}
        {...props}
      />,
    );

  /** Posições (translate em unidades do viewBox) dos 11 jogadores de um lado, na ordem do slot. */
  const positions = (html: string, side: 'home' | 'away') => {
    const re = new RegExp(`pitch-player-node pitch-player-${side}" style="transform:translate\\(([\\d.]+)px, ([\\d.]+)px\\)"`, 'g');
    return [...html.matchAll(re)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
  };
  const meanX = (ps: { x: number }[]) => ps.reduce((s, p) => s + p.x, 0) / ps.length;

  it('1º tempo: mandante defende a esquerda; 2º tempo: defende a direita', () => {
    const t1 = positions(render({ period: '1T' }), 'home');
    const t2 = positions(render({ period: '2T' }), 'home');
    expect(t1).toHaveLength(11);
    expect(t2).toHaveLength(11);
    expect(meanX(t1)).toBeLessThan(50);
    expect(meanX(t2)).toBeGreaterThan(50);
  });

  it('o visitante faz o oposto do mandante nos dois tempos', () => {
    expect(meanX(positions(render({ period: '1T' }), 'away'))).toBeGreaterThan(50);
    expect(meanX(positions(render({ period: '2T' }), 'away'))).toBeLessThan(50);
  });

  it('o goleiro de cada time acompanha o seu gol depois da troca', () => {
    const t1 = render({ period: '1T' });
    const t2 = render({ period: '2T' });
    expect(positions(t1, 'home')[0].x).toBeLessThan(20);
    expect(positions(t2, 'home')[0].x).toBeGreaterThan(80);
    expect(positions(t1, 'away')[0].x).toBeGreaterThan(80);
    expect(positions(t2, 'away')[0].x).toBeLessThan(20);
  });

  it('rótulos Ataque e Defesa acompanham o lado em que o meu time ataca', () => {
    expect(render({ period: '1T', mySide: 'home' })).toContain('x="82" y="56.2">Ataque</text>');
    expect(render({ period: '2T', mySide: 'home' })).toContain('x="18" y="56.2">Ataque</text>');
    expect(render({ period: '2T', mySide: 'away' })).toContain('x="82" y="56.2">Ataque</text>');
  });

  it('lance do mandante é desenhado no gol certo para cada tempo', () => {
    const ballX = (html: string) => Number(/class="pitch-ball-node"[^>]*transform="translate\(([\d.]+), /.exec(html)?.[1]);
    const noPrimeiro = goal({ minute: 21, period: '1T' });
    const noSegundo = goal({ minute: 60, period: '2T' });
    expect(ballX(render({ period: '1T', events: [noPrimeiro], currentMinute: 21 }))).toBeGreaterThan(90);
    expect(ballX(render({ period: '2T', events: [noSegundo], currentMinute: 60 }))).toBeLessThan(10);
  });

  it('evento antigo reaberto no 2º tempo continua no lado em que aconteceu', () => {
    const ballX = (html: string) => Number(/class="pitch-ball-node"[^>]*transform="translate\(([\d.]+), /.exec(html)?.[1]);
    const doPrimeiroTempo = goal({ minute: 44, period: '1T' });
    const html = render({ period: '2T', events: [doPrimeiroTempo], selectedEvent: doPrimeiroTempo, currentMinute: 60 });
    expect(ballX(html)).toBeGreaterThan(90);
  });

  it('marcadores do 1º tempo saem do campo no 2º, salvo se o usuário os selecionar', () => {
    const doPrimeiro = goal({ minute: 30, period: '1T' });
    const marcadores = (html: string) => (html.match(/<g opacity=/g) ?? []).length;
    const base = { events: [doPrimeiro], currentMinute: 70 };
    expect(marcadores(render({ ...base, period: '1T' }))).toBeGreaterThan(0);
    expect(marcadores(render({ ...base, period: '2T' }))).toBe(0);
    expect(marcadores(render({ ...base, period: '2T', selectedEvent: doPrimeiro }))).toBeGreaterThan(0);
  });

  it('o período padrão é o 1º tempo (nada muda para quem não informa)', () => {
    expect(positions(render(), 'home')).toEqual(positions(render({ period: '1T' }), 'home'));
  });

  it('destaca com um anel só o jogador que está com a bola', () => {
    const html = render();
    expect(html.match(/pitch-carrier-ring/g)).toHaveLength(1);
  });
});

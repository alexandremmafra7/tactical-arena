import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { StandingRow, PlayerStatsEntry } from '@tactical-arena/shared';
import { LeagueView, type LeagueViewProps } from './League.js';

function renderLeague(props: Partial<LeagueViewProps> = {}) {
  const defaultLeague = {
    id: 'league-bra-1',
    name: 'Série A',
    countryCode: 'BRA',
    division: 1,
    capacity: 20,
    status: 'IN_PROGRESS',
    clubIds: ['c1', 'c2', 'c3', 'c4'],
    standings: [
      { clubId: 'c1', played: 1, wins: 1, draws: 0, losses: 0, goalsFor: 2, goalsAgainst: 0, points: 3 },
      { clubId: 'c2', played: 1, wins: 0, draws: 0, losses: 1, goalsFor: 0, goalsAgainst: 2, points: 0 },
    ] as StandingRow[],
    fixtures: [
      {
        round: 1,
        homeClubId: 'c1',
        awayClubId: 'c2',
        matchId: null,
        result: {
          homeGoals: 2,
          awayGoals: 0,
          scorers: [{ playerId: 'p1', clubId: 'c1', name: 'Atacante 1' }],
          assists: [{ playerId: 'p2', clubId: 'c1', name: 'Meia 1' }],
        },
      },
      {
        round: 1,
        homeClubId: 'c3',
        awayClubId: 'c4',
        matchId: null,
        result: {
          homeGoals: 1,
          awayGoals: 1,
          scorers: [],
          assists: [],
        },
      },
      {
        round: 2,
        homeClubId: 'c1',
        awayClubId: 'c3',
        matchId: null,
      },
      {
        round: 2,
        homeClubId: 'c2',
        awayClubId: 'c4',
        matchId: null,
      },
    ],
  } as unknown as LeagueViewProps['league'];

  const clubInfo = {
    c1: { name: 'Flamengo', slug: 'flamengo' },
    c2: { name: 'Palmeiras', slug: 'palmeiras' },
    c3: { name: 'Coritiba', slug: 'coritiba' },
    c4: { name: 'Paraná', slug: 'parana' },
  };

  const finalProps: LeagueViewProps = {
    league: defaultLeague,
    clubInfo,
    matches: {},
    stats: null,
    myClubId: 'c1',
    ...props,
  };

  return renderToStaticMarkup(
    <MemoryRouter>
      <LeagueView {...finalProps} />
    </MemoryRouter>
  );
}

describe('LeagueView Component', () => {
  it('renders friendly empty state when no goals or assists have been registered', () => {
    const html = renderLeague({
      stats: {
        topScorers: [
          { playerId: 'p-zero', playerName: 'Jogador Sem Gols', clubId: 'c4', goals: 0, assists: 0 } as unknown as PlayerStatsEntry,
        ],
        topAssistants: [
          { playerId: 'p-zero-a', playerName: 'Jogador Sem Assist', clubId: 'c4', goals: 0, assists: 0 } as unknown as PlayerStatsEntry,
        ],
      },
    });

    expect(html).toContain('Estatísticas Individuais da Liga');
    expect(html).toContain('Nenhum gol ou assistência registrado até o momento nesta edição da liga.');
    expect(html).not.toContain('Jogador Sem Gols');
    expect(html).not.toContain('Jogador Sem Assist');
  });

  it('filters out 0-goal and 0-assist entries and displays active leaderboard with badges', () => {
    const html = renderLeague({
      stats: {
        topScorers: [
          { playerId: 'p1', playerName: 'Gabriel Barbosa', clubId: 'c1', goals: 5, assists: 0 } as unknown as PlayerStatsEntry,
          { playerId: 'p2', playerName: 'Zero Gols', clubId: 'c4', goals: 0, assists: 0 } as unknown as PlayerStatsEntry,
        ],
        topAssistants: [
          { playerId: 'p3', playerName: 'Arrascaeta', clubId: 'c1', goals: 0, assists: 3 } as unknown as PlayerStatsEntry,
          { playerId: 'p4', playerName: 'Zero Assist', clubId: 'c4', goals: 0, assists: 0 } as unknown as PlayerStatsEntry,
        ],
      },
    });

    expect(html).toContain('Gabriel Barbosa');
    expect(html).toContain('5');
    expect(html).toContain('gols');
    expect(html).toContain('Arrascaeta');
    expect(html).toContain('3');
    expect(html).toContain('assistências');
    expect(html).not.toContain('Zero Gols');
    expect(html).not.toContain('Zero Assist');
  });

  it('correctly renders simulated fixture results with score and "Fim de jogo", not "a jogar"', () => {
    const html = renderLeague({
      selectedRound: 1,
    });

    expect(html).toContain('round-fixtures-list');
    expect(html).toContain('round-fixture-row');
    expect(html).toContain('Flamengo');
    expect(html).toContain('Palmeiras');
    // Placar 2 x 0
    expect(html).toContain('2');
    expect(html).toContain('0');
    expect(html).toContain('Fim de jogo');
    expect(html).not.toContain('• a jogar');
  });

  it('renders "A Jogar" for future rounds and highlights the user club fixture', () => {
    const html = renderLeague({
      selectedRound: 2,
      myClubId: 'c1',
    });

    expect(html).toContain('A Jogar');
    expect(html).toContain('my-fixture');
    expect(html).toContain('Seu Jogo');
  });

  it('defaults to current round (first round with pending fixtures)', () => {
    // In default league: round 1 has all played, round 2 has pending fixtures -> defaults to round 2
    const html = renderLeague();

    // Round 2 fixtures: Flamengo vs Coritiba, Palmeiras vs Paraná
    expect(html).toContain('Rodada 2 de 2');
    expect(html).toContain('Rodada Atual');
    expect(html).toContain('A Jogar');
  });
});

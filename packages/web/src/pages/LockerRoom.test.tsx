import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Club, LockerRoomState, PlayerHierarchyEntry } from '@tactical-arena/shared';
import { LockerRoomView } from './LockerRoom.js';

function makePlayer(position: string, overrides: any) {
  return {
    id: `player-${Math.random()}`,
    name: 'Player',
    position,
    overall: 70,
    age: 25,
    stamina: 100,
    happiness: 100,
    ...overrides,
  };
}

const player1 = makePlayer('leader', { name: 'Capitão Silva', overall: 82, traits: ['LEADER'], morale: 85, commitment: 90 });
const player2 = makePlayer('unhappy', { name: 'Atacante Revoltado', overall: 78, morale: 40, commitment: 35 });
const player3 = makePlayer('vet', { age: 32, name: 'Veterano Experiência', morale: 80, commitment: 80 });

const club: Club = {
  id: 'club-1',
  name: 'Clube Teste',
  ownerId: 'manager-1',
  slug: 'clube-teste',
  country: 'BRA',
  players: [player1, player2, player3],
  academyPlayers: [],
  budget: 1_000_000,
  captainPlayerId: player1.id,
  captainWeeksServed: 4,
  tutorPlayerId: null,
  penaltyTakerId: null,
  freeKickTakerId: null,
  cornerLeftTakerId: null,
  cornerRightTakerId: null,
  stadiumLevel: 1,
  stadiumCapacity: 20_000,
  stadiumConstruction: null,
  titlesWon: 0,
  sponsorships: [],
  loans: [],
  pendingTransferPayments: [],
  pendingRoundTactic: null,
} satisfies Club;

const hierarchy: PlayerHierarchyEntry[] = [
  {
    playerId: player1.id,
    playerName: 'Capitão Silva',
    position: 'MID',
    overall: 82,
    age: 32,
    tier: 'TEAM_LEADER',
    socialGroup: 'CORE_VETERANS',
    leadershipScore: 102,
    happiness: 87,
    concern: null,
  },
  {
    playerId: player2.id,
    playerName: 'Atacante Revoltado',
    position: 'ATT',
    overall: 78,
    age: 24,
    tier: 'HIGHLY_INFLUENTIAL',
    socialGroup: 'GENERAL_GROUP',
    leadershipScore: 65,
    happiness: 40,
    concern: 'Insatisfeito com poucos minutos em campo',
  },
];

const state: LockerRoomState = {
  squadCohesion: 74,
  managerSupport: 68,
  atmosphere: 'GOOD',
  hierarchy,
  recentIncidents: ['Atacante Revoltado: Insatisfeito com poucos minutos em campo'],
};

describe('LockerRoomView', () => {
  it('renders accessible meters, hierarchy and concerns', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LockerRoomView club={club} state={state} />
      </MemoryRouter>
    );

    expect(html).toContain('Coesão do Elenco');
    expect(html).toContain('Apoio ao Técnico');
    expect(html).toContain('Líderes de Equipe');
    expect(html).toContain('Insatisfeito com poucos minutos');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="74"');
  });

  it('renderiza o banner de atmosfera no padrão Stadium Night', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LockerRoomView club={club} state={state} />
      </MemoryRouter>
    );

    expect(html).toContain('Vestiário Unido');
    expect(html).toContain('atmosphere-good');
  });

  it('renderiza a pirâmide de hierarquia com 4 degraus estruturados', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LockerRoomView club={club} state={state} />
      </MemoryRouter>
    );

    expect(html).toContain('data-testid="hierarchy-pyramid"');
    expect(html).toContain('data-testid="pyramid-tier-TEAM_LEADER"');
    expect(html).toContain('data-testid="pyramid-tier-HIGHLY_INFLUENTIAL"');
    expect(html).toContain('data-testid="pyramid-tier-INFLUENTIAL"');
    expect(html).toContain('data-testid="pyramid-tier-GENERAL_SQUAD"');

    expect(html).toContain('Capitão Silva');
    expect(html).toContain('102 pts');
    expect(html).toContain('Atacante Revoltado');
  });

  it('renderiza o painel de grupos sociais e suas métricas coletivas', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LockerRoomView club={club} state={state} />
      </MemoryRouter>
    );

    expect(html).toContain('data-testid="social-groups-panel"');
    expect(html).toContain('Núcleo de Veteranos');
    expect(html).toContain('Jovens da Base');
    expect(html).toContain('Legião Estrangeira');
    expect(html).toContain('Grupo Principal');
    expect(html).toContain('Moral Coletiva');
  });

  it('renderiza a central de mediação com botões de intervenção rápida para jogador insatisfeito', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LockerRoomView club={club} state={state} />
      </MemoryRouter>
    );

    expect(html).toContain('data-testid="captain-mediation-section"');
    expect(html).toContain('Pedir Mediação do Capitão');
    expect(html).toContain('Conversa Diplomática');
    expect(html).toContain('Cobrar Profissionalismo');
    expect(html).toContain(`data-testid="mediate-captain-${player2.id}"`);
    expect(html).toContain(`data-testid="diplomatic-talk-${player2.id}"`);
  });

  it('exibe estado de plena harmonia quando não há insatisfações ativas', () => {
    const happyState: LockerRoomState = {
      ...state,
      hierarchy: [hierarchy[0]], // apenas o líder satisfeito
    };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LockerRoomView club={club} state={happyState} />
      </MemoryRouter>
    );

    expect(html).toContain('Vestiário em Plena Harmonia');
  });
});

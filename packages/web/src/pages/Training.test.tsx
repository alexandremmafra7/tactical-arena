import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Club, MentorshipPair, Player, SectorTrainingFocus } from '@tactical-arena/shared';
import { TrainingView } from './Training.js';

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: `player-${Math.random()}`,
    name: 'Atleta Exemplo',
    position: 'MID',
    age: 28,
    overall: 80,
    potential: 82,
    morale: 80,
    fatigue: 0,
    commitment: 80,
    marketValue: 1_000_000,
    wage: 20_000,
    releaseClause: 5_000_000,
    contractUntil: 2028,
    starLevel: 'NONE',
    functions: [],
    developmentPoints: 0,
    trainingFocus: null,
    suspensions: [],
    injuryWeeks: 0,
    nationality: 'BRA',
    attributes: {
      pace: 75,
      finishing: 70,
      passing: 84,
      defending: 72,
      physical: 76,
      goalkeeping: 10,
    },
    detailedAttributes: {} as any,
    preferredFoot: 'RIGHT',
    traits: ['LEADER'],
    ...overrides,
  };
}

const mentor = makePlayer({
  id: 'mentor-1',
  name: 'Thiago Neves',
  position: 'MID',
  age: 33,
  overall: 83,
  traits: ['LEADER'],
  nationality: 'BRA',
});

const apprentice = makePlayer({
  id: 'apprentice-1',
  name: 'Pedrinho Jóia',
  position: 'MID',
  age: 18,
  overall: 69,
  potential: 88,
  traits: [],
  nationality: 'BRA',
});

const defender = makePlayer({
  id: 'def-1',
  name: 'Geromel',
  position: 'DEF',
  age: 34,
  overall: 81,
  traits: ['DETERMINED'],
  nationality: 'BRA',
});

const mockClub: Club = {
  id: 'club-test',
  name: 'Grêmio Arena FC',
  ownerId: 'manager-1',
  slug: 'gremio-arena-fc',
  country: 'BRA',
  players: [mentor, apprentice, defender],
  academyPlayers: [],
  budget: 2_500_000,
  captainPlayerId: mentor.id,
  captainWeeksServed: 10,
  tutorPlayerId: mentor.id,
  penaltyTakerId: null,
  freeKickTakerId: null,
  cornerLeftTakerId: null,
  cornerRightTakerId: null,
  stadiumLevel: 2,
  stadiumCapacity: 35_000,
  stadiumConstruction: null,
  titlesWon: 2,
  sponsorships: [],
  loans: [],
  pendingTransferPayments: [],
  pendingRoundTactic: null,
  staff: [
    {
      id: 'staff-fit',
      name: 'Paulo Paixão',
      role: 'FITNESS_COACH',
      tier: 'OURO',
      rating: 82,
      wage: 15_000,
      specialty: 'Recuperação Física',
      description: 'Especialista em forma atlética',
      minClubVisibility: 50,
      minCareerTitles: 0,
      avatar: 'coach_1.png',
      nationality: 'BRA',
    },
    {
      id: 'staff-youth',
      name: 'Claudiomiro',
      role: 'YOUTH_COORDINATOR',
      tier: 'PRATA',
      rating: 78,
      wage: 12_000,
      specialty: 'Captação de Talentos',
      description: 'Especialista em categorias de base',
      minClubVisibility: 40,
      minCareerTitles: 0,
      avatar: 'coach_2.png',
      nationality: 'BRA',
    },
  ],
};

const defaultSectorFocuses: {
  defense: SectorTrainingFocus;
  midfield: SectorTrainingFocus;
  attack: SectorTrainingFocus;
} = {
  defense: 'CLEAN_TACKLING',
  midfield: 'POSSESSION_FLOW',
  attack: 'CLINICAL_FINISHING',
};

const mockPairs: MentorshipPair[] = [
  {
    id: 'pair-1',
    mentorId: mentor.id,
    mentorName: mentor.name,
    apprenticeId: apprentice.id,
    apprenticeName: apprentice.name,
    compatibilityScore: 95,
    positionMatch: true,
    sharedNationality: true,
    weeksActive: 4,
  },
];

describe('TrainingView (Passo 10 UI Integration)', () => {
  it('renderiza os 3 setores de Treino Setorial (Defesa, Meio-Campo e Ataque) com descrições e seletores', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TrainingView
          club={mockClub}
          mentorshipPairs={mockPairs}
          sectorFocuses={defaultSectorFocuses}
          focusChoice={{}}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('data-testid="sector-units-section"');
    expect(html).toContain('Treino Setorial Específico (Sinergia por Linhas)');

    // Cards dos 3 setores
    expect(html).toContain('data-testid="sector-card-defense"');
    expect(html).toContain('Linha Defensiva &amp; Goleiros');
    expect(html).toContain('Desarme Limpo &amp; Cobertura');

    expect(html).toContain('data-testid="sector-card-midfield"');
    expect(html).toContain('Linha de Meio-Campo');
    expect(html).toContain('Circulação &amp; Posse de Bola');

    expect(html).toContain('data-testid="sector-card-attack"');
    expect(html).toContain('Setor Ofensivo &amp; Pontas');
    expect(html).toContain('Finalização Clínica a 1 Toque');
  });

  it('renderiza o Sistema de Mentoria 1-para-1 com cards de afinidade e badges', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TrainingView
          club={mockClub}
          mentorshipPairs={mockPairs}
          sectorFocuses={defaultSectorFocuses}
          focusChoice={{}}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('data-testid="mentorship-section"');
    expect(html).toContain('Sistema de Mentoria 1-para-1');
    expect(html).toContain('data-testid="btn-auto-mentorship"');

    // Card da dupla
    expect(html).toContain('data-testid="mentorship-card-pair-1"');
    expect(html).toContain('Thiago Neves');
    expect(html).toContain('Pedrinho Jóia');
    expect(html).toContain('95%');
    expect(html).toContain('high-affinity');
    expect(html).toContain('4 sem. ativas');
    expect(html).toContain('Mesma Pos.');
    expect(html).toContain('Mesma Pátria');
    expect(html).toContain('data-testid="btn-remove-mentorship-pair-1"');
  });

  it('exibe mensagem orientativa quando não há duplas de mentoria ativas', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TrainingView
          club={mockClub}
          mentorshipPairs={[]}
          sectorFocuses={defaultSectorFocuses}
          focusChoice={{}}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('Nenhuma dupla de mentoria ativa no momento');
    expect(html).not.toContain('data-testid="mentorship-grid"');
  });

  it('renderiza o elenco profissional, destaques da comissão e badges de staff', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TrainingView
          club={mockClub}
          mentorshipPairs={mockPairs}
          sectorFocuses={defaultSectorFocuses}
          focusChoice={{}}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('Paulo Paixão');
    expect(html).toContain('+26% Físico');
    expect(html).toContain('Claudiomiro');
    expect(html).toContain('+28% Jovens');
    expect(html).toContain('Elenco Profissional');
    expect(html).toContain('Thiago Neves');
    expect(html).toContain('Tutor');
  });

  it('exibe o modal de relatório quando a comissão técnica conclui o treino automático', () => {
    const autoReport = {
      message: 'Comissão técnica concluiu o ciclo semanal de evolução!',
      actions: [
        {
          playerName: 'Pedrinho Jóia',
          focus: 'PASSING',
          reason: 'Desenvolvimento do passe para acompanhar o ritmo da mentoria.',
          cost: 15_000,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TrainingView
          club={mockClub}
          mentorshipPairs={mockPairs}
          sectorFocuses={defaultSectorFocuses}
          focusChoice={{}}
          autoReport={autoReport}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('Relatório da Comissão Técnica');
    expect(html).toContain('Comissão técnica concluiu o ciclo semanal de evolução!');
    expect(html).toContain('Pedrinho Jóia');
    expect(html).toContain('Passe');
    expect(html).toContain('15.000');
  });
});

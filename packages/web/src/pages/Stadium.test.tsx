import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Club, StadiumUpgradePreview } from '@tactical-arena/shared';
import { StadiumView } from './Stadium.js';

const club: Club = {
  id: 'club-1',
  name: 'Esporte Clube Teste',
  ownerId: 'manager-1',
  slug: 'esporte-clube-teste',
  country: 'BRA',
  players: [],
  academyPlayers: [],
  budget: 5_000_000,
  captainPlayerId: null,
  captainWeeksServed: 0,
  tutorPlayerId: null,
  penaltyTakerId: null,
  freeKickTakerId: null,
  cornerLeftTakerId: null,
  cornerRightTakerId: null,
  stadiumLevel: 2,
  stadiumCapacity: 15_000,
  stadiumTier: 2,
  stadiumUpgradeWeek: null,
  stadiumConstruction: null,
  titlesWon: 1,
  sponsorships: [
    {
      id: 'sp-1',
      sponsorName: 'Banco Arena',
      type: 'MASTER',
      weeklyAmount: 50_000,
      weeksRemaining: 20,
      titleBonus: 200_000,
      cupBonus: 100_000,
      contractLength: 'MEDIO',
    },
    {
      id: 'sp-2',
      sponsorName: 'Tech Arena',
      type: 'STADIUM_NAMING',
      weeklyAmount: 80_000,
      weeksRemaining: 30,
      titleBonus: 300_000,
      cupBonus: 150_000,
      contractLength: 'MEDIO',
    },
  ],
  loans: [],
  pendingTransferPayments: [],
  pendingRoundTactic: null,
};

const preview: StadiumUpgradePreview = {
  current: {
    level: 2,
    capacity: 15_000,
    publicoMedio: 12_000,
    receitaPorJogo: 360_000,
    prestigeStars: 2,
  },
  next: {
    level: 3,
    capacity: 40_000,
    publicoMedio: 28_000,
    receitaPorJogo: 840_000,
    prestigeStars: 3,
    upgradeCost: 5_000_000,
    constructionWeeks: 6,
    paybackMatches: 18,
  },
};

describe('StadiumView', () => {
  it('renders attendance, stadium visualizer, and kit visualizer', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><StadiumView club={club} preview={preview} /></MemoryRouter>
    );

    expect(html).toContain('Público no estádio');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Taxa de Ocupação"');
    
    expect(html).toContain('Visualizador de Uniforme e Patrocínios');
    expect(html).toContain('Banco Arena');
    expect(html).toContain('Tech Arena');
    expect(html).toContain('TIER 2');
    expect(html).toContain('BENEFÍCIOS DA REFORMA');
  });

  it('renders confirmation box when confirming upgrade', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><StadiumView club={club} preview={preview} confirming={true} /></MemoryRouter>
    );

    expect(html).toContain('Confirmar');
    expect(html).toContain('Duração da obra:');
    expect(html).toContain('Etapa 1/4');
    expect(html).toContain('lugares');
  });

  it('renders construction banner and progress bar when under construction, and loops construction video', () => {
    const underConstructionClub: Club = {
      ...club,
      stadiumConstruction: {
        targetLevel: 3,
        weeksRemaining: 4,
      },
      stadiumUpgradeWeek: 4,
    };

    const html = renderToStaticMarkup(
      <MemoryRouter><StadiumView club={underConstructionClub} preview={preview} /></MemoryRouter>
    );

    expect(html).toContain('Obra em andamento');
    expect(html).toContain('Em obras de ampliação');
    expect(html).toContain('aria-label="Progresso da Obra"');
    expect(html).toContain('src="/stadium/construction-tier-3.mp4"');
    expect(html.toLowerCase()).toContain('autoplay');
    expect(html).toContain('loop');
  });

  it('renders max level message when stadium is at tier 5', () => {
    const maxClub: Club = {
      ...club,
      stadiumLevel: 5,
      stadiumTier: 5,
      stadiumCapacity: 120_000,
      stadiumConstruction: null,
    };

    const html = renderToStaticMarkup(
      <MemoryRouter><StadiumView club={maxClub} preview={null} /></MemoryRouter>
    );

    expect(html).toContain('ESTÁDIO NÍVEL MÁXIMO');
    expect(html).toContain('120.000');
  });
});


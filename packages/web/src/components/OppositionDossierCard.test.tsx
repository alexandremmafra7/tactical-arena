import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OppositionDossier } from '@tactical-arena/shared';
import { OppositionDossierCard } from './OppositionDossierCard.js';

describe('OppositionDossierCard Component', () => {
  const mockDossier: OppositionDossier = {
    opponentClubId: 'opp-1',
    opponentName: 'Flamengo',
    confidenceRating: 85,
    presetIdentification: {
      presetId: 'tiki-taka',
      presetName: 'Tiki-Taka Contemporâneo',
      certainty: 92,
    },
    defensiveLineAnalysis: {
      height: 'HIGH',
      restDefence: '3+2',
      description: 'Linha muito alta, propensa a bolas nas costas.',
    },
    keyThreats: [
      {
        playerId: 'p-10',
        playerName: 'Arrascaeta',
        threatReason: 'Principal construtor de jogadas (MID)',
        overall: 86,
      },
    ],
    vulnerabilities: [
      {
        area: 'Defesa Central',
        description: 'Defesa muito avançada oferece vasto espaço nas costas dos centrais.',
      },
    ],
    countermeasures: [
      {
        param: 'AttackApproach',
        recommendedValue: 'DIRECT',
        reason: 'Lançamentos diretos para punir a linha alta.',
      },
    ],
  };

  it('renders dossier header with opponent name and scout precision badge', () => {
    const html = renderToStaticMarkup(<OppositionDossierCard dossier={mockDossier} />);

    expect(html).toContain('Dossiê de Espionagem: Flamengo');
    expect(html).toContain('Scout: 85% precisão');
    expect(html).toContain('briefing-confidence alta');
  });

  it('renders tactical preset and certainty badge', () => {
    const html = renderToStaticMarkup(<OppositionDossierCard dossier={mockDossier} />);

    expect(html).toContain('Tiki-Taka Contemporâneo');
    expect(html).toContain('92% convicção');
  });

  it('renders defensive line height and rest defence structure', () => {
    const html = renderToStaticMarkup(<OppositionDossierCard dossier={mockDossier} />);

    expect(html).toContain('Linha Alta');
    expect(html).toContain('def-high');
    expect(html).toContain('Rest: 3+2');
    expect(html).toContain('Linha muito alta, propensa a bolas nas costas.');
  });

  it('renders key threats with player name and overall rating', () => {
    const html = renderToStaticMarkup(<OppositionDossierCard dossier={mockDossier} />);

    expect(html).toContain('Jogador Chave a Neutralizar');
    expect(html).toContain('Arrascaeta');
    expect(html).toContain('OVR 86');
    expect(html).toContain('Principal construtor de jogadas (MID)');
  });

  it('renders vulnerabilities and recommended tactical countermeasures', () => {
    const html = renderToStaticMarkup(<OppositionDossierCard dossier={mockDossier} />);

    expect(html).toContain('Defesa Central:');
    expect(html).toContain('Defesa muito avançada oferece vasto espaço');
    expect(html).toContain('Abordagem Ofensiva:');
    expect(html).toContain('Direta (Bolas Longas)');
    expect(html).toContain('Lançamentos diretos para punir a linha alta.');
  });

  it('handles deep defensive line and low confidence styling correctly', () => {
    const lowConfDossier: OppositionDossier = {
      ...mockDossier,
      confidenceRating: 45,
      defensiveLineAnalysis: {
        height: 'DEEP',
        restDefence: 'UNKNOWN',
        description: 'Linha baixa compactada.',
      },
    };

    const html = renderToStaticMarkup(<OppositionDossierCard dossier={lowConfDossier} />);

    expect(html).toContain('briefing-confidence baixa');
    expect(html).toContain('Bloco Baixo');
    expect(html).toContain('def-deep');
    expect(html).not.toContain('Rest: UNKNOWN');
  });
});

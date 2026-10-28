import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Player } from '@tactical-arena/shared';
import { PlayerRadarChart, extractRadarAttributes } from './PlayerRadarChart.js';
import { PlayerComparisonModal, generateScoutVerdict } from './PlayerComparisonModal.js';

describe('PlayerRadarChart & PlayerComparisonModal (Passo 8)', () => {
  const mockPlayerA: Player = {
    id: 'player-a',
    name: 'Atacante Veloz',
    position: 'ATT',
    overall: 82,
    age: 26,
    potential: 85,
    marketValue: 15_000_000,
    salary: 50_000,
    clubId: 'club-1',
    fatigue: 0,
    injuryWeeks: 0,
    suspensions: [],
    attributes: {
      pace: 88,
      finishing: 84,
      passing: 75,
      defending: 35,
      physical: 78,
      goalkeeping: 15,
    },
    functions: ['PONTA'],
    traits: [],
  } as unknown as Player;

  const mockPlayerB: Player = {
    id: 'player-b',
    name: 'Jovem Promessa',
    position: 'ATT',
    overall: 78,
    age: 20,
    potential: 91,
    marketValue: 18_000_000,
    salary: 30_000,
    clubId: 'club-2',
    fatigue: 0,
    injuryWeeks: 0,
    suspensions: [],
    attributes: {
      pace: 92,
      finishing: 76,
      passing: 80,
      defending: 38,
      physical: 70,
      goalkeeping: 15,
    },
    functions: ['SEGUNDO_ATACANTE'],
    traits: [],
  } as unknown as Player;

  const mockPlayerWithoutAttrs: Player = {
    id: 'player-no-attrs',
    name: 'Atleta Sem Atributos Detalhados',
    position: 'MID',
    overall: 75,
    age: 24,
    potential: 78,
    marketValue: 2_000_000,
    salary: 20_000,
    clubId: 'club-1',
    fatigue: 0,
    injuryWeeks: 0,
    suspensions: [],
  } as unknown as Player;

  it('1. Renderiza PlayerRadarChart com 1 jogador, exibindo os 6 eixos e o polígono primário', () => {
    const html = renderToStaticMarkup(
      <PlayerRadarChart primaryPlayer={mockPlayerA} size={260} />
    );

    // Eixos presentes
    expect(html).toContain('VEL');
    expect(html).toContain('FIN');
    expect(html).toContain('PAS');
    expect(html).toContain('DEF');
    expect(html).toContain('FIS');
    expect(html).toContain('TEC');

    // Polígono e classe primária presentes
    expect(html).toContain('radar-polygon-primary');
    // Não deve conter o polígono secundário quando renderizado com 1 só
    expect(html).not.toContain('radar-polygon-secondary');
  });

  it('2. Renderiza PlayerRadarChart com 2 jogadores sobrepostos e verifica ambos os polígonos', () => {
    const html = renderToStaticMarkup(
      <PlayerRadarChart
        primaryPlayer={mockPlayerA}
        secondaryPlayer={mockPlayerB}
        size={260}
      />
    );

    // Ambos os polígonos presentes
    expect(html).toContain('radar-polygon-primary');
    expect(html).toContain('radar-polygon-secondary');

    // Nomes de ambos na legenda
    expect(html).toContain('Atacante Veloz');
    expect(html).toContain('Jovem Promessa');
  });

  it('3. Renderiza PlayerComparisonModal exibindo veredito comparativo, diferenças de atributos e papéis ideais', () => {
    const html = renderToStaticMarkup(
      <PlayerComparisonModal
        isOpen={true}
        onClose={() => {}}
        primaryPlayer={mockPlayerA}
        secondaryPlayer={mockPlayerB}
      />
    );

    // Modal e títulos
    expect(html).toContain('Comparador Tático de Atletas');
    expect(html).toContain('Veredito do Departamento de Scouting:');

    // Nomes e métricas dos dois atletas
    expect(html).toContain('Atacante Veloz');
    expect(html).toContain('Jovem Promessa');
    expect(html).toContain('82');
    expect(html).toContain('78');

    // Linhas de métricas de atributos
    expect(html).toContain('Velocidade (VEL)');
    expect(html).toContain('Finalização (FIN)');
    expect(html).toContain('Passe (PAS)');

    // Veredito de scouting deve ser gerado
    const verdict = generateScoutVerdict(mockPlayerA, mockPlayerB);
    expect(verdict.length).toBeGreaterThan(15);
    expect(html).toContain(verdict);
  });

  it('4. Garante funcionamento seguro com fallback quando player.attributes for ausente ou parcial', () => {
    // Não deve lançar exceção
    expect(() => {
      extractRadarAttributes(mockPlayerWithoutAttrs);
    }).not.toThrow();

    const attrs = extractRadarAttributes(mockPlayerWithoutAttrs);
    expect(attrs.vel).toBe(75); // fallback para o overall (75)
    expect(attrs.fin).toBe(75);
    expect(attrs.pas).toBe(75);
    expect(attrs.def).toBe(75);
    expect(attrs.fis).toBe(75);

    // Deve renderizar perfeitamente no JSX
    const html = renderToStaticMarkup(
      <PlayerRadarChart primaryPlayer={mockPlayerWithoutAttrs} />
    );
    expect(html).toContain('radar-polygon-primary');
    expect(html).toContain('Atleta Sem Atributos Detalhados');
  });

  it('5. Altera eixo para GK quando o atleta for goleiro', () => {
    const mockGk: Player = {
      id: 'p-gk',
      name: 'Goleiro Titular',
      position: 'GK',
      overall: 80,
      age: 28,
      potential: 82,
      attributes: {
        pace: 50,
        finishing: 20,
        passing: 60,
        defending: 40,
        physical: 75,
        goalkeeping: 84,
      },
    } as unknown as Player;

    const html = renderToStaticMarkup(
      <PlayerRadarChart primaryPlayer={mockGk} />
    );

    expect(html).toContain('GK');
    expect(html).not.toContain('>TEC<');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TeamRolePerformanceReport } from '@tactical-arena/shared';
import { TacticalRolePerformanceCard } from './TacticalRolePerformanceCard.js';

describe('TacticalRolePerformanceCard Component', () => {
  const mockHomeReport: TeamRolePerformanceReport = {
    teamName: 'Flamengo',
    clubId: 'c1',
    starters: [
      {
        playerId: 'p1',
        name: 'Rossi',
        position: 'GK',
        role: 'GOLEIRO',
        roleName: 'Goleiro',
        rating: 7.5,
        keyStat: '4 defesas, 0 gols sofridos',
        tacticalVerdict: 'BOM',
        explanation: 'Paredão sob as traves: defesas cruciais garantiram a meta invicta.',
        goals: 0,
        assists: 0,
        highlightIcon: '🧤',
      },
      {
        playerId: 'p2',
        name: 'Fabrício Bruno',
        position: 'DEF',
        role: 'ZAGUEIRO_REBATEDOR',
        roleName: 'Zagueiro Rebatedor',
        rating: 7.2,
        keyStat: 'Meta zerada, soberano no corte',
        tacticalVerdict: 'BOM',
        explanation: 'Forte nas divididas e no combate aéreo.',
        goals: 0,
        assists: 0,
        highlightIcon: '🧱',
      },
      {
        playerId: 'p3',
        name: 'Ayrton Lucas',
        position: 'LAT',
        role: 'ALA_OFENSIVO',
        roleName: 'Ala Ofensivo',
        rating: 7.8,
        keyStat: '1 assist., apoio no corredor',
        tacticalVerdict: 'EXCELENTE',
        explanation: 'Deu amplitude pelo flanco e cruzou com perigo.',
        goals: 0,
        assists: 1,
        highlightIcon: '🚀',
      },
      {
        playerId: 'p4',
        name: 'Arrascaeta',
        position: 'MID',
        role: 'MEIA_ARMADOR',
        roleName: 'Meia Armador / Camisa 10',
        rating: 8.0,
        keyStat: '1 assistência, maestro na criação',
        tacticalVerdict: 'EXCELENTE',
        explanation: 'Visão privilegiada: ditou o ritmo e desfez a marcação rival.',
        goals: 0,
        assists: 1,
        highlightIcon: '🎯',
      },
      {
        playerId: 'p5',
        name: 'Pedro',
        position: 'ATT',
        role: 'CENTROAVANTE_REFERENCIA',
        roleName: 'Homem de Referência / Pivô',
        rating: 8.5,
        keyStat: '2 gols (1 de cabeça), 4 finalizações',
        tacticalVerdict: 'EXCELENTE',
        explanation: 'Cumpriu a função de pivô e finalizador de área com letalidade máxima.',
        goals: 2,
        assists: 0,
        highlightIcon: '⚽',
      },
    ],
    tacticalHighlights: [
      '⭐ Destaque individual: Pedro brilhou no papel de Homem de Referência / Pivô (Nota 8.5).',
      '⚽ Eficácia no comando do ataque: setor ofensivo converteu 2 gols executando seus papéis táticos.',
      '🛡️ Solidez da retaguarda: zaga e volantes anularam as principais investidas do adversário.',
    ],
  };

  const mockAwayReport: TeamRolePerformanceReport = {
    teamName: 'Palmeiras',
    clubId: 'c2',
    starters: [
      {
        playerId: 'p6',
        name: 'Weverton',
        position: 'GK',
        role: 'GOLEIRO',
        roleName: 'Goleiro',
        rating: 6.2,
        keyStat: '2 defesas, 2 gols sofridos',
        tacticalVerdict: 'REGULAR',
        explanation: 'Trabalho regular debaixo das traves.',
        goals: 0,
        assists: 0,
        highlightIcon: '🧤',
      },
      {
        playerId: 'p7',
        name: 'Veiga',
        position: 'MID',
        role: 'MEIA_ARMADOR',
        roleName: 'Meia Armador / Camisa 10',
        rating: 6.5,
        keyStat: 'Distribuição e articulação ofensiva',
        tacticalVerdict: 'REGULAR',
        explanation: 'Cadenciou as jogadas no terço final.',
        goals: 0,
        assists: 0,
        highlightIcon: '🎯',
      },
    ],
    tacticalHighlights: [
      '⚠️ Alerta ofensivo: atacantes encontraram dificuldade para furar o bloqueio defensivo rival.',
    ],
  };

  it('renderiza o cabeçalho, nome do time e badge do Stadium Night', () => {
    const html = renderToStaticMarkup(<TacticalRolePerformanceCard report={mockHomeReport} />);

    expect(html).toContain('DESEMPENHO DE PAPÉIS TÁTICOS');
    expect(html).toContain('Rendimento dos Papéis em Campo');
    expect(html).toContain('Flamengo');
    expect(html).toContain('Análise causal do auxiliar técnico');
  });

  it('renderiza os cartões dos titulares com papéis, notas e estatísticas-chave', () => {
    const html = renderToStaticMarkup(<TacticalRolePerformanceCard report={mockHomeReport} />);

    // Pedro
    expect(html).toContain('Pedro');
    expect(html).toContain('Homem de Referência / Pivô');
    expect(html).toContain('8.5');
    expect(html).toContain('EXCELENTE');
    expect(html).toContain('2 gols (1 de cabeça)');

    // Rossi
    expect(html).toContain('Rossi');
    expect(html).toContain('Goleiro');
    expect(html).toContain('4 defesas, 0 gols sofridos');

    // Arrascaeta
    expect(html).toContain('Arrascaeta');
    expect(html).toContain('Meia Armador / Camisa 10');
    expect(html).toContain('maestro na criação');
  });

  it('renderiza painel de observações do auxiliar técnico quando disponível', () => {
    const html = renderToStaticMarkup(<TacticalRolePerformanceCard report={mockHomeReport} />);

    expect(html).toContain('Observações do Auxiliar Técnico:');
    expect(html).toContain('Pedro brilhou no papel de Homem de Referência');
    expect(html).toContain('Solidez da retaguarda');
  });

  it('renderiza botões de alternância de time quando home e away reports são passados', () => {
    const html = renderToStaticMarkup(
      <TacticalRolePerformanceCard homeReport={mockHomeReport} awayReport={mockAwayReport} />,
    );

    expect(html).toContain('Flamengo');
    expect(html).toContain('Palmeiras');
    expect(html).toContain('role-team-toggle-group');
  });

  it('retorna null se nenhum relatório for fornecido', () => {
    const html = renderToStaticMarkup(<TacticalRolePerformanceCard />);
    expect(html).toBe('');
  });
});

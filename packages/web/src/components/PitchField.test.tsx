import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { partnershipKey, type Player } from '@tactical-arena/shared';
import { PitchField, PitchTacticalOverlay, StartingXIPitch } from './PitchField.js';

describe('PitchField Dynamic Tactical Overlays', () => {
  const dummySquad: Player[] = Array.from({ length: 11 }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Jogador ${i + 1}`,
    position: i === 0 ? 'GK' : i < 5 ? 'DEF' : i < 9 ? 'MID' : 'ATT',
    overall: 75,
    age: 24,
    nationality: 'Brasil',
    traits: [],
    injuryWeeks: 0,
    suspensions: [],
    fatigue: 10,
    morale: 80,
  })) as unknown as Player[];

  const dummySelections = dummySquad.map((p) => p.id);

  it('renders clean pitch without overlays when no tactical dials are provided', () => {
    const html = renderToStaticMarkup(
      <PitchField
        formation="4-4-2"
        squad={dummySquad}
        selections={dummySelections}
        onSelect={() => {}}
      />
    );

    expect(html).toContain('pitch-markings');
    expect(html).not.toContain('pitch-tactical-overlay');
    expect(html).not.toContain('LINHA ALTA');
    expect(html).not.toContain('FLUXO:');
  });

  it('renders HIGH defensive line with space behind warning and amber glow', () => {
    const html = renderToStaticMarkup(
      <PitchField
        formation="4-4-2"
        squad={dummySquad}
        selections={dummySelections}
        defensiveLine="HIGH"
        onSelect={() => {}}
      />
    );

    expect(html).toContain('pitch-tactical-overlay');
    expect(html).toContain('LINHA ALTA');
    expect(html).toContain('ESPAÇO NAS COSTAS');
    expect(html).toContain('space-behind-zone');
    expect(html).toContain('y1="168"');
  });

  it('renders DEEP defensive line (low block) with protected penalty box zone', () => {
    const html = renderToStaticMarkup(
      <PitchField
        formation="5-3-2"
        squad={dummySquad}
        selections={dummySelections}
        defensiveLine="DEEP"
        onSelect={() => {}}
      />
    );

    expect(html).toContain('pitch-tactical-overlay');
    expect(html).toContain('BLOCO BAIXO');
    expect(html).toContain('deep-block-zone');
    expect(html).toContain('y1="236"');
  });

  it('renders BALANCED defensive line at standard centre-back coordinates', () => {
    const html = renderToStaticMarkup(
      <PitchField
        formation="4-3-3"
        squad={dummySquad}
        selections={dummySelections}
        defensiveLine="BALANCED"
        onSelect={() => {}}
      />
    );

    expect(html).toContain('pitch-tactical-overlay');
    expect(html).toContain('LINHA MÉDIA');
    expect(html).toContain('y1="204"');
  });

  it('renders WINGS attack style arrows along both flanks with crossing trajectories', () => {
    const html = renderToStaticMarkup(
      <PitchField
        formation="4-4-2"
        squad={dummySquad}
        selections={dummySelections}
        attackStyle="WINGS"
        onSelect={() => {}}
      />
    );

    expect(html).toContain('pitch-tactical-overlay');
    expect(html).toContain('FLUXO: ALAS &amp; PONTAS');
    expect(html).toContain('tactical-attack-arrows-wings');
    expect(html).toContain('tactical-animated-arrow');
  });

  it('renders THROUGH_MIDDLE attack style with central converging penetration arrows', () => {
    const html = renderToStaticMarkup(
      <PitchField
        formation="4-2-3-1"
        squad={dummySquad}
        selections={dummySelections}
        attackStyle="THROUGH_MIDDLE"
        onSelect={() => {}}
      />
    );

    expect(html).toContain('pitch-tactical-overlay');
    expect(html).toContain('FLUXO: JOGO POR DENTRO');
    expect(html).toContain('tactical-attack-arrows-middle');
  });

  it('renders BALANCED attack style with 3 evenly distributed progression lines', () => {
    const html = renderToStaticMarkup(
      <PitchField
        formation="4-1-4-1"
        squad={dummySquad}
        selections={dummySelections}
        attackStyle="BALANCED"
        onSelect={() => {}}
      />
    );

    expect(html).toContain('pitch-tactical-overlay');
    expect(html).toContain('FLUXO: ATAQUE EQUILIBRADO');
    expect(html).toContain('tactical-attack-arrows-balanced');
  });

  it('infers defensive line from pressing if defensiveLine is omitted', () => {
    const htmlHigh = renderToStaticMarkup(
      <PitchField
        formation="4-3-3"
        squad={dummySquad}
        selections={dummySelections}
        pressing="HIGH_PRESS"
        onSelect={() => {}}
      />
    );
    expect(htmlHigh).toContain('LINHA ALTA');

    const htmlLow = renderToStaticMarkup(
      <PitchField
        formation="5-3-2"
        squad={dummySquad}
        selections={dummySelections}
        pressing="LOW_BLOCK"
        onSelect={() => {}}
      />
    );
    expect(htmlLow).toContain('BLOCO BAIXO');
  });

  it('supports StartingXIPitch with dynamic overlays as well', () => {
    const lineup = dummySquad.map((p) => ({ playerId: p.id }));
    const html = renderToStaticMarkup(
      <StartingXIPitch
        formation="4-4-2"
        lineup={lineup}
        players={dummySquad}
        defensiveLine="HIGH"
        attackStyle="WINGS"
      />
    );

    expect(html).toContain('pitch-tactical-overlay');
    expect(html).toContain('LINHA ALTA');
    expect(html).toContain('FLUXO: ALAS &amp; PONTAS');
  });

  describe('Passo 6: Dynamic Partnerships & Tactical Board (Brasfoot ⇄ FM)', () => {
    it('renders partnership lines, badges and summary bar in TACTICAL mode when squad has eligible sectors', () => {
      const html = renderToStaticMarkup(
        <PitchField
          formation="4-4-2"
          squad={dummySquad}
          selections={dummySelections}
          tacticalViewMode="TACTICAL"
          onSelect={() => {}}
        />
      );

      // Linhas SVG de parceria e badges centrais
      expect(html).toContain('pitch-partnership-lines');
      expect(html).toContain('partnership-pair-group');
      expect(html).toContain('partnership-line');
      expect(html).toContain('partnership-score-badge');
      expect(html).toContain('partnership-score-text');

      // Mini-Card de resumo de parcerias de setor
      expect(html).toContain('partnership-summary-bar');
      expect(html).toContain('Parcerias de Setor');
      expect(html).toContain('partnership-sector-chip');
    });

    it('correctly applies classes and colors for each partnership affinity level (VETERAN, ESTABLISHED, DEVELOPING, NEW)', () => {
      // 4-4-2:
      // Zaga: dummySquad[2] e dummySquad[3] (DEF e DEF)
      // Meio: dummySquad[5] e dummySquad[6] (MID e MID)
      // Ataque: dummySquad[9] e dummySquad[10] (ATT e ATT)
      const defKey = partnershipKey(dummySquad[2].id, dummySquad[3].id);
      const midKey = partnershipKey(dummySquad[5].id, dummySquad[6].id);
      const attKey = partnershipKey(dummySquad[9].id, dummySquad[10].id);

      // Cenário 1: VETERAN (40 jogos juntos)
      const historyVeteran = new Map<string, number>([
        [defKey, 40],
      ]);
      const htmlVeteran = renderToStaticMarkup(
        <PitchField
          formation="4-4-2"
          squad={dummySquad}
          selections={dummySelections}
          matchesHistory={historyVeteran}
          tacticalViewMode="TACTICAL"
          onSelect={() => {}}
        />
      );
      expect(htmlVeteran).toContain('partnership-line-veteran');
      expect(htmlVeteran).toContain('stroke="#10b981"');
      expect(htmlVeteran).toContain('partnership-glow-veteran');

      // Cenário 2: ESTABLISHED (20 jogos juntos)
      const historyEstablished = new Map<string, number>([
        [midKey, 20],
      ]);
      const htmlEstablished = renderToStaticMarkup(
        <PitchField
          formation="4-4-2"
          squad={dummySquad}
          selections={dummySelections}
          matchesHistory={historyEstablished}
          tacticalViewMode="TACTICAL"
          onSelect={() => {}}
        />
      );
      expect(htmlEstablished).toContain('partnership-line-established');
      expect(htmlEstablished).toContain('stroke="#38bdf8"');

      // Cenário 3: DEVELOPING (10 jogos juntos)
      const historyDeveloping = new Map<string, number>([
        [attKey, 10],
      ]);
      const htmlDeveloping = renderToStaticMarkup(
        <PitchField
          formation="4-4-2"
          squad={dummySquad}
          selections={dummySelections}
          matchesHistory={historyDeveloping}
          tacticalViewMode="TACTICAL"
          onSelect={() => {}}
        />
      );
      expect(htmlDeveloping).toContain('partnership-line-developing');
      expect(htmlDeveloping).toContain('stroke="#f59e0b"');
      expect(htmlDeveloping).toContain('stroke-dasharray="4 2"');

      // Cenário 4: NEW (2 jogos juntos -> risco sob pressão)
      const historyNew = new Map<string, number>([
        [defKey, 2],
      ]);
      const htmlNew = renderToStaticMarkup(
        <PitchField
          formation="4-4-2"
          squad={dummySquad}
          selections={dummySelections}
          matchesHistory={historyNew}
          tacticalViewMode="TACTICAL"
          onSelect={() => {}}
        />
      );
      expect(htmlNew).toContain('partnership-line-new');
      expect(htmlNew).toContain('stroke="#ef4444"');
      expect(htmlNew).toContain('stroke-dasharray="2 3"');
      expect(htmlNew).toContain('Sem Química');
    });

    it('toggles between SIMPLE and TACTICAL modes and controls visual complexity', () => {
      // Toggle buttons renderizados
      const htmlTactical = renderToStaticMarkup(
        <PitchField
          formation="4-4-2"
          squad={dummySquad}
          selections={dummySelections}
          tacticalViewMode="TACTICAL"
          onSelect={() => {}}
        />
      );
      expect(htmlTactical).toContain('pitch-view-mode-bar');
      expect(htmlTactical).toContain('Visão Simples');
      expect(htmlTactical).toContain('Prancheta Tática');
      expect(htmlTactical).toContain('pitch-partnership-lines');
      expect(htmlTactical).toContain('player-function-pill');
      expect(htmlTactical).toContain('partnership-summary-bar');

      // No modo SIMPLE: sem linhas de química, sem pílulas e sem card de resumo
      const htmlSimple = renderToStaticMarkup(
        <PitchField
          formation="4-4-2"
          squad={dummySquad}
          selections={dummySelections}
          tacticalViewMode="SIMPLE"
          onSelect={() => {}}
        />
      );
      expect(htmlSimple).toContain('pitch-view-mode-bar');
      expect(htmlSimple).not.toContain('pitch-partnership-lines');
      expect(htmlSimple).not.toContain('player-function-pill');
      expect(htmlSimple).not.toContain('partnership-summary-bar');
    });

    it('renders tactical sub-role pills on outfield players with rich combat bonus tooltips', () => {
      const squadWithRoles = dummySquad.map((p, idx) => {
        if (idx === 0) return { ...p, position: 'GK' as const };
        if (idx === 2) {
          return {
            ...p,
            position: 'DEF' as const,
            functions: ['ZAGUEIRO_CONSTRUTOR' as const],
          };
        }
        if (idx === 5) {
          return {
            ...p,
            position: 'MID' as const,
            functions: ['MEIA_ARMADOR' as const],
          };
        }
        if (idx === 9) {
          return {
            ...p,
            position: 'ATT' as const,
            functions: ['CENTROAVANTE_REFERENCIA' as const],
          };
        }
        return p;
      });

      const html = renderToStaticMarkup(
        <PitchField
          formation="4-4-2"
          squad={squadWithRoles}
          selections={dummySelections}
          tacticalViewMode="TACTICAL"
          onSelect={() => {}}
        />
      );

      // Pílulas nos jogadores de linha
      expect(html).toContain('player-function-pill');
      expect(html).toContain('ZAG. CONST');
      expect(html).toContain('ARMADOR');
      expect(html).toContain('HOMEM-GOL');

      // Tooltip informativo com impacto de combate
      expect(html).toContain('Função Tática: Zagueiro Construtor');
      expect(html).toContain('Pass +15%');
      expect(html).toContain('Função Tática: Meia Armador / Camisa 10');
      expect(html).toContain('Pass +25%');
    });

    it('StartingXIPitch also supports partnership lines and tactical view mode', () => {
      const lineup = dummySquad.map((p) => ({ playerId: p.id }));

      const htmlTactical = renderToStaticMarkup(
        <StartingXIPitch
          formation="4-4-2"
          lineup={lineup}
          players={dummySquad}
          tacticalViewMode="TACTICAL"
        />
      );

      expect(htmlTactical).toContain('pitch-partnership-lines');
      expect(htmlTactical).toContain('player-function-pill');
      expect(htmlTactical).toContain('partnership-summary-bar');

      const htmlSimple = renderToStaticMarkup(
        <StartingXIPitch
          formation="4-4-2"
          lineup={lineup}
          players={dummySquad}
          tacticalViewMode="SIMPLE"
        />
      );

      expect(htmlSimple).not.toContain('pitch-partnership-lines');
      expect(htmlSimple).not.toContain('player-function-pill');
      expect(htmlSimple).not.toContain('partnership-summary-bar');
    });

    it('renders cleanly and safely even if player has missing/undefined suspensions or injuryWeeks', () => {
      const minimalSquad = dummySquad.map((p) => {
        const copy = { ...p };
        delete (copy as any).suspensions;
        delete (copy as any).injuryWeeks;
        return copy;
      });
      const lineup = minimalSquad.map((p) => ({ playerId: p.id }));

      expect(() => {
        renderToStaticMarkup(
          <StartingXIPitch
            formation="4-4-2"
            lineup={lineup}
            players={minimalSquad}
            tacticalViewMode="TACTICAL"
          />
        );
      }).not.toThrow();
    });
  });
});


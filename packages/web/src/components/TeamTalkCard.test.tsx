import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TeamTalkOption, TeamTalkResult } from '@tactical-arena/shared';
import { getRecommendedTeamTalk } from '@tactical-arena/shared';
import { TeamTalkCard, TeamTalkCardView } from './TeamTalkCard.js';

describe('TeamTalkCard Component', () => {
  const mockResult: TeamTalkResult = {
    message: 'O elenco saiu inspirado da preleção.',
    moraleModifiers: { 'p1': 8, 'p2': 4 },
    overallReaction: 'INSPIRED',
  };

  const defaultRecommendedOption: TeamTalkOption = getRecommendedTeamTalk('PRE_MATCH', 0, false);

  it('renders pre-match context with 4 tone options and impact descriptions', () => {
    const html = renderToStaticMarkup(
      <TeamTalkCard
        clubId="club-1"
        context="PRE_MATCH"
        scoreDifferential={0}
      />
    );

    expect(html).toContain('Preleção Pré-Jogo');
    expect(html).toContain('Deixar Auxiliar falar');
    expect(html).toContain('Manter a calma');
    expect(html).toContain('Falar com paixão');
    expect(html).toContain('Cobrar mais');
    expect(html).toContain('Encorajar o grupo');
    expect(html).toContain('Reduz a pressão');
    expect(html).toContain('Inspira líderes');
    expect(html).toContain('Transmitir Preleção');
  });

  it('renders half-time context and reacts to score differential', () => {
    const html = renderToStaticMarkup(
      <TeamTalkCard
        clubId="club-1"
        context="HALF_TIME"
        scoreDifferential={-2}
      />
    );

    expect(html).toContain('Preleção no Intervalo');
    expect(html).toContain('A equipe precisa reagir');
  });

  it('renders high-pressure note when isDerbyOrFinal is true', () => {
    const html = renderToStaticMarkup(
      <TeamTalkCard
        clubId="club-1"
        context="PRE_MATCH"
        scoreDifferential={0}
        isDerbyOrFinal={true}
      />
    );

    expect(html).toContain('Jogo de alta pressão');
  });

  it('renders selected option active state in TeamTalkCardView', () => {
    const html = renderToStaticMarkup(
      <TeamTalkCardView
        clubId="club-1"
        context="PRE_MATCH"
        scoreDifferential={0}
        isDerbyOrFinal={false}
        selectedOptionId="PRE_MATCH:PASSIONATE"
        recommendedOption={defaultRecommendedOption}
        busy={false}
        error={null}
        appliedResult={null}
        onSelectOption={() => {}}
        onSubmit={() => {}}
        onAssistantSubmit={() => {}}
      />
    );

    expect(html).toContain('team-talk-option selected passionate');
    expect(html).toContain('Falar com paixão');
  });

  it('renders applied result with message and reaction badge', () => {
    const html = renderToStaticMarkup(
      <TeamTalkCardView
        clubId="club-1"
        context="HALF_TIME"
        scoreDifferential={0}
        isDerbyOrFinal={false}
        selectedOptionId="HALF_TIME:PASSIONATE"
        recommendedOption={defaultRecommendedOption}
        busy={false}
        error={null}
        appliedResult={mockResult}
        onSelectOption={() => {}}
        onSubmit={() => {}}
        onAssistantSubmit={() => {}}
      />
    );

    expect(html).toContain('team-talk-applied-banner');
    expect(html).toContain('O elenco saiu inspirado da preleção.');
    expect(html).toContain('INSPIRED');
    expect(html).toContain('Inspirado');
    expect(html).toContain('Preleção Realizada');
  });

  it('renders error alert when submission fails', () => {
    const html = renderToStaticMarkup(
      <TeamTalkCardView
        clubId="club-1"
        context="PRE_MATCH"
        scoreDifferential={0}
        isDerbyOrFinal={false}
        selectedOptionId="PRE_MATCH:CALM"
        recommendedOption={defaultRecommendedOption}
        busy={false}
        error="Falha na conexão com o vestiário"
        appliedResult={null}
        onSelectOption={() => {}}
        onSubmit={() => {}}
        onAssistantSubmit={() => {}}
      />
    );

    expect(html).toContain('team-talk-alert error');
    expect(html).toContain('Falha na conexão com o vestiário');
  });

  it('handles submission logic and triggers callbacks', async () => {
    const submitTalkMock = vi.fn().mockResolvedValue(mockResult);
    const onAppliedMock = vi.fn();

    // Verify submission contract
    const result = await submitTalkMock('club-1', 'PRE_MATCH:PASSIONATE', 'PRE_MATCH', 0);
    onAppliedMock(result);

    expect(submitTalkMock).toHaveBeenCalledWith('club-1', 'PRE_MATCH:PASSIONATE', 'PRE_MATCH', 0);
    expect(onAppliedMock).toHaveBeenCalledWith(mockResult);
    expect(result.overallReaction).toBe('INSPIRED');
  });
});

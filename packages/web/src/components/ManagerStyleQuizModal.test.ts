import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ManagerStyleQuizModal,
  answerManagerStyleQuiz,
  classifyManagerStyleQuiz,
  type ManagerStyleQuizAnswer,
} from './ManagerStyleQuizModal.js';

describe('classifyManagerStyleQuiz', () => {
  it.each([
    [['A', 'A', 'A', 'B'], 'brasfoot_casual'],
    [['A', 'A', 'B', 'B'], 'balanced'],
    [['B', 'B', 'B', 'A'], 'football_manager_hardcore'],
  ] as const)(
    'classifies the complete answers %s as %s',
    (answers, expected) => {
      expect(classifyManagerStyleQuiz(answers)).toBe(expected);
    },
  );

  it('requires all four answers before classifying a profile', () => {
    expect(() => classifyManagerStyleQuiz(['A', 'A', 'A'])).toThrow(
      'O quiz exige exatamente 4 respostas.',
    );
  });
});

describe('ManagerStyleQuizModal', () => {
  it('completes the four-answer flow before revealing the profile', () => {
    let answers: readonly ManagerStyleQuizAnswer[] = [];

    for (const [index, choice] of (['A', 'A', 'B', 'A'] as const).entries()) {
      const progress = answerManagerStyleQuiz(answers, choice);
      answers = progress.answers;
      expect(progress.resultProfile).toBe(
        index === 3 ? 'brasfoot_casual' : null,
      );
    }
  });

  it('renders an accessible dialog with the first narrative question', () => {
    const markup = renderToStaticMarkup(
      createElement(ManagerStyleQuizModal, {
        isOpen: true,
        onClose: vi.fn(),
        onApplyProfile: vi.fn(),
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('Dia do Jogo • Substituições e Ritmo');
    expect(markup).toContain('Pergunta 1 de 4');
  });
});

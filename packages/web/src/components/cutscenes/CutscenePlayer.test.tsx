import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { CutsceneContext } from '../../context/CutsceneContext.js';
import { CutscenePlayer } from './CutscenePlayer.js';

describe('CutscenePlayer - Natural Color & Hook Order Verification', () => {
  it('renders nothing when no cutscene is active without violating hook order', () => {
    const html = renderToStaticMarkup(
      <CutsceneContext.Provider
        value={{
          currentCutscene: null,
          playCutscene: () => {},
          closeCutscene: () => {},
        }}
      >
        <CutscenePlayer />
      </CutsceneContext.Provider>
    );

    expect(html).toBe('');
  });

  it('renders video with 100% pristine natural colors without SVG gradient tint', () => {
    const mockCutscene = {
      type: 'primeiro-contrato' as const,
      club: {
        id: 'club-1',
        name: 'Flamengo',
        primaryColor: '#e11d48',
        secondaryColor: '#000000',
        crestBase64: null,
      },
      data: {
        managerName: 'Professor Tático',
        salary: 150000,
      },
    };

    const html = renderToStaticMarkup(
      <CutsceneContext.Provider
        value={{
          currentCutscene: mockCutscene,
          playCutscene: () => {},
          closeCutscene: () => {},
        }}
      >
        <CutscenePlayer />
      </CutsceneContext.Provider>
    );

    // Verify video source
    expect(html).toContain('src="/cutscenes/primeiro-contrato.mp4"');

    // Verify NO SVG tint filter is applied to video
    expect(html).not.toContain('club-gradient-tint');
    expect(html).not.toContain('url(#club-gradient-tint)');

    // Verify clean UI details are rendered
    expect(html).toContain('Professor Tático');
    expect(html).toContain('Salário Inicial');
  });

  it('renders retirement cutscene with correct video source and player card', () => {
    const mockCutscene = {
      type: 'aposentadoria' as const,
      club: {
        id: 'club-1',
        name: 'Santos',
        primaryColor: '#ffffff',
        secondaryColor: '#000000',
        crestBase64: null,
      },
      data: {
        playerName: 'Veterano Lendário',
        playerOverall: 79,
        playerPosition: 'MEI',
        message: 'Pendurando as chuteiras com honra.',
      },
    };

    const html = renderToStaticMarkup(
      <CutsceneContext.Provider
        value={{
          currentCutscene: mockCutscene,
          playCutscene: () => {},
          closeCutscene: () => {},
        }}
      >
        <CutscenePlayer />
      </CutsceneContext.Provider>
    );

    expect(html).toContain('src="/cutscenes/aposentadoria.mp4"');
    expect(html).toContain('Veterano Lendário');
    expect(html).toContain('Despedida dos Gramados');
    expect(html).toContain('Pendurando as chuteiras com honra.');
  });
});

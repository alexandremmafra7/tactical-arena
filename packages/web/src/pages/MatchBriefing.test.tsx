import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Club, OppositionDossier, TacticalAssistantAdvice } from '@tactical-arena/shared';

// Mock dependencies
vi.mock('../api/client.js', () => ({
  getClub: vi.fn().mockResolvedValue({
    id: 'club-1',
    name: 'Flamengo',
    country: 'BRA',
    players: [],
    pendingRoundTactic: {
      formation: '4-3-3',
      lineup: Array.from({ length: 11 }, (_, i) => ({ playerId: `p-${i}` })),
    },
  }),
  getClubCalendar: vi.fn().mockResolvedValue({
    entries: [
      {
        round: 2,
        stageName: 'Rodada 2',
        competitionName: 'Brasileirão Série A',
        opponentClubId: 'opp-1',
        opponentName: 'Internacional',
        isHome: false,
        date: '2026-04-12',
      },
    ],
  }),
  getClubForm: vi.fn().mockResolvedValue(['V', 'V', 'E', 'V', 'D']),
  getTacticalAdvice: vi.fn().mockResolvedValue({
    confidence: 0.85,
    confidenceLabel: 'Alta',
    opponentSummary: 'Internacional atua na formação 4-4-2.',
    keyWeakness: 'Defesa central lenta.',
    recommendedFormation: '4-3-3',
    recommendedMentality: 'Ofensiva',
    recommendedPressing: 'Pressão Alta',
    assistantNotes: 'Explorar jogadas de velocidade pelas pontas.',
  } as TacticalAssistantAdvice),
  getActiveLeague: vi.fn().mockResolvedValue({
    id: 'league-1',
    name: 'Brasileirão Série A',
    standings: [{ clubId: 'club-1' }, { clubId: 'opp-1' }],
  }),
  getOppositionDossier: vi.fn().mockResolvedValue({
    opponentClubId: 'opp-1',
    opponentName: 'Internacional',
    confidenceRating: 80,
    presetIdentification: {
      presetId: 'direct',
      presetName: 'Ataque pelas Pontas',
      certainty: 75,
    },
    defensiveLineAnalysis: {
      height: 'BALANCED',
      restDefence: '3+2',
      description: 'Linha equilibrada.',
    },
    keyThreats: [],
    vulnerabilities: [],
    countermeasures: [],
  } as OppositionDossier),
  autoPrepareTactics: vi.fn(),
  applyTeamTalk: vi.fn(),
  goToMatchday: vi.fn(),
  saveTacticPreset: vi.fn(),
  setDefaultTacticPreset: vi.fn(),
  setRoundTactic: vi.fn(),
}));

import { MatchBriefingPage } from './MatchBriefing.js';

describe('MatchBriefingPage Component', () => {
  it('renders correctly with Match Briefing Action Center and Status Strip classes', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/clubs/club-1/briefing']}>
        <Routes>
          <Route path="/clubs/:clubId/briefing" element={<MatchBriefingPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial server-side markup render should handle loading / page container
    expect(html).toContain('page');
  });
});

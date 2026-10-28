import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { PreSeasonInvitationModal } from './PreSeasonInvitationModal.js';
import type { Club } from '@tactical-arena/shared';

describe('PreSeasonInvitationModal Component', () => {
  const mockClub: Club = {
    id: 'c1',
    name: 'Tactical FC',
    budget: 50_000_000,
    prestige: 85,
  } as unknown as Club;

  it('renders correctly when open', () => {
    const onClose = vi.fn();
    const onAccept = vi.fn();
    const onStay = vi.fn();

    const html = renderToStaticMarkup(
      <PreSeasonInvitationModal
        club={mockClub}
        isOpen={true}
        onClose={onClose}
        onAcceptTournament={onAccept}
        onStayAtCt={onStay}
      />
    );

    expect(html).toContain('Convites para Torneios de Pré-Temporada');
    expect(html).toContain('Florida Winter Cup');
    expect(html).toContain('Permanecer no CT');
  });

  it('renders nothing when isOpen is false', () => {
    const onClose = vi.fn();
    const onAccept = vi.fn();
    const onStay = vi.fn();

    const html = renderToStaticMarkup(
      <PreSeasonInvitationModal
        club={mockClub}
        isOpen={false}
        onClose={onClose}
        onAcceptTournament={onAccept}
        onStayAtCt={onStay}
      />
    );

    expect(html).toBe('');
  });
});

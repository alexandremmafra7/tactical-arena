import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { NegotiationRoomModal } from './NegotiationRoomModal.js';
import type { Player, Club } from '@tactical-arena/shared';

describe('NegotiationRoomModal Component', () => {
  const mockPlayer: Player = {
    id: 'p1',
    name: 'Craque Silva',
    position: 'ATT',
    overall: 88,
    age: 25,
    wage: 50_000,
    marketValue: 10_000_000,
  } as unknown as Player;

  const mockClub: Club = {
    id: 'c1',
    name: 'Tactical FC',
    budget: 50_000_000,
    prestige: 85,
  } as unknown as Club;

  it('renders correctly when open', () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    const html = renderToStaticMarkup(
      <NegotiationRoomModal
        isOpen={true}
        onClose={onClose}
        player={mockPlayer}
        club={mockClub}
        onSuccessDeal={onSuccess}
      />
    );

    expect(html).toContain('Craque Silva');
    expect(html).toContain('Mesa de Diálogo');
    expect(html).toContain('Apresentar Proposta');
  });

  it('does not render when isOpen is false', () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    const html = renderToStaticMarkup(
      <NegotiationRoomModal
        isOpen={false}
        onClose={onClose}
        player={mockPlayer}
        club={mockClub}
        onSuccessDeal={onSuccess}
      />
    );

    expect(html).toBe('');
  });
});

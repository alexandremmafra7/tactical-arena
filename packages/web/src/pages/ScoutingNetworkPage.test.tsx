import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { ScoutingNetworkPage } from './ScoutingNetworkPage.js';
import type { Club } from '@tactical-arena/shared';

describe('ScoutingNetworkPage Component', () => {
  const mockClub: Club = {
    id: 'c1',
    name: 'Tactical FC',
    budget: 50_000_000,
    prestige: 85,
  } as unknown as Club;

  it('renders scouting network page correctly', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ScoutingNetworkPage club={mockClub} />
      </MemoryRouter>
    );
    expect(html).toContain('Rede Mundial de Olheiros');
    expect(html).toContain('Equipe de Olheiros');
    expect(html).toContain('Carlos Alberto');
  });
});

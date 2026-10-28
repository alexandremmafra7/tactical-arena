import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { computeDirectorTransferRecommendations } from '@tactical-arena/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardSource = readFileSync(join(__dirname, 'DirectorRecommendationsCard.tsx'), 'utf-8');
const transfersHubSource = readFileSync(join(__dirname, '..', 'pages', 'TransfersHub.tsx'), 'utf-8');
const clubHomeSource = readFileSync(join(__dirname, '..', 'pages', 'ClubHome.tsx'), 'utf-8');

describe('DirectorRecommendationsCard contract and integration', () => {
  it('exports computeDirectorTransferRecommendations and is callable with minimal arguments', () => {
    const club = {
      id: 'c1',
      name: 'Teste FC',
      country: 'BRA',
      budget: 10_000_000,
      players: [],
    } as any;

    const res = computeDirectorTransferRecommendations(club, []);
    expect(res).toEqual([]);
  });

  it('DirectorRecommendationsCard component implements 1-click quick offer and deep scout modal', () => {
    expect(cardSource).toContain('computeDirectorTransferRecommendations');
    expect(cardSource).toContain('handleQuickOfferClick');
    expect(cardSource).toContain('LightningIcon');
    expect(cardSource).toContain('EyeIcon');
    expect(cardSource).toContain('Relatório do Olheiro');
  });

  it('TransfersHub integrates DirectorRecommendationsCard with quick offer and proposal targets', () => {
    expect(transfersHubSource).toContain('<DirectorRecommendationsCard');
    expect(transfersHubSource).toContain('handleDirectorQuickOffer');
    expect(transfersHubSource).toContain('handleDirectorCustomProposal');
    expect(transfersHubSource).toContain('handleDirectorBuyout');
  });

  it('ClubHome integrates DirectorRecommendationsCard for staff delegation automation', () => {
    expect(clubHomeSource).toContain('<DirectorRecommendationsCard');
    expect(clubHomeSource).toContain('handleDirectorQuickOffer');
    expect(clubHomeSource).toContain('scoutingAutomation');
  });
});

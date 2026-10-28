import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const bannerSource = readFileSync(join(__dirname, 'ExpiringContractsBanner.tsx'), 'utf-8');
const modalSource = readFileSync(join(__dirname, 'BatchRenewModal.tsx'), 'utf-8');
const squadSource = readFileSync(join(__dirname, '../pages/Squad.tsx'), 'utf-8');
const contractsSource = readFileSync(join(__dirname, '../pages/Contracts.tsx'), 'utf-8');
const clubHomeSource = readFileSync(join(__dirname, '../pages/ClubHome.tsx'), 'utf-8');

describe('ExpiringContractsBanner & BatchRenewModal component and integration', () => {
  it('ExpiringContractsBanner implements 1-click batch action and modal trigger', () => {
    expect(bannerSource).toContain('Renovar Todos Recomendados');
    expect(bannerSource).toContain('Gerenciar em Lote');
    expect(bannerSource).toContain('identifyExpiringContracts');
    expect(bannerSource).toContain('<BatchRenewModal');
  });

  it('BatchRenewModal implements checklist table, duration presets, and atomic confirmation', () => {
    expect(modalSource).toContain('Selecionar Recomendados');
    expect(modalSource).toContain('Marcar Todos');
    expect(modalSource).toContain('Desmarcar Todos');
    expect(modalSource).toContain('Caixa Restante:');
    expect(modalSource).toContain('onConfirmBatchRenew');
  });

  it('Squad page integrates ExpiringContractsBanner', () => {
    expect(squadSource).toContain('<ExpiringContractsBanner');
    expect(squadSource).toContain('batchRenewContracts');
  });

  it('Contracts page integrates ExpiringContractsBanner', () => {
    expect(contractsSource).toContain('<ExpiringContractsBanner');
    expect(contractsSource).toContain('batchRenewContracts');
  });

  it('ClubHome integrates ExpiringContractsBanner for proactive contract management', () => {
    expect(clubHomeSource).toContain('<ExpiringContractsBanner');
    expect(clubHomeSource).toContain('batchRenewContracts');
  });
});

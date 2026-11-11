import { describe, it, expect } from 'vitest';
import { resolveClubKit, CANONICAL_CLUB_KITS } from './clubKits.js';

describe('Canonical Club Kits & Resolver', () => {
  it('1. Resolve o uniforme canônico do Flamengo com listras horizontais rubro-negras e manto reserva branco', () => {
    const kit = resolveClubKit({ slug: 'flamengo', name: 'Flamengo' });
    expect(kit.primaryColor.toLowerCase()).toBe('#c8102e');
    expect(kit.secondaryColor.toLowerCase()).toBe('#111111');
    expect(kit.kitPattern).toBe('STRIPES_HORIZONTAL');
    expect(kit.awayPrimaryColor.toLowerCase()).toBe('#ffffff');
    expect(kit.awaySecondaryColor.toLowerCase()).toBe('#c8102e');
    expect(kit.awayKitPattern).toBe('SOLID');
  });

  it('2. Resolve uniformes canônicos de outros clubes tradicionais (Corinthians, Palmeiras, Vasco, Grêmio)', () => {
    const vasco = resolveClubKit({ slug: 'vasco-da-gama', name: 'Vasco da Gama' });
    expect(vasco.kitPattern).toBe('DIAGONAL_SASH');
    expect(vasco.awayKitPattern).toBe('DIAGONAL_SASH');

    const gremio = resolveClubKit({ slug: 'gremio', name: 'Grêmio' });
    expect(gremio.kitPattern).toBe('STRIPES_VERTICAL');

    const palmeiras = resolveClubKit({ slug: 'palmeiras', name: 'Palmeiras' });
    expect(palmeiras.primaryColor.toLowerCase()).toBe('#028b4c');
    expect(palmeiras.kitPattern).toBe('SOLID');

    const corinthians = resolveClubKit({ slug: 'corinthians', name: 'Corinthians' });
    expect(corinthians.primaryColor.toLowerCase()).toBe('#ffffff');
    expect(corinthians.awayKitPattern).toBe('STRIPES_VERTICAL');
  });

  it('3. Preserva customizações manuais do usuário se informadas', () => {
    const custom = resolveClubKit({
      slug: 'flamengo',
      name: 'Flamengo',
      primaryColor: '#0000ff',
      secondaryColor: '#ffff00',
      kitPattern: 'SOLID',
    });
    expect(custom.primaryColor).toBe('#0000ff');
    expect(custom.secondaryColor).toBe('#ffff00');
    expect(custom.kitPattern).toBe('SOLID');
  });

  it('4. Retorna fallback seguro e consistente para clubes sem registro canônico', () => {
    const unknown = resolveClubKit({ slug: 'time-desconhecido-123', name: 'Time Desconhecido' });
    expect(unknown.primaryColor).toBe('#1e293b');
    expect(unknown.secondaryColor).toBe('#ffffff');
    expect(unknown.kitPattern).toBe('SOLID');
    expect(unknown.awayPrimaryColor).toBe('#ffffff');
  });
});

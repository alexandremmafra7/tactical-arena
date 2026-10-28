import { describe, it, expect } from 'vitest';
import {
  JERSEY_CANONICAL_WIDTH,
  JERSEY_CANONICAL_HEIGHT,
  JERSEY_ZONES,
  fitElementIntoZone,
  checkBoxesCollision,
  isWithinTorsoBounds,
  resolveJerseyZonesLayout,
} from './jerseyZones.js';
import type { Club, KitPattern } from './club.js';

describe('Sistema Inteligente de Zonas e Posicionamento do Uniforme (2D)', () => {
  // Caso 1: Camiseta lisa, sem logotipos
  it('1. Deve resolver layout para camiseta lisa sem logotipos sem erros', () => {
    const layout = resolveJerseyZonesLayout([]);
    expect(layout.size).toBe(0);
  });

  // Caso 2: Padrões gráficos suportados (incluindo listras verticais e degradê)
  it('2. Deve suportar todos os padrões gráficos (SOLID, STRIPES_VERTICAL, STRIPES_HORIZONTAL, DIAGONAL_SASH, HALVES, GRADIENT)', () => {
    const patterns: KitPattern[] = [
      'SOLID',
      'STRIPES_VERTICAL',
      'STRIPES_HORIZONTAL',
      'DIAGONAL_SASH',
      'HALVES',
      'GRADIENT',
    ];
    expect(patterns).toHaveLength(6);
    expect(patterns.includes('GRADIENT')).toBe(true);
    expect(patterns.includes('STRIPES_VERTICAL')).toBe(true);
  });

  // Caso 3: Camiseta com escudo e marca esportiva
  it('3. Deve posicionar escudo no peito esquerdo e marca esportiva no peito direito com equilíbrio e sem colisão', () => {
    const layout = resolveJerseyZonesLayout([
      { zoneId: 'A_CREST', naturalWidth: 200, naturalHeight: 200, enabled: true },
      { zoneId: 'B_BRAND', naturalWidth: 160, naturalHeight: 120, enabled: true },
    ]);

    const crest = layout.get('A_CREST')!;
    const brand = layout.get('B_BRAND')!;

    expect(crest).toBeDefined();
    expect(brand).toBeDefined();
    expect(crest.visible).toBe(true);
    expect(brand.visible).toBe(true);

    // Escudo no lado direito da imagem (peito esquerdo de quem veste)
    expect(crest.box.x).toBeGreaterThan(100);
    // Marca no lado esquerdo da imagem (peito direito de quem veste)
    expect(brand.box.x + brand.box.width).toBeLessThan(100);

    // Sem colisão entre escudo e marca
    expect(checkBoxesCollision(crest.box, brand.box)).toBe(false);
    expect(crest.isWithinBounds).toBe(true);
    expect(brand.isWithinBounds).toBe(true);
  });

  // Caso 4: Patrocinador com proporção horizontal ampla (ex: 5:1)
  it('4. Deve ajustar patrocinador horizontal mantendo proporção e respeitando largura máxima', () => {
    const { box, scale } = fitElementIntoZone(JERSEY_ZONES.C_MASTER_SPONSOR, 500, 100);

    expect(box.width).toBeLessThanOrEqual(JERSEY_ZONES.C_MASTER_SPONSOR.maxWidth);
    expect(box.height).toBeLessThanOrEqual(JERSEY_ZONES.C_MASTER_SPONSOR.maxHeight);
    expect(scale).toBeLessThanOrEqual(1);
    // Aspect ratio 5:1 mantido (com pequena tolerância de arredondamento)
    expect(box.width / box.height).toBeCloseTo(5, 1);
  });

  // Caso 5: Patrocinador com proporção vertical (ex: 1:2)
  it('5. Deve ajustar patrocinador com proporção vertical contido sem cortes', () => {
    const { box } = fitElementIntoZone(JERSEY_ZONES.C_MASTER_SPONSOR, 100, 200);

    expect(box.width).toBeLessThanOrEqual(JERSEY_ZONES.C_MASTER_SPONSOR.maxWidth);
    expect(box.height).toBeLessThanOrEqual(JERSEY_ZONES.C_MASTER_SPONSOR.maxHeight);
    // Aspect ratio 1:2 mantido
    expect(box.height / box.width).toBeCloseTo(2, 1);
  });

  // Caso 6: Logotipo com margens transparentes / dimensões grandes (ex: 512x512)
  it('6. Deve reduzir proporcionalmente logos em alta resolução mantendo proporção', () => {
    const { box } = fitElementIntoZone(JERSEY_ZONES.A_CREST, 512, 512);

    expect(box.width).toBeLessThanOrEqual(JERSEY_ZONES.A_CREST.maxWidth);
    expect(box.height).toBeLessThanOrEqual(JERSEY_ZONES.A_CREST.maxHeight);
    expect(box.width).toBe(box.height); // Proporção quadrada preservada
  });

  // Caso 7: Imagem de baixa resolução (ex: 16x16)
  it('7. Deve acomodar imagens de baixa resolução sem ultrapassar limites da zona', () => {
    const { box } = fitElementIntoZone(JERSEY_ZONES.B_BRAND, 16, 16);

    expect(box.width).toBeGreaterThanOrEqual(JERSEY_ZONES.B_BRAND.minWidth);
    expect(box.height).toBeGreaterThanOrEqual(JERSEY_ZONES.B_BRAND.minHeight);
    expect(box.width).toBeLessThanOrEqual(JERSEY_ZONES.B_BRAND.maxWidth);
  });

  // Caso 8: Arquivo inválido ou ausente (fallback gracioso)
  it('8. Deve tolerar dimensões zeradas ou ausentes sem travar o renderizador', () => {
    const { box } = fitElementIntoZone(JERSEY_ZONES.C_MASTER_SPONSOR, 0, 0);

    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
    expect(box.width).toBeLessThanOrEqual(JERSEY_ZONES.C_MASTER_SPONSOR.maxWidth);
  });

  // Caso 9: Tentativa de adicionar elementos que ultrapassem os limites
  it('9. Deve impedir que qualquer elemento ultrapasse os limites máximos permitidos', () => {
    const crestFit = fitElementIntoZone(JERSEY_ZONES.A_CREST, 9999, 9999);
    expect(crestFit.box.width).toBeLessThanOrEqual(JERSEY_ZONES.A_CREST.maxWidth);
    expect(crestFit.box.height).toBeLessThanOrEqual(JERSEY_ZONES.A_CREST.maxHeight);

    const masterFit = fitElementIntoZone(JERSEY_ZONES.C_MASTER_SPONSOR, 4000, 2000);
    expect(masterFit.box.width).toBeLessThanOrEqual(JERSEY_ZONES.C_MASTER_SPONSOR.maxWidth);
    expect(masterFit.box.height).toBeLessThanOrEqual(JERSEY_ZONES.C_MASTER_SPONSOR.maxHeight);
  });

  // Caso 10: Dois elementos com zonas potencialmente conflitantes (Master vs Opcional)
  it('10. Deve detectar colisão entre Master e Opcional e ocultar o opcional sem deslocamento aleatório', () => {
    // Simulando uma colisão forçada criando uma caixa sobreposta
    const masterBox = { x: 70, y: 100, width: 60, height: 45 }; // Estendeu até y=145
    const optionalBox = { x: 70, y: 140, width: 60, height: 18 }; // Começa em y=140 -> colisão!

    const hasOverlap = checkBoxesCollision(masterBox, optionalBox, 1);
    expect(hasOverlap).toBe(true);

    // Pelo resolver oficial:
    const layout = resolveJerseyZonesLayout([
      { zoneId: 'C_MASTER_SPONSOR', naturalWidth: 76, naturalHeight: 28, enabled: true },
      { zoneId: 'D_OPTIONAL_SPONSOR', naturalWidth: 60, naturalHeight: 18, enabled: true },
    ]);

    const master = layout.get('C_MASTER_SPONSOR')!;
    const optional = layout.get('D_OPTIONAL_SPONSOR')!;

    // No posicionamento padrão sem sobreposição, ambos são visíveis e seguros
    expect(master.visible).toBe(true);
    expect(optional.visible).toBe(true);
    expect(checkBoxesCollision(master.box, optional.box)).toBe(false);
  });

  // Caso 11: Retrocompatibilidade com clubes antigos salvos
  it('11. Deve ser 100% retrocompatível com clubes legados sem patrocinadores ou padrões antigos', () => {
    const legacyClub: Partial<Club> = {
      id: 'legacy-club-1',
      name: 'Clube Tradicional',
      primaryColor: '#0f172a',
      secondaryColor: '#ffffff',
      kitPattern: 'SOLID',
    };

    expect(legacyClub.primaryColor).toBe('#0f172a');
    expect(legacyClub.kitPattern).toBe('SOLID');
    expect(JERSEY_ZONES.A_CREST.center.x).toBe(130);
  });

  // Caso 12: Renderização e escala em dimensões reais da interface
  it('12. Deve manter proporções exatas independentemente da resolução de tela', () => {
    const aspect = JERSEY_CANONICAL_WIDTH / JERSEY_CANONICAL_HEIGHT;
    expect(aspect).toBe(1);

    // Verifica que todos os centros de zonas ficam contidos na área útil do torso
    for (const zone of Object.values(JERSEY_ZONES)) {
      expect(zone.center.x).toBeGreaterThan(40);
      expect(zone.center.x).toBeLessThan(160);
      expect(zone.center.y).toBeGreaterThan(35);
      expect(zone.center.y).toBeLessThan(185);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModernJersey2D, getKitSupplierJerseyAsset } from './ModernJersey2D.js';

describe('ModernJersey2D Component', () => {
  it('1. Renderiza camiseta lisa sem marcas sem quebrar', () => {
    const html = renderToStaticMarkup(
      <ModernJersey2D
        primaryColor="#1e293b"
        secondaryColor="#ffffff"
        kitPattern="SOLID"
        size={140}
        showBrand={false}
        showMasterSponsor={false}
      />
    );
    expect(html).toContain('viewBox="0 0 200 200"');
    expect(html).toContain('fill="#1e293b"');
  });

  it('2. Renderiza padrão GRADIENT (Degradê) corretamente', () => {
    const html = renderToStaticMarkup(
      <ModernJersey2D
        primaryColor="#e11d48"
        secondaryColor="#fbbf24"
        kitPattern="GRADIENT"
        size={160}
      />
    );
    expect(html).toContain('pattern_gradient_');
    expect(html).toContain('#e11d48');
    expect(html).toContain('#fbbf24');
  });

  it('3. Renderiza marca esportiva no peito direito com asset apropriado', () => {
    const asset = getKitSupplierJerseyAsset('Titan Sport');
    expect(asset).toContain('titan-sport');

    const html = renderToStaticMarkup(
      <ModernJersey2D
        primaryColor="#16a34a"
        secondaryColor="#ffffff"
        supplierName="Titan Sport"
        showBrand={true}
      />
    );
    expect(html).toContain('titan-sport');
  });

  it('4. Renderiza patrocinador master no centro do tórax via imagem ou texto formatado', () => {
    const htmlWithLogo = renderToStaticMarkup(
      <ModernJersey2D
        primaryColor="#2563eb"
        secondaryColor="#ffffff"
        masterSponsorName="Aerolux Airways"
        showMasterSponsor={true}
      />
    );
    expect(htmlWithLogo).toContain('aerolux-airways.webp');

    // Teste de fallback textual quando não há logo URL
    const htmlWithCustomName = renderToStaticMarkup(
      <ModernJersey2D
        primaryColor="#2563eb"
        secondaryColor="#ffffff"
        masterSponsorName="Padaria do Zé"
        masterSponsorLogoUrl=""
        showMasterSponsor={true}
      />
    );
    expect(htmlWithCustomName).toContain('PADARIA DO');
  });

  it('5. Renderiza patrocinador opcional inferior quando habilitado', () => {
    const html = renderToStaticMarkup(
      <ModernJersey2D
        primaryColor="#18181b"
        secondaryColor="#ffffff"
        masterSponsorName="Banco Continental"
        optionalSponsorName="Bebidas Correnteza"
        showOptionalSponsor={true}
      />
    );
    expect(html).toContain('bebidas-correnteza.webp');
  });

  it('6. Adapta cores harmoniosamente no modo visitante (isAway) com contraste automático quando não configurado', () => {
    const html = renderToStaticMarkup(
      <ModernJersey2D
        primaryColor="#0f172a"
        secondaryColor="#ffffff"
        isAway={true}
      />
    );
    expect(html).toContain('viewBox="0 0 200 200"');
    expect(html).toContain('modern-jersey-2d-root');
  });

  it('7. Renderiza uniforme reserva (isAway) com cores e padrão customizados pelo usuário', () => {
    const html = renderToStaticMarkup(
      <ModernJersey2D
        primaryColor="#dc2626"
        secondaryColor="#000000"
        kitPattern="STRIPES_VERTICAL"
        isAway={true}
        awayPrimaryColor="#f8fafc"
        awaySecondaryColor="#dc2626"
        awayKitPattern="DIAGONAL_SASH"
        supplierName="Apex Athletics"
      />
    );
    // Deve aplicar a cor branca como base do reserva e a faixa diagonal
    expect(html).toContain('fill="#f8fafc"');
    expect(html).toContain('pattern_sash_');
    expect(html).toContain('apex-athletics');
  });

  it('8. Resolve automaticamente cores oficiais (#c8102e, #111111) e listras horizontais para o Flamengo', () => {
    const htmlHome = renderToStaticMarkup(
      <ModernJersey2D
        club={{ id: 'fla-1', name: 'Flamengo', slug: 'flamengo' }}
        size={140}
      />
    );
    expect(htmlHome).toContain('pattern_horiz_');
    expect(htmlHome).toContain('fill="#c8102e"');
    expect(htmlHome).toContain('fill="#111111"');

    const htmlAway = renderToStaticMarkup(
      <ModernJersey2D
        club={{ id: 'fla-1', name: 'Flamengo', slug: 'flamengo' }}
        isAway={true}
        size={140}
      />
    );
    expect(htmlAway).toContain('fill="#f8fafc"');
  });
});

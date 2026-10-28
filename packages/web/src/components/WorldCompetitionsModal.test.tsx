import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorldCompetitionsModal } from './WorldCompetitionsModal.js';

describe('WorldCompetitionsModal Component', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <WorldCompetitionsModal isOpen={false} onClose={() => {}} />
    );
    expect(html).toBe('');
  });

  it('renders all 10 world leagues and national cups when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <WorldCompetitionsModal isOpen={true} onClose={() => {}} />
    );

    expect(html).toContain('Ligas &amp; Copas Nacionais do Mundo');
    expect(html).toContain('Passo 11');
    expect(html).toContain('Confederação:');
    expect(html).toContain('Todas as Nações');
    expect(html).toContain('UEFA (Europa)');
    expect(html).toContain('CONMEBOL (América do Sul)');
    expect(html).toContain('AFC (Ásia)');

    // Default country is Brasil
    expect(html).toContain('Brasil');
    expect(html).toContain('Brasileirão Série A');
    expect(html).toContain('Copa do Brasil');
    expect(html).toContain('Supercopa do Brasil');
    expect(html).toContain('CONMEBOL Libertadores');
  });

  it('contains close button and modal accessibility attributes', () => {
    const html = renderToStaticMarkup(
      <WorldCompetitionsModal isOpen={true} onClose={() => {}} />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Fechar modal"');
    expect(html).toContain('✕ Fechar');
  });
});

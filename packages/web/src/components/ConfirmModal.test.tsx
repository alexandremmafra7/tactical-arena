import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfirmModal } from './ConfirmModal.js';

describe('ConfirmModal Component', () => {
  it('does not render anything when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ConfirmModal
        isOpen={false}
        title="Dispensar Atleta"
        message="Tem certeza?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders modal dialog with custom title and message when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <ConfirmModal
        isOpen={true}
        title="Dispensar Promessa"
        message="Deseja dispensar Eduardo Santos?"
        confirmLabel="Dispensar Atleta"
        cancelLabel="Voltar"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('Dispensar Promessa');
    expect(html).toContain('Deseja dispensar Eduardo Santos?');
    expect(html).toContain('Dispensar Atleta');
    expect(html).toContain('Voltar');
  });
});

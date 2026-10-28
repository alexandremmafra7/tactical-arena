import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangleIcon } from './icons/AppIcons.js';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Global Error Boundary capturou um erro não tratado:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Erro desconhecido na renderização.';
      const errorStack = this.state.error?.stack || '';

      return (
        <div className="page centered" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div
            className="card"
            style={{
              maxWidth: 620,
              margin: '0 auto',
              background: '#141217',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
              borderRadius: 16,
              padding: '28px 24px',
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <AlertTriangleIcon size={48} color="#ef4444" />
            </div>
            <h2 style={{ color: 'var(--danger)', marginBottom: 8, fontSize: '1.4rem' }}>
              Ops! Algo inesperado aconteceu em campo.
            </h2>
            <p className="muted" style={{ marginBottom: 16, fontSize: '0.9rem', lineHeight: 1.5 }}>
              O Tactical Arena FC encontrou um erro na interface e evitou uma falha geral. Seus dados e saves continuam seguros.
            </p>

            {/* Error Message & Stack Details */}
            <div
              style={{
                textAlign: 'left',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 20,
                fontSize: '0.82rem',
                fontFamily: 'monospace',
                color: '#f87171',
                maxHeight: 180,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <strong>{errorMsg}</strong>
              {errorStack && (
                <details style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.74rem' }}>
                  <summary style={{ cursor: 'pointer', color: '#cbd5e1' }}>Ver pilha de execução (Stack)</summary>
                  <pre style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{errorStack}</pre>
                </details>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary-action"
                onClick={() => {
                  sessionStorage.clear();
                  window.location.href = '/';
                }}
                style={{ padding: '10px 20px', fontSize: '0.95rem' }}
              >
                Reiniciar e Voltar ao Início
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(`${errorMsg}\n\n${errorStack}`);
                    alert('Erro copiado para a área de transferência!');
                  } catch {
                    // clipboard fallback
                  }
                }}
                style={{ padding: '10px 16px', fontSize: '0.9rem' }}
              >
                Copiar Erro
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (confirm('Deseja limpar todos os dados temporários em cache e reiniciar? Seus arquivos de save no banco não serão apagados.')) {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = '/';
                  }
                }}
                style={{ padding: '10px 16px', fontSize: '0.85rem', opacity: 0.8 }}
                title="Limpar cache do navegador e reiniciar sessão"
              >
                Limpar Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

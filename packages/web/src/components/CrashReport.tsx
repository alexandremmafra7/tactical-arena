import React from 'react';

/**
 * The screen that appears instead of a blank one.
 *
 * The app had no error boundary anywhere, which means a render error unmounts the whole tree and leaves the
 * stadium background and nothing else. That is unreportable by design: on a phone there is no console to
 * open, so "a tela fica vazia" is the entire bug report the player can give, whatever actually went wrong.
 *
 * This catches three different kinds of failure, because a boundary alone only sees the first:
 *  - errors thrown while rendering, via `componentDidCatch`
 *  - errors thrown outside React, via `window.onerror`
 *  - rejected promises nobody handled, via `unhandledrejection` — which is where an offline-mode failure
 *    lands, since every screen loads its data in an async effect
 *
 * The escape hatch matters as much as the message. Local career data lives in `localStorage`, so a save
 * written by an older build can be what breaks the render, and a player with no way to clear it has a game
 * that never opens again.
 */
interface CrashState {
  error: Error | null;
  source: string;
}

const LOCAL_KEYS = ['tactical_arena_offline_save_v1', 'token', 'game_network_mode', 'custom_api_base'];

export class CrashReport extends React.Component<{ children: React.ReactNode }, CrashState> {
  state: CrashState = { error: null, source: 'render' };

  static getDerivedStateFromError(error: Error): CrashState {
    return { error, source: 'render' };
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleRejection);
  }

  /**
   * Only takes over the screen for an error that actually broke something. A failed image or a background
   * fetch that the app already handles must not replace a working game with a crash page.
   */
  handleWindowError = (event: ErrorEvent) => {
    if (!event.error) return;
    this.setState((prev) => (prev.error ? prev : { error: event.error as Error, source: 'janela' }));
  };

  handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (!(reason instanceof Error)) return;
    this.setState((prev) => (prev.error ? prev : { error: reason, source: 'promessa' }));
  };

  details(): string {
    const { error, source } = this.state;
    return [
      `Origem: ${source}`,
      `Erro: ${error?.name}: ${error?.message}`,
      `Tela: ${window.location.pathname}`,
      `Navegador: ${navigator.userAgent}`,
      '',
      error?.stack ?? '(sem pilha)',
    ].join('\n');
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ minHeight: '100vh', padding: 20, color: '#e2e8f0', background: '#0b0a0f', overflowY: 'auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', color: '#f87171', margin: '0 0 8px', fontSize: '1.5rem' }}>
          O jogo travou
        </h1>
        <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: '#94a3b8' }}>
          Alguma coisa quebrou e a tela não pôde ser desenhada. Os detalhes abaixo dizem o que foi.
        </p>

        <pre
          style={{
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8,
            padding: 12, fontSize: '0.72rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: '46vh', overflowY: 'auto', color: '#fca5a5',
          }}
        >
          {this.details()}
        </pre>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <button
            className="btn-secondary"
            onClick={() => navigator.clipboard?.writeText(this.details()).catch(() => undefined)}
          >
            Copiar detalhes
          </button>
          <button className="btn-secondary" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
          {/*
            The way back in when the stored career is what breaks the render. Destructive, so it says so and
            asks first: it throws away the offline save along with the session.
          */}
          <button
            className="btn-primary"
            onClick={() => {
              if (!window.confirm('Isso apaga a carreira salva neste aparelho. Continuar?')) return;
              try {
                for (const key of LOCAL_KEYS) localStorage.removeItem(key);
              } catch {
                // Storage can be blocked entirely, which is itself a reason the game would not open.
              }
              window.location.href = '/';
            }}
          >
            Limpar dados e recomeçar
          </button>
        </div>
      </div>
    );
  }
}

import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listMyClubs, login, register, setOfflineMode } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { GameHeader } from '../components/GameHeader.js';
import { ServerSettingsModal } from '../components/ServerSettingsModal.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      setOfflineMode(false);
      const result = mode === 'login' ? await login(email, password) : await register(email, password);
      signIn(result.token, result.userId);
      const clubs = await listMyClubs().catch(() => []);
      navigate(clubs.length > 0 ? `/clubs/${clubs[0].id}` : '/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickGuest() {
    setError(null);
    setLoading(true);
    try {
      setOfflineMode(false);
      const guestEmail = 'treinador@tacticalarena.local';
      const guestPass = 'treinador123';
      let result;
      try {
        result = await login(guestEmail, guestPass);
      } catch {
        result = await register(guestEmail, guestPass);
      }
      signIn(result.token, result.userId);
      const clubs = await listMyClubs().catch(() => []);
      navigate(clubs.length > 0 ? `/clubs/${clubs[0].id}` : '/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="start-screen">
      <GameHeader />

      <div className="start-menu-panel">
        <div className="start-menu-clip" />

        <button
          type="button"
          className="start-menu-item primary"
          style={{ marginBottom: '12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff' }}
          onClick={() => navigate('/')}
        >
          Jogar Carreira Offline (Modo Local)
        </button>

        <button
          type="button"
          className="start-menu-item"
          style={{ marginBottom: '16px' }}
          onClick={handleQuickGuest}
          disabled={loading}
        >
          Entrar como Convidado Local
        </button>

        <form onSubmit={handleSubmit} className="login-form">
          <h2>{mode === 'login' ? 'Entrar com Email' : 'Criar conta'}</h2>
          <input
            className="clipboard-input"
            type="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="clipboard-input"
            type="password"
            placeholder="Senha"
            aria-label="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && (
            <div>
              <p className="error">{error}</p>
              <button
                type="button"
                onClick={() => setServerSettingsOpen(true)}
                style={{
                  background: 'rgba(212,175,55,0.15)',
                  border: '1px solid #ffd700',
                  color: '#ffd700',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  marginTop: 6
                }}
              >
                Configurar Endereço IP do Servidor
              </button>
            </div>
          )}
          <button type="submit" className="start-menu-item" disabled={loading}>
            <span>▶</span> {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center' }}>
        <Link className="btn-secondary" to="/">
          ← Início
        </Link>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setServerSettingsOpen(true)}
        >
          Configurar Servidor
        </button>
      </div>

      <ServerSettingsModal
        isOpen={serverSettingsOpen}
        onClose={() => setServerSettingsOpen(false)}
        onConnected={() => setError(null)}
      />
    </div>
  );
}

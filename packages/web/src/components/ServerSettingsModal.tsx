import { useState, useEffect } from 'react';
import { checkServerHealth, getApiBase, setCustomApiBase, setOfflineMode } from '../api/client.js';
import { SettingsIcon } from './icons/AppIcons.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export function ServerSettingsModal({ isOpen, onClose, onConnected }: Props) {
  const [serverUrl, setServerUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setServerUrl(getApiBase());
      setStatus('idle');
      setStatusMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleTest() {
    setTesting(true);
    setStatus('idle');
    setStatusMsg('');
    const ok = await checkServerHealth(serverUrl);
    setTesting(false);
    if (ok) {
      setStatus('success');
      setStatusMsg('Conexão estabelecida com sucesso! O servidor do jogo está online.');
    } else {
      setStatus('error');
      setStatusMsg('Não foi possível conectar ao servidor. Verifique se o servidor está rodando no PC (porta 3001) e se o celular está conectado na mesma rede Wi-Fi.');
    }
  }

  async function handleSave() {
    setCustomApiBase(serverUrl);
    setTesting(true);
    const ok = await checkServerHealth(serverUrl);
    setTesting(false);
    if (ok) {
      setOfflineMode(false);
      setStatus('success');
      setStatusMsg('🟢 Servidor salvo e conectado com sucesso!');
      if (onConnected) onConnected();
      setTimeout(() => {
        onClose();
      }, 700);
    } else {
      setStatus('error');
      setStatusMsg('Endereço salvo, porém o servidor não respondeu ao teste de conexão.');
    }
  }

  function handleReset() {
    setCustomApiBase('');
    setServerUrl(getApiBase());
    setStatus('idle');
    setStatusMsg('Restaurado para o endereço padrão.');
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, width: '92%', borderRadius: 16, background: '#18141d', border: '1px solid rgba(212,175,55,0.4)', padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#ffd700', fontFamily: 'var(--font-display)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SettingsIcon size={18} color="#ffd700" />
            Conexão com o Servidor
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: 16 }}>
          No celular, o jogo se conecta ao servidor no seu computador ou na nuvem para carregar campeonatos, times e dados de carreira.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, fontWeight: 700 }}>
            Endereço IP / URL do Servidor:
          </label>
          <input
            type="text"
            className="clipboard-input"
            value={serverUrl}
            onChange={(e) => {
              setServerUrl(e.target.value);
              setStatus('idle');
            }}
            placeholder="http://192.168.1.139:3001"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              background: '#0d0a10',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              fontSize: '0.9rem',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {statusMsg && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              fontSize: '0.8rem',
              lineHeight: 1.4,
              marginBottom: 16,
              background: status === 'success' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
              border: `1px solid ${status === 'success' ? '#4ade80' : '#f87171'}`,
              color: status === 'success' ? '#86efac' : '#fca5a5'
            }}
          >
            {statusMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            style={{
              flex: '1 1 auto',
              padding: '10px 14px',
              borderRadius: 8,
              background: '#2a2435',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            {testing ? 'Testando...' : 'Testar Conexão'}
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={testing}
            style={{
              flex: '1 1 auto',
              padding: '10px 16px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)',
              border: 'none',
              color: '#1a1400',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Salvar e Conectar
          </button>
        </div>

        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '0.72rem',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            Restaurar Endereço Padrão (Wi-Fi Local)
          </button>
        </div>
      </div>
    </div>
  );
}

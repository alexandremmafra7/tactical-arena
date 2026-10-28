import { useState, useEffect } from 'react';
import { exportAllGameDataJson, wipeAllGameData } from '../lib/privacyService.js';
import { ShieldIcon } from './icons/AppIcons.js';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showFullPolicy, setShowFullPolicy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-label="Privacidade e Direitos LGPD"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(8px)',
        padding: 16,
      }}
    >
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: '95%',
          maxHeight: '90vh',
          borderRadius: 20,
          background: '#15111b',
          border: '1px solid rgba(212,175,55,0.4)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          color: '#e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#ffd700', fontFamily: 'var(--font-display, inherit)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldIcon size={20} color="#ffd700" /> Privacidade & LGPD (Lei nº 13.709/2018)
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!showFullPolicy ? (
            <>
              <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 12, padding: 12, fontSize: '0.82rem', lineHeight: 1.5, color: '#f1f5f9' }}>
                No <strong>Tactical Arena FC</strong>, suas carreiras, táticas e times customizados pertencem exclusivamente a você.
              </div>

              <div style={{ background: '#0e0b12', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: 14 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#38bdf8' }}>
                  Armazenamento de Carreira
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  No modo Offline, todas as temporadas, transferências e elencos ficam salvos exclusivamente no armazenamento local deste aparelho.
                </p>
              </div>

              <div style={{ background: '#0e0b12', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: 14 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', color: '#4ade80' }}>
                  Conexão com Servidor
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Ao jogar online ou conectar em rede local, apenas os dados indispensáveis para a sincronização das partidas são transmitidos ao servidor configurado.
                </p>
              </div>

              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#cbd5e1' }}>
                  Seus Direitos como Titular (Art. 18 LGPD)
                </h4>

                <button
                  type="button"
                  onClick={exportAllGameDataJson}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: '#1e1826',
                    border: '1px solid rgba(212,175,55,0.3)',
                    color: '#ffd700',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>Exportar Meus Dados de Carreira (JSON)</span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Art. 18, V</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowFullPolicy(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#93c5fd',
                    fontSize: '0.8rem',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    textAlign: 'center',
                    padding: 4,
                  }}
                >
                  Ler Política de Privacidade Completa
                </button>
              </div>

              <div style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.35)',
                      color: '#f87171',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Apagar Todos os Saves e Dados Locais (Art. 18, VI)
                  </button>
                ) : (
                  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#fca5a5', fontWeight: 600 }}>
                      Tem certeza? Isso apagará todas as carreiras salvas e times personalizados deste aparelho de forma definitiva.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        style={{ flex: 1, padding: 8, borderRadius: 8, background: '#1e1826', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={wipeAllGameData}
                        style={{ flex: 1, padding: 8, borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Sim, Apagar Tudo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.82rem', lineHeight: 1.6, color: '#cbd5e1' }}>
              <button
                type="button"
                onClick={() => setShowFullPolicy(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffd700', fontSize: '0.8rem', cursor: 'pointer', marginBottom: 10, padding: 0 }}
              >
                ← Voltar às opções
              </button>
              <h3 style={{ margin: '0 0 8px 0', color: '#ffd700', fontSize: '1rem' }}>Política de Privacidade — Tactical Arena FC</h3>
              <p><strong>1. Base Legal:</strong> Execução de Contrato (Art. 7º, V da Lei 13.709/2018) para a experiência de simulação esportiva e gerenciamento tático.</p>
              <p><strong>2. Armazenamento Local:</strong> Os arquivos de save e customizações ficam guardados na memória do seu dispositivo. Nenhum dado financeiro ou sensível é coletado.</p>
              <p><strong>3. Comunicação de Rede:</strong> O jogo pode se conectar a um servidor local ou dedicado estritamente para sincronizar campeonatos e partidas multiplayer.</p>
              <p><strong>4. Direitos do Titular:</strong> Você pode exportar seus arquivos em JSON ou solicitar a eliminação completa a qualquer instante.</p>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              background: '#ffd700',
              border: 'none',
              color: '#0d0a10',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

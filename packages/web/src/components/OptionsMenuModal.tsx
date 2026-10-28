import { useState, useEffect } from 'react';
import { deleteSave, listSaves } from '../api/client.js';
import type { ElectronAppInfo } from '../electron.js';
import { soundFx } from '../lib/soundEffects.js';
import { fullscreenHelper } from '../lib/fullscreen.js';
import {
  type UiScaleOption,
  applyUiScale,
  getSavedUiScale,
  getCurrentUiScale,
  onUiScaleChange,
} from '../lib/uiScale.js';

interface OptionsMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OptionsMenuModal({ isOpen, onClose }: OptionsMenuModalProps) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [appInfo, setAppInfo] = useState<ElectronAppInfo | null>(null);
  const [soundMuted, setSoundMuted] = useState(soundFx.isMuted());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uiScale, setUiScale] = useState<UiScaleOption>(getSavedUiScale());
  const [scaleFactor, setScaleFactor] = useState<number>(getCurrentUiScale().factor);

  useEffect(() => {
    if (!isOpen) return;
    fullscreenHelper.isFullscreen().then(setIsFullscreen);
    const unsubFull = fullscreenHelper.onFullscreenChange((full) => {
      setIsFullscreen(full);
    });
    const unsubScale = onUiScaleChange((opt, factor) => {
      setUiScale(opt);
      setScaleFactor(factor);
    });
    return () => {
      unsubFull();
      unsubScale();
    };
  }, [isOpen]);

  async function handleToggleFullscreen() {
    const next = await fullscreenHelper.toggleFullscreen();
    setIsFullscreen(next);
  }

  function handleSelectScale(option: UiScaleOption) {
    const factor = applyUiScale(option);
    setUiScale(option);
    setScaleFactor(factor);
  }

  if (!isOpen) return null;

  function toggleSound() {
    const next = !soundMuted;
    soundFx.setMuted(next);
    setSoundMuted(next);
    if (!next) {
      soundFx.playWhistle('short');
    }
  }

  async function handleSaveGame() {
    setBusy(true);
    setFeedback(null);
    try {
      if (window.electronAPI?.saveGame) {
        const result = await window.electronAPI.saveGame();
        setFeedback(result.ok ? 'Jogo salvo com sucesso! Cópia de segurança criada.' : (result.error ?? 'Erro ao salvar.'));
      } else {
        setFeedback('Jogo salvo automaticamente na sua sessão.');
      }
    } catch (err) {
      setFeedback(`Erro ao salvar: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleQuitGame() {
    if (window.electronAPI?.quitGame) {
      await window.electronAPI.quitGame();
    } else {
      window.location.href = '/';
    }
  }

  async function handleDeleteCareer() {
    setBusy(true);
    setFeedback(null);
    try {
      const { currentSaveId } = await listSaves();
      if (currentSaveId) {
        await deleteSave(currentSaveId);
      }
      window.location.href = '/';
    } catch (err) {
      setFeedback(`Erro ao excluir: ${(err as Error).message}`);
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  async function handleShowVersion() {
    setFeedback(null);
    if (window.electronAPI?.getAppInfo) {
      const info = await window.electronAPI.getAppInfo();
      setAppInfo(info);
    } else {
      setAppInfo({
        name: 'Tactical Arena FC',
        version: '0.1.0',
        platform: 'web',
        electron: '44.9.0',
        chrome: '128.0',
      });
    }
  }

  return (
    <div className="options-modal-backdrop" onClick={onClose} role="dialog" aria-label="Menu de Opções">
      <div className="options-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="options-modal-header">
          <div className="options-modal-title">
            <img src="/cards/options.png" alt="" className="options-modal-card-img" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <div>
              <h2>Menu de Opções</h2>
              <p className="options-modal-subtitle">Salvar, tela, escala, áudio e carreira</p>
            </div>
          </div>
          <button type="button" className="options-modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="options-modal-body">
          {feedback && <div className="options-feedback-alert">{feedback}</div>}

          {/* Opção 1: Salvar Jogo */}
          <div className="options-action-item">
            <div className="options-action-info">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <span>Salvar Jogo</span>
              </h3>
              <p>Gera uma cópia de segurança e persiste todo o progresso do seu clube e carreira.</p>
            </div>
            <button type="button" className="btn-options-action save" onClick={handleSaveGame} disabled={busy}>
              {busy ? 'Salvando...' : 'Salvar Agora'}
            </button>
          </div>

          {/* Opção 2: Modo Tela Cheia */}
          <div className="options-action-item">
            <div className="options-action-info">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
                <span>Modo Tela Cheia (Fullscreen)</span>
              </h3>
              <p>Alternar entre modo janela e tela cheia imersiva (Atalho: F11 ou Alt+Enter).</p>
            </div>
            <button
              type="button"
              className={`btn-options-action ${isFullscreen ? 'save' : 'info'}`}
              onClick={handleToggleFullscreen}
            >
              {isFullscreen ? 'Ativado (Tela Cheia)' : 'Modo Janela'}
            </button>
          </div>

          {/* Opção 3: Escala da Interface (Zoom Adaptável) */}
          <div className="options-action-item">
            <div className="options-action-info">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <polyline points="9 21 3 21 3 15"></polyline>
                  <line x1="21" y1="3" x2="14" y2="10"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
                <span>Escala da Interface (Zoom Adaptável)</span>
              </h3>
              <p>
                Ajusta proporções para caber perfeitamente em notebooks (768p), telas HD (720p) ou monitores Full HD (Atalho: Ctrl + / Ctrl - / Ctrl 0).
                {uiScale === 'auto' && (
                  <span style={{ display: 'block', marginTop: 4, color: '#38bdf8', fontSize: '0.78rem' }}>
                    Auto-detecção ativa: {Math.round(scaleFactor * 100)}% da resolução da tela.
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {(
                [
                  { key: 'auto', label: 'Auto' },
                  { key: '75', label: '75%' },
                  { key: '85', label: '85%' },
                  { key: '100', label: '100%' },
                  { key: '115', label: '115%' },
                ] as const
              ).map((scale) => {
                const isSelected = uiScale === scale.key;
                return (
                  <button
                    key={scale.key}
                    type="button"
                    onClick={() => handleSelectScale(scale.key)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.15)',
                      background: isSelected ? 'rgba(255, 215, 0, 0.18)' : 'rgba(255,255,255,0.05)',
                      color: isSelected ? '#ffd700' : '#d1d5db',
                      transition: 'all 0.15s',
                    }}
                  >
                    {scale.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opção 4: Efeitos Sonoros */}
          <div className="options-action-item">
            <div className="options-action-info">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <span>Efeitos Sonoros (Apitos e Torcida)</span>
              </h3>
              <p>Som de apito em início/fim de tempos, pênaltis, cartões e comemoração de gol.</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`btn-options-action ${soundMuted ? 'quit' : 'save'}`}
                onClick={toggleSound}
              >
                {soundMuted ? 'Desativado' : 'Ativado'}
              </button>
              {!soundMuted && (
                <button
                  type="button"
                  className="btn-options-action info"
                  onClick={() => {
                    soundFx.playGoalCheer();
                    soundFx.playWhistle('start');
                  }}
                  title="Testar som de apito e comemoração de gol da torcida"
                >
                  Testar
                </button>
              )}
            </div>
          </div>

          {/* Opção 5: Versão */}
          <div className="options-action-item">
            <div className="options-action-info">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Versão do Jogo</span>
              </h3>
              <p>Informações de compilação, motor tático e integridade do sistema.</p>
            </div>
            <button type="button" className="btn-options-action info" onClick={handleShowVersion}>
              Ver Detalhes
            </button>
          </div>

          {appInfo && (
            <div className="options-version-box">
              <h4>{appInfo.name} • v{appInfo.version}</h4>
              <p><strong>Motor:</strong> Reforged Engine v2.4 (Sigmoide, xG e Sinergia)</p>
              <p><strong>Plataforma:</strong> {appInfo.platform} (Electron {appInfo.electron})</p>
              <p><strong>Status:</strong> Banco de dados e elencos sincronizados</p>
            </div>
          )}

          {/* Opção 6: Excluir Carreira */}
          <div className="options-action-item danger">
            <div className="options-action-info">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Excluir Carreira</span>
              </h3>
              <p>Apaga o save atual e volta ao menu principal. Essa ação não pode ser desfeita.</p>
            </div>
            {!confirmDelete ? (
              <button type="button" className="btn-options-action quit" onClick={() => setConfirmDelete(true)} disabled={busy}>
                Excluir
              </button>
            ) : (
              <div className="options-confirm-quit">
                <span>Excluir esta carreira?</span>
                <button type="button" className="btn-options-confirm-yes" onClick={handleDeleteCareer} disabled={busy}>
                  {busy ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
                <button type="button" className="btn-options-confirm-no" onClick={() => setConfirmDelete(false)} disabled={busy}>
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Opção 7: Sair do Jogo */}
          <div className="options-action-item danger">
            <div className="options-action-info">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f87171' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Sair do Jogo</span>
              </h3>
              <p>Fecha o jogo com segurança e encerra a aplicação.</p>
            </div>
            {!confirmQuit ? (
              <button type="button" className="btn-options-action quit" onClick={() => setConfirmQuit(true)}>
                Sair
              </button>
            ) : (
              <div className="options-confirm-quit">
                <span>Deseja sair?</span>
                <button type="button" className="btn-options-confirm-yes" onClick={handleQuitGame}>
                  Sim, Fechar
                </button>
                <button type="button" className="btn-options-confirm-no" onClick={() => setConfirmQuit(false)}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="options-modal-footer">
          <button type="button" className="btn-options-close" onClick={onClose}>
            Voltar ao Jogo
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { CreateCareerResult } from '@tactical-arena/shared';
import { ClubCrest } from './ClubCrest.js';
import { CountryFlag } from './CountryFlag.js';
import { trapFocus } from './focusUtils.js';
import { OnboardingWizard } from './OnboardingWizard.js';
import {
  deleteSave,
  duplicateSave,
  getClub,
  listMyClubs,
  listSaves,
  loadSave,
  renameSave,
  type SaveSlot,
} from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { BriefcaseIcon } from './icons/AppIcons.js';

export type SubmenuTab = 'continue' | 'load' | 'new';

interface StartSubmenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewCareer: (result: CreateCareerResult) => void;
  onLoadCareer: (saveId: string) => void;
  initialTab?: SubmenuTab;
}

/** The rail entries double as the page heading for the panel on the right, so the whole screen
 *  reads as one place instead of a stack of unrelated tabs. */
const TABS: { id: SubmenuTab; icon: React.ReactNode; label: string; hint: string; title: string; lead: string }[] = [
  {
    id: 'continue',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 4 15 12 5 20 5 4"></polygon>
        <polygon points="13 4 23 12 13 20 13 4"></polygon>
      </svg>
    ),
    label: 'Continuar',
    hint: 'Retomar de onde parou',
    title: 'Continuar Carreira',
    lead: 'Volte para a carreira ativa exatamente no ponto em que você parou.',
  },
  {
    id: 'load',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
    ),
    label: 'Carregar',
    hint: 'Trocar de técnico',
    title: 'Carregar Carreira',
    lead: 'Cada carreira pertence a um técnico exclusivo e roda de forma totalmente independente.',
  },
  {
    id: 'new',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    ),
    label: 'Novo Técnico',
    hint: 'Começar do zero',
    title: 'Novo Técnico e Nova Carreira',
    lead: 'Monte o perfil do treinador e escolha como o jogo vai marcar o tempo das partidas.',
  },
];

export function StartSubmenuModal({ isOpen, onClose, onNewCareer, onLoadCareer, initialTab = 'continue' }: StartSubmenuModalProps) {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [tab, setTab] = useState<SubmenuTab>(initialTab);
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [myClubs, setMyClubs] = useState<any[]>([]);
  const [currentSaveId, setCurrentSaveId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Editing & Deletion
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) {
      setTab(initialTab);
    }
    refreshSaves();
  }, [isOpen, initialTab]);

  // Escape closes the hub when the target is inside the dialog (e.g., backdrop or controls).
  // When the quiz is open, focus is trapped inside the quiz, so this listener does not fire.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && dialogRef.current?.contains(e.target as Element)) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    return trapFocus(dialogRef.current);
  }, [isOpen]);

  async function refreshSaves() {
    setLoading(true);
    setError(null);
    try {
      const [res, clubs] = await Promise.all([
        listSaves(),
        listMyClubs().catch(() => []),
      ]);
      setSaves(res.saves);
      setMyClubs(clubs);
      setCurrentSaveId(res.currentSaveId);
      if (res.saves.length === 0) {
        setTab('new');
      } else if (initialTab) {
        setTab(initialTab);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const activeSave = saves.find((s) => s.id === currentSaveId) ?? saves[0];

  async function handleContinue() {
    setBusy(true);
    setError(null);
    try {
      let targetClubId: string | undefined;
      if (activeSave) {
        const loaded = await loadSave(activeSave.id).catch(() => null);
        if (loaded?.token && loaded?.userId) {
          signIn(loaded.token, loaded.userId);
        }
        if (loaded?.claimedClubId) {
          targetClubId = loaded.claimedClubId;
        }
      }
      if (!targetClubId) {
        const clubs = await listMyClubs().catch(() => []);
        if (clubs.length > 0) {
          targetClubId = clubs[0].id;
        }
      }
      if (targetClubId) {
        const validClub = await getClub(targetClubId).catch(() => null);
        if (validClub) {
          navigate(`/clubs/${targetClubId}`);
          onClose();
        } else {
          setTab('load');
          setError('O clube desta carreira não foi encontrado. Escolha outro save ou crie um novo técnico.');
        }
      } else {
        navigate('/dashboard');
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadSpecificSave(saveId: string) {
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadSave(saveId);
      if (loaded.token && loaded.userId) {
        signIn(loaded.token, loaded.userId);
      }
      onLoadCareer(saveId);
      let targetClubId = loaded.claimedClubId;
      if (!targetClubId) {
        const clubs = await listMyClubs().catch(() => []);
        if (clubs.length > 0) {
          targetClubId = clubs[0].id;
        }
      }
      if (targetClubId) {
        const validClub = await getClub(targetClubId).catch(() => null);
        if (validClub) {
          navigate(`/clubs/${targetClubId}`);
          onClose();
        } else {
          setTab('load');
          setError('O clube deste jogo salvo não foi encontrado no banco de dados.');
        }
      } else {
        navigate('/dashboard');
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** OnboardingWizard is the sole place a career gets created; this just authenticates and hands off. */
  function handleWizardCompleted(result: CreateCareerResult) {
    setError(null);
    signIn(result.token, result.userId);
    onNewCareer(result);
    onClose();
  }


  async function handleRename(saveId: string) {
    if (!editingName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await renameSave(saveId, editingName.trim());
      setEditingId(null);
      await refreshSaves();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(saveId: string) {
    try {
      await deleteSave(saveId);
      setConfirmDeleteId(null);
      await refreshSaves();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDuplicate(saveId: string) {
    setBusy(true);
    try {
      await duplicateSave(saveId);
      await refreshSaves();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  const money = (value?: number) => value === undefined
    ? 'Não informado'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  const gameDate = (value?: string) => {
    if (!value) return 'Data não informada';
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
  };
  const careerBadges = (save: SaveSlot) => {
    const badges: string[] = [];
    if (save.currentDate && save.nextMatchDate === save.currentDate) badges.push('Dia de Jogo');
    if (save.transferWindowOpen) badges.push('Janela Aberta');
    if (save.seasonPhase === 'OFF_SEASON') badges.push('Fim de Temporada');
    return badges;
  };
  const clubForCrest = (save: SaveSlot) => {
    const matchingClub = myClubs.find((c) =>
      (save.clubName && c.name?.toLowerCase() === save.clubName.toLowerCase()) ||
      (save.clubSlug && c.slug === save.clubSlug)
    );
    return {
      id: save.id,
      name: save.clubName ?? matchingClub?.name ?? 'Sem clube',
      slug: save.clubSlug ?? matchingClub?.slug ?? null,
      crestBase64: save.crestBase64 ?? matchingClub?.crestBase64 ?? null,
      primaryColor: save.primaryColor ?? matchingClub?.primaryColor ?? null,
      secondaryColor: save.secondaryColor ?? matchingClub?.secondaryColor ?? null,
    };
  };
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  // Rendered into <body>, not in place. The start menu panel this modal is mounted under carries
  // `backdrop-filter: blur(10px)`, and a filtered ancestor becomes the containing block for its
  // position:fixed descendants — so the "full screen" overlay was really being sized by that 440px
  // panel, which is why the hub came out as a postage stamp with its own inner scrollbars.
  return createPortal(
    <div
      ref={dialogRef}
      className="career-hub-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="career-hub-title"
    >
      <div className="career-hub-shell" onClick={(e) => e.stopPropagation()}>
        {/* Left rail: identity, navigation, way out */}
        <aside className="career-hub-rail">
          <div className="career-hub-brand">
            <img src="/logo.png" alt="" className="career-hub-brand-crest" />
            <div className="career-hub-brand-text">
              <h2 id="career-hub-title">Central de Carreiras</h2>
              <p>Técnicos e saves independentes</p>
            </div>
          </div>

          <nav className="career-hub-nav" role="tablist" aria-label="Seções da central de carreiras">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`career-hub-tab-${t.id}`}
                aria-controls={`career-hub-panel-${t.id}`}
                className={`career-hub-nav-item ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
                aria-selected={tab === t.id}
              >
                <span className="career-hub-nav-icon">{t.icon}</span>
                <span className="career-hub-nav-text">
                  <strong>
                    {t.label}
                    {t.id === 'load' && saves.length > 0 ? ` (${saves.length})` : ''}
                  </strong>
                  <em>{t.hint}</em>
                </span>
              </button>
            ))}
          </nav>

          <button type="button" className="career-hub-back" onClick={onClose}>
            ← Voltar ao menu principal
          </button>
        </aside>

        {/* Right panel: the actual work surface */}
        <main
          className="career-hub-main"
          role="tabpanel"
          id={`career-hub-panel-${tab}`}
          aria-labelledby={`career-hub-tab-${tab}`}
        >
          <header className="career-hub-main-head">
            <div className="career-hub-main-head-content">
              <h3>{activeTab.title}</h3>
              <p>{activeTab.lead}</p>
            </div>
            <button type="button" className="career-hub-close" onClick={onClose} aria-label="Fechar central de carreiras">
              ✕
            </button>
          </header>

          <div className="career-hub-main-body">
            {error && <div className="career-hub-alert" role="status" aria-live="polite">{error}</div>}

            {/* TAB 1: CONTINUAR CARREIRA */}
            {tab === 'continue' && (
              <>
                {activeSave ? (
                  <article className="career-hero">
                    <header className="career-club-identity career-club-identity-hero">
                      <ClubCrest club={clubForCrest(activeSave)} size={76} />
                      <div>
                        <div className="career-status-row">
                          <span className="career-current-label">Carreira ativa</span>
                          {careerBadges(activeSave).map((badge) => <span key={badge} className="career-status-pill">{badge}</span>)}
                        </div>
                        <h4 className="career-club-name">{activeSave.clubName ?? 'Sem clube'}</h4>
                        <p className="career-club-secondary">
                          <CountryFlag code={activeSave.managerNationality} size={15} />
                          {activeSave.managerName ?? 'Professor Técnico'} · {activeSave.name}
                        </p>
                      </div>
                    </header>

                    <dl className="career-facts-grid">
                      <div>
                        <dt>Data / Semana</dt>
                        <dd>{gameDate(activeSave.currentDate)} · Rodada {activeSave.round ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>Caixa / Orçamento</dt>
                        <dd className={activeSave.budget !== undefined && activeSave.budget < 0 ? 'career-value-danger' : ''}>{money(activeSave.budget)}</dd>
                      </div>
                      <div>
                        <dt>Divisão / Posição</dt>
                        <dd>{activeSave.division ?? '—'}ª Divisão · {activeSave.leaguePosition ? `${activeSave.leaguePosition}º` : '—'}</dd>
                      </div>
                      <div>
                        <dt>Próximo Jogo</dt>
                        <dd>{activeSave.nextOpponentName ?? 'A definir'}{activeSave.nextMatchDate ? ` · ${gameDate(activeSave.nextMatchDate)}` : ''}</dd>
                      </div>
                    </dl>

                    <button type="button" className="career-hub-cta" onClick={handleContinue} disabled={busy}>
                      {busy ? 'Carregando carreira...' : activeSave.nextMatchDate === activeSave.currentDate ? 'Ir para o jogo' : 'Continuar carreira'}
                    </button>
                  </article>
                ) : (
                  <div className="career-hub-empty">
                    <span className="career-hub-empty-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BriefcaseIcon size={32} color="#94a3b8" />
                    </span>
                    <p>Nenhuma carreira encontrada no momento.</p>
                    <button type="button" className="career-hub-cta" onClick={() => setTab('new')}>
                      Criar novo técnico e nova carreira
                    </button>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: CARREGAR JOGO SALVO */}
            {tab === 'load' && (
              <>
                {loading ? (
                  <p className="career-hub-loading">Carregando carreiras...</p>
                ) : saves.length === 0 ? (
                  <div className="career-hub-empty">
                    <span className="career-hub-empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #94a3b8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </span>
                    <p>Você ainda não tem nenhuma carreira salva.</p>
                    <button type="button" className="career-hub-cta" onClick={() => setTab('new')}>
                      Criar novo técnico e nova carreira
                    </button>
                  </div>
                ) : (
                  <div className="career-slot-grid">
                    {saves.map((save) => {
                      const isCurrent = save.id === currentSaveId;
                      const isEditing = editingId === save.id;
                      const isDeleting = confirmDeleteId === save.id;

                      return (
                        <article key={save.id} className={`career-slot ${isCurrent ? 'current' : ''}`}>
                          {isEditing ? (
                            <div className="career-slot-edit">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="career-slot-input"
                                autoFocus
                              />
                              <div className="career-slot-edit-actions">
                                <button
                                  type="button"
                                  className="career-icon-btn confirm"
                                  onClick={() => handleRename(save.id)}
                                  aria-label="Salvar novo nome da carreira"
                                  title="Salvar nome"
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  className="career-icon-btn"
                                  onClick={() => setEditingId(null)}
                                  aria-label="Cancelar renomeação"
                                  title="Cancelar"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <header className="career-club-identity">
                                <ClubCrest club={clubForCrest(save)} size={54} />
                                <div>
                                  <div className="career-status-row">
                                    {isCurrent && <span className="career-current-label">Atual</span>}
                                    {careerBadges(save).map((badge) => <span key={badge} className="career-status-pill">{badge}</span>)}
                                  </div>
                                  <h4 className="career-club-name">{save.clubName ?? 'Sem clube'}</h4>
                                  <p className="career-club-secondary">
                                    <CountryFlag code={save.managerNationality} size={14} />
                                    {save.managerName ?? 'Técnico'} · {save.name}
                                  </p>
                                </div>
                              </header>

                              <dl className="career-facts-grid career-slot-meta">
                                <div>
                                  <dt>Data / Semana</dt>
                                  <dd>{gameDate(save.currentDate)} · R{save.round ?? '—'}</dd>
                                </div>
                                <div>
                                  <dt>Caixa / Orçamento</dt>
                                  <dd className={save.budget !== undefined && save.budget < 0 ? 'career-value-danger' : ''}>{money(save.budget)}</dd>
                                </div>
                                <div>
                                  <dt>Divisão / Posição</dt>
                                  <dd>{save.division ?? '—'}ª · {save.leaguePosition ? `${save.leaguePosition}º` : '—'}</dd>
                                </div>
                                <div>
                                  <dt>Próximo Jogo</dt>
                                  <dd>{save.nextOpponentName ?? 'A definir'}</dd>
                                </div>
                              </dl>
                            </>
                          )}

                          {!isEditing && (
                            <footer className="career-slot-actions">
                              {isDeleting ? (
                                <div className="career-slot-danger">
                                  <span>Excluir esta carreira?</span>
                                  <button
                                    type="button"
                                    className="career-icon-btn danger"
                                    onClick={() => handleDelete(save.id)}
                                    aria-label="Confirmar exclusão da carreira"
                                  >
                                    Sim
                                  </button>
                                  <button
                                    type="button"
                                    className="career-icon-btn"
                                    onClick={() => setConfirmDeleteId(null)}
                                    aria-label="Cancelar exclusão da carreira"
                                  >
                                    Não
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="career-slot-play"
                                    onClick={() => handleLoadSpecificSave(save.id)}
                                    disabled={busy}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                    </svg>
                                    <span>Jogar</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="career-icon-btn"
                                    onClick={() => {
                                      setEditingId(save.id);
                                      setEditingName(save.name);
                                    }}
                                    aria-label="Renomear carreira"
                                    title="Renomear carreira"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 20h9"></path>
                                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className="career-icon-btn"
                                    onClick={() => handleDuplicate(save.id)}
                                    aria-label="Duplicar carreira"
                                    title="Duplicar carreira"
                                    disabled={busy}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className="career-icon-btn danger"
                                    onClick={() => setConfirmDeleteId(save.id)}
                                    aria-label="Excluir carreira"
                                    title="Excluir carreira"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6"></polyline>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                  </button>
                                </>
                              )}
                            </footer>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* TAB 3: NOVO TÉCNICO E NOVA CARREIRA */}
            {tab === 'new' && (
              <OnboardingWizard
                onCompleted={handleWizardCompleted}
                onCancel={onClose}
                onError={setError}
              />
            )}
          </div>

          <footer className="career-hub-footer">
            <span>Tactical Arena v0.1.0</span>
            <span>Saves: {saves.length} / Ilimitado</span>
            <button
              type="button"
              className="career-hub-editor-link"
              onClick={() => {
                navigate('/team-editor');
                onClose();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              <span>Mod Packs & Editor</span>
            </button>
          </footer>
        </main>
      </div>
    </div>,
    document.body,
  );
}

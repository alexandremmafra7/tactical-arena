import { useEffect, useState } from 'react';
import type { CreateCareerResult } from '@tactical-arena/shared';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { GameHeader } from '../components/GameHeader.js';
import { StartSubmenuModal, type SubmenuTab } from '../components/StartSubmenuModal.js';
import { ServerSettingsModal } from '../components/ServerSettingsModal.js';
import { PrivacyModal } from '../components/PrivacyModal.js';
import { PrivacyConsentBanner } from '../components/PrivacyConsentBanner.js';
import { isOfflineMode } from '../api/client.js';
import { prepareOfflineWorld } from '../api/localEngine.js';
import { IntroSplash } from '../components/IntroSplash.js';

/** The game's front door — a stadium-night main menu.
 *  Clicking "Iniciar Jogo" opens the career submenu (Continuar Carreira, Carregar Jogo Salvo, Iniciar Nova Carreira).
 */
export function StartPage() {

  const { token, userId, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuTab, setSubmenuTab] = useState<SubmenuTab>('continue');
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('mythra_intro_shown'));

  function handleIntroComplete() {
    sessionStorage.setItem('mythra_intro_shown', 'true');
    setShowIntro(false);
  }

  useEffect(() => {
    const isOff = isOfflineMode();
    if (!isOff) return;

    /**
     * Reads the shipped club database before a career can be started.
     *
     * Offline the game used to invent its clubs, so on Android the manager took charge of a Flamengo whose
     * squad was generated noise. The real one is a file inside the app bundle, and it has to be read before
     * the world is built, which happens the moment a save is first touched. Failure is silent on purpose:
     * `prepareOfflineWorld` keeps the invented world when it cannot read the file, and a game that opens with
     * made-up squads beats a front door that does not open.
     */
    prepareOfflineWorld().catch(() => undefined);
  }, []);

  function handleNewCareer(result: CreateCareerResult) {
    setSubmenuOpen(false);
    navigate(`/clubs/${result.club.id}`);
  }

  function handleLoadCareer(_saveId: string) {
    setSubmenuOpen(false);
  }

  async function handleOpenGameMenu(tab: SubmenuTab = 'continue') {
    setConnecting(true);
    try {
      // The world is built the first time a save is touched, so the real clubs have to be in hand by now.
      if (isOfflineMode()) await prepareOfflineWorld();
      setSubmenuTab(tab);
      setSubmenuOpen(true);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="start-screen">
      {showIntro && <IntroSplash onComplete={handleIntroComplete} />}
      <GameHeader />

      <div className="start-menu-panel">
        <div className="start-menu-clip" />

        <div className="start-menu">
          <button className="start-menu-item primary" onClick={() => handleOpenGameMenu('continue')} disabled={connecting}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            {connecting ? 'Carregando...' : 'Iniciar Jogo'}
          </button>
          <button
            className="start-menu-item"
            onClick={() => handleOpenGameMenu('new')}
            title="Começar uma nova carreira do zero escolhendo técnico e clube"
            disabled={connecting}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Nova Carreira
          </button>
          <button
            className="start-menu-item"
            onClick={() => handleOpenGameMenu('load')}
            title="Carregar ou gerenciar jogos salvos"
            disabled={connecting}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            Carregar Carreira
          </button>
          <button
            className="start-menu-item"
            onClick={() => navigate('/team-editor')}
            title="Editar elencos, criar clubes e times"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
            Editor de Times
          </button>
          <button
            className="start-menu-item"
            onClick={() => navigate('/quick-play')}
            title="Jogar partidas avulsas ou copas mata-mata instantâneas"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            Jogo Rápido & Torneios
          </button>
          <button
            className="start-menu-item"
            onClick={() => navigate('/custom-championship')}
            title="Crie ligas e copas personalizadas com times de qualquer país"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
              <path d="M4 22h16"></path>
              <path d="M10 14.66V17c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-2.34"></path>
              <path d="M18 14.66V17c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1v-2.34"></path>
              <path d="M6 2h12v7a6 6 0 0 1-12 0V2z"></path>
            </svg>
            Campeonato Personalizado
          </button>
          <button
            className="start-menu-item"
            onClick={() => navigate('/online')}
            title="Jogar partidas e torneios online via P2P WebRTC"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            Modo Online Multiplayer (P2P)
          </button>
          <button
            className="start-menu-item"
            onClick={() => setPrivacyOpen(true)}
            title="Direitos do Titular e Termos LGPD"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Privacidade & LGPD
          </button>
          <button
            className="start-menu-item"
            onClick={signOut}
            disabled={!token}
            title={token ? 'Sair da conta' : 'Você não está logado'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Sair
          </button>
        </div>

        <StartSubmenuModal
          isOpen={submenuOpen}
          onClose={() => setSubmenuOpen(false)}
          onNewCareer={handleNewCareer}
          onLoadCareer={handleLoadCareer}
          initialTab={submenuTab}
        />
        <ServerSettingsModal
          isOpen={serverSettingsOpen}
          onClose={() => setServerSettingsOpen(false)}
          onConnected={() => setServerSettingsOpen(false)}
        />
        <PrivacyModal isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
        <PrivacyConsentBanner onOpenPolicy={() => setPrivacyOpen(true)} />
      </div>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Club } from '@tactical-arena/shared';
import { ClubCrest } from './ClubCrest.js';
import { OptionsMenuModal } from './OptionsMenuModal.js';
import { formatLongPtBr, formatShortPtBr } from '@tactical-arena/shared';
import { useGameDate } from '../lib/useGameDate.js';
import { getDetailedGameState } from '../api/client.js';
import {
  DESKTOP_CLUB_NAV,
  MOBILE_PRIMARY_NAV,
  MOBILE_DRAWER_NAV,
  clubPath,
  type ClubTab,
} from '../lib/clubNavigation.js';
import { NavIcon, MenuIcon, SettingsIcon, SoccerBallIcon, ChecklistIcon, TacticsIcon, ArrowLeftIcon } from './icons/AppIcons.js';
import { AutomationProfileModal } from './AutomationProfileModal.js';

export type { ClubTab };

/** The clock reads as a date first; the phase explains why nothing is being played in February. */
const PHASE_LABEL: Record<string, string> = {
  PRE_SEASON: 'Pré-temporada',
  IN_SEASON: 'Em andamento',
  OFF_SEASON: 'Fim de temporada',
};

interface ClubNavProps {
  club: Club;
  active: ClubTab;
  /**
   * Where the back arrow goes. Defaults to the club home dashboard.
   */
  backTo?: string;
  onClubUpdate?: (updatedClub: Club) => void;
}

/** Shared top & bottom navigation for every club-management screen — fully responsive for desktop & mobile. */
export function ClubNav({ club, active, backTo, onClubUpdate }: ClubNavProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [claimedTeamCode, setClaimedTeamCode] = useState<string | null>(null);
  const gameState = useGameDate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await getDetailedGameState();
        if (!cancelled && state?.claimedNationalTeamCode) {
          setClaimedTeamCode(state.claimedNationalTeamCode);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const presetMode = club.staffDelegationConfig?.presetMode ?? 'brasfoot_casual';
  const modeLabel =
    presetMode === 'brasfoot_casual'
      ? 'Arcade'
      : presetMode === 'football_manager_hardcore'
      ? 'Manual'
      : 'Gestor';
  const modeColor =
    presetMode === 'brasfoot_casual'
      ? '#10b981'
      : presetMode === 'football_manager_hardcore'
      ? '#f59e0b'
      : '#38bdf8';

  const clock = (() => {
    if (!gameState?.currentDate) return null;
    try {
      return { long: formatLongPtBr(gameState.currentDate), short: formatShortPtBr(gameState.currentDate) };
    } catch {
      return null;
    }
  })();
  const navigate = useNavigate();

  const isMoreActive = MOBILE_DRAWER_NAV.some((item) => item.matches.includes(active));

  return (
    <>
      <header className="topbar">
        <div className="topbar-club-brand">
          {active !== 'home' && (
            <Link className="back-to-panel" to={backTo ?? `/clubs/${club.id}`} title="Voltar" aria-label="Voltar">
              <ArrowLeftIcon size={20} />
            </Link>
          )}
          <Link to={`/clubs/${club.id}`} className="crest-name" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ClubCrest club={club} size={38} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="topbar-club-title" style={{ lineHeight: 1.1 }}>{club.name}</span>
              {clock && gameState && (
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.01em' }}>
                  {clock.long} • Temporada {gameState.seasonYear} ({PHASE_LABEL[gameState.phase] ?? gameState.phase})
                </span>
              )}
            </div>
          </Link>
        </div>

        <div className="topbar-actions">
          {claimedTeamCode && (
            <Link
              to={`/national-team/${claimedTeamCode}`}
              className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold transition flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span>Minha Seleção</span>
            </Link>
          )}
          <Link className="topbar-shortcut" to={clubPath(club.id, 'briefing')} aria-label="Próximo confronto">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 5 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="12 8 8 11 9.5 15.5 14.5 15.5 16 11"></polygon>
            </svg>
            <span className="topbar-shortcut-label">Próximo confronto</span>
          </Link>
          <Link className="topbar-shortcut" to={clubPath(club.id, 'competitions')} aria-label="Competições">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 5 }}>
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
              <path d="M4 22h16"></path>
              <path d="M10 14.66V17c0 .55-.45 1-1 1H7v2h10v-2h-2c-.55 0-1-.45-1-1v-2.34"></path>
              <path d="M6 4h12v7a6 6 0 0 1-12 0V4z"></path>
            </svg>
            <span className="topbar-shortcut-label">Competições</span>
          </Link>
          <button
            type="button"
            className="topbar-mode-badge"
            onClick={() => setAutomationModalOpen(true)}
            title="Alterar perfil de automação e controle do clube"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: `1.5px solid ${modeColor}80`,
              color: modeColor,
              borderRadius: 16,
              padding: '4px 10px',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              transition: 'all 0.15s ease',
            }}
          >
            {presetMode === 'brasfoot_casual' && <SoccerBallIcon size={12} color={modeColor} />}
            {presetMode === 'football_manager_hardcore' && <ChecklistIcon size={12} color={modeColor} />}
            {presetMode !== 'brasfoot_casual' && presetMode !== 'football_manager_hardcore' && <TacticsIcon size={12} color={modeColor} />}
            <span>{modeLabel}</span>
          </button>
        </div>
      </header>

      {/* Desktop Navigation (>= 769px) - Fixo no topo e com Home e Opções */}
      <nav className="club-nav desktop-nav">
        {DESKTOP_CLUB_NAV.map((tab) => (
          <Link key={tab.key} to={clubPath(club.id, tab.destination as any)} className={`club-nav-tab${tab.matches.includes(active) ? ' active' : ''}`}>
            {tab.icon && (
              <img
                src={tab.icon}
                alt=""
                className="club-nav-icon"
                onError={(e) => {
                  const cardFallback = tab.icon?.replace('/icons/', '/cards/').replace('.png', '.webp');
                  if (cardFallback && !e.currentTarget.src.includes(cardFallback)) {
                    e.currentTarget.src = cardFallback;
                  }
                }}
              />
            )}
            {tab.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOptionsOpen(true)}
          className="club-nav-tab"
          title="Opções do Jogo (Salvar, Sair, Versão)"
        >
          <img src="/cards/options.png" alt="" className="club-nav-icon" onError={(e) => { e.currentTarget.src = '/icons/options.png'; }} />
          Opções
        </button>
      </nav>

      {/* Mobile Bottom Navigation Bar (<= 768px) */}
      <nav className="mobile-bottom-nav" aria-label="Navegação Principal Mobile">
        {MOBILE_PRIMARY_NAV.map((item) => (
          <Link
            key={item.key}
            to={clubPath(club.id, item.destination as any)}
            className={`mobile-nav-item${item.matches.includes(active) ? ' active' : ''}`}
          >
            <div className="mobile-nav-icon-wrap">
              {item.icon && (
                <img
                  src={item.icon}
                  alt=""
                  className="mobile-nav-icon"
                  onError={(e) => {
                    const cardFallback = item.icon?.replace('/icons/', '/cards/').replace('.png', '.webp');
                    if (cardFallback && !e.currentTarget.src.includes(cardFallback)) {
                      e.currentTarget.src = cardFallback;
                    }
                  }}
                />
              )}
            </div>
            <span className="mobile-nav-label">{item.label}</span>
          </Link>
        ))}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`mobile-nav-item mobile-nav-btn${isMoreActive ? ' active' : ''}`}
          aria-label="Mais opções e ferramentas de gestão"
        >
          <div className="mobile-nav-icon-wrap">
            <MenuIcon size={20} />
          </div>
          <span className="mobile-nav-label">Mais</span>
        </button>
      </nav>

      {/* Mobile "Mais" Bottom Sheet Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-handle" />
            <div className="mobile-drawer-header">
              <h3>Central de Gestão</h3>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={() => setMobileMenuOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="mobile-drawer-grid">
              {MOBILE_DRAWER_NAV.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="mobile-drawer-tile"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(clubPath(club.id, item.destination as any));
                  }}
                >
                  <span className="mobile-drawer-tile-icon">
                    <NavIcon name={item.key} size={22} />
                  </span>
                  <span className="mobile-drawer-tile-title">{item.label}</span>
                </button>
              ))}

              <button
                type="button"
                className="mobile-drawer-tile highlight"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setOptionsOpen(true);
                }}
              >
                <span className="mobile-drawer-tile-icon">
                  <SettingsIcon size={22} />
                </span>
                <span className="mobile-drawer-tile-title">Opções do Jogo</span>
                <span className="mobile-drawer-tile-desc">Salvar, Configurar e Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <OptionsMenuModal isOpen={optionsOpen} onClose={() => setOptionsOpen(false)} />
      <AutomationProfileModal
        isOpen={automationModalOpen}
        onClose={() => setAutomationModalOpen(false)}
        club={club}
        onProfileChanged={(updated) => {
          onClubUpdate?.(updated);
        }}
      />
    </>
  );
}

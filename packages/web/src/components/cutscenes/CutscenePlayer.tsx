import React, { useEffect, useRef, useState } from 'react';
import { useCutscene } from '../../context/CutsceneContext.js';
import cutscenesConfig from '../../config/cutscenesConfig.json';
import { getTrophyImagePath } from '../../utils/trophyHelper.js';
import { getClubTingimentoColors } from '@tactical-arena/shared';

export const CutscenePlayer: React.FC = () => {
  const { currentCutscene, closeCutscene } = useCutscene();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    if (!currentCutscene) {
      setCurrentTime(0);
      setIsLoaded(false);
      setHasError(false);
      return;
    }

    // 3s fallback timer if video fails to load
    const timer = setTimeout(() => {
      if (!isLoaded) {
        setHasError(true);
      }
    }, 3000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCutscene();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentCutscene, isLoaded, closeCutscene]);

  if (!currentCutscene) {
    return null;
  }

  const config = (cutscenesConfig as Record<string, any>)[currentCutscene.type] || {
    duration: 6.0,
    title: 'EVENTO ESPECIAL',
    subtitle: 'Tactical Arena FC'
  };

  const club = currentCutscene.club;
  const colors = getClubTingimentoColors(club);
  const trophyPath = getTrophyImagePath(currentCutscene.competition, club?.country);
  const data = currentCutscene.data || {};

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    closeCutscene();
  };

  if (hasError) {
    return (
      <div style={styles.overlay}>
        <div style={styles.errorBox}>
          <h2>{config.title}</h2>
          <p>{config.subtitle}</p>
          <button style={styles.skipButton} onClick={closeCutscene}>Continuar</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      {/* Video Container - Pristine natural video footage */}
      <video
        ref={videoRef}
        src={`/cutscenes/${currentCutscene.type}.mp4`}
        autoPlay
        playsInline
        muted={false}
        onTimeUpdate={handleTimeUpdate}
        onLoadedData={() => setIsLoaded(true)}
        onEnded={handleEnded}
        onError={() => setHasError(true)}
        style={styles.video}
      />

      {/* Dynamic Overlays / UI (Untinted, pristine colors) */}
      <div style={styles.uiContainer}>
        {/* Top Header / Club Crest */}
        <div style={styles.header}>
          {club?.crestBase64 ? (
            <img src={club.crestBase64} alt={club.name} style={styles.crest} />
          ) : (
            <div style={{ ...styles.crestPlaceholder, borderColor: colors.primaryColor }}>
              {club?.name ? club.name.charAt(0) : 'TA'}
            </div>
          )}
          <div style={styles.clubInfo}>
            <span style={styles.clubName}>{club?.name || 'Tactical Arena FC'}</span>
            <span style={styles.sceneTitle}>{config.title}</span>
          </div>
        </div>

        {/* Center / Trophies / Player Cards */}
        {currentCutscene.type === 'campeao' && currentTime >= 6.0 && (
          <div style={styles.trophyContainer}>
            <img src={trophyPath} alt="Troféu" style={styles.trophyImage} />
            <div style={{ ...styles.trophyGlow, background: `radial-gradient(circle, ${colors.primaryColor}55 0%, transparent 70%)` }} />
            <div style={styles.banner}>
              <h2>CAMPEÃO</h2>
              <p>{currentCutscene.competition || 'Competição Oficial'}</p>
            </div>
          </div>
        )}

        {currentCutscene.type === 'primeiro-contrato' && (
          <div style={styles.centerCard}>
            <h3 style={styles.centerCardTitle}>{data.managerName || 'Novo Treinador'}</h3>
            <p style={styles.centerCardText}>Salário Inicial: {data.salary ? `R$ ${data.salary.toLocaleString('pt-BR')}` : 'R$ 150.000 / mês'}</p>
          </div>
        )}

        {(currentCutscene.type === 'contratacao-galactica' || currentCutscene.type === 'joia-da-base') && (
          <div style={styles.playerCardContainer}>
            <div style={{ ...styles.playerCard, borderColor: colors.primaryColor }}>
              <span style={styles.playerOverall}>{data.playerOverall || 88}</span>
              <h4>{data.playerName || 'Estrela Contratada'}</h4>
              <p>{data.playerPosition || 'ATA'} • {currentCutscene.type === 'joia-da-base' ? 'Promessa da Base' : 'Contratação de Peso'}</p>
            </div>
          </div>
        )}

        {currentCutscene.type === 'subimos' && (
          <div style={styles.bannerCenter}>
            <h2>ACESSO CONQUISTADO!</h2>
            <p>{data.divisionName || 'Promoção de Divisão'}</p>
          </div>
        )}

        {currentCutscene.type === 'rescisao' && (
          <div style={styles.bannerCenter}>
            <h2>FIM DE CICLO</h2>
            <p>{data.message || 'Contrato encerrado por acordo mútuo.'}</p>
          </div>
        )}

        {currentCutscene.type === 'aposentadoria' && (
          <div style={styles.playerCardContainer}>
            <div style={{ ...styles.playerCard, borderColor: '#f59e0b', background: 'rgba(15, 23, 42, 0.88)' }}>
              <span style={{ ...styles.playerOverall, background: '#f59e0b', color: '#000' }}>{data.playerOverall || 78}</span>
              <h4>{data.playerName || 'Veterano do Clube'}</h4>
              <p>{data.playerPosition || 'MEI'} • Despedida dos Gramados</p>
              {data.message && (
                <p style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '6px' }}>{data.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Skip Button */}
        <button style={styles.skipBtn} onClick={closeCutscene}>
          Pular [ESC]
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#0a0a0a',
    zIndex: 999999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  uiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '32px',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    pointerEvents: 'auto',
  },
  crest: {
    width: '56px',
    height: '56px',
    objectFit: 'contain',
  },
  crestPlaceholder: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    fontSize: '20px',
  },
  clubInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  clubName: {
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: 700,
    textShadow: '0 2px 4px rgba(0,0,0,0.8)',
  },
  sceneTitle: {
    color: '#34d399',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  skipBtn: {
    position: 'absolute',
    bottom: '32px',
    right: '32px',
    pointerEvents: 'auto',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    backdropFilter: 'blur(4px)',
    transition: 'background 0.2s',
  },
  trophyContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    animation: 'fadeInUp 0.8s ease-out forwards',
  },
  trophyImage: {
    maxHeight: '280px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 20px rgba(250, 204, 21, 0.6))',
  },
  trophyGlow: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    zIndex: -1,
    filter: 'blur(40px)',
  },
  banner: {
    marginTop: '20px',
    textAlign: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    padding: '12px 32px',
    borderRadius: '12px',
    border: '1px solid rgba(250, 204, 21, 0.4)',
  },
  centerCardTitle: {
    margin: '0 0 8px 0',
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: 800,
    letterSpacing: '0.5px',
  },
  centerCardText: {
    margin: 0,
    color: '#fbbf24',
    fontSize: '15px',
    fontWeight: 600,
  },
  centerCard: {
    margin: 'auto',
    textAlign: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.75)',
    padding: '24px 48px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.2)',
    backdropFilter: 'blur(8px)',
  },
  playerCardContainer: {
    margin: 'auto 0 auto auto',
    paddingRight: '48px',
  },
  playerCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    border: '2px solid',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'center',
    minWidth: '220px',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
  },
  playerOverall: {
    fontSize: '36px',
    fontWeight: 900,
    color: '#34d399',
    display: 'block',
  },
  bannerCenter: {
    margin: 'auto',
    textAlign: 'center',
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    padding: '28px 56px',
    borderRadius: '16px',
    border: '1px solid rgba(52, 211, 153, 0.5)',
    backdropFilter: 'blur(10px)',
  },
  errorBox: {
    textAlign: 'center',
    color: '#ffffff',
  },
  skipButton: {
    marginTop: '16px',
    padding: '10px 24px',
    backgroundColor: '#34d399',
    color: '#000000',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  }
};

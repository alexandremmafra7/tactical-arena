import { useEffect, useRef, useState } from 'react';

interface IntroSplashProps {
  onComplete: () => void;
}

export function IntroSplash({ onComplete }: IntroSplashProps) {
  const [phase, setPhase] = useState<'playing' | 'fade-out'>('playing');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef(false);

  function finish() {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase('fade-out');
    setTimeout(() => {
      onComplete();
    }, 450);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Se o navegador bloquear autoplay com áudio, tenta mudo para não travar
          if (video && !completedRef.current) {
            video.muted = true;
            video.play().catch(() => {
              finish();
            });
          }
        });
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (['Escape', ' ', 'Enter'].includes(e.key)) {
        finish();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    // Timeout de segurança caso o vídeo falhe ou demore além da duração de 20s
    const maxTimer = setTimeout(() => {
      finish();
    }, 22000);

    return () => {
      clearTimeout(maxTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div
      className={`intro-splash-overlay ${phase}`}
      onClick={finish}
      role="dialog"
      aria-label="Abertura Tactical Arena FC"
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        className="intro-splash-video"
        playsInline
        autoPlay
        onEnded={finish}
        onError={finish}
      />

      <button
        type="button"
        className="intro-skip-btn"
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
        title="Pressione ESC ou clique para pular"
      >
        Pular [ESC] ⤸
      </button>
    </div>
  );
}

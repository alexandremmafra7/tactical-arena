import type { StadiumConstruction } from '@tactical-arena/shared';
import { getStadiumTierInfo, getNextStadiumTier } from '@tactical-arena/shared';
import { stadiumImageUrl, stadiumConstructionVideoUrl } from './StadiumIcon.js';

export interface StadiumVisualizerProps {
  tier?: number;
  level?: number;
  capacity: number;
  stadiumName?: string;
  construction?: StadiumConstruction | null;
  className?: string;
}

function formatNumber(value?: number): string {
  return (value ?? 0).toLocaleString('pt-BR');
}

export function StadiumVisualizer({
  tier,
  level = 1,
  capacity,
  stadiumName,
  construction,
  className = 'stadium-visualizer-container',
}: StadiumVisualizerProps) {
  const currentTierNumber = tier ?? level;
  const currentTierInfo = getStadiumTierInfo(currentTierNumber);
  const nextTierInfo = getNextStadiumTier(currentTierNumber);
  const displayName = stadiumName || currentTierInfo?.name || `Estádio Nível ${currentTierNumber}`;

  const isUnderConstruction = Boolean(construction && construction.weeksRemaining > 0);
  const imgSrc = stadiumImageUrl(currentTierNumber);

  return (
    <div className={className} role="region" aria-label={`Visualizador do ${displayName}`}>
      <div className="stadium-visualizer-header">
        <div className="stadium-visualizer-badge">
          <span className="stadium-visualizer-tier-tag">TIER {currentTierNumber}</span>
          <h2 className="stadium-visualizer-title">{displayName}</h2>
          <span className="stadium-visualizer-capacity">{formatNumber(capacity)} lugares</span>
        </div>
      </div>

      <div className="stadium-visualizer-preview">
        <div className={`stadium-visualizer-img-wrap ${isUnderConstruction ? 'is-construction' : ''}`}>
          {isUnderConstruction ? (
            <video
              src={construction?.videoFile || (construction ? stadiumConstructionVideoUrl(construction.targetLevel, construction.targetStep) : '/stadium/tier-1-step-1.mp4')}
              autoPlay
              loop
              muted
              playsInline
              className="stadium-visualizer-video"
              aria-label={`Ampliação do ${displayName} em andamento`}
            />
          ) : (
            <>
              <img
                src={imgSrc}
                alt=""
                className="stadium-backdrop-glow"
                aria-hidden="true"
              />
              <img
                src={imgSrc}
                alt={`${displayName} - Nível ${currentTierNumber}`}
                className="stadium-visualizer-img"
              />
            </>
          )}
          {isUnderConstruction && (
            <div className="stadium-visualizer-overlay">
              <span className="stadium-visualizer-overlay-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <span className="stadium-visualizer-overlay-text">Em obras de ampliação</span>
            </div>
          )}
        </div>

        {isUnderConstruction && construction && (
          <div className="stadium-visualizer-construction-panel">
            <div className="stadium-visualizer-construction-header">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 22h20M6 18v4M10 14v8M14 10v12M18 6v16" />
                </svg>
                <span>
                  {construction.stepName
                    ? `${construction.stepName} (Etapa ${construction.targetStep ?? 1}/4)`
                    : `Ampliação para Nível ${construction.targetLevel}`}
                </span>
              </span>
              <span className="stadium-visualizer-weeks-left">
                {construction.weeksRemaining} {construction.weeksRemaining === 1 ? 'semana restante' : 'semanas restantes'}
              </span>
            </div>
            {(() => {
              if (!construction) return null;
              const targetInfo = getStadiumTierInfo(construction.targetLevel);
              const totalWeeks = targetInfo?.upgradeWeeks ?? 4;
              const progressPct = Math.max(
                0,
                Math.min(100, Math.round(((totalWeeks - construction.weeksRemaining) / totalWeeks) * 100))
              );
              return (
                <div
                  className="stadium-visualizer-progress-bar"
                  role="progressbar"
                  aria-label="Progresso da Obra"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="stadium-visualizer-progress-fill"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {currentTierInfo && (
        <div className="stadium-visualizer-footer">
          <p className="stadium-visualizer-desc">{currentTierInfo.description}</p>
          <div className="stadium-visualizer-stats">
            <span>Manutenção semanal: R$ {currentTierInfo.weeklyMaintenance.toLocaleString('pt-BR')}</span>
            {nextTierInfo && (
              <span className="stadium-visualizer-next-hint">
                Próximo: {nextTierInfo.name} ({formatNumber(nextTierInfo.capacity)} lug.)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { Player } from '@tactical-arena/shared';
import type { PenaltyTargetZone, PenaltyShotOutcome } from '@tactical-arena/shared';
import { positionLabel } from '../lib/positionLabel.js';
import { GoalNetIcon, TrophyIcon, ShieldIcon } from './icons/AppIcons.js';

interface PenaltyInteractiveModalProps {
  isOpen: boolean;
  taker: Player;
  keeper: Player | null;
  availableTakers: Player[];
  minute?: number;
  isShootout?: boolean;
  shootoutRound?: number;
  onSelectTaker: (player: Player) => void;
  onShoot: (targetZone: PenaltyTargetZone) => void;
  lastOutcome?: {
    outcome: PenaltyShotOutcome;
    targetZone: PenaltyTargetZone;
    gkZone: PenaltyTargetZone;
  } | null;
  onConfirmOutcome: () => void;
}

const ZONE_LABELS: Record<PenaltyTargetZone, { title: string; subtitle: string; icon: string }> = {
  1: { title: 'Superior Esquerdo', subtitle: 'Ângulo / Risco Alto', icon: '↖' },
  2: { title: 'Superior Direito', subtitle: 'Ângulo / Risco Alto', icon: '↗' },
  3: { title: 'Inferior Esquerdo', subtitle: 'Rasteiro / Seguro', icon: '↙' },
  4: { title: 'Inferior Direito', subtitle: 'Rasteiro / Seguro', icon: '↘' },
  5: { title: 'Centro do Gol', subtitle: 'Firme / Risco Médio', icon: '⬆' },
};

export function PenaltyInteractiveModal({
  isOpen,
  taker,
  keeper,
  availableTakers,
  minute,
  isShootout,
  shootoutRound,
  onSelectTaker,
  onShoot,
  lastOutcome,
  onConfirmOutcome,
}: PenaltyInteractiveModalProps) {
  const [selectedZone, setSelectedZone] = useState<PenaltyTargetZone | null>(null);
  const [isShooting, setIsShooting] = useState(false);

  if (!isOpen) return null;

  const handleZoneClick = (zone: PenaltyTargetZone) => {
    if (lastOutcome || isShooting) return;
    setSelectedZone(zone);
    setIsShooting(true);
    // Simulate brief suspense before triggering shot resolution
    setTimeout(() => {
      onShoot(zone);
      setIsShooting(false);
    }, 600);
  };

  const penAttr = taker.detailedAttributes?.PENALTY_TAKING ?? taker.attributes.finishing;
  const shotPower = taker.detailedAttributes?.SHOT_POWER ?? taker.attributes.finishing;
  const gkSaving = keeper?.detailedAttributes?.PENALTY_SAVING ?? keeper?.attributes.goalkeeping ?? 70;
  const gkReflexes = keeper?.detailedAttributes?.REFLEXES ?? keeper?.attributes.goalkeeping ?? 70;

  return (
    <div className="penalty-modal-backdrop" role="dialog" aria-label="Cobrança de Pênalti">
      <div className="penalty-modal-card">
        {/* Header */}
        <div className="penalty-modal-header">
          <div className="penalty-modal-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {isShootout ? <TrophyIcon size={14} color="#fbbf24" /> : <GoalNetIcon size={14} color="#38bdf8" />}
            {isShootout ? `DISPUTA DE PÊNALTIS • COBRANÇA #${shootoutRound || 1}` : `PÊNALTI AOS ${minute || 90}'`}
          </div>
          <h2>{isShootout ? 'Decisão na Marca da Cal' : 'Penalidade Máxima'}</h2>
          <p className="muted">
            {lastOutcome
              ? 'Resultado da finalização'
              : 'Selecione o cobrador e clique no quadrante do gol onde deseja finalizar'}
          </p>
        </div>

        {/* Duel Duelists Header */}
        <div className="penalty-duel-container">
          {/* Striker */}
          <div className="duel-card striker-card">
            <div className="duel-card-role">BATEDOR</div>
            <div className="duel-card-name">
              <strong>{taker.name}</strong>
              <span className="duel-card-pos">({positionLabel(taker.position)})</span>
            </div>
            <div className="duel-stats-grid">
              <div className="duel-stat-item">
                <span className="duel-stat-label">Pênalti</span>
                <span className="duel-stat-val highlight">{penAttr}</span>
              </div>
              <div className="duel-stat-item">
                <span className="duel-stat-label">Força</span>
                <span className="duel-stat-val">{shotPower}</span>
              </div>
              <div className="duel-stat-item">
                <span className="duel-stat-label">Moral</span>
                <span className="duel-stat-val">{Math.round(taker.morale ?? 0)}%</span>
              </div>
              <div className="duel-stat-item">
                <span className="duel-stat-label">Fadiga</span>
                <span className="duel-stat-val">{Math.round(taker.fatigue ?? 0)}%</span>
              </div>
            </div>

            {/* Taker Switcher if not yet shot */}
            {!lastOutcome && availableTakers.length > 1 && (
              <div className="taker-selector-dropdown">
                <label htmlFor="taker-select">Trocar cobrador:</label>
                <select
                  id="taker-select"
                  value={taker.id}
                  onChange={(e) => {
                    const found = availableTakers.find((p) => p.id === e.target.value);
                    if (found) onSelectTaker(found);
                  }}
                >
                  {availableTakers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (PEN: {p.detailedAttributes?.PENALTY_TAKING ?? p.attributes.finishing})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="duel-vs-badge">VS</div>

          {/* Goalkeeper */}
          <div className="duel-card keeper-card">
            <div className="duel-card-role">GOLEIRO</div>
            <div className="duel-card-name">
              <strong>{keeper?.name ?? 'Goleiro'}</strong>
              <span className="duel-card-pos">(GK)</span>
            </div>
            <div className="duel-stats-grid">
              <div className="duel-stat-item">
                <span className="duel-stat-label">Pênaltis</span>
                <span className="duel-stat-val highlight">{gkSaving}</span>
              </div>
              <div className="duel-stat-item">
                <span className="duel-stat-label">Reflexos</span>
                <span className="duel-stat-val">{gkReflexes}</span>
              </div>
              <div className="duel-stat-item">
                <span className="duel-stat-label">Overall</span>
                <span className="duel-stat-val">{keeper?.overall ?? 70}</span>
              </div>
              <div className="duel-stat-item">
                <span className="duel-stat-label">Defesa</span>
                <span className="duel-stat-val">{keeper?.attributes.goalkeeping ?? 70}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2D Goal Target Field */}
        <div className="penalty-goal-arena">
          <div className="goal-crossbar" />
          <div className="goal-post-left" />
          <div className="goal-post-right" />
          <div className="goal-net-mesh" />

          {/* 5 Interactive Quadrants */}
          <div className="goal-quadrants-grid">
            {/* Top Row: 1, 5, 2 */}
            <button
              type="button"
              className={`goal-quadrant quad-1 ${selectedZone === 1 ? 'selected' : ''} ${lastOutcome?.targetZone === 1 ? 'target-hit' : ''} ${lastOutcome?.gkZone === 1 ? 'gk-dive' : ''}`}
              onClick={() => handleZoneClick(1)}
              disabled={!!lastOutcome || isShooting}
            >
              <span className="quad-icon">{ZONE_LABELS[1].icon}</span>
              <span className="quad-title">{ZONE_LABELS[1].title}</span>
              <span className="quad-sub">{ZONE_LABELS[1].subtitle}</span>
            </button>

            <button
              type="button"
              className={`goal-quadrant quad-5 ${selectedZone === 5 ? 'selected' : ''} ${lastOutcome?.targetZone === 5 ? 'target-hit' : ''} ${lastOutcome?.gkZone === 5 ? 'gk-dive' : ''}`}
              onClick={() => handleZoneClick(5)}
              disabled={!!lastOutcome || isShooting}
            >
              <span className="quad-icon">{ZONE_LABELS[5].icon}</span>
              <span className="quad-title">{ZONE_LABELS[5].title}</span>
              <span className="quad-sub">{ZONE_LABELS[5].subtitle}</span>
            </button>

            <button
              type="button"
              className={`goal-quadrant quad-2 ${selectedZone === 2 ? 'selected' : ''} ${lastOutcome?.targetZone === 2 ? 'target-hit' : ''} ${lastOutcome?.gkZone === 2 ? 'gk-dive' : ''}`}
              onClick={() => handleZoneClick(2)}
              disabled={!!lastOutcome || isShooting}
            >
              <span className="quad-icon">{ZONE_LABELS[2].icon}</span>
              <span className="quad-title">{ZONE_LABELS[2].title}</span>
              <span className="quad-sub">{ZONE_LABELS[2].subtitle}</span>
            </button>

            {/* Bottom Row: 3, (Center floor / Goalkeeper), 4 */}
            <button
              type="button"
              className={`goal-quadrant quad-3 ${selectedZone === 3 ? 'selected' : ''} ${lastOutcome?.targetZone === 3 ? 'target-hit' : ''} ${lastOutcome?.gkZone === 3 ? 'gk-dive' : ''}`}
              onClick={() => handleZoneClick(3)}
              disabled={!!lastOutcome || isShooting}
            >
              <span className="quad-icon">{ZONE_LABELS[3].icon}</span>
              <span className="quad-title">{ZONE_LABELS[3].title}</span>
              <span className="quad-sub">{ZONE_LABELS[3].subtitle}</span>
            </button>

            <div className="goal-keeper-visual">
              <span className="keeper-icon-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldIcon size={26} color="#38bdf8" />
              </span>
              <span className="keeper-zone-tag">Marca da Cal</span>
            </div>

            <button
              type="button"
              className={`goal-quadrant quad-4 ${selectedZone === 4 ? 'selected' : ''} ${lastOutcome?.targetZone === 4 ? 'target-hit' : ''} ${lastOutcome?.gkZone === 4 ? 'gk-dive' : ''}`}
              onClick={() => handleZoneClick(4)}
              disabled={!!lastOutcome || isShooting}
            >
              <span className="quad-icon">{ZONE_LABELS[4].icon}</span>
              <span className="quad-title">{ZONE_LABELS[4].title}</span>
              <span className="quad-sub">{ZONE_LABELS[4].subtitle}</span>
            </button>
          </div>
        </div>

        {/* Outcome Display Banner */}
        {lastOutcome && (
          <div className={`penalty-outcome-banner outcome-${lastOutcome.outcome.toLowerCase()}`}>
            <div className="outcome-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {lastOutcome.outcome === 'GOL' ? (
                <GoalNetIcon size={36} color="#38bdf8" />
              ) : (
                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  {lastOutcome.outcome === 'DEFESA' ? 'DEFESA' : lastOutcome.outcome === 'TRAVE' ? 'TRAVE' : 'FORA'}
                </span>
              )}
            </div>
            <div className="outcome-content">
              <h3>
                {lastOutcome.outcome === 'GOL' && 'GOOOOL! A bola morreu nas redes!'}
                {lastOutcome.outcome === 'DEFESA' && 'DEFENDEU O GOLEIRO! Grande intervenção!'}
                {lastOutcome.outcome === 'TRAVE' && 'NA TRAVE! A bola carimbou o poste!'}
                {lastOutcome.outcome === 'FORA' && 'PRA FORA! Finalização sem direção!'}
              </h3>
              <p>
                O batedor mirou no <strong>{ZONE_LABELS[lastOutcome.targetZone].title}</strong> e o goleiro pulou no{' '}
                <strong>{ZONE_LABELS[lastOutcome.gkZone].title}</strong>.
              </p>
            </div>
            <button className="btn-confirm-outcome" onClick={onConfirmOutcome}>
              Continuar Partida
            </button>
          </div>
        )}

        {isShooting && (
          <div className="shooting-suspense-banner" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <GoalNetIcon size={18} color="#38bdf8" /> Finalizando na marca da cal...
          </div>
        )}
      </div>
    </div>
  );
}

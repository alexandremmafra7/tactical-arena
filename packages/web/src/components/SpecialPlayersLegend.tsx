import type React from 'react';
import { createPortal } from 'react-dom';
import { GenioStarIcon, BaitaChevronIcon, PromessaSub20Icon } from './SpecialPlayerIcon.js';

export interface SpecialPlayersLegendProps {
  /** Optional close callback if displayed inside an overlay or modal */
  onClose?: () => void;
  /** Whether the card is embedded inside another view or stands alone */
  embedded?: boolean;
  /** Custom extra class names */
  className?: string;
}

/**
 * Visual Legend card for Special Players ("LEGENDA DE JOGADORES ESPECIAIS"),
 * matching the authentic tactical dark/gold frame and column specifications.
 */
export function SpecialPlayersLegend({
  onClose,
  embedded = false,
  className = '',
}: SpecialPlayersLegendProps) {
  return (
    <div className={`special-players-legend-card ${embedded ? 'embedded' : ''} ${className}`}>
      <div className="special-players-legend-header">
        <h3 className="special-players-legend-title">LEGENDA DE JOGADORES ESPECIAIS</h3>
        {onClose && (
          <button
            type="button"
            className="special-players-legend-close"
            onClick={onClose}
            aria-label="Fechar legenda"
          >
            ✕
          </button>
        )}
      </div>

      <div className="special-players-legend-body">
        <div className="special-legend-card-list">
          {/* Row 1: Gênio / Extraclasse */}
          <div className="special-legend-row row-genio">
            <div className="special-legend-icon-col">
              <div className="special-legend-icon-container genio-glow-bg">
                <GenioStarIcon size={48} />
              </div>
            </div>
            <div className="special-legend-text-col">
              <div className="tier-name-highlight name-genio">
                <strong>Gênio / Extraclasse</strong>
              </div>
              <p className="tier-desc-text">
                Muda jogos sozinho, quase impossível de anular, decide finais.
              </p>
            </div>
          </div>

          {/* Row 2: Baita Jogador / Diferenciado */}
          <div className="special-legend-row row-baita">
            <div className="special-legend-icon-col">
              <div className="special-legend-icon-container baita-glow-bg">
                <BaitaChevronIcon size={44} />
              </div>
            </div>
            <div className="special-legend-text-col">
              <div className="tier-name-highlight name-baita">
                <strong>Baita Jogador / Diferenciado</strong>
              </div>
              <p className="tier-desc-text">
                Leitura de jogo acima da média, consistente e muito acima do elenco padrão.
              </p>
            </div>
          </div>

          {/* Row 3: Promessa Sub-20 */}
          <div className="special-legend-row row-promessa">
            <div className="special-legend-icon-col">
              <div className="special-legend-icon-container promessa-glow-bg">
                <PromessaSub20Icon size={44} />
              </div>
            </div>
            <div className="special-legend-text-col">
              <div className="tier-name-highlight name-promessa">
                <strong>Promessa Sub-20 / Joia da Base</strong>
              </div>
              <p className="tier-desc-text">
                Jovem talento de altíssimo potencial e rápida evolução com minutos em campo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal wrapper for displaying the Special Players Legend anywhere in the application.
 */
export function SpecialPlayersLegendModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="options-modal-backdrop live-tactical-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(8, 7, 10, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="special-legend-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 760, width: '92vw', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <SpecialPlayersLegend onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}

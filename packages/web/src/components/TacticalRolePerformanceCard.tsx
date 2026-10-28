import { useState } from 'react';
import type { TeamRolePerformanceReport, PlayerRolePerformance, Position } from '@tactical-arena/shared';
import { TacticsIcon } from './icons/AppIcons.js';

export interface TacticalRolePerformanceCardProps {
  homeReport?: TeamRolePerformanceReport;
  awayReport?: TeamRolePerformanceReport;
  report?: TeamRolePerformanceReport;
  defaultSide?: 'home' | 'away';
}

function getRatingBadgeClass(rating: number): string {
  if (rating >= 7.8) return 'rating-exceptional';
  if (rating >= 6.8) return 'rating-good';
  if (rating >= 5.8) return 'rating-average';
  return 'rating-poor';
}

function getVerdictBadgeClass(verdict: string): string {
  switch (verdict) {
    case 'EXCELENTE':
      return 'verdict-excelente';
    case 'BOM':
      return 'verdict-bom';
    case 'REGULAR':
      return 'verdict-regular';
    case 'ABAIXO':
      return 'verdict-abaixo';
    default:
      return 'verdict-regular';
  }
}

function getPositionSectorClass(pos: Position): string {
  switch (pos) {
    case 'GK':
      return 'pos-gk';
    case 'DEF':
      return 'pos-def';
    case 'LAT':
      return 'pos-lat';
    case 'MID':
      return 'pos-mid';
    case 'ATT':
      return 'pos-att';
    default:
      return '';
  }
}

export function TacticalRolePerformanceCard({
  homeReport,
  awayReport,
  report,
  defaultSide = 'home',
}: TacticalRolePerformanceCardProps) {
  const [selectedSide, setSelectedSide] = useState<'home' | 'away'>(defaultSide);
  const [sectorFilter, setSectorFilter] = useState<'ALL' | Position>('ALL');

  const currentReport: TeamRolePerformanceReport | undefined =
    report ?? (selectedSide === 'home' ? homeReport : awayReport) ?? homeReport ?? awayReport;

  if (!currentReport) {
    return null;
  }

  const { teamName, starters, tacticalHighlights } = currentReport;

  const filteredStarters = starters.filter((player) => {
    if (sectorFilter === 'ALL') return true;
    return player.position === sectorFilter;
  });

  const hasBothReports = !!homeReport && !!awayReport;

  return (
    <section className="card role-performance-card" data-testid="tactical-role-performance-card">
      {/* Top Header */}
      <div className="role-performance-header">
        <div className="role-title-group">
          <div className="role-badge-pill">
            
            <span>DESEMPENHO DE PAPÉIS TÁTICOS</span>
          </div>
          <h2 className="role-performance-headline">
            Rendimento dos Papéis em Campo: <span className="team-highlight">{teamName}</span>
          </h2>
          <p className="role-performance-subtitle">
            Análise causal do auxiliar técnico sobre a execução das instruções e funções táticas dos titulares
          </p>
        </div>

        {/* Team Selector Toggle */}
        {hasBothReports && (
          <div className="role-team-toggle-group">
            <button
              type="button"
              className={`role-toggle-btn ${selectedSide === 'home' ? 'active' : ''}`}
              onClick={() => setSelectedSide('home')}
            >
              {homeReport?.teamName ?? 'Mandante'}
            </button>
            <button
              type="button"
              className={`role-toggle-btn ${selectedSide === 'away' ? 'active' : ''}`}
              onClick={() => setSelectedSide('away')}
            >
              {awayReport?.teamName ?? 'Visitante'}
            </button>
          </div>
        )}
      </div>

      {/* Assistant Highlights */}
      {tacticalHighlights && tacticalHighlights.length > 0 && (
        <div className="role-highlights-panel">
          <span className="role-highlights-title"><TacticsIcon size={16} color="var(--accent)" style={{ marginRight: 6, verticalAlign: '-2px' }} /> Observações do Auxiliar Técnico:</span>
          <div className="role-highlights-list">
            {tacticalHighlights.map((highlight, idx) => (
              <div key={idx} className="role-highlight-item">
                <span>{highlight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sector Filter Buttons */}
      <div className="role-filters-bar">
        <button
          type="button"
          className={`role-filter-tab ${sectorFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setSectorFilter('ALL')}
        >
          Todos ({starters.length})
        </button>
        <button
          type="button"
          className={`role-filter-tab ${sectorFilter === 'ATT' ? 'active' : ''}`}
          onClick={() => setSectorFilter('ATT')}
        >
          Ataque ({starters.filter((p) => p.position === 'ATT').length})
        </button>
        <button
          type="button"
          className={`role-filter-tab ${sectorFilter === 'MID' ? 'active' : ''}`}
          onClick={() => setSectorFilter('MID')}
        >
          Meio-Campo ({starters.filter((p) => p.position === 'MID').length})
        </button>
        <button
          type="button"
          className={`role-filter-tab ${sectorFilter === 'LAT' ? 'active' : ''}`}
          onClick={() => setSectorFilter('LAT')}
        >
          Laterais/Alas ({starters.filter((p) => p.position === 'LAT').length})
        </button>
        <button
          type="button"
          className={`role-filter-tab ${sectorFilter === 'DEF' ? 'active' : ''}`}
          onClick={() => setSectorFilter('DEF')}
        >
          Zaga ({starters.filter((p) => p.position === 'DEF').length})
        </button>
        <button
          type="button"
          className={`role-filter-tab ${sectorFilter === 'GK' ? 'active' : ''}`}
          onClick={() => setSectorFilter('GK')}
        >
          Goleiro ({starters.filter((p) => p.position === 'GK').length})
        </button>
      </div>

      {/* Starters Performance Grid */}
      <div className="role-starters-grid">
        {filteredStarters.map((starter: PlayerRolePerformance) => (
          <div key={starter.playerId} className="role-starter-card" data-testid={`role-card-${starter.playerId}`}>
            {/* Player Info Row */}
            <div className="role-starter-top">
              <div className="role-starter-identity">
                <span className={`position-tag ${getPositionSectorClass(starter.position)}`}>
                  {starter.position}
                </span>
                <strong className="starter-player-name">{starter.name}</strong>
              </div>
              <div className={`starter-rating-badge ${getRatingBadgeClass(starter.rating)}`}>
                <span className="rating-label">NOTA</span>
                <span className="rating-val">{starter.rating.toFixed(1)}</span>
              </div>
            </div>

            {/* Tactical Role & Verdict Row */}
            <div className="role-starter-function-row">
              <div className="role-name-tag">
                
                <span className="role-name-text">{starter.roleName}</span>
              </div>
              <span className={`verdict-badge ${getVerdictBadgeClass(starter.tacticalVerdict)}`}>
                {starter.tacticalVerdict}
              </span>
            </div>

            {/* Key Stat Box */}
            <div className="role-key-stat-box">
              <span className="stat-label">Impacto no Jogo:</span>
              <strong className="stat-value">{starter.keyStat}</strong>
            </div>

            {/* Causal Explanation */}
            <p className="role-explanation-text">
              {starter.explanation}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

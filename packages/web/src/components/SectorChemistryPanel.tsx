import type { SectorChemistryBreakdown } from '@tactical-arena/shared';

interface SectorChemistryPanelProps {
  chemistry: SectorChemistryBreakdown;
  compact?: boolean;
}

export function SectorChemistryPanel({ chemistry, compact }: SectorChemistryPanelProps) {
  const { defense, midfield, attack, flanks, overallScore, overallLabel, attackSynergy, defenseSynergy } = chemistry;

  const atkBonusPct = Math.round((attackSynergy - 1) * 100);
  const defBonusPct = Math.round((defenseSynergy - 1) * 100);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ffd700';
    if (score >= 40) return '#ff9800';
    return '#ff5252';
  };

  return (
    <div className={`sector-chemistry-panel ${compact ? 'compact' : ''}`}>
      {/* Header with Overall Chemistry */}
      <div className="chemistry-header">
        <div className="chemistry-title-group">
          <span className="chemistry-badge">QUÍMICA E ENTROSAMENTO</span>
          <h3 className="chemistry-main-title">
            {overallLabel} ({overallScore}%)
          </h3>
        </div>

        <div className="chemistry-synergy-tags">
          {atkBonusPct > 0 && <span className="synergy-tag atk">+{atkBonusPct}% Ataque</span>}
          {defBonusPct > 0 && <span className="synergy-tag def">+{defBonusPct}% Defesa</span>}
        </div>
      </div>

      {/* Global Progress Bar */}
      <div className="chemistry-progress-container">
        <div
          className="chemistry-progress-fill"
          style={{ width: `${overallScore}%`, background: getScoreColor(overallScore) }}
        />
      </div>

      {/* 4 Sector Cards Grid */}
      <div className="chemistry-sectors-grid">
        {/* Defense */}
        <div className="sector-card">
          <div className="sector-card-top">
            <span className="sector-name">{defense.name}</span>
            <span className="sector-score" style={{ color: getScoreColor(defense.score) }}>
              {defense.score}%
            </span>
          </div>
          <div className="sector-mini-bar">
            <div className="sector-mini-fill" style={{ width: `${defense.score}%`, background: getScoreColor(defense.score) }} />
          </div>
          <div className="sector-bonuses-list">
            {defense.activeBonuses.length === 0 ? (
              <span className="no-bonus-tag">Sem sinergias especiais ativas</span>
            ) : (
              defense.activeBonuses.map((b, i) => (
                <span key={i} className="bonus-pill active">
                  ✓ {b}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Midfield */}
        <div className="sector-card">
          <div className="sector-card-top">
            <span className="sector-name">{midfield.name}</span>
            <span className="sector-score" style={{ color: getScoreColor(midfield.score) }}>
              {midfield.score}%
            </span>
          </div>
          <div className="sector-mini-bar">
            <div className="sector-mini-fill" style={{ width: `${midfield.score}%`, background: getScoreColor(midfield.score) }} />
          </div>
          <div className="sector-bonuses-list">
            {midfield.activeBonuses.length === 0 ? (
              <span className="no-bonus-tag">Sem sinergias especiais ativas</span>
            ) : (
              midfield.activeBonuses.map((b, i) => (
                <span key={i} className="bonus-pill active">
                  ✓ {b}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Attack */}
        <div className="sector-card">
          <div className="sector-card-top">
            <span className="sector-name">{attack.name}</span>
            <span className="sector-score" style={{ color: getScoreColor(attack.score) }}>
              {attack.score}%
            </span>
          </div>
          <div className="sector-mini-bar">
            <div className="sector-mini-fill" style={{ width: `${attack.score}%`, background: getScoreColor(attack.score) }} />
          </div>
          <div className="sector-bonuses-list">
            {attack.activeBonuses.length === 0 ? (
              <span className="no-bonus-tag">Sem sinergias especiais ativas</span>
            ) : (
              attack.activeBonuses.map((b, i) => (
                <span key={i} className="bonus-pill active">
                  ✓ {b}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Flanks */}
        <div className="sector-card">
          <div className="sector-card-top">
            <span className="sector-name">{flanks.name}</span>
            <span className="sector-score" style={{ color: getScoreColor(flanks.score) }}>
              {flanks.score}%
            </span>
          </div>
          <div className="sector-mini-bar">
            <div className="sector-mini-fill" style={{ width: `${flanks.score}%`, background: getScoreColor(flanks.score) }} />
          </div>
          <div className="sector-bonuses-list">
            {flanks.activeBonuses.length === 0 ? (
              <span className="no-bonus-tag">Sem sinergias especiais ativas</span>
            ) : (
              flanks.activeBonuses.map((b, i) => (
                <span key={i} className="bonus-pill active">
                  ✓ {b}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

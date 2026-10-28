import type { OppositionDossier } from '@tactical-arena/shared';
import { ShieldIcon } from './icons/AppIcons.js';

export interface OppositionDossierCardProps {
  dossier: OppositionDossier;
  onApplyCountermeasures?: () => void;
}

export function OppositionDossierCard({ dossier, onApplyCountermeasures }: OppositionDossierCardProps) {
  const confidenceClass = dossier.confidenceRating >= 80 ? 'alta' : dossier.confidenceRating >= 60 ? 'media' : 'baixa';
  const certaintyPct = Math.round(dossier.presetIdentification.certainty);

  const defLineLabel: Record<string, string> = {
    HIGH: 'Linha Alta',
    BALANCED: 'Linha Equilibrada',
    DEEP: 'Bloco Baixo',
  };

  const paramLabel: Record<string, string> = {
    Mentality: 'Mentalidade',
    AttackApproach: 'Abordagem Ofensiva',
    AttackStyle: 'Estilo de Ataque',
    Pressing: 'Intensidade de Pressão',
    DefensiveLine: 'Altura da Defesa',
    MarkingStyle: 'Estilo de Marcação',
  };

  const valueLabel: Record<string, string> = {
    ATTACKING: 'Ofensiva',
    DEFENSIVE: 'Defensiva',
    BALANCED: 'Equilibrada',
    DIRECT: 'Direta (Bolas Longas)',
    PATIENT: 'Paciente (Posse Curta)',
    FLANKS: 'Explorar Pontas',
    THROUGH_MIDDLE: 'Jogo por Dentro',
    HIGH_PRESS: 'Pressão Alta',
    LOW_BLOCK: 'Bloco Baixo',
  };

  return (
    <section className="card dossier-card" data-testid="opposition-dossier-card">
      <div className="dossier-header">
        <div className="dossier-title-row">
          <div>
            <h3 className="dossier-title">Dossiê de Espionagem: {dossier.opponentName}</h3>
            <p className="dossier-subtitle">
              Relatório tático de reconhecimento e recomendações do auxiliar
            </p>
          </div>
        </div>
        <span className={`briefing-confidence ${confidenceClass}`}>
          Scout: {dossier.confidenceRating}% precisão
        </span>
      </div>

      <div className="dossier-body">
        {/* Preset Identification & Defensive Line Row */}
        <div className="dossier-overview-grid">
          <div className="dossier-panel dossier-preset-box">
            <span className="dossier-panel-label">Estilo Previsto</span>
            <div className="dossier-preset-title">
              <strong>{dossier.presetIdentification.presetName}</strong>
              <span className="dossier-certainty-badge">
                {certaintyPct}% convicção
              </span>
            </div>
          </div>

          <div className="dossier-panel dossier-def-box">
            <span className="dossier-panel-label">Linha Defensiva & Estrutura</span>
            <div className="dossier-def-tags">
              <span className={`dossier-badge def-${dossier.defensiveLineAnalysis.height.toLowerCase()}`}>
                {defLineLabel[dossier.defensiveLineAnalysis.height] || dossier.defensiveLineAnalysis.height}
              </span>
              {dossier.defensiveLineAnalysis.restDefence !== 'UNKNOWN' && (
                <span className="dossier-badge def-rest">
                  Rest: {dossier.defensiveLineAnalysis.restDefence}
                </span>
              )}
            </div>
            <p className="dossier-def-desc">{dossier.defensiveLineAnalysis.description}</p>
          </div>
        </div>

        {/* Key Threats */}
        {dossier.keyThreats.length > 0 && (
          <div className="dossier-section">
            <h4 className="dossier-section-title">Jogador Chave a Neutralizar</h4>
            <div className="dossier-threats-list">
              {dossier.keyThreats.map((threat) => (
                <div key={threat.playerId} className="dossier-threat-item">
                  <div className="dossier-threat-header">
                    <span className="dossier-threat-name">{threat.playerName}</span>
                    <span className="dossier-threat-overall">OVR {threat.overall}</span>
                  </div>
                  <span className="dossier-threat-reason">{threat.threatReason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vulnerabilities & Countermeasures */}
        <div className="dossier-tactics-split">
          {dossier.vulnerabilities.length > 0 && (
            <div className="dossier-split-col">
              <h4 className="dossier-section-title">Brechas Identificadas</h4>
              <ul className="dossier-vulnerabilities-list">
                {dossier.vulnerabilities.map((v, i) => (
                  <li key={i} className="dossier-vuln-item">
                    <strong className="dossier-vuln-area">{v.area}:</strong>
                    <span className="dossier-vuln-desc"> {v.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dossier.countermeasures.length > 0 && (
            <div className="dossier-split-col">
              <h4 className="dossier-section-title">Contramedidas Recomendadas</h4>
              <div className="dossier-countermeasures-list">
                {dossier.countermeasures.map((c, i) => (
                  <div key={i} className="dossier-counter-item">
                    <div className="dossier-counter-head">
                      <span className="dossier-counter-param">
                        {paramLabel[c.param] || c.param}:
                      </span>
                      <strong className="dossier-counter-val">
                        {valueLabel[c.recommendedValue] || c.recommendedValue}
                      </strong>
                    </div>
                    <p className="dossier-counter-reason">{c.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {onApplyCountermeasures && (
          <div className="dossier-footer-actions">
            <button
              type="button"
              className="btn-briefing-assistant"
              onClick={onApplyCountermeasures}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <ShieldIcon size={16} /> Adotar Contramedidas do Dossiê
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

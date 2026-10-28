import { useState } from 'react';
import type { Club, DirectorTransferRecommendation, Player } from '@tactical-arena/shared';
import {
  computeDirectorTransferRecommendations,
  getDirectorTransferDiscount,
  getPlayerTier,
} from '@tactical-arena/shared';
import { positionLabel } from '../lib/positionLabel.js';
import { footLabel } from '../lib/footLabel.js';
import { ClubCrest } from './ClubCrest.js';
import { SpecialPlayerBadge } from './SpecialPlayerIcon.js';
import { CountryFlag } from './CountryFlag.js';
import {
  TacticsIcon,
  StaffIcon,
  LightningIcon,
  EyeIcon,
  HandshakeIcon,
  SearchIcon,
  UsersIcon,
  BarChartIcon,
  SwordsIcon,
} from './icons/AppIcons.js';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export interface DirectorRecommendationsCardProps {
  club: Club;
  availablePlayers: any[];
  divisionAvgRating?: number;
  onQuickOffer: (recommendation: DirectorTransferRecommendation) => void;
  onCustomProposal?: (recommendation: DirectorTransferRecommendation) => void;
  onBuyout?: (recommendation: DirectorTransferRecommendation) => void;
  isCompact?: boolean;
}

export function DirectorRecommendationsCard({
  club,
  availablePlayers,
  divisionAvgRating,
  onQuickOffer,
  onCustomProposal,
  onBuyout,
  isCompact = false,
}: DirectorRecommendationsCardProps) {
  const [selectedReport, setSelectedReport] = useState<DirectorTransferRecommendation | null>(null);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);

  const footballDirector = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const directorDiscount = getDirectorTransferDiscount(footballDirector);
  const delegation = club.staffDelegationConfig;
  const isCasualMode = delegation?.presetMode === 'brasfoot_casual' || delegation?.scoutingAutomation === 'auto_shortlist';

  const recommendations = computeDirectorTransferRecommendations(club, availablePlayers, divisionAvgRating);

  if (recommendations.length === 0) {
    return null;
  }

  async function handleQuickOfferClick(rec: DirectorTransferRecommendation) {
    setBusyPlayerId(rec.player.id);
    try {
      await onQuickOffer(rec);
    } finally {
      setBusyPlayerId(null);
    }
  }

  return (
    <>
      <div
        className="card director-recommendations-card"
        style={{
          background: 'linear-gradient(135deg, #1b162b 0%, #100e1a 100%)',
          border: '1.5px solid rgba(168, 85, 247, 0.4)',
          borderRadius: 12,
          padding: isCompact ? '12px 14px' : '16px 20px',
          marginBottom: 16,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TacticsIcon size={22} color="#c084fc" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: isCompact ? '1rem' : '1.15rem', color: '#fff' }}>
                  Sugestões do Diretor de Futebol
                </h3>
                <span
                  style={{
                    background: 'rgba(168, 85, 247, 0.2)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 12,
                    textTransform: 'uppercase',
                  }}
                >
                  {recommendations.length} Alvos Prioritários
                </span>
              </div>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.78rem' }}>
                {footballDirector ? (
                  <>
                    <StaffIcon size={14} color="#a855f7" /> <strong>{footballDirector.name}</strong> ({footballDirector.rating} OVR) • Persuasão: <span style={{ color: '#4ade80' }}>-{(directorDiscount * 100).toFixed(0)}% nas propostas</span>
                  </>
                ) : (
                  <><StaffIcon size={14} color="#a855f7" /> Cargo Vago • Recomendações preliminares da comissão técnica</>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isCasualMode ? (
              <span style={{ fontSize: '0.74rem', background: '#064e3b', color: '#6ee7b7', padding: '3px 8px', borderRadius: 6, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <LightningIcon size={12} color="#6ee7b7" /> Modo Rápido Ativo (1-Clique)
              </span>
            ) : (
              <span style={{ fontSize: '0.74rem', background: '#1e1b4b', color: '#a5b4fc', padding: '3px 8px', borderRadius: 6, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <EyeIcon size={12} color="#a5b4fc" /> Relatórios Detalhados Ativos
              </span>
            )}
          </div>
        </div>

        {/* Recommendations List */}
        <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {recommendations.map((rec) => {
            const p = rec.player;
            const tier = getPlayerTier(p.overall, p.starLevel, p.diferenciado, p.age, p.potential, p.name);
            const isBusy = busyPlayerId === p.id;
            const starter = rec.comparisonWithStarter;

            return (
              <div
                key={`${rec.sellerClubId}-${p.id}`}
                className="director-rec-item"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: rec.urgency === 'HIGH' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div>
                  {/* Top Line: Player Info & Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`pos-pill pos-${p.position}`} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                          {positionLabel(p.position)}
                        </span>
                        <strong style={{ fontSize: '0.98rem', color: '#fff' }}>{p.name}</strong>
                        {tier && <SpecialPlayerBadge tier={tier} size="sm" />}
                        {p.age <= 21 && p.potential >= 80 && (
                          <span className="scout-badge badge-youth">
                            SUB-21
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span className="crest-name" style={{ fontSize: '0.76rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ClubCrest club={{ id: rec.sellerClubId, name: rec.sellerClubName, slug: rec.sellerClubId }} size={18} /> {rec.sellerClubName}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>• {p.age} anos • {footLabel(p.preferredFoot)}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span className="ovr-badge" style={{ fontSize: '0.92rem', padding: '2px 7px' }}>{p.overall}</span>
                      {rec.urgency === 'HIGH' ? (
                        <span className="scout-badge badge-urgency">
                          <span className="status-dot dot-red" /> CARÊNCIA
                        </span>
                      ) : rec.isStarterUpgrade ? (
                        <span className="scout-badge badge-starter">
                          <span className="status-dot dot-green" /> TITULAR
                        </span>
                      ) : (
                        <span className="scout-badge badge-rotation">
                          <span className="status-dot dot-yellow" /> REFORÇO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Starter Comparison Pill */}
                  {starter?.currentStarterName ? (
                    <div style={{ marginTop: 6, background: 'rgba(0, 0, 0, 0.25)', padding: '4px 8px', borderRadius: 6, fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Titular: <strong>{starter.currentStarterName}</strong> ({starter.currentStarterOverall} OVR)</span>
                      <strong style={{ color: starter.overallDifference > 0 ? '#4ade80' : starter.overallDifference === 0 ? '#fbbf24' : '#94a3b8' }}>
                        {starter.overallDifference > 0 ? `+${starter.overallDifference} OVR ➔ Evolução` : starter.overallDifference === 0 ? '= Mesmo nível' : `${starter.overallDifference} OVR`}
                      </strong>
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '4px 8px', borderRadius: 6, fontSize: '0.72rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span><strong>Posição desguarnecida:</strong> Atleta chegará como titular absoluto.</span>
                    </div>
                  )}

                  {/* Rationale Balloon */}
                  <div style={{ marginTop: 6, background: 'rgba(168, 85, 247, 0.08)', borderLeft: '3px solid #a855f7', padding: '5px 8px', borderRadius: 4, fontSize: '0.74rem', color: '#e9d5ff', fontStyle: 'italic' }}>
                    "{rec.rationale}"
                  </div>

                  {/* Pricing Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: '0.76rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: 6 }}>
                    <span className="muted">Oferta Recomendada:</span>
                    <strong style={{ color: '#4ade80', fontSize: '0.88rem' }}>{formatMoney(rec.suggestedOfferPrice)}</strong>
                  </div>
                </div>

                {/* Actions Row */}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1, fontSize: '0.76rem', padding: '6px 10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    disabled={isBusy || club.budget < rec.suggestedOfferPrice}
                    onClick={() => handleQuickOfferClick(rec)}
                    title="Envia proposta imediata pelo valor avaliado pelo Diretor"
                  >
                    {isBusy ? 'Enviando...' : <><LightningIcon size={14} /> Proposta Imediata ({formatMoney(rec.suggestedOfferPrice)})</>}
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.76rem', padding: '6px 10px', borderColor: 'rgba(168, 85, 247, 0.5)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setSelectedReport(rec)}
                    title="Visualizar relatório completo do olheiro com atributos e comparação"
                  >
                    <EyeIcon size={14} /> Relatório
                  </button>

                  {onCustomProposal && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.76rem', padding: '6px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => onCustomProposal(rec)}
                      title="Abrir negociação personalizada com trocas e parcelas"
                    >
                      <HandshakeIcon size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          MODAL: RELATÓRIO COMPLETO DO OLHEIRO / DIRETOR DE FUTEBOL (FM STYLE)
          ========================================================================= */}
      {selectedReport && (
        <div className="options-modal-backdrop" onClick={() => setSelectedReport(null)}>
          <div className="options-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="options-modal-header" style={{ borderBottom: '1px solid rgba(168, 85, 247, 0.3)' }}>
              <div className="options-modal-title">
                <SearchIcon size={22} color="#a855f7" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>Relatório do Olheiro</h2>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    Análise aprofundada de {selectedReport.player.name} ({positionLabel(selectedReport.player.position)})
                  </span>
                </div>
              </div>
              <button type="button" className="options-modal-close" onClick={() => setSelectedReport(null)}>✕</button>
            </div>

            <div className="options-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Profile Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: '#1c1924', border: '2px solid #a855f7', borderRadius: '50%', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UsersIcon size={24} color="#a855f7" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>{selectedReport.player.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <ClubCrest club={{ id: selectedReport.sellerClubId, name: selectedReport.sellerClubName }} size={16} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{selectedReport.sellerClubName}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>• {selectedReport.player.age} anos • {footLabel(selectedReport.player.preferredFoot)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="ovr-badge" style={{ fontSize: '1.2rem', padding: '4px 10px' }}>{selectedReport.player.overall}</span>
                  <span className="muted" style={{ display: 'block', fontSize: '0.72rem', marginTop: 2 }}>Potencial: {selectedReport.player.potential}</span>
                </div>
              </div>

              {/* Attributes Radar Grid */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <BarChartIcon size={16} color="#a855f7" /> Atributos Técnicos e Físicos
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                    <span className="muted" style={{ fontSize: '0.7rem', display: 'block' }}>Ritmo / Pace</span>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{selectedReport.player.attributes.pace}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                    <span className="muted" style={{ fontSize: '0.7rem', display: 'block' }}>Finalização</span>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{selectedReport.player.attributes.finishing}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                    <span className="muted" style={{ fontSize: '0.7rem', display: 'block' }}>Passe / Criação</span>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{selectedReport.player.attributes.passing}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                    <span className="muted" style={{ fontSize: '0.7rem', display: 'block' }}>Defesa</span>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{selectedReport.player.attributes.defending}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                    <span className="muted" style={{ fontSize: '0.7rem', display: 'block' }}>Físico / Força</span>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{selectedReport.player.attributes.physical}</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: 6, borderRadius: 6, textAlign: 'center' }}>
                    <span className="muted" style={{ fontSize: '0.7rem', display: 'block' }}>Goleiro</span>
                    <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{selectedReport.player.attributes.goalkeeping}</strong>
                  </div>
                </div>
              </div>

              {/* Head to Head Starter Comparison */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <SwordsIcon size={16} color="#38bdf8" /> Comparação com Titular Atual
                </h4>
                {selectedReport.comparisonWithStarter?.currentStarterName ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 6 }}>
                      <span className="muted" style={{ fontSize: '0.72rem' }}>Titular Atual</span>
                      <h5 style={{ margin: '2px 0 0', fontSize: '0.88rem' }}>{selectedReport.comparisonWithStarter.currentStarterName}</h5>
                      <span className="ovr-badge" style={{ fontSize: '0.8rem', marginTop: 4, display: 'inline-block' }}>
                        {selectedReport.comparisonWithStarter.currentStarterOverall} OVR
                      </span>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 800, color: selectedReport.comparisonWithStarter.overallDifference > 0 ? '#4ade80' : '#fbbf24' }}>
                      ➔ {selectedReport.comparisonWithStarter.overallDifference > 0 ? `+${selectedReport.comparisonWithStarter.overallDifference}` : selectedReport.comparisonWithStarter.overallDifference}
                    </div>

                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 8, borderRadius: 6 }}>
                      <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>Alvo Recomendado</span>
                      <h5 style={{ margin: '2px 0 0', fontSize: '0.88rem', color: '#fff' }}>{selectedReport.player.name}</h5>
                      <span className="ovr-badge" style={{ fontSize: '0.8rem', marginTop: 4, display: 'inline-block' }}>
                        {selectedReport.player.overall} OVR
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                    O clube não possui titular consolidado nesta posição. A contratação suprirá uma lacuna direta no time principal.
                  </p>
                )}
              </div>

              {/* Valuation Box */}
              <div className="buyout-details-box" style={{ margin: 0 }}>
                <div className="buyout-row">
                  <span>Valor de Mercado:</span>
                  <strong>{formatMoney(selectedReport.player.marketValue)}</strong>
                </div>
                <div className="buyout-row">
                  <span>Multa Rescisória:</span>
                  <strong>{formatMoney(selectedReport.player.releaseClause)}</strong>
                </div>
                <div className="buyout-row highlight">
                  <span>Oferta Sugerida pelo Diretor:</span>
                  <strong style={{ color: '#4ade80', fontSize: '1.05rem' }}>{formatMoney(selectedReport.suggestedOfferPrice)}</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn-options-action save"
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => {
                    const target = selectedReport;
                    setSelectedReport(null);
                    handleQuickOfferClick(target);
                  }}
                >
                  <LightningIcon size={14} /> Enviar Proposta Imediata ({formatMoney(selectedReport.suggestedOfferPrice)})
                </button>

                {onCustomProposal && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={() => {
                      const target = selectedReport;
                      setSelectedReport(null);
                      onCustomProposal(target);
                    }}
                  >
                    <HandshakeIcon size={14} /> Proposta Personalizada
                  </button>
                )}

                {onBuyout && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => {
                      const target = selectedReport;
                      setSelectedReport(null);
                      onBuyout(target);
                    }}
                  >
                    <LightningIcon size={14} /> Multa
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

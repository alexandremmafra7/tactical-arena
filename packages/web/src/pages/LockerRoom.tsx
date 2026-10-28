import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type {
  Club,
  TeamTalkOption,
  TeamTalkContext,
  LockerRoomState,
  PlayerHierarchyEntry,
  HierarchyTier,
  SocialGroup,
  MediationApproach,
} from '@tactical-arena/shared';
import {
  computeLockerRoomHierarchy,
  getAvailableTeamTalks,
  applyTeamTalk,
  computeSocialGroupsSummary,
  resolvePlayerConcernWithLeader,
  SOCIAL_GROUP_LABELS,
} from '@tactical-arena/shared';
import { getClub } from '../api/client.js';
import { TeamTalkModal } from '../components/TeamTalkModal.js';
import { ClubNav } from '../components/ClubNav.js';
import {
  CrownIcon,
  StarIcon,
  ShieldIcon,
  SquadIcon,
  FlameIcon,
  CheckIcon,
  AlertTriangleIcon,
  SoccerBallIcon,
  AcademyIcon,
  TrophyIcon,
} from '../components/icons/AppIcons.js';

export interface LockerRoomViewProps {
  club: Club;
  state: LockerRoomState;
  onOpenTeamTalk?: () => void;
  onResolveConcern?: (targetPlayerId: string, leaderPlayerId: string, approach: MediationApproach) => void;
  onClubUpdate?: (club: Club) => void;
}

const TIER_CONFIG: {
  tier: HierarchyTier;
  label: string;
  badge: string;
  iconType: 'crown' | 'star' | 'shield' | 'squad';
  description: string;
}[] = [
  {
    tier: 'TEAM_LEADER',
    label: 'Líderes do Elenco',
    badge: 'Capitães & Pilares',
    iconType: 'crown',
    description: 'Voz máxima do vestiário e referência moral do clube',
  },
  {
    tier: 'HIGHLY_INFLUENTIAL',
    label: 'Muito Influentes',
    badge: 'Núcleo Pesado',
    iconType: 'star',
    description: 'Atletas respeitados que guiam os grupos sociais',
  },
  {
    tier: 'INFLUENTIAL',
    label: 'Influentes',
    badge: 'Grupo Consolidado',
    iconType: 'shield',
    description: 'Jogadores integrados com tempo de casa ou boa minutagem',
  },
  {
    tier: 'GENERAL_SQUAD',
    label: 'Elenco Geral',
    badge: 'Base do Grupo',
    iconType: 'squad',
    description: 'Recém-chegados, jovens e jogadores de rotação',
  },
];

const ATMOSPHERE_CONFIG: Record<
  LockerRoomState['atmosphere'],
  { label: string; badgeClass: string; iconType: 'flame' | 'check' | 'shield' | 'warning' }
> = {
  EXCELLENT: { label: 'Ambiente Fantástico', badgeClass: 'atmosphere-excellent', iconType: 'flame' },
  GOOD: { label: 'Vestiário Unido', badgeClass: 'atmosphere-good', iconType: 'check' },
  NORMAL: { label: 'Ambiente Estável', badgeClass: 'atmosphere-normal', iconType: 'shield' },
  DISRUPTED: { label: 'Vestiário Dividido', badgeClass: 'atmosphere-disrupted', iconType: 'warning' },
  CRITICAL: { label: 'Motim / Crise', badgeClass: 'atmosphere-critical', iconType: 'warning' },
};

export function LockerRoomView({
  club,
  state,
  onOpenTeamTalk,
  onResolveConcern,
  onClubUpdate,
}: LockerRoomViewProps) {
  const navigate = useNavigate();
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const atmosphereInfo = ATMOSPHERE_CONFIG[state.atmosphere] ?? ATMOSPHERE_CONFIG.NORMAL;
  const socialSummaries = computeSocialGroupsSummary(state.hierarchy);

  // Identificar o capitão / líder principal para mediações
  const primaryLeader =
    state.hierarchy.find((h) => h.tier === 'TEAM_LEADER') ??
    state.hierarchy.find((h) => h.playerId === club.captainPlayerId) ??
    state.hierarchy[0];
  const leaderId = primaryLeader?.playerId ?? club.captainPlayerId ?? (club.players[0]?.id ?? '');
  const leaderName = primaryLeader?.playerName ?? 'Capitão';

  // Jogadores que possuem preocupações ativas não resolvidas localmente
  const unsatisfiedPlayers = state.hierarchy.filter(
    (h) => Boolean(h.concern) && !resolvedIds.has(h.playerId),
  );

  function handleAction(targetPlayerId: string, approach: MediationApproach) {
    if (onResolveConcern) {
      onResolveConcern(targetPlayerId, leaderId, approach);
    }

    const result = resolvePlayerConcernWithLeader(club.players, targetPlayerId, leaderId, approach);
    setLocalFeedback(result.message);
    if (result.resolvedConcern) {
      setResolvedIds((prev) => new Set([...prev, targetPlayerId]));
    }
  }

  return (
    <div className="page locker-room-page">
      <ClubNav club={club} active="lockerRoom" onClubUpdate={onClubUpdate} />
      <div className="page-header">
        <div className="page-title-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Voltar para a tela anterior"
            >
              ← Voltar
            </button>
            <h1 style={{ margin: 0 }}>Vestiário do {club.name}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onOpenTeamTalk && (
              <button
                type="button"
                className="btn-primary"
                onClick={onOpenTeamTalk}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  boxShadow: '0 0 14px rgba(245, 158, 11, 0.35)',
                }}
                title="Conduzir preleção ou reunião com o elenco"
              >
                <FlameIcon size={15} fill="#ffd700" color="#ffd700" />
                <span>Reunião com o Elenco</span>
              </button>
            )}

            <div className={`atmosphere-banner-badge ${atmosphereInfo.badgeClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {atmosphereInfo.iconType === 'flame' && <FlameIcon size={14} color="#f97316" fill="#f9731640" />}
              {atmosphereInfo.iconType === 'check' && <CheckIcon size={14} color="#10b981" />}
              {atmosphereInfo.iconType === 'shield' && <ShieldIcon size={14} color="#38bdf8" />}
              {atmosphereInfo.iconType === 'warning' && <AlertTriangleIcon size={14} color="#f59e0b" />}
              <span>{atmosphereInfo.label}</span>
            </div>
          </div>
        </div>
      </div>

      {localFeedback && (
        <div className="toast-notification info" role="status" aria-live="polite">
          <span>{localFeedback}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setLocalFeedback(null)}
            aria-label="Fechar notificação"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. ESTADO GERAL DO VESTIÁRIO */}
      <section className="card locker-room-status-card">
        <h2>Estado do Vestiário</h2>
        <div className="layout-grid">
          <div className="stat-card">
            <div className="stat-label">Coesão do Elenco</div>
            <div
              className="meter"
              role="progressbar"
              aria-label="Coesão do Elenco"
              aria-valuenow={state.squadCohesion}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="meter-bar" style={{ width: `${state.squadCohesion}%` }}>
                {state.squadCohesion}%
              </div>
              <div className="meter-arrow">▲</div>
            </div>
            <p className="stat-desc">Importante: manter bom relacionamento e união entre jogadores</p>
          </div>

          <div className="stat-card">
            <div className="stat-label">Apoio ao Técnico</div>
            <div
              className="meter"
              role="progressbar"
              aria-label="Apoio ao Técnico"
              aria-valuenow={state.managerSupport}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="meter-bar" style={{ width: `${state.managerSupport}%` }}>
                {state.managerSupport}%
              </div>
              <div className="meter-arrow">▲</div>
            </div>
            <p className="stat-desc">Importante: líderes e atletas afinados com sua filosofia de jogo</p>
          </div>
        </div>
      </section>

      {/* 2. PIRÂMIDE DE HIERARQUIA DO VESTIÁRIO (4 DEGRAUS) */}
      <section className="card hierarchy-pyramid-section" data-testid="hierarchy-pyramid">
        <div className="section-title-wrap">
          <h2>Pirâmide de Hierarquia & Líderes de Equipe</h2>
          <p className="muted">
            Estrutura social e níveis de ascendência no elenco do clube
          </p>
        </div>

        <div className="locker-room-pyramid">
          {TIER_CONFIG.map(({ tier, label, badge, iconType, description }) => {
            const members = state.hierarchy.filter((h) => h.tier === tier);
            return (
              <div
                key={tier}
                className={`pyramid-tier pyramid-tier-${tier.toLowerCase().replace(/_/g, '-')}`}
                data-testid={`pyramid-tier-${tier}`}
              >
                <div className="tier-header">
                  <div className="tier-badge-group">
                    <span className="tier-icon">
                      {iconType === 'crown' && <CrownIcon size={18} color="#ffd700" fill="#ffd70033" />}
                      {iconType === 'star' && <StarIcon size={18} color="#38bdf8" fill="#38bdf833" />}
                      {iconType === 'shield' && <ShieldIcon size={18} color="#a78bfa" fill="#a78bfa33" />}
                      {iconType === 'squad' && <SquadIcon size={18} color="#94a3b8" />}
                    </span>
                    <h3 className="tier-title">{label}</h3>
                    <span className="tier-count">({members.length})</span>
                  </div>
                  <span className="tier-desc-tag">{badge}</span>
                </div>
                <p className="tier-subtext muted">{description}</p>

                {members.length === 0 ? (
                  <div className="tier-empty muted">Nenhum jogador neste patamar atualmente</div>
                ) : (
                  <div className="tier-members-grid">
                    {members.map((entry) => {
                      const isUnsatisfied = Boolean(entry.concern) && !resolvedIds.has(entry.playerId);
                      return (
                        <div
                          key={entry.playerId}
                          className={`player-hierarchy-card ${isUnsatisfied ? 'has-concern' : ''}`}
                        >
                          <div className="player-hierarchy-top">
                            <div className="player-avatar-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {entry.tier === 'TEAM_LEADER' ? (
                                <CrownIcon size={18} color="#ffd700" fill="#ffd70033" />
                              ) : entry.tier === 'HIGHLY_INFLUENTIAL' ? (
                                <StarIcon size={18} color="#38bdf8" fill="#38bdf833" />
                              ) : (
                                <SoccerBallIcon size={16} color="#94a3b8" />
                              )}
                            </div>
                            <div className="player-hierarchy-info">
                              <h4 className="player-hierarchy-name">{entry.playerName}</h4>
                              <div className="player-hierarchy-tags">
                                <span className="pos-pill">{entry.position}</span>
                                <span className="ovr-pill">OVR {entry.overall}</span>
                                <span className="pts-pill">{entry.leadershipScore} pts</span>
                                <span className="social-pill">
                                  {SOCIAL_GROUP_LABELS[entry.socialGroup] ?? entry.socialGroup}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="player-happiness-meter">
                            <div className="happiness-info-row">
                              <span className="happiness-title">Moral & Comprometimento</span>
                              <span className="happiness-pct">{entry.happiness}%</span>
                            </div>
                            <div className="happiness-bar-track">
                              <div
                                className="happiness-bar-fill"
                                style={{
                                  width: `${entry.happiness}%`,
                                  backgroundColor:
                                    entry.happiness >= 70
                                      ? '#10b981'
                                      : entry.happiness >= 50
                                        ? '#38bdf8'
                                        : '#ef4444',
                                }}
                              />
                            </div>
                          </div>

                          {isUnsatisfied && (
                            <div className="player-concern-tag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <AlertTriangleIcon size={14} color="#f59e0b" />
                              <span>{entry.concern}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. MAPA DE GRUPOS SOCIAIS (PANELAS DO ELENCO) */}
      <section className="card social-groups-section" data-testid="social-groups-panel">
        <div className="section-title-wrap">
          <h2>Grupos Sociais & Afinidades</h2>
          <p className="muted">
            Panelas e agrupamentos sociais que determinam o convívio diário no centro de treinamento
          </p>
        </div>

        <div className="social-groups-grid">
          {socialSummaries.map((summary) => (
            <div
              key={summary.group}
              className={`social-group-card group-${summary.group.toLowerCase().replace(/_/g, '-')}`}
              data-testid={`social-group-${summary.group}`}
            >
              <div className="social-group-header">
                <div className="social-group-icon-title">
                  <span className="social-group-icon">
                    {summary.group === 'CORE_VETERANS' ? (
                      <TrophyIcon size={16} color="#fbbf24" />
                    ) : summary.group === 'ACADEMY_PROSPECTS' ? (
                      <AcademyIcon size={16} color="#4ade80" />
                    ) : summary.group === 'FOREIGN_PLAYERS' ? (
                      <ShieldIcon size={16} color="#38bdf8" />
                    ) : (
                      <SoccerBallIcon size={16} color="#94a3b8" />
                    )}
                  </span>
                  <h3>{summary.label}</h3>
                </div>
                <span className="social-group-size-badge">
                  {summary.members.length} {summary.members.length === 1 ? 'atleta' : 'atletas'}
                </span>
              </div>

              <div className="social-group-happiness">
                <div className="social-happiness-label">
                  <span>Moral Coletiva</span>
                  <strong>{summary.averageHappiness}%</strong>
                </div>
                <div className="happiness-bar-track">
                  <div
                    className="happiness-bar-fill"
                    style={{
                      width: `${summary.averageHappiness}%`,
                      backgroundColor:
                        summary.averageHappiness >= 70
                          ? '#10b981'
                          : summary.averageHappiness >= 50
                            ? '#38bdf8'
                            : '#f59e0b',
                    }}
                  />
                </div>
              </div>

              {summary.unsatisfiedCount > 0 && (
                <div className="social-group-alert" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangleIcon size={14} color="#f59e0b" />
                  <span>
                    {summary.unsatisfiedCount} {summary.unsatisfiedCount === 1 ? 'jogador insatisfeito' : 'jogadores insatisfeitos'}
                  </span>
                </div>
              )}

              <div className="social-members-box">
                <span className="social-members-label">Integrantes:</span>
                <div className="social-chips-wrap">
                  {summary.members.length === 0 ? (
                    <span className="muted">Nenhum atleta</span>
                  ) : (
                    summary.members.map((m) => (
                      <span key={m.playerId} className="social-member-chip">
                        {m.playerName} ({m.position})
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. CENTRAL DE MEDIAÇÃO DE CONFLITOS & REUNIÃO DE CAPITÃES */}
      <section className="card captain-mediation-section" data-testid="captain-mediation-section">
        <div className="section-title-wrap">
          <h2>Central de Mediação & Reunião de Capitães</h2>
          <p className="muted">
            Resolva insatisfações conversando diretamente ou convocando o capitão ({leaderName}) para interceder
          </p>
        </div>

        {unsatisfiedPlayers.length === 0 ? (
          <div className="mediation-empty-card">
            <span className="empty-icon">
              <CheckIcon size={28} color="#10b981" />
            </span>
            <h3>Vestiário em Plena Harmonia</h3>
            <p className="muted">
              Nenhum jogador possui insatisfações pendentes no momento. Todos estão focados nos objetivos do clube.
            </p>
          </div>
        ) : (
          <div className="mediation-cards-list">
            {unsatisfiedPlayers.map((target) => (
              <div
                key={target.playerId}
                className="captain-intervention-card"
                data-testid={`intervention-${target.playerId}`}
              >
                <div className="intervention-card-header">
                  <div className="target-player-info">
                    <span className="warning-icon">
                      <AlertTriangleIcon size={16} color="#f59e0b" />
                    </span>
                    <div>
                      <h4 className="target-player-name">{target.playerName}</h4>
                      <div className="target-player-meta">
                        <span className="pos-pill">{target.position}</span>
                        <span className="ovr-pill">OVR {target.overall}</span>
                        <span className="happiness-pill">Felicidade: {target.happiness}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="concern-reason-box">
                    <strong>Motivo da Insatisfação:</strong>
                    <p>{target.concern}</p>
                  </div>
                </div>

                <div className="intervention-actions-row">
                  <span className="actions-label">Ações de Resolução:</span>
                  <div className="actions-buttons-group">
                    <button
                      type="button"
                      className="btn-action btn-captain-mediation"
                      onClick={() => handleAction(target.playerId, 'CAPTAIN_MEDIATION')}
                      data-testid={`mediate-captain-${target.playerId}`}
                    >
                      Pedir Mediação do Capitão
                    </button>
                    <button
                      type="button"
                      className="btn-action btn-diplomatic"
                      onClick={() => handleAction(target.playerId, 'DIPLOMATIC')}
                      data-testid={`diplomatic-talk-${target.playerId}`}
                    >
                      Conversa Diplomática
                    </button>
                    <button
                      type="button"
                      className="btn-action btn-demand"
                      onClick={() => handleAction(target.playerId, 'DEMAND_COMMITMENT')}
                      data-testid={`demand-commitment-${target.playerId}`}
                    >
                      Cobrar Profissionalismo
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. INCIDENTES RECENTES */}
      {state.recentIncidents && state.recentIncidents.length > 0 && (
        <section className="card incidents-section">
          <h2>Incidentes Recentes</h2>
          <div className="incidents-list">
            {state.recentIncidents.map((incident, idx) => (
              <div key={idx} className="incident-item">
                <span className="incident-bullet">
                  <AlertTriangleIcon size={12} color="#f59e0b" />
                </span>
                <span className="incident-desc">{incident}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. PRELEÇÃO */}
      <section className="card team-talk-section">
        <h2>Preleção</h2>
        <p className="muted">
          Disponível antes de jogos, no intervalo e após partidas para moldar a mentalidade do elenco.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={onOpenTeamTalk}
          disabled={!onOpenTeamTalk}
        >
          Realizar Preleção
        </button>
      </section>
    </div>
  );
}

export function LockerRoomPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamTalkModalOpen, setTeamTalkModalOpen] = useState(false);
  const [selectedContext] = useState<TeamTalkContext>('PRE_MATCH');
  const [teamTalkResult, setTeamTalkResult] = useState<string | null>(null);

  useEffect(() => {
    const id = clubId;
    if (!id) return;
    setLoading(true);
    setError(null);
    async function loadClub(clubToLoad: string) {
      try {
        const clubData = await getClub(clubToLoad);
        setClub(clubData);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadClub(id);
  }, [clubId]);

  function handleResolveConcern(
    targetPlayerId: string,
    leaderPlayerId: string,
    approach: MediationApproach,
  ) {
    if (!club) return;
    const result = resolvePlayerConcernWithLeader(
      club.players,
      targetPlayerId,
      leaderPlayerId,
      approach,
    );
    setClub({ ...club, players: result.updatedSquad });
    setTeamTalkResult(result.message);
  }

  async function handleApplyTeamTalk(option: TeamTalkOption) {
    if (!club) return;
    setError(null);
    setTeamTalkResult(null);

    const scoreDifferential = 0;
    const isDerbyOrFinal = false;

    const availableTalks = getAvailableTeamTalks(selectedContext, scoreDifferential, isDerbyOrFinal);
    const selectedOption = availableTalks.find((t) => t.id === option.id);

    if (!selectedOption) {
      setError('Opção de preleção inválida');
      return;
    }

    try {
      const rng = () => Math.random();
      const result = applyTeamTalk(club.players, selectedOption, selectedContext, scoreDifferential, rng);

      const updatedPlayers = club.players.map((player) => {
        const moraleChange = result.moraleModifiers[player.id] ?? 0;
        const updated = { ...player, morale: player.morale + moraleChange };
        return updated;
      });

      const updatedClub = { ...club, players: updatedPlayers };
      setClub(updatedClub);
      setTeamTalkResult(result.message);

      setTimeout(() => setTeamTalkModalOpen(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Vestiário</h1>
        </div>
        <p>Carregando...</p>
      </div>
    );
  }

  if (error && !club) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Vestiário</h1>
        </div>
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Vestiário</h1>
        </div>
        <p className="error">Clube não encontrado</p>
      </div>
    );
  }

  const lockerRoomState: LockerRoomState = computeLockerRoomHierarchy(
    club.players,
    {},
    club.captainPlayerId ?? undefined,
  );

  return (
    <>
      <LockerRoomView
        club={club}
        state={lockerRoomState}
        onOpenTeamTalk={() => setTeamTalkModalOpen(true)}
        onResolveConcern={handleResolveConcern}
        onClubUpdate={(u) => setClub(u)}
      />

      {teamTalkModalOpen && club && (
        <TeamTalkModal
          isOpen={true}
          club={club}
          context={selectedContext}
          onSelectTalk={handleApplyTeamTalk}
          onClose={() => {
            setTeamTalkModalOpen(false);
            setTeamTalkResult(null);
          }}
        />
      )}

      {teamTalkResult && (
        <div className="toast success">
          <span className="toast-message">{teamTalkResult}</span>
        </div>
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  STAFF_ROLES_INFO,
  STAFF_TIER_CONFIG,
  StaffMember,
  StaffRole,
  StaffDelegationConfig,
  DEFAULT_STAFF_DELEGATION_CONFIG,
  getStaffDelegationPreset,
  detectStaffDelegationPresetMode,
  canHireStaff,
  type TacticalAssistantAdvice,
  type Club,
} from '@tactical-arena/shared';
import {
  getClub,
  hireStaff,
  fireStaff,
  updateStaffDelegationConfig,
  listStaffMarket,
  getTacticalAdvice,
  getCareer,
  autoTrainSquad,
  autoTrainAcademy,
  autoPrepareTactics,
} from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { StaffIcon, StaffRoleIcon } from '../components/icons/AppIcons.js';

const ALL_ROLES: StaffRole[] = [
  'TACTICAL_ASSISTANT',
  'FITNESS_COACH',
  'YOUTH_COORDINATOR',
  'FOOTBALL_DIRECTOR',
  'FINANCIAL_DIRECTOR',
];

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Green when the assistant is sure, amber when they are guessing. Thresholds match confidenceLabelFor. */
function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#4ade80';
  if (confidence >= 0.6) return '#fbbf24';
  return '#f87171';
}

export function StaffPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [fireTarget, setFireTarget] = useState<{ id: string; roleName: string; name: string } | null>(null);
  const [market, setMarket] = useState<StaffMember[]>([]);
  const [activeTab, setActiveTab] = useState<'MY_STAFF' | 'MARKET' | 'RESPONSIBILITIES'>('MY_STAFF');
  const [delegationConfig, setDelegationConfig] = useState<StaffDelegationConfig>(DEFAULT_STAFF_DELEGATION_CONFIG);
  const [roleFilter, setRoleFilter] = useState<StaffRole | 'ALL'>('ALL');
  const [careerTitles, setCareerTitles] = useState<number>(0);
  const [tacticalAdvice, setTacticalAdvice] = useState<TacticalAssistantAdvice | null>(null);
  const [showAdviceModal, setShowAdviceModal] = useState(false);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingDelegation, setSavingDelegation] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    Promise.all([
      getClub(clubId),
      listStaffMarket(clubId).catch(() => []),
      getCareer().then((c) => c.titles.length).catch(() => 0),
    ])
      .then(([clubData, marketData, titles]) => {
        setClub(clubData);
        if (clubData?.staffDelegationConfig) {
          setDelegationConfig(clubData.staffDelegationConfig);
        }
        setMarket(marketData);
        setCareerTitles(titles);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [clubId]);

  function handleSelectPreset(mode: 'brasfoot_casual' | 'balanced' | 'football_manager_hardcore') {
    setDelegationConfig(getStaffDelegationPreset(mode));
  }

  function handleUpdateConfigField<K extends keyof StaffDelegationConfig>(field: K, value: StaffDelegationConfig[K]) {
    setDelegationConfig((prev) => {
      const next = { ...prev, [field]: value };
      next.presetMode = detectStaffDelegationPresetMode(next);
      return next;
    });
  }

  async function handleSaveDelegation() {
    if (!club) return;
    setSavingDelegation(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await updateStaffDelegationConfig(club.id, delegationConfig);
      setClub(updated);
      setSuccessMsg('Configuração de responsabilidades da comissão salva com sucesso!');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingDelegation(false);
    }
  }

  async function handleHire(staff: StaffMember) {
    if (!club) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await hireStaff(club.id, staff);
      setClub(updated);
      setSuccessMsg(`${staff.name} foi contratado com sucesso como ${STAFF_ROLES_INFO[staff.role].title}!`);
      setActiveTab('MY_STAFF');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleFire(staffId: string, roleName: string, name: string) {
    setFireTarget({ id: staffId, roleName, name });
  }

  async function executeFire() {
    if (!club || !fireTarget) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    const { id: staffId, roleName } = fireTarget;
    setFireTarget(null);
    try {
      const updated = await fireStaff(club.id, staffId);
      setClub(updated);
      setSuccessMsg(`Contrato rescindido. O cargo de ${roleName} está vago.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoTactics() {
    if (!club) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await autoPrepareTactics(club.id);
      setClub(res.club);
      setSuccessMsg(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoTrainSquad() {
    if (!club) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await autoTrainSquad(club.id);
      setClub(res.club);
      setSuccessMsg(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoTrainAcademy() {
    if (!club) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await autoTrainAcademy(club.id);
      setClub(res.club);
      setSuccessMsg(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenTacticalAdvice() {
    if (!club) return;
    setLoadingAdvice(true);
    setShowAdviceModal(true);
    try {
      const advice = await getTacticalAdvice(club.id);
      setTacticalAdvice(advice);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingAdvice(false);
    }
  }

  if (loading) return <div className="page">Carregando comissão técnica...</div>;
  if (!club) return null;

  const clubVisibility = club.visibilityScore ?? 50;
  const currentStaff = club.staff ?? [];
  const staffByRole = new Map<StaffRole, StaffMember>();
  for (const s of currentStaff) {
    staffByRole.set(s.role, s);
  }

  const filteredMarket = market.filter((s) => {
    if (roleFilter !== 'ALL' && s.role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="page staff-page">
      <ClubNav club={club} active="staff" />
      <HubSubnav hub="team" clubId={club.id} active="staff" />

      {error && <p className="error" style={{ margin: '8px 0' }}>{error}</p>}
      {successMsg && <p className="success-banner" style={{ margin: '8px 0', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '10px 16px', borderRadius: 8, border: '1px solid #22c55e' }}>{successMsg}</p>}

      {/* HEADER HERO */}
      <section className="card staff-hero-card" style={{ background: 'linear-gradient(135deg, #18151f 0%, #110e17 100%)', border: '1.5px solid rgba(168, 85, 247, 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: '#221933', border: '2px solid #a855f7', borderRadius: '50%', width: 68, height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
              <img src="/icons/nav/comissao.png" alt="Comissão Técnica" style={{ width: 50, height: 50, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#c084fc', letterSpacing: '0.05em' }}>
                Departamento Profissional
              </span>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', fontFamily: 'var(--font-display)' }}>
                Comissão Técnica e Diretoria
              </h2>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                {currentStaff.length}/5 Cargos Preenchidos • Folha da Comissão: {formatMoney(currentStaff.reduce((sum, s) => sum + s.wage, 0))}/sem
              </p>
            </div>
          </div>

          {/* Nomeado porque no celular os dois rótulos não cabem lado a lado e o par precisa empilhar. */}
          <div className="staff-tab-switch">
            <button
              className={activeTab === 'MY_STAFF' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('MY_STAFF')}
            >
              Nossa Comissão
            </button>
            <button
              className={activeTab === 'MARKET' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('MARKET')}
            >
              Mercado
            </button>
            <button
              className={activeTab === 'RESPONSIBILITIES' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setActiveTab('RESPONSIBILITIES')}
            >
              Responsabilidades
            </button>
          </div>
        </div>
      </section>

      {/* TAB 1: MY STAFF */}
      {activeTab === 'MY_STAFF' && (
        <section className="staff-roles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
          {ALL_ROLES.map((roleKey) => {
            const roleInfo = STAFF_ROLES_INFO[roleKey];
            const member = staffByRole.get(roleKey);

            if (!member) {
              return (
                <div key={roleKey} className="card staff-card empty" style={{ borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <StaffRoleIcon role={roleKey} size={24} color="#94a3b8" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>{roleInfo.title}</h3>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>{roleInfo.department}</span>
                    </div>
                  </div>
                  <p className="muted" style={{ fontSize: '0.82rem', minHeight: 48 }}>{roleInfo.benefitDescription}</p>
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>Cargo Vago</span>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                      onClick={() => {
                        setRoleFilter(roleKey);
                        setActiveTab('MARKET');
                      }}
                    >
                      Contratar no Mercado
                    </button>
                  </div>
                </div>
              );
            }

            const tierConfig = STAFF_TIER_CONFIG[member.tier];

            return (
              <div key={roleKey} className="card staff-card active" style={{ position: 'relative', overflow: 'hidden', border: `1.5px solid ${tierConfig.badgeColor}40` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: '#1c1924', border: `2px solid ${tierConfig.badgeColor}`, borderRadius: '50%', width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <StaffRoleIcon role={roleKey} size={26} color={tierConfig.badgeColor} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#fff' }}>{member.name}</h3>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                        <CountryFlag code={member.nationality} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{roleInfo.title}</span>
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      background: `${tierConfig.badgeColor}20`,
                      color: tierConfig.badgeColor,
                      border: `1px solid ${tierConfig.badgeColor}60`,
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                      fontWeight: 800,
                    }}
                  >
                    {member.rating} OVR • {member.tier}
                  </span>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: 6, margin: '8px 0', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                    Especialidade Principal
                  </span>
                  <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>{member.specialty}</strong>
                </div>

                {/* SPECIFIC ACTIVE BENEFIT & AUTOMATION ACTIONS */}
                <div style={{ margin: '10px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {roleKey === 'TACTICAL_ASSISTANT' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ color: '#4ade80' }}>✓ +{Math.round((member.rating - 50) * 0.2)}% de eficácia tática nas partidas</span>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn-primary"
                          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                          disabled={busy}
                          onClick={handleAutoTactics}
                        >
                          Escalar Contra-Tática
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                          onClick={handleOpenTacticalAdvice}
                        >
                          Relatório do Rival
                        </button>
                      </div>
                    </div>
                  )}
                  {roleKey === 'FITNESS_COACH' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ color: '#4ade80' }}>
                        ✓ +{Math.round((member.rating - 50) * 0.7)}% estamina • -{Math.round((member.rating - 50) * 0.9)}% lesões • +{Math.round((member.rating - 50) * 0.8)}% treino
                      </span>
                      <button
                        className="btn-primary"
                        style={{ fontSize: '0.78rem', padding: '5px 10px', alignSelf: 'flex-start' }}
                        disabled={busy}
                        onClick={handleAutoTrainSquad}
                      >
                        Treinar Elenco Automaticamente
                      </button>
                    </div>
                  )}
                  {roleKey === 'YOUTH_COORDINATOR' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ color: '#4ade80' }}>
                        ✓ +{Math.round((member.rating - 50) * 1.0)}% evolução da base • Atração de promessas
                      </span>
                      <button
                        className="btn-primary"
                        style={{ fontSize: '0.78rem', padding: '5px 10px', alignSelf: 'flex-start' }}
                        disabled={busy}
                        onClick={handleAutoTrainAcademy}
                      >
                        Treinar Toda a Base
                      </button>
                    </div>
                  )}
                  {roleKey === 'FOOTBALL_DIRECTOR' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ color: '#4ade80' }}>
                        ✓ {Math.round((member.rating - 50) * 0.35)}% de desconto em transferências
                      </span>
                      <Link
                        to={`/clubs/${club.id}/transfers?tab=market`}
                        className="btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '5px 10px', alignSelf: 'flex-start', textDecoration: 'none' }}
                      >
                        Radar de Transferências
                      </Link>
                    </div>
                  )}
                  {roleKey === 'FINANCIAL_DIRECTOR' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span style={{ color: '#4ade80' }}>
                        ✓ +{Math.round((member.rating - 50) * 0.4)}% patrocínio • -{Math.round((member.rating - 50) * 0.2)}% juros • Alertas de vencimento
                      </span>
                    </div>
                  )}
                </div>

                {/* HISTÓRICO E CONFIANÇA DO PROFISSIONAL */}
                {(() => {
                  const memberRecords = (club?.staffRecords ?? []).filter((r) => r.staffId === member.id || r.role === roleKey);
                  const evaluated = memberRecords.filter((r) => r.status !== 'PENDING');
                  const correctCount = evaluated.filter((r) => r.status === 'CORRECT').length;
                  const accuracyPct = evaluated.length > 0 ? Math.round((correctCount / evaluated.length) * 100) : null;

                  return (
                    <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 700 }}>Confiança e Retrospecto:</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: accuracyPct === null ? '#94a3b8' : accuracyPct >= 70 ? '#4ade80' : accuracyPct >= 50 ? '#fbbf24' : '#f87171' }}>
                          {accuracyPct === null ? 'Aguardando histórico' : `${accuracyPct}% de acertos (${correctCount}/${evaluated.length})`}
                        </span>
                      </div>
                      {memberRecords.length > 0 ? (
                        <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: '0.74rem', color: '#94a3b8', maxHeight: 80, overflowY: 'auto' }}>
                          {memberRecords.slice(0, 3).map((r) => (
                            <li key={r.id} style={{ marginBottom: 2 }}>
                              {r.status === 'CORRECT' ? '✓' : r.status === 'INCORRECT' ? '✕' : '•'} {r.details}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>Nenhuma recomendação avaliada ainda neste mandato.</span>
                      )}
                    </div>
                  );
                })()}

                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Salário: <strong style={{ color: '#fff' }}>{formatMoney(member.wage)}/sem</strong></span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() => {
                        setRoleFilter(roleKey);
                        setActiveTab('MARKET');
                      }}
                    >
                      Substituir
                    </button>
                    <button
                      className="btn-danger"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() => handleFire(member.id, roleInfo.title, member.name)}
                      disabled={busy}
                    >
                      Demitir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* TAB 2: MARKET */}
      {activeTab === 'MARKET' && (
        <section style={{ marginTop: 16 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Mercado de Profissionais e Auxiliares</h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                  Contrate os melhores especialistas para potencializar o desempenho do clube dentro e fora de campo.
                </p>
              </div>

              {/* Role filter pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  className={roleFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                  onClick={() => setRoleFilter('ALL')}
                >
                  Todos ({market.length})
                </button>
                {ALL_ROLES.map((r) => (
                  <button
                    key={r}
                    className={roleFilter === r ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '0.78rem', padding: '5px 10px' }}
                    onClick={() => setRoleFilter(r)}
                  >
                    {STAFF_ROLES_INFO[r].title.split(' e ')[0].trim()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {filteredMarket.map((candidate) => {
              const roleInfo = STAFF_ROLES_INFO[candidate.role];
              const tierConfig = STAFF_TIER_CONFIG[candidate.tier];
              const isHired = currentStaff.some((s) => s.id === candidate.id);
              const { canHire, reason } = canHireStaff(candidate, clubVisibility, careerTitles);

              return (
                <div key={candidate.id} className="card candidate-card" style={{ border: `1.5px solid ${tierConfig.badgeColor}30`, position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ background: '#17141f', border: `2px solid ${tierConfig.badgeColor}`, borderRadius: '50%', width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <StaffRoleIcon role={candidate.role} size={24} color={tierConfig.badgeColor} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.02rem', color: '#fff' }}>{candidate.name}</h4>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                          <CountryFlag code={candidate.nationality} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{roleInfo.title}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        background: `${tierConfig.badgeColor}20`,
                        color: tierConfig.badgeColor,
                        border: `1px solid ${tierConfig.badgeColor}50`,
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: '0.72rem',
                        fontWeight: 800,
                      }}
                    >
                      {candidate.rating} OVR • {candidate.tier}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 10px', borderRadius: 6, margin: '8px 0', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Especialidade</span>
                    <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>{candidate.specialty}</p>
                  </div>

                  <p className="muted" style={{ fontSize: '0.78rem', margin: '8px 0' }}>{candidate.description}</p>

                  {!canHire && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '6px 10px', borderRadius: 6, fontSize: '0.75rem', margin: '8px 0' }}>
                      {reason}
                    </div>
                  )}

                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Salário: <strong style={{ color: '#fff' }}>{formatMoney(candidate.wage)}/sem</strong></span>
                    {isHired ? (
                      <span style={{ fontSize: '0.78rem', color: '#4ade80', fontWeight: 700 }}>✓ Ativo no Clube</span>
                    ) : (
                      <button
                        className="btn-primary"
                        style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                        disabled={!canHire || busy}
                        onClick={() => handleHire(candidate)}
                      >
                        Contratar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: RESPONSIBILITIES & AUTOMATION */}
      {activeTab === 'RESPONSIBILITIES' && (
        <section style={{ marginTop: 16 }}>
          {/* PRESET SELECTOR HEADER */}
          <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #1c1829 0%, #13101c 100%)', border: '1.5px solid rgba(168, 85, 247, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#c084fc', letterSpacing: '0.05em' }}>
                  Delegação de Tarefas & Fluidez
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '1.15rem', color: '#fff' }}>
                  Estilo de Gestão e Automação da Comissão
                </h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                  Alterne entre a agilidade da gestão automatizada e o controle tático aprofundado, ou personalize cada responsabilidade.
                </p>
              </div>

              {/* Preset selector pills */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={delegationConfig.presetMode === 'brasfoot_casual' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '0.8rem', padding: '7px 14px', borderRadius: 20 }}
                  onClick={() => handleSelectPreset('brasfoot_casual')}
                >
                  Estilo Ágil / Direto
                </button>
                <button
                  type="button"
                  className={delegationConfig.presetMode === 'balanced' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '0.8rem', padding: '7px 14px', borderRadius: 20 }}
                  onClick={() => handleSelectPreset('balanced')}
                >
                  Equilibrado
                </button>
                <button
                  type="button"
                  className={delegationConfig.presetMode === 'football_manager_hardcore' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '0.8rem', padding: '7px 14px', borderRadius: 20 }}
                  onClick={() => handleSelectPreset('football_manager_hardcore')}
                >
                  Modo Estrategista Completo
                </button>
                <button
                  type="button"
                  className={delegationConfig.presetMode === 'custom' ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '0.8rem', padding: '7px 14px', borderRadius: 20 }}
                  disabled
                >
                  Personalizado
                </button>
              </div>
            </div>
          </div>

          {/* RESPONSIBILITY CARDS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* 1. ESCALAÇÃO E PARTIDA */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.02rem', color: '#fff' }}>Escalação e Dia de Jogo</h4>
                  <span className="muted" style={{ fontSize: '0.74rem' }}>Auxiliar Técnico</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                  Escalação Inicial Automática
                </label>
                <select
                  value={delegationConfig.autoLineup}
                  onChange={(e) => handleUpdateConfigField('autoLineup', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#13111c', border: '1px solid #332d42', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="best_eleven">Melhores 11 (Força Máxima)</option>
                  <option value="balanced_rotation">Rotação Equilibrada (Força & Ritmo)</option>
                  <option value="rest_tired">Preservar Cansados (Fôlego &gt;80%)</option>
                  <option value="manual">Manual (Treinador escala tudo)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                  Critério padrão usado pela comissão para preencher o time titular.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                  Substituições Automáticas em Partida
                </label>
                <select
                  value={delegationConfig.autoSubstitutionsInMatch ? 'true' : 'false'}
                  onChange={(e) => handleUpdateConfigField('autoSubstitutionsInMatch', e.target.value === 'true')}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#13111c', border: '1px solid #332d42', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="true">Sim (Auxiliar substitui lesionados sem travar o jogo)</option>
                  <option value="false">Não (Pausar e abrir prancheta de substituição)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                  Em lesão incapacitante, o auxiliar coloca a melhor opção do banco imediatamente.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                  Designação de Funções (Capitão e Cobradores)
                </label>
                <select
                  value={delegationConfig.autoAssignRoles ? 'true' : 'false'}
                  onChange={(e) => handleUpdateConfigField('autoAssignRoles', e.target.value === 'true')}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#13111c', border: '1px solid #332d42', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="true">Sim (Comissão define capitão, faltas e pênaltis)</option>
                  <option value="false">Não (Definido manualmente na prancheta)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                  Cobradores ideais selecionados conforme atributos técnicos.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                  Preleções de Vestiário (Auxiliar Técnico fala pelo time)
                </label>
                <select
                  value={delegationConfig.delegateTeamTalks !== false ? 'true' : 'false'}
                  onChange={(e) => handleUpdateConfigField('delegateTeamTalks', e.target.value === 'true')}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#13111c', border: '1px solid #332d42', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="true">Sim (Auxiliar conduz preleções de vestiário automaticamente)</option>
                  <option value="false">Não (Preleções manuais conduzidas pelo treinador)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                  No pré-jogo e intervalo, a comissão aplica a mensagem mais equilibrada sem travar o fluxo da partida.
                </span>
              </div>
            </div>

            {/* 2. MERCADO E BASE */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.02rem', color: '#fff' }}>Mercado e Categorias de Base</h4>
                  <span className="muted" style={{ fontSize: '0.74rem' }}>Diretoria & Coordenação</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                  Olheiros & Radar de Transferências
                </label>
                <select
                  value={delegationConfig.scoutingAutomation}
                  onChange={(e) => handleUpdateConfigField('scoutingAutomation', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#13111c', border: '1px solid #332d42', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="auto_shortlist">Radar Automático (Adicionar à lista de alvos)</option>
                  <option value="director_recommendations">Recomendações do Diretor de Futebol</option>
                  <option value="manual">Manual (Apenas buscas manuais)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                  Monitoramento contínuo de oportunidades no mercado da bola.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                  Renovações de Contrato
                </label>
                <select
                  value={delegationConfig.contractRenewals}
                  onChange={(e) => handleUpdateConfigField('contractRenewals', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#13111c', border: '1px solid #332d42', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="director_handles_routine">Diretor renova contratos de rotina</option>
                  <option value="notify_only_key_players">Notificar apenas jogadores-chave</option>
                  <option value="manual">Manual (Treinador negocia todos)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                  Evita perdas de jogadores por vencimento de vínculo.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                  Promoção de Jovens da Base
                </label>
                <select
                  value={delegationConfig.youthPromotions}
                  onChange={(e) => handleUpdateConfigField('youthPromotions', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#13111c', border: '1px solid #332d42', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="auto_promote_high_potential">Auto-promover joias de alto potencial</option>
                  <option value="manual">Manual (Treinador promove manualmente)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                  Coordenador da base sobe promessas prontas para o profissional.
                </span>
              </div>
            </div>

            {/* 3. TREINAMENTO E FISIOTERAPIA */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.02rem', color: '#fff' }}>Treinos e Departamento Médico</h4>
                  <span className="muted" style={{ fontSize: '0.74rem' }}>Preparação Física e Saúde</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                  Regime de Treinamento
                </label>
                <select
                  value={delegationConfig.trainingRegime}
                  onChange={(e) => handleUpdateConfigField('trainingRegime', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#13111c', border: '1px solid #332d42', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="simple_preset">Preset Simples (Equipe toda)</option>
                  <option value="auto_fitness_coach">Preparador Físico ajusta fôlego automaticamente</option>
                  <option value="individual_attributes">Atributos Individuais Detalhados (Avançado)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                  Foco na evolução de atributos físicos, técnicos e táticos.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
                  Tratamento no Departamento Médico
                </label>
                <select
                  value={delegationConfig.injuryRehab}
                  onChange={(e) => handleUpdateConfigField('injuryRehab', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, background: '#13111c', border: '1px solid #332d42', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="auto_fastest">Mais Rápido (Tratamento Intensivo)</option>
                  <option value="auto_balanced">Equilibrado (Seguro e estável)</option>
                  <option value="manual_medical_clinic">Manual (Clínica Médica e DM)</option>
                </select>
                <span className="muted" style={{ fontSize: '0.72rem', display: 'block', marginTop: 3 }}>
                  Velocidade e protocolo de recuperação de atletas contundidos.
                </span>
              </div>
            </div>
          </div>

          {/* SAVE BUTTON BAR */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '10px 24px', fontSize: '0.9rem', fontWeight: 700 }}
              disabled={savingDelegation}
              onClick={handleSaveDelegation}
            >
              {savingDelegation ? 'Salvando...' : 'Salvar Responsabilidades'}
            </button>
          </div>
        </section>
      )}

      {/* MODAL DE CONSELHO TÁTICO */}
      {showAdviceModal && (
        <div className="modal-backdrop" onClick={() => setShowAdviceModal(false)}>
          <div className="modal-card" style={{ maxWidth: 520, background: '#181422', border: '2px solid #a855f7' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                Relatório do Auxiliar Tático
              </h3>
              <button className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setShowAdviceModal(false)}>✕</button>
            </div>

            {loadingAdvice && <p className="muted">Analisando padrão tático do adversário...</p>}

            {tacticalAdvice && !loadingAdvice && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.88rem' }}>
                {/*
                  How sure the assistant is, shown before anything they say.
                  A report that never admits doubt is one the manager cannot weigh, and a weak assistant is
                  wrong about a third of the time. See generateTacticalAssistantAdvice.
                */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: 8,
                    border: `1px solid ${confidenceColor(tacticalAdvice.confidence)}55`,
                  }}
                >
                  <span style={{ fontWeight: 700, color: confidenceColor(tacticalAdvice.confidence) }}>
                    {tacticalAdvice.confidenceLabel}
                  </span>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    {tacticalAdvice.withinSpecialty
                      ? 'É o tipo de jogo que ele conhece bem'
                      : 'Está fora da especialidade dele'}
                  </span>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Padrão do Adversário</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 600, color: '#fff' }}>{tacticalAdvice.opponentSummary}</p>
                </div>

                <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: 12, borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#f87171', fontWeight: 700 }}>Ponto Fraco Identificado</span>
                  <p style={{ margin: '4px 0 0', color: '#fca5a5' }}>{tacticalAdvice.keyWeakness}</p>
                  {tacticalAdvice.detail && (
                    <p style={{ margin: '8px 0 0', color: '#fecaca', fontSize: '0.84rem' }}>{tacticalAdvice.detail}</p>
                  )}
                </div>

                <div style={{ background: 'rgba(34, 197, 94, 0.12)', padding: 12, borderRadius: 8, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#4ade80', fontWeight: 700 }}>Recomendação Tática</span>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: '#86efac' }}>
                    <li><strong>Formação:</strong> {tacticalAdvice.recommendedFormation}</li>
                    <li><strong>Estilo de Ataque:</strong> {tacticalAdvice.recommendedAttackStyle}</li>
                    <li><strong>Mentalidade:</strong> {tacticalAdvice.recommendedMentality}</li>
                    <li><strong>Marcação/Pressão:</strong> {tacticalAdvice.recommendedPressing}</li>
                  </ul>
                </div>

                <div style={{ background: 'rgba(168, 85, 247, 0.12)', padding: 12, borderRadius: 8, border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#c084fc', fontWeight: 700 }}>Parecer do Especialista</span>
                  <p style={{ margin: '4px 0 0', color: '#e9d5ff', fontStyle: 'italic' }}>{tacticalAdvice.assistantNotes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={!!fireTarget}
        title="Rescindir com Profissional"
        message={
          <>
            Tem certeza que deseja rescindir o contrato de{' '}
            <strong style={{ color: '#ffd700' }}>{fireTarget?.name}</strong> ({fireTarget?.roleName})?
            O cargo ficará vago e o profissional deixará a comissão técnica.
          </>
        }
        confirmLabel="Rescindir Contrato"
        cancelLabel="Cancelar"
        variant="danger"
        onCancel={() => setFireTarget(null)}
        onConfirm={executeFire}
      />
    </div>
  );
}

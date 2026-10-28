import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Club, League, StadiumUpgradePreview } from '@tactical-arena/shared';
import {
  calculateAttendance,
  calculateAttendanceRate,
  getNextStadiumLevel,
  getNextStadiumReform,
  getStadiumCurrentStep,
  getStadiumSubReforms,
  type StadiumSubReformConfig,
  spendingRemarks,
  stadiumDisplayName,
  weeklyCashFlow,
} from '@tactical-arena/shared';
import { getActiveLeague, getClub, getStadiumPreview, upgradeStadium } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { StaffRemarks } from '../components/StaffRemarks.js';
import { stadiumImageUrl } from '../components/StadiumIcon.js';
import { StadiumVisualizer } from '../components/StadiumVisualizer.js';
import { KitJerseyVisualizer } from '../components/KitJerseyVisualizer.js';
import {
  StadiumIconSvg,
  UsersIcon,
  FinanceIcon,
  TrophyIcon,
  StarIcon,
  AlertTriangleIcon,
  TrainingIcon,
} from '../components/icons/AppIcons.js';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatNumber(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR');
}

export interface StadiumViewProps {
  club: Club;
  preview?: StadiumUpgradePreview | null;
  league?: (League & { standings: { clubId: string; played: number }[] }) | null;
  error?: string | null;
  confirming?: boolean;
  upgrading?: boolean;
  onStartUpgrade?: () => void;
  onConfirmUpgrade?: () => void;
  onCancelUpgrade?: () => void;
}

export function StadiumView({
  club,
  preview,
  league,
  error,
  confirming = false,
  upgrading = false,
  onStartUpgrade,
  onConfirmUpgrade,
  onCancelUpgrade,
}: StadiumViewProps) {
  const nextLevel = getNextStadiumLevel(club.stadiumLevel);
  const arenaName = stadiumDisplayName(club.sponsorships) ?? `Estádio do ${club.name}`;
  const namingSponsor = club.sponsorships.find((s) => s.type === 'STADIUM_NAMING');
  const next = preview?.next ?? null;

  const currentTier = club.stadiumTier ?? club.stadiumLevel ?? 1;
  const currentStep = preview?.currentStep ?? club.stadiumStep ?? getStadiumCurrentStep(currentTier, club.stadiumCapacity);
  const nextReform = preview?.nextReform ?? getNextStadiumReform(currentTier, currentStep);
  const tierReforms = preview?.tierReforms && preview.tierReforms.length > 0 ? preview.tierReforms : getStadiumSubReforms(currentTier);

  const extraRevenue = next && preview ? next.receitaPorJogo - preview.current.receitaPorJogo : 0;

  const standingIndex = league?.standings?.findIndex((row) => row.clubId === club.id) ?? -1;
  const attendanceInputs = {
    stadiumCapacity: club.stadiumCapacity,
    leaguePosition: standingIndex >= 0 ? standingIndex + 1 : null,
    totalClubsInLeague: league?.clubIds.length ?? 0,
    titlesWon: club.titlesWon,
    matchesPlayed: standingIndex >= 0 ? league!.standings[standingIndex].played : 0,
  };
  const attendance = calculateAttendance(attendanceInputs);
  const occupancyPct = Math.round(calculateAttendanceRate(attendanceInputs) * 100);

  const { net: weeklyNet } = weeklyCashFlow(club, calculateAttendanceRate(attendanceInputs));
  const prestigeGain = next && preview ? Math.max(1, next.prestigeStars - preview.current.prestigeStars) : 1;

  return (
    <div className="page">
      <ClubNav club={club} active="stadium" />
      <HubSubnav hub="financial" clubId={club.id} active="stadium" />

      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      <section className="card stadium-crowd-card">
        <div className="stadium-crowd-figures">
          <div>
            <h3>Público no estádio</h3>
            <p className="stadium-crowd-value">{formatNumber(attendance)}</p>
            <p className="muted">
              {occupancyPct}% de {formatNumber(club.stadiumCapacity)} lugares
            </p>
          </div>
          <p className="muted stadium-crowd-note">
            {standingIndex >= 0
              ? 'A torcida acompanha a campanha na tabela. Subir de posição enche o estádio.'
              : 'Sem campeonato em andamento, o público fica na média do clube.'}
          </p>
        </div>
        <div
          className="attendance-bar"
          title={`${occupancyPct}% de ocupação`}
          role="progressbar"
          aria-label="Taxa de Ocupação"
          aria-valuenow={occupancyPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="attendance-bar-fill" style={{ width: `${occupancyPct}%` }} />
        </div>
      </section>

      {/* Modern Stadium & Jersey Visualizer Grid - 2 Colunas Limpas */}
      <div className="stadium-visualizer-grid">
        <StadiumVisualizer
          tier={club.stadiumTier ?? club.stadiumLevel}
          level={club.stadiumLevel}
          capacity={club.stadiumCapacity}
          stadiumName={arenaName}
          construction={club.stadiumConstruction}
        />
        <KitJerseyVisualizer
          club={club}
          sponsorships={club.sponsorships}
        />
      </div>

      <div className="stadium-pro-container">
        {/* Arena Header */}
        <div className="stadium-pro-header">
          <div className="stadium-pro-header-icon"><StadiumIconSvg size={32} color="#f59e0b" /></div>
          <div>
            <h1 className="stadium-pro-title">{arenaName}</h1>
            {namingSponsor ? (
              <div className="stadium-pro-naming-tag">
                <StarIcon size={14} color="#ffd700" fill="#ffd700" style={{ marginRight: 4 }} />
                <span>Naming rights de <strong>{namingSponsor.sponsorName}</strong> • {namingSponsor.weeksRemaining} semana(s) restante(s)</span>
              </div>
            ) : (
              <div className="stadium-pro-naming-tag" style={{ color: 'var(--muted)' }}>
                <span>Nenhum naming rights ativo no momento</span>
              </div>
            )}
          </div>
        </div>

        {/* 2-Column Pro Layout */}
        <div className="stadium-pro-layout">
          {/* Left Column: Visual Stage Evolution & Confirmation */}
          <div className="stadium-pro-visual-col">
            <div className="stadium-evolution-card">
              <div className="stadium-evolution-showcase">
                {/* Current Stadium */}
                <div className="stadium-stage-box">
                  <div className="stadium-stage-pill">
                    <span className="stadium-stage-level">NÍVEL {club.stadiumLevel}</span>
                    <span className="stadium-stage-capacity">{formatNumber(club.stadiumCapacity)} lugares</span>
                  </div>
                  <img
                    src={stadiumImageUrl(club.stadiumLevel)}
                    alt={`Estádio Nível ${club.stadiumLevel}`}
                    className="stadium-stage-img"
                  />
                </div>

                {nextLevel && (
                  <>
                    <div className="stadium-evolution-arrow">➔</div>

                    {/* Next Stadium */}
                    <div className="stadium-stage-box">
                      <div className="stadium-stage-pill" style={{ borderColor: '#ffd700' }}>
                        <span className="stadium-stage-level" style={{ color: '#ffd700' }}>NÍVEL {nextLevel.level}</span>
                        <span className="stadium-stage-capacity">{formatNumber(nextLevel.capacity)} lugares</span>
                      </div>
                      <img
                        src={stadiumImageUrl(nextLevel.level)}
                        alt={`Estádio Nível ${nextLevel.level}`}
                        className="stadium-stage-img"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* 4-Step Sub-reforms Track */}
              {tierReforms.length > 0 && (
                <div className="stadium-steps-track">
                  <div className="stadium-steps-header">
                    <span>Etapas de Modernização (Nível {currentTier})</span>
                    <span style={{ color: currentStep >= 4 ? '#22c55e' : '#38bdf8' }}>
                      {currentStep}/4 Concluídas
                    </span>
                  </div>
                  <div className="stadium-steps-pills">
                    {tierReforms.map((ref) => {
                      const isDone = ref.step <= currentStep;
                      const isCurrent = club.stadiumConstruction && club.stadiumConstruction.targetStep === ref.step;
                      return (
                        <div key={ref.step} className={`stadium-step-pill ${isDone ? 'step-done' : isCurrent ? 'step-active' : ''}`}>
                          <div className="stadium-step-number">{isDone ? '✓' : isCurrent ? '▶' : ref.step}</div>
                          <div className="stadium-step-info">
                            <strong className="stadium-step-name">{ref.name}</strong>
                            <span className="stadium-step-cap">+{formatNumber(ref.capacityGain)} lug.</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Embedded Confirmation Box when confirming */}
              {confirming && (nextReform || next) && (
                <div className="stadium-confirm-box">
                  <h3 className="stadium-confirm-title">
                    {nextReform ? `Confirmar ${nextReform.name}? (Etapa ${nextReform.step}/4)` : 'Confirmar reforma?'}
                  </h3>
                  {nextReform && (
                    <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                      {nextReform.description}
                    </p>
                  )}
                  <div className="stadium-confirm-grid">
                    <div className="stadium-confirm-row">
                      <span className="stadium-confirm-label">Investimento:</span>
                      <span className="stadium-confirm-value">{formatMoney(nextReform ? nextReform.cost : next!.upgradeCost)}</span>
                    </div>
                    <div className="stadium-confirm-row">
                      <span className="stadium-confirm-label">Duração da obra:</span>
                      <span className="stadium-confirm-value">
                        {nextReform ? `${nextReform.durationWeeks} semana(s)` : `${next!.constructionWeeks} semanas`}
                      </span>
                    </div>
                    <div className="stadium-confirm-row">
                      <span className="stadium-confirm-label">Nova capacidade:</span>
                      <span className="stadium-confirm-value">
                        {nextReform
                          ? `${formatNumber(nextReform.targetCapacity)} lugares (+${formatNumber(nextReform.capacityGain)})`
                          : `${formatNumber(next!.capacity)} lugares`}
                      </span>
                    </div>
                    <div className="stadium-confirm-row">
                      <span className="stadium-confirm-label">{nextReform?.step === 4 ? 'Metamorfose:' : 'Etapa:'}</span>
                      <span className="stadium-confirm-value gain">
                        {nextReform ? (nextReform.step === 4 ? `Conclusão do Nível ${currentTier + 1}` : `Passo ${nextReform.step} de 4`) : 'Evolução'}
                      </span>
                    </div>
                  </div>
                  <div className="stadium-confirm-actions">
                    <button
                      type="button"
                      className="stadium-btn-cancel"
                      onClick={onCancelUpgrade}
                      disabled={upgrading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="stadium-btn-confirm"
                      onClick={onConfirmUpgrade}
                      disabled={upgrading}
                    >
                      {upgrading ? 'Iniciando Obra...' : 'Confirmar e Iniciar Obra'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Master Action / Status Button */}
            {club.stadiumConstruction ? (
              <div className="stadium-under-construction-banner">
                <AlertTriangleIcon size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                <span>
                  Obra em andamento:{' '}
                  <strong>
                    {club.stadiumConstruction.stepName
                      ? `${club.stadiumConstruction.stepName} (Etapa ${club.stadiumConstruction.targetStep ?? 1}/4)`
                      : `Nível ${club.stadiumConstruction.targetLevel}`}
                  </strong>{' '}
                  pronto em <strong>{club.stadiumConstruction.weeksRemaining} semana(s)</strong>.
                </span>
              </div>
            ) : (nextReform || next) ? (
              !confirming && (
                <>
                  <StaffRemarks
                    remarks={spendingRemarks(club, nextReform ? nextReform.cost : next!.upgradeCost, weeklyNet)}
                    title="Parecer financeiro"
                  />
                  <button
                    type="button"
                    className="stadium-master-cta"
                    onClick={onStartUpgrade}
                    disabled={club.budget < (nextReform ? nextReform.cost : next!.upgradeCost)}
                    title={club.budget < (nextReform ? nextReform.cost : next!.upgradeCost) ? 'Orçamento insuficiente' : ''}
                  >
                    <TrainingIcon size={18} style={{ marginRight: 6 }} />
                    <span>
                      {nextReform
                        ? `Reformar Etapa ${nextReform.step}/4: ${nextReform.name} • ${formatMoney(nextReform.cost)} (+${formatNumber(nextReform.capacityGain)} lug.)`
                        : `Reformar para nível ${next!.level} • ${formatMoney(next!.upgradeCost)} (capacidade ${formatNumber(next!.capacity)})`}
                    </span>
                  </button>
                </>
              )
            ) : (
              <div className="stadium-card-box" style={{ textAlign: 'center', padding: '16px' }}>
                <span style={{ color: '#ffd700', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <TrophyIcon size={18} color="#ffd700" fill="#ffd70033" />
                  Estádio já atingiu o nível máximo (Nível 5 - 120.000 lugares)!
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Benefits, Investment & Info Cards */}
          <div className="stadium-pro-benefits-col">
            {preview && next ? (
              <>
                {/* Benefícios da Reforma */}
                <div className="stadium-card-box">
                  <h3 className="stadium-card-title">BENEFÍCIOS DA REFORMA</h3>

                  <div className="stadium-benefit-item">
                    <div className="stadium-benefit-icon-badge"><UsersIcon size={18} color="#38bdf8" /></div>
                    <div className="stadium-benefit-text-wrap">
                      <span className="stadium-benefit-label">Público médio estimado:</span>
                      <span className="stadium-benefit-numbers">
                        {formatNumber(preview.current.publicoMedio)} ➔ <strong>{formatNumber(next.publicoMedio)}</strong> por jogo
                      </span>
                    </div>
                  </div>

                  <div className="stadium-benefit-item">
                    <div className="stadium-benefit-icon-badge"><FinanceIcon size={18} color="#10b981" /></div>
                    <div className="stadium-benefit-text-wrap">
                      <span className="stadium-benefit-label">Receita de bilheteria:</span>
                      <span className="stadium-benefit-numbers">
                        {formatMoney(preview.current.receitaPorJogo)} ➔ <strong>{formatMoney(next.receitaPorJogo)}</strong> por jogo
                        <span className="stadium-benefit-gain-pill">(+{formatMoney(extraRevenue)}/jogo)</span>
                      </span>
                    </div>
                  </div>

                  <div className="stadium-benefit-item">
                    <div className="stadium-benefit-icon-badge"><TrophyIcon size={18} color="#ffd700" fill="#ffd70033" /></div>
                    <div className="stadium-benefit-text-wrap">
                      <span className="stadium-benefit-label">Prestígio do clube:</span>
                      <span className="stadium-benefit-numbers">
                        +{prestigeGain} {prestigeGain === 1 ? 'nível' : 'níveis'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Investimento */}
                <div className="stadium-card-box highlight">
                  <div className="stadium-investment-display">
                    <div className="stadium-benefit-icon-badge" style={{ width: 52, height: 52 }}>
                      <FinanceIcon size={26} color="#10b981" />
                    </div>
                    <div>
                      <div className="stadium-card-title" style={{ fontSize: '0.8rem' }}>
                        {nextReform ? `INVESTIMENTO ETAPA ${nextReform.step}/4:` : 'INVESTIMENTO:'}
                      </div>
                      <div className="stadium-investment-val">
                        {formatMoney(nextReform ? nextReform.cost : next.upgradeCost)}
                      </div>
                      <div className="stadium-investment-sub">
                        {nextReform
                          ? `Adiciona +${formatNumber(nextReform.capacityGain)} lugares imediatos`
                          : `Retorno estimado em ~${next.paybackMatches ?? 24} jogos de casa`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Informações da Obra */}
                <div className="stadium-card-box">
                  <h3 className="stadium-card-title" style={{ color: 'var(--muted)' }}>
                    {nextReform ? `ETAPA ${nextReform.step}/4: ${nextReform.name.toUpperCase()}` : 'INFORMAÇÕES DA OBRA'}
                  </h3>
                  <div className="stadium-construction-notice">
                    <AlertTriangleIcon size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <span>
                      {nextReform
                        ? `${nextReform.description} Custo: ${formatMoney(nextReform.cost)} • Duração: ${nextReform.durationWeeks} semana(s).`
                        : `Valor da obra: ${formatMoney(next.upgradeCost)} • Duração: ${next.constructionWeeks} semanas.`}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="stadium-card-box">
                <h3 className="stadium-card-title">ESTÁDIO NÍVEL MÁXIMO</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#e5dec9' }}>
                  Sua arena já conta com a maior infraestrutura esportiva possível ({formatNumber(club.stadiumCapacity)} lugares), maximizando as receitas de bilheteria em todos os jogos em casa.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StadiumPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [preview, setPreview] = useState<StadiumUpgradePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [league, setLeague] = useState<(League & { standings: { clubId: string; played: number }[] }) | null>(null);

  useEffect(() => {
    if (!clubId) return;
    Promise.all([getClub(clubId), getStadiumPreview(clubId)])
      .then(([clubData, previewData]) => {
        setClub(clubData);
        setPreview(previewData);
      })
      .then(() => getActiveLeague(clubId).catch(() => null))
      .then((active) => setLeague(active as never))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [clubId]);

  async function handleConfirmUpgrade() {
    if (!club) return;
    setError(null);
    setUpgrading(true);
    try {
      const updated = await upgradeStadium(club.id);
      setClub(updated);
      setConfirming(false);
      setPreview(await getStadiumPreview(club.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpgrading(false);
    }
  }

  if (loading) return <div className="page">Carregando...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  return (
    <StadiumView
      club={club}
      preview={preview}
      league={league}
      error={error}
      confirming={confirming}
      upgrading={upgrading}
      onStartUpgrade={() => setConfirming(true)}
      onConfirmUpgrade={handleConfirmUpgrade}
      onCancelUpgrade={() => setConfirming(false)}
    />
  );
}

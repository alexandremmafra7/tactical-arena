import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Club, Player, TrainingFocus, MentorshipPair, SectorTrainingFocus } from '@tactical-arena/shared';
import { autoAssignMentorshipPairs, SECTOR_FOCUS_LABELS } from '@tactical-arena/shared';
import { getClub, setTutor, trainPlayer, autoTrainSquad } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { getClubThemeStyle } from '../lib/clubTheme.js';
import { positionLabel } from '../lib/positionLabel.js';
import { footLabel } from '../lib/footLabel.js';
import { TrainingIcon, StaffIcon, AlertTriangleIcon } from '../components/icons/AppIcons.js';

export const FOCUS_LABEL: Record<TrainingFocus, string> = {
  PHYSICAL: 'Físico (Força/Velocidade)',
  TECHNICAL: 'Técnico (Passe/Finalização)',
  MENTAL: 'Mental (Comprometimento)',
  FINISHING: 'Finalização',
  PASSING: 'Passe',
  DEFENDING: 'Desarme',
  PACE: 'Velocidade',
};

export const INDIVIDUAL_FOCUSES: TrainingFocus[] = ['FINISHING', 'PASSING', 'DEFENDING', 'PACE'];

export function formatMoney(value?: number | null): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export interface TrainingViewProps {
  club: Club;
  mentorshipPairs: MentorshipPair[];
  sectorFocuses: {
    defense: SectorTrainingFocus;
    midfield: SectorTrainingFocus;
    attack: SectorTrainingFocus;
  };
  focusChoice: Record<string, TrainingFocus | null>;
  busy?: boolean;
  busyPlayerId?: string | null;
  error?: string | null;
  successMsg?: string | null;
  autoReport?: { actions: any[]; message: string } | null;
  onAutoTrain?: () => void;
  onTrain?: (playerId: string) => void;
  onSetTutor?: (playerId: string) => void;
  onRemoveTutor?: () => void;
  onAutoAssignMentorship?: () => void;
  onRemoveMentorship?: (pairId: string) => void;
  onSectorFocusChange?: (unit: 'defense' | 'midfield' | 'attack', focus: SectorTrainingFocus) => void;
  onFocusChoiceChange?: (playerId: string, focus: TrainingFocus | null) => void;
  onCloseAutoReport?: () => void;
}

/** Pure presentation component for Training Page */
export function TrainingView({
  club,
  mentorshipPairs,
  sectorFocuses,
  focusChoice,
  busy = false,
  busyPlayerId = null,
  error = null,
  successMsg = null,
  autoReport = null,
  onAutoTrain,
  onTrain,
  onSetTutor,
  onRemoveTutor,
  onAutoAssignMentorship,
  onRemoveMentorship,
  onSectorFocusChange,
  onFocusChoiceChange,
  onCloseAutoReport,
}: TrainingViewProps) {
  const fitnessCoach = club.staff?.find((s) => s.role === 'FITNESS_COACH');
  const youthCoordinator = club.staff?.find((s) => s.role === 'YOUTH_COORDINATOR');
  const regime = club.staffDelegationConfig?.trainingRegime ?? 'simple_preset';
  const individualTraining = regime === 'individual_attributes';

  return (
    <div className="page training-page" style={getClubThemeStyle(club)}>
      <ClubNav club={club} active="training" />
      <HubSubnav hub="team" clubId={club.id} active="training" />

      {error && <p className="error" style={{ margin: '8px 0' }}>{error}</p>}
      {successMsg && (
        <p
          className="success-banner"
          style={{
            margin: '8px 0',
            background: 'rgba(34, 197, 94, 0.15)',
            color: '#4ade80',
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #22c55e',
          }}
        >
          {successMsg}
        </p>
      )}

      {/* STAFF BOOSTS & AUTOMATION BAR */}
      <section className="card training-hero-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrainingIcon size={26} color="var(--accent)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Centro de Treinamento Profissional</h3>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.82rem' }}>
                {individualTraining
                  ? 'Escolha foco individual em finalização, passe, desarme ou velocidade.'
                  : 'O preparador físico administra automaticamente forma e recuperação do elenco.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn-primary"
              style={{
                fontSize: '0.88rem',
                padding: '8px 16px',
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
                border: '1px solid var(--accent)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px var(--club-glow)',
              }}
              disabled={busy}
              onClick={onAutoTrain}
            >
              {busy ? 'Executando...' : 'Treino Automático pela Comissão'}
            </button>

            {fitnessCoach ? (
              <span className="badge-pill" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid #22c55e' }}>
                {fitnessCoach.name} ({fitnessCoach.rating} OVR): +{Math.round((fitnessCoach.rating - 50) * 0.8)}% Físico
              </span>
            ) : (
              <Link to={`/clubs/${club.id}/staff`} className="badge-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid #f59e0b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                <AlertTriangleIcon size={14} style={{ marginRight: 4 }} /> Sem Preparador Físico (Contratar)
              </Link>
            )}

            {youthCoordinator && (
              <span className="badge-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #38bdf8' }}>
                {youthCoordinator.name}: +{Math.round((youthCoordinator.rating - 50) * 1.0)}% Jovens
              </span>
            )}
          </div>
        </div>
      </section>

      {/* TREINO SETORIAL EM BLOCO (DEFESA / MEIO / ATAQUE) */}
      <section className="card sector-units-section" data-testid="sector-units-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              Treino Setorial Específico (Sinergia por Linhas)
            </h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.82rem' }}>
              Define os exercícios táticos coletivos aplicados em conjunto para cada terço do campo.
            </p>
          </div>
        </div>

        <div className="sector-units-grid">
          {/* Setor Defesa */}
          <div className="sector-unit-card unit-defense" data-testid="sector-card-defense">
            <div className="sector-unit-header">
              <h4 className="sector-unit-title">Linha Defensiva & Goleiros</h4>
            </div>
            <select
              aria-label="Foco da Linha Defensiva"
              className="sector-focus-select"
              value={sectorFocuses.defense}
              onChange={(e) => onSectorFocusChange?.('defense', e.target.value as SectorTrainingFocus)}
            >
              {(Object.keys(SECTOR_FOCUS_LABELS) as SectorTrainingFocus[])
                .filter((f) => SECTOR_FOCUS_LABELS[f].unit === 'DEFENSE')
                .map((f) => (
                  <option key={f} value={f}>
                    {SECTOR_FOCUS_LABELS[f].label}
                  </option>
                ))}
            </select>
            <p className="sector-focus-desc">{SECTOR_FOCUS_LABELS[sectorFocuses.defense].description}</p>
          </div>

          {/* Setor Meio-Campo */}
          <div className="sector-unit-card unit-midfield" data-testid="sector-card-midfield">
            <div className="sector-unit-header">
              <h4 className="sector-unit-title">Linha de Meio-Campo</h4>
            </div>
            <select
              aria-label="Foco da Linha de Meio-Campo"
              className="sector-focus-select"
              value={sectorFocuses.midfield}
              onChange={(e) => onSectorFocusChange?.('midfield', e.target.value as SectorTrainingFocus)}
            >
              {(Object.keys(SECTOR_FOCUS_LABELS) as SectorTrainingFocus[])
                .filter((f) => SECTOR_FOCUS_LABELS[f].unit === 'MIDFIELD')
                .map((f) => (
                  <option key={f} value={f}>
                    {SECTOR_FOCUS_LABELS[f].label}
                  </option>
                ))}
            </select>
            <p className="sector-focus-desc">{SECTOR_FOCUS_LABELS[sectorFocuses.midfield].description}</p>
          </div>

          {/* Setor Ataque */}
          <div className="sector-unit-card unit-attack" data-testid="sector-card-attack">
            <div className="sector-unit-header">
              <h4 className="sector-unit-title">Setor Ofensivo & Pontas</h4>
            </div>
            <select
              aria-label="Foco do Setor Ofensivo"
              className="sector-focus-select"
              value={sectorFocuses.attack}
              onChange={(e) => onSectorFocusChange?.('attack', e.target.value as SectorTrainingFocus)}
            >
              {(Object.keys(SECTOR_FOCUS_LABELS) as SectorTrainingFocus[])
                .filter((f) => SECTOR_FOCUS_LABELS[f].unit === 'ATTACK')
                .map((f) => (
                  <option key={f} value={f}>
                    {SECTOR_FOCUS_LABELS[f].label}
                  </option>
                ))}
            </select>
            <p className="sector-focus-desc">{SECTOR_FOCUS_LABELS[sectorFocuses.attack].description}</p>
          </div>
        </div>
      </section>

      {/* SISTEMA DE MENTORIA 1-PARA-1 (VETERANO ⇄ PROMESSA SUB-20) */}
      <section className="card mentorship-section" data-testid="mentorship-section">
        <div className="mentorship-header-actions">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              Sistema de Mentoria 1-para-1 (Veterano ⇄ Promessa)
            </h3>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.82rem' }}>
              Líderes experientes (27+ anos) aceleram a evolução de promessas (sub-22) e transferem traços de personalidade.
            </p>
          </div>
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }}
            onClick={onAutoAssignMentorship}
            data-testid="btn-auto-mentorship"
          >
            Auto-Atribuir pela Coordenação
          </button>
        </div>

        {mentorshipPairs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Nenhuma dupla de mentoria ativa no momento. Clique em <strong>Auto-Atribuir</strong> para emparelhar veteranos e promessas compatíveis.
          </div>
        ) : (
          <div className="mentorship-grid" data-testid="mentorship-grid">
            {mentorshipPairs.map((pair) => {
              const isHigh = pair.compatibilityScore >= 75;
              const fillWidth = `${pair.compatibilityScore}%`;
              const fillColor = pair.compatibilityScore >= 75 ? '#10b981' : pair.compatibilityScore >= 50 ? '#38bdf8' : '#f59e0b';
              return (
                <div
                  key={pair.id}
                  className={`mentorship-card ${isHigh ? 'high-affinity' : ''}`}
                  data-testid={`mentorship-card-${pair.id}`}
                >
                  <div className="mentorship-players-row">
                    <div className="mentorship-actor">
                      <span className="mentorship-actor-label">Mentor</span>
                      <span className="mentorship-actor-name">{pair.mentorName}</span>
                    </div>
                    <span className="mentorship-arrow">➔</span>
                    <div className="mentorship-actor" style={{ textAlign: 'right' }}>
                      <span className="mentorship-actor-label" style={{ justifyContent: 'flex-end' }}>Aprendiz</span>
                      <span className="mentorship-actor-name">{pair.apprenticeName}</span>
                    </div>
                  </div>

                  <div className="mentorship-compatibility-bar">
                    <div className="mentorship-compat-meta">
                      <span style={{ color: 'var(--muted)' }}>Afinidade de Mentoria</span>
                      <strong style={{ color: fillColor }}>{pair.compatibilityScore}%</strong>
                    </div>
                    <div className="mentorship-meter">
                      <div
                        className="mentorship-meter-fill"
                        style={{ width: fillWidth, background: fillColor }}
                      />
                    </div>
                  </div>

                  <div className="mentorship-footer">
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                      {pair.weeksActive} sem. ativas • {pair.positionMatch ? 'Mesma Pos.' : 'Pos. Mista'}
                      {pair.sharedNationality ? ' • Mesma Pátria' : ''}
                    </span>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                      onClick={() => onRemoveMentorship?.(pair.id)}
                      data-testid={`btn-remove-mentorship-${pair.id}`}
                    >
                      Encerrar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* TABELA DE ELENCO PROFISSIONAL */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Elenco Profissional</h2>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Orçamento disponível: <strong style={{ color: '#4ade80' }}>{formatMoney(club.budget)}</strong>
          </span>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Pos.</th>
                <th>Pé</th>
                <th>Idade</th>
                <th>Força</th>
                <th>Potencial</th>
                <th>Atributos Chave</th>
                <th>Foco de Treino</th>
                <th>Custo</th>
                <th>Tutor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {club.players.map((p: Player) => {
                const isTutor = club.tutorPlayerId === p.id;
                const cost = Math.max(5000, Math.round(p.marketValue * 0.05));
                const canAfford = club.budget >= cost;
                const isBusy = busyPlayerId === p.id;

                return (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{positionLabel(p.position)}</td>
                    <td className={p.preferredFoot === 'BOTH' ? 'foot-ambidextrous' : undefined}>{footLabel(p.preferredFoot)}</td>
                    <td>{p.age}</td>
                    <td><strong style={{ color: '#ffd700' }}>{Math.round(p.overall)}</strong></td>
                    <td>{p.potential}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {p.position === 'GK' ? (
                        <span>GOL: {p.attributes.goalkeeping} • FIS: {p.attributes.physical}</span>
                      ) : p.position === 'DEF' || p.position === 'LAT' ? (
                        <span>DEF: {p.attributes.defending} • VEL: {p.attributes.pace} • FIS: {p.attributes.physical}</span>
                      ) : p.position === 'MID' ? (
                        <span>PAS: {p.attributes.passing} • DEF: {p.attributes.defending} • VEL: {p.attributes.pace}</span>
                      ) : (
                        <span>FIN: {p.attributes.finishing} • VEL: {p.attributes.pace} • PAS: {p.attributes.passing}</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="training-focus-select"
                        value={focusChoice[p.id] ?? ''}
                        onChange={(e) =>
                          onFocusChoiceChange?.(p.id, (e.target.value || null) as TrainingFocus | null)
                        }
                      >
                        <option value="">Geral Equilibrado</option>
                        {(individualTraining ? INDIVIDUAL_FOCUSES : ['PHYSICAL', 'TECHNICAL', 'MENTAL'] as TrainingFocus[]).map((focus) => (
                          <option key={focus} value={focus}>{FOCUS_LABEL[focus]}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatMoney(cost)}</td>
                    <td>
                      {isTutor ? (
                        <>
                          <span className="star-developed">Tutor</span>{' '}
                          <button className="btn-secondary" style={{ fontSize: '0.72rem', padding: '2px 6px' }} onClick={onRemoveTutor}>
                            Remover
                          </button>
                        </>
                      ) : (
                        <button className="btn-secondary" style={{ fontSize: '0.72rem', padding: '2px 6px' }} onClick={() => onSetTutor?.(p.id)}>
                          Nomear
                        </button>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-primary"
                        style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                        disabled={!canAfford || isBusy}
                        onClick={() => onTrain?.(p.id)}
                      >
                        {isBusy ? 'Treinando...' : 'Treinar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL DE RELATÓRIO DO TREINO AUTOMÁTICO */}
      {autoReport && (
        <div className="modal-backdrop" onClick={onCloseAutoReport}>
          <div
            className="modal-card"
            style={{
              maxWidth: 580,
              background: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(20px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
                Relatório da Comissão Técnica
              </h3>
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.9rem' }} onClick={onCloseAutoReport}>✕</button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#cbd5e1', margin: '0 0 16px', lineHeight: 1.5 }}>{autoReport.message}</p>

            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {autoReport.actions.map((act: any, idx: number) => {
                const isString = typeof act === 'string';
                const name = isString ? act : (act.playerName ?? 'Atleta');
                const focus = !isString && act.focus ? (FOCUS_LABEL[act.focus as TrainingFocus] ?? act.focus) : null;
                const cost = !isString && typeof act.cost === 'number' ? act.cost : undefined;

                return (
                  <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{name}</strong>
                      {focus && (
                        <span style={{ fontSize: '0.76rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                          {focus}
                        </span>
                      )}
                    </div>
                    {act?.reason && <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>{act.reason}</p>}
                    {cost !== undefined && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: '#4ade80', fontWeight: 600 }}>Investimento: {formatMoney(cost)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn-primary" onClick={onCloseAutoReport} style={{ padding: '8px 24px' }}>Concluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Investing in main-squad development: training focus, sector training and mentorship assignment. */
export function TrainingPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [focusChoice, setFocusChoice] = useState<Record<string, TrainingFocus | null>>({});
  const [autoReport, setAutoReport] = useState<{ actions: any[]; message: string } | null>(null);
  const [mentorshipPairs, setMentorshipPairs] = useState<MentorshipPair[]>([]);
  const [sectorFocuses, setSectorFocuses] = useState<{
    defense: SectorTrainingFocus;
    midfield: SectorTrainingFocus;
    attack: SectorTrainingFocus;
  }>({
    defense: 'CLEAN_TACKLING',
    midfield: 'POSSESSION_FLOW',
    attack: 'CLINICAL_FINISHING',
  });

  useEffect(() => {
    if (!clubId) return;
    getClub(clubId)
      .then((c) => {
        setClub(c);
        setMentorshipPairs((prev) => (prev.length > 0 ? prev : autoAssignMentorshipPairs(c.players)));
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [clubId]);

  async function handleAutoTrain() {
    if (!club) return;
    setError(null);
    setSuccessMsg(null);
    setBusy(true);
    try {
      const res = await autoTrainSquad(club.id);
      setClub(res.club);
      setAutoReport({ actions: res.actions, message: res.message });
      setSuccessMsg(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTrain(playerId: string) {
    if (!club) return;
    setError(null);
    setSuccessMsg(null);
    setBusyPlayerId(playerId);
    try {
      const focus = focusChoice[playerId] ?? null;
      const targetPlayer = club.players.find((p) => p.id === playerId);
      const prevOverall = targetPlayer?.overall ?? 0;

      const updatedClub = await trainPlayer(club.id, playerId, focus);
      setClub(updatedClub);

      const afterPlayer = updatedClub.players.find((p) => p.id === playerId);
      const afterOverall = afterPlayer?.overall ?? 0;
      const diff = Math.round((afterOverall - prevOverall) * 10) / 10;
      const gainText = diff > 0 ? ` e a Força subiu para ${afterOverall} (+${diff})!` : `! Força atual: ${afterOverall}.`;

      setSuccessMsg(`Sessão de treino concluída para ${targetPlayer?.name ?? 'o atleta'}${focus ? ` com foco em ${FOCUS_LABEL[focus]}` : ''}${gainText}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyPlayerId(null);
    }
  }

  async function handleSetTutor(playerId: string) {
    if (!club) return;
    setError(null);
    setSuccessMsg(null);
    try {
      setClub(await setTutor(club.id, playerId));
      const target = club.players.find((p) => p.id === playerId);
      setSuccessMsg(`${target?.name} foi nomeado o Tutor do elenco!`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRemoveTutor() {
    if (!club) return;
    setError(null);
    setSuccessMsg(null);
    try {
      setClub(await setTutor(club.id, null));
      setSuccessMsg('Designação de tutor removida.');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleAutoAssignMentorship() {
    if (!club) return;
    const pairs = autoAssignMentorshipPairs(club.players, mentorshipPairs);
    setMentorshipPairs(pairs);
    setSuccessMsg(`Coordenação da Base definiu ${pairs.length} parcerias de mentoria veterano-aprendiz!`);
  }

  function handleRemoveMentorship(pairId: string) {
    setMentorshipPairs((prev) => prev.filter((p) => p.id !== pairId));
    setSuccessMsg('Parceria de mentoria desfeita com sucesso.');
  }

  function handleSectorFocusChange(unit: 'defense' | 'midfield' | 'attack', focus: SectorTrainingFocus) {
    setSectorFocuses((prev) => ({ ...prev, [unit]: focus }));
    const label = SECTOR_FOCUS_LABELS[focus]?.label ?? focus;
    setSuccessMsg(`Foco setorial de ${unit === 'defense' ? 'Defesa' : unit === 'midfield' ? 'Meio-Campo' : 'Ataque'} ajustado para "${label}".`);
  }

  function handleFocusChoiceChange(playerId: string, focus: TrainingFocus | null) {
    setFocusChoice((prev) => ({ ...prev, [playerId]: focus }));
  }

  if (loading) return <div className="page">Carregando centro de treinamento...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  return (
    <TrainingView
      club={club}
      mentorshipPairs={mentorshipPairs}
      sectorFocuses={sectorFocuses}
      focusChoice={focusChoice}
      busy={busy}
      busyPlayerId={busyPlayerId}
      error={error}
      successMsg={successMsg}
      autoReport={autoReport}
      onAutoTrain={handleAutoTrain}
      onTrain={handleTrain}
      onSetTutor={handleSetTutor}
      onRemoveTutor={handleRemoveTutor}
      onAutoAssignMentorship={handleAutoAssignMentorship}
      onRemoveMentorship={handleRemoveMentorship}
      onSectorFocusChange={handleSectorFocusChange}
      onFocusChoiceChange={handleFocusChoiceChange}
      onCloseAutoReport={() => setAutoReport(null)}
    />
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { developmentPlasticity, youthRemarks, isYouthGem, type Club, type Player, type TrainingFocus } from '@tactical-arena/shared';
import { promoteAcademyPlayer, releaseAcademyPlayer, trainAcademyPlayer, autoTrainAcademy } from '../api/client.js';
import { StaffRemarks } from './StaffRemarks.js';
import { positionLabel } from '../lib/positionLabel.js';
import { footLabel } from '../lib/footLabel.js';
import { PromessaSub20Icon } from './SpecialPlayerIcon.js';
import { useCutscene } from '../context/CutsceneContext.js';
import { AlertTriangleIcon } from './icons/AppIcons.js';
import { ConfirmModal } from './ConfirmModal.js';

interface AcademyPanelProps {
  club: Club;
  onUpdate: (club: Club) => void;
  onError: (message: string) => void;
}

const FOCUS_LABELS: Record<TrainingFocus, string> = {
  PHYSICAL: 'Físico (Força/Velocidade)',
  TECHNICAL: 'Técnico (Passe/Finalização)',
  MENTAL: 'Mental (Maturidade/Tática)',
  FINISHING: 'Finalização',
  PASSING: 'Passe',
  DEFENDING: 'Desarme',
  PACE: 'Velocidade',
};

const INDIVIDUAL_FOCUSES: TrainingFocus[] = ['FINISHING', 'PASSING', 'DEFENDING', 'PACE'];

function formatMoney(value?: number | null): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Sub-20 youth prospects: promote to the main squad, train (costs budget), or release outright. */
export function AcademyPanel({ club, onUpdate, onError }: AcademyPanelProps) {
  const { playCutscene } = useCutscene();
  const [focusByPlayer, setFocusByPlayer] = useState<Record<string, TrainingFocus | ''>>({});
  const [busy, setBusy] = useState(false);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Player | null>(null);
  const [autoReport, setAutoReport] = useState<{ actions: any[]; message: string } | null>(null);

  const youthCoordinator = club.staff?.find((s) => s.role === 'YOUTH_COORDINATOR');
  const fitnessCoach = club.staff?.find((s) => s.role === 'FITNESS_COACH');
  const individualTraining = club.staffDelegationConfig?.trainingRegime === 'individual_attributes';

  async function handleAutoTrain() {
    setBusy(true);
    try {
      const res = await autoTrainAcademy(club.id);
      onUpdate(res.club);
      setAutoReport({ actions: res.actions, message: res.message });
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePromote(playerId: string) {
    try {
      const target = club.academyPlayers.find((p) => p.id === playerId);
      const updated = await promoteAcademyPlayer(club.id, playerId);
      onUpdate(updated);
      if (target) {
        playCutscene({
          type: 'joia-da-base',
          club,
          data: {
            playerName: target.name,
            playerOverall: target.overall,
            playerPosition: target.position
          }
        });
      }
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function executeRelease(playerId: string) {
    try {
      onUpdate(await releaseAcademyPlayer(club.id, playerId));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setReleaseTarget(null);
    }
  }

  async function handleTrain(playerId: string) {
    setBusyPlayerId(playerId);
    try {
      onUpdate(await trainAcademyPlayer(club.id, playerId, focusByPlayer[playerId] || null));
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusyPlayerId(null);
    }
  }

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PromessaSub20Icon size={26} /> Categorias de Base (Sub-20)
          </h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.84rem' }}>
            Jovens promessas com alta plasticidade neural. Evoluem semanalmente e convertem treinos em saltos reais de força.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {club.academyPlayers.length > 0 && (
            <button
              className="btn-primary"
              style={{
                fontSize: '0.85rem',
                padding: '6px 14px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: '1px solid #38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              }}
              disabled={busy}
              onClick={handleAutoTrain}
            >
              <PromessaSub20Icon size={18} showGlow={false} /> {busy ? 'Treinando Base...' : 'Treinar Toda a Base (Coordenador)'}
            </button>
          )}

          {youthCoordinator ? (
            <span className="badge-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #38bdf8', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <PromessaSub20Icon size={16} showGlow={false} /> {youthCoordinator.name} ({youthCoordinator.rating} OVR): +{Math.round((youthCoordinator.rating - 50) * 1.0)}% Aceleração
            </span>
          ) : (
            <Link to={`/clubs/${club.id}/staff`} className="badge-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid #f59e0b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              <AlertTriangleIcon size={14} style={{ marginRight: 4 }} /> Sem Coordenador da Base (Contratar)
            </Link>
          )}
        </div>
      </div>

      {/*
        The coordinator, on the screen where their work is. Their read of a boy's ceiling is a judgement with
        their own error in it, not the exact number in the data. See youthRemarks.
      */}
      <StaffRemarks remarks={youthRemarks(club)} title="Parecer da base" />

      {club.academyPlayers.length === 0 && <p className="muted">Nenhum jogador na base no momento.</p>}
      {club.academyPlayers.length > 0 && (
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
                <th title="Multiplicador de evolução natural e de treinos">Plasticidade</th>
                <th>Foco de Treino</th>
                <th>Custo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {club.academyPlayers.map((p: Player) => {
                const plasticity = developmentPlasticity(p.age);
                const cost = Math.max(2000, Math.round(p.marketValue * 0.05));
                const canAfford = club.budget >= cost;
                const isBusy = busyPlayerId === p.id;

                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>{' '}
                      {isYouthGem(p) && <PromessaSub20Icon size={18} />}
                    </td>
                    <td>{positionLabel(p.position)}</td>
                    <td>{footLabel(p.preferredFoot)}</td>
                    <td>{p.age} anos</td>
                    <td><strong style={{ color: '#ffd700' }}>{Math.round(p.overall)}</strong></td>
                    <td><strong style={{ color: '#4ade80' }}>{p.potential}</strong></td>
                    <td>
                      <span
                        className={plasticity >= 2 ? 'academy-plasticity-high' : undefined}
                        style={{
                          fontWeight: 700,
                          color: plasticity >= 2 ? '#38bdf8' : '#cbd5e1',
                        }}
                      >
                        {plasticity.toFixed(1)}x
                      </span>
                    </td>
                    <td>
                      <select
                        value={focusByPlayer[p.id] ?? ''}
                        aria-label={`Foco de treino de ${p.name}`}
                        onChange={(e) => setFocusByPlayer((prev) => ({ ...prev, [p.id]: e.target.value as TrainingFocus | '' }))}
                      >
                        <option value="">Geral Equilibrado</option>
                        {(individualTraining ? INDIVIDUAL_FOCUSES : Object.keys(FOCUS_LABELS) as TrainingFocus[]).map((focus) => (
                          <option key={focus} value={focus}>
                            {FOCUS_LABELS[focus]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatMoney(cost)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(() => {
                          const isTrained = Boolean((p as any).lastTrainedCycle);
                          return (
                            <button
                              className={isTrained ? "btn-secondary" : "btn-primary"}
                              style={{ fontSize: '0.75rem', padding: '4px 8px', opacity: isTrained ? 0.6 : 1 }}
                              disabled={!canAfford || isBusy || isTrained}
                              onClick={() => handleTrain(p.id)}
                              title={isTrained ? 'Atleta já realizou a sessão desta rodada. Avance a rodada para novo treino.' : 'Realizar treino intensivo'}
                            >
                              {isBusy ? 'Treinando...' : isTrained ? 'Treinado' : 'Treinar'}
                            </button>
                          );
                        })()}
                        <button
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => handlePromote(p.id)}
                        >
                          Subir p/ Profissional
                        </button>
                        <button
                          className="btn-danger"
                          style={{ fontSize: '0.75rem', padding: '4px 6px' }}
                          onClick={() => setReleaseTarget(p)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE RELATÓRIO DO COORDENADOR DA BASE */}
      {autoReport && (
        <div className="modal-backdrop" onClick={() => setAutoReport(null)}>
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
                Relatório das Categorias de Base
              </h3>
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.9rem' }} onClick={() => setAutoReport(null)}>✕</button>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#cbd5e1', margin: '0 0 16px', lineHeight: 1.5 }}>{autoReport.message}</p>

            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {autoReport.actions.map((act: any, idx: number) => {
                const isString = typeof act === 'string';
                const name = isString ? act : (act.playerName ?? 'Atleta');
                const focus = !isString && act.focus ? (FOCUS_LABELS[act.focus as TrainingFocus] ?? act.focus) : null;
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
              <button className="btn-primary" onClick={() => setAutoReport(null)} style={{ padding: '8px 24px' }}>Concluir</button>
            </div>
          </div>
        </div>
      )}
          <ConfirmModal
        isOpen={!!releaseTarget}
        title="Dispensar Promessa"
        message={
          <>
            Tem certeza que deseja dispensar a promessa{' '}
            <strong style={{ color: '#ffd700' }}>{releaseTarget?.name}</strong> das categorias de base?
            Esta ação é irreversível e o atleta deixará o clube imediatamente.
          </>
        }
        confirmLabel="Dispensar Atleta"
        cancelLabel="Cancelar"
        variant="danger"
        onCancel={() => setReleaseTarget(null)}
        onConfirm={() => releaseTarget && executeRelease(releaseTarget.id)}
      />
    </section>
  );
}

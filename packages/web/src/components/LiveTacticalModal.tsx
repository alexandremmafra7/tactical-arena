import { useEffect, useState } from 'react';
import {
  isPlayerAvailable,
  getRecommendedTeamTalk,
  type AttackApproach,
  type AttackStyle,
  type Club,
  type Formation,
  type MarkingStyle,
  type MatchEvent,
  type Mentality,
  type PendingMatchDecision,
  type Player,
  type PlayerFunction,
  type PressingIntensity,
  type Tactic,
  type TeamTalkResult,
} from '@tactical-arena/shared';
import {
  applyTeamTalk,
  setPlayerFunctions,
  type InjuryDecisionOptions,
} from '../api/client.js';
import { positionLabel } from '../lib/positionLabel.js';
import { PitchField, setDraggedPlayerPosition, DND_PLAYER_ID, DND_PLAYER_POSITION } from './PitchField.js';
import { ClubCrest } from './ClubCrest.js';
import { TeamTalkCard } from './TeamTalkCard.js';
import { TacticsIcon, HalftimeTacticsHydrationIcon, MedicalCrossIcon, RedCardIcon } from './icons/AppIcons.js';

import { STANDARD_FORMATIONS, CONTINGENCY_FORMATIONS, analyzeSquadChemistry } from '@tactical-arena/shared';
import { SectorChemistryPanel } from './SectorChemistryPanel.js';

export type LiveTacticalModalMode = 'manual' | 'halftime' | 'injury' | 'redCard';

const FORMATIONS: Formation[] = [...STANDARD_FORMATIONS, ...CONTINGENCY_FORMATIONS];

interface LiveTacticalModalProps {
  isOpen: boolean;
  mode: LiveTacticalModalMode;
  minute: number;
  myClub: Club | null;
  mySide: 'home' | 'away' | null;
  tactic: Tactic | null;
  kitColor: string | null;
  bookedIds: ReadonlySet<string>;
  events?: MatchEvent[];
  busy: boolean;
  error?: string | null;
  // Score banner props
  homeClub?: Club | null;
  awayClub?: Club | null;
  homeGoals?: number;
  awayGoals?: number;
  // Injury mode props
  injuryDecision?: PendingMatchDecision | null;
  injuryOptions?: InjuryDecisionOptions | null;
  onResolveInjury?: (replacementPlayerId: string | null) => Promise<void>;
  // Red card mode props
  redCardDecision?: PendingMatchDecision | null;
  onResolveRedCard?: (lineupPlayerIds: string[] | null) => Promise<void>;
  // Manual / Halftime save
  onSaveTactic?: (updated: {
    formation: Formation;
    mentality: Mentality;
    attackStyle: AttackStyle;
    markingStyle: MarkingStyle;
    attackApproach: AttackApproach;
    pressing: PressingIntensity;
    lineup: string[];
    subOutId?: string;
    subInId?: string;
  }) => Promise<void>;
  onClose: () => void;
  onResumeHalftime?: () => void;
  onTeamTalkApplied?: (result: TeamTalkResult) => void;
}

export function LiveTacticalModal({
  isOpen,
  mode,
  minute,
  myClub,
  mySide,
  tactic,
  kitColor,
  bookedIds,
  events = [],
  busy,
  error: externalError,
  homeClub,
  awayClub,
  homeGoals,
  awayGoals,
  injuryDecision,
  injuryOptions,
  onResolveInjury,
  redCardDecision,
  onResolveRedCard,
  onSaveTactic,
  onClose,
  onResumeHalftime,
  onTeamTalkApplied,
}: LiveTacticalModalProps) {
  const [formation, setFormation] = useState<Formation>('4-4-2');
  const [mentality, setMentality] = useState<Mentality>('balanced');
  const [attackStyle, setAttackStyle] = useState<AttackStyle>('BALANCED');
  const [markingStyle, setMarkingStyle] = useState<MarkingStyle>('BALANCED');
  const [attackApproach, setAttackApproach] = useState<AttackApproach>('BALANCED');
  const [pressing, setPressing] = useState<PressingIntensity>('MEDIUM');
  const [selections, setSelections] = useState<(string | null)[]>([]);
  const [subOutId, setSubOutId] = useState('');
  const [subInId, setSubInId] = useState('');
  const [subMessage, setSubMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [teamTalkApplied, setTeamTalkApplied] = useState(false);

  // Sync state whenever modal opens or tactic updates
  useEffect(() => {
    if (!isOpen || !tactic) return;
    setFormation(tactic.formation);
    setMentality(tactic.mentality);
    setAttackStyle(tactic.attackStyle);
    setMarkingStyle(tactic.markingStyle);
    setAttackApproach(tactic.attackApproach);
    setPressing(tactic.pressing ?? 'MEDIUM');
    setSelections(tactic.lineup.map((s) => s.playerId));
    setSubOutId('');
    setSubInId('');
    setSubMessage(null);
    setLocalError(null);
    setTeamTalkApplied(false);
  }, [isOpen, tactic]);

  if (!isOpen || !myClub) return null;

  const isInjury = mode === 'injury';
  const isRedCard = mode === 'redCard';
  const isHalftime = mode === 'halftime';
  const isManual = mode === 'manual';

  const scoreDifferential = mySide === 'home'
    ? (homeGoals ?? 0) - (awayGoals ?? 0)
    : mySide === 'away'
      ? (awayGoals ?? 0) - (homeGoals ?? 0)
      : 0;

  // Injury decision data
  const injuredPlayer = isInjury && injuryDecision ? myClub.players.find((p) => p.id === injuryDecision.playerId) : null;
  const suggestedCandidate = isInjury && injuryOptions?.suggestedId
    ? myClub.players.find((p) => p.id === injuryOptions.suggestedId)
    : null;
  const candidates: Player[] = injuryOptions?.candidates ?? [];

  // Red card decision data
  const sentOffPlayer = isRedCard && redCardDecision ? myClub.players.find((p) => p.id === redCardDecision.playerId) : null;

  // Track players who were already substituted OUT (now wearing training vests 🦺 on the bench and cannot return)
  const substitutedOutIds = new Set<string>();
  events.forEach((ev) => {
    if (ev.type === 'substitution' && ev.team === mySide && ev.playerId) {
      substitutedOutIds.add(ev.playerId);
    }
  });
  (tactic?.plannedSubstitutions ?? []).forEach((s) => {
    substitutedOutIds.add(s.outPlayerId);
  });
  if (subOutId) substitutedOutIds.add(subOutId);

  // Bench players list
  const declaredSubstituteIds = new Set((tactic?.substitutes ?? []).map((s) => s.playerId));
  const starterIds = new Set(selections.filter((id): id is string => !!id));
  const benchPlayers = myClub.players.filter(
    (p) => (declaredSubstituteIds.has(p.id) || substitutedOutIds.has(p.id)) && !starterIds.has(p.id),
  );

  // Drag & drop drop-on-slot handler (when a bench player is dropped directly onto a starter slot)
  function handleSlotSelect(slotIndex: number, newPlayerId: string) {
    const previousStarterId = selections[slotIndex];
    if (previousStarterId && previousStarterId !== newPlayerId) {
      const outPlayer = myClub?.players.find((p) => p.id === previousStarterId);
      const inPlayer = myClub?.players.find((p) => p.id === newPlayerId);
      setSubOutId(previousStarterId);
      setSubInId(newPlayerId);
      if (outPlayer && inPlayer) {
        setSubMessage(`Substituição: Sai ${outPlayer.name} (${positionLabel(outPlayer.position)}) ➔ Entra ${inPlayer.name} (${positionLabel(inPlayer.position)})`);
      }
    }
    setSelections((prev) => {
      const next = [...prev];
      next[slotIndex] = newPlayerId;
      return next;
    });
  }

  function handleSlotSwap(fromIndex: number, toIndex: number) {
    setSelections((prev) => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  }

  function handleBenchDragStart(e: React.DragEvent, player: Player) {
    if (substitutedOutIds.has(player.id)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(DND_PLAYER_ID, player.id);
    e.dataTransfer.setData(DND_PLAYER_POSITION, player.position);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedPlayerPosition(player.position);
  }

  async function handleAssignFunction(playerId: string, fn: PlayerFunction) {
    if (!myClub) return;
    try {
      await setPlayerFunctions(myClub.id, playerId, [fn]);
    } catch (err) {
      setLocalError((err as Error).message);
    }
  }

  async function handleSaveAndResume() {
    if (selections.some((id) => !id)) {
      setLocalError('Escale um jogador em todas as posições de linha.');
      return;
    }
    setLocalError(null);
    if (isHalftime && !teamTalkApplied && myClub && myClub.staffDelegationConfig?.delegateTeamTalks !== false) {
      const rec = getRecommendedTeamTalk('HALF_TIME', scoreDifferential);
      applyTeamTalk(myClub.id, rec.id, 'HALF_TIME', scoreDifferential)
        .then((res) => {
          if (onTeamTalkApplied) onTeamTalkApplied(res);
        })
        .catch(() => {});
    }
    if (onSaveTactic) {
      await onSaveTactic({
        formation,
        mentality,
        attackStyle,
        markingStyle,
        attackApproach,
        pressing,
        lineup: selections.filter((id): id is string => !!id),
        subOutId: subOutId || undefined,
        subInId: subInId || undefined,
      });
    }
    if (isHalftime && onResumeHalftime) {
      onResumeHalftime();
    }
  }

  const errorMessage = localError || externalError;

  return (
    <div className="options-modal-backdrop live-tactical-backdrop" role="dialog" aria-modal="true">
      <div className={`options-modal-card live-tactical-modal-card ${mode}`}>
        {/* MODAL HEADER */}
        <div className="live-tactical-modal-header">
          <div className="live-tactical-title-group">
            <span className="live-tactical-header-icon" aria-hidden="true">
              {isHalftime && <HalftimeTacticsHydrationIcon size={30} />}
              {isManual && <TacticsIcon size={26} color="#ffd700" />}
              {isInjury && <MedicalCrossIcon size={24} />}
              {isRedCard && <RedCardIcon size={22} />}
            </span>
            <div>
              <h2 className="live-tactical-modal-title">
                {isInjury && `Atendimento Médico • Lesão aos ${minute}'`}
                {isRedCard && `Expulsão Direta • Reorganização aos ${minute}'`}
                {isHalftime && `Intervalo de Jogo (45') • Vestiário e Prancheta Tática`}
                {isManual && `Prancheta Tática e Substituições • ${minute}'`}
              </h2>
              <p className="live-tactical-modal-subtitle">
                {isInjury && `${injuredPlayer?.name ?? 'Um jogador'} não tem condições de continuar na partida.`}
                {isRedCard && `${sentOffPlayer?.name ?? 'Um jogador'} foi expulso. Reorganize o posicionamento dos 10 jogadores.`}
                {isHalftime && 'Ajuste a formação, faça substituições táticas e reidrate a equipe para o 2º tempo.'}
                {isManual && `As alterações táticas e substituições valerão a partir do minuto ${minute + 1}'.`}
              </p>
            </div>
          </div>

          {isHalftime ? (
            <button
              type="button"
              className="btn-halftime-resume-header"
              onClick={handleSaveAndResume}
              disabled={busy}
              title="Iniciar o 2º tempo com as configurações atuais"
            >
              {busy ? 'Iniciando...' : 'INICIAR 2º TEMPO ➔'}
            </button>
          ) : isManual ? (
            <button
              type="button"
              className="options-modal-close"
              onClick={onClose}
              aria-label="Fechar"
              disabled={busy}
            >
              ✕
            </button>
          ) : null}
        </div>

        {errorMessage && <div className="options-feedback-alert error">{errorMessage}</div>}
        {subMessage && <div className="options-feedback-alert success">{subMessage}</div>}

        {/* SCORE BANNER — halftime only */}
        {isHalftime && homeClub && awayClub && homeGoals != null && awayGoals != null && (
          <div className="halftime-score-banner">
            <div className="halftime-score-team home">
              <ClubCrest club={homeClub} size={36} />
              <span className="halftime-score-name">{homeClub.name}</span>
              <span className="halftime-score-num">{homeGoals}</span>
            </div>
            <div className="halftime-score-center">
              <span className="halftime-badge">INTERVALO</span>
              <span className="halftime-score-divider">x</span>
            </div>
            <div className="halftime-score-team away">
              <span className="halftime-score-num">{awayGoals}</span>
              <span className="halftime-score-name">{awayClub.name}</span>
              <ClubCrest club={awayClub} size={36} />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE: INJURY STOPPAGE                                                    */}
        {/* ========================================================================= */}
        {isInjury && (
          <div className="live-tactical-injury-body">
            <div className="injury-player-alert-card">
              <div className="injury-alert-icon">✚</div>
              <div className="injury-alert-info">
                <h3>{injuredPlayer?.name ?? 'Jogador Lesionado'}</h3>
                <span>
                  {injuredPlayer ? `${positionLabel(injuredPlayer.position)} · Overall ${injuredPlayer.overall}` : ''}
                </span>
                <p className="injury-alert-desc">Lesão confirmada pelo departamento médico. Substituição necessária.</p>
              </div>
            </div>

            {/* VIBRANT GLOWING RECOMMENDATION CARD */}
            {suggestedCandidate && onResolveInjury && (
              <div className="assistant-recommendation-hero-card">
                <div className="assistant-recommendation-badge">
                  ⭐ SUGESTÃO DO AUXILIAR TÉCNICO (MELHOR OPÇÃO)
                </div>
                <div className="assistant-hero-content">
                  <div className="assistant-hero-avatar"><TacticsIcon size={22} color="var(--accent)" /></div>
                  <div className="assistant-hero-details">
                    <h4 className="assistant-hero-name">{suggestedCandidate.name}</h4>
                    <div className="assistant-hero-meta">
                      <span className="assistant-hero-pos">{positionLabel(suggestedCandidate.position)}</span>
                      <span className="assistant-hero-ovr">Overall {suggestedCandidate.overall}</span>
                      <span className="assistant-hero-stamina">Fôlego {Math.round(100 - (suggestedCandidate.fatigue ?? 0))}%</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-assistant-hero-action"
                    onClick={() => onResolveInjury(suggestedCandidate.id)}
                    disabled={busy}
                  >
                    {busy ? 'Substituindo...' : `Substituir por ${suggestedCandidate.name}`}
                  </button>
                </div>
              </div>
            )}

            {/* OTHER CANDIDATES LIST */}
            <div className="injury-candidates-section">
              <h4 className="injury-candidates-title">Outras opções disponíveis no banco de reservas:</h4>
              {candidates.length === 0 ? (
                <p className="muted">Não há outros reservas disponíveis para esta posição.</p>
              ) : (
                <div className="injury-candidates-grid">
                  {candidates
                    .filter((c: Player) => c.id !== suggestedCandidate?.id)
                    .map((player: Player) => (
                      <button
                        key={player.id}
                        type="button"
                        className="injury-candidate-card"
                        onClick={() => onResolveInjury && onResolveInjury(player.id)}
                        disabled={busy}
                      >
                        <div className="injury-candidate-info">
                          <strong className="injury-candidate-name">{player.name}</strong>
                          <span className="injury-candidate-meta">
                            {positionLabel(player.position)} · OVR {player.overall}
                          </span>
                        </div>
                        <span className="injury-candidate-action-tag">Entrar</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* DECLINE BUTTON */}
            <div className="injury-decline-dock">
              <button
                type="button"
                className="btn-decline-injury"
                onClick={() => onResolveInjury && onResolveInjury(null)}
                disabled={busy}
              >
                Seguir com um a menos (Sem substituição)
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE: RED CARD STOPPAGE                                                  */}
        {/* ========================================================================= */}
        {isRedCard && (
          <div className="live-tactical-redcard-body">
            <div className="redcard-alert-banner">
              
              <p>
                <strong>{sentOffPlayer?.name ?? 'Jogador'}</strong> foi expulso. Arraste os jogadores no campo abaixo
                para posicionar o buraco tático onde for mais conveniente para a sua estratégia.
              </p>
            </div>

            <div className="redcard-pitch-container">
              <PitchField
                compact
                kitColor={kitColor}
                clubSlug={myClub.slug}
                isAway={mySide === 'away'}
                bookedPlayerIds={bookedIds}
                formation={formation}
                squad={myClub.players}
                selections={selections}
                vacatedPlayerIds={sentOffPlayer ? new Set([sentOffPlayer.id]) : undefined}
                currentMatchMinute={minute}
                defensiveLine={tactic?.defensiveLine}
                attackStyle={attackStyle}
                pressing={pressing}
                onSelect={handleSlotSelect}
                onSwap={handleSlotSwap}
                onAssignFunction={handleAssignFunction}
              />
            </div>

            <div className="redcard-action-dock">
              <button
                type="button"
                className="btn-options-action save"
                onClick={() => onResolveRedCard && onResolveRedCard(selections.filter((id): id is string => !!id))}
                disabled={busy}
              >
                {busy ? 'Salvando reorganização...' : '✓ Confirmar Nova Disposição Tática'}
              </button>
              <button
                type="button"
                className="btn-options-action info"
                onClick={() => onResolveRedCard && onResolveRedCard(null)}
                disabled={busy}
              >
                Manter Posicionamento Atual
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE: MANUAL / HALFTIME TACTICAL COMMAND CENTER                          */}
        {/* ========================================================================= */}
        {(isManual || isHalftime) && (
          <div className="live-tactical-full-body">
            {isHalftime && (
              <div className="live-tactical-halftime-talk">
                <TeamTalkCard
                  clubId={myClub.id}
                  context="HALF_TIME"
                  scoreDifferential={scoreDifferential}
                  onApplied={(result) => {
                    setTeamTalkApplied(true);
                    if (onTeamTalkApplied) onTeamTalkApplied(result);
                  }}
                />
              </div>
            )}

            {/* Top Bar: Formations Bar */}
            <div className="live-tactical-formations-bar">
              <span className="formations-label">Formação Tática:</span>
              <div className="formations-pills-list">
                {FORMATIONS.map((f: Formation) => (
                  <button
                    key={f}
                    type="button"
                    className={`formation-pill ${formation === f ? 'active' : ''}`}
                    onClick={() => setFormation(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* 2-Column Zero-Scroll Tactical Workstation */}
            <div className="live-tactical-2col-grid">
              {/* Left Column: Compact 2D Pitch */}
              <div className="live-tactical-pitch-col">
                <div className="tactical-pitch-wrapper">
                  <PitchField
                    compact
                    kitColor={kitColor}
                    clubSlug={myClub.slug}
                    isAway={mySide === 'away'}
                    bookedPlayerIds={bookedIds}
                    formation={formation}
                    squad={myClub.players}
                    selections={selections}
                    currentMatchMinute={minute}
                    defensiveLine={tactic?.defensiveLine}
                    attackStyle={attackStyle}
                    pressing={pressing}
                    onSelect={handleSlotSelect}
                    onSwap={handleSlotSwap}
                    onAssignFunction={handleAssignFunction}
                  />
                </div>
              </div>

              {/* Right Column: Interactive Bench (Drag & Drop) & Strategies */}
              <div className="live-tactical-controls-col">
                {/* Interactive Bench Container */}
                <div className="tactical-bench-panel">
                  <div className="tactical-bench-header">
                    <h4 className="tactical-bench-title">
                      Banco de Reservas
                    </h4>
                    <span className="tactical-bench-tip">
                      Arraste um reserva para cima do titular no campo para substituir
                    </span>
                  </div>

                  <div className="tactical-bench-chips-grid">
                    {benchPlayers.map((player) => {
                      const isSubstitutedOut = substitutedOutIds.has(player.id);
                      return (
                        <div
                          key={player.id}
                          className={`bench-player-chip ${isSubstitutedOut ? 'substituted-vest' : 'available'}`}
                          draggable={!isSubstitutedOut}
                          onDragStart={(e) => handleBenchDragStart(e, player)}
                          onDragEnd={() => setDraggedPlayerPosition(null)}
                          title={
                            isSubstitutedOut
                              ? `${player.name} já foi substituído e está de colete. Pelas regras do futebol, não pode retornar a campo.`
                              : `Arraste ${player.name} (${positionLabel(player.position)}) para o campo para substituir.`
                          }
                        >
                          <span className="bench-chip-pos">
                            {isSubstitutedOut ? 'SUB' : positionLabel(player.position)}
                          </span>
                          <div className="bench-chip-info">
                            <strong className="bench-chip-name">{player.name}</strong>
                            <span className="bench-chip-meta">
                              {isSubstitutedOut ? (
                                <span className="vest-status-tag">COLETE (SUBSTITUÍDO)</span>
                              ) : (
                                <>OVR {player.overall} · Fôlego: {Math.round(100 - (player.fatigue ?? 0))}%</>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Strategy Pills Deck */}
                <div className="tactical-strategies-deck">
                  {/* Mentalidade */}
                  <div className="strategy-deck-row">
                    <span className="strategy-deck-label">Mentalidade:</span>
                    <div className="strategy-deck-pills">
                      {[
                        { id: 'defensive', label: 'Defensiva' },
                        { id: 'balanced', label: 'Equilibrada' },
                        { id: 'attacking', label: 'Ofensiva' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`strategy-pill ${mentality === item.id ? 'active' : ''}`}
                          onClick={() => setMentality(item.id as Mentality)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Estilo de Ataque */}
                  <div className="strategy-deck-row">
                    <span className="strategy-deck-label">Estilo de Ataque:</span>
                    <div className="strategy-deck-pills">
                      {[
                        { id: 'WINGS', label: 'Pontas' },
                        { id: 'BALANCED', label: 'Misto' },
                        { id: 'THROUGH_MIDDLE', label: 'Meio' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`strategy-pill ${attackStyle === item.id ? 'active' : ''}`}
                          onClick={() => setAttackStyle(item.id as AttackStyle)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Marcação */}
                  <div className="strategy-deck-row">
                    <span className="strategy-deck-label">Marcação:</span>
                    <div className="strategy-deck-pills">
                      {[
                        { id: 'LIGHT', label: 'Leve' },
                        { id: 'BALANCED', label: 'Equilibrada' },
                        { id: 'HEAVY', label: 'Pesada' },
                        { id: 'MAN_MARKING', label: 'Individual' },
                        { id: 'ZONAL', label: 'Zona' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`strategy-pill ${markingStyle === item.id ? 'active' : ''}`}
                          onClick={() => setMarkingStyle(item.id as MarkingStyle)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pressão */}
                  <div className="strategy-deck-row">
                    <span className="strategy-deck-label">Pressão:</span>
                    <div className="strategy-deck-pills">
                      {[
                        { id: 'LOW_BLOCK', label: 'Bloco Baixo' },
                        { id: 'MEDIUM', label: 'Média' },
                        { id: 'HIGH_PRESS', label: 'Pressão Alta' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`strategy-pill ${pressing === item.id ? 'active' : ''}`}
                          onClick={() => setPressing(item.id as PressingIntensity)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Real-time Sector Chemistry Panel */}
                {myClub && (() => {
                  const currentTactic: Tactic = {
                    clubId: myClub.id,
                    formation,
                    mentality,
                    attackStyle,
                    markingStyle,
                    attackApproach,
                    pressing,
                    lineup: selections.filter((id): id is string => id !== null).map((id) => ({ playerId: id })),
                    substitutes: [],
                    plannedSubstitutions: [],
                  };
                  const chemistry = analyzeSquadChemistry(myClub, currentTactic);
                  return <SectorChemistryPanel chemistry={chemistry} compact />;
                })()}
              </div>
            </div>

            {/* Bottom Action Dock (somente para pausa manual, no intervalo o botão fica no topo sem necessidade de rolagem) */}
            {!isHalftime && (
              <div className="live-tactical-bottom-dock">
                <button
                  type="button"
                  className="btn-options-action save live-dock-hero-btn"
                  onClick={handleSaveAndResume}
                  disabled={busy}
                >
                  {busy ? 'Aplicando alterações...' : `APLICAR ALTERAÇÕES E VOLTAR AO JOGO (min ${minute + 1}')`}
                </button>

                <button
                  type="button"
                  className="btn-options-action cancel"
                  onClick={onClose}
                  disabled={busy}
                >
                  Voltar à Partida
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

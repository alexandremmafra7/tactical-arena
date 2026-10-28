import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { autoFillLineup, isPlayerAvailable, lineupRemarks, pickBenchPlayers, pickPlayersForSlots } from '@tactical-arena/shared';
import type {
  AttackApproach,
  AttackStyle,
  Club,
  DefensiveLineHeight,
  Formation,
  LineupAutofillStrategy,
  MarkingStyle,
  Mentality,
  Player,
  PlayerFunction,
  PlayerRole,
  PressingIntensity,
  Tactic,
  TacticPreset,
} from '@tactical-arena/shared';
import {
  deleteTacticPreset,
  getClub,
  listTacticPresets,
  saveTacticPreset,
  setDefaultTacticPreset,
  setPlayerRole,
  setPlayerFunctions,
  setRoundTactic,
} from '../api/client.js';
import { PitchField, getFormationSlots, sideFromX, DND_PLAYER_ID, DND_SOURCE_SLOT } from '../components/PitchField.js';
import { PlayerChip } from '../components/PlayerChip.js';
import { STANDARD_FORMATIONS, analyzeSquadChemistry, autoAssignSquadRoles, defensiveLineOf, playerRoles } from '@tactical-arena/shared';
import { SectorChemistryPanel } from '../components/SectorChemistryPanel.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { StaffRemarks } from '../components/StaffRemarks.js';
import { positionLabel } from '../lib/positionLabel.js';
import { useClubColor } from '../lib/useClubColor.js';
import { goToMatchday } from '../lib/goToMatchday';
import { SoccerBallIcon, CheckIcon, AlertTriangleIcon } from '../components/icons/AppIcons.js';
import { useViewMode } from '../context/ViewModeContext.js';

const FORMATIONS: Formation[] = STANDARD_FORMATIONS;
type PositionFilter = 'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT';

/** Pulls hand-placed pitch coordinates out of a stored lineup. Slots saved before free placement
 *  existed simply have no x/y, and stay wherever the formation puts them. */
function pointsFromLineup(lineup: { x?: number; y?: number }[]): ({ x: number; y: number } | null)[] {
  return lineup.map((slot) => (typeof slot.x === 'number' && typeof slot.y === 'number' ? { x: slot.x, y: slot.y } : null));
}

export function ClubTacticsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [presets, setPresets] = useState<TacticPreset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyMatch, setBusyMatch] = useState(false);
  const [unscaledAlert, setUnscaledAlert] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [savePresetModalOpen, setSavePresetModalOpen] = useState(false);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const { isBrasfoot } = useViewMode();

  const [formation, setFormation] = useState<Formation>('4-4-2');
  const [mentality, setMentality] = useState<Mentality>('balanced');
  const [attackStyle, setAttackStyle] = useState<AttackStyle>('THROUGH_MIDDLE');
  const [markingStyle, setMarkingStyle] = useState<MarkingStyle>('BALANCED');
  const [attackApproach, setAttackApproach] = useState<AttackApproach>('COUNTER_ATTACK');
  const [pressing, setPressing] = useState<PressingIntensity>('MEDIUM');
  const [defensiveLine, setDefensiveLine] = useState<DefensiveLineHeight>('BALANCED');
  const [selections, setSelections] = useState<(string | null)[]>(Array(11).fill(null));
  /** Hand-placed pitch coordinates per slot; null means "leave this one where the formation puts it". */
  const [slotPoints, setSlotPoints] = useState<({ x: number; y: number } | null)[]>(Array(11).fill(null));
  const [substituteIds, setSubstituteIds] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [mobileTab, setMobileTab] = useState<'pitch' | 'bench' | 'strategy'>('pitch');
  const clubColor = useClubColor(club);

  useEffect(() => {
    if (!clubId) return;
    (async () => {
      try {
        const [clubData, presetData] = await Promise.all([getClub(clubId), listTacticPresets(clubId)]);
        setClub(clubData);
        setPresets(presetData);

        if (clubData && presetData.length === 0 && !clubData.pendingRoundTactic) {
          const autofilled = autoFillLineup(clubData);
          setFormation(autofilled.formation);
          setSelections(autofilled.lineup.map((s) => s.playerId));
          setSlotPoints(pointsFromLineup(autofilled.lineup));
          setSubstituteIds(autofilled.substitutes.map((s) => s.playerId));
        } else if (clubData?.pendingRoundTactic) {
          try {
            const currentTactic: Tactic =
              typeof clubData.pendingRoundTactic === 'string'
                ? JSON.parse(clubData.pendingRoundTactic)
                : clubData.pendingRoundTactic;
            setFormation(currentTactic.formation);
            setMentality(currentTactic.mentality);
            setAttackStyle(currentTactic.attackStyle);
            setMarkingStyle(currentTactic.markingStyle);
            setAttackApproach(currentTactic.attackApproach);
            setPressing(currentTactic.pressing ?? 'MEDIUM');
            setDefensiveLine(currentTactic.defensiveLine ?? defensiveLineOf(currentTactic));
            setSelections(currentTactic.lineup.map((s) => s.playerId));
            setSlotPoints(pointsFromLineup(currentTactic.lineup));
            setSubstituteIds(currentTactic.substitutes.map((s) => s.playerId));
          } catch {
            // fallback
          }
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [clubId]);

  function handleFormationChange(next: Formation) {
    setFormation(next);
    setSelections(Array(getFormationSlots(next).length).fill(null));
    // A new formation is a new shape: hand placement from the old one would be meaningless.
    setSlotPoints(Array(getFormationSlots(next).length).fill(null));
    setSubstituteIds([]);
  }

  function handleSlotSelect(slotIndex: number, playerId: string) {
    const previousPlayerId = selections[slotIndex];
    const isPlayerInBench = substituteIds.includes(playerId);

    setSelections((prev) => {
      const next = [...prev];
      next[slotIndex] = playerId;
      return next;
    });

    setSubstituteIds((prev) => {
      let nextSubIds = [...prev];
      nextSubIds = nextSubIds.filter((id) => id !== playerId);

      if (previousPlayerId) {
        if (isPlayerInBench) {
          const indexA = prev.indexOf(playerId);
          if (indexA !== -1) {
            nextSubIds.splice(indexA, 0, previousPlayerId);
          } else {
            nextSubIds.push(previousPlayerId);
          }
        } else {
          if (nextSubIds.length < 7) {
            nextSubIds.push(previousPlayerId);
          }
        }
      }

      return Array.from(new Set(nextSubIds)).slice(0, 7);
    });
  }

  function toggleSubstitute(playerId: string) {
    setSubstituteIds((prev) => (prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]));
  }

  function handleAutoFill(strategy: LineupAutofillStrategy) {
    if (!club) return;
    const slotPositions = getFormationSlots(formation).map((s) => s.position);
    const styleContext = { attackStyle, markingStyle };
    const next = pickPlayersForSlots(club.players, slotPositions, strategy, null, styleContext);
    setSelections(next);
    setSlotPoints(Array(next.length).fill(null));
    const usedIds = new Set(next.filter((id): id is string => !!id));
    setSubstituteIds(pickBenchPlayers(club.players, usedIds, strategy, undefined, null, styleContext));
    setSuccessMsg(
      `Escalação preenchida (${
        strategy === 'overall'
          ? 'Melhores'
          : strategy === 'stamina'
          ? 'Descansados'
          : strategy === 'balanced'
          ? 'Equilibrado'
          : strategy === 'assistant'
          ? 'Comissão Técnica (Fôlego >80% & Fase)'
          : 'Por Estilo'
      }).`
    );
    setTimeout(() => setSuccessMsg(null), 2500);
  }

  async function handleAutoAssignRoles() {
    if (!club) return;
    const starterIds = selections.filter((id): id is string => !!id);
    if (starterIds.length === 0) {
      setError('Escale titulares antes de atribuir os papéis.');
      return;
    }
    const assignments = autoAssignSquadRoles(starterIds, club.players);
    let updatedClub = club;
    for (const [playerId, roles] of Object.entries(assignments)) {
      try {
        updatedClub = await setPlayerFunctions(club.id, playerId, roles as PlayerFunction[]);
      } catch {
        // continue
      }
    }
    setClub(updatedClub);
    setSuccessMsg('Auxiliar Técnico: papéis ideais atribuídos com sucesso aos titulares!');
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  function handleSlotSwap(fromIndex: number, toIndex: number) {
    setSelections((prev) => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
    // Two players trading places trade their spots on the grass as well, or a swap would teleport one
    // of them back to the formation's default while the other kept a hand-placed spot.
    setSlotPoints((prev) => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
  }

  /** The manager parked a shirt somewhere by hand. The point sticks, and it is what the simulation
   *  reads as this player's position (see `effectiveSlotPositions` in shared). */
  function handleSlotMove(slotIndex: number, x: number, y: number) {
    setSlotPoints((prev) => {
      const next = [...prev];
      next[slotIndex] = { x, y };
      return next;
    });
  }

  function handleResetPlacement() {
    setSlotPoints(Array.from({ length: 11 }, () => null));
  }

  async function handleAssignRole(playerId: string, role: PlayerRole) {
    if (!club) return;
    try {
      setClub(await setPlayerRole(club.id, playerId, role, true));
      setSuccessMsg('Função atribuída com sucesso!');
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function applyPreset(presetId: string) {
    setSelectedPresetId(presetId);
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    setFormation(preset.formation);
    setMentality(preset.mentality);
    setAttackStyle(preset.attackStyle);
    setMarkingStyle(preset.markingStyle);
    setAttackApproach(preset.attackApproach);
    setPressing(preset.pressing ?? 'MEDIUM');
    setDefensiveLine(preset.defensiveLine ?? defensiveLineOf(preset));
    setSelections(preset.lineup.map((slot) => slot.playerId));
    setSlotPoints(pointsFromLineup(preset.lineup));
    setSubstituteIds(preset.substitutes.map((slot) => slot.playerId));
    setSuccessMsg(`Plano "${preset.name}" carregado.`);
    setTimeout(() => setSuccessMsg(null), 2000);
  }

  function buildTactic(): Tactic | null {
    if (!club) return null;
    if (selections.some((id) => !id)) {
      setError('Escale um jogador em todas as 11 posições do campo antes de salvar.');
      return null;
    }
    return {
      clubId: club.id,
      formation,
      mentality,
      attackStyle,
      markingStyle,
      attackApproach,
      pressing,
      defensiveLine,
      lineup: selections.map((playerId, i) => {
        const point = slotPoints[i];
        // The flank follows the shirt: a winger dragged to the other touchline is on that flank now,
        // preferred-foot bonus and all.
        const x = point?.x ?? getFormationSlots(formation)[i].x;
        return {
          playerId: playerId as string,
          side: sideFromX(x),
          ...(point ? { x: point.x, y: point.y } : {}),
        };
      }),
      substitutes: substituteIds.map((playerId) => ({ playerId })),
      plannedSubstitutions: [],
    };
  }

  async function handleGoDirectlyToLiveMatch() {
    if (!club) return;
    setError(null);

    const starterCount = selections.filter(Boolean).length;
    if (starterCount < 11) {
      setUnscaledAlert(true);
      return;
    }

    setBusyMatch(true);
    try {
      const tactic = buildTactic();
      if (!tactic) return;

      await setRoundTactic(club.id, tactic);
      const preset = await saveTacticPreset(club.id, 'Padrão (' + formation + ')', tactic);
      await setDefaultTacticPreset(club.id, preset.id);

      const matchId = await goToMatchday(club.id);
      if (matchId) {
        navigate(`/match/${matchId}/live`);
        return;
      }
      navigate(`/clubs/${club.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyMatch(false);
    }
  }

  async function handleQuickAutoFillAndPlay() {
    if (!club) return;
    setBusyMatch(true);
    setUnscaledAlert(false);
    try {
      const tacticData = autoFillLineup(club);
      setFormation(tacticData.formation);
      setSelections(tacticData.lineup.map((s) => s.playerId));
      setSubstituteIds(tacticData.substitutes.map((s) => s.playerId));

      await setRoundTactic(club.id, tacticData);
      const preset = await saveTacticPreset(club.id, 'Padrão (4-4-2)', tacticData);
      await setDefaultTacticPreset(club.id, preset.id);

      const matchId = await goToMatchday(club.id);
      if (matchId) {
        navigate(`/match/${matchId}/live`);
        return;
      }
      navigate(`/clubs/${club.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyMatch(false);
    }
  }

  async function handleSavePreset() {
    if (!club) return;
    setError(null);
    const tactic = buildTactic();
    if (!tactic) return;
    if (!newPresetName.trim()) {
      setError('Dê um nome ao plano antes de salvar.');
      return;
    }

    try {
      const preset = await saveTacticPreset(club.id, newPresetName.trim(), tactic);
      setPresets((prev) => [preset, ...prev]);
      setNewPresetName('');
      setSavePresetModalOpen(false);
      setSuccessMsg(`Plano "${preset.name}" salvo com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSetRoundTactic() {
    if (!club) return;
    setError(null);
    const tactic = buildTactic();
    if (!tactic) return;
    try {
      setClub(await setRoundTactic(club.id, tactic));
      setSuccessMsg('Tática e escalação salvas com sucesso!');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <div className="page">Carregando...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  const starterIds = selections.filter((id): id is string => !!id);
  const starterPlayers = starterIds.map((id) => club.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const averageOverall =
    starterPlayers.length > 0
      ? Math.round(starterPlayers.reduce((acc, p) => acc + p.overall, 0) / starterPlayers.length)
      : 0;

  const averageFatigue =
    starterPlayers.length > 0
      ? Math.round(starterPlayers.reduce((acc, p) => acc + (100 - (p.fatigue ?? 0)), 0) / starterPlayers.length)
      : 100;

  const nonStarters = club.players.filter((p) => !starterIds.includes(p.id));
  const benchPlayers = nonStarters.filter((p) => substituteIds.includes(p.id) && isPlayerAvailable(p));

  const filteredUnlisted = nonStarters
    .filter((p) => !substituteIds.includes(p.id))
    .filter((p) => {
      if (positionFilter === 'ALL') return true;
      if (positionFilter === 'GK') return p.position === 'GK';
      if (positionFilter === 'DEF') return ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position);
      if (positionFilter === 'MID') return ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(p.position);
      if (positionFilter === 'ATT') return ['ST', 'CF', 'LW', 'RW'].includes(p.position);
      return true;
    });

  return (
    <div className="page">
      {/*
        A única tela de Minha equipe sem a barra de irmãos, de propósito: esta aqui é construída para caber
        sem rolagem, e já carrega a barra segmentada do celular mais a toolbar de formação. Uma terceira
        barra empurraria o campo para fora da tela, que é o oposto do que a prancheta existe para fazer.
        A seta de voltar leva ao hub, e de lá se chega a qualquer irmã.
      */}
      <ClubNav club={club} active="tactics" backTo={`/clubs/${club.id}`} />
      <HubSubnav hub="team" clubId={club.id} active="tactics" />

      {error && <div className="options-feedback-alert error" style={{ marginBottom: 10 }}>{error}</div>}
      {successMsg && <div className="options-feedback-alert" style={{ marginBottom: 10 }}>{successMsg}</div>}

      <div className="tactics-zero-scroll-container">
        {/* MOBILE SEGMENTED VIEW SWITCHER */}
        <div className="tactics-mobile-segmented-bar">
          <button
            type="button"
            className={`tactics-mobile-tab-btn ${mobileTab === 'pitch' ? 'active' : ''}`}
            onClick={() => setMobileTab('pitch')}
          >
            Campo & Formação
          </button>
          <button
            type="button"
            className={`tactics-mobile-tab-btn ${mobileTab === 'bench' ? 'active' : ''}`}
            onClick={() => setMobileTab('bench')}
          >
            Reservas ({benchPlayers.length}/7)
          </button>
          <button
            type="button"
            className={`tactics-mobile-tab-btn ${mobileTab === 'strategy' ? 'active' : ''}`}
            onClick={() => setMobileTab('strategy')}
          >
            Estratégia
          </button>
        </div>

        {/* TOP TOOLBAR: Formations, Autofill, Roles, Presets */}
        <div className={`tactics-top-toolbar ${mobileTab === 'bench' ? 'mobile-hidden' : ''}`}>
          {/* Formations (Shown in pitch mode on mobile) */}
          <div className={`tactics-toolbar-group ${mobileTab === 'strategy' ? 'mobile-hidden' : ''}`}>
            <span className="tactics-toolbar-label">Formação:</span>
            {FORMATIONS.map((f) => (
              <button
                key={f}
                type="button"
                className={`tactics-btn-pill ${formation === f ? 'active' : ''}`}
                onClick={() => handleFormationChange(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Autofill Strategies */}
          <div className={`tactics-toolbar-group ${mobileTab === 'strategy' ? 'mobile-hidden' : ''}`}>
            <button
              type="button"
              className="tactics-btn-pill active"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#fff', fontWeight: 700 }}
              onClick={() => handleAutoFill('assistant')}
              title="Escalação Rápida da Comissão: melhores 11 com fôlego >80% e bom momento"
            >
              Escalação Automática (Auxiliar)
            </button>
            <button type="button" className="tactics-btn-pill" onClick={() => handleAutoFill('overall')} title="Escalar melhores titulares">
              Melhores
            </button>
            <button type="button" className="tactics-btn-pill" onClick={() => handleAutoFill('stamina')} title="Escalar jogadores mais descansados">
              Fôlego
            </button>
            <button type="button" className="tactics-btn-pill" onClick={() => handleAutoFill('balanced')} title="Equilibrar força e ritmo">
              Equilibrado
            </button>
          </div>

          {/* Roles Modal Trigger & Presets */}
          <div className="tactics-toolbar-group" style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              className="tactics-btn-pill special"
              onClick={() => setRolesModalOpen(true)}
              title="Definir capitão e cobradores oficiais"
            >
              Cobradores e Capitão
            </button>

            {!isBrasfoot && (
              <button
                type="button"
                className="tactics-btn-pill special"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#fff', fontWeight: 600 }}
                onClick={handleAutoAssignRoles}
                title="Auxiliar Técnico analisa o elenco e atribui automaticamente os melhores papéis táticos para todos os titulares"
              >
                Papéis Ideais (Auxiliar)
              </button>
            )}

            <select
              value={selectedPresetId}
              onChange={(e) => applyPreset(e.target.value)}
              className="tactics-btn-pill"
              style={{ padding: '5px 8px', fontSize: '0.78rem' }}
            >
              <option value="">Planos Táticos...</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isDefault ? '(Padrão)' : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="tactics-btn-pill"
              onClick={() => setSavePresetModalOpen(true)}
              title="Salvar formação atual como novo plano"
            >
              Salvar Plano
            </button>
          </div>
        </div>

        {/* MAIN ZERO-SCROLL GRID: 2 COLUMNS */}
        <div className="tactics-zero-scroll-grid">
          {/* LEFT: PITCH & STRATEGY SEGMENTS */}
          <div className={`tactics-pitch-column-pro ${mobileTab === 'bench' ? 'mobile-hidden' : ''}`}>
            <div className={`tactics-pitch-box ${mobileTab === 'strategy' ? 'mobile-hidden' : ''}`}>
              {(() => {
                const rolesByPlayerId: Record<string, PlayerRole[]> = {};
                for (const player of club.players) {
                  const roles = playerRoles(club, player.id);
                  if (roles.length > 0) rolesByPlayerId[player.id] = roles;
                }
                const isArcadeMode = (club?.staffDelegationConfig?.presetMode ?? 'brasfoot_casual') === 'brasfoot_casual' || isBrasfoot;
                return (
                  <PitchField
                    kitColor={clubColor}
                    kitPattern={club.kitPattern}
                    primaryColor={club.primaryColor}
                    secondaryColor={club.secondaryColor}
                    clubSlug={club.slug}
                    formation={formation}
                    squad={club.players}
                    selections={selections}
                    slotPoints={slotPoints}
                    rolesByPlayerId={rolesByPlayerId}
                    defensiveLine={defensiveLine}
                    attackStyle={attackStyle}
                    pressing={pressing}
                    tacticalViewMode={isArcadeMode ? 'SIMPLE' : 'TACTICAL'}
                    onSelect={handleSlotSelect}
                    onSwap={handleSlotSwap}
                    onMove={handleSlotMove}
                  />
                );
              })()}
            </div>

            {/* Segmented Tactical Strategy Controls */}
            <div className={`tactics-segmented-deck ${mobileTab !== 'strategy' ? 'mobile-hidden' : ''}`}>
              {/* Mentalidade */}
              <div className="segmented-control-block">
                <span className="segmented-control-label">Mentalidade</span>
                <div className="segmented-button-row">
                  <button
                    type="button"
                    className={`segmented-btn ${mentality === 'defensive' ? 'active' : ''}`}
                    onClick={() => setMentality('defensive')}
                  >
                    Defensiva
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${mentality === 'balanced' ? 'active' : ''}`}
                    onClick={() => setMentality('balanced')}
                  >
                    Equilíbrio
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${mentality === 'attacking' ? 'active' : ''}`}
                    onClick={() => setMentality('attacking')}
                  >
                    Ofensiva
                  </button>
                </div>
              </div>

              {!isBrasfoot && (
                <>
                  {/* Ataque */}
                  <div className="segmented-control-block">
                    <span className="segmented-control-label">Estilo de Ataque</span>
                    <div className="segmented-button-row">
                      <button
                        type="button"
                        className={`segmented-btn ${attackStyle === 'WINGS' ? 'active' : ''}`}
                        onClick={() => setAttackStyle('WINGS')}
                      >
                        Pontas
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${attackStyle === 'BALANCED' ? 'active' : ''}`}
                        onClick={() => setAttackStyle('BALANCED')}
                      >
                        Misto
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${attackStyle === 'THROUGH_MIDDLE' ? 'active' : ''}`}
                        onClick={() => setAttackStyle('THROUGH_MIDDLE')}
                      >
                        Meio
                      </button>
                    </div>
                  </div>

                  {/* Marcação */}
                  <div className="segmented-control-block">
                    <span className="segmented-control-label">Marcação</span>
                    <div className="segmented-button-row">
                      <button
                        type="button"
                        className={`segmented-btn ${markingStyle === 'LIGHT' ? 'active' : ''}`}
                        onClick={() => setMarkingStyle('LIGHT')}
                      >
                        Leve
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${markingStyle === 'BALANCED' ? 'active' : ''}`}
                        onClick={() => setMarkingStyle('BALANCED')}
                      >
                        Média
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${markingStyle === 'HEAVY' ? 'active' : ''}`}
                        onClick={() => setMarkingStyle('HEAVY')}
                      >
                        Pesada
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${markingStyle === 'MAN_MARKING' ? 'active' : ''}`}
                        onClick={() => setMarkingStyle('MAN_MARKING')}
                      >
                        Individual
                      </button>
                    </div>
                  </div>

                  {/* Pressão */}
                  <div className="segmented-control-block">
                    <span className="segmented-control-label">Pressão</span>
                    <div className="segmented-button-row">
                      <button
                        type="button"
                        className={`segmented-btn ${pressing === 'LOW_BLOCK' ? 'active' : ''}`}
                        onClick={() => {
                          setPressing('LOW_BLOCK');
                          setDefensiveLine('DEEP');
                        }}
                      >
                        Baixo
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${pressing === 'MEDIUM' ? 'active' : ''}`}
                        onClick={() => {
                          setPressing('MEDIUM');
                          setDefensiveLine('BALANCED');
                        }}
                      >
                        Média
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${pressing === 'HIGH_PRESS' ? 'active' : ''}`}
                        onClick={() => {
                          setPressing('HIGH_PRESS');
                          setDefensiveLine('HIGH');
                        }}
                      >
                        Alta
                      </button>
                    </div>
                  </div>

                  {/* Linha Defensiva */}
                  <div className="segmented-control-block">
                    <span className="segmented-control-label">Linha Defensiva</span>
                    <div className="segmented-button-row">
                      <button
                        type="button"
                        className={`segmented-btn ${defensiveLine === 'DEEP' ? 'active' : ''}`}
                        onClick={() => setDefensiveLine('DEEP')}
                      >
                        Baixa
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${defensiveLine === 'BALANCED' ? 'active' : ''}`}
                        onClick={() => setDefensiveLine('BALANCED')}
                      >
                        Média
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${defensiveLine === 'HIGH' ? 'active' : ''}`}
                        onClick={() => setDefensiveLine('HIGH')}
                      >
                        Alta
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Dynamic Sector Chemistry Breakdown */}
            {!isBrasfoot && (
              <div className={mobileTab !== 'strategy' ? 'mobile-hidden' : ''}>
                {(() => {
                  const currentTactic: Tactic = {
                    clubId: club.id,
                    formation,
                    mentality,
                    attackStyle,
                    markingStyle,
                    attackApproach,
                    pressing,
                    defensiveLine,
                    lineup: selections.filter((id): id is string => id !== null).map((id) => ({ playerId: id })),
                    substitutes: substituteIds.map((id) => ({ playerId: id })),
                    plannedSubstitutions: [],
                  };
                  const chemistry = analyzeSquadChemistry(club, currentTactic);
                  return <SectorChemistryPanel chemistry={chemistry} />;
                })()}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: SUBSTITUTES & SQUAD */}
          <div className={`tactics-side-column-pro ${mobileTab !== 'bench' ? 'mobile-hidden' : ''}`}>
            {/*
              The fitness coach, above the bench, which is where the manager is looking when the answer to
              their warning is "then put somebody else on". It updates with every change to the eleven, and
              it is the same warning the game puts on the coach's record the moment this lineup is saved
              (see recordFitnessWarnings) — so the opinion is read before they are held to the outcome.

              Not at the foot of the page: the tactics screen has a fixed bottom dock, which covers anything
              placed there.
            */}
            <StaffRemarks remarks={lineupRemarks(club, starterIds)} title="Departamento físico" />

            {/* Banco de Reservas (7 slots) */}
            <div className="tactics-bench-card-pro">
              <div className="tactics-bench-header">
                <div className="tactics-bench-title">
                  <span>Banco de Reservas</span>
                  <span className="badge-count">{benchPlayers.length}/7</span>
                </div>
                <button
                  type="button"
                  className="btn-quick-autofill"
                  onClick={() => handleAutoFill('overall')}
                  title="Escala automaticamente os melhores jogadores disponíveis"
                >
                  Auto-Completar
                </button>
              </div>

              {benchPlayers.length === 0 && (
                <p className="muted" style={{ margin: 0, fontSize: '0.76rem', padding: '6px 0' }}>
                  Nenhum reserva selecionado. Clique nos jogadores do elenco abaixo para colocá-los no banco.
                </p>
              )}
              <div
                className="tactics-bench-slots-grid"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const playerId = e.dataTransfer.getData(DND_PLAYER_ID);
                  const sourceSlotRaw = e.dataTransfer.getData(DND_SOURCE_SLOT);
                  if (playerId && sourceSlotRaw) {
                    const fromIndex = Number(sourceSlotRaw);
                    setSelections((prev) => {
                      const next = [...prev];
                      next[fromIndex] = null;
                      return next;
                    });
                    setSlotPoints((prev) => {
                      const next = [...prev];
                      next[fromIndex] = null;
                      return next;
                    });
                    setSubstituteIds((prev) => Array.from(new Set([...prev, playerId])).slice(0, 7));
                    setSuccessMsg('Jogador movido para o banco de reservas.');
                    setTimeout(() => setSuccessMsg(null), 2000);
                  }
                }}
              >
                {benchPlayers.map((p) => (
                  <PlayerChip
                    kitColor={clubColor}
                    kitPattern={club.kitPattern}
                    primaryColor={club.primaryColor}
                    secondaryColor={club.secondaryColor}
                    clubSlug={club.slug}
                    key={p.id}
                    player={p}
                    active
                    draggable
                    onClick={() => toggleSubstitute(p.id)}
                  />
                ))}
              </div>
            </div>

            {/* Elenco Disponível com Abas de Posição */}
            <div className="tactics-squad-card-pro">
              <div className="tactics-squad-header">
                <span style={{ fontSize: '0.82rem', fontWeight: 900, textTransform: 'uppercase', color: '#fff' }}>
                  Elenco ({filteredUnlisted.length})
                </span>
                <div className="tactics-position-filters">
                  {(['ALL', 'GK', 'DEF', 'MID', 'ATT'] as PositionFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`tactics-pos-filter-btn ${positionFilter === f ? 'active' : ''}`}
                      onClick={() => setPositionFilter(f)}
                    >
                      {f === 'ALL' ? 'Todos' : f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="tactics-player-compact-list">
                {filteredUnlisted.map((p) => {
                  const available = isPlayerAvailable(p);
                  const stamina = Math.round(100 - (p.fatigue ?? 0));
                  return (
                    <div
                      key={p.id}
                      className={`tactics-player-compact-row ${!available ? 'unavailable' : ''}`}
                      onClick={available ? () => toggleSubstitute(p.id) : undefined}
                      title={available ? 'Clique para colocar no banco de reservas' : 'Indisponível (lesionado ou suspenso)'}
                    >
                      <span className="player-pos-badge">{positionLabel(p.position)}</span>
                      <span className="player-name-compact">{p.name}</span>
                      <span className="player-ovr-compact">{p.overall}</span>
                      <span className="player-stamina-dot" style={{ color: stamina > 80 ? '#34c759' : stamina > 60 ? '#ffcc00' : '#ff3b30' }}>
                        {stamina}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM COMMAND DOCK */}
      <div className="tactics-bottom-dock">
        <div className="tactics-dock-status">
          <div className="tactics-dock-badge">
            <span>Força Titular:</span>
            <span className="val">{averageOverall > 0 ? averageOverall : '--'}</span>
          </div>
          <div className={`tactics-dock-badge ${starterIds.length === 11 ? 'complete' : 'pending'}`}>
            {starterIds.length === 11 ? (
              <>
                <CheckIcon size={14} color="#34c759" style={{ marginRight: 4 }} />
                11/11 Escalados
              </>
            ) : (
              <>
                <AlertTriangleIcon size={14} color="#f59e0b" style={{ marginRight: 4 }} />
                {starterIds.length}/11 Escalados
              </>
            )}
          </div>
          <div className="tactics-dock-badge" style={{ color: '#d4af37' }}>
            <span>Fôlego Médio:</span>
            <span className="val">{averageFatigue}%</span>
          </div>
        </div>

        <div className="tactics-dock-actions">
          <button type="button" className="btn-dock-save" onClick={handleSetRoundTactic}>
            Salvar Tática
          </button>
          <button
            type="button"
            className="btn-dock-hero-play"
            onClick={handleGoDirectlyToLiveMatch}
            disabled={busyMatch}
          >
            <SoccerBallIcon size={18} color="#fff" style={{ marginRight: 6 }} />
            <span>{busyMatch ? 'Carregando...' : 'IR PARA A PARTIDA (AO VIVO)'}</span>
          </button>
        </div>
      </div>

      {/* SPECIAL ROLES MODAL (Capitão, Batedores) */}
      {rolesModalOpen && (
        <div className="options-modal-backdrop" onClick={() => setRolesModalOpen(false)}>
          <div className="options-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="options-modal-header">
              <div className="options-modal-title">
                <h2>Capitão e Cobradores Oficiais</h2>
              </div>
              <button type="button" className="options-modal-close" onClick={() => setRolesModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="options-modal-body">
              <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                Defina os líderes e especialistas em bolas paradas para a sua equipe:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)' }}>Capitão</label>
                  <select
                    value={club.captainPlayerId ?? ''}
                    onChange={(e) => e.target.value && handleAssignRole(e.target.value, 'CAPTAIN')}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Escolha...</option>
                    {starterPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({positionLabel(p.position)} · {p.overall})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)' }}>Pênaltis</label>
                  <select
                    value={club.penaltyTakerId ?? ''}
                    onChange={(e) => e.target.value && handleAssignRole(e.target.value, 'PENALTY_TAKER')}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Escolha...</option>
                    {starterPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({positionLabel(p.position)} · {p.overall})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)' }}>Faltas</label>
                  <select
                    value={club.freeKickTakerId ?? ''}
                    onChange={(e) => e.target.value && handleAssignRole(e.target.value, 'FREE_KICK_TAKER')}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Escolha...</option>
                    {starterPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({positionLabel(p.position)} · {p.overall})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)' }}>Escanteios</label>
                  <select
                    value={club.cornerLeftTakerId ?? ''}
                    onChange={(e) => e.target.value && handleAssignRole(e.target.value, 'CORNER_LEFT_TAKER')}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">Escolha...</option>
                    {starterPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({positionLabel(p.position)} · {p.overall})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="btn-options-action save"
                onClick={() => setRolesModalOpen(false)}
                style={{ width: '100%', marginTop: 16, padding: '10px' }}
              >
                Concluir Atribuições
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE NEW PRESET MODAL */}
      {savePresetModalOpen && (
        <div className="options-modal-backdrop" onClick={() => setSavePresetModalOpen(false)}>
          <div className="options-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="options-modal-header">
              <div className="options-modal-title">
                <h2>Salvar Plano Tático</h2>
              </div>
              <button type="button" className="options-modal-close" onClick={() => setSavePresetModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="options-modal-body">
              <input
                placeholder="Ex: Tática Ofensiva Clássicos"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '0.9rem', marginBottom: 14 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn-options-action info"
                  onClick={() => setSavePresetModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-options-action save"
                  onClick={handleSavePreset}
                  style={{ flex: 1.5 }}
                >
                  Salvar Plano
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNSCALED ALERT MODAL */}
      {unscaledAlert && (
        <div className="options-modal-backdrop" onClick={() => setUnscaledAlert(false)}>
          <div className="options-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="options-modal-header">
              <div className="options-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangleIcon size={24} color="#f59e0b" />
                <h2>Seu time não está escalado!</h2>
              </div>
              <button type="button" className="options-modal-close" onClick={() => setUnscaledAlert(false)}>
                ✕
              </button>
            </div>
            <div className="options-modal-body">
              <p style={{ color: '#f5c542', fontWeight: 600, fontSize: '0.92rem', margin: '4px 0 12px' }}>
                Para ir para a partida ao vivo, você precisa definir os 11 titulares da sua equipe. Você pode preencher os melhores jogadores com 1 clique abaixo ou arrastar os jogadores para cada posição.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  type="button"
                  className="btn-options-action save"
                  style={{ padding: '14px 20px', fontSize: '0.92rem', fontWeight: 800, textAlign: 'center' }}
                  onClick={handleQuickAutoFillAndPlay}
                  disabled={busyMatch}
                >
                  Escalar Automaticamente (Melhores) e Jogar Agora
                </button>
                <button
                  type="button"
                  className="btn-options-action info"
                  style={{ padding: '12px 20px', textAlign: 'center' }}
                  onClick={() => setUnscaledAlert(false)}
                >
                  Continuar Escalando Manualmente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

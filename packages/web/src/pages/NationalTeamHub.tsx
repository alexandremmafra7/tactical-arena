import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { NationalSquadEntry, NationalTeamConfig, Position } from '@tactical-arena/shared';
import { calculateFifaReleaseCompensation } from '@tactical-arena/shared';
import { getNationalTeam, saveNationalSquad, getDetailedGameState, resignNationalTeam } from '../api/client.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { GlobeIcon } from '../components/icons/AppIcons.js';

export function NationalTeamHubPage() {
  const { teamCode } = useParams<{ teamCode: string }>();
  const navigate = useNavigate();
  const [teamData, setTeamData] = useState<{ config: NationalTeamConfig; squad: NationalSquadEntry[] } | null>(null);
  const [allEligiblePlayers, setAllEligiblePlayers] = useState<Array<{ id: string; name: string; position: Position; overall: number; wage?: number; clubName?: string }>>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'squad' | 'tactics' | 'matches'>('squad');
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showResignModal, setShowResignModal] = useState(false);

  useEffect(() => {
    if (!teamCode) return;
    let cancelled = false;
    (async () => {
      try {
        const [natData, gameState] = await Promise.all([
          getNationalTeam(teamCode),
          getDetailedGameState(),
        ]);
        if (cancelled) return;
        setTeamData(natData);
        if (natData?.squad) {
          setSelectedPlayerIds(natData.squad.map((s: NationalSquadEntry) => s.playerId));
        }

        // Obter todos os jogadores do mundo
        const players = (gameState?.clubs ?? []).flatMap((c: any) =>
          (c.players ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
            position: p.position as Position,
            overall: p.overall,
            wage: p.wage ?? 25000,
            clubName: c.name,
          }))
        );
        setAllEligiblePlayers(players);
      } catch (err) {
        console.error('Erro ao carregar seleção nacional', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamCode]);

  const handleTogglePlayer = (id: string) => {
    if (selectedPlayerIds.includes(id)) {
      setSelectedPlayerIds(selectedPlayerIds.filter((pId) => pId !== id));
    } else {
      if (selectedPlayerIds.length >= 26) {
        alert('O limite máximo de convocação padrão FIFA é de 26 atletas.');
        return;
      }
      setSelectedPlayerIds([...selectedPlayerIds, id]);
    }
  };

  const handleAutoSelect = () => {
    const sorted = [...allEligiblePlayers].sort((a, b) => b.overall - a.overall);
    const gks = sorted.filter((p) => p.position === 'GK').slice(0, 3);
    const defs = sorted.filter((p) => p.position === 'DEF').slice(0, 5);
    const lats = sorted.filter((p) => p.position === 'LAT').slice(0, 4);
    const mids = sorted.filter((p) => p.position === 'MID').slice(0, 7);
    const atts = sorted.filter((p) => p.position === 'ATT').slice(0, 7);
    const autoIds = [...gks, ...defs, ...lats, ...mids, ...atts].map((p) => p.id);
    setSelectedPlayerIds(autoIds.slice(0, 26));
    setSuccessMsg('Convocação automática FIFA de 26 atletas realizada com sucesso!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveSquad = async () => {
    if (!teamCode) return;
    setSaving(true);
    try {
      await saveNationalSquad(teamCode, selectedPlayerIds);
      setSuccessMsg('Convocação salva com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      alert('Erro ao salvar convocação: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmResign = async () => {
    setShowResignModal(false);
    await resignNationalTeam();
    navigate('/hub');
  };

  if (loading) return <div className="page">Carregando Hub da Seleção...</div>;
  if (!teamData) return <div className="page error">Seleção não encontrada.</div>;

  const filteredPlayers = allEligiblePlayers.filter((p) => {
    if (positionFilter !== 'ALL' && p.position !== positionFilter) return false;
    if (searchQuery.trim() && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="page">
      {/* Header Estilizado Seleção */}
      <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-blue-900/40 via-slate-900 to-slate-900 border border-blue-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-blue-600/20 border border-blue-500/50 flex items-center justify-center shadow-inner">
            <GlobeIcon size={32} color="#38bdf8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold uppercase tracking-wider">
                Seleção Nacional • {teamData.config.confederation}
              </span>
              <span className="text-xs text-amber-400 font-semibold">Ranking FIFA: #{teamData.config.fifaRanking}</span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1">{teamData.config.name}</h1>
            <p className="text-xs text-slate-400">Gestão técnica internacional • Convocação de 26 atletas (Padrão FIFA) • Proteção e Benefícios</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResignModal(true)}
            className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition"
          >
            Renunciar Cargo
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('squad')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'squad'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-800/60 text-slate-400 hover:text-white'
          }`}
        >
          Convocação ({selectedPlayerIds.length}/26)
        </button>
        <button
          onClick={() => setActiveTab('tactics')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'tactics'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-800/60 text-slate-400 hover:text-white'
          }`}
        >
          Tática &amp; Titulares
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'matches'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-800/60 text-slate-400 hover:text-white'
          }`}
        >
          Jogos &amp; Datas FIFA
        </button>
      </div>

      {activeTab === 'squad' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Buscar atleta por nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-blue-500 w-full sm:w-64"
              />
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value as any)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-blue-500"
              >
                <option value="ALL">Todas Posições</option>
                <option value="GK">GK (Goleiro - 3)</option>
                <option value="DEF">DEF (Zagueiro - 5)</option>
                <option value="LAT">LAT (Lateral - 4)</option>
                <option value="MID">MID (Meia - 7)</option>
                <option value="ATT">ATT (Atacante - 7)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleAutoSelect}
                className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition"
              >
                Convocação Automática FIFA (26)
              </button>
              <button
                onClick={handleSaveSquad}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar Convocação'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPlayers.map((player) => {
              const isConvocated = selectedPlayerIds.includes(player.id);
              const dailyComp = calculateFifaReleaseCompensation(player as any, 1);
              return (
                <div
                  key={player.id}
                  onClick={() => handleTogglePlayer(player.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isConvocated
                      ? 'bg-blue-600/10 border-blue-500/50 shadow-md'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isConvocated
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {player.position}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                        {player.name}
                        {isConvocated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold inline-flex items-center gap-1" title="Convocado FIFA / Proteção Ativa">
                            <GlobeIcon size={10} color="#93c5fd" /> FIFA
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {player.clubName || 'Clube não informado'} • <span className="text-emerald-400 font-semibold">R$ {dailyComp.toLocaleString('pt-BR')}/dia FIFA</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 font-black text-xs text-amber-400 border border-slate-700">
                      {player.overall}
                    </span>
                    <input
                      type="checkbox"
                      checked={isConvocated}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'tactics' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-base text-white">Esquema Tático &amp; 11 Titulares (Padrão FIFA 26)</h3>
          <p className="text-xs text-slate-400">
            Os 11 primeiros atletas convocados na lista compõem a escalação titular padrão da seleção para as partidas internacionais.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamData.squad.slice(0, 11).map((entry: NationalSquadEntry, idx: number) => (
              <div key={entry.playerId} className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                    {idx + 1}
                  </span>
                  <div>
                    <h5 className="font-bold text-sm text-white">{entry.playerName}</h5>
                    <p className="text-[11px] text-slate-400">{entry.position} • {entry.clubName}</p>
                  </div>
                </div>
                <span className="font-black text-xs text-amber-400">{entry.overall}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-base text-white">Calendário de Partidas Internacionais (Datas FIFA)</h3>
          <p className="text-xs text-slate-400">
            As partidas de seleções ocorrem nas semanas oficiais de Data FIFA, enquanto o campeonato de clubes permanece em recesso, com repasses automáticos do Programa de Benefícios e Proteção aos Clubes da FIFA.
          </p>
        </div>
      )}
    </div>
  );
}

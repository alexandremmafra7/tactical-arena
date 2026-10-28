import React, { useState } from 'react';
import type { Club, ScoutProfile, GlobalScoutMission, ScoutPlayerReport } from '@tactical-arena/shared';
import { generateScoutReport } from '@tactical-arena/shared';
import { ClubNav } from '../components/ClubNav.js';
import { getClubThemeStyle } from '../lib/clubTheme.js';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export interface ScoutingNetworkPageProps {
  club: Club;
  onStartMission?: (mission: GlobalScoutMission) => void;
}

export function ScoutingNetworkPage({ club }: ScoutingNetworkPageProps) {
  const [scouts, setScouts] = useState<ScoutProfile[]>([
    { id: 's1', name: 'Carlos Alberto (Olheiro Chefe)', abilityRating: 88, potentialRating: 92, region: 'CONMEBOL' },
    { id: 's2', name: 'Hans Müller (Olheiro Europa)', abilityRating: 84, potentialRating: 85, region: 'UEFA_WEST' },
  ]);

  const [missions, setMissions] = useState<GlobalScoutMission[]>([
    {
      id: 'm1',
      scoutId: 's1',
      type: 'REGIONAL_HUNT',
      region: 'CONMEBOL',
      weeksRemaining: 2,
      totalWeeks: 4,
      status: 'ACTIVE',
      discoveredPlayerIds: [],
    },
  ]);

  const [reports, setReports] = useState<ScoutPlayerReport[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<'CONMEBOL' | 'UEFA_WEST' | 'UEFA_EAST' | 'AFRICA' | 'ASIA'>('CONMEBOL');
  const [missionType, setMissionType] = useState<'REGIONAL_HUNT' | 'POSITION_SEARCH'>('REGIONAL_HUNT');

  const handleCreateMission = (e: React.FormEvent) => {
    e.preventDefault();
    const availableScout = scouts.find((s) => !missions.some((m) => m.scoutId === s.id && m.status === 'ACTIVE'));
    if (!availableScout) {
      alert('Todos os olheiros já estão alocados em missões ativas!');
      return;
    }

    const newMission: GlobalScoutMission = {
      id: `mission-${Date.now()}`,
      scoutId: availableScout.id,
      type: missionType,
      region: selectedRegion,
      weeksRemaining: 4,
      totalWeeks: 4,
      status: 'ACTIVE',
      discoveredPlayerIds: [],
    };

    setMissions([newMission, ...missions]);
    setIsModalOpen(false);
  };

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case 'HIDDEN_GEM':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">Gema Oculta</span>;
      case 'RECOMMENDED_STAR':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">Titular Imediato</span>;
      case 'SQUAD_ROTATION':
        return <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold">Opção Sólida</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 text-xs font-semibold">Descartado</span>;
    }
  };

  return (
    <div className="page scouting-network-page" style={getClubThemeStyle(club)}>
      <ClubNav club={club} active="transfers" backTo={`/clubs/${club.id}/transfers`} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide">Rede Mundial de Olheiros & Garimpo</h1>
          <p className="text-sm text-slate-400">Gerencie missões internacionais, fure a névoa de guerra e descubra joias ocultas no mercado.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/40 transition"
        >
          + Nova Missão de Olheiro
        </button>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Olheiros e Missões Ativas */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              Equipe de Olheiros
            </h2>
            <div className="space-y-3">
              {scouts.map((scout) => {
                const activeMission = missions.find((m) => m.scoutId === scout.id && m.status === 'ACTIVE');
                return (
                  <div key={scout.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-sm">{scout.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {scout.region}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Avaliação: <strong className="text-emerald-400">{scout.abilityRating}</strong></span>
                      <span>Potencial: <strong className="text-emerald-400">{scout.potentialRating}</strong></span>
                    </div>
                    {activeMission ? (
                      <div className="mt-2 pt-2 border-t border-slate-700/40">
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                          <span>Missão: {activeMission.type}</span>
                          <span>{activeMission.weeksRemaining} sem. restantes</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${((activeMission.totalWeeks - activeMission.weeksRemaining) / activeMission.totalWeeks) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-400 italic">Disponível para nova missão</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Feed de Relatórios & Descobertas */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              Feed de Descobertas & Relatórios
            </h2>

            {reports.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl">
                <p className="text-slate-300 font-semibold mt-3">Nenhum relatório recente recebido.</p>
                <p className="text-xs text-slate-500 mt-1">Aloque seus olheiros em missões para garimpar novos talentos no exterior.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.playerId} className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">{report.playerName}</h3>
                        {getGradeBadge(report.grade)}
                      </div>
                      <p className="text-xs text-slate-400">
                        {report.position} • {report.age} anos • Valor Estimado: {formatMoney(report.estimatedMarketValue)}
                      </p>
                      <p className="text-xs text-emerald-300 italic mt-1">{report.summary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Overall Est.: <strong className="text-emerald-400">{report.overallEstimate.min}~{report.overallEstimate.max}</strong></p>
                      <p className="text-xs text-slate-400">Potencial Est.: <strong className="text-emerald-400">{report.potentialEstimate.min}~{report.potentialEstimate.max}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nova Missão */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-6 space-y-5">
            <h3 className="text-xl font-bold text-white">Nova Missão de Olheiro</h3>
            <form onSubmit={handleCreateMission} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Região Alvo</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="CONMEBOL">CONMEBOL (América do Sul)</option>
                  <option value="UEFA_WEST">UEFA Ocidental (Europa)</option>
                  <option value="UEFA_EAST">UEFA Oriental (Leste Europeu)</option>
                  <option value="AFRICA">África</option>
                  <option value="ASIA">Ásia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Tipo de Missão</label>
                <select
                  value={missionType}
                  onChange={(e) => setMissionType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="REGIONAL_HUNT">Garimpo de Promessas Sub-21 (4 semanas)</option>
                  <option value="POSITION_SEARCH">Busca de Atleta para Posição Carente (3 semanas)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Lançar Missão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

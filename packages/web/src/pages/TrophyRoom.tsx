import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getClubTrophyRoom, getClub } from '../api/client.js';
import type { TrophyRoomEntry, ClubRecordBook, HistoricalPlayerRankingEntry, TrophyTier } from '@tactical-arena/shared';
import { getTrophyVisualSpec } from '@tactical-arena/shared';
import {
  TrophyIcon,
  StarIcon,
  CrownIcon,
  FinanceIcon,
  ChecklistIcon,
  LightningIcon,
  FlameIcon,
} from '../components/icons/AppIcons.js';

export const TrophyRoom: React.FC = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const [loading, setLoading] = useState(true);
  const [clubName, setClubName] = useState<string>('Clube');
  const [trophies, setTrophies] = useState<TrophyRoomEntry[]>([]);
  const [recordBook, setRecordBook] = useState<ClubRecordBook | null>(null);
  const [titlesCount, setTitlesCount] = useState<number>(0);
  const [filterTier, setFilterTier] = useState<string>('ALL');
  const [hallTab, setHallTab] = useState<'GOALS' | 'ASSISTS' | 'MATCHES'>('GOALS');

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    Promise.all([
      getClubTrophyRoom(clubId).catch(() => null),
      getClub(clubId).catch(() => null),
    ]).then(([trophyData, clubData]) => {
      if (trophyData) {
        setTrophies(trophyData.trophies || []);
        setRecordBook(trophyData.recordBook || null);
        setTitlesCount(trophyData.titlesWon || (trophyData.trophies ? trophyData.trophies.length : 0));
        if (trophyData.clubName) setClubName(trophyData.clubName);
      }
      if (clubData && clubData.name) {
        setClubName(clubData.name);
      }
      setLoading(false);
    });
  }, [clubId]);

  const filteredTrophies = trophies.filter((t) => {
    if (filterTier === 'ALL') return true;
    const spec = getTrophyVisualSpec(t.competitionType);
    return spec.tier === filterTier;
  });

  const getHallData = (): { title: string; unit: string; list: HistoricalPlayerRankingEntry[] } => {
    if (!recordBook) return { title: 'Gols', unit: 'gols', list: [] };
    switch (hallTab) {
      case 'GOALS':
        return { title: 'Maiores Artilheiros', unit: 'gols', list: recordBook.topScorers || [] };
      case 'ASSISTS':
        return { title: 'Líderes em Assistências', unit: 'assistências', list: recordBook.topAssisters || [] };
      case 'MATCHES':
        return { title: 'Mais Partidas Disputadas', unit: 'jogos', list: recordBook.mostAppearances || [] };
    }
  };

  const hallInfo = getHallData();

  if (loading) {
    return (
      <div className="trophy-room-container flex items-center justify-center min-h-[400px]">
        <div className="text-center text-slate-400">
          <div className="inline-block animate-spin text-4xl mb-3">
            <TrophyIcon size={40} color="#f59e0b" />
          </div>
          <p>Carregando a Sala de Troféus e Hall da Fama...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="trophy-room-container max-w-6xl mx-auto p-4 md:p-6 space-y-8 animate-fade-in text-slate-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-3xl shadow-inner shadow-amber-500/20">
              <TrophyIcon size={32} color="#f59e0b" fill="rgba(245, 158, 11, 0.2)" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Link to={`/clubs/${clubId}`} className="text-xs text-amber-400/80 hover:text-amber-300 transition uppercase tracking-wider font-semibold">
                  ← Voltar ao Clube
                </Link>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <span>{clubName}</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase tracking-wider">
                  Sala de Troféus & Hall da Fama
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Galeria de glórias, recordes históricos e ídolos eternizados do clube
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/80 px-5 py-3 rounded-xl border border-slate-700/60 shadow-lg">
            <div className="text-right">
              <span className="block text-xs uppercase text-slate-400 font-semibold">Títulos Oficiais</span>
              <span className="text-2xl font-black text-amber-400">{titlesCount}</span>
            </div>
            <div className="text-2xl text-amber-400">
              <StarIcon size={24} color="#f59e0b" fill="#f59e0b" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 1. Prateleira de Troféus */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <TrophyIcon size={20} color="#f59e0b" />
            <h2 className="text-xl font-bold text-white tracking-wide">Prateleira de Troféus</h2>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-semibold">
              {filteredTrophies.length}
            </span>
          </div>

          {/* Tier Filter Pills */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(['ALL', 'MUNDIAL', 'CONTINENTAL', 'NACIONAL', 'REGIONAL'] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setFilterTier(tier)}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  filterTier === tier
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {tier === 'ALL' ? 'Todos' : tier === 'REGIONAL' ? 'Regionais / Estaduais' : tier.charAt(0) + tier.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {filteredTrophies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
            <div className="flex justify-center mb-2 opacity-50">
              <TrophyIcon size={40} color="#64748b" />
            </div>
            <h3 className="font-semibold text-slate-300">Nenhum troféu nesta categoria ainda</h3>
            <p className="text-xs mt-1 text-slate-500 max-w-md mx-auto">
              {filterTier === 'REGIONAL'
                ? 'Conquiste Campeonatos Estaduais (Paulistão, Carioca, etc.) ou Copas Regionais para preencher esta seção de títulos estaduais e regionais.'
                : 'Conquiste campeonatos nacionais, estaduais, copas ou torneios continentais para preencher a galeria de taças do clube.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTrophies.map((trophy) => {
              const spec = getTrophyVisualSpec(trophy.competitionType, trophy.competitionName);
              return (
                <div
                  key={trophy.id}
                  className="relative group overflow-hidden rounded-xl border p-4 transition duration-200 hover:-translate-y-1 hover:shadow-xl"
                  style={{
                    background: spec.bgGradient,
                    borderColor: `${spec.borderColor}66`,
                    boxShadow: `0 4px 20px -2px ${spec.badgeGlow}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-inner flex-shrink-0 overflow-hidden"
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: `1px solid ${spec.borderColor}88`,
                      }}
                    >
                      {spec.trophyAsset ? (
                        <img
                          src={`/trophies/${spec.trophyAsset}`}
                          alt={trophy.competitionName}
                          className="w-10 h-10 object-contain drop-shadow"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <TrophyIcon size={28} color={spec.borderColor} fill={`${spec.borderColor}33`} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            background: `${spec.borderColor}22`,
                            color: spec.borderColor,
                            border: `1px solid ${spec.borderColor}55`,
                          }}
                        >
                          {spec.tier}
                        </span>
                        <span className="text-xs font-bold text-amber-300">
                          {trophy.seasonYear}
                        </span>
                      </div>

                      <h3 className="font-bold text-base text-white mt-1 truncate">
                        {trophy.competitionName || spec.name}
                      </h3>

                      <div className="mt-2 text-xs text-slate-300 space-y-0.5">
                        {trophy.managerName && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span>Técnico:</span>
                            <span className="font-medium text-slate-200 truncate">{trophy.managerName}</span>
                          </div>
                        )}
                        {trophy.runnerUpClubName && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span>Vice:</span>
                            <span className="font-medium text-slate-200 truncate">{trophy.runnerUpClubName}</span>
                          </div>
                        )}
                        {trophy.topScorerPlayerName && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span>Artilheiro:</span>
                            <span className="font-medium text-amber-200 truncate">
                              {trophy.topScorerPlayerName} ({trophy.topScorerGoals || 0} gols)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Grid: 2. Hall da Fama (Quadro de Honra) & 3. Mural de Recordes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Hall da Fama (7 cols on large) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <StarIcon size={20} color="#f59e0b" fill="#f59e0b" />
              <h2 className="text-xl font-bold text-white tracking-wide">Hall da Fama</h2>
            </div>

            {/* Tab selector */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setHallTab('GOALS')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  hallTab === 'GOALS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Gols
              </button>
              <button
                onClick={() => setHallTab('ASSISTS')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  hallTab === 'ASSISTS' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Assistências
              </button>
              <button
                onClick={() => setHallTab('MATCHES')}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  hallTab === 'MATCHES' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Partidas
              </button>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>Top 3 Histórico:</span>
              <span className="text-amber-400">{hallInfo.title}</span>
            </h3>

            {hallInfo.list.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                <p>Nenhum registro consolidado no Hall da Fama ainda.</p>
                <p className="text-xs text-slate-600 mt-1">
                  Atletas com atuações de destaque ao longo das temporadas entrarão neste mural sagrado.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-2">
                {/* 2nd Place (Silver) */}
                {hallInfo.list[1] ? (
                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center order-2 sm:order-1 relative">
                    <div className="w-10 h-10 mx-auto -mt-7 rounded-full bg-slate-400 text-slate-950 font-black flex items-center justify-center shadow-lg border-2 border-slate-300 text-sm">
                      2º
                    </div>
                    <div className="mt-2 font-bold text-slate-200 truncate">{hallInfo.list[1].name}</div>
                    <div className="text-lg font-black text-slate-300 mt-0.5">
                      {hallInfo.list[1].total} <span className="text-xs font-normal text-slate-400">{hallInfo.unit}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Era: {hallInfo.list[1].era || 'Atual'}</div>
                  </div>
                ) : (
                  <div className="bg-slate-900/30 border border-dashed border-slate-800/50 rounded-xl p-4 text-center text-xs text-slate-600 order-2 sm:order-1">
                    2º Lugar Vago
                  </div>
                )}

                {/* 1st Place (Gold) */}
                {hallInfo.list[0] ? (
                  <div className="bg-gradient-to-b from-amber-500/20 to-slate-900 border-2 border-amber-500/60 rounded-xl p-5 text-center order-1 sm:order-2 shadow-xl shadow-amber-500/10 relative -mt-3">
                    <div className="w-12 h-12 mx-auto -mt-8 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center shadow-xl border-2 border-amber-300 text-sm gap-1">
                      <CrownIcon size={14} color="#000" fill="#000" /> 1º
                    </div>
                    <div className="mt-2 font-black text-white text-base truncate">{hallInfo.list[0].name}</div>
                    <div className="text-2xl font-black text-amber-400 mt-0.5">
                      {hallInfo.list[0].total} <span className="text-xs font-normal text-amber-200/80">{hallInfo.unit}</span>
                    </div>
                    <div className="text-[11px] text-amber-400/70 mt-1 font-semibold">Era: {hallInfo.list[0].era || 'Atual'}</div>
                  </div>
                ) : (
                  <div className="bg-slate-900/30 border border-dashed border-slate-800/50 rounded-xl p-5 text-center text-xs text-slate-600 order-1 sm:order-2">
                    1º Lugar Vago
                  </div>
                )}

                {/* 3rd Place (Bronze) */}
                {hallInfo.list[2] ? (
                  <div className="bg-slate-800/40 border border-amber-900/40 rounded-xl p-4 text-center order-3 relative">
                    <div className="w-10 h-10 mx-auto -mt-7 rounded-full bg-amber-700 text-amber-100 font-black flex items-center justify-center shadow-lg border-2 border-amber-600 text-sm">
                      3º
                    </div>
                    <div className="mt-2 font-bold text-slate-200 truncate">{hallInfo.list[2].name}</div>
                    <div className="text-lg font-black text-amber-500 mt-0.5">
                      {hallInfo.list[2].total} <span className="text-xs font-normal text-slate-400">{hallInfo.unit}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">Era: {hallInfo.list[2].era || 'Atual'}</div>
                  </div>
                ) : (
                  <div className="bg-slate-900/30 border border-dashed border-slate-800/50 rounded-xl p-4 text-center text-xs text-slate-600 order-3">
                    3º Lugar Vago
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Mural de Recordes do Clube (5 cols on large) */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ChecklistIcon size={20} color="#f59e0b" />
            <h2 className="text-xl font-bold text-white tracking-wide">Mural de Recordes</h2>
          </div>

          <div className="space-y-3">
            {/* Maior Venda */}
            <div className="bg-slate-900/70 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FinanceIcon size={20} color="#10b981" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">Maior Venda Histórica</div>
                  <div className="font-bold text-white text-sm">
                    {recordBook?.recordSale?.playerName || 'Nenhum registro'}
                  </div>
                  {recordBook?.recordSale && (
                    <div className="text-[11px] text-slate-400">
                      Para: <span className="text-slate-200">{recordBook.recordSale.clubName}</span> ({recordBook.recordSale.year})
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-emerald-400">
                  {recordBook?.recordSale ? `R$ ${(recordBook.recordSale.amount / 1_000_000).toFixed(1)}M` : '—'}
                </span>
              </div>
            </div>

            {/* Maior Compra */}
            <div className="bg-slate-900/70 border border-blue-500/20 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <StarIcon size={20} color="#38bdf8" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">Maior Compra Histórica</div>
                  <div className="font-bold text-white text-sm">
                    {recordBook?.recordPurchase?.playerName || 'Nenhum registro'}
                  </div>
                  {recordBook?.recordPurchase && (
                    <div className="text-[11px] text-slate-400">
                      De: <span className="text-slate-200">{recordBook.recordPurchase.clubName}</span> ({recordBook.recordPurchase.year})
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-blue-400">
                  {recordBook?.recordPurchase ? `R$ ${(recordBook.recordPurchase.amount / 1_000_000).toFixed(1)}M` : '—'}
                </span>
              </div>
            </div>

            {/* Maior Goleada */}
            <div className="bg-slate-900/70 border border-purple-500/20 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <LightningIcon size={20} color="#c084fc" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">Maior Goleada Aplicada</div>
                  <div className="font-bold text-white text-sm">
                    {recordBook?.biggestWin ? `${recordBook.biggestWin.score} vs ${recordBook.biggestWin.opponentName}` : 'Nenhum registro'}
                  </div>
                  {recordBook?.biggestWin && (
                    <div className="text-[11px] text-slate-400">Temporada: {recordBook.biggestWin.year}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-purple-400">
                  {recordBook?.biggestWin ? `+${recordBook.biggestWin.goalDiff} Gols` : '—'}
                </span>
              </div>
            </div>

            {/* Invencibilidade */}
            <div className="bg-slate-900/70 border border-amber-500/20 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FlameIcon size={20} color="#f59e0b" fill="rgba(245, 158, 11, 0.2)" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold">Sequência Invicta</div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Recorde Histórico:</span>
                    <span className="text-amber-400 font-black">{recordBook?.unbeatenStreakRecord || 0} jogos</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Sequência Atual: <span className="text-emerald-400 font-semibold">{recordBook?.currentUnbeatenStreak || 0} jogos invicto</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import type { ContinentalTournamentState, TournamentGroup } from '@tactical-arena/shared';
import { listContinentalTournaments, listScoutingDatabase, listMyClubs } from '../api/client.js';
import { ClubCrest } from './ClubCrest.js';
import { TrophyIcon } from './icons/AppIcons.js';

interface ContinentalHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ClubMeta {
  name: string;
  slug: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export const ContinentalHubModal: React.FC<ContinentalHubModalProps> = ({ isOpen, onClose }) => {
  const [tournaments, setTournaments] = useState<ContinentalTournamentState[]>([]);
  const [activeTournamentId, setActiveTournamentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'groups' | 'knockout'>('groups');
  const [clubInfo, setClubInfo] = useState<Record<string, ClubMeta>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [data, scoutingClubs, myClubs] = await Promise.all([
          listContinentalTournaments(),
          listScoutingDatabase().catch(() => []),
          listMyClubs().catch(() => []),
        ]);
        if (cancelled) return;
        setTournaments(data);
        if (data.length > 0 && !activeTournamentId) {
          setActiveTournamentId(data[0].id);
        }

        const map: Record<string, ClubMeta> = {};
        for (const c of scoutingClubs) {
          map[c.id] = {
            name: c.name,
            slug: c.slug,
            crestBase64: (c as any).crestBase64 ?? null,
            primaryColor: (c as any).primaryColor ?? null,
            secondaryColor: (c as any).secondaryColor ?? null,
          };
        }
        for (const mc of myClubs) {
          map[mc.id] = {
            name: mc.name,
            slug: mc.slug ?? null,
            crestBase64: mc.crestBase64 ?? null,
            primaryColor: mc.primaryColor ?? null,
            secondaryColor: mc.secondaryColor ?? null,
          };
        }
        setClubInfo(map);
      } catch (err) {
        console.error('Erro ao carregar torneios continentais', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTournament = tournaments.find((t) => t.id === activeTournamentId) || tournaments[0];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(5, 5, 10, 0.9)',
        backdropFilter: 'blur(8px)',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1000px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden',
          color: '#f8fafc',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(15, 23, 42, 0.95)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrophyIcon size={20} color="#fbbf24" /> Competições Continentais &amp; Mundiais
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Fase de grupos, chaveamento mata-mata, repescagem e premiações em dinheiro
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#e2e8f0',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✕ Fechar
          </button>
        </div>

        {/* Tournament Selector Bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 20px',
            background: 'rgba(15, 23, 42, 0.8)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            overflowX: 'auto',
          }}
        >
          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTournamentId(t.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: t.id === currentTournament?.id ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                background: t.id === currentTournament?.id ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: t.id === currentTournament?.id ? '#fbbf24' : '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {t.name} ({t.season})
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Carregando torneios...</div>
          ) : !currentTournament ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Nenhum torneio continental ativo nesta temporada.</div>
          ) : (
            <div>
              {/* Stage & Tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 600 }}>
                  Estágio Atual: <span style={{ color: '#38bdf8', textTransform: 'uppercase' }}>{currentTournament.currentStage}</span>
                  {currentTournament.championClubId && (
                    <span style={{ marginLeft: '12px', color: '#fbbf24', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <TrophyIcon size={14} color="#fbbf24" /> Campeão Definido!
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setActiveTab('groups')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: activeTab === 'groups' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: activeTab === 'groups' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: activeTab === 'groups' ? '#38bdf8' : '#94a3b8',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Fase de Grupos (A-H)
                  </button>
                  <button
                    onClick={() => setActiveTab('knockout')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: activeTab === 'knockout' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: activeTab === 'knockout' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: activeTab === 'knockout' ? '#38bdf8' : '#94a3b8',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Mata-Mata &amp; Final
                  </button>
                </div>
              </div>

              {activeTab === 'groups' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: '16px' }}>
                  {currentTournament.groups.map((group: TournamentGroup) => (
                    <div
                      key={group.letter}
                      style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '10px 14px',
                          background: 'rgba(15, 23, 42, 0.8)',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          color: '#fbbf24',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>Grupo {group.letter}</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Top 2 avançam</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', textAlign: 'left' }}>
                            <th style={{ padding: '6px 10px' }}>#</th>
                            <th style={{ padding: '6px 10px' }}>Clube</th>
                            <th style={{ padding: '6px 6px', textAlign: 'center' }}>J</th>
                            <th style={{ padding: '6px 6px', textAlign: 'center' }}>SG</th>
                            <th style={{ padding: '6px 10px', textAlign: 'center' }}>PTS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.standings.map((row, idx) => {
                            const cInfo = clubInfo[row.clubId];
                            const clubName = cInfo?.name ?? row.clubId;
                            const clubSlug = cInfo?.slug ?? null;

                            return (
                              <tr
                                key={row.clubId}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                  background: idx < 2 ? 'rgba(56, 189, 248, 0.06)' : 'transparent',
                                }}
                              >
                                <td style={{ padding: '6px 10px', fontWeight: 700, color: idx < 2 ? '#38bdf8' : '#94a3b8' }}>{idx + 1}</td>
                                <td style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, fontWeight: idx < 2 ? 700 : 500, color: '#f8fafc' }}>
                                  <ClubCrest
                                    club={{
                                      id: row.clubId,
                                      name: clubName,
                                      slug: clubSlug,
                                      crestBase64: cInfo?.crestBase64,
                                      primaryColor: cInfo?.primaryColor,
                                      secondaryColor: cInfo?.secondaryColor,
                                    }}
                                    size={18}
                                  />
                                  <span>{clubName}</span>
                                </td>
                                <td style={{ padding: '6px 6px', textAlign: 'center', color: '#94a3b8' }}>{row.played}</td>
                                <td style={{ padding: '6px 6px', textAlign: 'center', color: row.goalDifference >= 0 ? '#34d399' : '#f87171' }}>
                                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, color: '#fbbf24' }}>{row.points}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'knockout' && (
                <div>
                  {currentTournament.knockoutFixtures.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      O mata-mata será gerado ao término da fase de grupos (Rodada 6).
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                      {currentTournament.knockoutFixtures.map((fix: any, idx: number) => {
                        const res = fix.result;
                        const homeInfo = clubInfo[fix.homeClubId];
                        const awayInfo = clubInfo[fix.awayClubId];
                        const homeName = homeInfo?.name ?? fix.homeClubId;
                        const homeSlug = homeInfo?.slug ?? null;
                        const awayName = awayInfo?.name ?? fix.awayClubId;
                        const awaySlug = awayInfo?.slug ?? null;

                        return (
                          <div
                            key={idx}
                            style={{
                              background: 'rgba(30, 41, 59, 0.6)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '10px',
                              padding: '12px',
                            }}
                          >
                            <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
                              {fix.stageName} (Rodada {fix.round})
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '4px' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: fix.winnerClubId === fix.homeClubId ? 800 : 500 }}>
                                <ClubCrest
                                  club={{
                                    id: fix.homeClubId,
                                    name: homeName,
                                    slug: homeSlug,
                                    crestBase64: homeInfo?.crestBase64,
                                    primaryColor: homeInfo?.primaryColor,
                                    secondaryColor: homeInfo?.secondaryColor,
                                  }}
                                  size={16}
                                />
                                {homeName}
                              </span>
                              <span style={{ fontWeight: 800, color: '#fbbf24' }}>{res ? res.homeGoals : '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: fix.winnerClubId === fix.awayClubId ? 800 : 500 }}>
                                <ClubCrest
                                  club={{
                                    id: fix.awayClubId,
                                    name: awayName,
                                    slug: awaySlug,
                                    crestBase64: awayInfo?.crestBase64,
                                    primaryColor: awayInfo?.primaryColor,
                                    secondaryColor: awayInfo?.secondaryColor,
                                  }}
                                  size={16}
                                />
                                {awayName}
                              </span>
                              <span style={{ fontWeight: 800, color: '#fbbf24' }}>{res ? res.awayGoals : '-'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

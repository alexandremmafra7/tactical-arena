import React, { useState } from 'react';
import type { TournamentGroup, GroupLetter } from '@tactical-arena/shared';
import { ClubCrest } from './ClubCrest.js';
import { Link } from 'react-router-dom';
import { GlobeIcon } from './icons/AppIcons.js';

interface ClubInfo {
  name: string;
  slug: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

interface ContinentalGroupStageProps {
  groups: TournamentGroup[];
  clubInfo: Record<string, ClubInfo>;
  onSelectGroup?: (letter: GroupLetter) => void;
}

export const ContinentalGroupStage: React.FC<ContinentalGroupStageProps> = ({
  groups,
  clubInfo,
}) => {
  const [activeGroupLetter, setActiveGroupLetter] = useState<GroupLetter>('A');

  if (!groups || groups.length === 0) return null;

  const currentGroup = groups.find((g) => g.letter === activeGroupLetter) || groups[0];

  return (
    <section className="card continental-groups-container" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <GlobeIcon size={18} color="#38bdf8" /> Fase de Grupos
        </h2>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {groups.map((g) => (
            <button
              key={g.letter}
              onClick={() => setActiveGroupLetter(g.letter)}
              className={activeGroupLetter === g.letter ? 'btn-group-active' : 'btn-group-tab'}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: activeGroupLetter === g.letter ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                background: activeGroupLetter === g.letter ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.04)',
                color: activeGroupLetter === g.letter ? '#38bdf8' : '#94a3b8',
              }}
            >
              Grupo {g.letter}
            </button>
          ))}
        </div>
      </div>

      {currentGroup && (
        <div>
          <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6 }}>
            Classificação — Grupo {currentGroup.letter}
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '6px 8px', width: 30 }}>#</th>
                  <th style={{ padding: '6px 8px' }}>Clube</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>P</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>J</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>V</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>E</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>D</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>GP</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>GC</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center' }}>SG</th>
                </tr>
              </thead>
              <tbody>
                {currentGroup.standings.map((row, idx) => {
                  const club = clubInfo[row.clubId];
                  const isTop2 = idx < 2;
                  const isThird = idx === 2;

                  return (
                    <tr
                      key={row.clubId}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: isTop2 ? 'rgba(34, 197, 94, 0.05)' : isThird ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px', fontWeight: 600, color: isTop2 ? '#22c55e' : isThird ? '#f59e0b' : '#64748b' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ClubCrest
                          club={{
                            id: row.clubId,
                            name: club?.name ?? row.clubId,
                            slug: club?.slug ?? null,
                            crestBase64: club?.crestBase64,
                            primaryColor: club?.primaryColor,
                            secondaryColor: club?.secondaryColor,
                          }}
                          size={20}
                        />
                        <span style={{ fontWeight: 500, color: '#f1f5f9' }}>{club?.name ?? row.clubId}</span>
                        {isTop2 && <span style={{ fontSize: '0.7rem', color: '#22c55e', background: 'rgba(34,197,94,0.15)', padding: '1px 5px', borderRadius: 4 }}>Oitavas</span>}
                        {isThird && <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: 4 }}>Play-off</span>}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: '#38bdf8' }}>{row.points}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>{row.played}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>{row.won}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>{row.drawn}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>{row.lost}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>{row.goalsFor}</td>
                      <td style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>{row.goalsAgainst}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: row.goalDifference > 0 ? '#22c55e' : row.goalDifference < 0 ? '#ef4444' : '#94a3b8' }}>
                        {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {currentGroup.fixtures && currentGroup.fixtures.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 8 }}>Jogos do Grupo {currentGroup.letter}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
                {currentGroup.fixtures.slice(0, 6).map((fix, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <span>{clubInfo[fix.homeClubId]?.name ?? fix.homeClubId} vs {clubInfo[fix.awayClubId]?.name ?? fix.awayClubId}</span>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>R{fix.round}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

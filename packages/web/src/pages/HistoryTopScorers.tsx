import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Club, League, PlayerStatsEntry } from '@tactical-arena/shared';
import { getClub, getLeagueStats, getWorldStats, getActiveLeague, listLeagues } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { positionLabel } from '../lib/positionLabel.js';
import { GoalNetIcon, AssistBootIcon, GlobeIcon, TrophyIcon, SearchIcon } from '../components/icons/AppIcons.js';

export function HistoryTopScorersPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [metric, setMetric] = useState<'scorers' | 'assistants'>('scorers');
  const [selectedScope, setSelectedScope] = useState<string>('my_league');
  const [allLeagues, setAllLeagues] = useState<League[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [activeLeagueName, setActiveLeagueName] = useState<string>('Minha Divisão');
  const [currentLeagueName, setCurrentLeagueName] = useState<string>('Minha Divisão');
  const [topScorers, setTopScorers] = useState<PlayerStatsEntry[]>([]);
  const [topAssistants, setTopAssistants] = useState<PlayerStatsEntry[]>([]);
  const [limitCount, setLimitCount] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    getClub(clubId)
      .then(async (clubData) => {
        setClub(clubData);
        const [activeLeague, leaguesList] = await Promise.all([
          getActiveLeague(clubData.id).catch(() => null),
          listLeagues().catch(() => [] as League[]),
        ]);

        setAllLeagues(leaguesList);

        if (activeLeague) {
          setActiveLeagueId(activeLeague.id);
          setActiveLeagueName(activeLeague.name || 'Minha Divisão');
          setCurrentLeagueName(activeLeague.name || 'Minha Divisão');
          setSelectedScope(activeLeague.id);
          const stats = await getLeagueStats(activeLeague.id).catch(() => ({ topScorers: [], topAssistants: [] }));
          setTopScorers(stats.topScorers);
          setTopAssistants(stats.topAssistants);
        } else {
          setSelectedScope('world');
          setCurrentLeagueName('Mundial');
          const worldStats = await getWorldStats().catch(() => ({ topScorers: [], topAssistants: [] }));
          setTopScorers(worldStats.topScorers);
          setTopAssistants(worldStats.topAssistants);
        }
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [clubId]);

  async function handleLeagueChange(scopeValue: string) {
    setSelectedScope(scopeValue);
    setLoading(true);
    try {
      if (scopeValue === 'world') {
        setCurrentLeagueName('Mundial (Chuteira de Ouro)');
        const stats = await getWorldStats();
        setTopScorers(stats.topScorers);
        setTopAssistants(stats.topAssistants);
      } else {
        const targetId = scopeValue === 'my_league' ? activeLeagueId : scopeValue;
        if (!targetId) return;
        const found = allLeagues.find((l) => l.id === targetId);
        setCurrentLeagueName(found?.name ?? (scopeValue === 'my_league' ? activeLeagueName : 'Campeonato'));
        const stats = await getLeagueStats(targetId);
        setTopScorers(stats.topScorers);
        setTopAssistants(stats.topAssistants);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="page">Carregando artilharia e estatísticas oficiais...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  const currentList = metric === 'scorers' ? topScorers : topAssistants;
  const displayedList = limitCount > 0 ? currentList.slice(0, limitCount) : currentList;

  return (
    <div className="page">
      <ClubNav club={club} active="history" backTo={`/clubs/${club.id}/history`} />
      <HubSubnav hub="club" clubId={club.id} active="scorers" />

      {/* Hero Header & Controls */}
      <section className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)', border: '1.5px solid rgba(56, 189, 248, 0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
              <GoalNetIcon size={28} color="#38bdf8" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>
                Artilharia & Assistências (Carreira Dinâmica)
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                Estatísticas acumuladas das partidas in-game. Somente atletas que marcaram ou assistiram.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Metric Toggle */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                onClick={() => setMetric('scorers')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  background: metric === 'scorers' ? '#38bdf8' : 'transparent',
                  color: metric === 'scorers' ? '#000' : '#cbd5e1',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <GoalNetIcon size={14} color="currentColor" /> Artilheiros
              </button>
              <button
                type="button"
                onClick={() => setMetric('assistants')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  background: metric === 'assistants' ? '#38bdf8' : 'transparent',
                  color: metric === 'assistants' ? '#000' : '#cbd5e1',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AssistBootIcon size={14} color="currentColor" /> Assistências
              </button>
            </div>

            {/* Quick Pills */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 3, border: '1px solid rgba(255,255,255,0.1)' }}>
              {activeLeagueId && (
                <button
                  type="button"
                  onClick={() => handleLeagueChange(activeLeagueId)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    background: selectedScope === activeLeagueId ? '#22c55e' : 'transparent',
                    color: selectedScope === activeLeagueId ? '#000' : '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {activeLeagueName}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleLeagueChange('world')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  background: selectedScope === 'world' ? '#22c55e' : 'transparent',
                  color: selectedScope === 'world' ? '#000' : '#cbd5e1',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <GlobeIcon size={14} color="currentColor" /> Mundial
              </button>
            </div>
          </div>
        </div>

        {/* Championship Dropdown & Limit Bar */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>
              Consultar Campeonato:
            </span>
            <select
              value={selectedScope}
              onChange={(e) => handleLeagueChange(e.target.value)}
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                minWidth: 240,
              }}
            >
              {activeLeagueId && (
                <option value={activeLeagueId}>[Sua Liga] {activeLeagueName}</option>
              )}
              <option value="world">Mundial (Chuteira de Ouro / Todas as Ligas)</option>
              <optgroup label="Todos os Campeonatos Disponíveis">
                {allLeagues
                  .filter((l) => l.id !== activeLeagueId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.countryCode ? `(${l.countryCode})` : ''}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Exibir:</span>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
              {[
                { label: 'Top 10', val: 10 },
                { label: 'Top 20', val: 20 },
                { label: 'Todos com Gol', val: 0 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setLimitCount(opt.val)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    background: limitCount === opt.val ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                    color: limitCount === opt.val ? '#38bdf8' : '#94a3b8',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Table */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc' }}>
            {metric === 'scorers' ? 'Ranking de Artilheiros' : 'Ranking de Líderes de Assistências'} — {currentLeagueName}
          </h2>
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            {displayedList.length} de {currentList.length} atleta(s) com {metric === 'scorers' ? 'gols' : 'assistências'}
          </span>
        </div>

        {displayedList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#cbd5e1', fontWeight: 600 }}>
              Nenhum jogador marcou {metric === 'scorers' ? 'gols' : 'assistências'} ainda nesta competição.
            </p>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.82rem' }}>
              Apenas atletas com estatísticas positivas ({metric === 'scorers' ? 'gols > 0' : 'assistências > 0'}) aparecem no ranking oficial.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>#</th>
                  <th>Jogador</th>
                  <th>Clube</th>
                  <th style={{ textAlign: 'center' }}>Pos.</th>
                  <th style={{ textAlign: 'center' }}>Idade</th>
                  <th style={{ textAlign: 'center' }}>Força</th>
                  <th style={{ textAlign: 'right' }}>Jogos</th>
                  <th style={{ textAlign: 'right' }}>{metric === 'scorers' ? 'Gols' : 'Assistências'}</th>
                  <th style={{ textAlign: 'right' }}>Média</th>
                  <th style={{ textAlign: 'center', width: 140 }}>Ação / Mercado</th>
                </tr>
              </thead>
              <tbody>
                {displayedList.map((entry, index) => {
                  const isTop3 = index < 3;
                  const medalColor = index === 0 ? '#ffd700' : index === 1 ? '#cbd5e1' : index === 2 ? '#b45309' : undefined;
                  const isUserClub = entry.clubId === club.id;
                  const statValue = metric === 'scorers' ? entry.goals : entry.assists;

                  return (
                    <tr key={entry.playerId} style={isUserClub ? { background: 'rgba(34, 197, 94, 0.08)' } : isTop3 ? { background: 'rgba(56, 189, 248, 0.04)' } : undefined}>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>
                        {medalColor ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: medalColor, color: '#000', fontSize: '0.74rem' }}>
                            {index + 1}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{index + 1}º</span>
                        )}
                      </td>
                      <td>
                        <Link
                          to={`/clubs/${club.id}/players/${entry.playerId}`}
                          style={{ fontWeight: 700, color: '#38bdf8', textDecoration: 'none' }}
                          title="Ver ficha completa do jogador"
                        >
                          {entry.playerName}
                        </Link>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {entry.clubSlug && (
                            <img
                              src={`/crests/${entry.clubSlug}.png`}
                              alt=""
                              style={{ width: 18, height: 18, objectFit: 'contain' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <span style={{ fontSize: '0.84rem', color: isUserClub ? '#4ade80' : 'inherit' }}>
                            {entry.clubName} {isUserClub ? '(Seu Time)' : ''}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        {positionLabel(entry.position)}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.84rem' }}>{entry.age}</td>
                      <td style={{ textAlign: 'center' }}>
                        <strong style={{ color: entry.overall >= 88 ? '#ffd700' : entry.overall >= 80 ? '#38bdf8' : '#f8fafc' }}>
                          {entry.overall}
                        </strong>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.84rem', color: 'var(--muted)' }}>{entry.matches}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.05rem', color: metric === 'scorers' ? '#38bdf8' : '#4ade80' }}>
                          {statValue}
                        </strong>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.84rem', color: '#94a3b8' }}>
                        {entry.goalsPerMatch.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isUserClub ? (
                          <span style={{ fontSize: '0.74rem', color: '#4ade80', fontWeight: 700 }}>Seu Elenco</span>
                        ) : (
                          <Link
                            to={`/clubs/${club.id}/players/${entry.playerId}`}
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '0.74rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title={`Abrir perfil e negociar contratação de ${entry.playerName}`}
                          >
                            <SearchIcon size={12} color="currentColor" /> Scout / Contratar
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

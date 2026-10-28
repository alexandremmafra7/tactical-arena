import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Club, QuickPlayFormat, QuickTournamentMatch, QuickTournamentState } from '@tactical-arena/shared';
import {
  createQuickTournament,
  advanceQuickTournament,
  autoSimulateQuickMatch,
} from '@tactical-arena/shared';
import { listAllClubsForEditor } from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { TrophyIcon } from '../components/icons/AppIcons.js';

export function QuickPlayPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'EXHIBITION' | 'TOURNAMENT'>('EXHIBITION');

  // Exhibition state
  const [exHomeId, setExHomeId] = useState('');
  const [exAwayId, setExAwayId] = useState('');
  const [exNeutral, setExNeutral] = useState(true);
  const [exMatch, setExMatch] = useState<QuickTournamentMatch | null>(null);

  // Tournament setup state
  const [tournName, setTournName] = useState('Copa Relâmpago 2026');
  const [tournFormat, setTournFormat] = useState<QuickPlayFormat>('KNOCKOUT_4');
  const [tournament, setTournament] = useState<QuickTournamentState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await listAllClubsForEditor();
        setClubs(list);
        if (list.length >= 2) {
          setExHomeId(list[0].id);
          setExAwayId(list[1].id);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleRunExhibition(e: React.FormEvent) {
    e.preventDefault();
    const home = clubs.find((c) => c.id === exHomeId);
    const away = clubs.find((c) => c.id === exAwayId);
    if (!home || !away) {
      setError('Selecione dois clubes válidos.');
      return;
    }
    if (home.id === away.id) {
      setError('Os clubes mandante e visitante devem ser diferentes.');
      return;
    }
    setError(null);
    const res = autoSimulateQuickMatch(home, away, exNeutral, 'Amistoso');
    setExMatch(res);
  }

  function handleStartTournament(e: React.FormEvent) {
    e.preventDefault();
    const count = tournFormat === 'KNOCKOUT_4' ? 4 : tournFormat === 'KNOCKOUT_8' ? 8 : 16;
    if (clubs.length < count) {
      setError(`São necessários pelo menos ${count} clubes para este formato.`);
      return;
    }
    setError(null);
    const participants = [...clubs].sort(() => Math.random() - 0.5).slice(0, count);
    const state = createQuickTournament(tournName, participants, tournFormat);
    setTournament(state);
  }

  function handleSimulateTournamentMatch(matchId: string) {
    if (!tournament) return;
    const currentRound = tournament.rounds[tournament.currentRoundIndex];
    if (!currentRound) return;

    const completed = currentRound.matches.map((m) => {
      if (m.id === matchId && !m.winnerClubId) {
        return autoSimulateQuickMatch(m.homeClub, m.awayClub, true, m.roundName, m.id);
      }
      return m;
    });

    const updated = advanceQuickTournament(tournament, completed);
    setTournament(updated);
  }

  if (loading) return <div className="page">Carregando Jogo Rápido...</div>;

  return (
    <div className="page">
      <header className="topbar" style={{ marginBottom: 20 }}>
        <h1>Jogo Rápido & Torneios Customizados</h1>
        <div className="topbar-actions">
          <Link className="btn-secondary" to="/">
            ← Menu Principal
          </Link>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          className={mode === 'EXHIBITION' ? 'btn-primary-action' : 'btn-secondary'}
          onClick={() => setMode('EXHIBITION')}
        >
          Duelo Direto (Amistoso 1v1)
        </button>
        <button
          type="button"
          className={mode === 'TOURNAMENT' ? 'btn-primary-action' : 'btn-secondary'}
          onClick={() => setMode('TOURNAMENT')}
        >
          Copa Mata-Mata Relâmpago
        </button>
      </div>

      {mode === 'EXHIBITION' && (
        <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2>Amistoso de Exibição 1v1</h2>
          <p className="muted">Escolha quaisquer dois clubes da base e simule um confronto direto imediato sem afetar seu save de carreira.</p>

          <form onSubmit={handleRunExhibition} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Mandante</label>
                <select value={exHomeId} onChange={(e) => setExHomeId(e.target.value)} style={{ width: '100%', padding: 8 }}>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.country})
                    </option>
                  ))}
                </select>
              </div>

              <span style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--accent)' }}>VS</span>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Visitante</label>
                <select value={exAwayId} onChange={(e) => setExAwayId(e.target.value)} style={{ width: '100%', padding: 8 }}>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.country})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="neutral" checked={exNeutral} onChange={(e) => setExNeutral(e.target.checked)} />
              <label htmlFor="neutral">Campo Neutro (Ex: Maracanã / Wembley)</label>
            </div>

            <button type="submit" className="btn-primary-action" style={{ padding: '12px' }}>
              Simular Partida Instantânea
            </button>
          </form>

          {exMatch && exMatch.result && (
            <div className="card" style={{ marginTop: 24, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--accent)' }}>
              <h3 style={{ textAlign: 'center', color: 'var(--accent)', marginBottom: 16 }}>Resultado do Amistoso</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.2rem', fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClubCrest club={exMatch.homeClub} size={36} />
                  {exMatch.homeClub.name}
                </span>
                <span style={{ fontSize: '1.8rem', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {exMatch.result.homeGoals} x {exMatch.result.awayGoals}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {exMatch.awayClub.name}
                  <ClubCrest club={exMatch.awayClub} size={36} />
                </span>
              </div>

              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>Principais Lances & Gols:</h4>
                <ul style={{ paddingLeft: 20, margin: 0, fontSize: '0.85rem' }}>
                  {exMatch.result.events.filter((e) => e.type === 'goal' || e.type === 'card').map((ev, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      <strong>{ev.minute}'</strong> — {ev.description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'TOURNAMENT' && !tournament && (
        <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2>Criar Copa Mata-Mata Relâmpago</h2>
          <p className="muted">Organize um torneio eliminatório rápido de 4, 8 ou 16 equipes com chaveamento automático.</p>

          <form onSubmit={handleStartTournament} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Nome da Competição</label>
              <input value={tournName} onChange={(e) => setTournName(e.target.value)} required style={{ width: '100%', padding: 8 }} />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Formato do Torneio</label>
              <select value={tournFormat} onChange={(e) => setTournFormat(e.target.value as QuickPlayFormat)} style={{ width: '100%', padding: 8 }}>
                <option value="KNOCKOUT_4">Copa de 4 Equipes (Semifinais e Final)</option>
                <option value="KNOCKOUT_8">Copa de 8 Equipes (Quartas, Semis e Final)</option>
                <option value="KNOCKOUT_16">Copa de 16 Equipes (Oitavas até a Final)</option>
              </select>
            </div>

            <button type="submit" className="btn-primary-action" style={{ padding: '12px' }}>
              Sortear Chaves e Iniciar Torneio
            </button>
          </form>
        </div>
      )}

      {mode === 'TOURNAMENT' && tournament && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0 }}>{tournament.name}</h2>
              <span className="muted">Fase Atual: {tournament.rounds[tournament.currentRoundIndex]?.name}</span>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setTournament(null)}>
              Reiniciar / Novo Torneio
            </button>
          </div>

          {tournament.isFinished && tournament.championClub && (
            <div className="card" style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(229,169,60,0.2) 0%, rgba(16,185,129,0.2) 100%)', border: '2px solid var(--accent)', padding: 32, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <TrophyIcon size={54} color="var(--accent)" fill="var(--accent)" />
              </div>
              <h2 style={{ color: 'var(--accent)', fontSize: '1.8rem', margin: '0 0 8px 0' }}>{tournament.championClub.name} É O CAMPEÃO!</h2>
              <p className="muted" style={{ fontSize: '1rem', margin: '0 0 16px 0' }}>
                Vice-campeão: <strong>{tournament.runnerUpClub?.name}</strong>
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {tournament.rounds.map((round, rIdx) => (
              <div key={rIdx} className="card" style={{ opacity: rIdx > tournament.currentRoundIndex ? 0.6 : 1 }}>
                <h3 style={{ fontSize: '1.1rem', color: rIdx === tournament.currentRoundIndex ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 12 }}>
                  {round.name} {round.isCompleted ? '✓ (Concluída)' : rIdx === tournament.currentRoundIndex ? '▶ (Em Andamento)' : ''}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {round.matches.map((m) => (
                    <div key={m.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', fontWeight: m.winnerClubId === m.homeClub.id ? 700 : 400 }}>
                          <ClubCrest club={m.homeClub} size={24} />
                          {m.homeClub.name}
                        </span>
                        <span style={{ fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                          {m.result ? m.result.homeGoals : '-'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem', fontWeight: m.winnerClubId === m.awayClub.id ? 700 : 400 }}>
                          <ClubCrest club={m.awayClub} size={24} />
                          {m.awayClub.name}
                        </span>
                        <span style={{ fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                          {m.result ? m.result.awayGoals : '-'}
                        </span>
                      </div>

                      {m.result && m.result.penaltyWinner && (
                        <div style={{ fontSize: '0.75rem', color: '#93c5fd', marginBottom: 8, textAlign: 'center' }}>
                          (Pênaltis: {m.result.penaltyWinner === 'home' ? m.homeClub.name : m.awayClub.name} venceu)
                        </div>
                      )}

                      {!m.winnerClubId && rIdx === tournament.currentRoundIndex && !tournament.isFinished && (
                        <button
                          type="button"
                          className="btn-primary-action"
                          style={{ width: '100%', padding: '6px', fontSize: '0.82rem' }}
                          onClick={() => handleSimulateTournamentMatch(m.id)}
                        >
                          ▶ Simular Confronto
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

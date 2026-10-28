import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Club, HallOfFameData, AllTimeTopScorerEntry, ClubTrophyRankingEntry, ManagerHallOfFameEntry } from '@tactical-arena/shared';
import { getClub, getHallOfFame, createTransferProposal } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { PlayerStatusMarks } from '../components/PlayerStatusMarks.js';
import { positionLabel } from '../lib/positionLabel.js';
import {
  TrophyIcon,
  SoccerBallIcon,
  TacticsIcon,
  TransfersIcon,
  StarIcon,
} from '../components/icons/AppIcons.js';

function SearchIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function HallOfFamePage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [club, setClub] = useState<Club | null>(null);
  const [data, setData] = useState<HallOfFameData | null>(null);
  const [tab, setTab] = useState<'scorers' | 'clubs' | 'managers'>('scorers');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal de Proposta Rápida
  const [proposingPlayer, setProposingPlayer] = useState<AllTimeTopScorerEntry | null>(null);
  const [offerCash, setOfferCash] = useState<number>(0);
  const [sendingProposal, setSendingProposal] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    Promise.all([getClub(clubId), getHallOfFame(clubId)])
      .then(([clubData, hofData]) => {
        setClub(clubData);
        setData(hofData);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [clubId]);

  function handleOpenProposal(player: AllTimeTopScorerEntry) {
    setProposingPlayer(player);
    const baseValue = player.marketValue ?? 10_000_000;
    setOfferCash(Math.round(baseValue * 1.1));
  }

  async function handleSendProposal() {
    if (!club || !proposingPlayer || !proposingPlayer.clubId) return;
    setSendingProposal(true);
    try {
      await createTransferProposal({
        buyerClubId: club.id,
        sellerClubId: proposingPlayer.clubId,
        targetPlayerId: proposingPlayer.playerId,
        cashAmount: offerCash,
        installments: 1,
        offeredPlayerIds: [],
        hasBankGuarantee: true,
      });
      setSuccessMsg(`Proposta de ${formatMoney(offerCash)} enviada com sucesso ao ${proposingPlayer.clubName}!`);
      setProposingPlayer(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      alert(`Erro ao enviar proposta: ${(err as Error).message}`);
    } finally {
      setSendingProposal(false);
    }
  }

  if (loading) return <div className="page">Carregando Hall da Fama...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club || !data) return null;

  const filteredScorers = data.topScorers.filter((s) =>
    s.playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.clubName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClubs = data.topClubs.filter((c) =>
    c.clubName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredManagers = data.topManagers.filter((m) =>
    m.managerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page hall-of-fame-page">
      <ClubNav club={club} active="history" backTo={`/clubs/${club.id}/history`} />
      <HubSubnav hub="club" clubId={club.id} active="hallOfFame" />

      {/* Hero Header */}
      <section className="card hall-of-fame-hero" style={{ marginBottom: 16, border: '1.5px solid rgba(255, 215, 0, 0.3)', background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(15, 23, 42, 0.95) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 12, borderRadius: 14, background: 'rgba(255, 215, 0, 0.15)', border: '1px solid rgba(255, 215, 0, 0.4)' }}>
              <TrophyIcon size={32} color="#ffd700" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                Hall da Fama &amp; Recordes Históricos
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: '#94a3b8' }}>
                Os maiores artilheiros de todos os tempos, ranking de títulos dos clubes e técnicos consagrados.
              </p>
            </div>
          </div>

          <div className="hall-of-fame-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn-secondary ${tab === 'scorers' ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: '0.84rem',
                padding: '8px 16px',
                background: tab === 'scorers' ? '#ffd700' : 'rgba(255, 255, 255, 0.06)',
                color: tab === 'scorers' ? '#000' : '#f8fafc',
                border: tab === 'scorers' ? '1px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.15)',
              }}
              onClick={() => setTab('scorers')}
            >
              <SoccerBallIcon size={16} />
              Maiores Artilheiros
            </button>
            <button
              type="button"
              className={`btn-secondary ${tab === 'clubs' ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: '0.84rem',
                padding: '8px 16px',
                background: tab === 'clubs' ? '#ffd700' : 'rgba(255, 255, 255, 0.06)',
                color: tab === 'clubs' ? '#000' : '#f8fafc',
                border: tab === 'clubs' ? '1px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.15)',
              }}
              onClick={() => setTab('clubs')}
            >
              <TrophyIcon size={16} />
              Clubes Mais Vitoriosos
            </button>
            <button
              type="button"
              className={`btn-secondary ${tab === 'managers' ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: '0.84rem',
                padding: '8px 16px',
                background: tab === 'managers' ? '#ffd700' : 'rgba(255, 255, 255, 0.06)',
                color: tab === 'managers' ? '#000' : '#f8fafc',
                border: tab === 'managers' ? '1px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.15)',
              }}
              onClick={() => setTab('managers')}
            >
              <TacticsIcon size={16} />
              Técnicos Lendários
            </button>
          </div>
        </div>

        {/* Barra de Busca Rápida */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>
              <SearchIcon size={15} />
            </span>
            <input
              type="text"
              placeholder={
                tab === 'scorers' ? 'Buscar jogador ou clube...' :
                tab === 'clubs' ? 'Buscar clube ou país...' : 'Buscar treinador...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 32px',
                fontSize: '0.84rem',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 8,
                color: '#fff',
              }}
            />
          </div>
        </div>
      </section>

      {successMsg && (
        <div className="card" style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#4ade80', marginBottom: 14, padding: '10px 16px' }}>
          {successMsg}
        </div>
      )}

      {/* ABA 1: MAIORES ARTILHEIROS DE TODOS OS TEMPOS */}
      {tab === 'scorers' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Panteão Global: Maiores Artilheiros de Todos os Tempos</h2>
              <p className="muted" style={{ margin: '3px 0 0', fontSize: '0.8rem' }}>
                Homenagem eterna aos maiores goleadores do futebol mundial (contagem histórica consagrada FIFA / RSSSF).
              </p>
            </div>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '4px 10px', borderRadius: 9999, background: 'rgba(255, 215, 0, 0.1)', color: '#ffd700', border: '1px solid rgba(255, 215, 0, 0.3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <StarIcon size={12} fill="#ffd700" color="#ffd700" /> Ranking Imutável de Lendas
            </span>
          </div>

          <div className="table-scroll" style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>#</th>
                  <th>Jogador</th>
                  <th style={{ textAlign: 'right' }}>Gols</th>
                  <th style={{ textAlign: 'right' }}>Jogos</th>
                  <th style={{ textAlign: 'right' }}>Média</th>
                  <th>Clube Consagrado / Atual</th>
                  <th style={{ textAlign: 'center' }}>Era</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredScorers.map((scorer) => {
                  const isTop3 = scorer.rank <= 3;
                  const medalColor = scorer.rank === 1 ? '#ffd700' : scorer.rank === 2 ? '#cbd5e1' : scorer.rank === 3 ? '#b45309' : undefined;
                  const isUserClub = scorer.clubId === club.id;

                  return (
                    <tr key={scorer.playerId} style={isTop3 ? { background: 'rgba(255, 215, 0, 0.04)' } : undefined}>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>
                        {medalColor ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: medalColor, color: '#000', fontSize: '0.74rem' }}>
                            {scorer.rank}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{scorer.rank}º</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            {scorer.nationality && (
                              <CountryFlag code={scorer.nationality} size={15} />
                            )}
                            <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>{scorer.playerName}</span>
                            <PlayerStatusMarks
                              tier={scorer.overall >= 90 ? 'GENIO' : scorer.overall >= 80 && scorer.diferenciado ? 'BAITA' : scorer.age <= 20 ? 'PROMESSA' : null}
                            />
                          </div>
                          {scorer.distinction && (
                            <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontStyle: 'italic', paddingLeft: 22 }}>
                              {scorer.distinction}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.15rem', color: '#ffd700', fontWeight: 900 }}>{scorer.totalGoals}</strong>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.84rem', color: 'var(--muted)' }}>{scorer.matchesPlayed}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.84rem', color: '#94a3b8' }}>{scorer.goalsPerMatch.toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {scorer.clubSlug && (
                            <img
                              src={`/crests/${scorer.clubSlug}.png`}
                              alt=""
                              style={{ width: 18, height: 18, objectFit: 'contain' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <span style={{ fontSize: '0.84rem', color: isUserClub ? '#4ade80' : 'inherit' }}>
                            {scorer.notableClub || scorer.clubName} {isUserClub ? '(Seu Time)' : ''}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.76rem', color: 'var(--muted)' }}>
                        {scorer.era || 'Histórico'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {scorer.isActive ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 9999, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.35)', letterSpacing: '0.04em' }}>
                            EM ATIVIDADE
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 9999, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)', letterSpacing: '0.04em' }}>
                            LENDA IMORTAL
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {scorer.isActive && !isUserClub && scorer.clubId ? (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleOpenProposal(scorer)}
                            title={`Fazer proposta de contratação por ${scorer.playerName}`}
                          >
                            <TransfersIcon size={12} />
                            Contratar
                          </button>
                        ) : isUserClub ? (
                          <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>No Elenco</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>Consagrado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ABA 2: CLUBES MAIS VITORIOSOS */}
      {tab === 'clubs' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Ranking Histórico de Títulos dos Clubes</h2>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
                Pontuação Ponderada: Mundial (10 pts) • Continental (7 pts) • Liga Nacional (5 pts) • Copa Nacional (4 pts)
              </p>
            </div>
          </div>

          <div className="table-scroll" style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>#</th>
                  <th>Clube</th>
                  <th style={{ textAlign: 'center' }}>País</th>
                  <th style={{ textAlign: 'right' }}>Mundiais</th>
                  <th style={{ textAlign: 'right' }}>Continentais</th>
                  <th style={{ textAlign: 'right' }}>Ligas</th>
                  <th style={{ textAlign: 'right' }}>Copas</th>
                  <th style={{ textAlign: 'right' }}>Total Taças</th>
                  <th style={{ textAlign: 'right' }}>Pontos de Glória</th>
                </tr>
              </thead>
              <tbody>
                {filteredClubs.map((c) => {
                  const isTop3 = c.rank <= 3;
                  const medalColor = c.rank === 1 ? '#ffd700' : c.rank === 2 ? '#cbd5e1' : c.rank === 3 ? '#b45309' : undefined;
                  const isUser = c.clubId === club.id;

                  return (
                    <tr key={c.clubId} style={isUser ? { background: 'rgba(34, 197, 94, 0.08)' } : isTop3 ? { background: 'rgba(255, 215, 0, 0.04)' } : undefined}>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>
                        {medalColor ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: medalColor, color: '#000', fontSize: '0.74rem' }}>
                            {c.rank}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{c.rank}º</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {c.clubSlug && (
                            <img
                              src={`/crests/${c.clubSlug}.png`}
                              alt=""
                              style={{ width: 22, height: 22, objectFit: 'contain' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                          <span style={{ fontWeight: 700, color: isUser ? '#4ade80' : '#fff' }}>
                            {c.clubName} {isUser ? '⭐ (Seu Clube)' : ''}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <CountryFlag code={c.country} size={16} />
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.88rem' }}>{c.mundialCount}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.88rem' }}>{c.continentalCount}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.88rem' }}>{c.leagueCount}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.88rem' }}>{c.cupCount}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.92rem', fontWeight: 700 }}>{c.titlesWon}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1rem', color: '#ffd700' }}>{c.points}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ABA 3: TÉCNICOS LENDÁRIOS */}
      {tab === 'managers' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Hall da Fama dos Treinadores</h2>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
                Os maiores estrategistas da história. Seu desempenho na carreira é medido diretamente contra os ícones mundiais.
              </p>
            </div>
          </div>

          <div className="table-scroll" style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>#</th>
                  <th>Treinador</th>
                  <th style={{ textAlign: 'center' }}>Nacionalidade</th>
                  <th style={{ textAlign: 'right' }}>Mundiais</th>
                  <th style={{ textAlign: 'right' }}>Continentais</th>
                  <th style={{ textAlign: 'right' }}>Ligas Nacionais</th>
                  <th style={{ textAlign: 'right' }}>Copas</th>
                  <th style={{ textAlign: 'right' }}>Total Taças</th>
                  <th style={{ textAlign: 'right' }}>Pontos de Carreira</th>
                </tr>
              </thead>
              <tbody>
                {filteredManagers.map((m) => {
                  const isTop3 = m.rank <= 3;
                  const medalColor = m.rank === 1 ? '#ffd700' : m.rank === 2 ? '#cbd5e1' : m.rank === 3 ? '#b45309' : undefined;

                  return (
                    <tr key={m.managerId} style={m.isUser ? { background: 'rgba(34, 197, 94, 0.12)', borderLeft: '3px solid #22c55e' } : isTop3 ? { background: 'rgba(255, 215, 0, 0.04)' } : undefined}>
                      <td style={{ textAlign: 'center', fontWeight: 800 }}>
                        {medalColor ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: medalColor, color: '#000', fontSize: '0.74rem' }}>
                            {m.rank}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{m.rank}º</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: m.isUser ? 800 : 700, color: m.isUser ? '#4ade80' : '#fff' }}>
                            {m.managerName}
                          </span>
                          {m.isUser && (
                            <span style={{ fontSize: '0.72rem', background: '#16a34a', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                              VOCÊ
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {m.nationality && <CountryFlag code={m.nationality} size={16} />}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.88rem' }}>{m.mundialTitles}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.88rem' }}>{m.continentalTitles}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.88rem' }}>{m.leagueTitles}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.88rem' }}>{m.cupTitles}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.92rem', fontWeight: 700 }}>{m.totalTitles}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1rem', color: '#ffd700' }}>{m.points}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL DE PROPOSTA DE TRANSFERÊNCIA RÁPIDA */}
      {proposingPlayer && (
        <div className="modal-backdrop" onClick={() => setProposingPlayer(null)}>
          <div
            className="modal-card"
            style={{
              maxWidth: 480,
              background: 'rgba(15, 23, 42, 0.98)',
              border: '1.5px solid rgba(255, 215, 0, 0.3)',
              borderRadius: 16,
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(16px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                Fazer Proposta de Transferência
              </h3>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '2px 8px', fontSize: '0.85rem' }}
                onClick={() => setProposingPlayer(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 10, marginBottom: 14 }}>
              <div>
                <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{proposingPlayer.playerName}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                  {positionLabel(proposingPlayer.position)} • {proposingPlayer.age} anos • {proposingPlayer.overall} OVR
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#ffd700' }}>
                  {proposingPlayer.totalGoals} gols na carreira ({proposingPlayer.clubName})
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: 6 }}>
                Valor da Oferta à Vista:
              </label>
              <input
                type="number"
                step="500000"
                value={offerCash}
                onChange={(e) => setOfferCash(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '1rem',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#4ade80',
                  fontWeight: 800,
                }}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                Seu Orçamento Disponível: <strong style={{ color: '#4ade80' }}>{formatMoney(club.budget)}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setProposingPlayer(null)}
                disabled={sendingProposal}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSendProposal}
                disabled={sendingProposal || offerCash > club.budget || offerCash <= 0}
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', padding: '8px 18px', fontWeight: 700 }}
              >
                {sendingProposal ? 'Enviando...' : 'Enviar Proposta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

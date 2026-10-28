import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { COUNTRIES, formatShortPtBr } from '@tactical-arena/shared';
import type { Club, Cup, League as LeagueType, Match, StandingRow, PlayerStatsEntry, LeagueFixture } from '@tactical-arena/shared';
import { forceStartLeague, getClub, getLeague, getLeagueStats, getMatch, listCups, listLeagues, listMyClubs, listTacticPresets, type LeagueStats } from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { competitionLogo } from '../lib/competitionLogo.js';
import { goToMatchday } from '../lib/goToMatchday';
import { GoalNetIcon, AssistBootIcon, ArrowLeftIcon, HomeIcon } from '../components/icons/AppIcons.js';

type LeagueWithStandings = LeagueType & { standings: StandingRow[] };

/**
 * O status da competição em palavras.
 *
 * Enquanto esta tela só era alcançável pelo painel de desenvolvimento, mostrar IN_PROGRESS cru não
 * incomodava ninguém. Agora ela tem porta no menu de Competições e é o jogador que lê.
 */
const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Inscrições abertas',
  IN_PROGRESS: 'Em disputa',
  FINISHED: 'Encerrado',
};

/**
 * Controles de simulação: existem para desenvolver, não para jogar.
 *
 * Quem faz a rodada andar é o dia de jogo, a partir do painel do clube — um botão de avançar rodada aqui
 * deixa o jogador pular a própria partida sem perceber que fez isso. Ficam visíveis só no `npm run dev`.
 */
const DEV_CONTROLS = import.meta.env.DEV;


interface ClubInfo {
  name: string;
  slug: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export interface LeagueViewProps {
  league: LeagueWithStandings;
  clubInfo?: Record<string, ClubInfo>;
  matches?: Record<string, Match>;
  stats?: LeagueStats | null;
  myClubId?: string | null;
  myClubLeagues?: LeagueType[];
  myCups?: Cup[];
  busy?: boolean;
  error?: string | null;
  onAdvanceRound?: () => void;
  onForceStart?: () => void;
  selectedRound?: number;
  onSelectRound?: (round: number) => void;
}

export function LeagueView({
  league,
  clubInfo = {},
  matches = {},
  stats = null,
  myClubId = null,
  myClubLeagues = [],
  myCups = [],
  busy = false,
  error = null,
  onAdvanceRound,
  onForceStart,
  selectedRound,
  onSelectRound,
}: LeagueViewProps) {
  const navigate = useNavigate();
  const country = COUNTRIES.find((c) => c.code === league.countryCode);
  const countryName = country?.name ?? league.countryCode;

  const rounds = useMemo(() => {
    return [...new Set(league.fixtures.map((f) => f.round))].sort((a, b) => a - b);
  }, [league.fixtures]);

  function getFixtureDetails(f: LeagueFixture) {
    if (f.result) {
      return {
        isPlayed: true,
        homeGoals: f.result.homeGoals,
        awayGoals: f.result.awayGoals,
        scorers: f.result.scorers,
      };
    }
    if (f.matchId && matches[f.matchId]?.result) {
      const res = matches[f.matchId].result!;
      return {
        isPlayed: true,
        homeGoals: res.homeGoals,
        awayGoals: res.awayGoals,
        scorers: undefined,
      };
    }
    return {
      isPlayed: false,
      homeGoals: null,
      awayGoals: null,
      scorers: undefined,
    };
  }

  const currentSeasonRound = useMemo(() => {
    if (rounds.length === 0) return 1;
    // Menor rodada com algum jogo que ainda não foi concluído
    const pendingFixture = league.fixtures.find((f) => !getFixtureDetails(f).isPlayed);
    return pendingFixture ? pendingFixture.round : (rounds[rounds.length - 1] ?? 1);
  }, [league.fixtures, matches, rounds]);

  const [internalRound, setInternalRound] = useState<number>(currentSeasonRound);
  useEffect(() => {
    setInternalRound(currentSeasonRound);
  }, [league.id, currentSeasonRound]);

  const activeRound = selectedRound ?? internalRound;
  const changeRound = onSelectRound ?? setInternalRound;

  const fixturesInSelectedRound = useMemo(() => {
    return league.fixtures.filter((f) => f.round === activeRound);
  }, [league.fixtures, activeRound]);

  const roundStatusLabel = useMemo(() => {
    if (fixturesInSelectedRound.length === 0) return '';
    const hasLive = fixturesInSelectedRound.some((f) => f.matchId && matches[f.matchId]?.status === 'LIVE');
    if (hasLive) return '● Ao Vivo';
    const allFinished = fixturesInSelectedRound.every((f) => getFixtureDetails(f).isPlayed);
    if (allFinished) return 'Rodada Concluída';
    if (activeRound === currentSeasonRound) return 'Rodada Atual';
    const allPending = fixturesInSelectedRound.every((f) => !getFixtureDetails(f).isPlayed);
    if (allPending) return 'A Realizar';
    return 'Em Andamento';
  }, [fixturesInSelectedRound, matches, activeRound, currentSeasonRound]);

  const activeScorers = useMemo(() => {
    return (stats?.topScorers ?? [])
      .filter((s) => Number(s.goals ?? 0) > 0)
      .slice(0, 10);
  }, [stats]);

  const activeAssistants = useMemo(() => {
    return (stats?.topAssistants ?? [])
      .filter((a) => Number(a.assists ?? 0) > 0)
      .slice(0, 10);
  }, [stats]);

  const clubLabel = (id: string) => (
    <span className="crest-name">
      <ClubCrest
        club={{
          id,
          name: clubInfo[id]?.name ?? id,
          slug: clubInfo[id]?.slug ?? null,
          crestBase64: clubInfo[id]?.crestBase64,
          primaryColor: clubInfo[id]?.primaryColor,
          secondaryColor: clubInfo[id]?.secondaryColor,
        }}
        size={18}
      />
      {clubInfo[id]?.name ?? id}
    </span>
  );

  const logo = competitionLogo(league.name);

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="crest-name">
          {logo && <img src={logo} alt="" className="competition-logo" />}
          {league.name}
        </h1>
        <div className="topbar-actions">
          <Link
            className="back-to-panel"
            to={myClubId ? `/clubs/${myClubId}/competitions` : '/dashboard'}
            title="Voltar"
            aria-label="Voltar"
          >
            <ArrowLeftIcon size={20} />
          </Link>
          <Link
            className="home-button"
            to={myClubId ? `/clubs/${myClubId}` : '/dashboard'}
            title="Ir para a página inicial"
            aria-label="Ir para a página inicial"
          >
            <HomeIcon size={20} color="var(--accent)" />
          </Link>
        </div>
      </header>

      {/*
        Esta tela vive fora da hierarquia do clube, em /league/:id, então não monta a ClubNav. A barra de
        irmãos ela monta: sem isso, a tabela era um beco de onde só se saía pelo botão de voltar.
      */}
      {myClubId && (
        <HubSubnav
          hub="competitions"
          clubId={myClubId}
          active="league"
          extraItems={[
            { key: 'league', label: 'Tabela', to: `/league/${league.id}` },
            ...myCups.map((cup) => ({ key: cup.id, label: cup.name, to: `/cup/${cup.id}` })),
          ]}
        />
      )}

      {myClubLeagues.length > 0 && (
        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '12px 0' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent, #f59e0b)' }}>Alternar Competição:</span>
          <select
            value={league.id}
            onChange={(e) => navigate(`/league/${e.target.value}`)}
            style={{
              background: '#24202c',
              color: 'var(--fg)',
              border: '1px solid #3d364a',
              borderRadius: 8,
              padding: '6px 12px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              flex: 1,
              maxWidth: 380,
            }}
          >
            {myClubLeagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} {l.division ? `(Série ${l.division === 1 ? 'A' : l.division === 2 ? 'B' : l.division === 3 ? 'C' : 'D'})` : '(Campeonato Estadual)'}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="muted">
        <CountryFlag code={league.countryCode} /> {countryName} • Divisão {league.division} • {STATUS_LABEL[league.status] ?? league.status} • 
        {league.clubIds.length}/{league.capacity} clubes
      </p>

      {error && <p className="error">{error}</p>}

      {DEV_CONTROLS && league.status === 'OPEN' && (
        <section className="card">
          <p>A liga ainda não tem clubes suficientes para encher naturalmente.</p>
          <button onClick={onForceStart} disabled={busy || league.clubIds.length < 2}>
            Forçar início do campeonato
          </button>
        </section>
      )}

      {DEV_CONTROLS && league.status === 'IN_PROGRESS' && (
        <section className="card">
          <button onClick={onAdvanceRound} disabled={busy}>
            Avançar rodada
          </button>
        </section>
      )}

      <section className="card">
        <h2>Classificação</h2>
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Clube</th>
              <th>P</th>
              <th>V</th>
              <th>E</th>
              <th>D</th>
              <th>GP</th>
              <th>GC</th>
              <th>SG</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {league.standings.map((row: StandingRow, i: number) => (
              <tr key={row.clubId}>
                <td>{i + 1}</td>
                <td>{clubLabel(row.clubId)}</td>
                <td>{row.played}</td>
                <td>{row.wins}</td>
                <td>{row.draws}</td>
                <td>{row.losses}</td>
                <td>{row.goalsFor}</td>
                <td>{row.goalsAgainst}</td>
                <td>{row.goalsFor - row.goalsAgainst}</td>
                <td>
                  <strong>{row.points}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      {/* Estatísticas Individuais da Liga */}
      <section className="card league-stats-card">
        <div className="round-card-header">
          <h2>Estatísticas Individuais da Liga</h2>
          <span className="badge-pill-neutral">Temporada Regular</span>
        </div>
        {activeScorers.length === 0 && activeAssistants.length === 0 ? (
          <p className="muted" style={{ margin: '12px 0 4px', textAlign: 'center' }}>
            Nenhum gol ou assistência registrado até o momento nesta edição da liga.
          </p>
        ) : (
          <div className="league-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <GoalNetIcon size={18} color="#38bdf8" /> Artilheiros
              </h3>
              {activeScorers.length === 0 ? (
                <p className="muted">Nenhum gol marcado ainda.</p>
              ) : (
                <div className="scorers-compact-list">
                  {activeScorers.map((s, i) => {
                    const club = s.clubId ? clubInfo[s.clubId] : null;
                    return (
                      <div key={s.playerId} className="scorer-row">
                        <span className="scorer-rank">{i + 1}º</span>
                        <div className="scorer-info">
                          <strong className="scorer-name">{s.playerName}</strong>
                          {club && (
                            <span className="scorer-club">
                              <ClubCrest
                                club={{
                                  id: s.clubId!,
                                  name: club.name,
                                  slug: club.slug ?? null,
                                  crestBase64: club.crestBase64,
                                  primaryColor: club.primaryColor,
                                  secondaryColor: club.secondaryColor,
                                }}
                                size={16}
                              />
                              {club.name}
                            </span>
                          )}
                        </div>
                        <span className="scorer-goals-pill">
                          <strong>{s.goals}</strong> {s.goals === 1 ? 'gol' : 'gols'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AssistBootIcon size={18} color="#38bdf8" /> Garçons (Assistências)
              </h3>
              {activeAssistants.length === 0 ? (
                <p className="muted">Nenhuma assistência registrada ainda.</p>
              ) : (
                <div className="scorers-compact-list">
                  {activeAssistants.map((a, i) => {
                    const club = a.clubId ? clubInfo[a.clubId] : null;
                    return (
                      <div key={a.playerId} className="scorer-row">
                        <span className="scorer-rank">{i + 1}º</span>
                        <div className="scorer-info">
                          <strong className="scorer-name">{a.playerName}</strong>
                          {club && (
                            <span className="scorer-club">
                              <ClubCrest
                                club={{
                                  id: a.clubId!,
                                  name: club.name,
                                  slug: club.slug ?? null,
                                  crestBase64: club.crestBase64,
                                  primaryColor: club.primaryColor,
                                  secondaryColor: club.secondaryColor,
                                }}
                                size={16}
                              />
                              {club.name}
                            </span>
                          )}
                        </div>
                        <span className="scorer-goals-pill">
                          <strong>{a.assists}</strong> {a.assists === 1 ? 'assistência' : 'assistências'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Calendário de Jogos no Formato Tabela/GE */}
      <section className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              disabled={activeRound <= 1}
              onClick={() => changeRound(Math.max(1, activeRound - 1))}
              aria-label="Rodada Anterior"
            >
              ‹ Anterior
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                aria-label="Selecionar rodada"
                value={activeRound}
                onChange={(e) => changeRound(Number(e.target.value))}
                style={{
                  background: '#24202c',
                  color: 'var(--fg)',
                  border: '1px solid #3d364a',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                {rounds.map((r) => (
                  <option key={r} value={r}>
                    Rodada {r} de {rounds.length}
                  </option>
                ))}
              </select>
              {roundStatusLabel && <span className="badge-pill-neutral">{roundStatusLabel}</span>}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              disabled={activeRound >= rounds.length}
              onClick={() => changeRound(Math.min(rounds.length, activeRound + 1))}
              aria-label="Próxima Rodada"
            >
              Próxima ›
            </button>
          </div>

          {activeRound !== currentSeasonRound && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--accent, #d4af37)' }}
              onClick={() => changeRound(currentSeasonRound)}
            >
              Ir para Rodada Atual ({currentSeasonRound}ª)
            </button>
          )}
        </div>

        {fixturesInSelectedRound.length === 0 ? (
          <p className="muted">Nenhum confronto agendado para esta rodada.</p>
        ) : (
          <div className="round-fixtures-list">
            {fixturesInSelectedRound.map((f, idx) => {
              const details = getFixtureDetails(f);
              const isMyMatch = myClubId ? (f.homeClubId === myClubId || f.awayClubId === myClubId) : false;
              const liveMatch = f.matchId ? matches[f.matchId] : null;
              const isLive = liveMatch?.status === 'LIVE';
              const homeClub = clubInfo[f.homeClubId];
              const awayClub = clubInfo[f.awayClubId];

              return (
                <div
                  key={`${f.round}-${f.homeClubId}-${f.awayClubId}-${idx}`}
                  className={`round-fixture-row ${isMyMatch ? 'my-fixture' : ''}`}
                >
                  {/* Home Team */}
                  <div className="fixture-team home">
                    <span className="fixture-team-name">{homeClub?.name ?? f.homeClubId}</span>
                    <ClubCrest
                      club={{
                        id: f.homeClubId,
                        name: homeClub?.name ?? f.homeClubId,
                        slug: homeClub?.slug ?? null,
                        crestBase64: homeClub?.crestBase64,
                        primaryColor: homeClub?.primaryColor,
                        secondaryColor: homeClub?.secondaryColor,
                      }}
                      size={28}
                    />
                  </div>

                  {/* Score / Center Box */}
                  <div className="fixture-score-box">
                    {details.isPlayed ? (
                      <>
                        <div className="fixture-score-values">
                          <span className="score-num">{details.homeGoals ?? 0}</span>
                          <span className="score-divider">x</span>
                          <span className="score-num">{details.awayGoals ?? 0}</span>
                        </div>
                        <span className="badge-pill-neutral" style={{ fontSize: '0.65rem', marginTop: 3 }}>
                          Fim de jogo
                        </span>
                      </>
                    ) : isLive ? (
                      <>
                        <Link to={`/match/${f.matchId}/live`} className="btn-live" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                          ● AO VIVO
                        </Link>
                      </>
                    ) : (
                      <span className="score-pending">A Jogar</span>
                    )}
                    {isMyMatch && <span className="fixture-you-tag">Seu Jogo</span>}
                  </div>

                  {/* Away Team */}
                  <div className="fixture-team away">
                    <ClubCrest
                      club={{
                        id: f.awayClubId,
                        name: awayClub?.name ?? f.awayClubId,
                        slug: awayClub?.slug ?? null,
                        crestBase64: awayClub?.crestBase64,
                        primaryColor: awayClub?.primaryColor,
                        secondaryColor: awayClub?.secondaryColor,
                      }}
                      size={28}
                    />
                    <span className="fixture-team-name">{awayClub?.name ?? f.awayClubId}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export function LeaguePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [league, setLeague] = useState<LeagueWithStandings | null>(null);
  const [clubInfo, setClubInfo] = useState<Record<string, ClubInfo>>({});
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showLineupWarning, setShowLineupWarning] = useState(false);
  const [myClubId, setMyClubId] = useState<string | null>(null);
  const [myClubLeagues, setMyClubLeagues] = useState<LeagueType[]>([]);
  const [stats, setStats] = useState<LeagueStats | null>(null);
  // Só para montar a barra de Competições: a copa do meu clube é o irmão desta tela.
  const [myCups, setMyCups] = useState<Cup[]>([]);

  async function refresh() {
    if (!leagueId) return;
    setLoading(true);
    try {
      const data = await getLeague(leagueId);
      setLeague(data);

      const clubs = await Promise.all(data.clubIds.map((id) => getClub(id).catch(() => null)));
      const info: Record<string, ClubInfo> = {};
      clubs.forEach((c: Club | null, i: number) => {
        if (c) {
          info[data.clubIds[i]] = {
            name: c.name,
            slug: c.slug,
            crestBase64: c.crestBase64,
            primaryColor: c.primaryColor,
            secondaryColor: c.secondaryColor,
          };
        }
      });
      setClubInfo(info);

      listMyClubs()
        .then(async (mine) => {
          const mineId = mine.find((c) => data.clubIds.includes(c.id))?.id ?? null;
          setMyClubId(mineId);
          if (mine.length > 0) {
            setClubInfo((prev) => {
              const updated = { ...prev };
              mine.forEach((mc) => {
                if (updated[mc.id]) {
                  updated[mc.id] = {
                    ...updated[mc.id],
                    crestBase64: mc.crestBase64 ?? updated[mc.id].crestBase64,
                    primaryColor: mc.primaryColor ?? updated[mc.id].primaryColor,
                    secondaryColor: mc.secondaryColor ?? updated[mc.id].secondaryColor,
                  };
                }
              });
              return updated;
            });
          }
          if (mineId) {
            const [cups, allLeagues] = await Promise.all([
              listCups().catch(() => [] as Cup[]),
              listLeagues(data.countryCode).catch(() => [] as LeagueType[]),
            ]);
            setMyCups(cups.filter((c) => c.clubIds.includes(mineId)));
            setMyClubLeagues(allLeagues.filter((l) => l.clubIds.includes(mineId)));
          }
        })
        .catch(() => {});

      const matchIds = data.fixtures.map((f) => f.matchId).filter((id): id is string => !!id);
      const fetchedMatches = await Promise.all(matchIds.map((id) => getMatch(id).catch(() => null)));
      const matchMap: Record<string, Match> = {};
      fetchedMatches.forEach((m) => {
        if (m) matchMap[m.id] = m;
      });
      setMatches(matchMap);
      getLeagueStats(leagueId).then(setStats).catch(() => {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  async function handleForceStart() {
    if (!leagueId) return;
    setBusy(true);
    setError(null);
    try {
      await forceStartLeague(leagueId);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** True if `clubId` is about to have its NEXT round auto-resolved with no lineup of its own choosing —
   *  neither a one-off pending tactic nor a standing default preset. Auto-fill itself stays a fully
   *  supported way to play (a manager who wants a hands-off league is free to never touch Escalação), but
   *  advancing shouldn't silently do that on a manager's very first round without at least asking. */
  async function willAutoFillWithNoLineupSet(clubId: string, currentLeague: LeagueWithStandings): Promise<boolean> {
    const pendingRounds = currentLeague.fixtures.filter((f) => !f.matchId).map((f) => f.round);
    if (pendingRounds.length === 0) return false;
    const round = Math.min(...pendingRounds);
    const hasFixtureThisRound = currentLeague.fixtures.some(
      (f) => f.round === round && !f.matchId && (f.homeClubId === clubId || f.awayClubId === clubId),
    );
    if (!hasFixtureThisRound) return false;

    const [club, presets] = await Promise.all([getClub(clubId), listTacticPresets(clubId)]);
    return !club.pendingRoundTactic && !presets.some((p) => p.isDefault);
  }

  /** Advancing the round creates the manager's own fixture LIVE right away (see `advanceRound` server-side) —
   *  jump straight into watching it instead of leaving the manager to find and click "ao vivo, assistir"
   *  in the calendar below, an extra step for something that's already ready to watch. */
  async function executeAdvanceRound() {
    if (!leagueId || !league) return;
    setShowLineupWarning(false);
    setBusy(true);
    setError(null);
    try {
      const mine = await listMyClubs()
        .then((clubs) => clubs.find((c) => league.clubIds.includes(c.id))?.id ?? null)
        .catch(() => null);
      setMyClubId(mine);

      const matchId = mine ? await goToMatchday(mine) : null;
      if (matchId) {
        navigate(`/match/${matchId}/live`);
        return;
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvanceRound() {
    if (!leagueId || !league) return;
    if (myClubId) {
      const willAutoFill = await willAutoFillWithNoLineupSet(myClubId, league).catch(() => false);
      if (willAutoFill) {
        setShowLineupWarning(true);
        return;
      }
    }
    await executeAdvanceRound();
  }

  if (loading) return <div className="page">Carregando...</div>;
  if (!league) return <div className="page error">{error ?? 'Liga não encontrada'}</div>;

  return (
    <>
      <LeagueView
        league={league}
        clubInfo={clubInfo}
        matches={matches}
        stats={stats}
        myClubId={myClubId}
        myClubLeagues={myClubLeagues}
        myCups={myCups}
        busy={busy}
        error={error}
        onAdvanceRound={handleAdvanceRound}
        onForceStart={handleForceStart}
      />
      <ConfirmModal
        isOpen={showLineupWarning}
        title="Escalação Pendente"
        message="Você ainda não escalou seu time para esta rodada e o clube jogará com escalação automática definida pelos auxiliares. Deseja avançar mesmo assim?"
        confirmLabel="Avançar com Escalação Automática"
        cancelLabel="Voltar e Escalar Time"
        variant="warning"
        onConfirm={executeAdvanceRound}
        onCancel={() => setShowLineupWarning(false)}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Club, Cup, League, Match, StandingRow, PlayerStatsEntry } from '@tactical-arena/shared';
import { getClub, getCup, getLeague, getLeagueStats, getMatch, listMyClubs, tickLiveMatch, type LeagueStats } from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { competitionLogo } from '../lib/competitionLogo.js';

interface ClubInfo {
  id: string;
  name: string;
  slug: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

interface MatchFixtureView {
  fixtureId: string;
  homeClub: ClubInfo;
  awayClub: ClubInfo;
  homeScore?: number;
  awayScore?: number;
  isSimulated: boolean;
  isMyMatch: boolean;
  matchId?: string | null;
  penaltyShootout?: string;
}

export function RoundSummaryPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [match, setMatch] = useState<Match | null>(null);
  const [league, setLeague] = useState<(League & { standings: StandingRow[] }) | null>(null);
  const [cup, setCup] = useState<Cup | null>(null);
  const [leagueStats, setLeagueStats] = useState<LeagueStats | null>(null);
  const [myClubId, setMyClubId] = useState<string | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [roundMatches, setRoundMatches] = useState<MatchFixtureView[]>([]);
  const [clubsMap, setClubsMap] = useState<Record<string, ClubInfo>>({});

  useEffect(() => {
    if (!matchId) return;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const m = await getMatch(matchId!);
        setMatch(m);

        const myClubs = await listMyClubs().catch(() => []);
        const myClub = myClubs.find((c) => c.id === m.homeClubId || c.id === m.awayClubId);
        const userClubId = myClub?.id ?? myClubs[0]?.id ?? null;
        setMyClubId(userClubId);

        let competitionType = m.competitionType;
        let competitionId = m.competitionId;

        // Fallback: If competition info wasn't directly tagged on match, discover from club
        if (!competitionId || !competitionType) {
          const checkClubId = userClubId ?? m.homeClubId ?? m.awayClubId;
          if (checkClubId) {
            const fallbackLeague = await getLeague(checkClubId).catch(() => null);
            if (fallbackLeague && fallbackLeague.fixtures?.length > 0) {
              competitionType = 'league';
              competitionId = fallbackLeague.id;
            } else {
              const fallbackCup = await getCup(checkClubId).catch(() => null);
              if (fallbackCup && fallbackCup.fixtures?.length > 0) {
                competitionType = 'cup';
                competitionId = fallbackCup.id;
              }
            }
          }
        }

        if (competitionType === 'league' && competitionId) {
          let l = await getLeague(competitionId);

          const currentId = matchId ?? '';
          // Find current round
          const currentFixture = l.fixtures.find(
            (f) =>
              f.matchId === currentId ||
              `match_${f.homeClubId}_${f.awayClubId}_${f.round}` === currentId ||
              `${f.homeClubId}_${f.awayClubId}_${f.round}` === currentId ||
              (f.homeClubId === m.homeClubId && f.awayClubId === m.awayClubId),
          );
          const roundFromId = currentId.startsWith('match_') ? Number(currentId.split('_').slice(-1)[0]) : NaN;
          const round = currentFixture?.round ?? (Number.isFinite(roundFromId) ? roundFromId : 1);
          setRoundNumber(round);

          // Fetch all club names and custom crests
          const clubDetails = await Promise.all(l.clubIds.map((id) => getClub(id).catch(() => null)));
          const cMap: Record<string, ClubInfo> = {};
          clubDetails.forEach((c) => {
            if (c) {
              cMap[c.id] = {
                id: c.id,
                name: c.name,
                slug: c.slug,
                crestBase64: c.crestBase64,
                primaryColor: c.primaryColor,
                secondaryColor: c.secondaryColor,
              };
            }
          });
          myClubs.forEach((mc) => {
            if (mc && cMap[mc.id]) {
              cMap[mc.id] = {
                ...cMap[mc.id],
                crestBase64: mc.crestBase64 ?? cMap[mc.id].crestBase64,
                primaryColor: mc.primaryColor ?? cMap[mc.id].primaryColor,
                secondaryColor: mc.secondaryColor ?? cMap[mc.id].secondaryColor,
              };
            }
          });
          setClubsMap(cMap);

          // Fixtures for this round
          const thisRoundFixtures = l.fixtures.filter((f) => f.round === round);
          const matchesToFetch = thisRoundFixtures.map(
            (f) => f.matchId || `match_${f.homeClubId}_${f.awayClubId}_${f.round}`,
          );
          const fetchedMatches = await Promise.all(
            matchesToFetch.map(async (id) => {
              let matchObj = await getMatch(id).catch(() => null);
              if (matchObj && matchObj.status === 'LIVE') {
                matchObj = await tickLiveMatch(id, 90).catch(() => matchObj);
              }
              return matchObj;
            }),
          );

          l = await getLeague(competitionId).catch(() => l);
          setLeague(l);

          const fetchedMap = new Map<string, Match>();
          fetchedMatches.forEach((matchObj) => {
            if (matchObj) {
              fetchedMap.set(matchObj.id, matchObj);
              if (matchObj.homeClubId && matchObj.awayClubId) {
                fetchedMap.set(`match_${matchObj.homeClubId}_${matchObj.awayClubId}_${round}`, matchObj);
              }
            }
          });

          const fixtureViews: MatchFixtureView[] = thisRoundFixtures.map((f, i) => {
            const fallbackId = `match_${f.homeClubId}_${f.awayClubId}_${f.round}`;
            const matchObj = (f.matchId ? fetchedMap.get(f.matchId) : null) ?? fetchedMap.get(fallbackId) ?? null;
            const isThisMatch =
              f.matchId === currentId ||
              fallbackId === currentId ||
              `${f.homeClubId}_${f.awayClubId}_${f.round}` === currentId ||
              (f.homeClubId === m.homeClubId && f.awayClubId === m.awayClubId);

            const homeScore =
              f.result?.homeGoals ??
              matchObj?.result?.homeGoals ??
              (isThisMatch ? m.result?.homeGoals : undefined);

            const awayScore =
              f.result?.awayGoals ??
              matchObj?.result?.awayGoals ??
              (isThisMatch ? m.result?.awayGoals : undefined);

            const isSimulated =
              f.result != null ||
              matchObj?.status === 'SIMULATED' ||
              matchObj?.result !== undefined ||
              (homeScore !== undefined && awayScore !== undefined);

            const isMyMatch = f.homeClubId === userClubId || f.awayClubId === userClubId;
            const shootout =
              (f.result as any)?.penaltyShootout || matchObj?.result?.penaltyShootout
                ? `(${((f.result as any)?.penaltyShootout ?? matchObj?.result?.penaltyShootout).homeScore} x ${((f.result as any)?.penaltyShootout ?? matchObj?.result?.penaltyShootout).awayScore} pen)`
                : undefined;

            const resolveClubInfo = (clubId: string, defaultName: string): ClubInfo => {
              if (cMap[clubId]) return cMap[clubId];
              const mine = myClubs.find((mc) => mc.id === clubId);
              if (mine) {
                return {
                  id: mine.id,
                  name: mine.name,
                  slug: mine.slug,
                  crestBase64: mine.crestBase64,
                  primaryColor: mine.primaryColor,
                  secondaryColor: mine.secondaryColor,
                };
              }
              return { id: clubId, name: defaultName, slug: null };
            };

            return {
              fixtureId: `${round}-${i}`,
              homeClub: resolveClubInfo(f.homeClubId, 'Mandante'),
              awayClub: resolveClubInfo(f.awayClubId, 'Visitante'),
              homeScore,
              awayScore,
              isSimulated,
              isMyMatch,
              matchId: f.matchId ?? fallbackId,
              penaltyShootout: shootout,
            };
          });

          setRoundMatches(fixtureViews);

          // League Stats (Top Scorers)
          getLeagueStats(l.id).then(setLeagueStats).catch(() => {});
        } else if (competitionType === 'cup' && competitionId) {
          let c = await getCup(competitionId);

          const currentId = matchId ?? '';
          const currentFixture = c.fixtures.find(
            (f) =>
              f.matchId === currentId ||
              `match_${f.homeClubId}_${f.awayClubId}_${f.round}` === currentId ||
              `${f.homeClubId}_${f.awayClubId}_${f.round}` === currentId ||
              (f.homeClubId === m.homeClubId && f.awayClubId === m.awayClubId),
          );
          const roundFromId = currentId.startsWith('match_') ? Number(currentId.split('_').slice(-1)[0]) : NaN;
          const round = currentFixture?.round ?? (Number.isFinite(roundFromId) ? roundFromId : 1);
          setRoundNumber(round);

          const clubDetails = await Promise.all(c.clubIds.map((id) => getClub(id).catch(() => null)));
          const cMap: Record<string, ClubInfo> = {};
          clubDetails.forEach((clubObj) => {
            if (clubObj) {
              cMap[clubObj.id] = {
                id: clubObj.id,
                name: clubObj.name,
                slug: clubObj.slug,
                crestBase64: clubObj.crestBase64,
                primaryColor: clubObj.primaryColor,
                secondaryColor: clubObj.secondaryColor,
              };
            }
          });
          myClubs.forEach((mc) => {
            if (mc && cMap[mc.id]) {
              cMap[mc.id] = {
                ...cMap[mc.id],
                crestBase64: mc.crestBase64 ?? cMap[mc.id].crestBase64,
                primaryColor: mc.primaryColor ?? cMap[mc.id].primaryColor,
                secondaryColor: mc.secondaryColor ?? cMap[mc.id].secondaryColor,
              };
            }
          });
          setClubsMap(cMap);

          const thisRoundFixtures = c.fixtures.filter((f) => f.round === round);
          const matchesToFetch = thisRoundFixtures.map(
            (f) => f.matchId || `match_${f.homeClubId}_${f.awayClubId}_${f.round}`,
          );
          const fetchedMatches = await Promise.all(
            matchesToFetch.map(async (id) => {
              let matchObj = await getMatch(id).catch(() => null);
              if (matchObj && matchObj.status === 'LIVE') {
                matchObj = await tickLiveMatch(id, 90).catch(() => matchObj);
              }
              return matchObj;
            }),
          );

          c = await getCup(competitionId).catch(() => c);
          setCup(c);

          const fetchedMap = new Map<string, Match>();
          fetchedMatches.forEach((matchObj) => {
            if (matchObj) {
              fetchedMap.set(matchObj.id, matchObj);
              if (matchObj.homeClubId && matchObj.awayClubId) {
                fetchedMap.set(`match_${matchObj.homeClubId}_${matchObj.awayClubId}_${round}`, matchObj);
              }
            }
          });

          const fixtureViews: MatchFixtureView[] = thisRoundFixtures.map((f, i) => {
            const fallbackId = `match_${f.homeClubId}_${f.awayClubId}_${f.round}`;
            const matchObj = (f.matchId ? fetchedMap.get(f.matchId) : null) ?? fetchedMap.get(fallbackId) ?? null;
            const isThisMatch =
              f.matchId === currentId ||
              fallbackId === currentId ||
              `${f.homeClubId}_${f.awayClubId}_${f.round}` === currentId ||
              (f.homeClubId === m.homeClubId && f.awayClubId === m.awayClubId);

            const homeScore =
              matchObj?.result?.homeGoals ??
              (isThisMatch ? m.result?.homeGoals : undefined);

            const awayScore =
              matchObj?.result?.awayGoals ??
              (isThisMatch ? m.result?.awayGoals : undefined);

            const isSimulated =
              Boolean(f.winnerClubId) ||
              matchObj?.status === 'SIMULATED' ||
              matchObj?.result !== undefined ||
              (homeScore !== undefined && awayScore !== undefined);

            const isMyMatch = f.homeClubId === userClubId || f.awayClubId === userClubId;
            const shootout =
              f.wentToPenalties && f.penaltyScore
                ? `(${f.penaltyScore.home} x ${f.penaltyScore.away} pen)`
                : matchObj?.result?.penaltyShootout
                  ? `(${matchObj.result.penaltyShootout.homeScore} x ${matchObj.result.penaltyShootout.awayScore} pen)`
                  : undefined;

            const resolveClubInfo = (clubId: string, defaultName: string): ClubInfo => {
              if (cMap[clubId]) return cMap[clubId];
              const mine = myClubs.find((mc) => mc.id === clubId);
              if (mine) {
                return {
                  id: mine.id,
                  name: mine.name,
                  slug: mine.slug,
                  crestBase64: mine.crestBase64,
                  primaryColor: mine.primaryColor,
                  secondaryColor: mine.secondaryColor,
                };
              }
              return { id: clubId, name: defaultName, slug: null };
            };

            return {
              fixtureId: `${round}-${i}`,
              homeClub: resolveClubInfo(f.homeClubId, 'Mandante'),
              awayClub: resolveClubInfo(f.awayClubId, 'Visitante'),
              homeScore,
              awayScore,
              isSimulated,
              isMyMatch,
              matchId: f.matchId ?? fallbackId,
              penaltyShootout: shootout,
            };
          });

          setRoundMatches(fixtureViews);
        } else {
          // Friendly / Exhibition match fallback
          const homeClubDetails = m.homeClubId ? await getClub(m.homeClubId).catch(() => null) : null;
          const awayClubDetails = m.awayClubId ? await getClub(m.awayClubId).catch(() => null) : null;

          const homeClub: ClubInfo = homeClubDetails
            ? {
                id: homeClubDetails.id,
                name: homeClubDetails.name,
                slug: homeClubDetails.slug,
                crestBase64: homeClubDetails.crestBase64,
                primaryColor: homeClubDetails.primaryColor,
                secondaryColor: homeClubDetails.secondaryColor,
              }
            : { id: m.homeClubId ?? 'home', name: (m as any).homeTeam?.name ?? 'Mandante', slug: null };

          const awayClub: ClubInfo = awayClubDetails
            ? {
                id: awayClubDetails.id,
                name: awayClubDetails.name,
                slug: awayClubDetails.slug,
                crestBase64: awayClubDetails.crestBase64,
                primaryColor: awayClubDetails.primaryColor,
                secondaryColor: awayClubDetails.secondaryColor,
              }
            : { id: m.awayClubId ?? 'away', name: (m as any).awayTeam?.name ?? 'Visitante', slug: null };

          setClubsMap({ [homeClub.id]: homeClub, [awayClub.id]: awayClub });
          setRoundMatches([
            {
              fixtureId: 'friendly-0',
              homeClub,
              awayClub,
              homeScore: m.result?.homeGoals,
              awayScore: m.result?.awayGoals,
              isSimulated: m.status === 'SIMULATED' || m.result !== undefined,
              isMyMatch: true,
              matchId: m.id,
              penaltyShootout: m.result?.penaltyShootout
                ? `(${m.result.penaltyShootout.homeScore} x ${m.result.penaltyShootout.awayScore} pen)`
                : undefined,
            },
          ]);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [matchId]);

  if (loading) return <div className="page">Carregando resumo da rodada...</div>;
  if (error || !match) return <div className="page error">{error ?? 'Partida não encontrada'}</div>;

  const competitionTitle = league
    ? `${league.name} (Divisão ${league.division})`
    : cup
      ? cup.name
      : 'Amistoso';

  const logoSrc = league
    ? competitionLogo(league.name)
    : cup
      ? competitionLogo(cup.name)
      : null;

  return (
    <div className="page round-summary-page">
      {/* Top Header */}
      <header className="topbar round-summary-topbar">
        <div className="round-summary-heading">
          {logoSrc && <img src={logoSrc} alt="" className="round-summary-logo" />}
          <div>
            <span className="round-summary-badge">Fim da Rodada</span>
            <h1>{competitionTitle} • Rodada {roundNumber}</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => navigate(myClubId ? `/clubs/${myClubId}` : '/dashboard')}
          >
            Avançar
          </button>
        </div>
      </header>

      {/* Main 2-Column Dashboard */}
      <div className="round-summary-grid">
        {/* Left Column: Rodada de Jogos (Resultados) */}
        <div className="round-summary-col">
          <div className="card round-results-card">
            <div className="round-card-header">
              <h2>Resultados da {roundNumber}ª Rodada</h2>
              <span className="badge-pill-neutral">{roundMatches.length} jogos</span>
            </div>

            <div className="round-fixtures-list">
              {roundMatches.map((f) => (
                <div
                  key={f.fixtureId}
                  className={`round-fixture-row ${f.isMyMatch ? 'my-fixture' : ''}`}
                >
                  {/* Home Team */}
                  <div className="fixture-team home">
                    <span className="fixture-team-name">{f.homeClub.name}</span>
                    <ClubCrest club={f.homeClub} size={28} />
                  </div>

                  {/* Score */}
                  <div className="fixture-score-box">
                    {f.isSimulated ? (
                      <div className="fixture-score-values">
                        <span className="score-num">{f.homeScore ?? 0}</span>
                        <span className="score-divider">x</span>
                        <span className="score-num">{f.awayScore ?? 0}</span>
                      </div>
                    ) : (
                      <span className="score-pending">Aguardando</span>
                    )}
                    {f.penaltyShootout && <span className="fixture-shootout-tag">{f.penaltyShootout}</span>}
                    {f.isMyMatch && <span className="fixture-you-tag">Seu Jogo</span>}
                  </div>

                  {/* Away Team */}
                  <div className="fixture-team away">
                    <ClubCrest club={f.awayClub} size={28} />
                    <span className="fixture-team-name">{f.awayClub.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Classificação Atualizada & Artilheiros */}
        <div className="round-summary-col">
          {league?.standings && league.standings.length > 0 && (
            <div className="card round-standings-card">
              <div className="round-card-header">
                <h2>Classificação Atualizada</h2>
                <Link to={`/league/${league.id}`} className="link-see-more">
                  Ver Tabela Completa
                </Link>
              </div>

              <div className="table-wrapper">
                <table className="standings-table compact-table">
                  <thead>
                    <tr>
                      <th className="num-col">#</th>
                      <th>Clube</th>
                      <th className="num-col" title="Pontos">P</th>
                      <th className="num-col" title="Jogos">J</th>
                      <th className="num-col" title="Vitórias">V</th>
                      <th className="num-col" title="Empates">E</th>
                      <th className="num-col" title="Derrotas">D</th>
                      <th className="num-col" title="Saldo de Gols">SG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {league.standings.map((row, idx) => {
                      const pos = idx + 1;
                      const club = clubsMap[row.clubId];
                      const isMyClub = row.clubId === myClubId;
                      const isG4 = pos <= 4;
                      const isRelegation = pos > league.standings.length - 4 && league.standings.length > 8;
                      const goalDiff = row.goalsFor - row.goalsAgainst;

                      return (
                        <tr
                          key={row.clubId}
                          className={`${isMyClub ? 'my-club-row' : ''} ${isG4 ? 'zone-g4' : isRelegation ? 'zone-z4' : ''}`}
                        >
                          <td className="num-col font-bold">
                            <span className="pos-badge">{pos}</span>
                          </td>
                          <td className="club-cell">
                            {club && <ClubCrest club={club} size={20} />}
                            <span className="club-name-text">{club?.name ?? row.clubId}</span>
                            {isMyClub && <span className="you-pill">Você</span>}
                          </td>
                          <td className="num-col font-bold points-col">{row.points}</td>
                          <td className="num-col muted">{row.played}</td>
                          <td className="num-col">{row.wins}</td>
                          <td className="num-col">{row.draws}</td>
                          <td className="num-col">{row.losses}</td>
                          <td className={`num-col sg-col ${goalDiff > 0 ? 'pos' : goalDiff < 0 ? 'neg' : ''}`}>
                            {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Scorers Card */}
          {leagueStats?.topScorers && leagueStats.topScorers.length > 0 && (
            <div className="card round-scorers-card">
              <div className="round-card-header">
                <h2>Principais Artilheiros</h2>
                <span className="badge-pill-neutral">Gols</span>
              </div>

              <div className="scorers-compact-list">
                {leagueStats.topScorers.slice(0, 5).map((scorer: PlayerStatsEntry, i: number) => {
                  const club = scorer.clubId ? clubsMap[scorer.clubId] : null;
                  return (
                    <div key={scorer.playerId} className="scorer-row">
                      <span className="scorer-rank">{i + 1}º</span>
                      <div className="scorer-info">
                        <strong className="scorer-name">{scorer.playerName}</strong>
                        {club && (
                          <span className="scorer-club">
                            <ClubCrest club={club} size={16} />
                            {club.name}
                          </span>
                        )}
                      </div>
                      <span className="scorer-goals-pill">
                        <strong>{scorer.goals}</strong> {scorer.goals === 1 ? 'gol' : 'gols'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Dock */}
      <div className="round-summary-bottom-dock">
        <button
          type="button"
          className="btn-round-continue"
          onClick={() => navigate(myClubId ? `/clubs/${myClubId}` : '/dashboard')}
        >
          Continuar / Próxima Rodada
        </button>
      </div>
    </div>
  );
}

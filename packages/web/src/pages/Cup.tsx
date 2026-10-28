import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Club, Cup as CupType, Match } from '@tactical-arena/shared';
import { getActiveLeague, getClub, getCup, getMatch, listMyClubs, listTacticPresets } from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { ContinentalGroupStage } from '../components/ContinentalGroupStage.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { competitionLogo } from '../lib/competitionLogo.js';
import { goToMatchday } from '../lib/goToMatchday';
import { TrophyIcon, ArrowLeftIcon, HomeIcon } from '../components/icons/AppIcons.js';

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

const ROUND_NAMES: Record<number, string> = {
  1: 'Quartas de final',
  2: 'Semifinal',
  3: 'Final',
};

function roundName(round: number, totalRounds: number): string {
  // Named from the final backwards, so it still reads right for brackets bigger than 8 (round of 16, etc.).
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quartas de final';
  return `${ROUND_NAMES[round] ?? `Rodada ${round}`}`;
}

export function CupPage() {
  const { cupId } = useParams<{ cupId: string }>();
  const navigate = useNavigate();
  const [cup, setCup] = useState<CupType | null>(null);
  const [clubInfo, setClubInfo] = useState<Record<string, ClubInfo>>({});
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showLineupWarning, setShowLineupWarning] = useState(false);
  const [myClubId, setMyClubId] = useState<string | null>(null);
  // Só para montar a barra de Competições: a liga do meu clube é o irmão desta tela.
  const [myLeagueId, setMyLeagueId] = useState<string | null>(null);

  async function refresh() {
    if (!cupId) return;
    setLoading(true);
    try {
      const data = await getCup(cupId);
      setCup(data);
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
            const active = await getActiveLeague(mineId).catch(() => null);
            setMyLeagueId(active?.id ?? null);
          }
        })
        .catch(() => {});

      // Only fixtures without a winner yet can still be live — no point re-fetching decided ones.
      const pendingMatchIds = data.fixtures.filter((f) => f.matchId && !f.winnerClubId).map((f) => f.matchId as string);
      const fetchedMatches = await Promise.all(pendingMatchIds.map((id) => getMatch(id).catch(() => null)));
      const matchMap: Record<string, Match> = {};
      fetchedMatches.forEach((m) => {
        if (m) matchMap[m.id] = m;
      });
      setMatches(matchMap);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cupId]);

  /** True if `clubId`'s next tie is about to be auto-resolved with no default preset of its own — cup
   *  fixtures never consult a one-off pending tactic (only leagues have that concept), just the standing
   *  default preset (see cupService.resolveCupTactic). */
  async function willAutoFillWithNoLineupSet(clubId: string, currentCup: CupType): Promise<boolean> {
    const pendingRounds = currentCup.fixtures.filter((f) => !f.winnerClubId).map((f) => f.round);
    if (pendingRounds.length === 0) return false;
    const round = Math.min(...pendingRounds);
    const hasFixtureThisRound = currentCup.fixtures.some(
      (f) => f.round === round && !f.winnerClubId && (f.homeClubId === clubId || f.awayClubId === clubId),
    );
    if (!hasFixtureThisRound) return false;

    const presets = await listTacticPresets(clubId);
    return !presets.some((p) => p.isDefault);
  }

  /** Advancing the round creates the manager's own fixture LIVE right away (see `advanceRound` server-side) —
   *  jump straight into watching it instead of leaving the manager to find and click "ao vivo, assistir"
   *  in the bracket below, an extra step for something that's already ready to watch. */
  async function executeAdvanceRound() {
    if (!cupId || !cup) return;
    setShowLineupWarning(false);
    setBusy(true);
    setError(null);
    try {
      const mine = await listMyClubs()
        .then((clubs) => clubs.find((c) => cup.clubIds.includes(c.id))?.id ?? null)
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
    if (!cupId || !cup) return;
    if (myClubId) {
      const willAutoFill = await willAutoFillWithNoLineupSet(myClubId, cup).catch(() => false);
      if (willAutoFill) {
        setShowLineupWarning(true);
        return;
      }
    }
    await executeAdvanceRound();
  }

  if (loading) return <div className="page">Carregando...</div>;
  if (!cup) return <div className="page error">{error ?? 'Copa não encontrada'}</div>;

  const totalRounds = Math.round(Math.log2(cup.clubIds.length));
  const rounds = [...new Set(cup.fixtures.map((f) => f.round))].sort((a, b) => a - b);

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
        size={20}
      />
      {clubInfo[id]?.name ?? id}
    </span>
  );

  const logo = competitionLogo(cup.name);

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="crest-name">
          {logo && <img src={logo} alt="" className="competition-logo" />}
          {cup.name}
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

      {/* Mesma barra da tabela: a copa também vive fora da hierarquia do clube e precisava de saída. */}
      {myClubId && (
        <HubSubnav
          hub="competitions"
          clubId={myClubId}
          active={cup.id}
          extraItems={[
            ...(myLeagueId ? [{ key: 'league', label: 'Tabela', to: `/league/${myLeagueId}` }] : []),
            { key: cup.id, label: cup.name, to: `/cup/${cup.id}` },
          ]}
        />
      )}

      {error && <p className="error">{error}</p>}

      {cup.status === 'FINISHED' && cup.championClubId && (
        <section className="card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrophyIcon size={20} color="#fbbf24" /> Campeão
          </h2>
          <p>{clubLabel(cup.championClubId)}</p>
        </section>
      )}

      {DEV_CONTROLS && cup.status === 'IN_PROGRESS' && (
        <section className="card">
          <button onClick={handleAdvanceRound} disabled={busy}>
            {busy ? 'Simulando...' : 'Avançar rodada'}
          </button>
        </section>
      )}

      {/* Fase de Grupos se houver fixtures com 'Grupo' */}
      {(() => {
        const groupFixtures = cup.fixtures.filter((f) => f.stageName?.includes('Grupo'));
        if (groupFixtures.length === 0) return null;

        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
        const groups = letters.map((letter) => {
          const fixturesForLetter = groupFixtures.filter((f) => f.stageName?.includes(`Grupo ${letter}`));
          const clubIdsInGroup = Array.from(new Set(fixturesForLetter.flatMap((f) => [f.homeClubId, f.awayClubId]))).filter(Boolean);

          const standings = clubIdsInGroup.map((clubId) => {
            let played = 0, won = 0, drawn = 0, lost = 0, goalsFor = 0, goalsAgainst = 0, points = 0;
            fixturesForLetter.forEach((fix) => {
              if (!fix.matchId) return;
              const match = matches[fix.matchId];
              if (!match || (match.status !== 'SIMULATED' && !match.result)) return;
              const isHome = fix.homeClubId === clubId;
              const isAway = fix.awayClubId === clubId;
              if (!isHome && !isAway) return;

              played += 1;
              const gf = isHome ? (match.result?.homeGoals ?? match.live?.homeGoals ?? 0) : (match.result?.awayGoals ?? match.live?.awayGoals ?? 0);
              const ga = isHome ? (match.result?.awayGoals ?? match.live?.awayGoals ?? 0) : (match.result?.homeGoals ?? match.live?.homeGoals ?? 0);
              goalsFor += gf;
              goalsAgainst += ga;

              if (gf > ga) { won += 1; points += 3; }
              else if (gf < ga) { lost += 1; }
              else { drawn += 1; points += 1; }
            });

            return {
              clubId,
              played,
              won,
              drawn,
              lost,
              goalsFor,
              goalsAgainst,
              goalDifference: goalsFor - goalsAgainst,
              points,
            };
          }).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            return b.goalsFor - a.goalsFor;
          });

          return {
            letter,
            clubIds: clubIdsInGroup,
            standings,
            fixtures: fixturesForLetter,
          };
        }).filter((g) => g.clubIds.length > 0);

        return groups.length > 0 ? <ContinentalGroupStage groups={groups} clubInfo={clubInfo} /> : null;
      })()}

      {rounds.map((round) => {
        const roundFixtures = cup.fixtures.filter((f) => f.round === round && !f.stageName?.includes('Grupo'));
        if (roundFixtures.length === 0) return null;
        const stageHeading = roundFixtures[0]?.stageName ?? roundName(round, totalRounds);

        return (
          <section className="card" key={round}>
            <h2>{stageHeading}</h2>
            <ul className="club-list">
              {roundFixtures.map((f, i) => {
                const match = f.matchId ? matches[f.matchId] : null;
                const isDecided = f.winnerClubId !== null && f.winnerClubId !== '__LEG1__';
                const isLeg1Done = f.winnerClubId === '__LEG1__';

                return (
                  <li key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <span className={isDecided && f.winnerClubId === f.homeClubId ? 'highlight-winner' : isDecided ? 'muted' : ''}>
                          {clubLabel(f.homeClubId)}
                        </span>
                        {' vs '}
                        <span className={isDecided && f.winnerClubId === f.awayClubId ? 'highlight-winner' : isDecided ? 'muted' : ''}>
                          {clubLabel(f.awayClubId)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {f.leg && <span className="badge" style={{ fontSize: '0.75rem', background: '#334155' }}>{f.leg === 1 ? 'Ida' : 'Volta'}</span>}

                        {f.matchId && isDecided && (
                          <span className="muted">
                            {f.aggregateScore && (
                              <strong style={{ color: '#38bdf8', marginRight: 6 }}>
                                [Agr: {f.aggregateScore.home}x{f.aggregateScore.away}]
                              </strong>
                            )}
                            • Classificado: <strong style={{ color: '#22c55e' }}>{clubInfo[f.winnerClubId!]?.name ?? f.winnerClubId}</strong>
                            {f.wentToPenalties && (
                              <span className="badge-pens" style={{ marginLeft: 4 }}>
                                (pên. {f.penaltyScore ? `${f.penaltyScore.home}x${f.penaltyScore.away}` : ''})
                              </span>
                            )}
                            {' '}
                            <Link to={`/match/${f.matchId}/result`} className="btn-details-link" style={{ marginLeft: 6 }}>
                              [súmula]
                            </Link>
                          </span>
                        )}

                        {f.matchId && isLeg1Done && (
                          <span className="muted">
                            {f.firstLegScore && (
                              <strong style={{ color: '#f59e0b', marginRight: 6 }}>
                                [Placar: {f.firstLegScore.home}x{f.firstLegScore.away}]
                              </strong>
                            )}
                            <Link to={`/match/${f.matchId}/result`} className="btn-details-link">
                              [súmula ida]
                            </Link>
                          </span>
                        )}

                        {f.matchId && !f.winnerClubId && match?.status === 'LIVE' && (
                          <Link to={`/match/${f.matchId}/live`} className="btn-live">
                            ● ao vivo, assistir
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <ConfirmModal
        isOpen={showLineupWarning}
        title="Escalação Pendente"
        message="Você ainda não escalou seu time para esta fase eliminatória e o clube jogará com escalação automática definida pelos auxiliares. Deseja avançar mesmo assim?"
        confirmLabel="Avançar com Escalação Automática"
        cancelLabel="Voltar e Escalar Time"
        variant="warning"
        onConfirm={executeAdvanceRound}
        onCancel={() => setShowLineupWarning(false)}
      />
    </div>
  );
}

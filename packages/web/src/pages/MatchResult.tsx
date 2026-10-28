import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Club, Evaluation, Match, MatchEvent, MatchResult as MatchResultData, MatchSide, Player, Tactic, CombatBonusBreakdown } from '@tactical-arena/shared';
import {
  buildPressingReport,
  calculateMatchRatings,
  findManOfTheMatch,
  pressingOf,
  generatePostMatchInsights,
  generateTacticalMatchReport,
  formatMatchEventMinute,
  calculateMatchBroadcastPayout,
  resolveMatchBroadcaster,
  calculateCombatPerformanceBonus,
} from '@tactical-arena/shared';
import { getClub, getMatch, listMyClubs, listSaves, type ClockFormat } from '../api/client.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { BroadcastLogo } from '../components/BroadcastLogo.js';
import { GoalCelebrationOverlay } from '../components/GoalCelebrationOverlay.js';
import { MatchStatsPanel } from '../components/MatchStatsPanel.js';
import { PostMatchInsightsCard } from '../components/PostMatchInsightsCard.js';
import { TacticalRolePerformanceCard } from '../components/TacticalRolePerformanceCard.js';
import { eventIcon, eventVariant } from '../lib/matchEventDisplay.js';
import { positionLabel } from '../lib/positionLabel.js';
import {
  MatchTimelineBar,
  PenaltyShootoutGridWidget,
  MatchNarrativeReplayWidget,
} from '../components/MatchDramaWidgets.js';
import { TrophyIcon, AssistBootIcon, SwordsIcon, BrainIcon } from '../components/icons/AppIcons.js';

/**
 * The single lance that best explains how the match was decided — the eventual winner's last goal (the one
 * that sealed it), or the last goal overall in a draw. Falls back to the last red card if there was no goal
 * at all, since going a man down is the next-most decisive thing that can happen in a scoreless match.
 * Deliberately a simple heuristic (not a full score-progression replay) — good enough to headline the report
 * without tracking every lead change.
 */
function decisiveMoment(result: MatchResultData): MatchEvent | null {
  const goals = result.events.filter((e) => e.type === 'goal');
  if (goals.length === 0) {
    const reds = result.events.filter((e) => e.type === 'card' && e.suspensionMatches);
    return reds[reds.length - 1] ?? null;
  }
  if (result.homeGoals === result.awayGoals) {
    return goals[goals.length - 1];
  }
  const winner: MatchSide = result.homeGoals > result.awayGoals ? 'home' : 'away';
  const winnerGoals = goals.filter((g) => g.team === winner);
  return winnerGoals[winnerGoals.length - 1] ?? goals[goals.length - 1];
}

/**
 * Every player from this side who actually featured in the match — the starting XI plus anyone who came
 * on as a substitute — for the ratings report. Deliberately not the shared `resolveLineupPlayers`, which
 * validates suspension against the club's *current* state and would throw here: a red card in this very
 * match sets the suspension immediately after full time, which would otherwise poison the report trying
 * to display that same match.
 */
function playersWhoFeatured(club: Club, tactic: Tactic, events: MatchEvent[], side: MatchSide): Player[] {
  const byId = new Map(club.players.map((p) => [p.id, p]));
  const startersIds = tactic.lineup.map((slot) => slot.playerId);
  const subInIds = events.filter((e) => e.type === 'substitution' && e.team === side).map((e) => e.relatedPlayerId).filter((id): id is string => !!id);
  const allIds = [...new Set([...startersIds, ...subInIds])];
  return allIds.map((id) => byId.get(id)).filter((p): p is Player => !!p);
}

const POLL_INTERVAL_MS = 2000;
const PLAYBACK_INTERVAL_MS = 400;
const GOAL_PLAYBACK_PAUSE_MS = 1800;
const GOAL_BANNER_DURATION_MS = 1600;

export function MatchResultPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [homeClub, setHomeClub] = useState<Club | null>(null);
  const [awayClub, setAwayClub] = useState<Club | null>(null);
  const [myClubId, setMyClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleEvents, setVisibleEvents] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clockFormat, setClockFormat] = useState<ClockFormat>('HALF_45');
  /**
   * The goal being celebrated right now — the event alone, not the club that scored it.
   *
   * Storing the club here used to freeze it: the playback chain resolves each step inside a `setTimeout`
   * closure created when the manager pressed play, so a replay started before `getClub` had resolved
   * carried `null` clubs through every goal in it and showed the whole thing without crests. Keeping only
   * the event means the club is looked up at render time, from whatever has loaded by then.
   */
  const [celebrating, setCelebrating] = useState<MatchEvent | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!matchId) return;

    async function poll() {
      try {
        const data = await getMatch(matchId!);
        if (data.status === 'LIVE') {
          if (pollRef.current) clearInterval(pollRef.current);
          navigate(`/match/${matchId}/live`);
          return;
        }
        setMatch(data);
        if (data.status === 'SIMULATED' && pollRef.current) {
          clearInterval(pollRef.current);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    }

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [matchId]);

  useEffect(() => {
    if (!match) return;
    getClub(match.homeClubId).then(setHomeClub).catch(() => {});
    getClub(match.awayClubId).then(setAwayClub).catch(() => {});
    listMyClubs()
      .then((mine) => setMyClubId(mine.find((c) => c.id === match.homeClubId || c.id === match.awayClubId)?.id ?? null))
      .catch(() => {});
    listSaves()
      .then((res: any) => {
        if (res.currentManager?.clockFormat) {
          setClockFormat(res.currentManager.clockFormat);
        }
      })
      .catch(() => {});

  }, [match?.homeClubId, match?.awayClubId]);

  function scheduleNext(index: number, total: number, events: MatchEvent[]) {
    if (index >= total) {
      setPlaying(false);
      return;
    }
    const upcoming = events[index];
    const delay = upcoming.type === 'goal' ? GOAL_PLAYBACK_PAUSE_MS : PLAYBACK_INTERVAL_MS;
    playTimeoutRef.current = setTimeout(() => {
      setVisibleEvents(index + 1);
      if (upcoming.type === 'goal') {
        setCelebrating(upcoming);
        if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
        celebrationTimeoutRef.current = setTimeout(() => setCelebrating(null), GOAL_BANNER_DURATION_MS);
      }
      scheduleNext(index + 1, total, events);
    }, delay);
  }

  function startPlayback() {
    if (!match?.result) return;
    setPlaying(true);
    setVisibleEvents(0);
    setCelebrating(null);
    scheduleNext(0, match.result.events.length, match.result.events);
  }

  useEffect(() => {
    return () => {
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    };
  }, []);

  if (error) return <div className="page error">{error}</div>;
  if (!match) return <div className="page">Carregando...</div>;

  if (match.status === 'WAITING_TACTICS') {
    return (
      <div className="page">
        <header className="topbar">
          <h1>Aguardando os dois técnicos...</h1>
          <div className="topbar-actions">
            <Link
              className="home-button"
              to={myClubId ? `/clubs/${myClubId}` : '/dashboard'}
              title="Ir para a página inicial"
              aria-label="Ir para a página inicial"
            >
              <img src="/icons/home.webp" alt="" aria-hidden="true" />
            </Link>
          </div>
        </header>
        <p className="muted">Esta página atualiza automaticamente assim que a partida for simulada.</p>
      </div>
    );
  }

  const result = match.result!;
  const shownEvents = result.events.slice(0, visibleEvents);
  const runningHomeGoals = visibleEvents === 0 ? result.homeGoals : shownEvents.filter((e) => e.type === 'goal' && e.team === 'home').length;
  const runningAwayGoals = visibleEvents === 0 ? result.awayGoals : shownEvents.filter((e) => e.type === 'goal' && e.team === 'away').length;
  // Resolved here rather than captured when the goal fired, so a crest that finished loading mid-replay
  // still shows up on the banner (see `celebrating`).
  const celebratingClub = celebrating ? (celebrating.team === 'home' ? homeClub : awayClub) : null;

  // "Notas dos jogadores" — the scoreboard above already shows the final score immediately (playback is
  // just an optional highlight replay on top), so the ratings report is available right away too.
  const ratings =
    homeClub && awayClub && match.homeTactic && match.awayTactic
      ? calculateMatchRatings(
          playersWhoFeatured(homeClub, match.homeTactic, result.events, 'home'),
          playersWhoFeatured(awayClub, match.awayTactic, result.events, 'away'),
          result.events,
          result.homeGoals,
          result.awayGoals,
        )
      : null;
  const manOfTheMatch = ratings ? findManOfTheMatch(ratings.home, ratings.away, result.homeGoals, result.awayGoals) : null;
  const decisive = decisiveMoment(result);
  const broadcaster = match.broadcaster ?? resolveMatchBroadcaster(match.competitionId ?? 'default', 1, 14, false, match.seed);
  const isMyClubHome = myClubId === homeClub?.id;
  const isMyClubAway = myClubId === awayClub?.id;
  const isMyMatch = isMyClubHome || isMyClubAway;
  const myPayout = isMyMatch && broadcaster ? calculateMatchBroadcastPayout(broadcaster, isMyClubHome) : null;

  const mySide: MatchSide | null = isMyClubHome ? 'home' : isMyClubAway ? 'away' : null;
  const myClub = isMyClubHome ? homeClub : isMyClubAway ? awayClub : null;
  const oppClub = isMyClubHome ? awayClub : isMyClubAway ? homeClub : null;

  const combatBonus: CombatBonusBreakdown | null =
    mySide && myClub && oppClub
      ? calculateCombatPerformanceBonus({
          events: result.events,
          mySide,
          myGoals: mySide === 'home' ? result.homeGoals : result.awayGoals,
          opponentGoals: mySide === 'home' ? result.awayGoals : result.homeGoals,
          pressRecoveries:
            (mySide === 'home' ? result.stats?.home?.pressRecoveries : result.stats?.away?.pressRecoveries) ?? 0,
          isUnderdog:
            myClub.players.length > 0 && oppClub.players.length > 0
              ? myClub.players.reduce((sum, p) => sum + p.overall, 0) / myClub.players.length <
                oppClub.players.reduce((sum, p) => sum + p.overall, 0) / oppClub.players.length - 3
              : false,
        })
      : null;

  return (
    <div className="page">
      <header className="topbar">
        <h1>Resultado da partida</h1>
      </header>

      {celebrating && celebratingClub && (
        <GoalCelebrationOverlay
          key={visibleEvents}
          event={celebrating}
          club={celebratingClub}
          scoreline={`${runningHomeGoals} x ${runningAwayGoals}`}
          onDismiss={() => setCelebrating(null)}
        />
      )}

      <div className="card scoreboard">
        <span className="scoreboard-side">
          {homeClub && <ClubCrest club={homeClub} size={40} />}
          {homeClub?.name ?? ''}
        </span>
        <span>{runningHomeGoals}</span>
        <span className="muted">x</span>
        <span>{runningAwayGoals}</span>
        <span className="scoreboard-side">
          {awayClub && <ClubCrest club={awayClub} size={40} />}
          {awayClub?.name ?? ''}
        </span>
      </div>

      {result.penaltyShootout && homeClub && awayClub && (
        <PenaltyShootoutGridWidget
          shootout={result.penaltyShootout}
          homeName={homeClub.name}
          awayName={awayClub.name}
        />
      )}

      {homeClub && awayClub && (
        <>
          <MatchTimelineBar
            events={result.events}
            homeName={homeClub.name}
            awayName={awayClub.name}
            clockFormat={clockFormat}
          />
          <MatchNarrativeReplayWidget
            result={result}
            homeName={homeClub.name}
            awayName={awayClub.name}
          />
        </>
      )}

      {decisive && (
        <div className="card decisive-moment">
          <span className="decisive-moment-label">Momento decisivo</span>
          <p>
            <span className="decisive-moment-icon">{eventIcon(decisive)}</span>
            <strong>{formatMatchEventMinute(decisive, clockFormat)}</strong> {decisive.description}
          </p>
        </div>
      )}

      {broadcaster && (
        <div className="card broadcast-payout-card" style={{ borderLeft: `4px solid ${broadcaster.brandColor}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BroadcastLogo logoKey={broadcaster.logoKey} size="md" showBadge={false} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '1rem', color: '#F4F7FB' }}>{broadcaster.name}</strong>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: broadcaster.accentColor,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {broadcaster.badgeLabel}
                  </span>
                </div>
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  {broadcaster.conglomerateName} • "{broadcaster.slogan}"
                </span>
              </div>
            </div>

            {myPayout !== null && myPayout > 0 && (
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#9AABC0', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Cota de Transmissão Recebida
                </span>
                <strong style={{ fontSize: '1.1rem', color: '#00E599', fontFamily: 'Space Grotesk, sans-serif' }}>
                  +{myPayout.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {combatBonus && combatBonus.totalBonus > 0 && (
        <div className="card combat-bonus-card" style={{ borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '1rem', color: '#F4F7FB', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <SwordsIcon size={18} color="#F59E0B" /> Bônus de Combate & Performance Coletiva
                </strong>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#F59E0B',
                    letterSpacing: '0.04em',
                  }}
                >
                  PREMIAÇÃO
                </span>
              </div>
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                Recompensa financeira por intensidade tática, metas competitivas e superação em campo
              </span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: '#9AABC0', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Premiação Total Recebida
              </span>
              <strong style={{ fontSize: '1.1rem', color: '#F59E0B', fontFamily: 'Space Grotesk, sans-serif' }}>
                +{combatBonus.totalBonus.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </strong>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
            {combatBonus.items.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F4F7FB' }}>{item.label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10B981' }}>
                    +{item.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94A3B8' }}>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.penaltyShootout && (
        <div className="card penalty-shootout-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrophyIcon size={18} color="#fbbf24" /> Disputa de Pênaltis
          </h2>
          <p className="shootout-summary">
            Vencedor nos pênaltis:{' '}
            <strong>
              {result.penaltyShootout.winnerClubId === homeClub?.id ? homeClub?.name : awayClub?.name}
            </strong>{' '}
            ({result.penaltyShootout.homeScore} x {result.penaltyShootout.awayScore})
          </p>
          <div className="shootout-kicks-list">
            {result.penaltyShootout.kicks.map((kick, i) => (
              <div key={i} className={`shootout-kick-item kick-${kick.outcome.toLowerCase()}`}>
                <span className="kick-round">
                  #{kick.roundNumber} ({kick.team === 'home' ? homeClub?.name : awayClub?.name})
                </span>
                <span className="kick-kicker">
                  <strong>{kick.kickerName}</strong> vs {kick.goalkeeperName}
                </span>
                <span className={`kick-badge badge-${kick.outcome.toLowerCase()}`}>
                  {kick.outcome === 'GOL'
                    ? 'Gol'
                    : kick.outcome === 'DEFESA'
                      ? 'Defesa'
                      : kick.outcome === 'TRAVE'
                        ? 'Na Trave'
                        : 'Para Fora'}
                </span>
                <span className="kick-score">
                  ({kick.scoreAfter.home} x {kick.scoreAfter.away})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {homeClub && awayClub && (
        <PostMatchInsightsCard
          insights={generatePostMatchInsights(match, homeClub, awayClub)}
          homeClubName={homeClub.name}
          awayClubName={awayClub.name}
        />
      )}

      <div className="card">
        <h2>Estatísticas</h2>
        <MatchStatsPanel
          home={
            result.stats?.home ?? {
              shots: Math.max(result.homeGoals, 6),
              shotsOnTarget: Math.max(result.homeGoals, 3),
              possession: 50,
              corners: 3,
              fouls: 8,
              xg: Number((result.homeGoals * 0.8).toFixed(2)),
            }
          }
          away={
            result.stats?.away ?? {
              shots: Math.max(result.awayGoals, 6),
              shotsOnTarget: Math.max(result.awayGoals, 3),
              possession: 50,
              corners: 3,
              fouls: 8,
              xg: Number((result.awayGoals * 0.8).toFixed(2)),
            }
          }
        />
      </div>

      {match.homeTactic && match.awayTactic && (() => {
        const homeStarters = homeClub
          ? match.homeTactic.lineup
              .map((slot) => homeClub.players.find((p) => p.id === slot.playerId))
              .filter((p): p is Player => !!p)
          : [];
        const awayStarters = awayClub
          ? match.awayTactic.lineup
              .map((slot) => awayClub.players.find((p) => p.id === slot.playerId))
              .filter((p): p is Player => !!p)
          : [];

        const tacticalReport = generateTacticalMatchReport(
          match,
          match.homeTactic,
          match.awayTactic,
          homeClub?.name,
          awayClub?.name,
          homeStarters,
          awayStarters,
          ratings ?? undefined,
        );
        return (
          <>
            <div className="card tactical-report-card">
              <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <BrainIcon size={20} color="#38bdf8" /> Relatório Tático e Causal
              </h2>
              {tacticalReport && (
                <div className="ratings-columns" style={{ marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ marginBottom: '8px' }}>{homeClub?.name ?? 'Mandante'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {tacticalReport.home.evaluations.map((ev: Evaluation, idx: number) => (
                        <div
                          key={idx}
                          className={`insight-item-box impact-${ev.status.toLowerCase()}`}
                          style={{ padding: '8px 12px' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.85rem' }}>
                              {ev.icon ? `${ev.icon} ` : ''}{ev.title ?? ev.dimension}
                            </strong>
                            {ev.metricLabel && <span className="muted" style={{ fontSize: '0.78rem' }}>{ev.metricLabel}</span>}
                          </div>
                          {ev.causalExplanation && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#cbd5e1' }}>
                              {ev.causalExplanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 style={{ marginBottom: '8px' }}>{awayClub?.name ?? 'Visitante'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {tacticalReport.away.evaluations.map((ev: Evaluation, idx: number) => (
                        <div
                          key={idx}
                          className={`insight-item-box impact-${ev.status.toLowerCase()}`}
                          style={{ padding: '8px 12px' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.85rem' }}>
                              {ev.icon ? `${ev.icon} ` : ''}{ev.title ?? ev.dimension}
                            </strong>
                            {ev.metricLabel && <span className="muted" style={{ fontSize: '0.78rem' }}>{ev.metricLabel}</span>}
                          </div>
                          {ev.causalExplanation && (
                            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#cbd5e1' }}>
                              {ev.causalExplanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <p>
                {homeClub?.name ?? 'Mandante'}:{' '}
                {buildPressingReport(
                  pressingOf(match.homeTactic),
                  result.stats?.home ?? {
                    shots: Math.max(result.homeGoals, 6),
                    shotsOnTarget: Math.max(result.homeGoals, 3),
                    possession: 50,
                    corners: 3,
                    fouls: 8,
                  },
                )}
              </p>
              <p>
                {awayClub?.name ?? 'Visitante'}:{' '}
                {buildPressingReport(
                  pressingOf(match.awayTactic),
                  result.stats?.away ?? {
                    shots: Math.max(result.awayGoals, 6),
                    shotsOnTarget: Math.max(result.awayGoals, 3),
                    possession: 50,
                    corners: 3,
                    fouls: 8,
                  },
                )}
              </p>
            </div>

            {tacticalReport?.rolePerformances && (
              <TacticalRolePerformanceCard
                homeReport={tacticalReport.rolePerformances.home}
                awayReport={tacticalReport.rolePerformances.away}
                defaultSide={isMyClubAway ? 'away' : 'home'}
              />
            )}
          </>
        );
      })()}

      <div className="card">
        <button onClick={startPlayback} disabled={playing}>
          {playing ? 'Reproduzindo...' : '▶ Ver melhores momentos'}
        </button>
        <ul className="lances-feed">
          {shownEvents.map((event, i) => (
            <li key={i} className={`lance-item lance-${eventVariant(event)}`}>
              <span className="lance-item-icon">{eventIcon(event)}</span>
              <strong>{formatMatchEventMinute(event, clockFormat)}</strong>
              <span>
                {event.description}
                {event.type === 'goal' && event.assistPlayerName && (
                  <span className="muted" style={{ fontSize: '0.85em', marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AssistBootIcon size={12} color="currentColor" /> Assist: <strong>{event.assistPlayerName}</strong>
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {ratings && (
        <div className="card">
          <h2>Notas dos jogadores</h2>
          {manOfTheMatch && (
            <p className="man-of-the-match">
              ⭐ Destaque da partida: <strong>{manOfTheMatch.name}</strong> ({positionLabel(manOfTheMatch.position)})) • 
              {manOfTheMatch.rating.toFixed(1)}
            </p>
          )}
          <div className="ratings-columns">
            <div>
              <h3>{homeClub?.name}</h3>
              <ul className="club-list ratings-list">
                {ratings.home.map((r) => (
                  <li key={r.playerId} className={manOfTheMatch?.playerId === r.playerId ? 'man-of-the-match-row' : ''}>
                    <span>
                      {r.name} <span className="muted">({positionLabel(r.position)})</span>
                    </span>
                    <strong>{r.rating.toFixed(1)}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>{awayClub?.name}</h3>
              <ul className="club-list ratings-list">
                {ratings.away.map((r) => (
                  <li key={r.playerId} className={manOfTheMatch?.playerId === r.playerId ? 'man-of-the-match-row' : ''}>
                    <span>
                      {r.name} <span className="muted">({positionLabel(r.position)})</span>
                    </span>
                    <strong>{r.rating.toFixed(1)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="match-result-bottom-dock">
        <Link to={`/match/${matchId}/round-summary`} className="btn-match-continue">
          Resumo da Rodada e Classificação
        </Link>
      </div>
    </div>
  );
}

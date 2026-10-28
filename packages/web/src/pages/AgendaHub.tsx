import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Club, Cup, League } from '@tactical-arena/shared';
import { formatShortPtBr, monthNamePtBr, parseGameDate } from '@tactical-arena/shared';
import { getActiveLeague, getClub, getClubCalendar, getGameState, listCups, type CalendarEntry } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { FastAdvanceButton } from '../components/FastAdvanceButton.js';
import { competitionLogo } from '../lib/competitionLogo.js';
import { GlobeIcon, TrophyIcon } from '../components/icons/AppIcons.js';

const FIFA_DATES_SET = new Set(['03-25', '06-10', '09-09', '10-14', '11-18']);
function isFifaWindowDate(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const mmdd = dateStr.slice(5);
  return FIFA_DATES_SET.has(mmdd);
}

type LeagueWithStandings = League & { standings?: unknown[] };

/** Groups the season into months, which is how a fixture list is actually read. */
function byMonth(entries: CalendarEntry[]): { key: string; label: string; entries: CalendarEntry[] }[] {
  const groups: { key: string; label: string; entries: CalendarEntry[] }[] = [];
  for (const entry of entries) {
    const key = entry.date ? entry.date.slice(0, 7) : 'sem-data';
    const label = entry.date
      ? `${monthNamePtBr(parseGameDate(entry.date).month)} de ${parseGameDate(entry.date).year}`
      : 'Ainda sem data definida';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, label, entries: [entry] });
  }
  return groups;
}

/**
 * The season calendar.
 *
 * This screen used to be two shortcut cards — one for the league, one per cup — with no fixtures on it
 * at all, which is why a cup tie sitting between two league rounds was invisible. Now it is the actual
 * schedule: every match the club plays this season, both competitions merged in date order, so the
 * interleaving is the thing you see rather than something you have to work out.
 */
export function AgendaHubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [league, setLeague] = useState<LeagueWithStandings | null>(null);
  const [cups, setCups] = useState<Cup[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [today, setToday] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    (async () => {
      try {
        const clubData = await getClub(clubId);
        if (cancelled) return;
        setClub(clubData);

        const [activeLeague, allCups, calendar, state] = await Promise.all([
          getActiveLeague(clubId),
          listCups(),
          getClubCalendar(clubId),
          getGameState().catch(() => null),
        ]);
        if (cancelled) return;
        setLeague(activeLeague);
        setCups(allCups.filter((c) => c.clubIds.includes(clubId)));
        setEntries(calendar.entries);
        setToday(state?.currentDate ?? null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (loading) return <div className="page">Carregando agenda...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  const months = byMonth(entries);
  const played = entries.filter((e) => e.result).length;
  const nextEntry = entries.find((e) => !e.result && e.date);

  return (
    <div className="page">
      <ClubNav club={club} active="agenda" backTo={`/clubs/${club.id}/competitions`} />

      {/*
        A tabela e a copa moram em rotas próprias, fora da hierarquia do clube, então os links vêm daqui
        como itens extras: a barra só consegue montá-los depois que a liga e as copas do clube chegam.
      */}
      <HubSubnav
        hub="competitions"
        clubId={club.id}
        active="agenda"
        extraItems={[
          ...(league ? [{ key: 'league', label: 'Tabela', to: `/league/${league.id}` }] : []),
          ...cups.map((cup) => ({ key: cup.id, label: cup.name, to: `/cup/${cup.id}` })),
        ]}
      />

      <header className="agenda-header">
        <div>
          <h2>Calendário da temporada</h2>
          <p className="muted">
            {entries.length} jogos {league ? `• ${league.name}` : ''}
            {cups.length > 0 ? ` • ${cups.map((c) => c.name).join(', ')}` : ''}
            {' • '}
            {played} disputados
          </p>
        </div>
        {nextEntry && (
          <div className="agenda-next">
            <span className="agenda-next-label">Próximo jogo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
              <ClubCrest
                club={{
                  id: nextEntry.opponentClubId,
                  name: nextEntry.opponentName,
                  slug: nextEntry.opponentSlug ?? null,
                  crestBase64: nextEntry.opponentCrestBase64 ?? null,
                  primaryColor: nextEntry.opponentPrimaryColor ?? null,
                  secondaryColor: nextEntry.opponentSecondaryColor ?? null,
                } as Club}
                size={26}
              />
              <strong>
                {nextEntry.date ? formatShortPtBr(nextEntry.date) : '-'} · {nextEntry.isHome ? 'casa' : 'fora'} ·{' '}
                {nextEntry.opponentName}
              </strong>
            </div>
            <span className="agenda-next-comp">{nextEntry.competitionName}</span>
            <div style={{ marginTop: 8 }}>
              <FastAdvanceButton clubId={club.id} className="btn-secondary" />
            </div>
          </div>
        )}
      </header>


      {entries.length === 0 && (
        <div className="card">
          <p className="muted">
            Nenhum jogo agendado ainda. O calendário é montado quando a competição começa.
          </p>
        </div>
      )}

      {months.map((month) => (
        <section key={month.key} className="card agenda-month">
          <h3 className="agenda-month-title">{month.label}</h3>
          <ul className="agenda-fixture-list">
            {month.entries.map((entry, i) => {
              const isToday = today !== null && entry.date === today;
              const isPast = !!entry.result;
              return (
                <li
                  key={`${entry.competitionId}-${entry.round}-${i}`}
                  className={`agenda-fixture${isToday ? ' today' : ''}${isPast ? ' played' : ''}`}
                >
                  <span className="agenda-fixture-date">
                    {entry.date ? formatShortPtBr(entry.date) : '--/--'}
                    {isFifaWindowDate(entry.date) && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', color: '#38bdf8', fontWeight: 700, marginTop: '2px' }}>
                        <GlobeIcon size={11} color="#38bdf8" /> Data FIFA
                      </span>
                    )}
                  </span>

                  <span className={`agenda-fixture-comp ${entry.kind.toLowerCase()}`}>
                    {(() => {
                      const isStateChamp = entry.competitionName && (
                        entry.competitionName.includes('Campeonato') ||
                        entry.competitionName.includes('Paulista') ||
                        entry.competitionName.includes('Carioca') ||
                        entry.competitionName.includes('Mineiro') ||
                        entry.competitionName.includes('Gaúcho') ||
                        entry.competitionName.includes('Paranaense') ||
                        entry.competitionName.includes('Catarinense') ||
                        entry.competitionName.includes('Baiano') ||
                        entry.competitionName.includes('Pernambucano') ||
                        entry.competitionName.includes('Cearense') ||
                        entry.competitionName.includes('Goiano')
                      ) && !entry.competitionName.includes('Brasileirão') && !entry.competitionName.includes('Série');

                      return isStateChamp ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '2px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 700 }}>
                          Estadual
                        </span>
                      ) : competitionLogo(entry.competitionName) ? (
                        <img src={competitionLogo(entry.competitionName)!} alt="" className="agenda-comp-logo" />
                      ) : entry.kind === 'CUP' ? (
                        <TrophyIcon size={14} color="#fbbf24" />
                      ) : (
                        <span className="fixture-badge-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
                      );
                    })()}
                    <span className="agenda-fixture-round">
                      {entry.kind === 'CUP' ? (entry.stageName ?? `Fase ${entry.round}`) : `${entry.round}ª rodada`}
                    </span>
                  </span>

                  <span className="agenda-fixture-venue" title={entry.isHome ? 'Em casa' : 'Fora de casa'}>
                    {entry.isHome ? 'casa' : 'fora'}
                  </span>

                  <span className="agenda-fixture-opponent">
                    <ClubCrest
                      club={{
                        id: entry.opponentClubId,
                        name: entry.opponentName,
                        slug: entry.opponentSlug ?? null,
                        crestBase64: entry.opponentCrestBase64 ?? null,
                        primaryColor: entry.opponentPrimaryColor ?? null,
                        secondaryColor: entry.opponentSecondaryColor ?? null,
                      } as Club}
                      size={24}
                    />
                    <span>{entry.opponentName}</span>
                  </span>

                  <span className="agenda-fixture-result">
                    {entry.result ? (
                      <>
                        <span className={`agenda-outcome ${entry.result.outcome}`}>{entry.result.outcome}</span>
                        <span className="agenda-score">
                          {entry.result.goalsFor} x {entry.result.goalsAgainst}
                        </span>
                        {entry.matchId && (
                          <Link className="agenda-link" to={`/match/${entry.matchId}/result`}>
                            ver
                          </Link>
                        )}
                      </>
                    ) : isToday ? (
                      <span className="agenda-today-tag">hoje</span>
                    ) : (
                      <span className="muted">a jogar</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

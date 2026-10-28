import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Club, CountryHistory } from '@tactical-arena/shared';
import { getClub, getHistory } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { CountryFlag } from '../components/CountryFlag.js';
import { competitionLogo } from '../lib/competitionLogo.js';

/** Champions of every finished league season and cup, grouped by country. */
export function HistoryChampionsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [history, setHistory] = useState<CountryHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) return;
    Promise.all([getClub(clubId), getHistory()])
      .then(([clubData, historyData]) => {
        setClub(clubData);
        setHistory(historyData);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [clubId]);

  if (loading) return <div className="page">Carregando...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  const countriesWithHistory = history.filter((c) => c.leagues.length > 0 || c.cups.length > 0);

  return (
    <div className="page">
      <ClubNav club={club} active="history" backTo={`/clubs/${club.id}/history`} />
      <HubSubnav hub="club" clubId={club.id} active="champions" />

      <section className="card">
        <h2>Campeões</h2>
        {countriesWithHistory.length === 0 && (
          <p className="muted">Ainda não há nenhuma temporada de liga ou copa concluída no jogo.</p>
        )}

        {countriesWithHistory.map((country) => (
          <div key={country.countryCode} className="history-country">
            <h3 className="crest-name">
              <CountryFlag code={country.countryCode} title={country.countryName} /> {country.countryName}
            </h3>

            {country.leagues.length > 0 && (
              <>
                <h4>Ligas</h4>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Temporada</th>
                        <th>Competição</th>
                        <th>Campeão</th>
                        <th>Técnico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {country.leagues
                        .slice()
                        .sort((a, b) => b.season - a.season || (a.division ?? 0) - (b.division ?? 0))
                        .map((entry, i) => {
                          const logo = competitionLogo(entry.name);
                          return (
                            <tr key={i}>
                              <td>{entry.season}</td>
                              <td>
                                <span className="crest-name">
                                  {logo && <img src={logo} alt="" className="matchday-comp-logo" />}
                                  {entry.name || `Divisão ${entry.division}`}
                                </span>
                              </td>
                              <td>{entry.championClubName}</td>
                              <td>{entry.managerName}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {country.cups.length > 0 && (
              <>
                <h4>Copas</h4>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Temporada</th>
                        <th>Copa</th>
                        <th>Campeão</th>
                        <th>Técnico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {country.cups
                        .slice()
                        .sort((a, b) => b.season - a.season)
                        .map((entry, i) => {
                          const logo = competitionLogo(entry.name);
                          return (
                            <tr key={i}>
                              <td>{entry.season}</td>
                              <td>
                                <span className="crest-name">
                                  {logo && <img src={logo} alt="" className="matchday-comp-logo" />}
                                  {entry.name}
                                </span>
                              </td>
                              <td>{entry.championClubName}</td>
                              <td>{entry.managerName}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

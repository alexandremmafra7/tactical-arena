import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { COUNTRIES, type Club, type Cup, type League } from '@tactical-arena/shared';
import { getActiveLeague, listCups, listMyClubs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { CountryFlag } from '../components/CountryFlag.js';

function formatMoney(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function countryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

export function DashboardPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [clubLeague, setClubLeague] = useState<League | null>(null);
  const [clubCup, setClubCup] = useState<Cup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { signOut } = useAuth();

  useEffect(() => {
    let cancelled = false;

    listMyClubs()
      .then((list) => {
        if (cancelled) return;
        setClubs(list);
        setSelectedClubId((current) => current || list[0]?.id || '');
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClub = clubs.find((club) => club.id === selectedClubId);

  useEffect(() => {
    if (!selectedClub) {
      setClubLeague(null);
      return;
    }

    let cancelled = false;
    getActiveLeague(selectedClub.id)
      .then((active) => {
        if (!cancelled) setClubLeague(active);
      })
      .catch(() => {
        if (!cancelled) setClubLeague(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClub]);

  useEffect(() => {
    if (!selectedClub) {
      setClubCup(null);
      return;
    }

    let cancelled = false;
    listCups(selectedClub.country)
      .then((cups) => {
        if (!cancelled) {
          setClubCup(cups.find((cup) => cup.clubIds.includes(selectedClub.id)) ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setClubCup(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClub]);

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="brand">
          <img src="/logo-icon.png" alt="Tactical Arena FC" width={32} height={32} /> Tactical Arena FC
        </h1>
        <div className="topbar-actions">
          {selectedClub && (
            <Link className="btn-secondary" to={`/clubs/${selectedClub.id}/transfers`}>
              Mercado de transferências
            </Link>
          )}
          <button className="btn-secondary" onClick={signOut}>
            Sair
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {loading && <p>Carregando...</p>}

      {!loading && clubs.length === 0 && (
        <section className="card">
          <h2>Meus clubes</h2>
          <p>Você ainda não tem um clube. Inicie uma carreira pela Central de Carreiras.</p>
          <Link className="btn-secondary" to="/">
            Ir para a Central de Carreiras
          </Link>
        </section>
      )}

      {clubs.length > 0 && (
        <section className="card">
          <h2>Meus clubes</h2>
          <ul className="club-list">
            {clubs.map((club) => (
              <li
                key={club.id}
                className={club.id === selectedClubId ? 'selected' : ''}
                onClick={() => setSelectedClubId(club.id)}
              >
                <span className="crest-name">
                  <ClubCrest club={club} />
                  <CountryFlag code={club.country} size={18} title={countryName(club.country)} />
                  <strong>{club.name}</strong>
                </span>
                <span className="muted">
                  {' '}• {countryName(club.country)} • {club.players.length} jogadores • Orçamento:{' '}
                  {formatMoney(club.budget)} • ID: {club.id}
                </span>
              </li>
            ))}
          </ul>

          {selectedClub && (
            <>
              <p className="muted">
                {clubLeague ? (
                  <>
                    Liga: <Link to={`/league/${clubLeague.id}`}>{clubLeague.name}</Link> ({clubLeague.status},{' '}
                    {clubLeague.clubIds.length}/{clubLeague.capacity} clubes)
                  </>
                ) : (
                  'Carregando liga...'
                )}
              </p>
              {clubCup && (
                <p className="muted">
                  Copa: <Link to={`/cup/${clubCup.id}`}>{clubCup.name}</Link> ({clubCup.status}
                  {clubCup.status === 'FINISHED' && clubCup.championClubId === selectedClub.id
                    ? ' • Você é o campeão!'
                    : ''}
                  )
                </p>
              )}
              {clubLeague?.status === 'IN_PROGRESS' && !selectedClub.pendingRoundTactic && (
                <p className="error">
                  Você ainda não escalou o time para a próxima rodada desta liga.{' '}
                  <Link className="btn-secondary" to={`/clubs/${selectedClub.id}/tactics`}>
                    Definir agora
                  </Link>
                </p>
              )}
              <p>
                <Link className="btn-secondary" to={`/clubs/${selectedClub.id}`}>
                  Gerenciar {selectedClub.name}
                </Link>
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Club } from '@tactical-arena/shared';
import { getClub } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubCard } from '../components/HubCard.js';
import { financeHubStatus } from '../lib/hubStatus.js';

/**
 * Os três assuntos do financeiro, um card cada.
 *
 * Eram dois, "Finanças" e "Estádio", e patrocínio vivia escondido numa aba dentro do primeiro: dois níveis
 * fundo para a única receita que o técnico negocia. Agora tem card próprio, e o que sobrou de "Finanças"
 * ganhou o nome do que realmente é — conta corrente, com empréstimo, metas e transmissão.
 */
const ITEMS: { key: string; label: string; path: (clubId: string) => string; card: string }[] = [
  { key: 'sponsors', label: 'Patrocínios', path: (id) => `/clubs/${id}/sponsors`, card: '/cards/proposals.webp' },
  { key: 'stadium', label: 'Estádio', path: (id) => `/clubs/${id}/stadium`, card: '/cards/stadium.webp' },
  { key: 'finance', label: 'Conta Corrente', path: (id) => `/clubs/${id}/finance`, card: '/cards/finance.webp' },
];

/** "Financeiro" hub — a card per subdivision (Patrocínios, Estádio, Conta Corrente). */
export function FinanceHubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) return;
    getClub(clubId)
      .then(setClub)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [clubId]);

  if (loading) return <div className="page">Carregando...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  const status = financeHubStatus(club);

  return (
    <div className="page">
      <ClubNav club={club} active="financial" />

      <div className="hub-grid hub-grid-banners">
        {ITEMS.map((item) => (
          <HubCard
            key={item.key}
            to={item.path(club.id)}
            art={item.card}
            alt={item.label}
            status={status[item.key]}
          />
        ))}
      </div>
    </div>
  );
}

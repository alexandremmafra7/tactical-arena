import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Club } from '@tactical-arena/shared';
import { getClub } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { FinancePanel } from '../components/FinancePanel.js';

export function FinancePage() {
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

  return (
    <div className="page">
      <ClubNav club={club} active="finance" />

      <HubSubnav hub="financial" clubId={club.id} active="finance" />

      {error && <p className="error">{error}</p>}
      {/* Patrocínio saiu daqui para tela própria; o que ficou é a conta corrente do clube. */}
      <FinancePanel club={club} onUpdate={setClub} onError={setError} secao="conta" />
    </div>
  );
}

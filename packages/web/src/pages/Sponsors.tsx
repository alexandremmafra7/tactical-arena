import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Club } from '@tactical-arena/shared';
import { getClub } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { FinancePanel } from '../components/FinancePanel.js';

/**
 * O quadro de patrocínios, em tela própria.
 *
 * Vivia como a primeira aba dentro de "Finanças", o que o punha dois níveis fundo: abrir o financeiro,
 * depois escolher a aba. É a única receita que o técnico negocia de verdade, e a proposta de um concorrente
 * expira, ao contrário do extrato da conta. Agora é um dos três cards do menu financeiro.
 */
export function SponsorsPage() {
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
      <ClubNav club={club} active="sponsors" />

      <HubSubnav hub="financial" clubId={club.id} active="sponsors" />

      {error && <p className="error">{error}</p>}
      <FinancePanel club={club} onUpdate={setClub} onError={setError} secao="patrocinios" />
    </div>
  );
}

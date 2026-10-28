import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Club, CountryHistory } from '@tactical-arena/shared';
import { getClub, getHistory } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubCard } from '../components/HubCard.js';
import { clubHubStatus } from '../lib/hubStatus.js';

/**
 * Hub do Clube: o que se lê, não o que se decide.
 *
 * Era o hub "História" e ganhou Minha carreira, que ocupava sozinha uma aba de primeiro nível para uma
 * tela só. Títulos do clube, artilharia e a trajetória do técnico são o mesmo tipo de visita — consulta,
 * não decisão — e agora moram juntos.
 *
 * A rota continua sendo /history: é string interna, o jogador nunca a vê, e mudá-la só custaria mexer no
 * backTo de duas telas sem mudar nada na tela.
 *
 * Bola de Ouro saiu da tela. Ficou meses como card apagado, esperando critério próprio, e card
 * desabilitado não avisa que algo vem por aí: ensina o jogador a passar o olho por cima de card. Volta
 * quando tiver regra, com porta que abre.
 */
export function HistoryHubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [history, setHistory] = useState<CountryHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clubId) return;
    getClub(clubId)
      .then(setClub)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
    // Mesma chamada que as duas telas de dentro fazem; aqui é só para a faixa dos cards.
    getHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [clubId]);

  if (loading) return <div className="page">Carregando...</div>;
  if (error && !club) return <div className="page error">{error}</div>;
  if (!club) return null;

  const status = clubHubStatus(club, history);

  return (
    <div className="page">
      <ClubNav club={club} active="history" />

      <div className="hub-grid hub-grid-banners">
        <HubCard
          to={`/clubs/${club.id}/trophies`}
          art="/cards/trophies.webp"
          alt="Sala de Troféus"
          status={{ value: `${club.titlesWon ?? 0}`, label: 'taças conquistadas', tone: 'neutral' }}
        />

        <HubCard
          to={`/clubs/${club.id}/history/champions`}
          art="/cards/champions.webp"
          alt="Campeões"
          status={status.champions}
        />

        <HubCard
          to={`/clubs/${club.id}/history/scorers`}
          art="/cards/scorers.webp"
          alt="Artilheiros"
          status={status.scorers}
        />

        <HubCard
          to="/career"
          art="/cards/career.webp"
          alt="Minha carreira"
          status={{ value: 'Trajetória', label: 'do treinador e contratos', tone: 'neutral' }}
        />

        <HubCard
          to={`/clubs/${club.id}/history/hall-of-fame`}
          art="/cards/golden-ball.webp"
          alt="Hall da Fama"
          status={{ value: 'Lendas', label: 'artilheiros, clubes e técnicos', tone: 'attention' }}
        />
      </div>
    </div>
  );
}

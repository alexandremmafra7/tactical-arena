import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Club } from '@tactical-arena/shared';
import { getClub } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubCard } from '../components/HubCard.js';
import { teamHubStatus } from '../lib/hubStatus.js';
import { useGameDate } from '../lib/useGameDate.js';

const ITEMS: { key: string; label: string; path: (clubId: string) => string; card: string }[] = [
  { key: 'squad', label: 'Elenco', path: (id) => `/clubs/${id}/squad`, card: '/cards/squad.webp' },
  { key: 'tactics', label: 'Tática/Escalação', path: (id) => `/clubs/${id}/tactics`, card: '/cards/tactics.webp' },
  { key: 'training', label: 'Treinamento', path: (id) => `/clubs/${id}/training`, card: '/cards/training.webp' },
  { key: 'academy', label: 'Divisão de base', path: (id) => `/clubs/${id}/academy`, card: '/cards/academy.webp' },
  { key: 'staff', label: 'Comissão Técnica e Diretoria', path: (id) => `/clubs/${id}/staff`, card: '/cards/staff.webp' },
  // Contrato virou decisão de verdade: quem vence sai de graça, e renovar cedo custa menos.
  { key: 'contracts', label: 'Contratos', path: (id) => `/clubs/${id}/contracts`, card: '/cards/proposals.webp' },
];

/** "Minha equipe" hub — a card per sub-area (Elenco, Tática, Treinamento, Base) instead of one flat nav tab each. */
export function TeamHubPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * O relógio, só para saber a temporada corrente e com isso quantos contratos vencem.
   *
   * É a mesma requisição que a barra de cima já faz, e é a única do hub inteiro que não sai do clube. Vale
   * a segunda chamada: contrato vencendo é o aviso que o jogador mais perde por não ver a tempo.
   */
  const gameState = useGameDate();

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

  const status = teamHubStatus(club, gameState?.seasonYear ?? null);

  return (
    <div className="page">
      <ClubNav club={club} active="team" />

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

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Club } from '@tactical-arena/shared';
import { getClub } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { HubSubnav } from '../components/HubSubnav.js';
import { AcademyPanel } from '../components/AcademyPanel.js';

export function AcademyPage() {
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
      <ClubNav club={club} active="academy" />
      <HubSubnav hub="team" clubId={club.id} active="academy" />
      {error && <p className="error">{error}</p>}
      <AcademyPanel club={club} onUpdate={setClub} onError={setError} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ATTRIBUTE_WEIGHT_BY_ROLE,
  DETAILED_ATTRIBUTE_DESCRIPTIONS,
  DETAILED_ATTRIBUTE_LABELS,
  DETAILED_ATTRIBUTE_TYPE,
  FUNCTIONS_BY_POSITION,
  PLAYER_TIER_DESCRIPTION,
  PLAYER_TIER_LABEL,
  ROLE_BY_FUNCTION,
  getPlayerTier,
  resolveAttributeRole,
  roleFitScore,
} from '@tactical-arena/shared';
import type { Club, DetailedAttribute } from '@tactical-arena/shared';
import { getClub } from '../api/client.js';
import { ClubNav } from '../components/ClubNav.js';
import { ClubCrest } from '../components/ClubCrest.js';
import { ContractsIcon } from '../components/icons/AppIcons.js';
import { SpecialPlayerIcon, SpecialPlayerBadge } from '../components/SpecialPlayerIcon.js';
import { getClubThemeStyle } from '../lib/clubTheme.js';
import { positionLabel } from '../lib/positionLabel.js';
import { footLabel } from '../lib/footLabel.js';
import { functionLabel } from '../lib/functionLabel.js';
import { NegotiationRoomModal } from '../components/NegotiationRoomModal.js';
import { renewPlayerContract } from '../api/client.js';

/** A player's full scouting profile: every attribute relevant to their role, plus how well they'd
 *  fit each tactical function available for their position (see the "Atributos Jogadores" design doc). */
export function PlayerDetailPage() {
  const { clubId, playerId } = useParams<{ clubId: string; playerId: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);

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

  const player = club.players.find((p) => p.id === playerId);
  if (!player) return <div className="page error">Jogador não encontrado neste clube.</div>;

  const role = resolveAttributeRole(player.position, player.functions);
  const weights = ATTRIBUTE_WEIGHT_BY_ROLE[role];
  const relevantKeys = (Object.keys(weights) as DetailedAttribute[]).sort((a, b) => weights[b]! - weights[a]!);
  const fisico = relevantKeys.filter((k) => DETAILED_ATTRIBUTE_TYPE[k] === 'FISICO');
  const tecnico = relevantKeys.filter((k) => DETAILED_ATTRIBUTE_TYPE[k] === 'TECNICO');

  const availableFunctions = FUNCTIONS_BY_POSITION[player.position];

  function AttributeRow({ attr }: { attr: DetailedAttribute }) {
    const value = player!.detailedAttributes[attr];
    return (
      <div className="attr-row" title={DETAILED_ATTRIBUTE_DESCRIPTIONS[attr]}>
        <span className="attr-name">{DETAILED_ATTRIBUTE_LABELS[attr]}</span>
        <div className="attr-bar">
          <div className="attr-bar-fill" style={{ width: `${value}%` }} />
        </div>
        <span className="attr-value">{value}</span>
      </div>
    );
  }

  const tier = getPlayerTier(player.overall, player.starLevel, player.diferenciado, player.age, player.potential, player.name);

  return (
    <div className="page player-detail-page" style={getClubThemeStyle(club)}>
      <ClubNav club={club} active="squad" backTo={`/clubs/${club.id}/squad`} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <Link className="btn-secondary" to={`/clubs/${club.id}/squad`}>
          ← Voltar ao elenco
        </Link>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsNegotiationOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#059669',
              color: '#ffffff',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.4)'
            }}
          >
            <ContractsIcon size={16} /> Negociar Contrato
          </button>
          <Link
            className="btn-primary-club"
            to={`/clubs/${club.id}/training`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'var(--accent)',
              color: 'var(--accent-contrast, #ffffff)',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 2px 8px var(--club-glow, rgba(0,0,0,0.3))'
            }}
          >
            Ir para Treino da Equipe
          </Link>
        </div>
      </div>

      <section className="card player-hero-card" style={{ borderTop: '3px solid var(--accent)' }}>
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ClubCrest club={club} size={28} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0 }}>{player.name}</h2>
                {tier && <SpecialPlayerBadge tier={tier} size="md" />}
              </div>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {club.name} · {positionLabel(player.position)} · {footLabel(player.preferredFoot)}
                {player.preferredFoot === 'BOTH' ? ' ✦' : ''}
              </span>
            </div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: '12px', marginBottom: 0 }}>
          Força <strong style={{ color: 'var(--club-readable)' }}>{Math.round(player.overall)}</strong> · Potencial {player.potential} · {player.age} anos
          {player.functions.length > 0 && (
            <>
              {' '}
              ·{' '}
              {player.functions.map((fn) => (
                <span key={fn} className="trait-badge">
                  {functionLabel(fn)}
                </span>
              ))}
            </>
          )}
        </p>
      </section>

      {tier && (
        <section className={`card player-tier-showcase-card tier-${tier.toLowerCase()}`}>
          <div className="player-tier-showcase-content">
            <div className="player-tier-showcase-icon">
              <SpecialPlayerIcon tier={tier} size="lg" />
            </div>
            <div className="player-tier-showcase-text">
              <span className="player-tier-showcase-tag">JOGADOR ESPECIAL</span>
              <h3 className="player-tier-showcase-title">{PLAYER_TIER_LABEL[tier]}</h3>
              <p className="player-tier-showcase-desc">{PLAYER_TIER_DESCRIPTION[tier]}</p>
            </div>
          </div>
        </section>
      )}

      {availableFunctions.length > 0 && (
        <section className="card">
          <h2>Compatibilidade com funções</h2>
          <p className="muted">Quão bem os atributos deste jogador combinam com cada função possível para a posição dele.</p>
          <div className="fit-score-list">
            {availableFunctions.map((fn) => (
              <div key={fn} className="fit-score">
                <span>{functionLabel(fn)}</span>
                <strong>{roleFitScore(player.detailedAttributes, ROLE_BY_FUNCTION[fn])}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2>Atributos físicos</h2>
        {fisico.map((attr) => (
          <AttributeRow key={attr} attr={attr} />
        ))}
      </section>

      <section className="card">
        <h2>Atributos técnicos</h2>
        {tecnico.map((attr) => (
          <AttributeRow key={attr} attr={attr} />
        ))}
      </section>

      <NegotiationRoomModal
        isOpen={isNegotiationOpen}
        onClose={() => setIsNegotiationOpen(false)}
        player={player}
        club={club}
        onSuccessDeal={async (offer) => {
          await renewPlayerContract(club.id, player.id, offer.contractYears);
          const updated = await getClub(club.id);
          setClub(updated);
        }}
      />
    </div>
  );
}

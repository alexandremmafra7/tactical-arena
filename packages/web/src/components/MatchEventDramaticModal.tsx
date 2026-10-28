import type { Club, Player } from '@tactical-arena/shared';
import { formatMatchEventMinute } from '@tactical-arena/shared';
import { positionLabel } from '../lib/positionLabel.js';
import { TargetIcon, ActivityIcon, TacticsIcon, AlertTriangleIcon, SettingsIcon, ShieldIcon } from './icons/AppIcons.js';

export type DramaticEventType = 'penalty' | 'red_card' | 'injury';

export interface DramaticEventData {
  type: DramaticEventType;
  minute: number;
  period?: '1T' | '2T';
  stoppageMinute?: number;
  player?: Player | null;
  club?: Club | null;
  penaltyTaker?: Player | null;
  description?: string;
}

interface MatchEventDramaticModalProps {
  event: DramaticEventData | null;
  suggestedSubstitute?: Player | null;
  busy?: boolean;
  onSubstituteBest?: () => void;
  onOpenTactics: () => void;
  onResume: () => void;
}

export function MatchEventDramaticModal({
  event,
  suggestedSubstitute,
  busy = false,
  onSubstituteBest,
  onOpenTactics,
  onResume,
}: MatchEventDramaticModalProps) {
  if (!event) return null;

  const isPenalty = event.type === 'penalty';
  const isRedCard = event.type === 'red_card';
  const isInjury = event.type === 'injury';

  const imageSrc = isPenalty
    ? '/cards/event-penalty.jpg'
    : isRedCard
      ? '/cards/event-red-card.jpg'
      : '/cards/event-injury.jpg';

  const badgeText = isPenalty
    ? 'Pênalti Marcado'
    : isRedCard
      ? 'Expulsão Direta'
      : 'Atendimento Médico';

  const title = isPenalty
    ? 'PÊNALTI A FAVOR DO SEU TIME!'
    : isRedCard
      ? 'JOGADOR EXPULSO DE CAMPO!'
      : 'LESÃO INCAPACITANTE EM CAMPO!';

  const playerName = event.player?.name ?? 'Seu jogador';
  const penaltyTakerName = event.penaltyTaker?.name ?? event.player?.name ?? 'Cobrador Principal';

  return (
    <div className="dramatic-event-backdrop" role="dialog" aria-label={title}>
      <div className={`dramatic-event-card ${event.type}`}>
        {/* Banner Art */}
        <div className="dramatic-event-media">
          <img src={imageSrc} alt="" className="dramatic-event-img" />
          <div className="dramatic-event-badge">{badgeText}</div>
          <div className="dramatic-event-minute">{formatMatchEventMinute(event)}</div>
        </div>

        {/* Card Body */}
        <div className="dramatic-event-body">
          <h2 className="dramatic-event-title">{title}</h2>

          {isPenalty && (
            <div className="dramatic-event-description">
              <p>
                O árbitro assinalou <strong>penalidade máxima</strong> para o seu time aos {formatMatchEventMinute(event)}!
              </p>
              <div className="dramatic-event-highlight-box">
                <span className="highlight-label"><TargetIcon size={14} color="#ffd700" style={{ marginRight: 4 }} /> Cobrador Designado:</span>
                <strong>{penaltyTakerName}</strong>
                {event.penaltyTaker && <span className="highlight-meta">Overall {event.penaltyTaker.overall}</span>}
              </div>
            </div>
          )}

          {isRedCard && (
            <div className="dramatic-event-description">
              <p>
                <strong>{playerName}</strong> recebeu cartão vermelho direto e deixou o gramado!
              </p>
              <div className="dramatic-event-highlight-box alert">
                <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 6 }}>
                  <AlertTriangleIcon size={16} color="#fbbf24" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>O seu time agora está jogando com <strong>10 jogadores</strong>. Reorganize a tática e reposicione o buraco na formação para não ser surpreendido.</span>
                </span>
              </div>
            </div>
          )}

          {isInjury && (
            <div className="dramatic-event-description">
              <p>
                <strong>{playerName}</strong> sofreu uma lesão incapacitante e precisa deixar o gramado imediatamente!
              </p>
              <div className="dramatic-event-highlight-box warning">
                <span>O departamento médico solicita a substituição para recompor o time em campo.</span>
              </div>
              {suggestedSubstitute && (
                <div className="dramatic-event-highlight-box" style={{ marginTop: '8px', borderLeft: '3px solid #22c55e', background: 'rgba(34, 197, 94, 0.08)' }}>
                  <span className="highlight-label" style={{ color: '#4ade80' }}>Sugestão do Auxiliar (Melhor Opção):</span>
                  <strong>{suggestedSubstitute.name}</strong>
                  <span className="highlight-meta">
                    {positionLabel(suggestedSubstitute.position)} · Overall {suggestedSubstitute.overall} · <ActivityIcon size={13} color="#22c55e" style={{ marginRight: 2 }} /> Fôlego {Math.round(100 - (suggestedSubstitute.fatigue ?? 0))}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="dramatic-event-actions">
            {isInjury ? (
              <>
                <button
                  type="button"
                  className="btn-dramatic-action primary"
                  onClick={onSubstituteBest}
                  disabled={busy}
                >
                  {busy
                    ? 'Substituindo...'
                    : suggestedSubstitute
                      ? `Substituir pela melhor opção (${suggestedSubstitute.name})`
                      : 'Substituir pela melhor opção'}
                </button>

                <button
                  type="button"
                  className="btn-dramatic-action secondary"
                  onClick={onOpenTactics}
                  disabled={busy}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <TacticsIcon size={16} /> Ir para o painel tático para escolher
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn-dramatic-action primary"
                  onClick={onOpenTactics}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {isPenalty ? (
                    <><SettingsIcon size={16} /> Mudar Cobrador / Gerenciar Tática</>
                  ) : (
                    <><ShieldIcon size={16} /> Gerenciamento Tático (Reorganizar com 10)</>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-dramatic-action secondary"
                  onClick={onResume}
                >
                  {isPenalty
                    ? 'Cobrar Pênalti e Continuar Partida'
                    : 'Continuar com a Formação Atual'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

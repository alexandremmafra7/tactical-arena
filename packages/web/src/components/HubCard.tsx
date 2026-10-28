import { Link } from 'react-router-dom';
import type { HubStatus } from '../lib/hubStatus.js';

interface HubCardProps {
  /** Para onde o card leva. Ausente deixa o card desabilitado. */
  to?: string;
  /** A arte do banner. O título está pintado dentro dela. */
  art: string;
  alt: string;
  /** A faixa de estado. Sem ela o card volta a ser só a arte. */
  status?: HubStatus;
  /** Explica ao jogador por que o card está apagado. */
  disabledReason?: string;
}

/**
 * Um card de hub: a arte, e embaixo dela o que está acontecendo lá dentro.
 *
 * A faixa é a razão de este componente existir. Sem ela o hub é um menu bonito que obriga a entrar em
 * seis telas para descobrir em qual havia algo a fazer. Com ela, o hub é o próprio painel: dois
 * lesionados, três contratos vencendo, uma vaga de patrocínio, tudo legível antes do clique.
 *
 * A faixa vai por baixo da arte, e não por cima dela, porque o título de cada card está pintado dentro da
 * imagem — texto sobreposto brigaria com o que já está desenhado ali.
 */
export function HubCard({ to, art, alt, status, disabledReason }: HubCardProps) {
  const inner = (
    <>
      <img src={art} alt={alt} className="hub-banner-img" />
      {status && (
        <span className={`hub-card-status tone-${status.tone ?? 'neutral'}`}>
          <strong className="hub-card-status-value">{status.value}</strong>
          <span className="hub-card-status-label">{status.label}</span>
        </span>
      )}
    </>
  );

  if (!to) {
    return (
      <span className="hub-card hub-card-banner disabled" title={disabledReason}>
        {inner}
      </span>
    );
  }

  return (
    <Link to={to} className="hub-card hub-card-banner" title={alt}>
      {inner}
    </Link>
  );
}

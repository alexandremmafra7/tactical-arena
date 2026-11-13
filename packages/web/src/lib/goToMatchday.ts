import { advanceMatchday, fastAdvanceToNextMatch, getNextMatch } from '../api/client';

/**
 * The one answer to "ir para a partida".
 */
export async function goToMatchday(clubId: string): Promise<string | null> {
  /**
   * A match already under way wins over starting a new one. Without this, a manager who navigated away
   * mid-game and came back would advance the clock past their own match instead of returning to it.
   */
  const current = await getNextMatch(clubId).catch(() => null);
  if (current && (current.status === 'LIVE' || current.status === 'WAITING_TACTICS')) {
    return current.id;
  }

  // 1. Tenta o avanço rápido em lote direto no servidor (1 única requisição HTTP para saltar semanas de pré-temporada)
  try {
    const fast = await fastAdvanceToNextMatch(clubId);
    if (fast.interrupted && fast.interruptionReason?.type === 'BOARD_CRISIS') {
      window.location.href = `/career`;
      return null;
    }
    if (fast.nextMatch?.matchId) {
      return fast.nextMatch.matchId;
    }
  } catch {
    // Se o fast-advance falhar por qualquer motivo, segue para o fallback iterativo abaixo
  }

  // 2. Fallback: avança rodada a rodada pelo calendário
  const MAX_ADVANCES = 30;
  for (let step = 0; step < MAX_ADVANCES; step++) {
    const outcome = await advanceMatchday(clubId);

    if (outcome.sackedFromClubId) {
      window.location.href = `/career?sacked=${outcome.sackedFromClubId}`;
      return null;
    }

    if (outcome.matchId) return outcome.matchId;

    const next = await getNextMatch(clubId).catch(() => null);
    if (next && (next.status === 'LIVE' || next.status === 'WAITING_TACTICS')) {
      return next.id;
    }

    // Se nenhuma partida foi jogada no mundo inteiro nesta rodada (fim de calendário), paramos
    if (outcome.played.length === 0) {
      break;
    }
  }

  return null;
}

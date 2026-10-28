import { advanceMatchday, getNextMatch } from '../api/client';

/**
 * The one answer to "ir para a partida".
 *
 * Four screens used to work this out for themselves, and all four did it the same wrong way: read the
 * manager's league, find the lowest round with no match, advance *that league*, then hunt through the
 * fixtures for one of my own. Which meant a cup tie falling between two league rounds could never be
 * reached — the button only knew how to advance a league — and any screen that got the round arithmetic
 * subtly different sent the manager somewhere else entirely.
 *
 * Now the server decides. The calendar knows what day is next and what is played on it, so this asks for
 * the next matchday and goes wherever it lands: a Sunday of league, a Wednesday of cup, no difference.
 *
 * Returns the match to open, or null when the day held nothing for this club — which is a perfectly
 * ordinary outcome once the world plays its own fixtures.
 *
 * A demissão também se resolve aqui, e não em cada tela. São seis chamadores, e este arquivo existe
 * precisamente porque quatro deles já resolviam "ir para a partida" cada um à sua maneira errada — deixar a
 * demissão para eles seria repetir o mesmo erro com um caso que aparece muito mais raramente e por isso
 * seria esquecido num deles sem ninguém notar.
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

  const outcome = await advanceMatchday();

  /**
   * A demissão interrompe tudo o que viria a seguir, e leva o técnico para a carreira.
   *
   * Sem isto o jogador continuaria no painel de um clube que já não dirige, e o botão de partida o levaria
   * ao jogo de outra pessoa — a demissão aconteceria no banco e em lugar nenhum onde ele pudesse notar.
   *
   * A ida é por `location.href` e não pelo roteador de propósito: tudo o que a aplicação tem em memória
   * sobre o clube antigo — elenco, tabela, próxima partida — passou a ser sobre um clube de outra pessoa, e
   * um recarregamento completo é a forma mais barata de garantir que nada disso sobreviva.
   */
  if (outcome.sackedFromClubId) {
    window.location.href = `/career?sacked=${outcome.sackedFromClubId}`;
    return null;
  }

  if (outcome.matchId) return outcome.matchId;

  // The day was played but gave this club nothing to watch (their competition was not on it).
  return (await getNextMatch(clubId).catch(() => null))?.id ?? null;
}

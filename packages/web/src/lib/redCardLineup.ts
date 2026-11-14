import type { Tactic } from '@tactical-arena/shared';

/**
 * Nova ordem dos titulares depois de uma expulsão, slot a slot, ou null quando a lista pedida não é uma
 * simples reorganização dos mesmos jogadores (aí não há o que aplicar e a partida segue como está).
 *
 * Aceita as 11 posições, com o expulso marcando o buraco, ou só os 10 que restaram em campo: nesse caso o
 * expulso volta para o slot que ele ocupava, igual ao que o servidor faz em resolveRedCardDecision.
 */
export function reorderedLineup(current: Tactic, requested: string[]): string[] | null {
  const currentIds = current.lineup.map((slot) => slot.playerId);
  let ids = requested;

  if (ids.length === currentIds.length - 1) {
    const missingIdx = currentIds.findIndex((id) => !ids.includes(id));
    if (missingIdx < 0) return null;
    ids = [...ids];
    ids.splice(missingIdx, 0, currentIds[missingIdx]);
  }

  if (ids.length !== currentIds.length) return null;
  const sortedA = [...currentIds].sort();
  const sortedB = [...ids].sort();
  return sortedA.every((id, i) => id === sortedB[i]) ? ids : null;
}

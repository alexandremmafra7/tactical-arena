import { backfillContract, createRng, type Player } from '@tactical-arena/shared';
import { getGameState } from './gameStateService.js';

/**
 * Carimba contrato num elenco recém-gerado.
 *
 * O gerador de elenco vive no `shared` e não sabe em que ano o jogo está — nem deveria, porque é a mesma
 * função que o motor offline usa sem banco nenhum. Então o prazo é posto aqui, à beira do banco, que é o
 * único lado que conhece o relógio.
 *
 * Reaproveita `backfillContract` de propósito: espalhar os prazos no tempo é a mesma regra que se aplica a
 * um elenco antigo sem contrato, e escrever duas versões dela é como este projeto já se partiu com nome de
 * liga, divisão e partida ao vivo.
 */
export function stampContractsForSeason(
  players: Player[],
  seed: string,
  seasonYear: number,
): Player[] {
  const rng = createRng(`contratos-${seed}-${seasonYear}`);
  return players.map((player) => backfillContract(player, seasonYear, rng));
}

export async function stampContracts(players: Player[], seed: string): Promise<Player[]> {
  if (players.length === 0) return players;
  const { seasonYear } = await getGameState();
  return stampContractsForSeason(players, seed, seasonYear);
}

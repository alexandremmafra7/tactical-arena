import { backfillContract, createRng, type Player } from '@tactical-arena/shared';
import { prisma } from './prisma.js';
import { getGameState } from '../services/gameStateService.js';

/**
 * Dá contrato a quem foi criado antes de contrato existir.
 *
 * O mundo inteiro nasceu sem prazo: o importador do CSV, o gerador de elenco e a fundação de clube nunca
 * carimbaram `contractUntil`, porque o campo não existia. `seasonsRemaining` trata a ausência como contrato
 * longo, de propósito, para nenhum save perder o elenco na primeira virada — mas isso significa que numa
 * carreira nova a tela de contratos não mostra data nenhuma e nada vence, e o diretor de futebol volta a não
 * ter trabalho. O sistema existiria e não seria sentido.
 *
 * Então o buraco se fecha uma vez, no arranque, ao lado da cura de schema que existe para esta mesma classe
 * de problema. `backfillContract` espalha os prazos no tempo: dar a todos o mesmo ano de término faria o
 * mundo inteiro vencer contrato na mesma virada e um elenco perderia metade da gente de uma vez.
 *
 * O filtro é um LIKE no JSON, e não uma leitura de todos os elencos: quem já tem um `contractUntil` gravado
 * nem é lido. Num mundo recém-importado a consulta não devolve nada, porque o importador já carimba o prazo
 * na criação de cada clube — este arranque só paga o custo por um save feito antes de os contratos
 * existirem, e paga-o uma vez.
 *
 * As escritas vão em lotes por isso mesmo: 1.811 clubes atualizados um a um seguraram o servidor tempo
 * suficiente para o smoke test do empacotamento desistir de esperar pelo /health.
 */
/** Quantos clubes se atualizam de uma vez. Acima disto o SQLite do desktop começa a devolver "database is locked". */
const LOTE = 50;

export async function backfillContracts(): Promise<number> {
  const semContrato = await prisma.club.findMany({
    where: { NOT: [{ playersJson: { contains: '"contractUntil"' } }, { playersJson: '[]' }] },
    select: { id: true, playersJson: true, academyPlayersJson: true },
  });
  if (semContrato.length === 0) return 0;

  const { seasonYear } = await getGameState();

  const escritas: Promise<unknown>[] = [];
  for (const club of semContrato) {
    /**
     * Semente pelo id do clube, para a mesma base gerar sempre os mesmos prazos.
     *
     * Sem isto, dois computadores com o mesmo save veriam elencos com contratos diferentes, e reinstalar o
     * jogo mudaria a carreira por baixo do jogador.
     */
    const rng = createRng(`contratos-${club.id}-${seasonYear}`);
    const players = (JSON.parse(club.playersJson) as Player[]).map((p) => backfillContract(p, seasonYear, rng));
    const academy = (JSON.parse(club.academyPlayersJson) as Player[]).map((p) => backfillContract(p, seasonYear, rng));

    escritas.push(
      prisma.club.update({
        where: { id: club.id },
        data: { playersJson: JSON.stringify(players), academyPlayersJson: JSON.stringify(academy) },
      }),
    );

    if (escritas.length >= LOTE) {
      await Promise.all(escritas.splice(0, escritas.length));
    }
  }

  if (escritas.length > 0) await Promise.all(escritas);

  return semContrato.length;
}

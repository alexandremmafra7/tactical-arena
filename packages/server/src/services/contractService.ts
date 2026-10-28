import { randomUUID } from 'node:crypto';
import {
  BOT_OWNER_ID,
  batchRenewContracts,
  contractEndFor,
  identifyExpiringContracts,
  processDirectorContractDelegation,
  renewContract,
  renewalCost,
  seasonsRemaining,
  type CategorizedExpiringContracts,
  type Player,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub } from './clubService.js';
import { getGameState } from './gameStateService.js';

/**
 * Renovar contrato e assinar quem está livre.
 *
 * As duas metades do trabalho de um diretor de futebol, e as duas que o jogo não tinha. Sem contrato não
 * havia o que renovar, e sem lista de passes livres não havia de onde tirar substituto — o técnico só podia
 * comprar de outro clube, e no mundo da máquina ninguém vendia.
 *
 * A regra de preço vive no `shared` (`renewalCost`), porque a tela precisa mostrar o valor antes de o técnico
 * decidir e o servidor precisa cobrá-lo. Escrever a mesma conta nos dois lados é o defeito que este projeto
 * já teve com nome de liga, divisão e partida ao vivo.
 */
export class ContractError extends Error {}

/** Quantas temporadas se pode comprar de uma vez. Cinco é o teto de um contrato novo para um garoto. */
const MAX_RENEWAL_YEARS = 5;

export async function renewPlayerContract(
  clubId: string,
  requestingUserId: string,
  playerId: string,
  years: number,
): Promise<{ club: Awaited<ReturnType<typeof getClub>>; cost: number }> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new ContractError('Você não é o dono deste clube');
  }

  const anos = Math.max(1, Math.min(MAX_RENEWAL_YEARS, Math.round(years)));
  const index = club.players.findIndex((p) => p.id === playerId);
  if (index === -1) {
    throw new ContractError('Jogador não pertence a este clube');
  }

  const { seasonYear } = await getGameState();
  const player = club.players[index];
  const director = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const cost = renewalCost(player, seasonYear, anos, director);

  if (club.budget < cost) {
    throw new ContractError(`Orçamento insuficiente: renovar por ${anos} temporada(s) custa R$ ${cost.toLocaleString('pt-BR')}`);
  }

  const players = [...club.players];
  players[index] = renewContract(player, seasonYear, anos);

  await prisma.club.update({
    where: { id: clubId },
    data: { playersJson: JSON.stringify(players), budget: club.budget - cost },
  });

  return { club: { ...club, players, budget: club.budget - cost }, cost };
}

export async function batchRenewPlayerContracts(
  clubId: string,
  requestingUserId: string,
  playerIds: string[],
  optionsOrYears: number | { years?: number; yearsMap?: Record<string, number>; updateWages?: boolean } = 2,
): Promise<{ club: Awaited<ReturnType<typeof getClub>>; totalCost: number; renewedCount: number; failedPlayerIds: string[] }> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new ContractError('Você não é o dono deste clube');
  }

  const { seasonYear } = await getGameState();
  const options =
    typeof optionsOrYears === 'number'
      ? { years: optionsOrYears, updateWages: true }
      : { updateWages: true, ...optionsOrYears };

  const batchResult = batchRenewContracts(club, playerIds, seasonYear, options);

  if (batchResult.renewedPlayers.length > 0) {
    await prisma.club.update({
      where: { id: clubId },
      data: {
        playersJson: JSON.stringify(batchResult.updatedClub.players),
        budget: batchResult.updatedClub.budget,
      },
    });
  }

  return {
    club: batchResult.updatedClub,
    totalCost: batchResult.totalCost,
    renewedCount: batchResult.renewedPlayers.length,
    failedPlayerIds: batchResult.failedPlayerIds,
  };
}

export async function processClubDelegatedRenewals(clubId: string): Promise<void> {
  const club = await getClub(clubId).catch(() => null);
  if (!club || club.ownerId === BOT_OWNER_ID) return;

  const { seasonYear } = await getGameState();
  const delegationOutcome = processDirectorContractDelegation(club, seasonYear);

  if (delegationOutcome.renewedCount > 0) {
    await prisma.club.update({
      where: { id: clubId },
      data: {
        playersJson: JSON.stringify(delegationOutcome.club.players),
        budget: delegationOutcome.club.budget,
      },
    });

    if (delegationOutcome.headline) {
      await prisma.newsItem.create({
        data: {
          id: randomUUID(),
          clubId: club.id,
          category: 'CONTRACT',
          headline: delegationOutcome.headline,
        },
      });
    }
  }

  if (delegationOutcome.keyPlayersRequiringDecision.length > 0) {
    const keyNames = delegationOutcome.keyPlayersRequiringDecision.map((i) => i.player.name).slice(0, 2).join(', ');
    const count = delegationOutcome.keyPlayersRequiringDecision.length;
    const alertHeadline =
      count === 1
        ? `⚠️ Alerta da Diretoria: Contrato do craque ${keyNames} está prestes a expirar. Decisão urgente necessária!`
        : `⚠️ Alerta da Diretoria: ${count} jogadores-chave (${keyNames}...) estão com contrato expirando. Decisão urgente necessária!`;

    const alreadyAlerted = await prisma.newsItem.findFirst({
      where: { clubId: club.id, headline: alertHeadline },
    });
    if (!alreadyAlerted) {
      await prisma.newsItem.create({
        data: {
          id: randomUUID(),
          clubId: club.id,
          category: 'CONTRACT',
          headline: alertHeadline,
        },
      });
    }
  }
}

export interface FreeAgentSummary {
  id: string;
  player: Player;
  sinceSeason: number;
}

/**
 * Quem está sem clube.
 *
 * Ordenado por qualidade porque é assim que se olha uma lista dessas, e limitado porque o mundo produz
 * centenas de passes livres por temporada e nenhuma tela quer todos de uma vez.
 */
export async function listFreeAgents(options: { country?: string; position?: string; limit?: number } = {}): Promise<FreeAgentSummary[]> {
  const records = await prisma.freeAgent.findMany({
    where: {
      ...(options.country ? { country: options.country } : {}),
      ...(options.position ? { position: options.position } : {}),
    },
    orderBy: { overall: 'desc' },
    take: Math.min(200, Math.max(1, options.limit ?? 50)),
  });

  return records.map((r) => ({
    id: r.id,
    player: JSON.parse(r.playerJson) as Player,
    sinceSeason: r.sinceSeason,
  }));
}

/**
 * Assina um jogador livre.
 *
 * Não há taxa de transferência, que é o ponto de um passe livre: paga-se uma luva proporcional ao salário e
 * pronto. O clube que perdeu o jogador não recebe nada, e é essa perda que faz renovar cedo valer a pena.
 */
export async function signFreeAgent(
  clubId: string,
  requestingUserId: string,
  freeAgentId: string,
  years?: number,
): Promise<{ club: Awaited<ReturnType<typeof getClub>>; cost: number; player: Player }> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new ContractError('Você não é o dono deste clube');
  }

  const record = await prisma.freeAgent.findUnique({ where: { id: freeAgentId } });
  if (!record) {
    throw new ContractError('Este jogador já assinou com outro clube');
  }

  const { seasonYear } = await getGameState();
  const livre = JSON.parse(record.playerJson) as Player;
  const anos = Math.max(1, Math.min(MAX_RENEWAL_YEARS, Math.round(years ?? 3)));

  /**
   * A luva de um passe livre: doze semanas de salário por temporada contratada.
   *
   * Barato ao lado de uma transferência, e é assim que deve ser — a vantagem do passe livre é justamente
   * não haver taxa. O que ele custa mesmo é a folha, que entra toda semana no extrato.
   */
  const cost = Math.max(1, Math.round(livre.wage * 12 * anos));
  if (club.budget < cost) {
    throw new ContractError(`Orçamento insuficiente: a luva é de R$ ${cost.toLocaleString('pt-BR')}`);
  }

  const assinado: Player = {
    ...livre,
    // Id novo, porque o antigo carregava o clube de origem e dois clubes não podem partilhar um jogador.
    id: randomUUID(),
    contractUntil: contractEndFor(livre.age, seasonYear) + (anos - 1),
  };

  /**
   * A remoção da lista e a entrada no elenco numa transação só.
   *
   * Sem isso, duas assinaturas do mesmo passe livre em paralelo poriam o jogador em dois clubes, ou o
   * tirariam da lista sem ele chegar a lugar nenhum.
   */
  const players = [...club.players, assinado];
  await prisma.$transaction([
    prisma.freeAgent.delete({ where: { id: freeAgentId } }),
    prisma.club.update({
      where: { id: clubId },
      data: { playersJson: JSON.stringify(players), budget: club.budget - cost },
    }),
  ]);

  return { club: { ...club, players, budget: club.budget - cost }, cost, player: assinado };
}

/**
 * O que a tela precisa saber sobre os contratos do elenco, sem repetir a conta de preço no cliente.
 */
export async function contractOverview(clubId: string, requestingUserId: string): Promise<{
  seasonYear: number;
  players: { playerId: string; contractUntil: number | null; seasonsRemaining: number; costByYears: Record<string, number> }[];
  expiringAnalysis: CategorizedExpiringContracts;
}> {
  const club = await getClub(clubId);
  if (club.ownerId !== requestingUserId) {
    throw new ContractError('Você não é o dono deste clube');
  }

  const { seasonYear } = await getGameState();
  const director = club.staff?.find((s) => s.role === 'FOOTBALL_DIRECTOR');
  const expiringAnalysis = identifyExpiringContracts(club, 10, seasonYear);

  return {
    seasonYear,
    players: club.players.map((p) => ({
      playerId: p.id,
      contractUntil: p.contractUntil ?? null,
      seasonsRemaining: seasonsRemaining(p, seasonYear),
      // O preço de cada duração, para a tela oferecer a escolha sem inventar a conta.
      costByYears: Object.fromEntries(
        [1, 2, 3, 4, 5].map((anos) => [anos, renewalCost(p, seasonYear, anos, director)]),
      ),
    })),
    expiringAnalysis,
  };
}

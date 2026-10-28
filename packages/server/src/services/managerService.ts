import { randomUUID } from 'node:crypto';
import { createRng, generatePlayerName, getCountry, calculateClubVisibility } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';

/**
 * Os treinadores do mundo.
 *
 * O jogo não tinha nenhum: todo clube da máquina era `BOT_OWNER_ID` e mais nada. A consequência é maior do
 * que parece — sem treinador não há de quem um clube se separar, nenhuma vaga pode abrir, e "outro clube se
 * interessou por você" seria ficção, porque os clubes não teriam a quem dispensar para o contratar.
 *
 * Não há inteligência aqui, e nem deve haver: o treinador da máquina não escala, não treina e não contrata.
 * Ele é um nome, uma reputação e um vínculo, e é isso que basta para o mercado existir e para a notícia ter
 * sujeito. Quem decide alguma coisa é a confiança da diretoria, que mora no `shared`.
 */

/** Onde a reputação começa para quem não dirige nada. */
const REPUTACAO_BASE = 50;

/** Quanto se perde ao ser demitido. Duas demissões seguidas já mudam a faixa de clube que procura o técnico. */
export const REPUTATION_SACK_PENALTY = 12;

/** Quanto se perde ao abandonar um clube com a temporada correndo. */
export const REPUTATION_WALKOUT_PENALTY = 8;

export interface ManagerView {
  id: string;
  name: string;
  nationality: string | null;
  reputation: number;
  clubId: string | null;
  userId: string | null;
}

/**
 * A reputação com que um treinador nasce, tirada da estatura do clube que dirige.
 *
 * Quem comanda o Palmeiras chegou lá por alguma razão, e quem comanda um clube de terceira divisão também.
 * Reaproveita `calculateClubVisibility`, que já compõe elenco, estádio, sócios, títulos e divisão numa nota
 * de 0 a 100 e já é a régua que o jogo usa para contratar comissão técnica e negociar transferências —
 * inventar uma segunda régua de estatura seria criar duas verdades sobre o tamanho do mesmo clube.
 */
export function startingReputation(visibilityScore: number): number {
  // Comprimido para o meio da escala: o mundo não começa com ninguém em 5 nem em 98, porque reputação é
  // história e ninguém tem história no primeiro dia.
  return Math.round(30 + visibilityScore * 0.45);
}

/**
 * Cria os treinadores que faltam, um por clube sem ninguém.
 *
 * Idempotente por construção: só olha clube que não tem treinador. É assim que o mundo importado ganha
 * comando de uma vez e que um clube fundado depois ganha o seu na primeira passagem seguinte, sem precisar
 * de nenhuma marca de "já rodou".
 */
export async function ensureManagersForAllClubs(nomesReais: Map<string, string> = new Map()): Promise<number> {
  const comTreinador = new Set(
    (await prisma.manager.findMany({ where: { clubId: { not: null } }, select: { clubId: true } })).map((m) => m.clubId!),
  );

  /**
   * Descobrir quem falta é uma consulta; ler o elenco é outra.
   *
   * Trazer `playersJson` de todos os clubes para depois descartar quase todos custaria os 104 MB do mundo
   * inteiro a cada arranque — que é exatamente como o backfill de contratos segurou o servidor além do
   * tempo que o empacotamento espera pelo `/health`. Primeiro os ids, que são baratos; o elenco só de quem
   * de facto vai ganhar treinador, que num mundo já importado é ninguém.
   */
  const ids = (await prisma.club.findMany({ select: { id: true } })).map((c) => c.id).filter((id) => !comTreinador.has(id));
  if (ids.length === 0) return 0;

  const clubes = await prisma.club.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, country: true, titlesWon: true, membersCount: true, stadiumCapacity: true, playersJson: true },
  });

  /**
   * A divisão vem da liga, e importa mais do que parece.
   *
   * Tratar todo clube como se fosse de primeira divisão espremeu a reputação do mundo inteiro entre 36 e 62:
   * o técnico do Real Madrid ficava a 21 pontos de um treinador de terceira divisão, e o mercado não teria
   * como distinguir a quem oferecer o quê. A divisão não fica no `Club` — mora na `League` — então é aqui
   * que se cruza, uma vez, com uma consulta que traz as 128 ligas do mundo.
   */
  const divisaoPorClube = new Map<string, number>();
  for (const liga of await prisma.league.findMany({ select: { division: true, clubIdsJson: true } })) {
    for (const id of JSON.parse(liga.clubIdsJson) as string[]) divisaoPorClube.set(id, liga.division);
  }

  const novos: { id: string; name: string; nationality: string | null; reputation: number; clubId: string }[] = [];

  for (const clube of clubes) {
    const real = clube.slug ? nomesReais.get(clube.slug) : undefined;

    /**
     * Nome inventado só onde não há um real, e com a semente presa ao clube.
     *
     * Sem semente estável, reinstalar o jogo trocaria o treinador de metade do mundo — e o técnico que o
     * jogador enfrentou a temporada toda viraria outra pessoa sem nada ter acontecido.
     */
    const rng = createRng(`treinador-${clube.id}`);
    const continente = getCountry(clube.country)?.continent ?? 'EUROPE';
    const nome = real ?? generatePlayerName(continente, rng);

    const visibilidade = calculateClubVisibility(
      { id: clube.id, players: JSON.parse(clube.playersJson), stadiumCapacity: clube.stadiumCapacity } as never,
      divisaoPorClube.get(clube.id) ?? 3,
      clube.titlesWon,
      clube.membersCount ?? undefined,
    ).score;

    novos.push({
      id: randomUUID(),
      name: nome,
      // Nome real não ganha nacionalidade inventada: Abel Ferreira dirige no Brasil e é português.
      nationality: real ? null : clube.country,
      reputation: startingReputation(visibilidade),
      clubId: clube.id,
    });
  }

  // Em lotes, porque são 1.800 clubes e escrever um a um segurou o arranque do servidor quando o backfill
  // de contratos fez exatamente isso.
  const LOTE = 200;
  for (let i = 0; i < novos.length; i += LOTE) {
    await prisma.manager.createMany({ data: novos.slice(i, i + LOTE) });
  }

  return novos.length;
}

/**
 * O bolsão de desempregados, para toda vaga ter candidato.
 *
 * Sem ele, o primeiro clube a demitir alguém ficaria sem comando para sempre, e a segunda demissão do mundo
 * não teria para onde mandar o demitido. O bolsão nasce pequeno de propósito: ele se enche sozinho conforme
 * o mundo demite, e um mundo cheio de técnicos sem clube no primeiro dia não parece futebol.
 */
export async function ensureUnemployedPool(minimo = 24): Promise<number> {
  const livres = await prisma.manager.count({ where: { clubId: null } });
  if (livres >= minimo) return 0;

  const rng = createRng(`bolsao-${minimo}-${livres}`);
  const continentes = ['SOUTH_AMERICA', 'EUROPE', 'AFRICA', 'ASIA', 'NORTH_AMERICA', 'OCEANIA'] as const;

  const novos = Array.from({ length: minimo - livres }, (_, i) => ({
    id: randomUUID(),
    name: generatePlayerName(continentes[i % continentes.length], rng),
    nationality: null,
    reputation: Math.round(REPUTACAO_BASE + (rng() - 0.5) * 30),
    clubId: null,
  }));

  await prisma.manager.createMany({ data: novos });
  return novos.length;
}

export async function getManagerForClub(clubId: string): Promise<ManagerView | null> {
  const m = await prisma.manager.findFirst({ where: { clubId } });
  return m ? { id: m.id, name: m.name, nationality: m.nationality, reputation: m.reputation, clubId: m.clubId, userId: m.userId } : null;
}

/**
 * Tira o treinador do clube e devolve-o ao bolsão, com a reputação já cobrada.
 *
 * A saída e o custo andam juntos numa função só porque separá-los é como se acaba com um mundo cheio de
 * demissões sem consequência: quem chama para demitir raramente lembra de cobrar depois.
 */
export async function releaseManager(clubId: string, penalty: number): Promise<ManagerView | null> {
  const atual = await prisma.manager.findFirst({ where: { clubId } });
  if (!atual) return null;

  const reputacao = Math.max(1, Math.min(100, atual.reputation - penalty));
  const m = await prisma.manager.update({ where: { id: atual.id }, data: { clubId: null, reputation: reputacao } });
  return { id: m.id, name: m.name, nationality: m.nationality, reputation: m.reputation, clubId: null, userId: m.userId };
}

/**
 * O clube escolhe entre os desempregados, dentro do que a estatura dele alcança.
 *
 * Um clube grande não contrata qualquer um e um clube pequeno não consegue o melhor do mercado. A regra é
 * uma só: o melhor candidato cuja reputação não passe muito do que o clube merece. Sem o teto, todo clube do
 * mundo disputaria o mesmo nome e o bolsão esvaziaria pelo topo.
 */
export async function hireBestAvailable(clubId: string, clubVisibility: number): Promise<ManagerView | null> {
  const teto = startingReputation(clubVisibility) + 10;

  const candidato =
    (await prisma.manager.findFirst({
      where: { clubId: null, userId: null, reputation: { lte: teto } },
      orderBy: { reputation: 'desc' },
    })) ??
    // Nenhum candidato à altura é motivo para contratar o mais modesto que houver, não para o clube ficar
    // sem comando: um clube sem treinador é um estado que nada no jogo sabe representar.
    (await prisma.manager.findFirst({ where: { clubId: null, userId: null }, orderBy: { reputation: 'asc' } }));

  if (!candidato) return null;

  const m = await prisma.manager.update({ where: { id: candidato.id }, data: { clubId } });
  return { id: m.id, name: m.name, nationality: m.nationality, reputation: m.reputation, clubId: m.clubId, userId: m.userId };
}

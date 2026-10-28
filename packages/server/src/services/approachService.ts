import { randomUUID } from 'node:crypto';
import {
  attractsInterest,
  BOT_OWNER_ID,
  calculateClubVisibility,
  canBeApproachedBy,
  CONFIDENCE_START,
  explainBlock,
  INTEREST_CEILING,
  type Player,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { startingReputation } from './managerService.js';
import { divisionOfClub, getGameMode } from './gameModeService.js';

/**
 * A sondagem: um clube que abriu vaga vai buscar quem está bem em outro lugar.
 *
 * Sem isto o mercado de técnicos só teria uma direção. Toda vaga seria preenchida pelo bolsão de
 * desempregados, e um treinador que fizesse uma temporada excelente num clube pequeno ficaria lá para
 * sempre — o mundo teria demissões e nenhuma ascensão, que é meia história.
 *
 * A regra é curta e tem duas condições, ambas necessárias:
 *
 *  - **o técnico tem de estar bem** onde está (`attractsInterest`), porque ninguém contrata alguém que a
 *    própria diretoria está prestes a demitir;
 *  - **o clube que sonda tem de ser maior**, com folga, senão a sondagem seria um convite para descer, e
 *    o mundo trocaria de treinadores em círculos sem nada melhorar.
 */

/**
 * Quanto de estatura o clube que sonda precisa ter a mais.
 *
 * Sem margem, dois clubes praticamente do mesmo tamanho ficariam a roubar treinadores um do outro toda
 * semana, e a rotatividade viraria ruído — o mesmo defeito que mataria a notícia de troca de comando.
 */
const MARGEM_DE_ESTATURA = 8;

export interface ApproachView {
  id: string;
  clubId: string;
  clubName: string;
  clubCountry: string;
  /** Estatura do clube interessado, para a tela poder comparar com o atual. */
  visibility: number;
  /** A divisão em que este clube joga, que é o que o modo de carreira consulta. */
  division: number;
  /** Verdadeiro quando o modo de carreira não deixa aceitar. */
  locked: boolean;
  /** Por que não se pode aceitar. Null quando se pode. */
  lockReason: string | null;
  createdAt: string;
}

async function visibilidadeDe(clubId: string): Promise<number> {
  const clube = await prisma.club.findUnique({
    where: { id: clubId },
    select: { id: true, playersJson: true, stadiumCapacity: true, titlesWon: true, membersCount: true },
  });
  if (!clube) return 40;
  return calculateClubVisibility(
    { id: clube.id, players: JSON.parse(clube.playersJson) as Player[], stadiumCapacity: clube.stadiumCapacity } as never,
    1,
    clube.titlesWon,
    clube.membersCount ?? undefined,
  ).score;
}

export interface PoachTarget {
  managerId: string;
  name: string;
  fromClubId: string;
  isPlayer: boolean;
}

/**
 * Quem este clube tentaria tirar de outro, se pudesse.
 *
 * Devolve o melhor candidato empregado que satisfaz as duas condições, ou null quando não há ninguém a
 * quem valha a pena sondar — que é o caso comum, e por isso a busca é barata e ordenada por reputação.
 */
export async function pickPoachTarget(clubId: string, clubVisibility?: number): Promise<PoachTarget | null> {
  /**
   * A estatura do clube é calculada aqui quando não vem pronta.
   *
   * Recebê-la sempre de fora convidava ao erro que de facto aconteceu: um chamador passar um número que não
   * corresponde ao clube, e a comparação com os outros clubes ficar entre uma estatura real e uma inventada.
   * Quem já a tem em mãos passa-a e poupa a consulta; quem não tem não precisa arranjar uma.
   */
  const estatura = clubVisibility ?? (await visibilidadeDe(clubId));
  const teto = startingReputation(estatura) + 10;

  /**
   * Ordenado por confiança, e não por reputação.
   *
   * Por reputação a busca via os treinadores mais reputados do mundo — que trabalham exatamente nos clubes
   * grandes, nunca nos pequenos — e depois nenhum deles passava no filtro de estatura. Medido: a sondagem
   * não disparava uma única vez. Quem um clube vai buscar é quem está **em alta**, e a reputação entra como
   * teto de alcance, não como ordem de preferência.
   */
  const candidatos = await prisma.manager.findMany({
    where: { clubId: { not: null }, NOT: { clubId }, reputation: { lte: teto }, confidence: { gte: INTEREST_CEILING } },
    orderBy: { confidence: 'desc' },
    select: { id: true, name: true, clubId: true, confidence: true, userId: true },
    take: 50,
  });

  for (const candidato of candidatos) {
    // Ninguém contrata quem a própria diretoria está prestes a mandar embora.
    if (!attractsInterest(candidato.confidence)) continue;

    const atual = await visibilidadeDe(candidato.clubId!);
    if (estatura - atual < MARGEM_DE_ESTATURA) continue;

    return { managerId: candidato.id, name: candidato.name, fromClubId: candidato.clubId!, isPlayer: !!candidato.userId };
  }

  return null;
}

/**
 * Registra a sondagem ao técnico do jogador, que é o único que decide.
 *
 * Um treinador da máquina não recusa: a troca acontece e pronto. O do jogador recebe um convite, porque a
 * decisão de mudar de clube é dele e de mais ninguém — automatizá-la seria o oposto do jogo.
 *
 * Só uma sondagem por clube de cada vez: o mesmo clube insistindo toda semana viraria exatamente o ruído
 * que o sistema de reuniões inteiro existe para evitar.
 */
export async function recordApproach(managerId: string, clubId: string, fromClubId: string): Promise<void> {
  const jaExiste = await prisma.managerApproach.findFirst({ where: { managerId, clubId, status: 'PENDING' } });
  if (jaExiste) return;

  await prisma.managerApproach.create({
    data: { id: randomUUID(), managerId, clubId, fromClubId, status: 'PENDING' },
  });
}

/** As sondagens abertas para o técnico deste usuário, já com o que a tela precisa mostrar. */
export async function listApproaches(userId: string): Promise<ApproachView[]> {
  const meu = await prisma.manager.findFirst({ where: { userId }, select: { id: true } });
  if (!meu) return [];

  const mode = getGameMode(userId);

  const sondagens = await prisma.managerApproach.findMany({
    where: { managerId: meu.id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const vistas: ApproachView[] = [];
  for (const sondagem of sondagens) {
    const clube = await prisma.club.findUnique({
      where: { id: sondagem.clubId },
      select: { name: true, country: true, ownerId: true },
    });
    // Um clube que arranjou técnico entretanto já não está a sondar ninguém.
    if (!clube || clube.ownerId !== BOT_OWNER_ID) continue;

    /**
     * A sondagem que o modo não alcança aparece, com cadeado.
     *
     * Escondê-la seria mais simples e pior: o técnico do modo padrão nunca saberia que o gigante o queria, e
     * o teto do modo seria invisível — um jogo que dá menos sem dizer que dá menos. Mostrando, o limite vira
     * informação, e a assinatura vira uma escolha em vez de uma surpresa.
     */
    const division = await divisionOfClub(sondagem.clubId);
    const permitido = canBeApproachedBy(mode, division);

    vistas.push({
      id: sondagem.id,
      clubId: sondagem.clubId,
      clubName: clube.name,
      clubCountry: clube.country,
      visibility: await visibilidadeDe(sondagem.clubId),
      division,
      locked: !permitido,
      lockReason: permitido ? null : explainBlock(mode, 'division'),
      createdAt: sondagem.createdAt.toISOString(),
    });
  }

  return vistas;
}

export class ApproachError extends Error {}

/**
 * O técnico aceita, e muda de clube na mesma hora.
 *
 * Sair no meio da temporada é permitido de propósito, e custa reputação. A alternativa — só permitir a
 * troca na virada — foi considerada e descartada: o modelo de passagens já divide uma temporada entre dois
 * treinadores, porque foi construído para o pedido de demissão que sempre existiu. O que faltava não era
 * código, era preço.
 */
export async function acceptApproach(approachId: string, userId: string): Promise<{ clubId: string }> {
  const sondagem = await prisma.managerApproach.findUnique({ where: { id: approachId } });
  if (!sondagem || sondagem.status !== 'PENDING') {
    throw new ApproachError('Esta sondagem já não está aberta');
  }

  const meu = await prisma.manager.findFirst({ where: { userId } });
  if (!meu || meu.id !== sondagem.managerId) {
    throw new ApproachError('Esta sondagem não é sua');
  }

  const clube = await prisma.club.findUnique({ where: { id: sondagem.clubId }, select: { ownerId: true } });
  if (!clube || clube.ownerId !== BOT_OWNER_ID) {
    throw new ApproachError('Este clube já contratou outro técnico');
  }

  await prisma.managerApproach.update({ where: { id: approachId }, data: { status: 'ACCEPTED' } });
  // As outras caducam: quem aceitou uma não está mais no mercado.
  await prisma.managerApproach.updateMany({
    where: { managerId: meu.id, status: 'PENDING', id: { not: approachId } },
    data: { status: 'EXPIRED' },
  });

  return { clubId: sondagem.clubId };
}

/** O técnico diz não, e aquele clube não volta a perguntar. */
export async function declineApproach(approachId: string, userId: string): Promise<void> {
  const meu = await prisma.manager.findFirst({ where: { userId }, select: { id: true } });
  const sondagem = await prisma.managerApproach.findUnique({ where: { id: approachId } });
  if (!meu || !sondagem || sondagem.managerId !== meu.id) {
    throw new ApproachError('Esta sondagem não é sua');
  }
  await prisma.managerApproach.update({ where: { id: approachId }, data: { status: 'DECLINED' } });
}

/**
 * Move um treinador da máquina de um clube para outro, e abre a vaga que ele deixa.
 *
 * A vaga aberta não é preenchida aqui: quem chama é que sabe o que fazer com ela, e resolvê-la neste
 * arquivo criaria uma recursão em que cada troca dispara outra troca mundo afora.
 */
export async function movePoachedManager(managerId: string, toClubId: string): Promise<string | null> {
  const treinador = await prisma.manager.findUnique({ where: { id: managerId } });
  if (!treinador || !treinador.clubId) return null;

  const deixado = treinador.clubId;

  /**
   * A cadeira de destino é esvaziada antes, se ainda houver alguém nela.
   *
   * No fluxo normal ela já está vazia — a vaga é o que motivou a sondagem. Mas `clubId` é único no banco, e
   * confiar em quem chama para garantir isso significa que o dia em que alguém não garantir, o erro será
   * uma violação de índice no meio de um tick semanal e não algo que se possa tratar.
   */
  const ocupante = await prisma.manager.findFirst({ where: { clubId: toClubId } });
  if (ocupante && ocupante.id !== managerId) {
    await prisma.manager.update({ where: { id: ocupante.id }, data: { clubId: null } });
  }
  await prisma.manager.update({
    where: { id: managerId },
    // Confiança recomeça no clube novo: é outra diretoria, e ela ainda não tem opinião formada.
    data: { clubId: toClubId, confidence: CONFIDENCE_START, warnings: 0, confidenceReason: null },
  });

  return deixado;
}

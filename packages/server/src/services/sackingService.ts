import { randomUUID } from 'node:crypto';
import {
  BOT_OWNER_ID,
  calculateClubVisibility,
  shouldSack,
  CONFIDENCE_START,
  type Player,
} from '@tactical-arena/shared';
import { prisma, type Db } from '../db/prisma.js';
import { closeTenure } from './careerService.js';
import { hireBestAvailable, releaseManager, REPUTATION_SACK_PENALTY } from './managerService.js';
import { readSavesIndex } from './saveService.js';
import { movePoachedManager, pickPoachTarget, recordApproach } from './approachService.js';
import { isSackImmune } from './gameModeService.js';

/**
 * A demissão, que é onde a confiança da diretoria deixa de ser aviso e passa a ter consequência.
 *
 * Duas regras mandam aqui, e as duas existem para a demissão ser história em vez de sorteio:
 *
 *  - **ninguém é demitido sem ter sido avisado** — a condição está em `shouldSack` e é verificada de novo
 *    neste arquivo, porque é a única coisa que separa "eu vi vir e não reagi" de "o jogo me expulsou";
 *  - **o clube nunca fica sem comando** — um clube sem treinador é um estado que nada no jogo sabe
 *    representar, e a vaga é preenchida na mesma passagem em que é aberta.
 *
 * Para o jogador, ser demitido não acaba com a carreira: acaba com a passagem. O clube volta ao mercado, a
 * tenure fecha com o motivo registrado, e a tela de ofertas — que já existia para o técnico desempregado —
 * passa a ser o começo do próximo capítulo, mais abaixo do que o anterior. É isso que dá peso ao que veio
 * antes.
 */

export interface SackingOutcome {
  /** Quantos treinadores da máquina perderam o emprego nesta passagem. */
  botsSacked: number;
  /** Verdadeiro quando o próprio jogador foi demitido. */
  playerSacked: boolean;
  /** O clube de onde o jogador saiu, para a tela saber para onde levá-lo. */
  playerFormerClubId: string | null;
  /** Sondagens abertas ao técnico do jogador nesta passagem. */
  approaches: number;
}

/**
 * Preenche uma vaga, tentando primeiro tirar alguém de outro clube.
 *
 * A ordem é o que dá duas direções ao mercado. Se a vaga fosse sempre preenchida pelo bolsão, o mundo
 * teria demissões e nenhuma ascensão: um treinador que fizesse uma temporada excelente num clube pequeno
 * ficaria lá para sempre.
 *
 * Devolve quantas sondagens foram abertas ao jogador — zero na esmagadora maioria das vezes.
 */
async function preencherVaga(clubId: string, clubName: string): Promise<number> {
  const visibilidade = await visibilidadeDe(clubId);
  const alvo = await pickPoachTarget(clubId, visibilidade);

  if (alvo?.isPlayer) {
    /**
     * Ao técnico do jogador não se troca de clube por decreto: convida-se.
     *
     * E o clube não fica à espera da resposta — contrata alguém do bolsão para comandar enquanto isso, que
     * é o que um clube de verdade faz. Se o convite for aceito, esse interino volta ao mercado.
     */
    await recordApproach(alvo.managerId, clubId, alvo.fromClubId);
    const interino = await hireBestAvailable(clubId, visibilidade);
    if (interino) await publicarChegada(clubId, clubName, interino.name);
    return 1;
  }

  if (alvo) {
    const deixado = await movePoachedManager(alvo.managerId, clubId);
    await publicarChegada(clubId, clubName, alvo.name);

    /**
     * O clube que perdeu o treinador contrata do bolsão, e não sonda por sua vez.
     *
     * Deixá-lo sondar transformaria uma demissão numa reação em cadeia mundo afora, e a cada semana o
     * jogador leria dezenas de notícias de troca de comando — o excesso que mata qualquer sistema de avisos.
     */
    if (deixado) {
      const reposto = await hireBestAvailable(deixado, await visibilidadeDe(deixado));
      const clubeDeixado = await prisma.club.findUnique({ where: { id: deixado }, select: { name: true } });
      if (reposto && clubeDeixado) {
        await publicarDemissao(deixado, clubeDeixado.name, alvo.name);
        await publicarChegada(deixado, clubeDeixado.name, reposto.name);
      }
    }
    return 0;
  }

  const contratado = await hireBestAvailable(clubId, visibilidade);
  if (contratado) await publicarChegada(clubId, clubName, contratado.name);
  return 0;
}

/** Quantos clubes se resolvem de uma vez. */
const LOTE = 100;

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

/**
 * Percorre o mundo e executa as demissões que a semana tornou inevitáveis.
 *
 * Roda depois do recálculo da confiança, e nunca antes: demitir com a nota da semana passada seria julgar
 * alguém por uma partida que já foi jogada desde então.
 */
export async function processSackings(): Promise<SackingOutcome> {
  const candidatos = await prisma.manager.findMany({
    where: { clubId: { not: null }, warnings: { gt: 0 } },
    select: { id: true, name: true, clubId: true, confidence: true, warnings: true, userId: true },
    take: LOTE,
  });

  let botsSacked = 0;
  let playerSacked = false;
  let playerFormerClubId: string | null = null;
  let approaches = 0;

  for (const treinador of candidatos) {
    if (!shouldSack(treinador.confidence, treinador.warnings)) continue;

    const clube = await prisma.club.findUnique({
      where: { id: treinador.clubId! },
      select: { id: true, name: true, ownerId: true },
    });
    if (!clube) continue;

    const doJogador = clube.ownerId !== BOT_OWNER_ID;

    /**
     * O técnico do modo do zero não é demitido.
     *
     * O clube foi fundado por ele; não há dono para o mandar embora, e uma demissão apagaria a única coisa
     * que o modo pede. A pressão continua toda: o presidente bate à porta e a confiança cai na barra. Ela é
     * atmosfera, e não ameaça.
     */
    if (doJogador && isSackImmune(clube.ownerId)) continue;

    await releaseManager(clube.id, REPUTATION_SACK_PENALTY);
    await publicarDemissao(clube.id, clube.name, treinador.name);

    if (doJogador) {
      /**
       * O clube volta ao mercado e a passagem fecha com o motivo gravado.
       *
       * O mesmo caminho que a demissão voluntária já usava, com um motivo diferente — e é essa diferença
       * que a tela de carreira mostra depois, distinguindo quem saiu de quem foi mandado embora.
       */
      await prisma.club.update({ where: { id: clube.id }, data: { ownerId: BOT_OWNER_ID } });
      await closeTenure(clube.id, clube.ownerId, 'SACKED');
      playerSacked = true;
      playerFormerClubId = clube.id;
    } else {
      botsSacked += 1;
    }

    // A vaga é preenchida na mesma passagem em que abre, inclusive a que o jogador deixou.
    approaches += await preencherVaga(clube.id, clube.name);
  }

  return { botsSacked, playerSacked, playerFormerClubId, approaches };
}

/**
 * Põe o jogador no comando de um clube, tirando quem estava lá.
 *
 * Sem isto o mundo tem um buraco silencioso: `ensureManagersForAllClubs` dá comando a todo clube, e quando o
 * jogador assume um deles o treinador da máquina continua sentado na cadeira. A confiança seria calculada
 * para um fantasma, e a demissão do jogador demitiria outra pessoa.
 *
 * A identidade do técnico do jogador vem do save, que é onde ela sempre morou — nome, sobrenome e
 * nacionalidade escolhidos na criação da carreira.
 */
export interface ManagerSeatIdentity {
  name: string;
  nationality: string | null;
}

export async function seatUserAsManager(
  clubId: string,
  userId: string,
  identity?: ManagerSeatIdentity,
  db: Pick<Db, 'manager'> = prisma,
): Promise<void> {
  const anterior = await db.manager.findFirst({ where: { clubId } });
  // Quem estava no cargo vai para o mercado sem penalidade: não foi demitido, foi substituído.
  if (anterior && anterior.userId !== userId) {
    await db.manager.update({
      where: { id: anterior.id },
      data: { clubId: null },
    });
  }

  const save = identity
    ? undefined
    : readSavesIndex().saves.find((slot) => slot.managerUserId === userId);
  const nome = identity?.name.trim() || save?.managerName?.trim() || 'Técnico';
  const nationality = identity?.nationality ?? save?.managerNationality ?? null;

  const meu = await db.manager.findFirst({ where: { userId } });
  if (meu) {
    /**
     * A confiança recomeça a cada clube, e a reputação não.
     *
     * São duas coisas diferentes: reputação é o que o mercado lembra da carreira inteira e por isso viaja
     * com o técnico; confiança é o que **esta** diretoria acha dele, e ninguém chega a um clube novo já
     * desacreditado pelo que fez no anterior.
     */
    await db.manager.update({
      where: { id: meu.id },
      data: { clubId, confidence: CONFIDENCE_START, warnings: 0, confidenceReason: null },
    });
    return;
  }

  await db.manager.create({
    data: {
      id: randomUUID(),
      name: nome,
      nationality,
      reputation: 50,
      userId,
      clubId,
      confidence: CONFIDENCE_START,
    },
  });
}

/**
 * Tira o jogador do comando quando ele sai por vontade própria, e põe outro no lugar.
 *
 * O custo de reputação é do chamador, porque só ele sabe se a saída foi um pedido de demissão no meio da
 * temporada ou uma transferência acertada — e as duas custam coisas diferentes.
 */
export async function unseatUserAsManager(clubId: string, penalty: number): Promise<void> {
  await releaseManager(clubId, penalty);
  const contratado = await hireBestAvailable(clubId, await visibilidadeDe(clubId));
  const clube = await prisma.club.findUnique({ where: { id: clubId }, select: { name: true } });
  if (contratado && clube) await publicarChegada(clubId, clube.name, contratado.name);
}

/**
 * A notícia, que é o que faz a rotatividade do mundo ser sentida em vez de apenas acontecer.
 *
 * Falhar aqui não pode desfazer uma demissão: a notícia é o relato do fato, não o fato.
 */
async function publicarDemissao(clubId: string, clubName: string, managerName: string): Promise<void> {
  await prisma.newsItem
    .create({
      data: {
        id: randomUUID(),
        clubId,
        category: 'MANAGER',
        headline: `${managerName} deixa o comando do ${clubName}`,
      },
    })
    .catch(() => null);
}

async function publicarChegada(clubId: string, clubName: string, managerName: string): Promise<void> {
  await prisma.newsItem
    .create({
      data: {
        id: randomUUID(),
        clubId,
        category: 'MANAGER',
        headline: `${managerName} é o novo técnico do ${clubName}`,
      },
    })
    .catch(() => null);
}

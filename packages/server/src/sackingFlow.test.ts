import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from './db/prisma.js';
import { ensureSchema } from './db/ensureSchema.js';
import { ensureManagersForAllClubs, ensureUnemployedPool, getManagerForClub } from './services/managerService.js';
import { processSackings, seatUserAsManager, unseatUserAsManager } from './services/sackingService.js';
import { getCareer } from './services/careerService.js';
import { openTenure } from './services/careerService.js';
import { BOT_OWNER_ID, generateStarterSquad, SACK_FLOOR, CONFIDENCE_START } from '@tactical-arena/shared';

/**
 * A demissão, que é onde a nota deixa de ser aviso e passa a ter consequência.
 *
 * O que estes testes protegem é a diferença entre história e sorteio. Uma demissão que chega sem aviso é o
 * jogo expulsando o jogador por um número que ele nunca viu; com aviso, foi ele quem não reagiu. E um clube
 * que fica sem comando é um estado que nada mais no jogo sabe representar, então a vaga tem de fechar na
 * mesma passagem em que abre.
 */
async function criarClube(nome: string, ownerId = BOT_OWNER_ID): Promise<string> {
  const id = randomUUID();
  await prisma.club.create({
    data: {
      id,
      name: nome,
      ownerId,
      country: 'BRA',
      playersJson: JSON.stringify(generateStarterSquad(id, 'BRA')),
      academyPlayersJson: '[]',
    },
  });
  return id;
}

/** Põe o treinador do clube no ponto exato em que a diretoria age. */
async function condenar(clubId: string, warnings = 1): Promise<void> {
  await prisma.manager.updateMany({ where: { clubId }, data: { confidence: SACK_FLOOR - 5, warnings } });
}

describe('demissão de treinador', () => {
  beforeAll(async () => {
    await ensureSchema();
    await ensureUnemployedPool();
  });

  it('demite o treinador da máquina e preenche a vaga na mesma passagem', async () => {
    const clube = await criarClube(`Demite ${Date.now()}`);
    await ensureManagersForAllClubs();
    const antes = await getManagerForClub(clube);
    await condenar(clube);

    const { botsSacked } = await processSackings();

    expect(botsSacked).toBeGreaterThanOrEqual(1);
    const depois = await getManagerForClub(clube);
    // Um clube sem comando é um estado que nada no jogo sabe representar.
    expect(depois).not.toBeNull();
    expect(depois!.id).not.toBe(antes!.id);
  });

  it('cobra a reputação de quem foi demitido, e o devolve ao mercado', async () => {
    const clube = await criarClube(`Custo ${Date.now()}`);
    await ensureManagersForAllClubs();
    const antes = (await prisma.manager.findFirst({ where: { clubId: clube } }))!;
    await condenar(clube);

    await processSackings();

    const demitido = (await prisma.manager.findUnique({ where: { id: antes.id } }))!;
    expect(demitido.clubId).toBeNull();
    expect(demitido.reputation).toBeLessThan(antes.reputation);
  });

  it('não demite quem está mal mas nunca foi avisado', async () => {
    /**
     * A regra que separa consequência de sorteio, e a única que este arquivo inteiro existe para garantir.
     * Sem o aviso, o jogador é demitido por um número que nunca viu.
     */
    const clube = await criarClube(`SemAviso ${Date.now()}`);
    await ensureManagersForAllClubs();
    const antes = await getManagerForClub(clube);
    await condenar(clube, 0);

    await processSackings();

    expect((await getManagerForClub(clube))!.id).toBe(antes!.id);
  });

  it('devolve o clube do jogador ao mercado e fecha a passagem como demissão', async () => {
    const userId = randomUUID();
    const clube = await criarClube(`Jogador ${Date.now()}`, userId);
    await ensureManagersForAllClubs();
    await openTenure(userId, clube, 'Jogador FC', 'BRA');
    await seatUserAsManager(clube, userId);
    await condenar(clube);

    const { playerSacked, playerFormerClubId } = await processSackings();

    expect(playerSacked).toBe(true);
    expect(playerFormerClubId).toBe(clube);

    const registro = await prisma.club.findUnique({ where: { id: clube }, select: { ownerId: true } });
    expect(registro!.ownerId).toBe(BOT_OWNER_ID);

    /**
     * A carreira não acaba: acaba a passagem. É o que permite ao jogador recomeçar mais abaixo, e é isso
     * que dá peso ao que ele construiu antes.
     */
    const carreira = await getCareer(userId);
    expect(carreira.activeClubIds).not.toContain(clube);
    expect(carreira.tenures.find((t) => t.clubId === clube)!.endReason).toBe('SACKED');
  });

  it('writes a tenure through the supplied staged client', async () => {
    const userId = randomUUID();
    const clube = await criarClube(`Mandato ${Date.now()}`);

    await openTenure(userId, clube, 'Mandato FC', 'BRA', prisma);

    await expect(prisma.managerTenure.findFirst({
      where: { userId, clubId: clube, endedAt: null },
    })).resolves.toMatchObject({
      clubName: 'Mandato FC',
      countryCode: 'BRA',
    });
  });

  it('uses explicit staged identity without reading the save index', async () => {
    const userId = randomUUID();
    const clube = await criarClube(`Identidade ${Date.now()}`);
    await ensureManagersForAllClubs();

    await seatUserAsManager(
      clube,
      userId,
      { name: 'Alex Ribeiro', nationality: 'BRA' },
      prisma,
    );

    const manager = await prisma.manager.findFirst({ where: { userId } });
    expect(manager).toMatchObject({
      name: 'Alex Ribeiro',
      nationality: 'BRA',
      clubId: clube,
    });
  });

  it('senta o jogador na cadeira e tira quem estava nela', async () => {
    /**
     * O buraco que a etapa anterior deixou aberto: todo clube ganha comando, e o treinador da máquina
     * continuava sentado enquanto o jogador dirigia. A confiança seria calculada para um fantasma.
     */
    const userId = randomUUID();
    const clube = await criarClube(`Cadeira ${Date.now()}`);
    await ensureManagersForAllClubs();
    const daMaquina = await getManagerForClub(clube);

    await seatUserAsManager(clube, userId);

    const agora = await getManagerForClub(clube);
    expect(agora!.userId).toBe(userId);
    expect(agora!.id).not.toBe(daMaquina!.id);
    // Quem saiu não foi demitido, foi substituído: volta ao mercado sem perder reputação.
    const anterior = (await prisma.manager.findUnique({ where: { id: daMaquina!.id } }))!;
    expect(anterior.clubId).toBeNull();
    expect(anterior.reputation).toBe(daMaquina!.reputation);
  });

  it('leva a reputação do técnico entre clubes, mas não a confiança', async () => {
    /**
     * São duas coisas diferentes. Reputação é o que o mercado lembra da carreira inteira; confiança é o que
     * **esta** diretoria acha dele. Ninguém chega a um clube novo já desacreditado pelo que fez no anterior.
     */
    const userId = randomUUID();
    const primeiro = await criarClube(`Antes ${Date.now()}`);
    const segundo = await criarClube(`Depois ${Date.now()}`);
    await ensureManagersForAllClubs();

    await seatUserAsManager(primeiro, userId);
    await prisma.manager.updateMany({ where: { userId }, data: { confidence: 12, warnings: 1, reputation: 71 } });

    await seatUserAsManager(segundo, userId);

    const meu = (await prisma.manager.findFirst({ where: { userId } }))!;
    expect(meu.clubId).toBe(segundo);
    expect(meu.confidence).toBe(CONFIDENCE_START);
    expect(meu.warnings).toBe(0);
    expect(meu.reputation).toBe(71);
  });

  it('cobra reputação de quem abandona o clube, e põe outro no comando', async () => {
    const userId = randomUUID();
    const clube = await criarClube(`Abandono ${Date.now()}`);
    await ensureManagersForAllClubs();
    await seatUserAsManager(clube, userId);
    const antes = (await prisma.manager.findFirst({ where: { userId } }))!;

    await unseatUserAsManager(clube, 8);

    const meu = (await prisma.manager.findFirst({ where: { userId } }))!;
    expect(meu.clubId).toBeNull();
    expect(meu.reputation).toBe(antes.reputation - 8);
    expect(await getManagerForClub(clube)).not.toBeNull();
  });

  it('conta o que aconteceu ao mundo, para a notícia ter sujeito', async () => {
    const clube = await criarClube(`Noticia ${Date.now()}`);
    await ensureManagersForAllClubs();
    const saindo = (await prisma.manager.findFirst({ where: { clubId: clube } }))!;
    await condenar(clube);

    await processSackings();

    const noticias = await prisma.newsItem.findMany({ where: { clubId: clube, category: 'MANAGER' } });
    expect(noticias.length).toBe(2);
    expect(noticias.some((n) => n.headline.includes(saindo.name) && n.headline.includes('deixa o comando'))).toBe(true);
    expect(noticias.some((n) => n.headline.includes('novo técnico'))).toBe(true);
  });
});

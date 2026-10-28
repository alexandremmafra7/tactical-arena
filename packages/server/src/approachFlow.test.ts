import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from './db/prisma.js';
import { ensureSchema } from './db/ensureSchema.js';
import { ensureManagersForAllClubs, ensureUnemployedPool, getManagerForClub } from './services/managerService.js';
import {
  acceptApproach,
  declineApproach,
  listApproaches,
  movePoachedManager,
  pickPoachTarget,
  recordApproach,
} from './services/approachService.js';
import { processSackings, seatUserAsManager } from './services/sackingService.js';
import { BOT_OWNER_ID, generateStarterSquad, INTEREST_CEILING, SACK_FLOOR } from '@tactical-arena/shared';

/**
 * A sondagem, que é a segunda direção do mercado.
 *
 * Sem ela o mundo teria demissões e nenhuma ascensão: toda vaga sairia do bolsão de desempregados, e um
 * treinador que fizesse uma temporada excelente num clube pequeno ficaria lá para sempre. Meia história.
 *
 * As duas condições são o que estes testes protegem — o técnico tem de estar bem onde está, e quem sonda
 * tem de ser maior com folga. Sem a primeira, um clube contrataria alguém que a própria diretoria vai
 * demitir; sem a segunda, o mundo trocaria treinadores em círculos sem nada melhorar.
 */
async function criarClube(nome: string, capacidade: number, ownerId = BOT_OWNER_ID): Promise<string> {
  const id = randomUUID();
  await prisma.club.create({
    data: {
      id,
      name: nome,
      ownerId,
      country: 'BRA',
      playersJson: JSON.stringify(generateStarterSquad(id, 'BRA', `elenco-${nome}`, capacidade > 50_000 ? 85 : 45)),
      academyPlayersJson: '[]',
      stadiumCapacity: capacidade,
      membersCount: capacidade * 3,
    },
  });
  return id;
}

/**
 * Põe o mundo em repouso antes de cada teste que depende de quem é o melhor candidato.
 *
 * As suítes desta pasta partilham um banco só, e ao fim de uma execução completa há centenas de treinadores
 * espalhados pelo mundo. Sem baixar a confiança de todos, o clube do teste vai buscar um deles em vez do
 * treinador que o teste preparou — e o teste falha por um motivo que não tem nada a ver com o que verifica.
 */
async function silenciarMundo(): Promise<void> {
  await prisma.manager.updateMany({ data: { confidence: 50, warnings: 0 } });
}

describe('sondagem de treinador', () => {
  beforeAll(async () => {
    await ensureSchema();
    await ensureUnemployedPool();
  });

  it('escolhe quem está bem num clube menor', async () => {
    const grande = await criarClube(`Gigante ${Date.now()}`, 80_000);
    const pequeno = await criarClube(`Modesto ${Date.now()}`, 5_000);
    await ensureManagersForAllClubs();
    await silenciarMundo();
    await prisma.manager.updateMany({ where: { clubId: pequeno }, data: { confidence: 92 } });

    const alvo = await pickPoachTarget(grande);

    expect(alvo).not.toBeNull();
    expect(alvo!.fromClubId).toBe(pequeno);
  });

  it('não vai buscar quem a própria diretoria quer demitir', async () => {
    /**
     * A condição que impede o absurdo mais óbvio: um clube grande contratando alguém que está a uma semana
     * de ser mandado embora do clube pequeno onde está.
     */
    const grande = await criarClube(`Gigante2 ${Date.now()}`, 80_000);
    const pequeno = await criarClube(`Modesto2 ${Date.now()}`, 5_000);
    await ensureManagersForAllClubs();
    await silenciarMundo();
    await prisma.manager.updateMany({ where: { clubId: pequeno }, data: { confidence: SACK_FLOOR + 1 } });

    const alvo = await pickPoachTarget(grande);
    expect(alvo?.fromClubId).not.toBe(pequeno);
  });

  it('não sonda para um clube que não é maior', async () => {
    // Sem margem de estatura, dois clubes do mesmo tamanho ficariam a roubar-se um ao outro toda semana.
    const a = await criarClube(`Igual A ${Date.now()}`, 20_000);
    const b = await criarClube(`Igual B ${Date.now()}`, 20_000);
    await ensureManagersForAllClubs();
    await silenciarMundo();
    await prisma.manager.updateMany({ where: { clubId: b }, data: { confidence: 95 } });

    const alvo = await pickPoachTarget(a);
    expect(alvo?.fromClubId).not.toBe(b);
  });

  it('convida o técnico do jogador em vez de o transferir por decreto', async () => {
    /**
     * A diferença que define o jogo. Um treinador da máquina muda de clube e pronto; o do jogador recebe um
     * convite, porque a decisão de mudar é dele e automatizá-la seria o oposto de jogar.
     */
    const userId = randomUUID();
    const pequeno = await criarClube(`Dele ${Date.now()}`, 5_000);
    const grande = await criarClube(`Cobiça ${Date.now()}`, 80_000);
    await ensureManagersForAllClubs();
    await seatUserAsManager(pequeno, userId);
    await silenciarMundo();
    await prisma.manager.updateMany({ where: { userId }, data: { confidence: 95, reputation: 60 } });

    const alvo = await pickPoachTarget(grande);
    expect(alvo?.isPlayer).toBe(true);

    await recordApproach(alvo!.managerId, grande, pequeno);
    const sondagens = await listApproaches(userId);

    expect(sondagens.some((s) => s.clubId === grande)).toBe(true);
    // A estatura do clube que sonda vem junto, para a tela poder comparar com o atual.
    expect(sondagens.find((s) => s.clubId === grande)!.visibility).toBeGreaterThan(0);
  });

  it('não deixa o mesmo clube insistir toda semana', async () => {
    // O mesmo clube perguntando sempre viraria o ruído que o sistema de reuniões inteiro evita.
    const userId = randomUUID();
    const meu = await criarClube(`Insiste A ${Date.now()}`, 5_000);
    const outro = await criarClube(`Insiste B ${Date.now()}`, 80_000);
    await ensureManagersForAllClubs();
    await seatUserAsManager(meu, userId);
    const eu = (await prisma.manager.findFirst({ where: { userId } }))!;

    await recordApproach(eu.id, outro, meu);
    await recordApproach(eu.id, outro, meu);

    const abertas = await prisma.managerApproach.count({ where: { managerId: eu.id, clubId: outro, status: 'PENDING' } });
    expect(abertas).toBe(1);
  });

  it('caduca as outras sondagens quando o técnico aceita uma', async () => {
    const userId = randomUUID();
    const meu = await criarClube(`Aceita A ${Date.now()}`, 5_000);
    const escolhido = await criarClube(`Aceita B ${Date.now()}`, 80_000);
    const preterido = await criarClube(`Aceita C ${Date.now()}`, 70_000);
    await ensureManagersForAllClubs();
    await seatUserAsManager(meu, userId);
    const eu = (await prisma.manager.findFirst({ where: { userId } }))!;

    await recordApproach(eu.id, escolhido, meu);
    await recordApproach(eu.id, preterido, meu);

    const { clubId } = await acceptApproach(
      (await prisma.managerApproach.findFirst({ where: { managerId: eu.id, clubId: escolhido } }))!.id,
      userId,
    );

    expect(clubId).toBe(escolhido);
    // Quem aceitou uma não está mais no mercado.
    expect(await prisma.managerApproach.count({ where: { managerId: eu.id, status: 'PENDING' } })).toBe(0);
  });

  it('deixa o técnico dizer não, e aquele clube não volta na lista', async () => {
    const userId = randomUUID();
    const meu = await criarClube(`Recusa A ${Date.now()}`, 5_000);
    const outro = await criarClube(`Recusa B ${Date.now()}`, 80_000);
    await ensureManagersForAllClubs();
    await seatUserAsManager(meu, userId);
    const eu = (await prisma.manager.findFirst({ where: { userId } }))!;
    await recordApproach(eu.id, outro, meu);

    const sondagem = (await prisma.managerApproach.findFirst({ where: { managerId: eu.id, clubId: outro } }))!;
    await declineApproach(sondagem.id, userId);

    expect((await listApproaches(userId)).some((s) => s.clubId === outro)).toBe(false);
  });

  it('move o treinador da máquina e abre a vaga que ele deixa', async () => {
    const origem = await criarClube(`Origem ${Date.now()}`, 5_000);
    const destino = await criarClube(`Destino ${Date.now()}`, 80_000);
    await ensureManagersForAllClubs();
    const saindo = (await getManagerForClub(origem))!;

    const deixado = await movePoachedManager(saindo.id, destino);

    expect(deixado).toBe(origem);
    expect((await getManagerForClub(destino))!.id).toBe(saindo.id);
    // A vaga fica aberta de propósito: resolvê-la aqui faria cada troca disparar outra mundo afora.
    expect(await getManagerForClub(origem)).toBeNull();
  });

  it('faz uma demissão num clube grande virar oportunidade para quem está bem num pequeno', async () => {
    /**
     * O ciclo inteiro numa passagem: o gigante demite, vai buscar o treinador em alta do clube modesto, e
     * o modesto contrata do bolsão. É isto que dá ao mundo as duas direções.
     */
    const grande = await criarClube(`Ciclo Gigante ${Date.now()}`, 90_000);
    const pequeno = await criarClube(`Ciclo Modesto ${Date.now()}`, 4_000);
    await ensureManagersForAllClubs();

    const emAlta = (await getManagerForClub(pequeno))!;
    await silenciarMundo();
    await prisma.manager.updateMany({ where: { clubId: pequeno }, data: { confidence: INTEREST_CEILING + 10 } });
    await prisma.manager.updateMany({ where: { clubId: grande }, data: { confidence: SACK_FLOOR - 5, warnings: 1 } });

    await processSackings();

    expect((await getManagerForClub(grande))!.id).toBe(emAlta.id);
    // O clube que perdeu o treinador não fica sem ninguém.
    expect(await getManagerForClub(pequeno)).not.toBeNull();
  });
});

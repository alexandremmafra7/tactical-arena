import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from './db/prisma.js';
import { ensureSchema } from './db/ensureSchema.js';
import { claimClub, resignClub } from './services/clubService.js';
import { divisionOfClub, GameModeError, hardcoreProgress } from './services/gameModeService.js';
import { ensureManagersForAllClubs, ensureUnemployedPool, getManagerForClub } from './services/managerService.js';
import { processSackings, seatUserAsManager } from './services/sackingService.js';
import { openTenure } from './services/careerService.js';
import { readSavesIndex, writeSavesIndex } from './services/saveService.js';
import { BOT_OWNER_ID, generateStarterSquad, SACK_FLOOR, type GameMode } from '@tactical-arena/shared';

/**
 * Os modos de carreira, aplicados onde importa: no servidor.
 *
 * A tela esconde o que o modo não permite, e esconder é cortesia. A recusa é que é a regra — sem ela o teto
 * do modo padrão cai com uma chamada de rede feita à mão, e os três modos viram três telas diferentes para o
 * mesmo jogo.
 */
async function criarClubeEmDivisao(nome: string, division: number, country = 'BRA'): Promise<string> {
  const id = randomUUID();
  await prisma.club.create({
    data: {
      id,
      name: nome,
      ownerId: BOT_OWNER_ID,
      country,
      playersJson: JSON.stringify(generateStarterSquad(id, 'BRA')),
      academyPlayersJson: '[]',
    },
  });

  await prisma.league.create({
    data: {
      id: randomUUID(),
      name: `${nome} Liga`,
      countryCode: country,
      division,
      capacity: 2,
      season: 2026,
      status: 'IN_PROGRESS',
      clubIdsJson: JSON.stringify([id]),
      fixturesJson: '[]',
    },
  });

  return id;
}

/** Cria a carreira no índice de saves, que é onde o modo mora. */
function comModo(mode: GameMode): string {
  const userId = randomUUID();
  const index = readSavesIndex();
  writeSavesIndex({
    currentSaveId: index.currentSaveId,
    saves: [
      ...index.saves,
      {
        id: randomUUID(),
        name: `Teste ${mode}`,
        fileName: `teste-${mode}.db`,
        managerUserId: userId,
        managerName: `Técnico ${mode}`,
        gameMode: mode,
      } as never,
    ],
  });
  return userId;
}

describe('modos de carreira no servidor', () => {
  beforeAll(async () => {
    await ensureSchema();
    await ensureUnemployedPool();
  });

  it('sabe em que divisão joga cada clube', async () => {
    const primeira = await criarClubeEmDivisao(`Div1 ${Date.now()}`, 1);
    const segunda = await criarClubeEmDivisao(`Div2 ${Date.now()}`, 2);

    expect(await divisionOfClub(primeira)).toBe(1);
    expect(await divisionOfClub(segunda)).toBe(2);
  });

  it('lê a divisão de hoje, e não a de uma temporada arquivada', async () => {
    /**
     * Um clube que disputou a elite numa temporada encerrada era tratado como clube de elite para sempre.
     * Verificado em campo: um clube de terceira divisão que o modo padrão recusou com a mensagem da
     * primeira, por causa de uma linha de liga antiga que ninguém mais lê.
     */
    const clube = await criarClubeEmDivisao(`Caiu ${Date.now()}`, 3);
    await prisma.league.create({
      data: {
        id: randomUUID(),
        name: `Elite de ontem ${Date.now()}`,
        countryCode: 'BRA',
        division: 1,
        capacity: 2,
        season: 2025,
        status: 'FINISHED',
        clubIdsJson: JSON.stringify([clube]),
        fixturesJson: '[]',
      },
    });

    expect(await divisionOfClub(clube)).toBe(3);
  });

  it('recusa ao modo padrão um clube da primeira divisão', async () => {
    const userId = comModo('STANDARD');
    const elite = await criarClubeEmDivisao(`Elite ${Date.now()}`, 1);

    await expect(claimClub(elite, userId)).rejects.toBeInstanceOf(GameModeError);
    // E o clube continua livre: uma recusa não pode deixar meio caminho andado.
    const registro = await prisma.club.findUnique({ where: { id: elite }, select: { ownerId: true } });
    expect(registro!.ownerId).toBe(BOT_OWNER_ID);
  });

  it('deixa o modo padrão assumir um clube da segunda divisão', async () => {
    const userId = comModo('STANDARD');
    const clube = await criarClubeEmDivisao(`Acesso ${Date.now()}`, 2);

    const assumido = await claimClub(clube, userId);
    expect(assumido.ownerId).toBe(userId);
  });

  it('abre a primeira divisão ao premium', async () => {
    const userId = comModo('PREMIUM');
    const elite = await criarClubeEmDivisao(`Gigante ${Date.now()}`, 1);

    const assumido = await claimClub(elite, userId);
    expect(assumido.ownerId).toBe(userId);
  });

  it('não deixa um técnico do zero recém-criado assumir nada, mesmo sem clube', async () => {
    /**
     * O buraco mais fácil de abrir neste modo, e eu abri: tratar "sem clube" como prova de que o objetivo
     * foi cumprido. Um jogador recém-criado também não tem clube — e podia assumir o gigante que quisesse
     * antes de fundar coisa alguma, o que fecharia o modo inteiro.
     */
    const userId = comModo('HARDCORE');
    const gigante = await criarClubeEmDivisao(`Atalho ${Date.now()}`, 1);

    await expect(claimClub(gigante, userId)).rejects.toBeInstanceOf(GameModeError);
  });

  it('não deixa o modo do zero assumir clube nenhum', async () => {
    /**
     * Nem o pior clube da divisão mais baixa. A premissa do modo é o clube ser dele, e assumir um pronto
     * seria outro jogo com o mesmo nome.
     */
    const userId = comModo('HARDCORE');
    const modesto = await criarClubeEmDivisao(`Modesto ${Date.now()}`, 3);

    await expect(claimClub(modesto, userId)).rejects.toBeInstanceOf(GameModeError);
  });

  it('não solta o modo do zero só por chegar à elite: é preciso ganhar', async () => {
    /**
     * O acesso promove os primeiros colocados, e não só o campeão — um clube pode subir em segundo lugar sem
     * nunca ter ganhado nada. Se chegar bastasse, o objetivo do modo cumpria-se sem vencer uma única vez.
     */
    const userId = comModo('HARDCORE');
    const pais = `X${Date.now() % 100000}`;
    const clube = await criarClubeEmDivisao(`Do Zero ${Date.now()}`, 2, pais);
    await prisma.club.update({ where: { id: clube }, data: { ownerId: userId } });

    await expect(resignClub(clube, userId)).rejects.toBeInstanceOf(GameModeError);

    // Sobe para a divisão mais alta, e ainda assim não sai: chegou, não ganhou.
    await prisma.league.updateMany({ where: { clubIdsJson: { contains: clube } }, data: { division: 1 } });
    await expect(resignClub(clube, userId)).rejects.toBeInstanceOf(GameModeError);

    // Ganha o campeonato da divisão mais alta: a porta abre.
    await prisma.league.updateMany({ where: { clubIdsJson: { contains: clube } }, data: { championOwnerId: userId } });
    const objetivo = await hardcoreProgress(userId, clube);
    expect(objetivo.met).toBe(true);

    const largado = await resignClub(clube, userId);
    expect(largado.ownerId).toBe(BOT_OWNER_ID);
  });

  it('cobra também a copa do país, quando o país tem uma', async () => {
    // O mundo importado tem 98 primeiras divisões e 7 copas: o requisito sai do país, não de uma lista fixa.
    const userId = comModo('HARDCORE');
    const pais = `Y${Date.now() % 100000}`;
    const clube = await criarClubeEmDivisao(`Com Copa ${Date.now()}`, 1, pais);
    await prisma.club.update({ where: { id: clube }, data: { ownerId: userId } });
    await prisma.league.updateMany({ where: { clubIdsJson: { contains: clube } }, data: { championOwnerId: userId } });

    await prisma.cup.create({
      data: {
        id: randomUUID(),
        name: `Copa de ${pais}`,
        countryCode: pais,
        season: 2026,
        status: 'IN_PROGRESS',
        clubIdsJson: JSON.stringify([clube]),
        fixturesJson: '[]',
      },
    });

    const comCopaPendente = await hardcoreProgress(userId, clube);
    expect(comCopaPendente.met).toBe(false);
    expect(comCopaPendente.missing).toContain(`Copa de ${pais}`);

    await prisma.cup.updateMany({ where: { countryCode: pais }, data: { championOwnerId: userId } });
    expect((await hardcoreProgress(userId, clube)).met).toBe(true);
  });

  it('tira o teto de quem venceu o modo do zero', async () => {
    const userId = comModo('HARDCORE');
    const pais = `Z${Date.now() % 100000}`;
    const meu = await criarClubeEmDivisao(`Venceu ${Date.now()}`, 1, pais);
    /**
     * Fundar abre uma passagem, e é a passagem encerrada que prova a vitória depois.
     * Pôr só o `ownerId` faria o clube ser dele sem nunca ter havido um começo — que é o que a fundação faz.
     */
    await prisma.club.update({ where: { id: meu }, data: { ownerId: userId } });
    await openTenure(userId, meu, 'Venceu FC', pais);
    await prisma.league.updateMany({ where: { clubIdsJson: { contains: meu } }, data: { championOwnerId: userId } });

    // Um gigante de outro país, que o modo do zero jamais alcançaria antes de cumprir o objetivo.
    const gigante = await criarClubeEmDivisao(`Gigante depois ${Date.now()}`, 1);
    await resignClub(meu, userId);

    const assumido = await claimClub(gigante, userId);
    expect(assumido.ownerId).toBe(userId);
  });

  it('deixa os outros modos sair quando quiserem', async () => {
    const userId = comModo('STANDARD');
    const clube = await criarClubeEmDivisao(`Sai ${Date.now()}`, 2);
    await claimClub(clube, userId);

    const largado = await resignClub(clube, userId);
    expect(largado.ownerId).toBe(BOT_OWNER_ID);
  });

  it('torna o técnico do modo do zero indemissível, com a confiança no chão', async () => {
    /**
     * A contrapartida da trava, e a razão de ela funcionar. Se a diretoria pudesse demitir, a única coisa
     * que o modo pede poderia ser tornada impossível por uma sequência ruim.
     */
    const userId = comModo('HARDCORE');
    const clube = await criarClubeEmDivisao(`Imune ${Date.now()}`, 3);
    await prisma.club.update({ where: { id: clube }, data: { ownerId: userId } });
    await ensureManagersForAllClubs();
    await seatUserAsManager(clube, userId);
    await prisma.manager.updateMany({ where: { clubId: clube }, data: { confidence: SACK_FLOOR - 10, warnings: 1 } });

    await processSackings();

    const registro = await prisma.club.findUnique({ where: { id: clube }, select: { ownerId: true } });
    expect(registro!.ownerId).toBe(userId);
    expect((await getManagerForClub(clube))!.userId).toBe(userId);
  });

  it('demite o técnico do modo padrão nas mesmas condições', async () => {
    // O espelho do teste anterior: a imunidade é do modo do zero, e de mais ninguém.
    const userId = comModo('STANDARD');
    const clube = await criarClubeEmDivisao(`Demissivel ${Date.now()}`, 2);
    await claimClub(clube, userId);
    await prisma.manager.updateMany({ where: { clubId: clube }, data: { confidence: SACK_FLOOR - 10, warnings: 1 } });

    await processSackings();

    const registro = await prisma.club.findUnique({ where: { id: clube }, select: { ownerId: true } });
    expect(registro!.ownerId).toBe(BOT_OWNER_ID);
  });
});

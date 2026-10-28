import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from './db/prisma.js';
import { ensureSchema } from './db/ensureSchema.js';
import { ensureManagersForAllClubs, getManagerForClub } from './services/managerService.js';
import { buildLeagueContext, processConfidenceTick, type FinanceSnapshot } from './services/boardConfidenceService.js';
import { BOT_OWNER_ID, generateStarterSquad, WARNING_FLOOR, SACK_FLOOR, shouldSack } from '@tactical-arena/shared';

/**
 * A confiança da diretoria, viva no mundo.
 *
 * O módulo puro já prova que a nota se move certo. O que se prova aqui é outra coisa: que ela chega a **todo**
 * treinador e não só ao do jogador. Se só o clube do dono fosse avaliado, só ele seria demitido, o mundo
 * nunca abriria vaga, e o mercado de técnicos seria uma porta que só abre para dentro — que é exatamente o
 * defeito que o tick semanal teve durante meses, cobrando salário apenas de quem tinha dono.
 */
async function montarLiga(nome: string, quantos = 4): Promise<{ leagueId: string; clubIds: string[] }> {
  const clubIds: string[] = [];
  for (let i = 0; i < quantos; i += 1) {
    const id = randomUUID();
    await prisma.club.create({
      data: {
        id,
        name: `${nome} ${i}`,
        ownerId: BOT_OWNER_ID,
        country: 'BRA',
        /**
         * A força vem do elenco de verdade, e não de escrever as colunas de rating à mão.
         *
         * Escrevê-las era inútil: a extensão do Prisma recalcula rating a cada gravação de elenco, então os
         * valores fixados eram descartados na mesma escrita que os punha lá, e o posto de elenco saía do
         * desempate entre quatro elencos equivalentes — passava sozinho e falhava na suíte completa.
         */
        playersJson: JSON.stringify(generateStarterSquad(id, 'BRA', `forca-${nome}-${i}`, 85 - i * 15)),
        academyPlayersJson: '[]',
      },
    });
    clubIds.push(id);
  }

  /**
   * Uma tabela em que o mais forte perde tudo e o mais fraco ganha tudo.
   *
   * É o cenário que separa a nota justa da injusta: os dois terminam com a mesma quantidade de jogos, e a
   * diretoria tem de chegar a conclusões opostas sobre os dois treinadores.
   */
  const fixtures = [];
  for (let round = 1; round <= 6; round += 1) {
    fixtures.push({
      id: randomUUID(),
      round,
      homeClubId: clubIds[quantos - 1],
      awayClubId: clubIds[0],
      result: { homeGoals: 2, awayGoals: 0 },
    });
  }

  const leagueId = randomUUID();
  await prisma.league.create({
    data: {
      id: leagueId,
      name: nome,
      countryCode: 'BRA',
      division: 1,
      capacity: quantos,
      season: 2026,
      status: 'IN_PROGRESS',
      clubIdsJson: JSON.stringify(clubIds),
      fixturesJson: JSON.stringify(fixtures),
    },
  });

  return { leagueId, clubIds };
}

const SAUDAVEL: FinanceSnapshot = { budget: 5_000_000, weeklyIncome: 400_000, weeklyExpenses: 300_000, weeklyWageBill: 150_000 };

/**
 * O contexto restrito aos clubes deste teste.
 *
 * `processConfidenceTick` ignora quem não está no mapa, então filtrá-lo é o que impede cada iteração de
 * reavaliar as dezenas de ligas que as outras suítes deixaram no banco partilhado. Sem isto os testes que
 * rodam dez semanas seguidas estouram o tempo — e estouravam mesmo, à medida que a suíte crescia.
 */
async function contextoDe(clubIds: string[]) {
  const mundo = await buildLeagueContext();
  return new Map([...mundo].filter(([id]) => clubIds.includes(id)));
}

describe('confiança da diretoria no mundo', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  it('avalia o treinador de clube da máquina, e não só o do jogador', async () => {
    const { clubIds } = await montarLiga(`Mundo ${Date.now()}`);
    await ensureManagersForAllClubs();

    const { managersEvaluated } = await processConfidenceTick(new Map(clubIds.map((id) => [id, SAUDAVEL])));

    expect(managersEvaluated).toBeGreaterThanOrEqual(clubIds.length);
    for (const id of clubIds) {
      const treinador = await prisma.manager.findFirst({ where: { clubId: id } });
      expect(treinador!.confidenceReason).not.toBeNull();
    }
  });

  it('afunda quem desperdiça o melhor elenco e promove quem supera com o pior', async () => {
    /**
     * O teste que prova que a régua é relativa ao elenco. O clube 0 é o mais forte da liga e perdeu os seis
     * jogos; o último é o mais fraco e ganhou todos. A diretoria tem de os julgar em direções opostas.
     */
    const { clubIds } = await montarLiga(`Justica ${Date.now()}`);
    await ensureManagersForAllClubs();

    const financas = new Map(clubIds.map((id) => [id, SAUDAVEL]));
    // Várias semanas, porque a nota caminha para o destino em vez de saltar até ele.
    const contexto = await contextoDe(clubIds);
    for (let semana = 0; semana < 10; semana += 1) await processConfidenceTick(financas, contexto);

    const forte = await getManagerForClub(clubIds[0]);
    const fraco = await getManagerForClub(clubIds[clubIds.length - 1]);

    expect(forte!.reputation).toBeGreaterThan(0); // sanidade: o registro existe
    const notaForte = (await prisma.manager.findFirst({ where: { clubId: clubIds[0] } }))!.confidence;
    const notaFraco = (await prisma.manager.findFirst({ where: { clubId: clubIds[clubIds.length - 1] } }))!.confidence;

    expect(notaForte).toBeLessThan(notaFraco);
    expect(notaForte).toBeLessThan(WARNING_FLOOR);
    expect(fraco).not.toBeNull();
  });

  it('avisa uma vez, e não repete o aviso a cada semana', async () => {
    const { clubIds } = await montarLiga(`Aviso ${Date.now()}`);
    await ensureManagersForAllClubs();

    const financas = new Map(clubIds.map((id) => [id, SAUDAVEL]));
    // O contexto de liga é montado uma vez: refazê-lo a cada semana relê o mundo competitivo inteiro doze
    // vezes, que é o que o tick semanal de verdade evita passando-o adiante.
    const contexto = await contextoDe(clubIds);
    let avisosTotais = 0;
    for (let semana = 0; semana < 12; semana += 1) {
      avisosTotais += (await processConfidenceTick(financas, contexto)).newWarnings;
    }

    const afundando = (await prisma.manager.findFirst({ where: { clubId: clubIds[0] } }))!;
    expect(afundando.confidence).toBeLessThan(WARNING_FLOOR);
    /**
     * Um aviso por treinador, por pior que a temporada continue.
     *
     * Um ultimato repetido toda semana deixa de ser ultimato e vira o cartão que o jogador aprende a fechar
     * sem ler — que é a forma mais rápida de matar todo o sistema de reuniões.
     */
    expect(afundando.warnings).toBe(1);
    expect(avisosTotais).toBeGreaterThanOrEqual(1);
  });

  it('não demite ninguém sem o aviso ter sido dado', async () => {
    const { clubIds } = await montarLiga(`SemAviso ${Date.now()}`);
    await ensureManagersForAllClubs();
    await prisma.manager.updateMany({ where: { clubId: clubIds[0] }, data: { confidence: SACK_FLOOR - 5, warnings: 0 } });

    const antes = (await prisma.manager.findFirst({ where: { clubId: clubIds[0] } }))!;
    expect(shouldSack(antes.confidence, antes.warnings)).toBe(false);
  });

  it('não julga quem ainda não entrou em campo', async () => {
    /**
     * Sem tabela não há objetivo, e cobrar posição de quem não jogou seria inventar um fracasso. Um clube
     * fora de liga em andamento simplesmente não é avaliado.
     */
    const id = randomUUID();
    await prisma.club.create({
      data: {
        id,
        name: `Sem Liga ${Date.now()}`,
        ownerId: BOT_OWNER_ID,
        country: 'BRA',
        playersJson: JSON.stringify(generateStarterSquad(id, 'BRA')),
        academyPlayersJson: '[]',
      },
    });
    await ensureManagersForAllClubs();

    const antes = (await prisma.manager.findFirst({ where: { clubId: id } }))!;
    await processConfidenceTick(new Map());
    const depois = (await prisma.manager.findFirst({ where: { clubId: id } }))!;

    expect(depois.confidence).toBe(antes.confidence);
    expect(depois.confidenceReason).toBeNull();
  });

  it('deixa o caixa no fim pesar na opinião da diretoria', async () => {
    const { clubIds } = await montarLiga(`Caixa ${Date.now()}`);
    await ensureManagersForAllClubs();

    // O segundo e o terceiro da liga não jogaram: mesma tabela, mesma posição, só o dinheiro difere.
    const meio = clubIds[1];
    const outro = clubIds[2];

    const quebrado = new Map<string, FinanceSnapshot>([
      [meio, { budget: 50_000, weeklyIncome: 100_000, weeklyExpenses: 400_000, weeklyWageBill: 150_000 }],
      [outro, SAUDAVEL],
    ]);
    const ctx = await contextoDe([meio, outro]);
    for (let semana = 0; semana < 8; semana += 1) await processConfidenceTick(quebrado, ctx);

    const notaQuebrado = (await prisma.manager.findFirst({ where: { clubId: meio } }))!;
    const notaSolvente = (await prisma.manager.findFirst({ where: { clubId: outro } }))!;

    expect(notaQuebrado.confidence).toBeLessThan(notaSolvente.confidence);
    expect(notaQuebrado.confidenceReason).toContain('financeira');
  });

  it('lê o mundo competitivo sem abrir um único elenco', async () => {
    // A garantia de custo: 128 ligas em vez de 1.811 clubes, e nenhum playersJson de 42 KB por clube.
    const { clubIds } = await montarLiga(`Contexto ${Date.now()}`);
    const contexto = await buildLeagueContext();

    const doMaisForte = contexto.get(clubIds[0])!;
    expect(doMaisForte.squadRank).toBe(1);
    expect(doMaisForte.roundsPlayed).toBe(6);
    expect(doMaisForte.form).toEqual(['D', 'D', 'D', 'D', 'D']);
    expect(contexto.get(clubIds[clubIds.length - 1])!.form).toEqual(['V', 'V', 'V', 'V', 'V']);
  });
});

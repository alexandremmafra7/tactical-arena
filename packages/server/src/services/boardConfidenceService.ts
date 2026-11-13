import {
  boardConfidence,
  computeStandings,
  runwayWeeks,
  seasonObjective,
  shouldWarn,
  wageRatio,
  type FormResult,
  type LeagueFixture,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';

/**
 * A confiança da diretoria, viva, para todo treinador do mundo.
 *
 * A nota em si é função pura e mora no `shared`. Aqui só se junta o que ela precisa saber — onde o clube
 * está, o que a diretoria pediu, como foram os últimos jogos, e se o caixa aguenta — e se grava o resultado.
 *
 * Roda para **todos**, bots inclusive, e isso não é capricho. Se só o clube do jogador fosse avaliado, só ele
 * seria demitido: o mundo nunca abriria uma vaga, e o mercado de técnicos seria uma porta que só abre para
 * dentro. É a mesma lição do tick semanal, que durante muito tempo cobrou salário só de quem tinha dono.
 */

/** Quantos clubes se avaliam de uma vez. */
const LOTE = 300;

interface ContextoDeLiga {
  /** Posição na tabela, 1-based. */
  position: number;
  totalClubs: number;
  roundsPlayed: number;
  totalRounds: number;
  /** Posto de força do elenco dentro da liga, 1 = melhor. */
  squadRank: number;
  /** Últimos resultados, do mais recente para o mais antigo. */
  form: FormResult[];
}

/**
 * Lê o mundo competitivo de uma vez só.
 *
 * São 128 ligas contra 1.811 clubes: percorrer as ligas e derivar o contexto de cada clube custa uma consulta
 * e nenhum `playersJson`. A alternativa — perguntar a tabela clube a clube — seria mil e oitocentas leituras
 * por semana de jogo, e a semana já é a operação mais cara que existe neste projeto.
 *
 * A força do elenco vem das colunas de rating já mantidas pela extensão do Prisma a cada escrita de elenco.
 * Reabrir os elencos aqui traria os 104 MB do mundo inteiro para calcular um número que já está gravado.
 */
export async function buildLeagueContext(): Promise<Map<string, ContextoDeLiga>> {
  const [ligas, forcas] = await Promise.all([
    prisma.league.findMany({
      where: { status: 'IN_PROGRESS' },
      select: { clubIdsJson: true, fixturesJson: true },
    }),
    prisma.club.findMany({ select: { id: true, ratingAttack: true, ratingDefense: true, ratingGoalkeeping: true } }),
  ]);

  const forcaPorClube = new Map(forcas.map((c) => [c.id, c.ratingAttack + c.ratingDefense + c.ratingGoalkeeping]));
  const contexto = new Map<string, ContextoDeLiga>();

  for (const liga of ligas) {
    const clubIds = JSON.parse(liga.clubIdsJson) as string[];
    const fixtures = JSON.parse(liga.fixturesJson) as LeagueFixture[];
    if (clubIds.length < 2) continue;

    const jogados = fixtures.filter((f) => f.result);
    const tabela = computeStandings(
      clubIds,
      jogados.map((f) => ({
        homeClubId: f.homeClubId,
        awayClubId: f.awayClubId,
        homeGoals: f.result!.homeGoals,
        awayGoals: f.result!.awayGoals,
      })),
    );

    const posicaoPorClube = new Map(tabela.map((linha, i) => [linha.clubId, i + 1]));
    const jogosPorClube = new Map(tabela.map((linha) => [linha.clubId, linha.played]));
    const totalRounds = fixtures.length > 0 ? Math.max(...fixtures.map((f) => f.round)) : 0;

    // Posto de força dentro da própria liga: é o que torna a cobrança justa, porque décimo lugar significa
    // coisas opostas para o melhor e para o pior elenco da divisão.
    const porForca = [...clubIds].sort((a, b) => (forcaPorClube.get(b) ?? 0) - (forcaPorClube.get(a) ?? 0));
    const postoPorClube = new Map(porForca.map((id, i) => [id, i + 1]));

    /**
     * A forma sai das partidas já jogadas, na ordem das rodadas.
     *
     * Guardar uma sequência no clube seria mais rápido de ler e mais fácil de deixar desatualizada — o mesmo
     * tipo de campo derivado que já obrigou este projeto a um backfill de arranque. Aqui ela se deduz do que
     * aconteceu, que não pode divergir de si mesmo.
     */
    const formaPorClube = new Map<string, FormResult[]>();
    for (const f of [...jogados].sort((a, b) => b.round - a.round)) {
      for (const [clube, marcados, sofridos] of [
        [f.homeClubId, f.result!.homeGoals, f.result!.awayGoals],
        [f.awayClubId, f.result!.awayGoals, f.result!.homeGoals],
      ] as const) {
        const lista = formaPorClube.get(clube) ?? [];
        if (lista.length >= 5) continue;
        lista.push(marcados > sofridos ? 'V' : marcados === sofridos ? 'E' : 'D');
        formaPorClube.set(clube, lista);
      }
    }

    for (const clubId of clubIds) {
      contexto.set(clubId, {
        position: posicaoPorClube.get(clubId) ?? clubIds.length,
        totalClubs: clubIds.length,
        roundsPlayed: jogosPorClube.get(clubId) ?? 0,
        totalRounds,
        squadRank: postoPorClube.get(clubId) ?? clubIds.length,
        form: formaPorClube.get(clubId) ?? [],
      });
    }
  }

  return contexto;
}

export interface ConfidenceOutcome {
  managersEvaluated: number;
  /** Treinadores que cruzaram o piso de aviso nesta semana e ainda não tinham sido avisados. */
  newWarnings: number;
}

export interface FinanceSnapshot {
  budget: number;
  weeklyIncome: number;
  weeklyExpenses: number;
  weeklyWageBill: number;
}

/**
 * Recalcula a confiança de todo treinador empregado.
 *
 * As finanças vêm de fora, do tick semanal, que acabou de as calcular para gravar o caixa. Recalculá-las
 * aqui daria uma segunda versão da saúde financeira do mesmo clube na mesma semana, e as duas divergiriam no
 * dia em que alguém mexesse numa e não na outra.
 *
 * Um clube fora de liga em andamento — pré-temporada, ou uma liga ainda por começar — não é avaliado. Não é
 * omissão: sem tabela não há objetivo, e cobrar posição de quem ainda não jogou seria inventar um fracasso.
 */
export async function processConfidenceTick(
  financas: Map<string, FinanceSnapshot>,
  contexto?: Map<string, ContextoDeLiga>,
): Promise<ConfidenceOutcome> {
  const ligas = contexto ?? (await buildLeagueContext());

  let managersEvaluated = 0;
  let newWarnings = 0;
  let cursor: string | undefined;

  for (;;) {
    const treinadores = await prisma.manager.findMany({
      where: { clubId: { not: null } },
      take: LOTE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, clubId: true, confidence: true, warnings: true, confidenceReason: true },
    });
    if (treinadores.length === 0) break;
    cursor = treinadores[treinadores.length - 1].id;

    const escritas: ReturnType<typeof prisma.manager.update>[] = [];

    for (const treinador of treinadores) {
      const liga = ligas.get(treinador.clubId!);
      if (!liga) continue;

      const financa = financas.get(treinador.clubId!);
      const liquido = financa ? financa.weeklyIncome - financa.weeklyExpenses : 0;

      const resultado = boardConfidence({
        previous: treinador.confidence,
        objective: seasonObjective(liga.squadRank, liga.totalClubs, liga.position, liga.roundsPlayed, liga.totalRounds),
        currentPosition: liga.roundsPlayed > 0 ? liga.position : null,
        totalClubs: liga.totalClubs,
        roundsPlayed: liga.roundsPlayed,
        totalRounds: liga.totalRounds,
        form: liga.form,
        runwayWeeks: financa ? runwayWeeks(financa.budget, liquido) : Number.POSITIVE_INFINITY,
        wageRatio: financa ? wageRatio(financa.weeklyWageBill, financa.weeklyIncome) : 0,
      });

      const avisar = shouldWarn(resultado.score, treinador.warnings);
      if (avisar) newWarnings += 1;
      managersEvaluated += 1;

      /**
       * Só escreve quem mudou.
       *
       * A nota caminha para um destino e depois fica parada nele, que é precisamente o comportamento que a
       * torna justa — e significa que, passadas algumas semanas, a maioria dos treinadores do mundo tem
       * exatamente a mesma nota da semana anterior. Gravar todos assim mesmo era uma escrita por treinador
       * por semana de jogo sem nada para gravar: medido, mil e oitocentas escritas semanais num mundo
       * completo, e o bastante para estourar o tempo de um teste que roda doze semanas seguidas.
       */
      const nova = Math.round(resultado.score);
      if (nova === treinador.confidence && resultado.reason === treinador.confidenceReason && !avisar) continue;

      escritas.push(
        prisma.manager.update({
          where: { id: treinador.id },
          data: {
            confidence: nova,
            confidenceReason: resultado.reason,
            ...(avisar ? { warnings: treinador.warnings + 1 } : {}),
          },
        }),
      );
    }

    /**
     * Um lote, uma transação. Soltas num `Promise.all`, cada escrita abria e fechava a própria transação
     * no SQLite — medido: ~1.800 commits na primeira semana de um mundo completo, a maior parte do tempo
     * de "avançar até o jogo", e o que fazia a partida parecer nunca começar num servidor de CPU modesta.
     */
    if (escritas.length > 0) await prisma.$transaction(escritas);
    if (treinadores.length < LOTE) break;
  }

  return { managersEvaluated, newWarnings };
}

import {
  canBeSacked,
  canResign,
  canTakeOverAfterGoal,
  canTakeOverDivision,
  explainBlock,
  hardcoreGoal,
  type GameMode,
  type HardcoreGoal,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { readSavesIndex } from './saveService.js';

/**
 * Qual modo de carreira este técnico escolheu, e o que isso o impede de fazer.
 *
 * O modo vive no índice de saves, em disco, ao lado do resto da identidade da carreira — nome, nacionalidade,
 * formato de relógio. Não é estado do mundo: dois técnicos no mesmo mundo podem jogar modos diferentes, e
 * guardá-lo no banco obrigaria a uma coluna que o mundo não usa para nada.
 *
 * **Toda regra é verificada aqui, no servidor.** A tela esconde o que não está disponível, e esconder é
 * cortesia — a recusa é que é a regra. Sem isto, o teto do modo padrão cairia com uma chamada de rede feita
 * à mão.
 */
export class GameModeError extends Error {}

/** Carreira feita antes de os modos existirem é carreira padrão, que é o que sempre foi na prática. */
const PADRAO: GameMode = 'STANDARD';

export function getGameMode(userId: string): GameMode {
  try {
    const save = readSavesIndex().saves.find((s) => s.managerUserId === userId);
    return save?.gameMode ?? PADRAO;
  } catch {
    // Índice ilegível não pode impedir alguém de jogar: o modo mais permissivo aqui seria o errado, então
    // cai-se no padrão, que é o mais comum e o mais restrito depois do modo do zero.
    return PADRAO;
  }
}

/**
 * Em que divisão joga este clube **agora**.
 *
 * A liga em andamento manda, e as encerradas só entram se não houver nenhuma. Sem essa ordem, um clube que
 * disputou a elite numa temporada arquivada era tratado como clube de elite para sempre: verificado num
 * clube de terceira divisão que o modo padrão recusou com a mensagem da primeira, por causa de uma linha de
 * liga antiga que ninguém mais lê.
 *
 * Fora de qualquer liga trata-se como a divisão mais baixa: não há elite sem campeonato.
 */
export async function divisionOfClub(clubId: string): Promise<number> {
  const ligas = await prisma.league.findMany({
    where: { clubIdsJson: { contains: clubId } },
    orderBy: { season: 'desc' },
    select: { division: true, status: true, clubIdsJson: true },
  });

  const pertence = ligas.filter((liga) => (JSON.parse(liga.clubIdsJson) as string[]).includes(clubId));
  const emAndamento = pertence.find((liga) => liga.status === 'IN_PROGRESS');
  return (emAndamento ?? pertence[0])?.division ?? 99;
}

/**
 * Recusa a tomada de um clube que o modo não alcança.
 *
 * Vale para as três portas de entrada — escolher no painel, aceitar uma oferta de emprego e aceitar uma
 * sondagem — porque todas passam por `claimClub`. Fechar só uma delas seria fechar a porta e deixar as
 * janelas abertas.
 */
export async function assertCanTakeOver(userId: string, clubId: string): Promise<void> {
  const mode = getGameMode(userId);
  const division = await divisionOfClub(clubId);

  /**
   * Quem venceu o modo do zero deixa de ter teto.
   *
   * "Sem clube" **não** basta como prova de vitória, e tratá-lo assim abriu um buraco que fechava o modo
   * inteiro: um jogador recém-criado também não tem clube nenhum, e podia assumir o gigante que quisesse
   * antes de fundar coisa alguma.
   *
   * A prova é uma passagem encerrada. No modo do zero só há uma forma de encerrar uma: pedindo demissão, o
   * que exige o objetivo cumprido — a diretoria não demite ninguém neste modo. Quem tem uma passagem fechada
   * chegou lá ganhando.
   */
  if (mode === 'HARDCORE') {
    const meu = await prisma.club.findFirst({ where: { ownerId: userId }, select: { id: true } });
    const cumprido = meu
      ? (await hardcoreProgress(userId, meu.id)).met
      : (await prisma.managerTenure.count({ where: { userId, endedAt: { not: null } } })) > 0;

    if (canTakeOverAfterGoal(mode, cumprido, division)) return;
    throw new GameModeError(explainBlock(mode, 'division'));
  }

  if (!canTakeOverDivision(mode, division)) {
    throw new GameModeError(explainBlock(mode, 'division'));
  }
}

/**
 * O que falta ao técnico do modo do zero para se libertar do contrato.
 *
 * As competições são as do **país do clube, na divisão mais alta que ele tem** — o título dessa divisão e
 * todas as copas nacionais. Um país sem copa pede só o título; o Brasil pede Série A e Copa do Brasil.
 *
 * A lista sai do mundo e não de uma tabela fixa por uma razão medida: há 98 primeiras divisões no mundo
 * importado e apenas 7 copas. Escrever "liga mais copa" como requisito universal deixaria 91 países com um
 * objetivo impossível.
 *
 * Enquanto o clube não está na divisão mais alta, a lista sai vazia — e `hardcoreGoal` trata lista vazia
 * como objetivo não cumprido, que é o que prende o técnico durante a subida.
 */
export async function hardcoreProgress(userId: string, clubId: string): Promise<HardcoreGoal> {
  const clube = await prisma.club.findUnique({ where: { id: clubId }, select: { country: true } });
  if (!clube) return hardcoreGoal([]);

  const [ligas, copas] = await Promise.all([
    prisma.league.findMany({
      where: { countryCode: clube.country },
      select: { id: true, name: true, division: true, championOwnerId: true },
    }),
    prisma.cup.findMany({ where: { countryCode: clube.country }, select: { id: true, name: true, championOwnerId: true } }),
  ]);

  const divisaoAtual = await divisionOfClub(clubId);
  const divisaoMaisAlta = ligas.length > 0 ? Math.min(...ligas.map((l) => l.division)) : 1;
  // Ainda a subir: nada a listar, e o objetivo fica por cumprir.
  if (divisaoAtual > divisaoMaisAlta) return hardcoreGoal([]);

  /**
   * Uma competição por nome, e não por temporada.
   *
   * A liga renova numa linha nova a cada temporada, então há muitas linhas do mesmo campeonato. O que se
   * pede é ganhá-lo uma vez, e por isso as linhas se agrupam pelo nome: ganhar o Brasileirão de 2029 conta
   * como ter ganhado o Brasileirão.
   */
  const porNome = new Map<string, { id: string; name: string; won: boolean }>();
  for (const liga of ligas.filter((l) => l.division === divisaoMaisAlta)) {
    const anterior = porNome.get(liga.name);
    porNome.set(liga.name, {
      id: liga.id,
      name: liga.name,
      won: (anterior?.won ?? false) || liga.championOwnerId === userId,
    });
  }
  for (const copa of copas) {
    const anterior = porNome.get(copa.name);
    porNome.set(copa.name, {
      id: copa.id,
      name: copa.name,
      won: (anterior?.won ?? false) || copa.championOwnerId === userId,
    });
  }

  return hardcoreGoal([...porNome.values()]);
}

/** Recusa a saída de quem ainda não cumpriu o que o modo pede. */
export async function assertCanResign(userId: string, clubId: string): Promise<void> {
  const mode = getGameMode(userId);
  if (mode !== 'HARDCORE') return;

  const objetivo = await hardcoreProgress(userId, clubId);
  if (!canResign(mode, objetivo.met)) {
    const falta = objetivo.missing.length > 0 ? ` Falta ganhar: ${objetivo.missing.join(', ')}.` : '';
    throw new GameModeError(`${explainBlock(mode, 'resign')}${falta}`);
  }
}

/**
 * O técnico deste clube está imune à demissão?
 *
 * Consultado pela demissão em massa do tick semanal, e por isso recebe o dono do clube em vez de fazer a
 * consulta: percorrer o mundo perguntando o modo de cada um, um a um, custaria uma leitura de disco por
 * clube por semana de jogo.
 */
export function isSackImmune(ownerId: string): boolean {
  return !canBeSacked(getGameMode(ownerId));
}

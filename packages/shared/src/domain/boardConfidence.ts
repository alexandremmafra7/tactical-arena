import type { FormResult, SeasonObjective } from './clubBriefing.js';

/**
 * A confiança da diretoria no técnico, de 0 a 100.
 *
 * Uma nota só, e dela sai tudo: a demissão quando cai demais, o interesse de outros clubes quando sobe, e o
 * que o presidente diz quando pede uma reunião. Ter um número em vez de três regras soltas é o que impede o
 * jogo de demitir por um motivo e sondar por outro no mesmo dia.
 *
 * **A nota não é aproveitamento.** É a distância entre onde o clube está e onde a diretoria pediu que
 * estivesse, e o pedido já vem dimensionado ao elenco por `seasonObjective`. Salvar um elenco fraco do
 * rebaixamento vale mais confiança do que terminar em quarto com o melhor elenco da liga. Medir por vitórias
 * faria o jogo premiar quem escolhesse o clube mais rico, e a carreira perderia o sentido: o técnico do
 * Palmeiras seria sempre melhor que o do Criciúma, por definição, sem ter feito nada.
 *
 * Tudo aqui é função pura. A parte que erra num sistema destes não é a conta, é o ritmo — quando cobrar,
 * quanta paciência dar, quando é tarde demais — e ritmo se testa.
 */

/** Onde a nota começa. Nem crédito nem desconfiança: o técnico chega com a diretoria neutra. */
export const CONFIDENCE_START = 60;

/**
 * Abaixo disto o presidente pede a primeira conversa.
 *
 * Aviso, não demissão. Um sistema que demite sem avisar é arbitrário; com aviso, a demissão vira consequência
 * de algo que o jogador viu chegar e teve a chance de reverter.
 */
export const WARNING_FLOOR = 35;

/** Abaixo disto a diretoria age — e só age se o aviso já tiver sido dado. */
export const SACK_FLOOR = 18;

/** Acima disto outros clubes começam a olhar. */
export const INTEREST_CEILING = 78;

/**
 * Quantas rodadas de paciência a diretoria dá no começo da temporada.
 *
 * É a defesa mais importante deste módulo. Uma tabela de cinco rodadas não diz nada — o clube que vai ser
 * campeão pode estar em décimo — e demitir na rodada 3 é o erro mais fácil de cometer aqui, além de ser o
 * que faria o jogador desinstalar o jogo. Dentro desta janela a nota se move a um quarto da velocidade.
 */
export const GRACE_ROUNDS = 6;

/**
 * O quanto a nota pode andar numa semana, para a corda apertar em vez de estourar.
 *
 * O destino de uma semana catastrófica é o fundo da escala, e saltar direto para lá mediu 57 pontos de
 * queda entre uma segunda e a outra — o bastante para ir de tranquilo a demitido sem o jogador ver a pressão
 * subir uma única vez. O teto é o que transforma esse salto em descida.
 *
 * Com oito, uma temporada em queda livre leva cerca de quatro semanas para consumir a confiança inicial e
 * chega ao piso de demissão por volta da décima rodada — um mês e meio, que é o tempo que um presidente de
 * verdade leva para perder a paciência.
 */
export const MAX_WEEKLY_DELTA = 8;

export type ConfidenceMood = 'idolo' | 'tranquilo' | 'observado' | 'pressionado' | 'insustentavel';

export interface BoardConfidenceInput {
  /** A nota da semana passada. Ausente no primeiro cálculo de uma passagem. */
  previous?: number;
  /** O que a diretoria pediu, já dimensionado ao elenco. */
  objective: SeasonObjective;
  /** Posição atual na tabela, 1-based. Null antes da primeira rodada. */
  currentPosition: number | null;
  totalClubs: number;
  roundsPlayed: number;
  totalRounds: number;
  /** Últimos resultados, do mais recente para o mais antigo. */
  form: FormResult[];
  /** Semanas de caixa antes de acabar o dinheiro. Infinito quando o clube dá lucro. */
  runwayWeeks: number;
  /** Quanto da receita vai em salário, 0 a 1. */
  wageRatio: number;
  /** Fases de copa vencidas nesta temporada. */
  cupRoundsWon?: number;
  /** Verdadeiro quando o clube caiu de uma copa para um adversário de divisão inferior. */
  cupUpsetLoss?: boolean;
}

export interface BoardConfidenceResult {
  score: number;
  mood: ConfidenceMood;
  label: string;
  /** Quanto a nota andou nesta semana. Negativo é queda. */
  delta: number;
  /** O que mais pesou, para o presidente ter o que dizer na reunião. */
  reason: string;
}

function limitar(valor: number): number {
  return Math.max(0, Math.min(100, valor));
}

/**
 * A posição, traduzida em pressão.
 *
 * Positivo é folga, negativo é cobrança. Não é linear de propósito: ficar duas posições abaixo do pedido é
 * um aborrecimento, ficar dez é uma crise, e a diferença entre as duas coisas tem que aparecer na nota. O
 * termo é dividido pelo tamanho da liga para uma queda de cinco lugares pesar o mesmo numa liga de 20 e numa
 * de 8 — sem isso, dirigir numa liga pequena seria muito mais perigoso, sem nenhuma razão de futebol.
 *
 * A impaciência do fim de temporada mora aqui, e não no tamanho do passo, porque é o **destino** que muda:
 * a mesma décima posição é recuperável em maio e definitiva em novembro. Estar atrás em setembro é pior do
 * que estar atrás em abril mesmo que nada mais tenha mudado, e é isso que o multiplicador exprime.
 */
function pressaoDaTabela(
  objective: SeasonObjective,
  currentPosition: number | null,
  totalClubs: number,
  fracaoJogada: number,
): number {
  if (currentPosition === null) return 0;

  const folga = objective.targetPosition - currentPosition;
  const escala = Math.max(1, totalClubs - 1);

  /**
   * Cumprir vale, e vencer vale mais — mesmo quando vencer era o pedido.
   *
   * Medir o mérito só pela folga sobre o pedido deixava o técnico de clube grande sem teto: quando a
   * diretoria pede o título, a folga nunca passa de zero, e o campeão com o melhor elenco terminava a
   * temporada em 72 pontos de confiança, abaixo de quem chegou em terceiro com elenco mediano. Ganhar tudo
   * o que havia para ganhar não pode valer menos do que superar uma expectativa modesta.
   *
   * Então o mérito tem duas metades: superar o pedido, e a posição absoluta na tabela. A segunda é o que dá
   * teto a quem já era obrigado a vencer.
   */
  if (folga >= 0) {
    const superacao = (folga / escala) * 30;
    const altura = ((totalClubs - currentPosition) / escala) * 14;
    return Math.min(22, superacao + altura);
  }

  const atraso = -folga / escala;
  // Quadrático: a cobrança acelera conforme o clube afunda.
  const cobranca = atraso * 35 + atraso * atraso * 90;
  return -cobranca * (1 + fracaoJogada * 0.6);
}

/**
 * A forma recente, que é como um presidente perde a paciência antes de a tabela mudar.
 *
 * Cinco derrotas seguidas derrubam mesmo com o clube ainda em posição aceitável, porque é assim que funciona:
 * ninguém espera a tabela alcançar o que a arquibancada já está gritando. Os jogos mais recentes pesam mais.
 */
function pesoDaForma(form: FormResult[]): number {
  if (form.length === 0) return 0;

  const janela = form.slice(0, 5);
  let soma = 0;
  let pesoTotal = 0;

  janela.forEach((resultado, indice) => {
    const peso = 5 - indice;
    pesoTotal += peso;
    soma += peso * (resultado === 'V' ? 1 : resultado === 'E' ? 0 : -1);
  });

  return (soma / pesoTotal) * 10;
}

/**
 * As finanças, que demitem por conta própria.
 *
 * Um clube perto de não conseguir pagar a folha é problema de gestão, e nenhuma sequência de vitórias
 * apaga isso. A folha alta sozinha não é crime — um clube grande gasta muito — mas passar de toda a receita
 * é insustentável em qualquer tamanho.
 */
function pesoDasFinancas(runwayWeeks: number, wageRatio: number): number {
  let peso = 0;

  if (runwayWeeks < 4) peso -= 25;
  else if (runwayWeeks < 12) peso -= 8;
  else if (runwayWeeks === Number.POSITIVE_INFINITY) peso += 2;

  if (wageRatio > 1) peso -= 10;
  else if (wageRatio > 0.8) peso -= 4;

  return peso;
}

/** A copa: uma boa campanha compra tempo, e cair para um clube menor custa. */
function pesoDaCopa(cupRoundsWon: number, cupUpsetLoss: boolean): number {
  return Math.min(10, cupRoundsWon * 3) - (cupUpsetLoss ? 12 : 0);
}

export function moodFor(score: number): { mood: ConfidenceMood; label: string } {
  if (score >= 85) return { mood: 'idolo', label: 'Ídolo da torcida' };
  if (score >= INTEREST_CEILING) return { mood: 'tranquilo', label: 'Prestigiado' };
  if (score >= WARNING_FLOOR) return { mood: 'observado', label: 'Sob observação' };
  if (score >= SACK_FLOOR) return { mood: 'pressionado', label: 'Sob pressão' };
  return { mood: 'insustentavel', label: 'Situação insustentável' };
}

/**
 * Onde a confiança **merece** estar, dado o momento do clube.
 *
 * Separar o destino do caminho é o que faz este módulo funcionar. A primeira versão somava os termos
 * diretamente na nota toda semana, e o resultado, medido ao longo de uma temporada de 38 rodadas, foi
 * absurdo: quem cumpria o objetivo exatamente via a nota escorrer de 60 para 45 sem nada ter acontecido, e o
 * pior elenco do campeonato, salvo do rebaixamento, caía ao piso de demissão na rodada 28. Sem um ponto para
 * onde puxar, a nota é um passeio aleatório que sempre acaba num extremo — todo mundo termina em 0 ou em 100.
 *
 * Com destino, cumprir o objetivo é um estado estável: o clube fica onde está, que é exatamente o que
 * "a diretoria está satisfeita" quer dizer.
 */
function confiancaMerecida(input: BoardConfidenceInput, fracaoJogada: number): {
  alvo: number;
  tabela: number;
  forma: number;
  financas: number;
  copa: number;
} {
  const tabela = pressaoDaTabela(input.objective, input.currentPosition, input.totalClubs, fracaoJogada);
  const forma = pesoDaForma(input.form);
  const financas = pesoDasFinancas(input.runwayWeeks, input.wageRatio);
  const copa = pesoDaCopa(input.cupRoundsWon ?? 0, input.cupUpsetLoss ?? false);

  return { alvo: limitar(CONFIDENCE_START + tabela + forma + financas + copa), tabela, forma, financas, copa };
}

/**
 * Recalcula a confiança da diretoria a partir da nota da semana passada.
 *
 * A nota **caminha** para o destino em vez de saltar até ele. Uma diretoria que recalculasse do zero toda
 * segunda daria pulos de trinta pontos e pareceria bipolar; andando aos poucos, a nota conta uma história e
 * dá para ver a corda apertando — que é o que torna o aviso do presidente um aviso, e não um susto.
 */
export function boardConfidence(input: BoardConfidenceInput): BoardConfidenceResult {
  const anterior = input.previous ?? CONFIDENCE_START;

  const fracaoJogada = input.totalRounds > 0 ? Math.min(1, input.roundsPlayed / input.totalRounds) : 0;
  const { alvo, tabela, forma, financas, copa } = confiancaMerecida(input, fracaoJogada);

  /**
   * A paciência do começo.
   *
   * Nas primeiras rodadas o passo é curto, porque a tabela ainda não significa nada — o clube que vai ser
   * campeão pode estar em décimo na quarta rodada. A impaciência do fim não está aqui: ela mora no destino,
   * onde é o julgamento que muda, e não a velocidade com que a diretoria muda de ideia.
   */
  const passoMaximo = input.roundsPlayed < GRACE_ROUNDS ? MAX_WEEKLY_DELTA * 0.25 : MAX_WEEKLY_DELTA;

  const distancia = alvo - anterior;
  const delta = Math.max(-passoMaximo, Math.min(passoMaximo, distancia));

  const score = limitar(Math.round((anterior + delta) * 10) / 10);
  const { mood, label } = moodFor(score);

  return { score, mood, label, delta: Math.round(delta * 10) / 10, reason: motivo(tabela, forma, financas, copa) };
}

/**
 * Qual dos termos mandou, para o presidente ter o que dizer.
 *
 * Escolhe o de maior peso absoluto, e não o mais negativo: quando as coisas vão bem a mesma frase serve para
 * elogiar. Uma reunião em que o presidente fala genericamente é uma reunião que o jogador aprende a fechar
 * sem ler.
 */
function motivo(tabela: number, forma: number, financas: number, copa: number): string {
  const termos: { peso: number; texto: string }[] = [
    { peso: tabela, texto: tabela >= 0 ? 'a posição na tabela' : 'a distância para o objetivo da temporada' },
    { peso: forma, texto: forma >= 0 ? 'a sequência de resultados' : 'a sequência recente de resultados' },
    { peso: financas, texto: 'a situação financeira do clube' },
    { peso: copa, texto: copa >= 0 ? 'a campanha na copa' : 'a eliminação na copa' },
  ];

  return termos.reduce((maior, atual) => (Math.abs(atual.peso) > Math.abs(maior.peso) ? atual : maior)).texto;
}

/**
 * A diretoria deve chamar o técnico para conversar.
 *
 * Só uma vez por passagem: o aviso é um ultimato, e um ultimato repetido toda semana deixa de ser ultimato.
 */
export function shouldWarn(score: number, warningsGiven: number): boolean {
  return score < WARNING_FLOOR && warningsGiven === 0;
}

/**
 * A diretoria demite.
 *
 * O aviso é condição, não formalidade: sem ele, a demissão vira sorteio do ponto de vista de quem joga.
 */
export function shouldSack(score: number, warningsGiven: number): boolean {
  return score < SACK_FLOOR && warningsGiven > 0;
}

/** O técnico está bem o bastante para outro clube o querer. */
export function attractsInterest(score: number): boolean {
  return score >= INTEREST_CEILING;
}

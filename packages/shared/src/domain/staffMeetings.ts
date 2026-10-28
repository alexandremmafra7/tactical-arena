import type { Club } from './club.js';
import { STAFF_ROLES_INFO, type StaffMember, type StaffRole } from './staff.js';
import { MAX_SPONSORSHIPS } from './finance.js';
import { injuredPlayers } from './clubBriefing.js';

/**
 * Quem pede uma reunião com o técnico, e quando o jogo fica calado.
 *
 * Um sistema de avisos morre por excesso. Quando morre, o jogador aprende a fechar sem ler, e a partir daí
 * nem o aviso que importava chega. Por isso este módulo é escrito ao contrário do habitual: as regras de
 * silêncio vêm primeiro e são a maior parte dele, e a de aparecer é quase um detalhe.
 *
 * Nada aqui desenha nada. É função pura, do estado do clube para uma fila, porque a parte que erra é o
 * ritmo: quando falar, quanto esperar, quando desistir. Isso se testa; um cartão bonito não.
 */

export type MeetingTopic = 'lineup' | 'sponsors' | 'academy' | 'injuries' | 'cash' | 'contracts' | 'board';

export interface MeetingRequest {
  topic: MeetingTopic;
  /** O cargo de quem pede. Null quando o posto está vago e quem fala é a diretoria. */
  role: StaffRole | null;
  /** Quem assina o pedido: o profissional, ou a diretoria quando não há profissional. */
  speakerName: string;
  speakerTitle: string;
  speakerIcon: string;
  /** A fala, em primeira pessoa. */
  message: string;
  actionPath: string;
  actionLabel: string;
  /** Quanto mais alto, mais cedo na fila. */
  urgency: number;
}

/** O que o jogo já sabe sobre o momento, e que decide se vale interromper. */
export interface MeetingContext {
  hasLineup: boolean;
  /** Dias até a próxima partida. Zero é hoje. */
  daysToNextMatch: number;
  /** Semana corrente da carreira, para os prazos de adiamento. */
  currentWeek: number;
  /** Propostas de patrocínio que valem mais que o contrato em vigor, se houver. */
  bestSponsorUpgrade?: number;
  /** Jovens da base prontos para subir. */
  academyReady?: number;
  /** Quantos contratos vencem nesta temporada ou na próxima. */
  expiringContracts?: number;
  /** A confiança da diretoria, 0 a 100. Ausente quando ainda não foi avaliada. */
  boardConfidence?: number;
  /** O que mais pesou na última avaliação, em texto, vindo de `boardConfidence`. */
  boardConcern?: string;
  /** Verdadeiro na semana em que o presidente decide pedir satisfações. */
  boardWarning?: boolean;
  /** Quantos avisos o servidor já registrou, para a tela saber qual deles está a mostrar. */
  boardWarningCount?: number;
}

/**
 * O que o jogador adiou, e até quando.
 *
 * Guardado no save. Sem isto, "agora não" dura até a próxima tela e o pedido volta, que é a forma mais rápida
 * de tornar o sistema insuportável.
 */
export interface MeetingDeferral {
  topic: MeetingTopic;
  /** Semana em que o assunto pode voltar a ser levantado. */
  mutedUntilWeek: number;
  /** Quantas vezes já foi adiado. Na segunda, o assunto cala até a temporada seguinte. */
  times: number;
}

/** Um pedido por dia de jogo. Mais que isso vira ruído, por mais coisa que esteja pendente. */
export const MEETINGS_PER_DAY = 1;

/** E três por semana, que é o teto acima do qual o jogador começa a fechar sem ler. */
export const MEETINGS_PER_WEEK = 3;

/** Quantas semanas um assunto adiado fica calado. */
export const DEFER_WEEKS = 4;

/** Adiar duas vezes é uma resposta: o assunto some por uma temporada inteira. */
export const DEFER_SEASON_WEEKS = 40;

/** Fechar a porta ao presidente compra duas semanas, e só. Ver deferMeeting. */
export const BOARD_MUTE_WEEKS = 2;

function quemFala(club: Club, role: StaffRole): { membro: StaffMember | null; nome: string; titulo: string; icone: string } {
  const info = STAFF_ROLES_INFO[role];
  const membro = (club.staff ?? []).find((s) => s.role === role) ?? null;
  return {
    membro,
    /**
     * Cargo vago fala pela diretoria, e a ausência vira a própria mensagem.
     *
     * Era tentador simplesmente não falar quando não há ninguém no posto, e seria o pior dos dois mundos: o
     * jogador que não contratou coordenador de base é exatamente aquele que precisa ouvir que ninguém está
     * olhando a base.
     */
    nome: membro?.name ?? 'Diretoria',
    titulo: membro ? info.title : `${info.title} (cargo vago)`,
    icone: membro?.avatar || info.icon,
  };
}

/**
 * Monta a fila de pedidos de reunião, já filtrada e ordenada.
 *
 * A ordem é por urgência, e urgência aqui significa uma coisa concreta: o que se perde por não decidir hoje.
 * Escalação faltando na véspera custa a partida; vaga de patrocínio aberta custa dinheiro que continua sem
 * entrar amanhã, então ela espera.
 */
export function buildMeetingQueue(
  club: Club,
  context: MeetingContext,
  deferrals: MeetingDeferral[] = [],
): MeetingRequest[] {
  const pedidos: MeetingRequest[] = [];

  /**
   * O presidente pede satisfações, e é o único assunto desta lista com consequência sobre o próprio técnico.
   *
   * Vem primeiro em urgência porque é o único que pode acabar com a carreira no clube. E é obrigatório: a
   * demissão só acontece depois deste aviso, senão o jogador é demitido por um número que nunca viu e a
   * consequência vira sorteio.
   *
   * Quem fala é a diretoria, não um contratado — não existe cargo de presidente na comissão técnica porque
   * ele está acima dela, e é essa a diferença que a fala precisa passar.
   */
  if (context.boardWarning) {
    const preocupacao = context.boardConcern ?? 'o rumo da temporada';
    pedidos.push({
      topic: 'board',
      role: null,
      speakerName: 'Presidente',
      speakerTitle: 'Presidente do clube',
      speakerIcon: '🎩',
      message: `Precisamos conversar sobre ${preocupacao}. O conselho está preocupado, e eu preciso poder dizer a eles que a situação vai mudar.`,
      actionPath: 'career',
      actionLabel: 'Ouvir o presidente',
      urgency: 110,
    });
  }

  /**
   * Escalação em falta, e só na véspera.
   *
   * Fora da véspera isto não é assunto de reunião: falta tempo de sobra, e o aviso discreto que já existe na
   * tela do clube dá conta. Interromper por algo que tem uma semana para ser resolvido é o começo do fim.
   */
  if (!context.hasLineup && context.daysToNextMatch <= 1) {
    const voz = quemFala(club, 'TACTICAL_ASSISTANT');
    pedidos.push({
      topic: 'lineup',
      role: voz.membro ? 'TACTICAL_ASSISTANT' : null,
      speakerName: voz.nome,
      speakerTitle: voz.titulo,
      speakerIcon: voz.icone,
      message: voz.membro
        ? 'Treinador, o jogo é amanhã e não temos time escalado. Precisamos fechar os onze hoje.'
        : 'Não há auxiliar técnico no clube e o jogo é amanhã. Alguém precisa escalar o time.',
      actionPath: 'tactics',
      actionLabel: 'Escalar agora',
      urgency: 100,
    });
  }

  // Lesão é assunto do preparador físico, e só quando há jogo próximo para ela atrapalhar.
  const lesionados = injuredPlayers(club.players ?? []);
  if (lesionados.length > 0 && context.daysToNextMatch <= 3) {
    const voz = quemFala(club, 'FITNESS_COACH');
    pedidos.push({
      topic: 'injuries',
      role: voz.membro ? 'FITNESS_COACH' : null,
      speakerName: voz.nome,
      speakerTitle: voz.titulo,
      speakerIcon: voz.icone,
      message: voz.membro
        ? `Temos ${lesionados.length === 1 ? `${lesionados[0].name} no departamento médico` : `${lesionados.length} jogadores no departamento médico`}. Vale rever quem entra em campo.`
        : `Há ${lesionados.length} jogador(es) lesionado(s) e ninguém cuidando da preparação física.`,
      actionPath: 'squad',
      actionLabel: 'Ver elenco',
      urgency: 70,
    });
  }

  /**
   * Patrocínio só vira reunião quando há dinheiro na mesa.
   *
   * Uma vaga aberta sem proposta boa não é decisão, é estado, e estado é trabalho do aviso discreto. O que
   * justifica interromper é uma proposta concreta que paga mais do que o clube recebe hoje.
   */
  const vagas = MAX_SPONSORSHIPS - (club.sponsorships?.length ?? 0);
  const ganho = context.bestSponsorUpgrade ?? 0;
  if (vagas > 0 && ganho > 0) {
    const voz = quemFala(club, 'FINANCIAL_DIRECTOR');
    pedidos.push({
      topic: 'sponsors',
      role: voz.membro ? 'FINANCIAL_DIRECTOR' : null,
      speakerName: voz.nome,
      speakerTitle: voz.titulo,
      speakerIcon: voz.icone,
      message: voz.membro
        ? `Temos ${vagas === 1 ? 'uma vaga' : `${vagas} vagas`} de patrocínio parada e proposta na mesa: a melhor paga R$ ${ganho.toLocaleString('pt-BR')} por semana. Precisa da sua assinatura.`
        : `Há ${vagas === 1 ? 'uma vaga' : `${vagas} vagas`} de patrocínio sem ninguém para negociar. O clube deixa de receber toda semana.`,
      actionPath: 'sponsors',
      actionLabel: 'Ver propostas',
      urgency: 50,
    });
  }

  /**
   * Contrato a vencer, que é a única decisão desta lista com prejuízo certo se ninguém agir.
   *
   * Um jogador que chega ao fim sai de graça e o clube não recebe nada por ele. É o assunto que dá trabalho
   * de verdade ao diretor de futebol, e por isso é ele quem bate à porta.
   */
  if ((context.expiringContracts ?? 0) > 0) {
    const voz = quemFala(club, 'FOOTBALL_DIRECTOR');
    const quantos = context.expiringContracts!;
    pedidos.push({
      topic: 'contracts',
      role: voz.membro ? 'FOOTBALL_DIRECTOR' : null,
      speakerName: voz.nome,
      speakerTitle: voz.titulo,
      speakerIcon: voz.icone,
      message: voz.membro
        ? `${quantos === 1 ? 'Um contrato vence' : `${quantos} contratos vencem`} e o clube não recebe nada por quem sai de graça. Renovar agora sai mais barato que no último ano.`
        : `${quantos === 1 ? 'Um contrato vence' : `${quantos} contratos vencem`} e não há diretor de futebol para cuidar disso.`,
      actionPath: 'contracts',
      actionLabel: 'Ver contratos',
      urgency: 60,
    });
  }

  // Base: alguém pronto para subir, que é uma decisão com prazo, porque o menino envelhece.
  if ((context.academyReady ?? 0) > 0) {
    const voz = quemFala(club, 'YOUTH_COORDINATOR');
    const quantos = context.academyReady!;
    pedidos.push({
      topic: 'academy',
      role: voz.membro ? 'YOUTH_COORDINATOR' : null,
      speakerName: voz.nome,
      speakerTitle: voz.titulo,
      speakerIcon: voz.icone,
      message: voz.membro
        ? `Tenho ${quantos === 1 ? 'um garoto pronto' : `${quantos} garotos prontos`} para subir ao profissional. Queria te mostrar antes que percam a janela.`
        : `Há ${quantos} jovem(ns) pronto(s) na base e nenhum coordenador para acompanhar.`,
      actionPath: 'academy',
      actionLabel: 'Ver a base',
      urgency: 40,
    });
  }

  return aplicarSilencio(pedidos, context, deferrals);
}

/**
 * As regras de silêncio, que são o produto de verdade.
 *
 * Nesta ordem: o que o jogador mandou calar fica calado; o que sobra é ordenado por urgência; e do topo sai
 * um só. Nunca dois cartões, nunca o segundo assunto "aproveitando que já abriu".
 */
function aplicarSilencio(
  pedidos: MeetingRequest[],
  context: MeetingContext,
  deferrals: MeetingDeferral[],
): MeetingRequest[] {
  const calados = new Map(deferrals.map((d) => [d.topic, d]));

  const permitidos = pedidos.filter((p) => {
    const adiado = calados.get(p.topic);
    if (!adiado) return true;
    return context.currentWeek >= adiado.mutedUntilWeek;
  });

  permitidos.sort((a, b) => b.urgency - a.urgency);
  return permitidos.slice(0, MEETINGS_PER_DAY);
}

/**
 * Registra um "agora não", e decide por quanto tempo.
 *
 * A segunda recusa do mesmo assunto é tratada como resposta, não como adiamento: quem disse não duas vezes
 * não quer ser lembrado disso outra vez esta temporada. Insistir depois disso é a definição de chato.
 */
export function deferMeeting(
  topic: MeetingTopic,
  currentWeek: number,
  deferrals: MeetingDeferral[] = [],
): MeetingDeferral[] {
  const anterior = deferrals.find((d) => d.topic === topic);
  const vezes = (anterior?.times ?? 0) + 1;

  /**
   * O presidente é o único que não se cala por uma temporada.
   *
   * Todo outro assunto aceita "não" como resposta definitiva, e deve mesmo. Este não pode: um ultimato que o
   * jogador consegue silenciar deixa de ser ultimato, e a demissão que vem depois dele passa a chegar sem
   * aviso nenhum — exatamente o que o aviso existe para impedir.
   */
  const espera = topic === 'board' ? BOARD_MUTE_WEEKS : vezes >= 2 ? DEFER_SEASON_WEEKS : DEFER_WEEKS;

  return [
    ...deferrals.filter((d) => d.topic !== topic),
    { topic, mutedUntilWeek: currentWeek + espera, times: vezes },
  ];
}

/**
 * O teto semanal, contado fora daqui porque depende de quantas reuniões já aconteceram.
 *
 * Fica exposto como função para a tela não precisar reimplementar a comparação, que é como esse tipo de regra
 * acaba divergindo entre duas plataformas neste projeto.
 */
export function weeklyBudgetSpent(meetingsThisWeek: number): boolean {
  return meetingsThisWeek >= MEETINGS_PER_WEEK;
}

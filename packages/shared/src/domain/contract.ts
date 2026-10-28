import type { Player } from './player.js';
import { PEAK_AGE_END } from './player.js';
import type { StaffMember } from './staff.js';
import { getDirectorTransferDiscount } from './staff.js';

/**
 * O contrato de um jogador com o clube.
 *
 * Não existia. O jogador tinha salário e multa rescisória e nenhum prazo, e a consequência é maior do que
 * parece: **sem prazo não há motivo para ninguém sair**. O mundo ficava parado não por falta de uma
 * inteligência de mercado, mas porque nenhum elenco tinha uma data que obrigasse a decidir. É também o que
 * deixava o diretor de futebol sem função de verdade: renovar contrato num jogo sem contrato é nada.
 *
 * O contrato é guardado como o ano em que termina, e não como um número de anos restantes, porque a virada
 * de temporada é anual e comparar dois anos não depende de ninguém lembrar de decrementar um contador.
 */

/** Quantos anos dura um contrato novo, por faixa de idade. Jovem assina longo, veterano assina curto. */
export function defaultContractYears(age: number): number {
  if (age <= 21) return 5;
  if (age <= PEAK_AGE_END) return 4;
  if (age <= 32) return 2;
  return 1;
}

/** O ano em que o contrato de um jogador recém-assinado termina. */
export function contractEndFor(age: number, currentSeason: number): number {
  return currentSeason + defaultContractYears(age);
}

/**
 * Quantas temporadas faltam. Zero significa que vence no fim desta.
 *
 * Um contrato ausente é tratado como longo, e não como vencido: saves e elencos criados antes de os
 * contratos existirem não podem perder o time inteiro na primeira virada.
 */
export function seasonsRemaining(player: Player, currentSeason: number): number {
  if (player.contractUntil == null) return defaultContractYears(player.age);
  return player.contractUntil - currentSeason;
}

/** O contrato termina no fim da temporada corrente. */
export function isExpiring(player: Player, currentSeason: number): boolean {
  return seasonsRemaining(player, currentSeason) <= 0;
}

/**
 * Já venceu e o jogador está livre.
 *
 * Separado de `isExpiring` porque as duas perguntas levam a ações diferentes: um contrato que vence pede
 * renovação agora, um que venceu já tirou o jogador do clube.
 */
export function hasExpired(player: Player, currentSeason: number): boolean {
  return seasonsRemaining(player, currentSeason) < 0;
}

/**
 * O que custa renovar.
 *
 * Proporcional ao salário e ao tempo que se compra, com um prêmio para quem está em fim de contrato: um
 * jogador a uma temporada do fim sabe que pode sair de graça, e cobra por isso. Renovar cedo é mais barato,
 * que é exatamente a decisão que dá trabalho ao diretor de futebol.
 */
export function renewalCost(player: Player, currentSeason: number, years: number, director?: StaffMember | null): number {
  const restantes = Math.max(0, seasonsRemaining(player, currentSeason));

  // Quem está a um ano do fim custa metade a mais; quem tem contrato longo quase não cobra prêmio.
  const premioDeUrgencia = restantes <= 0 ? 1.6 : restantes === 1 ? 1.5 : restantes === 2 ? 1.2 : 1.0;

  // Semanas de salário por ano contratado, que é a moeda em que uma folha se pensa.
  const base = player.wage * 42 * years * premioDeUrgencia;

  /**
   * O desconto do diretor de futebol vale aqui também.
   *
   * Era o único efeito real dele e valia só na compra de jogador. Renovação é a outra metade do trabalho de
   * um diretor, e é a que existe todo ano mesmo para quem não contrata ninguém.
   */
  return Math.max(1, Math.round(base * (1 - getDirectorTransferDiscount(director))));
}

/**
 * Renova o contrato, devolvendo o jogador com o novo prazo.
 *
 * A contagem parte do maior entre a temporada corrente e o fim atual, para renovar cedo somar em vez de
 * encurtar: quem renova com três anos pela frente por mais dois fica com cinco, não com dois.
 */
export function renewContract(player: Player, currentSeason: number, years: number): Player {
  /**
   * O prazo de partida é o mesmo que `seasonsRemaining` mostra, e não a temporada corrente.
   *
   * As duas funções discordavam num caso que parecia raro e é o mais comum de todos: jogador sem
   * `contractUntil`. `seasonsRemaining` mostra o prazo padrão da idade dele, e daqui saía a temporada
   * corrente — renovar por três anos um jogador que a tela dizia ter quatro deixava-o com três. A tela
   * mentia ou o servidor roubava, conforme o lado de onde se olhasse.
   */
  const atual = player.contractUntil ?? currentSeason + defaultContractYears(player.age);
  const base = Math.max(currentSeason, atual);
  return { ...player, contractUntil: base + Math.max(1, Math.round(years)) };
}

/**
 * Quem um clube da máquina deixa sair quando o contrato vence.
 *
 * A escala obriga a esta regra existir. São 61.490 jogadores no mundo e contratos de três anos em média, o
 * que daria vinte mil vencimentos por temporada se cada contrato simplesmente corresse até o fim — vinte mil
 * jogadores sem clube, e vinte mil buracos a preencher. Um clube de verdade renova quase todo mundo e deixa
 * sair o excedente, e é isso que esta função decide: medido, cerca de 545 saídas por temporada no mundo
 * inteiro.
 *
 * Dois critérios, e ambos olham o elenco em vez de olhar o jogador sozinho:
 *
 *  - **sobra na posição**: mais gente na posição do que o clube consegue usar;
 *  - **veterano abaixo da média**: passou dos trinta e joga menos que o elenco dele.
 *
 * O clube nunca solta abaixo do mínimo para escalar, por pior que o elenco esteja.
 */
export function playersToRelease(
  players: Player[],
  currentSeason: number,
  options: { minSquad?: number; maxPerPosition?: number } = {},
): Player[] {
  const minSquad = options.minSquad ?? 18;
  const maxPerPosition = options.maxPerPosition ?? 4;

  const vencendo = players.filter((p) => isExpiring(p, currentSeason));
  if (vencendo.length === 0) return [];

  const media = players.reduce((soma, p) => soma + p.overall, 0) / Math.max(1, players.length);
  const contagem = new Map<string, number>();
  for (const p of players) contagem.set(p.position, (contagem.get(p.position) ?? 0) + 1);

  /**
   * Pior primeiro, para o clube soltar quem menos lhe faz falta quando o mínimo de elenco morde.
   */
  const candidatos = vencendo
    .filter((p) => (contagem.get(p.position) ?? 0) > maxPerPosition || (p.age > 30 && p.overall < media))
    .sort((a, b) => a.overall - b.overall);

  const podeSoltar = Math.max(0, players.length - minSquad);
  return candidatos.slice(0, podeSoltar);
}

/**
 * O contrato que um jogador sem prazo recebe, para saves anteriores aos contratos entrarem no sistema.
 *
 * Espalhado no tempo de propósito: dar a todos o mesmo ano de término faria o mundo inteiro vencer contrato
 * na mesma virada, e um elenco perderia metade da gente de uma vez.
 */
export function backfillContract(player: Player, currentSeason: number, rng: () => number): Player {
  if (player.contractUntil != null) return player;
  const anos = Math.max(1, Math.round(defaultContractYears(player.age) * (0.4 + rng() * 0.6)));
  return { ...player, contractUntil: currentSeason + anos };
}

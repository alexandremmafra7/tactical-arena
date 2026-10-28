/**
 * Os três modos de carreira, e o que cada um permite.
 *
 * As regras vivem aqui, longe do banco e da tela, por um motivo prático: elas precisam ser verificadas nos
 * dois lados. O cliente esconde o que não está disponível, e o servidor recusa — e se as duas versões da
 * mesma regra fossem escritas separadamente, divergiriam no primeiro ajuste. Este projeto já se partiu assim
 * com nome de liga, divisão de campeonato e partida ao vivo.
 *
 * O que separa os modos não é dificuldade artificial. É **por onde se entra**:
 *
 *  - `PREMIUM` entra por onde quiser, inclusive pela porta da frente de um gigante;
 *  - `STANDARD` entra pela segunda divisão e sobe pelo que fizer em campo;
 *  - `HARDCORE` não entra em clube nenhum: funda o seu e não pode sair até o levar à primeira divisão.
 */

export type GameMode = 'STANDARD' | 'PREMIUM' | 'HARDCORE';

export const GAME_MODES: GameMode[] = ['STANDARD', 'PREMIUM', 'HARDCORE'];

export interface GameModeInfo {
  mode: GameMode;
  label: string;
  tagline: string;
  description: string;
  icon: string;
}

export const GAME_MODE_INFO: Record<GameMode, GameModeInfo> = {
  STANDARD: {
    mode: 'STANDARD',
    label: 'Standard',
    tagline: 'Comece na segunda divisão, em qualquer país',
    description:
      'Você assume um clube de segunda divisão de qualquer liga do mundo e sobe pelo que fizer em campo. Clubes de primeira divisão não contratam você, mas o time que você levar lá sobe com você.',
    icon: '⚽',
  },
  PREMIUM: {
    mode: 'PREMIUM',
    label: 'Premium',
    tagline: 'Qualquer clube, qualquer divisão, qualquer país',
    description:
      'Sem porteiro: escolha o clube que quiser desde o primeiro dia, receba propostas de gigantes e jogue nas quatro velocidades de partida.',
    icon: '👑',
  },
  HARDCORE: {
    mode: 'HARDCORE',
    label: 'Iron Man',
    tagline: 'Funde um clube e leve-o à elite',
    description:
      'Você cria o seu clube e não pode largá-lo: para se libertar do contrato é preciso levá-lo à divisão mais alta e ganhar tudo o que houver para ganhar lá, título e copa. Em compensação, a diretoria nunca vai demitir você. O clube é seu.',
    icon: '🔨',
  },
};

/** A divisão mais alta que este modo deixa o técnico **assumir**. Nada impede de chegar lá jogando. */
export function highestDivisionOffered(mode: GameMode): number {
  return mode === 'PREMIUM' ? 1 : 2;
}

/**
 * Este modo permite assumir um clube já existente nesta divisão?
 *
 * O teto é sobre **escolher**, e nunca sobre conquistar. Subir com o clube que se pegou é o objetivo do modo
 * padrão, e barrar isso transformaria acesso e rebaixamento — que já existem e funcionam — em decoração para
 * quem não paga.
 */
export function canTakeOverDivision(mode: GameMode, division: number): boolean {
  if (mode === 'HARDCORE') return false;
  return division >= highestDivisionOffered(mode);
}

/** O modo obriga a fundar o próprio clube em vez de assumir um. */
export function mustFoundOwnClub(mode: GameMode): boolean {
  return mode === 'HARDCORE';
}

/**
 * O que o modo do zero exige antes de libertar o técnico.
 *
 * Não basta **chegar** à elite: o acesso promove os primeiros colocados, e um clube pode subir em segundo
 * lugar sem nunca ter ganhado nada. Chegar seria um objetivo que se cumpre sem vencer.
 *
 * Exige-se então ganhar. E ganhar **tudo o que o clube pode ganhar lá em cima**: o título da divisão mais
 * alta do país e todas as copas nacionais dele.
 *
 * Por que não exigir também o título de cada divisão do caminho: porque seria uma armadilha sem saída.
 * Quem sobe da segunda em segundo lugar nunca mais disputa a segunda — não há como voltar de propósito — e
 * o objetivo ficaria impossível por uma coisa que já aconteceu. Os títulos do caminho são mostrados como
 * conquista, e não cobrados como requisito.
 */
export interface HardcoreGoal {
  /** As competições que faltam ganhar, por nome, para a tela poder listar. */
  missing: string[];
  /** O que já foi ganho com este clube, para a tela poder mostrar o progresso. */
  won: string[];
  met: boolean;
}

export interface CompetitionToWin {
  id: string;
  name: string;
  /** Verdadeiro quando este técnico já a ganhou pelo menos uma vez. */
  won: boolean;
}

export function hardcoreGoal(competitions: CompetitionToWin[]): HardcoreGoal {
  const missing = competitions.filter((c) => !c.won).map((c) => c.name);
  const won = competitions.filter((c) => c.won).map((c) => c.name);

  /**
   * Sem competição nenhuma o objetivo não está cumprido.
   *
   * Uma lista vazia significa que o clube ainda não chegou à divisão mais alta, ou que o país não foi lido —
   * e nos dois casos libertar o técnico seria dar de graça o que o modo inteiro existe para cobrar.
   */
  return { missing, won, met: competitions.length > 0 && missing.length === 0 };
}

/**
 * O técnico pode largar o clube agora?
 *
 * No modo do zero, só depois de cumprir o objetivo. É a promessa inteira do modo, e é o que dá peso a cada
 * temporada na divisão de baixo. Nos outros, sempre — sair custa reputação, e o preço é o que já regula a
 * decisão.
 */
export function canResign(mode: GameMode, goalMet: boolean): boolean {
  if (mode !== 'HARDCORE') return true;
  return goalMet;
}

/**
 * O técnico que cumpriu o objetivo do modo do zero deixa de ter teto.
 *
 * Ele fundou um clube do nada e ganhou tudo o que havia para ganhar com ele. Prendê-lo depois disso às
 * regras de entrada do modo padrão seria castigar quem venceu o modo mais difícil do jogo.
 */
export function canTakeOverAfterGoal(mode: GameMode, goalMet: boolean, division: number): boolean {
  if (mode === 'HARDCORE' && goalMet) return true;
  return canTakeOverDivision(mode, division);
}

/**
 * A diretoria pode demitir este técnico?
 *
 * No modo do zero, não. O clube foi fundado por ele; não há dono para o mandar embora, e uma demissão
 * apagaria a única coisa que o modo pede. A pressão continua toda lá — o presidente ainda bate à porta, a
 * confiança ainda cai — mas ela é atmosfera, e não ameaça.
 */
export function canBeSacked(mode: GameMode): boolean {
  return mode !== 'HARDCORE';
}

/** Um clube desta divisão pode sondar um técnico neste modo? */
export function canBeApproachedBy(mode: GameMode, division: number): boolean {
  return canTakeOverDivision(mode, division);
}

export type MatchSpeedKey = 'slow' | 'normal' | 'fast' | 'superfast';

/**
 * As velocidades que este modo libera.
 *
 * As duas do meio são o jogo; as pontas são conveniência. "Muito rápido" resolve a temporada em metade do
 * tempo e "Lento" é para quem quer ver a partida acontecer — nenhuma das duas muda um resultado, que é
 * exatamente o critério para poderem ser vendidas sem o jogo virar pagar-para-vencer.
 */
export const FREE_MATCH_SPEEDS: MatchSpeedKey[] = ['normal', 'fast'];
export const ALL_MATCH_SPEEDS: MatchSpeedKey[] = ['slow', 'normal', 'fast', 'superfast'];

export function availableMatchSpeeds(mode: GameMode): MatchSpeedKey[] {
  return mode === 'PREMIUM' ? ALL_MATCH_SPEEDS : FREE_MATCH_SPEEDS;
}

export function canUseMatchSpeed(mode: GameMode, speed: MatchSpeedKey): boolean {
  return availableMatchSpeeds(mode).includes(speed);
}

/**
 * A frase que explica a recusa, para a tela nunca dizer apenas "não".
 *
 * Um bloqueio sem motivo lê-se como defeito. Com motivo, lê-se como regra do modo — e é a diferença entre o
 * jogador achar que o jogo quebrou e entender o que está a jogar.
 */
export function explainBlock(mode: GameMode, what: 'division' | 'resign' | 'speed'): string {
  if (what === 'division') {
    return mode === 'HARDCORE'
      ? 'No modo Iron Man você comanda o clube que fundou, e nenhum outro.'
      : 'Clubes de primeira divisão só assinam com técnicos do modo Premium.';
  }
  if (what === 'resign') {
    return 'Você fundou este clube e só pode deixá-lo depois de ganhar tudo o que há para ganhar com ele.';
  }
  return 'Esta velocidade de partida está disponível no modo Premium.';
}

import { MatchEvent, MatchResult, MatchSide } from './match.js';
import { MarkingStyle } from './tactic.js';
import { Player } from './player.js';

export interface MatchTimelineMarker {
  minute: number;
  stoppageMinute?: number;
  type: 'goal' | 'card_yellow' | 'card_red' | 'injury' | 'sub' | 'penalty_miss';
  team: 'home' | 'away';
  playerName: string;
  secondaryPlayerName?: string;
  description: string;
  xg?: number;
  scorelineAfter?: string;
}

export interface MomentumBlock {
  periodLabel: string;
  startMinute: number;
  endMinute: number;
  homeShare: number; // 0 to 100 percentage
  awayShare: number;
  dominantSide: 'home' | 'away' | 'balanced';
}

export interface NarrativeReplayItem {
  minuteStr: string;
  title: string;
  description: string;
  xg?: number;
  team: 'home' | 'away';
  type: string;
}

/**
 * Constrói os marcadores da linha do tempo visual da partida a partir dos eventos.
 */
export function buildMatchTimelineMarkers(events: MatchEvent[]): MatchTimelineMarker[] {
  let homeG = 0;
  let awayG = 0;

  return events.map((ev) => {
    if (ev.type === 'goal') {
      if (ev.team === 'home') homeG++;
      else awayG++;
    }

    let markerType: MatchTimelineMarker['type'] = 'goal';
    if (ev.type === 'goal') {
      const outcome = (ev as any).shotOutcome;
      markerType = outcome === 'off_target' || outcome === 'saved' || outcome === 'woodwork' || outcome === 'blocked' || (ev.isPenalty && outcome === 'saved') ? 'penalty_miss' : 'goal';
    } else if (ev.type === 'card') {
      markerType = ev.suspensionMatches ? 'card_red' : 'card_yellow';
    } else if (ev.type === 'injury') {
      markerType = 'injury';
    } else if (ev.type === 'substitution') {
      markerType = 'sub';
    }

    const scorelineAfter = ev.type === 'goal' ? `${homeG}x${awayG}` : undefined;

    return {
      minute: ev.minute,
      stoppageMinute: ev.stoppageMinute,
      type: markerType,
      team: ev.team,
      playerName: ev.description.split(' ')[0] || 'Jogador',
      secondaryPlayerName: ev.assistPlayerName,
      description: ev.description,
      xg: ev.xg,
      scorelineAfter,
    };
  });
}

/**
 * Calcula o Momentum e Pressão Tática por blocos de 15 minutos (0-15', 15-30', 30-45', 45-60', 60-75', 75-90'+).
 */
export function computeMomentumBlocks(events: MatchEvent[]): MomentumBlock[] {
  const intervals = [
    { label: '0-15’', start: 0, end: 15 },
    { label: '15-30’', start: 15, end: 30 },
    { label: '30-45’+', start: 30, end: 45 },
    { label: '45-60’', start: 45, end: 60 },
    { label: '60-75’', start: 60, end: 75 },
    { label: '75-90’+', start: 75, end: 120 },
  ];

  return intervals.map((interval) => {
    const blockEvents = events.filter((e) => e.minute >= interval.start && e.minute <= interval.end);
    let homeWeight = 1;
    let awayWeight = 1;

    for (const ev of blockEvents) {
      let w = 1;
      if (ev.type === 'goal') w = 6;
      else if (ev.type === 'chance') w = ev.xg && ev.xg >= 0.3 ? 3 : 2;
      else if (ev.type === 'card') w = -1;
      else if (ev.type === 'injury') w = -1;

      if (ev.team === 'home') homeWeight += w;
      else awayWeight += w;
    }

    const total = homeWeight + awayWeight;
    const homeShare = Math.round((homeWeight / total) * 100);
    const awayShare = 100 - homeShare;

    let dominantSide: 'home' | 'away' | 'balanced' = 'balanced';
    if (homeShare >= 58) dominantSide = 'home';
    else if (awayShare >= 58) dominantSide = 'away';

    return {
      periodLabel: interval.label,
      startMinute: interval.start,
      endMinute: interval.end,
      homeShare,
      awayShare,
      dominantSide,
    };
  });
}

/**
 * Detecta se o jogo está em momento de Clímax / Acréscimos de alta tensão (ex: jogo empatado em mata-mata ou diferença de 1 gol nos acréscimos).
 */
export function isStoppageTimeClimax(
  currentMinute: number,
  period: string | undefined,
  homeGoals: number,
  awayGoals: number,
  isKnockout: boolean,
): boolean {
  const isStoppage = (period === '1T' && currentMinute > 45) || (period === '2T' && currentMinute > 90) || currentMinute > 90 || (period !== '1T' && period !== '2T' && currentMinute > 45);
  if (!isStoppage) return false;

  const diff = Math.abs(homeGoals - awayGoals);
  if (diff === 0 && isKnockout) return true; // Empate em mata-mata vai para pênaltis / prorrogação
  if (diff <= 1) return true; // Diferença mínima nos acréscimos
  return false;
}

/**
 * Constrói o replay textual dos lances capitais pós-jogo (3 a 5 lances mais decisivos com xG e narrativa causal).
 */
export function buildMatchNarrativeReplay(result: MatchResult, homeName: string, awayName: string): NarrativeReplayItem[] {
  const significant = result.events.filter(
    (e) => e.type === 'goal' || (e.type === 'chance' && e.xg && e.xg >= 0.25) || e.type === 'injury' || (e.type === 'card' && e.suspensionMatches)
  );

  const sorted = significant.sort((a, b) => {
    const scoreA = a.type === 'goal' ? 3 : a.xg && a.xg >= 0.3 ? 2 : 1;
    const scoreB = b.type === 'goal' ? 3 : b.xg && b.xg >= 0.3 ? 2 : 1;
    return scoreB - scoreA;
  }).slice(0, 5).sort((a, b) => a.minute - b.minute);

  return sorted.map((ev) => {
    const teamName = ev.team === 'home' ? homeName : awayName;
    let title = 'Lance de Perigo';
    if (ev.type === 'goal') title = `GOL do ${teamName}!`;
    else if (ev.type === 'card' && ev.suspensionMatches) title = `Cartão Vermelho (${teamName})`;
    else if (ev.type === 'injury') title = `Lesão (${teamName})`;
    else if (ev.xg && ev.xg >= 0.3) title = `Grande Chance Perdida (${teamName})`;

    const minuteStr = ev.stoppageMinute ? `${ev.minute}+${ev.stoppageMinute}'` : `${ev.minute}'`;

    return {
      minuteStr,
      title,
      description: ev.description,
      xg: ev.xg,
      team: ev.team,
      type: ev.type,
    };
  });
}


export type MomentumZone = 'CONTROLE' | 'PRESSAO' | 'DOMINIO' | 'AVALANCHE';
export type MomentumSkillId = 'PRESSIONAR' | 'JANELA_DE_OURO' | 'AVALANCHE_TOTAL' | 'SEGURAR_JOGO';

export interface MomentumSkillStatus {
  id: MomentumSkillId;
  label: string;
  minZone: number;
  cost: number;
  unlocked: boolean;
  active: boolean;
  description: string;
}

export interface LiveMomentumResourceInput {
  events: MatchEvent[];
  currentMinute: number;
  mySide: MatchSide;
  myPossession?: number;
  myShots?: number;
  opponentShots?: number;
  myCorners?: number;
  opponentCorners?: number;
  tacticalBoostCount?: number;
  spentMomentum?: number;
  lastSpendMinute?: number | null;
}

export interface LiveMomentumResourceState {
  rawMomentum: number;
  effectiveMomentum: number;
  homeMomentum: number;
  zone: MomentumZone;
  opponentDominates: boolean;
  remainingDebt: number;
}

/**
 * Calcula o Momentum como recurso dinâmico da partida (0 a 100 na perspectiva do clube comandado),
 * considerando eventos recentes, posse, escanteios, substituições, ajustes táticos e o gasto recente de barra.
 */
export function computeLiveMomentumResource(input: LiveMomentumResourceInput): LiveMomentumResourceState {
  const {
    events,
    currentMinute,
    mySide,
    myPossession = 50,
    myShots = 0,
    opponentShots = 0,
    myCorners = 0,
    opponentCorners = 0,
    tacticalBoostCount = 0,
    spentMomentum = 0,
    lastSpendMinute = null,
  } = input;

  const windowMinutes = 12;
  const from = Math.max(0, currentMinute - windowMinutes);
  const recent = events.filter((e) => e.minute >= from && e.minute <= currentMinute);

  let myScore = 4 + Math.max(0, (myPossession - 45) * 0.12) + Math.min(4, myShots * 0.35 + myCorners * 0.45);
  let oppScore = 4 + Math.max(0, (55 - myPossession) * 0.12) + Math.min(4, opponentShots * 0.35 + opponentCorners * 0.45);

  for (const ev of recent) {
    let weight = 1.4;
    if (ev.type === 'goal') weight = 6.5;
    else if (ev.type === 'chance') weight = ev.xg && ev.xg >= 0.25 ? 3.2 : 2.1;
    else if (ev.type === 'substitution') weight = 1.8;
    else if (ev.type === 'card') weight = ev.suspensionMatches ? -4.5 : -1.5;
    else if (ev.type === 'injury') weight = -1.2;

    if (ev.team === mySide) {
      myScore += weight;
    } else {
      oppScore += weight;
    }
  }

  myScore += Math.min(3, tacticalBoostCount) * 1.1;

  const safeMy = Math.max(1, myScore);
  const safeOpp = Math.max(1, oppScore);
  const rawMomentum = Math.max(8, Math.min(96, Math.round((safeMy / (safeMy + safeOpp)) * 100)));

  const minutesSinceSpend = lastSpendMinute !== null ? Math.max(0, currentMinute - lastSpendMinute) : 0;
  const recovered = minutesSinceSpend * 3;
  const remainingDebt = Math.max(0, spentMomentum - recovered);

  const effectiveMomentum = Math.max(5, Math.min(98, rawMomentum - remainingDebt));
  const homeMomentum = mySide === 'home' ? effectiveMomentum : 100 - effectiveMomentum;

  let zone: MomentumZone = 'CONTROLE';
  if (effectiveMomentum >= 85) zone = 'AVALANCHE';
  else if (effectiveMomentum >= 60) zone = 'DOMINIO';
  else if (effectiveMomentum >= 30) zone = 'PRESSAO';

  return {
    rawMomentum,
    effectiveMomentum,
    homeMomentum,
    zone,
    opponentDominates: effectiveMomentum <= 38,
    remainingDebt,
  };
}

/**
 * Retorna o estado e disponibilidade dos 4 gatilhos táticos de Momentum.
 */
export function getMomentumSkillStatuses(
  effectiveMomentum: number,
  activeSkillId: MomentumSkillId | null,
): MomentumSkillStatus[] {
  const opponentDominates = effectiveMomentum <= 38;

  return [
    {
      id: 'PRESSIONAR',
      label: 'Pressão Alta',
      minZone: 30,
      cost: 0,
      unlocked: effectiveMomentum >= 30,
      active: activeSkillId === 'PRESSIONAR',
      description: 'Zona 30+ · Sem custo de barra · Sobe linhas de marcação e acelera retomada no meio.',
    },
    {
      id: 'JANELA_DE_OURO',
      label: 'Janela de Ouro',
      minZone: 60,
      cost: 40,
      unlocked: effectiveMomentum >= 60,
      active: activeSkillId === 'JANELA_DE_OURO',
      description: 'Zona 60+ · Custo 40 · Abre janela de ataque total por 8 min com pressão máxima no terço final.',
    },
    {
      id: 'AVALANCHE_TOTAL',
      label: 'Avalanche',
      minZone: 85,
      cost: 55,
      unlocked: effectiveMomentum >= 85,
      active: activeSkillId === 'AVALANCHE_TOTAL',
      description: 'Zona 85+ · Custo 55 · Blitz ofensiva total por 6 min. Maior chance de gol, mas expõe a defesa.',
    },
    {
      id: 'SEGURAR_JOGO',
      label: 'Segurar / Contra-Ataque',
      minZone: 0,
      cost: 0,
      unlocked: opponentDominates,
      active: activeSkillId === 'SEGURAR_JOGO',
      description: 'Liberado sob domínio rival (≤ 38%) · Fecha o bloco baixo e dispara transições rápidas.',
    },
  ];
}

export type AssistantSubReasonCode =
  | 'YELLOW_AND_TIRED'
  | 'YELLOW_HEAVY_MARKING'
  | 'CRITICAL_FATIGUE'
  | 'LOW_RATING';

export interface AssistantSubSuggestion {
  outPlayerId: string;
  outPlayerName: string;
  outPlayerPosition: Player['position'];
  inPlayerId: string;
  inPlayerName: string;
  inPlayerOverall: number;
  reasonCode: AssistantSubReasonCode;
  reasonLabel: string;
  urgency: 'CRITICAL' | 'WARNING';
}

/**
 * Avalia os titulares em campo e o banco disponível para sugerir substituições cirúrgicas
 * baseadas em risco de expulsão (amarelado + cansado / marcação pesada), fadiga crítica (< 55%) ou nota baixa.
 */
export function computeAssistantSubSuggestions(params: {
  starters: Player[];
  bench: Player[];
  staminaByPlayerId: ReadonlyMap<string, number>;
  ratingByPlayerId: ReadonlyMap<string, number>;
  bookedPlayerIds: ReadonlySet<string>;
  vacatedPlayerIds: ReadonlySet<string>;
  markingStyle?: MarkingStyle;
  currentMinute: number;
}): AssistantSubSuggestion[] {
  const {
    starters,
    bench,
    staminaByPlayerId,
    ratingByPlayerId,
    bookedPlayerIds,
    vacatedPlayerIds,
    markingStyle = 'BALANCED',
    currentMinute,
  } = params;

  if (bench.length === 0) return [];

  const isHeavyMarking = markingStyle === 'HEAVY' || markingStyle === 'MAN_MARKING';
  const suggestions: (AssistantSubSuggestion & { priorityScore: number })[] = [];

  const pickBestBenchFor = (starter: Player, usedBenchIds: Set<string>): Player | null => {
    const available = bench.filter((b) => !usedBenchIds.has(b.id));
    if (available.length === 0) return null;
    const samePos = available.filter((b) => b.position === starter.position);
    const pool = samePos.length > 0 ? samePos : available.filter((b) => (starter.position === 'GK' ? b.position === 'GK' : b.position !== 'GK'));
    if (pool.length === 0) return null;
    pool.sort((a, b) => b.overall - a.overall || (a.fatigue ?? 0) - (b.fatigue ?? 0));
    return pool[0];
  };

  const usedBenchIds = new Set<string>();

  for (const starter of starters) {
    if (vacatedPlayerIds.has(starter.id)) continue;
    const stamina = Math.round(staminaByPlayerId.get(starter.id) ?? 80);
    const rating = ratingByPlayerId.get(starter.id) ?? 6.2;
    const isBooked = bookedPlayerIds.has(starter.id);

    let reasonCode: AssistantSubReasonCode | null = null;
    let reasonLabel = '';
    let urgency: 'CRITICAL' | 'WARNING' = 'WARNING';
    let priorityScore = 0;

    if (isBooked && stamina < 68) {
      reasonCode = 'YELLOW_AND_TIRED';
      reasonLabel = `Amarelado e com ${stamina}% de fôlego (risco de 2º amarelo)`;
      urgency = 'CRITICAL';
      priorityScore = 100 + (68 - stamina);
    } else if (isBooked && isHeavyMarking) {
      reasonCode = 'YELLOW_HEAVY_MARKING';
      reasonLabel = 'Amarelado em marcação pesada (risco de expulsão)';
      urgency = 'CRITICAL';
      priorityScore = 92;
    } else if (stamina < 55) {
      reasonCode = 'CRITICAL_FATIGUE';
      reasonLabel = `Desgaste físico elevado (${stamina}% de fôlego)`;
      urgency = stamina < 42 ? 'CRITICAL' : 'WARNING';
      priorityScore = 80 + (55 - stamina);
    } else if (currentMinute >= 55 && rating < 5.7 && starter.position !== 'GK') {
      reasonCode = 'LOW_RATING';
      reasonLabel = `Rendimento abaixo da média (nota ${rating.toFixed(1)})`;
      urgency = 'WARNING';
      priorityScore = 50 + Math.round((6.0 - rating) * 10);
    }

    if (reasonCode) {
      const candidate = pickBestBenchFor(starter, usedBenchIds);
      if (candidate) {
        usedBenchIds.add(candidate.id);
        suggestions.push({
          outPlayerId: starter.id,
          outPlayerName: starter.name,
          outPlayerPosition: starter.position,
          inPlayerId: candidate.id,
          inPlayerName: candidate.name,
          inPlayerOverall: candidate.overall,
          reasonCode,
          reasonLabel,
          urgency,
          priorityScore,
        });
      }
    }
  }

  return suggestions
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map(({ priorityScore: _p, ...rest }) => rest);
}


export type HalftimeTalkToneId = 'COBRAR' | 'APOIAR' | 'CALAR';

export interface HalftimeToneChoice {
  id: HalftimeTalkToneId;
  talkId: string;
  label: string;
  subtitle: string;
  moraleEffectLabel: string;
  recommended: boolean;
}

export interface HalftimeAssistantBriefing {
  headline: string;
  tacticalNote: string;
  choices: HalftimeToneChoice[];
}

/**
 * Gera o relatório executivo de intervalo do Auxiliar Técnico e as 3 opções diretas de conversa
 * de vestiário (Cobrar, Apoiar, Calar/Focar Tática) que afetam a moral para o 2º tempo.
 */
export function buildHalftimeAssistantBriefing(params: {
  myGoals: number;
  oppGoals: number;
  myShots: number;
  oppShots: number;
  myXg?: number;
  oppXg?: number;
  myPossession?: number;
  bookedCount?: number;
  exhaustedCount?: number;
}): HalftimeAssistantBriefing {
  const {
    myGoals,
    oppGoals,
    myShots,
    oppShots,
    myXg = myShots * 0.12,
    oppXg = oppShots * 0.12,
    myPossession = 50,
    bookedCount = 0,
    exhaustedCount = 0,
  } = params;

  const diff = myGoals - oppGoals;

  let headline = '';
  if (diff > 0) {
    headline =
      myXg >= oppXg
        ? `Vantagem merecida no 1º tempo (${myGoals} x ${oppGoals}) com controle territorial (${myPossession}% de posse).`
        : `Fomos cirúrgicos para abrir ${myGoals} x ${oppGoals}, mas o rival criou volume (${oppXg.toFixed(2)} xG).`;
  } else if (diff < 0) {
    headline =
      myXg > oppXg
        ? `Saímos atrás (${myGoals} x ${oppGoals}) apesar de criarmos boas chances (${myXg.toFixed(2)} xG em ${myShots} finalizações).`
        : `Primeiro tempo abaixo do esperado (${myGoals} x ${oppGoals}): o adversário venceu as divididas e finalizou ${oppShots} vezes.`;
  } else {
    headline =
      myShots > oppShots + 2
        ? `Empate em ${myGoals} x ${oppGoals} com superioridade nossa (${myShots} a ${oppShots} nas finalizações). Falta calibrar o último passe.`
        : `Equilíbrio tenso no 1º tempo (${myGoals} x ${oppGoals}). Quem ajustar melhor a transição leva o jogo na etapa final.`;
  }

  const alerts: string[] = [];
  if (bookedCount >= 2) {
    alerts.push(`${bookedCount} titulares pendurados com amarelo exigem cautela na marcação`);
  } else if (bookedCount === 1) {
    alerts.push('1 titular advertido com amarelo');
  }
  if (exhaustedCount >= 1) {
    alerts.push(`${exhaustedCount} atleta(s) já apresentam desgaste acentuado para a volta do intervalo`);
  }
  if (alerts.length === 0) {
    alerts.push(
      diff > 0
        ? 'Elenco fisicamente inteiro para sustentar as linhas no 2º tempo'
        : 'Grupo tem perna para subir as linhas de pressão nos primeiros 15 minutos',
    );
  }

  const tacticalNote = `${alerts.join(' · ')}.`;

  // Map each of the 3 tones to the corresponding TeamTalk ID recognized by lockerRoom.ts
  const cobrancaTalkId = diff > 0 ? 'HT_WIN_DEMANDING' : diff === 0 ? 'HT_DRAW_DEMANDING' : 'HT_LOSS_DEMANDING';
  const apoiarTalkId = diff > 0 ? 'HT_WIN_PASSIONATE' : diff === 0 ? 'HT_DRAW_ENCOURAGING' : 'HT_LOSS_ENCOURAGING';
  const calarTalkId = diff > 0 ? 'HT_WIN_CALM' : diff === 0 ? 'HT_DRAW_CALM' : 'HT_LOSS_CALM';

  const recommendedTone: HalftimeTalkToneId =
    diff < 0 && myXg < oppXg ? 'COBRAR' : diff < 0 ? 'APOIAR' : diff === 0 ? 'COBRAR' : 'CALAR';

  const choices: HalftimeToneChoice[] = [
    {
      id: 'COBRAR',
      talkId: cobrancaTalkId,
      label: 'Cobrar Postura',
      subtitle: 'Exige intensidade máxima nas divididas e foco no resultado.',
      moraleEffectLabel: 'Moral Competitiva +6',
      recommended: recommendedTone === 'COBRAR',
    },
    {
      id: 'APOIAR',
      talkId: apoiarTalkId,
      label: 'Apoiar o Grupo',
      subtitle: 'Transmite confiança aos atletas para buscarem o gol sem afobação.',
      moraleEffectLabel: 'Moral Coletiva +8',
      recommended: recommendedTone === 'APOIAR',
    },
    {
      id: 'CALAR',
      talkId: calarTalkId,
      label: 'Foco Silencioso',
      subtitle: 'Mantém o vestiário sereno e focado apenas no ajuste posicional.',
      moraleEffectLabel: 'Equilíbrio & Foco +5',
      recommended: recommendedTone === 'CALAR',
    },
  ];

  return {
    headline,
    tacticalNote,
    choices,
  };
}

export interface QuickPressOption {
  id: string;
  label: string;
  quote: string;
  moraleDelta: number;
  boardDelta: number;
}

export interface QuickPressQuestion {
  id: string;
  outlet: string;
  question: string;
  options: QuickPressOption[];
}

/**
 * Gera 2 perguntas rápidas para a Coletiva Pós-Jogo integrada ao Cockpit ("Após o Apito"),
 * com efeitos diretos na Moral do Elenco e na Confiança da Diretoria.
 */
export function buildQuickPostMatchPressQuestions(params: {
  myClubName: string;
  oppClubName: string;
  myGoals: number;
  oppGoals: number;
  myShots: number;
  oppShots: number;
  myPressRecoveries?: number;
  hadSubGoal?: boolean;
}): QuickPressQuestion[] {
  const {
    myClubName,
    oppClubName,
    myGoals,
    oppGoals,
    myShots,
    oppShots,
    myPressRecoveries = 0,
    hadSubGoal = false,
  } = params;

  const diff = myGoals - oppGoals;
  const questions: QuickPressQuestion[] = [];

  if (diff > 0) {
    questions.push({
      id: 'qp_result_win',
      outlet: 'Sala de Imprensa',
      question: `Vitória por ${myGoals} x ${oppGoals} sobre o ${oppClubName}. Qual foi o fator determinante para o triunfo do ${myClubName} hoje?`,
      options: [
        {
          id: 'win_praise_squad',
          label: 'Exaltar Entrega do Elenco',
          quote: 'Os atletas cumpriram cada detalhe e merecem todos os aplausos pela entrega.',
          moraleDelta: 6,
          boardDelta: 4,
        },
        {
          id: 'win_praise_tactic',
          label: 'Destacar Leitura Tática',
          quote: 'Controlamos os espaços e soubemos acelerar no momento certo para definir o placar.',
          moraleDelta: 3,
          boardDelta: 7,
        },
        {
          id: 'win_keep_feet',
          label: 'Manter Pés no Chão',
          quote: 'Somamos pontos importantes, mas ainda temos ajustes a fazer para a sequência.',
          moraleDelta: 2,
          boardDelta: 5,
        },
      ],
    });
  } else if (diff < 0) {
    questions.push({
      id: 'qp_result_loss',
      outlet: 'Sala de Imprensa',
      question: `Revés por ${myGoals} x ${oppGoals} diante do ${oppClubName}. Como você avalia o impacto desse resultado para o ${myClubName}?`,
      options: [
        {
          id: 'loss_shield',
          label: 'Blindar os Jogadores',
          quote: 'A responsabilidade pela estratégia é minha. O grupo lutou e vai dar a resposta.',
          moraleDelta: 5,
          boardDelta: 2,
        },
        {
          id: 'loss_demand',
          label: 'Cobrar Reação Imediata',
          quote: 'Cometemos erros que não podem se repetir. Exijo outra postura na próxima rodada.',
          moraleDelta: -3,
          boardDelta: 5,
        },
        {
          id: 'loss_analyze',
          label: 'Focar na Correção Tática',
          quote: 'Criamos situações, mas faltou compactação. Vamos corrigir o posicionamento na semana.',
          moraleDelta: 2,
          boardDelta: 4,
        },
      ],
    });
  } else {
    questions.push({
      id: 'qp_result_draw',
      outlet: 'Sala de Imprensa',
      question: `Empate em ${myGoals} x ${oppGoals} contra o ${oppClubName} (${myShots} a ${oppShots} em finalizações). O ponto somado satisfaz?`,
      options: [
        {
          id: 'draw_valorize',
          label: 'Valorizar a Competitividade',
          quote: 'O elenco manteve a organização até o fim num confronto muito fechado.',
          moraleDelta: 4,
          boardDelta: 3,
        },
        {
          id: 'draw_ambition',
          label: 'Cobrar Mais Pontaria',
          quote: 'Pelo volume que tivemos, deixamos dois pontos em campo. Precisamos ser mais letais.',
          moraleDelta: -1,
          boardDelta: 5,
        },
        {
          id: 'draw_balanced',
          label: 'Análise Equilibrada',
          quote: 'Resultado justo pelo que as duas equipes produziram nos 90 minutos.',
          moraleDelta: 2,
          boardDelta: 3,
        },
      ],
    });
  }

  // Second question: tactical / pressing / bench impact
  if (hadSubGoal) {
    questions.push({
      id: 'qp_bench_impact',
      outlet: 'Bancada Tática',
      question: 'As alterações vindas do banco mudaram o ritmo da partida. Como avalia a força do grupo?',
      options: [
        {
          id: 'sub_merit',
          label: 'Mérito do Grupo',
          quote: 'Quem entra sabe exatamente sua função. Isso mostra a força do nosso elenco.',
          moraleDelta: 5,
          boardDelta: 4,
        },
        {
          id: 'sub_reading',
          label: 'Leitura da Comissão',
          quote: 'Exploramos o cansaço da defesa adversária no setor exato que planejamos.',
          moraleDelta: 2,
          boardDelta: 6,
        },
      ],
    });
  } else {
    questions.push({
      id: 'qp_tactical_posture',
      outlet: 'Bancada Tática',
      question:
        myPressRecoveries >= 4
          ? `A equipe registrou ${myPressRecoveries} recuperações no campo ofensivo. Essa intensidade será o padrão?`
          : 'Qual o principal foco de ajuste para o próximo compromisso da temporada?',
      options: [
        {
          id: 'tac_intensity',
          label: 'Manter DNA Agressivo',
          quote: 'Nossa identidade passa por controlar o ritmo e recuperar a bola o mais rápido possível.',
          moraleDelta: 3,
          boardDelta: 5,
        },
        {
          id: 'tac_recovery',
          label: 'Priorizar Recuperação Física',
          quote: 'O calendário exige inteligência. Vamos recuperar o fôlego do grupo para manter a regularidade.',
          moraleDelta: 4,
          boardDelta: 4,
        },
      ],
    });
  }

  return questions;
}

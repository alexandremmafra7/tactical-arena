import { MatchEvent, MatchResult } from './match.js';

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

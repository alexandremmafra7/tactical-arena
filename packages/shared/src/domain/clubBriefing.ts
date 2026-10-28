import { Club } from './club.js';
import { MAX_SPONSORSHIPS } from './finance.js';
import { Player } from './player.js';
import type { StaffRole } from './staff.js';

/**
 * The "what should I actually do right now" layer of the club dashboard.
 *
 * The home screen was a wall of things to *read*: three identical injury headlines stacked in a feed, a
 * balance, a table row. Nothing told a manager what needed their attention, so the only way to find a
 * problem was to go looking for it screen by screen. Everything here turns state the game already tracks
 * into a short list of things worth acting on — pure functions, so the same reasoning can be reused by any
 * screen (or tested) without dragging the UI along.
 */

/** One result from the club's point of view: vitória, empate, derrota. */
export type FormResult = 'V' | 'E' | 'D';

export type AlertSeverity = 'urgent' | 'warning' | 'info';

export interface ClubAlert {
  severity: AlertSeverity;
  /** Short enough to sit in a single banner line. */
  message: string;
  /** Where acting on it takes you — a path suffix under /clubs/:id, or an absolute path. */
  actionPath: string;
  actionLabel: string;
}

/** Everything the briefing needs that doesn't live on the Club itself. */
export interface BriefingContext {
  /** Transfer proposals other clubs have sent for this club's players. */
  incomingProposals: number;
  /** True once the manager has a standing lineup (pendingRoundTactic or a default preset). */
  hasLineup: boolean;
  /** Net cash per week: income minus outgoings. Negative means the club is burning money. */
  weeklyNet: number;
}

/** Where a club with nobody watching its players' legs notices somebody is spent. */
const TIRED_FATIGUE = 70;
/** Below this many weeks of runway, the budget is worth flagging before it becomes a crisis. */
const LOW_RUNWAY_WEEKS = 6;

export function injuredPlayers(players: Player[]): Player[] {
  return players.filter((p) => p.injuryWeeks > 0);
}

export function suspendedPlayers(players: Player[]): Player[] {
  return players.filter((p) => p.suspensions.length > 0);
}

/**
 * Who is spent, in the eyes of whoever is watching.
 *
 * A club with no fitness coach still notices a player who can barely stand; what it does not have is anybody
 * spotting the one who will be gone by the seventieth minute. So the threshold moves with the coach: an elite
 * one raises a hand around 60 fatigue, nobody at all waits until 70. It is the same principle the tactical
 * assistant's report runs on, applied to the person whose job this actually is.
 */
export function tiredPlayers(players: Player[], coachRating?: number): Player[] {
  const threshold = coachRating === undefined ? TIRED_FATIGUE : Math.max(55, Math.round(TIRED_FATIGUE - (coachRating - 50) * 0.2));
  return players.filter((p) => p.fatigue >= threshold).sort((a, b) => b.fatigue - a.fatigue);
}

/**
 * How many weeks the current balance survives at the current burn rate. `Infinity` when the club is
 * breaking even or profitable — there's nothing to count down to.
 */
export function budgetRunwayWeeks(budget: number, weeklyNet: number): number {
  if (weeklyNet >= 0) return Infinity;
  return Math.floor(budget / -weeklyNet);
}

/**
 * Everything demanding attention, most urgent first. The dashboard banner shows the head of this list;
 * the rest can be surfaced wherever there's room.
 */
export function clubAlerts(club: Club, context: BriefingContext): ClubAlert[] {
  const alerts: ClubAlert[] = [];

  if (!context.hasLineup) {
    alerts.push({
      severity: 'urgent',
      message: 'Nenhuma escalação definida',
      actionPath: 'tactics',
      actionLabel: 'Escalar time',
    });
  }

  const injured = injuredPlayers(club.players);
  if (injured.length > 0) {
    alerts.push({
      severity: 'urgent',
      message: injured.length === 1 ? `${injured[0].name} está lesionado` : `${injured.length} jogadores lesionados`,
      actionPath: 'squad',
      actionLabel: 'Ver elenco',
    });
  }

  /**
   * Vaga de patrocínio vazia é dinheiro parado, e ninguém ia lá ver.
   *
   * O quadro de patrocínios é a única receita que o técnico negocia, e vivia dois níveis fundo: Finanças, e
   * depois a aba. O aviso usa só o que esta tela já tem em mãos, sem buscar proposta nenhuma: um contrato a
   * menos que o teto é uma vaga que podia estar pagando toda semana.
   */
  const vagas = MAX_SPONSORSHIPS - (club.sponsorships?.length ?? 0);
  if (vagas > 0) {
    alerts.push({
      severity: 'info',
      message: vagas === 1 ? 'Uma vaga de patrocínio em aberto' : `${vagas} vagas de patrocínio em aberto`,
      // Direto ao quadro, não ao menu: o aviso já disse do que se trata.
      actionPath: 'sponsors',
      actionLabel: 'Ver propostas',
    });
  }

  const suspended = suspendedPlayers(club.players);
  if (suspended.length > 0) {
    alerts.push({
      severity: 'warning',
      message: suspended.length === 1 ? `${suspended[0].name} está suspenso` : `${suspended.length} jogadores suspensos`,
      actionPath: 'squad',
      actionLabel: 'Ver elenco',
    });
  }

  if (context.incomingProposals > 0) {
    alerts.push({
      severity: 'warning',
      message:
        context.incomingProposals === 1 ? '1 proposta recebida por um jogador seu' : `${context.incomingProposals} propostas recebidas`,
      // A tela solta de propostas foi removida: o assunto vive numa aba do hub de Negociações.
      actionPath: 'transfers?tab=proposals',
      actionLabel: 'Ver propostas',
    });
  }

  const runway = budgetRunwayWeeks(club.budget, context.weeklyNet);
  if (runway < LOW_RUNWAY_WEEKS) {
    alerts.push({
      severity: runway <= 2 ? 'urgent' : 'warning',
      message: `Saldo cobre só ${runway} semana(s) de custos`,
      actionPath: 'financial',
      actionLabel: 'Ver financeiro',
    });
  }

  return alerts;
}

export interface Advice {
  severity: AlertSeverity;
  message: string;
  /** Whose job this observation is. Every line here belongs to somebody on the comissão. */
  role?: StaffRole;
  /** The name of the person saying it, when the club employs one. Null when the post is vacant. */
  staffName?: string | null;
}

/**
 * Softer than `clubAlerts`: observations a decent assistant would volunteer, rather than problems demanding
 * a click. Kept separate so the banner never fills up with "your squad is fine" chatter.
 *
 * Every line here is somebody's job, and it used to be nobody's: the advice arrived unsigned, as though the
 * game itself were talking, while the five people the club pays for lived on a screen of their own applying
 * multipliers no manager ever saw. So each observation now carries the name of whoever is responsible for it,
 * and what they notice depends on how good they are: a strong fitness coach flags a tiring player ten points
 * of fatigue before an empty dugout would.
 *
 * Nothing disappears when a post is vacant. A club with nobody watching still sees the obvious, it just sees
 * it later and with no name attached, which is exactly what the empty chair costs.
 */
export function clubAdvice(club: Club, context: BriefingContext): Advice[] {
  const advice: Advice[] = [];
  const staffOf = (role: StaffRole) => club.staff?.find((s) => s.role === role) ?? null;

  const coach = staffOf('FITNESS_COACH');
  const tired = tiredPlayers(club.players, coach?.rating);
  if (tired.length > 0) {
    const worst = tired[0];
    advice.push({
      severity: tired.length >= 4 ? 'warning' : 'info',
      role: 'FITNESS_COACH',
      staffName: coach?.name ?? null,
      message:
        tired.length === 1
          ? `${worst.name} está cansado (${Math.round(100 - worst.fatigue)}% de energia), considere rodízio`
          : `${tired.length} titulares cansados, o mais desgastado é ${worst.name} (${Math.round(100 - worst.fatigue)}% de energia)`,
    });
  }

  const director = staffOf('FINANCIAL_DIRECTOR');
  const runway = budgetRunwayWeeks(club.budget, context.weeklyNet);
  if (runway === Infinity) {
    advice.push({ severity: 'info', role: 'FINANCIAL_DIRECTOR', staffName: director?.name ?? null, message: 'As contas fecham no positivo a cada semana.' });
  } else if (runway >= LOW_RUNWAY_WEEKS) {
    advice.push({
      severity: 'info',
      role: 'FINANCIAL_DIRECTOR',
      staffName: director?.name ?? null,
      message: `Seu saldo cobre cerca de ${runway} semanas de custos.`,
    });
  }

  /**
   * A sponsorship running out is the one thing on this list that is invisible until it is too late: the
   * money simply stops arriving one week. Only a financial director watches the calendar for it.
   */
  if (director) {
    const expiring = club.sponsorships.filter((s) => s.weeksRemaining <= 8).sort((a, b) => a.weeksRemaining - b.weeksRemaining)[0];
    if (expiring) {
      advice.push({
        severity: 'warning',
        role: 'FINANCIAL_DIRECTOR',
        staffName: director.name,
        message: `O contrato com ${expiring.sponsorName} acaba em ${expiring.weeksRemaining} semanas, convém buscar substituto`,
      });
    }
  }

  const fit = club.players.filter((p) => p.injuryWeeks === 0 && p.suspensions.length === 0);
  if (fit.length < 14) {
    advice.push({
      severity: 'warning',
      role: 'FOOTBALL_DIRECTOR',
      staffName: staffOf('FOOTBALL_DIRECTOR')?.name ?? null,
      message: `Só ${fit.length} jogadores disponíveis, o elenco está curto.`,
    });
  }

  if (club.captainPlayerId === null) {
    advice.push({
      severity: 'info',
      role: 'TACTICAL_ASSISTANT',
      staffName: staffOf('TACTICAL_ASSISTANT')?.name ?? null,
      message: 'Nenhum capitão definido, a braçadeira dá bônus ao time.',
    });
  }

  return advice;
}

export interface SeasonObjective {
  /** Best league position the board will accept, 1-based. */
  targetPosition: number;
  label: string;
  /** 0..1 — how close the club currently is to meeting it. */
  progress: number;
  met: boolean;
  onTrack: boolean;
}

/**
 * What the board expects this season, sized to the club rather than fixed for everyone.
 *
 * There was no objective anywhere in the game, so a season had no shape beyond the table itself: finishing
 * 9th felt identical whether you were the richest club in the division or a promoted minnow. The target is
 * derived from squad strength relative to the rest of the league, which is the same thing a real board
 * would judge on and needs no extra data to maintain.
 */
export function seasonObjective(
  squadRank: number,
  totalClubs: number,
  currentPosition: number | null,
  playedRounds: number = 0,
  totalRounds: number = 0,
): SeasonObjective {
  const share = totalClubs > 1 ? (squadRank - 1) / (totalClubs - 1) : 0;

  let targetPosition: number;
  let label: string;
  if (share <= 0.2) {
    targetPosition = 1;
    label = 'Ganhar o campeonato';
  } else if (share <= 0.45) {
    targetPosition = Math.max(2, Math.ceil(totalClubs * 0.2));
    label = `Terminar entre os ${Math.max(2, Math.ceil(totalClubs * 0.2))} primeiros`;
  } else if (share <= 0.75) {
    targetPosition = Math.ceil(totalClubs * 0.5);
    label = 'Terminar na metade de cima';
  } else {
    targetPosition = Math.max(1, totalClubs - Math.max(2, Math.floor(totalClubs * 0.2)));
    label = 'Escapar do rebaixamento';
  }

  const isFinal = totalRounds > 0 && playedRounds >= totalRounds;
  const onTrack = currentPosition !== null && currentPosition <= targetPosition;
  /**
   * Cumprida só quando a temporada acabou e o clube chegou onde a diretoria pediu.
   *
   * Isto era `isFinal ? onTrack : onTrack`, cujos dois ramos são a mesma coisa, então `met` valia `onTrack`
   * e a tela anunciava "✓ Concluído" na primeira rodada, com o clube em 1º numa tabela de zeros. As duas
   * etiquetas ao lado já diziam a intenção: "● No caminho" durante o campeonato, "Concluído" no fim dele.
   * Enquanto `met` era `onTrack`, o ramo do "No caminho" era código morto que nunca chegava a desenhar.
   *
   * Quem chama sem dizer quantas rodadas a temporada tem não tem relógio para consultar, e aí "cumprida"
   * só pode querer dizer "está no lugar pedido" — a mesma divisão que o `progress` logo abaixo já faz.
   */
  const met = totalRounds > 0 ? isFinal && onTrack : onTrack;

  let progress = 0;
  if (currentPosition === null) {
    progress = 0;
  } else if (totalRounds > 0 && playedRounds > 0) {
    const positionEfficiency = onTrack
      ? 1
      : Math.max(0, (totalClubs - currentPosition) / Math.max(1, totalClubs - targetPosition));
    const roundFraction = Math.max(0, Math.min(1, playedRounds / totalRounds));
    // As the season unfolds, progress builds up gradually towards 100%
    progress = Math.min(1, Math.max(0, roundFraction * positionEfficiency));
  } else if (totalRounds > 0 && playedRounds === 0) {
    // Start of season: 0% progress
    progress = 0;
  } else {
    // Fallback when totalRounds is omitted
    progress = onTrack
      ? 1
      : Math.max(0, (totalClubs - currentPosition) / Math.max(1, totalClubs - targetPosition));
  }

  return { targetPosition, label, progress, met, onTrack };
}

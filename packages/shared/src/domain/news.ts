export type NewsCategory =
  | 'MATCH_RESULT'
  | 'GOAL_STREAK'
  | 'INJURY'
  | 'SUSPENSION'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'TITLE'
  | 'PROMOTION'
  | 'RELEGATION'
  /** Troca de comando: demissão, contratação, técnico que deixa o clube. */
  | 'MANAGER'
  /** Gestão e renovação de contratos. */
  | 'CONTRACT'
  /** Convocação e atuações de Seleções Nacionais (Data FIFA). */
  | 'NATIONAL_TEAM';

export interface NewsItem {
  id: string;
  clubId: string;
  category: NewsCategory;
  headline: string;
  createdAt: string;
}

/**
 * Template-based headline generators — deliberately not free-text generation, just real match/transfer/
 * title data slotted into a fixed sentence per category. Club names go without an article ("vence
 * Palmeiras", not "vence o/a Palmeiras") since there's no reliable way to know a club name's grammatical
 * gender from the string alone, and the article-free form still reads as a natural scoreboard headline.
 * No "&" and no em/en dash in any of these, per the house style rule (see FEEDBACK on UI copy).
 */

export function matchResultHeadline(clubName: string, opponentName: string, myGoals: number, oppGoals: number): string {
  if (myGoals > oppGoals) return `${clubName} vence ${opponentName} por ${myGoals} a ${oppGoals}`;
  if (myGoals < oppGoals) return `${clubName} perde para ${opponentName} por ${myGoals} a ${oppGoals}`;
  return `${clubName} empata com ${opponentName} em ${myGoals} a ${oppGoals}`;
}

/** Only called for a 2+ goal game — a single goal isn't newsworthy on its own. */
export function goalStreakHeadline(playerName: string, goalCount: number, opponentName: string): string {
  const verb = goalCount >= 3 ? `marca ${goalCount} vezes` : 'marca duas vezes';
  return `${playerName} ${verb} na partida contra ${opponentName}`;
}

export function transferInHeadline(clubName: string, playerName: string): string {
  return `${clubName} anuncia a contratação de ${playerName}`;
}

export function transferOutHeadline(clubName: string, playerName: string, toClubName: string): string {
  return `${playerName} deixa ${clubName} e vai para ${toClubName}`;
}

export function titleHeadline(clubName: string, competitionName: string): string {
  return `${clubName} conquista o título: ${competitionName}`;
}

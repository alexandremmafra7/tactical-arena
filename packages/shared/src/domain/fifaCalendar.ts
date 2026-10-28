/**
 * ============================================================================
 * CALENDÁRIO INTERNACIONAL FIFA & DATAS FIFA — FASE C
 * ============================================================================
 * Gerencia as semanas de janelas internacionais oficiais da FIFA, pausas
 * nas ligas nacionais, convocações de atletas (call-ups) e partidas de seleções.
 */

export interface InternationalMatch {
  id: string;
  homeTeamId: string; // ISO-3 (ex: 'BRA')
  awayTeamId: string; // ISO-3 (ex: 'ARG')
  competitionName: string; // Ex: 'Eliminatórias da Copa' ou 'Amistoso Internacional'
  weekNumber: number;
  date: string;
  homeGoals?: number;
  awayGoals?: number;
  played: boolean;
}

export interface PlayerCallUp {
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  nationalTeamId: string;
  nationalTeamName: string;
  weekNumber: number;
}

/**
 * Semanas padrão do ano (1 a 52) correspondentes às 5 janelas de Datas FIFA oficiais:
 * - Março (~Semana 11)
 * - Junho (~Semana 23)
 * - Setembro (~Semana 36)
 * - Outubro (~Semana 41)
 * - Novembro (~Semana 46)
 */
export const FIFA_WINDOW_WEEKS: number[] = [11, 23, 36, 41, 46];

/**
 * Verifica se uma determinada semana do ano corresponde a uma Data FIFA.
 */
export function isFifaDateWeek(weekNumber: number): boolean {
  return FIFA_WINDOW_WEEKS.includes(weekNumber);
}

/**
 * Retorna o nome descritivo da janela FIFA com base na semana do ano.
 */
export function getFifaWindowLabel(weekNumber: number): string {
  switch (weekNumber) {
    case 11:
      return 'Data FIFA — Março';
    case 23:
      return 'Data FIFA — Junho / Fim de Temporada';
    case 36:
      return 'Data FIFA — Setembro';
    case 41:
      return 'Data FIFA — Outubro';
    case 46:
      return 'Data FIFA — Novembro';
    default:
      return 'Data FIFA';
  }
}

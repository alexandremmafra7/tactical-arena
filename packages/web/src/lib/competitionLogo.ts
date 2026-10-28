/** Real branding for the two competitions actually played in Brazil (see leagueService.joinOrCreateLeague
 *  and import-content.ts's createCopaDoBrasilIfNeeded, which name these exactly) — every other league/cup
 *  keeps its generic auto-generated name and no logo. */
const COMPETITION_LOGOS: Record<string, string> = {
  'Brasileirão Série A': '/competitions/brasileirao.png',
  'Brasileirão Série B': '/competitions/brasileirao.png',
  'Copa do Brasil': '/competitions/copa-do-brasil.png',
  'Premier League': '/competitions/premier-league.png',
  'FA Cup': '/competitions/fa-cup.png',
  'LaLiga': '/competitions/laliga.png',
  'LaLiga EA Sports': '/competitions/laliga.png',
  'Copa del Rey': '/competitions/copa-del-rey.png',
  'Taça Libertadores': '/competitions/libertadores.png',
  'Copa Libertadores': '/competitions/libertadores.png',
  'Copa Libertadores da América': '/competitions/libertadores.png',
  'UEFA Champions League': '/competitions/champions-league.png',
  'Champions League': '/competitions/champions-league.png',
};

export function competitionLogo(name: string): string | null {
  if (!name) return null;
  if (COMPETITION_LOGOS[name]) return COMPETITION_LOGOS[name];
  const lower = name.toLowerCase();
  if (lower.includes('brasileir')) return '/competitions/brasileirao.png';
  if (lower.includes('copa do brasil')) return '/competitions/copa-do-brasil.png';
  if (lower.includes('premier league')) return '/competitions/premier-league.png';
  if (lower.includes('fa cup')) return '/competitions/fa-cup.png';
  if (lower.includes('laliga') || lower.includes('la liga')) return '/competitions/laliga.png';
  if (lower.includes('copa del rey')) return '/competitions/copa-del-rey.png';
  if (lower.includes('libertadores')) return '/competitions/libertadores.png';
  if (lower.includes('champions league')) return '/competitions/champions-league.png';
  if (lower.includes('bundesliga')) return '/trophies/tr_nacional_ALE_d1.png';
  if (lower.includes('serie a') && !lower.includes('brasileir')) return '/trophies/tr_nacional_ITA.png';
  if (lower.includes('ligue 1')) return '/trophies/tr_nacional_FRA_d1.png';
  if (lower.includes('primeira liga')) return '/trophies/tr_nacional_POR_d1.png';
  if (lower.includes('eredivisie')) return '/trophies/tr_nacional_HOL_d1.png';
  if (lower.includes('liga profesional')) return '/trophies/tr_nacional_ARG_d1.png';
  if (lower.includes('saudi pro league')) return '/trophies/tr_nacional_ARS_d1.png';
  if (lower.includes('coppa italia')) return '/trophies/tr_copa_ITA.png';
  if (lower.includes('dfb-pokal') || lower.includes('dfb pokal')) return '/trophies/tr_copa_ALE.png';
  if (lower.includes('coupe de france')) return '/trophies/tr_copa_FRA.png';
  if (lower.includes('taça de portugal')) return '/trophies/tr_copa_POR.png';
  if (lower.includes('knvb beker')) return '/trophies/tr_copa_HOL.png';
  if (lower.includes('copa argentina')) return '/trophies/tr_copa_ARG.png';
  if (lower.includes("king's cup") || lower.includes('kings cup')) return '/trophies/tr_copa_ARS.png';
  return null;
}


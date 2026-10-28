export function getTrophyImagePath(competitionName?: string, country?: string): string {
  if (!competitionName) {
    return '/trophies/tr_supercopa_generico.png';
  }

  const name = competitionName.toLowerCase();
  const c = country?.toLowerCase() || '';

  if (name.includes('libertadores') || name.includes('copa libertadores')) {
    return '/trophies/tr_libertadores.png';
  }
  if (name.includes('champions') || name.includes('liga dos campeões')) {
    return '/trophies/tr_ligacampeoes.png';
  }
  if (name.includes('mundial') || name.includes('intercontinental')) {
    return '/trophies/tr_mundial.png';
  }
  if (name.includes('copa') && c.includes('bra')) {
    return '/trophies/tr_copa_BRA.png';
  }
  if (name.includes('copa')) {
    return '/trophies/tr_copa.png';
  }
  if (name.includes('estadual') || name.includes('paulista') || name.includes('carioca')) {
    return '/trophies/tr_estadualgenerico.png';
  }
  if (name.includes('brasileiro') || name.includes('serie a') || name.includes('série a')) {
    return '/trophies/tr_nacional_BRA_d1.png';
  }
  if (name.includes('serie b') || name.includes('série b')) {
    return '/trophies/tr_nacional_BRA_d2.png';
  }

  return '/trophies/tr_supercopa_generico.png';
}

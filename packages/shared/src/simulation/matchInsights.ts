import type { Match, MatchResult } from '../domain/match.js';
import type { Club } from '../domain/club.js';

export interface TacticalInsightItem {
  icon: string;
  category: 'DOMINANCE' | 'SUBSTITUTIONS' | 'GOALKEEPING' | 'DISCIPLINE' | 'EFFICIENCY' | 'PRESSURE';
  title: string;
  narrative: string;
  impact: 'POSITIVE' | 'NEUTRAL' | 'CRITICAL';
}

export interface PostMatchInsights {
  headline: string;
  verdict: string;
  insights: TacticalInsightItem[];
  homeXgDominancePct: number;
}

/**
 * Generates automated tactical post-match intelligence reports based on xG, shot accuracy,
 * goalkeeper interventions, disciplinary moments, and substitute impacts (PDF Tactical Arena FC).
 */
export function generatePostMatchInsights(
  match: Match,
  homeClub: Club,
  awayClub: Club,
): PostMatchInsights {
  const result = match.result;
  if (!result) {
    return {
      headline: 'Partida em andamento',
      verdict: 'Aguardando apito final para análise tática.',
      insights: [],
      homeXgDominancePct: 50,
    };
  }

  const homeStats = result.stats?.home ?? {
    shots: Math.max(result.homeGoals * 3, 5),
    shotsOnTarget: Math.max(result.homeGoals, 2),
    xg: Math.max(result.homeGoals * 0.75, 0.5),
    saves: 2,
  };
  const awayStats = result.stats?.away ?? {
    shots: Math.max(result.awayGoals * 3, 4),
    shotsOnTarget: Math.max(result.awayGoals, 1),
    xg: Math.max(result.awayGoals * 0.75, 0.4),
    saves: 2,
  };

  let homeXg = homeStats.xg ?? (homeStats.shotsOnTarget * 0.32 + (homeStats.shots - homeStats.shotsOnTarget) * 0.05);
  let awayXg = awayStats.xg ?? (awayStats.shotsOnTarget * 0.32 + (awayStats.shots - awayStats.shotsOnTarget) * 0.05);

  if (result.homeGoals > 0 && homeXg < result.homeGoals * 0.3) {
    homeXg = Math.max(homeXg, Number((result.homeGoals * 0.65).toFixed(1)));
  }
  if (result.awayGoals > 0 && awayXg < result.awayGoals * 0.3) {
    awayXg = Math.max(awayXg, Number((result.awayGoals * 0.65).toFixed(1)));
  }

  const totalXg = Math.max(0.1, homeXg + awayXg);
  const homeXgDominancePct = Math.round((homeXg / totalXg) * 100);

  const insights: TacticalInsightItem[] = [];

  // 1. CHANCE CREATION & XG DOMINANCE
  if (result.homeGoals > result.awayGoals && homeXg > awayXg * 1.3) {
    insights.push({
      icon: '📈',
      category: 'DOMINANCE',
      title: `Controle Total do ${homeClub.name}`,
      narrative: `O ${homeClub.name} traduziu seu volume ofensivo (${homeXg.toFixed(1)} xG) em gols, sufocando as linhas do adversário.`,
      impact: 'POSITIVE',
    });
  } else if (result.awayGoals > result.homeGoals && awayXg > homeXg * 1.3) {
    insights.push({
      icon: '📈',
      category: 'DOMINANCE',
      title: `Superioridade Visitante do ${awayClub.name}`,
      narrative: `O ${awayClub.name} impôs seu ritmo fora de casa, criando ${awayXg.toFixed(1)} xG contra apenas ${homeXg.toFixed(1)} do mandante.`,
      impact: 'POSITIVE',
    });
  } else if (result.homeGoals > result.awayGoals && awayXg > homeXg) {
    insights.push({
      icon: '🎯',
      category: 'EFFICIENCY',
      title: `Eficiência Cirúrgica do ${homeClub.name}`,
      narrative: `Mesmo gerando menor volume esperado (${homeXg.toFixed(1)} xG contra ${awayXg.toFixed(1)} xG), o ${homeClub.name} foi letal nas finalizações.`,
      impact: 'POSITIVE',
    });
  } else if (result.awayGoals > result.homeGoals && homeXg > awayXg) {
    insights.push({
      icon: '🎯',
      category: 'EFFICIENCY',
      title: `Castigo na Bola Decisiva para o ${awayClub.name}`,
      narrative: `O ${homeClub.name} acumulou ${homeXg.toFixed(1)} xG mas pecou na pontaria, permitindo a vitória clínica do ${awayClub.name}.`,
      impact: 'CRITICAL',
    });
  }

  const allPlayers = new Map([...homeClub.players, ...awayClub.players].map((p) => [p.id, p]));
  const getPlayerName = (id: string) => allPlayers.get(id)?.name ?? 'Jogador';

  // 2. DISCIPLINARY & RED CARDS
  const redCards = result.events.filter((e) => e.type === 'card' && e.suspensionMatches);
  for (const rc of redCards) {
    const isHome = rc.team === 'home';
    const culpritTeam = isHome ? homeClub.name : awayClub.name;
    const name = getPlayerName(rc.playerId);
    insights.push({
      icon: '🟥',
      category: 'DISCIPLINE',
      title: `Impacto da Expulsão aos ${rc.minute}'`,
      narrative: `A saída precoce de ${name} comprometeu o desenho tático do ${culpritTeam}, forçando linhas baixas e sobrecarregando o setor defensivo.`,
      impact: 'CRITICAL',
    });
  }

  // 3. SUBSTITUTION IMPACTS
  const subs = result.events.filter((e) => e.type === 'substitution');
  const subGoals = result.events.filter(
    (e) => e.type === 'goal' && subs.some((s) => s.relatedPlayerId === e.playerId && s.minute <= e.minute),
  );
  if (subGoals.length > 0) {
    const firstSubGoal = subGoals[0];
    const subClub = firstSubGoal.team === 'home' ? homeClub.name : awayClub.name;
    const name = getPlayerName(firstSubGoal.playerId);
    insights.push({
      icon: '🔄',
      category: 'SUBSTITUTIONS',
      title: 'Dedo do Treinador',
      narrative: `A alteração no segundo tempo deu resultado imediato: ${name} saiu do banco para balançar as redes pelo ${subClub}.`,
      impact: 'POSITIVE',
    });
  }

  // 4. GOALKEEPER HEROICS
  if (homeStats.saves >= 4) {
    insights.push({
      icon: '🧤',
      category: 'GOALKEEPING',
      title: `Muralha no Gol do ${homeClub.name}`,
      narrative: `Com ${homeStats.saves} intervenções difíceis, a meta do ${homeClub.name} segurou investidas cruciais do adversário.`,
      impact: 'POSITIVE',
    });
  }
  if (awayStats.saves >= 4) {
    insights.push({
      icon: '🧤',
      category: 'GOALKEEPING',
      title: `Defesas Decisivas do ${awayClub.name}`,
      narrative: `O goleiro do ${awayClub.name} operou ${awayStats.saves} defesas fundamentais para manter o time vivo no confronto.`,
      impact: 'POSITIVE',
    });
  }

  // 5. PRESSURE & HIGH INTENSITY PLAY
  const homePressureEfficiency = homeStats.pressRecoveries > 0
    ? (homeStats.goalsFromPressRecovery / homeStats.pressRecoveries) * 100
    : 0;
  const awayPressureEfficiency = awayStats.pressRecoveries > 0
    ? (awayStats.goalsFromPressRecovery / awayStats.pressRecoveries) * 100
    : 0;

  if (homeStats.pressRecoveries >= 5) {
    insights.push({
      icon: '',
      category: 'PRESSURE',
      title: `Pressão Alta do ${homeClub.name}`,
      narrative: `O ${homeClub.name} recuperou ${homeStats.pressRecoveries} bolas no campo ofensivo${homeStats.goalsFromPressRecovery > 0 ? `, convertendo ${homeStats.goalsFromPressRecovery} em gol${homeStats.goalsFromPressRecovery > 1 ? 's' : ''}` : ''}.`,
      impact: homeStats.goalsFromPressRecovery > 0 ? 'POSITIVE' : 'NEUTRAL',
    });
  }
  if (awayStats.pressRecoveries >= 5) {
    insights.push({
      icon: '',
      category: 'PRESSURE',
      title: `Pressão Alta do ${awayClub.name}`,
      narrative: `O ${awayClub.name} recuperou ${awayStats.pressRecoveries} bolas no campo ofensivo${awayStats.goalsFromPressRecovery > 0 ? `, convertendo ${awayStats.goalsFromPressRecovery} em gol${awayStats.goalsFromPressRecovery > 1 ? 's' : ''}` : ''}.`,
      impact: awayStats.goalsFromPressRecovery > 0 ? 'POSITIVE' : 'NEUTRAL',
    });
  }

  // 6. WING PLAY & CROSSING EFFICIENCY
  // Approximating wing play through big chances from wide areas and corners
  const homeWingThreat = homeStats.bigChances + (homeStats.corners * 0.5);
  const awayWingThreat = awayStats.bigChances + (awayStats.corners * 0.5);

  if (homeWingThreat >= 4 && homeWingThreat > awayWingThreat * 1.5) {
    insights.push({
      icon: '🏃',
      category: 'EFFICIENCY',
      title: `Explosividade pelas Alas do ${homeClub.name}`,
      narrative: `O ${homeClub.name} criou ${homeWingThreat.toFixed(1)} oportunidades de ataque pelas laterais, explorando espaços e sobrecarregando as defesas adversárias.`,
      impact: 'POSITIVE',
    });
  }
  if (awayWingThreat >= 4 && awayWingThreat > homeWingThreat * 1.5) {
    insights.push({
      icon: '🏃',
      category: 'EFFICIENCY',
      title: `Velocidade nas Pontas do ${awayClub.name}`,
      narrative: `O ${awayClub.name} utilizou ${awayWingThreat.toFixed(1)} jogadas pelas alas para desequilibrar, gerando ${awayStats.bigChances} chances claras e ${awayStats.corners} escanteios perigosos.`,
      impact: 'POSITIVE',
    });
  }

  // Headline and Overall Verdict
  let headline = 'Confronto Equilibrado';
  let verdict = 'Duelo tático marcado pela disputa acirrada no meio-campo e marcação encaixada.';

  if (result.homeGoals > result.awayGoals) {
    headline = `Vitória do ${homeClub.name} (${result.homeGoals} x ${result.awayGoals})`;
    verdict = `O ${homeClub.name} fez valer o mando de campo e garantiu os 3 pontos com autoridade.`;
  } else if (result.awayGoals > result.homeGoals) {
    headline = `Triunfo do ${awayClub.name} (${result.awayGoals} x ${result.homeGoals})`;
    verdict = `Vitória estratégica do ${awayClub.name} fora de casa, aproveitando os espaços táticos concedidos.`;
  } else {
    headline = `Empate em ${result.homeGoals} x ${result.awayGoals}`;
    verdict = 'Equipes dividiram o controle das ações em partida disputada até o apito final.';
  }

  return {
    headline,
    verdict,
    insights,
    homeXgDominancePct,
  };
}

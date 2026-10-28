import type { Match, MatchEvent, MatchSide, MatchSideStats } from '../domain/match.js';
import type { Tactic } from '../domain/tactic.js';
import type { Player, PlayerFunction, Position } from '../domain/player.js';
import { PLAYER_ROLE_MODIFIERS, autoAssignBestRolesForPlayer } from './playerRoleModifiers.js';
import type { PlayerRating } from '../domain/matchRatings.js';

export type EvaluatedDimension =
  | 'PRESSING'
  | 'DEFENSIVE_LINE'
  | 'ATTACK_STYLE'
  | 'TRANSITIONS'
  | 'EFFICIENCY';

export interface Evaluation {
  dimension: EvaluatedDimension;
  status: 'POSITIVE' | 'NEGATIVE' | 'CRITICAL';
  title: string;
  metricLabel?: string;
  causalExplanation: string;
  icon?: string;
}

export type TacticalVerdict = 'EXCELENTE' | 'BOM' | 'REGULAR' | 'ABAIXO';

export interface PlayerRolePerformance {
  playerId: string;
  name: string;
  position: Position;
  role: PlayerFunction | 'GOLEIRO' | 'SEM_FUNCAO';
  roleName: string;
  rating: number;
  keyStat: string;
  tacticalVerdict: TacticalVerdict;
  explanation: string;
  goals: number;
  assists: number;
  highlightIcon?: string;
}

export interface TeamRolePerformanceReport {
  teamName: string;
  clubId: string;
  starters: PlayerRolePerformance[];
  tacticalHighlights: string[];
}

export type TeamReport = {
  teamName: string;
  evaluations: Evaluation[];
  overallVerdict: string;
};

export type TacticalMatchReport = {
  home: TeamReport;
  away: TeamReport;
  rolePerformances?: {
    home: TeamRolePerformanceReport;
    away: TeamRolePerformanceReport;
  };
};

/**
 * Avalia o desempenho individual de cada jogador titular conforme seu papel tático atribuído,
 * correlacionando notas reais, eventos de partida e justificativas causais explicáveis.
 */
export function evaluateTeamRolePerformances(
  starters: Player[],
  tactic: Tactic | undefined,
  side: MatchSide,
  match: Match,
  teamName: string,
  clubId: string,
  ratingsList?: PlayerRating[],
): TeamRolePerformanceReport {
  const result = match.result;
  const events = result?.events ?? [];
  const sideStats = (side === 'home' ? result?.stats?.home : result?.stats?.away) ?? {
    shots: 0,
    shotsOnTarget: 0,
    possession: 50,
    corners: 0,
    fouls: 0,
    pressRecoveries: 0,
    goalsFromPressRecovery: 0,
    xg: 0,
    bigChances: 0,
    saves: 0,
    woodwork: 0,
    blockedShots: 0,
  };
  const oppStats = (side === 'home' ? result?.stats?.away : result?.stats?.home) ?? {
    shots: 0,
    shotsOnTarget: 0,
    possession: 50,
    corners: 0,
    fouls: 0,
    pressRecoveries: 0,
    goalsFromPressRecovery: 0,
    xg: 0,
    bigChances: 0,
    saves: 0,
    woodwork: 0,
    blockedShots: 0,
  };
  const goalsConceded = side === 'home' ? (result?.awayGoals ?? 0) : (result?.homeGoals ?? 0);

  const ratingsMap = new Map<string, number>();
  if (ratingsList) {
    for (const r of ratingsList) {
      ratingsMap.set(r.playerId, r.rating);
    }
  }

  const rolePerformances: PlayerRolePerformance[] = starters.map((player) => {
    let role: PlayerFunction | 'GOLEIRO' | 'SEM_FUNCAO' = 'SEM_FUNCAO';
    let roleName = 'Jogador Polivalente';

    if (player.position === 'GK') {
      role = 'GOLEIRO';
      roleName = 'Goleiro';
    } else if (player.functions && player.functions.length > 0) {
      role = player.functions[0];
      roleName = PLAYER_ROLE_MODIFIERS[role]?.name ?? role;
    } else {
      const best = autoAssignBestRolesForPlayer(player);
      if (best.length > 0) {
        role = best[0];
        roleName = PLAYER_ROLE_MODIFIERS[role]?.name ?? role;
      }
    }

    const rating = ratingsMap.get(player.id) ?? 6.0;

    // Métricas individuais nos lances
    const playerEvents = events.filter((e) => e.team === side && e.playerId === player.id);
    const goals = events.filter((e) => e.team === side && e.type === 'goal' && e.playerId === player.id).length;
    const assists = events.filter(
      (e) =>
        e.team === side &&
        e.type === 'goal' &&
        (e.assistPlayerId === player.id || (e.assistPlayerName && e.assistPlayerName === player.name)),
    ).length;
    const chances = playerEvents.filter((e) => e.type === 'chance').length;
    const headers = playerEvents.filter((e) => e.shotType === 'HEADER').length;
    const oneOnOnes = playerEvents.filter((e) => e.shotType === 'ONE_ON_ONE').length;

    // Veredito tático
    let tacticalVerdict: TacticalVerdict = 'REGULAR';
    if (rating >= 7.8 || goals >= 2 || (goals >= 1 && assists >= 1)) {
      tacticalVerdict = 'EXCELENTE';
    } else if (rating >= 6.8 || goals >= 1 || assists >= 1) {
      tacticalVerdict = 'BOM';
    } else if (rating >= 5.8) {
      tacticalVerdict = 'REGULAR';
    } else {
      tacticalVerdict = 'ABAIXO';
    }

    // Ícone e estatística-chave
    let highlightIcon = '⭐';
    let keyStat = 'Participação tática equilibrada';
    let explanation = '';

    if (role === 'GOLEIRO') {
      highlightIcon = '🧤';
      const saves = sideStats.saves ?? 0;
      keyStat = `${saves} defesa${saves !== 1 ? 's' : ''}, ${goalsConceded} gol${goalsConceded !== 1 ? 's' : ''} sofrido${goalsConceded !== 1 ? 's' : ''}`;
      if (goalsConceded === 0 && saves >= 3) {
        explanation = 'Paredão sob as traves: defesas cruciais garantiram a meta invicta.';
      } else if (goalsConceded === 0) {
        explanation = 'Partida segura e tranquila, sem sustos ou falhas na saída.';
      } else if (saves >= 4) {
        explanation = 'Evitou uma derrota mais ampla com intervenções difíceis no mano a mano.';
      } else {
        explanation = 'Trabalho regular debaixo das traves frente às investidas adversárias.';
      }
    } else if (role === 'CENTROAVANTE_REFERENCIA' || role === 'CENTROAVANTE') {
      highlightIcon = '⚽';
      if (goals > 0) {
        keyStat = `${goals} gol${goals > 1 ? 's' : ''}${headers > 0 ? ` (${headers} de cabeça)` : ''}, ${chances + goals} finalizações`;
        explanation = 'Cumpriu a função de pivô e finalizador de área com letalidade máxima.';
      } else if (headers > 0) {
        keyStat = `${headers} cabeceio${headers > 1 ? 's' : ''}, reteve a zaga rival`;
        explanation = 'Ganhou duelos aéreos e fez o pivô de costas, abastecendo os companheiros.';
      } else if (chances > 0) {
        keyStat = `${chances} finalizações na área`;
        explanation = 'Bons desmarques na área, mas faltou pontaria para transformar chances em gol.';
      } else {
        keyStat = 'Isolado entre os zagueiros centrais';
        explanation = 'Pouco acionado na referência de área pela marcação encaixada do adversário.';
      }
    } else if (role === 'FALSO_NOVE') {
      highlightIcon = '🎭';
      if (goals > 0 || assists > 0) {
        keyStat = `${goals} gol${goals > 1 ? 's' : ''}, ${assists} assist., atraiu zagueiros`;
        explanation = 'Recuou entre as linhas com maestria, atraindo zagueiros e servindo infiltrações.';
      } else {
        keyStat = 'Flutuação entrelinhas e apoio';
        explanation = 'Movimentação inteligente para gerar linhas de passe curtas no ataque.';
      }
    } else if (role === 'PONTA_INVERTIDO' || role === 'PONTA') {
      highlightIcon = '';
      if (goals > 0) {
        keyStat = `${goals} gol${goals > 1 ? 's' : ''}, cortes perigosos para dentro`;
        explanation = 'Atacou os espaços no mano a mano e afunilou em diagonal para finalizar com perigo.';
      } else if (assists > 0) {
        keyStat = `${assists} assistência${assists > 1 ? 's' : ''}, 1x1 incisivo`;
        explanation = 'Quebrou as linhas adversárias em velocidade e serviu o centroavante.';
      } else {
        keyStat = `${chances} tentativas individuais`;
        explanation = 'Buscou a jogada individual pelo flanco, mas encontrou dobras de marcação.';
      }
    } else if (role === 'PONTA_LINHA_DE_FUNDO') {
      highlightIcon = '🏃';
      keyStat = `${assists > 0 ? `${assists} assist., ` : ''}cruzamentos na linha de fundo`;
      explanation = 'Drible vertical e velocidade para ganhar o fundo e abastecer a área.';
    } else if (role === 'MEIA_ARMADOR' || role === 'MEIA_CRIACAO') {
      highlightIcon = '🎯';
      if (assists > 0) {
        keyStat = `${assists} assistência${assists > 1 ? 's' : ''}, maestro na criação`;
        explanation = 'Visão privilegiada: ditou o ritmo e desfez a marcação rival com passes decisivos.';
      } else if (goals > 0) {
        keyStat = `${goals} gol${goals > 1 ? 's' : ''}, chegada surpresa`;
        explanation = 'Infiltrou na área com precisão de camisa 10 e definiu no momento certo.';
      } else {
        keyStat = 'Distribuição e articulação ofensiva';
        explanation = 'Cadenciou as jogadas no terço final, apesar da forte pressão adversária.';
      }
    } else if (role === 'VOLANTE_CAO_DE_GUARDA' || role === 'VOLANTE') {
      highlightIcon = '🛡️';
      keyStat = `Proteção à zaga, combate central (${sideStats.pressRecoveries} desarmes do time)`;
      if (rating >= 7.0) {
        explanation = 'Verdadeiro cão de guarda: varreu a entrada da área e desarmou transições velozes.';
      } else {
        explanation = 'Protegeu a cabeça de área e evitou que meias rivais finalizassem com liberdade.';
      }
    } else if (role === 'MEIA_BOX_TO_BOX') {
      highlightIcon = '🔋';
      keyStat = 'Motor de área a área, intensidade alta';
      explanation = 'Combinação incansável de pressão na marcação e apoio nas pontas e no meio.';
    } else if (role === 'ALA_OFENSIVO' || role === 'ALA') {
      highlightIcon = '🚀';
      const corners = sideStats.corners ?? 0;
      keyStat = `${assists > 0 ? `${assists} assist., ` : ''}apoio no corredor (${corners} escanteios)`;
      explanation = 'Deu amplitude pelo flanco e sobrecarregou a lateral rival com apoio contínuo.';
    } else if (role === 'LATERAL_CONSTRUTOR' || role === 'LATERAL') {
      highlightIcon = '📐';
      keyStat = 'Equilíbrio no flanco e apoio por dentro';
      explanation = 'Fechou o setor com disciplina tática e auxiliou na circulação qualificada da posse.';
    } else if (role === 'ZAGUEIRO_REBATEDOR') {
      highlightIcon = '🧱';
      keyStat = `${goalsConceded === 0 ? 'Meta zerada, soberano no corte' : 'Combate aéreo e desarmes diretos'}`;
      explanation = 'Forte nas divididas e no combate aéreo, afastando o perigo da pequena área.';
    } else if (role === 'ZAGUEIRO_CONSTRUTOR') {
      highlightIcon = '🔍';
      keyStat = 'Saída qualificada, quebra de 1ª linha';
      explanation = 'Iniciou as jogadas a partir de trás com passes verticais seguros sem rifar a bola.';
    } else {
      keyStat = `${goals > 0 ? `${goals} gol(s)` : `${rating.toFixed(1)} nota média`}`;
      explanation = 'Compromisso tático e disciplina posicional ao longo dos 90 minutos.';
    }

    return {
      playerId: player.id,
      name: player.name,
      position: player.position,
      role,
      roleName,
      rating,
      keyStat,
      tacticalVerdict,
      explanation,
      goals,
      assists,
      highlightIcon,
    };
  });

  // Destaques coletivos do auxiliar técnico
  const tacticalHighlights: string[] = [];
  const topPerformer = [...rolePerformances].sort((a, b) => b.rating - a.rating)[0];
  if (topPerformer && topPerformer.rating >= 7.5) {
    tacticalHighlights.push(
      `⭐ Destaque individual: ${topPerformer.name} brilhou no papel de ${topPerformer.roleName} (Nota ${topPerformer.rating.toFixed(1)}).`,
    );
  }

  const strikers = rolePerformances.filter((p) => p.position === 'ATT');
  const strikerGoals = strikers.reduce((acc, p) => acc + p.goals, 0);
  if (strikerGoals > 0) {
    tacticalHighlights.push(
      `⚽ Eficácia no comando do ataque: setor ofensivo converteu ${strikerGoals} gol${strikerGoals > 1 ? 's' : ''} executando seus papéis táticos.`,
    );
  } else if (strikers.length > 0) {
    tacticalHighlights.push(
      `⚠️ Alerta ofensivo: atacantes encontraram dificuldade para furar o bloqueio defensivo rival.`,
    );
  }

  if (goalsConceded === 0) {
    tacticalHighlights.push(
      `🛡️ Solidez da retaguarda: zaga e volantes anularam as principais investidas do adversário.`,
    );
  } else if (oppStats.shotsOnTarget >= 6) {
    tacticalHighlights.push(
      `🚨 Exposição defensiva: ${oppStats.shotsOnTarget} finalizações no alvo concedidas exigem atenção nas coberturas.`,
    );
  }

  return {
    teamName,
    clubId,
    starters: rolePerformances,
    tacticalHighlights,
  };
}

/**
 * Generate a tactical causal report for a simulated match.
 */
export function generateTacticalMatchReport(
  match: Match,
  homeTactic?: Tactic,
  awayTactic?: Tactic,
  homeTeamName?: string,
  awayTeamName?: string,
  homeStarters?: Player[],
  awayStarters?: Player[],
  ratingsList?: { home: PlayerRating[]; away: PlayerRating[] },
): TacticalMatchReport | null {
  if (match.status !== 'SIMULATED' || !match.result) {
    return null;
  }

  const { stats, events, homeGoals, awayGoals } = match.result;

  const evaluatePressing = (
    tactic: Tactic | undefined,
    side: 'home' | 'away',
    sideStats: MatchSideStats,
    oppStats: MatchSideStats,
  ): Evaluation => {
    if (!tactic) {
      return {
        dimension: 'PRESSING',
        status: 'NEGATIVE',
        title: 'Pressão Indefinida',
        causalExplanation: 'Sem instruções táticas de pressão.',
        icon: '❓',
      };
    }
    switch (tactic.pressing) {
      case 'HIGH_PRESS': {
        const recoveries = sideStats.pressRecoveries ?? 0;
        const pressGoals = sideStats.goalsFromPressRecovery ?? 0;
        const isEffective = recoveries >= 4 || pressGoals >= 1;
        return {
          dimension: 'PRESSING',
          status: isEffective ? 'POSITIVE' : 'NEGATIVE',
          title: 'Pressão Alta Sufocante',
          metricLabel: `${recoveries} recuperações altas, ${pressGoals} gols gerados`,
          causalExplanation: isEffective
            ? 'High Press sufocou a saída do adversário e gerou perigo imediato no terço final.'
            : 'A tentativa de pressão alta foi superada pelo rival e causou desgaste sem desarmes no ataque.',
          icon: '',
        };
      }
      case 'LOW_BLOCK': {
        const oppBlocked = oppStats.blockedShots ?? 0;
        const oppShotsOnTarget = oppStats.shotsOnTarget ?? 0;
        const goalsConceded = side === 'home' ? awayGoals : homeGoals;
        const isSolid = goalsConceded < 3;
        return {
          dimension: 'PRESSING',
          status: isSolid ? 'POSITIVE' : 'NEGATIVE',
          title: 'Bloco Baixo',
          metricLabel: `${oppBlocked} chutes travados, ${oppShotsOnTarget} chutes no alvo sofridos`,
          causalExplanation: isSolid
            ? 'A escolha por Bloco Baixo tirou toda a profundidade do rival e protegeu a grande área.'
            : 'O bloco baixo não suportou a pressão adversária e cedeu finalizações perigosas.',
          icon: '🛡️',
        };
      }
      case 'MEDIUM': {
        const recoveries = sideStats.pressRecoveries ?? 0;
        const isGood = recoveries >= 3;
        return {
          dimension: 'PRESSING',
          status: isGood ? 'POSITIVE' : 'NEGATIVE',
          title: 'Bloco Médio',
          metricLabel: `${recoveries} recuperações no meio`,
          causalExplanation: isGood
            ? 'Pressão em bloco médio manteve a compactação sem desorganizar as linhas.'
            : 'Pressão média não gerou efeito relevante na disputa pela posse de bola.',
          icon: '⚖️',
        };
      }
      default:
        return {
          dimension: 'PRESSING',
          status: 'NEGATIVE',
          title: 'Pressão Indefinida',
          causalExplanation: 'Instrução de pressão não identificada.',
          icon: '❓',
        };
    }
  };

  const evaluateDefensiveLine = (
    tactic: Tactic | undefined,
    side: 'home' | 'away',
  ): Evaluation => {
    if (!tactic) {
      return {
        dimension: 'DEFENSIVE_LINE',
        status: 'NEGATIVE',
        title: 'Linha Indefinida',
        causalExplanation: 'Sem instruções de linha defensiva.',
        icon: '❓',
      };
    }
    if (tactic.defensiveLine === 'HIGH') {
      const opponentTeam = side === 'home' ? 'away' : 'home';
      const count = events.filter(
        (e) => e.team === opponentTeam && e.shotType === 'ONE_ON_ONE',
      ).length;
      if (count > 0) {
        return {
          dimension: 'DEFENSIVE_LINE',
          status: 'CRITICAL',
          title: 'Linha Alta Vulnerável',
          metricLabel: `${count} cara-a-cara sofridos`,
          causalExplanation: 'Zagueiros jogaram muito adiantados, concedendo espaço para bolas longas nas costas.',
          icon: '🚨',
        };
      }
      return {
        dimension: 'DEFENSIVE_LINE',
        status: 'POSITIVE',
        title: 'Linha Alta Segura',
        metricLabel: '0 bolas nas costas',
        causalExplanation: 'Linha adiantada manteve o adversário longe da área sem sofrer nas costas.',
        icon: '🛡️',
      };
    }
    if (tactic.defensiveLine === 'DEEP') {
      return {
        dimension: 'DEFENSIVE_LINE',
        status: 'POSITIVE',
        title: 'Linha Recuada Sólida',
        metricLabel: 'Defesa baixa',
        causalExplanation: 'Zaga posicionada na risca da grande área negou qualquer infiltração em velocidade.',
        icon: '🧱',
      };
    }
    return {
      dimension: 'DEFENSIVE_LINE',
      status: 'POSITIVE',
      title: 'Linha Equilibrada',
      metricLabel: 'Altura média',
      causalExplanation: 'Posicionamento estável da retaguarda, alternando coberturas e combatividade.',
      icon: '⚖️',
    };
  };

  const evaluateAttackStyle = (
    tactic: Tactic | undefined,
    side: 'home' | 'away',
    sideStats: MatchSideStats,
  ): Evaluation => {
    if (!tactic) {
      return {
        dimension: 'ATTACK_STYLE',
        status: 'NEGATIVE',
        title: 'Estilo de Ataque Indefinido',
        causalExplanation: 'Sem instruções ofensivas.',
        icon: '❓',
      };
    }
    if (tactic.attackStyle === 'WINGS') {
      const aerialCount = events.filter((e) => e.team === side && e.shotType === 'HEADER').length;
      const aerialMetric = aerialCount > 0 ? aerialCount : sideStats.bigChances;
      return {
        dimension: 'ATTACK_STYLE',
        status: 'POSITIVE',
        title: 'Ataque pelas Pontas',
        metricLabel: `${sideStats.corners} escanteios, ${aerialMetric} finalizações aéreas`,
        causalExplanation: 'Exploração agressiva das alas gerou cruzamentos perigosos e volume constante de escanteios.',
        icon: '🦅',
      };
    }
    if (tactic.attackStyle === 'THROUGH_MIDDLE') {
      const isGood = sideStats.shotsOnTarget >= 4;
      return {
        dimension: 'ATTACK_STYLE',
        status: isGood ? 'POSITIVE' : 'NEGATIVE',
        title: 'Jogo por Dentro',
        metricLabel: `${sideStats.shotsOnTarget} chutes no alvo pelo centro`,
        causalExplanation: isGood
          ? 'Tabelas e combinações curtas pelo centro criaram infiltrações perigosas na área.'
          : 'O afunilamento pelo centro esbarrou na densidade defensiva adversária.',
        icon: '🎯',
      };
    }
    return {
      dimension: 'ATTACK_STYLE',
      status: 'POSITIVE',
      title: 'Ataque Equilibrado',
      metricLabel: `${sideStats.shots} finalizações totais`,
      causalExplanation: 'Alternância equilibrada entre os corredores e a zona central.',
      icon: '🔄',
    };
  };

  const evaluateTransitions = (
    tactic: Tactic | undefined,
    sideStats: MatchSideStats,
  ): Evaluation => {
    if (!tactic) {
      return {
        dimension: 'TRANSITIONS',
        status: 'NEGATIVE',
        title: 'Transições Indefinidas',
        causalExplanation: 'Sem estratégia de transição definida.',
        icon: '❓',
      };
    }
    switch (tactic.transitionStyle) {
      case 'COUNTERPRESS':
        return {
          dimension: 'TRANSITIONS',
          status: 'POSITIVE',
          title: 'Pressão Pós-Perda',
          metricLabel: `${sideStats.pressRecoveries} desarmes pós-perda`,
          causalExplanation: 'Transições rápidas geraram contra-ataques imediatos após perda da posse.',
          icon: '',
        };
      case 'RECOMPOSE':
        return {
          dimension: 'TRANSITIONS',
          status: 'POSITIVE',
          title: 'Recomposição Rápida',
          causalExplanation: 'Equipe recuou prontamente para recompor as linhas defensivas após perder a posse.',
          icon: '🛡️',
        };
      default:
        return {
          dimension: 'TRANSITIONS',
          status: 'NEGATIVE',
          title: 'Transição Neutra',
          causalExplanation: 'Transição sem instruções de aceleração ou recuo.',
          icon: '⚖️',
        };
    }
  };

  const evaluateEfficiency = (
    tactic: Tactic | undefined,
    sideStats: MatchSideStats,
    goals: number,
  ): Evaluation => {
    if (!tactic) {
      return {
        dimension: 'EFFICIENCY',
        status: 'NEGATIVE',
        title: 'Eficiência Indefinida',
        causalExplanation: 'Sem dados para avaliação de eficiência.',
        icon: '❓',
      };
    }
    const isEfficient = goals >= sideStats.xg;
    return {
      dimension: 'EFFICIENCY',
      status: isEfficient ? 'POSITIVE' : 'NEGATIVE',
      title: 'Eficácia em Finalizações',
      metricLabel: `${goals} gols vs ${sideStats.xg.toFixed(2)} xG`,
      causalExplanation: isEfficient
        ? `Alta eficiência ofensiva: converteu ${goals} gol(s) superando a expectativa de ${sideStats.xg.toFixed(2)} xG.`
        : `Desperdício de chances criadas: marcou ${goals} gol(s) apesar de gerar ${sideStats.xg.toFixed(2)} xG.`,
      icon: isEfficient ? '🔥' : '📉',
    };
  };

  const homeEvaluations: Evaluation[] = [
    evaluatePressing(homeTactic, 'home', stats.home, stats.away),
    evaluateDefensiveLine(homeTactic, 'home'),
    evaluateAttackStyle(homeTactic, 'home', stats.home),
    evaluateTransitions(homeTactic, stats.home),
    evaluateEfficiency(homeTactic, stats.home, homeGoals),
  ];

  const awayEvaluations: Evaluation[] = [
    evaluatePressing(awayTactic, 'away', stats.away, stats.home),
    evaluateDefensiveLine(awayTactic, 'away'),
    evaluateAttackStyle(awayTactic, 'away', stats.away),
    evaluateTransitions(awayTactic, stats.away),
    evaluateEfficiency(awayTactic, stats.away, awayGoals),
  ];

  const formation = homeTactic?.formation ?? 'unknown';
  const overallVerdict = `${formation} – pressionar e agredir ofensivamente`;

  let rolePerformances: { home: TeamRolePerformanceReport; away: TeamRolePerformanceReport } | undefined;

  if (homeStarters && homeStarters.length > 0 && awayStarters && awayStarters.length > 0) {
    rolePerformances = {
      home: evaluateTeamRolePerformances(
        homeStarters,
        homeTactic,
        'home',
        match,
        homeTeamName ?? match.homeClubId,
        match.homeClubId,
        ratingsList?.home,
      ),
      away: evaluateTeamRolePerformances(
        awayStarters,
        awayTactic,
        'away',
        match,
        awayTeamName ?? match.awayClubId,
        match.awayClubId,
        ratingsList?.away,
      ),
    };
  }

  return {
    home: {
      teamName: homeTeamName ?? match.homeClubId,
      evaluations: homeEvaluations,
      overallVerdict,
    },
    away: {
      teamName: awayTeamName ?? match.awayClubId,
      evaluations: awayEvaluations,
      overallVerdict,
    },
    rolePerformances,
  };
}

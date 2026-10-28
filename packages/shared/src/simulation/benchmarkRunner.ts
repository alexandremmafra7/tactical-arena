import { makeClub } from './testFactories.js';
import { generateStarterSquad } from '../domain/squadGenerator.js';
import { simulateMatch } from './engine.js';
import { CANONICAL_TACTIC_PRESETS } from '../domain/tacticPreset.js';
import { autoAssignSquadRoles } from './playerRoleModifiers.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';
import type { Tactic } from '../domain/tactic.js';
import type { CanonicalTacticPreset } from '../domain/tacticPreset.js';
import type { Club } from '../domain/club.js';
import type { Player, PlayerFunction } from '../domain/player.js';

export const TOTAL_BENCHMARK_MATCHES = 1000;

export interface BenchmarkMetrics {
  totalGoals: number;
  homeGoals: number;
  awayGoals: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  scorelessDraws: number;
  totalYellowCards: number;
  totalRedCards: number;
  totalShots: number;
  totalXg: number;
  highPressRecoveries: number;
  highPressMatches: number;
  lowBlockRecoveries: number;
  lowBlockMatches: number;
  goalsByRole: Record<string, number>;
  assistsByRole: Record<string, number>;
}

function buildTacticWithPreset(club: Club, preset: CanonicalTacticPreset): Tactic {
  const autofilled = autoFillLineup(club, null, preset.formation);
  return {
    ...autofilled,
    clubId: club.id,
    formation: preset.formation,
    mentality: preset.mentality,
    attackStyle: preset.attackStyle,
    markingStyle: preset.markingStyle,
    attackApproach: preset.attackApproach,
    pressing: preset.pressing,
    transitionStyle: preset.transitionStyle,
    restDefenceShape: preset.restDefenceShape,
    defensiveLine: preset.defensiveLine,
  };
}

function applyActiveRolesToClub(club: Club, starterIds: string[]): Club {
  const assigned = autoAssignSquadRoles(starterIds, club.players);
  return {
    ...club,
    players: club.players.map((p: Player) => ({
      ...p,
      functions: assigned[p.id] ?? p.functions ?? [],
    })),
  };
}

export function runTacticalBenchmark(matchCount: number = TOTAL_BENCHMARK_MATCHES): BenchmarkMetrics {
  const metrics: BenchmarkMetrics = {
    totalGoals: 0,
    homeGoals: 0,
    awayGoals: 0,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    scorelessDraws: 0,
    totalYellowCards: 0,
    totalRedCards: 0,
    totalShots: 0,
    totalXg: 0,
    highPressRecoveries: 0,
    highPressMatches: 0,
    lowBlockRecoveries: 0,
    lowBlockMatches: 0,
    goalsByRole: {},
    assistsByRole: {},
  };

  const startTime = Date.now();

  for (let i = 0; i < matchCount; i++) {
    // Cenários de forças realistas da liga (Série A varia entre 58 e 78, média ~66):
    let homeSkill = 66;
    let awaySkill = 66;
    if (i >= 400 && i < 700) {
      homeSkill = 74;
      awaySkill = 60;
    } else if (i >= 700) {
      homeSkill = 60;
      awaySkill = 74;
    }

    const homePlayers = generateStarterSquad(`home-${i}`, 'BRA', `h-seed-${i}`, homeSkill);
    const awayPlayers = generateStarterSquad(`away-${i}`, 'BRA', `a-seed-${i}`, awaySkill);

    const homeRaw: Club = {
      ...makeClub(`home-${i}`, 'Mandante FC', homeSkill, { seed: `h-seed-${i}` }),
      players: homePlayers,
    };
    const awayRaw: Club = {
      ...makeClub(`away-${i}`, 'Visitante FC', awaySkill, { seed: `a-seed-${i}` }),
      players: awayPlayers,
    };

    // Distribuição tática realista de uma liga competitiva:
    const leaguePresetDistribution = [
      // Wing Play (22%)
      3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
      // Midfield Diamond (20%)
      4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
      // Direct Counter (16%)
      6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
      // Low-Block Counter (16%)
      2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
      // Tiki-Taka (8%)
      0, 0, 0, 0, 0, 0, 0, 0,
      // Gegenpressing (8%)
      1, 1, 1, 1, 1, 1, 1, 1,
      // Catenaccio (6%)
      5, 5, 5, 5, 5, 5,
      // Total Football (4%)
      7, 7, 7, 7,
    ];

    const homePresetIdx = leaguePresetDistribution[i % leaguePresetDistribution.length];
    const awayPresetIdx = leaguePresetDistribution[(i * 7 + 13) % leaguePresetDistribution.length];
    const homePreset = CANONICAL_TACTIC_PRESETS[homePresetIdx];
    const awayPreset = CANONICAL_TACTIC_PRESETS[awayPresetIdx];

    let homeTactic = buildTacticWithPreset(homeRaw, homePreset);
    let awayTactic = buildTacticWithPreset(awayRaw, awayPreset);

    // Atribui papéis táticos ativos
    const homeStarters = homeTactic.lineup.map((s) => s.playerId);
    const awayStarters = awayTactic.lineup.map((s) => s.playerId);
    const homeClub = applyActiveRolesToClub(homeRaw, homeStarters);
    const awayClub = applyActiveRolesToClub(awayRaw, awayStarters);

    // Mapeamento de papéis para tracking de gols e assistências
    const playerRoleMap = new Map<string, PlayerFunction>();
    for (const p of [...homeClub.players, ...awayClub.players]) {
      if (p.functions && p.functions.length > 0) {
        playerRoleMap.set(p.id, p.functions[0]);
      }
    }

    // Executa a simulação determinística oficial
    const result = simulateMatch({
      seed: `benchmark-mc-${i}`,
      home: { club: homeClub, tactic: homeTactic },
      away: { club: awayClub, tactic: awayTactic },
    });

    // Acumula métricas
    metrics.totalGoals += result.homeGoals + result.awayGoals;
    metrics.homeGoals += result.homeGoals;
    metrics.awayGoals += result.awayGoals;

    if (result.homeGoals > result.awayGoals) {
      metrics.homeWins++;
    } else if (result.homeGoals === result.awayGoals) {
      metrics.draws++;
      if (result.homeGoals === 0) metrics.scorelessDraws++;
    } else {
      metrics.awayWins++;
    }

    // Stats
    const homeShots = result.stats?.home.shots ?? 0;
    const awayShots = result.stats?.away.shots ?? 0;
    metrics.totalShots += homeShots + awayShots;
    metrics.totalXg += (result.stats?.home.xg ?? 0) + (result.stats?.away.xg ?? 0);

    // Press Recoveries
    if (homePreset.pressing === 'HIGH_PRESS') {
      metrics.highPressRecoveries += result.stats?.home.pressRecoveries ?? 0;
      metrics.highPressMatches++;
    } else if (homePreset.pressing === 'LOW_BLOCK') {
      metrics.lowBlockRecoveries += result.stats?.home.pressRecoveries ?? 0;
      metrics.lowBlockMatches++;
    }

    // Eventos (Gols, Cartões, Assistências)
    for (const ev of result.events) {
      if (ev.type === 'card') {
        if (ev.suspensionMatches) {
          metrics.totalRedCards++;
        } else {
          metrics.totalYellowCards++;
        }
      } else if (ev.type === 'goal') {
        const scorerRole = playerRoleMap.get(ev.playerId) ?? 'SEM_PAPEL';
        metrics.goalsByRole[scorerRole] = (metrics.goalsByRole[scorerRole] ?? 0) + 1;

        if (ev.assistPlayerId) {
          const assistRole = playerRoleMap.get(ev.assistPlayerId) ?? 'SEM_PAPEL';
          metrics.assistsByRole[assistRole] = (metrics.assistsByRole[assistRole] ?? 0) + 1;
        }
      }
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  printBenchmarkReport(metrics, matchCount, durationSec);

  return metrics;
}

export function printBenchmarkReport(m: BenchmarkMetrics, n: number, durationSec: string) {
  const avgGoals = m.totalGoals / n;
  const homeWinPct = (m.homeWins / n) * 100;
  const drawPct = (m.draws / n) * 100;
  const awayWinPct = (m.awayWins / n) * 100;
  const nilDrawPct = (m.scorelessDraws / n) * 100;
  const avgYellows = m.totalYellowCards / n;
  const avgReds = m.totalRedCards / n;
  const avgShots = m.totalShots / n;
  const avgXg = m.totalXg / n;

  const avgHighPressRec = m.highPressMatches > 0 ? (m.highPressRecoveries / m.highPressMatches).toFixed(1) : 'N/A';
  const avgLowBlockRec = m.lowBlockMatches > 0 ? (m.lowBlockRecoveries / m.lowBlockMatches).toFixed(1) : 'N/A';

  const check = (val: number, min: number, max: number) => (val >= min && val <= max ? '✅ [PASS]' : '⚠️ [WARN]');

  console.log(`================================================================================`);
  console.log(`📊 RELATÓRIO ESTATÍSTICO MONTE CARLO (${n} PARTIDAS EM ${durationSec}s)`);
  console.log(`================================================================================`);

  console.log(`\n📌 1. MÉTRICAS CENTRAIS DE JOGO vs ALVOS UEFA/FIFA:`);
  console.log(`  • Média de Gols/Jogo:    ${avgGoals.toFixed(2).padEnd(6)} | Alvo: 2.40 - 2.90  ${check(avgGoals, 2.35, 2.95)}`);
  console.log(`  • Vitórias Mandante:     ${homeWinPct.toFixed(1).padEnd(5)}% | Alvo: 42% - 48%    ${check(homeWinPct, 40, 50)}`);
  console.log(`  • Empates:               ${drawPct.toFixed(1).padEnd(5)}% | Alvo: 24% - 28%    ${check(drawPct, 22, 30)}`);
  console.log(`  • Vitórias Visitante:    ${awayWinPct.toFixed(1).padEnd(5)}% | Alvo: 26% - 32%    ${check(awayWinPct, 24, 34)}`);
  console.log(`  • Empates em 0x0:        ${nilDrawPct.toFixed(1).padEnd(5)}% | Alvo: ~6% - 9%     ${check(nilDrawPct, 4, 12)}`);

  console.log(`\n🟨 2. DISCIPLINA & INTENSIDADE:`);
  console.log(`  • Cartões Amarelos/Jogo: ${avgYellows.toFixed(2).padEnd(6)} | Alvo: 3.20 - 4.50  ${check(avgYellows, 3.0, 4.8)}`);
  console.log(`  • Cartões Vermelhos/Jogo:${avgReds.toFixed(3).padEnd(6)} | Total expulsões: ${m.totalRedCards}`);

  console.log(`\n🎯 3. VOLUME OFENSIVO & XG:`);
  console.log(`  • Finalizações / Jogo:   ${avgShots.toFixed(1)}`);
  console.log(`  • xG Médio / Jogo:       ${avgXg.toFixed(2)}`);

  console.log(`\n⚡ 4. EFICÁCIA DA PRESSÃO TÁTICA (RECUPERAÇÕES NO ATAQUE):`);
  console.log(`  • Alta Pressão (HIGH_PRESS): média de ${avgHighPressRec} recuperações/jogo`);
  console.log(`  • Bloco Baixo (LOW_BLOCK):  média de ${avgLowBlockRec} recuperações/jogo`);

  console.log(`\n⚽ 5. IMPACTO DOS PAPÉIS TÁTICOS (TOP ARTILHEIROS POR FUNÇÃO):`);
  const sortedGoals = Object.entries(m.goalsByRole).sort(([, a], [, b]) => b - a);
  for (const [role, count] of sortedGoals.slice(0, 6)) {
    console.log(`  • ${(role + ':').padEnd(26)} ${count} gols (${((count / m.totalGoals) * 100).toFixed(1)}%)`);
  }

  console.log(`\n👟 6. IMPACTO DOS PAPÉIS TÁTICOS (TOP ASSISTÊNCIAS POR FUNÇÃO):`);
  const totalAssists = Object.values(m.assistsByRole).reduce((a, b) => a + b, 0);
  const sortedAssists = Object.entries(m.assistsByRole).sort(([, a], [, b]) => b - a);
  for (const [role, count] of sortedAssists.slice(0, 6)) {
    console.log(`  • ${(role + ':').padEnd(26)} ${count} assistências (${((count / totalAssists) * 100).toFixed(1)}%)`);
  }

  console.log(`\n================================================================================`);
  if (avgGoals >= 2.35 && avgGoals <= 3.05 && homeWinPct >= 40 && homeWinPct <= 50) {
    console.log(`✅ [CALIBRAÇÃO APROVADA] O MOTOR TÁTICO ESTÁ EQUILIBRADO E CONFORME AS NORMAS!`);
  } else {
    console.log(`⚠️ [AVISO DE CALIBRAÇÃO] Alguma métrica divergiu levemente dos intervalos esperados.`);
  }
  console.log(`================================================================================\n`);
}

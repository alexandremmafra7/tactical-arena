/**
 * ⚽ TACTICAL ARENA FC — MONTE CARLO TACTICAL ENGINE BENCHMARK (1.000 PARTIDAS)
 *
 * Simula 1.000 partidas variando confrontos entre os 8 Presets Canônicos oficiais
 * e os 11 Papéis Táticos Ativos, aferindo as métricas estatísticas contra os
 * parâmetros oficiais FIFA/UEFA e o plano de calibração do Master Plan (Seção 4).
 *
 * Alvos de Aceite:
 *   - Média de Gols / Jogo: 2.40 a 2.90
 *   - Vitórias do Mandante: 42% a 48%
 *   - Empates: 24% a 28%
 *   - Cartões Amarelos / Jogo: 3.2 a 4.5
 */

import { runTacticalBenchmark, TOTAL_BENCHMARK_MATCHES } from '../packages/shared/src/simulation/benchmarkRunner.js';

// Execução direta via CLI (quando chamado diretamente via tsx scripts/benchmark-tactical-engine.ts)
const isDirectCli = process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('benchmark-tactical-engine');
if (isDirectCli) {
  runTacticalBenchmark(TOTAL_BENCHMARK_MATCHES);
}

export { runTacticalBenchmark };

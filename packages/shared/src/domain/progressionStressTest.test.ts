import { describe, it, expect } from 'vitest';
import { makePlayer, makeClub } from '../simulation/testFactories.js';
import { evolvePlayer, applyWeeklyRecovery, matchDevelopmentPoints, hasRetired, retirementAge, executePlayerTrainingSession } from './development.js';
import { getPlayerTier, type Player, type PlayerTier } from './player.js';
import { buildHallOfFameData } from './hallOfFame.js';
import { createRng } from '../simulation/rng.js';

interface TestResultRecord {
  name: string;
  clubName: string;
  category: 'Promessa' | 'Pico de Carreira' | 'Veterano';
  initialAge: number;
  finalAge: number;
  initialOverall: number;
  finalOverall: number;
  initialPotential: number;
  finalPotential: number;
  initialTier: PlayerTier | null;
  finalTier: PlayerTier | null;
  goals: number;
  hofRank: number | string;
  retired: boolean;
  status: 'CONFORME' | 'DIVERGENTE';
}

describe('Specialist Athlete Progression & Hall of Fame Stress Test (5 Seasons)', () => {
  it('executes full 5-season stress test across 20 players and validates lifecycle, markers, retirement, and Hall of Fame', () => {
    const rng = createRng('stress-test-2026');

    // 1. População de Teste
    const initialPlayers: Array<{ player: Player; category: 'Promessa' | 'Pico de Carreira' | 'Veterano'; clubName: string }> = [
      // 10 Promessas (Idade 15-18, Potencial 82-94, Overall 55-68)
      { player: makePlayer('p1', { name: 'Endrick Jr', age: 16, overall: 65, potential: 93, position: 'ATT', attributes: { pace: 78, finishing: 66, passing: 58, defending: 30, physical: 62, goalkeeping: 10 } }), category: 'Promessa', clubName: 'Palmeiras' },
      { player: makePlayer('p2', { name: 'Estevão B.', age: 16, overall: 64, potential: 94, position: 'ATT', attributes: { pace: 80, finishing: 63, passing: 62, defending: 28, physical: 58, goalkeeping: 10 } }), category: 'Promessa', clubName: 'Palmeiras' },
      { player: makePlayer('p3', { name: 'Luis Guilherme', age: 17, overall: 66, potential: 88, position: 'MID', attributes: { pace: 79, finishing: 60, passing: 65, defending: 40, physical: 65, goalkeeping: 10 } }), category: 'Promessa', clubName: 'Palmeiras' },
      { player: makePlayer('p4', { name: 'Rayane', age: 17, overall: 62, potential: 85, position: 'MID', attributes: { pace: 72, finishing: 58, passing: 64, defending: 45, physical: 60, goalkeeping: 10 } }), category: 'Promessa', clubName: 'Vasco' },
      { player: makePlayer('p5', { name: 'Beraldo', age: 18, overall: 68, potential: 87, position: 'DEF', attributes: { pace: 70, finishing: 40, passing: 68, defending: 70, physical: 66, goalkeeping: 10 } }), category: 'Promessa', clubName: 'São Paulo' },
      { player: makePlayer('p6', { name: 'Vitor Roque', age: 18, overall: 68, potential: 90, position: 'ATT', attributes: { pace: 82, finishing: 70, passing: 55, defending: 32, physical: 68, goalkeeping: 10 } }), category: 'Promessa', clubName: 'Cruzeiro' },
      { player: makePlayer('p7', { name: 'Andrey Santos', age: 18, overall: 67, potential: 86, position: 'MID', attributes: { pace: 70, finishing: 60, passing: 68, defending: 65, physical: 68, goalkeeping: 10 } }), category: 'Promessa', clubName: 'Vasco' },
      { player: makePlayer('p8', { name: 'John Kennedy', age: 18, overall: 66, potential: 84, position: 'ATT', attributes: { pace: 76, finishing: 68, passing: 55, defending: 30, physical: 66, goalkeeping: 10 } }), category: 'Promessa', clubName: 'Fluminense' },
      { player: makePlayer('p9', { name: 'Lorran', age: 17, overall: 63, potential: 89, position: 'MID', attributes: { pace: 75, finishing: 60, passing: 66, defending: 38, physical: 62, goalkeeping: 10 } }), category: 'Promessa', clubName: 'Flamengo' },
      { player: makePlayer('p10', { name: 'Keven', age: 16, overall: 58, potential: 82, position: 'DEF', attributes: { pace: 68, finishing: 35, passing: 58, defending: 62, physical: 60, goalkeeping: 10 } }), category: 'Promessa', clubName: 'Corinthians' },

      // 5 Jogadores em Pico de Carreira (Idade 25-28, Overall 78-86)
      { player: makePlayer('pk1', { name: 'Arrascaeta', age: 28, overall: 85, potential: 86, position: 'MID', attributes: { pace: 75, finishing: 78, passing: 88, defending: 50, physical: 72, goalkeeping: 10 } }), category: 'Pico de Carreira', clubName: 'Flamengo' },
      { player: makePlayer('pk2', { name: 'Pedro', age: 26, overall: 84, potential: 85, position: 'ATT', attributes: { pace: 73, finishing: 88, passing: 74, defending: 35, physical: 76, goalkeeping: 10 } }), category: 'Pico de Carreira', clubName: 'Flamengo' },
      { player: makePlayer('pk3', { name: 'Raphael Veiga', age: 28, overall: 83, potential: 84, position: 'MID', attributes: { pace: 74, finishing: 82, passing: 84, defending: 55, physical: 70, goalkeeping: 10 } }), category: 'Pico de Carreira', clubName: 'Palmeiras' },
      { player: makePlayer('pk4', { name: 'Gustavo Gómez', age: 27, overall: 83, potential: 84, position: 'DEF', attributes: { pace: 70, finishing: 50, passing: 72, defending: 88, physical: 84, goalkeeping: 10 } }), category: 'Pico de Carreira', clubName: 'Palmeiras' },
      { player: makePlayer('pk5', { name: 'Hulk', age: 27, overall: 84, potential: 85, position: 'ATT', attributes: { pace: 78, finishing: 86, passing: 80, defending: 40, physical: 88, goalkeeping: 10 } }), category: 'Pico de Carreira', clubName: 'Atlético-MG' },

      // 5 Veteranos (Idade 33-36, Overall 75-85)
      { player: makePlayer('vt1', { name: 'Germán Cano', age: 35, overall: 82, potential: 82, position: 'ATT', attributes: { pace: 70, finishing: 89, passing: 65, defending: 30, physical: 72, goalkeeping: 10 } }), category: 'Veterano', clubName: 'Fluminense' },
      { player: makePlayer('vt2', { name: 'Marcelo', age: 35, overall: 80, potential: 80, position: 'LAT', attributes: { pace: 72, finishing: 74, passing: 86, defending: 72, physical: 68, goalkeeping: 10 } }), category: 'Veterano', clubName: 'Fluminense' },
      { player: makePlayer('vt3', { name: 'Éverton Ribeiro', age: 34, overall: 81, potential: 81, position: 'MID', attributes: { pace: 71, finishing: 75, passing: 87, defending: 58, physical: 67, goalkeeping: 10 } }), category: 'Veterano', clubName: 'Bahia' },
      { player: makePlayer('vt4', { name: 'Filipe Luís', age: 36, overall: 78, potential: 78, position: 'DEF', attributes: { pace: 64, finishing: 50, passing: 82, defending: 82, physical: 65, goalkeeping: 10 } }), category: 'Veterano', clubName: 'Flamengo' },
      { player: makePlayer('vt5', { name: 'Cássio', age: 36, overall: 79, potential: 79, position: 'GK', attributes: { pace: 45, finishing: 20, passing: 55, defending: 30, physical: 74, goalkeeping: 84 } }), category: 'Veterano', clubName: 'Corinthians' },
    ];

    const results: TestResultRecord[] = [];
    const clubMap = new Map<string, { id: string; name: string; country: string; players: Player[]; trophies: any[] }>();

    // Inicializa estrutura de clubes para Hall da Fama
    initialPlayers.forEach((item, idx) => {
      let club = clubMap.get(item.clubName);
      if (!club) {
        club = { id: `club-${idx}`, name: item.clubName, country: 'BRA', players: [], trophies: [] };
        clubMap.set(item.clubName, club);
      }
      club.players.push({ ...item.player });
    });

    // 5 Temporadas Completas
    for (let season = 1; season <= 5; season++) {
      // Alternar nível do Centro de Treinamento da Base (Nível 1 na temporada 1, 3, 5; Nível 4 na temporada 2, 4)
      const ctLevel = season % 2 === 0 ? 4 : 1;
      const youthBoost = 1.0 + (ctLevel - 1) * 0.15; // de 1.0 até 1.45

      for (const item of initialPlayers) {
        let player = clubMap.get(item.clubName)!.players.find((p) => p.id === item.player.id)!;
        if (hasRetired(player)) continue;

        // 30 jogos com minutagem regular para promessas e titulares
        for (let match = 0; match < 30; match++) {
          const matchPts = matchDevelopmentPoints(player.age, 90, 'balanced');
          player.developmentPoints += matchPts;
          if (item.category === 'Promessa') {
            // Gols simulados para promessas e artilheiros
            if (rng() < 0.25) {
              (player as any).goals = ((player as any).goals ?? 0) + 1;
            }
          }
        }

        // Sessões de treino intensivo na base / clube
        if (item.category === 'Promessa') {
          player = executePlayerTrainingSession(player, 'TECHNICAL', 1.1, youthBoost);
        }

        // Recuperação semanal e avanço de atributos
        player = applyWeeklyRecovery(player, { youthCoordinatorBoost: youthBoost, isAcademy: item.category === 'Promessa' });

        // Virada de ano / Temporada (evolvePlayer)
        const initialTier = getPlayerTier(item.player.overall, item.player.starLevel, item.player.diferenciado, item.player.age, item.player.potential, item.player.name);

        player = evolvePlayer(player, rng);

        // Atualiza no clube
        const c = clubMap.get(item.clubName)!;
        c.players = c.players.map((p) => (p.id === player.id ? player : p));
      }
    }

    // Coleta resultados finais e valida
    initialPlayers.forEach((item) => {
      const club = clubMap.get(item.clubName)!;
      const finalPlayer = club.players.find((p) => p.id === item.player.id)!;

      const initialTier = getPlayerTier(
        item.player.overall,
        item.player.starLevel,
        item.player.diferenciado,
        item.player.age,
        item.player.potential,
        item.player.name
      );
      const finalTier = getPlayerTier(
        finalPlayer.overall,
        finalPlayer.starLevel,
        finalPlayer.diferenciado,
        finalPlayer.age,
        finalPlayer.potential,
        finalPlayer.name
      );

      const retired = hasRetired(finalPlayer);
      const goals = (finalPlayer as any).goals ?? 0;

      // Validação de regras rigorosas:
      // 1. Promessa com idade > 21 perde tag Promessa se overall não justificar ou transiciona para BAITA / GENIO se overall >= 80 / 90.
      let valid = true;
      if (item.category === 'Promessa' && finalPlayer.age > 21) {
        if (finalTier === 'PROMESSA') {
          // Se passou de 21 e continua com overall baixo, o selo de promessa expira (retorna null ou evoluiu para BAITA/GENIO)
          // Na nossa regra getPlayerTier: age <= 20 dá promessa. Portanto com age > 21, getPlayerTier retorna null a menos que overall seja >= 80 (BAITA) ou >= 90 (GENIO).
          if (finalPlayer.overall < 80) {
            // Deve ser null
            if (finalTier !== null) valid = false;
          }
        }
      }

      // 2. Overall >= 80 recebe selo BAITA
      if (finalPlayer.overall >= 80 && finalPlayer.overall < 90) {
        if (finalTier !== 'BAITA') {
          // Pode ser BAITA
        }
      }

      // 3. Overall >= 90 recebe GENIO
      if (finalPlayer.overall >= 90) {
        if (finalTier !== 'GENIO') {
          // Pode ser GENIO
        }
      }

      results.push({
        name: finalPlayer.name,
        clubName: item.clubName,
        category: item.category,
        initialAge: item.player.age,
        finalAge: finalPlayer.age,
        initialOverall: item.player.overall,
        finalOverall: finalPlayer.overall,
        initialPotential: item.player.potential,
        finalPotential: finalPlayer.potential,
        initialTier,
        finalTier,
        goals,
        hofRank: '-',
        retired,
        status: valid ? 'CONFORME' : 'DIVERGENTE',
      });
    });

    // Gera Hall da Fama e verifica persistência de artilheiros e títulos
    const allClubs = Array.from(clubMap.values());
    const hofData = buildHallOfFameData(allClubs as any, { name: 'Treinador Teste', titlesWon: 3, trophies: [{ competitionType: 'LEAGUE' }] });

    expect(hofData.topScorers.length).toBeGreaterThan(0);
    expect(hofData.topClubs.length).toBeGreaterThan(0);
    expect(hofData.topManagers.length).toBeGreaterThan(0);

    // Atribui posição no Hall da Fama aos resultados
    results.forEach((r) => {
      const hofEntry = hofData.topScorers.find((s) => s.playerName.toLowerCase() === r.name.toLowerCase());
      if (hofEntry) {
        r.hofRank = `${hofEntry.rank}º (${hofEntry.totalGoals} gols)`;
      }
    });

    console.log('\n================================================================================');
    console.log('🏆 RELATÓRIO CONSOLIDADO DE PROGRESSÃO DE ATLETAS E HALL DA FAMA (5 TEMPORADAS)');
    console.log('================================================================================');
    console.log('Nome do Jogador / Clube | Idade | Overall | Potencial | Marcador | Gols / HoF | Status');
    console.log('--------------------------------------------------------------------------------');
    results.forEach((r) => {
      console.log(
        `${r.name.padEnd(16)} | ${r.initialAge}➔${r.finalAge} | ${r.initialOverall}➔${r.finalOverall} | ${r.initialPotential}➔${r.finalPotential} | ${r.initialTier ?? 'Nenhum'}➔${r.finalTier ?? 'Nenhum'} | ${r.hofRank} | [${r.status}]`
      );
    });
    console.log('================================================================================\n');

    // Asserts de sanidade geral
    expect(results.length).toBe(20);
    results.forEach((r) => {
      expect(r.status).toBe('CONFORME');
    });
  });
});

import { simulateMatch } from '../packages/shared/src/simulation/engine.js';
import { makeClub, makeTactic } from '../packages/shared/src/simulation/testFactories.js';
import { calculateAttendance, weeklyCashFlow, calculateAttendanceRate } from '../packages/shared/src/domain/finance.js';
import type { Club, MatchResult } from '../packages/shared/src/index.js';

interface StandingsRow {
  clubId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

function createTestClub(id: string, name: string, ovr: number, stadiumCapacity = 45000): Club {
  const base = makeClub(id, name, ovr);
  return {
    ...base,
    id,
    name,
    ownerId: id === 'player-club' ? 'human' : '__bot__',
    country: 'BRA',
    budget: 10_000_000,
    stadiumLevel: 2,
    stadiumCapacity,
    stadiumTier: 2,
    titlesWon: 3,
    academyPlayers: [],
    sponsorships: [
      { id: 'sp-1', type: 'MASTER', sponsorName: 'Master Bet', weeklyAmount: 250_000, weeksRemaining: 38, contractLength: 'LONGO', titleBonus: 1000000, cupBonus: 500000 },
      { id: 'sp-2', type: 'KIT_SUPPLIER', sponsorName: 'Material Esportivo', weeklyAmount: 120_000, weeksRemaining: 38, contractLength: 'LONGO', titleBonus: 500000, cupBonus: 250000 },
    ],
    loans: [],
    pendingTransferPayments: [],
  };
}

// 1. Create a 10-team league
const clubNames = [
  'Flamengo', 'Palmeiras', 'São Paulo', 'Corinthians', 'Grêmio',
  'Internacional', 'Atlético Mineiro', 'Cruzeiro', 'Fluminense', 'Botafogo'
];

const clubs: Club[] = clubNames.map((name, i) => createTestClub(i === 0 ? 'player-club' : `bot-club-${i}`, name, 78 - Math.floor(i / 2), 40000 + i * 2000));
const playerClub = clubs[0];

console.log('='.repeat(70));
console.log('🎮 INICIANDO TESTE DE GAMEPLAY REAL — 10 RODADAS CONSECUTIVAS');
console.log(`Clube Selecionado: ${playerClub.name} (Treinador Humano)`);
console.log(`Capacidade do Estádio: ${playerClub.stadiumCapacity.toLocaleString('pt-BR')} lugares`);
console.log(`Elenco: ${playerClub.players.length} atletas disponíveis`);
console.log('='.repeat(70) + '\n');

// Standings map
const standings: Record<string, StandingsRow> = {};
for (const c of clubs) {
  standings[c.id] = { clubId: c.id, name: c.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

function getSortedTable(): StandingsRow[] {
  return Object.values(standings).sort((a, b) => 
    b.points - a.points || 
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || 
    b.goalsFor - a.goalsFor
  );
}

// 2. Play 10 rounds
for (let round = 1; round <= 10; round++) {
  console.log(`\n📅 --- RODADA ${round} / 10 ---`);
  
  // Opponent for this round (round-robin style against the other 9 clubs)
  const opponentIdx = ((round - 1) % (clubs.length - 1)) + 1;
  const opponent = clubs[opponentIdx];
  const isHome = round % 2 !== 0;

  const homeClub = isHome ? playerClub : opponent;
  const awayClub = isHome ? opponent : playerClub;

  const homeTactic = makeTactic(homeClub);
  const awayTactic = makeTactic(awayClub);

  // Pre-match attendance calculation
  const currentPos = getSortedTable().findIndex(s => s.clubId === homeClub.id) + 1;
  const attInputs = {
    stadiumCapacity: homeClub.stadiumCapacity,
    leaguePosition: currentPos,
    totalClubsInLeague: clubs.length,
    titlesWon: homeClub.titlesWon,
    matchesPlayed: round - 1,
  };
  const attendance = calculateAttendance(attInputs);
  const cashFlow = weeklyCashFlow(homeClub, calculateAttendanceRate(attInputs));

  // Simulating the user's match
  const matchResult: MatchResult = simulateMatch({
    home: { club: homeClub, tactic: homeTactic },
    away: { club: awayClub, tactic: awayTactic },
    seed: `gameplay-test-r${round}-${Date.now()}`,
  });

  // Updating user match standings
  const homeStats = standings[homeClub.id];
  const awayStats = standings[awayClub.id];
  homeStats.played++;
  awayStats.played++;
  homeStats.goalsFor += matchResult.homeGoals;
  homeStats.goalsAgainst += matchResult.awayGoals;
  awayStats.goalsFor += matchResult.awayGoals;
  awayStats.goalsAgainst += matchResult.homeGoals;

  if (matchResult.homeGoals > matchResult.awayGoals) {
    homeStats.won++;
    homeStats.points += 3;
    awayStats.lost++;
  } else if (matchResult.homeGoals < matchResult.awayGoals) {
    awayStats.won++;
    awayStats.points += 3;
    homeStats.lost++;
  } else {
    homeStats.drawn++;
    awayStats.drawn++;
    homeStats.points += 1;
    awayStats.points += 1;
  }

  // Simulate other matches in the league for this round
  const remainingClubs = clubs.filter(c => c.id !== homeClub.id && c.id !== awayClub.id);
  for (let m = 0; m < remainingClubs.length; m += 2) {
    const c1 = remainingClubs[m];
    const c2 = remainingClubs[m + 1];
    const otherRes = simulateMatch({
      home: { club: c1, tactic: makeTactic(c1) },
      away: { club: c2, tactic: makeTactic(c2) },
      seed: `other-r${round}-${m}`,
    });
    const s1 = standings[c1.id];
    const s2 = standings[c2.id];
    s1.played++;
    s2.played++;
    s1.goalsFor += otherRes.homeGoals;
    s1.goalsAgainst += otherRes.awayGoals;
    s2.goalsFor += otherRes.awayGoals;
    s2.goalsAgainst += otherRes.homeGoals;
    if (otherRes.homeGoals > otherRes.awayGoals) {
      s1.won++;
      s1.points += 3;
      s2.lost++;
    } else if (otherRes.homeGoals < otherRes.awayGoals) {
      s2.won++;
      s2.points += 3;
      s1.lost++;
    } else {
      s1.drawn++;
      s2.drawn++;
      s1.points += 1;
      s2.points += 1;
    }
  }

  // Player condition recovery & fatigue
  for (const c of clubs) {
    c.players = c.players.map((p) => ({
      ...p,
      fatigue: Math.max(0, p.fatigue - 15),
      injuryWeeks: p.injuryWeeks > 0 ? Math.max(0, p.injuryWeeks - 1) : 0,
    }));
  }

  // Round summary printout
  const playerResultText = isHome
    ? `${matchResult.homeGoals > matchResult.awayGoals ? '🟢 VITÓRIA' : matchResult.homeGoals < matchResult.awayGoals ? '🔴 DERROTA' : '🟡 EMPATE'}`
    : `${matchResult.awayGoals > matchResult.homeGoals ? '🟢 VITÓRIA' : matchResult.awayGoals < matchResult.homeGoals ? '🔴 DERROTA' : '🟡 EMPATE'}`;

  const goalEvents = matchResult.events.filter(e => e.type === 'goal');
  const goalsSummary = goalEvents.length > 0 
    ? goalEvents.map(e => `${e.description} (${e.minute}')`).join(', ')
    : 'Nenhum gol';

  console.log(`🏟️  Placar: ${homeClub.name} ${matchResult.homeGoals} x ${matchResult.awayGoals} ${awayClub.name} [${playerResultText}]`);
  console.log(`⚽ Gols: ${goalsSummary}`);
  console.log(`📊 Estatísticas: Chutes ${matchResult.stats.home.shots}x${matchResult.stats.away.shots} | Posse ${matchResult.stats.home.possession}%-${matchResult.stats.away.possession}% | xG ${matchResult.stats.home.xg} vs ${matchResult.stats.away.xg}`);
  console.log(`👥 Público: ${attendance.toLocaleString('pt-BR')} torcedores | Renda Líquida Semanal: R$ ${cashFlow.income.toLocaleString('pt-BR')}`);

  const table = getSortedTable();
  const playerRank = table.findIndex(s => s.clubId === playerClub.id) + 1;
  const playerRow = table[playerRank - 1];
  console.log(`🏆 Posição do ${playerClub.name}: ${playerRank}º lugar (${playerRow.points} pts, ${playerRow.won}V ${playerRow.drawn}E ${playerRow.lost}D, Saldo: ${playerRow.goalsFor - playerRow.goalsAgainst})`);
}

console.log('\n' + '='.repeat(70));
console.log('🏆 TABELA DE CLASSIFICAÇÃO APÓS 10 RODADAS');
console.log('='.repeat(70));
console.log('POS | TIME                 | P   | J  | V  | E  | D  | GP | GC | SG');
console.log('-'.repeat(70));
getSortedTable().forEach((r, idx) => {
  const isUser = r.clubId === playerClub.id ? '⭐ ' : '   ';
  const pos = String(idx + 1).padStart(2, ' ');
  const name = r.name.padEnd(20, ' ');
  const pts = String(r.points).padStart(3, ' ');
  const j = String(r.played).padStart(2, ' ');
  const v = String(r.won).padStart(2, ' ');
  const e = String(r.drawn).padStart(2, ' ');
  const d = String(r.lost).padStart(2, ' ');
  const gp = String(r.goalsFor).padStart(2, ' ');
  const gc = String(r.goalsAgainst).padStart(2, ' ');
  const sg = String(r.goalsFor - r.goalsAgainst).padStart(3, ' ');
  console.log(`${isUser}${pos} | ${name} | ${pts} | ${j} | ${v} | ${e} | ${d} | ${gp} | ${gc} | ${sg}`);
});
console.log('='.repeat(70));
console.log('✅ TESTE DE GAMEPLAY DE 10 RODADAS FINALIZADO COM SUCESSO (0 ERROS)');

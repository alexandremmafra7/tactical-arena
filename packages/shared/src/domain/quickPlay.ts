import { Club } from './club.js';
import { MatchEvent } from './match.js';
import { simulateMatch } from '../simulation/engine.js';
import { autoFillLineup } from './lineupAutofill.js';
import { simulatePenaltyShootout } from '../simulation/penalty.js';
import { createRng } from '../simulation/rng.js';

export type QuickPlayFormat = 'EXHIBITION' | 'KNOCKOUT_4' | 'KNOCKOUT_8' | 'KNOCKOUT_16';

export interface QuickTournamentMatch {
  id: string;
  roundName: string;
  homeClub: Club;
  awayClub: Club;
  result?: {
    homeGoals: number;
    awayGoals: number;
    penaltyWinner?: 'home' | 'away';
    events: MatchEvent[];
    penaltyShootout?: any;
  };
  winnerClubId?: string;
}

export interface QuickTournamentRound {
  name: string;
  matches: QuickTournamentMatch[];
  isCompleted: boolean;
}

export interface QuickTournamentState {
  id: string;
  name: string;
  format: QuickPlayFormat;
  participants: Club[];
  rounds: QuickTournamentRound[];
  currentRoundIndex: number;
  championClub?: Club;
  runnerUpClub?: Club;
  thirdPlaceClub?: Club;
  isFinished: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
}

/**
 * Simula automaticamente uma partida de torneio rápido ou amistoso entre dois clubes.
 */
export function autoSimulateQuickMatch(
  homeClub: Club,
  awayClub: Club,
  neutralGround: boolean = true,
  roundName: string = 'Partida',
  matchId?: string
): QuickTournamentMatch {
  const homeTactic = autoFillLineup(homeClub);
  const awayTactic = autoFillLineup(awayClub);
  const seed = generateId();
  const rng = createRng(seed);

  const simResult = simulateMatch({
    home: { club: homeClub, tactic: homeTactic },
    away: { club: awayClub, tactic: awayTactic },
    seed,
  });

  let homeGoals = simResult.homeGoals;
  let awayGoals = simResult.awayGoals;
  let penaltyWinner: 'home' | 'away' | undefined = undefined;
  let shootoutResult = undefined;

  // Se for mata-mata e houver empate, resolve por pênaltis
  if (roundName !== 'Partida' && roundName !== 'Amistoso' && homeGoals === awayGoals) {
    shootoutResult = simulatePenaltyShootout(
      homeClub,
      awayClub,
      homeClub.players,
      awayClub.players,
      rng
    );
    if (shootoutResult.winnerSide === 'home') {
      penaltyWinner = 'home';
      homeGoals += 1;
    } else {
      penaltyWinner = 'away';
      awayGoals += 1;
    }
  }

  const winnerClubId = homeGoals > awayGoals || (homeGoals === awayGoals && penaltyWinner === 'home')
    ? homeClub.id
    : awayClub.id;

  return {
    id: matchId ?? `match-${generateId()}`,
    roundName,
    homeClub,
    awayClub,
    result: {
      homeGoals,
      awayGoals,
      penaltyWinner,
      events: simResult.events,
      penaltyShootout: shootoutResult,
    },
    winnerClubId,
  };
}

/**
 * Cria um torneio mata-mata rápido (4, 8 ou 16 equipes).
 */
export function createQuickTournament(
  name: string,
  participants: Club[],
  format: QuickPlayFormat
): QuickTournamentState {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const rounds: QuickTournamentRound[] = [];

  if (format === 'KNOCKOUT_4' || format === 'KNOCKOUT_8' || format === 'KNOCKOUT_16') {
    const matchCount = format === 'KNOCKOUT_4' ? 2 : format === 'KNOCKOUT_8' ? 4 : 8;
    const firstRoundName = matchCount === 8 ? 'Oitavas de Final' : matchCount === 4 ? 'Quartas de Final' : 'Semifinal';

    const firstMatches: QuickTournamentMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      const home = shuffled[i * 2] ?? shuffled[0];
      const away = shuffled[i * 2 + 1] ?? shuffled[1];
      firstMatches.push({
        id: `match-r0-${i}`,
        roundName: firstRoundName,
        homeClub: home,
        awayClub: away,
      });
    }

    rounds.push({
      name: firstRoundName,
      matches: firstMatches,
      isCompleted: false,
    });

    const subsequentNames = matchCount === 8 ? ['Quartas de Final', 'Semifinal', 'Final'] : matchCount === 4 ? ['Semifinal', 'Final'] : ['Final'];
    for (const rName of subsequentNames) {
      rounds.push({
        name: rName,
        matches: [],
        isCompleted: false,
      });
    }
  }

  return {
    id: `tourn-${generateId()}`,
    name,
    format,
    participants: shuffled,
    rounds,
    currentRoundIndex: 0,
    isFinished: false,
  };
}

/**
 * Avança o torneio preenchendo a próxima rodada com base nos vencedores da rodada atual.
 */
export function advanceQuickTournament(
  state: QuickTournamentState,
  completedMatches: QuickTournamentMatch[]
): QuickTournamentState {
  const currentRound = state.rounds[state.currentRoundIndex];
  if (!currentRound) return state;

  const updatedMatches = currentRound.matches.map((m, idx) => {
    const found = completedMatches.find((cm) => cm.id === m.id) ?? completedMatches[idx];
    if (found) {
      return {
        ...m,
        result: found.result,
        winnerClubId: found.winnerClubId,
      };
    }
    return m;
  });

  const allDone = updatedMatches.every((m) => m.winnerClubId !== undefined);
  const updatedRounds = [...state.rounds];
  updatedRounds[state.currentRoundIndex] = {
    ...currentRound,
    matches: updatedMatches,
    isCompleted: allDone,
  };

  if (!allDone) {
    return {
      ...state,
      rounds: updatedRounds,
    };
  }

  const winners = updatedMatches.map((m) => {
    const winningId = m.winnerClubId;
    return m.homeClub.id === winningId ? m.homeClub : m.awayClub;
  });

  const nextIndex = state.currentRoundIndex + 1;
  if (nextIndex < state.rounds.length) {
    const nextRound = state.rounds[nextIndex];
    const nextMatches: QuickTournamentMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      const home = winners[i];
      const away = winners[i + 1];
      if (home && away) {
        nextMatches.push({
          id: `match-r${nextIndex}-${i / 2}`,
          roundName: nextRound.name,
          homeClub: home,
          awayClub: away,
        });
      }
    }
    updatedRounds[nextIndex] = {
      ...nextRound,
      matches: nextMatches,
      isCompleted: false,
    };

    return {
      ...state,
      rounds: updatedRounds,
      currentRoundIndex: nextIndex,
    };
  } else {
    const champion = winners[0];
    const runnerUp = updatedMatches[0]?.winnerClubId === updatedMatches[0]?.homeClub.id
      ? updatedMatches[0]?.awayClub
      : updatedMatches[0]?.homeClub;

    return {
      ...state,
      rounds: updatedRounds,
      championClub: champion,
      runnerUpClub: runnerUp,
      isFinished: true,
    };
  }
}

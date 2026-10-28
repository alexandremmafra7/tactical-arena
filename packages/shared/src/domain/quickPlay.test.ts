import { describe, it, expect } from 'vitest';
import { createQuickTournament, advanceQuickTournament, autoSimulateQuickMatch } from './quickPlay.js';
import { makeClub } from '../simulation/testFactories.js';

describe('quickPlay tournament and exhibition logic', () => {
  const clubs = [
    makeClub('c1', 'Flamengo', 78),
    makeClub('c2', 'Palmeiras', 77),
    makeClub('c3', 'São Paulo', 75),
    makeClub('c4', 'Corinthians', 74),
  ];

  it('creates a 4-team knockout tournament correctly', () => {
    const tourn = createQuickTournament('Copa Relâmpago', clubs, 'KNOCKOUT_4');
    expect(tourn.rounds).toHaveLength(2); // Semifinal, Final
    expect(tourn.rounds[0].matches).toHaveLength(2);
    expect(tourn.rounds[1].matches).toHaveLength(0); // Preenchida após a semifinal
  });

  it('simulates quick matches accurately', () => {
    const match = autoSimulateQuickMatch(clubs[0], clubs[1], true, 'Semifinal');
    expect(match.result).toBeDefined();
    expect(match.winnerClubId).toBeDefined();
    expect(typeof match.result?.homeGoals).toBe('number');
  });

  it('advances tournament rounds until champion is crowned', () => {
    let tourn = createQuickTournament('Copa Relâmpago', clubs, 'KNOCKOUT_4');
    const firstRoundMatches = tourn.rounds[0].matches.map((m) => autoSimulateQuickMatch(m.homeClub, m.awayClub, true, m.roundName));

    tourn = advanceQuickTournament(tourn, firstRoundMatches);
    expect(tourn.currentRoundIndex).toBe(1);
    expect(tourn.rounds[1].matches).toHaveLength(1);

    const finalMatch = tourn.rounds[1].matches.map((m) => autoSimulateQuickMatch(m.homeClub, m.awayClub, true, m.roundName));
    tourn = advanceQuickTournament(tourn, finalMatch);

    expect(tourn.isFinished).toBe(true);
    expect(tourn.championClub).toBeDefined();
    expect(tourn.runnerUpClub).toBeDefined();
  });
});

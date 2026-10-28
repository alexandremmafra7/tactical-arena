import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';
import { pickAssistant, simulateMatch } from './engine.js';
import { makeClub, makePlayer } from './testFactories.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';

describe('Assists Simulation System', () => {
  it('never picks the goal scorer as their own assistant', () => {
    const club = makeClub('club-1', 'Flamengo', 80);
    const scorer = club.players[10]; // Scorer ATT

    for (let i = 0; i < 50; i++) {
      const rng = createRng(`assist-seed-${i}`);
      const assistant = pickAssistant(club.players, scorer.id, rng);

      expect(assistant).not.toBeNull();
      expect(assistant!.id).not.toBe(scorer.id);
    }
  });

  it('weights creative playmakers and wingers more heavily for assists', () => {
    const playmaker = makePlayer('p-playmaker', {
      name: 'Ganso',
      position: 'MID',
      attributes: { pace: 65, finishing: 60, passing: 95, defending: 40, physical: 65, goalkeeping: 10 },
      functions: ['MEIA_CRIACAO'],
    });

    const defender = makePlayer('p-defender', {
      name: 'Zagueiro',
      position: 'DEF',
      attributes: { pace: 65, finishing: 40, passing: 55, defending: 85, physical: 80, goalkeeping: 10 },
      functions: [],
    });

    const scorer = makePlayer('p-scorer', {
      name: 'Pedro',
      position: 'ATT',
    });

    const teammates = [playmaker, defender, scorer];

    let playmakerCount = 0;
    let defenderCount = 0;
    const trials = 200;

    for (let i = 0; i < trials; i++) {
      const rng = createRng(`trial-${i}`);
      const assistant = pickAssistant(teammates, scorer.id, rng);
      if (assistant?.id === playmaker.id) playmakerCount++;
      if (assistant?.id === defender.id) defenderCount++;
    }

    expect(playmakerCount).toBeGreaterThan(defenderCount * 2);
  });

  it('generates assistPlayerId on open-play goals during full match simulation', () => {
    const home = makeClub('home-club', 'Home', 85);
    const away = makeClub('away-club', 'Away', 50);

    const homeTactic = autoFillLineup(home);
    const awayTactic = autoFillLineup(away);

    let matchWithAssistFound = false;

    for (let i = 0; i < 15; i++) {
      const result = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `test-match-${i}`,
      });

      const goalEvents = result.events.filter((e) => e.type === 'goal' && !e.isPenalty);
      for (const goal of goalEvents) {
        if (goal.assistPlayerId) {
          matchWithAssistFound = true;
          expect(goal.assistPlayerName).toBeTruthy();
          expect(goal.assistPlayerId).not.toBe(goal.playerId);
        }
      }
      if (matchWithAssistFound) break;
    }

    expect(matchWithAssistFound).toBe(true);
  });
});

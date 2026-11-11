import { describe, expect, it } from 'vitest';
import { suggestedReplacement } from './engine.js';
import { sentOffPlayerIds } from './numericalDisadvantage.js';
import { makePlayer } from './testFactories.js';
import type { MatchEvent } from '../domain/match.js';
import type { Tactic } from '../domain/tactic.js';

describe('Lineup GK and Dismissal Integrity Tests', () => {
  const tactic: Tactic = {
    clubId: 'c1',
    formation: '4-4-2',
    mentality: 'balanced',
    attackStyle: 'BALANCED',
    markingStyle: 'BALANCED',
    attackApproach: 'BALANCED',
    lineup: [],
    substitutes: [],
    plannedSubstitutions: [],
  };

  it('suggestedReplacement NEVER suggests a goalkeeper for an injured outfield player if outfield bench players exist', () => {
    const backupKeeper = makePlayer('gk2', { position: 'GK', overall: 85 });
    const backupDefender = makePlayer('def1', { position: 'DEF', overall: 75 });
    const injuredStriker = makePlayer('att1', { position: 'ATT', overall: 80 });

    const candidates = [backupKeeper, backupDefender];
    const picked = suggestedReplacement(candidates, tactic, injuredStriker);

    expect(picked).not.toBeNull();
    expect(picked!.id).toBe('def1');
    expect(picked!.position).not.toBe('GK');
  });

  it('suggestedReplacement prioritizes a backup goalkeeper when a goalkeeper is injured', () => {
    const backupKeeper = makePlayer('gk2', { position: 'GK', overall: 78 });
    const backupDefender = makePlayer('def1', { position: 'DEF', overall: 84 });
    const injuredKeeper = makePlayer('gk1', { position: 'GK', overall: 82 });

    const candidates = [backupDefender, backupKeeper];
    const picked = suggestedReplacement(candidates, tactic, injuredKeeper);

    expect(picked).not.toBeNull();
    expect(picked!.id).toBe('gk2');
    expect(picked!.position).toBe('GK');
  });

  it('sentOffPlayerIds correctly recognizes straight reds, second yellows, and red card descriptors', () => {
    const events: MatchEvent[] = [
      { minute: 15, type: 'card', team: 'home', playerId: 'p1', description: 'Cartão amarelo' },
      { minute: 40, type: 'card', team: 'home', playerId: 'p2', description: 'Cartão vermelho para Jogador 2!', suspensionMatches: 2 },
      { minute: 60, type: 'card', team: 'away', playerId: 'a5', description: 'Segundo amarelo em Jogador A5! Expulso e suspenso por 1 partida(s)' },
      { minute: 75, type: 'card', team: 'home', playerId: 'p3', description: 'Expulso após falta dura' } as MatchEvent,
    ];

    const homeSentOff = sentOffPlayerIds(events, 'home');
    const awaySentOff = sentOffPlayerIds(events, 'away');

    expect(homeSentOff.has('p1')).toBe(false); // Only yellow
    expect(homeSentOff.has('p2')).toBe(true);  // Red with suspensionMatches
    expect(homeSentOff.has('p3')).toBe(true);  // Expulso in description
    expect(awaySentOff.has('a5')).toBe(true);  // Second yellow / expulso
  });
});

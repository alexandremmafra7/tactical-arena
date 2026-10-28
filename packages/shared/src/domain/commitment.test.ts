import { describe, it, expect } from 'vitest';
import { applyCommitment } from './commitment.js';
import { makePlayer, makeClub, makeTactic } from '../simulation/testFactories.js';

describe('applyCommitment', () => {
  it('raises commitment for a starter', () => {
    const club = makeClub('c1', 'Club One', 60);
    const tactic = makeTactic(club, { lineup: club.players.slice(0, 11).map((p) => ({ playerId: p.id })), substitutes: [] });

    const result = applyCommitment(club.players, tactic);
    const starter = result.find((p) => p.id === club.players[0].id)!;
    expect(starter.commitment).toBeGreaterThan(50);
  });

  it('raises commitment for a substitute who actually came on', () => {
    const club = makeClub('c2', 'Club Two', 60);
    const starters = club.players.slice(0, 11);
    const outPlayer = starters[9];
    const subPlayer = makePlayer('sub-player', { position: outPlayer.position });

    const tactic = makeTactic(club, {
      lineup: starters.map((p) => ({ playerId: p.id })),
      substitutes: [{ playerId: subPlayer.id }],
      plannedSubstitutions: [{ id: 'sub1', minute: 60, outPlayerId: outPlayer.id, inPlayerId: subPlayer.id }],
    });

    const result = applyCommitment([...starters, subPlayer], tactic);
    const sub = result.find((p) => p.id === subPlayer.id)!;
    expect(sub.commitment).toBeGreaterThan(50);
  });

  it('docks more commitment from a snubbed player who outclasses the starters at their position than one who does not', () => {
    const club = makeClub('c3', 'Club Three', 60);
    const starters = club.players.slice(0, 11);
    // Position of the last starter (an ATT, per SQUAD_TEMPLATE) — used to build both bench comparisons on equal footing.
    const attStarter = starters.find((p) => p.position === 'ATT')!;

    const strongBenchPlayer = makePlayer('strong-bench', { position: 'ATT', overall: attStarter.overall + 30 });
    const weakBenchPlayer = makePlayer('weak-bench', { position: 'ATT', overall: Math.max(1, attStarter.overall - 30) });

    const playersWithStrong = [...starters, strongBenchPlayer];
    const playersWithWeak = [...starters, weakBenchPlayer];
    const tacticStrong = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })), substitutes: [] });
    const tacticWeak = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })), substitutes: [] });

    const resultStrong = applyCommitment(playersWithStrong, tacticStrong);
    const resultWeak = applyCommitment(playersWithWeak, tacticWeak);

    const strongOutcome = resultStrong.find((p) => p.id === 'strong-bench')!.commitment;
    const weakOutcome = resultWeak.find((p) => p.id === 'weak-bench')!.commitment;

    expect(strongOutcome).toBeLessThan(weakOutcome);
  });

  it('docks less commitment from a named substitute than from a player left out of the squad entirely, all else equal', () => {
    const club = makeClub('c4', 'Club Four', 60);
    const starters = club.players.slice(0, 11);
    const attStarter = starters.find((p) => p.position === 'ATT')!;

    const namedSub = makePlayer('named-sub', { position: 'ATT', overall: attStarter.overall });
    const leftOut = makePlayer('left-out', { position: 'ATT', overall: attStarter.overall });

    const tacticWithBench = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })), substitutes: [{ playerId: namedSub.id }] });
    const tacticWithoutBench = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })), substitutes: [] });

    const resultNamedSub = applyCommitment([...starters, namedSub], tacticWithBench).find((p) => p.id === 'named-sub')!.commitment;
    const resultLeftOut = applyCommitment([...starters, leftOut], tacticWithoutBench).find((p) => p.id === 'left-out')!.commitment;

    expect(resultNamedSub).toBeGreaterThan(resultLeftOut);
  });

  it('docks more commitment from a snub when a SELFISH teammate started in their position, holding the quality gap constant', () => {
    const club = makeClub('c6', 'Club Six', 60);
    // Pin every ATT starter's overall so the position's peer average is deterministic, not left to makeClub's jitter.
    const starters = club.players.slice(0, 11).map((p) => (p.position === 'ATT' ? { ...p, overall: 60 } : p));
    const attStarter = starters.find((p) => p.position === 'ATT')!;
    const selfishAttStarter = { ...attStarter, traits: ['SELFISH' as const] };
    const startersWithSelfish = starters.map((p) => (p.id === attStarter.id ? selfishAttStarter : p));

    // A modest quality gap — big enough to matter, small enough that neither scenario saturates MAX_SNUB_PENALTY,
    // so the SELFISH amplifier's effect is actually visible in the comparison.
    const snubPlain = makePlayer('snub-plain', { position: 'ATT', overall: 68 });
    const snubSelfish = makePlayer('snub-selfish', { position: 'ATT', overall: 68 });

    const tacticPlain = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })), substitutes: [] });
    const tacticSelfish = makeTactic(club, { lineup: startersWithSelfish.map((p) => ({ playerId: p.id })), substitutes: [] });

    const resultPlain = applyCommitment([...starters, snubPlain], tacticPlain).find((p) => p.id === 'snub-plain')!.commitment;
    const resultSelfish = applyCommitment([...startersWithSelfish, snubSelfish], tacticSelfish).find((p) => p.id === 'snub-selfish')!.commitment;

    expect(resultSelfish).toBeLessThan(resultPlain);
  });

  it('clamps commitment to [0, 100]', () => {
    const club = makeClub('c5', 'Club Five', 60);
    const starters = club.players.slice(0, 11);
    const tactic = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })), substitutes: [] });

    let players = starters.map((p) => ({ ...p, commitment: 99 }));
    for (let i = 0; i < 10; i++) {
      players = applyCommitment(players, tactic);
    }
    expect(players.every((p) => p.commitment <= 100)).toBe(true);

    const attStarter = starters.find((p) => p.position === 'ATT')!;
    let snubbed = [...starters, makePlayer('ever-snubbed', { position: 'ATT', overall: attStarter.overall + 50, commitment: 1 })];
    const snubTactic = makeTactic(club, { lineup: starters.map((p) => ({ playerId: p.id })), substitutes: [] });
    for (let i = 0; i < 10; i++) {
      snubbed = applyCommitment(snubbed, snubTactic);
    }
    expect(snubbed.find((p) => p.id === 'ever-snubbed')!.commitment).toBeGreaterThanOrEqual(0);
  });
});

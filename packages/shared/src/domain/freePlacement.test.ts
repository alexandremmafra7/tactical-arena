import { describe, expect, it } from 'vitest';
import { effectiveSlotPositions, positionFromPitchPoint, FORMATION_POSITIONS } from './tactic.js';
import { makeClub, makeTactic } from '../simulation/testFactories.js';
import { computeTeamStrength } from '../simulation/teamStrength.js';

describe('positionFromPitchPoint', () => {
  it('maps each band of the pitch to the position played there', () => {
    expect(positionFromPitchPoint(50, 95)).toBe('GK');
    expect(positionFromPitchPoint(50, 75)).toBe('DEF');
    expect(positionFromPitchPoint(15, 75)).toBe('LAT');
    expect(positionFromPitchPoint(85, 75)).toBe('LAT');
    expect(positionFromPitchPoint(50, 50)).toBe('MID');
    expect(positionFromPitchPoint(50, 18)).toBe('ATT');
  });

  it('agrees with the formation wherever the formation already puts a player', () => {
    // 4-4-2's own coordinates, from the web pitch editor: dropping a player exactly where the
    // formation would have placed them must not silently reclassify their position.
    const fourFourTwo: [number, number][] = [
      [50, 92], [15, 75], [38, 78], [62, 78], [85, 75],
      [15, 50], [38, 53], [62, 53], [85, 50], [35, 20], [65, 20],
    ];
    const derived = fourFourTwo.map(([x, y]) => positionFromPitchPoint(x, y));
    expect(derived).toEqual(FORMATION_POSITIONS['4-4-2']);
  });
});

describe('effectiveSlotPositions', () => {
  it('falls back to the formation for slots the manager never dragged', () => {
    const club = makeClub('c1', 'Club', 70);
    const tactic = makeTactic(club, { formation: '4-4-2' });
    expect(effectiveSlotPositions(tactic)).toEqual(FORMATION_POSITIONS['4-4-2']);
  });

  it('lets a hand-placed slot override the formation', () => {
    const club = makeClub('c1', 'Club', 70);
    const tactic = makeTactic(club, { formation: '4-4-2' });
    // Slot 2 is a centre-back in 4-4-2; park them on the edge of the opposing box.
    tactic.lineup[2] = { ...tactic.lineup[2], x: 50, y: 15 };
    const positions = effectiveSlotPositions(tactic);
    expect(positions[2]).toBe('ATT');
    expect(positions[1]).toBe(FORMATION_POSITIONS['4-4-2'][1]);
  });
});

describe('the simulation honours free placement', () => {
  it('applies the out-of-position penalty to a defender parked up front', () => {
    const club = makeClub('c1', 'Club', 70);
    const asFormationSays = makeTactic(club, { formation: '4-4-2' });
    const withDefenderUpFront = makeTactic(club, { formation: '4-4-2' });
    withDefenderUpFront.lineup[2] = { ...withDefenderUpFront.lineup[2], x: 50, y: 15 };

    const before = computeTeamStrength(club, asFormationSays);
    const after = computeTeamStrength(club, withDefenderUpFront);

    // Same eleven, same formation label: the only difference is where the manager put one shirt, and
    // that alone has to move the numbers. Otherwise free placement is decoration.
    expect(after.attack).not.toBe(before.attack);
  });
});

import { describe, it, expect } from 'vitest';
import {
  calculateFlankCoverage,
  calculateInMatchStamina,
  calculateMicrocycleRecovery,
  computeTeamStrength,
  positionMismatchFactor,
  starFactor,
} from './teamStrength.js';
import { makeClub, makePlayer, makeTactic } from './testFactories.js';
import { STARTING_BUDGET, STARTING_STADIUM_CAPACITY, STARTING_STADIUM_LEVEL, Club } from '../domain/club.js';
import { Player, StarLevel } from '../domain/player.js';
import { Formation, LineupSlot } from '../domain/tactic.js';

/** 1 GK + 10 identical outfield players with a deliberately extreme pace-vs-passing gap, for unambiguous style tests. */
function makePaceHeavyClub(id: string): Club {
  const gk = makePlayer(`${id}-gk`, { position: 'GK' });
  const outfield = Array.from({ length: 10 }, (_, i) =>
    makePlayer(`${id}-o${i}`, {
      position: 'MID',
      attributes: { pace: 90, finishing: 60, passing: 30, defending: 60, physical: 60, goalkeeping: 10 },
    }),
  );
  return {
    id,
    name: id,
    ownerId: `${id}-owner`,
    slug: null,
    pendingRoundTactic: null,
    country: 'BRA',
    players: [gk, ...outfield],
    academyPlayers: [],
    budget: STARTING_BUDGET,
    captainPlayerId: null,
    captainWeeksServed: 0,
    tutorPlayerId: null,
    penaltyTakerId: null,
    freeKickTakerId: null,
    cornerLeftTakerId: null,
    cornerRightTakerId: null,
    stadiumLevel: STARTING_STADIUM_LEVEL,
    stadiumCapacity: STARTING_STADIUM_CAPACITY,
    stadiumConstruction: null,
    titlesWon: 0,
    sponsorships: [],
    loans: [],
    pendingTransferPayments: [],
  };
}

describe('computeTeamStrength age curve', () => {
  it('gives a peak-age squad more effective attack than an otherwise identical veteran squad', () => {
    const peakClub = makeClub('peak', 'Peak FC', 70, { age: 26 });
    const veteranClub = makeClub('veteran', 'Veteran FC', 70, { age: 38, seed: 'peak' });

    const peakStrength = computeTeamStrength(peakClub, makeTactic(peakClub));
    const veteranStrength = computeTeamStrength(veteranClub, makeTactic(veteranClub));

    expect(peakStrength.attack).toBeGreaterThan(veteranStrength.attack);
  });

  it('attenuates the age penalty for an elite (high overall) veteran squad compared to a regular veteran squad', () => {
    const peakRegular = makeClub('peak-regular', 'Peak Regular', 70, { age: 26 });
    const veteranRegular = makeClub('vet-regular', 'Veteran Regular', 70, { age: 38, seed: 'peak-regular' });

    const peakElite = makeClub('peak-elite', 'Peak Elite', 92, { age: 26 });
    const veteranElite = makeClub('vet-elite', 'Veteran Elite', 92, { age: 38, seed: 'peak-elite' });

    const regularDegradation =
      1 - computeTeamStrength(veteranRegular, makeTactic(veteranRegular)).attack / computeTeamStrength(peakRegular, makeTactic(peakRegular)).attack;
    const eliteDegradation =
      1 - computeTeamStrength(veteranElite, makeTactic(veteranElite)).attack / computeTeamStrength(peakElite, makeTactic(peakElite)).attack;

    expect(eliteDegradation).toBeLessThan(regularDegradation);
  });
});

describe('computeTeamStrength tactical dimensions', () => {
  it('WINGS attack beats THROUGH_MIDDLE for a pace-heavy, passing-weak squad', () => {
    const club = makePaceHeavyClub('wings-club');
    const wings = computeTeamStrength(club, makeTactic(club, { attackStyle: 'WINGS' }));
    const middle = computeTeamStrength(club, makeTactic(club, { attackStyle: 'THROUGH_MIDDLE' }));

    expect(wings.attack).toBeGreaterThan(middle.attack);
  });

  it('penalizes WINGS by 12% when nobody occupies a flank corridor', () => {
    const club = makeClub('narrow-wings-club', 'Narrow Wings FC', 70);
    const tactic = makeTactic(club, {
      formation: '3-5-2',
      attackStyle: 'WINGS',
      lineup: club.players.map((player) => ({ playerId: player.id, side: 'CENTER' })),
    });

    expect(calculateFlankCoverage(tactic.formation, tactic.lineup)).toBe(0.88);
    expect(computeTeamStrength(club, tactic).attackStyleCompatibility).toBe(0.88);
  });

  it('rewards WINGS with a lateral slot regardless of the player function', () => {
    const club = makeClub('lateral-wings-club', 'Lateral Wings FC', 70);
    const tactic = makeTactic(club, { attackStyle: 'WINGS' });

    expect(calculateFlankCoverage(tactic.formation, tactic.lineup)).toBe(1.06);
    expect(computeTeamStrength(club, tactic).attackStyleCompatibility).toBe(1.06);
  });

  it.each(['LEFT', 'RIGHT'] as const)('rewards WINGS with an ATT stationed on the %s flank', (side) => {
    const lineup: LineupSlot[] = Array.from({ length: 11 }, (_, index) => ({
      playerId: `player-${index}`,
      side: index === 9 ? side : 'CENTER',
    }));

    expect(calculateFlankCoverage('3-5-2', lineup)).toBe(1.06);
  });

  it('does not count a central ATT as flank coverage', () => {
    const lineup: LineupSlot[] = Array.from({ length: 11 }, (_, index) => ({
      playerId: `player-${index}`,
      side: 'CENTER',
    }));

    expect(calculateFlankCoverage('3-5-2', lineup)).toBe(0.88);
  });

  it('honours free placement when resolving a lateral slot', () => {
    const formation: Formation = '3-5-2';
    const lineup: LineupSlot[] = [
      { playerId: 'gk' },
      { playerId: 'wide-defender', x: 10, y: 70 },
    ];

    expect(calculateFlankCoverage(formation, lineup)).toBe(1.06);
  });

  it('stops counting a wide player after they leave the pitch', () => {
    const club = makeClub('dismissed-winger-club', 'Dismissed Winger FC', 70);
    const widePlayer = club.players[9];
    const tactic = makeTactic(club, {
      formation: '3-5-2',
      attackStyle: 'WINGS',
      lineup: club.players.map((player, index) => ({
        playerId: player.id,
        side: index === 9 ? 'LEFT' : 'CENTER',
      })),
    });

    expect(computeTeamStrength(club, tactic).attackStyleCompatibility).toBe(1.06);
    expect(computeTeamStrength(club, tactic, new Set([widePlayer.id])).attackStyleCompatibility).toBe(0.88);
  });

  it('does not make ZONAL or MAN_MARKING depend on fielding wingers', () => {
    const club = makeClub('marking-club', 'Marking FC', 70);
    const zonal = computeTeamStrength(club, makeTactic(club, { attackStyle: 'BALANCED', markingStyle: 'ZONAL' }));
    const manMarking = computeTeamStrength(club, makeTactic(club, { attackStyle: 'BALANCED', markingStyle: 'MAN_MARKING' }));

    expect(zonal.attackStyleCompatibility).toBe(1);
    expect(manMarking.attackStyleCompatibility).toBe(1);
    expect(zonal.foulProbabilityModifier).toBe(0.8);
    expect(manMarking.foulProbabilityModifier).toBe(1.3);
  });

  it('HEAVY marking raises both defense and foul risk compared to LIGHT marking', () => {
    const club = makeClub('marking-club', 'Marking FC', 70);
    const heavy = computeTeamStrength(club, makeTactic(club, { markingStyle: 'HEAVY' }));
    const light = computeTeamStrength(club, makeTactic(club, { markingStyle: 'LIGHT' }));

    expect(heavy.defense).toBeGreaterThan(light.defense);
    expect(heavy.foulProbabilityModifier).toBeGreaterThan(light.foulProbabilityModifier);
  });

  it('COUNTER_ATTACK trades chance volume for conversion and defensive solidity versus TOTAL_ATTACK', () => {
    const club = makeClub('approach-club', 'Approach FC', 70);
    const counter = computeTeamStrength(club, makeTactic(club, { attackApproach: 'COUNTER_ATTACK' }));
    const total = computeTeamStrength(club, makeTactic(club, { attackApproach: 'TOTAL_ATTACK' }));

    expect(counter.chanceModifier).toBeLessThan(total.chanceModifier);
    expect(counter.goalModifier).toBeGreaterThan(total.goalModifier);
    expect(counter.defense).toBeGreaterThan(total.defense);
  });

  it('leaves BALANCED attack style genuinely between the two committed styles', () => {
    const club = makeClub('mid-style-club', 'Mid Style FC', 70);
    const wings = computeTeamStrength(club, makeTactic(club, { attackStyle: 'WINGS' }));
    const balanced = computeTeamStrength(club, makeTactic(club, { attackStyle: 'BALANCED' }));
    const middle = computeTeamStrength(club, makeTactic(club, { attackStyle: 'THROUGH_MIDDLE' }));

    const [lo, hi] = wings.attack < middle.attack ? [wings.attack, middle.attack] : [middle.attack, wings.attack];
    expect(balanced.attack).toBeGreaterThan(lo);
    expect(balanced.attack).toBeLessThan(hi);
  });

  /** The compromise must cost something in both directions, or nobody would ever pick a committed approach. */
  it('never lets BALANCED approach dominate either committed approach', () => {
    const club = makeClub('mid-approach-club', 'Mid Approach FC', 70);
    const counter = computeTeamStrength(club, makeTactic(club, { attackApproach: 'COUNTER_ATTACK' }));
    const balanced = computeTeamStrength(club, makeTactic(club, { attackApproach: 'BALANCED' }));
    const total = computeTeamStrength(club, makeTactic(club, { attackApproach: 'TOTAL_ATTACK' }));

    // Expected goals ~ chances created x conversion rate: strictly ordered counter < balanced < total.
    const xg = (s: typeof counter) => s.chanceModifier * s.goalModifier;
    expect(xg(counter)).toBeLessThan(xg(balanced));
    expect(xg(balanced)).toBeLessThan(xg(total));

    // Defensive solidity runs the other way, so the middle buys its extra goals with real defensive cost.
    expect(balanced.defense).toBeLessThan(counter.defense);
    expect(balanced.defense).toBeGreaterThan(total.defense);
  });
});

describe('positionMismatchFactor', () => {
  it('returns 1 for a perfect position match', () => {
    expect(positionMismatchFactor('MID', 'MID')).toBe(1);
  });

  it('decays exponentially with positional distance, harsher the further apart', () => {
    const oneStep = positionMismatchFactor('DEF', 'LAT'); // |1-2| = 1
    const twoStep = positionMismatchFactor('DEF', 'MID'); // |1-3| = 2
    const maxStep = positionMismatchFactor('GK', 'ATT'); // |0-4| = 4

    expect(oneStep).toBeCloseTo(0.7);
    expect(twoStep).toBeCloseTo(0.49);
    expect(maxStep).toBeCloseTo(0.7 ** 4);
    expect(maxStep).toBeLessThan(twoStep);
    expect(twoStep).toBeLessThan(oneStep);
  });

  it('is symmetric — direction of the mismatch does not matter, only the distance', () => {
    expect(positionMismatchFactor('GK', 'ATT')).toBeCloseTo(positionMismatchFactor('ATT', 'GK'));
  });
});

describe('computeTeamStrength positional mismatch handicap', () => {
  it('fields a much weaker attack/defense when the squad is slotted well out of their natural positions', () => {
    const club = makeClub('mismatch-club', 'Mismatch FC', 70);
    const inPosition = computeTeamStrength(club, makeTactic(club));
    // Reversing the lineup against the unchanged 4-4-2 slot order scrambles nearly everyone out of position.
    const reversedLineup = [...club.players].reverse().map((p) => ({ playerId: p.id }));
    const outOfPosition = computeTeamStrength(club, makeTactic(club, { lineup: reversedLineup }));

    expect(outOfPosition.attack).toBeLessThan(inPosition.attack);
    expect(outOfPosition.defense).toBeLessThan(inPosition.defense);
  });

  it('tanks goalkeeping when an outfield player is fielded in goal instead of the real goalkeeper', () => {
    const club = makeClub('gk-mismatch-club', 'GK Mismatch FC', 70);
    const gk = club.players.find((p) => p.position === 'GK')!;
    const outfielder = club.players.find((p) => p.position !== 'GK')!;

    const normal = computeTeamStrength(club, makeTactic(club));
    const swappedLineup = club.players.map((p) => {
      if (p.id === gk.id) return { playerId: outfielder.id };
      if (p.id === outfielder.id) return { playerId: gk.id };
      return { playerId: p.id };
    });
    const swapped = computeTeamStrength(club, makeTactic(club, { lineup: swappedLineup }));

    expect(swapped.goalkeeping).toBeLessThan(normal.goalkeeping);
  });
});

describe('computeTeamStrength captaincy', () => {
  it('gives a long-serving captain a higher effective attack contribution than the same player with no armband', () => {
    const club = makeClub('captain-club', 'Captain FC', 70);
    const tactic = makeTactic(club);
    const midfielder = club.players.find((p) => p.position === 'MID')!;
    const withoutCaptain = computeTeamStrength(club, tactic);
    const withCaptain = computeTeamStrength({ ...club, captainPlayerId: midfielder.id, captainWeeksServed: 50 }, tactic);

    expect(withCaptain.attack).toBeGreaterThan(withoutCaptain.attack);
  });
});

describe('starFactor (differentiated star weight)', () => {
  it('gives a regular player no star boost at all', () => {
    const regular = makePlayer('reg', { overall: 70, starLevel: 'NONE' });
    expect(starFactor(regular)).toBe(1);
  });

  it('stacks the weights top-mundial > gold-star > double-chevron > regular', () => {
    const natural = makePlayer('nat', { overall: 87, starLevel: 'NATURAL' });
    const gold = makePlayer('gold', { overall: 92, starLevel: 'NONE' });
    const doubleChevron = makePlayer('dc', { overall: 88, starLevel: 'NONE' });
    const regular = makePlayer('reg', { overall: 70, starLevel: 'NONE' });

    expect(starFactor(natural)).toBeGreaterThan(starFactor(gold));
    expect(starFactor(gold)).toBeGreaterThan(starFactor(doubleChevron));
    expect(starFactor(doubleChevron)).toBeGreaterThan(starFactor(regular));
  });

  it('keeps the double-chevron weight strictly below the top-mundial star weight', () => {
    const natural = makePlayer('nat', { overall: 87, starLevel: 'NATURAL' });
    const doubleChevron = makePlayer('dc', { overall: 88, starLevel: 'NONE' });
    expect(starFactor(natural)).toBeGreaterThan(starFactor(doubleChevron));
    expect(starFactor(doubleChevron)).toBeGreaterThan(1);
  });
});

describe('computeTeamStrength star boost', () => {
  const upgradePlayer = (club: Club, slot: (p: Player) => boolean, starLevel: StarLevel): Club => ({
    ...club,
    players: club.players.map((p) =>
      slot(p)
        ? { ...p, overall: 92, starLevel, attributes: { ...p.attributes, pace: 92, finishing: 92, goalkeeping: 92 } }
        : p,
    ),
  });

  it('lets a top-mundial star pull the side above the same side with a plain elite player', () => {
    const plain = upgradePlayer(makeClub('plain', 'Plain FC', 70, { seed: 'star-squad' }), (p) => p.position === 'ATT', 'NONE');
    const star = upgradePlayer(makeClub('star', 'Star FC', 70, { seed: 'star-squad' }), (p) => p.position === 'ATT', 'NATURAL');

    const plainStrength = computeTeamStrength(plain, makeTactic(plain));
    const starStrength = computeTeamStrength(star, makeTactic(star));

    expect(starStrength.attack).toBeGreaterThan(plainStrength.attack);
  });

  it('boosts goalkeeping for a top-mundial goalkeeper', () => {
    const plain = upgradePlayer(makeClub('gk-plain', 'GK Plain', 70, { seed: 'gk-squad' }), (p) => p.position === 'GK', 'NONE');
    const star = upgradePlayer(makeClub('gk-star', 'GK Star', 70, { seed: 'gk-squad' }), (p) => p.position === 'GK', 'NATURAL');

    const plainStrength = computeTeamStrength(plain, makeTactic(plain));
    const starStrength = computeTeamStrength(star, makeTactic(star));

    expect(starStrength.goalkeeping).toBeGreaterThan(plainStrength.goalkeeping);
  });
});

describe('sports science stamina physiology & recovery', () => {
  it('models in-match stamina depletion and proves halftime recovery boost', () => {
    const player = makePlayer('athlete', { position: 'MID', fatigue: 0, attributes: { physical: 50, pace: 70, finishing: 70, passing: 70, defending: 70, goalkeeping: 10 } });

    const min0 = calculateInMatchStamina(player, 0);
    const min45 = calculateInMatchStamina(player, 45);
    const min46 = calculateInMatchStamina(player, 46);
    const min90 = calculateInMatchStamina(player, 90);

    expect(min0).toBe(100);
    expect(min45).toBeLessThan(min0);
    // Halftime boost: at min 46, stamina is strictly higher than at min 45 due to 15-min rest recovery!
    expect(min46).toBeGreaterThan(min45);
    expect(min90).toBeLessThan(min46);
  });

  it('proves high-physical players resist in-match fatigue better than low-physical players', () => {
    const sturdy = makePlayer('sturdy', { position: 'MID', fatigue: 0, attributes: { physical: 95, pace: 70, finishing: 70, passing: 70, defending: 70, goalkeeping: 10 } });
    const frail = makePlayer('frail', { position: 'MID', fatigue: 0, attributes: { physical: 15, pace: 70, finishing: 70, passing: 70, defending: 70, goalkeeping: 10 } });

    const sturdy90 = calculateInMatchStamina(sturdy, 90);
    const frail90 = calculateInMatchStamina(frail, 90);

    expect(sturdy90).toBeGreaterThan(frail90);
  });

  it('calculates realistic microcycle recovery across 3-day (midweek) and 7-day (weekly) turnarounds', () => {
    const fatigue = 25; // Acute fatigue from a hard match

    const recovered3Days = calculateMicrocycleRecovery(fatigue, 3, 50, 25);
    const recovered7Days = calculateMicrocycleRecovery(fatigue, 7, 50, 25);

    // After 3 days (midweek), ~78% recovery leaves only small residual fatigue
    expect(recovered3Days).toBeLessThan(fatigue);
    expect(recovered3Days).toBeLessThanOrEqual(5);

    // After 7 days (full week), player is fully recovered (0 fatigue)
    expect(recovered7Days).toBe(0);
  });
});

describe('computeTeamStrength rest-defence compatibility (Phase 2)', () => {
  /** '5-3-2': GK, LAT, DEF, DEF, DEF, LAT, MID, MID, MID, ATT, ATT. Indices 6,7,8 are the three MID slots. */
  function makeFiveThreeTwoClub(id: string, withProtectors: boolean): Club {
    const club = makePaceHeavyClub(id);
    if (!withProtectors) return club;
    return {
      ...club,
      players: club.players.map((p, i) => ([6, 7, 8].includes(i) ? { ...p, functions: ['VOLANTE' as const] } : p)),
    };
  }

  /** '3-5-2': GK, DEF, DEF, DEF, MID, MID, MID, MID, MID, ATT, ATT. Indices 4,5,6 are three of the five MID slots. */
  function makeThreeFiveTwoClub(id: string, withProtectors: boolean): Club {
    const club = makePaceHeavyClub(id);
    if (!withProtectors) return club;
    return {
      ...club,
      players: club.players.map((p, i) => ([4, 5, 6].includes(i) ? { ...p, functions: ['VOLANTE' as const] } : p)),
    };
  }

  it('reaches full 3+2 compatibility with three defenders (2 LAT + 2 DEF) and two VOLANTE protectors', () => {
    const club = makeFiveThreeTwoClub('rd-3-2-full', true);
    const tactic = makeTactic(club, { formation: '5-3-2', restDefenceShape: '3+2' });
    const strength = computeTeamStrength(club, tactic);

    expect(strength.restDefence.compatibility).toBe(1);
    expect(strength.restDefence.centralExposure).toBeCloseTo(0.8);
    expect(strength.restDefence.territorialRetention).toBeCloseTo(1.0);
    expect(strength.restDefence.flankVulnerability).toBeCloseTo(1.0);
  });

  it('interpolates toward neutral for a partial 3+2 (defenders present, no protectors)', () => {
    const club = makeFiveThreeTwoClub('rd-3-2-partial', false);
    const tactic = makeTactic(club, { formation: '5-3-2', restDefenceShape: '3+2' });
    const strength = computeTeamStrength(club, tactic);

    expect(strength.restDefence.compatibility).toBeGreaterThan(0);
    expect(strength.restDefence.compatibility).toBeLessThan(1);
    expect(strength.restDefence.centralExposure).toBeGreaterThan(0.8);
    expect(strength.restDefence.centralExposure).toBeLessThan(1);
  });

  it('reaches full 2+3 compatibility with two-plus base defenders and three containment players', () => {
    const club = makeThreeFiveTwoClub('rd-2-3-full', true);
    const tactic = makeTactic(club, { formation: '3-5-2', restDefenceShape: '2+3' });
    const strength = computeTeamStrength(club, tactic);

    expect(strength.restDefence.compatibility).toBe(1);
    expect(strength.restDefence.territorialRetention).toBeCloseTo(1.1);
    expect(strength.restDefence.flankVulnerability).toBeCloseTo(1.2);
  });

  it('interpolates toward neutral for a partial 2+3 (defenders present, no containment)', () => {
    const club = makeThreeFiveTwoClub('rd-2-3-partial', false);
    const tactic = makeTactic(club, { formation: '3-5-2', restDefenceShape: '2+3' });
    const strength = computeTeamStrength(club, tactic);

    expect(strength.restDefence.compatibility).toBeGreaterThan(0);
    expect(strength.restDefence.compatibility).toBeLessThan(1);
  });

  it('gives 2+3 stronger territorial retention and greater flank vulnerability than 3+2, at full compatibility', () => {
    const threeTwo = computeTeamStrength(
      makeFiveThreeTwoClub('rd-cmp-3-2', true),
      makeTactic(makeFiveThreeTwoClub('rd-cmp-3-2', true), { formation: '5-3-2', restDefenceShape: '3+2' }),
    );
    const twoThree = computeTeamStrength(
      makeThreeFiveTwoClub('rd-cmp-2-3', true),
      makeTactic(makeThreeFiveTwoClub('rd-cmp-2-3', true), { formation: '3-5-2', restDefenceShape: '2+3' }),
    );

    expect(twoThree.restDefence.territorialRetention).toBeGreaterThan(threeTwo.restDefence.territorialRetention);
    expect(twoThree.restDefence.flankVulnerability).toBeGreaterThan(threeTwo.restDefence.flankVulnerability);
    expect(twoThree.restDefence.centralExposure).toBeGreaterThanOrEqual(threeTwo.restDefence.centralExposure);
  });

  it('honours free placement: dragging VOLANTE protectors up into the attacking third breaks 3+2 compatibility', () => {
    // 5-3-2's 3 DEF slots already satisfy the defender leg on their own, and makeFiveThreeTwoClub tags all
    // three MID slots (6,7,8) VOLANTE — only 2 are needed for a full protectorScore, so this drags two of
    // the three (6,7) forward; effectiveSlotPositions then reclassifies them as ATT, dropping the surviving
    // protector count from 3 to 1 and protectorScore below its 2/2 cap.
    const club = makeFiveThreeTwoClub('rd-free-placement', true);
    const grounded = makeTactic(club, { formation: '5-3-2', restDefenceShape: '3+2' });
    const dragged = makeTactic(club, {
      formation: '5-3-2',
      restDefenceShape: '3+2',
      lineup: grounded.lineup.map((slot, i) => ((i === 6 || i === 7) ? { ...slot, x: 50, y: 10 } : slot)),
    });

    const groundedStrength = computeTeamStrength(club, grounded);
    const draggedStrength = computeTeamStrength(club, dragged);

    expect(draggedStrength.restDefence.compatibility).toBeLessThan(groundedStrength.restDefence.compatibility);
  });

  it('stops counting VOLANTE protectors toward 3+2 compatibility once they leave the pitch', () => {
    const club = makeFiveThreeTwoClub('rd-off-pitch', true);
    const tactic = makeTactic(club, { formation: '5-3-2', restDefenceShape: '3+2' });
    const goneIds = new Set([club.players[6].id, club.players[7].id]);

    const onPitch = computeTeamStrength(club, tactic);
    const withVolantesGone = computeTeamStrength(club, tactic, goneIds);

    expect(withVolantesGone.restDefence.compatibility).toBeLessThan(onPitch.restDefence.compatibility);
  });

  it('produces neutral, non-NaN rest-defence modifiers when the whole side is off the pitch', () => {
    const club = makeFiveThreeTwoClub('rd-all-off', true);
    const tactic = makeTactic(club, { formation: '5-3-2', restDefenceShape: '3+2' });
    const allIds = new Set(club.players.map((p) => p.id));

    const strength = computeTeamStrength(club, tactic, allIds);

    expect(strength.restDefence).toEqual({ centralExposure: 1, territorialRetention: 1, flankVulnerability: 1, compatibility: 0 });
    expect(Number.isNaN(strength.teamwork)).toBe(false);
    expect(Number.isNaN(strength.anticipation)).toBe(false);
    expect(Number.isNaN(strength.firstTouch)).toBe(false);
    expect(Number.isNaN(strength.composure)).toBe(false);
  });

  it('defaults to 3+2 for a tactic stored before restDefenceShape existed', () => {
    const club = makeFiveThreeTwoClub('rd-default', true);
    const withoutField = makeTactic(club, { formation: '5-3-2' });
    const explicit = makeTactic(club, { formation: '5-3-2', restDefenceShape: '3+2' });

    expect(computeTeamStrength(club, withoutField).restDefence).toEqual(computeTeamStrength(club, explicit).restDefence);
  });
});

describe('computeTeamStrength collective attributes (Phase 2)', () => {
  it('only averages teamwork/anticipation/first-touch/composure over players still on the pitch', () => {
    const club = makeClub('collective-club', 'Collective FC', 70, { traits: [] });
    const leaderId = club.players[5].id;
    const withLeader: Club = { ...club, players: club.players.map((p) => (p.id === leaderId ? { ...p, traits: ['LEADER' as const] } : p)) };
    const tactic = makeTactic(withLeader);

    const withLeaderOnPitch = computeTeamStrength(withLeader, tactic);
    const withLeaderExcluded = computeTeamStrength(withLeader, tactic, new Set([leaderId]));

    expect(withLeaderOnPitch.teamwork).toBeGreaterThan(withLeaderExcluded.teamwork);
  });
});

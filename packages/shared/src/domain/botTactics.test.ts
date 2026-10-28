import { describe, it, expect } from 'vitest';
import { TACTICAL_IDENTITIES, botTactic, tacticalIdentityOf } from './botTactics.js';
import { autoFillLineup } from './lineupAutofill.js';
import { makeClub, makeTactic } from '../simulation/testFactories.js';

describe('bot tactical identities', () => {
  it('gives the same club the same identity every time, so a manager can learn to expect it', () => {
    const club = makeClub('stable', 'Stable FC', 65);
    const first = tacticalIdentityOf(club);
    const second = tacticalIdentityOf(club);
    expect(first).toEqual(second);
  });

  it('sends strong squads out to press and weak ones to sit deep', () => {
    const giant = tacticalIdentityOf(makeClub('giant', 'Giant FC', 80));
    const minnow = tacticalIdentityOf(makeClub('minnow', 'Minnow FC', 42));

    expect(giant.pressing).not.toBe('LOW_BLOCK');
    expect(minnow.pressing).toBe('LOW_BLOCK');
    expect(minnow.attackApproach).toBe('COUNTER_ATTACK');
    expect(giant.attackApproach).not.toBe('COUNTER_ATTACK');
  });

  it('spreads more than one style across a league of similar clubs', () => {
    const identities = new Set<string>();
    for (let i = 0; i < 40; i++) {
      identities.add(tacticalIdentityOf(makeClub(`spread-${i}`, `Club ${i}`, 62)).name);
    }
    expect(identities.size).toBeGreaterThan(1);
  });

  it('covers every archetype across a league spanning the quality range', () => {
    const seen = new Set<string>();
    for (const skill of [40, 45, 62, 65, 75, 82]) {
      for (let i = 0; i < 25; i++) {
        seen.add(tacticalIdentityOf(makeClub(`cover-${skill}-${i}`, `Club ${i}`, skill)).name);
      }
    }
    expect(seen.size).toBe(TACTICAL_IDENTITIES.length);
  });
});

describe('botTactic', () => {
  it('dresses the auto-filled XI in the club identity without touching who plays', () => {
    const club = makeClub('dress', 'Dress FC', 45);
    const autoFilled = autoFillLineup(club);
    const dressed = botTactic(club, autoFilled);
    const identity = tacticalIdentityOf(club);

    expect(dressed.lineup).toEqual(autoFilled.lineup);
    expect(dressed.substitutes).toEqual(autoFilled.substitutes);
    expect(dressed.attackApproach).toBe(identity.attackApproach);
    expect(dressed.pressing).toBe(identity.pressing);
    expect(dressed.markingStyle).toBe(identity.markingStyle);
  });

  /** Swapping the formation label without rebuilding the XI would misalign every slot — see botTactics.ts. */
  it('leaves the formation exactly as auto-fill built it', () => {
    const club = makeClub('formation', 'Formation FC', 80);
    const autoFilled = autoFillLineup(club);
    expect(botTactic(club, autoFilled).formation).toBe(autoFilled.formation);
  });

  it('does not disturb a tactic that was handed to it wholesale', () => {
    const club = makeClub('untouched', 'Untouched FC', 65);
    const preset = makeTactic(club);
    const dressed = botTactic(club, preset);
    expect(dressed.lineup).toEqual(preset.lineup);
    expect(dressed.clubId).toBe(club.id);
  });
});

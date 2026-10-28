import { describe, expect, it } from 'vitest';
import { makeClub } from './testFactories.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';
import { simulateMatch } from './engine.js';
import { STAFF_TIER_CONFIG, type StaffMember, type StaffRole, type StaffTier } from '../domain/staff.js';
import type { Club } from '../domain/club.js';
import type { Tactic } from '../domain/tactic.js';

const N = 500;

function hire(role: StaffRole, tier: StaffTier): StaffMember {
  const config = STAFF_TIER_CONFIG[tier];
  return {
    id: `${role}-${tier}`,
    name: `${role} ${tier}`,
    role,
    tier,
    rating: config.maxRating,
    specialty: 'teste',
    description: '',
    wage: config.baseWage,
    minClubVisibility: 0,
    minCareerTitles: 0,
    avatar: '',
    nationality: 'BRA',
  };
}

/** The same club twice, differing only in who it employs. */
function twins(staff: StaffMember[]): { us: Club; them: Club; ourTactic: Tactic; theirTactic: Tactic } {
  const us = { ...makeClub('staff-us', 'Nós', 65, { seed: 'staff-twin' }), staff };
  const them = makeClub('staff-them', 'Eles', 65, { seed: 'staff-twin' });
  return {
    us,
    them,
    ourTactic: { ...autoFillLineup(us), clubId: us.id } as Tactic,
    theirTactic: { ...autoFillLineup(them), clubId: them.id } as Tactic,
  };
}

/**
 * The same fixture list, played by the same two squads, changing only who the first club employs.
 *
 * The seeds are deliberately identical across every condition: with different ones, the gap between two
 * conditions would be part staff and part luck, and at this sample size luck is the larger of the two.
 */
function playSeason(staff: StaffMember[]) {
  const { us, them, ourTactic, theirTactic } = twins(staff);
  let points = 0;
  let injuries = 0;

  for (let i = 0; i < N; i += 1) {
    // Alternating the venue, so the home advantage cancels out of the comparison.
    const atHome = i % 2 === 0;
    const result = simulateMatch({
      seed: `staff-fixture-${i}`,
      home: atHome ? { club: us, tactic: ourTactic } : { club: them, tactic: theirTactic },
      away: atHome ? { club: them, tactic: theirTactic } : { club: us, tactic: ourTactic },
    });
    const ours = atHome ? result.homeGoals : result.awayGoals;
    const theirs = atHome ? result.awayGoals : result.homeGoals;
    points += ours > theirs ? 3 : ours === theirs ? 1 : 0;
    injuries += result.events.filter((e) => e.type === 'injury' && e.team === (atHome ? 'home' : 'away')).length;
  }

  return { ppg: points / N, injuries };
}

/**
 * The comissão técnica, on the pitch.
 *
 * Two of the five staff roles were sold on the hiring screen and wired to nothing. `getTacticalAssistantBonus`
 * had no callers at all, which made the Auxiliar Tático the one role with no effect anywhere in the game.
 * `getInjuryReductionRate` had none on the server: the only code reading it was a variable in the transfers
 * page that nothing then rendered. Both promises were text.
 *
 * These are statistical tests over 500 matches between identical squads, which is the only honest way to
 * ask whether hiring somebody changed anything.
 */
describe('staff on the pitch', () => {
  it('makes a tactical assistant worth hiring, and a better one worth more', () => {
    const none = playSeason([]);
    const bronze = playSeason([hire('TACTICAL_ASSISTANT', 'BRONZE')]);
    const diamond = playSeason([hire('TACTICAL_ASSISTANT', 'DIAMANTE')]);

    expect(bronze.ppg, `bronze ${bronze.ppg.toFixed(3)} x nenhum ${none.ppg.toFixed(3)}`).toBeGreaterThan(none.ppg);
    expect(diamond.ppg, `diamante ${diamond.ppg.toFixed(3)} x bronze ${bronze.ppg.toFixed(3)}`).toBeGreaterThan(bronze.ppg);

    /**
     * And it has to stay a hire, not a cheat code. Measured at roughly +2,9 points over a 38-round season
     * for a bronze and +6,8 for a diamante, which is one or two extra wins: enough to be felt, nowhere near
     * enough to decide a championship on its own.
     */
    const overSeason = (diamond.ppg - none.ppg) * 38;
    expect(overSeason, `diamante vale ${overSeason.toFixed(1)} pontos numa temporada`).toBeLessThan(12);
  }, 120000);

  it('makes a fitness coach keep players on the pitch', () => {
    const none = playSeason([]);
    const coached = playSeason([hire('FITNESS_COACH', 'DIAMANTE')]);

    expect(
      coached.injuries,
      `com preparador ${coached.injuries} lesões x sem ${none.injuries}`,
    ).toBeLessThan(none.injuries);
  }, 120000);

  it('leaves a club with no staff exactly where the calibration found it', () => {
    /**
     * The whole engine is calibrated against a match with every dial neutral (see matchProfile.test.ts).
     * Staff bonuses are multipliers, so a club that employs nobody has to come out at exactly 1: if an empty
     * comissão moved the baseline even slightly, every calibrated figure in the game would have shifted with
     * it.
     */
    const { us, them, ourTactic, theirTactic } = twins([]);
    const withEmptyArray = simulateMatch({ seed: 'neutral', home: { club: us, tactic: ourTactic }, away: { club: them, tactic: theirTactic } });

    const noStaffField: Club = { ...us };
    delete (noStaffField as { staff?: unknown }).staff;
    const withNoField = simulateMatch({
      seed: 'neutral',
      home: { club: noStaffField, tactic: ourTactic },
      away: { club: them, tactic: theirTactic },
    });

    expect(withNoField.homeGoals).toBe(withEmptyArray.homeGoals);
    expect(withNoField.awayGoals).toBe(withEmptyArray.awayGoals);
    expect(withNoField.events.length).toBe(withEmptyArray.events.length);
  });
});

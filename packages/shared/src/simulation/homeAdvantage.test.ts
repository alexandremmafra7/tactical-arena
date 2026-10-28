import { describe, it, expect } from 'vitest';
import { DEFAULT_CROWD_INTENSITY, NEUTRAL_HOME_ADVANTAGE, homeAdvantageFactors } from './homeAdvantage.js';
import { simulateMatch } from './engine.js';
import { generateStarterSquad } from '../domain/squadGenerator.js';
import { autoFillLineup } from '../domain/lineupAutofill.js';
import { makeClub } from './testFactories.js';

describe('homeAdvantageFactors', () => {
  it('favours the hosts in every dimension at a typical crowd', () => {
    const f = homeAdvantageFactors(DEFAULT_CROWD_INTENSITY);
    expect(f.attack).toBeGreaterThan(1);
    expect(f.defense).toBeGreaterThan(1);
    // The referee lean: fewer whistles against the hosts, more against the visitors.
    expect(f.homeFoul).toBeLessThan(1);
    expect(f.awayFoul).toBeGreaterThan(1);
  });

  it('grows with the crowd but never disappears when the ground is empty', () => {
    const empty = homeAdvantageFactors(0);
    const full = homeAdvantageFactors(1);

    expect(full.attack).toBeGreaterThan(empty.attack);
    expect(full.defense).toBeGreaterThan(empty.defense);
    expect(full.awayFoul).toBeGreaterThan(empty.awayFoul);
    // Travel and familiarity survive an empty stand — this is what the COVID matches showed.
    expect(empty.attack).toBeGreaterThan(1);
    expect(empty.defense).toBeGreaterThan(1);
  });

  it('clamps a nonsense crowd figure instead of trusting it', () => {
    expect(homeAdvantageFactors(-5)).toEqual(homeAdvantageFactors(0));
    expect(homeAdvantageFactors(37)).toEqual(homeAdvantageFactors(1));
  });

  it('offers a genuinely neutral venue for callers that want no mando at all', () => {
    expect(NEUTRAL_HOME_ADVANTAGE).toEqual({ attack: 1, defense: 1, homeFoul: 1, awayFoul: 1 });
  });
});

/**
 * The calibration itself, held against the research targets in homeAdvantage.ts: two identical squads with
 * identical tactics, so every point the home side takes beyond half is the venue.
 *
 * Asserted as a *band* rather than an exact figure — the point is that the mando is real and realistic, and
 * pinning it to a decimal would turn every future engine tweak into a failing test for no benefit.
 */
describe('engine: playing at home', () => {
  function evenSides() {
    const shell = (id: string) => ({ ...makeClub(id, id, 70), players: generateStarterSquad(id, 'BRA', 'identical-squad') });
    const home = shell('home-mando');
    const away = shell('away-mando');
    return {
      home,
      away,
      homeTactic: { ...autoFillLineup(home), clubId: home.id },
      awayTactic: { ...autoFillLineup(away), clubId: away.id },
    };
  }

  function pointsShare(crowdIntensity: number | undefined, n = 1500) {
    const { home, away, homeTactic, awayTactic } = evenSides();
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    for (let i = 0; i < n; i++) {
      const r = simulateMatch({
        home: { club: home, tactic: homeTactic },
        away: { club: away, tactic: awayTactic },
        seed: `mando-${i}`,
        crowdIntensity,
      });
      if (r.homeGoals > r.awayGoals) homeWins++;
      else if (r.homeGoals < r.awayGoals) awayWins++;
      else draws++;
    }

    const homePts = homeWins * 3 + draws;
    const awayPts = awayWins * 3 + draws;
    return homePts / (homePts + awayPts);
  }

  it('gives the hosts roughly the share of points real football does', () => {
    const share = pointsShare(DEFAULT_CROWD_INTENSITY);
    // Top leagues land near 57%; Brazilian football sits at the upper end of that band.
    expect(share).toBeGreaterThan(0.54);
    expect(share).toBeLessThan(0.62);
  });

  it('is worth more in a full ground than an empty one', () => {
    expect(pointsShare(1)).toBeGreaterThan(pointsShare(0));
  });

  it('applies the mando by default, so a caller that knows no crowd figure still gets a real match', () => {
    expect(pointsShare(undefined)).toBeGreaterThan(0.52);
  });
});

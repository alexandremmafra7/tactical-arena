import { describe, expect, it } from 'vitest';
import {
  MATCH_DEVELOPMENT_POINTS_FULL_MATCH,
  developmentPlasticity,
  matchDevelopmentPoints,
} from './development.js';

/**
 * Minutes on the pitch develop a footballer.
 *
 * The rule exists because `developmentPoints` used to come only from a manager pressing "treinar", which
 * meant they came only from the single club a human runs. Every other player in the world earned nothing,
 * ever — so the moment the world started playing its own competitions in the background, the entire
 * opposition would sit frozen at its starting overall while the manager's squad pulled away.
 */
describe('development from playing', () => {
  it('gives nothing to a player who did not play', () => {
    expect(matchDevelopmentPoints(24, 0)).toBe(0);
    expect(matchDevelopmentPoints(24, -1)).toBe(0);
  });

  it('scales with minutes actually played', () => {
    const full = matchDevelopmentPoints(28, 90);
    const half = matchDevelopmentPoints(28, 45);
    const cameOn = matchDevelopmentPoints(28, 10);
    expect(half).toBeCloseTo(full / 2, 5);
    expect(cameOn).toBeLessThan(half);
    expect(cameOn).toBeGreaterThan(0);
  });

  it('never pays more than a full match, however long the game ran', () => {
    // Stoppage time must not turn into a development loophole.
    expect(matchDevelopmentPoints(28, 120)).toBeCloseTo(matchDevelopmentPoints(28, 90), 5);
  });

  it('teaches the young far more than the old, on the same curve as everything else', () => {
    const teenager = matchDevelopmentPoints(17, 90);
    const prime = matchDevelopmentPoints(24, 90);
    const veteran = matchDevelopmentPoints(33, 90);

    expect(teenager).toBeGreaterThan(prime);
    // Past the growth ceiling `developmentPlasticity` is flat at 1, so a 24-year-old and a 33-year-old
    // earn the same from the same minutes. That is the curve working as designed, not an oversight: what
    // separates them is what `evolvePlayer` does afterwards, where the veteran declines regardless.
    expect(veteran).toBeCloseTo(prime, 5);

    // Reuses `developmentPlasticity` rather than inventing a second age curve that could drift from it.
    expect(teenager).toBeCloseTo(MATCH_DEVELOPMENT_POINTS_FULL_MATCH * developmentPlasticity(17), 5);
  });

  it('is worth clearly less than a dedicated training session', () => {
    // Training is 20 points (TRAINING_DEVELOPMENT_BOOST). Playing has to matter without ever beating
    // coaching, or a manager who trains would be wasting their time.
    const TRAINING = 20;
    expect(matchDevelopmentPoints(24, 90)).toBeLessThan(TRAINING);
    expect(matchDevelopmentPoints(17, 90)).toBeLessThan(TRAINING);
  });

  it('is the same rule at every age boundary, with no cliff', () => {
    for (let age = 16; age <= 38; age += 1) {
      const points = matchDevelopmentPoints(age, 90);
      expect(points, `age ${age}`).toBeGreaterThan(0);
      expect(points, `age ${age}`).toBeLessThanOrEqual(MATCH_DEVELOPMENT_POINTS_FULL_MATCH * 2.6);
    }
    // Monotonic: growing older never suddenly pays *more*.
    for (let age = 17; age <= 38; age += 1) {
      expect(matchDevelopmentPoints(age, 90)).toBeLessThanOrEqual(matchDevelopmentPoints(age - 1, 90));
    }
  });
});

import { Club } from './club.js';

/**
 * CLUB VISIBILITY & REPUTATION SYSTEM
 *
 * Quantifies a club's media appeal, audience reach, and prestige (0-100 score).
 * Proportionally modulates TV rights earnings, facility fees, and sponsorship revenue.
 */

export type VisibilityTier = 'LOCAL' | 'REGIONAL' | 'NACIONAL' | 'CONTINENTAL' | 'GLOBAL';

export interface VisibilityBreakdown {
  squad: number;       // 0 - 25 points
  stadium: number;     // 0 - 20 points
  membership: number;  // 0 - 20 points
  titles: number;      // 0 - 20 points
  division: number;    // 0 - 15 points
}

export interface ClubVisibility {
  score: number; // 0 - 100
  tier: VisibilityTier;
  label: string;
  tvRevenueMultiplier: number;
  openBroadcastChance: number; // probability of being picked for Free-To-Air flagship matches
  breakdown: VisibilityBreakdown;
}

export function getVisibilityTier(score: number): { tier: VisibilityTier; label: string; tvMultiplier: number; openChance: number } {
  if (score >= 85) {
    return { tier: 'GLOBAL', label: 'Marca Global', tvMultiplier: 2.2, openChance: 0.85 };
  }
  if (score >= 70) {
    return { tier: 'CONTINENTAL', label: 'Gigante Continental', tvMultiplier: 1.7, openChance: 0.70 };
  }
  if (score >= 50) {
    return { tier: 'NACIONAL', label: 'Força Nacional', tvMultiplier: 1.35, openChance: 0.50 };
  }
  if (score >= 30) {
    return { tier: 'REGIONAL', label: 'Destaque Regional', tvMultiplier: 1.1, openChance: 0.30 };
  }
  return { tier: 'LOCAL', label: 'Clube Local', tvMultiplier: 0.9, openChance: 0.15 };
}

/**
 * Computes the overall visibility index of a club.
 */
export function calculateClubVisibility(
  club: Club,
  division: number = 1,
  titlesWon: number = 0,
  membersCount: number = 20_000,
): ClubVisibility {
  // 1. Squad Strength (0 - 25 pts)
  const squadOvr = club.players.length > 0
    ? club.players.reduce((sum, p) => sum + p.overall, 0) / club.players.length
    : 70;
  const starsCount = club.players.filter((p) => p.starLevel && p.starLevel !== 'NONE').length;
  const squadScore = Math.min(25, Math.max(5, ((squadOvr - 50) / 45) * 20 + starsCount * 1.5));

  // 2. Stadium & Infrastructure (0 - 20 pts)
  const capacity = club.stadiumCapacity ?? 15_000;
  const stadiumScore = Math.min(20, Math.max(3, (capacity / 100_000) * 20));

  // 3. Membership Reach (0 - 20 pts)
  const membershipScore = Math.min(20, Math.max(2, (membersCount / 120_000) * 20));

  // 4. Titles & Glory (0 - 20 pts)
  const titlesScore = Math.min(20, titlesWon * 5);

  // 5. Division Prestige (0 - 15 pts)
  const divisionScore = division === 1 ? 15 : division === 2 ? 8 : 4;

  const totalScore = Math.min(100, Math.max(10, Math.round(squadScore + stadiumScore + membershipScore + titlesScore + divisionScore)));
  const { tier, label, tvMultiplier, openChance } = getVisibilityTier(totalScore);

  return {
    score: totalScore,
    tier,
    label,
    tvRevenueMultiplier: tvMultiplier,
    openBroadcastChance: openChance,
    breakdown: {
      squad: Math.round(squadScore),
      stadium: Math.round(stadiumScore),
      membership: Math.round(membershipScore),
      titles: Math.round(titlesScore),
      division: Math.round(divisionScore),
    },
  };
}

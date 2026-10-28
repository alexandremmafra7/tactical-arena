/**
 * What a tactical assistant is worth.
 *
 * `getTacticalAssistantBonus` promises up to +14% on attack and defence, a figure nothing ever checked
 * because nothing ever called it. Two identical squads, one with an assistant and one without, over enough
 * matches to see past the noise.
 */
import {
  generateStarterSquad,
  simulateMatch,
  autoFillLineup,
  STAFF_TIER_CONFIG,
  type Club,
  type StaffMember,
  type StaffTier,
} from '../packages/shared/src/index.js';

const MATCHES = 3000;

function club(id: string, staff: StaffMember[] = []): Club {
  const players = generateStarterSquad(id, 'BRA', undefined, 70);
  return {
    id, name: id, ownerId: 'bench', slug: null, country: 'BRA', players, academyPlayers: [],
    budget: 0, captainPlayerId: null, captainWeeksServed: 0, tutorPlayerId: null, penaltyTakerId: null,
    freeKickTakerId: null, cornerLeftTakerId: null, cornerRightTakerId: null, stadiumLevel: 1,
    stadiumCapacity: 2000, stadiumConstruction: null, titlesWon: 0, sponsorships: [], loans: [],
    pendingTransferPayments: [], pendingRoundTactic: null, staff,
  } as Club;
}

function assistant(tier: StaffTier): StaffMember {
  const config = STAFF_TIER_CONFIG[tier];
  return {
    id: `a-${tier}`, name: `Auxiliar ${tier}`, role: 'TACTICAL_ASSISTANT', tier,
    rating: config.maxRating, specialty: 'teste', description: '', wage: config.baseWage,
    minClubVisibility: 0, minCareerTitles: 0, avatar: '', nationality: 'BRA',
  };
}

function run(withStaff: StaffMember[]) {
  const a = club('com', withStaff);
  const b = club('sem');
  const tacticA = autoFillLineup(a);
  const tacticB = autoFillLineup(b);

  let points = 0, goalsFor = 0, goalsAgainst = 0;
  for (let i = 0; i < MATCHES; i += 1) {
    // Alternating the venue so home advantage cancels out of the comparison.
    const home = i % 2 === 0;
    const result = simulateMatch({
      home: home ? { club: a, tactic: tacticA } : { club: b, tactic: tacticB },
      away: home ? { club: b, tactic: tacticB } : { club: a, tactic: tacticA },
      seed: `assist-${i}`,
    });
    const mine = home ? result.homeGoals : result.awayGoals;
    const theirs = home ? result.awayGoals : result.homeGoals;
    goalsFor += mine;
    goalsAgainst += theirs;
    points += mine > theirs ? 3 : mine === theirs ? 1 : 0;
  }
  return { ppg: points / MATCHES, gf: goalsFor / MATCHES, ga: goalsAgainst / MATCHES };
}

const baseline = run([]);
console.log(`sem auxiliar     ${baseline.ppg.toFixed(3)} pts/jogo   ${baseline.gf.toFixed(2)} marcados   ${baseline.ga.toFixed(2)} sofridos`);
for (const tier of ['BRONZE', 'OURO', 'DIAMANTE'] as StaffTier[]) {
  const r = run([assistant(tier)]);
  const overSeason = (r.ppg - baseline.ppg) * 38;
  console.log(
    `${tier.padEnd(9)} ${STAFF_TIER_CONFIG[tier].maxRating} OVR  ${r.ppg.toFixed(3)} pts/jogo   ` +
      `${r.gf.toFixed(2)} marcados   ${r.ga.toFixed(2)} sofridos   ` +
      `${overSeason >= 0 ? '+' : ''}${overSeason.toFixed(1)} pontos em 38 rodadas`,
  );
}

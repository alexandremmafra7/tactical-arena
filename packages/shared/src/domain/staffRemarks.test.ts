import { describe, expect, it } from 'vitest';
import { directorVerdict, lineupRemarks, scoutingRemarks, spendingRemarks, youthRemarks } from './staffRemarks.js';
import type { StaffMember, StaffRole } from './staff.js';
import { makeClub, makePlayer } from '../simulation/testFactories.js';

function staff(role: StaffRole, rating: number, name = 'Fulano'): StaffMember {
  return {
    id: `${role}-${rating}`,
    name,
    role,
    tier: 'OURO',
    rating,
    specialty: 'teste',
    description: '',
    wage: 10_000,
    minClubVisibility: 0,
    minCareerTitles: 0,
    avatar: '',
    nationality: 'BRA',
  };
}

const PROSPECTS = [
  makePlayer('joia', { name: 'Joia', age: 17, potential: 88 }),
  makePlayer('medio', { name: 'Mediano', age: 18, potential: 70 }),
  makePlayer('fraco', { name: 'Limitado', age: 19, potential: 55 }),
];

function clubWith(overrides: Record<string, unknown> = {}) {
  return { ...makeClub('remarks', 'Parecer FC', 70), academyPlayers: PROSPECTS, ...overrides } as ReturnType<typeof makeClub>;
}

/**
 * The comissão, speaking where the manager is already working.
 *
 * Everything the staff did was invisible: multipliers applied in a service somewhere, on a screen the manager
 * had no reason to open twice. These are the two places where a member of staff now has an opinion the
 * manager can act on, and in both of them the opinion is theirs, with their own error in it.
 */
describe('staff remarks', () => {
  it('says nothing useful when nobody holds the post, and says so', () => {
    const empty = youthRemarks(clubWith({ staff: [] }));
    expect(empty).toHaveLength(1);
    expect(empty[0].tone).toBe('VACANT');
    expect(empty[0].staffName).toBeNull();
  });

  it('has the coordinator pick a prospect and say how sure they are', () => {
    const elite = youthRemarks(clubWith({ staff: [staff('YOUTH_COORDINATOR', 98, 'Elite')] }));
    const weak = youthRemarks(clubWith({ staff: [staff('YOUTH_COORDINATOR', 55, 'Fraco')] }));

    // An elite coordinator can see the ceiling and says so plainly.
    expect(elite[0].text).toContain('Joia');
    expect(elite[0].text).not.toContain('cedo para cravar');

    /**
     * A weak one hedges, and it is not just wording: their ranking runs on a reading of each boy that can be
     * a dozen points out, which is what makes two coordinators of the same price worth different money.
     */
    expect(weak[0].text).toContain('cedo para cravar');
  });

  it('does not change its mind when the screen is reopened', () => {
    const club = clubWith({ staff: [staff('YOUTH_COORDINATOR', 60)] });
    expect(youthRemarks(club)).toEqual(youthRemarks(club));
  });

  it('warns that an eligible jewel awaits the manager decision in manual mode', () => {
    const ready = makePlayer('pronto', { name: 'Pronto', age: 18, overall: 70, potential: 82 });
    const club = clubWith({
      academyPlayers: [ready],
      staff: [staff('YOUTH_COORDINATOR', 90, 'Coordenador')],
      staffDelegationConfig: {
        ...clubWith().staffDelegationConfig,
        youthPromotions: 'manual',
        trainingRegime: 'individual_attributes',
        presetMode: 'football_manager_hardcore',
      },
    });

    const remarks = youthRemarks(club);

    expect(remarks.some((remark) => remark.playerId === ready.id && remark.text.includes('decisão'))).toBe(true);
  });

  it('leaves a price unjudged when there is no director to judge it', () => {
    const target = makePlayer('alvo', { name: 'Alvo', marketValue: 1_000_000 });
    expect(directorVerdict(clubWith({ staff: [] }), target, 1_000_000)).toBeNull();
    expect(scoutingRemarks(clubWith({ staff: [] }), target, 1_000_000)[0].tone).toBe('VACANT');
  });

  it('calls a price cheap, fair or dear against the director own valuation', () => {
    const club = clubWith({ staff: [staff('FOOTBALL_DIRECTOR', 98, 'Olho Bom')] });
    const target = makePlayer('alvo', { name: 'Alvo', marketValue: 1_000_000 });

    const fair = directorVerdict(club, target, target.marketValue)!;
    const dear = directorVerdict(club, target, target.marketValue * 3)!;
    const cheap = directorVerdict(club, target, target.marketValue * 0.3)!;

    expect(fair.label).toBe('Justo');
    expect(dear.label).toBe('Caro');
    expect(cheap.label).toBe('Pechincha');
    expect(dear.tone).toBe('WARNING');
    expect(cheap.tone).toBe('OPPORTUNITY');
  });

  it('makes a better director a more reliable valuer', () => {
    const target = makePlayer('alvo', { name: 'Alvo', marketValue: 1_000_000 });

    const off = (rating: number) => {
      let worst = 0;
      // Several directors of the same quality, since each one's error is seeded on their own id.
      for (let n = 0; n < 30; n += 1) {
        const club = clubWith({ staff: [{ ...staff('FOOTBALL_DIRECTOR', rating), id: `dir-${rating}-${n}` }] });
        const verdict = directorVerdict(club, target, target.marketValue)!;
        worst = Math.max(worst, Math.abs(verdict.valuation - target.marketValue) / target.marketValue);
      }
      return worst;
    };

    /**
     * The point of paying for a director. The discount they negotiate was always real; what they never did
     * was tell the manager whether the thing was worth buying, and a weak one still cannot.
     */
    expect(off(98)).toBeLessThan(off(55));
    expect(off(98)).toBeLessThan(0.1);
  });

  it('has the fitness coach speak about the eleven actually picked, not the whole squad', () => {
    const tired = makePlayer('cansado', { name: 'Cansado', fatigue: 92 });
    const fresh = makePlayer('inteiro', { name: 'Inteiro', fatigue: 5 });
    const club = clubWith({ players: [tired, fresh], staff: [staff('FITNESS_COACH', 90, 'Zeca')] });

    const picked = lineupRemarks(club, [tired.id]);
    const rested = lineupRemarks(club, [fresh.id]);

    /**
     * The difference from the home screen's advice, which is about the squad. This one answers a question
     * about the team sheet in front of the manager, so it has to change when the team sheet changes.
     */
    expect(picked[0].tone).toBe('WARNING');
    expect(picked[0].text).toContain('Cansado');
    expect(rested[0].tone).toBe('INFO');
    expect(rested[0].text).not.toContain('Cansado');
  });

  it('never buries the warning under a list of eleven names', () => {
    const players = Array.from({ length: 11 }, (_, i) => makePlayer(`p${i}`, { name: `Exausto ${i}`, fatigue: 95 }));
    const club = clubWith({ players, staff: [staff('FITNESS_COACH', 90, 'Zeca')] });

    // A voice that flags every player has said nothing about any of them.
    expect(lineupRemarks(club, players.map((p) => p.id)).length).toBeLessThanOrEqual(3);
  });

  it('tells the manager what a big purchase leaves behind, not just whether it clears', () => {
    const club = clubWith({ budget: 5_000_000, staff: [staff('FINANCIAL_DIRECTOR', 85, 'Marco')] });

    const unaffordable = spendingRemarks(club, 9_000_000, -50_000)[0];
    const tight = spendingRemarks(club, 4_600_000, -50_000)[0];
    const comfortable = spendingRemarks(club, 1_000_000, -50_000)[0];

    expect(unaffordable.tone).toBe('WARNING');
    expect(unaffordable.text).toContain('Faltam');

    /**
     * The figure the stadium screen never showed. The button already refuses when the money is not there at
     * all, which is a different question from whether spending it is wise: R$ 400.000 left against a
     * R$ 50.000 weekly burn is eight weeks of club left.
     */
    expect(tight.tone).toBe('WARNING');
    expect(tight.text).toContain('8 semanas');
    expect(comfortable.tone).toBe('INFO');
  });

  it('says nothing about spending when nobody is watching the money', () => {
    const club = clubWith({ budget: 5_000_000, staff: [] });
    expect(spendingRemarks(club, 1_000_000, -50_000)[0].tone).toBe('VACANT');
  });
});

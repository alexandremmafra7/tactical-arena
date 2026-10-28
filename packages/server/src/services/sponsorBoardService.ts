import {
  averageSquadOverall,
  buildSponsorBoard,
  createRng,
  type Player,
  type Sponsorship,
} from '@tactical-arena/shared';

/**
 * The sponsor board a club carries when nobody is negotiating for it.
 *
 * Signing a deal is a manager's decision and stays one (see `signSponsorship`, which checks ownership).
 * What this fills in is the board a club already had when the season started, which every club in the
 * world was missing: a computer-run club could never sign anything, so it ran permanently at a loss.
 *
 * `leaguePosition` is deliberately null. A board is drawn before a ball is kicked, and asking for the
 * table here would drag the league service into club creation and into the season turn, where it would
 * cost a query per club across thousands of them.
 */
export function sponsorBoardFor(club: {
  id: string;
  players: Player[];
  stadiumLevel: number;
  stadiumCapacity: number;
  division: number;
  titlesWon: number;
  season?: number;
}): Sponsorship[] {
  /**
   * The generator names its offers after the sponsorship type, which is fine for a list of offers on a
   * screen and wrong for a signed contract: every club in the world would hold a deal with the id
   * `board-MASTER`. Stamped with the club and the season, they are unique and still reproducible.
   */
  const stamp = (deal: Sponsorship): Sponsorship => ({ ...deal, id: `${club.id}-${club.season ?? 0}-${deal.type}` });

  return buildSponsorBoard(
    createRng(`sponsors-${club.id}-${club.season ?? 0}`),
    {
      avgSquadOverall: averageSquadOverall(club.players),
      stadiumLevel: club.stadiumLevel,
      division: club.division,
      leaguePosition: null,
      totalClubsInLeague: 20,
      titlesWon: club.titlesWon,
    },
    club.stadiumCapacity,
  ).map(stamp);
}

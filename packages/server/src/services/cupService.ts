import { randomUUID } from 'node:crypto';
import {
  BOT_OWNER_ID,
  Club,
  Cup,
  CupFixture,
  MatchResult,
  Player,
  Tactic,
  autoFillLineup,
  botTactic,
  tacticalIdentityOf,
  createRng,
  generateFirstRoundFixtures,
  generateNextRoundFixtures,
  resolveLineupPlayers,
  resolvePenaltyWinner,
  simulatePenaltyShootout,
  totalCupRounds,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { scheduleCupRound } from './scheduleService.js';
import { getGameState } from './gameStateService.js';
import { getClub } from './clubService.js';
import { createLiveMatch, getMatch, tickLiveMatchSystem } from './matchService.js';
import { distributeCupPrizeMoney } from './financeService.js';
import { getDefaultPreset } from './tacticPresetService.js';
import { computeTopScorer } from './topScorerService.js';
import { generateTitleNews } from './newsService.js';

export class CupError extends Error {}

/**
 * The cup, round number and every fixture in that round for `matchId` — what the live-match banner and its
 * round ticker are built from. Read once when the screen opens, not on every tick of the clock.
 */
export async function findCupRoundContext(
  matchId: string,
): Promise<{ cup: Cup; round: number; fixtures: CupFixture[] } | null> {
  /**
   * Narrowed the same way as `findLeagueRoundContext`, and for the same reason: a live match is always in
   * a competition still being played, and searching the text is SQLite's job rather than Node's. Cup
   * brackets are far smaller than league calendars so this was never the expensive one — but it grows
   * with every season played just the same, and the shape should not differ between the two.
   */
  const candidates = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Cup"
    WHERE "status" = 'IN_PROGRESS' AND instr("fixturesJson", ${matchId}) > 0
    LIMIT 1
  `;
  if (candidates.length === 0) return null;

  const record = await prisma.cup.findUnique({ where: { id: candidates[0].id } });
  if (!record) return null;

  const cup = toDomain(record);
  const fixture = cup.fixtures.find((f) => f.matchId === matchId);
  if (!fixture) return null;
  return { cup, round: fixture.round, fixtures: cup.fixtures.filter((f) => f.round === fixture.round) };
}

/**
 * Picks the tactic a cup fixture is played with: the manager's own standing lineup, then their
 * marked-default `TacticPreset` if it still fields a valid XI, then auto-fill.
 *
 * `pendingRoundTactic` used to be skipped here on purpose, because it was consumed once played and a cup tie
 * would have silently eaten a side picked for the next league match. It is no longer consumed by anything
 * (see leagueService.resolveLeagueTactic), so it is simply "the lineup this manager picked" — and ignoring
 * that in a cup would mean their chosen side turns out only half the time, which is the opposite of what a
 * standing lineup is for.
 */
async function resolveCupTactic(club: Club, cupId: string): Promise<Tactic> {
  if (club.pendingRoundTactic) {
    try {
      resolveLineupPlayers(club, club.pendingRoundTactic, cupId);
      return club.pendingRoundTactic;
    } catch {
      // Not valid for this competition (a cup-scoped suspension, say) — fall through, but leave it saved.
    }
  }

  const preset = await getDefaultPreset(club.id);
  if (preset) {
    const tactic: Tactic = {
      clubId: club.id,
      formation: preset.formation,
      mentality: preset.mentality,
      attackStyle: preset.attackStyle,
      markingStyle: preset.markingStyle,
      attackApproach: preset.attackApproach,
      pressing: preset.pressing,
      lineup: preset.lineup,
      substitutes: preset.substitutes,
      plannedSubstitutions: [],
    };
    try {
      resolveLineupPlayers(club, tactic, cupId);
      return tactic;
    } catch {
      // Preset no longer fields a valid XI (player sold/retired/suspended) — fall through to auto-fill.
    }
  }
  // A club the computer runs gets its own standing style; a human club falls back to plain neutral, since
  // inventing a tactical identity for someone's own team behind their back is worse than picking nothing.
  if (club.ownerId === BOT_OWNER_ID) {
    const identity = tacticalIdentityOf(club);
    const autoFilled = autoFillLineup(club, cupId, identity.formation);
    return botTactic(club, autoFilled);
  }
  return autoFillLineup(club, cupId, '4-4-2');
}

/**
 * A rough overall-based strength reading for the penalty-shootout tiebreak — deliberately *not*
 * `computeTeamStrength`, which re-validates the lineup against the club's *current* squad (including
 * suspensions) and would throw for a fixture resolved earlier in the bracket, once a later match has
 * since sent one of these same players off. The shootout just needs a plausible weighting, not the
 * full simulation-accurate figure.
 */
function roughLineupStrength(club: Club, tactic: Tactic): number {
  const byId = new Map(club.players.map((p) => [p.id, p]));
  const overalls = tactic.lineup.map((slot) => byId.get(slot.playerId)?.overall ?? 0).filter((overall) => overall > 0);
  if (overalls.length === 0) return 0;
  return overalls.reduce((sum, overall) => sum + overall, 0) / overalls.length;
}

/** Creates a single-elimination cup for an even, power-of-2 set of clubs (e.g. 8: QF, SF, Final). */
export async function createCup(name: string, countryCode: string, clubIds: string[], seed: string = randomUUID()): Promise<Cup> {
  if (clubIds.length < 2) {
    throw new CupError('É necessário pelo menos 2 clubes para criar uma copa');
  }

  const rng = createRng(seed);
  const shuffled = [...clubIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let fixtures: CupFixture[];
  try {
    fixtures = generateFirstRoundFixtures(shuffled);
  } catch (err) {
    throw new CupError((err as Error).message);
  }

  const id = randomUUID();
  // The season comes from the game clock, not the wall clock: once the in-game year moves past the real
  // one, a cup stamped with new Date() would land in a season the leagues are no longer playing.
  const season = (await getGameState()).seasonYear;
  const datedFixtures = await scheduleCupRound(fixtures, season, 1, shuffled);
  await prisma.cup.create({
    data: {
      id,
      name,
      countryCode,
      clubIdsJson: JSON.stringify(shuffled),
      fixturesJson: JSON.stringify(datedFixtures),
      status: 'IN_PROGRESS',
      season,
    },
  });

  return getCup(id);
}

export async function getCup(cupId: string): Promise<Cup> {
  const record = await prisma.cup.findUnique({ where: { id: cupId } });
  if (!record) {
    throw new CupError(`Copa ${cupId} não encontrada`);
  }
  return toDomain(record);
}

export async function listCups(countryCode?: string): Promise<Cup[]> {
  const records = await prisma.cup.findMany({
    where: countryCode ? { countryCode } : undefined,
    orderBy: { createdAt: 'asc' },
  });
  return records.map(toDomain);
}

/**
 * Resolves every still-pending fixture in the current round. Every fixture is created live (see
 * createLiveMatch): one with no real manager on either side is fast-forwarded through the engine right
 * away (default preset or auto-fill tactics); one with a real manager stays paused so they can go watch
 * it — that fixture then stays pending, blocking the round, until a later `advanceCupRound` call finds it
 * finished. Any draw is broken by a strength-weighted penalty shootout since there's no extra-time
 * simulation. A completed round generates the next round's pairings from the winners, or crowns the
 * champion if that was the final.
 */
export async function advanceCupRound(cupId: string, requestingUserId?: string): Promise<Cup> {
  const cup = await getCup(cupId);
  if (cup.status !== 'IN_PROGRESS') {
    throw new CupError('Esta copa já foi concluída');
  }
  /**
   * This check did not exist at all: any authenticated user could advance any cup, including one they had
   * no club in. It arrives now because the split below gives it somewhere to live — `playCupRound` is the
   * unauthorized half the time service calls after checking the save once, and this is the authorized
   * half the route calls. `requestingUserId` is optional only so existing callers keep working.
   */
  if (requestingUserId) {
    const clubs = await prisma.club.findMany({
      where: { id: { in: cup.clubIds }, ownerId: requestingUserId },
      select: { id: true },
    });
    if (clubs.length === 0) {
      throw new CupError('Você não tem clube nesta copa');
    }
  }
  return playCupRound(cupId);
}

/**
 * One cup round, with no question of who asked for it. See `playLeagueRound` for why the two halves are
 * separate: authorization is about the user, and which round is due is now a question for the calendar.
 */
export async function playCupRound(cupId: string, requestedRound?: number): Promise<Cup> {
  const cup = await getCup(cupId);
  if (cup.status !== 'IN_PROGRESS') {
    throw new CupError('Esta copa já foi concluída');
  }

  const pendingRounds = cup.fixtures.filter((f) => f.winnerClubId === null).map((f) => f.round);
  if (pendingRounds.length === 0) {
    throw new CupError('Não há rodada pendente para avançar');
  }
  const round = requestedRound ?? Math.min(...pendingRounds);
  // Same as the league: a round already played is a no-op, not a failure.
  if (!pendingRounds.includes(round)) return cup;

  const updatedFixtures = [...cup.fixtures];

  // Same reasoning as leagueService.advanceRound: if a human is involved anywhere in this round, every
  // fixture is created live and left paced together (see the live-match round ticker) instead of only
  // pacing the human's own tie. Only resolve instantly when nobody in the whole round is human.
  const roundFixtures = updatedFixtures.filter((f) => f.round === round && f.winnerClubId === null && f.matchId === null);
  const roundClubOwners = new Map<string, string>();
  for (const fixture of roundFixtures) {
    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      if (!roundClubOwners.has(clubId)) roundClubOwners.set(clubId, (await getClub(clubId)).ownerId);
    }
  }
  const roundHasHuman = [...roundClubOwners.values()].some((ownerId) => ownerId !== BOT_OWNER_ID);

  for (let i = 0; i < updatedFixtures.length; i++) {
    const fixture = updatedFixtures[i];
    if (fixture.round !== round || fixture.winnerClubId !== null) continue;

    const homeClub = await getClub(fixture.homeClubId);
    const awayClub = await getClub(fixture.awayClubId);

    let homeTactic: Tactic;
    let awayTactic: Tactic;
    let homeGoals: number;
    let awayGoals: number;
    let matchId = fixture.matchId;

    if (matchId === null) {
      homeTactic = await resolveCupTactic(homeClub, cupId);
      awayTactic = await resolveCupTactic(awayClub, cupId);
      // Every fixture is created live — the engine only ever simulates matches, never precomputes a result.
      let match = await createLiveMatch(fixture.homeClubId, fixture.awayClubId, homeTactic, awayTactic, { type: 'cup', id: cupId });
      if (!roundHasHuman) {
        match = await tickLiveMatchSystem(match.id);
      }
      matchId = match.id;
      updatedFixtures[i] = { ...fixture, matchId };
      if (!match.result) continue; // live and not yet finished — leave this fixture pending
      ({ homeGoals, awayGoals } = match.result);
    } else {
      // Already has a match from an earlier advance call — auto-complete any abandoned live match to fulltime.
      let existing = await getMatch(matchId);
      if (existing.status === 'LIVE') {
        existing = await tickLiveMatchSystem(matchId);
      }
      if (existing.status !== 'SIMULATED' || !existing.result) continue; // still being played
      homeTactic = existing.homeTactic!;
      awayTactic = existing.awayTactic!;
      ({ homeGoals, awayGoals } = existing.result);
    }

    let winnerClubId: string | null = null;
    let wentToPenalties = false;
    let penaltyScore: { home: number; away: number } | undefined;
    let aggregateScore: { home: number; away: number } | undefined;
    let firstLegScore = fixture.firstLegScore;

    if (fixture.leg === 1) {
      firstLegScore = { home: homeGoals, away: awayGoals };
      winnerClubId = '__LEG1__';
    } else if (fixture.leg === 2) {
      const leg1Away = firstLegScore?.away ?? 0;
      const leg1Home = firstLegScore?.home ?? 0;
      const aggHome = homeGoals + leg1Away;
      const aggAway = awayGoals + leg1Home;
      aggregateScore = { home: aggHome, away: aggAway };

      if (aggHome !== aggAway) {
        winnerClubId = aggHome > aggAway ? fixture.homeClubId : fixture.awayClubId;
      } else {
        wentToPenalties = true;
        const shootoutRng = createRng(`${cupId}-${round}-${fixture.homeClubId}-${fixture.awayClubId}-agg-pens`);
        const homeLineupPlayers = resolveLineupPlayers(homeClub, homeTactic, cupId);
        const awayLineupPlayers = resolveLineupPlayers(awayClub, awayTactic, cupId);
        const shootout = simulatePenaltyShootout(
          homeClub,
          awayClub,
          homeLineupPlayers,
          awayLineupPlayers,
          shootoutRng,
        );
        winnerClubId = shootout.winnerClubId;
        penaltyScore = { home: shootout.homeScore, away: shootout.awayScore };

        if (matchId) {
          const matchRecord = await prisma.match.findUnique({ where: { id: matchId } });
          if (matchRecord && matchRecord.resultJson) {
            const res: MatchResult = JSON.parse(matchRecord.resultJson);
            res.penaltyShootout = shootout;
            await prisma.match.update({
              where: { id: matchId },
              data: { resultJson: JSON.stringify(res) },
            });
          }
        }
      }
    } else {
      // Single leg match
      if (homeGoals !== awayGoals) {
        winnerClubId = homeGoals > awayGoals ? fixture.homeClubId : fixture.awayClubId;
      } else {
        wentToPenalties = true;
        const shootoutRng = createRng(`${cupId}-${round}-${fixture.homeClubId}-${fixture.awayClubId}-pens`);
        const homeLineupPlayers = homeTactic.lineup
          .map((slot) => homeClub.players.find((p) => p.id === slot.playerId))
          .filter((p): p is Player => !!p);
        const awayLineupPlayers = awayTactic.lineup
          .map((slot) => awayClub.players.find((p) => p.id === slot.playerId))
          .filter((p): p is Player => !!p);
        const shootout = simulatePenaltyShootout(
          homeClub,
          awayClub,
          homeLineupPlayers,
          awayLineupPlayers,
          shootoutRng,
        );
        winnerClubId = shootout.winnerClubId;
        penaltyScore = { home: shootout.homeScore, away: shootout.awayScore };

        if (matchId) {
          const matchRecord = await prisma.match.findUnique({ where: { id: matchId } });
          if (matchRecord && matchRecord.resultJson) {
            const res: MatchResult = JSON.parse(matchRecord.resultJson);
            res.penaltyShootout = shootout;
            await prisma.match.update({
              where: { id: matchId },
              data: { resultJson: JSON.stringify(res) },
            });
          }
        }
      }
    }

    updatedFixtures[i] = {
      ...fixture,
      matchId,
      winnerClubId,
      wentToPenalties,
      penaltyScore,
      firstLegScore,
      aggregateScore,
    };
  }

  const roundStillPending = updatedFixtures.some((f) => f.round === round && f.winnerClubId === null);
  let status: Cup['status'] = 'IN_PROGRESS';
  let championClubId: string | null = null;
  let championOwnerId: string | null = null;
  let championClub: Club | null = null;

  if (!roundStillPending) {
    const currentRoundFixtures = updatedFixtures.filter((f) => f.round === round);
    const isLeg1 = currentRoundFixtures.every((f) => f.leg === 1);

    if (isLeg1) {
      // Generate Leg 2 return fixtures with inverted home/away
      const leg2Fixtures: CupFixture[] = currentRoundFixtures.map((leg1) => ({
        round: round + 1,
        stageName: (leg1.stageName ?? '').replace('(Ida)', '(Volta)'),
        homeClubId: leg1.awayClubId,
        awayClubId: leg1.homeClubId,
        matchId: null,
        winnerClubId: null,
        wentToPenalties: false,
        leg: 2,
        tieId: leg1.tieId ?? randomUUID(),
        firstLegScore: leg1.firstLegScore,
      }));
      updatedFixtures.push(...leg2Fixtures);
    } else {
      // Leg 2 completed or single-leg round completed
      const winners = currentRoundFixtures.map((f) => f.winnerClubId!).filter((id) => id !== '__LEG1__');

      if (cup.name.includes('Copa do Brasil')) {
        // Official CBF Progression
        if (round === 1) {
          // 40 winners -> Stage 2 (Single Leg)
          updatedFixtures.push(...generateNextRoundFixtures(winners, 2, '2ª Fase (Preliminar)'));
        } else if (round === 2) {
          // 20 winners -> Merge with 12 seeded giants to make 32 clubs (Stage 3 Ida)
          const seededClubs = await prisma.club.findMany({
            where: { country: 'BRA', slug: { in: ['palmeiras', 'flamengo', 'atletico-mg', 'gremio', 'botafogo', 'rb-bragantino', 'atletico-paranaense', 'fluminense', 'sao-paulo', 'internacional', 'bahia', 'fortaleza'] } },
          });
          const all32 = [...winners, ...seededClubs.map((c) => c.id)].sort(() => Math.random() - 0.5);
          const stage3Leg1: CupFixture[] = [];
          for (let k = 0; k < all32.length; k += 2) {
            stage3Leg1.push({
              round: 3,
              stageName: '3ª Fase (Ida)',
              homeClubId: all32[k],
              awayClubId: all32[k + 1],
              matchId: null,
              winnerClubId: null,
              wentToPenalties: false,
              leg: 1,
              tieId: randomUUID(),
            });
          }
          updatedFixtures.push(...stage3Leg1);
        } else if (winners.length === 1) {
          status = 'FINISHED';
          championClubId = winners[0];
          championClub = await getClub(championClubId);
          championOwnerId = championClub.ownerId;
        } else {
          // Next round of two-legged ties
          let nextStageName = 'Mata-Mata (Ida)';
          if (winners.length === 16) nextStageName = 'Oitavas de Final (Ida)';
          else if (winners.length === 8) nextStageName = 'Quartas de Final (Ida)';
          else if (winners.length === 4) nextStageName = 'Semifinais (Ida)';
          else if (winners.length === 2) nextStageName = 'Grande Final (Ida)';

          const nextLeg1: CupFixture[] = [];
          for (let k = 0; k < winners.length; k += 2) {
            nextLeg1.push({
              round: round + 1,
              stageName: nextStageName,
              homeClubId: winners[k],
              awayClubId: winners[k + 1],
              matchId: null,
              winnerClubId: null,
              wentToPenalties: false,
              leg: 1,
              tieId: randomUUID(),
            });
          }
          updatedFixtures.push(...nextLeg1);
        }
      } else {
        // Standard bracket cup
        if (winners.length === 1) {
          status = 'FINISHED';
          championClubId = winners[0];
          championClub = await getClub(championClubId);
          championOwnerId = championClub.ownerId;
        } else if (round < totalCupRounds(cup.clubIds.length)) {
          updatedFixtures.push(...generateNextRoundFixtures(winners, round + 1));
        }
      }
    }
  }

  let topScorerPlayerId: string | null = null;
  let topScorerName: string | null = null;
  let topScorerGoals: number | null = null;
  let topScorerClubId: string | null = null;
  if (status === 'FINISHED') {
    const matchIds = updatedFixtures.map((f) => f.matchId).filter((id): id is string => !!id);
    const topScorer = await computeTopScorer(matchIds, cup.clubIds);
    topScorerPlayerId = topScorer?.playerId ?? null;
    topScorerName = topScorer?.name ?? null;
    topScorerGoals = topScorer?.goals ?? null;
    topScorerClubId = topScorer?.clubId ?? null;
  }

  /**
   * Date whatever rounds were just drawn.
   *
   * A knockout bracket does not exist ahead of time — the next round's ties are only known once this one
   * has a winner — so this is the first moment those fixtures can be given a day. Each is scheduled after
   * the round that produced it, so a tie can never be dated earlier than the match that qualified for it.
   */
  const playedOn = updatedFixtures.find((f) => f.round === round && f.date)?.date ?? undefined;
  const newRounds = [...new Set(updatedFixtures.filter((f) => !f.date).map((f) => f.round))].sort((a, b) => a - b);
  let scheduledFixtures = updatedFixtures;
  for (const newRound of newRounds) {
    scheduledFixtures = await scheduleCupRound(scheduledFixtures, cup.season, newRound, cup.clubIds, playedOn);
  }

  await prisma.cup.update({
    where: { id: cupId },
    data: {
      fixturesJson: JSON.stringify(scheduledFixtures),
      status,
      championClubId,
      championOwnerId,
      topScorerPlayerId,
      topScorerName,
      topScorerGoals,
      topScorerClubId,
    },
  });

  const finishedCup: Cup = {
    ...cup,
    fixtures: updatedFixtures,
    status,
    championClubId,
    championOwnerId,
    topScorerPlayerId,
    topScorerName,
    topScorerGoals,
    topScorerClubId,
  };

  if (status === 'FINISHED') {
    await distributeCupPrizeMoney(finishedCup);
    if (championClub) {
      await generateTitleNews(championClub.name, championClub.id, cup.name).catch((err) =>
        console.error('generateTitleNews failed:', err),
      );
    }

    /**
     * Next season's edition is not created here any more — see `seasonService.turnSeason`.
     *
     * The old renewal fired the moment the final was decided, in whatever month that happened, and drew
     * a bracket with no dates attached, which left it invisible to the clock. A cup now opens when the
     * year opens, with its first round already on the calendar.
     */
  }

  return finishedCup;
}

interface CupRecord {
  id: string;
  name: string;
  countryCode: string;
  clubIdsJson: string;
  fixturesJson: string;
  status: string;
  championClubId: string | null;
  championOwnerId?: string | null;
  season: number;
  topScorerPlayerId: string | null;
  topScorerName: string | null;
  topScorerGoals: number | null;
  topScorerClubId: string | null;
}

function toDomain(record: CupRecord): Cup {
  return {
    id: record.id,
    name: record.name,
    countryCode: record.countryCode,
    clubIds: JSON.parse(record.clubIdsJson),
    fixtures: JSON.parse(record.fixturesJson),
    status: record.status as Cup['status'],
    championClubId: record.championClubId,
    championOwnerId: record.championOwnerId ?? null,
    season: record.season,
    topScorerPlayerId: record.topScorerPlayerId,
    topScorerName: record.topScorerName,
    topScorerGoals: record.topScorerGoals,
    topScorerClubId: record.topScorerClubId,
  };
}

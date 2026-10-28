import { describe, expect, it, beforeEach } from 'vitest';
import { computeTeamStrength, derivePossession } from '@tactical-arena/shared';
import { getClubTrophyRoom, getCareerTrophyRoom, setOfflineMode } from './client.js';
import {
  localAutoPrepareTactics,
  localAutoTrainSquad,
  localGetClub,
  localGetClubCalendar,
  localGetGameState,
  localAdvanceMatchday,
  localAcceptJobOffer,
  localApplyTeamTalk,
  localClaimClub,
  localGetCareer,
  localGetJobOffers,
  localGetLeagueById,
  localGetLockerRoom,
  localGetMatch,
  localAdvanceLiveMatch,
  localGetNextMatch,
  localGetNextMatchday,
  localGetStadiumPreview,
  localGetOppositionDossier,
  loadLocalGameState,
  localListTacticPresets,
  localListTransferProposals,
  localResignClub,
  localSetCaptain,
  localSetPlayerRole,
  localSetTutor,
  localTrainPlayer,
  localPayReleaseClause,
  localBuyTransferListing,
  localUpgradeStadium,
  resetInMemoryGameState,
  saveLocalGameState,
  localCreateCustomChampionship,
} from './localEngine.js';

/**
 * The offline engine has to answer in the shape the game reads.
 *
 * This is the bug that shipped to Android three times over, in three different functions, and it is
 * invisible on the desktop build because there a real server answers instead:
 *
 *  - `localGetGameState` returned `{ gameDate, currentSeasonYear, ... }` while every screen reads
 *    `currentDate`. `ClubNav` renders `formatLongPtBr(gameState.currentDate)` on every club page, so
 *    `parseGameDate(undefined)` threw during render and left a blank screen with only the background.
 *  - `localGetStadiumPreview` returned a flat object while the screen reads `preview.current.receitaPorJogo`.
 *  - `localAutoTrainSquad` and friends returned a count while every caller does `setClub(res.club)`.
 *
 *  - `localGetCareer` returned hardcoded tenures while the client expects persisted tenures with
 *    `startedAt`, `endedAt`, `endReason`, and `countryCode`.
 *  - `localGetJobOffers` returned an empty array while the client expects generated offers when
 *    unemployed and persisted offers until acceptance.
 *
 * TypeScript could not catch any of them: the functions were all typed `Promise<any>`. These assertions are
 * the check that was missing, and they are about field names rather than behaviour on purpose.
 */
describe('offline engine answers in the shape the game reads', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInMemoryGameState();
  });

  it('gives the clock a date that parses', async () => {
    const state = await localGetGameState();

    // The exact field ClubNav reads, in the exact format parseGameDate accepts.
    expect(state.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof state.seasonYear).toBe('number');
    expect(['PRE_SEASON', 'IN_SEASON', 'OFF_SEASON']).toContain(state.phase);
    expect(state).toHaveProperty('seasonStartDate');
    expect(state).toHaveProperty('seasonEndDate');
  });

  it('gives the stadium screen a preview it can read into', async () => {
    const preview = await localGetStadiumPreview('club_BRA_1');

    // `preview.current.receitaPorJogo` is a real read on that screen; a flat object throws there.
    expect(preview.current).toBeTruthy();
    expect(typeof preview.current.capacity).toBe('number');
    expect(typeof preview.current.receitaPorJogo).toBe('number');
  });

  it('hands the club back from the buttons that replace it', async () => {
    const trained = await localAutoTrainSquad('club_BRA_1');
    const prepared = await localAutoPrepareTactics('club_BRA_1');

    /**
     * Every caller does `setClub(res.club)` and renders from it on the next line. Returning a count put
     * `undefined` in state and blanked the screen one render later, which is the hardest version of this
     * bug to trace back to its cause.
     */
    expect(trained.club?.id).toBe('club_BRA_1');
    expect(typeof trained.message).toBe('string');
    expect(prepared.club?.id).toBe('club_BRA_1');
    expect(typeof prepared.message).toBe('string');
  });

  it('gives the agenda entries it can render', async () => {
    const calendar = await localGetClubCalendar('club_BRA_1');
    const entry = calendar.entries[0];

    /**
     * The agenda renders `entry.kind.toLowerCase()` and `${entry.round}ª rodada`. This used to return
     * `type: 'league'` and `title: 'Rodada 3'`, so the agenda threw on `undefined.toLowerCase()` and the
     * club page printed "RODADA UNDEFINED" from the same missing field.
     */
    expect(entry).toBeTruthy();
    expect(entry.kind).toBe('LEAGUE');
    expect(typeof entry.round).toBe('number');
    expect(entry.competitionId).toBeTruthy();
    expect(entry.competitionName).toBeTruthy();
    expect(entry.opponentName).toBeTruthy();

    // Real dates off the shared calendar, not `2026-0X-15` derived from the round number.
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const months = new Set(calendar.entries.map((e) => e.date?.slice(5, 7)));
    expect(months.size, 'uma temporada inteira não cabe num mês só').toBeGreaterThan(2);
  });

  it('hands the club back from every squad operation', async () => {
    /**
     * These seven were lost to a careless edit and rebuilt from their contracts, so they are checked rather
     * than trusted. Every caller does `setClub(...)` with what comes out; returning anything else blanks the
     * screen on the next render.
     */
    const captain = await localSetCaptain('club_BRA_1', 'algum-jogador');
    expect(captain.captainPlayerId).toBe('algum-jogador');

    // An empty id is how the client spells "nobody wears the armband".
    expect((await localSetCaptain('club_BRA_1', '')).captainPlayerId).toBeNull();
    expect((await localSetTutor('club_BRA_1', 'outro')).tutorPlayerId).toBe('outro');

    const withTaker = await localSetPlayerRole('club_BRA_1', 'batedor', 'PENALTY_TAKER', true);
    expect(withTaker.penaltyTakerId).toBe('batedor');
    expect((await localSetPlayerRole('club_BRA_1', 'batedor', 'PENALTY_TAKER', false)).penaltyTakerId).toBeNull();

    const trained = await localTrainPlayer('club_BRA_1', (captain.players[0]?.id ?? ''), 'PHYSICAL');
    expect(trained.id).toBe('club_BRA_1');
    expect(trained.players[0]?.trainingFocus).toBe('PHYSICAL');
  });

  it('answers the list endpoints with a list, not undefined', async () => {
    // Both are rendered with `.map` straight away, which is why an empty array matters and null does not do.
    expect(await localListTacticPresets('club_BRA_1')).toEqual([]);
    expect(await localListTransferProposals('club_BRA_1')).toEqual([]);
  });

  it('plays the rest of the round, so the table means something', async () => {
    await localClaimClub('club_BRA_1');

    const antes = loadLocalGameState();
    const liga = antes.leagues.find((l) => l.clubIds.includes('club_BRA_1'))!;
    expect(liga.fixtures.filter((f) => f.result)).toHaveLength(0);

    const saida = await localAdvanceMatchday();

    /**
     * Measured before this was rewritten: zero fixtures resolved, every time, because the away side was
     * handed the *home* side's tactic and `simulateMatch` threw on the first game of the round. The table
     * never moved, and there was no championship to read.
     */
    const depois = loadLocalGameState();
    const jogados = depois.leagues.find((l) => l.id === liga.id)!.fixtures.filter((f) => f.result);
    expect(jogados.length, 'os outros jogos da rodada têm de acontecer').toBeGreaterThan(0);

    // The manager's own match is left standing, because that is the one they are about to watch.
    const meu = jogados.find((f) => f.homeClubId === 'club_BRA_1' || f.awayClubId === 'club_BRA_1');
    expect(meu, 'a partida do técnico não é simulada por trás dele').toBeUndefined();
    expect(saida.matchId).toBeTruthy();

    // And the shape the client reads: `date`, `played`, not `advancedDate`/`playedFixtures`.
    expect(saida.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(saida.played)).toBe(true);
  });

  it('moves the clock, which it never did', async () => {
    await localClaimClub('club_BRA_1');
    const antes = loadLocalGameState().gameDate;

    await localAdvanceMatchday();
    const depois = loadLocalGameState().gameDate;

    // Every advance used to report the same invented February date and leave the clock where it was.
    expect(`${depois.year}-${depois.month}-${depois.day}`).not.toBe(`${antes.year}-${antes.month}-${antes.day}`);
  });

  it('plays every country on the same date, not just the manager own league', async () => {
    await localClaimClub('club_BRA_1');
    await localAdvanceMatchday();

    /**
     * A world where only one league plays is not a world. Uruguay and Argentina run their own seasons on
     * the same calendar, so a date that hosts a Brazilian round hosts theirs too.
     */
    const state = loadLocalGameState();
    const outras = state.leagues.filter((l) => !l.clubIds.includes('club_BRA_1'));
    const comJogo = outras.filter((l) => l.fixtures.some((f) => f.result));
    expect(comJogo.length, 'os outros campeonatos também rodam').toBeGreaterThan(0);
  });

  it('builds a standings table that adds up', async () => {
    await localClaimClub('club_BRA_1');
    for (let i = 0; i < 3; i += 1) await localAdvanceMatchday();

    const state = loadLocalGameState();
    const liga = state.leagues.find((l) => l.clubIds.includes('club_BRA_1'))!;
    const { standings } = await localGetLeagueById(liga.id);

    const jogos = liga.fixtures.filter((f) => f.result).length;
    const somaJogos = standings.reduce((total, row) => total + row.played, 0);

    // Two clubs per fixture, so the table's played column has to total twice the games actually played.
    expect(somaJogos).toBe(jogos * 2);
    expect(standings.some((row) => row.points > 0), 'alguém tem de ter pontuado').toBe(true);
  });

  it('reports the next matchday in the shape the button reads', async () => {
    await localClaimClub('club_BRA_1');
    const next = await localGetNextMatchday();

    // `ScheduledRound`: the old version returned `{ date, fixtures }`, which the button cannot use.
    expect(next?.kind).toBe('LEAGUE');
    expect(typeof next?.round).toBe('number');
    expect(next?.competitionName).toBeTruthy();
    expect(next?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gives every offline club the sponsors its ground earns', async () => {
    const club = await localClaimClub('club_BRA_1');

    /**
     * Offline created every club with an empty board, so the finance screen read "Patrocínios ativos:
     * R$ 0/sem" and the club burned its wage bill against gate money alone. Sponsorship is the largest
     * income a club has, and buildSponsorBoard is a pure function with no server behind it.
     */
    expect(club.sponsorships.length).toBeGreaterThan(0);
    expect(club.sponsorships.every((s) => s.weeklyAmount > 0)).toBe(true);
    expect(club.sponsorships.every((s) => s.weeksRemaining > 0)).toBe(true);

    // One deal per type, and ids that do not collide between clubs.
    expect(new Set(club.sponsorships.map((s) => s.type)).size).toBe(club.sponsorships.length);
    const outro = loadLocalGameState().clubs.find((c) => c.id === 'club_ARG_1')!;
    expect(outro.sponsorships[0].id).not.toBe(club.sponsorships[0].id);
  });

  it('plays the whole round when the manager goes to their own match', async () => {
    await localClaimClub('club_BRA_1');
    const proxima = await localGetNextMatch('club_BRA_1');
    expect(proxima).toBeTruthy();

    // Opening the match screen is what a player actually does. The advance button is the other way in.
    await localGetMatch(proxima!.id);

    const state = loadLocalGameState();
    const liga = state.leagues.find((l) => l.clubIds.includes('club_BRA_1'))!;
    const rodada = liga.fixtures.filter((f) => f.round === 1);

    /**
     * The bug this covers, and the reason the earlier tests missed it: they called `localAdvanceMatchday`
     * directly, so they proved the function worked without proving anything called it. Going to the match
     * resolved one fixture and left the other three of the round standing, so the table never moved on the
     * phone however many games the manager played.
     */
    /**
     * Todos menos o do técnico, que é o ponto: a rodada acontece à volta dele e a partida dele fica de pé,
     * esperando ser jogada. Antes ela vinha resolvida daqui e a tela ao vivo nunca abria.
     */
    const meus = rodada.filter((f) => f.homeClubId === 'club_BRA_1' || f.awayClubId === 'club_BRA_1');
    expect(rodada.filter((f) => !f.result)).toEqual(meus);
    expect(meus).toHaveLength(1);
    expect(rodada.length).toBeGreaterThan(1);

    // And the rest of the world played that day too.
    const outras = state.leagues.filter((l) => !l.clubIds.includes('club_BRA_1'));
    expect(outras.some((l) => l.fixtures.some((f) => f.result))).toBe(true);
  });

  it('uses tactical possession in an offline live match', async () => {
    await localClaimClub('club_BRA_1');
    const next = await localGetNextMatch('club_BRA_1');
    const state = loadLocalGameState();
    const club = state.clubs.find((candidate) => candidate.id === 'club_BRA_1')!;
    club.pendingRoundTactic = {
      clubId: club.id,
      formation: '4-4-2',
      mentality: 'balanced',
      attackStyle: 'BALANCED',
      markingStyle: 'BALANCED',
      attackApproach: 'BALANCED',
      pressing: 'LOW_BLOCK',
      defensiveLine: 'DEEP',
      lineup: club.players.slice(0, 11).map((player) => ({ playerId: player.id })),
      substitutes: club.players.slice(11, 18).map((player) => ({ playerId: player.id })),
      plannedSubstitutions: [],
    };
    saveLocalGameState(state);

    await localGetMatch(next!.id);
    const match = await localAdvanceLiveMatch(next!.id, 1);
    const home = state.clubs.find((candidate) => candidate.id === match.homeClubId)!;
    const away = state.clubs.find((candidate) => candidate.id === match.awayClubId)!;
    const homeStrength = computeTeamStrength(home, match.live!.homeTactic);
    const awayStrength = computeTeamStrength(away, match.live!.awayTactic);
    const expected = derivePossession(
      homeStrength,
      awayStrength,
      match.live!.homeTactic,
      match.live!.awayTactic,
    );
    const ownSide = match.homeClubId === club.id ? 'home' : 'away';
    const withoutLowBlock = derivePossession(
      homeStrength,
      awayStrength,
      ownSide === 'home' ? undefined : match.live!.homeTactic,
      ownSide === 'away' ? undefined : match.live!.awayTactic,
    );

    expect(match.live!.homePossession).toBe(expected.home);
    expect(match.live!.awayPossession).toBe(expected.away);
    expect(expected[ownSide]).toBeLessThan(withoutLowBlock[ownSide]);
  });

  it('tags matches with competitionType and competitionId for round summary and standings', async () => {
    await localClaimClub('club_BRA_1');
    const proxima = await localGetNextMatch('club_BRA_1');
    expect(proxima).toBeTruthy();
    expect(proxima?.competitionType).toBe('league');
    expect(proxima?.competitionId).toBeTruthy();

    const matchObj = await localGetMatch(proxima!.id);
    expect(matchObj.competitionType).toBe('league');
    expect(matchObj.competitionId).toBe(proxima?.competitionId);
  });

  it('computes top scorers and assistants in localGetLeagueStats', async () => {
    await localClaimClub('club_BRA_1');
    const state = loadLocalGameState();
    const liga = state.leagues.find((l) => l.clubIds.includes('club_BRA_1'))!;

    // Seed fixture results
    liga.fixtures[0].result = {
      homeGoals: 2,
      awayGoals: 1,
      scorers: [
        { playerId: 'p1', clubId: liga.fixtures[0].homeClubId, name: 'Goleador 1' },
        { playerId: 'p1', clubId: liga.fixtures[0].homeClubId, name: 'Goleador 1' },
        { playerId: 'p2', clubId: liga.fixtures[0].awayClubId, name: 'Goleador 2' },
      ],
      assists: [
        { playerId: 'p3', clubId: liga.fixtures[0].homeClubId, name: 'Garçom 1' },
      ],
    };

    const { localGetLeagueStats } = await import('./localEngine.js');
    const stats = await localGetLeagueStats(liga.id);
    expect(stats.topScorers.length).toBeGreaterThanOrEqual(2);
    expect(stats.topScorers[0].playerId).toBe('p1');
    expect(stats.topScorers[0].goals).toBe(2);
    expect(stats.topAssistants.length).toBeGreaterThanOrEqual(1);
    expect(stats.topAssistants[0].playerId).toBe('p3');
    expect(stats.topAssistants[0].assists).toBe(1);
  });

  it('runs deadline day live auctions offline and settles winning transfers', async () => {
    const { localGetDeadlineDay, localPlaceDeadlineDayBid, localAdvanceDeadlineDay } = await import('./localEngine.js');
    await localClaimClub('club_BRA_1');
    const state = loadLocalGameState();
    const seller = state.clubs.find((c) => c.id !== 'club_BRA_1')!;
    const playerToSell = seller.players[0];

    state.listings = [
      {
        id: 'offline-deadline-listing-1',
        clubId: seller.id,
        clubName: seller.name,
        player: playerToSell,
        askingPrice: 50_000,
        status: 'ACTIVE',
        createdAt: '2026-01-01',
      },
    ];
    saveLocalGameState(state);

    const deadline = localGetDeadlineDay('club_BRA_1');
    expect(deadline.isActive).toBe(true);
    const auction = deadline.auctions.find((a) => a.id === 'offline-deadline-listing-1');
    expect(auction).toBeTruthy();

    const buyer = state.clubs.find((c) => c.id === 'club_BRA_1')!;
    const initialSellerBudget = seller.budget;
    buyer.budget = 200_000_000;
    saveLocalGameState(state);

    const winningAmount = 100_000_000;
    localPlaceDeadlineDayBid({
      auctionId: auction!.id,
      buyerClubId: buyer.id,
      amount: winningAmount,
      wageOffer: 25_000,
    });

    for (let i = 0; i < 5; i += 1) {
      localAdvanceDeadlineDay('club_BRA_1');
    }

    const afterState = loadLocalGameState();
    const updatedSeller = afterState.clubs.find((c) => c.id === seller.id)!;
    const updatedBuyer = afterState.clubs.find((c) => c.id === buyer.id)!;

    expect(updatedSeller.players.some((p) => p.id === playerToSell.id)).toBe(false);
    expect(updatedBuyer.players.some((p) => p.id === playerToSell.id)).toBe(true);
    expect(updatedSeller.budget).toBe(initialSellerBudget + winningAmount);
    expect(updatedBuyer.budget).toBe(200_000_000 - winningAmount);
  });
});

describe('offline locker room', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInMemoryGameState();
  });

  it('heals old saves with a locker-room map and derives the club room', async () => {
    const state = loadLocalGameState();
    delete state.lockerRoomStates;
    saveLocalGameState(state);
    await new Promise((resolve) => setTimeout(resolve, 150));
    resetInMemoryGameState();

    const room = await localGetLockerRoom(state.clubs[0].id);

    expect(room.hierarchy).toHaveLength(state.clubs[0].players.length);
    expect(loadLocalGameState().lockerRoomStates?.[state.clubs[0].id]).toBeDefined();
  });

  it('applies a talk, persists morale and rejects a club managed by somebody else', async () => {
    const state = loadLocalGameState();
    const club = state.clubs[0];
    club.ownerId = 'local_manager_1';
    club.players[0].traits = ['LEADER'];
    const initialMorale = club.players[0].morale;
    saveLocalGameState(state);

    const result = await localApplyTeamTalk(club.id, 'PRE_MATCH:PASSIONATE', 'PRE_MATCH', 0);
    expect(result.moraleModifiers[club.players[0].id]).toBe(8);
    expect(club.players[0].morale).toBe(Math.min(100, initialMorale + 8));

    await new Promise((resolve) => setTimeout(resolve, 150));
    resetInMemoryGameState();
    expect((await localGetLockerRoom(club.id)).hierarchy).toHaveLength(club.players.length);
    expect((await localGetClub(club.id)).players[0].morale).toBe(Math.min(100, initialMorale + 8));

    const other = loadLocalGameState().clubs.find((candidate) => candidate.id !== club.id)!;
    await expect(localApplyTeamTalk(other.id, 'PRE_MATCH:CALM', 'PRE_MATCH', 0))
      .rejects.toThrow('Você não administra este clube');
  });

  it('creates custom championship and preserves rest of the world clubs', async () => {
    const initialState = loadLocalGameState();
    const initialClubCount = initialState.clubs.length;
    const sampleClubs = initialState.clubs.slice(0, 4).map((c) => c.id);

    const config = {
      id: 'custom_test_1',
      name: 'Superliga Teste',
      formatType: 'LEAGUE_WITH_PLAYOFFS' as const,
      divisions: [
        {
          division: 1,
          name: 'Divisão 1',
          clubIds: sampleClubs,
          roundsFormat: 'SINGLE' as const,
          promotionCount: 0,
          relegationCount: 0,
          playoffs: {
            qualifyingSpots: 4 as const,
            tieFormat: 'SINGLE_LEG' as const,
            hasThirdPlaceMatch: true,
            neutralFinal: true,
          },
        },
      ],
      settings: {
        isContinuousCareer: true,
        allowTransfers: true,
        injuriesAndSuspensions: true,
      },
    };

    const result = await localCreateCustomChampionship(config, sampleClubs[0], 'Treinador Teste');
    expect(result.club.id).toBe(sampleClubs[0]);
    expect(result.save.name).toBe('Superliga Teste');

    const updatedState = loadLocalGameState();
    expect(updatedState.clubs.length).toBe(initialClubCount);
    expect(updatedState.leagues.length).toBe(1);
    expect(updatedState.leagues[0].fixtures.length).toBeGreaterThan(0);
  });
});

/**
 * Test suite for offline career history and job offers.
 * These tests cover the functional dependencies 3, 4, 5, and 8 for the offline engine.
 */
describe('offline career history and job offers', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInMemoryGameState();
  });

  it('migrates an owned club into an open tenure', async () => {
    const state = loadLocalGameState();
    const club = state.clubs[0];
    club.ownerId = 'local_manager_1';
    delete state.tenures;
    saveLocalGameState(state);
    await new Promise((resolve) => setTimeout(resolve, 150));
    resetInMemoryGameState();

    const career = await localGetCareer();

    expect(career.activeClubIds).toEqual([club.id]);
    expect(career.tenures[0]).toEqual(expect.objectContaining({ clubId: club.id, endedAt: null }));
  });

  it('opens a tenure when claiming a club', async () => {
    const club = await localClaimClub('club_BRA_1');
    const career = await localGetCareer();

    expect(career.activeClubIds).toEqual([club.id]);
    expect(career.tenures).toEqual([
      expect.objectContaining({
        clubId: club.id,
        clubName: club.name,
        countryCode: club.country,
        startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        endedAt: null,
        endReason: null,
      }),
    ]);
  });

  it('keeps each tenure isolated after resigning and joining another club', async () => {
    const first = await localClaimClub('club_BRA_1');
    await localResignClub(first.id);
    const second = await localClaimClub('club_ARG_1');
    const career = await localGetCareer();

    expect(career.activeClubIds).toEqual([second.id]);
    expect(career.tenures).toHaveLength(2);
    expect(career.tenures[0]).toEqual(expect.objectContaining({
      clubId: first.id,
      endedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      endReason: 'RESIGNED',
    }));
    expect(career.tenures[1]).toEqual(expect.objectContaining({
      clubId: second.id,
      endedAt: null,
      endReason: null,
    }));
  });

  it('generates and reuses job offers while unemployed', async () => {
    const first = await localGetJobOffers();
    const second = await localGetJobOffers();

    expect(first).toHaveLength(3);
    expect(first).toEqual(second);
    expect(first[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      clubId: expect.any(String),
      clubName: expect.any(String),
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }));
  });

  it('accepts one offer and no longer returns the expired alternatives', async () => {
    const offers = await localGetJobOffers();
    const accepted = await localAcceptJobOffer(offers[0].id);

    expect(accepted.id).toBe(offers[0].clubId);
    expect(accepted.ownerId).toBe('local_manager_1');
    expect(await localGetJobOffers()).toEqual([]);
  });

  it('persists removal of stale offers whose clubs are no longer available', async () => {
    const offers = await localGetJobOffers();
    const state = loadLocalGameState();
    state.clubs.find((club) => club.id === offers[0].clubId)!.ownerId = 'other_manager';
    saveLocalGameState(state);

    expect(await localGetJobOffers()).toEqual(offers.slice(1));
    await new Promise((resolve) => setTimeout(resolve, 150));
    resetInMemoryGameState();
    expect(await localGetJobOffers()).toEqual(offers.slice(1));
  });

  it('captures the champion owner when the player completes the last league fixture', async () => {
    const club = await localClaimClub('club_BRA_1');
    const state = loadLocalGameState();
    const league = state.leagues.find((candidate) => candidate.clubIds.includes(club.id))!;
    for (const fixture of league.fixtures) {
      fixture.result = { homeGoals: fixture.homeClubId === club.id ? 5 : 0, awayGoals: fixture.awayClubId === club.id ? 5 : 0 } as never;
    }
    const lastPlayerFixture = [...league.fixtures].reverse().find((fixture) => fixture.homeClubId === club.id || fixture.awayClubId === club.id)!;
    lastPlayerFixture.result = undefined;
    saveLocalGameState(state);

    const match = await localGetMatch(`match_${lastPlayerFixture.homeClubId}_${lastPlayerFixture.awayClubId}_${lastPlayerFixture.round}`);
    let played = await localAdvanceLiveMatch(match.id, 45, false);
    for (let i = 0; i < 5 && played.status !== 'SIMULATED'; i += 1) {
      played = await localAdvanceLiveMatch(match.id, 120, false);
    }
    expect(played.status).toBe('SIMULATED');

    expect(league.status).toBe('FINISHED');
    expect(league.championClubId).toBe(club.id);
    expect(league.championOwnerId).toBe('local_manager_1');
  });

  it('generates a detailed opposition dossier offline', async () => {
    const state = loadLocalGameState();
    const myClub = state.clubs[0];
    const opponent = state.clubs[1];

    const dossier = await localGetOppositionDossier(myClub.id, opponent.id);

    expect(dossier.opponentClubId).toBe(opponent.id);
    expect(dossier.opponentName).toBe(opponent.name);
    expect(dossier.presetIdentification).toBeDefined();
    expect(dossier.presetIdentification.presetName).toBeTruthy();
    expect(dossier.defensiveLineAnalysis).toBeDefined();
    expect(dossier.defensiveLineAnalysis.height).toBeDefined();
    expect(dossier.countermeasures.length).toBeGreaterThan(0);
  });
});

describe('offline release clause payment', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInMemoryGameState();
  });

  it('allows paying release clause in offline mode', async () => {
    const state = loadLocalGameState();
    const seller = state.clubs[1];
    const buyer = state.clubs[0];
    const player = seller.players[0];
    player.releaseClause = 1_000_000;
    buyer.budget = 10_000_000;
    const initialSellerBudget = seller.budget;
    saveLocalGameState(state);

    await localPayReleaseClause(seller.id, player.id, buyer.id);

    const updatedState = loadLocalGameState();
    const updatedBuyer = updatedState.clubs.find((c) => c.id === buyer.id)!;
    const updatedSeller = updatedState.clubs.find((c) => c.id === seller.id)!;

    expect(updatedBuyer.players.some((p) => p.id === player.id)).toBe(true);
    expect(updatedSeller.players.some((p) => p.id === player.id)).toBe(false);
    expect(updatedBuyer.budget).toBe(10_000_000 - 1_000_000);
    expect(updatedSeller.budget).toBe(initialSellerBudget + 1_000_000);
  });
});

describe('offline stadium upgrades and progression', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInMemoryGameState();
  });

  it('starts sub-reform step 1 and completes it after matchday progression', async () => {
    await localClaimClub('club_BRA_1');
    const state = loadLocalGameState();
    const club = state.clubs.find((c) => c.id === 'club_BRA_1')!;
    club.budget = 5_000_000;
    club.stadiumCapacity = 2000;
    club.stadiumTier = 1;
    club.stadiumStep = 0;
    club.stadiumConstruction = null;
    saveLocalGameState(state);

    // 1. Inicia reforma da etapa 1 (Terraplanagem, 1 semana, 500.000, meta: 5.250)
    const upgraded = await localUpgradeStadium('club_BRA_1');
    expect(upgraded.budget).toBe(4_500_000);
    expect(upgraded.stadiumConstruction).toBeTruthy();
    expect(upgraded.stadiumConstruction?.targetStep).toBe(1);
    expect(upgraded.stadiumConstruction?.stepName).toBe('Terraplanagem & Fundações');
    expect(upgraded.stadiumConstruction?.weeksRemaining).toBe(1);
    expect(upgraded.stadiumConstruction?.targetCapacity).toBe(5_250);

    // 2. Joga a partida e conclui o jogo (atravessando 1T e 2T até o apito final)
    const next = await localGetNextMatch('club_BRA_1');
    expect(next).toBeTruthy();
    await localGetMatch(next!.id);
    let finishedMatch = await localAdvanceLiveMatch(next!.id, 45, false);
    for (const alvo of [46, 60, 75, 90, 100]) {
      finishedMatch = await localAdvanceLiveMatch(next!.id, alvo, false);
    }
    expect(finishedMatch.status).toBe('SIMULATED');

    // 3. Verifica que a obra avançou no tick semanal disparado pelo fim da partida
    const afterMatchState = loadLocalGameState();
    const clubAfter = afterMatchState.clubs.find((c) => c.id === 'club_BRA_1')!;
    expect(clubAfter.stadiumConstruction).toBeNull();
    expect(clubAfter.stadiumCapacity).toBe(5_250);
    expect(clubAfter.stadiumStep).toBe(1);
    expect(afterMatchState.news.some((n) => n.headline.includes('Obra Concluída') && n.clubId === 'club_BRA_1')).toBe(true);

    // 4. Próxima etapa (Passo 2) está disponível com target de 8.500
    const preview = await localGetStadiumPreview('club_BRA_1');
    expect(preview.currentStep).toBe(1);
    expect(preview.nextReform?.step).toBe(2);
    expect(preview.nextReform?.name).toBe('Vestiários Profissionais & Concreto');
  });
});

describe('trophy room client calls', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInMemoryGameState();
    setOfflineMode(true);
  });

  it('ensures getClubTrophyRoom and getCareerTrophyRoom return Promises with catch', async () => {
    await localClaimClub('club_BRA_1');

    const clubPromise = getClubTrophyRoom('club_BRA_1');
    expect(typeof clubPromise.then).toBe('function');
    expect(typeof clubPromise.catch).toBe('function');

    const clubData = await clubPromise.catch(() => null);
    expect(clubData).toBeTruthy();
    expect(clubData?.clubId).toBe('club_BRA_1');
    expect(Array.isArray(clubData?.trophies)).toBe(true);

    const careerPromise = getCareerTrophyRoom();
    expect(typeof careerPromise.then).toBe('function');
    expect(typeof careerPromise.catch).toBe('function');

    const careerData = await careerPromise.catch(() => null);
    expect(careerData).toBeTruthy();
    expect(Array.isArray(careerData?.trophies)).toBe(true);
  });
});

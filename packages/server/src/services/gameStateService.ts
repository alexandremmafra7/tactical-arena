import { GameDate, gameDate, seasonPhaseOn, type SeasonPhase } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';

/** The one row that holds the game clock. Each save is its own database file, so one row is enough. */
const SINGLETON_ID = 'singleton';

export interface GameState {
  currentDate: GameDate;
  seasonYear: number;
  phase: SeasonPhase;
  lastWeeklyTickDate: GameDate | null;
}

function toDomain(record: {
  currentDate: string;
  seasonYear: number;
  phase: string;
  lastWeeklyTickDate: string | null;
}): GameState {
  return {
    currentDate: record.currentDate,
    seasonYear: record.seasonYear,
    phase: record.phase as SeasonPhase,
    lastWeeklyTickDate: record.lastWeeklyTickDate,
  };
}

/**
 * Which year a save should consider its current season.
 *
 * Taken from the leagues already in the database rather than from the wall clock, so a save opened in a
 * later real-world year does not suddenly jump its in-game year. Falls back to the real year only for a
 * database with no leagues at all, which is what `joinOrCreateLeague` seeds new leagues from too.
 */
async function inferSeasonYear(): Promise<number> {
  // Ordered by creation, not by season number. Both give the same answer for a real save, but a single
  // stray league carrying an odd season (a seeded fixture, an imported oddity) would otherwise capture
  // the whole game's year just by having the largest number.
  const inProgress = await prisma.league.findFirst({
    where: { status: 'IN_PROGRESS' },
    orderBy: { createdAt: 'desc' },
    select: { season: true },
  });
  if (inProgress) return inProgress.season;
  const any = await prisma.league.findFirst({ orderBy: { createdAt: 'desc' }, select: { season: true } });
  return any?.season ?? new Date().getFullYear();
}

/**
 * The clock, creating it on first use.
 *
 * Lazily bootstrapped rather than seeded at save creation, so a save made before the clock existed picks
 * one up the first time anything asks — no migration step, no separate code path for old saves.
 *
 * A fresh clock starts on 1 January: the year opens in pre-season, which is where the transfer window and
 * the squad's ageing belong, and the season proper starts in April (see `seasonWindow`).
 */
export async function getGameState(): Promise<GameState> {
  const existing = await prisma.gameState.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return toDomain(existing);

  const seasonYear = await inferSeasonYear();
  const currentDate = gameDate(seasonYear, 1, 1);
  const created = await prisma.gameState.create({
    data: {
      id: SINGLETON_ID,
      currentDate,
      seasonYear,
      phase: seasonPhaseOn(currentDate, seasonYear),
      lastWeeklyTickDate: null,
    },
  });
  return toDomain(created);
}

/** Moves the clock. The phase is derived from the date rather than stored independently, so the two can
 *  never disagree. */
export async function setCurrentDate(date: GameDate): Promise<GameState> {
  const state = await getGameState();
  const updated = await prisma.gameState.update({
    where: { id: SINGLETON_ID },
    data: { currentDate: date, phase: seasonPhaseOn(date, state.seasonYear) },
  });
  return toDomain(updated);
}

/** Rolls the clock into a new season year. Used by the 1 January turn. */
export async function setSeasonYear(seasonYear: number, currentDate: GameDate): Promise<GameState> {
  await getGameState();
  const updated = await prisma.gameState.update({
    where: { id: SINGLETON_ID },
    data: { seasonYear, currentDate, phase: seasonPhaseOn(currentDate, seasonYear) },
  });
  return toDomain(updated);
}

/** Records that a week has been processed, so a retried advance cannot charge wages twice. */
export async function setLastWeeklyTickDate(mondayDate: GameDate): Promise<GameState> {
  await getGameState();
  const updated = await prisma.gameState.update({
    where: { id: SINGLETON_ID },
    data: { lastWeeklyTickDate: mondayDate },
  });
  return toDomain(updated);
}

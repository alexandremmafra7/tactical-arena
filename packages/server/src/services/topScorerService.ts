import { prisma } from '../db/prisma.js';

export interface TopScorerResult {
  playerId: string;
  name: string;
  playerName?: string;
  goals: number;
  /** Null if the player could no longer be found on any of the competition's rosters. */
  clubId: string | null;
}

export interface TopAssistantResult {
  playerId: string;
  name: string;
  playerName?: string;
  assists: number;
  /** Null if the player could no longer be found on any of the competition's rosters. */
  clubId: string | null;
}

/**
 * Tallies every 'goal' event across `matchIds` and returns the leading scorer.
 */
export async function computeTopScorer(
  matchIds: string[],
  clubIds: string[],
  fixtureScorers: FixtureScorer[] = [],
): Promise<TopScorerResult | null> {
  const list = await computeTopScorersList(matchIds, clubIds, 1, fixtureScorers);
  return list[0] ?? null;
}

/**
 * Returns the ranked list of top goal scorers across the given matches.
 */
/** Goals from fixtures played for their result only, which keep a compact scorer list instead of a match row. */
export interface FixtureScorer {
  playerId: string;
  clubId: string;
  name: string;
}

export async function computeTopScorersList(
  matchIds: string[],
  clubIds: string[],
  limit: number = 10,
  fixtureScorers: FixtureScorer[] = [],
): Promise<TopScorerResult[]> {
  if (matchIds.length === 0 && fixtureScorers.length === 0) return [];

  const matches = matchIds.length > 0 ? await prisma.match.findMany({ where: { id: { in: matchIds } } }) : [];
  const goalsByPlayer = new Map<string, number>();
  const descriptionByPlayer = new Map<string, string>();

  // A match nobody watched leaves only who scored, which is all a scorers table ever needed.
  for (const scorer of fixtureScorers) {
    goalsByPlayer.set(scorer.playerId, (goalsByPlayer.get(scorer.playerId) ?? 0) + 1);
  }

  for (const match of matches) {
    if (!match.resultJson) continue;
    const result = JSON.parse(match.resultJson);
    for (const event of (result.events ?? []) as { type: string; playerId: string; description: string }[]) {
      if (event.type !== 'goal') continue;
      goalsByPlayer.set(event.playerId, (goalsByPlayer.get(event.playerId) ?? 0) + 1);
      if (!descriptionByPlayer.has(event.playerId)) descriptionByPlayer.set(event.playerId, event.description);
    }
  }
  if (goalsByPlayer.size === 0) return [];

  const sorted = [...goalsByPlayer.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const clubs = clubIds.length > 0 ? await prisma.club.findMany({ where: { id: { in: clubIds } } }) : [];

  const playerClubMap = new Map<string, { name: string; clubId: string }>();
  for (const club of clubs) {
    const players: { id: string; name: string }[] = JSON.parse(club.playersJson);
    for (const p of players) {
      playerClubMap.set(p.id, { name: p.name, clubId: club.id });
    }
  }

  const fromFixture = new Map(fixtureScorers.map((s) => [s.playerId, { name: s.name, clubId: s.clubId }]));
  return sorted.map(([playerId, goals]) => {
    const found = playerClubMap.get(playerId) ?? fromFixture.get(playerId);
    let name = found?.name ?? null;
    if (!name) {
      const description = descriptionByPlayer.get(playerId) ?? '';
      name = description.match(/Gol de (.+?)!/)?.[1] ?? 'Jogador';
    }
    return {
      playerId,
      name,
      playerName: name,
      goals,
      clubId: found?.clubId ?? null,
    };
  });
}

/**
 * Tallies every assist across `matchIds` and returns the leading assistant.
 */
export async function computeTopAssistant(
  matchIds: string[],
  clubIds: string[],
  fixtureAssistants: FixtureAssistant[] = [],
): Promise<TopAssistantResult | null> {
  const list = await computeTopAssistantsList(matchIds, clubIds, 1, fixtureAssistants);
  return list[0] ?? null;
}

/** Assist providers from fixtures played for their result only, mirroring `FixtureScorer`. */
export interface FixtureAssistant {
  playerId: string;
  clubId: string;
  name: string;
}

/**
 * Returns the ranked list of top assist providers across the given matches.
 */
export async function computeTopAssistantsList(
  matchIds: string[],
  clubIds: string[],
  limit: number = 10,
  fixtureAssistants: FixtureAssistant[] = [],
): Promise<TopAssistantResult[]> {
  if (matchIds.length === 0 && fixtureAssistants.length === 0) return [];

  const matches = matchIds.length > 0 ? await prisma.match.findMany({ where: { id: { in: matchIds } } }) : [];
  const assistsByPlayer = new Map<string, number>();
  const nameByPlayer = new Map<string, string>();

  // A match nobody watched leaves only who provided the assist, which is all an assists table ever needed.
  for (const assistant of fixtureAssistants) {
    assistsByPlayer.set(assistant.playerId, (assistsByPlayer.get(assistant.playerId) ?? 0) + 1);
  }

  for (const match of matches) {
    if (!match.resultJson) continue;
    const result = JSON.parse(match.resultJson);
    for (const event of (result.events ?? []) as { type: string; assistPlayerId?: string; assistPlayerName?: string }[]) {
      if (event.type !== 'goal' || !event.assistPlayerId) continue;
      assistsByPlayer.set(event.assistPlayerId, (assistsByPlayer.get(event.assistPlayerId) ?? 0) + 1);
      if (event.assistPlayerName && !nameByPlayer.has(event.assistPlayerId)) {
        nameByPlayer.set(event.assistPlayerId, event.assistPlayerName);
      }
    }
  }
  if (assistsByPlayer.size === 0) return [];

  const sorted = [...assistsByPlayer.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const clubs = clubIds.length > 0 ? await prisma.club.findMany({ where: { id: { in: clubIds } } }) : [];

  const playerClubMap = new Map<string, { name: string; clubId: string }>();
  for (const club of clubs) {
    const players: { id: string; name: string }[] = JSON.parse(club.playersJson);
    for (const p of players) {
      playerClubMap.set(p.id, { name: p.name, clubId: club.id });
    }
  }

  const fromFixture = new Map(fixtureAssistants.map((a) => [a.playerId, { name: a.name, clubId: a.clubId }]));
  return sorted.map(([playerId, assists]) => {
    const found = playerClubMap.get(playerId) ?? fromFixture.get(playerId);
    const name = found?.name ?? nameByPlayer.get(playerId) ?? 'Jogador';
    return {
      playerId,
      name,
      playerName: name,
      assists,
      clubId: found?.clubId ?? null,
    };
  });
}

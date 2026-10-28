import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BOT_OWNER_ID, computeStandings, type GameMode, type LeagueFixture, type SeasonPhase } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { createManagerToken } from './authService.js';
import { getGameState } from './gameStateService.js';

export type ClockFormat = 'HALF_45' | 'FULL_90';

export interface ManagerProfile {
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string;
  style: string;
  avatar: string;
  clockFormat?: ClockFormat;
  /** O modo de carreira, para a tela saber o que esconder sem ter de perguntar noutro lugar. */
  gameMode?: GameMode;
  birthYear?: number;
}

export interface SaveSlot {
  id: string;
  name: string;
  fileName: string;
  managerFirstName?: string;
  managerLastName?: string;
  managerName?: string;
  managerNationality?: string;
  managerStyle?: string;
  managerAvatar?: string;
  clockFormat?: ClockFormat;
  /** O modo de carreira, escolhido na criação e imutável depois. Ver gameMode.ts. */
  gameMode?: GameMode;
  managerUserId?: string;
  managerToken?: string;
  clubName?: string;
  clubCountry?: string;
  clubSlug?: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  division?: number;
  season?: number;
  round?: number;
  budget?: number;
  titlesWon?: number;
  currentDate?: string;
  leaguePosition?: number;
  nextOpponentName?: string;
  nextOpponentSlug?: string | null;
  nextMatchDate?: string;
  seasonPhase?: SeasonPhase;
  transferWindowOpen?: boolean;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
}

export interface CreateSaveInput {
  name?: string;
  managerFirstName?: string;
  managerLastName?: string;
  managerNationality?: string;
  managerStyle?: string;
  managerAvatar?: string;
  clockFormat?: ClockFormat;
  gameMode?: GameMode;
}

interface SavesIndex {
  currentSaveId: string;
  saves: SaveSlot[];
}

function getDatabasePath(): string {
  const dbUrl = process.env['DATABASE_URL'] ?? 'file:./dev.db';
  const clean = dbUrl.replace(/^file:/, '');
  return path.resolve(clean);
}

function getTemplatePath(): string | null {
  const mainDbPath = getDatabasePath();
  const candidates = [
    path.join(path.dirname(mainDbPath), 'template.db'),
    path.join(process.cwd(), 'packages', 'server', 'prisma', 'template.db'),
    path.join(process.cwd(), 'packages', 'desktop', 'resources', 'template.db'),
    path.join(process.cwd(), 'resources', 'template.db'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function getSavesDirectory(): string {
  const dbPath = getDatabasePath();
  const dir = path.join(path.dirname(dbPath), 'saves');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getIndexPath(): string {
  return path.join(getSavesDirectory(), 'saves_index.json');
}

interface LiveSaveContext {
  clubName?: string;
  clubCountry?: string;
  clubSlug?: string | null;
  crestBase64?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  division?: number;
  season?: number;
  round?: number;
  budget?: number;
  titlesWon?: number;
  currentDate?: string;
  leaguePosition?: number;
  nextOpponentName?: string;
  nextOpponentSlug?: string | null;
  nextMatchDate?: string;
  seasonPhase?: SeasonPhase;
  transferWindowOpen?: boolean;
}

export async function getLiveClubInfo(userId?: string): Promise<LiveSaveContext> {
  try {
    const club = userId
      ? await prisma.club.findFirst({ where: { ownerId: userId } })
      : await prisma.club.findFirst({ where: { ownerId: { not: BOT_OWNER_ID } } });
    if (!club) return {};

    const gameState = await getGameState();
    const leagueRecords = await prisma.league.findMany({
      orderBy: [{ season: 'desc' }, { createdAt: 'desc' }],
    });
    const statusRank = (status: string) => status === 'IN_PROGRESS' ? 0 : status === 'OPEN' ? 1 : 2;
    const league = leagueRecords
      .map((record) => ({
        ...record,
        clubIds: JSON.parse(record.clubIdsJson) as string[],
        fixtures: JSON.parse(record.fixturesJson) as LeagueFixture[],
      }))
      .filter((candidate) => candidate.clubIds.includes(club.id))
      .sort((a, b) => statusRank(a.status) - statusRank(b.status))[0];

    const base = {
      clubName: club.name,
      clubCountry: club.country,
      clubSlug: club.slug,
      crestBase64: club.crestBase64 ?? null,
      primaryColor: club.primaryColor ?? null,
      secondaryColor: club.secondaryColor ?? null,
      budget: club.budget,
      titlesWon: club.titlesWon,
      currentDate: gameState.currentDate,
      season: gameState.seasonYear,
      seasonPhase: gameState.phase,
      transferWindowOpen: gameState.phase === 'PRE_SEASON',
    };
    if (!league) return base;

    const clubFixtures = league.fixtures.filter(
      (fixture) => fixture.homeClubId === club.id || fixture.awayClubId === club.id,
    );
    const pendingFixtures = clubFixtures.filter((fixture) => !fixture.matchId && !fixture.result);
    const nextFixture = pendingFixtures
      .filter((fixture) => fixture.date && fixture.date >= gameState.currentDate)
      .sort((a, b) => a.date!.localeCompare(b.date!) || a.round - b.round)[0]
      ?? pendingFixtures.filter((fixture) => !fixture.date).sort((a, b) => a.round - b.round)[0];
    const opponentId = nextFixture
      ? nextFixture.homeClubId === club.id ? nextFixture.awayClubId : nextFixture.homeClubId
      : undefined;
    const opponent = opponentId
      ? await prisma.club.findUnique({ where: { id: opponentId }, select: { name: true, slug: true } })
      : null;

    const matchIds = league.fixtures.map((fixture) => fixture.matchId).filter((id): id is string => !!id);
    const matches = matchIds.length > 0
      ? await prisma.match.findMany({ where: { id: { in: matchIds } }, select: { homeClubId: true, awayClubId: true, resultJson: true } })
      : [];
    const results = matches.flatMap((match) => {
      if (!match.resultJson) return [];
      const result = JSON.parse(match.resultJson) as { homeGoals: number; awayGoals: number };
      return [{ homeClubId: match.homeClubId, awayClubId: match.awayClubId, ...result }];
    });
    for (const fixture of league.fixtures) {
      if (fixture.matchId || !fixture.result) continue;
      results.push({
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        homeGoals: fixture.result.homeGoals,
        awayGoals: fixture.result.awayGoals,
      });
    }
    const leaguePosition = computeStandings(league.clubIds, results).findIndex((row) => row.clubId === club.id) + 1;
    const playedRounds = clubFixtures.filter((fixture) => !!fixture.matchId || !!fixture.result).map((fixture) => fixture.round);

    return {
      ...base,
      division: league.division,
      season: league.season,
      round: playedRounds.length > 0 ? Math.max(...playedRounds) : 0,
      leaguePosition: leaguePosition > 0 ? leaguePosition : undefined,
      nextOpponentName: opponent?.name,
      nextOpponentSlug: opponent?.slug,
      nextMatchDate: nextFixture?.date ?? undefined,
    };
  } catch {
    return {};
  }
}

export function readSavesIndex(): SavesIndex {
  const indexPath = getIndexPath();
  if (fs.existsSync(indexPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
      if (Array.isArray(data.saves)) return data;
    } catch {
      // fallback
    }
  }
  const initial: SavesIndex = { currentSaveId: '', saves: [] };
  try {
    fs.writeFileSync(indexPath, JSON.stringify(initial, null, 2));
  } catch {
    // best-effort
  }
  return initial;
}

export function writeSavesIndex(data: SavesIndex): void {
  const indexPath = getIndexPath();
  fs.writeFileSync(indexPath, JSON.stringify({ ...data, saves: data.saves.map(({ managerToken: _secret, ...save }) => save) }, null, 2));
}

export async function listAllSaves(): Promise<{ currentSaveId: string; currentManager: ManagerProfile | null; saves: SaveSlot[] }> {
  const index = readSavesIndex();
  if (index.saves.length === 0) return { currentSaveId: '', currentManager: null, saves: [] };
  const currentSave = index.saves.find((s) => s.id === index.currentSaveId) ?? index.saves[0];
  const liveInfo = await getLiveClubInfo(currentSave?.managerUserId);
  const updatedSaves = index.saves.map((save) => save.id === index.currentSaveId ? {
    ...save,
    isCurrent: true,
    clubName: liveInfo.clubName ?? save.clubName ?? 'Sem clube',
    clubCountry: liveInfo.clubCountry ?? save.clubCountry ?? save.managerNationality ?? 'BRA',
    division: liveInfo.division ?? save.division ?? 1,
    season: liveInfo.season ?? save.season ?? 1,
    round: liveInfo.round ?? save.round ?? 0,
    budget: liveInfo.budget ?? save.budget ?? 5000000,
    titlesWon: liveInfo.titlesWon ?? save.titlesWon ?? 0,
    clubSlug: liveInfo.clubSlug ?? save.clubSlug,
    crestBase64: liveInfo.crestBase64 ?? save.crestBase64,
    primaryColor: liveInfo.primaryColor ?? save.primaryColor,
    secondaryColor: liveInfo.secondaryColor ?? save.secondaryColor,
    currentDate: liveInfo.currentDate ?? save.currentDate,
    leaguePosition: liveInfo.leaguePosition ?? save.leaguePosition,
    nextOpponentName: liveInfo.nextOpponentName ?? save.nextOpponentName,
    nextOpponentSlug: liveInfo.nextOpponentSlug ?? save.nextOpponentSlug,
    nextMatchDate: liveInfo.nextMatchDate ?? save.nextMatchDate,
    seasonPhase: liveInfo.seasonPhase ?? save.seasonPhase,
    transferWindowOpen: liveInfo.transferWindowOpen ?? save.transferWindowOpen,
    updatedAt: new Date().toISOString(),
  } : { ...save, isCurrent: false });
  writeSavesIndex({ currentSaveId: index.currentSaveId, saves: updatedSaves });
  const currentManager: ManagerProfile | null = currentSave ? {
    firstName: currentSave.managerFirstName ?? 'Professor',
    lastName: currentSave.managerLastName ?? 'Técnico',
    fullName: currentSave.managerName ?? 'Professor Técnico',
    nationality: currentSave.managerNationality ?? 'BRA',
    style: currentSave.managerStyle ?? 'Estrategista',
    avatar: currentSave.managerAvatar ?? '👔',
    clockFormat: currentSave.clockFormat ?? 'HALF_45',
    gameMode: currentSave.gameMode ?? 'STANDARD',
  } : null;
  return { currentSaveId: index.currentSaveId, currentManager, saves: updatedSaves };
}

export async function createNewSave(input: CreateSaveInput | string): Promise<{ save: SaveSlot; token: string; userId: string }> {
  const params: CreateSaveInput = typeof input === 'string' ? { name: input } : input;
  const index = readSavesIndex();
  const id = `save-${Date.now()}`;
  const fileName = `${id}.db`;
  const savesDir = getSavesDirectory();
  const newDbPath = path.join(savesDir, fileName);
  const mainDbPath = getDatabasePath();
  if (index.currentSaveId) {
    const currentSave = index.saves.find((s) => s.id === index.currentSaveId);
    if (currentSave && fs.existsSync(mainDbPath)) {
      try { fs.copyFileSync(mainDbPath, path.join(savesDir, currentSave.fileName)); } catch { /* best-effort backup */ }
    }
  }
  const templatePath = getTemplatePath();
  if (templatePath && fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, newDbPath);
    fs.copyFileSync(templatePath, mainDbPath);
  } else if (fs.existsSync(mainDbPath)) {
    fs.copyFileSync(mainDbPath, newDbPath);
  }
  const managerFirstName = params.managerFirstName?.trim() || 'Novo';
  const managerLastName = params.managerLastName?.trim() || 'Técnico';
  const managerName = `${managerFirstName} ${managerLastName}`.trim();
  const managerNationality = params.managerNationality || 'BRA';
  const managerStyle = params.managerStyle || 'Estrategista';
  const managerAvatar = params.managerAvatar || '👔';
  const managerUserId = randomUUID();
  const managerToken = createManagerToken(managerUserId);
  try {
    await prisma.club.updateMany({ data: { ownerId: BOT_OWNER_ID } });
    await prisma.managerTenure.deleteMany({});
  } catch {
    // Best-effort legacy behavior.
  }
  await prisma.user.create({ data: { id: managerUserId, email: `${managerUserId}@manager.game`, passwordHash: 'manager_isolated' } });
  const clockFormat = params.clockFormat || 'HALF_45';
  const gameMode: GameMode = params.gameMode ?? 'STANDARD';
  const saveName = params.name?.trim() || managerName;
  const newSlot: SaveSlot = {
    id, name: saveName, fileName, managerFirstName, managerLastName, managerName,
    managerNationality, managerStyle, managerAvatar, clockFormat, gameMode,
    managerUserId, managerToken, clubName: 'Sem Clube', clubCountry: managerNationality,
    division: 1, season: 1, round: 1, budget: 5000000, titlesWon: 0,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isCurrent: true,
  };
  const nextSaves = [newSlot, ...index.saves.map((s) => ({ ...s, isCurrent: false }))];
  writeSavesIndex({ currentSaveId: id, saves: nextSaves });
  return { save: newSlot, token: managerToken, userId: managerUserId };
}

export function syncCurrentSaveToDisk(): void {
  const index = readSavesIndex();
  if (!index.currentSaveId) return;
  const currentSave = index.saves.find((s) => s.id === index.currentSaveId);
  if (!currentSave) return;
  const mainDbPath = getDatabasePath();
  const targetSavePath = path.join(getSavesDirectory(), currentSave.fileName);
  if (fs.existsSync(mainDbPath)) {
    try { fs.copyFileSync(mainDbPath, targetSavePath); } catch { /* best-effort sync */ }
  }
}

export async function loadSave(id: string): Promise<{ save: SaveSlot; token: string; userId: string; claimedClubId?: string }> {
  const index = readSavesIndex();
  const target = index.saves.find((s) => s.id === id);
  if (!target) throw new Error('Save não encontrado.');
  const savesDir = getSavesDirectory();
  const mainDbPath = getDatabasePath();
  const targetSavePath = path.join(savesDir, target.fileName);
  if (index.currentSaveId === id && fs.existsSync(mainDbPath)) {
    try { fs.copyFileSync(mainDbPath, targetSavePath); } catch { /* best-effort sync */ }
  } else {
    if (index.currentSaveId) {
      const currentSave = index.saves.find((s) => s.id === index.currentSaveId);
      if (currentSave && fs.existsSync(mainDbPath)) {
        try { fs.copyFileSync(mainDbPath, path.join(savesDir, currentSave.fileName)); } catch { /* best-effort backup */ }
      }
    }
    if (fs.existsSync(targetSavePath)) {
      try { fs.copyFileSync(targetSavePath, mainDbPath); } catch { /* best-effort copy */ }
    }
  }
  let userId = target.managerUserId;
  let token = target.managerToken;
  if (!userId) {
    userId = randomUUID();
    target.managerUserId = userId;
  }
  token = createManagerToken(userId);
  target.managerToken = token;
  let claimedClubId: string | undefined;
  try {
    let userClub = await prisma.club.findFirst({ where: { ownerId: userId } });
    if (!userClub) {
      const anyClaimedClub = await prisma.club.findFirst({ where: { ownerId: { not: BOT_OWNER_ID } } });
      if (anyClaimedClub) {
        await prisma.club.update({ where: { id: anyClaimedClub.id }, data: { ownerId: userId } });
        userClub = anyClaimedClub;
      }
    }
    if (userClub) {
      claimedClubId = userClub.id;
      target.clubName = userClub.name;
      target.clubCountry = userClub.country;
      target.budget = userClub.budget;
      target.titlesWon = userClub.titlesWon;
    }
  } catch {
    // best-effort
  }
  const nextSaves = index.saves.map((s) => ({ ...s, isCurrent: s.id === id, updatedAt: s.id === id ? new Date().toISOString() : s.updatedAt }));
  writeSavesIndex({ currentSaveId: id, saves: nextSaves });
  return { save: { ...target, isCurrent: true }, token, userId, claimedClubId };
}

export function renameSave(id: string, newName: string): SaveSlot {
  const index = readSavesIndex();
  const target = index.saves.find((s) => s.id === id);
  if (!target) throw new Error('Save não encontrado.');
  target.name = newName.trim() || target.name;
  target.updatedAt = new Date().toISOString();
  writeSavesIndex(index);
  return target;
}

export function deleteSave(id: string): void {
  const index = readSavesIndex();
  const target = index.saves.find((s) => s.id === id);
  if (!target) return;
  const filePath = path.join(getSavesDirectory(), target.fileName);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch { /* best-effort */ }
  }
  const nextSaves = index.saves.filter((s) => s.id !== id);
  const nextCurrent = index.currentSaveId === id ? (nextSaves[0]?.id ?? '') : index.currentSaveId;
  writeSavesIndex({ currentSaveId: nextCurrent, saves: nextSaves });
}

export function duplicateSave(id: string, customName?: string): SaveSlot {
  const index = readSavesIndex();
  const source = index.saves.find((s) => s.id === id);
  if (!source) throw new Error('Save de origem não encontrado.');
  const newId = `save-${Date.now()}`;
  const newFileName = `${newId}.db`;
  const savesDir = getSavesDirectory();
  const sourcePath = path.join(savesDir, source.fileName);
  const targetPath = path.join(savesDir, newFileName);
  if (fs.existsSync(sourcePath)) fs.copyFileSync(sourcePath, targetPath);
  const newSlot: SaveSlot = {
    ...source, id: newId, name: customName?.trim() || `${source.name} (Cópia)`, fileName: newFileName,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isCurrent: false,
  };
  const nextSaves = [newSlot, ...index.saves];
  writeSavesIndex({ currentSaveId: index.currentSaveId, saves: nextSaves });
  return newSlot;
}

export function getCurrentManagerProfile(): ManagerProfile | null {
  const index = readSavesIndex();
  const current = index.saves.find((s) => s.id === index.currentSaveId) ?? index.saves[0];
  if (!current) return null;
  return {
    firstName: current.managerFirstName ?? 'Professor', lastName: current.managerLastName ?? 'Técnico',
    fullName: current.managerName ?? 'Professor Técnico', nationality: current.managerNationality ?? 'BRA',
    style: current.managerStyle ?? 'Estrategista', avatar: current.managerAvatar ?? '👔', clockFormat: current.clockFormat ?? 'HALF_45',
  };
}

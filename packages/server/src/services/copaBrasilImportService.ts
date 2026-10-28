import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  BOT_OWNER_ID,
  generateSquad,
  generateFirstRoundFixtures,
  type CupFixture,
  type Cup,
  STARTING_BUDGET,
  STARTING_STADIUM_CAPACITY,
  STARTING_STADIUM_LEVEL,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { stampContracts } from './newSquadContracts.js';

interface RawApiSportsClub {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string;
    founded: number | null;
    logo: string;
  };
  venue: {
    id: number;
    name: string;
    city: string;
    capacity: number | null;
    surface: string;
  };
}

export const SEEDED_12_GIANTS_SLUGS = [
  'palmeiras',
  'flamengo',
  'atletico-mg',
  'gremio',
  'botafogo',
  'rb-bragantino',
  'atletico-paranaense',
  'fluminense',
  'sao-paulo',
  'internacional',
  'bahia',
  'fortaleza',
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function estimateSkillLevel(slug: string, rawName: string): number {
  if (['flamengo', 'palmeiras'].includes(slug)) return 78;
  if (['botafogo', 'cruzeiro', 'atletico-mg', 'fluminense', 'sao-paulo'].includes(slug)) return 74;
  if (['gremio', 'internacional', 'corinthians', 'bahia', 'fortaleza', 'rb-bragantino'].includes(slug)) return 70;
  if (['vasco-da-gama', 'atletico-paranaense', 'vitoria', 'juventude', 'criciuma'].includes(slug)) return 66;
  if (['sport-recife', 'ceara', 'goias', 'coritiba', 'america-mineiro', 'crb', 'vila-nova', 'operario-pr', 'paysandu', 'avai', 'santos'].some((s) => slug.includes(s) || slugify(rawName).includes(s))) return 63;
  if (['remo', 'volta-redonda', 'athletic-club', 'ypiranga-rs', 'sao-bernardo', 'ferroviario', 'caxias', 'brusque', 'confianca', 'botafogo-sp', 'amazonas', 'aparecidense', 'tombense', 'abc', 'sampaio-correa'].some((s) => slug.includes(s) || slugify(rawName).includes(s))) return 58;
  return 52;
}

function estimateDivision(skillLevel: number): number {
  if (skillLevel >= 66) return 1;
  if (skillLevel >= 60) return 2;
  if (skillLevel >= 55) return 3;
  return 4;
}

/**
 * Imports all 92 clubs from D:\Code\Documentação\Elencos\copaBrasil_2024.json into the database.
 */
export async function importCopaBrasilClubs(): Promise<{ totalImported: number; created: number; updated: number }> {
  const jsonPath = 'D:\\Code\\Documentação\\Elencos\\copaBrasil_2024.json';
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Arquivo não encontrado: ${jsonPath}`);
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const entries: RawApiSportsClub[] = rawData.response ?? [];

  let created = 0;
  let updated = 0;

  for (const entry of entries) {
    const rawName = entry.team.name;
    const slug = slugify(rawName);
    const capacity = entry.venue.capacity ?? 15000;
    const skillLevel = estimateSkillLevel(slug, rawName);
    const division = estimateDivision(skillLevel);

    const existing = await prisma.club.findFirst({
      where: { OR: [{ slug }, { name: rawName }] },
    });

    if (existing) {
      await prisma.club.update({
        where: { id: existing.id },
        data: {
          slug,
          stadiumCapacity: capacity,
        },
      });
      updated++;
    } else {
      const clubId = randomUUID();
      const squad = await stampContracts(generateSquad(skillLevel, `copa-${slug}`), clubId);

      await prisma.club.create({
        data: {
          id: clubId,
          name: rawName,
          slug,
          country: 'BRA',
          budget: STARTING_BUDGET,
          ownerId: BOT_OWNER_ID,
          stadiumCapacity: capacity,
          stadiumLevel: capacity > 40000 ? 3 : capacity > 20000 ? 2 : STARTING_STADIUM_LEVEL,
          titlesWon: 0,
          captainWeeksServed: 0,
          playersJson: JSON.stringify(squad),
          academyPlayersJson: '[]',
        },
      });
      created++;
    }
  }

  return { totalImported: entries.length, created, updated };
}

/**
 * Creates the official Copa do Brasil 2024 tournament (92 clubs with 7 stages).
 */
export async function createOfficialCopaDoBrasil(season: number = new Date().getFullYear()): Promise<Cup> {
  // Ensure all 92 clubs are imported
  await importCopaBrasilClubs();

  // Find the 12 seeded giants
  const seededClubs = await prisma.club.findMany({
    where: {
      slug: { in: SEEDED_12_GIANTS_SLUGS },
      country: 'BRA',
    },
  });
  const seededClubIds = seededClubs.map((c) => c.id);

  // Find all remaining Brazilian clubs for Stage 1 (80 clubs)
  const nonSeededClubs = await prisma.club.findMany({
    where: {
      country: 'BRA',
      id: { notIn: seededClubIds },
    },
    take: 80,
  });

  const stage1ClubIds = nonSeededClubs.map((c) => c.id);

  // Shuffle stage 1 clubs
  const shuffledStage1 = [...stage1ClubIds].sort(() => Math.random() - 0.5);

  // Generate Stage 1 Fixtures (40 single-leg knockout ties)
  const fixtures: CupFixture[] = generateFirstRoundFixtures(shuffledStage1, '1ª Fase (Preliminar)');

  const cupId = randomUUID();
  const cupRecord = await prisma.cup.create({
    data: {
      id: cupId,
      name: 'Copa do Brasil',
      countryCode: 'BRA',
      clubIdsJson: JSON.stringify([...shuffledStage1, ...seededClubIds]),
      fixturesJson: JSON.stringify(fixtures),
      status: 'IN_PROGRESS',
      season,
    },
  });

  return {
    id: cupRecord.id,
    name: cupRecord.name,
    countryCode: cupRecord.countryCode,
    clubIds: JSON.parse(cupRecord.clubIdsJson),
    fixtures,
    status: 'IN_PROGRESS',
    championClubId: null,
    championOwnerId: null,
    season: cupRecord.season,
    topScorerPlayerId: null,
    topScorerName: null,
    topScorerGoals: null,
    topScorerClubId: null,
    seededClubIds,
    currentStageName: '1ª Fase (Preliminar)',
  };
}

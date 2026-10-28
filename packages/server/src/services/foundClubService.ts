import { randomUUID } from 'node:crypto';
import {
  BOT_OWNER_ID,
  Club,
  KitPattern,
  LeagueFixture,
  STARTING_BUDGET,
  STARTING_STADIUM_CAPACITY,
  STARTING_STADIUM_LEVEL,
  generateAcademy,
  generateStarterSquad,
  isValidCountryCode,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub } from './clubService.js';
import { getGameState } from './gameStateService.js';
import { promotionSlots } from './promotionService.js';
import { sponsorBoardFor } from './sponsorBoardService.js';
import { openTenure } from './careerService.js';
import { syncCurrentSaveToDisk } from './saveService.js';
import { stampContracts } from './newSquadContracts.js';

export class FoundClubError extends Error {}

/** A file-safe name for the club's crest. Accents folded, everything else collapsed to single hyphens. */
function slugify(name: string): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'clube';
}

/**
 * How much weaker than its division a club founded from nothing starts.
 *
 * It has no history, no money and nobody who wanted to sign for it, so it should be the worst side in the
 * league it enters. Not hopeless: eight points of overall below the tier's average is roughly the gap
 * between a promoted club and a settled one, which is a season of hard work rather than a lost cause.
 */
const FOUNDED_SQUAD_HANDICAP = 8;

/**
 * How big a place the club is from, and what that costs.
 *
 * One choice with two consequences pointing opposite ways, which is the whole design: a big city hands you a
 * ground that earns three times as much every week, and takes most of your opening budget to secure. A small
 * town leaves the money in your hands and almost nothing coming through the turnstiles. Cash now against
 * income later, decided once, at the only moment the manager knows nothing else about their club.
 *
 * Nothing new had to be built for it. Capacity already drives gate money, attendance, maintenance and the
 * size of the sponsor board a club can attract (see `calculateStadiumRevenue` and `buildSponsorBoard`), so
 * the city is simply wired into figures that were already load-bearing.
 */
export const CITY_SIZES = {
  SMALL: { label: 'Cidade pequena', capacity: 2_000, budgetShare: 1 },
  MEDIUM: { label: 'Cidade média', capacity: 8_000, budgetShare: 0.7 },
  LARGE: { label: 'Cidade grande', capacity: 15_000, budgetShare: 0.45 },
} as const;

export type CitySize = keyof typeof CITY_SIZES;

export interface FoundClubInput {
  name: string;
  country: string;
  /** Where the club is from. Flavour on the club page, and it goes into the crest prompt. */
  city?: string;
  citySize?: CitySize;
  kitPattern?: KitPattern;
  primaryColor?: string;
  secondaryColor?: string;
  crestBase64?: string;
}

export interface FoundableCountry {
  code: string;
  /** The tier a founded club enters, which is the lowest one this country runs. */
  accessDivision: number;
  /** Clubs already in it. */
  size: number;
}

/**
 * The countries where founding a club means anything.
 *
 * A club founded in a country with a single division has nowhere to climb to: it would spend every season
 * of the save in the only tier there is, which is the same game as taking over an existing club with a
 * worse squad. Measured on the shipped world, 26 of 98 countries run a second division — so this filter is
 * not a formality, it excludes most of the map.
 */
export async function listFoundableCountries(): Promise<FoundableCountry[]> {
  const season = (await getGameState()).seasonYear;
  const leagues = await prisma.league.findMany({
    where: { season },
    select: { countryCode: true, division: true, clubIdsJson: true },
  });

  const tiersByCountry = new Map<string, Map<number, number>>();
  for (const league of leagues) {
    const tiers = tiersByCountry.get(league.countryCode) ?? new Map<number, number>();
    tiers.set(league.division, (JSON.parse(league.clubIdsJson) as string[]).length);
    tiersByCountry.set(league.countryCode, tiers);
  }

  const foundable: FoundableCountry[] = [];
  for (const [code, tiers] of tiersByCountry) {
    if (tiers.size < 2) continue;

    const accessDivision = Math.max(...tiers.keys());
    const size = tiers.get(accessDivision) ?? 0;
    const above = tiers.get(accessDivision - 1);

    /**
     * "Somewhere to climb to" is not the same as "has two divisions". It means access and relegation
     * actually run between this tier and the one above it, which is the very rule the season turn applies
     * (see `promotionSlots`): a tier too small to trade clubs promotes nobody, ever, so a club founded in it
     * would be as stuck as one founded in a country with a single division.
     *
     * It also keeps the debris out. A save that has been played through the team editor accumulates odd
     * tiers — a division 70 holding one club — and every one of them is the deepest tier in its country.
     */
    if (above === undefined || promotionSlots(above, size) === 0) continue;

    foundable.push({ code, accessDivision, size });
  }

  return foundable.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Founds a club and puts it in its country's access division, in somebody else's place.
 *
 * Entering has to cost a seat, and that is not a shortcut: the division has a fixed size, an already drawn
 * fixture list, and an even number of clubs that a round robin depends on. Adding a twenty-first club would
 * invalidate every one of those at once. A club joining a league somebody else leaves is also what actually
 * happens when a side is admitted to a competition.
 *
 * The seat taken is the weakest squad in the tier, read from the ratings kept beside each club (see
 * `computeSquadRating`) rather than by opening twenty rosters. The displaced club is not deleted: it carries
 * on with no domestic league, which is a state the world already has plenty of — every club below the last
 * division is in it.
 *
 * Only before a ball is kicked. Substituting a club into fixtures that have already been played would
 * rewrite results that happened, so a season under way refuses rather than corrupting its own history.
 */
export async function foundClub(ownerId: string, input: FoundClubInput): Promise<Club> {
  const { name, country, city } = input;
  const size = CITY_SIZES[input.citySize ?? 'SMALL'] ?? CITY_SIZES.SMALL;
  if (!isValidCountryCode(country)) throw new FoundClubError(`País inválido: ${country}`);

  /**
   * This season's ladder, not every league the country has ever run. A save that has been played for a few
   * years carries one league per division per season, so leaving the season out picks an arbitrary year's
   * competition and puts the club into a championship that finished long ago.
   */
  const season = (await getGameState()).seasonYear;
  const tiers = await prisma.league.findMany({ where: { countryCode: country, season }, orderBy: { division: 'desc' } });
  if (tiers.length === 0) throw new FoundClubError('Este país não tem campeonato para entrar.');

  const accessLeague = tiers[0];
  const fixtures = JSON.parse(accessLeague.fixturesJson) as LeagueFixture[];
  if (fixtures.some((f) => f.result || f.matchId)) {
    throw new FoundClubError('A temporada nesta divisão já começou. Só dá para fundar um clube antes da primeira rodada.');
  }

  const memberIds = JSON.parse(accessLeague.clubIdsJson) as string[];
  if (memberIds.length < 2) throw new FoundClubError('Esta divisão é pequena demais para receber um clube novo.');

  const members = await prisma.club.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, ownerId: true, ratingAttack: true, ratingDefense: true },
  });

  /**
   * Only a club nobody manages can lose its place. Taking another human manager's league seat would be a
   * strange thing for the game to do on its own.
   */
  const displaceable = members.filter((c) => c.ownerId === BOT_OWNER_ID);
  if (displaceable.length === 0) throw new FoundClubError('Não há vaga disponível nesta divisão.');

  const displaced = displaceable.reduce((weakest, club) =>
    club.ratingAttack + club.ratingDefense < weakest.ratingAttack + weakest.ratingDefense ? club : weakest,
  );

  const tierAverage =
    members.reduce((sum, c) => sum + (c.ratingAttack + c.ratingDefense) / 2, 0) / Math.max(1, members.length);
  const skillLevel = Math.max(35, Math.round(tierAverage) - FOUNDED_SQUAD_HANDICAP);

  const id = randomUUID();
  // Contrato carimbado na criação, senão o clube nasce sem prazo nenhum e nada vence na primeira temporada.
  const players = await stampContracts(generateStarterSquad(id, country, undefined, skillLevel), id);
  const academyPlayers = await stampContracts(generateAcademy(id, country), `${id}-base`);

  /**
   * A slug, because a crest is a file named after one.
   *
   * Only clubs with a slug can carry their own badge (see `uploadCrest`), and a club a manager invented is
   * exactly the club most likely to want one. Suffixed with part of the id so two managers who both found a
   * "Esperança FC" do not end up sharing a badge.
   */
  const slug = `${slugify(name)}-${id.slice(0, 8)}`;

  await prisma.club.create({
    data: {
      id,
      name,
      ownerId,
      country,
      playersJson: JSON.stringify(players),
      academyPlayersJson: JSON.stringify(academyPlayers),
      slug,
      kitPattern: input.kitPattern ?? 'SOLID',
      primaryColor: input.primaryColor ?? '#e11d48',
      secondaryColor: input.secondaryColor ?? '#ffffff',
      crestBase64: input.crestBase64 ?? null,
      sponsorshipsJson: JSON.stringify(
        sponsorBoardFor({
          id,
          players,
          stadiumLevel: STARTING_STADIUM_LEVEL,
          stadiumCapacity: size.capacity,
          division: accessLeague.division,
          titlesWon: 0,
        }),
      ),
      budget: Math.round(STARTING_BUDGET * size.budgetShare),
      stadiumLevel: STARTING_STADIUM_LEVEL,
      stadiumCapacity: size.capacity,
    },
  });

  // One substitution, in the roster and in every fixture that was drawn against the club leaving.
  const swap = (clubId: string) => (clubId === displaced.id ? id : clubId);
  await prisma.league.update({
    where: { id: accessLeague.id },
    data: {
      clubIdsJson: JSON.stringify(memberIds.map(swap)),
      fixturesJson: JSON.stringify(
        fixtures.map((f) => ({ ...f, homeClubId: swap(f.homeClubId), awayClubId: swap(f.awayClubId) })),
      ),
    },
  });

  if (city?.trim()) {
    // Kept on the club so the crest prompt and the club page can say where it is from.
    await prisma.club.update({ where: { id }, data: { city: city.trim() } });
  }

  await openTenure(ownerId, id, name, country);
  syncCurrentSaveToDisk();

  return getClub(id);
}

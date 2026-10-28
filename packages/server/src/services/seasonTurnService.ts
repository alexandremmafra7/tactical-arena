import { randomUUID } from 'node:crypto';
import {
  backfillContract,
  playersToRelease,
  renewContract,
  defaultContractYears,
  isExpiring,
  hasExpired,
  type Position,
  BOT_OWNER_ID,
  DEFAULT_STAFF_DELEGATION_CONFIG,
  Club,
  autoFillLineup,
  matchDevelopmentPoints,
  Player,
  createRng,
  evolvePlayer,
  generateAcademyProspect,
  hasRetired,
  resolveYouthPromotions,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { toDomain as toDomainClub } from './clubService.js';
import { sponsorBoardFor } from './sponsorBoardService.js';
import { evaluateSeasonTurnStaffRecords } from './staffRecordService.js';
import { getGameState } from './gameStateService.js';

/**
 * Abaixo disto o clube não consegue escalar onze com um banco decente, e o jogo repõe.
 *
 * Onze titulares mais cinco no banco. É rede de segurança, não a reposição automática que existia antes.
 */
const MIN_SQUAD_SIZE = 16;

/** As posições que uma reposição de emergência preenche, na ordem em que fazem falta. */
const POSICOES_DE_EMERGENCIA: Position[] = ['GK', 'DEF', 'MID', 'ATT', 'DEF', 'MID'];

const BATCH_SIZE = 200;

export interface SeasonTurnOutcome {
  seasonYear: number;
  clubsProcessed: number;
}

/**
 * One club, one year older.
 *
 * Everything here used to happen every time a manager pressed "avançar semana", which is how a squad
 * could age a decade in a season and why nobody outside the manager's own club ever aged at all. Growth,
 * decline, retirement and graduation are annual events, so this is where they live now — and because
 * `developmentPoints` accumulate all season from both training and minutes played, what moves a player
 * is a year of being coached and picked rather than a single click.
 */
export function computeSeasonTurn(
  club: Club,
  rng: () => number,
  backgroundMatches = 0,
  world: { division?: number; seasonYear?: number } = {},
): Club & { liberados?: Player[] } {
  /** A temporada corrente, que os contratos precisam para saber o que venceu. */
  const temporada = world.seasonYear ?? new Date().getUTCFullYear();
  /**
   * The season's football, for a squad whose matches nobody watched.
   *
   * A background fixture is resolved from ratings and never opens a roster (see
   * `simulateBackgroundResult`), so the minutes it represents cannot be credited player by player as they
   * happen. They are counted instead and cashed in here, which is the same place a watched season's
   * development is spent anyway — nothing is lost by waiting, and the alternative is the thing this game
   * already refused once: a world standing still while the manager's squad pulls away.
   *
   * Credited as a full match to whoever would start, on the same curve as everything else: the young gain
   * far more from the same minutes than the settled do (see `matchDevelopmentPoints`).
   */
  if (backgroundMatches > 0) {
    const starters = new Set(autoFillLineup(club).lineup.map((slot) => slot.playerId));
    club = {
      ...club,
      players: club.players.map((player) =>
        starters.has(player.id)
          ? {
              ...player,
              developmentPoints:
                player.developmentPoints + backgroundMatches * matchDevelopmentPoints(player.age, 90),
            }
          : player,
      ),
    };
  }

  /**
   * Quem se aposenta vai embora, e ninguém nasce no lugar dele.
   *
   * Cada aposentado era substituído por um garoto de dezasseis a vinte e um anos na mesma posição, e isso
   * inflava o elenco: o substituto entrava **e** o formado da base entrava por cima. Medido ao longo de vinte
   * temporadas, um elenco de 32 chegava a 56 jogadores. Sem a reposição o saldo é de menos 0,7 por temporada,
   * e a categoria de base passa a ser a única fonte de gente nova, que é o que ela deveria ser.
   *
   * O garoto que a reposição criava também era um beco sem saída: nascia com 3,6 pontos de folga até o
   * potencial, contra 15,8 de quem sobe da base. Era reserva eterno desde o primeiro dia.
   */
  const evolvedPlayers = club.players
    .map((player) => evolvePlayer(player, rng))
    // Elencos criados antes de os contratos existirem entram no sistema aqui, com prazos espalhados.
    .map((player) => backfillContract(player, temporada, rng));
  const captainAfterEvolve = evolvedPlayers.find((p) => p.id === club.captainPlayerId);
  const captainRetired = club.captainPlayerId !== null && (!captainAfterEvolve || hasRetired(captainAfterEvolve));
  const naoAposentados = evolvedPlayers.filter((player) => !hasRetired(player));

  /**
   * Contrato que vence: o clube renova quem quer manter e solta o excedente.
   *
   * Sem esta escolha o mundo colapsa por escala: são 61.490 jogadores e contratos de três anos em média, o
   * que daria vinte mil vencimentos por temporada. Um clube de verdade renova quase todo mundo, e
   * `playersToRelease` decide os poucos que saem — medido, cerca de 545 no mundo inteiro por temporada.
   *
   * O clube do técnico não é renovado automaticamente: a decisão é dele, e é o que dá trabalho ao diretor de
   * futebol. Quem ele deixar vencer, ele perde.
   */
  const soltos = playersToRelease(naoAposentados, temporada);
  const soltosIds = new Set(soltos.map((p) => p.id));
  const survivors =
    club.ownerId === BOT_OWNER_ID
      ? naoAposentados
          .filter((p) => !soltosIds.has(p.id))
          .map((p) => (isExpiring(p, temporada) ? renewContract(p, temporada, defaultContractYears(p.age)) : p))
      : naoAposentados.filter((p) => !hasExpired(p, temporada));

  const liberados = club.ownerId === BOT_OWNER_ID
    ? soltos
    : naoAposentados.filter((p) => hasExpired(p, temporada));
  const captainPlayerId = captainRetired ? null : club.captainPlayerId;
  const captainWeeksServed = captainRetired ? 0 : club.captainWeeksServed;

  // Promotion is applied to the whole evolved academy: a ready jewel need not wait for the next birthday.
  const evolvedAcademy = club.academyPlayers.map((player) => evolvePlayer(player, rng));
  const promotions = resolveYouthPromotions(
    survivors,
    evolvedAcademy,
    club.staffDelegationConfig ?? DEFAULT_STAFF_DELEGATION_CONFIG,
  );
  const promoted = promotions.promoted.map((player) =>
    renewContract(player, temporada, defaultContractYears(player.age)),
  );
  // Each promotion opens a new academy slot. Manual mode retains every prospect, including 20-year-olds.
  const academyPlayers = [
    ...promotions.academyPlayers,
    ...promotions.promoted.map((player) =>
      generateAcademyProspect(`${club.id}-a-${randomUUID()}`, player.position, club.country, rng),
    ),
  ];

  /**
   * O piso, para nenhum clube ficar sem time.
   *
   * Medido: sem reposição, um elenco cruza os dezoito jogadores por volta da temporada vinte e nove, e nunca
   * chega perto de onze em quarenta. É longe, mas uma carreira longa ou um clube azarado com aposentadorias
   * chega lá, e um clube que não consegue escalar onze não é um clube. Isto não é a reposição antiga de
   * volta: só entra abaixo do piso, e nunca faz o elenco crescer.
   */
  const semAposentados = [...survivors, ...promoted];
  const faltam = Math.max(0, MIN_SQUAD_SIZE - semAposentados.length);
  const emergencia = Array.from({ length: faltam }, (_, i) =>
    generateAcademyProspect(`${club.id}-r-${randomUUID()}`, POSICOES_DE_EMERGENCIA[i % POSICOES_DE_EMERGENCIA.length], club.country, rng),
  );
  const players = [...semAposentados, ...emergencia];

  /**
   * The off-season is when sponsors are renegotiated, and a club nobody manages has to renegotiate its own.
   * Deals run out during the season (the weekly tick drops them at zero weeks) and only an owner can sign
   * a replacement, so without this the computer-run world would starve one contract at a time and end up
   * exactly where it started: insolvent, hidden behind a cash floor.
   *
   * The manager's own board is left alone. Signing is their decision, and the offers screen is where it
   * belongs.
   */
  const sponsorships =
    club.ownerId === BOT_OWNER_ID
      ? sponsorBoardFor({ ...club, players, division: world.division ?? 1, season: world.seasonYear })
      : club.sponsorships;

  return { ...club, players, academyPlayers, captainPlayerId, captainWeeksServed, sponsorships, liberados };
}

async function writeFor(club: Club & { liberados?: Player[] }, seasonYear = 0) {
  await prisma.club.update({
    where: { id: club.id },
    data: {
      playersJson: JSON.stringify(club.players),
      academyPlayersJson: JSON.stringify(club.academyPlayers),
      captainPlayerId: club.captainPlayerId,
      captainWeeksServed: club.captainWeeksServed,
      sponsorshipsJson: JSON.stringify(club.sponsorships),
      // The season's background matches have now been paid out as development.
      pendingMatchesPlayed: 0,
    },
  });

  /**
   * Quem teve contrato vencido vai para a lista de passes livres.
   *
   * Numa tabela própria porque o jogo guarda elenco como JSON dentro do clube, e um jogador sem clube não
   * tem onde morar. Sair do elenco e não chegar aqui seria apagar o jogador, que é pior do que não ter
   * contrato nenhum.
   */
  if (club.liberados && club.liberados.length > 0) {
    await prisma.freeAgent.createMany({
      data: club.liberados.map((jogador) => ({
        id: `${club.id}-${jogador.id}`,
        playerJson: JSON.stringify(jogador),
        country: jogador.nationality || club.country,
        overall: jogador.overall,
        position: jogador.position,
        sinceSeason: seasonYear,
      })),
    });
  }
}

/**
 * A year passes for one squad.
 *
 * The same seed and the same computation as the whole-world turn, just without reading the world to get
 * there. Useful wherever only one club's year is in question — and it is what `turnSeasonForAllClubs`
 * does to each club it finds.
 */
export async function turnSeasonForClub(clubId: string, seasonYear: number): Promise<void> {
  const record = await prisma.club.findUnique({ where: { id: clubId } });
  if (!record) return;
  const domainClub = toDomainClub(record);
  await evaluateSeasonTurnStaffRecords(domainClub, (await getGameState()).currentDate);
  const rng = createRng(`${clubId}-season-${seasonYear}`);
  await writeFor(
    computeSeasonTurn(domainClub, rng, record.pendingMatchesPlayed ?? 0, {
      division: (await divisionsByClubId([clubId])).get(clubId),
      seasonYear,
    }),
    seasonYear,
  );
}

/**
 * Which division each of these clubs plays in, in one query rather than one per club.
 *
 * The season turn runs across every club in the world, so a lookup per club would be thousands of them.
 * Sponsorship is the only thing here that needs it, and a club with no league at all is treated as playing
 * in the lowest tier the game models — which is what a club below the last division effectively is.
 */
async function divisionsByClubId(clubIds: string[]): Promise<Map<string, number>> {
  const wanted = new Set(clubIds);
  const leagues = await prisma.league.findMany({ select: { division: true, clubIdsJson: true } });
  const byClub = new Map<string, number>();
  for (const league of leagues) {
    for (const id of JSON.parse(league.clubIdsJson) as string[]) {
      if (!wanted.has(id)) continue;
      // A club can appear in several seasons of the same league; they share a division, so first wins.
      if (!byClub.has(id)) byClub.set(id, league.division);
    }
  }
  return byClub;
}

/**
 * A year passes, for every squad in the world.
 *
 * Seeded from the season being turned, so the same save always produces the same retirements and the
 * same breakthroughs. This is the squad half of the turn; the competition half (creating next season's
 * leagues and cups, paying the annual television money, opening the transfer window) belongs to the
 * 1 January turn that calls this.
 */
export async function turnSeasonForAllClubs(seasonYear: number): Promise<SeasonTurnOutcome> {
  let clubsProcessed = 0;
  let cursor: string | undefined;

  for (;;) {
    const records = await prisma.club.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (records.length === 0) break;
    cursor = records[records.length - 1].id;

    const divisions = await divisionsByClubId(records.map((r) => r.id));
    const writes = records.map((record) => {
      // Seeded per club as well as per season, so one club's retirements never depend on how many clubs
      // happen to sit before it in the batch.
      const rng = createRng(`${record.id}-season-${seasonYear}`);
      clubsProcessed += 1;
      return writeFor(
        computeSeasonTurn(toDomainClub(record), rng, record.pendingMatchesPlayed ?? 0, {
          division: divisions.get(record.id),
          seasonYear,
        }),
        seasonYear,
      );
    });

    /**
     * Em sequência, e não numa transação só.
     *
     * `writeFor` deixou de ser uma consulta e passou a ser duas: o clube, e os passes livres que saíram
     * dele. `$transaction` aceita uma lista de consultas do Prisma, não de promessas já em curso, e
     * empacotá-las juntas deixaria de compilar. O lote continua limitado por `BATCH_SIZE`.
     */
    for (const escrita of writes) await escrita;

    if (records.length < BATCH_SIZE) break;
  }

  return { seasonYear, clubsProcessed };
}

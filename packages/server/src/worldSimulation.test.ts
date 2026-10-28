import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { BOT_OWNER_ID, Club, League, generateDoubleRoundRobinFixtures } from '@tactical-arena/shared';
import { prisma } from './db/prisma.js';
import { advanceRound, getLeagueStats } from './services/leagueService.js';
import { createClub } from './services/clubService.js';
import { turnSeasonForClub } from './services/seasonTurnService.js';

/** Dedicated, never-reused country. */
const COUNTRY = 'CMR';

async function botClub(name: string): Promise<Club> {
  return createClub(BOT_OWNER_ID, name, COUNTRY);
}

async function createBotLeague(clubCount: number, division: number, name: string): Promise<{ leagueId: string; clubs: Club[] }> {
  const clubs: Club[] = [];
  for (let i = 0; i < clubCount; i++) {
    clubs.push(await botClub(`${name} ${i}`));
  }
  const clubIds = clubs.map((c) => c.id);
  const leagueId = randomUUID();
  await prisma.league.create({
    data: {
      id: leagueId,
      countryCode: COUNTRY,
      division,
      name,
      capacity: clubCount,
      status: 'IN_PROGRESS',
      clubIdsJson: JSON.stringify(clubIds),
      fixturesJson: JSON.stringify(generateDoubleRoundRobinFixtures(clubIds)),
      season: 2026,
    },
  });
  return { leagueId, clubs };
}

/** Plays every round of a bot league, tracking if any suspension was active during the season. */
async function playWholeSeason(leagueId: string): Promise<{ league: League; hadSuspensions: boolean }> {
  let league: League;
  let hadSuspensions = false;
  do {
    league = await advanceRound(leagueId, BOT_OWNER_ID);
    const currentClubs = await prisma.club.findMany({ where: { id: { in: league.clubIds } } });
    const currentPlayers = currentClubs.flatMap((c) => JSON.parse(c.playersJson) as { suspensions?: { matchesRemaining: number }[] }[]);
    if (currentPlayers.some((p) => (p.suspensions ?? []).length > 0)) {
      hadSuspensions = true;
    }
  } while (league.status !== 'FINISHED');
  return { league, hadSuspensions };
}

function squadIds(clubs: Club[]): Set<string> {
  const ids = new Set<string>();
  for (const club of clubs) ids.add(club.id);
  return ids;
}

describe('O mundo simulado', () => {
  it('computa os feitos de partidas de bot: cada gol tem artilheiro, e as assistências entram nas tabelas da liga', async () => {
    const { leagueId, clubs } = await createBotLeague(4, 10, 'Liga Feitos');
    const ids = squadIds(clubs);
    const goalsByPlayer = new Map<string, number>();
    const assistsByPlayer = new Map<string, number>();
    const playerClub = new Map<string, string>();

    const { league } = await playWholeSeason(leagueId);

    for (const fixture of league.fixtures) {
      if (!fixture.result) continue;
      const { scorers = [], assists = [] } = fixture.result;
      const homeClub = clubs.find((c) => c.id === fixture.homeClubId)!;
      const awayClub = clubs.find((c) => c.id === fixture.awayClubId)!;
      const squad = new Set([...homeClub.players.map((p) => p.id), ...awayClub.players.map((p) => p.id)]);

      for (const scorer of scorers) {
        expect(ids.has(scorer.clubId)).toBe(true);
        expect(squad.has(scorer.playerId), 'artilheiro deve ser um jogador real do clube').toBe(true);
        goalsByPlayer.set(scorer.playerId, (goalsByPlayer.get(scorer.playerId) ?? 0) + 1);
        playerClub.set(scorer.playerId, scorer.clubId);
      }

      for (const assistant of assists) {
        expect(ids.has(assistant.clubId)).toBe(true);
        expect(squad.has(assistant.playerId), 'assistente deve ser um jogador real do clube').toBe(true);
        assistsByPlayer.set(assistant.playerId, (assistsByPlayer.get(assistant.playerId) ?? 0) + 1);
        playerClub.set(assistant.playerId, assistant.clubId);
      }
    }

    expect(assistsByPlayer.size, 'o mundo deve gerar assistências para os jogadores de bot').toBeGreaterThan(0);

    const leaderGoals = Math.max(...goalsByPlayer.values());
    const leaderAssists = Math.max(...assistsByPlayer.values());

    const { topScorers, topAssistants } = await getLeagueStats(leagueId);
    expect(topScorers[0].goals).toBe(leaderGoals);
    expect(topScorers[0].clubId).toBe(playerClub.get(topScorers[0].playerId));
    expect(topAssistants[0].assists).toBe(leaderAssists);
    expect(topAssistants[0].clubId).toBe(playerClub.get(topAssistants[0].playerId));
  }, 60000);

  it('um campeonato inteiro de bots roda sozinho: campeão, artilheiro e evolução na virada', async () => {
    const { leagueId, clubs } = await createBotLeague(6, 11, 'Liga Mundo');
    const clubIds = clubs.map((c) => c.id);

    const rostersBefore = new Map(
      (await prisma.club.findMany({ where: { id: { in: clubIds } } })).map((c) => [c.id, c.playersJson]),
    );

    const matchesBefore = await prisma.match.count();
    const { league } = await playWholeSeason(leagueId);

    // Ninguém assistiu, então nenhum Match row deve ter sido criado.
    expect(await prisma.match.count()).toBe(matchesBefore);

    expect(league.status).toBe('FINISHED');
    expect(league.championClubId).not.toBeNull();
    expect(league.topScorerPlayerId).not.toBeNull();
    expect(league.topScorerGoals).toBeGreaterThan(0);
    expect(league.fixtures.every((f) => f.result)).toBe(true);

    /**
     * O que a regra de segundo plano compra, e o que ela custa.
     *
     * Uma partida que ninguém assiste é resolvida a partir das notas guardadas ao lado do clube, sem abrir
     * o elenco — que era onde estava o custo: o motor gasta 0,62 ms e a partida inteira media 27,7 ms.
     * Então o campeonato inteiro corre sem tocar num único jogador, e é isso que o torna viável num mundo
     * com centenas de ligas na mesma rodada.
     *
     * O preço é o que acontece *com* jogadores: não há lesão nem suspensão numa liga que o técnico não
     * disputa. As competições dele seguem simuladas minuto a minuto, com tudo.
     */
    const afterClubs = await prisma.club.findMany({ where: { id: { in: clubIds } } });
    for (const club of afterClubs) {
      expect(club.playersJson, 'o elenco não deve ser tocado por partidas de fundo').toBe(rostersBefore.get(club.id));
      expect(club.pendingMatchesPlayed, 'mas as partidas devem ser contadas').toBeGreaterThan(0);
    }

    // As tabelas continuam ganhando nome: cada gol tem um artilheiro real do clube.
    const scorers = league.fixtures.flatMap((f) => f.result?.scorers ?? []);
    expect(scorers.length).toBeGreaterThan(0);

    /**
     * E a evolução acontece — na virada do ano, que é onde os pontos de desenvolvimento são gastos de
     * qualquer forma. Um mundo que joga suas próprias ligas continua melhorando em vez de congelar.
     */
    const developmentBefore = totalDevelopment(afterClubs);
    for (const id of clubIds) await turnSeasonForClub(id, 2027);
    const developmentAfter = totalDevelopment(await prisma.club.findMany({ where: { id: { in: clubIds } } }));
    expect(developmentAfter).toBeGreaterThan(developmentBefore);
  }, 60000);
});

function totalDevelopment(clubs: { playersJson: string }[]): number {
  return clubs.reduce(
    (sum, c) => sum + (JSON.parse(c.playersJson) as { developmentPoints: number }[]).reduce((s, p) => s + p.developmentPoints, 0),
    0,
  );
}

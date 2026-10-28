import type { Club } from './club.js';
import type { Player, Position } from './player.js';

export interface PlayerStatsEntry {
  playerId: string;
  playerName: string;
  position: Position;
  clubId: string;
  clubName: string;
  clubSlug?: string | null;
  nationality?: string;
  age: number;
  overall: number;
  matches: number;
  goals: number;
  assists: number;
  goalsPerMatch: number;
}

/**
 * Agrega e ordena as estatísticas de artilharia e assistências dos jogadores de um conjunto de clubes.
 */
export function aggregateClubPlayerStats(
  clubs: Club[],
  clubIds?: string[],
): { topScorers: PlayerStatsEntry[]; topAssistants: PlayerStatsEntry[] } {
  const entries: PlayerStatsEntry[] = [];
  const targetClubIds = clubIds ? new Set(clubIds) : null;

  for (const club of clubs) {
    if (targetClubIds && !targetClubIds.has(club.id)) continue;
    for (const p of club.players) {
      const goals = p.seasonGoals ?? 0;
      const assists = p.seasonAssists ?? 0;
      const matches = p.seasonMatches ?? 0;
      entries.push({
        playerId: p.id,
        playerName: p.name,
        position: p.position,
        clubId: club.id,
        clubName: club.name,
        clubSlug: club.slug,
        nationality: p.nationality ?? 'BRA',
        age: p.age,
        overall: p.overall,
        matches,
        goals,
        assists,
        goalsPerMatch: matches > 0 ? Number((goals / matches).toFixed(2)) : 0,
      });
    }
  }

  const topScorers = entries
    .filter((e) => e.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.matches - b.matches)
    .slice(0, 50)
    .map((entry) => ({ ...entry }));

  const topAssistants = entries
    .filter((e) => e.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals || a.matches - b.matches)
    .slice(0, 50)
    .map((entry) => ({ ...entry }));

  return { topScorers, topAssistants };
}

/**
 * Determina os 11 titulares padrão de um clube para simulação em segundo plano.
 */
export function defaultLineupForClub(players: Player[]): Player[] {
  if (players.length <= 11) return [...players];
  const gks = players.filter((p) => p.position === 'GK').sort((a, b) => b.overall - a.overall);
  const defs = players.filter((p) => ['ZAG', 'LAT', 'CB', 'LB', 'RB'].includes(p.position)).sort((a, b) => b.overall - a.overall);
  const mids = players.filter((p) => ['VOL', 'MEI', 'MC', 'CM', 'CAM'].includes(p.position)).sort((a, b) => b.overall - a.overall);
  const atts = players.filter((p) => ['ATA', 'CF', 'ST', 'RW', 'LW'].includes(p.position)).sort((a, b) => b.overall - a.overall);

  const selected: Player[] = [];
  if (gks[0]) selected.push(gks[0]);
  selected.push(...defs.slice(0, 4));
  selected.push(...mids.slice(0, 4));
  selected.push(...atts.slice(0, 2));

  if (selected.length < 11) {
    const selectedIds = new Set(selected.map((p) => p.id));
    const remaining = players.filter((p) => !selectedIds.has(p.id)).sort((a, b) => b.overall - a.overall);
    selected.push(...remaining.slice(0, 11 - selected.length));
  }
  return selected.slice(0, 11);
}

/**
 * Gera marcadores de gols e assistências realistas e determinísticos para partidas em segundo plano.
 */
export function generateBackgroundScorersAndAssists(
  club: Club,
  goals: number,
  seed = `${club.id}-${goals}`
): {
  scorers: Array<{ playerId: string }>;
  assists: Array<{ playerId: string }>;
  lineupPlayerIds: string[];
} {
  const lineup = defaultLineupForClub(club.players);
  const lineupPlayerIds = lineup.map((p) => p.id);
  if (goals <= 0 || lineup.length === 0) {
    return { scorers: [], assists: [], lineupPlayerIds };
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const nextRng = () => {
    hash = (hash * 9301 + 49297) % 233280;
    return Math.abs(hash / 233280);
  };

  const scorers: Array<{ playerId: string }> = [];
  const assists: Array<{ playerId: string }> = [];

  const scorerWeights = lineup.map((p) => {
    let mult = 1.0;
    if (['ATA', 'CF', 'ST', 'RW', 'LW'].includes(p.position)) mult = 5.0;
    else if (['MEI', 'MC', 'CAM'].includes(p.position)) mult = 2.0;
    else if (['VOL', 'CM'].includes(p.position)) mult = 1.0;
    else if (['LAT', 'ZAG', 'CB', 'LB', 'RB'].includes(p.position)) mult = 0.35;
    else mult = 0.0;
    return p.overall * mult;
  });
  const totalScorerWeight = scorerWeights.reduce((s, w) => s + w, 0) || 1;

  for (let g = 0; g < goals; g++) {
    const roll = nextRng() * totalScorerWeight;
    let acc = 0;
    let scorer = lineup[0];
    for (let i = 0; i < lineup.length; i++) {
      acc += scorerWeights[i];
      if (roll <= acc) {
        scorer = lineup[i];
        break;
      }
    }
    scorers.push({ playerId: scorer.id });

    if (nextRng() < 0.75) {
      const eligible = lineup.filter((p) => p.id !== scorer.id);
      const assistWeights = eligible.map((p) => {
        let mult = 1.0;
        if (['MEI', 'MC', 'CAM'].includes(p.position)) mult = 4.0;
        else if (['ATA', 'CF', 'RW', 'LW'].includes(p.position)) mult = 2.5;
        else if (['LAT', 'LB', 'RB', 'VOL'].includes(p.position)) mult = 1.5;
        else mult = 0.2;
        return p.overall * mult;
      });
      const totalAssistWeight = assistWeights.reduce((s, w) => s + w, 0) || 1;
      const aRoll = nextRng() * totalAssistWeight;
      let aAcc = 0;
      let assistant = eligible[0];
      for (let i = 0; i < eligible.length; i++) {
        aAcc += assistWeights[i];
        if (aRoll <= aAcc) {
          assistant = eligible[i];
          break;
        }
      }
      if (assistant) {
        assists.push({ playerId: assistant.id });
      }
    }
  }

  return { scorers, assists, lineupPlayerIds };
}

/**
 * Atualiza os contadores de gols, assistências e jogos de um elenco com base nos eventos de uma partida assistida.
 */
export function applyMatchEventsToPlayers(
  players: Player[],
  events: Array<{ type: string; playerId?: string; assistPlayerId?: string }>,
  playedMinutes: Map<string, number>,
): Player[] {
  return players.map((p) => {
    const pGoals = events.filter((e) => e.type === 'goal' && e.playerId === p.id).length;
    const pAssists = events.filter((e) => e.type === 'goal' && e.assistPlayerId === p.id).length;
    const minutes = playedMinutes.get(p.id) ?? 0;
    const played = minutes > 0 ? 1 : 0;

    const seasonGoals = (p.seasonGoals ?? 0) + pGoals;
    const seasonAssists = (p.seasonAssists ?? 0) + pAssists;
    const seasonMatches = (p.seasonMatches ?? 0) + played;
    const careerGoals = (p.careerGoals ?? 0) + pGoals;
    const careerAssists = (p.careerAssists ?? 0) + pAssists;
    const careerMatches = (p.careerMatches ?? 0) + played;

    return {
      ...p,
      seasonGoals,
      seasonAssists,
      seasonMatches,
      careerGoals,
      careerAssists,
      careerMatches,
    };
  });
}

/**
 * Atualiza os contadores de uma partida em segundo plano (background match).
 */
export function applyBackgroundResultToPlayers(
  players: Player[],
  scorers: Array<{ playerId: string }>,
  assists: Array<{ playerId: string }>,
  lineupPlayerIds: string[],
): Player[] {
  const goalCounts = new Map<string, number>();
  for (const s of scorers) {
    goalCounts.set(s.playerId, (goalCounts.get(s.playerId) ?? 0) + 1);
  }
  const assistCounts = new Map<string, number>();
  for (const a of assists) {
    assistCounts.set(a.playerId, (assistCounts.get(a.playerId) ?? 0) + 1);
  }
  const playedSet = new Set(lineupPlayerIds);

  return players.map((p) => {
    const g = goalCounts.get(p.id) ?? 0;
    const a = assistCounts.get(p.id) ?? 0;
    const played = playedSet.has(p.id) ? 1 : 0;

    const seasonGoals = (p.seasonGoals ?? 0) + g;
    const seasonAssists = (p.seasonAssists ?? 0) + a;
    const seasonMatches = (p.seasonMatches ?? 0) + played;
    const careerGoals = (p.careerGoals ?? 0) + g;
    const careerAssists = (p.careerAssists ?? 0) + a;
    const careerMatches = (p.careerMatches ?? 0) + played;

    return {
      ...p,
      seasonGoals,
      seasonAssists,
      seasonMatches,
      careerGoals,
      careerAssists,
      careerMatches,
    };
  });
}

/**
 * Reseta os contadores da temporada atual na virada de ano, acumulando para a carreira.
 */
export function resetPlayerSeasonStats(player: Player): Player {
  const seasonGoals = player.seasonGoals ?? 0;
  const seasonAssists = player.seasonAssists ?? 0;
  const seasonMatches = player.seasonMatches ?? 0;
  return {
    ...player,
    careerGoals: (player.careerGoals ?? 0) + seasonGoals,
    careerAssists: (player.careerAssists ?? 0) + seasonAssists,
    careerMatches: (player.careerMatches ?? 0) + seasonMatches,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonMatches: 0,
  };
}

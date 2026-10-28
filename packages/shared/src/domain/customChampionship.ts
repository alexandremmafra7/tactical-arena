import type { CupFixture, CupTieFormat } from './cup.js';
import { generateFirstRoundFixtures, generateNextRoundFixtures, totalCupRounds } from './cup.js';
import type { StandingRow } from './league.js';
import { createRng } from '../simulation/rng.js';

/**
 * Modo Campeonatos Personalizados: o jogador monta a própria pirâmide de ligas e copas, escolhendo
 * clubes de qualquer nacionalidade. Ver `docs/PROMPT_CUSTOM_CHAMPIONSHIP.md` para a especificação completa.
 */
export type TournamentFormatType = 'LEAGUE_PURE' | 'LEAGUE_WITH_PLAYOFFS' | 'CUP_KNOCKOUT' | 'CUSTOM_PYRAMID';

export type DivisionRoundsFormat = 'SINGLE' | 'DOUBLE';

export interface CustomPlayoffConfig {
  qualifyingSpots: 4 | 8;
  tieFormat: CupTieFormat;
  hasThirdPlaceMatch: boolean;
  neutralFinal: boolean;
}

export interface CustomDivisionConfig {
  division: number;
  name: string;
  clubIds: string[];
  roundsFormat: DivisionRoundsFormat;
  promotionCount: number;
  relegationCount: number;
  playoffs?: CustomPlayoffConfig;
}

export interface CustomCupConfig {
  name: string;
  clubIds: string[];
  tieFormat: CupTieFormat;
}

export interface CustomChampionshipSettings {
  isContinuousCareer: boolean;
  allowTransfers: boolean;
  injuriesAndSuspensions: boolean;
}

export interface CustomChampionshipConfig {
  id: string;
  name: string;
  formatType: TournamentFormatType;
  divisions: CustomDivisionConfig[];
  cup?: CustomCupConfig;
  settings: CustomChampionshipSettings;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_CUP_SIZES = [8, 16, 32];

/**
 * Valida uma configuração de campeonato personalizado antes de criar o save. Puramente estrutural —
 * não toca o SQLite nem resolve os `clubIds` contra a base de clubes (isso é responsabilidade do
 * `customChampionshipService` no servidor, que conhece o catálogo real de clubes).
 */
export function validateCustomChampionshipConfig(config: CustomChampionshipConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.name || config.name.trim().length === 0) {
    errors.push('O campeonato precisa de um nome.');
  }

  if (config.formatType === 'CUP_KNOCKOUT') {
    if (!config.cup) {
      errors.push('Copas eliminatórias precisam de uma configuração de copa (`cup`).');
    } else if (!VALID_CUP_SIZES.includes(config.cup.clubIds.length)) {
      errors.push(`A copa precisa de 8, 16 ou 32 clubes (recebido: ${config.cup.clubIds.length}).`);
    }
  } else {
    if (config.divisions.length < 1 || config.divisions.length > 4) {
      errors.push(`É preciso ter entre 1 e 4 divisões (recebido: ${config.divisions.length}).`);
    }

    const seenDivisionNumbers = new Set<number>();
    config.divisions.forEach((div, index) => {
      if (seenDivisionNumbers.has(div.division)) {
        errors.push(`Número de divisão duplicado: ${div.division}.`);
      }
      seenDivisionNumbers.add(div.division);

      if (!div.name || div.name.trim().length === 0) {
        errors.push(`A divisão ${index + 1} precisa de um nome.`);
      }
      if (div.clubIds.length < 2) {
        errors.push(`A divisão "${div.name}" precisa de pelo menos 2 clubes.`);
      }
      if (div.clubIds.length % 2 !== 0) {
        errors.push(`A divisão "${div.name}" precisa de um número par de clubes para montar a tabela (recebido: ${div.clubIds.length}).`);
      }
      if (div.promotionCount < 0 || div.promotionCount >= div.clubIds.length) {
        errors.push(`Vagas de acesso inválidas na divisão "${div.name}".`);
      }
      if (div.relegationCount < 0 || div.relegationCount >= div.clubIds.length) {
        errors.push(`Vagas de descenso inválidas na divisão "${div.name}".`);
      }

      if (config.formatType === 'LEAGUE_WITH_PLAYOFFS') {
        if (!div.playoffs) {
          errors.push(`A divisão "${div.name}" precisa de uma configuração de playoffs.`);
        } else if (div.playoffs.qualifyingSpots > div.clubIds.length) {
          errors.push(`A divisão "${div.name}" não tem clubes suficientes para ${div.playoffs.qualifyingSpots} vagas de playoff.`);
        }
      }
    });

    if (config.formatType === 'CUSTOM_PYRAMID' && config.divisions.length > 1) {
      const byDivision = [...config.divisions].sort((a, b) => a.division - b.division);
      for (let i = 0; i < byDivision.length - 1; i += 1) {
        const upper = byDivision[i];
        const lower = byDivision[i + 1];
        if (upper.relegationCount !== lower.promotionCount) {
          errors.push(
            `Vagas de acesso/descenso não combinam entre "${upper.name}" (desce ${upper.relegationCount}) e "${lower.name}" (sobe ${lower.promotionCount}).`,
          );
        }
      }
    }
  }

  if (config.cup && config.formatType !== 'CUP_KNOCKOUT' && config.cup.clubIds.length < 2) {
    errors.push('A Copa Geral precisa de pelo menos 2 clubes.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Turno único: mesmo método de rotação do `generateDoubleRoundRobinFixtures` (league.ts), mas mantendo
 * apenas a primeira volta — cada clube enfrenta o outro uma única vez.
 */
export function generateSingleRoundRobinFixtures(clubIds: string[], seed?: string | number): { round: number; homeClubId: string; awayClubId: string }[] {
  const n = clubIds.length;
  if (n < 2) throw new Error('Uma divisão precisa de pelo menos 2 clubes para gerar a tabela');
  if (n % 2 !== 0) throw new Error('generateSingleRoundRobinFixtures exige um número par de clubes');

  let shuffledIds = [...clubIds];
  if (seed !== undefined && seed !== null) {
    const rng = createRng(typeof seed === 'number' ? String(seed) : seed);
    for (let i = shuffledIds.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
    }
  }

  const fixed = shuffledIds[0];
  let rotating = shuffledIds.slice(1);
  const fixtures: { round: number; homeClubId: string; awayClubId: string }[] = [];

  for (let round = 0; round < n - 1; round++) {
    const current = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const home = current[i];
      const away = current[n - 1 - i];
      const [h, a] = round % 2 === 0 ? [home, away] : [away, home];
      fixtures.push({ round: round + 1, homeClubId: h, awayClubId: a });
    }
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return fixtures;
}

const PLAYOFF_STAGE_NAMES: Record<4, Record<number, string>> & Record<8, Record<number, string>> = {
  4: { 1: 'Semifinal', 2: 'Final' },
  8: { 1: 'Quartas de Final', 2: 'Semifinal', 3: 'Final' },
};

export interface PlayoffBracket {
  qualifyingSpots: 4 | 8;
  tieFormat: CupTieFormat;
  hasThirdPlaceMatch: boolean;
  neutralFinal: boolean;
  /** Clubes classificados para o playoff, em ordem de campanha (1º colocado primeiro). */
  seeds: string[];
  /** Todas as partidas geradas até agora, de todas as fases já sorteadas. */
  fixtures: CupFixture[];
  thirdPlaceFixture: CupFixture | null;
  championClubId: string | null;
  runnerUpClubId: string | null;
}

function tieFixtures(homeClubId: string, awayClubId: string, round: number, stageName: string, tieFormat: CupTieFormat, tieId: string): CupFixture[] {
  if (tieFormat === 'SINGLE_LEG') {
    return [{ round, stageName, homeClubId, awayClubId, matchId: null, winnerClubId: null, wentToPenalties: false, tieId }];
  }
  return [
    { round, stageName, homeClubId, awayClubId, matchId: null, winnerClubId: null, wentToPenalties: false, leg: 1, tieId },
    { round, stageName, homeClubId: awayClubId, awayClubId: homeClubId, matchId: null, winnerClubId: null, wentToPenalties: false, leg: 2, tieId },
  ];
}

/** 1v4, 2v3 (top 4) ou 1v8, 2v7, 3v6, 4v5 (top 8) — melhor campanha sempre contra a pior. */
function pairSeeds(seeds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < seeds.length / 2; i++) {
    pairs.push([seeds[i], seeds[seeds.length - 1 - i]]);
  }
  return pairs;
}

/**
 * Monta a 1ª fase do mata-mata de playoffs a partir da tabela da fase regular. As fases seguintes só são
 * geradas por `advancePlayoffRound`, depois que os jogos da fase atual forem decididos — igual ao resto
 * do chaveamento de copas do jogo (ver cup.ts), onde o bracket não existe adiantado.
 */
export function generatePlayoffBracket(standings: StandingRow[], config: CustomPlayoffConfig): PlayoffBracket {
  if (standings.length < config.qualifyingSpots) {
    throw new Error(`É preciso de pelo menos ${config.qualifyingSpots} clubes na tabela para montar este playoff (recebido: ${standings.length})`);
  }

  const seeds = standings.slice(0, config.qualifyingSpots).map((row) => row.clubId);
  const stageName = PLAYOFF_STAGE_NAMES[config.qualifyingSpots][1];
  const fixtures = pairSeeds(seeds).flatMap(([home, away], i) =>
    tieFixtures(home, away, 1, stageName, config.tieFormat, `PO_R1_${i + 1}`),
  );

  return {
    qualifyingSpots: config.qualifyingSpots,
    tieFormat: config.tieFormat,
    hasThirdPlaceMatch: config.hasThirdPlaceMatch,
    neutralFinal: config.neutralFinal,
    seeds,
    fixtures,
    thirdPlaceFixture: null,
    championClubId: null,
    runnerUpClubId: null,
  };
}

/** Vencedor de um confronto: jogo único usa o próprio `winnerClubId`; ida e volta usa o do 2º jogo (que carrega o agregado). */
function tieWinner(legs: CupFixture[]): string | null {
  const decisive = legs.find((f) => f.leg === 2) ?? legs[0];
  return decisive.winnerClubId;
}

/**
 * Avança o playoff: recebe as partidas da rodada atual já decididas (com `winnerClubId` preenchido pelo
 * motor de partidas ou pela simulação de placar — esta função não decide resultados, só o chaveamento) e
 * gera a próxima fase, ou fecha o campeonato quando a final foi jogada.
 */
export function advancePlayoffRound(bracket: PlayoffBracket, decidedFixtures: CupFixture[]): PlayoffBracket {
  const byTie = new Map<string, CupFixture[]>();
  for (const fixture of decidedFixtures) {
    if (!fixture.tieId) throw new Error('Toda partida de playoff precisa de um tieId');
    if (fixture.winnerClubId === null) throw new Error(`Partida ${fixture.tieId} ainda não tem um vencedor definido`);
    byTie.set(fixture.tieId, [...(byTie.get(fixture.tieId) ?? []), fixture]);
  }

  const currentRound = decidedFixtures[0]?.round ?? 1;
  const mergedFixtures = [
    ...bracket.fixtures.filter((f) => f.round !== currentRound),
    ...decidedFixtures,
  ];

  const winners = [...byTie.values()].map(tieWinner).filter((id): id is string => id !== null);
  const totalRounds = bracket.qualifyingSpots === 4 ? 2 : 3;

  if (currentRound >= totalRounds) {
    // Final just played.
    const championClubId = winners[0] ?? null;
    const finalFixtures = decidedFixtures.filter((f) => f.round === currentRound);
    const runnerUpClubId = finalFixtures.find((f) => f.homeClubId === championClubId)?.awayClubId
      ?? finalFixtures.find((f) => f.awayClubId === championClubId)?.homeClubId
      ?? null;
    return { ...bracket, fixtures: mergedFixtures, championClubId, runnerUpClubId };
  }

  const nextRound = currentRound + 1;
  const stageName = PLAYOFF_STAGE_NAMES[bracket.qualifyingSpots][nextRound];
  const nextFixtures = pairSeeds(winners).flatMap(([home, away], i) =>
    tieFixtures(home, away, nextRound, stageName, bracket.tieFormat, `PO_R${nextRound}_${i + 1}`),
  );

  let thirdPlaceFixture = bracket.thirdPlaceFixture;
  if (bracket.hasThirdPlaceMatch && nextRound === totalRounds && winners.length === 2) {
    const losers = [...byTie.entries()].map(([tieId, legs]) => {
      const winner = tieWinner(legs);
      const decisive = legs.find((f) => f.leg === 2) ?? legs[0];
      return { tieId, loser: decisive.homeClubId === winner ? decisive.awayClubId : decisive.homeClubId };
    });
    if (losers.length === 2) {
      thirdPlaceFixture = {
        round: nextRound,
        stageName: 'Disputa de 3º Lugar',
        homeClubId: losers[0].loser,
        awayClubId: losers[1].loser,
        matchId: null,
        winnerClubId: null,
        wentToPenalties: false,
        tieId: 'PO_3RD_PLACE',
      };
    }
  }

  return { ...bracket, fixtures: [...mergedFixtures, ...nextFixtures], thirdPlaceFixture };
}

export interface CupBracket {
  name: string;
  tieFormat: CupTieFormat;
  clubIds: string[];
  fixtures: CupFixture[];
  championClubId: string | null;
}

/** Monta a 1ª fase de uma copa eliminatória personalizada (8, 16 ou 32 clubes). */
export function generateCustomCupBracket(clubIds: string[], config: CustomCupConfig): CupBracket {
  if (!VALID_CUP_SIZES.includes(clubIds.length)) {
    throw new Error(`A copa precisa de 8, 16 ou 32 clubes (recebido: ${clubIds.length})`);
  }

  if (config.tieFormat === 'SINGLE_LEG') {
    return { name: config.name, tieFormat: config.tieFormat, clubIds, fixtures: generateFirstRoundFixtures(clubIds), championClubId: null };
  }

  const stageName = cupStageName(clubIds.length);
  const fixtures = chunkPairs(clubIds).flatMap(([home, away], i) => tieFixtures(home, away, 1, stageName, config.tieFormat, `CUP_R1_${i + 1}`));
  return { name: config.name, tieFormat: config.tieFormat, clubIds, fixtures, championClubId: null };
}

function chunkPairs(ids: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
  return pairs;
}

function cupStageName(entrants: number): string {
  if (entrants === 8) return 'Quartas de Final';
  if (entrants === 16) return 'Oitavas de Final';
  return 'Dezesseis-avos de Final';
}

function nextCupStageName(remainingClubs: number): string | undefined {
  if (remainingClubs === 8) return 'Quartas de Final';
  if (remainingClubs === 4) return 'Semifinal';
  if (remainingClubs === 2) return 'Final';
  if (remainingClubs === 16) return 'Oitavas de Final';
  return undefined;
}

/**
 * Avança a copa personalizada: recebe as partidas da rodada atual decididas e gera a próxima fase (ou
 * fecha o torneio com um campeão, quando a final foi jogada). Para turno único, reusa o avanço do bracket
 * padrão (`generateNextRoundFixtures`, de cup.ts); para ida e volta, agrupa por `tieId` como no playoff.
 */
export function advanceCustomCupBracket(bracket: CupBracket, decidedFixtures: CupFixture[]): CupBracket {
  const currentRound = decidedFixtures[0]?.round ?? 1;
  const mergedFixtures = [...bracket.fixtures.filter((f) => f.round !== currentRound), ...decidedFixtures];

  let winners: string[];
  if (bracket.tieFormat === 'SINGLE_LEG') {
    winners = decidedFixtures.map((f) => {
      if (f.winnerClubId === null) throw new Error('Toda partida da rodada precisa de um vencedor definido');
      return f.winnerClubId;
    });
  } else {
    const byTie = new Map<string, CupFixture[]>();
    for (const fixture of decidedFixtures) {
      if (!fixture.tieId) throw new Error('Toda partida de ida e volta precisa de um tieId');
      byTie.set(fixture.tieId, [...(byTie.get(fixture.tieId) ?? []), fixture]);
    }
    winners = [...byTie.values()].map((legs) => {
      const winner = tieWinner(legs);
      if (winner === null) throw new Error('Confronto ainda não tem um vencedor definido');
      return winner;
    });
  }

  if (winners.length === 1) {
    return { ...bracket, fixtures: mergedFixtures, championClubId: winners[0] };
  }

  const nextRound = currentRound + 1;
  if (bracket.tieFormat === 'SINGLE_LEG') {
    const nextFixtures = generateNextRoundFixtures(winners, nextRound, nextCupStageName(winners.length));
    return { ...bracket, fixtures: [...mergedFixtures, ...nextFixtures] };
  }

  const stageName = nextCupStageName(winners.length);
  const nextFixtures = chunkPairs(winners).flatMap(([home, away], i) =>
    tieFixtures(home, away, nextRound, stageName ?? 'Mata-Mata', bracket.tieFormat, `CUP_R${nextRound}_${i + 1}`),
  );
  return { ...bracket, fixtures: [...mergedFixtures, ...nextFixtures] };
}

export { totalCupRounds };

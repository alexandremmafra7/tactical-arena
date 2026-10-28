import {
  MAX_SPONSORSHIPS,
  STAFF_ROLES_INFO,
  injuredPlayers,
  seasonsRemaining,
  suspendedPlayers,
  weeklyCashFlow,
} from '@tactical-arena/shared';
import type { CalendarEntry } from '../api/client.js';
import type { Club, CountryHistory, Cup, League } from '@tactical-arena/shared';

/**
 * O que cada card de hub diz sobre si.
 *
 * Antes o card era só a arte: o jogador abria "Minha equipe" e não ficava sabendo que tinha dois
 * lesionados e três contratos vencendo, precisava entrar em cada tela para descobrir se havia motivo para
 * entrar. Aqui mora o texto de cada faixa, num arquivo só, para a regra ser a mesma nos cinco hubs.
 *
 * Tudo abaixo sai do que a tela já tem em mãos. Nenhum status justifica uma requisição a mais.
 */
export type StatusTone = 'neutral' | 'attention' | 'urgent';

export interface HubStatus {
  /** O número, ou a palavra curta que faz as vezes dele. */
  value: string;
  /** O que o número é. Uma ou duas palavras. */
  label: string;
  tone?: StatusTone;
}

function plural(n: number, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_;
}

/** Cards do hub "Minha equipe". `seasonYear` vem do relógio do jogo; sem ele, contrato não é avaliado. */
export function teamHubStatus(club: Club, seasonYear: number | null): Record<string, HubStatus> {
  const injured = injuredPlayers(club.players).length;
  const suspended = suspendedPlayers(club.players).length;
  const unavailable = injured + suspended;

  const starters = club.pendingRoundTactic?.lineup?.filter((slot) => Boolean(slot?.playerId)).length ?? 0;

  const semFoco = club.players.filter((p) => !p.trainingFocus).length;

  const cargosTotal = Object.keys(STAFF_ROLES_INFO).length;
  const cargosOcupados = club.staff?.length ?? 0;
  const vagasStaff = Math.max(0, cargosTotal - cargosOcupados);

  const vencendo =
    seasonYear === null ? 0 : club.players.filter((p) => seasonsRemaining(p, seasonYear) <= 1).length;

  return {
    squad: unavailable > 0
      ? {
          value: String(unavailable),
          label: plural(unavailable, 'jogador fora', 'jogadores fora'),
          tone: injured > 0 ? 'urgent' : 'attention',
        }
      : { value: String(club.players.length), label: 'jogadores', tone: 'neutral' },

    tactics: starters === 11
      ? { value: club.pendingRoundTactic?.formation ?? '4-4-2', label: 'time escalado', tone: 'neutral' }
      : { value: `${starters}/11`, label: 'titulares definidos', tone: 'urgent' },

    training:
      semFoco === 0
        ? { value: 'Todos', label: 'com foco de treino', tone: 'neutral' }
        : semFoco === club.players.length
          ? { value: 'Nenhum', label: 'foco de treino definido', tone: 'attention' }
          : { value: String(semFoco), label: 'sem foco de treino', tone: 'attention' },

    academy: {
      value: String(club.academyPlayers?.length ?? 0),
      label: 'na base',
      tone: 'neutral',
    },

    staff: vagasStaff > 0
      ? { value: String(vagasStaff), label: plural(vagasStaff, 'cargo vago', 'cargos vagos'), tone: 'attention' }
      : { value: `${cargosOcupados}/${cargosTotal}`, label: 'comissão completa', tone: 'neutral' },

    contracts: vencendo > 0
      ? { value: String(vencendo), label: plural(vencendo, 'contrato vencendo', 'contratos vencendo'), tone: 'attention' }
      : { value: 'Nenhum', label: 'contrato vencendo', tone: 'neutral' },
  };
}

/** Cards do hub "Financeiro". */
export function financeHubStatus(club: Club): Record<string, HubStatus> {
  const vagas = MAX_SPONSORSHIPS - (club.sponsorships?.length ?? 0);
  const { net } = weeklyCashFlow(club);
  const obra = club.stadiumConstruction;

  return {
    sponsors: vagas > 0
      ? { value: String(vagas), label: plural(vagas, 'vaga aberta', 'vagas abertas'), tone: 'attention' }
      : { value: `${club.sponsorships.length}/${MAX_SPONSORSHIPS}`, label: 'cotas fechadas', tone: 'neutral' },

    stadium: obra
      ? { value: `${obra.weeksRemaining}`, label: plural(obra.weeksRemaining, 'semana de obra', 'semanas de obra'), tone: 'attention' }
      : { value: club.stadiumCapacity.toLocaleString('pt-BR'), label: 'lugares', tone: 'neutral' },

    finance: {
      value: formatCompactMoney(club.budget),
      label: net >= 0 ? 'em caixa, contas no azul' : 'em caixa, contas no vermelho',
      tone: net >= 0 ? 'neutral' : 'urgent',
    },
  };
}

/** Cards do hub "Competições". */
export function competitionsHubStatus(
  club: Club,
  league: (League & { standings?: { clubId: string }[] }) | null,
  cups: Cup[],
  nextEntry: CalendarEntry | null,
): Record<string, HubStatus> {
  const pos = league?.standings?.findIndex((row) => row.clubId === club.id) ?? -1;

  const status: Record<string, HubStatus> = {
    league: league
      ? pos >= 0
        ? { value: `${pos + 1}º`, label: `de ${league.clubIds.length} no ${league.name}`, tone: 'neutral' }
        : { value: league.name, label: 'campeonato em disputa', tone: 'neutral' }
      : { value: 'Nenhum', label: 'campeonato em disputa', tone: 'neutral' },

    agenda: nextEntry
      ? {
          value: nextEntry.date ? nextEntry.date.slice(8, 10) + '/' + nextEntry.date.slice(5, 7) : 'a definir',
          label: `${nextEntry.isHome ? 'em casa' : 'fora'} contra ${nextEntry.opponentName}`,
          tone: 'neutral',
        }
      : { value: 'Vazio', label: 'nenhum jogo marcado', tone: 'neutral' },
  };

  for (const cup of cups) {
    status[cup.id] =
      cup.status === 'FINISHED'
        ? cup.championClubId === club.id
          ? { value: 'Campeão', label: cup.name, tone: 'neutral' }
          : { value: 'Encerrada', label: cup.name, tone: 'neutral' }
        : { value: 'Em disputa', label: cup.name, tone: 'neutral' };
  }

  return status;
}

/**
 * Cards do hub "Clube".
 *
 * O histórico é a mesma requisição que as duas telas de dentro já fazem, então sai de graça em termos de
 * código novo. Minha carreira fica sem faixa: é uma placa, não um banner, e já se distingue à vista.
 */
export function clubHubStatus(club: Club, history: CountryHistory[]): Record<string, HubStatus> {
  // A temporada encerrada mais recente, em qualquer competição do mundo, é o que a tela de artilharia abre.
  const entries = history.flatMap((country) => [...country.leagues, ...country.cups]);
  const ultima = entries
    .filter((entry) => entry.topScorerName && entry.topScorerGoals != null)
    .sort((a, b) => b.season - a.season)[0];

  return {
    champions: {
      value: String(club.titlesWon),
      label: plural(club.titlesWon, 'título conquistado', 'títulos conquistados'),
      tone: 'neutral',
    },

    scorers: ultima
      ? { value: `${ultima.topScorerGoals}`, label: `gols de ${ultima.topScorerName} em ${ultima.season}`, tone: 'neutral' }
      : { value: 'Nenhuma', label: 'temporada encerrada ainda', tone: 'neutral' },
  };
}

/** Abreviação de dinheiro para caber numa faixa: 15,0 mi em vez de R$ 15.000.000. */
function formatCompactMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return value.toLocaleString('pt-BR');
}

/**
 * BROADCASTING RIGHTS & MEDIA CONGLOMERATES SYSTEM
 *
 * Models fictional sports media conglomerates, TV networks, and streaming broadcasters
 * created exclusively for the Tactical Arena FC / Elifoot Reforged universe.
 */

export type MediaConglomerateId =
  | 'OMNIMEDIA'
  | 'AURA_CORP'
  | 'SKYLINE_MEDIA'
  | 'NOVAPLAY_STUDIOS'
  | 'VERTEX_GLOBAL'
  | 'ZENITH_NETWORK'
  | 'PULSESTREAM';

export type BroadcastTier = 'FREE_TO_AIR' | 'PAY_TV' | 'STREAMING' | 'PPV';

export type BroadcasterLogoKey =
  | 'omnisports'
  | 'aura_tv'
  | 'skyline_sports'
  | 'novaplay'
  | 'vertex_arena'
  | 'zenith_premiere'
  | 'pulse_live';

export interface BroadcasterChannel {
  id: string;
  name: string;
  shortName: string;
  conglomerateId: MediaConglomerateId;
  conglomerateName: string;
  logoKey: BroadcasterLogoKey;
  tier: BroadcastTier;
  brandColor: string;
  accentColor: string;
  textColor: string;
  slogan: string;
  badgeLabel: string;
  facilityFeeBonus: number;
}

export interface MediaConglomerate {
  id: MediaConglomerateId;
  name: string;
  headquarters: string;
  channels: BroadcasterChannel[];
}

export const ALL_BROADCASTER_CHANNELS: Record<BroadcasterLogoKey, BroadcasterChannel> = {
  omnisports: {
    id: 'omnisports-hd',
    name: 'OmniSports HD',
    shortName: 'OmniSports',
    conglomerateId: 'OMNIMEDIA',
    conglomerateName: 'OmniMedia Group',
    logoKey: 'omnisports',
    tier: 'FREE_TO_AIR',
    brandColor: '#0066FF',
    accentColor: '#00F0FF',
    textColor: '#FFFFFF',
    slogan: 'O Mundo do Esporte em Alta Definição',
    badgeLabel: 'AO VIVO • ABERTA',
    facilityFeeBonus: 60_000,
  },
  aura_tv: {
    id: 'aura-tv',
    name: 'Aura TV',
    shortName: 'Aura TV',
    conglomerateId: 'AURA_CORP',
    conglomerateName: 'Aura Broadcast Corp',
    logoKey: 'aura_tv',
    tier: 'FREE_TO_AIR',
    brandColor: '#FF7A00',
    accentColor: '#FFD200',
    textColor: '#111118',
    slogan: 'A Emoção do Futebol Conectada a Você',
    badgeLabel: 'AO VIVO • REDE AURA',
    facilityFeeBonus: 45_000,
  },
  skyline_sports: {
    id: 'skyline-sports-1',
    name: 'SkyLine Sports 1',
    shortName: 'SkyLine',
    conglomerateId: 'SKYLINE_MEDIA',
    conglomerateName: 'SkyLine Media Group',
    logoKey: 'skyline_sports',
    tier: 'PAY_TV',
    brandColor: '#FF1E40',
    accentColor: '#0A1931',
    textColor: '#FFFFFF',
    slogan: 'The Home of Elite Championship Football',
    badgeLabel: 'LIVE • SKYLINE 1',
    facilityFeeBonus: 75_000,
  },
  novaplay: {
    id: 'novaplay-plus',
    name: 'NovaPlay+',
    shortName: 'NovaPlay',
    conglomerateId: 'NOVAPLAY_STUDIOS',
    conglomerateName: 'NovaPlay Studios',
    logoKey: 'novaplay',
    tier: 'STREAMING',
    brandColor: '#8B5CF6',
    accentColor: '#EC4899',
    textColor: '#FFFFFF',
    slogan: 'Transmissão Inteligente com Dados em Tempo Real',
    badgeLabel: 'AO VIVO • NOVAPLAY+',
    facilityFeeBonus: 35_000,
  },
  vertex_arena: {
    id: 'vertex-arena-hd',
    name: 'Vertex Arena HD',
    shortName: 'Vertex',
    conglomerateId: 'VERTEX_GLOBAL',
    conglomerateName: 'Vertex Global Sports',
    logoKey: 'vertex_arena',
    tier: 'PAY_TV',
    brandColor: '#10B981',
    accentColor: '#22C55E',
    textColor: '#0B1510',
    slogan: 'Excelência e Prestígio no Futebol Global',
    badgeLabel: 'LIVE • VERTEX ARENA',
    facilityFeeBonus: 70_000,
  },
  zenith_premiere: {
    id: 'zenith-premiere',
    name: 'Zenith Premiere',
    shortName: 'Zenith',
    conglomerateId: 'ZENITH_NETWORK',
    conglomerateName: 'Zenith TV Network',
    logoKey: 'zenith_premiere',
    tier: 'PPV',
    brandColor: '#F59E0B',
    accentColor: '#D97706',
    textColor: '#0F172A',
    slogan: 'Todos os Jogos da Rodada Onde Você Estiver',
    badgeLabel: 'AO VIVO • PREMIERE',
    facilityFeeBonus: 30_000,
  },
  pulse_live: {
    id: 'pulse-live',
    name: 'Pulse Live',
    shortName: 'Pulse',
    conglomerateId: 'PULSESTREAM',
    conglomerateName: 'PulseStream Entertainment',
    logoKey: 'pulse_live',
    tier: 'STREAMING',
    brandColor: '#EF4444',
    accentColor: '#B91C1C',
    textColor: '#FFFFFF',
    slogan: 'Adrenalina e Paixão a Cada Minuto',
    badgeLabel: 'AO VIVO • PULSE LIVE',
    facilityFeeBonus: 25_000,
  },
};

export const ALL_MEDIA_CONGLOMERATES: MediaConglomerate[] = [
  {
    id: 'OMNIMEDIA',
    name: 'OmniMedia Group',
    headquarters: 'São Paulo / Nova York',
    channels: [ALL_BROADCASTER_CHANNELS.omnisports],
  },
  {
    id: 'AURA_CORP',
    name: 'Aura Broadcast Corp',
    headquarters: 'Rio de Janeiro / Lisboa',
    channels: [ALL_BROADCASTER_CHANNELS.aura_tv],
  },
  {
    id: 'SKYLINE_MEDIA',
    name: 'SkyLine Media Group',
    headquarters: 'Londres',
    channels: [ALL_BROADCASTER_CHANNELS.skyline_sports],
  },
  {
    id: 'NOVAPLAY_STUDIOS',
    name: 'NovaPlay Studios',
    headquarters: 'Madrid / Berlim',
    channels: [ALL_BROADCASTER_CHANNELS.novaplay],
  },
  {
    id: 'VERTEX_GLOBAL',
    name: 'Vertex Global Sports',
    headquarters: 'Paris / Zurique',
    channels: [ALL_BROADCASTER_CHANNELS.vertex_arena],
  },
  {
    id: 'ZENITH_NETWORK',
    name: 'Zenith TV Network',
    headquarters: 'São Paulo',
    channels: [ALL_BROADCASTER_CHANNELS.zenith_premiere],
  },
  {
    id: 'PULSESTREAM',
    name: 'PulseStream Entertainment',
    headquarters: 'Montevidéu / Buenos Aires',
    channels: [ALL_BROADCASTER_CHANNELS.pulse_live],
  },
];

/** Competition to media package mappings */
export interface CompetitionBroadcastPackage {
  primaryBroadcaster: BroadcasterLogoKey;
  secondaryBroadcasters: BroadcasterLogoKey[];
  ppvBroadcaster?: BroadcasterLogoKey;
}

export const COMPETITION_BROADCAST_RIGHTS: Record<string, CompetitionBroadcastPackage> = {
  // Brasil
  BRA: {
    primaryBroadcaster: 'omnisports',
    secondaryBroadcasters: ['aura_tv', 'novaplay'],
    ppvBroadcaster: 'zenith_premiere',
  },
  'copa-do-brasil': {
    primaryBroadcaster: 'omnisports',
    secondaryBroadcasters: ['aura_tv', 'pulse_live'],
    ppvBroadcaster: 'zenith_premiere',
  },
  // Inglaterra
  ENG: {
    primaryBroadcaster: 'skyline_sports',
    secondaryBroadcasters: ['vertex_arena', 'novaplay'],
    ppvBroadcaster: 'zenith_premiere',
  },
  'fa-cup': {
    primaryBroadcaster: 'skyline_sports',
    secondaryBroadcasters: ['pulse_live', 'omnisports'],
  },
  // Espanha
  ESP: {
    primaryBroadcaster: 'vertex_arena',
    secondaryBroadcasters: ['novaplay', 'skyline_sports'],
    ppvBroadcaster: 'zenith_premiere',
  },
  'copa-del-rey': {
    primaryBroadcaster: 'vertex_arena',
    secondaryBroadcasters: ['aura_tv', 'pulse_live'],
  },
  // Continental CONMEBOL
  libertadores: {
    primaryBroadcaster: 'omnisports',
    secondaryBroadcasters: ['aura_tv', 'novaplay', 'pulse_live'],
    ppvBroadcaster: 'zenith_premiere',
  },
  // Continental UEFA
  champions: {
    primaryBroadcaster: 'vertex_arena',
    secondaryBroadcasters: ['skyline_sports', 'novaplay'],
  },
  // Default fallback for any other league or cup
  default: {
    primaryBroadcaster: 'omnisports',
    secondaryBroadcasters: ['aura_tv', 'novaplay', 'pulse_live'],
    ppvBroadcaster: 'zenith_premiere',
  },
};

/**
 * Resolves the designated broadcaster channel for a match based on its competition context,
 * round/stage, and whether it is a high-profile clash (clássico, semifinal, or final).
 */
export function resolveMatchBroadcaster(
  competitionKey: string,
  round: number = 1,
  totalRounds: number = 14,
  isHighProfileMatch: boolean = false,
  seedStr?: string,
): BroadcasterChannel {
  const normalizedKey = competitionKey.toLowerCase();
  const pkg =
    COMPETITION_BROADCAST_RIGHTS[competitionKey] ??
    COMPETITION_BROADCAST_RIGHTS[normalizedKey] ??
    (normalizedKey.includes('libertador')
      ? COMPETITION_BROADCAST_RIGHTS.libertadores
      : normalizedKey.includes('copa do brasil') || normalizedKey.includes('brasil')
        ? COMPETITION_BROADCAST_RIGHTS['copa-do-brasil']
        : normalizedKey.includes('fa cup')
          ? COMPETITION_BROADCAST_RIGHTS['fa-cup']
          : normalizedKey.includes('copa del rey')
            ? COMPETITION_BROADCAST_RIGHTS['copa-del-rey']
            : normalizedKey.includes('champion')
              ? COMPETITION_BROADCAST_RIGHTS.champions
              : COMPETITION_BROADCAST_RIGHTS.default);

  // Finals or decisive penultimate rounds and high profile matches get the primary flagship broadcaster
  const isFinalOrDecisive = round >= totalRounds - 1;
  if (isFinalOrDecisive || isHighProfileMatch) {
    return ALL_BROADCASTER_CHANNELS[pkg.primaryBroadcaster];
  }

  // Deterministic rotation based on seedStr / round so matches in the round feel broadcasted across multiple networks
  const hash = (seedStr ?? `${competitionKey}-${round}`).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const options = [pkg.primaryBroadcaster, ...pkg.secondaryBroadcasters, ...(pkg.ppvBroadcaster ? [pkg.ppvBroadcaster] : [])];

  const selectedKey = options[hash % options.length] ?? pkg.primaryBroadcaster;
  return ALL_BROADCASTER_CHANNELS[selectedKey];
}

/**
 * SEASON BROADCAST FINANCIAL TARGETS
 * Performance bonuses established by media partners for audience metrics and table positions.
 */
export interface BroadcastTarget {
  id: string;
  title: string;
  description: string;
  targetType: 'LEAGUE_TOP_4' | 'LEAGUE_CHAMPION' | 'CUP_FINAL' | 'OPEN_BROADCAST_WINS' | 'GOALS_SCORED';
  reward: number;
  targetValue: number;
  currentValue: number;
  isCompleted: boolean;
  broadcasterName: string;
  broadcasterLogoKey: BroadcasterLogoKey;
}

/**
 * Generates custom broadcast financial goals for a season, scaled by the club's visibility score and division.
 */
export function generateSeasonBroadcastTargets(visibilityScore: number = 50, division: number = 1): BroadcastTarget[] {
  const scale = (visibilityScore / 50) * (division === 1 ? 1.0 : 0.5);
  return [
    {
      id: 'target-top4',
      title: 'Meta de Audiência: G-4 da Liga',
      description: 'Termine a temporada entre os 4 primeiros colocados para garantir o bônus de grade premium.',
      targetType: 'LEAGUE_TOP_4',
      reward: Math.round(500_000 * scale),
      targetValue: 4,
      currentValue: 0,
      isCompleted: false,
      broadcasterName: 'OmniSports HD',
      broadcasterLogoKey: 'omnisports',
    },
    {
      id: 'target-open-wins',
      title: 'Destaque no Horário Nobre',
      description: 'Vença pelo menos 4 partidas televisionadas em sinal aberto ou pay-tv nesta temporada.',
      targetType: 'OPEN_BROADCAST_WINS',
      reward: Math.round(300_000 * scale),
      targetValue: 4,
      currentValue: 0,
      isCompleted: false,
      broadcasterName: 'SkyLine Sports 1',
      broadcasterLogoKey: 'skyline_sports',
    },
    {
      id: 'target-cup-run',
      title: 'Projeção Nacional: Final de Copa',
      description: 'Alcance a grande final da copa nacional para destravar o bônus máximo de transmissão.',
      targetType: 'CUP_FINAL',
      reward: Math.round(750_000 * scale),
      targetValue: 1,
      currentValue: 0,
      isCompleted: false,
      broadcasterName: 'Vertex Arena HD',
      broadcasterLogoKey: 'vertex_arena',
    },
  ];
}

/**
 * Calculates the exact facility fee payout for a club participating in a televised match.
 * Open / Pay-TV broadcasters pay 65% to the home team (host facility/attendance) and 35% to away team.
 * Streaming / PPV split 50/50.
 */
export function calculateMatchBroadcastPayout(broadcaster: BroadcasterChannel, isHome: boolean): number {
  if (!broadcaster.facilityFeeBonus || broadcaster.facilityFeeBonus <= 0) return 0;
  if (broadcaster.tier === 'FREE_TO_AIR' || broadcaster.tier === 'PAY_TV') {
    const share = isHome ? 0.65 : 0.35;
    return Math.round(broadcaster.facilityFeeBonus * share);
  }
  return Math.round(broadcaster.facilityFeeBonus * 0.5);
}

export interface BroadcastEvaluationContext {
  leaguePosition?: number | null;
  totalClubsInLeague?: number;
  isChampion?: boolean;
  isCupFinalist?: boolean;
  openBroadcastWins?: number;
  totalGoalsScored?: number;
}

/**
 * Evaluates performance against media conglomerate targets at season end.
 */
export function evaluateBroadcastTargets(
  targets: BroadcastTarget[],
  context: BroadcastEvaluationContext,
): { updatedTargets: BroadcastTarget[]; totalRewardEarned: number } {
  let totalRewardEarned = 0;

  const updatedTargets = targets.map((target) => {
    if (target.isCompleted) return target;

    let isCompleted = false;
    let currentValue = target.currentValue;

    switch (target.targetType) {
      case 'LEAGUE_TOP_4':
        if (typeof context.leaguePosition === 'number') {
          currentValue = context.leaguePosition;
          isCompleted = context.leaguePosition <= 4 && context.leaguePosition > 0;
        }
        break;

      case 'LEAGUE_CHAMPION':
        if (typeof context.isChampion === 'boolean') {
          currentValue = context.isChampion ? 1 : 0;
          isCompleted = context.isChampion;
        }
        break;

      case 'CUP_FINAL':
        if (typeof context.isCupFinalist === 'boolean') {
          currentValue = context.isCupFinalist ? 1 : 0;
          isCompleted = context.isCupFinalist;
        }
        break;

      case 'OPEN_BROADCAST_WINS':
        if (typeof context.openBroadcastWins === 'number') {
          currentValue = context.openBroadcastWins;
          isCompleted = context.openBroadcastWins >= target.targetValue;
        }
        break;

      case 'GOALS_SCORED':
        if (typeof context.totalGoalsScored === 'number') {
          currentValue = context.totalGoalsScored;
          isCompleted = context.totalGoalsScored >= target.targetValue;
        }
        break;
    }

    if (isCompleted && !target.isCompleted) {
      totalRewardEarned += target.reward;
      return { ...target, isCompleted: true, currentValue };
    }

    return { ...target, currentValue };
  });

  return { updatedTargets, totalRewardEarned };
}


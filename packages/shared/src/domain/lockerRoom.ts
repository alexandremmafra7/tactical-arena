import type { Player } from './player.js';

export type HierarchyTier = 'TEAM_LEADER' | 'HIGHLY_INFLUENTIAL' | 'INFLUENTIAL' | 'GENERAL_SQUAD';
export type SocialGroup = 'CORE_VETERANS' | 'ACADEMY_PROSPECTS' | 'FOREIGN_PLAYERS' | 'GENERAL_GROUP';
export type TeamTalkTone = 'CALM' | 'PASSIONATE' | 'DEMANDING' | 'ENCOURAGING';
export type TeamTalkContext = 'PRE_MATCH' | 'HALF_TIME' | 'POST_MATCH';

export interface PlayerHierarchyEntry {
  playerId: string;
  playerName: string;
  position: string;
  overall: number;
  age: number;
  tier: HierarchyTier;
  socialGroup: SocialGroup;
  leadershipScore: number;
  happiness: number;
  concern?: string | null;
}

export interface LockerRoomState {
  squadCohesion: number;
  managerSupport: number;
  atmosphere: 'EXCELLENT' | 'GOOD' | 'NORMAL' | 'DISRUPTED' | 'CRITICAL';
  hierarchy: PlayerHierarchyEntry[];
  recentIncidents: string[];
}

export interface TeamTalkOption {
  id: string;
  label: string;
  tone: TeamTalkTone;
  expectedImpact: string;
}

export interface TeamTalkResult {
  message: string;
  moraleModifiers: Record<string, number>;
  overallReaction: 'INSPIRED' | 'FOCUSED' | 'INDIFFERENT' | 'PRESSURE_OVERWHELMED';
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function computeLeadershipScore(player: Player, tenureWeeks: number, isCaptain: boolean): number {
  const ageBonus = player.age >= 29 ? 15 : player.age >= 25 ? 8 : 0;
  const personalityBonus = player.traits.includes('LEADER') ? 20 : player.traits.includes('DETERMINED') ? 10 : 0;
  const score = Math.max(0, tenureWeeks) * 0.5 + player.overall * 0.4 + ageBonus + personalityBonus + (isCaptain ? 25 : 0);
  return Math.round(Math.max(0, score) * 10) / 10;
}

function modalNationality(squad: Player[]): string | undefined {
  const counts = new Map<string, number>();
  for (const player of squad) counts.set(player.nationality, (counts.get(player.nationality) ?? 0) + 1);
  return [...counts].sort(([countryA, countA], [countryB, countB]) => countB - countA || countryA.localeCompare(countryB))[0]?.[0];
}

function socialGroup(player: Player, tenureWeeks: number, modalCountry?: string): SocialGroup {
  if (player.age >= 29 || tenureWeeks >= 104) return 'CORE_VETERANS';
  if (player.age <= 21) return 'ACADEMY_PROSPECTS';
  if (modalCountry && player.nationality !== modalCountry) return 'FOREIGN_PLAYERS';
  return 'GENERAL_GROUP';
}

function average(values: number[], fallback: number): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : fallback;
}

function managerSupport(hierarchy: PlayerHierarchyEntry[]): number {
  if (!hierarchy.length) return 50;
  const all = average(hierarchy.map((entry) => entry.happiness), 50);
  const leaders = average(hierarchy.filter((entry) => entry.tier === 'TEAM_LEADER').map((entry) => entry.happiness), all);
  const highlyInfluential = average(hierarchy.filter((entry) => entry.tier === 'HIGHLY_INFLUENTIAL').map((entry) => entry.happiness), all);
  const others = average(hierarchy.filter((entry) => entry.tier !== 'TEAM_LEADER' && entry.tier !== 'HIGHLY_INFLUENTIAL').map((entry) => entry.happiness), all);
  return clamp(Math.round(leaders * 0.45 + highlyInfluential * 0.35 + others * 0.2), 0, 100);
}

function atmosphere(cohesion: number, support: number): LockerRoomState['atmosphere'] {
  const score = (cohesion + support) / 2;
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'NORMAL';
  if (score >= 30) return 'DISRUPTED';
  return 'CRITICAL';
}

function buildHierarchy(
  squad: Player[],
  clubTenureMap: Record<string, number> = {},
  captainId?: string,
): PlayerHierarchyEntry[] {
  const modalCountry = modalNationality(squad);
  return squad.map((player) => ({
    player,
    leadershipScore: computeLeadershipScore(player, clubTenureMap[player.id] ?? 0, player.id === captainId),
  })).sort((a, b) => b.leadershipScore - a.leadershipScore || b.player.overall - a.player.overall || a.player.id.localeCompare(b.player.id))
    .map(({ player, leadershipScore }, index): PlayerHierarchyEntry => {
      const tier: HierarchyTier = index < 2 && leadershipScore >= 70
        ? 'TEAM_LEADER'
        : index >= 2 && index <= 4 && (leadershipScore >= 50 || player.overall >= 78)
          ? 'HIGHLY_INFLUENTIAL'
          : leadershipScore >= 30 ? 'INFLUENTIAL' : 'GENERAL_SQUAD';
      const happiness = clamp(Math.round((player.morale + player.commitment) / 2), 0, 100);
      return {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        overall: player.overall,
        age: player.age,
        tier,
        socialGroup: socialGroup(player, clubTenureMap[player.id] ?? 0, modalCountry),
        leadershipScore,
        happiness,
        concern: player.commitment < 50 ? 'Insatisfeito com poucos minutos em campo' : null,
      };
    });
}

export function computeLockerRoomHierarchy(
  squad: Player[],
  clubTenureMap: Record<string, number> = {},
  captainId?: string,
): LockerRoomState {
  const hierarchy = buildHierarchy(squad, clubTenureMap, captainId);
  const support = managerSupport(hierarchy);
  const cohesion = calculateSquadCohesion(squad, [], hierarchy.filter((entry) => entry.concern).length);
  return {
    squadCohesion: cohesion,
    managerSupport: support,
    atmosphere: atmosphere(cohesion, support),
    hierarchy,
    recentIncidents: hierarchy.filter((entry) => entry.concern).map((entry) => `${entry.playerName}: ${entry.concern}`),
  };
}

export function calculateSquadCohesion(
  squad: Player[],
  recentResults: ('W' | 'D' | 'L')[],
  activeConcernsCount: number,
): number {
  let cohesion = 70;
  for (const result of recentResults.slice(0, 5)) cohesion += result === 'W' ? 3 : result === 'L' ? -4 : 0;

  const concerns = buildHierarchy(squad)
    .filter((entry) => entry.happiness < 50)
    .slice(0, Math.max(0, activeConcernsCount));
  for (const concern of concerns) {
    cohesion -= concern.tier === 'TEAM_LEADER' ? 8 : concern.tier === 'HIGHLY_INFLUENTIAL' ? 4 : 2;
  }
  cohesion -= Math.max(0, activeConcernsCount - concerns.length) * 2;
  return clamp(Math.round(cohesion), 10, 100);
}

const TEAM_TALK_COPY: Record<TeamTalkTone, { label: string; expectedImpact: string }> = {
  CALM: { label: 'Manter a calma', expectedImpact: 'Reduz a pressão e ajuda jovens ou atletas abalados.' },
  PASSIONATE: { label: 'Falar com paixão', expectedImpact: 'Inspira líderes e personalidades intensas.' },
  DEMANDING: { label: 'Cobrar mais', expectedImpact: 'Funciona melhor com apoio forte ao treinador.' },
  ENCOURAGING: { label: 'Encorajar o grupo', expectedImpact: 'Ajuda especialmente quando a equipe está atrás.' },
};

export function getAvailableTeamTalks(
  context: TeamTalkContext,
  scoreDifferential: number,
  isDerbyOrFinal: boolean,
): TeamTalkOption[] {
  const circumstance = isDerbyOrFinal ? ' Jogo de alta pressão.' : scoreDifferential < 0 ? ' A equipe precisa reagir.' : '';
  return (['CALM', 'PASSIONATE', 'DEMANDING', 'ENCOURAGING'] as const).map((tone) => ({
    id: `${context}:${tone}`,
    tone,
    label: TEAM_TALK_COPY[tone].label,
    expectedImpact: `${TEAM_TALK_COPY[tone].expectedImpact}${circumstance}`,
  }));
}

export function getRecommendedTeamTalk(
  context: TeamTalkContext,
  scoreDifferential = 0,
  isDerbyOrFinal = false,
): TeamTalkOption {
  const available = getAvailableTeamTalks(context, scoreDifferential, isDerbyOrFinal);
  let targetTone: TeamTalkTone = 'ENCOURAGING';
  if (isDerbyOrFinal) {
    targetTone = 'CALM';
  } else if (scoreDifferential < 0) {
    targetTone = 'ENCOURAGING';
  } else if (scoreDifferential > 0) {
    targetTone = 'CALM';
  } else {
    targetTone = context === 'PRE_MATCH' ? 'ENCOURAGING' : 'CALM';
  }
  return available.find((opt) => opt.tone === targetTone) ?? available[0];
}

export function applyTeamTalk(
  squad: Player[],
  selectedOption: TeamTalkOption,
  context: TeamTalkContext,
  scoreDifferential: number,
  rng: () => number,
): TeamTalkResult {
  if (selectedOption.id !== `${context}:${selectedOption.tone}`) throw new Error('Preleção inválida para este contexto');
  const support = average(squad.map((player) => player.commitment), 50);
  const moraleModifiers = Object.fromEntries(squad.map((player) => {
    let delta: number;
    switch (selectedOption.tone) {
      case 'PASSIONATE':
        delta = player.traits.some((trait) => trait === 'AGGRESSIVE' || trait === 'DETERMINED' || trait === 'LEADER') ? 8 : 4;
        break;
      case 'CALM':
        delta = player.age <= 22 || player.morale < 50 ? 6 : 2;
        break;
      case 'DEMANDING':
        delta = support < 50 ? -6 : scoreDifferential >= 0 && support >= 60 ? 10 : 0;
        break;
      case 'ENCOURAGING':
        delta = scoreDifferential < 0 ? 8 : 3;
        break;
    }
    return [player.id, clamp(delta, -10, 15)];
  }));
  const values = Object.values(moraleModifiers);
  const mean = average(values, 0);
  const roll = rng();
  const overallReaction: TeamTalkResult['overallReaction'] = mean > 0
    ? (roll < 0.35 ? 'INSPIRED' : 'FOCUSED')
    : mean < 0 ? 'PRESSURE_OVERWHELMED' : 'INDIFFERENT';
  const messages: Record<TeamTalkResult['overallReaction'], string> = {
    INSPIRED: 'O elenco saiu inspirado da preleção.',
    FOCUSED: 'O elenco recebeu a mensagem e está focado.',
    INDIFFERENT: 'A preleção não mudou o clima do elenco.',
    PRESSURE_OVERWHELMED: 'A pressão da preleção pesou sobre o elenco.',
  };
  return { message: messages[overallReaction], moraleModifiers, overallReaction };
}

export type LockerRoomEventType =
  | 'INJURY'
  | 'RECOVERY'
  | 'GOOD_PERFORMANCE'
  | 'BAD_PERFORMANCE'
  | 'TRANSFER_RUMOR'
  | 'CONTRACT_TALK'
  | 'LEADERSHIP_CONFLICT'
  | 'LEADERSHIP_RALLY'
  | 'TEAM_BONDING'
  | 'DISCIPLINARY_ISSUE';

export interface LockerRoomEvent {
  id: string;
  type: LockerRoomEventType;
  description: string;
  affectedPlayers: string[]; // player IDs
  impact: {
    moraleChange: number; // -20 to +20
    cohesionChange: number; // -10 to +10
    hierarchyImpact: Record<string, number>; // playerId -> leadershipScore change
  };
  timestamp: number;
}

export function generateLockerRoomEvents(
  squad: Player[],
  recentResults: ('W' | 'D' | 'L')[],
  appearancesMap: Record<string, number>,
  injuries: string[], // player IDs
  transferRumors: string[], // player IDs
  rng: () => number,
  currentTime: number = Date.now(),
  captainId?: string,
): LockerRoomEvent[] {
  const events: LockerRoomEvent[] = [];

  // Injury events
  for (const playerId of injuries) {
    const player = squad.find(p => p.id === playerId);
    if (player) {
      events.push({
        id: `${playerId}-injury-${currentTime}`,
        type: 'INJURY',
        description: `${player.name} sofreu uma lesão e estará fora dos próximos jogos.`,
        affectedPlayers: [playerId],
        impact: {
          moraleChange: -15,
          cohesionChange: -8,
          hierarchyImpact: { [playerId]: -10 }
        },
        timestamp: currentTime
      });
    }
  }

  // Performance-based events
  for (const player of squad) {
    const appearances = appearancesMap[player.id] ?? 0;
    if (appearances >= 3) { // Played in recent games
      // Simulate performance based on recent form (simplified)
      const recentForm = rng(); // 0-1
      if (recentForm > 0.7) {
        events.push({
          id: `${player.id}-good-perf-${currentTime}`,
          type: 'GOOD_PERFORMANCE',
          description: `${player.name} teve uma ótima atuação nos últimos treinamentos.`,
          affectedPlayers: [player.id],
          impact: {
            moraleChange: 8,
            cohesionChange: 3,
            hierarchyImpact: { [player.id]: 5 }
          },
          timestamp: currentTime
        });
      } else if (recentForm < 0.3) {
        events.push({
          id: `${player.id}-bad-perf-${currentTime}`,
          type: 'BAD_PERFORMANCE',
          description: `${player.name} está tendo dificuldades nos treinamentos recentes.`,
          affectedPlayers: [player.id],
          impact: {
            moraleChange: -10,
            cohesionChange: -5,
            hierarchyImpact: { [player.id]: -8 }
          },
          timestamp: currentTime
        });
      }
    }
  }

  // Transfer rumor events
  for (const playerId of transferRumors) {
    const player = squad.find(p => p.id === playerId);
    if (player && rng() > 0.5) { // 50% chance of rumor causing unrest
      events.push({
        id: `${playerId}-transfer-rumor-${currentTime}`,
        type: 'TRANSFER_RUMOR',
        description: `${player.name} está sendo vinculado a uma transferência para outro clube.`,
        affectedPlayers: [playerId],
        impact: {
          moraleChange: -12,
          cohesionChange: -6,
          hierarchyImpact: { [playerId]: -15 }
        },
        timestamp: currentTime
      });
    }
  }

  // Team bonding events based on recent results
  const recentFormScore = recentResults.slice(0, 3).reduce((score, result) => {
    return score + (result === 'W' ? 1 : result === 'D' ? 0 : -1);
  }, 0);

  if (recentFormScore >= 2) { // Good recent form
    events.push({
      id: `team-bonding-${currentTime}`,
      type: 'TEAM_BONDING',
      description: 'O elenco está unido após uma sequência de bons resultados.',
      affectedPlayers: squad.map(p => p.id),
      impact: {
        moraleChange: 10,
        cohesionChange: 15,
        hierarchyImpact: {} // No specific hierarchy impact
      },
      timestamp: currentTime
    });
  } else if (recentFormScore <= -2) { // Poor recent form
    const leadersWithTrait = squad.filter((p) => p.traits?.includes('LEADER') || p.id === captainId);
    if (leadersWithTrait.length > 0) {
      // Tarefa 3.4: Grito de Guerra & Intervenção de Líder
      const leaderName = leadersWithTrait[0].name;
      events.push({
        id: `leadership-rally-${currentTime}`,
        type: 'LEADERSHIP_RALLY',
        description: `${leaderName} reuniu o elenco em um grito de guerra, blindando o vestiário contra a sequência negativa.`,
        affectedPlayers: squad.map((p) => p.id),
        impact: {
          moraleChange: -5, // Amortece a perda de moral em ~65% (de -15 para -5)
          cohesionChange: 6, // Transforma desunião em coesão de reação (+6 em vez de -12)
          hierarchyImpact: Object.fromEntries(
            leadersWithTrait.map((p) => [p.id, 8]),
          ),
        },
        timestamp: currentTime,
      });
    } else {
      events.push({
        id: `team-conflict-${currentTime}`,
        type: 'LEADERSHIP_CONFLICT',
        description: 'Tensões estão surgindo no elenco devido aos resultados ruins.',
        affectedPlayers: squad
          .sort((a, b) => (computeLeadershipScore(b, 0, false) || 0) - (computeLeadershipScore(a, 0, false) || 0))
          .slice(0, 3) // Top 3 leaders
          .map((p) => p.id),
        impact: {
          moraleChange: -15,
          cohesionChange: -12,
          hierarchyImpact: Object.fromEntries(
            squad
              .sort((a, b) => (computeLeadershipScore(b, 0, false) || 0) - (computeLeadershipScore(a, 0, false) || 0))
              .slice(0, 3)
              .map((p) => [p.id, -10]),
          ),
        },
        timestamp: currentTime,
      });
    }
  }

  // Disciplinary issues (low commitment players)
  const lowCommitmentPlayers = squad.filter(p => p.commitment < 40);
  for (const player of lowCommitmentPlayers) {
    if (rng() > 0.7) { // 30% chance of disciplinary issue
      events.push({
        id: `${player.id}-disciplinary-${currentTime}`,
        type: 'DISCIPLINARY_ISSUE',
        description: `${player.name} teve um incidente de disciplina nos treinamentos.`,
        affectedPlayers: [player.id],
        impact: {
          moraleChange: -8,
          cohesionChange: -5,
          hierarchyImpact: { [player.id]: -12 }
        },
        timestamp: currentTime
      });
    }
  }

  return events;
}

export function applyLockerRoomEvents(
  state: LockerRoomState,
  events: LockerRoomEvent[],
  squad: Player[],
  clubTenureMap: Record<string, number> = {},
  captainId?: string,
): { updatedState: LockerRoomState; updatedSquad: Player[] } {
  // Start with current state
  let updatedState = { ...state };
  let updatedSquad = [...squad];

  // Apply each event's impact
  for (const event of events) {
    // Update morale and commitment for affected players
    updatedSquad = updatedSquad.map(player => {
      if (event.affectedPlayers.includes(player.id)) {
        const moraleChange = event.impact.moraleChange;
        const commitmentChange = event.impact.moraleChange * 0.7; // Commitment changes less than morale

        return {
          ...player,
          morale: clamp(player.morale + moraleChange, 0, 100),
          commitment: clamp(player.commitment + commitmentChange, 0, 100)
        };
      }
      return player;
    });

    // Update squad cohesion
    updatedState.squadCohesion = clamp(
      updatedState.squadCohesion + event.impact.cohesionChange,
      0,
      100
    );

    // Update manager support based on happiness of leaders
    const leaderHappiness = average(
      updatedState.hierarchy
        .filter(entry => entry.tier === 'TEAM_LEADER' || entry.tier === 'HIGHLY_INFLUENTIAL')
        .map(entry => {
          const player = updatedSquad.find(p => p.id === entry.playerId);
          return player ? clamp((player.morale + player.commitment) / 2, 0, 100) : 50;
        }),
      50
    );
    updatedState.managerSupport = clamp(Math.round(leaderHappiness * 0.45 + 50 * 0.55), 0, 100);

    // Update atmosphere
    updatedState.atmosphere = atmosphere(updatedState.squadCohesion, updatedState.managerSupport);

    // Add to recent incidents (keep only last 5)
    if (event.description) {
      updatedState.recentIncidents = [
        ...updatedState.recentIncidents.slice(0, 4), // Keep last 4
        event.description
      ];
    }
  }

  // Rebuild hierarchy with updated player states
  updatedState.hierarchy = buildHierarchy(
    updatedSquad,
    clubTenureMap,
    captainId,
  );

  // Combine event descriptions with hierarchy concerns (keep up to 5)
  const concernIncidents = updatedState.hierarchy
    .filter(entry => entry.concern)
    .map(entry => `${entry.playerName}: ${entry.concern}`);
  updatedState.recentIncidents = [
    ...concernIncidents,
    ...updatedState.recentIncidents,
  ].slice(0, 5);

  return { updatedState, updatedSquad };
}

export function updateLockerRoom(
  squad: Player[],
  clubTenureMap: Record<string, number> = {},
  captainId?: string,
  recentResults: ('W' | 'D' | 'L')[] = [],
  appearancesMap: Record<string, number> = {},
  injuries: string[] = [],
  transferRumors: string[] = [],
  rng: () => number = Math.random,
  currentTime: number = Date.now()
): LockerRoomState {
  // Generate events based on current conditions
  const events = generateLockerRoomEvents(
    squad,
    recentResults,
    appearancesMap,
    injuries,
    transferRumors,
    rng,
    currentTime,
    captainId,
  );

  // Get initial state
  const initialState = computeLockerRoomHierarchy(squad, clubTenureMap, captainId);

  // Apply events to get final state
  const { updatedState } = applyLockerRoomEvents(initialState, events, squad, clubTenureMap, captainId);

  return updatedState;
}

export function evaluateSquadHappinessTick(
  squad: Player[],
  appearancesMap: Record<string, number>,
): { updatedSquad: Player[]; incidents: string[] } {
  const incidents: string[] = [];
  const updatedSquad = squad.map((player) => {
    const appearances = appearancesMap[player.id] ?? 0;
    const penalty = appearances === 0 ? 6 : appearances === 1 ? 3 : 0;
    const updated = {
      ...player,
      morale: clamp(player.morale - penalty, 0, 100),
      commitment: clamp(player.commitment - penalty, 0, 100),
    };
    if (updated.overall >= 78 && updated.commitment < 50) incidents.push(`${updated.name} está insatisfeito com poucos minutos em campo.`);
    return updated;
  });
  return { updatedSquad, incidents };
}

export interface SocialGroupSummary {
  group: SocialGroup;
  label: string;
  members: PlayerHierarchyEntry[];
  averageHappiness: number;
  unsatisfiedCount: number;
}

export const SOCIAL_GROUP_LABELS: Record<SocialGroup, string> = {
  CORE_VETERANS: 'Núcleo de Veteranos',
  ACADEMY_PROSPECTS: 'Jovens da Base',
  FOREIGN_PLAYERS: 'Legião Estrangeira',
  GENERAL_GROUP: 'Grupo Principal',
};

export function computeSocialGroupsSummary(hierarchy: PlayerHierarchyEntry[]): SocialGroupSummary[] {
  const groups: SocialGroup[] = ['CORE_VETERANS', 'ACADEMY_PROSPECTS', 'FOREIGN_PLAYERS', 'GENERAL_GROUP'];

  return groups.map((group) => {
    const members = hierarchy.filter((entry) => entry.socialGroup === group);
    const averageHappiness = members.length
      ? Math.round(members.reduce((sum, m) => sum + m.happiness, 0) / members.length)
      : 0;
    const unsatisfiedCount = members.filter((m) => Boolean(m.concern)).length;

    return {
      group,
      label: SOCIAL_GROUP_LABELS[group],
      members,
      averageHappiness,
      unsatisfiedCount,
    };
  });
}

export type MediationApproach = 'DIPLOMATIC' | 'DEMAND_COMMITMENT' | 'CAPTAIN_MEDIATION';

export interface MediationResult {
  updatedSquad: Player[];
  success: boolean;
  message: string;
  resolvedConcern: boolean;
  targetPlayerName: string;
  leaderPlayerName: string;
  moraleChange: number;
  commitmentChange: number;
}

export function resolvePlayerConcernWithLeader(
  squad: Player[],
  targetPlayerId: string,
  leaderPlayerId: string,
  approach: MediationApproach,
): MediationResult {
  const target = squad.find((p) => p.id === targetPlayerId);
  const leader = squad.find((p) => p.id === leaderPlayerId);

  if (!target) {
    return {
      updatedSquad: squad,
      success: false,
      message: 'Jogador insatisfeito não encontrado no elenco.',
      resolvedConcern: false,
      targetPlayerName: '',
      leaderPlayerName: leader?.name ?? '',
      moraleChange: 0,
      commitmentChange: 0,
    };
  }

  const leaderName = leader?.name ?? 'Líder do Elenco';
  const targetName = target.name;

  let moraleDelta = 0;
  let commitmentDelta = 0;
  let message = '';
  let success = true;

  // Liderança avaliada por trait LEADER, overall ou pontuação de liderança
  const leaderScore = leader ? computeLeadershipScore(leader, 0, false) : 0;
  const isInfluentialLeader = Boolean(
    leader && (leader.traits.includes('LEADER') || leaderScore >= 65 || leader.overall >= 78),
  );

  switch (approach) {
    case 'CAPTAIN_MEDIATION': {
      if (isInfluentialLeader) {
        commitmentDelta = 15;
        moraleDelta = 10;
        message = `${leaderName} reuniu-se reservadamente com ${targetName}. Com a autoridade de líder, convenceu o atleta da sua importância para o grupo, renovando seu compromisso.`;
      } else {
        commitmentDelta = 6;
        moraleDelta = 4;
        message = `${leaderName} tentou interceder junto a ${targetName}, mas sua liderança limitada gerou apenas um efeito modesto no vestiário.`;
      }
      break;
    }
    case 'DIPLOMATIC': {
      commitmentDelta = 12;
      moraleDelta = 8;
      message = `A comissão técnica teve uma conversa diplomática com ${targetName}, garantindo oportunidades futuras. O jogador aceitou os termos e recuperou a motivação.`;
      break;
    }
    case 'DEMAND_COMMITMENT': {
      if (isInfluentialLeader || target.traits.includes('DETERMINED')) {
        commitmentDelta = 15;
        moraleDelta = 0;
        message = `A cobrança por postura profissional surtiu efeito: ${targetName} aceitou o desafio e prometeu dedicação máxima aos treinamentos.`;
      } else {
        commitmentDelta = -5;
        moraleDelta = -10;
        success = false;
        message = `A cobrança dura sobre ${targetName} gerou atrito. O jogador sentiu-se injustiçado pela comissão técnica e liderança.`;
      }
      break;
    }
  }

  const updatedSquad = squad.map((p) => {
    if (p.id !== targetPlayerId) return p;
    // Se a intervenção do capitão influente foi bem-sucedida, garante que o compromisso atinja ao menos 50 para limpar o concern
    const baseNewCommitment = clamp(p.commitment + commitmentDelta, 0, 100);
    const finalCommitment = (approach === 'CAPTAIN_MEDIATION' && isInfluentialLeader) || (approach === 'DIPLOMATIC' && baseNewCommitment >= 45)
      ? Math.max(50, baseNewCommitment)
      : baseNewCommitment;

    return {
      ...p,
      morale: clamp(p.morale + moraleDelta, 0, 100),
      commitment: finalCommitment,
    };
  });

  const updatedTarget = updatedSquad.find((p) => p.id === targetPlayerId)!;
  const resolvedConcern = updatedTarget.commitment >= 50;

  return {
    updatedSquad,
    success,
    message,
    resolvedConcern,
    targetPlayerName: targetName,
    leaderPlayerName: leaderName,
    moraleChange: moraleDelta,
    commitmentChange: commitmentDelta,
  };
}

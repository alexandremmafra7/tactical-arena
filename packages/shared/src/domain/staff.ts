import type { Club } from './club.js';
import type { TrainingFocus } from './player.js';
import { autoFillLineup } from './lineupAutofill.js';
import { createRng } from '../simulation/rng.js';
import type { AttackApproach, AttackStyle, Formation, MarkingStyle, Mentality, PressingIntensity, Tactic } from './tactic.js';
import { MENTALITY_LABEL } from './tactic.js';
import { applyTacticalAdviceStyleBonus, type ManagerStyleId } from './managerStyle.js';

export type StaffRole =
  | 'TACTICAL_ASSISTANT'
  | 'FOOTBALL_DIRECTOR'
  | 'FITNESS_COACH'
  | 'YOUTH_COORDINATOR'
  | 'FINANCIAL_DIRECTOR';

export type StaffTier = 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE';

export type StaffRecommendationType =
  | 'TACTIC_PATTERN'
  | 'TRANSFER_VALUATION'
  | 'YOUTH_PROMOTION'
  | 'INJURY_WARNING';

export interface StaffRecordEntry {
  id: string;
  staffId: string;
  staffName: string;
  role: StaffRole;
  rating: number;
  dateString: string;
  recommendationType: StaffRecommendationType;
  details: string;
  status: 'PENDING' | 'CORRECT' | 'INCORRECT';
  playerId?: string;
  evaluatedAt?: string;
  metaJson?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  tier: StaffTier;
  rating: number; // 50 to 99
  /** What this one is good at, as text for the player to read. */
  specialty: string;
  /** The same specialty, as something the game can act on. Absent on staff hired before keys existed —
   *  read it through `specialtyKeyOf`, which recovers the key from the label. */
  specialtyKey?: StaffSpecialtyKey;
  description: string;
  wage: number; // Weekly wage
  minClubVisibility: number; // 0 to 100
  minCareerTitles: number; // Titles needed in manager career to hire
  avatar: string;
  nationality: string;
}

export interface StaffRoleInfo {
  role: StaffRole;
  title: string;
  icon: string;
  department: string;
  benefitDescription: string;
}

export const STAFF_ROLES_INFO: Record<StaffRole, StaffRoleInfo> = {
  TACTICAL_ASSISTANT: {
    role: 'TACTICAL_ASSISTANT',
    title: 'Auxiliar Tático e Estratégia',
    icon: 'tactics',
    department: 'Comissão de Campo',
    benefitDescription: 'Otimiza escalações automáticas, sugere substituições cirúrgicas e adaptações dinâmicas a lesões/expulsões ao vivo.',
  },
  FOOTBALL_DIRECTOR: {
    role: 'FOOTBALL_DIRECTOR',
    title: 'Diretor de Futebol e Scouting',
    icon: 'director',
    department: 'Departamento de Futebol',
    benefitDescription: 'Consegue descontos em contratações (5% a 20%), descobre pechinchas no mercado e comanda a blindagem de multas rescisórias.',
  },
  FITNESS_COACH: {
    role: 'FITNESS_COACH',
    title: 'Preparador Físico e Fisiologista',
    icon: 'fitness',
    department: 'Saúde e Fisiologia',
    benefitDescription: 'Acelera a recuperação de estamina entre jogos (+15% a +40%) e reduz o risco de lesões musculares nas partidas.',
  },
  YOUTH_COORDINATOR: {
    role: 'YOUTH_COORDINATOR',
    title: 'Coordenador da Base',
    icon: 'youth',
    department: 'Categorias de Base',
    benefitDescription: 'Acelera o desenvolvimento de jovens talentos (+20% a +50%) e atrai promessas com maior potencial de evolução.',
  },
  FINANCIAL_DIRECTOR: {
    role: 'FINANCIAL_DIRECTOR',
    title: 'Diretor Financeiro e Negócios',
    icon: 'finance',
    department: 'Diretoria Executiva',
    benefitDescription: 'Maximiza receitas de patrocínio (+5% a +20%), reduz juros de empréstimos e viabiliza maiores garantias bancárias e fundos de craque.',
  },
};

export const STAFF_TIER_CONFIG: Record<StaffTier, { minRating: number; maxRating: number; baseWage: number; minVis: number; minTitles: number; label: string; badgeColor: string }> = {
  BRONZE: {
    minRating: 55,
    maxRating: 68,
    baseWage: 4_000,
    minVis: 0,
    minTitles: 0,
    label: 'Iniciante / Regional',
    badgeColor: '#cd7f32',
  },
  PRATA: {
    minRating: 69,
    maxRating: 78,
    baseWage: 12_000,
    minVis: 25,
    minTitles: 0,
    label: 'Experiente / Nacional',
    badgeColor: '#c0c0c0',
  },
  OURO: {
    minRating: 79,
    maxRating: 88,
    baseWage: 35_000,
    minVis: 50,
    minTitles: 1,
    label: 'Renomado / Continental',
    badgeColor: '#ffd700',
  },
  DIAMANTE: {
    minRating: 89,
    maxRating: 98,
    baseWage: 80_000,
    minVis: 75,
    minTitles: 2,
    label: 'Elite Mundial',
    badgeColor: '#b9f2ff',
  },
};

const FIRST_NAMES = [
  'Roberto', 'Carlos', 'Marcelo', 'Alexandre', 'Fernando', 'Ricardo', 'Eduardo', 'Gabriel',
  'Leandro', 'Fabiano', 'Rodrigo', 'Gustavo', 'Mateus', 'Diego', 'Tiago', 'Luciano',
  'Antonio', 'Marco', 'Paolo', 'Giovanni', 'Davide', 'Javier', 'Alejandro', 'Pablo',
  'David', 'James', 'Michael', 'Oliver', 'Thomas', 'Stefan', 'Lukas', 'Hans',
];

const LAST_NAMES = [
  'Silveira', 'Albuquerque', 'Menezes', 'Ferreira', 'Fontana', 'Oliveira', 'Barreto', 'Dornelles',
  'Santoro', 'Castiglione', 'Moretti', 'Bianchi', 'Garrido', 'Navarro', 'Delgado', 'Herrera',
  'Schmidt', 'Weber', 'Becker', 'Vogel', 'Taylor', 'Clarke', 'Sinclair', 'Morrison',
];

/**
 * What a staff member is actually good at.
 *
 * Specialties used to be display strings and nothing else: four sentences per role, drawn at random, shown
 * on the hiring card and read by no logic anywhere. Two candidates of the same overall were completely
 * interchangeable, which left the choice between them decorative.
 *
 * They carry a key now so the game can act on them. The label stays exactly as it was, because it is what
 * the player reads.
 */
export type StaffSpecialtyKey =
  // Auxiliar Tático: which pattern of play this one reads best.
  | 'PRESSING_TRANSITION'
  | 'DEFENSIVE_SOLIDITY'
  | 'POSSESSION_CONTROL'
  | 'COUNTER_SET_PIECES'
  // Diretor de Futebol
  | 'NEGOTIATION'
  | 'YOUTH_RADAR'
  | 'CONTRACT_SHIELDING'
  | 'INTERNATIONAL_NETWORK'
  // Preparador Físico
  | 'PERIODISATION'
  | 'INJURY_PREVENTION'
  | 'FAST_RECOVERY'
  | 'EXPLOSIVENESS'
  // Coordenador da Base
  | 'TECHNICAL_POLISH'
  | 'YOUTH_MENTORING'
  | 'ACCELERATED_DEVELOPMENT'
  | 'ELITE_METHODOLOGY'
  // Diretor Financeiro
  | 'BUDGETING'
  | 'SPONSOR_HUNTING'
  | 'BANK_GUARANTEES'
  | 'CASH_FLOW';

const SPECIALTIES: Record<StaffRole, { key: StaffSpecialtyKey; label: string }[]> = {
  TACTICAL_ASSISTANT: [
    { key: 'PRESSING_TRANSITION', label: 'Pressão Alta e Transição Ofensiva' },
    { key: 'DEFENSIVE_SOLIDITY', label: 'Solidez Defensiva e Linhas Compactas' },
    { key: 'POSSESSION_CONTROL', label: 'Posse de Bola e Controle de Jogo' },
    { key: 'COUNTER_SET_PIECES', label: 'Contra-Ataque Rápido e Bolas Paradas' },
  ],
  FOOTBALL_DIRECTOR: [
    { key: 'NEGOTIATION', label: 'Especialista em Negociações de Mercado' },
    { key: 'YOUTH_RADAR', label: 'Radar de Jovens Promessas Sul-Americanas' },
    { key: 'CONTRACT_SHIELDING', label: 'Blindagem de Contratos e Cláusulas' },
    { key: 'INTERNATIONAL_NETWORK', label: 'Networking Internacional e Mercados Europeus' },
  ],
  FITNESS_COACH: [
    { key: 'PERIODISATION', label: 'Periodização Tática e Resistência' },
    { key: 'INJURY_PREVENTION', label: 'Prevenção de Lesões e Fisiologia Aplicada' },
    { key: 'FAST_RECOVERY', label: 'Recuperação Rápida Pós-Jogo' },
    { key: 'EXPLOSIVENESS', label: 'Alta Intensidade e Explosão Muscular' },
  ],
  YOUTH_COORDINATOR: [
    { key: 'TECHNICAL_POLISH', label: 'Lapidação Técnica de Promessas' },
    { key: 'YOUTH_MENTORING', label: 'Mentoria Psicológica de Jovens' },
    { key: 'ACCELERATED_DEVELOPMENT', label: 'Captação e Desenvolvimento Acelerado' },
    { key: 'ELITE_METHODOLOGY', label: 'Metodologia de Base de Elite' },
  ],
  FINANCIAL_DIRECTOR: [
    { key: 'BUDGETING', label: 'Engenharia Financeira e Orçamentos' },
    { key: 'SPONSOR_HUNTING', label: 'Captação de Patrocínios de Grande Porte' },
    { key: 'BANK_GUARANTEES', label: 'Estruturação de Garantias Bancárias' },
    { key: 'CASH_FLOW', label: 'Otimização de Fluxo de Caixa e Folha' },
  ],
};

/** Every specialty label, mapped back to its key. */
const SPECIALTY_KEY_BY_LABEL = new Map(
  Object.values(SPECIALTIES).flatMap((list) => list.map((s) => [s.label, s.key] as const)),
);

/**
 * A staff member's specialty, for anyone stored before specialties had keys.
 *
 * Staff live inside the club's JSON, so there is no migration step that could have backfilled them: a save
 * made before this carries the label only. The labels are a closed set of twenty, so reading the key back
 * out of one is exact rather than a guess.
 */
export function specialtyKeyOf(member: Pick<StaffMember, 'specialty' | 'specialtyKey'>): StaffSpecialtyKey | null {
  return member.specialtyKey ?? SPECIALTY_KEY_BY_LABEL.get(member.specialty) ?? null;
}

const AVATARS: Record<StaffRole, string[]> = {
  TACTICAL_ASSISTANT: ['AT1', 'AT2', 'AT3', 'AT4'],
  FOOTBALL_DIRECTOR: ['DF1', 'DF2', 'DF3', 'DF4'],
  FITNESS_COACH: ['PF1', 'PF2', 'PF3', 'PF4'],
  YOUTH_COORDINATOR: ['CB1', 'CB2', 'CB3', 'CB4'],
  FINANCIAL_DIRECTOR: ['FN1', 'FN2', 'FN3', 'FN4'],
};

/**
 * Generates a diverse pool of available staff candidates for hire across all 5 roles and 4 tiers.
 */
export function generateStaffMarket(seed = 42): StaffMember[] {
  const candidates: StaffMember[] = [];
  const roles: StaffRole[] = ['TACTICAL_ASSISTANT', 'FOOTBALL_DIRECTOR', 'FITNESS_COACH', 'YOUTH_COORDINATOR', 'FINANCIAL_DIRECTOR'];
  const tiers: StaffTier[] = ['BRONZE', 'PRATA', 'OURO', 'DIAMANTE'];

  let counter = 0;
  for (const role of roles) {
    for (const tier of tiers) {
      // 2 candidates per tier for each role = 40 candidates in total market
      for (let i = 0; i < 2; i++) {
        counter++;
        const config = STAFF_TIER_CONFIG[tier];
        const rating = config.minRating + Math.floor(((counter * 7 + seed) % 100) / 100 * (config.maxRating - config.minRating + 1));
        const firstName = FIRST_NAMES[(counter * 3 + seed) % FIRST_NAMES.length];
        const lastName = LAST_NAMES[(counter * 5 + seed + i) % LAST_NAMES.length];
        const specialtyList = SPECIALTIES[role];
        const specialty = specialtyList[(counter + seed) % specialtyList.length];
        const avatarList = AVATARS[role];
        const avatar = avatarList[counter % avatarList.length];

        const wage = Math.round(config.baseWage * (1 + (rating - config.minRating) * 0.04));

        candidates.push({
          id: `staff-${role.toLowerCase()}-${tier.toLowerCase()}-${counter}`,
          name: `${firstName} ${lastName}`,
          role,
          tier,
          rating,
          specialty: specialty.label,
          specialtyKey: specialty.key,
          description: `${STAFF_ROLES_INFO[role].title} (${config.label}) com especialidade em ${specialty.label}. Avaliação: ${rating} OVR.`,
          wage,
          minClubVisibility: config.minVis,
          minCareerTitles: config.minTitles,
          avatar,
          nationality: counter % 3 === 0 ? 'ARG' : counter % 4 === 0 ? 'URY' : 'BRA',
        });
      }
    }
  }

  return candidates;
}

/**
 * Checks if a club qualifies to hire a specific staff member based on visibility and career titles.
 */
export function canHireStaff(
  staff: StaffMember,
  clubVisibility: number,
  careerTitles: number
): { canHire: boolean; reason?: string } {
  if (clubVisibility < staff.minClubVisibility) {
    return {
      canHire: false,
      reason: `Exige Nível de Visibilidade do clube de pelo menos ${staff.minClubVisibility} pts (seu clube tem ${clubVisibility} pts).`,
    };
  }
  if (careerTitles < staff.minCareerTitles) {
    return {
      canHire: false,
      reason: `Exige ao menos ${staff.minCareerTitles} título(s) no currículo do treinador (você tem ${careerTitles}).`,
    };
  }
  return { canHire: true };
}

/**
 * Calculates the discount percentage provided by the active Football Director on transfer purchases (5% to 20%).
 */
export function getDirectorTransferDiscount(director?: StaffMember | null): number {
  if (!director || director.role !== 'FOOTBALL_DIRECTOR') return 0;
  return Math.min(0.20, Math.max(0.05, (director.rating - 50) * 0.0035));
}

/**
 * Calculates the stamina recovery boost provided by the active Fitness Coach (+10% to +40%).
 */
/**
 * O quanto um preparador físico acelera a recuperação de cansaço.
 *
 * Duas coisas estavam erradas aqui, e as duas foram medidas antes de mexer:
 *
 * O piso de 10% igualava todo preparador entre nota 50 e 65. Pagar mais caro por um de 60 devolvia
 * exatamente o mesmo que um de 50, o que torna metade do mercado indistinguível.
 *
 * E o topo criava um penhasco. Um jogo por semana custa cerca de 40 de cansaço, a recuperação base é 36, e o
 * bônus antigo levava a recuperação acima de 40 por volta da nota 80. A partir dali o cansaço deixava de
 * existir: o elenco chegava inteiro toda semana, sempre. Medido: cansaço médio de 39,8 com nota 60, e 0,0
 * com nota 85. Não era "descansa melhor", era a mecânica sair do jogo.
 *
 * A curva agora começa perto de zero e sobe devagar, e o teto de 22% mantém a recuperação por baixo do custo
 * de um jogo. Um bom preparador passa a adiar o desgaste em vez de aboli-lo.
 */
export function getFitnessStaminaBoost(fitnessCoach?: StaffMember | null): number {
  if (!fitnessCoach || fitnessCoach.role !== 'FITNESS_COACH') return 0;
  return Math.min(0.22, Math.max(0, (fitnessCoach.rating - 50) * 0.0045));
}

/**
 * Calculates the injury reduction chance provided by the active Fitness Coach (10% to 50%).
 */
/**
 * Quanto de lesão muscular o preparador evita.
 *
 * Mesmo piso, mesma correção. Este é o efeito que continua sendo o principal motivo de contratar bem: ele
 * cresce de forma contínua e não tem penhasco nenhum.
 */
export function getInjuryReductionRate(fitnessCoach?: StaffMember | null): number {
  if (!fitnessCoach || fitnessCoach.role !== 'FITNESS_COACH') return 0;
  return Math.min(0.50, Math.max(0, (fitnessCoach.rating - 50) * 0.010));
}

/**
 * Calculates the sponsorship bonus revenue provided by the active Financial Director (+5% to +20%).
 */
export function getFinancialDirectorSponsorBoost(cfo?: StaffMember | null): number {
  if (!cfo || cfo.role !== 'FINANCIAL_DIRECTOR') return 0;
  return Math.min(0.20, Math.max(0.05, (cfo.rating - 50) * 0.0035));
}

/**
 * Calculates the youth development multiplier provided by the Youth Coordinator (+30% to +80%).
 */
export function getYouthDevelopmentBoost(coordinator?: StaffMember | null): number {
  if (!coordinator || coordinator.role !== 'YOUTH_COORDINATOR') return 1.0;
  return 1.0 + Math.min(0.80, Math.max(0.30, (coordinator.rating - 50) * 0.01));
}

/**
 * Calculates the extra boost to Physical training focus provided by the Fitness Coach (+20% to +60%).
 */
/**
 * O quanto o preparador multiplica o ganho de um treino físico.
 *
 * Tinha o mesmo piso, e com o mesmo efeito: nota 55 e nota 70 devolviam x1,20 idêntico. A curva agora sai de
 * zero, então cada ponto pago vale alguma coisa desde o começo.
 */
export function getFitnessTrainingBoost(fitnessCoach?: StaffMember | null): number {
  if (!fitnessCoach || fitnessCoach.role !== 'FITNESS_COACH') return 1.0;
  return 1.0 + Math.min(0.60, Math.max(0, (fitnessCoach.rating - 50) * 0.012));
}

/**
 * Calculates the on-pitch tactical synergy and chance/defense bonus provided by the Tactical Assistant (+4% to +14%).
 */
export function getTacticalAssistantBonus(assistant?: StaffMember | null): { chanceBonus: number; defenseBonus: number } {
  if (!assistant || assistant.role !== 'TACTICAL_ASSISTANT') return { chanceBonus: 1.0, defenseBonus: 1.0 };
  const bonus = Math.min(0.14, Math.max(0.04, (assistant.rating - 50) * 0.002));
  return { chanceBonus: 1.0 + bonus, defenseBonus: 1.0 + bonus };
}

/** The four shapes a side's game plan takes, as an assistant reads them off the pitch. */
export type OpponentPattern = 'LOW_BLOCK_CROWD' | 'HIGH_LINE' | 'MIDFIELD_BUILD' | 'WIDE_PLAY';

export interface TacticalAssistantAdvice {
  opponentSummary: string;
  keyWeakness: string;
  recommendedFormation: string;
  recommendedMentality: string;
  recommendedAttackStyle: string;
  recommendedPressing: string;
  assistantNotes: string;
  /** What this assistant believes the opponent is doing, which is not always what they are doing. */
  readPattern: OpponentPattern;
  /** How sure the assistant is, 0 to 1. Drives everything else in this report. */
  confidence: number;
  /** The same figure in words, for the screen to show without deciding thresholds of its own. */
  confidenceLabel: string;
  /** Whether the opponent is playing the kind of football this assistant knows best. */
  withinSpecialty: boolean;
  /** The specific observation. Only an assistant good enough to see detail has one to offer. */
  detail: string | null;
}

/** Which patterns each assistant specialty actually reads well. Everything else they see through a fog. */
const SPECIALTY_SIGHT: Partial<Record<StaffSpecialtyKey, OpponentPattern[]>> = {
  PRESSING_TRANSITION: ['HIGH_LINE', 'MIDFIELD_BUILD'],
  DEFENSIVE_SOLIDITY: ['WIDE_PLAY', 'HIGH_LINE'],
  POSSESSION_CONTROL: ['MIDFIELD_BUILD', 'LOW_BLOCK_CROWD'],
  COUNTER_SET_PIECES: ['LOW_BLOCK_CROWD', 'WIDE_PLAY'],
};

const ALL_PATTERNS: OpponentPattern[] = ['LOW_BLOCK_CROWD', 'HIGH_LINE', 'MIDFIELD_BUILD', 'WIDE_PLAY'];

/** How the opponent is really lined up, before anybody has to interpret it. */
export function readOpponentPattern(formation: string, mentality: string, attackStyle: string, pressing: string): OpponentPattern {
  if (formation === '5-3-2' || formation === '5-4-1' || formation === '5-3-1') return 'LOW_BLOCK_CROWD';
  if (pressing === 'HIGH_PRESS' || mentality === 'attacking') return 'HIGH_LINE';
  if (attackStyle === 'THROUGH_MIDDLE') return 'MIDFIELD_BUILD';
  return 'WIDE_PLAY';
}

const PATTERN_ADVICE: Record<
  OpponentPattern,
  {
    weakness: (opponent: string) => string;
    formation: string;
    mentality: string;
    attackStyle: string;
    pressing: string;
    notes: string;
    detail: string;
  }
> = {
  LOW_BLOCK_CROWD: {
    weakness: (o) => `${o} joga muito congestionado no centro da área com 5 defensores.`,
    formation: '4-3-3 ou 3-4-3',
    mentality: 'ofensiva',
    attackStyle: 'jogo pelas pontas',
    pressing: 'pressão alta',
    notes: 'Não tente forçar bolas pelo meio. Abra o campo com pontas e explore cruzamentos nas costas dos alas adversários.',
    detail: 'Os alas deles saem para o cruzamento e demoram a voltar. O segundo pau fica livre quase toda vez.',
  },
  HIGH_LINE: {
    weakness: (o) => `${o} sobe muito as linhas de marcação e deixa uma avenida nas costas dos zagueiros.`,
    formation: '4-4-2 ou 4-2-3-1',
    mentality: 'equilibrada',
    attackStyle: 'contra-ataque rápido',
    pressing: 'bloco baixo ou médio',
    notes: 'Chame o adversário para o nosso campo e acione atacantes velozes em profundidade no mano a mano.',
    detail: 'O zagueiro da direita deles é o mais lento dos quatro. É por ali que a bola em profundidade compensa.',
  },
  MIDFIELD_BUILD: {
    weakness: (o) => `A criação de ${o} é concentrada no meio de campo.`,
    formation: '4-1-4-1 ou 4-2-3-1',
    mentality: 'equilibrada',
    attackStyle: 'ataque equilibrado',
    pressing: 'bloco médio',
    notes: 'Dobre a marcação nos meias centrais com volantes de pegada e force o oponente a ligações diretas.',
    detail: 'Tudo passa pelo meia de criação. Tirando ele do jogo, sobra bola longa, que é o que eles fazem pior.',
  },
  WIDE_PLAY: {
    weakness: (o) => `${o} busca o jogo pelos lados e depende do cruzamento para criar.`,
    formation: '4-3-3',
    mentality: 'ofensiva',
    attackStyle: 'jogo pelas pontas',
    pressing: 'pressão alta',
    notes: 'Feche os corredores e obrigue o adversário a jogar por dentro, que é onde eles têm menos gente.',
    detail: 'Os dois pontas deles ficam colados na linha. Com o lateral apoiado pelo volante, o cruzamento morre antes.',
  },
};

const PATTERN_SUMMARY: Record<OpponentPattern, string> = {
  LOW_BLOCK_CROWD: 'se fecha atrás e povoa a área',
  HIGH_LINE: 'sobe as linhas e pressiona no campo de ataque',
  MIDFIELD_BUILD: 'constrói por dentro e controla pelo meio',
  WIDE_PLAY: 'abre o jogo e ataca pelos lados',
};

/** An assistant nobody hired: someone from the staff room who watched the same match everyone else did. */
const INTERIM_ACCURACY = 0.3;
/** Detail is a matter of what a trained eye picks up. Below this an assistant sees the shape and no more. */
const DETAIL_RATING = 72;

/**
 * How likely this assistant is to read the opponent correctly.
 *
 * The rating used to change nothing at all: it was printed in front of the note and the note itself was the
 * same for a bronze 55 and a diamante 99. Competence now buys accuracy, which is the thing a scouting report
 * is actually made of, and the specialty decides which kind of football they read well. A pressing
 * specialist watching a side that sits deep is out of their depth, and it shows in what they hand you.
 */
function readingAccuracy(
  assistant: StaffMember | null | undefined,
  truth: OpponentPattern,
  managerStyle?: ManagerStyleId | string | null,
): { accuracy: number; withinSpecialty: boolean } {
  if (!assistant) {
    const accuracy = applyTacticalAdviceStyleBonus(INTERIM_ACCURACY, managerStyle);
    return { accuracy, withinSpecialty: false };
  }

  const sight = SPECIALTY_SIGHT[specialtyKeyOf(assistant) ?? 'PRESSING_TRANSITION'] ?? [];
  const withinSpecialty = sight.includes(truth);
  const base = 0.45 + (assistant.rating - 50) * 0.01;
  const raw = Math.max(0.2, Math.min(0.97, base + (withinSpecialty ? 0.15 : -0.1)));

  return { accuracy: applyTacticalAdviceStyleBonus(raw, managerStyle), withinSpecialty };
}

function confidenceLabelFor(confidence: number): string {
  if (confidence >= 0.8) return 'Leitura segura';
  if (confidence >= 0.6) return 'Leitura provável';
  if (confidence >= 0.4) return 'Impressão, sem certeza';
  return 'Palpite';
}

/**
 * The scouting report an assistant hands the manager before a match.
 *
 * The old version took the assistant and used it for one thing: writing the name in front of the note. Every
 * club got the same four-branch recommendation off the opponent's formation, so hiring a diamante changed the
 * byline and nothing else, and choosing between two candidates of the same overall was a coin toss.
 *
 * What an assistant is for is telling you what the other side is doing. So that is what their rating buys:
 * how often they get the read right, and how much detail comes with it. A weak one is often wrong and always
 * vague, and says so, because a report that never admits doubt is one the manager cannot weigh. Nothing here
 * decides anything on its own: the report is an opinion, and setting the team up is still the manager's call.
 *
 * The misread is seeded on the assistant and the opponent, so re-opening the screen never rerolls it. It is
 * the same assistant looking at the same match.
 */
export function generateTacticalAssistantAdvice(
  assistant: StaffMember | null | undefined,
  opponentTactic?: { formation?: string; mentality?: string; attackStyle?: string; pressing?: string } | null,
  opponentClubName: string = 'o adversário',
  managerStyle?: ManagerStyleId | string | null,
): TacticalAssistantAdvice {
  const formation = opponentTactic?.formation ?? '4-4-2';
  const mentality = opponentTactic?.mentality ?? 'balanced';
  const attackStyle = opponentTactic?.attackStyle ?? 'BALANCED';
  const pressing = opponentTactic?.pressing ?? 'MID_BLOCK';

  const truth = readOpponentPattern(formation, mentality, attackStyle, pressing);
  const { accuracy, withinSpecialty } = readingAccuracy(assistant, truth, managerStyle);

  const rng = createRng(`advice-${assistant?.id ?? 'interino'}-${opponentClubName}-${formation}-${mentality}-${attackStyle}-${pressing}`);
  const wrong = rng() > accuracy;
  const others = ALL_PATTERNS.filter((p) => p !== truth);
  const readPattern = wrong ? others[Math.floor(rng() * others.length)] : truth;

  const advice = PATTERN_ADVICE[readPattern];
  const rating = assistant?.rating ?? 0;
  const detail = rating >= DETAIL_RATING ? advice.detail : null;

  return {
    opponentSummary: `${opponentClubName} atua na formação ${formation} com mentalidade ${MENTALITY_LABEL[mentality as Mentality] ?? mentality}, e ${PATTERN_SUMMARY[readPattern]}.`,
    keyWeakness: advice.weakness(opponentClubName),
    recommendedFormation: advice.formation,
    recommendedMentality: advice.mentality,
    recommendedAttackStyle: advice.attackStyle,
    recommendedPressing: advice.pressing,
    assistantNotes: assistant ? `(${assistant.name}, ${assistant.rating} OVR): ${advice.notes}` : `(Auxiliar Interino): ${advice.notes}`,
    readPattern,
    confidence: accuracy,
    confidenceLabel: confidenceLabelFor(accuracy),
    withinSpecialty,
    detail,
  };
}

export interface AutoTrainingAction {
  playerId: string;
  playerName: string;
  focus: TrainingFocus;
  cost: number;
  reason: string;
}

/**
 * Plans an intelligent squad training routine managed by the Fitness Coach and Coaching Staff.
 * Analyzes potentials, age curves, fatigue, commitment and budget constraints.
 */
export function planSmartAutoTraining(club: Club): AutoTrainingAction[] {
  const actions: AutoTrainingAction[] = [];
  let availableBudget = Math.max(0, club.budget - 20_000);

  const candidates = club.players.map((p) => {
    const cost = Math.max(5000, Math.round(p.marketValue * 0.05));
    let priority = 0;
    let focus: TrainingFocus = 'PHYSICAL';
    let reason = '';

    const potentialGap = Math.max(0, p.potential - p.overall);

    if (p.age <= 22) {
      priority += 50 + potentialGap * 4;
      if (p.commitment < 60) {
        focus = 'MENTAL';
        reason = `Jovem promessa com comprometimento baixo (${p.commitment}%) desenvolvendo maturidade tática.`;
      } else if (p.attributes.physical < 65 || p.attributes.pace < 65) {
        focus = 'PHYSICAL';
        reason = `Jovem atleta (${p.age} anos) ganhando condicionamento e explosão muscular.`;
      } else {
        focus = 'TECHNICAL';
        reason = `Promessa com potencial ${p.potential} OVR lapidando refinamento técnico.`;
      }
    } else if (p.age >= 29) {
      priority += 25 + (p.attributes.physical < 60 ? 15 : 0);
      focus = 'PHYSICAL';
      reason = `Veterano (${p.age} anos) realizando manutenção física para retardar declínio.`;
    } else {
      // Peak age (23-28)
      priority += 30 + potentialGap * 2;
      if (p.commitment < 50) {
        focus = 'MENTAL';
        reason = `Foco mental para elevar comprometimento e entrega em campo (${p.commitment}%).`;
      } else if (p.position === 'ATT' || p.position === 'MID') {
        focus = 'TECHNICAL';
        reason = `Aprimoramento técnico de finalização e criação de jogadas no auge da carreira.`;
      } else {
        focus = 'PHYSICAL';
        reason = `Reforço físico e resistência para suportar a sequência de partidas.`;
      }
    }

    return { player: p, cost, priority, focus, reason };
  });

  candidates.sort((a, b) => b.priority - a.priority);

  for (const c of candidates) {
    if (availableBudget >= c.cost) {
      actions.push({
        playerId: c.player.id,
        playerName: c.player.name,
        focus: c.focus,
        cost: c.cost,
        reason: c.reason,
      });
      availableBudget -= c.cost;
    }
  }

  return actions;
}

/**
 * Plans an intelligent youth academy training routine managed by the Youth Coordinator.
 */
export function planSmartAcademyAutoTraining(club: Club): AutoTrainingAction[] {
  const actions: AutoTrainingAction[] = [];
  let availableBudget = Math.max(0, club.budget - 10_000);

  for (const p of club.academyPlayers) {
    const cost = Math.max(2000, Math.round(p.marketValue * 0.05));
    if (availableBudget < cost) continue;

    let focus: TrainingFocus = 'TECHNICAL';
    let reason = '';

    if (p.position === 'GK') {
      focus = 'TECHNICAL';
      reason = `Goleiro promessa aprimorando fundamentos e reflexos.`;
    } else if (p.position === 'DEF' || p.position === 'LAT') {
      if (p.attributes.physical < 60) {
        focus = 'PHYSICAL';
        reason = `Defensor da base desenvolvendo porte atlético e combatividade.`;
      } else {
        focus = 'TECHNICAL';
        reason = `Lapidação de passe e saída de bola defensiva.`;
      }
    } else if (p.position === 'MID') {
      focus = 'TECHNICAL';
      reason = `Meia da base aprimorando visão de jogo e precisão de passes.`;
    } else {
      if (p.attributes.pace > 65) {
        focus = 'TECHNICAL';
        reason = `Atacante veloz lapidando pontaria e finalização no gol.`;
      } else {
        focus = 'PHYSICAL';
        reason = `Atacante desenvolvendo velocidade de arrancada e explosão.`;
      }
    }

    actions.push({
      playerId: p.id,
      playerName: p.name,
      focus,
      cost,
      reason,
    });
    availableBudget -= cost;
  }

  return actions;
}

/**
 * Automatically prepares and deploys a counter-tactical setup and optimal lineup against the round's opponent.
 */
export function planSmartTacticsAgainstOpponent(
  club: Club,
  opponentTactic?: { formation?: string; mentality?: string; attackStyle?: string; pressing?: string } | null,
  competitionId: string | null = null,
): {
  tactic: Tactic;
  explanation: string;
} {
  const formation = opponentTactic?.formation ?? '4-4-2';
  const mentality = opponentTactic?.mentality ?? 'balanced';
  const attackStyle = opponentTactic?.attackStyle ?? 'BALANCED';
  const pressing = opponentTactic?.pressing ?? 'MID_BLOCK';

  let targetFormation: Formation = '4-3-3';
  let targetMentality: Mentality = 'attacking';
  let targetAttackStyle: AttackStyle = 'WINGS';
  let targetAttackApproach: AttackApproach = 'TOTAL_ATTACK';
  let targetPressing: PressingIntensity = 'HIGH_PRESS';
  let targetMarkingStyle: MarkingStyle = 'BALANCED';
  let explanation = '';

  if (formation === '5-3-2' || formation === '5-4-1' || formation === '5-3-1') {
    targetFormation = '4-3-3';
    targetAttackStyle = 'WINGS';
    targetAttackApproach = 'TOTAL_ATTACK';
    targetMentality = 'attacking';
    targetPressing = 'HIGH_PRESS';
    targetMarkingStyle = 'BALANCED';
    explanation = 'Contra a retranca de 5 defensores do adversário, o Auxiliar escalou o time em 4-3-3 com jogo aberto pelas pontas e pressão alta para sufocar a saída.';
  } else if (pressing === 'HIGH_PRESS' || mentality === 'attacking') {
    targetFormation = '4-4-2';
    targetAttackStyle = 'BALANCED';
    targetAttackApproach = 'COUNTER_ATTACK';
    targetMentality = 'balanced';
    targetPressing = 'LOW_BLOCK';
    targetMarkingStyle = 'BALANCED';
    explanation = 'Contra a pressão alta rival, o Auxiliar montou um bloco baixo compacto em 4-4-2 com contra-ataques velozes nas costas da zaga adversária.';
  } else if (attackStyle === 'THROUGH_MIDDLE') {
    targetFormation = '4-2-3-1';
    targetAttackStyle = 'BALANCED';
    targetAttackApproach = 'BALANCED';
    targetMentality = 'balanced';
    targetPressing = 'MEDIUM';
    targetMarkingStyle = 'MAN_MARKING';
    explanation = 'Contra a criação central rival, o Auxiliar reforçou o meio-campo em 4-2-3-1 com bloco médio e marcação individual compacta.';
  } else {
    targetFormation = '4-3-3';
    targetAttackStyle = 'BALANCED';
    targetAttackApproach = 'BALANCED';
    targetMentality = 'balanced';
    targetPressing = 'MEDIUM';
    targetMarkingStyle = 'BALANCED';
    explanation = 'O Auxiliar estruturou uma equipe equilibrada em 4-3-3 aproveitando a melhor condição física e técnica dos titulares disponíveis.';
  }

  const baseTactic = autoFillLineup(club, competitionId, targetFormation);
  const tactic: Tactic = {
    ...baseTactic,
    formation: targetFormation,
    mentality: targetMentality,
    attackStyle: targetAttackStyle,
    attackApproach: targetAttackApproach,
    markingStyle: targetMarkingStyle,
    pressing: targetPressing,
  };

  return { tactic, explanation };
}

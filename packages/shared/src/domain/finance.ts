import { Player } from './player.js';
import type { Club } from './club.js';
import { applySponsorshipStyleBonus, type ManagerStyleId } from './managerStyle.js';
import type { MatchEvent, MatchSide } from './match.js';

export type SponsorshipType = 'MASTER' | 'KIT_SUPPLIER' | 'STADIUM_NAMING' | 'REGIONAL' | 'TECH_EQUIPMENT';
export type ContractLength = 'CURTO' | 'MEDIO' | 'LONGO';
export type SponsorProfile = 'ESTAVEL' | 'PERFORMANCE' | 'MECENAS' | 'REGIONAL_TRADICAO';

export type SponsorGoalType =
  | 'LEAGUE_POSITION'
  | 'AVOID_RELEGATION'
  | 'CUP_STAGE'
  | 'GOALS_SCORED'
  | 'HOME_UNBEATEN_STREAK'
  | 'AVERAGE_ATTENDANCE';

export interface SponsorGoal {
  id: string;
  type: SponsorGoalType;
  title: string;
  description: string;
  targetValue: number;
  currentValue?: number;
  reward: number;
  isCompleted: boolean;
  isFailed?: boolean;
}

export interface Sponsorship {
  id: string;
  type: SponsorshipType;
  sponsorName: string;
  weeklyAmount: number;
  weeksRemaining: number;
  contractLength: ContractLength;
  /** One-off bonus paid the week this club is crowned league champion while this deal is active. */
  titleBonus: number;
  /** One-off bonus paid the week this club lifts the cup while this deal is active. */
  cupBonus: number;
  /** Which tier this sponsor name was drawn from (e.g. "Top Mundial") — only set for types with `tiers`. */
  sponsorTier?: string;
  /** A rival naming-rights bid shown alongside an already-active STADIUM_NAMING deal — signing it replaces
   *  the current deal instead of being blocked as a duplicate type. See generateNamingRightsChallengeOffer. */
  isChallenge?: boolean;
  /** A poach offer from a rival company seeking to replace an active sponsor mid-season with higher payouts. */
  isPoachOffer?: boolean;
  /**
   * A rival bidding for a slot the club already holds, offered openly at the negotiation table rather than
   * as a mid-season poach. Signing it breaks the running contract, which is the decision the table exists
   * to put in front of the manager.
   */
  isReplacement?: boolean;
  replacedSponsorName?: string;
  /** Immediate upfront signing bonus / transfer acquisition fund paid at the moment of signing. */
  signingBonus?: number;
  /** Commercial profile archetype of this sponsor (Conservative, Performance-driven, Patron Mecenas, etc.). */
  sponsorProfile?: SponsorProfile;
  /** Contractual performance goals with financial rewards upon achievement. */
  goals?: SponsorGoal[];
  /** Dedicated fund granted by this sponsor specifically to help hire and pay high-profile star players (80+ OVR). */
  craqueFund?: number;
  craqueFundRemaining?: number;
}

export interface BankGuarantee {
  id: string;
  bankName: string;
  maxGuaranteeAmount: number;
  activeUsedAmount: number;
  interestRatePerMonth: number;
  isAvailable: boolean;
  minVisibilityScore: number;
  description: string;
}

export function calculateBankGuaranteeEligibility(clubBudget: number, visibilityScore = 50, cfoRating = 50): BankGuarantee[] {
  const cfoBonus = cfoRating > 50 ? (cfoRating - 50) * 0.008 : 0;
  const baseMult = (Math.max(20, visibilityScore) / 100) * (1 + cfoBonus);

  return [
    {
      id: 'bg-safra',
      bankName: 'Banco Safra e Capital Global',
      maxGuaranteeAmount: Math.max(5_000_000, Math.round((clubBudget * 1.5 * baseMult) / 100_000) * 100_000),
      activeUsedAmount: 0,
      interestRatePerMonth: 0.012, // 1.2% / month
      isAvailable: visibilityScore >= 25,
      minVisibilityScore: 25,
      description: 'Garantia institucional padrão para aquisição parcelada de atletas e aval em multas rescisórias.',
    },
    {
      id: 'bg-meridiano',
      bankName: 'Consórcio Financeiro Premier',
      maxGuaranteeAmount: Math.max(15_000_000, Math.round((clubBudget * 3.5 * baseMult) / 100_000) * 100_000),
      activeUsedAmount: 0,
      interestRatePerMonth: 0.008, // 0.8% / month
      isAvailable: visibilityScore >= 55,
      minVisibilityScore: 55,
      description: 'Linha nobre de garantia internacional para contratação de estrelas mundiais com chancela de TV.',
    },
  ];
}

export type LoanPlanKey = 'CURTO' | 'MEDIO' | 'LONGO';

export interface Loan {
  id: string;
  planKey: LoanPlanKey;
  principal: number;
  remainingBalance: number;
  weeklyPayment: number;
  weeksRemaining: number;
}

export const MAX_SPONSORSHIPS = 5;

export interface StadiumTierConfig {
  tier: number;
  name: string;
  capacity: number;
  upgradeCost: number;
  upgradeWeeks: number;
  weeklyMaintenance: number;
  description: string;
}

export const STADIUM_TIERS: StadiumTierConfig[] = [
  {
    tier: 1,
    name: 'Estádio Municipal',
    capacity: 2_000,
    upgradeCost: 0,
    upgradeWeeks: 0,
    weeklyMaintenance: 5_000,
    description: 'Instalações básicas municipais com arquibancada simples.',
  },
  {
    tier: 2,
    name: 'Estádio Regional',
    capacity: 15_000,
    upgradeCost: 2_000_000,
    upgradeWeeks: 4,
    weeklyMaintenance: 20_000,
    description: 'Estádio regional estruturado com iluminação e setor coberto.',
  },
  {
    tier: 3,
    name: 'Arena Estadual',
    capacity: 40_000,
    upgradeCost: 5_000_000,
    upgradeWeeks: 6,
    weeklyMaintenance: 50_000,
    description: 'Arena moderna com camarotes, centro de imprensa e gramado premium.',
  },
  {
    tier: 4,
    name: 'Arena Nacional',
    capacity: 75_000,
    upgradeCost: 10_000_000,
    upgradeWeeks: 8,
    weeklyMaintenance: 120_000,
    description: 'Complexo de alto padrão apto para decisões nacionais e jogos de seleção.',
  },
  {
    tier: 5,
    name: 'Mega Arena Internacional',
    capacity: 120_000,
    upgradeCost: 20_000_000,
    upgradeWeeks: 12,
    weeklyMaintenance: 250_000,
    description: 'Ícone arquitetônico mundial com teto retrátil e capacidade de elite.',
  },
];

export function getStadiumTierInfo(tier: number): StadiumTierConfig | undefined {
  return STADIUM_TIERS.find((t) => t.tier === tier);
}

export function getNextStadiumTier(tier: number): StadiumTierConfig | undefined {
  return STADIUM_TIERS.find((t) => t.tier === tier + 1);
}

/** Level 1 is what every club starts with (free); each further level must be paid for via `stadium/upgrade`.
 *  Capacity spans a small local pitch (2,000) up to an outsized top-tier mega-arena (120,000), decelerating
 *  as it grows — each jump is proportionally smaller than the last, same as real-world stadium expansion.
 *  `constructionWeeks` is how long the club plays on the OLD capacity before the new one comes online —
 *  a bigger expansion takes proportionally longer to build, same as the cost curve. */
export const STADIUM_LEVELS = [
  { level: 1, capacity: 2_000, upgradeCost: 0, constructionWeeks: 0 },
  { level: 2, capacity: 15_000, upgradeCost: 2_000_000, constructionWeeks: 4 },
  { level: 3, capacity: 40_000, upgradeCost: 5_000_000, constructionWeeks: 6 },
  { level: 4, capacity: 75_000, upgradeCost: 10_000_000, constructionWeeks: 8 },
  { level: 5, capacity: 120_000, upgradeCost: 20_000_000, constructionWeeks: 12 },
];

export const STARTING_STADIUM_LEVEL = 1;
export const STARTING_STADIUM_CAPACITY = STADIUM_LEVELS[0].capacity;

/** An in-progress stadium expansion — the club already paid `upgradeCost` and plays on the current
 *  (smaller) capacity until `weeksRemaining` counts down to 0 (see developmentService.advanceWeek),
 *  at which point `stadiumLevel`/`stadiumCapacity` jump to `targetLevel`. At most one at a time. */
export interface StadiumSubReformConfig {
  tier: number;            // 1 to 4
  step: number;            // 1 to 4
  name: string;            // Nome da etapa
  description: string;     // Detalhes da obra
  cost: number;            // Custo desta etapa específica
  durationWeeks: number;   // Semanas de duração
  capacityGain: number;    // Lugares adicionados
  targetCapacity: number;  // Capacidade total alcançada
  videoFile: string;       // Arquivo de vídeo
}

export const STADIUM_SUB_REFORMS: Record<number, StadiumSubReformConfig[]> = {
  1: [
    {
      tier: 1,
      step: 1,
      name: 'Terraplanagem & Fundações',
      description: 'Remoção de terra, nivelamento do terreno e fundações estruturais no entorno.',
      cost: 500_000,
      durationWeeks: 1,
      capacityGain: 3_250,
      targetCapacity: 5_250,
      videoFile: '/stadium/tier-1-step-1.mp4',
    },
    {
      tier: 1,
      step: 2,
      name: 'Vestiários Profissionais & Concreto',
      description: 'Subida dos primeiros módulos pré-moldados e modernização dos vestiários.',
      cost: 500_000,
      durationWeeks: 1,
      capacityGain: 3_250,
      targetCapacity: 8_500,
      videoFile: '/stadium/tier-1-step-2.mp4',
    },
    {
      tier: 1,
      step: 3,
      name: 'Torres de Iluminação LED & Alambrados',
      description: 'Instalação de torres de refletores LED e fechamento perimetral do campo.',
      cost: 500_000,
      durationWeeks: 1,
      capacityGain: 3_250,
      targetCapacity: 11_750,
      videoFile: '/stadium/tier-1-step-3.mp4',
    },
    {
      tier: 1,
      step: 4,
      name: 'Cobertura Social & Entrega Nível 2',
      description: 'Cobertura da arquibancada principal e entrega oficial do Estádio Regional.',
      cost: 500_000,
      durationWeeks: 1,
      capacityGain: 3_250,
      targetCapacity: 15_000,
      videoFile: '/stadium/tier-1-step-4.mp4',
    },
  ],
  2: [
    {
      tier: 2,
      step: 1,
      name: 'Fechamento das Curvas (Anel Inferior)',
      description: 'Conexão das arquibancadas retas com as curvas de fundo em anel contínuo.',
      cost: 1_250_000,
      durationWeeks: 1,
      capacityGain: 6_250,
      targetCapacity: 21_250,
      videoFile: '/stadium/tier-2-step-1.mp4',
    },
    {
      tier: 2,
      step: 2,
      name: 'Anel Superior & Rampas de Acesso',
      description: 'Pilares gigantes de sustentação e estrutura do segundo anel de arquibancada.',
      cost: 1_250_000,
      durationWeeks: 2,
      capacityGain: 6_250,
      targetCapacity: 27_500,
      videoFile: '/stadium/tier-2-step-2.mp4',
    },
    {
      tier: 2,
      step: 3,
      name: 'Camarotes VIP, Cabines de TV & Telão',
      description: 'Anel envidraçado de camarotes executivos e montagem do telão de LED.',
      cost: 1_250_000,
      durationWeeks: 1,
      capacityGain: 6_250,
      targetCapacity: 33_750,
      videoFile: '/stadium/tier-2-step-3.mp4',
    },
    {
      tier: 2,
      step: 4,
      name: 'Cobertura Curva & Entrega Nível 3',
      description: 'Estruturas metálicas arqueadas e transformação completa na Arena Estadual.',
      cost: 1_250_000,
      durationWeeks: 2,
      capacityGain: 6_250,
      targetCapacity: 40_000,
      videoFile: '/stadium/tier-2-step-4.mp4',
    },
  ],
  3: [
    {
      tier: 3,
      step: 1,
      name: 'Rebaixamento do Gramado & Drenagem',
      description: 'Escavação do solo central para novas fileiras de assentos próximas ao campo.',
      cost: 2_500_000,
      durationWeeks: 2,
      capacityGain: 8_750,
      targetCapacity: 48_750,
      videoFile: '/stadium/tier-3-step-1.mp4',
    },
    {
      tier: 3,
      step: 2,
      name: 'Esplanada Moderna, Concourse & Catracas',
      description: 'Modernização das esplanadas externas, catracas de biometria e pórticos de LED.',
      cost: 2_500_000,
      durationWeeks: 2,
      capacityGain: 8_750,
      targetCapacity: 57_500,
      videoFile: '/stadium/tier-3-step-2.mp4',
    },
    {
      tier: 3,
      step: 3,
      name: 'Telão Central Halo & Cabos de Aço',
      description: 'Içamento do telão de última geração suspenso por cabos de aço tensionados.',
      cost: 2_500_000,
      durationWeeks: 2,
      capacityGain: 8_750,
      targetCapacity: 66_250,
      videoFile: '/stadium/tier-3-step-3.mp4',
    },
    {
      tier: 3,
      step: 4,
      name: 'Cobertura Têxtil & Entrega Nível 4',
      description: 'Membrana tensionada cobrindo 100% dos assentos e entrega da Arena Nacional.',
      cost: 2_500_000,
      durationWeeks: 2,
      capacityGain: 8_750,
      targetCapacity: 75_000,
      videoFile: '/stadium/tier-3-step-4.mp4',
    },
  ],
  4: [
    {
      tier: 4,
      step: 1,
      name: 'Gramado Retrátil Subterrâneo',
      description: 'Caverna subterrânea automatizada com trilhos e iluminação ultravioleta.',
      cost: 5_000_000,
      durationWeeks: 3,
      capacityGain: 11_250,
      targetCapacity: 86_250,
      videoFile: '/stadium/tier-4-step-1.mp4',
    },
    {
      tier: 4,
      step: 2,
      name: 'Acústica de Domo & Setores Premium',
      description: 'Painéis acústicos de alta performance e setorização ultra-premium.',
      cost: 5_000_000,
      durationWeeks: 3,
      capacityGain: 11_250,
      targetCapacity: 97_500,
      videoFile: '/stadium/tier-4-step-1.mp4',
    },
    {
      tier: 4,
      step: 3,
      name: 'Fachada Dinâmica de Aço & LED Exterior',
      description: 'Ripas de aço inoxidável e tiras de LED programáveis na fachada monumental.',
      cost: 5_000_000,
      durationWeeks: 3,
      capacityGain: 11_250,
      targetCapacity: 108_750,
      videoFile: '/stadium/tier-4-step-4.mp4',
    },
    {
      tier: 4,
      step: 4,
      name: 'Teto Retrátil & Entrega Mega Arena',
      description: 'Engrenagens do teto retrátil e entrega do maior complexo esportivo do mundo.',
      cost: 5_000_000,
      durationWeeks: 3,
      capacityGain: 11_250,
      targetCapacity: 120_000,
      videoFile: '/stadium/tier-4-step-4.mp4',
    },
  ],
};

export function getStadiumSubReforms(tier: number): StadiumSubReformConfig[] {
  return STADIUM_SUB_REFORMS[tier] || [];
}

export function getStadiumCurrentStep(tier: number, capacity: number): number {
  const reforms = STADIUM_SUB_REFORMS[tier];
  if (!reforms || reforms.length === 0) return 0;
  for (let i = reforms.length - 1; i >= 0; i--) {
    if (capacity >= reforms[i].targetCapacity) {
      return i + 1;
    }
  }
  return 0;
}

export function getNextStadiumReform(tier: number, currentStep: number = 0): StadiumSubReformConfig | null {
  if (currentStep >= 4) {
    const nextTierReforms = STADIUM_SUB_REFORMS[tier + 1];
    return nextTierReforms ? nextTierReforms[0] : null;
  }
  const reforms = STADIUM_SUB_REFORMS[tier];
  if (!reforms) return null;
  return reforms[currentStep] || null;
}

export interface StadiumConstruction {
  targetLevel: number;
  weeksRemaining: number;
  targetStep?: number;
  stepName?: string;
  targetCapacity?: number;
  videoFile?: string;
}

/**
 * What a seat costs.
 *
 * Was 5, which is not the price of a ticket to professional football in any era, and it showed: gate money
 * came to R$ 75.000 a week for a 25.000-seat ground while that club's wage bill ran to R$ 250.000. Across
 * the 1.526 clubs of the imported world, 46% could not finish a season in the black even with sponsors and
 * television money. At 10 that falls to 26%, which leaves a quarter of the world in real trouble rather
 * than half of it, and the median club still leaning on its television money to get by — which is what the
 * lower reaches of the sport actually look like.
 *
 * Deliberately not raised further: at 12 an expansion from 15.000 to 40.000 seats pays for itself in 28
 * weeks, and a stadium that pays for itself inside a season stops being a decision.
 */
const TICKET_PRICE = 10;
/** Occupancy for a club with nothing going for it and nothing against it — the midpoint of the band below. */
const ATTENDANCE_RATE = 0.6;

/** How far winning (or losing) can move the crowd either side of the baseline. Kept symmetric so a league's
 *  *average* occupancy still lands on ATTENDANCE_RATE and the economy stays balanced where it was tuned. */
const ATTENDANCE_FORM_SWING = 0.25;
/** A trophy cabinet keeps people coming back regardless of a bad season, with diminishing returns. */
const ATTENDANCE_TITLE_BONUS = 0.03;
const MAX_TITLE_BONUS = 0.12;

const MIN_ATTENDANCE_RATE = 0.25;
const MAX_ATTENDANCE_RATE = 1;

export interface AttendanceInputs {
  stadiumCapacity: number;
  /** 1 = top of the table. Null when the club has no league at all. */
  leaguePosition: number | null;
  totalClubsInLeague: number;
  titlesWon: number;
  /**
   * Fixtures played this season. Before the first one every club is on zero points and its "position" is
   * just however the table happened to sort — punishing a club with an empty ground for finishing last on a
   * tiebreak before a ball was kicked would be nonsense, so a fresh season starts everyone at the baseline.
   */
  matchesPlayed?: number;
}

/**
 * What share of the ground actually turns up.
 *
 * Occupancy was a flat 0.6 forever, which made the stadium a number that only ever changed when you paid to
 * expand it. Tying it to where the club sits in the table gives a full ground something to mean: win and the
 * place fills up and pays for itself, drift to the bottom and you are heating an empty bowl. Deliberately
 * centred on the old constant so league-average matchday income is unchanged — this redistributes the crowd
 * between good and bad seasons, it doesn't quietly hand everyone more money.
 */
export function calculateAttendanceRate(inputs: AttendanceInputs): number {
  const { leaguePosition, totalClubsInLeague, titlesWon, matchesPlayed } = inputs;

  // 1st place -> +swing, last -> -swing, mid-table -> 0. No table yet means no opinion either way.
  let rate = ATTENDANCE_RATE;
  const tableMeansSomething = matchesPlayed === undefined || matchesPlayed > 0;
  if (tableMeansSomething && leaguePosition !== null && totalClubsInLeague > 1) {
    const standing = 1 - (leaguePosition - 1) / (totalClubsInLeague - 1); // 1 at the top, 0 at the bottom
    rate += (standing - 0.5) * 2 * ATTENDANCE_FORM_SWING;
  }
  rate += Math.min(MAX_TITLE_BONUS, titlesWon * ATTENDANCE_TITLE_BONUS);

  return Math.max(MIN_ATTENDANCE_RATE, Math.min(MAX_ATTENDANCE_RATE, rate));
}

/** Bums on seats for one matchday. */
export function calculateAttendance(inputs: AttendanceInputs): number {
  return Math.round(inputs.stadiumCapacity * calculateAttendanceRate(inputs));
}

/**
 * Matchday income for one tick. `attendanceRate` defaults to the flat baseline so callers that have no
 * league context (and the economy tests pinned to it) behave exactly as before.
 */
export function calculateStadiumRevenue(stadiumCapacity: number, attendanceRate: number = ATTENDANCE_RATE): number {
  return Math.round(stadiumCapacity * attendanceRate * TICKET_PRICE);
}

/**
 * General upkeep for one tick, as a *percentage* of the club's own real cash flows instead of a flat
 * lookup by stadium level — a bigger matchday operation and a bigger payroll both cost proportionally
 * more to run, which is what actually makes the budget feel like managing a real club instead of paying
 * a fixed toll. Both rates are deliberately modest: together they eat less than a third of one week's
 * incoming stadium revenue plus wage bill for a mid-table club.
 */
export const MAINTENANCE_RATE_OF_STADIUM_REVENUE = 0.2;
export const MAINTENANCE_RATE_OF_WAGE_BILL = 0.1;

export function calculateMaintenanceCost(stadiumRevenue: number, wageBill: number): number {
  return Math.round(stadiumRevenue * MAINTENANCE_RATE_OF_STADIUM_REVENUE + wageBill * MAINTENANCE_RATE_OF_WAGE_BILL);
}

/** Total weekly payroll across a list of players (main squad and/or academy). */
export function calculateWageBill(players: Player[]): number {
  return players.reduce((sum, p) => sum + p.wage, 0);
}

/**
 * O caixa semanal do clube: o que entra, o que sai, e a diferença.
 *
 * Esta conta estava escrita à mão em três telas — painel, estádio e agora os cards dos hubs — e cada cópia
 * era uma chance de duas telas darem números diferentes para a mesma semana. O estádio, aliás, já divergia:
 * chamava `calculateStadiumRevenue` sem a taxa de ocupação, então contava bilheteria de estádio cheio.
 *
 * `attendanceRate` é opcional porque nem toda tela conhece a posição do clube na tabela. Sem ela, a receita
 * de bilheteria usa o padrão de `calculateStadiumRevenue`.
 */
export function weeklyCashFlow(
  club: Pick<Club, 'stadiumCapacity' | 'players' | 'sponsorships' | 'loans' | 'pendingTransferPayments'>,
  attendanceRate?: number,
): { income: number; expense: number; net: number } {
  const stadiumRevenue = calculateStadiumRevenue(club.stadiumCapacity, attendanceRate);
  const wageBill = calculateWageBill(club.players ?? []);
  const income = (club.sponsorships ?? []).reduce((sum, s) => sum + s.weeklyAmount, 0) + stadiumRevenue;
  const expense =
    wageBill +
    calculateMaintenanceCost(stadiumRevenue, wageBill) +
    (club.loans ?? []).reduce((sum, l) => sum + l.weeklyPayment, 0) +
    (club.pendingTransferPayments ?? []).reduce((sum, p) => sum + p.weeklyAmount, 0);
  return { income, expense, net: income - expense };
}

/**
 * A signing needs more than just the transfer fee in the bank — it commits the club to a new recurring
 * weekly wage starting immediately. This is the gate that ties salary to hiring: after paying the fee,
 * the club must still hold a cash cushion worth several weeks of its *total* payroll (existing squad +
 * the incoming player), so a club can't blow its entire reserve on a fee and then be unable to make next
 * week's payroll. Deliberately based on cash-on-hand rather than weekly income, so a wealthy club can
 * still outspend a small one even if its existing wage bill is already high.
 */
export const WAGE_RESERVE_WEEKS = 4;

/** Cash a club must keep in reserve for a given total weekly payroll (existing squad + any new signing). */
export function calculateWageReserve(totalWeeklyWageBill: number): number {
  return totalWeeklyWageBill * WAGE_RESERVE_WEEKS;
}

/** Whether `cashAfterDeal` (budget after paying any upfront transfer fee) leaves enough cushion to cover
 *  `WAGE_RESERVE_WEEKS` of `totalWeeklyWageBillAfterDeal` (the club's full payroll once the deal completes). */
export function canAffordWage(cashAfterDeal: number, totalWeeklyWageBillAfterDeal: number): boolean {
  return cashAfterDeal >= calculateWageReserve(totalWeeklyWageBillAfterDeal);
}

/** Simple squad-quality proxy for prestige — every rostered player counts equally, tactic-agnostic. */
export function averageSquadOverall(players: Player[]): number {
  if (players.length === 0) return 0;
  return players.reduce((sum, p) => sum + p.overall, 0) / players.length;
}

const FINANCIAL_MORALE_PENALTY_PER_WAGE_WEEK = 6;
const MAX_FINANCIAL_MORALE_PENALTY = 20;
const MORALE_MIN = 0;
const MORALE_MAX = 100;

/**
 * Weekly morale hit for playing on a club that's actually in the red — severity scales with how many
 * weeks' worth of payroll the deficit represents, so a barely-negative budget barely stings but a real
 * crisis does. No effect at all once the budget is back at or above zero.
 */
export function applyFinancialMorale(players: Player[], budget: number, wageBill: number): Player[] {
  if (budget >= 0 || wageBill <= 0) return players;

  const deficitWeeksOfPayroll = -budget / wageBill;
  const penalty = Math.min(MAX_FINANCIAL_MORALE_PENALTY, deficitWeeksOfPayroll * FINANCIAL_MORALE_PENALTY_PER_WAGE_WEEK);

  return players.map((p) => ({ ...p, morale: Math.max(MORALE_MIN, Math.min(MORALE_MAX, p.morale - penalty)) }));
}

export function getStadiumLevelInfo(level: number) {
  return STADIUM_LEVELS.find((l) => l.level === level);
}

export function getNextStadiumLevel(level: number) {
  return STADIUM_LEVELS.find((l) => l.level === level + 1);
}

export const MIN_LOAN_AMOUNT = 50_000;
export const MAX_LOAN_AMOUNT = 3_000_000;

/**
 * Three fixed plans trading rate for term, same shape as a real bank loan menu: pay it off fast at a
 * cheaper rate (harder on weekly cash flow), or stretch it out at a steeper rate (easier week to week,
 * more paid in total) — the manager picks whichever fits their budget.
 */
export interface LoanPlan {
  key: LoanPlanKey;
  label: string;
  termWeeks: number;
  interestRate: number;
}

export const LOAN_PLANS: LoanPlan[] = [
  { key: 'CURTO', label: 'Curto prazo', termWeeks: 10, interestRate: 0.1 },
  { key: 'MEDIO', label: 'Médio prazo', termWeeks: 20, interestRate: 0.2 },
  { key: 'LONGO', label: 'Longo prazo', termWeeks: 40, interestRate: 0.35 },
];

export function getLoanPlan(key: LoanPlanKey): LoanPlan {
  const plan = LOAN_PLANS.find((p) => p.key === key);
  if (!plan) throw new Error(`Plano de empréstimo desconhecido: ${key}`);
  return plan;
}

/** Fixed-term, fixed-rate loan: the whole principal + interest is spread evenly across the chosen plan's term. */
export function calculateLoanTerms(principal: number, planKey: LoanPlanKey = 'MEDIO'): { weeklyPayment: number; weeksRemaining: number } {
  const plan = getLoanPlan(planKey);
  const totalRepayment = principal * (1 + plan.interestRate);
  return {
    weeklyPayment: Math.round(totalRepayment / plan.termWeeks),
    weeksRemaining: plan.termWeeks,
  };
}

/**
 * Club "porte" (size/prestige), 0..1 — squad quality, stadium size and current league standing (division
 * plus table position) blended into one composite score. Sponsorship value scales off this: a small
 * bot-run club in a lower division fields modest offers, an elite title-chasing side in a big stadium
 * commands real money — the whole point being to make sponsorship feel earned, not random.
 */
export interface ClubPrestigeInputs {
  avgSquadOverall: number;
  stadiumLevel: number;
  /** 1 = top flight. */
  division: number;
  /** 1-based current table position; null before the league has any standings yet (start of season). */
  leaguePosition: number | null;
  totalClubsInLeague: number;
  /** Leagues + cups this club has won, ever. Proven winners command better sponsorship — see
   *  computeClubPrestige and the STADIUM_NAMING "challenge offer" mechanic below. */
  titlesWon: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const ELITE_SQUAD_OVERALL = 90;
/** Below this a squad is not a professional one, and no sponsor is paying for the shirt. */
const SEMI_PRO_SQUAD_OVERALL = 45;
/** Titles beyond this count stop adding further prestige — a dynasty caps out, it doesn't compound forever. */
const TITLES_FOR_MAX_PRESTIGE = 5;

function computePrestigeFactors(inputs: ClubPrestigeInputs) {
  /**
   * Cubic, the same curve `calculateMarketValue` uses, and for the same reason: what a squad is worth
   * grows far faster than its average rating. Read linearly, the entire shipped world of 1.505 clubs fell
   * between 62,6 and 74,1 average overall, so every prestige landed between 0,538 and 0,641 — a spread of
   * 1,19x against wage bills that spread 3,3x. Sponsorship came out flat, and the smallest clubs ended up
   * richer than the biggest ones. A sponsor pays for the club it is putting its name on.
   */
  const squadFactor = clamp01(
    ((inputs.avgSquadOverall - SEMI_PRO_SQUAD_OVERALL) / (ELITE_SQUAD_OVERALL - SEMI_PRO_SQUAD_OVERALL)) ** 3,
  );
  const stadiumFactor = clamp01(inputs.stadiumLevel / STADIUM_LEVELS.length);
  const divisionFactor = clamp01(1 / Math.max(1, inputs.division));
  const positionFactor =
    inputs.leaguePosition && inputs.totalClubsInLeague > 0
      ? clamp01((inputs.totalClubsInLeague - inputs.leaguePosition + 1) / inputs.totalClubsInLeague)
      : 0.5;
  const standingFactor = (divisionFactor + positionFactor) / 2;
  const titlesFactor = clamp01(inputs.titlesWon / TITLES_FOR_MAX_PRESTIGE);
  return { squadFactor, stadiumFactor, standingFactor, titlesFactor };
}

export function computeClubPrestige(inputs: ClubPrestigeInputs): number {
  const { squadFactor, stadiumFactor, standingFactor, titlesFactor } = computePrestigeFactors(inputs);
  return clamp01(squadFactor * 0.35 + stadiumFactor * 0.25 + standingFactor * 0.25 + titlesFactor * 0.15);
}

function prestigeStars(inputs: ClubPrestigeInputs): number {
  return Math.round(computeClubPrestige(inputs) * 5);
}

export interface StadiumUpgradeBenefit {
  level: number;
  capacity: number;
  publicoMedio: number;
  receitaPorJogo: number;
  /** 0-5, same star scale the sponsorship screen uses for "porte do clube". */
  prestigeStars: number;
}

export interface StadiumUpgradePreview {
  current: StadiumUpgradeBenefit;
  next:
    | (StadiumUpgradeBenefit & {
        upgradeCost: number;
        constructionWeeks: number;
        paybackMatches: number | null;
      })
    | null;
  nextReform?: StadiumSubReformConfig | null;
  tierReforms?: StadiumSubReformConfig[];
  currentStep?: number;
}

/**
 * Matchday benefits of the stadium's current level vs. the next one, for the "Reforma de Estádio" screen's
 * benefits panel and financial-impact card. Público médio and receita por jogo use the same flat attendance
 * rate as the real weekly tick (developmentService.advanceWeek calls calculateStadiumRevenue with no rate
 * override) rather than the form-aware calculateAttendanceRate — showing a form-boosted figure here would
 * make the payback estimate look better than what the club will actually collect for any side that isn't
 * sitting exactly mid-table.
 */
export function previewStadiumUpgrade(
  stadiumLevel: number,
  prestige: ClubPrestigeInputs,
  currentStep: number = 0,
  currentCapacity?: number
): StadiumUpgradePreview {
  const currentInfo = getStadiumLevelInfo(stadiumLevel);
  if (!currentInfo) {
    throw new Error(`Nível de estádio desconhecido: ${stadiumLevel}`);
  }

  const effectiveCapacity = currentCapacity ?? currentInfo.capacity;

  const current: StadiumUpgradeBenefit = {
    level: currentInfo.level,
    capacity: effectiveCapacity,
    publicoMedio: Math.round(effectiveCapacity * ATTENDANCE_RATE),
    receitaPorJogo: calculateStadiumRevenue(effectiveCapacity),
    prestigeStars: prestigeStars(prestige),
  };

  const nextInfo = getNextStadiumLevel(stadiumLevel);
  const nextReform = getNextStadiumReform(stadiumLevel, currentStep);
  const activeTier = nextReform ? nextReform.tier : stadiumLevel;
  const tierReforms = getStadiumSubReforms(activeTier);

  if (!nextInfo && !nextReform) {
    return { current, next: null, nextReform: null, tierReforms: [], currentStep };
  }

  const targetCapacity = nextInfo ? nextInfo.capacity : effectiveCapacity;
  const receitaPorJogo = calculateStadiumRevenue(targetCapacity);
  const revenueGainPerMatch = receitaPorJogo - current.receitaPorJogo;

  return {
    current,
    next: nextInfo
      ? {
          level: nextInfo.level,
          capacity: nextInfo.capacity,
          publicoMedio: Math.round(nextInfo.capacity * ATTENDANCE_RATE),
          receitaPorJogo,
          prestigeStars: prestigeStars({ ...prestige, stadiumLevel: nextInfo.level }),
          upgradeCost: nextInfo.upgradeCost,
          constructionWeeks: nextInfo.constructionWeeks,
          paybackMatches: revenueGainPerMatch > 0 ? Math.ceil(nextInfo.upgradeCost / revenueGainPerMatch) : null,
        }
      : null,
    nextReform,
    tierReforms,
    currentStep,
  };
}

interface SponsorTier {
  label: string;
  /** This tier is in play once the type's typeScore reaches this threshold (0..1) — tiers are checked
   *  highest-first, so a club lands in the best tier it qualifies for. */
  minScore: number;
  names: string[];
}

interface SponsorTypeDef {
  type: SponsorshipType;
  label: string;
  names: string[];
  minWeekly: number;
  maxWeekly: number;
  /** How much each prestige component drives this type's value — sums to 1. Naming rights leans on the
   *  stadium itself; a kit supplier cares mostly about squad quality; a small regional sponsor mostly
   *  wants a winning team to attach its name to. */
  weights: { squad: number; stadium: number; standing: number; titles: number };
  /** When set, the sponsor name is drawn from the highest tier this club's typeScore qualifies for
   *  instead of uniformly from the full `names` pool — e.g. KIT_SUPPLIER's "Top Mundial" vs. regional
   *  brands. Sorted highest minScore first. */
  tiers?: SponsorTier[];
  /** When set, this type ignores CONTRACT_LENGTHS and draws weeksRemaining uniformly from this range
   *  instead — STADIUM_NAMING deals run much longer than a typical shirt/regional sponsorship. */
  fixedContractWeeks?: [number, number];
}

/** Exactly 5 sponsorship types a club can hold at once — one Master (main shirt) plus four supporting
 *  deals, the same shape as a real professional club's sponsor board. */
export const SPONSOR_TYPES: SponsorTypeDef[] = [
  {
    type: 'MASTER',
    label: 'Patrocinador Master',
    // names is derived from tiers below (flattened) so the two never drift apart.
    names: [],
    minWeekly: 20_000,
    maxWeekly: 150_000,
    weights: { squad: 0.35, stadium: 0.25, standing: 0.25, titles: 0.15 },
    tiers: [
      {
        // Only interested in elite clubs: top of the table, traditional, chasing titles and continental spots.
        label: 'Elite Global',
        minScore: 0.66,
        names: [
          'Aerolux Airways', 'Banco Meridian Global', 'Zafiro Seguros Internacional',
          'Petro Vanguard Energy', 'Skyline Telecom Global', 'Orion Motors',
        ],
      },
      {
        // Traditional first-division clubs, mid-table upwards, with a solid support base.
        label: 'Continental Renomado',
        minScore: 0.33,
        names: [
          'Banco Confiança Continental', 'Seguradora Vitalis Corp', 'TeleConecta Corp',
          'Grupo Fortaleza Holdings', 'Energetica Aurora', 'Vetor Financeiro',
        ],
      },
      {
        // Smaller top-flight clubs, or second-division sides on the way up chasing national visibility.
        label: 'Nacional Emergente',
        minScore: 0,
        names: [
          'Banco Progresso Nacional', 'Seguradora Bússola', 'ConectaMais Telecom',
          'Grupo Cimeira Nacional', 'Energia Cardinal', 'Financeira Ponte',
        ],
      },
    ],
  },
  {
    type: 'KIT_SUPPLIER',
    label: 'Fornecedor Esportivo',
    // names is derived from tiers below (flattened) so the two never drift apart.
    names: [],
    minWeekly: 12_000,
    maxWeekly: 90_000,
    weights: { squad: 0.45, stadium: 0.15, standing: 0.25, titles: 0.15 },
    tiers: [
      {
        label: 'Top Mundial',
        minScore: 0.66,
        names: ['Titan Sport', 'Apex Athletics', 'Vortex Athletic', 'Zenit Sports', 'Prisma Sportswear', 'Condor Sports'],
      },
      {
        label: 'Nacional',
        minScore: 0.33,
        names: ['Rincon Sports', 'Elite Wear', 'Maxima Sportswear', 'Braza Athletic', 'Impacto Athletic', 'Fenix Sport'],
      },
      {
        // A club's first ever kit deal.
        label: 'Regional',
        minScore: 0,
        names: ['Furia Esportes', 'Rasante Esportivo', 'Trinca Sports', 'Garra Esportes', 'Raio Esportivo', 'Vigor Sports'],
      },
    ],
  },
  {
    type: 'STADIUM_NAMING',
    label: 'Naming Rights do Estádio',
    // Three thematic families rather than tiers — a naming-rights deal is gated by the stadium itself
    // (see `weights` below), not by which sector the brand happens to be in.
    names: [
      // Construtoras (12)
      'Construtora Basalto', 'Construtora Litoral', 'Construtora Substrato',
      'Construtora Coluna', 'Construtora Marco Real', 'Construtora Terraprima',
      'Construtora Vértice', 'Construtora Bastião', 'Construtora Cruzeta Industrial',
      'Construtora Amanhecer', 'Construtora Omega Prime', 'Construtora Ápice',
      // Energia (12)
      'Energia Girassol', 'Energia Turbovento', 'Energia Solstício',
      'Energia Facho', 'Energia Pás do Vento', 'Energia Centelha',
      'Energia Tempestade', 'Energia Alvorada', 'Energia Faísca Nova',
      'Energia Disco Solar', 'Energia Pulso', 'Energia Folha Pura',
      // Telecom (9)
      'Telecom Sinal Estelar', 'Telecom Elo', 'Telecom Vínculo',
      'Telecom Alto Sinal', 'Telecom Órbita Prime', 'Telecom Travessia',
      'Telecom Alvorada Leste', 'Telecom Estrela Guia', 'Telecom Cruzeiro',
    ],
    minWeekly: 10_000,
    maxWeekly: 80_000,
    weights: { squad: 0.05, stadium: 0.65, standing: 0.15, titles: 0.15 },
    // A naming-rights deal is a plurianual branding commitment, not a regular sponsorship term.
    fixedContractWeeks: [40, 60],
  },
  {
    type: 'REGIONAL',
    label: 'Patrocinador Regional',
    names: [
      'AutoPeças Serrano', 'Bebidas Glacial', 'Mercado Preço Bom', 'Farmácia Vidalis', 'Padaria Espiga Dourada',
      'AutoCenter Trajeto', 'Distribuidora Tempero', 'Mercadinho Poupança', 'Bebidas Correnteza', 'AutoPeças Giro',
      'Farmácia Popular Saúde', 'Mercado Praça Central', 'Distribuidora Verde Campo', 'Bebidas Nascente Azul',
      'AutoPeças Pistão', 'Mercadão da Vila', 'Farmácia Viver Bem', 'Padaria Fornalha',
    ],
    minWeekly: 8_000,
    maxWeekly: 60_000,
    weights: { squad: 0.25, stadium: 0.25, standing: 0.35, titles: 0.15 },
  },
  {
    type: 'TECH_EQUIPMENT',
    label: 'Parceiro de Tecnologia',
    names: [
      'CircuitoByte', 'FitNano Performance', 'GolData Analytics', 'PulsoTech Sports', 'RotaVetor',
      'RadarSense Analytics', 'CampoCode Sports', 'GolMétrica', 'NeuroCampo Tech', 'QuantoJogo',
      'DadosSprint', 'HiperPreparo Systems', 'DadoTático', 'VisãoCampo Sports', 'AgilidadeTech',
      'LabDesempenho', 'EstatísticaTop', 'SincroniaSkill',
    ],
    minWeekly: 5_000,
    maxWeekly: 37_500,
    weights: { squad: 0.25, stadium: 0.15, standing: 0.45, titles: 0.15 },
  },
];

// KIT_SUPPLIER's names come from its tiers — populate the flat pool once, right after SPONSOR_TYPES exists.
for (const typeDef of SPONSOR_TYPES) {
  if (typeDef.tiers) typeDef.names = typeDef.tiers.flatMap((t) => t.names);
}

export function getSponsorTypeDef(type: SponsorshipType): SponsorTypeDef {
  const def = SPONSOR_TYPES.find((t) => t.type === type);
  if (!def) throw new Error(`Tipo de patrocínio desconhecido: ${type}`);
  return def;
}

interface ContractLengthDef {
  key: ContractLength;
  label: string;
  minWeeks: number;
  maxWeeks: number;
  /** Shorter deals pay a premium rate for the flexibility; longer deals trade a lower weekly rate for
   *  a long guaranteed run — the same trade-off a real shirt-sponsor negotiation would have. */
  rateMultiplier: number;
}

export const CONTRACT_LENGTHS: ContractLengthDef[] = [
  { key: 'CURTO', label: 'Curto prazo', minWeeks: 10, maxWeeks: 15, rateMultiplier: 1.15 },
  { key: 'MEDIO', label: 'Médio prazo', minWeeks: 20, maxWeeks: 30, rateMultiplier: 1.0 },
  { key: 'LONGO', label: 'Longo prazo', minWeeks: 35, maxWeeks: 52, rateMultiplier: 0.85 },
];

/** One-off achievement bonuses, sized as a multiple of the deal's own weekly rate — a title clause on a
 *  fat Master contract is worth far more than the same clause on a small regional deal. */
const TITLE_BONUS_WEEKS_EQUIVALENT = 20;
const CUP_BONUS_WEEKS_EQUIVALENT = 12;

function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

function computeTypeScore(prestige: ClubPrestigeInputs, typeDef: SponsorTypeDef): number {
  const { squadFactor, stadiumFactor, standingFactor, titlesFactor } = computePrestigeFactors(prestige);
  return clamp01(
    squadFactor * typeDef.weights.squad +
      stadiumFactor * typeDef.weights.stadium +
      standingFactor * typeDef.weights.standing +
      titlesFactor * typeDef.weights.titles,
  );
}

/** Picks a sponsor name for this type/score — from the highest tier the score qualifies for, or
 *  uniformly from the flat pool when the type has no tiers. Avoids duplicate names across active offers. */
function pickSponsorName(
  rng: () => number,
  typeDef: SponsorTypeDef,
  typeScore: number,
  usedNames?: Set<string>,
): { sponsorName: string; sponsorTier?: string } {
  if (typeDef.tiers) {
    const qualifiedTierIndex = typeDef.tiers.findIndex((t) => typeScore >= t.minScore);
    const startIndex = qualifiedTierIndex !== -1 ? qualifiedTierIndex : typeDef.tiers.length - 1;

    // Try finding an unused name starting from the qualified tier, falling back to other tiers
    for (let offset = 0; offset < typeDef.tiers.length; offset++) {
      const tierIndex = (startIndex + offset) % typeDef.tiers.length;
      const tier = typeDef.tiers[tierIndex];
      const available = tier.names.filter((n) => !usedNames?.has(n));
      if (available.length > 0) {
        const picked = available[Math.floor(rng() * available.length)];
        usedNames?.add(picked);
        return { sponsorName: picked, sponsorTier: tier.label };
      }
    }

    // If all tier names are already used, pick with replacement from the qualified tier
    const fallbackTier = typeDef.tiers[startIndex];
    const picked = fallbackTier.names[Math.floor(rng() * fallbackTier.names.length)];
    usedNames?.add(picked);
    return { sponsorName: picked, sponsorTier: fallbackTier.label };
  }

  const available = typeDef.names.filter((n) => !usedNames?.has(n));
  const pool = available.length > 0 ? available : typeDef.names;
  const picked = pool[Math.floor(rng() * pool.length)];
  usedNames?.add(picked);
  return { sponsorName: picked };
}

function generateGoalsForOffer(
  typeDef: SponsorTypeDef,
  profile: SponsorProfile,
  typeScore: number,
  weeklyAmount: number,
  prestige: ClubPrestigeInputs,
): SponsorGoal[] {
  const goals: SponsorGoal[] = [];
  const division = prestige.division ?? 1;
  const isTopFlight = division === 1;

  if (profile === 'ESTAVEL') {
    if (isTopFlight) {
      if (typeScore > 0.55) {
        goals.push({
          id: `goal-pos-${Date.now()}-1`,
          type: 'LEAGUE_POSITION',
          title: 'Classificação no Top 8',
          description: 'Terminar o campeonato nacional entre os 8 primeiros colocados.',
          targetValue: 8,
          reward: roundToThousand(weeklyAmount * 6),
          isCompleted: false,
        });
      } else {
        goals.push({
          id: `goal-relegation-${Date.now()}-1`,
          type: 'AVOID_RELEGATION',
          title: 'Permanência Garantida',
          description: 'Evitar o rebaixamento e assegurar a permanência na 1ª Divisão.',
          targetValue: 16,
          reward: roundToThousand(weeklyAmount * 5),
          isCompleted: false,
        });
      }
    } else {
      goals.push({
        id: `goal-pos-${Date.now()}-1`,
        type: 'LEAGUE_POSITION',
        title: 'Luta pelo Acesso (G4)',
        description: 'Terminar a Série B no G4 e garantir vaga na elite.',
        targetValue: 4,
        reward: roundToThousand(weeklyAmount * 8),
        isCompleted: false,
      });
    }
  } else if (profile === 'PERFORMANCE') {
    if (isTopFlight) {
      if (typeScore > 0.55) {
        goals.push({
          id: `goal-pos-${Date.now()}-1`,
          type: 'LEAGUE_POSITION',
          title: 'Vaga na Libertadores (G4)',
          description: 'Terminar o campeonato no G4 da tabela de classificação.',
          targetValue: 4,
          reward: roundToThousand(weeklyAmount * 12),
          isCompleted: false,
        });
        goals.push({
          id: `goal-cup-${Date.now()}-2`,
          type: 'CUP_STAGE',
          title: 'Semifinal da Copa',
          description: 'Alcançar ao menos as semifinais na Copa nacional.',
          targetValue: 3,
          reward: roundToThousand(weeklyAmount * 8),
          isCompleted: false,
        });
      } else {
        goals.push({
          id: `goal-pos-${Date.now()}-1`,
          type: 'LEAGUE_POSITION',
          title: 'Vaga Continental (G8 / Sul-Americana)',
          description: 'Terminar no G8 e garantir vaga em competição continental.',
          targetValue: 8,
          reward: roundToThousand(weeklyAmount * 10),
          isCompleted: false,
        });
        goals.push({
          id: `goal-goals-${Date.now()}-2`,
          type: 'GOALS_SCORED',
          title: 'Ataque Positivo (35+ Gols)',
          description: 'Marcar 35 ou mais gols na edição da liga.',
          targetValue: 35,
          reward: roundToThousand(weeklyAmount * 6),
          isCompleted: false,
        });
      }
    } else {
      goals.push({
        id: `goal-pos-${Date.now()}-1`,
        type: 'LEAGUE_POSITION',
        title: 'Acesso à 1ª Divisão',
        description: 'Terminar no G4 da Série B.',
        targetValue: 4,
        reward: roundToThousand(weeklyAmount * 10),
        isCompleted: false,
      });
      goals.push({
        id: `goal-goals-${Date.now()}-2`,
        type: 'GOALS_SCORED',
        title: 'Ataque Goleador (35+ Gols)',
        description: 'Marcar 35 ou mais gols na Série B.',
        targetValue: 35,
        reward: roundToThousand(weeklyAmount * 5),
        isCompleted: false,
      });
    }
  } else if (profile === 'MECENAS') {
    goals.push({
      id: `goal-pos-${Date.now()}-1`,
      type: 'LEAGUE_POSITION',
      title: isTopFlight ? 'Briga Direta pelo Título (G3)' : 'Campeão da Série B',
      description: isTopFlight ? 'Terminar no Top 3 do campeonato.' : 'Conquistar o título da Série B.',
      targetValue: isTopFlight ? 3 : 1,
      reward: roundToThousand(weeklyAmount * 16),
      isCompleted: false,
    });
    goals.push({
      id: `goal-cup-${Date.now()}-2`,
      type: 'CUP_STAGE',
      title: 'Decisão na Copa (Finalista)',
      description: 'Chegar à grande final da Copa nacional.',
      targetValue: 2,
      reward: roundToThousand(weeklyAmount * 12),
      isCompleted: false,
    });
  } else {
    goals.push({
      id: `goal-att-${Date.now()}-1`,
      type: 'AVERAGE_ATTENDANCE',
      title: 'Estádio Pulsante (Média 65%+)',
      description: 'Manter ocupação média do estádio superior a 65% na temporada.',
      targetValue: 65,
      reward: roundToThousand(weeklyAmount * 6),
      isCompleted: false,
    });
  }

  return goals;
}

function pickContractTerms(
  rng: () => number,
  typeDef: SponsorTypeDef,
  profile: SponsorProfile = 'ESTAVEL',
): { weeksRemaining: number; contractLength: ContractLength; rateMultiplier: number } {
  if (typeDef.fixedContractWeeks) {
    const [minWeeks, maxWeeks] = typeDef.fixedContractWeeks;
    return { weeksRemaining: Math.round(minWeeks + rng() * (maxWeeks - minWeeks)), contractLength: 'LONGO', rateMultiplier: 1 };
  }

  if (profile === 'ESTAVEL') {
    const contractDef = CONTRACT_LENGTHS.find((c) => c.key === 'LONGO') ?? CONTRACT_LENGTHS[2];
    return {
      weeksRemaining: Math.round(contractDef.minWeeks + rng() * (contractDef.maxWeeks - contractDef.minWeeks)),
      contractLength: 'LONGO',
      rateMultiplier: 1.15,
    };
  } else if (profile === 'PERFORMANCE') {
    const contractDef = CONTRACT_LENGTHS.find((c) => c.key === 'MEDIO') ?? CONTRACT_LENGTHS[1];
    return {
      weeksRemaining: Math.round(contractDef.minWeeks + rng() * (contractDef.maxWeeks - contractDef.minWeeks)),
      contractLength: 'MEDIO',
      rateMultiplier: 1.0,
    };
  } else if (profile === 'MECENAS') {
    const contractDef = CONTRACT_LENGTHS.find((c) => c.key === 'MEDIO') ?? CONTRACT_LENGTHS[1];
    return {
      weeksRemaining: Math.round(contractDef.minWeeks + rng() * (contractDef.maxWeeks - contractDef.minWeeks)),
      contractLength: 'MEDIO',
      rateMultiplier: 0.95,
    };
  }

  const contractDef = CONTRACT_LENGTHS[Math.floor(rng() * CONTRACT_LENGTHS.length)];
  return {
    weeksRemaining: Math.round(contractDef.minWeeks + rng() * (contractDef.maxWeeks - contractDef.minWeeks)),
    contractLength: contractDef.key,
    rateMultiplier: contractDef.rateMultiplier,
  };
}

function buildOffer(
  id: string,
  rng: () => number,
  prestige: ClubPrestigeInputs,
  typeDef: SponsorTypeDef,
  profile: SponsorProfile = 'ESTAVEL',
  usedNames?: Set<string>,
  managerStyle?: ManagerStyleId | string | null,
): Sponsorship {
  const typeScore = computeTypeScore(prestige, typeDef);
  const { weeksRemaining, contractLength, rateMultiplier } = pickContractTerms(rng, typeDef, profile);
  const baseWeekly = typeDef.minWeekly + typeScore * (typeDef.maxWeekly - typeDef.minWeekly);
  let weeklyAmount = roundToThousand(baseWeekly * rateMultiplier);
  const { sponsorName, sponsorTier } = pickSponsorName(rng, typeDef, typeScore, usedNames);

  let signingBonus = 0;
  if (profile === 'MECENAS') {
    // Aporte maciço de contratação: no Master vai de R$ 3M a R$ 25M; nos demais de R$ 1M a R$ 8M
    const multiplier = typeDef.type === 'MASTER' ? (typeScore > 0.6 ? 35 : 22) : (typeScore > 0.6 ? 20 : 12);
    signingBonus = roundToThousand(weeklyAmount * multiplier);
  } else if (profile === 'PERFORMANCE') {
    // Aporte moderado de contratação
    signingBonus = roundToThousand(weeklyAmount * (typeDef.type === 'MASTER' ? 10 : 6));
  } else {
    // Aporte padrão / luvas de assinatura
    signingBonus = roundToThousand(weeklyAmount * 3);
  }

  const styleBoosted = applySponsorshipStyleBonus(weeklyAmount, signingBonus, managerStyle);
  weeklyAmount = styleBoosted.weeklyAmount;
  signingBonus = styleBoosted.signingBonus;

  let craqueFund: number | undefined;
  if (typeDef.type === 'MASTER' && (profile === 'MECENAS' || profile === 'PERFORMANCE')) {
    if (sponsorTier === 'Elite Global') {
      craqueFund = 20_000_000;
    } else if (sponsorTier === 'Continental Renomado') {
      craqueFund = 8_000_000;
    }
  }

  const goals = generateGoalsForOffer(typeDef, profile, typeScore, weeklyAmount, prestige);

  return {
    id,
    type: typeDef.type,
    sponsorName,
    weeklyAmount,
    weeksRemaining,
    contractLength,
    titleBonus: roundToThousand(weeklyAmount * TITLE_BONUS_WEEKS_EQUIVALENT),
    cupBonus: roundToThousand(weeklyAmount * CUP_BONUS_WEEKS_EQUIVALENT),
    signingBonus,
    sponsorProfile: profile,
    goals,
    ...(sponsorTier ? { sponsorTier } : {}),
    ...(craqueFund ? { craqueFund, craqueFundRemaining: craqueFund } : {}),
  };
}

/**
 * Multiple candidate offers per sponsorship type this club doesn't already hold (see MAX_SPONSORSHIPS /
 * SPONSOR_TYPES). Generates 3 diverse competing offers per slot (e.g. Stable, Performance, Mecenas).
 * Guarantees distinct sponsor companies per offer list.
 */
export function generateSponsorshipOffers(
  rng: () => number,
  prestige: ClubPrestigeInputs,
  activeTypes: SponsorshipType[] = [],
  offersPerType: number = 3,
  existingSponsorNames: string[] = [],
  managerStyle?: ManagerStyleId | string | null,
): Sponsorship[] {
  const availableTypes = SPONSOR_TYPES.filter((t) => !activeTypes.includes(t.type));
  const profiles: SponsorProfile[] = ['ESTAVEL', 'PERFORMANCE', 'MECENAS'];
  const usedNames = new Set<string>(existingSponsorNames);

  const offers: Sponsorship[] = [];
  for (const typeDef of availableTypes) {
    for (let i = 0; i < offersPerType; i++) {
      const profile = profiles[i % profiles.length];
      offers.push(buildOffer(`offer-${typeDef.type}-${profile}-${i}`, rng, prestige, typeDef, profile, usedNames, managerStyle));
    }
  }

  /**
   * And one rival for each slot already taken.
   *
   * Without these the negotiation table is a list of vacancies: a club holding four of five sponsors was
   * shown offers for the one empty slot and nothing else, so there was never a deal to weigh against a deal.
   * A competitor bidding for a shirt somebody else is already on is the ordinary case in football, and it is
   * the only thing that makes the table a negotiation rather than a shopping list.
   *
   * One per slot, not three: this is a decision about whether to break a running contract, and three
   * near-identical versions of it would bury the contract it is competing with.
   */
  for (const typeDef of SPONSOR_TYPES.filter((t) => activeTypes.includes(t.type))) {
    const rival = buildOffer(`rival-${typeDef.type}`, rng, prestige, typeDef, 'PERFORMANCE', usedNames, managerStyle);
    offers.push({ ...rival, isReplacement: true });
  }

  return offers;
}

/**
 * The order clubs win sponsors in. A club of any size has a shirt on its back; only a big one sells the
 * name of its ground.
 */
const SPONSOR_BOARD_PRIORITY: SponsorshipType[] = ['MASTER', 'KIT_SUPPLIER', 'REGIONAL', 'TECH_EQUIPMENT', 'STADIUM_NAMING'];

/**
 * The sponsor board a club nobody manages would already have.
 *
 * Sponsorship is by far the largest income a club has. But `signSponsorship` requires the requesting user
 * to own the club, and every club is created with an empty board, so no computer-run club has ever held a
 * single deal. Measured across the 1.505 clubs in the shipped database, that left the median club losing
 * R$ 151.000 a week with only 31% of the world solvent, propped up by a cash floor that hid it.
 *
 * How many deals a club holds follows the size of its ground. Ground size is not a proxy chosen for
 * convenience: it is the only thing that genuinely separates clubs in the shipped database, which runs from
 * 2.000 to 99.354 seats while every squad averages between 62 and 74 overall and no club has won anything
 * yet. Prestige, which reads mostly squad and standing, lands between 0,32 and 0,45 across the entire
 * world — too flat to tell a giant from a village side. What each deal is worth still comes from prestige,
 * so quality is paid for; only the size of the board comes from the stands.
 *
 * It counts seats rather than `stadiumLevel` because the upgrade ladder is far too coarse to sponsor by:
 * level 2 covers everything from 15.000 to 39.999 seats, which is 1.287 of the 1.526 clubs in one bucket.
 * The ladder is roughly geometric, so the count follows it geometrically too, a deal for every tripling.
 *
 * These are contracts already in progress, not a windfall: the term is part spent so the board does not
 * expire all at once, no signing bonus is paid, and the rate carries none of the premium a manager gets for
 * negotiating. Goals are left off, since nothing would ever evaluate them for a club the computer runs.
 */
export function buildSponsorBoard(
  rng: () => number,
  prestige: ClubPrestigeInputs,
  stadiumCapacity: number,
): Sponsorship[] {
  const smallest = STADIUM_LEVELS[0].capacity;
  const triplings = Math.log(Math.max(smallest, stadiumCapacity) / smallest) / Math.log(3);
  const deals = Math.max(1, Math.min(MAX_SPONSORSHIPS, Math.round(triplings) + 1));

  return SPONSOR_BOARD_PRIORITY.slice(0, deals).flatMap((type) => {
    const typeDef = SPONSOR_TYPES.find((t) => t.type === type);
    if (!typeDef) return [];

    const offer = buildOffer(`board-${type}`, rng, prestige, typeDef, 'REGIONAL_TRADICAO');
    const { signingBonus: _bonus, craqueFund: _fund, craqueFundRemaining: _left, ...deal } = offer;

    return [{ ...deal, goals: [], weeksRemaining: Math.max(4, Math.round(offer.weeksRemaining * (0.2 + rng() * 0.8))) }];
  });
}

/**
 * Mid-season lucrative poaching offers generated when a club is performing above expectations
 * (e.g. sitting in the Top 4). Rival brands propose breaking the existing deal with higher payouts.
 */
export function generateMidSeasonSponsorshipOffers(
  rng: () => number,
  prestige: ClubPrestigeInputs,
  activeSponsorships: Sponsorship[],
  leaguePosition: number | null,
): Sponsorship[] {
  if (leaguePosition === null || leaguePosition > 4 || activeSponsorships.length === 0) {
    return [];
  }

  const usedNames = new Set<string>(activeSponsorships.map((s) => s.sponsorName));
  const offers: Sponsorship[] = [];
  const eligibleTypes: SponsorshipType[] = ['MASTER', 'KIT_SUPPLIER'];

  for (const s of activeSponsorships) {
    if (!eligibleTypes.includes(s.type)) continue;
    // Evita loop infinito: se este contrato já veio de um assédio (poaching) no ciclo atual, não assedia novamente
    if (s.isPoachOffer) continue;

    const typeDef = getSponsorTypeDef(s.type);
    const poachOffer = buildOffer(`poach-${s.type}-${Date.now()}`, rng, prestige, typeDef, 'MECENAS', usedNames);
    const boostMultiplier = 1.35 + rng() * 0.25;
    const targetAmount = roundToThousand(s.weeklyAmount * boostMultiplier);
    const marketCap = roundToThousand(typeDef.maxWeekly * 1.3);

    // Se o valor já estiver no teto de mercado ou a proposta não superar o atual, não gera
    const finalWeekly = Math.min(targetAmount, marketCap);
    if (finalWeekly <= s.weeklyAmount) continue;

    poachOffer.weeklyAmount = finalWeekly;
    poachOffer.signingBonus = roundToThousand(poachOffer.weeklyAmount * (typeDef.type === 'MASTER' ? 12 : 8));
    poachOffer.isPoachOffer = true;
    poachOffer.replacedSponsorName = s.sponsorName;
    offers.push(poachOffer);
  }

  return offers;
}

export interface GoalEvaluationContext {
  leaguePosition?: number;
  totalClubsInLeague?: number;
  isChampion?: boolean;
  isRelegated?: boolean;
  cupRoundReached?: number;
  totalCupRounds?: number;
  isCupChampion?: boolean;
  totalGoalsScored?: number;
  homeUnbeatenStreak?: number;
  averageAttendanceRate?: number;
}

/**
 * Evaluates performance clauses across all active sponsorships against current season outcomes.
 */
export function evaluateSponsorGoals(
  sponsorships: Sponsorship[],
  context: GoalEvaluationContext,
): { updatedSponsorships: Sponsorship[]; totalRewardEarned: number; newlyCompletedGoals: { sponsorName: string; goal: SponsorGoal }[] } {
  let totalRewardEarned = 0;
  const newlyCompletedGoals: { sponsorName: string; goal: SponsorGoal }[] = [];

  const updatedSponsorships = sponsorships.map((s) => {
    if (!s.goals || s.goals.length === 0) return s;

    const updatedGoals = s.goals.map((g) => {
      if (g.isCompleted || g.isFailed) return g;

      let achieved = false;
      let failed = false;
      let currentVal = g.currentValue ?? 0;

      switch (g.type) {
        case 'LEAGUE_POSITION':
          if (context.leaguePosition !== undefined) {
            currentVal = context.leaguePosition;
            if (context.leaguePosition <= g.targetValue) achieved = true;
          }
          break;
        case 'AVOID_RELEGATION':
          if (context.isRelegated !== undefined) {
            if (!context.isRelegated) achieved = true;
            else failed = true;
          }
          break;
        case 'CUP_STAGE':
          if (context.cupRoundReached !== undefined) {
            currentVal = context.cupRoundReached;
            if (context.cupRoundReached >= g.targetValue || context.isCupChampion) achieved = true;
          }
          break;
        case 'GOALS_SCORED':
          if (context.totalGoalsScored !== undefined) {
            currentVal = context.totalGoalsScored;
            if (context.totalGoalsScored >= g.targetValue) achieved = true;
          }
          break;
        case 'HOME_UNBEATEN_STREAK':
          if (context.homeUnbeatenStreak !== undefined) {
            currentVal = context.homeUnbeatenStreak;
            if (context.homeUnbeatenStreak >= g.targetValue) achieved = true;
          }
          break;
        case 'AVERAGE_ATTENDANCE':
          if (context.averageAttendanceRate !== undefined) {
            currentVal = Math.round(context.averageAttendanceRate * 100);
            if (currentVal >= g.targetValue) achieved = true;
          }
          break;
      }

      if (achieved) {
        totalRewardEarned += g.reward;
        newlyCompletedGoals.push({ sponsorName: s.sponsorName, goal: { ...g, isCompleted: true, currentValue: currentVal } });
        return { ...g, isCompleted: true, currentValue: currentVal };
      }
      return { ...g, currentValue: currentVal, isFailed: failed };
    });

    return { ...s, goals: updatedGoals };
  });

  return { updatedSponsorships, totalRewardEarned, newlyCompletedGoals };
}

/**
 * A rival bid for a STADIUM_NAMING deal the club already holds — only surfaces once the club has proven
 * itself with at least one title (see ClubPrestigeInputs.titlesWon), and always outbids what a fresh offer
 * would pay (up to +45% at 3+ titles) to feel like real outside interest, not a random reroll. Signing it
 * (see financeService.signSponsorship) replaces the current naming-rights deal instead of stacking.
 */
export function generateNamingRightsChallengeOffer(
  rng: () => number,
  prestige: ClubPrestigeInputs,
  titlesWon: number,
): Sponsorship | null {
  if (titlesWon <= 0) return null;
  const typeDef = getSponsorTypeDef('STADIUM_NAMING');
  const offer = buildOffer(`challenge-STADIUM_NAMING-${titlesWon}`, rng, prestige, typeDef);
  const boostMultiplier = 1 + Math.min(titlesWon, 3) * 0.15;
  return {
    ...offer,
    weeklyAmount: roundToThousand(offer.weeklyAmount * boostMultiplier),
    isChallenge: true,
  };
}

/** The stadium's display name while a STADIUM_NAMING deal is active — purely derived from the current
 *  sponsorships, so it needs no persisted field and naturally reverts once the deal expires (sponsorships
 *  already drop off the list on expiry — see developmentService.advanceWeek). */
export function stadiumDisplayName(sponsorships: Sponsorship[]): string | null {
  const naming = sponsorships.find((s) => s.type === 'STADIUM_NAMING');
  return naming ? `Arena ${naming.sponsorName}` : null;
}

/**
 * Concrete prize table for a 20-club top flight, halved for every division below it (division 2 pays
 * half of division 1's amounts, division 3 a quarter, and so on) — so climbing the pyramid is worth
 * real money, not just prestige.
 *
 * It had eight rows, because the top flight had eight clubs. `calculatePrizeMoney` clamps to the length
 * of this table, so once the league grew to twenty every club from ninth down was paid the same: ninth
 * place and last place earned the identical eighty thousand, and half the table had nothing to play for
 * after the title race was gone. The first eight figures are untouched — they were calibrated against
 * the rest of the economy — and the tail simply continues the same decay.
 */
const LEAGUE_PRIZE_BY_POSITION: number[] = [
  2_000_000, 1_200_000, 800_000, 500_000, 300_000, 200_000, 120_000, 80_000,
  70_000, 62_000, 55_000, 48_000, 42_000, 36_000, 31_000, 26_000, 22_000, 18_000, 15_000, 12_000,
];

/** League prize money for a final table position, scaled down by division. */
export function calculatePrizeMoney(position: number, division: number = 1): number {
  const index = Math.min(Math.max(position, 1), LEAGUE_PRIZE_BY_POSITION.length) - 1;
  const base = LEAGUE_PRIZE_BY_POSITION[index];
  return roundToThousand(base / Math.max(1, division));
}

/**
 * The season's television money, paid once at the turn of the year.
 *
 * It exists because of a hole the calendar opened. The season runs April to December, so a club spends
 * roughly thirteen weeks between seasons with wages, maintenance and loan repayments going out and not a
 * single gate receipt coming in. A measured club burns about R$ 166 thousand a week, so those weeks cost
 * a little over two million with nothing to set against them: without this, every club in the world
 * would start each season poorer than it finished the last one, forever.
 *
 * Sized to cover that gap with room to spare for a top-flight club, and halved per division below, on
 * the same principle as the prize table — the pyramid is worth climbing.
 */
export const TV_MONEY_TOP_DIVISION = 3_000_000;

export function calculateTvMoney(division: number = 1): number {
  return roundToThousand(TV_MONEY_TOP_DIVISION / Math.max(1, division));
}

/** Cup prize money by stage reached — champion, runner-up, beaten semifinalist, or beaten quarterfinalist
 *  (any earlier round pays the same as a quarterfinal exit). */
export const CUP_PRIZE_CHAMPION = 1_500_000;
export const CUP_PRIZE_FINALIST = 700_000;
export const CUP_PRIZE_SEMIFINALIST = 350_000;
export const CUP_PRIZE_QUARTERFINALIST = 150_000;

export function calculateCupPrizeMoney(roundReached: number, totalRounds: number, isChampion: boolean): number {
  if (isChampion) return CUP_PRIZE_CHAMPION;
  const stagesShortOfFinal = totalRounds - roundReached;
  if (stagesShortOfFinal <= 0) return CUP_PRIZE_FINALIST;
  if (stagesShortOfFinal === 1) return CUP_PRIZE_SEMIFINALIST;
  return CUP_PRIZE_QUARTERFINALIST;
}

/**
 * ---------------------------------------------------------------------------
 * Margem de Pagamento por Combate / Premiação por Performance Coletiva
 * ---------------------------------------------------------------------------
 * Bonificações financeiras creditadas ao fim da partida com base no comportamento
 * tático, entrega coletiva, fair play e superação em campo.
 */

export interface CombatBonusInputs {
  events: MatchEvent[];
  mySide: MatchSide;
  myGoals: number;
  opponentGoals: number;
  pressRecoveries?: number;
  isUnderdog?: boolean;
}

export interface CombatBonusItem {
  id: string;
  label: string;
  description: string;
  amount: number;
}

export interface CombatBonusBreakdown {
  items: CombatBonusItem[];
  totalBonus: number;
}

export const COMBAT_BONUS_CONFIG = {
  CLEAN_SHEET: 25_000,
  HIGH_PRESS: 20_000,
  UNDERDOG: 35_000,
  FAIR_PLAY: 10_000,
  DOMINANT_MARGIN: 20_000,
} as const;

export function calculateCombatPerformanceBonus(inputs: CombatBonusInputs): CombatBonusBreakdown {
  const { events, mySide, myGoals, opponentGoals, pressRecoveries = 0, isUnderdog = false } = inputs;
  const items: CombatBonusItem[] = [];

  // 1. Baliza Inviolada (Clean Sheet Victory): vitória sem sofrer gols
  if (myGoals > opponentGoals && opponentGoals === 0) {
    items.push({
      id: 'CLEAN_SHEET',
      label: 'Baliza Inviolada (Clean Sheet)',
      description: 'Defesa sólida garantindo vitória sem sofrer gols.',
      amount: COMBAT_BONUS_CONFIG.CLEAN_SHEET,
    });
  }

  // 2. Pressão Alta e Combate Ativo: 5 ou mais recuperações de posse no terço final
  if (pressRecoveries >= 5) {
    items.push({
      id: 'HIGH_PRESS',
      label: 'Pressão Alta e Desarmes no Ataque',
      description: 'Intensidade e combatividade ofensiva (5+ desarmes/recuperações no terço final).',
      amount: COMBAT_BONUS_CONFIG.HIGH_PRESS,
    });
  }

  // 3. Resiliência do Azarão: vitória ou empate atuando como azarão
  if (isUnderdog && myGoals >= opponentGoals) {
    items.push({
      id: 'UNDERDOG_RESILIENCE',
      label: 'Superação do Azarão',
      description: 'Postura heroica conquistando pontos contra equipe teoricamente superior.',
      amount: COMBAT_BONUS_CONFIG.UNDERDOG,
    });
  }

  // 4. Prêmio de Fair Play: partida sem nenhuma expulsão direta/cartão vermelho do clube
  const hasRedCard = events.some(
    (e) => e.team === mySide && e.type === 'card' && Boolean(e.suspensionMatches && e.suspensionMatches > 0),
  );
  if (!hasRedCard) {
    items.push({
      id: 'FAIR_PLAY',
      label: 'Prêmio de Fair Play',
      description: 'Disciplina tática e conduta exemplar sem expulsões na partida.',
      amount: COMBAT_BONUS_CONFIG.FAIR_PLAY,
    });
  }

  // 5. Goleada e Supremacia Tática: vitória por 3 ou mais gols de diferença
  if (myGoals - opponentGoals >= 3) {
    items.push({
      id: 'DOMINANT_MARGIN',
      label: 'Goleada e Supremacia Tática',
      description: 'Vitória categórica com margem de 3 ou mais gols de diferença.',
      amount: COMBAT_BONUS_CONFIG.DOMINANT_MARGIN,
    });
  }

  const totalBonus = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    items,
    totalBonus,
  };
}


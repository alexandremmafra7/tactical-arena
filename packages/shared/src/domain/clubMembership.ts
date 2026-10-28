import { Club } from './club.js';

/**
 * CLUB MEMBERSHIP SYSTEM (SÓCIO-TORCEDOR)
 *
 * Modeled on real-world football membership programs (Avanti, Sócio Torcedor,
 * Sócio Colorado, Fiel Torcedor, Bayern Mitglieder, Barça Socios).
 */

export type MembershipTier = 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE' | 'ELITE_GLOBAL';

export interface MembershipTierDef {
  tier: MembershipTier;
  label: string;
  minMembers: number;
  weeklyFeePerMember: number; // in R$
  description: string;
}

/**
 * As mensalidades, medidas contra o resto da economia do jogo.
 *
 * Eram 8, 12, 15, 18 e 22, valores realistas por sócio e errados dentro deste jogo: um clube grande tem
 * 74.250 sócios, o que dava R$ 1.113.750 por semana contra R$ 209.000 de patrocínio. Cinco vezes e meia.
 * O patrocínio é a única receita que o técnico negocia, e ela ficaria decorativa ao lado de um número que
 * chega sozinho. Divididas por quatro, sócio e patrocínio ficam na mesma ordem de grandeza e as duas
 * decisões continuam valendo a pena.
 */
export const MEMBERSHIP_TIERS: MembershipTierDef[] = [
  { tier: 'BRONZE', label: 'Bronze', minMembers: 0, weeklyFeePerMember: 2, description: 'Plano Básico de Apoio' },
  { tier: 'PRATA', label: 'Prata', minMembers: 15_000, weeklyFeePerMember: 3, description: 'Plano Intermediário' },
  { tier: 'OURO', label: 'Ouro', minMembers: 45_000, weeklyFeePerMember: 4, description: 'Plano Premium de Arquibancada' },
  { tier: 'DIAMANTE', label: 'Diamante', minMembers: 90_000, weeklyFeePerMember: 5, description: 'Plano VIP e Fidelidade Total' },
  { tier: 'ELITE_GLOBAL', label: 'Elite Global', minMembers: 150_000, weeklyFeePerMember: 6, description: 'Sócio Internacional e Cadeira Cativa' },
];

/**
 * Quantos sócios um clube pode ter, em múltiplos da capacidade do estádio.
 *
 * Sem teto o crescimento é composto e explode: com as taxas originais, cinco temporadas de título levavam
 * de 74 mil a 1,64 milhão de sócios. Um clube não tem sócio ilimitado, tem a cidade e o estádio que tem, e
 * amarrar o teto ao estádio faz a obra do estádio valer duas vezes.
 */
export const MEMBERSHIP_CEILING_PER_SEAT = 3;

export function membershipCeiling(stadiumCapacity: number): number {
  return Math.max(5_000, Math.round(stadiumCapacity * MEMBERSHIP_CEILING_PER_SEAT));
}

/**
 * O ganho é uma fatia do espaço que falta, não do que já existe.
 *
 * Esta é a diferença entre crescer e explodir. Somar 1,8% dos sócios atuais a cada vitória compõe trinta e
 * oito vezes por temporada; somar 1,8% do que falta para o teto desacelera sozinho conforme o clube se
 * aproxima dele, que é como uma torcida realmente satura.
 */
function crescer(atual: number, teto: number, taxa: number): number {
  const espaco = Math.max(0, teto - atual);
  return Math.round(espaco * taxa);
}

export interface ClubMembershipState {
  membersCount: number;
  tier: MembershipTier;
  weeklyRevenue: number;
  recentGrowthRate: number; // e.g. +3.5%
}

export function getMembershipTier(membersCount: number): MembershipTierDef {
  for (let i = MEMBERSHIP_TIERS.length - 1; i >= 0; i--) {
    if (membersCount >= MEMBERSHIP_TIERS[i].minMembers) {
      return MEMBERSHIP_TIERS[i];
    }
  }
  return MEMBERSHIP_TIERS[0];
}

export function calculateMembershipWeeklyRevenue(membersCount: number): number {
  const tierDef = getMembershipTier(membersCount);
  return Math.round(membersCount * tierDef.weeklyFeePerMember);
}

/**
 * Derives initial membership based on club reputation, stadium capacity, and division.
 */
export function calculateInitialMembers(club: Club, division: number = 1): number {
  const capacity = club.stadiumCapacity ?? 15_000;
  const squadOvr = club.players.length > 0
    ? club.players.reduce((sum, p) => sum + p.overall, 0) / club.players.length
    : 70;

  let baseMembers: number;
  if (division === 1) {
    baseMembers = capacity >= 40_000 ? 55_000 : capacity >= 25_000 ? 30_000 : 15_000;
    if (squadOvr >= 75) baseMembers = Math.round(baseMembers * 1.35);
  } else if (division === 2) {
    baseMembers = capacity >= 25_000 ? 12_000 : 6_000;
  } else {
    baseMembers = 2_500;
  }

  return baseMembers;
}

/**
 * Calculates membership adjustments after a match result.
 * - Win: +1.0% to +3.0% (higher for high profile clashes)
 * - Draw: +0.2%
 * - Loss: -0.8%
 */
export function applyMatchMembershipImpact(
  currentMembers: number,
  result: 'WIN' | 'DRAW' | 'LOSS',
  isHighProfile: boolean = false,
  ceiling: number = Number.POSITIVE_INFINITY,
): { newMembers: number; diff: number } {
  // A perda é sobre quem está lá, porque quem sai é sócio de verdade; o ganho é sobre o espaço que falta.
  if (result === 'LOSS') {
    const perda = Math.round(currentMembers * 0.008);
    return { newMembers: Math.max(500, currentMembers - perda), diff: -perda };
  }

  const taxa = result === 'WIN' ? (isHighProfile ? 0.035 : 0.018) : 0.002;
  const diff = Number.isFinite(ceiling) ? crescer(currentMembers, ceiling, taxa) : Math.round(currentMembers * taxa);
  return { newMembers: Math.max(500, currentMembers + diff), diff };
}

/**
 * Applies a major boost when the club lifts a trophy.
 * - League Champion: +25%
 * - Cup Champion: +18%
 */
export function applyTitleMembershipBoost(
  currentMembers: number,
  competitionType: 'league' | 'cup',
  ceiling: number = Number.POSITIVE_INFINITY,
): { newMembers: number; diff: number } {
  const taxa = competitionType === 'league' ? 0.25 : 0.18;
  const diff = Number.isFinite(ceiling) ? crescer(currentMembers, ceiling, taxa) : Math.round(currentMembers * taxa);
  return { newMembers: currentMembers + diff, diff };
}

/**
 * Applies a burst of new memberships when a star player signs with the club.
 */
export function applyStarSigningMembershipBoost(
  currentMembers: number,
  playerOverall: number,
  ceiling: number = Number.POSITIVE_INFINITY,
): { newMembers: number; diff: number } {
  if (playerOverall < 80) return { newMembers: currentMembers, diff: 0 };
  const taxa = playerOverall >= 90 ? 0.12 : playerOverall >= 85 ? 0.08 : 0.04;
  const diff = Number.isFinite(ceiling) ? crescer(currentMembers, ceiling, taxa) : Math.round(currentMembers * taxa);
  return { newMembers: currentMembers + diff, diff };
}

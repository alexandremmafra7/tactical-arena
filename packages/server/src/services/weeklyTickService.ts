import {
  calculateMembershipWeeklyRevenue,
  calculateInitialMembers,
  GameDate,
  StadiumConstruction,
  StaffMember,
  applyFinancialMorale,
  calculateMaintenanceCost,
  calculateStadiumRevenue,
  calculateWageBill,
  getFinancialDirectorSponsorBoost,
  getStadiumLevelInfo,
  BOT_OWNER_ID,
  applyAutomatedMedicalCare,
  getAutomatedMedicalCareSettings,
} from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';
import { getClub, toDomain as toDomainClub } from './clubService.js';
import { buildLeagueContext, processConfidenceTick, type FinanceSnapshot } from './boardConfidenceService.js';
import { processSackings } from './sackingService.js';
import { processClubDelegatedRenewals } from './contractService.js';
import { generateMedicalRecoveryNews } from './newsService.js';

/**
 * The floor a computer-run club's cash cannot fall below.
 *
 * Kept, but it should now be dead weight rather than the thing holding the world up. It existed because no
 * computer-run club could sign a sponsor (only an owner can), so every one of them ran at a permanent loss:
 * measured across the shipped database, the median club burned R$ 151.000 a week and 69% of the world was
 * insolvent. They carry a sponsor board now (see `sponsorBoardFor`), so the floor is what it was always
 * meant to be: a backstop for a club that manages itself into trouble, not a subsidy for all of them.
 */
export const BOT_CASH_FLOOR = 100_000;

async function applyDelegatedWeeklyMedicalCare(clubId: string): Promise<void> {
  const club = await getClub(clubId);
  const settings = getAutomatedMedicalCareSettings(club);

  if (!settings) return;

  const result = applyAutomatedMedicalCare(
    club,
    settings.chiefDoctorRating,
    settings.mode,
  );

  if (result.recoveries.length === 0) return;

  await prisma.club.update({
    where: { id: clubId },
    data: {
      playersJson: JSON.stringify(result.club.players),
    },
  });

  await generateMedicalRecoveryNews(clubId, result.recoveries).catch((err) =>
    console.error('generateMedicalRecoveryNews weekly failed:', err),
  );
}

/** How many clubs are read and written per round trip. Whole-world ticks touch thousands of rows. */
const BATCH_SIZE = 200;

export interface WeeklyTickOutcome {
  weekStart: GameDate;
  clubsProcessed: number;
  /** Quantos treinadores tiveram a confiança da diretoria recalculada nesta semana. */
  managersEvaluated: number;
  /** Quantos ouviram o primeiro aviso do presidente. */
  newWarnings: number;
  /** Treinadores da máquina demitidos nesta semana. */
  botsSacked: number;
  /** Verdadeiro quando o próprio jogador foi demitido. */
  playerSacked: boolean;
  /** O clube que o jogador perdeu, para a tela saber o que aconteceu. */
  playerFormerClubId: string | null;
}

/**
 * The columns a week actually needs. Deliberately not the whole club row.
 *
 * A roster serialises to about 42 KB, and the two rosters are effectively all of a club row's bulk —
 * measured at 87% and 13% of it. The week does not need a single player: it needs money, dates and
 * counters. So it reads money, dates and counters, and the rosters are never touched at all. What the
 * squad is owed is recorded as `pendingRestWeeks` and folded in by `clubService.toDomain` the next time
 * anyone actually reads it, and what it costs is kept in the wage columns the prisma extension maintains.
 */
const WEEKLY_COLUMNS = {
  id: true,
  ownerId: true,
  budget: true,
  stadiumLevel: true,
  stadiumCapacity: true,
  stadiumTier: true,
  stadiumUpgradeWeek: true,
  stadiumConstructionJson: true,
  sponsorshipsJson: true,
  membersCount: true,
  loansJson: true,
  pendingTransferPaymentsJson: true,
  staffJson: true,
  captainPlayerId: true,
  captainWeeksServed: true,
  weeklyWageBill: true,
  academyWageBill: true,
} as const;

export interface WeeklyRecord {
  id: string;
  ownerId: string;
  budget: number;
  stadiumLevel: number;
  stadiumCapacity: number;
  stadiumTier?: number;
  stadiumUpgradeWeek?: number | null;
  stadiumConstructionJson: string | null;
  sponsorshipsJson: string;
  membersCount: number | null;
  loansJson: string;
  pendingTransferPaymentsJson: string;
  staffJson: string;
  captainPlayerId: string | null;
  captainWeeksServed: number;
  weeklyWageBill: number;
  academyWageBill: number;
}

export interface WeeklyFinances {
  data: Record<string, unknown>;
  creditByPayeeClubId: Map<string, number>;
  /** The balance after the week, so the caller can tell who needs the slow path below. */
  budget: number;
  /** Receita da semana, para a confiança da diretoria medir o fôlego sem refazer a conta. */
  weeklyIncome: number;
  /** Despesa total da semana. */
  weeklyExpenses: number;
  /** Só a folha, para a razão salário sobre receita. */
  weeklyWageBill: number;
}

/**
 * One club, one week: wages, rent, and the calendar counting down on everything that has a duration.
 *
 * Lifted out of `advanceWeek` with two deliberate removals. There is no owner check, because the world
 * ticks for everyone now and not just for whoever pressed a button. And nobody ages or retires here:
 * that belongs to the season turn, and doing it weekly is what used to make a squad grow a year older
 * every time the manager advanced (see `applyWeeklyRecovery` and `evolvePlayer`).
 *
 * The squad's own week — rest, morale settling, injuries counting down — is not here either, and that is
 * the point of the whole file: it is *owed* rather than done. Doing it here meant reading and rewriting
 * every roster in the world every Monday to move three small numbers per player, which measured at 87%
 * of the tick's entire cost.
 */
export function computeWeeklyFinances(record: WeeklyRecord): WeeklyFinances {
  const sponsorships = JSON.parse(record.sponsorshipsJson) as { weeklyAmount: number; weeksRemaining: number }[];
  const loans = JSON.parse(record.loansJson) as {
    weeklyPayment: number;
    weeksRemaining: number;
    remainingBalance: number;
  }[];
  const instalments = JSON.parse(record.pendingTransferPaymentsJson) as {
    weeklyAmount: number;
    weeksRemaining: number;
    payeeClubId: string;
  }[];
  let staff: StaffMember[] = [];
  if (record.staffJson) {
    try {
      const parsed = JSON.parse(record.staffJson);
      if (Array.isArray(parsed)) {
        staff = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.staff)) {
        staff = parsed.staff;
      }
    } catch {
      staff = [];
    }
  }

  // --- Stadium: count down any expansion in progress; new capacity only comes online once it hits 0. ---
  let stadiumLevel = record.stadiumLevel;
  let stadiumTier = record.stadiumTier ?? record.stadiumLevel;
  let stadiumCapacity = record.stadiumCapacity;
  let stadiumUpgradeWeek = record.stadiumUpgradeWeek ?? null;
  let stadiumConstruction: StadiumConstruction | null = record.stadiumConstructionJson
    ? (JSON.parse(record.stadiumConstructionJson) as StadiumConstruction)
    : null;
  if (stadiumConstruction) {
    const weeksRemaining = stadiumConstruction.weeksRemaining - 1;
    if (weeksRemaining <= 0) {
      if (stadiumConstruction.targetCapacity) {
        stadiumCapacity = stadiumConstruction.targetCapacity;
      }
      if (stadiumConstruction.targetStep !== undefined) {
        if (stadiumConstruction.targetStep >= 4) {
          stadiumLevel = stadiumConstruction.targetLevel;
          stadiumTier = stadiumConstruction.targetLevel;
        }
      } else {
        const finished = getStadiumLevelInfo(stadiumConstruction.targetLevel);
        if (finished) {
          stadiumLevel = finished.level;
          stadiumTier = finished.level;
          stadiumCapacity = finished.capacity;
        }
      }
      stadiumConstruction = null;
      stadiumUpgradeWeek = null;
    } else {
      stadiumConstruction = { ...stadiumConstruction, weeksRemaining };
      stadiumUpgradeWeek = weeksRemaining;
    }
  }

  // --- Finance: revenue in, payroll/maintenance/loan/transfer-instalment payments out. ---
  const sponsorBoost = getFinancialDirectorSponsorBoost(staff.find((s) => s.role === 'FINANCIAL_DIRECTOR'));
  const stadiumRevenue = calculateStadiumRevenue(record.stadiumCapacity);
  const sponsorshipRevenue = Math.round(sponsorships.reduce((sum, s) => sum + s.weeklyAmount, 0) * (1 + sponsorBoost));

  /**
   * A mensalidade dos sócios, que até agora era só um número na tela.
   *
   * `calculateMembershipWeeklyRevenue` existia e era chamada em exatamente um lugar: o painel de finanças,
   * que exibia a receita e nunca a creditava. O `membersCount` não aparecia uma única vez no servidor, então
   * a tela recalculava o valor inicial a cada abertura e o dinheiro nunca existiu.
   */
  const membersCount = record.membersCount ?? calculateInitialMembers(
    { players: [], stadiumCapacity: record.stadiumCapacity } as never,
    1,
  );
  const membershipRevenue = calculateMembershipWeeklyRevenue(membersCount);
  const staffWageBill = staff.reduce((sum, s) => sum + s.wage, 0);
  const wageBill = record.weeklyWageBill + record.academyWageBill + staffWageBill;
  const maintenanceCost = calculateMaintenanceCost(stadiumRevenue, wageBill);
  const loanPayments = loans.reduce((sum, l) => sum + l.weeklyPayment, 0);
  const instalmentPayments = instalments.reduce((sum, p) => sum + p.weeklyAmount, 0);
  const rawBudget =
    record.budget + stadiumRevenue + sponsorshipRevenue + membershipRevenue - wageBill - maintenanceCost - loanPayments - instalmentPayments;
  const budget = record.ownerId === BOT_OWNER_ID ? Math.max(BOT_CASH_FLOOR, rawBudget) : rawBudget;

  const creditByPayeeClubId = new Map<string, number>();
  for (const plan of instalments) {
    creditByPayeeClubId.set(plan.payeeClubId, (creditByPayeeClubId.get(plan.payeeClubId) ?? 0) + plan.weeklyAmount);
  }

  return {
    budget,
    creditByPayeeClubId,
    /**
     * A receita e a despesa da semana, devolvidas em vez de descartadas.
     *
     * Já eram calculadas aqui e morriam dentro da conta do caixa. A confiança da diretoria precisa das duas
     * — fôlego de caixa e quanto da receita vai em salário — e recalculá-las noutro lugar seria manter duas
     * versões da mesma verdade financeira sobre o mesmo clube.
     */
    weeklyIncome: stadiumRevenue + sponsorshipRevenue + membershipRevenue,
    weeklyExpenses: wageBill + maintenanceCost + loanPayments + instalmentPayments,
    weeklyWageBill: wageBill,
    data: {
      budget,
      // Gravado para o número parar de ser recalculado do zero a cada leitura de tela.
      membersCount,
      // Tenure is counted in weeks and always was — the field says so.
      captainWeeksServed: record.captainPlayerId ? record.captainWeeksServed + 1 : 0,
      // The squad's week: owed, not done.
      pendingRestWeeks: { increment: 1 },
      stadiumLevel,
      stadiumTier,
      stadiumCapacity,
      stadiumUpgradeWeek,
      stadiumConstructionJson: stadiumConstruction ? JSON.stringify(stadiumConstruction) : null,
      sponsorshipsJson: JSON.stringify(
        sponsorships.map((s) => ({ ...s, weeksRemaining: s.weeksRemaining - 1 })).filter((s) => s.weeksRemaining > 0),
      ),
      loansJson: JSON.stringify(
        loans
          .map((l) => ({
            ...l,
            weeksRemaining: l.weeksRemaining - 1,
            remainingBalance: Math.max(0, l.remainingBalance - l.weeklyPayment),
          }))
          .filter((l) => l.weeksRemaining > 0),
      ),
      pendingTransferPaymentsJson: JSON.stringify(
        instalments.map((p) => ({ ...p, weeksRemaining: p.weeksRemaining - 1 })).filter((p) => p.weeksRemaining > 0),
      ),
    },
  };
}

/**
 * The one thing a week does that genuinely needs the players themselves: docking morale at a club in the red.
 *
 * Kept off the fast path because it is rare and expensive. `applyFinancialMorale` is a no-op at or above
 * zero, and a computer-run club never goes below it thanks to the floor — so in practice this runs for a
 * manager who has spent themselves into trouble, and for nobody else. Discovering that by reading every
 * roster would cost the whole world the 42 KB the rest of this file exists to avoid.
 */
async function applyMoraleForClubsInTheRed(clubIds: string[]): Promise<void> {
  for (const id of clubIds) {
    const record = await prisma.club.findUnique({ where: { id } });
    if (!record) continue;
    const club = toDomainClub(record);
    const staffWageBill = (club.staff ?? []).reduce((sum, s) => sum + s.wage, 0);
    const wageBill = calculateWageBill(club.players) + calculateWageBill(club.academyPlayers) + staffWageBill;
    const players = applyFinancialMorale(club.players, club.budget, wageBill);
    // Writing the roster clears the owed rest, which `toDomain` has already folded into these players.
    await prisma.club.update({ where: { id }, data: { playersJson: JSON.stringify(players) } });
  }
}

/**
 * One week passes, for one club.
 *
 * The same computation as the whole-world tick without reading the world to get there, including the
 * instalments this club owes. `processWeeklyTick` is this applied to everyone.
 */
export async function processWeeklyTickForClub(clubId: string, weekStart: GameDate): Promise<void> {
  void weekStart;
  const record = await prisma.club.findUnique({ where: { id: clubId }, select: WEEKLY_COLUMNS });
  if (!record) return;

  const { data, creditByPayeeClubId, budget } = computeWeeklyFinances(record);
  await prisma.club.update({ where: { id: clubId }, data });
  for (const [payeeClubId, amount] of creditByPayeeClubId) {
    await prisma.club.update({ where: { id: payeeClubId }, data: { budget: { increment: amount } } }).catch(() => null);
  }
  if (budget < 0) await applyMoraleForClubsInTheRed([clubId]);

  if (record.ownerId !== BOT_OWNER_ID) await applyDelegatedWeeklyMedicalCare(clubId);
  await processClubDelegatedRenewals(clubId);
}


interface WeeklyWriteRow {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Writes a whole batch of clubs in one statement instead of one statement each.
 *
 * Once the rosters came out of the week, the payload per club shrank to a handful of numbers and a few
 * short JSON arrays — and the cost stopped being the data and became the round trips. Two thousand
 * updates cost about the same whether they carry forty kilobytes or forty bytes, so the last of the time
 * was pure per-statement overhead. (Batching was measured at only 1.3x back when each row still carried a
 * full roster, which is exactly why it was not worth doing then and is now.)
 *
 * SQLite has UPDATE-FROM but not `VALUES ... AS v(cols)`, so the batch is expressed as a UNION ALL of
 * SELECTs. `pendingRestWeeks` is incremented from the column itself rather than passed in, so no caller
 * has to know what it was.
 *
 * This deliberately does not go through the prisma extension, and does not need to: the extension exists
 * to keep the derived fields honest whenever a *roster* is written, and a week never writes one.
 */
async function writeWeekInBulk(rows: WeeklyWriteRow[]): Promise<void> {
  const CHUNK = 100;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const values = chunk
      .map((_, i) =>
        i === 0
          ? 'SELECT ? AS id, ? AS budget, ? AS cws, ? AS sl, ? AS st, ? AS sc, ? AS suw, ? AS scj, ? AS spj, ? AS lj, ? AS ptj'
          : 'SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?',
      )
      .join(' UNION ALL ');
    const params = chunk.flatMap((row) => [
      row.id,
      row.data.budget,
      row.data.captainWeeksServed,
      row.data.stadiumLevel,
      row.data.stadiumTier ?? row.data.stadiumLevel,
      row.data.stadiumCapacity,
      row.data.stadiumUpgradeWeek ?? null,
      row.data.stadiumConstructionJson ?? null,
      row.data.sponsorshipsJson,
      row.data.loansJson,
      row.data.pendingTransferPaymentsJson,
    ]);

    await prisma.$executeRawUnsafe(
      `UPDATE "Club" SET
         "budget" = v.budget,
         "captainWeeksServed" = v.cws,
         "pendingRestWeeks" = "Club"."pendingRestWeeks" + 1,
         "stadiumLevel" = v.sl,
         "stadiumTier" = v.st,
         "stadiumCapacity" = v.sc,
         "stadiumUpgradeWeek" = v.suw,
         "stadiumConstructionJson" = v.scj,
         "sponsorshipsJson" = v.spj,
         "loansJson" = v.lj,
         "pendingTransferPaymentsJson" = v.ptj
       FROM (${values}) AS v
       WHERE "Club"."id" = v.id`,
      ...params,
    );
  }
}

/**
 * One week passes, for every club in the world.
 *
 * The week the manager's club lives through is the same week every other club lives through. That was
 * never true before: `advanceWeek` was scoped to one club and gated on ownership, so wages, stadium works
 * and loan repayments simply never happened for anyone else, and a computer-run club could carry a
 * half-built stand for a decade.
 *
 * `weekStart` is the Monday being processed. Nothing in a week is a dice roll — rest, wages and countdowns
 * are all arithmetic — so a week always plays out the same way. The old tick seeded itself from
 * `Date.now()`, which meant replaying the same save gave a different world every time; the fix was not a
 * better seed but removing the randomness that never belonged here.
 */
export async function processWeeklyTick(weekStart: GameDate): Promise<WeeklyTickOutcome> {
  let clubsProcessed = 0;
  let cursor: string | undefined;
  const inTheRed: string[] = [];

  /**
   * As finanças de cada clube ficam guardadas para a confiança da diretoria, que roda logo abaixo.
   *
   * Um mapa de 1.811 números é barato; refazer a conta da semana por fora seria uma segunda versão da saúde
   * financeira do mesmo clube na mesma semana, e as duas divergiriam no primeiro dia em que alguém mexesse
   * numa e esquecesse da outra.
   */
  const financas = new Map<string, FinanceSnapshot>();

  for (;;) {
    const records = await prisma.club.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: WEEKLY_COLUMNS,
    });
    if (records.length === 0) break;
    cursor = records[records.length - 1].id;

    const rows: WeeklyWriteRow[] = [];
    const creditTotals = new Map<string, number>();
    for (const record of records) {
      const { data, creditByPayeeClubId, budget, weeklyIncome, weeklyExpenses, weeklyWageBill } =
        computeWeeklyFinances(record);
      rows.push({ id: record.id, data });
      financas.set(record.id, { budget, weeklyIncome, weeklyExpenses, weeklyWageBill });
      for (const [payeeClubId, amount] of creditByPayeeClubId) {
        creditTotals.set(payeeClubId, (creditTotals.get(payeeClubId) ?? 0) + amount);
      }
      if (budget < 0) inTheRed.push(record.id);
      clubsProcessed += 1;
    }

    /**
     * Instalments are credited after the batch's own writes, never inside them. A payee can sit in a
     * different batch — or in this one — and crediting it as part of the same statement list would race
     * with that club's own tick and lose whichever write landed second.
     */
    await writeWeekInBulk(rows);
    for (const [payeeClubId, amount] of creditTotals) {
      await prisma.club.update({ where: { id: payeeClubId }, data: { budget: { increment: amount } } }).catch(() => null);
    }

    if (records.length < BATCH_SIZE) break;
  }

  await applyMoraleForClubsInTheRed(inTheRed);

  const humanClubs = await prisma.club.findMany({
    where: { ownerId: { not: BOT_OWNER_ID } },
    select: { id: true },
  });
  for (const hc of humanClubs) {
    await applyDelegatedWeeklyMedicalCare(hc.id);
    await processClubDelegatedRenewals(hc.id);
  }

  /**
   * E a diretoria de cada clube forma a sua opinião sobre o treinador.
   *
   * Depois das finanças, e nunca antes: a confiança lê o caixa da semana que acabou de ser fechada, e lê-lo
   * antes daria a opinião da semana passada com a data desta.
   */
  const { managersEvaluated, newWarnings } = await processConfidenceTick(financas, await buildLeagueContext());

  /**
   * E as demissões que a semana tornou inevitáveis, depois do recálculo e nunca antes.
   *
   * Demitir com a nota da semana passada seria julgar alguém por uma partida que já foi jogada desde então.
   */
  const { botsSacked, playerSacked, playerFormerClubId } = await processSackings();

  return { weekStart, clubsProcessed, managersEvaluated, newWarnings, botsSacked, playerSacked, playerFormerClubId };
}

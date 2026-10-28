import { randomUUID } from 'node:crypto';
import { readOpponentPattern, type Club, type StaffRecordEntry } from '@tactical-arena/shared';
import { prisma } from '../db/prisma.js';

/**
 * Records a prediction, unless the same one is already outstanding.
 *
 * Several of these are written from places a manager can revisit freely: the scouting report is a GET that
 * fires every time the modal opens, and a lineup can be saved a dozen times before kickoff. Without this the
 * log would fill with copies of one opinion and the accuracy figure would count it a dozen times.
 *
 * `dedupeKey` is whatever makes two entries the same prediction — normally the type plus the player or the
 * opponent it is about.
 */
export async function recordPredictionOnce(
  clubId: string,
  dedupeKey: (entry: StaffRecordEntry) => boolean,
  entry: Omit<StaffRecordEntry, 'id' | 'status'>,
): Promise<StaffRecordEntry | null> {
  const clubRecord = await prisma.club.findUnique({ where: { id: clubId }, select: { staffRecordJson: true } });
  if (!clubRecord) return null;

  const current: StaffRecordEntry[] = clubRecord.staffRecordJson ? JSON.parse(clubRecord.staffRecordJson) : [];
  if (current.some((rec) => rec.status === 'PENDING' && dedupeKey(rec))) return null;

  return addStaffRecordEntry(clubId, entry);
}

/**
 * Adds a new recommendation/prediction entry to a club's staffRecords log.
 */
export async function addStaffRecordEntry(
  clubId: string,
  entry: Omit<StaffRecordEntry, 'id' | 'status'> & { status?: 'PENDING' | 'CORRECT' | 'INCORRECT' }
): Promise<StaffRecordEntry> {
  const clubRecord = await prisma.club.findUnique({ where: { id: clubId }, select: { staffRecordJson: true } });
  if (!clubRecord) throw new Error(`Clube ${clubId} não encontrado`);

  const currentRecords: StaffRecordEntry[] = clubRecord.staffRecordJson
    ? JSON.parse(clubRecord.staffRecordJson)
    : [];

  // The spread goes first: with it last, a caller passing `status: undefined` would wipe the default.
  const newEntry: StaffRecordEntry = {
    ...entry,
    id: randomUUID(),
    status: entry.status ?? 'PENDING',
  };

  const updated = [newEntry, ...currentRecords].slice(0, 100); // Keep last 100 entries

  await prisma.club.update({
    where: { id: clubId },
    data: { staffRecordJson: JSON.stringify(updated) },
  });

  return newEntry;
}

/**
 * Settles the predictions this match was able to settle.
 *
 * Scoped to the opponent it was actually about. A manager who opens the scouting report for two different
 * fixtures has two predictions outstanding, and judging both against whichever side happens to take the
 * field first would mark one of them wrong for no reason. A record with no opponent recorded is one written
 * before this scoping existed, and is left alone rather than guessed at.
 */
export async function evaluateMatchStaffRecords(
  club: Club,
  opponentClubId: string,
  opponentTactic: { formation: string; attackStyle: string; mentality: string; pressing?: string },
  matchInjuredPlayerIds: string[],
  gameDate: string,
): Promise<void> {
  if (!club.staffRecords || club.staffRecords.length === 0) return;

  let modified = false;

  const updatedRecords = club.staffRecords.map((rec) => {
    if (rec.status !== 'PENDING') return rec;

    if (rec.recommendationType === 'TACTIC_PATTERN' && rec.metaJson) {
      try {
        const meta = JSON.parse(rec.metaJson);
        if (meta.opponentClubId !== opponentClubId) return rec;

        /**
         * The claim being judged is the assistant's read of how the other side plays, which is the whole
         * content of a scouting report. Not the formation they told us to field: that is our own team sheet
         * and says nothing about whether they saw the opponent correctly.
         */
        const truth = readOpponentPattern(
          opponentTactic.formation,
          opponentTactic.mentality,
          opponentTactic.attackStyle,
          opponentTactic.pressing ?? 'MID_BLOCK',
        );
        const isCorrect = meta.readPattern === truth;
        modified = true;
        return {
          ...rec,
          status: isCorrect ? ('CORRECT' as const) : ('INCORRECT' as const),
          evaluatedAt: gameDate,
        };
      } catch {
        return rec;
      }
    }

    if (rec.recommendationType === 'INJURY_WARNING' && rec.playerId) {
      const wasInjured = matchInjuredPlayerIds.includes(rec.playerId);
      modified = true;
      return {
        ...rec,
        status: wasInjured ? ('CORRECT' as const) : ('INCORRECT' as const),
        evaluatedAt: gameDate,
      };
    }

    return rec;
  });

  if (modified) {
    await prisma.club.update({
      where: { id: club.id },
      data: { staffRecordJson: JSON.stringify(updatedRecords) },
    });
  }
}

/**
 * Evaluates pending TRANSFER_VALUATION and YOUTH_PROMOTION staff records during season turnover.
 */
/** How far a "fair price" call is allowed to be out before it counts as having been wrong. */
const FAIR_PRICE_TOLERANCE = 0.25;

export async function evaluateSeasonTurnStaffRecords(club: Club, gameDate: string): Promise<void> {
  if (!club.staffRecords || club.staffRecords.length === 0) return;

  let modified = false;

  const updatedRecords = club.staffRecords.map((rec) => {
    if (rec.status !== 'PENDING') return rec;

    if (rec.recommendationType === 'TRANSFER_VALUATION' && rec.metaJson && rec.playerId) {
      try {
        const meta = JSON.parse(rec.metaJson);
        const player = club.players.find((p) => p.id === rec.playerId);
        if (player) {
          // If current market value or rating grew beyond buying valuation
          const purchaseValuation = meta.purchasePrice ?? 0;
          const isPechincha = meta.valuationType === 'PECHINCHA';
          const isCaro = meta.valuationType === 'CARO';

          const currentValuation = player.marketValue ?? 0;
          let isCorrect: boolean;

          if (isPechincha) {
            isCorrect = currentValuation >= purchaseValuation;
          } else if (isCaro) {
            isCorrect = currentValuation < purchaseValuation;
          } else {
            /**
             * A fair call has to be checkable too. Passing every neutral verdict was a free mark, and since
             * most prices land on "Justo" it would have pushed every director's record toward 100%, which is
             * the one thing that empties the number the screen shows.
             */
            const drift = Math.abs(currentValuation - purchaseValuation) / Math.max(1, purchaseValuation);
            isCorrect = drift <= FAIR_PRICE_TOLERANCE;
          }

          modified = true;
          return {
            ...rec,
            status: isCorrect ? ('CORRECT' as const) : ('INCORRECT' as const),
            evaluatedAt: gameDate,
          };
        }
      } catch {
        return rec;
      }
    }

    if (rec.recommendationType === 'YOUTH_PROMOTION' && rec.metaJson && rec.playerId) {
      try {
        const meta = JSON.parse(rec.metaJson);
        const player = club.players.find((p) => p.id === rec.playerId);
        if (player) {
          const predictedPotential = meta.predictedPotential ?? 75;
          const isCorrect = player.overall >= predictedPotential - 4 || player.potential >= predictedPotential;
          modified = true;
          return {
            ...rec,
            status: isCorrect ? ('CORRECT' as const) : ('INCORRECT' as const),
            evaluatedAt: gameDate,
          };
        }
      } catch {
        return rec;
      }
    }

    return rec;
  });

  if (modified) {
    await prisma.club.update({
      where: { id: club.id },
      data: { staffRecordJson: JSON.stringify(updatedRecords) },
    });
  }
}

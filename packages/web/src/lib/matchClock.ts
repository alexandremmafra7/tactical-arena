import type { ClockFormat } from '../api/client.js';
import type { StoppageInfo } from '@tactical-arena/shared';
export { calculateStoppageTime } from '@tactical-arena/shared';

export interface FormattedClock {
  displayMinute: string;
  periodLabel: string;
  isStoppage: boolean;
  stoppageMinutes: number;
  stoppageSign?: string;
  progressPercent: number;
}

export function formatMatchClock(
  minute: number,
  clockFormat: ClockFormat = 'HALF_45',
  stoppage: StoppageInfo = { half1: 2, half2: 4 },
  isSecondHalf: boolean = false,
): FormattedClock {
  if (!isSecondHalf) {
    const isStoppage = minute > 45;
    const extra = isStoppage ? minute - 45 : 0;
    const displayMinute = isStoppage ? `45+${extra}'` : `${minute}'`;
    const periodLabel = isStoppage ? '1ºT ACRÉSCIMOS' : '1º TEMPO';
    const progressPercent = Math.min(100, (Math.min(45, minute) / 45) * 100);

    return {
      displayMinute,
      periodLabel,
      isStoppage,
      stoppageMinutes: stoppage.half1,
      stoppageSign: minute >= 40 ? `+${stoppage.half1}'` : undefined,
      progressPercent,
    };
  }

  // Second half
  const effectiveMinute = Math.max(45, minute);
  const half2Clock = effectiveMinute - 45;
  const isStoppage = effectiveMinute > 90;
  const extra = isStoppage ? effectiveMinute - 90 : 0;

  let displayMinute: string;
  let periodLabel: string;

  if (clockFormat === 'HALF_45') {
    // Brazilian traditional format (0-45' in 2nd half)
    if (isStoppage) {
      displayMinute = `45+${extra}' (2ºT)`;
      periodLabel = '2ºT ACRÉSCIMOS';
    } else {
      displayMinute = `${half2Clock}' (2ºT)`;
      periodLabel = '2º TEMPO';
    }
  } else {
    // International format (45-90' continuous)
    if (isStoppage) {
      displayMinute = `90+${extra}'`;
      periodLabel = '2ºT ACRÉSCIMOS';
    } else {
      displayMinute = `${effectiveMinute}'`;
      periodLabel = '2º TEMPO';
    }
  }

  const progressPercent = Math.min(100, (Math.min(45, half2Clock) / 45) * 100);

  return {
    displayMinute,
    periodLabel,
    isStoppage,
    stoppageMinutes: stoppage.half2,
    stoppageSign: effectiveMinute >= 85 ? `+${stoppage.half2}'` : undefined,
    progressPercent,
  };
}

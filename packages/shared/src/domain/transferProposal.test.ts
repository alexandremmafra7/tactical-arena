import { describe, it, expect } from 'vitest';
import { calculateInstallmentPlan } from './transferProposal.js';

describe('calculateInstallmentPlan', () => {
  it('never underpays the total across all installments (rounding is absorbed upward)', () => {
    const { weeklyAmount, weeksRemaining } = calculateInstallmentPlan(1_000_000, 7);
    expect(weeksRemaining).toBe(7);
    expect(weeklyAmount * weeksRemaining).toBeGreaterThanOrEqual(1_000_000);
  });

  it('treats a non-positive or fractional installment count as at least one payment', () => {
    const { weeksRemaining } = calculateInstallmentPlan(500_000, 0);
    expect(weeksRemaining).toBe(1);
  });
});

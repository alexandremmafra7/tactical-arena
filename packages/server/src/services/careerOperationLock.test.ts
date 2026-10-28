import { describe, expect, it } from 'vitest';
import { withCareerOperationLock } from './careerOperationLock.js';

describe('withCareerOperationLock', () => {
  it('serializes operations and keeps the queue usable after a failure', async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = withCareerOperationLock(async () => {
      events.push('first:start');
      await gate;
      events.push('first:end');
      throw new Error('expected failure');
    });
    const second = withCareerOperationLock(async () => {
      events.push('second:start');
      return 'done';
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);
    releaseFirst();
    await expect(first).rejects.toThrow('expected failure');
    await expect(second).resolves.toBe('done');
    expect(events).toEqual(['first:start', 'first:end', 'second:start']);
  });
});

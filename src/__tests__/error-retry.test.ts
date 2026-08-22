import { describe, expect, it } from 'vitest';
import { ContainerOperationError, classifyError, createRetryPolicy } from '../error-retry.js';

describe('retry policy', () => {
  it('retries transient transport and server failures', () => {
    const policy = createRetryPolicy(2);
    for (const error of [new Error('fetch failed'), new ContainerOperationError('unavailable', 503)]) {
      expect(classifyError(error).classification).toBe('transient');
      expect(policy.retry(error)).toBe(true);
    }
  });

  it('preserves status-aware validation and authorization classification', () => {
    const policy = createRetryPolicy(1);
    for (const error of [
      new ContainerOperationError('invalid', 400),
      new ContainerOperationError('forbidden', 403),
    ]) {
      expect(policy.retry(error)).toBe(false);
    }
    expect(classifyError(new ContainerOperationError('invalid', 400)).classification).toBe('validation');
    expect(classifyError(new ContainerOperationError('forbidden', 403)).classification).toBe('authorization');
  });

  it('rejects invalid retry bounds', () => {
    expect(() => createRetryPolicy(-1)).toThrow(RangeError);
    expect(() => createRetryPolicy(1.5)).toThrow(RangeError);
  });
});

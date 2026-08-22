import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_STOP_TIMEOUT_MS,
  planSessionStops,
  stopSessionsInParallel,
  withStopTimeout,
} from '../session-stop.js';

describe('session stop helper', () => {
  it('skips already-dead tiles for remote stop', () => {
    const plan = planSessionStops([
      { id: 'live', status: 'connected' },
      { id: 'starting', status: 'starting' },
      { id: 'dead', status: 'disconnected' },
      { id: 'failed', status: 'error' },
    ]);
    expect(plan.remoteIds).toEqual(['live', 'starting']);
    expect(plan.localOnlyIds).toEqual(['dead', 'failed']);
  });

  it('stops live sessions in parallel and times out hung remotes', async () => {
    const started: string[] = [];
    const results = await stopSessionsInParallel(
      ['a', 'b'],
      async (id) => {
        started.push(id);
        if (id === 'b') await new Promise((resolve) => setTimeout(resolve, 50));
        return id;
      },
      20,
    );
    expect(started).toEqual(['a', 'b']);
    expect(results.map((result) => result.status === 'fulfilled' ? result.value : result.reason)).toEqual(['a', 'timed-out']);
  });

  it('rejects invalid timeout bounds', async () => {
    await expect(withStopTimeout(Promise.resolve(1), -1)).rejects.toBeInstanceOf(RangeError);
    expect(DEFAULT_SESSION_STOP_TIMEOUT_MS).toBe(2_500);
  });
});

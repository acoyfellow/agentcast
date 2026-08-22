import { CLIENT_STATUS, SERVER_STATUS } from './constants.js';

export const DEFAULT_SESSION_STOP_TIMEOUT_MS = 2_500;

export type ClosableSession = {
  readonly id: string;
  readonly status: string;
};

export type SessionStopPlan = {
  readonly remoteIds: readonly string[];
  readonly localOnlyIds: readonly string[];
};

const remoteStopStatuses = new Set<string>([
  CLIENT_STATUS.CONNECTED,
  CLIENT_STATUS.CONNECTING,
  SERVER_STATUS.STARTING,
  SERVER_STATUS.READY,
  SERVER_STATUS.ACTIVE,
  SERVER_STATUS.IDLE,
  SERVER_STATUS.STOPPING,
]);

export function planSessionStops(sessions: readonly ClosableSession[]): SessionStopPlan {
  const remoteIds: string[] = [];
  const localOnlyIds: string[] = [];
  for (const session of sessions) {
    if (remoteStopStatuses.has(session.status)) remoteIds.push(session.id);
    else localOnlyIds.push(session.id);
  }
  return { remoteIds, localOnlyIds };
}

export async function withStopTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = DEFAULT_SESSION_STOP_TIMEOUT_MS,
): Promise<T | 'timed-out'> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) throw new RangeError('timeoutMs must be a non-negative integer');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<'timed-out'>((resolve) => {
        timer = setTimeout(() => resolve('timed-out'), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function stopSessionsInParallel<T>(
  sessionIds: readonly string[],
  stopOne: (sessionId: string) => Promise<T>,
  timeoutMs: number = DEFAULT_SESSION_STOP_TIMEOUT_MS,
): Promise<readonly PromiseSettledResult<T | 'timed-out'>[]> {
  return Promise.allSettled(sessionIds.map((sessionId) => withStopTimeout(stopOne(sessionId), timeoutMs)));
}

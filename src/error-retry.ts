export type ErrorClassification = 'transient' | 'validation' | 'authorization' | 'permanent';

export interface ErrorInfo {
  readonly message: string;
  readonly status?: number;
}

export interface ClassifiedError extends ErrorInfo {
  readonly classification: ErrorClassification;
}

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly retry: (error: Error) => boolean;
}

export class ContainerOperationError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ContainerOperationError';
    this.status = status;
  }
}

const transientMessages = [
  'Connection refused',
  'container port not found',
  'Monitor failed',
  'The operation was aborted',
  'timeout',
  'Container crashed',
  'Browser not ready',
  'BROWSER_NOT_READY',
  'fetch failed',
  'network',
];

export function errorInfo(error: Error): ErrorInfo {
  return {
    message: error.message,
    status: error instanceof ContainerOperationError ? error.status : undefined,
  };
}

export function classifyError(error: Error): ClassifiedError {
  const { message, status } = errorInfo(error);

  if (status === 401 || status === 403) return { classification: 'authorization', message, status };
  if (status === 400 || status === 409 || status === 422) return { classification: 'validation', message, status };
  if (status !== undefined && status >= 500) return { classification: 'transient', message, status };
  if (transientMessages.some((candidate) => message.includes(candidate))) return { classification: 'transient', message, status };
  return { classification: 'permanent', message, status };
}

export function createRetryPolicy(maxRetries: number): RetryPolicy {
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new RangeError('maxRetries must be a non-negative integer');
  return { maxRetries, retry: (error) => classifyError(error).classification === 'transient' };
}

export const containerStartRetryPolicy = createRetryPolicy(20);
export const instructionRetryPolicy = createRetryPolicy(5);

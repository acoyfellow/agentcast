

import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';
import { getContainer, switchPort } from '@cloudflare/containers';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import type { z } from 'zod';
import {
  ContainerStartError,
  BrowserError,
  NavigationError,
  ScreenshotError,
} from './errors.js';
import type { BrowserFingerprint } from './types.js';

export interface BrowserOptions {
  viewport?: { width: number; height: number };
  startUrl?: string;
  colorScheme?: 'light' | 'dark';
  gatewayUrl?: string;
  internalAiCredential?: string;
  fingerprint?: BrowserFingerprint;
  
  diagnostic?: boolean;
}

export interface ContainerResponse {
  success: boolean;
  wsEndpoint?: string;
  error?: string;
  browserReady?: boolean;
}

function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('Connection refused') ||
    msg.includes('container port not found') ||
    msg.includes('Monitor failed') ||
    msg.includes('The operation was aborted') ||
    msg.includes('timeout') ||
    msg.includes('Container crashed') ||
    (msg.includes('Container start failed') && !msg.includes('non-retryable'))
  );
}

function isNonRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('non-retryable') ||
    msg.includes('validation') ||
    msg.includes('invalid')
  );
}


const circuitBreakerState = new Map<string, { failures: number; lastFailure: number; open: boolean }>();

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_WINDOW_MS = 5 * 60 * 1000;
const CIRCUIT_BREAKER_COOLDOWN_MS = 10 * 60 * 1000;

function checkCircuitBreaker(sessionId: string): boolean {
  const state = circuitBreakerState.get(sessionId);
  if (!state) return true;

  const now = Date.now();

  if (now - state.lastFailure > CIRCUIT_BREAKER_WINDOW_MS) {
    circuitBreakerState.delete(sessionId);
    return true;
  }

  if (state.open) {
    if (now - state.lastFailure > CIRCUIT_BREAKER_COOLDOWN_MS) {
      circuitBreakerState.delete(sessionId);
      return true;
    }
    return false;
  }

  return true;
}

function recordCircuitBreakerFailure(sessionId: string): void {
  const state = circuitBreakerState.get(sessionId) || { failures: 0, lastFailure: 0, open: false };
  state.failures++;
  state.lastFailure = Date.now();

  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.open = true;
    console.warn(`[CircuitBreaker] ${sessionId.slice(0, 8)}: Circuit opened after ${state.failures} failures`);
  }

  circuitBreakerState.set(sessionId, state);
}

function recordCircuitBreakerSuccess(sessionId: string): void {
  circuitBreakerState.delete(sessionId);
}

const containerRetrySchedule = pipe(
  Schedule.exponential(1000, 2),
  Schedule.union(Schedule.spaced(5000)),
  Schedule.compose(Schedule.recurs(20)),
  Schedule.whileInput(isRetryableError),
);


export const startBrowser = (
  containerNamespace: DurableObjectNamespace<any>,
  sessionId: string,
  options: BrowserOptions,
): Effect.Effect<ContainerResponse, ContainerStartError> => {
  let lastAttemptErrorMessage: string | null = null;

  if (!checkCircuitBreaker(sessionId)) {
    return Effect.fail(
      new ContainerStartError({
        message: `Circuit breaker is open for session ${sessionId.slice(0, 8)}. Too many consecutive failures. Please wait before retrying.`,
        sessionId,
      })
    );
  }

  const container = getContainer(containerNamespace, sessionId);
  const body = JSON.stringify({
    viewport: options.viewport ?? { width: 1280, height: 720 },
    startUrl: options.startUrl,
    colorScheme: options.colorScheme ?? 'dark',
    gatewayUrl: options.gatewayUrl,
    internalAiCredential: options.internalAiCredential,
    fingerprint: options.fingerprint,
  });

  const attemptTimeoutMs = options.diagnostic ? 120_000 : 90_000;

  const baseEffect = pipe(
    Effect.tryPromise({
      try: async () => {
        console.log(`[SDK] startBrowser: Calling container.fetch for ${sessionId.slice(0, 8)}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);
        const request = switchPort(
          new Request('http://container/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
          }),
          8080,
        );
        console.log(`[SDK] startBrowser: Request created, calling container.fetch...`);
        const res = await container.fetch(request);
        console.log(`[SDK] startBrowser: Got response, status=${res.status}`);
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'failed to read error');
          if (res.status >= 400 && res.status < 500) {
            throw new Error(`Container start failed (non-retryable): ${errorText}`);
          }
          throw new Error(`Container start failed: ${errorText}`);
        }

        const data = (await res.json()) as ContainerResponse;
        console.log(`[SDK] startBrowser response for ${sessionId.slice(0, 8)}:`, JSON.stringify(data));

        if (data.error) {
          throw new Error(`Container start error: ${data.error}`);
        }

        if (!data.success) {
          throw new Error('Container start returned success=false');
        }

        recordCircuitBreakerSuccess(sessionId);
        return data;
      },
      catch: (error) => {
        recordCircuitBreakerFailure(sessionId);
        lastAttemptErrorMessage = error instanceof Error ? error.message : String(error);
        if (isNonRetryableError(error)) {
          return new ContainerStartError({
            message: error instanceof Error ? error.message : String(error),
            sessionId,
            cause: error,
          });
        }
        return error;
      },
    }),
  );

  const withRetryAndTimeout = pipe(
    baseEffect,
    Effect.retry(containerRetrySchedule),
    Effect.timeoutFail({
      duration: Duration.seconds(240),
      onTimeout: () =>
        new ContainerStartError({
          message: `Container start timeout after 4 minutes${lastAttemptErrorMessage ? `; last error: ${lastAttemptErrorMessage}` : ''}`,
          sessionId,
        }),
    }),
    Effect.mapError((error) => {
      if (error instanceof ContainerStartError) return error;
      return new ContainerStartError({
        message: error instanceof Error ? error.message : String(error),
        sessionId,
        cause: error,
      });
    }),
  );

  const diagnosticFailFast = pipe(
    baseEffect,
    Effect.timeoutFail({
      duration: Duration.seconds(120),
      onTimeout: () =>
        new ContainerStartError({
          message: `Container start timeout after 120s (diagnostic)${lastAttemptErrorMessage ? `; last error: ${lastAttemptErrorMessage}` : ''}`,
          sessionId,
        }),
    }),
    Effect.mapError((error) => {
      if (error instanceof ContainerStartError) return error;
      return new ContainerStartError({
        message: error instanceof Error ? error.message : String(error),
        sessionId,
        cause: error,
      });
    }),
  );

  if (options.diagnostic) return diagnosticFailFast;

  return pipe(
    withRetryAndTimeout,
  );
};


export const stopBrowser = (
  containerNamespace: DurableObjectNamespace<any>,
  sessionId: string,
): Effect.Effect<void, never> => {
  const container = getContainer(containerNamespace, sessionId);

  return pipe(
    Effect.tryPromise({
      try: async () => {
        await container.fetch(
          switchPort(new Request('http://container/stop', { method: 'POST' }), 8080),
        );
      },
      catch: (error) =>
        new BrowserError({
          message: `Failed to stop container: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        }),
    }),
    Effect.catchAll((error) => {
      console.warn(`[stopBrowser] ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
      return Effect.void;
    }),
  );
};


function isRetryableInstructionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('Connection refused') ||
    msg.includes('container port not found') ||
    msg.includes('Browser not ready') ||
    msg.includes('BROWSER_NOT_READY') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('timeout')
  );
}

const instructionRetrySchedule = pipe(
  Schedule.exponential(500, 2),
  Schedule.union(Schedule.spaced(3000)),
  Schedule.compose(Schedule.recurs(5)),
  Schedule.whileInput(isRetryableInstructionError),
);


export const sendInstruction = (
  containerNamespace: DurableObjectNamespace<any>,
  sessionId: string,
  instruction: string,
): Effect.Effect<{ success: boolean; response?: string }, BrowserError> => {
  const container = getContainer(containerNamespace, sessionId);

  const baseEffect = pipe(
    Effect.tryPromise({
      try: async () => {
        console.log(`[SDK] sendInstruction starting for ${sessionId.slice(0, 8)}, instruction: ${instruction.substring(0, 50)}...`);
        const res = await container.fetch(
          switchPort(
            new Request('http://container/instruction', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instruction }),
            }),
            8080,
          ),
        );

        console.log(`[SDK] sendInstruction got response, status=${res.status}, ok=${res.ok} for ${sessionId.slice(0, 8)}`);

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'failed to read error');
          console.log(`[SDK] sendInstruction error response for ${sessionId.slice(0, 8)}:`, errorText);
          throw new Error(`Instruction failed: ${errorText}`);
        }

        const data = await res.json() as { success: boolean; response?: string };
        console.log(`[SDK] sendInstruction parsed response for ${sessionId.slice(0, 8)}:`, JSON.stringify(data));
        return data;
      },
      catch: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[SDK] sendInstruction caught error for ${sessionId.slice(0, 8)}:`, msg);
        return error;
      },
    }),
  );

  return pipe(
    baseEffect,
    Effect.retry(instructionRetrySchedule),
    Effect.timeoutFail({
      duration: Duration.seconds(180),
      onTimeout: () => new BrowserError({
        message: `Instruction timeout after 3 minutes: ${instruction.substring(0, 50)}...`,
      }),
    }),
    Effect.mapError((error) => {
      if (error instanceof BrowserError) return error;
      return new BrowserError({
        message: `Failed to send instruction: ${error instanceof Error ? error.message : String(error)}`,
        cause: error,
      });
    }),
  );
};


export const resizeBrowser = (
  containerNamespace: DurableObjectNamespace<any>,
  sessionId: string,
  viewport: { width: number; height: number },
): Effect.Effect<void, BrowserError> => {
  const container = getContainer(containerNamespace, sessionId);

  return pipe(
    Effect.tryPromise({
      try: async () => {
        const res = await container.fetch(
          switchPort(
            new Request('http://container/resize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(viewport),
            }),
            8080,
          ),
        );

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'failed to read error');
          throw new Error(`Resize failed: ${errorText}`);
        }
      },
      catch: (error) =>
        new BrowserError({
          message: `Failed to resize: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        }),
    }),
  );
};


export const reloadBrowser = (
  containerNamespace: DurableObjectNamespace<any>,
  sessionId: string,
): Effect.Effect<void, BrowserError> => {
  const container = getContainer(containerNamespace, sessionId);

  return pipe(
    Effect.tryPromise({
      try: async () => {
        const res = await container.fetch(
          switchPort(new Request('http://container/reload', { method: 'POST' }), 8080),
        );

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'failed to read error');
          throw new Error(`Reload failed: ${errorText}`);
        }
      },
      catch: (error) =>
        new BrowserError({
          message: `Failed to reload: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        }),
    }),
  );
};


export const navigateBrowser = (
  containerNamespace: DurableObjectNamespace<any>,
  sessionId: string,
  url: string,
): Effect.Effect<void, NavigationError> => {
  return pipe(
    sendInstruction(containerNamespace, sessionId, `go to ${url}`),
    Effect.map(() => undefined),
    Effect.mapError(
      (error) =>
        new NavigationError({
          message: `Failed to navigate to ${url}: ${error.message}`,
          url,
          cause: error,
        }),
    ),
  );
};


export const extractData = <T>(
  containerNamespace: DurableObjectNamespace<any>,
  sessionId: string,
  schema: z.ZodSchema<T>,
): Effect.Effect<T, BrowserError> => {
  const container = getContainer(containerNamespace, sessionId);

  return pipe(
    Effect.tryPromise({
      try: async () => {
        console.log(`[SDK] extractData starting for ${sessionId.slice(0, 8)}`);

        const res = await container.fetch(
          switchPort(
            new Request('http://container/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                schema: schema._def,
                instruction: 'Extract data matching the provided schema from the current page',
              }),
            }),
            8080,
          ),
        );

        console.log(`[SDK] extractData got response, status=${res.status}, ok=${res.ok} for ${sessionId.slice(0, 8)}`);

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'failed to read error');
          console.log(`[SDK] extractData error response for ${sessionId.slice(0, 8)}:`, errorText);
          throw new Error(`Extraction failed: ${errorText}`);
        }

        const data = await res.json() as { success: boolean; data: unknown; error?: string };

        if (!data.success || data.error) {
          throw new Error(data.error || 'Extraction failed');
        }

        const parsed = schema.parse(data.data);
        console.log(`[SDK] extractData parsed and validated response for ${sessionId.slice(0, 8)}`);
        return parsed;
      },
      catch: (error) => {
        console.error(`[SDK] extractData caught error for ${sessionId.slice(0, 8)}:`, error);
        return new BrowserError({
          message: `Failed to extract data: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        });
      },
    }),
  );
};

export const getContainerStatus = (
  containerNamespace: DurableObjectNamespace<any>,
  sessionId: string,
): Effect.Effect<{ running: boolean; url?: string | null }, BrowserError> => {
  const container = getContainer(containerNamespace, sessionId);
  return pipe(
    Effect.tryPromise({
      try: async () => {
        const res = await container.fetch(
          switchPort(new Request('http://container/status'), 8080),
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        return await res.json() as { running: boolean; url?: string | null };
      },
      catch: (error) =>
        new BrowserError({
          message: `Failed to read container status: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        }),
    }),
  );
};


/**
 * Effect-based container operations
 *
 * Handles all interaction with Cloudflare Containers using Effect for
 * retries, timeouts, and error handling.
 */
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as Duration from 'effect/Duration';
import { pipe } from 'effect/Function';
import { getContainer, switchPort } from '@cloudflare/containers';
import { ContainerStartError, BrowserError, NavigationError, } from './errors.js';
function isRetryableError(error) {
    const msg = error instanceof Error ? error.message : String(error);
    return (msg.includes('Connection refused') ||
        msg.includes('container port not found') ||
        msg.includes('Monitor failed') ||
        msg.includes('The operation was aborted') ||
        msg.includes('timeout') ||
        msg.includes('Container crashed') ||
        (msg.includes('Container start failed') && !msg.includes('non-retryable')));
}
function isNonRetryableError(error) {
    const msg = error instanceof Error ? error.message : String(error);
    return (msg.includes('non-retryable') ||
        msg.includes('validation') ||
        msg.includes('invalid'));
}
/**
 * Circuit breaker state per session
 * Tracks consecutive failures and opens circuit after threshold
 */
const circuitBreakerState = new Map();
const CIRCUIT_BREAKER_THRESHOLD = 5; // Failures before opening
const CIRCUIT_BREAKER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CIRCUIT_BREAKER_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes cooldown
function checkCircuitBreaker(sessionId) {
    const state = circuitBreakerState.get(sessionId);
    if (!state)
        return true; // No failures yet, allow
    const now = Date.now();
    // Reset if outside failure window
    if (now - state.lastFailure > CIRCUIT_BREAKER_WINDOW_MS) {
        circuitBreakerState.delete(sessionId);
        return true;
    }
    // Check if circuit is open
    if (state.open) {
        // Check if cooldown period has passed
        if (now - state.lastFailure > CIRCUIT_BREAKER_COOLDOWN_MS) {
            // Reset circuit breaker
            circuitBreakerState.delete(sessionId);
            return true;
        }
        return false; // Circuit still open
    }
    return true; // Circuit closed, allow
}
function recordCircuitBreakerFailure(sessionId) {
    const state = circuitBreakerState.get(sessionId) || { failures: 0, lastFailure: 0, open: false };
    state.failures++;
    state.lastFailure = Date.now();
    if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
        state.open = true;
        console.warn(`[CircuitBreaker] ${sessionId.slice(0, 8)}: Circuit opened after ${state.failures} failures`);
    }
    circuitBreakerState.set(sessionId, state);
}
function recordCircuitBreakerSuccess(sessionId) {
    // Reset on success
    circuitBreakerState.delete(sessionId);
}
const containerRetrySchedule = pipe(Schedule.exponential(1000, 2), // 1s, 2s, 4s, 8s...
Schedule.union(Schedule.spaced(5000)), // Cap at 5s
Schedule.compose(Schedule.recurs(20)), // Max 20 attempts
Schedule.whileInput(isRetryableError));
/**
 * Start a browser container
 */
export const startBrowser = (containerNamespace, sessionId, options) => {
    // Check circuit breaker
    if (!checkCircuitBreaker(sessionId)) {
        return Effect.fail(new ContainerStartError({
            message: `Circuit breaker is open for session ${sessionId.slice(0, 8)}. Too many consecutive failures. Please wait before retrying.`,
            sessionId,
        }));
    }
    const container = getContainer(containerNamespace, sessionId);
    const body = JSON.stringify({
        viewport: options.viewport ?? { width: 1280, height: 720 },
        startUrl: options.startUrl,
        colorScheme: options.colorScheme ?? 'dark',
        apiKey: options.apiKey, // Pass API key to container
        fingerprint: options.fingerprint, // Pass fingerprint to container
    });
    return pipe(Effect.tryPromise({
        try: async () => {
            console.log(`[SDK] startBrowser: Calling container.fetch for ${sessionId.slice(0, 8)}`);
            const request = switchPort(new Request('http://container/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            }), 8080);
            console.log(`[SDK] startBrowser: Request created, calling container.fetch...`);
            const res = await container.fetch(request);
            console.log(`[SDK] startBrowser: Got response, status=${res.status}`);
            if (!res.ok) {
                const errorText = await res.text().catch(() => 'failed to read error');
                if (res.status >= 400 && res.status < 500) {
                    throw new Error(`Container start failed (non-retryable): ${errorText}`);
                }
                throw new Error(`Container start failed: ${errorText}`);
            }
            const data = (await res.json());
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
            if (isNonRetryableError(error)) {
                return new ContainerStartError({
                    message: error instanceof Error ? error.message : String(error),
                    sessionId,
                    cause: error,
                });
            }
            return error;
        },
    }), Effect.retry(containerRetrySchedule), Effect.timeoutFail({
        duration: Duration.seconds(120),
        onTimeout: () => new ContainerStartError({
            message: 'Container start timeout after 2 minutes',
            sessionId,
        }),
    }), Effect.mapError((error) => {
        if (error instanceof ContainerStartError)
            return error;
        return new ContainerStartError({
            message: error instanceof Error ? error.message : String(error),
            sessionId,
            cause: error,
        });
    }));
};
/**
 * Stop a browser container
 *
 * Best-effort: logs errors but doesn't fail (container may already be stopped)
 */
export const stopBrowser = (containerNamespace, sessionId) => {
    const container = getContainer(containerNamespace, sessionId);
    return pipe(Effect.tryPromise({
        try: async () => {
            await container.fetch(switchPort(new Request('http://container/stop', { method: 'POST' }), 8080));
        },
        catch: (error) => new BrowserError({
            message: `Failed to stop container: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
        }),
    }), Effect.catchAll((error) => {
        // Log error but don't fail - container may already be stopped/gone
        console.warn(`[stopBrowser] ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
        return Effect.void;
    }));
};
/**
 * Send an instruction to the container
 */
export const sendInstruction = (containerNamespace, sessionId, instruction) => {
    const container = getContainer(containerNamespace, sessionId);
    return pipe(Effect.tryPromise({
        try: async () => {
            console.log(`[SDK] sendInstruction starting for ${sessionId.slice(0, 8)}, instruction: ${instruction.substring(0, 50)}...`);
            const res = await container.fetch(switchPort(new Request('http://container/instruction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instruction }),
            }), 8080));
            console.log(`[SDK] sendInstruction got response, status=${res.status}, ok=${res.ok} for ${sessionId.slice(0, 8)}`);
            if (!res.ok) {
                const errorText = await res.text().catch(() => 'failed to read error');
                console.log(`[SDK] sendInstruction error response for ${sessionId.slice(0, 8)}:`, errorText);
                throw new Error(`Instruction failed: ${errorText}`);
            }
            const data = await res.json();
            console.log(`[SDK] sendInstruction parsed response for ${sessionId.slice(0, 8)}:`, JSON.stringify(data));
            console.log(`[SDK] sendInstruction returning data for ${sessionId.slice(0, 8)}:`, data);
            return data;
        },
        catch: (error) => {
            console.error(`[SDK] sendInstruction caught error for ${sessionId.slice(0, 8)}:`, error);
            return new BrowserError({
                message: `Failed to send instruction: ${error instanceof Error ? error.message : String(error)}`,
                cause: error,
            });
        },
    }));
};
/**
 * Resize browser viewport
 */
export const resizeBrowser = (containerNamespace, sessionId, viewport) => {
    const container = getContainer(containerNamespace, sessionId);
    return pipe(Effect.tryPromise({
        try: async () => {
            const res = await container.fetch(switchPort(new Request('http://container/resize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(viewport),
            }), 8080));
            if (!res.ok) {
                const errorText = await res.text().catch(() => 'failed to read error');
                throw new Error(`Resize failed: ${errorText}`);
            }
        },
        catch: (error) => new BrowserError({
            message: `Failed to resize: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
        }),
    }));
};
/**
 * Reload browser page
 */
export const reloadBrowser = (containerNamespace, sessionId) => {
    const container = getContainer(containerNamespace, sessionId);
    return pipe(Effect.tryPromise({
        try: async () => {
            const res = await container.fetch(switchPort(new Request('http://container/reload', { method: 'POST' }), 8080));
            if (!res.ok) {
                const errorText = await res.text().catch(() => 'failed to read error');
                throw new Error(`Reload failed: ${errorText}`);
            }
        },
        catch: (error) => new BrowserError({
            message: `Failed to reload: ${error instanceof Error ? error.message : String(error)}`,
            cause: error,
        }),
    }));
};
/**
 * Navigate browser to URL
 */
export const navigateBrowser = (containerNamespace, sessionId, url) => {
    return pipe(sendInstruction(containerNamespace, sessionId, `go to ${url}`), Effect.map(() => undefined), Effect.mapError((error) => new NavigationError({
        message: `Failed to navigate to ${url}: ${error.message}`,
        url,
        cause: error,
    })));
};
/**
 * Extract structured data from the current page
 */
export const extractData = (containerNamespace, sessionId, schema) => {
    const container = getContainer(containerNamespace, sessionId);
    return pipe(Effect.tryPromise({
        try: async () => {
            console.log(`[SDK] extractData starting for ${sessionId.slice(0, 8)}`);
            // Serialize Zod schema - we need to pass the schema definition
            // Stagehand expects the schema object directly, so we'll pass it as-is
            // The container will handle the actual extraction
            const res = await container.fetch(switchPort(new Request('http://container/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schema: schema._def, // Zod schema definition
                    instruction: 'Extract data matching the provided schema from the current page',
                }),
            }), 8080));
            console.log(`[SDK] extractData got response, status=${res.status}, ok=${res.ok} for ${sessionId.slice(0, 8)}`);
            if (!res.ok) {
                const errorText = await res.text().catch(() => 'failed to read error');
                console.log(`[SDK] extractData error response for ${sessionId.slice(0, 8)}:`, errorText);
                throw new Error(`Extraction failed: ${errorText}`);
            }
            const data = await res.json();
            if (!data.success || data.error) {
                throw new Error(data.error || 'Extraction failed');
            }
            // Validate with schema
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
    }));
};
//# sourceMappingURL=browser.js.map
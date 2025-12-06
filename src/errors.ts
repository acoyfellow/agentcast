/**
 * AgentCast Error Types
 * 
 * Structured error types using Effect's Data.TaggedError for type-safe error handling.
 */

import { Data } from 'effect';

// ============================================================================
// CONNECTION ERRORS
// ============================================================================

/**
 * Failed to connect to the AgentCast API
 */
export class ConnectionError extends Data.TaggedError('ConnectionError')<{
  readonly message: string;
  readonly url?: string;
  readonly cause?: unknown;
}> {}

/**
 * Connection timed out
 */
export class TimeoutError extends Data.TaggedError('TimeoutError')<{
  readonly message: string;
  readonly duration: number;
  readonly operation: string;
}> {}

/**
 * API returned an error response
 */
export class ApiError extends Data.TaggedError('ApiError')<{
  readonly message: string;
  readonly status: number;
  readonly body?: string;
}> {}

// ============================================================================
// SESSION ERRORS
// ============================================================================

/**
 * Session not found
 */
export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError')<{
  readonly message: string;
  readonly sessionId: string;
}> {}

/**
 * Session already stopped
 */
export class SessionStoppedError extends Data.TaggedError('SessionStoppedError')<{
  readonly message: string;
  readonly sessionId: string;
}> {}

/**
 * Session not connected (browser not ready)
 */
export class SessionNotConnectedError extends Data.TaggedError('SessionNotConnectedError')<{
  readonly message: string;
  readonly sessionId: string;
}> {}

// ============================================================================
// BROWSER ERRORS
// ============================================================================

/**
 * Browser failed to launch or crashed
 */
export class BrowserError extends Data.TaggedError('BrowserError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Page navigation failed
 */
export class NavigationError extends Data.TaggedError('NavigationError')<{
  readonly message: string;
  readonly url: string;
  readonly cause?: unknown;
}> {}

/**
 * Screenshot capture failed
 */
export class ScreenshotError extends Data.TaggedError('ScreenshotError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// ============================================================================
// CONTAINER ERRORS
// ============================================================================

/**
 * Container failed to start
 */
export class ContainerStartError extends Data.TaggedError('ContainerStartError')<{
  readonly message: string;
  readonly sessionId?: string;
  readonly cause?: unknown;
}> {}

/**
 * Container crashed unexpectedly
 */
export class ContainerCrashError extends Data.TaggedError('ContainerCrashError')<{
  readonly message: string;
  readonly sessionId?: string;
}> {}

// ============================================================================
// TYPE UNIONS
// ============================================================================

/**
 * All connection-related errors
 */
export type ConnectionErrors = ConnectionError | TimeoutError | ApiError;

/**
 * All session-related errors
 */
export type SessionErrors = SessionNotFoundError | SessionStoppedError | SessionNotConnectedError;

/**
 * All browser-related errors
 */
export type BrowserErrors = BrowserError | NavigationError | ScreenshotError;

/**
 * All container-related errors
 */
export type ContainerErrors = ContainerStartError | ContainerCrashError;

/**
 * All AgentCast errors
 */
export type AgentCastError = ConnectionErrors | SessionErrors | BrowserErrors | ContainerErrors;


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
export class ConnectionError extends Data.TaggedError('ConnectionError') {
}
/**
 * Connection timed out
 */
export class TimeoutError extends Data.TaggedError('TimeoutError') {
}
/**
 * API returned an error response
 */
export class ApiError extends Data.TaggedError('ApiError') {
}
// ============================================================================
// SESSION ERRORS
// ============================================================================
/**
 * Session not found
 */
export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError') {
}
/**
 * Session already stopped
 */
export class SessionStoppedError extends Data.TaggedError('SessionStoppedError') {
}
/**
 * Session not connected (browser not ready)
 */
export class SessionNotConnectedError extends Data.TaggedError('SessionNotConnectedError') {
}
// ============================================================================
// BROWSER ERRORS
// ============================================================================
/**
 * Browser failed to launch or crashed
 */
export class BrowserError extends Data.TaggedError('BrowserError') {
}
/**
 * Page navigation failed
 */
export class NavigationError extends Data.TaggedError('NavigationError') {
}
/**
 * Screenshot capture failed
 */
export class ScreenshotError extends Data.TaggedError('ScreenshotError') {
}
// ============================================================================
// CONTAINER ERRORS
// ============================================================================
/**
 * Container failed to start
 */
export class ContainerStartError extends Data.TaggedError('ContainerStartError') {
}
/**
 * Container crashed unexpectedly
 */
export class ContainerCrashError extends Data.TaggedError('ContainerCrashError') {
}
//# sourceMappingURL=errors.js.map
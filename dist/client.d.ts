/**
 * AgentCast - Client-safe exports
 *
 * This entry point exports only constants, types, and errors that are safe
 * to use in any environment (browser, Node.js, Workers).
 *
 * Use this for client applications (SvelteKit, React, etc.) that run in
 * non-Workers environments.
 *
 * @example
 * ```typescript
 * import { CLIENT_STATUS, SERVER_STATUS, type SessionStatus } from 'agentcast/client';
 * ```
 */
export { UNIFIED_STATUS, SERVER_STATUS, CLIENT_STATUS, SESSION_STATUS, ERROR_CODES, DEFAULTS, getWorkerUrl, DEFAULT_WORKER_URL, } from './constants.js';
export type { SessionStatus, SessionInfo, SessionEventMap, BrowserFingerprint, } from './types.js';
export { ConnectionError, TimeoutError, ApiError, SessionNotFoundError, SessionStoppedError, SessionNotConnectedError, BrowserError, NavigationError, ScreenshotError, ContainerStartError, ContainerCrashError, type AgentCastError, type ConnectionErrors, type SessionErrors, type BrowserErrors, type ContainerErrors, } from './errors.js';
//# sourceMappingURL=client.d.ts.map
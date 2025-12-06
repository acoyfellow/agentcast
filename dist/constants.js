/**
 * AgentCast Constants
 *
 * Centralized constants to avoid magic strings and enable type-safe checks
 */
// ============================================================================
// SESSION STATUS VALUES
// ============================================================================
/**
 * Unified session status values - single source of truth
 *
 * These are the core server-side statuses used throughout the system.
 * Client-side statuses are mapped from these values.
 */
export const UNIFIED_STATUS = {
    STOPPED: 'stopped',
    STARTING: 'starting',
    READY: 'ready',
    ERROR: 'error',
};
/**
 * Server-side session statuses (from container/worker)
 *
 * @deprecated Use UNIFIED_STATUS for new code. This constant is kept for backward compatibility.
 */
export const SERVER_STATUS = {
    STARTING: 'starting',
    READY: 'ready',
    ACTIVE: 'active',
    IDLE: 'idle',
    STOPPING: 'stopping',
    STOPPED: 'stopped',
    ERROR: 'error',
};
/**
 * Client-side session statuses (demo UI)
 *
 * @deprecated These are UI-specific statuses. Map from UNIFIED_STATUS instead.
 */
export const CLIENT_STATUS = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    DISABLED: 'disabled',
};
/**
 * All possible session statuses
 *
 * @deprecated Use UNIFIED_STATUS for server statuses. This constant is kept for backward compatibility.
 */
export const SESSION_STATUS = {
    ...SERVER_STATUS,
    ...CLIENT_STATUS,
};
// ============================================================================
// ERROR CODES
// ============================================================================
/**
 * Standard error codes returned by AgentCast APIs
 */
export const ERROR_CODES = {
    // Connection errors
    CONNECTION_ERROR: 'CONNECTION_ERROR',
    TIMEOUT: 'TIMEOUT',
    API_ERROR: 'API_ERROR',
    // Session errors
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    SESSION_STOPPED: 'SESSION_STOPPED',
    SESSION_NOT_CONNECTED: 'SESSION_NOT_CONNECTED',
    // Browser errors
    BROWSER_ERROR: 'BROWSER_ERROR',
    NAVIGATION_ERROR: 'NAVIGATION_ERROR',
    SCREENSHOT_ERROR: 'SCREENSHOT_ERROR',
    // Container errors
    CONTAINER_START_FAILED: 'CONTAINER_START_FAILED',
    CONTAINER_CRASHED: 'CONTAINER_CRASHED',
    BROWSER_NOT_READY: 'BROWSER_NOT_READY',
    BROWSER_START_FAILED: 'BROWSER_START_FAILED',
    RESIZE_FAILED: 'RESIZE_FAILED',
    RELOAD_FAILED: 'RELOAD_FAILED',
    INSTRUCTION_FAILED: 'INSTRUCTION_FAILED',
    // Validation errors
    INVALID_VIEWPORT: 'INVALID_VIEWPORT',
    MISSING_INSTRUCTION: 'MISSING_INSTRUCTION',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
};
// ============================================================================
// DEFAULT VALUES
// ============================================================================
export const DEFAULTS = {
    VIEWPORT: {
        WIDTH: 1280,
        HEIGHT: 720,
    },
    COLOR_SCHEME: 'dark',
    CONFIRMATION_TIMEOUT_MS: 60000,
};
// ============================================================================
// WORKER URL CONFIG
// ============================================================================
/**
 * Default worker URL for development only
 * For production, pass the URL explicitly or via env object
 */
export const DEFAULT_WORKER_URL = 'http://localhost:1337';
/**
 * Get the AgentCast worker URL.
 *
 * @param config - Either a URL string, or a Cloudflare env object containing WORKER_URL
 * @returns The worker URL
 *
 * @example
 * // Pass URL directly
 * getWorkerUrl('https://my-agent.workers.dev')
 *
 * @example
 * // Pass Cloudflare env object (in a Worker/DO)
 * getWorkerUrl(env) // reads env.WORKER_URL
 *
 * @example
 * // Development fallback
 * getWorkerUrl() // returns 'http://localhost:1337'
 */
export function getWorkerUrl(config) {
    if (typeof config === 'string')
        return config;
    if (config?.WORKER_URL)
        return config.WORKER_URL;
    return DEFAULT_WORKER_URL;
}
//# sourceMappingURL=constants.js.map
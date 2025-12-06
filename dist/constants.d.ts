/**
 * AgentCast Constants
 *
 * Centralized constants to avoid magic strings and enable type-safe checks
 */
/**
 * Unified session status values - single source of truth
 *
 * These are the core server-side statuses used throughout the system.
 * Client-side statuses are mapped from these values.
 */
export declare const UNIFIED_STATUS: {
    readonly STOPPED: "stopped";
    readonly STARTING: "starting";
    readonly READY: "ready";
    readonly ERROR: "error";
};
/**
 * Server-side session statuses (from container/worker)
 *
 * @deprecated Use UNIFIED_STATUS for new code. This constant is kept for backward compatibility.
 */
export declare const SERVER_STATUS: {
    readonly STARTING: "starting";
    readonly READY: "ready";
    readonly ACTIVE: "active";
    readonly IDLE: "idle";
    readonly STOPPING: "stopping";
    readonly STOPPED: "stopped";
    readonly ERROR: "error";
};
/**
 * Client-side session statuses (demo UI)
 *
 * @deprecated These are UI-specific statuses. Map from UNIFIED_STATUS instead.
 */
export declare const CLIENT_STATUS: {
    readonly CONNECTING: "connecting";
    readonly CONNECTED: "connected";
    readonly DISCONNECTED: "disconnected";
    readonly DISABLED: "disabled";
};
/**
 * All possible session statuses
 *
 * @deprecated Use UNIFIED_STATUS for server statuses. This constant is kept for backward compatibility.
 */
export declare const SESSION_STATUS: {
    readonly CONNECTING: "connecting";
    readonly CONNECTED: "connected";
    readonly DISCONNECTED: "disconnected";
    readonly DISABLED: "disabled";
    readonly STARTING: "starting";
    readonly READY: "ready";
    readonly ACTIVE: "active";
    readonly IDLE: "idle";
    readonly STOPPING: "stopping";
    readonly STOPPED: "stopped";
    readonly ERROR: "error";
};
/**
 * Standard error codes returned by AgentCast APIs
 */
export declare const ERROR_CODES: {
    readonly CONNECTION_ERROR: "CONNECTION_ERROR";
    readonly TIMEOUT: "TIMEOUT";
    readonly API_ERROR: "API_ERROR";
    readonly SESSION_NOT_FOUND: "SESSION_NOT_FOUND";
    readonly SESSION_STOPPED: "SESSION_STOPPED";
    readonly SESSION_NOT_CONNECTED: "SESSION_NOT_CONNECTED";
    readonly BROWSER_ERROR: "BROWSER_ERROR";
    readonly NAVIGATION_ERROR: "NAVIGATION_ERROR";
    readonly SCREENSHOT_ERROR: "SCREENSHOT_ERROR";
    readonly CONTAINER_START_FAILED: "CONTAINER_START_FAILED";
    readonly CONTAINER_CRASHED: "CONTAINER_CRASHED";
    readonly BROWSER_NOT_READY: "BROWSER_NOT_READY";
    readonly BROWSER_START_FAILED: "BROWSER_START_FAILED";
    readonly RESIZE_FAILED: "RESIZE_FAILED";
    readonly RELOAD_FAILED: "RELOAD_FAILED";
    readonly INSTRUCTION_FAILED: "INSTRUCTION_FAILED";
    readonly INVALID_VIEWPORT: "INVALID_VIEWPORT";
    readonly MISSING_INSTRUCTION: "MISSING_INSTRUCTION";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
};
export declare const DEFAULTS: {
    readonly VIEWPORT: {
        readonly WIDTH: 1280;
        readonly HEIGHT: 720;
    };
    readonly COLOR_SCHEME: "dark";
    readonly CONFIRMATION_TIMEOUT_MS: 60000;
};
/**
 * Default worker URL for development only
 * For production, pass the URL explicitly or via env object
 */
export declare const DEFAULT_WORKER_URL = "http://localhost:1337";
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
export declare function getWorkerUrl(config?: string | {
    WORKER_URL?: string;
}): string;
//# sourceMappingURL=constants.d.ts.map
/**
 * Unified session status type - single source of truth for server-side statuses
 *
 * This is the core status type used throughout the system for server-side status.
 * Client-side statuses are mapped from these values.
 *
 * @deprecated The full SessionStatus type below includes client statuses for backward compatibility.
 * Use UnifiedSessionStatus for new code.
 */
export type UnifiedSessionStatus = 'stopped' | 'starting' | 'ready' | 'error';
/**
 * Full session status type - includes both server and client statuses
 *
 * Server-side statuses (from container/worker):
 * - 'starting': Container spinning up
 * - 'ready': Browser ready, awaiting commands
 * - 'active': Commands being executed
 * - 'idle': Waiting for commands
 * - 'stopping': Shutting down
 * - 'stopped': Session ended
 * - 'error': Container failed to start or crashed
 *
 * Client-side statuses (demo UI):
 * - 'connecting': Attempting to connect to session
 * - 'connected': Successfully connected (maps to 'ready')
 * - 'disconnected': Lost connection (maps to 'stopped' or 'error')
 * - 'disabled': Session disabled by user
 */
export type SessionStatus = 'starting' | 'ready' | 'active' | 'idle' | 'stopping' | 'stopped' | 'error' | 'connecting' | 'connected' | 'disconnected' | 'disabled';
export interface SessionEventMap {
    /**
     * Fired when session is ready
     */
    ready: () => void;
    /**
     * Fired when session status changes
     */
    status: (status: SessionStatus) => void;
    /**
     * Fired when an error occurs
     */
    error: (error: Error) => void;
    /**
     * Fired when session stops
     */
    stop: () => void;
    /**
     * Fired when a human takes control via the view URL
     */
    'control:taken': () => void;
    /**
     * Fired when human releases control back to the agent
     */
    'control:released': () => void;
}
export interface SessionInfo {
    id: string;
    name?: string;
    status: SessionStatus;
    viewUrl: string;
    cdpUrl: string;
    createdAt: Date;
    lastActivity: Date;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface CreateSessionResponse {
    sessionId: string;
    viewUrl: string;
    cdpUrl: string;
}
export interface BrowserFingerprint {
    userAgent?: string;
    platform?: string;
    languages?: string[];
    screen?: {
        width: number;
        height: number;
        availWidth?: number;
        availHeight?: number;
        colorDepth?: number;
        pixelDepth?: number;
        devicePixelRatio?: number;
    };
    viewport?: {
        width: number;
        height: number;
    };
    timezone?: string;
    hardwareConcurrency?: number;
    maxTouchPoints?: number;
    fingerprint?: any;
}
//# sourceMappingURL=types.d.ts.map
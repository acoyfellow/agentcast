/**
 * AgentCast - Client-safe exports (default)
 *
 * This is the main entry point. It exports only constants, types, and errors
 * that are safe to use in any environment (browser, Node.js, Workers).
 *
 * For Workers-only functionality (BrowserAgent class),
 * import from 'agentcast'.
 *
 * @example Client usage (SvelteKit, React, etc.)
 * ```typescript
 * import { CLIENT_STATUS, SERVER_STATUS, type SessionStatus } from 'agentcast';
 * ```
 *
 * @example Workers usage (recommended)
 * ```typescript
 * import { BrowserAgent } from 'agentcast';
 * import { z } from 'zod';
 *
 * export class WebAgent extends BrowserAgent {
 *   protected getContainer() {
 *     return this.env.CONTAINER;
 *   }
 *
 *   async run() {
 *     await this.goto('https://example.com');
 *     await this.act('click the login button');
 *     const data = await this.extract(z.object({ title: z.string() }));
 *     return { data, watch: this.cdpUrl };
 *   }
 * }
 * ```
 */
export { UNIFIED_STATUS, SERVER_STATUS, CLIENT_STATUS, SESSION_STATUS, ERROR_CODES, DEFAULTS, getWorkerUrl, DEFAULT_WORKER_URL, } from './constants.js';
export type { SessionStatus, SessionInfo, SessionEventMap, BrowserFingerprint, } from './types.js';
export { ConnectionError, TimeoutError, ApiError, SessionNotFoundError, SessionStoppedError, SessionNotConnectedError, BrowserError, NavigationError, ScreenshotError, ContainerStartError, ContainerCrashError, type AgentCastError, type ConnectionErrors, type SessionErrors, type BrowserErrors, type ContainerErrors, } from './errors.js';
export { BrowserAgent, type SessionState } from './browser-agent.js';
//# sourceMappingURL=index.d.ts.map